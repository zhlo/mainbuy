import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { useIsMobile } from './hooks/useIsMobile';
import StockScreener from './components/StockScreener';
import StockDetail from './components/StockDetail';
import BrokerRadarView from './components/BrokerRadarView';
import FormulaModal from './components/FormulaModal';
import DataSourceModal from './components/DataSourceModal';
import AuthGateModal from './components/AuthGateModal';
import PinChangeModal from './components/PinChangeModal';

export default function App() {
  const isMobile = useIsMobile(768);

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
  const [screenerScope, setScreenerScope] = useState('ALL'); // 'ALL' | 'PINNED' | 'LISTED' | 'OTC' | 'CACHED'
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

  // 預設深色黑底模式 (Dark Mode)
  const [themeMode, setThemeMode] = useState(() => {
    try {
      return localStorage.getItem('mainbuy_theme_mode') || 'dark';
    } catch {
      return 'dark';
    }
  });

  // 手機閱讀字級模式：'standard' (標準放大字級) | 'xlarge' (特大字模式)
  const [fontScale, setFontScale] = useState(() => {
    try {
      return localStorage.getItem('mainbuy_font_scale') || 'standard';
    } catch {
      return 'standard';
    }
  });

  // 手機專屬頂部搜尋展開與右上角「☰ 更多」選單狀態
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);
  const [batchModalTrigger, setBatchModalTrigger] = useState(0);
  const screenerCsvExportRef = useRef(null);

  // 手機下拉更新 (Pull-to-Refresh) 狀態
  const [pullDistance, setPullDistance] = useState(0);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const pullTouchStartRef = useRef({ x: 0, y: 0, active: false });

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

  const handleChangeThemeMode = nextTheme => {
    setThemeMode(nextTheme);
    try {
      localStorage.setItem('mainbuy_theme_mode', nextTheme);
    } catch {
      // ignore
    }
  };

  const handleChangeFontScale = nextScale => {
    setFontScale(nextScale);
    try {
      localStorage.setItem('mainbuy_font_scale', nextScale);
    } catch {
      // ignore
    }
  };

  const handleToggleFontScale = () => {
    const next = fontScale === 'xlarge' ? 'standard' : 'xlarge';
    handleChangeFontScale(next);
    setToastMessage(next === 'xlarge' ? '🔍 已切換為「特大字模式」' : '🔤 已切換為「標準字級」');
    setTimeout(() => setToastMessage(''), 2000);
  };

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

  const selectedStock =
    selectedCode === 'TAIEX'
      ? taiexData
      : stocks.find(s => s.code === selectedCode) || stocks[0];

  // 手機頁頂下拉更新 (Pull-to-Refresh) 執行函式
  const executePullRefresh = useCallback(async () => {
    if (isPullRefreshing) return;
    setIsPullRefreshing(true);
    try {
      await syncAllStocksLive();
      if (activeView === 'detail' && selectedCode && selectedCode !== 'TAIEX') {
        const currentTarget = stocks.find(s => s.code === selectedCode);
        await syncSingleStock(selectedCode, currentTarget || null, true);
      }
      setToastMessage('✅ 已更新至最新雲端股價、法人與分點資料');
      setTimeout(() => setToastMessage(''), 2300);
    } finally {
      setIsPullRefreshing(false);
      setPullDistance(0);
    }
  }, [isPullRefreshing, syncAllStocksLive, activeView, selectedCode, stocks, syncSingleStock]);

  // 綁定手機頁頂下拉更新手勢（僅於頁面頂端垂直下拉時觸發，不干擾 K 線橫向滑動查價）
  useEffect(() => {
    if (!isMobile || !isAuthenticated) return undefined;

    const hasModalOpen =
      isMobileMoreOpen || isFormulaOpen || isDataSourceOpen || isPinModalOpen;
    if (hasModalOpen) return undefined;

    const onTouchStart = e => {
      if (window.scrollY > 4 || isPullRefreshing) {
        pullTouchStartRef.current.active = false;
        return;
      }
      // 避免在彈窗或可捲動抽屜內誤觸發
      if (e.target && e.target.closest && e.target.closest('.modal-backdrop, .mobile-bottom-sheet-backdrop, .kline-interactive-area')) {
        pullTouchStartRef.current.active = false;
        return;
      }
      const touch = e.touches[0];
      if (!touch) return;
      pullTouchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        active: true
      };
    };

    const onTouchMove = e => {
      if (!pullTouchStartRef.current.active || isPullRefreshing) return;
      if (window.scrollY > 4) {
        pullTouchStartRef.current.active = false;
        setPullDistance(0);
        return;
      }
      const touch = e.touches[0];
      if (!touch) return;
      const dy = touch.clientY - pullTouchStartRef.current.y;
      const dx = touch.clientX - pullTouchStartRef.current.x;

      if (dy > 8 && Math.abs(dy) > Math.abs(dx) * 1.4) {
        const damped = Math.min(105, Math.round(dy * 0.48));
        setPullDistance(damped);
      } else if (dy < 0) {
        setPullDistance(0);
      }
    };

    const onTouchEnd = () => {
      if (!pullTouchStartRef.current.active) return;
      pullTouchStartRef.current.active = false;
      if (pullDistance >= 64) {
        executePullRefresh();
      } else {
        setPullDistance(0);
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [
    isMobile,
    isAuthenticated,
    isMobileMoreOpen,
    isFormulaOpen,
    isDataSourceOpen,
    isPinModalOpen,
    isPullRefreshing,
    pullDistance,
    executePullRefresh
  ]);

  const handleUnlockSuccess = () => {
    setIsAuthenticated(true);
    setToastMessage('🔓 通行驗證成功，歡迎進入 MainBuy 私人工作站');
    setTimeout(() => setToastMessage(''), 2500);
  };

  const handleLockDevice = () => {
    logoutAndLockDevice();
    setIsMobileMoreOpen(false);
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
      setIsMobileSearchOpen(false);
      syncSingleStock('TAIEX', taiexData, false);
      return;
    }

    const existing = stocks.find(s => s.code === q || s.name.includes(q));
    if (existing && existing.hasRealBrokerReport) {
      setSelectedCode(existing.code);
      setInitialBrokerId('');
      setActiveView('detail');
      setCustomLookupCode('');
      setIsMobileSearchOpen(false);
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
      setIsMobileSearchOpen(false);
    } else if (existing) {
      setSelectedCode(existing.code);
      setInitialBrokerId('');
      setActiveView('detail');
      setCustomLookupCode('');
      setIsMobileSearchOpen(false);
    } else {
      alert(`查無台股代號「${q}」或公開 API 連線受限，請確認代號是否為 4 碼上市櫃股票（如 2317、3231、3017、8069）。`);
    }
  };

  const handleSelectStock = code => {
    setSelectedCode(code);
    setInitialBrokerId('');
    setActiveView('detail');
    if (isMobile) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (code === 'TAIEX') {
      if (dataSourceConfig.mode === 'live') {
        syncSingleStock('TAIEX', taiexData, false);
      }
      return;
    }
    const target = stocks.find(s => s.code === code);
    if (target) {
      if (!target.isFullMarketSummary) {
        saveStockToLocalCache(target);
      }
      if ((target.isFullMarketSummary || !target.hasRealBrokerReport) && dataSourceConfig.mode === 'live') {
        setToastMessage(`🔄 正在為【${code} ${target.name}】即時載入完整 243 日 K 線與券商分點日報表...`);
        syncSingleStock(code, target, true).then(updated => {
          if (updated) {
            setToastMessage(`✅【${code} ${updated.name}】完整 K 線與分點資料載入完成！`);
            setTimeout(() => setToastMessage(''), 2500);
          } else {
            setToastMessage('');
          }
        });
      }
    }
  };

  const handleSelectStockWithBroker = (code, brokerId) => {
    setSelectedCode(code);
    setInitialBrokerId(brokerId || '');
    setActiveView('detail');
    if (isMobile) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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
    setIsMobileSearchOpen(false);
  };

  // 全域匯出 CSV（支援從手機右上角「☰ 更多」在任何頁籤直接匯出）
  const handleGlobalExportCsv = () => {
    setIsMobileMoreOpen(false);
    if (screenerCsvExportRef.current) {
      screenerCsvExportRef.current();
      return;
    }
    const targetList =
      screenerScope === 'PINNED'
        ? stocks.filter(s => pinnedCodes.includes(s.code))
        : stocks;
    const headers = [
      '代號',
      '名稱',
      '成交價',
      '漲跌幅(%)',
      '成交量',
      '產業分類',
      '主力動能',
      '主1%',
      '主5%',
      '布林帶寬%',
      '月線斜率%',
      '上軌斜率%',
      '下軌斜率%',
      '股淨比',
      '殖利率%'
    ];
    const rows = targetList.map(s => [
      s.code,
      s.name,
      s.price,
      s.changePct,
      s.volume,
      s.industry || '',
      s.momentum?.main?.stageLabel || '',
      s.main1 ?? '',
      s.main5 ?? '',
      s.bandWidth ?? '',
      s.monthSlope ?? '',
      s.upperSlope ?? '',
      s.lowerSlope ?? '',
      s.pb ?? '',
      s.dividendYield ?? ''
    ]);
    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MainBuy主力選股清單_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setToastMessage(`📥 已匯出 ${targetList.length} 檔個股 CSV 報表`);
    setTimeout(() => setToastMessage(''), 2200);
  };

  const currentSurfaceTheme =
    themeMode === 'dark'
      ? 'theme-dark'
      : themeMode === 'light'
        ? 'theme-light'
        : activeView === 'screener' || activeView === 'radar'
          ? 'theme-dark'
          : 'theme-light';

  const displayLatestDate =
    syncState.latestDate ||
    taiexData?.latestTradeDate ||
    stocks[0]?.latestTradeDate ||
    stocks[0]?.kline?.[stocks[0].kline.length - 1]?.date ||
    '';

  return (
    <div
      className={`app-shell ${currentSurfaceTheme} ${isMobile ? 'is-mobile-shell' : ''} ${
        isMobile && fontScale === 'xlarge' ? 'mobile-font-xl' : ''
      }`}
    >
      {!isAuthenticated ? (
        <AuthGateModal onUnlockSuccess={handleUnlockSuccess} />
      ) : (
        <>
          {/* 手機下拉更新 (Pull-to-Refresh) 動態指示條 */}
          {isMobile && (pullDistance > 10 || isPullRefreshing) && (
            <div
              className={`mobile-ptr-indicator ${
                isPullRefreshing || pullDistance >= 64 ? 'ptr-ready' : ''
              }`}
              style={{
                height: `${isPullRefreshing ? 48 : pullDistance}px`
              }}
              id="mobile-ptr-indicator"
            >
              <span className="ptr-pill">
                {isPullRefreshing
                  ? '🔄 正在重新抓取最新雲端股價、法人與分點...'
                  : pullDistance >= 64
                    ? '↑ 放開立即更新雲端資料'
                    : '↓ 下拉更新雲端股價與分點'}
              </span>
            </div>
          )}

          {/* 導覽列：手機版精簡頂部列 vs 電腦版完整頂部列（電腦版 100% 維持原樣） */}
          {isMobile ? (
            <header className="mobile-top-appbar" id="mobile-top-appbar">
              <div className="mobile-appbar-main">
                <div
                  className="mobile-brand-left"
                  onClick={() => {
                    setScreenerScope('ALL');
                    setActiveView('screener');
                  }}
                >
                  <div className="mobile-brand-row1">
                    <div className="brand-logo mobile-logo-sm">M</div>
                    <span className="mobile-brand-title">MainBuy 主力雷達</span>
                  </div>
                  <span className="mobile-brand-status" id="mobile-latest-sync-badge">
                    {syncState.status === 'syncing' || isPullRefreshing
                      ? `🔄 更新中${displayLatestDate ? ` (${displayLatestDate})` : '...'}`
                      : displayLatestDate
                        ? `🟢 最新：${displayLatestDate}`
                        : '🟢 正式連線'}
                  </span>
                </div>

                <div className="mobile-appbar-actions">
                  <button
                    type="button"
                    className={`mobile-top-btn ${isMobileSearchOpen ? 'active' : ''}`}
                    onClick={() => setIsMobileSearchOpen(p => !p)}
                    id="btn-mobile-search-toggle"
                    aria-label="查詢任意台股"
                  >
                    🔍 查股
                  </button>
                  <button
                    type="button"
                    className={`mobile-top-btn font-toggle-btn ${
                      fontScale === 'xlarge' ? 'active' : ''
                    }`}
                    onClick={handleToggleFontScale}
                    id="btn-mobile-font-toggle"
                    title="一鍵切換標準字級與特大字模式"
                  >
                    {fontScale === 'xlarge' ? '特大字' : '標準字'}
                  </button>
                  <button
                    type="button"
                    className="mobile-top-btn more-menu-btn"
                    onClick={() => setIsMobileMoreOpen(true)}
                    id="btn-mobile-more-menu"
                    aria-label="更多功能選單"
                  >
                    ☰ 更多
                  </button>
                </div>
              </div>

              {isMobileSearchOpen && (
                <form className="mobile-quick-lookup-bar" onSubmit={handleLookupAnyStock}>
                  <input
                    type="text"
                    className="mobile-lookup-input"
                    placeholder="輸入 4 碼台股代號或股名 (如 2330、2454)..."
                    value={customLookupCode}
                    onChange={e => setCustomLookupCode(e.target.value)}
                    autoFocus
                    id="input-mobile-stock-lookup"
                  />
                  <button
                    type="submit"
                    className="btn-mobile-lookup-go"
                    disabled={isLookingUpSingle}
                  >
                    {isLookingUpSingle ? '抓取中' : '看K線'}
                  </button>
                  <button
                    type="button"
                    className="btn-mobile-lookup-star"
                    onClick={handleAddCustomWatchlist}
                    disabled={isLookingUpSingle || !customLookupCode.trim()}
                  >
                    ⭐加自選
                  </button>
                </form>
              )}
            </header>
          ) : (
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
                  onChange={e => handleChangeThemeMode(e.target.value)}
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
          )}

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
                externalMarketScope={screenerScope}
                onChangeExternalScope={setScreenerScope}
                batchModalTrigger={batchModalTrigger}
                registerCsvExport={fn => {
                  screenerCsvExportRef.current = fn;
                }}
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

          {/* 手機專屬：底部固定 4 大導覽列 (Bottom Tab Bar，含 iPhone 底部安全區適配) */}
          {isMobile && (
            <nav className="mobile-bottom-tabbar" id="mobile-bottom-tabbar" aria-label="手機主導覽列">
              <button
                type="button"
                className={`mobile-tab-item ${
                  activeView === 'screener' && screenerScope !== 'PINNED' ? 'active' : ''
                }`}
                onClick={() => {
                  setScreenerScope('ALL');
                  setActiveView('screener');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                id="mobile-tab-screener"
              >
                <span className="mobile-tab-icon">📊</span>
                <span className="mobile-tab-label">選股</span>
              </button>

              <button
                type="button"
                className={`mobile-tab-item ${
                  activeView === 'screener' && screenerScope === 'PINNED' ? 'active' : ''
                }`}
                onClick={() => {
                  setScreenerScope('PINNED');
                  setActiveView('screener');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                id="mobile-tab-watchlist"
              >
                <span className="mobile-tab-icon">⭐</span>
                <span className="mobile-tab-label">自選 ({pinnedCodes.length})</span>
              </button>

              <button
                type="button"
                className={`mobile-tab-item ${activeView === 'detail' ? 'active' : ''}`}
                onClick={() => {
                  setActiveView('detail');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                id="mobile-tab-kline"
              >
                <span className="mobile-tab-icon">📈</span>
                <span className="mobile-tab-label">K線</span>
              </button>

              <button
                type="button"
                className={`mobile-tab-item ${activeView === 'radar' ? 'active' : ''}`}
                onClick={() => {
                  setActiveView('radar');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                id="mobile-tab-broker"
              >
                <span className="mobile-tab-icon">🎯</span>
                <span className="mobile-tab-label">分點</span>
              </button>
            </nav>
          )}

          {/* 手機專屬：右上角「☰ 更多」底部彈出功能選單 */}
          {isMobile && isMobileMoreOpen && (
            <div
              className="mobile-bottom-sheet-backdrop"
              onClick={() => setIsMobileMoreOpen(false)}
              id="mobile-more-menu-backdrop"
            >
              <div
                className="mobile-bottom-sheet"
                onClick={e => e.stopPropagation()}
                id="mobile-more-menu-sheet"
              >
                <div className="sheet-drag-handle" />
                <div className="sheet-header-row">
                  <h3 className="sheet-title">☰ 更多功能與個人設定</h3>
                  <button
                    type="button"
                    className="btn-sheet-close"
                    onClick={() => setIsMobileMoreOpen(false)}
                  >
                    ✕
                  </button>
                </div>

                <div className="sheet-body-scroll">
                  {/* 字級一鍵切換 */}
                  <div className="more-setting-block">
                    <div className="more-setting-label">🔤 手機閱讀字級模式</div>
                    <div className="more-segmented-row">
                      <button
                        type="button"
                        className={`more-seg-btn ${fontScale === 'standard' ? 'active' : ''}`}
                        onClick={() => handleChangeFontScale('standard')}
                      >
                        標準字級
                      </button>
                      <button
                        type="button"
                        className={`more-seg-btn ${fontScale === 'xlarge' ? 'active' : ''}`}
                        onClick={() => handleChangeFontScale('xlarge')}
                      >
                        特大字模式
                      </button>
                    </div>
                  </div>

                  {/* 配色模式切換 */}
                  <div className="more-setting-block">
                    <div className="more-setting-label">🎨 畫面配色主題</div>
                    <div className="more-segmented-row">
                      <button
                        type="button"
                        className={`more-seg-btn ${themeMode === 'dark' ? 'active' : ''}`}
                        onClick={() => handleChangeThemeMode('dark')}
                      >
                        🌙 深色黑底
                      </button>
                      <button
                        type="button"
                        className={`more-seg-btn ${themeMode === 'classic' ? 'active' : ''}`}
                        onClick={() => handleChangeThemeMode('classic')}
                      >
                        🌓 雙模配色
                      </button>
                      <button
                        type="button"
                        className={`more-seg-btn ${themeMode === 'light' ? 'active' : ''}`}
                        onClick={() => handleChangeThemeMode('light')}
                      >
                        ☀️ 淺色模式
                      </button>
                    </div>
                  </div>

                  {/* 次要操作清單 */}
                  <div className="more-actions-grid">
                    <button
                      type="button"
                      className="more-action-btn"
                      onClick={() => {
                        setIsMobileMoreOpen(false);
                        executePullRefresh();
                      }}
                    >
                      <span>🔄 同步最新雲端資料</span>
                      <small>{syncState.latestDate || '立即更新'}</small>
                    </button>

                    <button
                      type="button"
                      className="more-action-btn"
                      onClick={() => {
                        setIsMobileMoreOpen(false);
                        setActiveView('screener');
                        setBatchModalTrigger(c => c + 1);
                      }}
                    >
                      <span>➕ 批次加入 / 族群快選</span>
                      <small>多檔匯入</small>
                    </button>

                    <button
                      type="button"
                      className="more-action-btn"
                      onClick={handleGlobalExportCsv}
                    >
                      <span>📥 匯出 CSV 選股清單</span>
                      <small>下載報表</small>
                    </button>

                    <button
                      type="button"
                      className="more-action-btn"
                      onClick={() => {
                        setIsMobileMoreOpen(false);
                        setIsFormulaOpen(true);
                      }}
                    >
                      <span>📘 指標與公式說明</span>
                      <small>主1/帶寬/斜率</small>
                    </button>

                    <button
                      type="button"
                      className="more-action-btn"
                      onClick={() => {
                        setIsMobileMoreOpen(false);
                        setIsDataSourceOpen(true);
                      }}
                    >
                      <span>⚙️ 資料源與快取設定</span>
                      <small>API / 快取</small>
                    </button>

                    <button
                      type="button"
                      className="more-action-btn"
                      onClick={() => {
                        setIsMobileMoreOpen(false);
                        setIsPinModalOpen(true);
                      }}
                    >
                      <span>🔑 修改私人 PIN 碼</span>
                      <small>門禁密碼</small>
                    </button>

                    <button
                      type="button"
                      className="more-action-btn danger-action"
                      onClick={handleLockDevice}
                    >
                      <span>🔒 安全鎖定本機裝置</span>
                      <small>登出保護</small>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
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
