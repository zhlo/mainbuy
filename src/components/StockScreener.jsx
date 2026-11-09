import React, { useState, useMemo, useEffect } from 'react';

// 繪製參考圖 1 中的迷你 K 棒 SVG
function MiniCandle({ type }) {
  switch (type) {
    case 'red-high':
      return (
        <svg width="16" height="22" viewBox="0 0 16 22" className="mini-candle-svg">
          <line x1="8" y1="2" x2="8" y2="20" stroke="#ff3b3b" strokeWidth="1.5" />
          <rect x="4" y="6" width="8" height="12" fill="#ff3b3b" />
        </svg>
      );
    case 'doji-bottom':
      return (
        <svg width="16" height="22" viewBox="0 0 16 22" className="mini-candle-svg">
          <line x1="8" y1="3" x2="8" y2="18" stroke="#ffffff" strokeWidth="1.5" />
          <line x1="4" y1="18" x2="12" y2="18" stroke="#ffffff" strokeWidth="2" />
        </svg>
      );
    case 'red-cross':
      return (
        <svg width="16" height="22" viewBox="0 0 16 22" className="mini-candle-svg">
          <line x1="8" y1="2" x2="8" y2="20" stroke="#ff3b3b" strokeWidth="1.5" />
          <rect x="4" y="9" width="8" height="6" fill="#ff3b3b" />
        </svg>
      );
    case 'red-t':
      return (
        <svg width="16" height="22" viewBox="0 0 16 22" className="mini-candle-svg">
          <line x1="8" y1="4" x2="8" y2="20" stroke="#ff3b3b" strokeWidth="1.5" />
          <line x1="3" y1="4" x2="13" y2="4" stroke="#ff3b3b" strokeWidth="2.4" />
        </svg>
      );
    case 'black-body':
      return (
        <svg width="16" height="22" viewBox="0 0 16 22" className="mini-candle-svg">
          <line x1="8" y1="2" x2="8" y2="20" stroke="#22e048" strokeWidth="1.5" />
          <rect x="4" y="5" width="8" height="12" fill="#22e048" />
        </svg>
      );
    case 'red-full':
    default:
      return (
        <svg width="16" height="22" viewBox="0 0 16 22" className="mini-candle-svg">
          <line x1="8" y1="2" x2="8" y2="20" stroke="#ff3b3b" strokeWidth="1.5" />
          <rect x="4" y="4" width="8" height="14" fill="#ff3b3b" />
        </svg>
      );
  }
}

const PRESET_STRATEGIES = {
  chip: [
    { id: 'main-surge', label: '主力集中飆升 (主1 ≥ 20%)', desc: '當日主力買賣超集中度 ≥ 20%', check: s => s.main1 >= 20 },
    { id: 'main-wave', label: '主力波段鎖碼 (主1/主5/主10皆≥10%)', desc: '短中長天期主力同步集中買進', check: s => s.main1 >= 10 && s.main5 >= 10 && s.main10 >= 10 },
    { id: 'trust-streak', label: '投信連買作帳 (投信連買 ≥ 2日)', desc: '投信法人連續買超 ≥ 2 日且投信% > 10%', check: s => s.trustConsec >= 2 && s.trustPct >= 10 },
    { id: 'dual-inst', label: '外資投信同買 (主力/外資/投信連買>0)', desc: '主力、外資、投信同步連買共振', check: s => s.mainConsec > 0 && s.foreignConsec > 0 && s.trustConsec > 0 },
    { id: 'low-pb-company', label: '股淨比 < 0.5 公司派大買 (圖3)', desc: '股價淨值比低於 0.5 且主力集中買超，容易是長線低點', check: s => s.pb < 0.5 && s.main1 > 0 }
  ],
  tech: [
    { id: 'boll-squeeze', label: '布林通道壓縮突破 (帶寬 ≤ 12 & 位階 ≥ 6)', desc: '布林帶寬收斂後向上突破通道上軌', check: s => s.bandWidth <= 12 && s.bandPos >= 6 },
    { id: 'band-expand', label: '高帶寬強勢噴出 (帶寬 ≥ 20)', desc: '布林帶寬張口 ≥ 20 強勢股', check: s => s.bandWidth >= 20 },
    { id: 'slope-up', label: '月線與週線斜率同步翻正', desc: '月線斜率 > 0 且上週斜率 > 0', check: s => s.monthSlope > 0 && s.lastWeekSlope > 0 },
    { id: 'high-bias', label: '強勢突破年線 (乖離年線 ≥ 20%)', desc: '股價站穩年線之上且正乖離強勁', check: s => s.biasYear >= 20 }
  ],
  intraday: [
    { id: 'out-vol-burst', label: '外盤大單連敲 (連外次 ≥ 1 & 連外量 ≥ 30)', desc: '主動外盤連續大單買進推升', check: s => s.outCount >= 1 && s.outVol >= 30 },
    { id: 'in-vol-active', label: '內盤大單湧現 (連內量 ≥ 30)', desc: '單筆或連續內盤成交量顯著放大', check: s => s.inVol >= 30 },
    { id: 'daytrade-hot', label: '當沖熱門股 (當沖% ≥ 25%)', desc: '當日現股當沖佔比 ≥ 25%', check: s => s.dayTradePct >= 25 }
  ],
  fundamental: [
    { id: 'rev-growth', label: '營收高成長 (YOY ≥ 25% & MOM > 0%)', desc: '年營收成長率 ≥ 25% 且月營收正成長', check: s => s.revYoY >= 25 && s.revMoM > 0 },
    { id: 'high-yield', label: '高殖利率定存 (殖利率 ≥ 4% & 連續年 ≥ 10)', desc: '殖利率 ≥ 4% 且連續配息超過 10 年', check: s => s.dividendYield >= 4 && s.divYears >= 10 },
    { id: 'maint-warn', label: '融資維持率 < 130% 警戒 (圖3)', desc: '維持率低於 130%，融資過高易多殺多', check: s => s.maintRatio < 130 }
  ]
};

