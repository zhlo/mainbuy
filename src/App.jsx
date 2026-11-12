import React, { useState, useEffect, useCallback } from 'react';
import { generateStockDataset, generateTaiexDataset } from './data/mockStocks';
import {
  fetchOfficialStockData,
  fetchOfficialTaiexData,
  fetchPrebuiltCloudSnapshot,
  hydrateStockBrokerSeries,
  loadCachedStocksFromStorage,
  saveStockToLocalCache
} from './services/liveStockService';
import { isDeviceAuthenticated, logoutAndLockDevice } from './services/authService';
import StockScreener from './components/StockScreener';
import StockDetail from './components/StockDetail';
import BrokerRadarView from './components/BrokerRadarView';
import FormulaModal from './components/FormulaModal';
import DataSourceModal from './components/DataSourceModal';
import AuthGateModal from './components/AuthGateModal';
import PinChangeModal from './components/PinChangeModal';

export default function App() {
  // 私人安全門禁驗證狀態（支援 30 天記住裝置免重複輸入）
  const [isAuthenticated, setIsAuthenticated] = useState(() => isDeviceAuthenticated());
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  // 初始化時立即載入本機快取個股，實現 0 秒瞬開
  const [stocks, setStocks] = useState(() => {
    const base = generateStockDataset();
    const cachedMap = loadCachedStocksFromStorage();
    const baseCodes = new Set(base.map(s => s.code));
    const merged = base.map(s =>
      cachedMap[s.code] ? hydrateStockBrokerSeries({ ...s, ...cachedMap[s.code] }) : s
    );
    Object.values(cachedMap).forEach(cs => {
      if (cs?.code && !baseCodes.has(cs.code) && Array.isArray(cs.kline)) {
        merged.unshift(hydrateStockBrokerSeries(cs));
      }
    });
    return merged;
  });

  const [taiexData, setTaiexData] = useState(() => generateTaiexDataset(stocks));

  const [activeView, setActiveView] = useState('screener'); // 'screener' | 'detail' | 'radar'
  const [selectedCode, setSelectedCode] = useState('2330');
  const [initialBrokerId, setInitialBrokerId] = useState('');
  // 自選股清單（持久化於 localStorage: mainbuy_watchlist_codes）
  const [pinnedCodes, setPinnedCodes] = useState(() => {
    try {
      const saved = localStorage.getItem('mainbuy_watchlist_codes');
      return saved ? JSON.parse(saved) : ['2330', '2345', '2317', '2454'];
    } catch {
      return ['2330', '2345', '2317', '2454'];
    }
  });
  const [toastMessage, setToastMessage] = useState('');
  const [isFormulaOpen, setIsFormulaOpen] = useState(false);
  const [isDataSourceOpen, setIsDataSourceOpen] = useState(false);
  const [themeMode, setThemeMode] = useState('dark'); // 'dark' | 'classic' | 'light'

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

  // 同步單一股票最新正式資料（含富邦/元大/宏遠券商網站真實分點日報表）並自動寫入本機快取
  const syncSingleStock = useCallback(
    async (code, existingStock = null, includeBrokerPortal = false) => {
      if (code === 'TAIEX') {
        const updatedTaiex = await fetchOfficialTaiexData(
          dataSourceConfig.finmindToken,
          existingStock || taiexData
        );
        if (updatedTaiex) setTaiexData(updatedTaiex);
        return updatedTaiex;
      }
      try {
        const updated = await fetchOfficialStockData(
          code,
          existingStock,
          dataSourceConfig.finmindToken,
          includeBrokerPortal
        );
        saveStockToLocalCache(updated);
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
    [dataSourceConfig.finmindToken, taiexData]
  );

  // 批次加入多檔股票或整組族群概念股至選股池與本機快取（支援即時進度通知）
  const handleBatchAddStocks = useCallback(
    async (rawCodes = [], onProgress) => {
      const uniqueCodes = [...new Set(rawCodes.map(c => String(c).trim()).filter(Boolean))];
      if (uniqueCodes.length === 0) return { success: 0, total: 0 };

      let successCount = 0;
      const total = uniqueCodes.length;

      for (let i = 0; i < total; i++) {
        const code = uniqueCodes[i];
        const existing = stocks.find(s => s.code === code);
        const currentName = existing?.name || '';

        // 抓取前通知進度
        if (onProgress) {
          onProgress({
            current: i + 1,
            total,
            code,
            name: currentName,
            percent: Math.round((i / total) * 100),
            status: 'fetching'
          });
        }

        const updated = await syncSingleStock(code, existing || null, true);
        if (updated) {
          successCount++;
        }

        // 抓取完成通知進度
        if (onProgress) {
          onProgress({
            current: i + 1,
            total,
            code,
            name: updated?.name || currentName,
            percent: Math.round(((i + 1) / total) * 100),
            status: 'done',
            successCount
          });
        }
      }
      return { success: successCount, total: uniqueCodes.length };
    },
    [stocks, syncSingleStock]
  );

  // 批次同步清單中所有個股與大盤加權指數的最新台股正式資料
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
      if (cloudSnapshot.taiex) {
        setTaiexData(cloudSnapshot.taiex);
      }
      // 背景同步最新大盤加權指數與台指期
      fetchOfficialTaiexData(
        dataSourceConfig.finmindToken,
        cloudSnapshot.taiex || generateTaiexDataset(cloudSnapshot.stocks)
      )
        .then(liveTaiex => {
          if (liveTaiex) setTaiexData(liveTaiex);
        })
        .catch(() => {});

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

    // 步驟 2：若無預建快照，直接由瀏覽器向公開 API 與券商分點網站抓取
    fetchOfficialTaiexData(dataSourceConfig.finmindToken, taiexData)
      .then(liveTaiex => {
        if (liveTaiex) setTaiexData(liveTaiex);
      })
      .catch(() => {});

    let successCount = 0;
    let latestDateFound = '';

    const ordered = [...stocks].sort((a, b) => {
      if (a.code === selectedCode) return -1;
      if (b.code === selectedCode) return 1;
      return 0;
    });

    for (let i = 0; i < ordered.length; i++) {
      const target = ordered[i];
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
          ? '目前網路環境無法直連外部公開 API，已自動使用內建基準資料庫'
          : ''
    }));
  }, [stocks, selectedCode, syncSingleStock, dataSourceConfig.finmindToken, taiexData]);

  const handleUnlockSuccess = () => {
    setIsAuthenticated(true);
    setToastMessage('🔓 通行驗證成功，歡迎進入 MainBuy 私人工作站');
    setTimeout(() => setToastMessage(''), 2500);
  };

  const handleLockDevice = () => {
    logoutAndLockDevice();
    setIsAuthenticated(false);
    setToastMessage('🔒 系統已安全鎖定，需重新輸入 PIN 碼');
    setTimeout(() => setToastMessage(''), 2500);
  };

  useEffect(() => {
    if (isAuthenticated && dataSourceConfig.mode === 'live') {
      syncAllStocksLive();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // 使用者輸入任意 4 碼台股代號或名稱：若已快取則 0 秒打開並背景更新，若未快取則即時抓取並永久快取
  const handleLookupAnyStock = async e => {
    e.preventDefault();
    const q = customLookupCode.trim();
    if (!q) return;

    if (q.toUpperCase() === 'TAIEX' || q.includes('加權') || q.includes('大盤')) {
      setSelectedCode('TAIEX');
      setActiveView('detail');
      setCustomLookupCode('');
      syncSingleStock('TAIEX', taiexData, false);
      return;
    }

    const existing = stocks.find(s => s.code === q || s.name.includes(q));
    if (existing && existing.hasRealBrokerReport) {
      // 已在選股池或快取中且具備分點資料 -> 0 秒切換，背景靜默更新
      setSelectedCode(existing.code);
      setInitialBrokerId('');
      setActiveView('detail');
      setCustomLookupCode('');
      syncSingleStock(existing.code, existing, true);
      return;
    }

    const targetCode = existing ? existing.code : q;
    setIsLookingUpSingle(true);
    const updated = await syncSingleStock(targetCode, existing || null, true);
    setIsLookingUpSingle(false);

    if (updated) {
      setSelectedCode(updated.code);
      setInitialBrokerId('');
      setActiveView('detail');
      setCustomLookupCode('');
    } else if (existing) {
      setSelectedCode(existing.code);
      setInitialBrokerId('');
      setActiveView('detail');
      setCustomLookupCode('');
    } else {
      alert(`查無台股代號「${q}」或公開 API 連線受限，請確認代號是否為 4 碼上市櫃股票（如 2317、3231、3017、8069）。`);
    }
  };

  const selectedStock =
    selectedCode === 'TAIEX'
      ? taiexData
      : stocks.find(s => s.code === selectedCode) || stocks[0];

  const handleSelectStock = code => {
    setSelectedCode(code);
    setInitialBrokerId('');
    setActiveView('detail');
    if (code === 'TAIEX') {
      if (dataSourceConfig.mode === 'live') {
        syncSingleStock('TAIEX', taiexData, false);
      }
      return;
    }
    const target = stocks.find(s => s.code === code);
    if (target) {
      saveStockToLocalCache(target);
      if (!target.hasRealBrokerReport && dataSourceConfig.mode === 'live') {
        syncSingleStock(code, target, true);
      }
    }
  };

  const handleSelectStockWithBroker = (code, brokerId) => {
    setSelectedCode(code);
    setInitialBrokerId(brokerId || '');
    setActiveView('detail');
  };

  // 切換加入/移除自選股，並寫入 localStorage 與彈出 Toast
  const handleTogglePin = useCallback(
    code => {
      if (!code || code === 'TAIEX') return;
      setPinnedCodes(prev => {
        const isAdding = !prev.includes(code);
        const next = isAdding ? [...prev, code] : prev.filter(c => c !== code);
        try {
          localStorage.setItem('mainbuy_watchlist_codes', JSON.stringify(next));
        } catch {}

        const target = stocks.find(s => s.code === code);
        const namePart = target ? ` ${target.name}` : '';
        setToastMessage(
          isAdding
            ? `⭐ 已將【${code}${namePart}】加入我的自選股！`
            : `已將【${code}${namePart}】從自選股移除`
        );
        setTimeout(() => setToastMessage(''), 2500);
        return next;
      });
    },
    [stocks]
  );

  // 輸入代號直接加入自選股
  const handleAddCustomWatchlist = async () => {
    const q = customLookupCode.trim();
    if (!q || q.toUpperCase() === 'TAIEX') return;

    let targetCode = q;
    let existing = stocks.find(s => s.code === q || s.name.includes(q));
    if (!existing) {
      setIsLookingUpSingle(true);
      existing = await syncSingleStock(q, null, true);
      setIsLookingUpSingle(false);
    }
    if (existing) {
      targetCode = existing.code;
    }

    setPinnedCodes(prev => {
      if (prev.includes(targetCode)) {
        setToastMessage(`ℹ️【${targetCode}${existing ? ` ${existing.name}` : ''}】已在自選股中`);
        setTimeout(() => setToastMessage(''), 2200);
        return prev;
      }
      const next = [...prev, targetCode];
      try {
        localStorage.setItem('mainbuy_watchlist_codes', JSON.stringify(next));
      } catch {}
      setToastMessage(
        `⭐ 成功將【${targetCode}${existing ? ` ${existing.name}` : ''}】加入我的自選股！`
      );
      setTimeout(() => setToastMessage(''), 2500);
      return next;
    });
    setCustomLookupCode('');
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
      {!isAuthenticated ? (
        <AuthGateModal onUnlockSuccess={handleUnlockSuccess} />
      ) : (
        <>
          {/* 全域頂部導覽列 */}
          <header className="global-navbar" id="global-navbar">
            <div
              className="brand-area"
              onClick={() => setActiveView('screener')}
              style={{ cursor: 'pointer' }}
              title="點擊返回主力選股首頁"
              id="brand-home-link"
            >
              <div className="brand-logo">M</div>
              <div>
                <h1 className="brand-title">MainBuy 主力雷達</h1>
                <span className="brand-subtitle">
                  {syncState.status === 'syncing'
                    ? `🔄 正在同步證交所/櫃買/券商分點正式資料 (${syncState.syncedCount}/${syncState.totalCount})...`
                    : syncState.status === 'synced'
                      ? `🟢 正式資料連線中 (${syncState.brokerSource || '證交所/FinMind'}｜最新日: ${syncState.latestDate})`
                      : '台股主力買賣・投信轉折・關鍵分點動能選股系統'}
                </span>
              </div>
            </div>

            {/* 主視圖切換頁籤：1.主力選股 / 2.個股K線 / 3.分點反查 */}
            <nav className="main-view-tabs" aria-label="主功能切換">
              <button
                className={`nav-tab-btn ${activeView === 'screener' ? 'active' : ''}`}
                onClick={() => setActiveView('screener')}
                id="nav-btn-screener"
              >
                <span className="tab-step">1</span>
                <span>主力選股 (動能轉折快篩)</span>
              </button>
              <button
                className={`nav-tab-btn ${activeView === 'detail' ? 'active' : ''}`}
                onClick={() => setActiveView('detail')}
                id="nav-btn-detail"
              >
                <span className="tab-step">2</span>
                <span>
                  {selectedStock.code === 'TAIEX'
                    ? `大盤K線：加權指數 (${selectedStock.price?.toLocaleString()})`
                    : `個股K線：${selectedStock.code} ${selectedStock.name}`}
                </span>
              </button>
              <button
                className={`nav-tab-btn ${activeView === 'radar' ? 'active' : ''}`}
                onClick={() => setActiveView('radar')}
                id="nav-btn-radar"
              >
                <span className="tab-step">3</span>
                <span>分點反查 & 隔日沖雷達</span>
              </button>
              <button
                className="nav-tab-btn formula-btn"
                onClick={() => setIsFormulaOpen(true)}
                id="nav-btn-formula"
              >
                <span>指標與公式說明</span>
              </button>
            </nav>

            {/* 動態查詢任意台股代號（自動快取秒開） + 同步正式資料按鈕 + 外觀模式 */}
            <div className="navbar-right-controls">
              <form className="live-lookup-form" onSubmit={handleLookupAnyStock}>
                <input
                  type="text"
                  className="live-lookup-input"
                  placeholder="搜尋台股代號/名稱(自動快取)..."
                  value={customLookupCode}
                  onChange={e => setCustomLookupCode(e.target.value)}
                  id="input-live-stock-lookup"
                />
                <button
                  type="submit"
                  className="btn-live-lookup"
                  disabled={isLookingUpSingle}
                  id="btn-submit-live-lookup"
                  title="查詢個股即時走勢與主力分點報表"
                >
                  {isLookingUpSingle ? '抓取中...' : '🔍 查股&快取'}
                </button>
                <button
                  type="button"
                  className="btn-live-add-watchlist"
                  onClick={handleAddCustomWatchlist}
                  disabled={isLookingUpSingle || !customLookupCode.trim()}
                  id="btn-add-custom-watchlist"
                  title="輸入代號直接加入我的自選股並自動快取"
                >
                  ⭐ 加自選
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
                <option value="dark">全深色旗艦模式 (推薦)</option>
                <option value="classic">雙模配色 (選股黑底 / K線白底)</option>
                <option value="light">全淺色分析模式</option>
              </select>

              <button
                className="quick-stock-btn"
                onClick={() => setIsDataSourceOpen(true)}
                title="資料來源與本機快取管理"
                id="btn-open-datasource"
              >
                ⚙️ 資料源
              </button>

              <button
                className="quick-stock-btn btn-pin-settings"
                onClick={() => setIsPinModalOpen(true)}
                title="修改私人通行 PIN 碼"
                id="btn-open-pin-modal"
              >
                🔑 改 PIN
              </button>
              <button
                className="quick-stock-btn btn-lock-system"
                onClick={handleLockDevice}
                title="安全登出並鎖定本機裝置"
                id="btn-lock-device"
              >
                🔒 鎖定
              </button>
            </div>
          </header>

          {/* 主要內容區 */}
          <main className="main-workspace">
            {activeView === 'screener' ? (
              <StockScreener
                stocks={stocks}
                taiexData={taiexData}
                pinnedCodes={pinnedCodes}
                onTogglePin={handleTogglePin}
                onSelectStock={handleSelectStock}
                onBatchAddStocks={handleBatchAddStocks}
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
                taiexData={taiexData}
                initialBrokerId={initialBrokerId}
                watchlistCodes={pinnedCodes}
                onToggleWatchlist={handleTogglePin}
                onSelectStock={handleSelectStock}
                onBackToScreener={() => setActiveView('screener')}
                onOpenFormulaModal={() => setIsFormulaOpen(true)}
              />
            )}
          </main>

          {/* 全站常駐免責與個人研究聲明頁尾 */}
          <footer className="app-global-footer" id="app-global-disclaimer-footer">
            <div className="footer-disclaimer-inner">
              <span className="footer-disclaimer-badge">⚠️ 私人研究聲明</span>
              <p className="footer-disclaimer-text">
                本站為個人策略研究與學術分析專用系統，非公開營業平台，亦不構成任何證券之要約、推薦或投資買賣建議。市場行情與券商分點數據可能因公佈時間差而存在延遲或非最新，亦可能存在計算偏差。投資請獨立審慎判斷並自負盈虧。
              </p>
            </div>
          </footer>
        </>
      )}

      {/* 全局自選股與操作 Toast 提示通知 */}
      {toastMessage && (
        <div className="floating-toast-notification" id="app-floating-toast">
          {toastMessage}
        </div>
      )}

      {/* 欄位與公式說明彈窗 */}
      <FormulaModal isOpen={isFormulaOpen} onClose={() => setIsFormulaOpen(false)} />

      {/* 修改 PIN 碼彈窗 */}
      <PinChangeModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onPinChanged={() => {
          setToastMessage('✅ 私人 PIN 碼修改成功！');
          setTimeout(() => setToastMessage(''), 2500);
        }}
      />

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
