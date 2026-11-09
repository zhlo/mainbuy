import React, { useState, useEffect, useCallback } from 'react';
import { generateStockDataset } from './data/mockStocks';
import {
  fetchOfficialStockData,
  fetchPrebuiltCloudSnapshot
} from './services/liveStockService';
import StockScreener from './components/StockScreener';
import StockDetail from './components/StockDetail';
import BrokerRadarView from './components/BrokerRadarView';
import FormulaModal from './components/FormulaModal';
import DataSourceModal from './components/DataSourceModal';

export default function App() {
  const [stocks, setStocks] = useState(() => generateStockDataset());
  const [activeView, setActiveView] = useState('screener'); // 'screener' | 'detail' | 'radar'
  const [selectedCode, setSelectedCode] = useState('2049');
  const [initialBrokerId, setInitialBrokerId] = useState('esun-chengzhong');
  const [pinnedCodes, setPinnedCodes] = useState(['2227', '2049', '2330']);
  const [isFormulaOpen, setIsFormulaOpen] = useState(false);
  const [isDataSourceOpen, setIsDataSourceOpen] = useState(false);
  const [themeMode, setThemeMode] = useState('classic'); // 'classic' | 'dark' | 'light'

  // 正式資料同步狀態
  const [syncState, setSyncState] = useState({
    status: 'idle', // 'idle' | 'syncing' | 'synced' | 'partial'
    syncedCount: 0,
    totalCount: 0,
    latestDate: '',
    brokerSource: '',
    errorMsg: ''
  });
  const [customLookupCode, setCustomLookupCode] = useState('');
  const [isLookingUpSingle, setIsLookingUpSingle] = useState(false);

  const [dataSourceConfig, setDataSourceConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('chipflow_datasource_config');
      return saved
        ? JSON.parse(saved)
        : { mode: 'live', finmindToken: '', refreshInterval: 5 };
    } catch {
      return { mode: 'live', finmindToken: '', refreshInterval: 5 };
    }
  });

  const handleSaveDataSourceConfig = cfg => {
    setDataSourceConfig(cfg);
    try {
      localStorage.setItem('chipflow_datasource_config', JSON.stringify(cfg));
    } catch {
      // ignore
    }
  };

  // 同步單一股票最新正式資料（含富邦/元大/宏遠券商網站真實分點日報表）
  const syncSingleStock = useCallback(
    async (code, existingStock = null, includeBrokerPortal = false) => {
      try {
        const updated = await fetchOfficialStockData(
          code,
          existingStock,
          dataSourceConfig.finmindToken,
          includeBrokerPortal
        );
        setStocks(prev => {
          const exists = prev.some(s => s.code === code);
          if (exists) {
            return prev.map(s => (s.code === code ? updated : s));
          }
          return [updated, ...prev];
        });
        if (updated.latestTradeDate) {
          setSyncState(prev => ({
            ...prev,
            status: 'synced',
            latestDate: updated.latestTradeDate,
            brokerSource: updated.hasRealBrokerReport
              ? '證交所/櫃買/券商分點日報表'
              : prev.brokerSource || 'FinMind + 證交所公開資料'
          }));
        }
        return updated;
      } catch {
        return null;
      }
    },
    [dataSourceConfig.finmindToken]
  );

  // 批次同步清單中所有個股的最新台股正式資料
  const syncAllStocksLive = useCallback(async () => {
    setSyncState(prev => ({
      ...prev,
      status: 'syncing',
      syncedCount: 0,
      totalCount: stocks.length,
      errorMsg: ''
    }));

    // 步驟 1：優先讀取雲端 GitHub Actions 從證交所/櫃買中心/券商網站預先抓取的 /live-data.json 快照
    const cloudSnapshot = await fetchPrebuiltCloudSnapshot();
    if (cloudSnapshot && Array.isArray(cloudSnapshot.stocks)) {
      setStocks(cloudSnapshot.stocks);
      setSyncState({
        status: 'synced',
        syncedCount: cloudSnapshot.stocks.length,
        totalCount: cloudSnapshot.stocks.length,
        latestDate: cloudSnapshot.latestDate || '',
        brokerSource: '證交所/櫃買中心 + 券商網站分點日報表',
        errorMsg: ''
      });
      return;
    }

    // 步驟 2：若無預建快照，直接由瀏覽器平行向 FinMind 與券商分點網站抓取
    let successCount = 0;
    let latestDateFound = '';

    const ordered = [...stocks].sort((a, b) => {
      if (a.code === selectedCode) return -1;
      if (b.code === selectedCode) return 1;
      return 0;
    });

    for (let i = 0; i < ordered.length; i++) {
      const target = ordered[i];
      // 針對目前選中個股與前 3 檔重點股同步抓取券商網站分點日報表
      const fetchBrokerToo = i < 3 || target.code === selectedCode;
      const updated = await syncSingleStock(target.code, target, fetchBrokerToo);
      if (updated) {
        successCount++;
        if (updated.latestTradeDate) latestDateFound = updated.latestTradeDate;
      }
      setSyncState(prev => ({
        ...prev,
        syncedCount: i + 1,
        latestDate: latestDateFound || prev.latestDate
      }));
    }

    setSyncState(prev => ({
      ...prev,
      status: successCount > 0 ? 'synced' : 'partial',
      errorMsg:
        successCount === 0
          ? '目前網路環境無法直連外部公開 API，已自動使用內建高擬真資料庫'
          : ''
    }));
  }, [stocks, selectedCode, syncSingleStock]);

  useEffect(() => {
    if (dataSourceConfig.mode === 'live') {
      syncAllStocksLive();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 使用者輸入任意 4 碼台股代號即時抓取正式資料（含券商分點日報表）並打開個股 K 線
  const handleLookupAnyStock = async e => {
    e.preventDefault();
    const code = customLookupCode.trim();
    if (!code) return;

    const existing = stocks.find(s => s.code === code || s.name.includes(code));
    const targetCode = existing ? existing.code : code;

    setIsLookingUpSingle(true);
    const updated = await syncSingleStock(targetCode, existing || null, true);
    setIsLookingUpSingle(false);

    if (updated) {
      setSelectedCode(updated.code);
      if (updated.realBrokerReports?.[1]?.buyers?.[0]?.id) {
        setInitialBrokerId(updated.realBrokerReports[1].buyers[0].id);
      }
      setActiveView('detail');
      setCustomLookupCode('');
    } else if (existing) {
      setSelectedCode(existing.code);
      setActiveView('detail');
      setCustomLookupCode('');
    } else {
      alert(`查無台股代號「${code}」或公開 API 連線受限，請確認代號是否為 4 碼上市櫃股票（如 2317、3231、3017）。`);
    }
  };

  const selectedStock = stocks.find(s => s.code === selectedCode) || stocks[0];

  const handleSelectStock = code => {
    setSelectedCode(code);
    setActiveView('detail');
    const target = stocks.find(s => s.code === code);
    if (target && !target.hasRealBrokerReport && dataSourceConfig.mode === 'live') {
      syncSingleStock(code, target, true);
    }
  };

  const handleSelectStockWithBroker = (code, brokerId) => {
    setSelectedCode(code);
    if (brokerId) setInitialBrokerId(brokerId);
    setActiveView('detail');
  };

  const handleTogglePin = code => {
    setPinnedCodes(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const currentSurfaceTheme =
    themeMode === 'dark'
      ? 'theme-dark'
      : themeMode === 'light'
        ? 'theme-light'
        : activeView === 'screener' || activeView === 'radar'
          ? 'theme-dark'
          : 'theme-light';

  return (
    <div className={`app-shell ${currentSurfaceTheme}`}>
      {/* 全域頂部導覽列 */}
      <header className="global-navbar" id="global-navbar">
        <div className="brand-area">
          <div className="brand-logo">籌</div>
          <div>
            <h1 className="brand-title">籌碼K線・主力分點選股雷達</h1>
            <span className="brand-subtitle">
              {syncState.status === 'syncing'
                ? `🔄 正在同步證交所/櫃買/券商分點正式資料 (${syncState.syncedCount}/${syncState.totalCount})...`
                : syncState.status === 'synced'
                  ? `🟢 正式資料連線中 (${syncState.brokerSource || '證交所/FinMind'}｜最新日: ${syncState.latestDate})`
                  : '台股主力集中度 / 神秘分點 / 投信連買 / 隔日沖鎖碼即時監控'}
            </span>
          </div>
        </div>

        {/* 主視圖切換頁籤 */}
        <nav className="main-view-tabs" aria-label="主功能切換">
          <button
            className={`nav-tab-btn ${activeView === 'screener' ? 'active' : ''}`}
            onClick={() => setActiveView('screener')}
            id="nav-btn-screener"
          >
            <span className="tab-step">1</span>
            <span>籌碼選股與即時監控 (圖1)</span>
          </button>
          <button
            className={`nav-tab-btn ${activeView === 'detail' ? 'active' : ''}`}
            onClick={() => setActiveView('detail')}
            id="nav-btn-detail"
          >
            <span className="tab-step">2</span>
            <span>個股籌碼K線：{selectedStock.code} {selectedStock.name} (圖2)</span>
          </button>
          <button
            className={`nav-tab-btn ${activeView === 'radar' ? 'active' : ''}`}
            onClick={() => setActiveView('radar')}
            id="nav-btn-radar"
          >
            <span className="tab-step">3</span>
            <span>主力分點反查 & 隔日沖雷達</span>
          </button>
          <button
            className="nav-tab-btn formula-btn"
            onClick={() => setIsFormulaOpen(true)}
            id="nav-btn-formula"
          >
            <span>欄位與公式說明 (圖3)</span>
          </button>
        </nav>

        {/* 動態查詢任意台股代號 + 同步正式資料按鈕 + 外觀模式 */}
        <div className="navbar-right-controls">
          <form className="live-lookup-form" onSubmit={handleLookupAnyStock}>
            <input
              type="text"
              className="live-lookup-input"
              placeholder="輸入任意台股代號(如 2317, 3231)..."
              value={customLookupCode}
              onChange={e => setCustomLookupCode(e.target.value)}
              id="input-live-stock-lookup"
            />
            <button
              type="submit"
              className="btn-live-lookup"
              disabled={isLookingUpSingle}
              id="btn-submit-live-lookup"
            >
              {isLookingUpSingle ? '抓取中...' : '➕ 抓正式股價&分點'}
            </button>
          </form>

          <button
            className="quick-stock-btn live-sync-btn"
            onClick={syncAllStocksLive}
            disabled={syncState.status === 'syncing'}
            title="立即從證交所/櫃買中心/券商分點網站與 FinMind 同步最新正式資料"
            id="btn-sync-live-all"
          >
            {syncState.status === 'syncing'
              ? `同步中(${syncState.syncedCount}/${syncState.totalCount})`
              : '🔄 同步最新正式資料'}
          </button>

          <select
            className="theme-mode-select"
            value={themeMode}
            onChange={e => setThemeMode(e.target.value)}
            id="select-theme-mode"
            title="切換配色模式"
          >
            <option value="classic">原版配色 (圖1黑底 / 圖2白底)</option>
            <option value="dark">全深色看盤模式</option>
            <option value="light">全淺色分析模式</option>
          </select>

          <button
            className="quick-stock-btn"
            onClick={() => setIsDataSourceOpen(true)}
            title="資料來源與 API 串接設定"
            id="btn-open-datasource"
          >
            ⚙️ 資料源
          </button>
        </div>
      </header>

      {/* 主要內容區 */}
      <main className="main-workspace">
        {activeView === 'screener' ? (
          <StockScreener
            stocks={stocks}
            pinnedCodes={pinnedCodes}
            onTogglePin={handleTogglePin}
            onSelectStock={handleSelectStock}
            onOpenFormulaModal={() => setIsFormulaOpen(true)}
          />
        ) : activeView === 'radar' ? (
          <BrokerRadarView
            stocks={stocks}
            onSelectStockWithBroker={handleSelectStockWithBroker}
          />
        ) : (
          <StockDetail
            stock={selectedStock}
            allStocks={stocks}
            initialBrokerId={initialBrokerId}
            onSelectStock={handleSelectStock}
            onBackToScreener={() => setActiveView('screener')}
            onOpenFormulaModal={() => setIsFormulaOpen(true)}
          />
        )}
      </main>

      {/* 欄位與公式說明彈窗 (對應圖 3) */}
      <FormulaModal isOpen={isFormulaOpen} onClose={() => setIsFormulaOpen(false)} />

      {/* 資料源與 API 設定彈窗 */}
      <DataSourceModal
        isOpen={isDataSourceOpen}
        onClose={() => setIsDataSourceOpen(false)}
        dataSourceConfig={dataSourceConfig}
        onSaveConfig={handleSaveDataSourceConfig}
        onTriggerSync={syncAllStocksLive}
        syncState={syncState}
      />
    </div>
  );
}