const DEFAULT_SAVED_STRATEGIES = [
  {
    id: 'preset-wave-lock',
    name: '🔥 主力投信雙鎖碼強勢股',
    marketScope: 'ALL',
    strategyIds: ['main-wave', 'trust-streak'],
    customFilters: { minMain1: '15', minMain5: '10', minTrustConsec: '2', maxPb: '', minRevYoY: '', maxMaintRatio: '' }
  },
  {
    id: 'preset-value-bottom',
    name: '💎 低股淨比公司派大買 (圖3)',
    marketScope: 'ALL',
    strategyIds: ['low-pb-company'],
    customFilters: { minMain1: '15', minMain5: '', minTrustConsec: '', maxPb: '0.5', minRevYoY: '', maxMaintRatio: '' }
  },
  {
    id: 'preset-intraday-sniper',
    name: '⚡ 盤中外盤大單急拉突破',
    marketScope: 'ALL',
    strategyIds: ['out-vol-burst'],
    customFilters: { minMain1: '10', minMain5: '', minTrustConsec: '', maxPb: '', minRevYoY: '', maxMaintRatio: '' }
  }
];

export default function StockScreener({
  stocks,
  pinnedCodes,
  onTogglePin,
  onSelectStock,
  onOpenFormulaModal
}) {
  const [marketScope, setMarketScope] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryDrawer, setActiveCategoryDrawer] = useState(null); // 'chip' | 'tech' | 'intraday' | 'fundamental' | 'custom' | 'saved'
  const [activeStrategyIds, setActiveStrategyIds] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'desc' });
  const [columnMode, setColumnMode] = useState('fig1'); // 'fig1' | 'fig3' | 'all'
  const [countdown, setCountdown] = useState(5);
  const [isLivePaused, setIsLivePaused] = useState(false);
  const [taiexTick, setTaiexTick] = useState({ index: 16032, futures: 15983, diff: 1 });
  const [newStrategyName, setNewStrategyName] = useState('');

  // 自訂儲存策略清單 (持久化於 localStorage)
  const [savedStrategies, setSavedStrategies] = useState(() => {
    try {
      const raw = localStorage.getItem('chipflow_saved_strategies');
      return raw ? JSON.parse(raw) : DEFAULT_SAVED_STRATEGIES;
    } catch {
      return DEFAULT_SAVED_STRATEGIES;
    }
  });

  // 自訂數值門檻篩選
  const [customFilters, setCustomFilters] = useState({
    minMain1: '',
    minMain5: '',
    minTrustConsec: '',
    maxPb: '',
    minRevYoY: '',
    maxMaintRatio: ''
  });

  // 模擬圖 1 頂部「=5秒 0」即時刷價倒數
  useEffect(() => {
    if (isLivePaused) return;
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          const delta = Math.round((Math.random() - 0.48) * 3);
          setTaiexTick(curr => ({
            index: curr.index + delta,
            futures: curr.futures + delta,
            diff: curr.diff + (delta >= 0 ? 1 : -1)
          }));
          return 5;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isLivePaused]);

  const toggleStrategy = id => {
    setActiveStrategyIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const clearAllConditions = () => {
    setMarketScope('ALL');
    setSearchQuery('');
    setActiveStrategyIds([]);
    setActiveCategoryDrawer(null);
    setCustomFilters({
      minMain1: '',
      minMain5: '',
      minTrustConsec: '',
      maxPb: '',
      minRevYoY: '',
      maxMaintRatio: ''
    });
    setSortConfig({ key: null, direction: 'desc' });
  };

  const handleSaveCurrentStrategy = () => {
    const title = newStrategyName.trim() || `自訂策略 (${savedStrategies.length + 1})`;
    const item = {
      id: `custom-${Date.now()}`,
      name: title,
      marketScope,
      strategyIds: activeStrategyIds,
      customFilters: { ...customFilters }
    };
    const updated = [item, ...savedStrategies];
    setSavedStrategies(updated);
    setNewStrategyName('');
    try {
      localStorage.setItem('chipflow_saved_strategies', JSON.stringify(updated));
    } catch {
      // ignore storage errors
    }
  };

  const handleApplySavedStrategy = item => {
    setMarketScope(item.marketScope || 'ALL');
    setActiveStrategyIds(item.strategyIds || []);
    setCustomFilters(
      item.customFilters || {
        minMain1: '',
        minMain5: '',
        minTrustConsec: '',
        maxPb: '',
        minRevYoY: '',
        maxMaintRatio: ''
      }
    );
  };

  const handleDeleteSavedStrategy = (id, e) => {
    e.stopPropagation();
    const updated = savedStrategies.filter(s => s.id !== id);
    setSavedStrategies(updated);
    try {
      localStorage.setItem('chipflow_saved_strategies', JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const handleSort = key => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'desc' ? 'asc' : 'desc' };
      }
      return { key, direction: 'desc' };
    });
  };

  const allStrategiesList = useMemo(() => {
    return [
      ...PRESET_STRATEGIES.chip,
      ...PRESET_STRATEGIES.tech,
      ...PRESET_STRATEGIES.intraday,
      ...PRESET_STRATEGIES.fundamental
    ];
  }, []);

  const hasCustomFilter = Object.values(customFilters).some(v => v !== '');
  const totalFilterCount = activeStrategyIds.length + (hasCustomFilter ? 1 : 0) + (marketScope !== 'ALL' ? 1 : 0);

  const filteredStocks = useMemo(() => {
    let list = [...stocks];

    // 1. 監控對象過濾
    if (marketScope === 'LISTED') {
      list = list.filter(s => s.market === '上市');
    } else if (marketScope === 'OTC') {
      list = list.filter(s => s.market === '上櫃');
    } else if (marketScope === 'PINNED') {
      list = list.filter(s => pinnedCodes.includes(s.code));
    } else if (marketScope === 'FIG1') {
      const fig1Codes = ['2227', '1536', '6230', '1590', '6510', '3529', '3702', '9914', '2301', '1477'];
      list = list.filter(s => fig1Codes.includes(s.code));
    }

    // 2. 搜尋關鍵字
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        s =>
          s.code.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.industry.toLowerCase().includes(q)
      );
    }

    // 3. 策略標籤篩選
    if (activeStrategyIds.length > 0) {
      const activeChecks = allStrategiesList.filter(st => activeStrategyIds.includes(st.id));
      list = list.filter(s => activeChecks.every(st => st.check(s)));
    }

    // 4. 自訂數值條件
    if (customFilters.minMain1 !== '') {
      list = list.filter(s => s.main1 >= Number(customFilters.minMain1));
    }
    if (customFilters.minMain5 !== '') {
      list = list.filter(s => s.main5 >= Number(customFilters.minMain5));
    }
    if (customFilters.minTrustConsec !== '') {
      list = list.filter(s => s.trustConsec >= Number(customFilters.minTrustConsec));
    }
    if (customFilters.maxPb !== '') {
      list = list.filter(s => s.pb <= Number(customFilters.maxPb));
    }
    if (customFilters.minRevYoY !== '') {
      list = list.filter(s => s.revYoY >= Number(customFilters.minRevYoY));
    }
    if (customFilters.maxMaintRatio !== '') {
      list = list.filter(s => s.maintRatio <= Number(customFilters.maxMaintRatio));
    }

    // 5. 排序（置頂股永遠優先）
    list.sort((a, b) => {
      const aPinned = pinnedCodes.includes(a.code) ? 1 : 0;
      const bPinned = pinnedCodes.includes(b.code) ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;

      if (!sortConfig.key) return 0;
      const valA = a[sortConfig.key];
      const valB = b[sortConfig.key];
      if (typeof valA === 'string') {
        return sortConfig.direction === 'asc'
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }
      return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
    });

    return list;
  }, [stocks, marketScope, searchQuery, activeStrategyIds, customFilters, sortConfig, pinnedCodes, allStrategiesList]);

  // 匯出當前選股結果為 CSV
  const handleExportCsv = () => {
    const headers = [
      '代號',
      '名稱',
      '成交價',
      '漲跌幅(%)',
      '成交量',
      '細產業分類',
      '主力連買',
      '外資連買',
      '投信連買',
      '主1',
      '主5',
      '主10',
      '外資%',
      '投信%',
      '當沖%',
      '乖離年線%',
      '維持率%',
      '營收YoY%',
      '股淨比',
      '殖利率%'
    ];
    const rows = filteredStocks.map(s => [
      s.code,
      s.name,
      s.price,
      s.changePct,
      s.volume,
      s.industry,
      s.mainConsec,
      s.foreignConsec,
      s.trustConsec,
      s.main1,
      s.main5,
      s.main10,
      s.foreignPct,
      s.trustPct,
      s.dayTradePct,
      s.biasYear,
      s.maintRatio,
      s.revYoY,
      s.pb,
      s.dividendYield
    ]);
    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `籌碼選股清單_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 數值紅綠顏色輔助函式（台股紅漲綠跌 / 紅正綠負 / 0白色）
  const getSignedColorClass = val => {
    if (val > 0) return 'cell-red';
    if (val < 0) return 'cell-green';
    return 'cell-neutral';
  };

  const showFig1Cols = columnMode === 'fig1' || columnMode === 'all';
  const showFig3Cols = columnMode === 'fig3' || columnMode === 'all';

  return (
    <section className="screener-container" id="screener-section">
      {/* 參考圖 1 頂部監控工具列 */}
      <div className="screener-toolbar">
        <div className="toolbar-left">
          <span className="toolbar-label">監控對象</span>
          <select
            className="monitor-select"
            value={marketScope}
            onChange={e => setMarketScope(e.target.value)}
            id="select-monitor-target"
          >
            <option value="ALL">台股上市櫃 ({stocks.length})</option>
            <option value="FIG1">圖1精選監控股 (10)</option>
            <option value="LISTED">台股上市</option>
            <option value="OTC">台股上櫃</option>
            <option value="PINNED">自選置頂股 ({pinnedCodes.length})</option>
          </select>

          <div className="quick-search-wrap">
            <input
              type="text"
              className="toolbar-search-input"
              placeholder="輸入代號/名稱/細產業..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              id="input-screener-search"
            />
            {searchQuery && (
              <button
                className="btn-clear-search"
                onClick={() => setSearchQuery('')}
                title="清除搜尋"
                id="btn-clear-search"
              >
                ✕
              </button>
            )}
          </div>

          <div className="strategy-btn-group">
            <button
              className={`btn-strategy-tab ${activeCategoryDrawer === 'chip' ? 'active' : ''}`}
              onClick={() => setActiveCategoryDrawer(prev => (prev === 'chip' ? null : 'chip'))}
              id="btn-tab-chip"
            >
              籌碼面
            </button>
            <button
              className={`btn-strategy-tab ${activeCategoryDrawer === 'tech' ? 'active' : ''}`}
              onClick={() => setActiveCategoryDrawer(prev => (prev === 'tech' ? null : 'tech'))}
              id="btn-tab-tech"
            >
              技術面
            </button>
            <button
              className={`btn-strategy-tab ${activeCategoryDrawer === 'intraday' ? 'active' : ''}`}
              onClick={() => setActiveCategoryDrawer(prev => (prev === 'intraday' ? null : 'intraday'))}
              id="btn-tab-intraday"
            >
              即時面
            </button>
            <button
              className={`btn-strategy-tab ${activeCategoryDrawer === 'fundamental' ? 'active' : ''}`}
              onClick={() => setActiveCategoryDrawer(prev => (prev === 'fundamental' ? null : 'fundamental'))}
              id="btn-tab-fundamental"
            >
              基本面(圖3)
            </button>
            <button
              className={`btn-strategy-tab ${activeCategoryDrawer === 'saved' ? 'active' : ''}`}
              onClick={() => setActiveCategoryDrawer(prev => (prev === 'saved' ? null : 'saved'))}
              id="btn-tab-saved"
            >
              ★策略庫({savedStrategies.length})
            </button>
            <button
              className="btn-strategy-clear"
              onClick={clearAllConditions}
              id="btn-clear-conditions"
            >
              條件清空
            </button>
          </div>
        </div>

        {/* 中央加權與期貨即時跳動報價（對應圖 1） */}
        <div className="toolbar-center-quotes">
          <div className="market-quote-box">
            <span className="quote-name">加權</span>
            <span className="quote-val">{taiexTick.index}</span>
          </div>
          <div className="market-quote-box">
            <span className="quote-name orange">期貨</span>
            <span className="quote-val yellow">{taiexTick.futures}</span>
            <span className={`quote-diff ${taiexTick.diff >= 0 ? 'green' : 'red'}`}>
              {Math.abs(taiexTick.diff)}
            </span>
          </div>
          <div
            className="market-quote-box refresh-box"
            onClick={() => setIsLivePaused(p => !p)}
            style={{ cursor: 'pointer' }}
            title="點擊可暫停/恢復每 5 秒自動更新盤中報價"
          >
            <span className="quote-name orange">=5秒</span>
            <span className="quote-val">{isLivePaused ? '暫停' : countdown === 5 ? 0 : countdown}</span>
          </div>
        </div>

        {/* 右側篩選狀態與欄位控制 */}
        <div className="toolbar-right">
          <div className={`filter-status-box ${totalFilterCount > 0 ? 'has-filter' : ''}`}>
            {totalFilterCount === 0 ? '無篩選' : `已套用 ${totalFilterCount} 項條件`}
          </div>
          <button
            className={`btn-toolbar-action red-text ${activeCategoryDrawer === 'custom' ? 'active' : ''}`}
            onClick={() => setActiveCategoryDrawer(prev => (prev === 'custom' ? null : 'custom'))}
            id="btn-open-custom-filter"
          >
            篩選
          </button>
          <select
            className="column-mode-select"
            value={columnMode}
            onChange={e => setColumnMode(e.target.value)}
            id="select-column-mode"
            title="切換顯示欄位組合"
          >
            <option value="fig1">欄位：圖1標準看盤</option>
            <option value="fig3">欄位：圖3公式與基本面</option>
            <option value="all">欄位：全部展開</option>
          </select>
          <button
            className="btn-toolbar-action blue-text"
            onClick={onOpenFormulaModal}
            id="btn-open-formula-guide"
          >
            公式說明
          </button>
          <button
            className="btn-toolbar-action"
            onClick={handleExportCsv}
            title="匯出目前篩選結果為 CSV"
            id="btn-export-csv"
          >
            匯出CSV
          </button>
        </div>
      </div>

      {/* 展開式策略抽屜（籌碼面 / 技術面 / 即時面 / 基本面 / 自訂數值篩選 / 策略庫） */}
      {activeCategoryDrawer && (
        <div className="strategy-drawer" id="strategy-drawer-panel">
          {activeCategoryDrawer === 'saved' ? (
            <div className="saved-strategy-manager">
              <div className="saved-list-row">
                <span className="drawer-label">已儲存選股策略（點擊直接套用）：</span>
                {savedStrategies.map(item => (
                  <div
                    key={item.id}
                    className="strategy-pill saved-pill"
                    onClick={() => handleApplySavedStrategy(item)}
                  >
                    <span>{item.name}</span>
                    <button
                      className="btn-del-strategy"
                      onClick={e => handleDeleteSavedStrategy(item.id, e)}
                      title="刪除此策略"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <div className="save-new-row">
                <input
                  type="text"
                  className="save-strategy-input"
                  placeholder="輸入新策略名稱（儲存目前勾選與數值門檻）..."
                  value={newStrategyName}
                  onChange={e => setNewStrategyName(e.target.value)}
                />
                <button className="btn-save-strategy" onClick={handleSaveCurrentStrategy}>
                  💾 儲存目前條件為策略
                </button>
              </div>
            </div>
          ) : activeCategoryDrawer !== 'custom' ? (
            <div className="strategy-pills-wrap">
              <span className="drawer-label">
                點擊啟用選股條件（可複選組合）：
              </span>
              {PRESET_STRATEGIES[activeCategoryDrawer]?.map(st => {
                const isSelected = activeStrategyIds.includes(st.id);
                return (
                  <button
                    key={st.id}
                    className={`strategy-pill ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleStrategy(st.id)}
                    title={st.desc}
                    id={`btn-strategy-${st.id}`}
                  >
                    <span className="pill-check">{isSelected ? '✓' : '+'}</span>
                    <span>{st.label}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="custom-filter-grid">
              <label className="custom-filter-item">
                <span>主 1 集中度 ≥ (%)</span>
                <input
                  type="number"
                  placeholder="例: 15"
                  value={customFilters.minMain1}
                  onChange={e => setCustomFilters({ ...customFilters, minMain1: e.target.value })}
                  id="input-filter-main1"
                />
              </label>
              <label className="custom-filter-item">
                <span>主 5 集中度 ≥ (%)</span>
                <input
                  type="number"
                  placeholder="例: 10"
                  value={customFilters.minMain5}
                  onChange={e => setCustomFilters({ ...customFilters, minMain5: e.target.value })}
                  id="input-filter-main5"
                />
              </label>
              <label className="custom-filter-item">
                <span>投信連買 ≥ (日)</span>
                <input
                  type="number"
                  placeholder="例: 2"
                  value={customFilters.minTrustConsec}
                  onChange={e => setCustomFilters({ ...customFilters, minTrustConsec: e.target.value })}
                  id="input-filter-trust"
                />
              </label>
              <label className="custom-filter-item">
                <span>股淨比 ≤ (倍，&lt;0.5低點)</span>
                <input
                  type="number"
                  step="0.1"
                  placeholder="例: 1.5 或 0.5"
                  value={customFilters.maxPb}
                  onChange={e => setCustomFilters({ ...customFilters, maxPb: e.target.value })}
                  id="input-filter-pb"
                />
              </label>
              <label className="custom-filter-item">
                <span>營收 YOY ≥ (%)</span>
                <input
                  type="number"
                  placeholder="例: 20"
                  value={customFilters.minRevYoY}
                  onChange={e => setCustomFilters({ ...customFilters, minRevYoY: e.target.value })}
                  id="input-filter-yoy"
                />
              </label>
              <label className="custom-filter-item">
                <span>融資維持率 ≤ (% 斷頭警戒)</span>
                <input
                  type="number"
                  placeholder="例: 130"
                  value={customFilters.maxMaintRatio}
                  onChange={e => setCustomFilters({ ...customFilters, maxMaintRatio: e.target.value })}
                  id="input-filter-maint"
                />
              </label>
            </div>
          )}
        </div>
      )}

      {/* 操作提示橫條 */}
      <div className="screener-subhint">
        <span>
          💡 點擊任一列「<strong>代號</strong>」或「<strong>名稱</strong>」即可進入<strong>個股籌碼 K 線與券商分點明細（圖 2 工作站）</strong>；點擊欄位表頭可排序。
        </span>
        <span className="subhint-right">
          符合條件共 <strong>{filteredStocks.length}</strong> 檔個股
        </span>
      </div>

      {/* 高密度看盤選股表格（完全對齊圖 1 視覺與欄位） */}
      <div className="screener-table-wrapper">
        <table className="screener-table" id="screener-data-table">
          <thead>
            <tr>
              <th className="sticky-col col-pin" title="置頂自選股">置<br />頂</th>
              <th className="sticky-col col-code sortable" onClick={() => handleSort('code')}>
                代號 {sortConfig.key === 'code' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th className="sticky-col col-name sortable" onClick={() => handleSort('name')}>
                名稱
              </th>
              <th className="col-kbar">K<br />棒</th>
              <th className="sortable" onClick={() => handleSort('price')}>
                成交價 {sortConfig.key === 'price' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th className="sortable" onClick={() => handleSort('changePct')}>
                漲跌<br />幅(%) {sortConfig.key === 'changePct' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
              </th>

              {showFig1Cols && (
                <>
                  <th className="sortable" onClick={() => handleSort('inCount')} title="連續內盤成交次數">連內次</th>
                  <th className="sortable" onClick={() => handleSort('inVol')} title="連續內盤成交量(張)">連內量</th>
                  <th className="sortable" onClick={() => handleSort('outCount')} title="連續外盤成交次數">連外次</th>
                  <th className="sortable" onClick={() => handleSort('outVol')} title="連續外盤成交量(張)">連外量</th>
                </>
              )}

              <th className="sortable" onClick={() => handleSort('volume')}>
                成交量 {sortConfig.key === 'volume' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
              </th>

              {showFig1Cols && (
                <th className="sortable" onClick={() => handleSort('warrantAmt')}>權證金額</th>
              )}

              <th className="col-industry sortable" onClick={() => handleSort('industry')}>細產業分類</th>

              {showFig1Cols && (
                <>
                  <th className="sortable" onClick={() => handleSort('monthSlope')}>月線<br />斜率</th>
                  <th className="sortable" onClick={() => handleSort('lastWeekSlope')}>上週<br />斜率</th>
                  <th className="sortable" onClick={() => handleSort('nextWeekSlope')}>下週<br />斜率</th>
                  <th className="sortable" onClick={() => handleSort('bandWidth')} title="布林通道帶寬(%)">帶寬</th>
                  <th className="sortable" onClick={() => handleSort('bandPos')} title="布林通道相對位階">位階</th>
                </>
              )}

              <th className="sortable" onClick={() => handleSort('mainConsec')} title="主力連續買賣超天數">主力<br />連買</th>
              <th className="sortable" onClick={() => handleSort('foreignConsec')} title="外資連續買賣超天數">外資<br />連買</th>
              <th className="sortable" onClick={() => handleSort('trustConsec')} title="投信連續買賣超天數">投信<br />連買</th>

              <th
                className="sortable"
                onClick={() => handleSort('main1')}
                title="主1：(今日買超總量 - 今日賣超賣量) / 當天成交量 * 100"
              >
                主1 {sortConfig.key === 'main1' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th
                className="sortable"
                onClick={() => handleSort('main5')}
                title="主5：(五日區間買超總量 - 五日區間賣超賣量) / 五日成交量 * 100"
              >
                主5 {sortConfig.key === 'main5' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th
                className="sortable"
                onClick={() => handleSort('main10')}
                title="主10：(十日區間買超總量 - 十日區間賣超賣量) / 十日成交量 * 100"
              >
                主10 {sortConfig.key === 'main10' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
              </th>

              <th className="sortable" onClick={() => handleSort('foreignPct')}>外資%</th>
              <th className="sortable" onClick={() => handleSort('trustPct')}>投信%</th>
              <th className="sortable" onClick={() => handleSort('dealerPct')}>自營%</th>
              <th className="sortable" onClick={() => handleSort('dayTradePct')}>當沖%</th>
              <th className="sortable" onClick={() => handleSort('marginPct')}>融資%</th>
              <th className="sortable" onClick={() => handleSort('shortPct')}>融券%</th>
              <th className="sortable" onClick={() => handleSort('shortMarginRatio')}>券資<br />比%</th>
              <th
                className="sortable"
                onClick={() => handleSort('biasYear')}
                title="乖年【乖離年線】：舉例年線100，股價90，乖年=-10"
              >
                乖離年<br />線%
              </th>

              {showFig3Cols && (
                <>
                  <th className="sortable" onClick={() => handleSort('biasQuarter')} title="乖季【乖離季線】">乖季%</th>
                  <th className="sortable" onClick={() => handleSort('biasMonth')} title="乖月【乖離月線】">乖月%</th>
                  <th className="sortable" onClick={() => handleSort('fromHigh')} title="離高：離一年來高點打幾折">離高<br />(折)</th>
                  <th className="sortable" onClick={() => handleSort('fromLow')} title="離低：離一年來最低點是幾倍">離低<br />(倍)</th>
                  <th className="sortable" onClick={() => handleSort('maintRatio')} title="維持率：低於130，融資率過高者容易多殺多">維持<br />率%</th>
                  <th className="sortable" onClick={() => handleSort('revYoY')} title="YOY：年營收成長(%)">營收<br />YOY%</th>
                  <th className="sortable" onClick={() => handleSort('revMoM')} title="MOM：月營收成長(%)">營收<br />MOM%</th>
                  <th className="sortable" onClick={() => handleSort('pb')} title="股淨比：低於0.5，公司派大買，容易是低點!">股淨比</th>
                  <th className="sortable" onClick={() => handleSort('dividendYield')} title="殖利率：(現金股利+股票股利)*100/股價">殖利<br />率%</th>
                  <th className="sortable" onClick={() => handleSort('divYears')} title="連續年：連續配發現金股利年數">連續<br />年</th>
                </>
              )}
            </tr>
          </thead>

          <tbody>
            {filteredStocks.map(stock => {
              const isPinned = pinnedCodes.includes(stock.code);
              const priceColor = getSignedColorClass(stock.changePct);

              return (
                <tr
                  key={stock.code}
                  className={`screener-row ${isPinned ? 'row-pinned' : ''}`}
                  onClick={() => onSelectStock(stock.code)}
                  id={`row-stock-${stock.code}`}
                >
                  <td
                    className="sticky-col col-pin"
                    onClick={e => {
                      e.stopPropagation();
                      onTogglePin(stock.code);
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isPinned}
                      onChange={() => {}}
                      className="pin-checkbox"
                      aria-label={`置頂 ${stock.name}`}
                    />
                  </td>
                  <td className="sticky-col col-code">{stock.code}</td>
                  <td className="sticky-col col-name">{stock.name}</td>
                  <td className="col-kbar">
                    <MiniCandle type={stock.candleType} />
                  </td>
                  <td className={`num-cell ${priceColor}`}>{stock.price}</td>
                  <td className={`num-cell ${priceColor}`}>{stock.changePct}</td>

                  {showFig1Cols && (
                    <>
                      <td className={`num-cell ${stock.inCount > 0 ? 'cell-green' : 'cell-zero'}`}>
                        {stock.inCount}
                      </td>
                      <td
                        className={`num-cell ${
                          stock.inVol >= 14 ? 'bg-highlight-green' : stock.inVol > 0 ? 'cell-green' : 'cell-zero'
                        }`}
                      >
                        {stock.inVol}
                      </td>
                      <td className={`num-cell ${stock.outCount > 0 ? 'cell-red' : 'cell-zero'}`}>
                        {stock.outCount}
                      </td>
                      <td
                        className={`num-cell ${
                          stock.outVol >= 30 ? 'bg-highlight-red' : stock.outVol > 0 ? 'cell-red' : 'cell-zero'
                        }`}
                      >
                        {stock.outVol}
                      </td>
                    </>
                  )}

                  <td className="num-cell cell-neutral">{stock.volume.toLocaleString()}</td>

                  {showFig1Cols && (
                    <td className="num-cell cell-muted">{stock.warrantAmt}</td>
                  )}

                  <td className="col-industry">{stock.industry}</td>

                  {showFig1Cols && (
                    <>
                      <td className={`num-cell ${getSignedColorClass(stock.monthSlope)}`}>
                        {stock.monthSlope}
                      </td>
                      <td className={`num-cell ${getSignedColorClass(stock.lastWeekSlope)}`}>
                        {stock.lastWeekSlope}
                      </td>
                      <td className={`num-cell ${getSignedColorClass(stock.nextWeekSlope)}`}>
                        {stock.nextWeekSlope}
                      </td>
                      <td
                        className={`num-cell ${
                          stock.bandWidth >= 20
                            ? 'bg-highlight-red'
                            : stock.bandWidth <= 10
                              ? 'cell-green'
                              : 'cell-red'
                        }`}
                      >
                        {stock.bandWidth}
                      </td>
                      <td
                        className={`num-cell ${
                          stock.bandPos >= 10
                            ? 'bg-highlight-red'
                            : stock.bandPos < 0
                              ? 'cell-green'
                              : 'cell-red'
                        }`}
                      >
                        {stock.bandPos}
                      </td>
                    </>
                  )}

                  <td className={`num-cell ${getSignedColorClass(stock.mainConsec)}`}>
                    {stock.mainConsec}
                  </td>
                  <td className={`num-cell ${getSignedColorClass(stock.foreignConsec)}`}>
                    {stock.foreignConsec}
                  </td>
                  <td className={`num-cell ${getSignedColorClass(stock.trustConsec)}`}>
                    {stock.trustConsec}
                  </td>

                  <td className={`num-cell ${getSignedColorClass(stock.main1)}`}>
                    {stock.main1}
                  </td>
                  <td className={`num-cell ${getSignedColorClass(stock.main5)}`}>
                    {stock.main5}
                  </td>
                  <td className={`num-cell ${getSignedColorClass(stock.main10)}`}>
                    {stock.main10}
                  </td>

                  <td className={`num-cell ${getSignedColorClass(stock.foreignPct)}`}>
                    {stock.foreignPct}
                  </td>
                  <td className={`num-cell ${getSignedColorClass(stock.trustPct)}`}>
                    {stock.trustPct}
                  </td>
                  <td className={`num-cell ${getSignedColorClass(stock.dealerPct)}`}>
                    {stock.dealerPct}
                  </td>
                  <td className={`num-cell ${stock.dayTradePct > 0 ? 'cell-red' : 'cell-zero'}`}>
                    {stock.dayTradePct}
                  </td>
                  <td className={`num-cell ${getSignedColorClass(stock.marginPct)}`}>
                    {stock.marginPct}
                  </td>
                  <td className={`num-cell ${getSignedColorClass(stock.shortPct)}`}>
                    {stock.shortPct}
                  </td>
                  <td className="num-cell cell-neutral">{stock.shortMarginRatio}</td>
                  <td className={`num-cell ${getSignedColorClass(stock.biasYear)}`}>
                    {stock.biasYear}
                  </td>

                  {showFig3Cols && (
                    <>
                      <td className={`num-cell ${getSignedColorClass(stock.biasQuarter)}`}>
                        {stock.biasQuarter}
                      </td>
                      <td className={`num-cell ${getSignedColorClass(stock.biasMonth)}`}>
                        {stock.biasMonth}
                      </td>
                      <td className="num-cell cell-neutral">{stock.fromHigh}</td>
                      <td className="num-cell cell-red">{stock.fromLow}</td>
                      <td
                        className={`num-cell ${
                          stock.maintRatio < 130 ? 'bg-highlight-green' : 'cell-neutral'
                        }`}
                        title={stock.maintRatio < 130 ? '維持率低於130%，留意融資多殺多風險！' : ''}
                      >
                        {stock.maintRatio}
                      </td>
                      <td className={`num-cell ${getSignedColorClass(stock.revYoY)}`}>
                        {stock.revYoY}
                      </td>
                      <td className={`num-cell ${getSignedColorClass(stock.revMoM)}`}>
                        {stock.revMoM}
                      </td>
                      <td
                        className={`num-cell ${
                          stock.pb < 0.5 ? 'bg-highlight-red' : 'cell-neutral'
                        }`}
                        title={stock.pb < 0.5 ? '股淨比低於0.5且主力買超，容易是長線低點！' : ''}
                      >
                        {stock.pb}
                      </td>
                      <td className="num-cell cell-red">{stock.dividendYield}</td>
                      <td className="num-cell cell-neutral">{stock.divYears}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
