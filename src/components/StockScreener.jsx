import React, { useState, useMemo, useEffect } from 'react';
import { computePeriodChipAnalysis, computeStockMomentum } from '../data/mockStocks';

// 繪製迷你 K 棒 SVG
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

// 近 10 日買賣超紅綠熱力格 (10-Day Sparkbar)
function Recent10Sparkbar({ values = [] }) {
  const arr = values.length > 0 ? values.slice(-10) : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const maxAbs = Math.max(10, ...arr.map(v => Math.abs(v)));
  return (
    <div className="sparkbar-10d" title={`近10日逐日買賣超(張): ${arr.join(', ')}`}>
      {arr.map((v, idx) => {
        const hPct = Math.max(22, Math.min(100, Math.round((Math.abs(v) / maxAbs) * 100)));
        const isLast = idx === arr.length - 1;
        const cls = v > 0 ? 'sb-up' : v < 0 ? 'sb-down' : 'sb-flat';
        return (
          <span
            key={idx}
            className={`sb-bar ${cls} ${isLast ? 'sb-today' : ''}`}
            style={{ height: `${hPct}%` }}
          />
        );
      })}
    </div>
  );
}

// 右側免跳頁「個股 K 線與分點拔河快覽抽屜」元件
function QuickStockPreviewDrawer({ stock, onClose, onExpandFullDetail }) {
  if (!stock) return null;
  const recentKline = (stock.kline || []).slice(-40);
  const chip1D = useMemo(
    () => computePeriodChipAnalysis(stock, stock.kline.length - 1, 1),
    [stock]
  );
  const mom = stock.momentum || computeStockMomentum(stock.kline || []);

  // 繪製 40 日精簡 K 線 + 20MA + 成交量
  const width = 360;
  const height = 165;
  const kTop = 10;
  const kBottom = 122;
  const kH = kBottom - kTop;
  const vTop = 130;
  const vBottom = 160;
  const vH = vBottom - vTop;
  const padX = 8;
  const plotW = width - padX * 2;
  const count = Math.max(1, recentKline.length);
  const stepX = plotW / count;
  const barW = Math.max(2.5, Math.min(6.5, stepX * 0.65));

  const prices = recentKline.flatMap(d => [d.high, d.low, d.ma20 || d.close]);
  const maxP = Math.max(...prices, 1);
  const minP = Math.min(...prices, 0);
  const spanP = Math.max(0.5, maxP - minP);
  const toY = p => kBottom - ((p - minP) / spanP) * kH;
  const maxV = Math.max(100, ...recentKline.map(d => d.volume));

  const ma20Pts = recentKline
    .map((d, i) => `${(padX + i * stepX + stepX / 2).toFixed(1)},${toY(d.ma20 || d.close).toFixed(1)}`)
    .join(' ');
  const ma5Pts = recentKline
    .map((d, i) => `${(padX + i * stepX + stepX / 2).toFixed(1)},${toY(d.ma5 || d.close).toFixed(1)}`)
    .join(' ');

  const buyAbs = Math.max(1, chip1D.top15BuySum);
  const sellAbs = Math.max(1, Math.abs(chip1D.top15SellSum));
  const totalTug = buyAbs + sellAbs;
  const buyRatioPct = Math.round((buyAbs / totalTug) * 100);

  return (
    <aside className="screener-preview-drawer" id="screener-preview-drawer">
      <div className="preview-drawer-header">
        <div>
          <div className="preview-stock-title">
            <span className="preview-code">{stock.code}</span>
            <strong className="preview-name">{stock.name}</strong>
            <span className="preview-industry-tag">{stock.industry}</span>
          </div>
          <div className="preview-price-row">
            <span className={`preview-price ${stock.changePct >= 0 ? 'cell-red' : 'cell-green'}`}>
              {stock.price}
            </span>
            <span className={`preview-chg ${stock.changePct >= 0 ? 'cell-red' : 'cell-green'}`}>
              {stock.change >= 0 ? `▲ +${stock.change}` : `▼ ${stock.change}`} ({stock.changePct}%)
            </span>
            <span className="preview-vol">量 {stock.volume.toLocaleString()} 張</span>
          </div>
        </div>
        <div className="preview-header-actions">
          <button
            className="btn-expand-detail"
            onClick={() => onExpandFullDetail(stock.code)}
            title="進入步驟 2 完整個股 K 線與分點工作站"
            id="btn-expand-full-kline"
          >
            ⤢ 完整個股K線
          </button>
          <button className="btn-close-preview" onClick={onClose} title="收合右側快覽">
            ✕
          </button>
        </div>
      </div>

      {/* 三大動能轉折狀態膠囊 */}
      <div className="preview-momentum-strip">
        <div className="pm-item">
          <span className="pm-label">主力動能</span>
          <strong className={mom.main?.todayNet >= 0 ? 'cell-red' : 'cell-green'}>
            {mom.main?.stageLabel}
          </strong>
          <small>近5日 {mom.main?.buyDays5}/5 買</small>
        </div>
        <div className="pm-item">
          <span className="pm-label">投信動能</span>
          <strong className={mom.trust?.todayNet >= 0 ? 'cell-red' : 'cell-green'}>
            {mom.trust?.stageLabel}
          </strong>
          <small>近5日 {mom.trust?.buyDays5}/5 買</small>
        </div>
        <div className="pm-item">
          <span className="pm-label">外資動能</span>
          <strong className={mom.foreign?.todayNet >= 0 ? 'cell-red' : 'cell-green'}>
            {mom.foreign?.stageLabel}
          </strong>
          <small>持股 {stock.kline?.[stock.kline.length - 1]?.foreignHoldPct || '--'}%</small>
        </div>
      </div>

      {/* 迷你 40 日 K 線與成交量快覽圖 */}
      <div className="preview-chart-card">
        <div className="preview-card-title">
          <span>📈 近 40 日 K 線與均線軌跡</span>
          <span className="preview-ma-legend">
            <i style={{ color: '#3b82f6' }}>—5MA</i> <i style={{ color: '#ef4444' }}>—20MA</i>
          </span>
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} className="preview-kline-svg">
          <line x1={padX} y1={kTop} x2={width - padX} y2={kTop} stroke="rgba(148,163,184,0.15)" />
          <line x1={padX} y1={(kTop + kBottom) / 2} x2={width - padX} y2={(kTop + kBottom) / 2} stroke="rgba(148,163,184,0.15)" strokeDasharray="2 2" />
          <line x1={padX} y1={kBottom} x2={width - padX} y2={kBottom} stroke="rgba(148,163,184,0.2)" />
          <polyline fill="none" stroke="#3b82f6" strokeWidth="1.2" points={ma5Pts} />
          <polyline fill="none" stroke="#ef4444" strokeWidth="1.3" points={ma20Pts} />
          {recentKline.map((d, i) => {
            const cx = padX + i * stepX + stepX / 2;
            const x = padX + i * stepX + (stepX - barW) / 2;
            const isUp = d.close >= d.open;
            const col = isUp ? '#ef4444' : '#22c55e';
            const yHigh = toY(d.high);
            const yLow = toY(d.low);
            const yOpen = toY(d.open);
            const yClose = toY(d.close);
            const bTop = Math.min(yOpen, yClose);
            const bH = Math.max(2, Math.abs(yClose - yOpen));
            const vBarH = Math.max(2, (d.volume / maxV) * vH);
            return (
              <g key={d.date}>
                <line x1={cx} y1={yHigh} x2={cx} y2={yLow} stroke={col} strokeWidth="1" />
                <rect x={x} y={bTop} width={barW} height={bH} fill={col} />
                <rect x={x} y={vBottom - vBarH} width={barW} height={vBarH} fill={col} opacity="0.6" />
              </g>
            );
          })}
        </svg>
      </div>

      {/* 主力買賣超前 15 名紅綠拔河條 */}
      <div className="preview-tug-card">
        <div className="preview-card-title">
          <span>⚖️ 當日主力分點多空拔河 (主1: {stock.main1}%)</span>
          <strong className={chip1D.chipNet >= 0 ? 'cell-red' : 'cell-green'}>
            差額 {chip1D.chipNet >= 0 ? `+${chip1D.chipNet}` : chip1D.chipNet} 張
          </strong>
        </div>
        <div className="tug-bar-track">
          <div className="tug-bar-buy" style={{ width: `${buyRatioPct}%` }}>
            買方 +{chip1D.top15BuySum}張 ({buyRatioPct}%)
          </div>
          <div className="tug-bar-sell" style={{ width: `${100 - buyRatioPct}%` }}>
            賣方 {chip1D.top15SellSum}張
          </div>
        </div>

        {/* 前 5 大買超 vs 賣超分點對照 */}
        <div className="preview-top5-grid">
          <div className="preview-top5-col">
            <div className="top5-col-head cell-red">買超前 5 大分點</div>
            {chip1D.topBuyers.slice(0, 5).map(b => (
              <div key={b.id} className="top5-row">
                <span className="top5-bname">{b.name}</span>
                <strong className="cell-red">+{b.net}張</strong>
              </div>
            ))}
          </div>
          <div className="preview-top5-col">
            <div className="top5-col-head cell-green">賣超前 5 大分點</div>
            {chip1D.topSellers.slice(0, 5).map(b => (
              <div key={b.id} className="top5-row">
                <span className="top5-bname">{b.name}</span>
                <strong className="cell-green">{b.net}張</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button
        className="btn-full-detail-bottom"
        onClick={() => onExpandFullDetail(stock.code)}
      >
        🔍 進入「2. 個股K線」查看 60 日分點明細與完整副圖 →
      </button>
    </aside>
  );
}

const PRESET_STRATEGIES = {
  chip: [
    { id: 'main-surge', label: '主力集中飆升 (主1 ≥ 20%)', desc: '當日主力買賣超集中度 ≥ 20%', check: s => s.main1 >= 20 },
    { id: 'main-wave', label: '主力波段鎖碼 (主1/主5/主10皆≥10%)', desc: '短中長天期主力同步集中買進', check: s => s.main1 >= 10 && s.main5 >= 10 && s.main10 >= 10 },
    { id: 'trust-streak', label: '投信連買作帳 (投信連買 ≥ 2日)', desc: '投信法人連續買超 ≥ 2 日', check: s => s.trustConsec >= 2 },
    { id: 'dual-inst', label: '主力+投信同買 (主力&投信同步偏多)', desc: '主力與投信同步買超或連買共振', check: s => (s.main1 > 0 || s.mainConsec > 0 || s.momentum?.main?.todayNet > 0) && (s.trustPct > 0 || s.trustConsec > 0 || s.momentum?.trust?.todayNet > 0) },
    { id: 'dual-sell-inst', label: '📉 主力+投信同賣 (多殺多/空方狙擊)', desc: '主力與投信同步賣超調節或連賣，適合避開或放空操作', check: s => (s.main1 < 0 || s.mainConsec < 0 || s.momentum?.main?.todayNet < 0) && (s.trustPct < 0 || s.trustConsec < 0 || s.momentum?.trust?.todayNet < 0) },
    { id: 'main-dump', label: '📉 主力波段出貨 (主1 ≤ -10% & 主5 ≤ -5%)', desc: '短中期主力分點持續大舉倒貨調節', check: s => s.main1 <= -10 && s.main5 <= -5 },
    { id: 'low-pb-company', label: '股淨比 < 0.5 公司派大買', desc: '股價淨值比低於 0.5 且主力集中買超，容易是長線低點', check: s => s.pb < 0.5 && s.main1 > 0 }
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
    { id: 'maint-warn', label: '融資維持率 < 130% 警戒', desc: '維持率低於 130%，融資過高易多殺多', check: s => s.maintRatio < 130 }
  ]
};

const DEFAULT_SAVED_STRATEGIES = [
  {
    id: 'preset-wave-lock',
    name: '🔥 主力投信雙鎖碼強勢股 (做多)',
    marketScope: 'ALL',
    momentumTarget: 'dual',
    momentumStage: 'ALL',
    strategyIds: [],
    customFilters: { minMain1: '', minMain5: '', minTrustConsec: '', maxPb: '', minRevYoY: '', maxMaintRatio: '' }
  },
  {
    id: 'preset-dual-sell-short',
    name: '📉 主力投信雙賣空方狙擊 (做空/避險)',
    marketScope: 'ALL',
    momentumTarget: 'dualSell',
    momentumStage: 'ALL',
    strategyIds: [],
    customFilters: { minMain1: '', minMain5: '', minTrustConsec: '', maxPb: '', minRevYoY: '', maxMaintRatio: '' }
  },
  {
    id: 'preset-value-bottom',
    name: '💎 低股淨比公司派大買',
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

// 動能階段選項定義
const MOMENTUM_STAGES = [
  { id: 'ALL', label: '全部階段', desc: '顯示所有符合鎖定對象之個股' },
  { id: 'DAY1_BUY', label: '🔥 轉折第1天買', desc: '昨日以前連續賣超或觀望，今日第 1 天正式轉為買超！' },
  { id: 'BUY_5D', label: '📈 5天內偏買', desc: '近 5 個交易日內買超 ≥ 3 天且近 5 日合計買超 > 0' },
  { id: 'BUY_10D', label: '🚀 10天內偏買', desc: '近 10 個交易日內買超 ≥ 6 天且近 10 日合計買超 > 0' },
  { id: 'BUY_20D', label: '💎 近期偏買(20日)', desc: '近 20 個交易日內買超 ≥ 11 天且波段合計買超 > 0' },
  { id: 'DAY1_SELL', label: '⚠️ 轉折第1天賣', desc: '昨日以前買超，今日第 1 天轉為賣超調節' },
  { id: 'SELL_BEAR', label: '📉 5天/10天偏賣', desc: '近 5 日或近 10 日持續偏空調節賣超' }
];

function checkMomentumMatch(stock, target, stage) {
  const mom = stock.momentum || computeStockMomentum(stock.kline || []);

  const matchSingle = mObj => {
    if (!mObj) return false;
    switch (stage) {
      case 'DAY1_BUY':
        return Boolean(mObj.isDay1Buy);
      case 'BUY_5D':
        return Boolean(mObj.is5DBuy);
      case 'BUY_10D':
        return Boolean(mObj.is10DBuy);
      case 'BUY_20D':
        return Boolean(mObj.is20DBuy);
      case 'DAY1_SELL':
        return Boolean(mObj.isDay1Sell);
      case 'SELL_BEAR':
        return Boolean(mObj.is5DSell || mObj.is10DSell);
      default:
        return true;
    }
  };

  const isPositiveBuy = mObj =>
    Boolean(
      mObj &&
        (mObj.isDay1Buy ||
          mObj.is5DBuy ||
          mObj.is10DBuy ||
          mObj.is20DBuy ||
          mObj.todayNet > 0)
    );

  const isNegativeSell = mObj =>
    Boolean(
      mObj &&
        (mObj.isDay1Sell ||
          mObj.is5DSell ||
          mObj.is10DSell ||
          mObj.todayNet < 0)
    );

  if (target === 'dual') {
    // 主力 + 投信同買：即便 stage === 'ALL' 也立即篩出主力與投信同步偏買的個股
    if (stage === 'ALL') {
      return isPositiveBuy(mom.main) && isPositiveBuy(mom.trust);
    }
    if (stage === 'DAY1_BUY') {
      return (mom.main?.isDay1Buy || mom.main?.is5DBuy) && (mom.trust?.isDay1Buy || mom.trust?.is5DBuy);
    }
    return matchSingle(mom.main) && matchSingle(mom.trust);
  }

  if (target === 'dualSell') {
    // 主力 + 投信同賣：即便 stage === 'ALL' 也立即篩出主力與投信同步偏賣的個股
    if (stage === 'ALL' || stage === 'SELL_BEAR') {
      return isNegativeSell(mom.main) && isNegativeSell(mom.trust);
    }
    if (stage === 'DAY1_SELL') {
      return (mom.main?.isDay1Sell || mom.main?.is5DSell) && (mom.trust?.isDay1Sell || mom.trust?.is5DSell);
    }
    return matchSingle(mom.main) && matchSingle(mom.trust);
  }

  if (stage === 'ALL') return true;
  return matchSingle(mom[target]);
}

export const HOT_THEME_GROUPS = [
  {
    id: 'ai-servers',
    name: '🤖 AI伺服器代工',
    codes: ['2317', '2382', '3231', '2356', '2376', '6669'],
    desc: '鴻海(2317)、廣達(2382)、緯創(3231)、英業達(2356)、技嘉(2376)、緯穎(6669)'
  },
  {
    id: 'cooling',
    name: '❄️ 散熱水冷模組',
    codes: ['3017', '3324', '3653', '8996', '3483'],
    desc: '奇鋐(3017)、雙鴻(3324)、健策(3653)、高力(8996)、力致(3483)'
  },
  {
    id: 'power-grid',
    name: '⚡ 重電綠能強韌電網',
    codes: ['1519', '1503', '1513', '1514'],
    desc: '華城(1519)、士電(1503)、中興電(1513)、亞力(1514)'
  },
  {
    id: 'ccl-copper',
    name: '⚡ CCL銅箔基板與PCB載板',
    codes: ['2383', '6274', '6213', '8358', '5469', '3037', '2368', '8155', '2367', '4927', '5439'],
    desc: '台光電(2383)、台燿(6274)、聯茂(6213)、金居(8358)、瀚宇博(5469)、欣興(3037)、金像電(2368)、博智(8155)、燿華(2367)、泰鼎-KY(4927)、高技(5439)'
  },
  {
    id: 'semicon',
    name: '💻 先進半導體封測',
    codes: ['2330', '2454', '3711', '3583', '3131'],
    desc: '台積電(2330)、聯發科(2454)、日月光投控(3711)、辛耘(3583)、弘塑(3131)'
  },
  {
    id: 'shipping',
    name: '🚢 貨櫃與散裝航運',
    codes: ['2603', '2609', '2615', '2605'],
    desc: '長榮(2603)、陽明(2609)、萬海(2615)、新興(2605)'
  },
  {
    id: 'automotive',
    name: '🚗 車用電子零組件',
    codes: ['1536', '2227', '3665', '3715'],
    desc: '和大(1536)、裕日車(2227)、貿聯-KY(3665)、定穎投控(3715)'
  },
  {
    id: 'high-dividend',
    name: '💰 高股息權值ETF',
    codes: ['0056', '00878', '00919', '00929'],
    desc: '元大高股息(0056)、國泰永續高股息(00878)、群益台灣精選高息(00919)、復華台灣科技優息(00929)'
  }
];

export default function StockScreener({
  stocks,
  taiexData,
  pinnedCodes,
  onTogglePin,
  onSelectStock,
  onBatchAddStocks,
  onOpenFormulaModal
}) {
  const [marketScope, setMarketScope] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  // 方案 C 核心：動能目標 ('main' | 'trust' | 'foreign' | 'dual' | 'dualSell') 與動能階段
  const [momentumTarget, setMomentumTarget] = useState('main');
  const [momentumStage, setMomentumStage] = useState('ALL');
  // 方案 C 核心：右側免跳頁個股 K 線與分點快覽抽屜
  const [previewCode, setPreviewCode] = useState('2330');
  const [isPreviewOpen, setIsPreviewOpen] = useState(true);

  // 批次加入與族群快選 Modal
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchInputText, setBatchInputText] = useState('');
  const [isBatchLoading, setIsBatchLoading] = useState(false);
  const [batchMessage, setBatchMessage] = useState('');
  const [alsoAddToWatchlist, setAlsoAddToWatchlist] = useState(true);
  const [batchProgress, setBatchProgress] = useState({
    active: false,
    current: 0,
    total: 0,
    code: '',
    name: '',
    percent: 0,
    status: 'idle'
  });

  const [activeCategoryDrawer, setActiveCategoryDrawer] = useState(null);
  const [activeStrategyIds, setActiveStrategyIds] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'desc' });
  const [columnMode, setColumnMode] = useState('fig1');
  const [countdown, setCountdown] = useState(5);
  const [isLivePaused, setIsLivePaused] = useState(false);
  const [tickJitter, setTickJitter] = useState(0);
  const [newStrategyName, setNewStrategyName] = useState('');

  // 自訂儲存策略清單 (持久化於 localStorage)
  const [savedStrategies, setSavedStrategies] = useState(() => {
    try {
      const raw = localStorage.getItem('chipflow_saved_strategies_v2');
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

  useEffect(() => {
    if (isLivePaused) return;
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setTickJitter(Math.round((Math.random() - 0.48) * 2));
          return 5;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isLivePaused]);

  const liveIndexVal = Number(((taiexData?.price || 41661.7) + tickJitter).toFixed(1));
  const liveIndexChg = Number(((taiexData?.change || 1960.1) + tickJitter).toFixed(1));
  const liveIndexPct = taiexData?.changePct ?? 4.94;
  const liveFuturesVal = Math.round((taiexData?.futuresPrice || 41635) + tickJitter);
  const liveFuturesDiff = Math.round(liveFuturesVal - liveIndexVal);

  const toggleStrategy = id => {
    setActiveStrategyIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const clearAllConditions = () => {
    setMarketScope('ALL');
    setSearchQuery('');
    setMomentumTarget('main');
    setMomentumStage('ALL');
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
      momentumTarget,
      momentumStage,
      strategyIds: activeStrategyIds,
      customFilters: { ...customFilters }
    };
    const updated = [item, ...savedStrategies];
    setSavedStrategies(updated);
    setNewStrategyName('');
    try {
      localStorage.setItem('chipflow_saved_strategies_v2', JSON.stringify(updated));
    } catch {
      // ignore storage errors
    }
  };

  const handleApplySavedStrategy = item => {
    setMarketScope(item.marketScope || 'ALL');
    if (item.momentumTarget) setMomentumTarget(item.momentumTarget);
    if (item.momentumStage) setMomentumStage(item.momentumStage);
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
      localStorage.setItem('chipflow_saved_strategies_v2', JSON.stringify(updated));
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

  // 統計各動能階段符合檔數（即時顯示於按鈕上）
  const stageCounts = useMemo(() => {
    const counts = {};
    MOMENTUM_STAGES.forEach(st => {
      counts[st.id] = stocks.filter(s => checkMomentumMatch(s, momentumTarget, st.id)).length;
    });
    return counts;
  }, [stocks, momentumTarget]);

  const dualBuyCount = useMemo(
    () => stocks.filter(s => checkMomentumMatch(s, 'dual', momentumStage)).length,
    [stocks, momentumStage]
  );
  const dualSellCount = useMemo(
    () => stocks.filter(s => checkMomentumMatch(s, 'dualSell', momentumStage)).length,
    [stocks, momentumStage]
  );

  const hasCustomFilter = Object.values(customFilters).some(v => v !== '');
  const totalFilterCount =
    activeStrategyIds.length +
    (hasCustomFilter ? 1 : 0) +
    (marketScope !== 'ALL' ? 1 : 0) +
    (momentumStage !== 'ALL' || momentumTarget === 'dual' || momentumTarget === 'dualSell' ? 1 : 0);

  const filteredStocks = useMemo(() => {
    let list = [...stocks];

    // 1. 監控對象過濾
    if (marketScope === 'LISTED') {
      list = list.filter(s => s.market === '上市');
    } else if (marketScope === 'OTC') {
      list = list.filter(s => s.market === '上櫃');
    } else if (marketScope === 'PINNED') {
      list = list.filter(s => pinnedCodes.includes(s.code));
    } else if (marketScope === 'CACHED') {
      list = list.filter(s => s.isUserCached);
    }

    // 2. 動能轉折階段篩選 (含主力+投信同買 / 主力+投信同賣 / 第1天買 / 5天偏買 / 10天偏買 / 近期偏買 / 第1天賣 / 偏賣)
    if (momentumStage !== 'ALL' || momentumTarget === 'dual' || momentumTarget === 'dualSell') {
      list = list.filter(s => checkMomentumMatch(s, momentumTarget, momentumStage));
    }

    // 3. 搜尋關鍵字
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        s =>
          s.code.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.industry.toLowerCase().includes(q)
      );
    }

    // 4. 策略標籤篩選
    if (activeStrategyIds.length > 0) {
      const activeChecks = allStrategiesList.filter(st => activeStrategyIds.includes(st.id));
      list = list.filter(s => activeChecks.every(st => st.check(s)));
    }

    // 5. 自訂數值條件
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

    // 6. 排序（置頂股永遠優先）
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
  }, [
    stocks,
    marketScope,
    momentumTarget,
    momentumStage,
    searchQuery,
    activeStrategyIds,
    customFilters,
    sortConfig,
    pinnedCodes,
    allStrategiesList
  ]);

  const previewStock = useMemo(() => {
    return (
      filteredStocks.find(s => s.code === previewCode) ||
      stocks.find(s => s.code === previewCode) ||
      filteredStocks[0] ||
      stocks[0]
    );
  }, [filteredStocks, stocks, previewCode]);

  // 匯出當前選股結果為 CSV
  const handleExportCsv = () => {
    const headers = [
      '代號',
      '名稱',
      '成交價',
      '漲跌幅(%)',
      '成交量',
      '細產業分類',
      '主力動能狀態',
      '投信動能狀態',
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
      s.momentum?.main?.stageLabel || '',
      s.momentum?.trust?.stageLabel || '',
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
    a.download = `MainBuy主力選股清單_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 執行批次匯入股票或熱門族群（即時進度追蹤）
  const handleExecuteBatchAdd = async targetCodes => {
    if (!onBatchAddStocks) return;
    const list =
      targetCodes ||
      batchInputText
        .split(/[\s,，、\n]+/)
        .map(s => s.trim())
        .filter(Boolean);
    if (list.length === 0) {
      setBatchMessage('⚠️ 請輸入至少一檔台股代號（如 2330、2454）或點選下方熱門族群標籤');
      return;
    }

    setIsBatchLoading(true);
    setBatchProgress({
      active: true,
      current: 0,
      total: list.length,
      code: list[0],
      name: '',
      percent: 0,
      status: 'fetching'
    });
    setBatchMessage(`⏳ 準備匯入 ${list.length} 檔股票，即將開始連線抓取籌碼與分點資料...`);

    try {
      const res = await onBatchAddStocks(list, progress => {
        setBatchProgress({
          active: true,
          current: progress.current,
          total: progress.total,
          code: progress.code,
          name: progress.name || '',
          percent: progress.percent,
          status: progress.status
        });
        setBatchMessage(
          `⏳ 正在抓取 [${progress.current}/${progress.total}]：${progress.code} ${
            progress.name ? `${progress.name} ` : ''
          }籌碼與分點日報表 (${progress.percent}%)`
        );
      });

      if (alsoAddToWatchlist && onTogglePin) {
        list.forEach(c => {
          if (!pinnedCodes.includes(c)) {
            onTogglePin(c);
          }
        });
      }

      setBatchProgress(prev => ({
        ...prev,
        active: true,
        current: list.length,
        percent: 100,
        status: 'done'
      }));

      setBatchMessage(
        `🎉 成功匯入 ${res.success} 檔股票至選股池！${alsoAddToWatchlist ? '已同步加入自選股 ⭐' : ''}`
      );
      setTimeout(() => {
        setIsBatchModalOpen(false);
        setIsBatchLoading(false);
        setBatchMessage('');
        setBatchInputText('');
        setBatchProgress({
          active: false,
          current: 0,
          total: 0,
          code: '',
          name: '',
          percent: 0,
          status: 'idle'
        });
      }, 1600);
    } catch (err) {
      setBatchMessage(`⚠️ 匯入過程異常: ${err.message}`);
      setIsBatchLoading(false);
      setBatchProgress(prev => ({ ...prev, active: false }));
    }
  };

  const getSignedColorClass = val => {
    if (val > 0) return 'cell-red';
    if (val < 0) return 'cell-green';
    return 'cell-neutral';
  };

  const showFig1Cols = columnMode === 'fig1' || columnMode === 'all';
  const showFig3Cols = columnMode === 'fig3' || columnMode === 'all';
  const cachedCount = stocks.filter(s => s.isUserCached).length;

  return (
    <section className="screener-container" id="screener-section">
      {/* 頂部監控工具列 */}
      <div className="screener-toolbar">
        <div className="toolbar-left">
          <span className="toolbar-label">選股範圍</span>
          <select
            className="monitor-select"
            value={marketScope}
            onChange={e => setMarketScope(e.target.value)}
            id="select-monitor-target"
          >
            <option value="ALL">台股熱門選股池 ({stocks.length})</option>
            <option value="PINNED">⭐ 我的自選股 ({pinnedCodes.length})</option>
            <option value="LISTED">台股上市</option>
            <option value="OTC">台股上櫃</option>
            <option value="CACHED">⚡ 曾搜尋快取股 ({cachedCount})</option>
          </select>

          <button
            className={`btn-watchlist-filter-pill ${marketScope === 'PINNED' ? 'active' : ''}`}
            onClick={() => setMarketScope(prev => (prev === 'PINNED' ? 'ALL' : 'PINNED'))}
            title={marketScope === 'PINNED' ? '切換回全部選股池' : '一鍵篩選：僅看我的自選股'}
            id="btn-quick-filter-watchlist"
          >
            ⭐ 自選股 ({pinnedCodes.length})
          </button>

          <button
            className="btn-batch-add-pill"
            onClick={() => {
              setIsBatchModalOpen(true);
              setBatchMessage('');
            }}
            id="btn-open-batch-modal"
            title="批次輸入多檔股票代號或一鍵加入熱門族群概念股"
          >
            ➕ 批次加入 / 族群快選
          </button>

          <div className="quick-search-wrap">
            <input
              type="text"
              className="toolbar-search-input"
              placeholder="篩選代號/名稱/產業..."
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
              主力策略
            </button>
            <button
              className={`btn-strategy-tab ${activeCategoryDrawer === 'tech' ? 'active' : ''}`}
              onClick={() => setActiveCategoryDrawer(prev => (prev === 'tech' ? null : 'tech'))}
              id="btn-tab-tech"
            >
              技術突破
            </button>
            <button
              className={`btn-strategy-tab ${activeCategoryDrawer === 'intraday' ? 'active' : ''}`}
              onClick={() => setActiveCategoryDrawer(prev => (prev === 'intraday' ? null : 'intraday'))}
              id="btn-tab-intraday"
            >
              盤中大單
            </button>
            <button
              className={`btn-strategy-tab ${activeCategoryDrawer === 'fundamental' ? 'active' : ''}`}
              onClick={() => setActiveCategoryDrawer(prev => (prev === 'fundamental' ? null : 'fundamental'))}
              id="btn-tab-fundamental"
            >
              價值基本面
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

        {/* 中央加權與期貨即時報價 (點擊加權或期貨可開啟大盤加權指數 K 線與大盤籌碼工作站) */}
        <div className="toolbar-center-quotes">
          <div
            className="market-quote-box clickable-market-box"
            onClick={() => onSelectStock('TAIEX')}
            style={{ cursor: 'pointer' }}
            title="點擊查看大盤加權指數 K 線、布林通道與三大法人/散戶/融資融券籌碼"
            id="btn-open-taiex-kline"
          >
            <span className="quote-name">加權 📈</span>
            <span className={`quote-val ${liveIndexChg >= 0 ? 'red' : 'green'}`}>
              {liveIndexVal.toLocaleString()}
            </span>
            <span className={`quote-diff ${liveIndexChg >= 0 ? 'red' : 'green'}`}>
              {liveIndexChg >= 0 ? `▲${Math.round(liveIndexChg)}` : `▼${Math.abs(Math.round(liveIndexChg))}`} ({liveIndexPct >= 0 ? `+${liveIndexPct}` : liveIndexPct}%)
            </span>
          </div>
          <div
            className="market-quote-box clickable-market-box"
            onClick={() => onSelectStock('TAIEX')}
            style={{ cursor: 'pointer' }}
            title="台指期近月報價與正逆價差（點擊查看大盤 K 線與籌碼）"
            id="btn-open-futures-kline"
          >
            <span className="quote-name orange">期貨</span>
            <span className="quote-val yellow">{liveFuturesVal.toLocaleString()}</span>
            <span className={`quote-diff ${liveFuturesDiff >= 0 ? 'red' : 'green'}`}>
              價差 {liveFuturesDiff >= 0 ? `+${liveFuturesDiff}` : liveFuturesDiff}
            </span>
          </div>
          <div
            className="market-quote-box refresh-box"
            onClick={() => setIsLivePaused(p => !p)}
            style={{ cursor: 'pointer' }}
            title="點擊可暫停/恢復每 5 秒自動更新"
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
            數值門檻
          </button>
          <select
            className="column-mode-select"
            value={columnMode}
            onChange={e => setColumnMode(e.target.value)}
            id="select-column-mode"
            title="切換顯示欄位組合"
          >
            <option value="fig1">欄位：主力動能標準版</option>
            <option value="fig3">欄位：估值與維持率版</option>
            <option value="all">欄位：全欄位展開</option>
          </select>
          <button
            className={`btn-toolbar-action ${isPreviewOpen ? 'blue-text' : ''}`}
            onClick={() => setIsPreviewOpen(p => !p)}
            title="開啟或關閉右側免跳頁個股 K 線快覽面板"
            id="btn-toggle-preview-drawer"
          >
            {isPreviewOpen ? '◫ 隱藏快覽' : '◫ 開啟K線快覽'}
          </button>
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

      {/* 方案 C 招牌功能：多空動能轉折快篩矩陣 (主力 / 投信 / 外資 / 同買 / 同賣 × 第1天買 / 5天偏買 / 10天偏買 / 近期偏買 / 偏賣) */}
      <div className="momentum-matrix-bar" id="momentum-matrix-bar">
        <div className="mm-target-group">
          <span className="mm-group-label">🎯 鎖定對象：</span>
          {[
            { id: 'main', label: '主力買賣' },
            { id: 'trust', label: '投信法人' },
            { id: 'foreign', label: '外資法人' },
            { id: 'dual', label: `🔥 主力+投信同買 (${dualBuyCount})` },
            { id: 'dualSell', label: `📉 主力+投信同賣 (${dualSellCount})`, isBear: true }
          ].map(t => (
            <button
              key={t.id}
              className={`mm-target-btn ${t.isBear ? 'bear-target' : ''} ${momentumTarget === t.id ? 'active' : ''}`}
              onClick={() => setMomentumTarget(t.id)}
              id={`btn-mm-target-${t.id}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mm-stage-group">
          <span className="mm-group-label">⚡ 動能轉折階段：</span>
          {MOMENTUM_STAGES.map(st => {
            const isSelected = momentumStage === st.id;
            const isBear = st.id === 'DAY1_SELL' || st.id === 'SELL_BEAR';
            return (
              <button
                key={st.id}
                className={`mm-stage-pill ${isSelected ? 'active' : ''} ${isBear ? 'bear-pill' : ''}`}
                onClick={() => setMomentumStage(st.id)}
                title={st.desc}
                id={`btn-mm-stage-${st.id}`}
              >
                <span>{st.label}</span>
                <span className="mm-count-badge">{stageCounts[st.id] ?? 0}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 展開式策略抽屜 */}
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
                  placeholder="輸入新策略名稱（儲存目前動能篩選與數值門檻）..."
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
                點擊啟用進階選股條件（可與上方動能階段疊加組合）：
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
          💡 <strong>單擊任一列</strong>可於右側快覽 K 線與前 5 大買賣分點；<strong>點擊「詳情K線」按鈕或雙擊列</strong>可進入「<strong>2. 個股K線</strong>」全螢幕工作站。搜尋過的股票皆會自動快取於本機秒開！
        </span>
        <span className="subhint-right">
          符合條件共 <strong>{filteredStocks.length}</strong> 檔個股
        </span>
      </div>

      {/* 方案 C 雙模主體：左側高密度動能選股表 + 右側可收合免跳頁個股 K 線快覽抽屜 */}
      <div className={`screener-split-workspace ${isPreviewOpen ? 'with-preview' : ''}`}>
        <div className="screener-table-wrapper">
          <table className="screener-table" id="screener-data-table">
            <thead>
              <tr>
                <th className="sticky-col col-pin" title="加入/移除我的自選股追蹤">自<br />選</th>
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

                {/* 方案 C 新增：動能狀態標籤 & 近 10 日買賣超紅綠熱力格 */}
                <th title="目前鎖定對象之多空轉折階段">
                  {momentumTarget === 'trust'
                    ? '投信動能狀態'
                    : momentumTarget === 'foreign'
                      ? '外資動能狀態'
                      : '主力動能狀態'}
                </th>
                <th title="近 10 個交易日逐日買賣超紅綠軌跡 (最右側為今日)">
                  近10日買賣軌跡
                </th>

                <th className="sortable" onClick={() => handleSort('volume')}>
                  成交量 {sortConfig.key === 'volume' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                </th>

                <th className="col-industry sortable" onClick={() => handleSort('industry')}>細產業分類</th>

                <th className="sortable" onClick={() => handleSort('mainConsec')} title="主力連續買賣超天數">主力<br />連買</th>
                <th className="sortable" onClick={() => handleSort('foreignConsec')} title="外資連續買賣超天數">外資<br />連買</th>
                <th className="sortable" onClick={() => handleSort('trustConsec')} title="投信連續買賣超天數">投信<br />連買</th>

                <th
                  className="sortable"
                  onClick={() => handleSort('main1')}
                  title="主1：(今日買超前15名總量 - 今日賣超前15名總量) / 當天成交量 * 100"
                >
                  主1 {sortConfig.key === 'main1' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th
                  className="sortable"
                  onClick={() => handleSort('main5')}
                  title="主5：(五日區間買超總量 - 五日區間賣超總量) / 五日成交量 * 100"
                >
                  主5 {sortConfig.key === 'main5' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th
                  className="sortable"
                  onClick={() => handleSort('main10')}
                  title="主10：(十日區間買超總量 - 十日區間賣超總量) / 十日成交量 * 100"
                >
                  主10 {sortConfig.key === 'main10' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                </th>

                <th
                  className="sortable"
                  onClick={() => handleSort('foreignPct')}
                  title="外資%【外資當日買賣佔比】：外資當日淨買賣超張數 / 當日總成交量 × 100%（正值為買超，負值為賣超）"
                >
                  外資% {sortConfig.key === 'foreignPct' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th
                  className="sortable"
                  onClick={() => handleSort('trustPct')}
                  title="投信%【投信當日買賣佔比】：投信當日淨買賣超張數 / 當日總成交量 × 100%（正值為買超，負值為賣超）"
                >
                  投信% {sortConfig.key === 'trustPct' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th
                  className="sortable"
                  onClick={() => handleSort('dealerPct')}
                  title="自營%【自營商當日買賣佔比】：自營商當日淨買賣超張數 / 當日總成交量 × 100%"
                >
                  自營%
                </th>
                <th
                  className="sortable"
                  onClick={() => handleSort('dayTradePct')}
                  title="當沖%【當沖成交比率】：當日沖銷總成交張數 / 當日總成交量 × 100%"
                >
                  當沖%
                </th>
                <th
                  className="sortable"
                  onClick={() => handleSort('marginPct')}
                  title="融資%【融資變動佔比】：當日融資增減張數 / 當日總成交量 × 100%"
                >
                  融資%
                </th>
                <th
                  className="sortable"
                  onClick={() => handleSort('shortPct')}
                  title="融券%【融券變動佔比】：當日融券增減張數 / 當日總成交量 × 100%"
                >
                  融券%
                </th>
                <th
                  className="sortable"
                  onClick={() => handleSort('shortMarginRatio')}
                  title="券資比%：融券餘額 / 融資餘額 × 100%（券資比高伴隨主力鎖碼易發動軋空行情）"
                >
                  券資<br />比%
                </th>
                <th
                  className="sortable"
                  onClick={() => handleSort('biasYear')}
                  title="乖年【乖離年線】：舉例年線100，股價90，乖年=-10"
                >
                  乖離年<br />線%
                </th>

                {showFig1Cols && (
                  <>
                    <th className="sortable" onClick={() => handleSort('monthSlope')}>月線<br />斜率</th>
                    <th className="sortable" onClick={() => handleSort('bandWidth')} title="布林通道帶寬(%)">帶寬</th>
                    <th className="sortable" onClick={() => handleSort('bandPos')} title="布林通道相對位階">位階</th>
                  </>
                )}

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
                const isPreviewSelected = previewStock?.code === stock.code;
                const priceColor = getSignedColorClass(stock.changePct);
                const mom = stock.momentum || computeStockMomentum(stock.kline || []);
                const activeMomObj =
                  momentumTarget === 'trust'
                    ? mom.trust
                    : momentumTarget === 'foreign'
                      ? mom.foreign
                      : mom.main;

                const stageBadgeClass = activeMomObj?.isDay1Buy
                  ? 'stage-day1-buy'
                  : activeMomObj?.is5DBuy || activeMomObj?.is10DBuy || activeMomObj?.is20DBuy
                    ? 'stage-bull'
                    : activeMomObj?.isDay1Sell
                      ? 'stage-day1-sell'
                      : 'stage-bear';

                return (
                  <tr
                    key={stock.code}
                    className={`screener-row ${isPinned ? 'row-pinned' : ''} ${
                      isPreviewSelected ? 'row-preview-active' : ''
                    }`}
                    onClick={() => {
                      setPreviewCode(stock.code);
                      if (!isPreviewOpen) {
                        onSelectStock(stock.code);
                      }
                    }}
                    onDoubleClick={() => onSelectStock(stock.code)}
                    id={`row-stock-${stock.code}`}
                  >
                    <td
                      className="sticky-col col-pin"
                      onClick={e => {
                        e.stopPropagation();
                        onTogglePin(stock.code);
                      }}
                      title={isPinned ? '點擊從自選股移除' : '點擊加入我的自選股追蹤'}
                    >
                      <button
                        type="button"
                        className={`btn-star-pin ${isPinned ? 'pinned-active' : ''}`}
                        aria-label={`自選 ${stock.name}`}
                      >
                        {isPinned ? '★' : '☆'}
                      </button>
                    </td>
                    <td
                      className="sticky-col col-code"
                      onClick={e => {
                        e.stopPropagation();
                        onSelectStock(stock.code);
                      }}
                      title="點擊直接進入個股K線完整工作站"
                    >
                      {stock.code}
                    </td>
                    <td
                      className="sticky-col col-name"
                      onClick={e => {
                        e.stopPropagation();
                        onSelectStock(stock.code);
                      }}
                      title="點擊直接進入個股K線完整工作站"
                    >
                      <span>{stock.name}</span>
                      {stock.isUserCached && (
                        <span className="cached-dot" title="已快取於本機瀏覽器">⚡</span>
                      )}
                    </td>
                    <td className="col-kbar">
                      <MiniCandle type={stock.candleType} />
                    </td>
                    <td className={`num-cell ${priceColor}`}>{stock.price}</td>
                    <td className={`num-cell ${priceColor}`}>{stock.changePct}</td>

                    {/* 動能轉折狀態標籤 */}
                    <td className="col-mom-stage">
                      <span className={`mom-stage-badge ${stageBadgeClass}`}>
                        {activeMomObj?.stageLabel || '盤整'}
                      </span>
                    </td>

                    {/* 近10日買賣紅綠熱力格 */}
                    <td className="col-sparkbar">
                      <Recent10Sparkbar values={activeMomObj?.recent10 || []} />
                    </td>

                    <td className="num-cell cell-neutral">{stock.volume.toLocaleString()}</td>

                    <td className="col-industry">{stock.industry}</td>

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

                    {showFig1Cols && (
                      <>
                        <td className={`num-cell ${getSignedColorClass(stock.monthSlope)}`}>
                          {stock.monthSlope}
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

        {/* 右側免跳頁個股 K 線與分點拔河快覽抽屜 */}
        {isPreviewOpen && previewStock && (
          <QuickStockPreviewDrawer
            stock={previewStock}
            onClose={() => setIsPreviewOpen(false)}
            onExpandFullDetail={code => onSelectStock(code)}
          />
        )}
      </div>

      {/* ➕ 批次加入股票 / 熱門族群一鍵快選彈窗 (Batch Add Modal) */}
      {isBatchModalOpen && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (!isBatchLoading) setIsBatchModalOpen(false);
          }}
          id="batch-add-modal-backdrop"
        >
          <div
            className="modal-panel batch-add-panel"
            onClick={e => e.stopPropagation()}
            id="batch-add-modal-panel"
          >
            <div className="modal-header">
              <div>
                <h2 className="modal-title">➕ 批次加入股票 / 熱門族群一鍵快選</h2>
                <p className="modal-subtitle">
                  無需一檔一檔手動查詢！支援輸入多檔台股代號批次匯入，或直接一鍵將熱門題材概念股全數加入選股池
                </p>
              </div>
              <button
                className="btn-icon-close"
                onClick={() => {
                  if (!isBatchLoading) setIsBatchModalOpen(false);
                }}
                disabled={isBatchLoading}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {/* 自訂輸入區塊 */}
              <div className="batch-section">
                <label className="batch-section-label">
                  <strong>✍️ 批次輸入台股代號（支援逗號、空格或換行）：</strong>
                  <span className="batch-subhint">例如：2330, 2454, 2382, 3017, 3324, 1519, 2603, 3037</span>
                </label>
                <textarea
                  className="batch-textarea"
                  rows={4}
                  placeholder="請在此貼上或輸入股票代號（例如：2330 2454 2382 3017 3324 1519 2603）..."
                  value={batchInputText}
                  onChange={e => setBatchInputText(e.target.value)}
                  disabled={isBatchLoading}
                  id="textarea-batch-codes"
                />
                <div className="batch-actions-row">
                  <button
                    className="btn-execute-batch"
                    onClick={() => handleExecuteBatchAdd()}
                    disabled={isBatchLoading || !batchInputText.trim()}
                    id="btn-submit-batch-add"
                  >
                    {isBatchLoading
                      ? `⏳ 正在抓取 [${batchProgress.current}/${batchProgress.total}] (${batchProgress.percent}%)`
                      : '🚀 一鍵批次匯入並快取'}
                  </button>
                  <button
                    className="btn-clear-textarea"
                    onClick={() => setBatchInputText('')}
                    disabled={isBatchLoading || !batchInputText}
                  >
                    清空輸入
                  </button>
                  <label className="batch-watchlist-checkbox-label">
                    <input
                      type="checkbox"
                      checked={alsoAddToWatchlist}
                      onChange={e => setAlsoAddToWatchlist(e.target.checked)}
                      disabled={isBatchLoading}
                    />
                    <span>⭐ 同步加入「我的自選股」</span>
                  </label>
                </div>
              </div>

              {/* 即時進度與狀態訊息區塊 */}
              {(batchMessage || batchProgress.active) && (
                <div
                  className={`batch-status-banner ${
                    batchMessage.includes('✅') || batchMessage.includes('🎉')
                      ? 'status-success'
                      : batchMessage.includes('⏳')
                        ? 'status-loading'
                        : 'status-error'
                  }`}
                  id="batch-progress-status-banner"
                >
                  <div className="batch-status-title-row">
                    <span className="batch-status-text">
                      {isBatchLoading && <span className="batch-spinner" />}
                      {batchMessage}
                    </span>
                    {batchProgress.active && batchProgress.total > 0 && (
                      <span className="batch-status-count-badge">
                        {batchProgress.current} / {batchProgress.total} 檔
                      </span>
                    )}
                  </div>

                  {batchProgress.active && (
                    <div className="batch-progress-container">
                      <div className="batch-progress-bar-track">
                        <div
                          className="batch-progress-bar-fill"
                          style={{ width: `${Math.min(100, Math.max(0, batchProgress.percent))}%` }}
                        />
                      </div>
                      <div className="batch-progress-meta">
                        <span className="batch-current-target">
                          {batchProgress.status === 'done' && batchProgress.percent === 100 ? (
                            '✅ 全數資料抓取完畢，已納入選股池'
                          ) : (
                            <>
                              <span className="pulse-dot" />
                              正在同步：
                              <strong>
                                {batchProgress.code} {batchProgress.name}
                              </strong>
                            </>
                          )}
                        </span>
                        <strong className="batch-progress-pct-val">{batchProgress.percent}%</strong>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 熱門題材族群一鍵快選 */}
              <div className="batch-section theme-groups-section">
                <label className="batch-section-label">
                  <strong>🔥 熱門題材族群一鍵加入選股池（點擊整組匯入）：</strong>
                </label>
                <div className="theme-groups-grid">
                  {HOT_THEME_GROUPS.map(grp => (
                    <div key={grp.id} className="theme-group-card">
                      <div className="theme-group-header">
                        <span className="theme-group-title">{grp.name}</span>
                        <span className="theme-group-count">{grp.codes.length} 檔</span>
                      </div>
                      <p className="theme-group-desc">{grp.desc}</p>
                      <button
                        className="btn-add-theme-group"
                        onClick={() => handleExecuteBatchAdd(grp.codes)}
                        disabled={isBatchLoading}
                        id={`btn-add-theme-${grp.id}`}
                      >
                        {isBatchLoading
                          ? `⏳ 抓取進度 ${batchProgress.current}/${batchProgress.total}...`
                          : `+ 一鍵加入全組 (${grp.codes.join(', ')})`}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
