import React, { useState, useMemo, useEffect, useRef } from 'react';
import { computePeriodChipAnalysis, BROKER_LIST } from '../data/mockStocks';
import { fetchSingleBrokerHistoryFromPortal } from '../services/liveStockService';

// 通用副圖 SVG 元件（同時繪製紅綠柱狀圖 + 累計/庫存折線圖 + 同步十字查價線；若當日盤後籌碼尚未公布則自動留空）
function SubIndicatorChart({
  data,
  hoverIdx,
  onHoverIdx,
  barKey,
  lineKey,
  lineColor = '#7e57c2',
  isKDJ = false
}) {
  const width = 760;
  const height = 68;
  const padLeft = 6;
  const padRight = 54;
  const plotW = width - padLeft - padRight;
  const count = data.length || 1;
  const stepX = plotW / count;
  const barW = Math.max(2.5, Math.min(8, stepX * 0.62));

  if (isKDJ) {
    const kPoints = data
      .map((d, i) => {
        const x = padLeft + i * stepX + stepX / 2;
        const y = height - 4 - (d.k / 100) * (height - 8);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
    const dPoints = data
      .map((d, i) => {
        const x = padLeft + i * stepX + stepX / 2;
        const y = height - 4 - (d.d / 100) * (height - 8);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
    const hoverX = padLeft + hoverIdx * stepX + stepX / 2;

    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="subchart-svg"
        onMouseMove={e => {
          const rect = e.currentTarget.getBoundingClientRect();
          const relX = ((e.clientX - rect.left) / rect.width) * width - padLeft;
          const idx = Math.min(count - 1, Math.max(0, Math.floor(relX / stepX)));
          onHoverIdx(idx);
        }}
      >
        <line x1={padLeft} y1={14} x2={width - padRight} y2={14} stroke="var(--chart-grid)" strokeDasharray="2 2" />
        <line x1={padLeft} y1={height / 2} x2={width - padRight} y2={height / 2} stroke="var(--chart-grid)" />
        <line x1={padLeft} y1={height - 12} x2={width - padRight} y2={height - 12} stroke="var(--chart-grid)" strokeDasharray="2 2" />
        <polyline fill="none" stroke="#2563eb" strokeWidth="1.4" points={kPoints} />
        <polyline fill="none" stroke="#9333ea" strokeWidth="1.4" points={dPoints} />
        <line x1={hoverX} y1={0} x2={hoverX} y2={height} stroke="var(--crosshair-color)" strokeWidth="1" />
        <text x={width - padRight + 4} y={13} className="axis-label">80</text>
        <text x={width - padRight + 4} y={height / 2 + 4} className="axis-label">50</text>
        <text x={width - padRight + 4} y={height - 4} className="axis-label">20</text>
      </svg>
    );
  }

  const validBarVals = data
    .map(d => d[barKey])
    .filter(v => v !== null && v !== undefined && Number.isFinite(v));
  const maxAbsBar = Math.max(10, ...validBarVals.map(v => Math.abs(v)));
  const zeroY = height * 0.56;
  const maxBarH = height * 0.4;

  const validLineEntries = data
    .map((d, i) => ({ val: d[lineKey], barVal: d[barKey], chipPending: d.chipPending, i }))
    .filter(
      item =>
        item.val !== null &&
        item.val !== undefined &&
        !(item.barVal === null || item.barVal === undefined)
    );

  const lineVals = validLineEntries.length > 0 ? validLineEntries.map(e => e.val) : [0];
  const minLine = Math.min(...lineVals);
  const maxLine = Math.max(...lineVals);
  const lineRange = Math.max(1, maxLine - minLine);

  const linePoints = validLineEntries
    .map(item => {
      const x = padLeft + item.i * stepX + stepX / 2;
      const y = height - 6 - ((item.val - minLine) / lineRange) * (height - 12);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const hoverX = padLeft + hoverIdx * stepX + stepX / 2;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="subchart-svg"
      onMouseMove={e => {
        const rect = e.currentTarget.getBoundingClientRect();
        const relX = ((e.clientX - rect.left) / rect.width) * width - padLeft;
        const idx = Math.min(count - 1, Math.max(0, Math.floor(relX / stepX)));
        onHoverIdx(idx);
      }}
    >
      <line x1={padLeft} y1={zeroY} x2={width - padRight} y2={zeroY} stroke="var(--chart-grid)" />
      {data.map((d, i) => {
        const rawVal = d[barKey];
        // 若當日盤後籌碼尚未公布 (null / undefined)，保持空白不畫柱狀圖
        if (rawVal === null || rawVal === undefined) {
          return null;
        }
        const val = Number(rawVal) || 0;
        const x = padLeft + i * stepX + (stepX - barW) / 2;
        const h = Math.max(1.5, (Math.abs(val) / maxAbsBar) * maxBarH);
        const y = val >= 0 ? zeroY - h : zeroY;
        const color = val >= 0 ? '#dc2626' : '#15803d';
        return <rect key={i} x={x} y={y} width={barW} height={h} fill={color} />;
      })}
      {linePoints && <polyline fill="none" stroke={lineColor} strokeWidth="1.5" points={linePoints} />}
      <line x1={hoverX} y1={0} x2={hoverX} y2={height} stroke="var(--crosshair-color)" strokeWidth="1" />
      <text x={width - padRight + 4} y={14} className="axis-label">
        {Math.round(maxAbsBar).toLocaleString()}
      </text>
      <text x={width - padRight + 4} y={zeroY + 4} className="axis-label">0</text>
    </svg>
  );
}

export default function StockDetail({
  stock,
  allStocks,
  taiexData,
  initialBrokerId,
  onSelectStock,
  onBackToScreener,
  onOpenFormulaModal
}) {
  const isMarketIndex = stock.code === 'TAIEX' || Boolean(stock.isMarketIndex);
  const unitLabel = isMarketIndex ? '億' : '張';

  const [periodDays, setPeriodDays] = useState(1); // 1, 5, 10, 20, 60
  const [endDateIdx, setEndDateIdx] = useState(stock.kline.length - 1);
  const [hoverIdx, setHoverIdx] = useState(stock.kline.length - 1);
  const [chartRange, setChartRange] = useState(60); // 45(3月), 60(6月), 75(1年)
  const [overlayMode, setOverlayMode] = useState('bollinger'); // 'bollinger' | 'ma' | 'vbp' | 'brokerCost'
  const [leftTab, setLeftTab] = useState('個股K線');
  const [rightTab, setRightTab] = useState('籌碼分析');
  const [topBrokerFilter, setTopBrokerFilter] = useState('topBuy15'); // 'mystery' | 'topBuy15' | 'dayTrade'
  const [bottomBrokerFilter, setBottomBrokerFilter] = useState('topSell15'); // 'topSell15' | 'foreign' | 'gov'
  const [selectedBrokerIds, setSelectedBrokerIds] = useState(() => {
    if (initialBrokerId) return [initialBrokerId];
    const topBuyerId = stock.realBrokerReports?.[1]?.buyers?.[0]?.id;
    return [topBuyerId || 'esun-chengzhong'];
  });
  const [dynamicBrokerHistories, setDynamicBrokerHistories] = useState({});
  const [creditSubMode, setCreditSubMode] = useState(isMarketIndex ? 'margin' : 'short'); // 'short' | 'margin'
  const [subchartPreset, setSubchartPreset] = useState(5); // 預設顯示 5 層高清晰副圖 (含散戶指標)，可一鍵切 1~6 層

  // 個股筆記與到價提醒狀態 (持久化於 localStorage)
  const [stockNotes, setStockNotes] = useState(() => {
    try {
      const saved = localStorage.getItem('chipflow_stock_notes');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const currentNote = stockNotes[stock.code] || {
    memo: `【${stock.code} ${stock.name} 看盤重點】\n1. 觀察關鍵分點（如買超第1名主力、外資、隔日沖分點）在重要均線附近的連續買賣超。\n2. 搭配主1、主5、主10集中度與布林通道上下軌位階操作。`,
    targetBuy: Number((stock.price * 0.95).toFixed(1)),
    stopLoss: Number((stock.price * 0.9).toFixed(1)),
    alertMain1: 15
  };

  const updateCurrentNote = (field, value) => {
    const updated = {
      ...stockNotes,
      [stock.code]: {
        ...currentNote,
        [field]: value
      }
    };
    setStockNotes(updated);
    try {
      localStorage.setItem('chipflow_stock_notes', JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    setEndDateIdx(stock.kline.length - 1);
    setHoverIdx(stock.kline.length - 1);
    if (stock.code === 'TAIEX') {
      setCreditSubMode('margin');
    }
    const topBuyerId = stock.realBrokerReports?.[1]?.buyers?.[0]?.id;
    if (topBuyerId && !initialBrokerId) {
      setSelectedBrokerIds([topBuyerId]);
    }
  }, [stock.code, stock.kline.length, stock.realBrokerReports, initialBrokerId]);

  useEffect(() => {
    if (initialBrokerId) {
      setSelectedBrokerIds([initialBrokerId]);
    }
  }, [initialBrokerId]);

  const klineChartRef = useRef(null);

  // 滑鼠滾輪即時縮放 K 線圖（向前放大看細部、向後縮小看長線，平滑支援 15 根至 250 根全年度 K 棒）
  useEffect(() => {
    const el = klineChartRef.current;
    if (!el) return;
    const handleWheel = e => {
      if (Math.abs(e.deltaY) < 1) return;
      e.preventDefault();
      const delta = e.deltaY;
      setChartRange(prev => {
        const maxBars = Math.max(stock.kline.length, 250);
        const minBars = 15;
        const step = Math.max(3, Math.round(prev * 0.12));
        const next = delta > 0 ? prev + step : prev - step;
        return Math.min(maxBars, Math.max(minBars, next));
      });
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [stock.kline.length]);

  const visibleKline = useMemo(() => {
    const start = Math.max(0, stock.kline.length - chartRange);
    return stock.kline.slice(start);
  }, [stock.kline, chartRange]);

  const visibleStartGlobalIdx = stock.kline.length - visibleKline.length;
  const localHoverIdx = Math.min(
    visibleKline.length - 1,
    Math.max(0, hoverIdx - visibleStartGlobalIdx)
  );
  const hoveredDay = visibleKline[localHoverIdx] || visibleKline[visibleKline.length - 1];

  // 計算右側統計區間籌碼分析與分點排行
  const chipAnalysis = useMemo(() => {
    return computePeriodChipAnalysis(stock, endDateIdx, periodDays);
  }, [stock, endDateIdx, periodDays]);

  // 當使用者點選某個真實分點時，若該分點含有 zco0Path 且尚未抓取 60 日真實逐日歷史，背景自動向券商網站抓取
  useEffect(() => {
    if (isMarketIndex) return;
    const primaryId = selectedBrokerIds[0];
    if (!primaryId) return;
    if (stock.realBrokerDailyHistory?.[primaryId] || dynamicBrokerHistories[primaryId]) return;
    const brokerObj = chipAnalysis.allBrokers?.find(b => b.id === primaryId);
    if (brokerObj?.zco0Path) {
      fetchSingleBrokerHistoryFromPortal(brokerObj.zco0Path, stock.kline).then(series => {
        if (series && Array.isArray(series)) {
          setDynamicBrokerHistories(prev => ({ ...prev, [primaryId]: series }));
        }
      });
    }
  }, [isMarketIndex, selectedBrokerIds, stock.code, stock.kline, stock.realBrokerDailyHistory, chipAnalysis.allBrokers, dynamicBrokerHistories]);

  const [mainSubchartFocus, setMainSubchartFocus] = useState('broker'); // 'broker' (鎖定勾選分點) | 'market' (全市場主力合計)

  // 解析或動態還原單一分點完整日報表歷史序列
  const resolveBrokerSeries = (targetId) => {
    if (dynamicBrokerHistories[targetId]) return dynamicBrokerHistories[targetId];
    if (stock.realBrokerDailyHistory?.[targetId]) return stock.realBrokerDailyHistory[targetId];
    if (stock.brokerSeries?.[targetId]) return stock.brokerSeries[targetId];

    const realReports = stock.realBrokerReports || {};
    const b1 = realReports[1]?.buyers?.find(b => b.id === targetId) || realReports[1]?.sellers?.find(b => b.id === targetId);
    const b5 = realReports[5]?.buyers?.find(b => b.id === targetId) || realReports[5]?.sellers?.find(b => b.id === targetId);
    const b10 = realReports[10]?.buyers?.find(b => b.id === targetId) || realReports[10]?.sellers?.find(b => b.id === targetId);
    const b20 = realReports[20]?.buyers?.find(b => b.id === targetId) || realReports[20]?.sellers?.find(b => b.id === targetId);

    const kline = stock.kline || [];
    let cumNet = 0;
    let lastPublishedIdx = kline.length - 1;
    while (lastPublishedIdx > 0 && kline[lastPublishedIdx]?.chipPending) {
      lastPublishedIdx--;
    }

    const net1 = b1?.net ?? 0;
    const net5 = b5?.net ?? net1 * 3;
    const net10 = b10?.net ?? net5 * 1.6;
    const net20 = b20?.net ?? net10 * 1.5;

    const prev4Avg = Math.round((net5 - net1) / 4);
    const prev5Avg = Math.round((net10 - net5) / 5);
    const prev10Avg = Math.round((net20 - net10) / 10);

    return kline.map((day, dIdx) => {
      if (dIdx > lastPublishedIdx || day.chipPending) {
        return {
          date: day.date,
          buy: null,
          sell: null,
          net: null,
          vol: null,
          avgBuy: day.close,
          avgSell: day.close,
          profitWan: 0,
          cumNet,
          chipPending: true
        };
      }
      const fromEnd = lastPublishedIdx - dIdx;
      let dayNet = 0;
      let dayBuy = 0;
      let daySell = 0;
      if (fromEnd === 0) {
        dayNet = net1;
        dayBuy = b1?.buy ?? (net1 > 0 ? net1 : 0);
        daySell = b1?.sell ?? (net1 < 0 ? Math.abs(net1) : 0);
      } else if (fromEnd <= 4) {
        dayNet = Math.round(prev4Avg * (0.8 + ((dIdx * 7) % 5) * 0.1));
        dayBuy = Math.max(0, dayNet > 0 ? dayNet + 15 : 10);
        daySell = Math.max(0, dayNet < 0 ? Math.abs(dayNet) + 15 : 10);
      } else if (fromEnd <= 9) {
        dayNet = Math.round(prev5Avg * (0.8 + ((dIdx * 11) % 5) * 0.1));
        dayBuy = Math.max(0, dayNet > 0 ? dayNet + 20 : 15);
        daySell = Math.max(0, dayNet < 0 ? Math.abs(dayNet) + 20 : 15);
      } else {
        dayNet = Math.round(prev10Avg * (0.7 + ((dIdx * 13) % 7) * 0.1));
        dayBuy = Math.max(0, dayNet > 0 ? dayNet + 25 : 20);
        daySell = Math.max(0, dayNet < 0 ? Math.abs(dayNet) + 25 : 20);
      }
      cumNet += dayNet;
      return {
        date: day.date,
        buy: dayBuy,
        sell: daySell,
        net: dayNet,
        vol: dayBuy + daySell,
        avgBuy: day.close,
        avgSell: day.close,
        cumNet,
        chipPending: false
      };
    });
  };

  // 計算所勾選券商分點（可單選或複選「組群」）在可見區間內的每日買賣超與累計買賣超及成本線
  const selectedBrokerDailyData = useMemo(() => {
    const ids = selectedBrokerIds.length > 0 ? selectedBrokerIds : ['esun-chengzhong'];
    let runningCum = 0;
    let runningCostSum = 0;
    let runningBuyLots = 0;

    return visibleKline.map(day => {
      let buy = 0;
      let sell = 0;
      let dayBuyVal = 0;
      let dayProfitWan = 0;
      let anyValid = false;

      ids.forEach(id => {
        const series = resolveBrokerSeries(id);
        const rec = series?.[day.index];
        if (rec && !rec.chipPending && rec.net !== null && rec.net !== undefined) {
          anyValid = true;
          buy += rec.buy || 0;
          sell += rec.sell || 0;
          dayBuyVal += (rec.buy || 0) * (rec.avgBuy || day.close);
          dayProfitWan += rec.profitWan || 0;
        }
      });

      const isDayPending = !anyValid && (day.chipPending || day.mainNet === null || day.mainNet === undefined);
      if (isDayPending) {
        const avgCostLine =
          runningBuyLots > 0 ? Number((runningCostSum / runningBuyLots).toFixed(2)) : day.ma20;
        return {
          date: day.date,
          close: day.close,
          buy: null,
          sell: null,
          avgBuy: day.close,
          brokerNet: null,
          brokerCum: runningCum,
          brokerCostLine: avgCostLine,
          profitWan: 0,
          chipPending: true
        };
      }

      const net = buy - sell;
      runningCum += net;
      runningCostSum += dayBuyVal;
      runningBuyLots += buy;
      const avgCostLine =
        runningBuyLots > 0 ? Number((runningCostSum / runningBuyLots).toFixed(2)) : day.ma20;

      return {
        date: day.date,
        close: day.close,
        buy,
        sell,
        avgBuy: buy > 0 ? Number((dayBuyVal / buy).toFixed(2)) : day.close,
        brokerNet: net,
        brokerCum: runningCum,
        brokerCostLine: avgCostLine,
        profitWan: dayProfitWan,
        chipPending: false
      };
    });
  }, [stock, visibleKline, selectedBrokerIds, dynamicBrokerHistories]);

  const hoveredBrokerPoint =
    selectedBrokerDailyData[localHoverIdx] ||
    selectedBrokerDailyData[selectedBrokerDailyData.length - 1];

  const toggleBrokerCheck = brokerId => {
    setSelectedBrokerIds([brokerId]);
    setMainSubchartFocus('broker');
  };

  const toggleBrokerMulti = (brokerId, e) => {
    e.stopPropagation();
    setSelectedBrokerIds(prev => {
      if (prev.includes(brokerId)) {
        return prev.length > 1 ? prev.filter(id => id !== brokerId) : prev;
      }
      return [...prev, brokerId];
    });
    setMainSubchartFocus('broker');
  };

  // 診斷所勾選分點近期進出行為特徵（連續買超、單日急買、轉賣倒貨、波段鎖碼）
  const selectedBrokerBehavior = useMemo(() => {
    if (!selectedBrokerDailyData || selectedBrokerDailyData.length === 0) return null;
    const valid = selectedBrokerDailyData.filter(
      d => !d.chipPending && d.brokerNet !== null && d.brokerNet !== undefined
    );
    if (valid.length === 0) return null;
    const last5 = valid.slice(-5);
    const todayRec = last5[last5.length - 1];
    const prev1 = last5.length >= 2 ? last5[last5.length - 2] : null;
    const buyDays5 = last5.filter(d => (d.brokerNet || 0) > 0).length;
    const sellDays5 = last5.filter(d => (d.brokerNet || 0) < 0).length;
    const sum5 = last5.reduce((s, d) => s + (d.brokerNet || 0), 0);
    const todayNet = todayRec?.brokerNet || 0;

    if (todayNet > 0 && prev1 && (prev1.brokerNet || 0) <= 0) {
      return { label: '🔥 轉折第1天轉買', type: 'day1-buy' };
    }
    if (todayNet < 0 && prev1 && (prev1.brokerNet || 0) > 0) {
      return { label: '⚠️ 今日轉賣倒貨', type: 'day1-sell' };
    }
    if (buyDays5 >= 4 && sum5 > 0) {
      return { label: '💎 近5日連續鎖碼吃貨', type: 'strong-buy' };
    }
    if (sellDays5 >= 4 && sum5 < 0) {
      return { label: '📉 近5日持續波段出貨', type: 'sell-5d' };
    }
    if (buyDays5 === 1 && todayNet > 0) {
      return { label: '⚡ 僅今日單日急買/短打', type: 'quick-buy' };
    }
    if (todayNet > 0) {
      return { label: '📈 近期偏多買超', type: 'buy-5d' };
    }
    if (todayNet < 0) {
      return { label: '📉 近期偏空調節', type: 'sell-5d' };
    }
    return { label: '⚖️ 區間進出平緩', type: 'neutral' };
  }, [selectedBrokerDailyData]);

  // 主圖 K 線 + 布林通道 + 成交量 SVG 幾何計算
  const mainChartWidth = 760;
  const mainChartHeight = 250;
  const kAreaTop = 14;
  const kAreaBottom = 186;
  const kAreaH = kAreaBottom - kAreaTop;
  const volTop = 196;
  const volBottom = 244;
  const volH = volBottom - volTop;
  const padLeft = 6;
  const padRight = 54;
  const plotW = mainChartWidth - padLeft - padRight;
  const count = visibleKline.length || 1;
  const stepX = plotW / count;
  const candleW = Math.max(3, Math.min(9, stepX * 0.66));

  const allPrices = visibleKline.flatMap(d => [d.high, d.low, d.bollUpper, d.bollLower]);
  const maxPrice = Math.max(...allPrices);
  const minPrice = Math.min(...allPrices);
  const priceSpan = Math.max(1, maxPrice - minPrice);

  const priceToY = p => kAreaBottom - ((p - minPrice) / priceSpan) * kAreaH;
  const maxVol = Math.max(100, ...visibleKline.map(d => d.volume));

  // 找出可見區間最高價與最低價 K 棒索引（繪製圖 2 中的 468 / 333 價格標籤）
  let highestIdx = 0;
  let lowestIdx = 0;
  visibleKline.forEach((d, idx) => {
    if (d.high > visibleKline[highestIdx].high) highestIdx = idx;
    if (d.low < visibleKline[lowestIdx].low) lowestIdx = idx;
  });

  const bollUpperPts = visibleKline
    .map((d, i) => `${(padLeft + i * stepX + stepX / 2).toFixed(1)},${priceToY(d.bollUpper).toFixed(1)}`)
    .join(' ');
  const bollMidPts = visibleKline
    .map((d, i) => `${(padLeft + i * stepX + stepX / 2).toFixed(1)},${priceToY(d.ma20).toFixed(1)}`)
    .join(' ');
  const bollLowerPts = visibleKline
    .map((d, i) => `${(padLeft + i * stepX + stepX / 2).toFixed(1)},${priceToY(d.bollLower).toFixed(1)}`)
    .join(' ');

  const ma5Pts = visibleKline
    .map((d, i) => `${(padLeft + i * stepX + stepX / 2).toFixed(1)},${priceToY(d.ma5).toFixed(1)}`)
    .join(' ');
  const ma10Pts = visibleKline
    .map((d, i) => `${(padLeft + i * stepX + stepX / 2).toFixed(1)},${priceToY(d.ma10).toFixed(1)}`)
    .join(' ');
  const ma60Pts = visibleKline
    .map((d, i) => `${(padLeft + i * stepX + stepX / 2).toFixed(1)},${priceToY(d.ma60).toFixed(1)}`)
    .join(' ');

  const brokerCostPts = selectedBrokerDailyData
    .map((d, i) => `${(padLeft + i * stepX + stepX / 2).toFixed(1)},${priceToY(d.brokerCostLine).toFixed(1)}`)
    .join(' ');

  const hoverX = padLeft + localHoverIdx * stepX + stepX / 2;

  // 右側上半部與下半部券商清單（支援：全部15、波段主力、隔日沖大戶、神秘券商、當沖大戶、散戶集散、外資主力、八大官股）
  const upperBrokerList = useMemo(() => {
    if (topBrokerFilter === 'topBuy15') return chipAnalysis.topBuyers;
    if (topBrokerFilter === 'swing') return chipAnalysis.swingBrokers?.filter(b => b.net > 0) || [];
    if (topBrokerFilter === 'dayTrade') return chipAnalysis.dayTradeBrokers?.filter(b => b.net > 0) || [];
    if (topBrokerFilter === 'mystery') return chipAnalysis.mysteryBrokers?.filter(b => b.net > 0) || [];
    if (topBrokerFilter === 'scalp') return chipAnalysis.scalpBrokers || [];
    if (topBrokerFilter === 'retail') return chipAnalysis.retailBrokers?.filter(b => b.net > 0) || [];
    if (topBrokerFilter === 'foreign') return chipAnalysis.foreignBrokers?.filter(b => b.net > 0) || [];
    if (topBrokerFilter === 'gov') return chipAnalysis.govBrokers?.filter(b => b.net > 0) || [];
    return chipAnalysis.topBuyers;
  }, [chipAnalysis, topBrokerFilter]);

  const lowerBrokerList = useMemo(() => {
    if (bottomBrokerFilter === 'topSell15') return chipAnalysis.topSellers;
    if (bottomBrokerFilter === 'dayTrade') return chipAnalysis.dayTradeBrokers?.filter(b => b.net < 0) || [];
    if (bottomBrokerFilter === 'swing') return chipAnalysis.swingBrokers?.filter(b => b.net < 0) || [];
    if (bottomBrokerFilter === 'retail') return chipAnalysis.retailBrokers?.filter(b => b.net < 0) || [];
    if (bottomBrokerFilter === 'foreign') return chipAnalysis.foreignBrokers?.filter(b => b.net < 0) || [];
    if (bottomBrokerFilter === 'gov') return chipAnalysis.govBrokers?.filter(b => b.net < 0) || [];
    return chipAnalysis.topSellers;
  }, [chipAnalysis, bottomBrokerFilter]);

  const selectedBrokerNames = selectedBrokerIds
    .map(id => {
      const found =
        chipAnalysis.allBrokers?.find(b => b.id === id) ||
        BROKER_LIST.find(b => b.id === id);
      return found?.name || id.replace(/^real-/, '');
    })
    .join(' + ');

  const priceTicks = [0, 0.2, 0.4, 0.6, 0.8, 1].map(t =>
    Math.round(minPrice + priceSpan * (1 - t))
  );

  // 同產業或相近個股清單（供「細產業」與「個股分析」頁籤比價）
  const industryPeers = useMemo(() => {
    const exactPeers = allStocks.filter(s => s.industry === stock.industry);
    if (exactPeers.length >= 3) return exactPeers;
    const prefix = stock.industry.split('-')[0];
    return allStocks.filter(s => s.industry.startsWith(prefix));
  }, [allStocks, stock]);

  // 體檢表 6 大維度診斷
  const healthChecks = useMemo(() => {
    return [
      {
        title: '主力籌碼集中度 (主1 / 主5 / 主10)',
        score: stock.main1 >= 15 ? 92 : stock.main1 > 0 ? 75 : 42,
        status: stock.main1 >= 15 ? '強勢鎖碼' : stock.main1 > 0 ? '偏多集中' : '主力調節',
        isGood: stock.main1 > 0,
        detail: `主1: ${stock.main1}%｜主5: ${stock.main5}%｜主10: ${stock.main10}%`
      },
      {
        title: '三大法人同買共振 (外資 / 投信連買)',
        score: stock.trustConsec > 0 && stock.foreignConsec > 0 ? 90 : stock.trustConsec > 0 ? 78 : 50,
        status: stock.trustConsec >= 2 ? '投信連買作帳' : stock.foreignConsec > 0 ? '外資偏多' : '法人分歧',
        isGood: stock.trustConsec > 0 || stock.foreignConsec > 0,
        detail: `外資連買 ${stock.foreignConsec} 日 (${stock.foreignPct}%)｜投信連買 ${stock.trustConsec} 日 (${stock.trustPct}%)`
      },
      {
        title: '均線乖離與布林通道位階',
        score: stock.monthSlope > 0 ? 85 : 55,
        status: stock.bandWidth <= 12 ? '布林壓縮待變' : stock.bandPos >= 8 ? '通道強勢突破' : '區間整理',
        isGood: stock.monthSlope >= 0,
        detail: `月線斜率 ${stock.monthSlope}｜布林帶寬 ${stock.bandWidth}｜位階 ${stock.bandPos}｜乖年 ${stock.biasYear}%`
      },
      {
        title: '融資維持率與信用籌碼安全度 (圖3)',
        score: stock.maintRatio >= 160 ? 94 : stock.maintRatio >= 130 ? 76 : 35,
        status: stock.maintRatio < 130 ? '⚠️斷頭多殺多警戒' : '信用籌碼安定',
        isGood: stock.maintRatio >= 130,
        detail: `整戶維持率 ${stock.maintRatio}% (低於130%易多殺多)｜券資比 ${stock.shortMarginRatio}%`
      },
      {
        title: '基本面營收成長動能 (YOY / MOM)',
        score: stock.revYoY >= 20 ? 91 : stock.revYoY > 0 ? 74 : 45,
        status: stock.revYoY >= 20 ? '營收高速成長' : stock.revYoY > 0 ? '穩健成長' : '動能趨緩',
        isGood: stock.revYoY > 0,
        detail: `單月營收YoY ${stock.revYoY}%｜累計YoY ${stock.cumRevYoY}%｜MoM ${stock.revMoM}%`
      },
      {
        title: '價值位階評估 (股淨比 / 殖利率 / 連續配息)',
        score: stock.pb < 0.5 || stock.dividendYield >= 4 ? 95 : 72,
        status: stock.pb < 0.5 ? '💎股淨比<0.5長線低點' : stock.dividendYield >= 4 ? '高殖利率護體' : '合理估值區間',
        isGood: true,
        detail: `股淨比 ${stock.pb}｜本益比 ${stock.pe}｜殖利率 ${stock.dividendYield}% (連續 ${stock.divYears} 年配息)`
      }
    ];
  }, [stock]);

  return (
    <section className="detail-workstation" id="stock-detail-workstation">
      {/* 參考圖 2 頂部雙欄控制列 */}
      <div className="detail-top-header">
        <div className="detail-header-left">
          <button
            className="btn-back-screener"
            onClick={onBackToScreener}
            title="返回選股監控列表"
            id="btn-back-screener"
          >
            ◀ 選股列表
          </button>

          <div className="stock-picker-group">
            <span className="picker-label">標的切換</span>
            <select
              className="stock-code-select"
              value={stock.code}
              onChange={e => onSelectStock(e.target.value)}
              id="select-detail-stock"
            >
              <option value="TAIEX">📊 TAIEX 加權指數 (大盤K線/籌碼)</option>
              {allStocks.map(s => (
                <option key={s.code} value={s.code}>
                  {s.code} {s.name}
                </option>
              ))}
            </select>
            <strong className="stock-title-name">{stock.name}</strong>
            {!isMarketIndex && (
              <button
                className="mini-badge"
                onClick={() => onSelectStock('TAIEX')}
                title="切換查看大盤加權指數 K 線、布林通道與三大法人/散戶/融資籌碼"
                id="btn-switch-taiex-detail"
              >
                📊 看大盤加權K線
              </button>
            )}
          </div>

          <div className="mini-action-badges">
            <button
              className={`mini-badge ${rightTab === '籌碼分析' ? 'active' : ''}`}
              onClick={() => setRightTab('籌碼分析')}
            >
              {isMarketIndex ? '大盤籌碼' : '主力'}
            </button>
            <button
              className={`mini-badge ${rightTab === '體檢表' ? 'active' : ''}`}
              onClick={() => setRightTab('體檢表')}
            >
              體檢
            </button>
            <button
              className={`mini-badge ${rightTab === '法人目標' ? 'active' : ''}`}
              onClick={() => setRightTab('法人目標')}
            >
              報告
            </button>
            <button
              className={`mini-badge ${leftTab === '筆記' ? 'active' : ''}`}
              onClick={() => setLeftTab('筆記')}
            >
              筆記
            </button>
          </div>

          <div className="header-quick-links">
            <button className="link-btn" onClick={onOpenFormulaModal}>指標公式說明</button>
            <span className="industry-pill">{stock.industry}</span>
          </div>
        </div>

        <div className="detail-header-right">
          <div className="stat-days-group">
            <span className="picker-label">統計天數</span>
            <select
              className="stat-days-select"
              value={periodDays}
              onChange={e => setPeriodDays(Number(e.target.value))}
              id="select-stat-days"
            >
              <option value={1}>1 天 (當日)</option>
              <option value={5}>5 天 (週主力)</option>
              <option value={10}>10 天 (雙週主力)</option>
              <option value={20}>20 天 (月主力)</option>
              <option value={60}>60 天 (季主力)</option>
            </select>
          </div>

          <div className="stat-date-group">
            <span className="picker-label">日期</span>
            <select
              className="stat-date-select"
              value={endDateIdx}
              onChange={e => setEndDateIdx(Number(e.target.value))}
              id="select-stat-date"
            >
              {stock.kline.map((d, idx) => (
                <option key={d.date} value={idx}>
                  {d.date}
                </option>
              ))}
            </select>
            <button
              className="btn-date-step"
              onClick={() => setEndDateIdx(i => Math.max(0, i - 1))}
              title="前一個交易日"
              id="btn-prev-day"
            >
              ◀
            </button>
            <button
              className="btn-date-step"
              onClick={() => setEndDateIdx(i => Math.min(stock.kline.length - 1, i + 1))}
              title="後一個交易日"
              id="btn-next-day"
            >
              ▶
            </button>
            <button
              className="btn-date-today"
              onClick={() => setEndDateIdx(stock.kline.length - 1)}
              id="btn-today"
            >
              今天
            </button>
          </div>
        </div>
      </div>

      {/* 主工作區：左側 K 線與多視角面板 + 右側籌碼集中度與分點買賣超排行 */}
      <div className="detail-split-layout">
        {/* 左側面板（對應圖 2 左半部） */}
        <div className="detail-left-pane">
          {/* 子功能頁籤列 */}
          <div className="chart-subtabs-bar">
            {['個股K線', '即時走勢', '分點K線', '大單券商', '主力地圖', '個股分析', '細產業', '筆記'].map(
              tab => (
                <button
                  key={tab}
                  className={`chart-subtab ${leftTab === tab ? 'active' : ''}`}
                  onClick={() => {
                    setLeftTab(tab);
                    if (tab === '分點K線') setOverlayMode('brokerCost');
                  }}
                >
                  {isMarketIndex && tab === '個股K線' ? '大盤K線' : tab}
                </button>
              )
            )}
            <span className="treasury-note">
              {isMarketIndex ? '支援布林通道、均線與大盤法人/散戶/融資融券同步對照' : '粉紅色區塊為庫藏股期間'}
            </span>
          </div>

          {/* 依據左側子頁籤切換對應專業視圖 */}
          {leftTab === '個股K線' || leftTab === '分點K線' ? (
            <>
              {/* 主圖疊加指標切換列 */}
              <div className="overlay-toolbar">
                <div className="overlay-buttons">
                  <button
                    className={`btn-overlay ${overlayMode === 'ma' ? 'active' : ''}`}
                    onClick={() => setOverlayMode('ma')}
                  >
                    均線
                  </button>
                  <button
                    className={`btn-overlay ${overlayMode === 'bollinger' ? 'active' : ''}`}
                    onClick={() => setOverlayMode('bollinger')}
                  >
                    布林
                  </button>
                  <button
                    className={`btn-overlay ${overlayMode === 'vbp' ? 'active' : ''}`}
                    onClick={() => setOverlayMode('vbp')}
                  >
                    分價量
                  </button>
                  {!isMarketIndex && (
                    <button
                      className={`btn-overlay ${overlayMode === 'brokerCost' ? 'active' : ''}`}
                      onClick={() => setOverlayMode('brokerCost')}
                    >
                      分點成本線
                    </button>
                  )}
                </div>

                {overlayMode === 'bollinger' ? (
                  <div className="overlay-legend">
                    <span className="legend-item gray">— 通道頂 {hoveredDay.bollUpper}</span>
                    <span className="legend-item gray">— 通道底 {hoveredDay.bollLower}</span>
                    <span className="legend-item red">— 20MA {hoveredDay.ma20}</span>
                  </div>
                ) : overlayMode === 'brokerCost' && !isMarketIndex ? (
                  <div className="overlay-legend">
                    <span className="legend-item" style={{ color: '#7c3aed', fontWeight: 700 }}>
                      — 【{selectedBrokerNames}】成本線 {hoveredBrokerPoint.brokerCostLine} 元
                    </span>
                    <span className="legend-item red">— 20MA {hoveredDay.ma20}</span>
                  </div>
                ) : (
                  <div className="overlay-legend">
                    <span className="legend-item blue">— 5MA {hoveredDay.ma5}</span>
                    <span className="legend-item orange">— 10MA {hoveredDay.ma10}</span>
                    <span className="legend-item red">— 20MA {hoveredDay.ma20}</span>
                    <span className="legend-item green">— 60MA {hoveredDay.ma60}</span>
                  </div>
                )}
              </div>

              {/* 查價線當日開高低收與漲跌幅橫條 */}
              <div className="kline-ohlc-readout">
                <span className="ohlc-date">{hoveredDay.date}</span>
                <span>開 <strong>{hoveredDay.open}</strong></span>
                <span>高 <strong>{hoveredDay.high}</strong></span>
                <span>低 <strong>{hoveredDay.low}</strong></span>
                <span>收 <strong>{hoveredDay.close}</strong></span>
                <span className={hoveredDay.change >= 0 ? 'val-up' : 'val-down'}>
                  漲跌 {hoveredDay.change >= 0 ? `+${hoveredDay.change}` : hoveredDay.change}
                </span>
                <span className={hoveredDay.changePct >= 0 ? 'val-up' : 'val-down'}>
                  漲幅 {hoveredDay.changePct}%
                </span>
                <span>
                  {isMarketIndex ? '成交金額' : '量'}{' '}
                  <strong>{hoveredDay.volume.toLocaleString()} {isMarketIndex ? '億' : '張'}</strong>
                </span>
                {hoveredDay.chipPending && (
                  <span className="pending-chip-badge" title="當日最新 K 線與成交量已即時顯示，未公布之盤後籌碼副圖自動留空">
                    ⏳ 最新股價/量已載入・部分盤後籌碼待公布(留空)
                  </span>
                )}
              </div>

              {/* K 線與副圖互動縮放區（支援滑鼠滾輪即時縮放與十字查價） */}
              <div className="kline-interactive-area" ref={klineChartRef}>
                <div className="main-kline-box">
                <svg
                  viewBox={`0 0 ${mainChartWidth} ${mainChartHeight}`}
                  className="main-kline-svg"
                  onMouseMove={e => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const relX = ((e.clientX - rect.left) / rect.width) * mainChartWidth - padLeft;
                    const localIdx = Math.min(count - 1, Math.max(0, Math.floor(relX / stepX)));
                    setHoverIdx(visibleStartGlobalIdx + localIdx);
                  }}
                >
                  {/* 庫藏股期間粉紅色底塊 */}
                  {stock.treasuryPeriod && (
                    <rect
                      x={padLeft + Math.max(0, stock.treasuryPeriod[0] - visibleStartGlobalIdx) * stepX}
                      y={kAreaTop}
                      width={Math.max(0, (stock.treasuryPeriod[1] - stock.treasuryPeriod[0]) * stepX)}
                      height={kAreaH}
                      fill="rgba(244, 114, 182, 0.12)"
                    />
                  )}

                  {/* 右側設定之統計區間淡藍底塊 */}
                  {periodDays > 1 && (
                    <rect
                      x={padLeft + Math.max(0, chipAnalysis.startIdx - visibleStartGlobalIdx) * stepX}
                      y={kAreaTop}
                      width={
                        Math.max(
                          1,
                          chipAnalysis.endIdx - Math.max(visibleStartGlobalIdx, chipAnalysis.startIdx) + 1
                        ) * stepX
                      }
                      height={kAreaH}
                      fill="rgba(59, 130, 246, 0.1)"
                    />
                  )}

                  {/* 水平價格格線與右側價格刻度 */}
                  {priceTicks.map((pt, idx) => {
                    const y = kAreaTop + (idx / (priceTicks.length - 1)) * kAreaH;
                    return (
                      <g key={idx}>
                        <line
                          x1={padLeft}
                          y1={y}
                          x2={mainChartWidth - padRight}
                          y2={y}
                          stroke="var(--chart-grid)"
                          strokeDasharray="2 2"
                        />
                        <text x={mainChartWidth - padRight + 4} y={y + 4} className="axis-label">
                          {pt}
                        </text>
                      </g>
                    );
                  })}

                  {/* 分價量橫條 */}
                  {overlayMode === 'vbp' &&
                    priceTicks.slice(0, -1).map((pt, idx) => {
                      const y = kAreaTop + (idx / (priceTicks.length - 1)) * kAreaH + 4;
                      const barLen = 80 + ((idx * 47) % 140);
                      return (
                        <rect
                          key={idx}
                          x={padLeft}
                          y={y}
                          width={barLen}
                          height={14}
                          fill="rgba(59, 130, 246, 0.18)"
                        />
                      );
                    })}

                  {/* 布林通道 / 分點成本線 / 均線折線 */}
                  {overlayMode === 'bollinger' ? (
                    <>
                      <polyline fill="none" stroke="#64748b" strokeWidth="1.2" points={bollUpperPts} />
                      <polyline fill="none" stroke="#ef4444" strokeWidth="1.3" points={bollMidPts} />
                      <polyline fill="none" stroke="#64748b" strokeWidth="1.2" points={bollLowerPts} />
                    </>
                  ) : overlayMode === 'brokerCost' && !isMarketIndex ? (
                    <>
                      <polyline fill="none" stroke="#ef4444" strokeWidth="1.1" strokeDasharray="3 3" points={bollMidPts} />
                      <polyline fill="none" stroke="#7c3aed" strokeWidth="2.2" points={brokerCostPts} />
                    </>
                  ) : (
                    <>
                      <polyline fill="none" stroke="#3b82f6" strokeWidth="1.2" points={ma5Pts} />
                      <polyline fill="none" stroke="#f59e0b" strokeWidth="1.2" points={ma10Pts} />
                      <polyline fill="none" stroke="#ef4444" strokeWidth="1.2" points={bollMidPts} />
                      <polyline fill="none" stroke="#10b981" strokeWidth="1.2" points={ma60Pts} />
                    </>
                  )}

                  {/* K 棒與底部成交量柱 */}
                  {visibleKline.map((d, i) => {
                    const cx = padLeft + i * stepX + stepX / 2;
                    const x = padLeft + i * stepX + (stepX - candleW) / 2;
                    const isUp = d.close >= d.open;
                    const color = isUp ? '#dc2626' : '#15803d';
                    const highY = priceToY(d.high);
                    const lowY = priceToY(d.low);
                    const openY = priceToY(d.open);
                    const closeY = priceToY(d.close);
                    const bodyTop = Math.min(openY, closeY);
                    const bodyH = Math.max(2, Math.abs(closeY - openY));

                    const vH = Math.max(2, (d.volume / maxVol) * volH);
                    const vY = volBottom - vH;

                    return (
                      <g key={d.date}>
                        <line x1={cx} y1={highY} x2={cx} y2={lowY} stroke={color} strokeWidth="1.2" />
                        <rect x={x} y={bodyTop} width={candleW} height={bodyH} fill={color} />
                        <rect
                          x={x}
                          y={vY}
                          width={candleW}
                          height={vH}
                          fill={i === visibleKline.length - 1 ? '#eab308' : '#7aa2c4'}
                          opacity="0.85"
                        />
                      </g>
                    );
                  })}

                  {/* 區間最高價與最低價標籤框 */}
                  {visibleKline[highestIdx] && (
                    <g
                      transform={`translate(${Math.min(
                        mainChartWidth - padRight - 48,
                        Math.max(10, padLeft + highestIdx * stepX - 12)
                      )}, ${Math.max(4, priceToY(visibleKline[highestIdx].high) - 18)})`}
                    >
                      <rect width="42" height="15" rx="2" fill="var(--callout-bg)" stroke="#dc2626" strokeWidth="1" />
                      <text x="21" y="11" textAnchor="middle" fill="#dc2626" fontSize="10" fontWeight="700">
                        {visibleKline[highestIdx].high}
                      </text>
                    </g>
                  )}
                  {visibleKline[lowestIdx] && (
                    <g
                      transform={`translate(${Math.min(
                        mainChartWidth - padRight - 48,
                        Math.max(10, padLeft + lowestIdx * stepX - 12)
                      )}, ${Math.min(kAreaBottom - 16, priceToY(visibleKline[lowestIdx].low) + 3)})`}
                    >
                      <rect width="42" height="15" rx="2" fill="var(--callout-bg)" stroke="#15803d" strokeWidth="1" />
                      <text x="21" y="11" textAnchor="middle" fill="#15803d" fontSize="10" fontWeight="700">
                        {visibleKline[lowestIdx].low}
                      </text>
                    </g>
                  )}

                  <line x1={padLeft} y1={volTop - 4} x2={mainChartWidth - padRight} y2={volTop - 4} stroke="var(--chart-grid)" />
                  <line x1={hoverX} y1={0} x2={hoverX} y2={mainChartHeight} stroke="var(--crosshair-color)" strokeWidth="1" />
                </svg>
              </div>

              {/* 多軌同步副圖區（若最新交易日盤後籌碼尚未公布，自動留空不補 0） */}
              <div className="subcharts-stack">
                {/* 分點進出（若處於「分點K線」模式，置頂顯示分點進出！） */}
                {leftTab === '分點K線' && !isMarketIndex && (
                  <div className="subchart-panel broker-sync-panel">
                    <div className="subchart-header">
                      <span className="subchart-badge highlight-badge">主力分點進出 ({selectedBrokerNames})</span>
                      <span className="subchart-stat">
                        — 累計買賣超(張) <strong>{hoveredBrokerPoint.brokerCum}</strong>
                      </span>
                      {hoveredBrokerPoint.brokerNet === null || hoveredBrokerPoint.brokerNet === undefined ? (
                        <span className="pending-chip-badge">⏳ 盤後分點待公布 (留空)</span>
                      ) : (
                        <span className={`subchart-stat ${hoveredBrokerPoint.brokerNet >= 0 ? 'val-up' : 'val-down'}`}>
                          ▮ 當日買賣超 <strong>{hoveredBrokerPoint.brokerNet}</strong> (買 {hoveredBrokerPoint.buy} / 賣 {hoveredBrokerPoint.sell}｜均價 {hoveredBrokerPoint.avgBuy})
                        </span>
                      )}
                    </div>
                    <SubIndicatorChart
                      data={selectedBrokerDailyData}
                      hoverIdx={localHoverIdx}
                      onHoverIdx={idx => setHoverIdx(visibleStartGlobalIdx + idx)}
                      barKey="brokerNet"
                      lineKey="brokerCum"
                      lineColor="#7c3aed"
                    />
                  </div>
                )}

                {/* 1. 主力買賣超 / 鎖定單一分點買賣超（若勾選分點則即時連動，一眼看出是近期都在買、哪天買、還是今日倒貨） */}
                <div className="subchart-panel subchart-focus-panel">
                  <div className="subchart-header">
                    {isMarketIndex ? (
                      <>
                        <span className="subchart-badge">大盤主力(三大法人合計)</span>
                        <span className="subchart-stat">
                          — 累計({unitLabel}) <strong>{hoveredDay.cumMainNet?.toLocaleString() ?? '--'}</strong>
                        </span>
                        {hoveredDay.mainNet === null || hoveredDay.mainNet === undefined ? (
                          <span className="pending-chip-badge">⏳ 盤後籌碼待公布 (留空)</span>
                        ) : (
                          <span className={`subchart-stat ${hoveredDay.mainNet >= 0 ? 'val-up' : 'val-down'}`}>
                            ▮ 買賣超({unitLabel}) <strong>{hoveredDay.mainNet.toLocaleString()}</strong>
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="subchart-focus-toggle-group">
                          <button
                            className={`btn-subchart-focus ${mainSubchartFocus === 'broker' ? 'active' : ''}`}
                            onClick={() => setMainSubchartFocus('broker')}
                            title="查看右側所勾選分點的每日買賣超柱狀與累計張數"
                          >
                            🎯 鎖定分點：{selectedBrokerNames}
                          </button>
                          <button
                            className={`btn-subchart-focus ${mainSubchartFocus === 'market' ? 'active' : ''}`}
                            onClick={() => setMainSubchartFocus('market')}
                            title="切換回全市場買超前15減賣超前15的主力合計買賣超"
                          >
                            📊 全市場主力
                          </button>
                        </div>

                        {mainSubchartFocus === 'broker' ? (
                          <>
                            {selectedBrokerBehavior && (
                              <span className={`badge-broker-behavior ${selectedBrokerBehavior.type}`}>
                                {selectedBrokerBehavior.label}
                              </span>
                            )}
                            <span className="subchart-stat">
                              — 累計留倉(張) <strong>{hoveredBrokerPoint.brokerCum?.toLocaleString() ?? 0}</strong>
                            </span>
                            {hoveredBrokerPoint.brokerNet === null || hoveredBrokerPoint.brokerNet === undefined ? (
                              <span className="pending-chip-badge">⏳ 盤後分點待公布 (留空)</span>
                            ) : (
                              <span className={`subchart-stat ${hoveredBrokerPoint.brokerNet >= 0 ? 'val-up' : 'val-down'}`}>
                                ▮ 當日買賣超(張){' '}
                                <strong>
                                  {hoveredBrokerPoint.brokerNet >= 0 ? `+${hoveredBrokerPoint.brokerNet}` : hoveredBrokerPoint.brokerNet}
                                </strong>
                                {' '}(買 {hoveredBrokerPoint.buy} / 賣 {hoveredBrokerPoint.sell})
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="subchart-stat">
                              — 累計(張) <strong>{hoveredDay.cumMainNet?.toLocaleString() ?? '--'}</strong>
                            </span>
                            {hoveredDay.mainNet === null || hoveredDay.mainNet === undefined ? (
                              <span className="pending-chip-badge">⏳ 盤後籌碼待公布 (留空)</span>
                            ) : (
                              <span className={`subchart-stat ${hoveredDay.mainNet >= 0 ? 'val-up' : 'val-down'}`}>
                                ▮ 主力買賣超(張) <strong>{hoveredDay.mainNet.toLocaleString()}</strong>
                              </span>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>
                  <SubIndicatorChart
                    data={!isMarketIndex && mainSubchartFocus === 'broker' ? selectedBrokerDailyData : visibleKline}
                    hoverIdx={localHoverIdx}
                    onHoverIdx={idx => setHoverIdx(visibleStartGlobalIdx + idx)}
                    barKey={!isMarketIndex && mainSubchartFocus === 'broker' ? 'brokerNet' : 'mainNet'}
                    lineKey={!isMarketIndex && mainSubchartFocus === 'broker' ? 'brokerCum' : 'cumMainNet'}
                    lineColor={!isMarketIndex && mainSubchartFocus === 'broker' ? '#7c3aed' : '#8b5cf6'}
                  />
                </div>

                {/* 2. 外資 */}
                <div className="subchart-panel">
                  <div className="subchart-header">
                    <span className="subchart-badge">外資</span>
                    <span className="subchart-stat">
                      — {isMarketIndex ? `累計(${unitLabel})` : '庫存'}{' '}
                      <strong>
                        {hoveredDay.foreignHold?.toLocaleString() ?? '--'}
                        {!isMarketIndex && ` (${hoveredDay.foreignHoldPct}%)`}
                      </strong>
                    </span>
                    {hoveredDay.foreignNet === null || hoveredDay.foreignNet === undefined ? (
                      <span className="pending-chip-badge">⏳ 盤後籌碼待公布 (留空)</span>
                    ) : (
                      <span className={`subchart-stat ${hoveredDay.foreignNet >= 0 ? 'val-up' : 'val-down'}`}>
                        ▮ 買賣超({unitLabel}) <strong>{hoveredDay.foreignNet.toLocaleString()}</strong>
                      </span>
                    )}
                  </div>
                  <SubIndicatorChart
                    data={visibleKline}
                    hoverIdx={localHoverIdx}
                    onHoverIdx={idx => setHoverIdx(visibleStartGlobalIdx + idx)}
                    barKey="foreignNet"
                    lineKey="foreignHold"
                    lineColor="#f59e0b"
                  />
                </div>

                {/* 3. 投信 */}
                <div className="subchart-panel">
                  <div className="subchart-header">
                    <span className="subchart-badge">投信</span>
                    <span className="subchart-stat">
                      — {isMarketIndex ? `累計(${unitLabel})` : '庫存'}{' '}
                      <strong>
                        {hoveredDay.trustHold?.toLocaleString() ?? '--'}
                        {!isMarketIndex && ` (${hoveredDay.trustHoldPct}%)`}
                      </strong>
                    </span>
                    {hoveredDay.trustNet === null || hoveredDay.trustNet === undefined ? (
                      <span className="pending-chip-badge">⏳ 盤後籌碼待公布 (留空)</span>
                    ) : (
                      <span className={`subchart-stat ${hoveredDay.trustNet >= 0 ? 'val-up' : 'val-down'}`}>
                        ▮ 買賣超({unitLabel}) <strong>{hoveredDay.trustNet.toLocaleString()}</strong>
                      </span>
                    )}
                  </div>
                  <SubIndicatorChart
                    data={visibleKline}
                    hoverIdx={localHoverIdx}
                    onHoverIdx={idx => setHoverIdx(visibleStartGlobalIdx + idx)}
                    barKey="trustNet"
                    lineKey="trustHold"
                    lineColor="#d97706"
                  />
                </div>

                {/* 4. 自營商(避險) */}
                {subchartPreset >= 4 && (
                  <div className="subchart-panel">
                    <div className="subchart-header">
                      <span className="subchart-badge">自營商(含避險)</span>
                      <span className="subchart-stat">
                        — 累計({unitLabel}) <strong>{hoveredDay.cumDealer?.toLocaleString() ?? '--'}</strong>
                      </span>
                      {hoveredDay.dealerNet === null || hoveredDay.dealerNet === undefined ? (
                        <span className="pending-chip-badge">⏳ 盤後籌碼待公布 (留空)</span>
                      ) : (
                        <span className={`subchart-stat ${hoveredDay.dealerNet >= 0 ? 'val-up' : 'val-down'}`}>
                          ▮ 買賣超({unitLabel}) <strong>{hoveredDay.dealerNet.toLocaleString()}</strong>
                        </span>
                      )}
                    </div>
                    <SubIndicatorChart
                      data={visibleKline}
                      hoverIdx={localHoverIdx}
                      onHoverIdx={idx => setHoverIdx(visibleStartGlobalIdx + idx)}
                      barKey="dealerNet"
                      lineKey="cumDealer"
                      lineColor="#ca8a04"
                    />
                  </div>
                )}

                {/* 5. 散戶動向 (散戶多空指標) */}
                {(isMarketIndex || subchartPreset >= 5) && (
                  <div className="subchart-panel">
                    <div className="subchart-header">
                      <span className="subchart-badge">散戶動向(反向指標)</span>
                      <span className="subchart-stat">
                        — 累計({unitLabel}) <strong>{hoveredDay.cumRetailNet?.toLocaleString() ?? '--'}</strong>
                      </span>
                      {hoveredDay.retailNet === null || hoveredDay.retailNet === undefined ? (
                        <span className="pending-chip-badge">⏳ 盤後籌碼待公布 (留空)</span>
                      ) : (
                        <span className={`subchart-stat ${hoveredDay.retailNet >= 0 ? 'val-up' : 'val-down'}`}>
                          ▮ 散戶淨部位({unitLabel}) <strong>{hoveredDay.retailNet.toLocaleString()}</strong>
                        </span>
                      )}
                    </div>
                    <SubIndicatorChart
                      data={visibleKline}
                      hoverIdx={localHoverIdx}
                      onHoverIdx={idx => setHoverIdx(visibleStartGlobalIdx + idx)}
                      barKey="retailNet"
                      lineKey="cumRetailNet"
                      lineColor="#06b6d4"
                    />
                  </div>
                )}

                {/* 6. 融券 / 融資切換 */}
                {subchartPreset >= 3 && (
                  <div className="subchart-panel">
                    <div className="subchart-header">
                      <select
                        className="subchart-select"
                        value={creditSubMode}
                        onChange={e => setCreditSubMode(e.target.value)}
                      >
                        <option value="margin">融資</option>
                        <option value="short">融券</option>
                      </select>
                      {creditSubMode === 'short' ? (
                        <>
                          <span className="subchart-stat">
                            — 融券餘額(張) <strong>{hoveredDay.shortBal?.toLocaleString() ?? '--'} ({hoveredDay.shortHoldPct}%)</strong>
                          </span>
                          {hoveredDay.shortDiff === null || hoveredDay.shortDiff === undefined ? (
                            <span className="pending-chip-badge">⏳ 信用籌碼待公布 (留空)</span>
                          ) : (
                            <span className={`subchart-stat ${hoveredDay.shortDiff >= 0 ? 'val-up' : 'val-down'}`}>
                              ▮ 融券變動(張) <strong>{hoveredDay.shortDiff}</strong>
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="subchart-stat">
                            — 融資餘額({unitLabel}) <strong>{hoveredDay.marginBal?.toLocaleString() ?? '--'} (維持率 {stock.maintRatio}%)</strong>
                          </span>
                          {hoveredDay.marginDiff === null || hoveredDay.marginDiff === undefined ? (
                            <span className="pending-chip-badge">⏳ 信用籌碼待公布 (留空)</span>
                          ) : (
                            <span className={`subchart-stat ${hoveredDay.marginDiff >= 0 ? 'val-up' : 'val-down'}`}>
                              ▮ 融資變動({unitLabel}) <strong>{hoveredDay.marginDiff}</strong>
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    <SubIndicatorChart
                      data={visibleKline}
                      hoverIdx={localHoverIdx}
                      onHoverIdx={idx => setHoverIdx(visibleStartGlobalIdx + idx)}
                      barKey={creditSubMode === 'short' ? 'shortDiff' : 'marginDiff'}
                      lineKey={creditSubMode === 'short' ? 'shortBal' : 'marginBal'}
                      lineColor="#f59e0b"
                    />
                  </div>
                )}

                {/* 7. KD 技術指標 */}
                {subchartPreset >= 2 && (
                  <div className="subchart-panel">
                    <div className="subchart-header">
                      <span className="subchart-badge">KD</span>
                      <span className="subchart-stat blue-text">— K(9) <strong>{hoveredDay.k}</strong></span>
                      <span className="subchart-stat purple-text">— D(9) <strong>{hoveredDay.d}</strong></span>
                    </div>
                    <SubIndicatorChart
                      data={visibleKline}
                      hoverIdx={localHoverIdx}
                      onHoverIdx={idx => setHoverIdx(visibleStartGlobalIdx + idx)}
                      isKDJ
                    />
                  </div>
                )}

                {/* 8. 副圖對照：若頂部已鎖定分點，此處對照全市場主力買賣超；若頂部為全市場主力，此處顯示分點進出 */}
                {leftTab !== '分點K線' && !isMarketIndex && (
                  <div className="subchart-panel broker-sync-panel">
                    <div className="subchart-header">
                      {mainSubchartFocus === 'broker' ? (
                        <>
                          <span className="subchart-badge">全市場主力買賣超對照</span>
                          <span className="subchart-stat">
                            — 累計(張) <strong>{hoveredDay.cumMainNet?.toLocaleString() ?? '--'}</strong>
                          </span>
                          {hoveredDay.mainNet === null || hoveredDay.mainNet === undefined ? (
                            <span className="pending-chip-badge">⏳ 盤後籌碼待公布 (留空)</span>
                          ) : (
                            <span className={`subchart-stat ${hoveredDay.mainNet >= 0 ? 'val-up' : 'val-down'}`}>
                              ▮ 買賣超(張) <strong>{hoveredDay.mainNet.toLocaleString()}</strong>
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="subchart-badge highlight-badge">分點進出 ({selectedBrokerNames})</span>
                          <span className="subchart-stat">
                            — 累計買賣超(張) <strong>{hoveredBrokerPoint.brokerCum}</strong>
                          </span>
                          {hoveredBrokerPoint.brokerNet === null || hoveredBrokerPoint.brokerNet === undefined ? (
                            <span className="pending-chip-badge">⏳ 盤後分點待公布 (留空)</span>
                          ) : (
                            <span className={`subchart-stat ${hoveredBrokerPoint.brokerNet >= 0 ? 'val-up' : 'val-down'}`}>
                              ▮ 買賣超(張) <strong>{hoveredBrokerPoint.brokerNet}</strong> (買張 {hoveredBrokerPoint.buy} 賣張 {hoveredBrokerPoint.sell})
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    <SubIndicatorChart
                      data={mainSubchartFocus === 'broker' ? visibleKline : selectedBrokerDailyData}
                      hoverIdx={localHoverIdx}
                      onHoverIdx={idx => setHoverIdx(visibleStartGlobalIdx + idx)}
                      barKey={mainSubchartFocus === 'broker' ? 'mainNet' : 'brokerNet'}
                      lineKey={mainSubchartFocus === 'broker' ? 'cumMainNet' : 'brokerCum'}
                      lineColor={mainSubchartFocus === 'broker' ? '#8b5cf6' : '#7c3aed'}
                    />
                  </div>
                )}
              </div>
              </div>

              {/* 底部時間軸與區間切換列（支援 1月/3月/6月/1年/全部 與滑鼠滾輪縮放提示） */}
              <div className="chart-bottom-bar">
                <div className="preset-num-btns" title="切換副圖顯示層數">
                  {[1, 2, 3, 4, 5, 6].map(n => (
                    <button
                      key={n}
                      className={`btn-preset-num ${subchartPreset === n ? 'active' : ''}`}
                      onClick={() => setSubchartPreset(n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div className="timeline-date-badge">{hoveredDay.date}</div>
                <div className="range-zoom-btns">
                  <span className="wheel-zoom-hint" title="將游標移至 K 線圖上方滾動滑鼠滾輪即可平滑縮放">
                    🔍 滾輪縮放 ({visibleKline.length}日)
                  </span>
                  <button
                    className={`btn-range ${chartRange <= 25 ? 'active' : ''}`}
                    onClick={() => setChartRange(20)}
                    title="近 1 個月 (約 20 交易日)"
                  >
                    1月
                  </button>
                  <button
                    className={`btn-range ${chartRange > 25 && chartRange <= 75 ? 'active' : ''}`}
                    onClick={() => setChartRange(60)}
                    title="近 3 個月 (約 60 交易日)"
                  >
                    3月
                  </button>
                  <button
                    className={`btn-range ${chartRange > 75 && chartRange <= 150 ? 'active' : ''}`}
                    onClick={() => setChartRange(120)}
                    title="近半年 (約 120 交易日)"
                  >
                    6月
                  </button>
                  <button
                    className={`btn-range ${chartRange > 150 && chartRange <= 255 ? 'active' : ''}`}
                    onClick={() => setChartRange(250)}
                    title="近 1 年完整交易日 (約 250 交易日)"
                  >
                    1年
                  </button>
                  <button
                    className={`btn-range ${chartRange >= (stock.kline.length || 250) ? 'active' : ''}`}
                    onClick={() => setChartRange(stock.kline.length || 250)}
                    title="全部歷史 K 棒"
                  >
                    全部
                  </button>
                  <button
                    className="btn-range btn-zoom-btn"
                    onClick={() => setChartRange(prev => Math.max(15, prev - 12))}
                    title="放大 K 線"
                  >
                    +
                  </button>
                  <button
                    className="btn-range btn-zoom-btn"
                    onClick={() => setChartRange(prev => Math.min(stock.kline.length || 250, prev + 18))}
                    title="縮小 K 線"
                  >
                    −
                  </button>
                </div>
              </div>
            </>
          ) : leftTab === '即時走勢' ? (
            <div className="tab-custom-content">
              <div className="intraday-grid">
                <div className="intraday-card">
                  <h3>📈 {stock.code} {stock.name} 盤中內外盤與大戶散戶力道分析</h3>
                  <div className="intraday-OrderFlow">
                    <div className="flow-row">
                      <span>特大單/主力外盤買進</span>
                      <div className="flow-bar-bg">
                        <div className="flow-bar-fill red" style={{ width: `${Math.min(92, Math.max(25, 55 + stock.main1))}%` }} />
                      </div>
                      <strong className="val-up">{Math.min(92, Math.max(25, 55 + stock.main1))}%</strong>
                    </div>
                    <div className="flow-row">
                      <span>內盤主動賣出占比</span>
                      <div className="flow-bar-bg">
                        <div className="flow-bar-fill green" style={{ width: `${Math.min(85, Math.max(15, 45 - stock.main1))}%` }} />
                      </div>
                      <strong className="val-down">{Math.min(85, Math.max(15, 45 - stock.main1))}%</strong>
                    </div>
                  </div>
                  <div className="intraday-stats-strip">
                    <div><span>連續內盤次數：</span><strong className="val-down">{stock.inCount} 次 ({stock.inVol} 張)</strong></div>
                    <div><span>連續外盤次數：</span><strong className="val-up">{stock.outCount} 次 ({stock.outVol} 張)</strong></div>
                    <div><span>當日當沖比率：</span><strong>{stock.dayTradePct}%</strong></div>
                    <div><span>權證認購金額：</span><strong>{stock.warrantAmt} 萬</strong></div>
                  </div>
                </div>

                <div className="intraday-card">
                  <h3>📊 最佳五檔委買 / 委賣掛單明細</h3>
                  <table className="broker-table">
                    <thead>
                      <tr>
                        <th>委買張數</th>
                        <th>委買價</th>
                        <th>委賣價</th>
                        <th>委賣張數</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[0, 1, 2, 3, 4].map(lv => {
                        const step = stock.price >= 100 ? 0.5 : 0.1;
                        const bidP = (stock.price - lv * step).toFixed(stock.price >= 100 ? 1 : 2);
                        const askP = (stock.price + (lv + 1) * step).toFixed(stock.price >= 100 ? 1 : 2);
                        const bidV = Math.round(28 + ((lv * 19 + parseInt(stock.code, 10)) % 95));
                        const askV = Math.round(32 + ((lv * 23 + parseInt(stock.code, 10)) % 110));
                        return (
                          <tr key={lv}>
                            <td className="val-up">{bidV}</td>
                            <td className="val-up">{bidP}</td>
                            <td className="val-down">{askP}</td>
                            <td className="val-down">{askV}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : leftTab === '大單券商' ? (
            <div className="tab-custom-content">
              <h3>⚖️ 區間買超前 10 大主力 vs 賣超前 10 大主力視覺化對決 ({periodDays}日統計)</h3>
              <p className="tab-subdesc">點擊任一券商長條可直接將該分點載入下方與右側明細追蹤</p>
              <div className="duel-bars-grid">
                <div className="duel-col">
                  <div className="duel-header red">主力買方前 10 名 (合計 +{chipAnalysis.top15BuySum} 張)</div>
                  {chipAnalysis.topBuyers.slice(0, 10).map(b => {
                    const maxNet = Math.max(1, chipAnalysis.topBuyers[0]?.net || 1);
                    const pct = Math.min(100, Math.round((b.net / maxNet) * 100));
                    return (
                      <div key={b.id} className="duel-bar-item" onClick={() => toggleBrokerCheck(b.id)}>
                        <div className="duel-label">{b.name}</div>
                        <div className="duel-track">
                          <div className="duel-fill red" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="duel-val val-up">+{b.net}張</div>
                      </div>
                    );
                  })}
                </div>
                <div className="duel-col">
                  <div className="duel-header green">主力賣方前 10 名 (合計 {chipAnalysis.top15SellSum} 張)</div>
                  {chipAnalysis.topSellers.slice(0, 10).map(b => {
                    const maxAbs = Math.max(1, Math.abs(chipAnalysis.topSellers[0]?.net || 1));
                    const pct = Math.min(100, Math.round((Math.abs(b.net) / maxAbs) * 100));
                    return (
                      <div key={b.id} className="duel-bar-item" onClick={() => toggleBrokerCheck(b.id)}>
                        <div className="duel-label">{b.name}</div>
                        <div className="duel-track">
                          <div className="duel-fill green" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="duel-val val-down">{b.net}張</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : leftTab === '主力地圖' ? (
            <div className="tab-custom-content">
              <h3>🗺️ 券商派別與地緣主力資金流向地圖 ({periodDays}日統計)</h3>
              <div className="broker-map-cards">
                {[
                  { title: '外資主力軍團', list: chipAnalysis.foreignBrokers, desc: '美林、大摩、小摩、瑞銀、高盛等外資分點' },
                  { title: '隔日沖大戶群', list: chipAnalysis.dayTradeBrokers, desc: '凱基-台北、富邦-建國、凱基-新竹等短線大戶' },
                  { title: '神秘與地緣主力', list: chipAnalysis.mysteryBrokers, desc: '玉山-城中、群益-中山、元大-城北等關鍵分點' },
                  { title: '八大官股行庫', list: chipAnalysis.govBrokers, desc: '兆豐、臺銀、第一金、華南永昌等政策護盤指標' }
                ].map(group => {
                  const sumNet = group.list.reduce((s, b) => s + b.net, 0);
                  const sumProfit = group.list.reduce((s, b) => s + b.profitWan, 0);
                  return (
                    <div key={group.title} className="map-group-card">
                      <div className="map-group-top">
                        <strong>{group.title}</strong>
                        <span className={sumNet >= 0 ? 'val-up' : 'val-down'}>
                          {sumNet >= 0 ? `買超 +${sumNet} 張` : `賣超 ${sumNet} 張`}
                        </span>
                      </div>
                      <p className="map-group-desc">{group.desc}</p>
                      <div className="map-group-Chips">
                        {group.list.slice(0, 6).map(b => (
                          <button
                            key={b.id}
                            className={`map-chip ${b.net >= 0 ? 'up' : 'down'}`}
                            onClick={() => {
                              toggleBrokerCheck(b.id);
                              setLeftTab('分點K線');
                              setOverlayMode('brokerCost');
                            }}
                          >
                            {b.name} ({b.net >= 0 ? `+${b.net}` : b.net})
                          </button>
                        ))}
                      </div>
                      <div className="map-group-footer">
                        群組區間預估損益：<strong className={sumProfit >= 0 ? 'val-up' : 'val-down'}>{sumProfit} 萬</strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : leftTab === '個股分析' || leftTab === '細產業' ? (
            <div className="tab-custom-content">
              <h3>🏭 【{stock.industry}】同產業個股主力集中度與估值比價表</h3>
              <p className="tab-subdesc">點擊任一同業個股可立即切換檢視其個股 K 線與分點明細</p>
              <table className="broker-table">
                <thead>
                  <tr>
                    <th className="b-col-name">代號 / 名稱</th>
                    <th>成交價</th>
                    <th>漲跌%</th>
                    <th>主1%</th>
                    <th>主5%</th>
                    <th>主10%</th>
                    <th>投信連買</th>
                    <th>本益比</th>
                    <th>股淨比</th>
                    <th>殖利率%</th>
                    <th>營收YoY%</th>
                  </tr>
                </thead>
                <tbody>
                  {industryPeers.map(peer => (
                    <tr
                      key={peer.code}
                      className={`broker-row ${peer.code === stock.code ? 'row-broker-active' : ''}`}
                      onClick={() => onSelectStock(peer.code)}
                    >
                      <td className="b-col-name">
                        <strong>{peer.code} {peer.name}</strong>
                      </td>
                      <td>{peer.price}</td>
                      <td className={peer.changePct >= 0 ? 'val-up' : 'val-down'}>{peer.changePct}%</td>
                      <td className={peer.main1 >= 0 ? 'val-up' : 'val-down'}>{peer.main1}%</td>
                      <td className={peer.main5 >= 0 ? 'val-up' : 'val-down'}>{peer.main5}%</td>
                      <td className={peer.main10 >= 0 ? 'val-up' : 'val-down'}>{peer.main10}%</td>
                      <td className={peer.trustConsec >= 0 ? 'val-up' : 'val-down'}>{peer.trustConsec}日</td>
                      <td>{peer.pe}</td>
                      <td>{peer.pb}</td>
                      <td>{peer.dividendYield}%</td>
                      <td className={peer.revYoY >= 0 ? 'val-up' : 'val-down'}>{peer.revYoY}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* 筆記與到價/主力提醒設定 */
            <div className="tab-custom-content">
              <h3>📝 {stock.code} {stock.name} 專屬交易筆記與主力異動監控設定</h3>
              <div className="notes-form-grid">
                <label className="calc-field">
                  <span>理想低接買進價 (元)</span>
                  <input
                    type="number"
                    value={currentNote.targetBuy}
                    onChange={e => updateCurrentNote('targetBuy', e.target.value)}
                  />
                </label>
                <label className="calc-field">
                  <span>防守停損價 (元)</span>
                  <input
                    type="number"
                    value={currentNote.stopLoss}
                    onChange={e => updateCurrentNote('stopLoss', e.target.value)}
                  />
                </label>
                <label className="calc-field">
                  <span>主1集中度突破通知門檻 (%)</span>
                  <input
                    type="number"
                    value={currentNote.alertMain1}
                    onChange={e => updateCurrentNote('alertMain1', e.target.value)}
                  />
                </label>
              </div>
              <textarea
                className="stock-memo-textarea"
                rows={8}
                value={currentNote.memo}
                onChange={e => updateCurrentNote('memo', e.target.value)}
                placeholder="記錄關鍵分點成本、法說會重點與進出策略..."
              />
              <p className="tab-subdesc">✓ 筆記與監控門檻已自動儲存於本機瀏覽器</p>
            </div>
          )}
        </div>

        {/* 右側面板：主力集中度看板 + 基本面 9 宮格 + 關鍵/買賣超前15名券商分點明細 */}
        <div className="detail-right-pane">
          {/* 右側子頁籤 */}
          <div className="right-subtabs-bar">
            {[
              { id: '籌碼分析', label: '主力分析' },
              { id: '體檢表', label: '體檢表' },
              { id: '重大事件', label: '重大事件(1)', isRed: true },
              { id: '新聞', label: '新聞' },
              { id: '分點細膩', label: '分點逐日明細' },
              { id: '法人目標', label: `法人目標(${stock.targetPrice}元)`, isRed: true }
            ].map(t => (
              <button
                key={t.id}
                className={`right-subtab ${rightTab === t.id ? 'active' : ''} ${t.isRed ? 'red-tab' : ''}`}
                onClick={() => setRightTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* 股票報價標題列 */}
          <div className="right-stock-quote-bar">
            <span className="quote-code-name">
              {stock.code} {stock.name}
            </span>
            <span className={`quote-price-main ${stock.change >= 0 ? 'val-up' : 'val-down'}`}>
              {stock.price?.toLocaleString()}{isMarketIndex ? '點' : '元'} {stock.change >= 0 ? `▲ ${stock.change}` : `▼ ${Math.abs(stock.change)}`} ({stock.changePct}%)
            </span>
          </div>

          {rightTab === '籌碼分析' ? (
            isMarketIndex ? (
              <>
                {/* 大盤加權指數與三大法人/散戶/融資融券結構看板 */}
                {(() => {
                  const sliceStart = Math.max(0, endDateIdx - periodDays + 1);
                  const periodSlice = stock.kline.slice(sliceStart, endDateIdx + 1);
                  const sumField = key =>
                    Number(
                      periodSlice
                        .reduce((acc, d) => acc + (Number(d[key]) || 0), 0)
                        .toFixed(1)
                    );
                  const mMain = sumField('mainNet');
                  const mForeign = sumField('foreignNet');
                  const mTrust = sumField('trustNet');
                  const mDealer = sumField('dealerNet');
                  const mRetail = sumField('retailNet');
                  const mMargin = sumField('marginDiff');
                  const mVol = sumField('volume');
                  const endBar = stock.kline[endDateIdx] || stock.kline[stock.kline.length - 1];

                  const topBullStocks = [...allStocks]
                    .sort((a, b) => (b.main1 || 0) - (a.main1 || 0))
                    .slice(0, 10);
                  const topBearStocks = [...allStocks]
                    .sort((a, b) => (a.main1 || 0) - (b.main1 || 0))
                    .slice(0, 10);

                  return (
                    <>
                      <div className="chip-summary-grid">
                        <div className="chip-metrics-table">
                          <div className="metric-row">
                            <span className="m-label">統計區間</span>
                            <span className="m-val">{periodSlice[0]?.date} ~ {endBar?.date}</span>
                          </div>
                          <div className="metric-row">
                            <span className="m-label">台指期近月 / 價差</span>
                            <span className="m-val">
                              {(stock.futuresPrice || 41635).toLocaleString()} 點 ({stock.futuresDiff >= 0 ? `+${stock.futuresDiff}` : stock.futuresDiff})
                            </span>
                          </div>
                          <div className="metric-row">
                            <span className="m-label">區間成交金額</span>
                            <span className="m-val">{mVol.toLocaleString()} 億元</span>
                          </div>
                          <div className="metric-row">
                            <span className="m-label">三大法人合計({periodDays}日)</span>
                            <span className={`m-val ${mMain >= 0 ? 'val-up' : 'val-down'}`}>
                              {mMain >= 0 ? `+${mMain}` : mMain} 億元
                            </span>
                          </div>
                          <div className="metric-row">
                            <span className="m-label">外資及陸資({periodDays}日)</span>
                            <span className={`m-val ${mForeign >= 0 ? 'val-up' : 'val-down'}`}>
                              {mForeign >= 0 ? `+${mForeign}` : mForeign} 億元
                            </span>
                          </div>
                          <div className="metric-row">
                            <span className="m-label">投信法人({periodDays}日)</span>
                            <span className={`m-val ${mTrust >= 0 ? 'val-up' : 'val-down'}`}>
                              {mTrust >= 0 ? `+${mTrust}` : mTrust} 億元
                            </span>
                          </div>
                          <div className="metric-row">
                            <span className="m-label">自營商含避險({periodDays}日)</span>
                            <span className={`m-val ${mDealer >= 0 ? 'val-up' : 'val-down'}`}>
                              {mDealer >= 0 ? `+${mDealer}` : mDealer} 億元
                            </span>
                          </div>
                          <div className="metric-row">
                            <span className="m-label">散戶多空指標({periodDays}日)</span>
                            <span className={`m-val ${mRetail >= 0 ? 'val-up' : 'val-down'}`}>
                              {mRetail >= 0 ? `+${mRetail}` : mRetail} 億元
                            </span>
                          </div>
                          <div className="metric-row">
                            <span className="m-label">大盤融資餘額 / 增減</span>
                            <span className={`m-val ${mMargin >= 0 ? 'val-up' : 'val-down'}`}>
                              {endBar?.marginBal?.toLocaleString()} 億 ({mMargin >= 0 ? `+${mMargin}` : mMargin} 億)
                            </span>
                          </div>
                        </div>

                        <div className={`main-force-card ${mMain >= 0 ? 'bullish' : 'bearish'}`}>
                          <div className="mf-card-header">
                            <div>{endBar?.shortDate || '最新'} ({periodDays}日)</div>
                            <div>大盤法人動向</div>
                          </div>
                          <div className="mf-card-body">
                            <div className="mf-big-status">{mMain >= 0 ? '大盤偏多' : '法人調節'}</div>
                            <div className="mf-big-lots">{Math.abs(mMain).toLocaleString()} 億</div>
                          </div>
                        </div>
                      </div>

                      {/* 權值與熱門股主力買超 vs 賣超排行 */}
                      <div className="broker-section">
                        <div className="broker-bar red-bar">
                          <span className="broker-bar-title">🔥 權值/熱門股主力買超集中排行 (點擊切換個股K線)</span>
                        </div>
                        <div className="broker-table-scroll">
                          <table className="broker-table">
                            <thead>
                              <tr>
                                <th className="b-col-name">代號 / 名稱</th>
                                <th>收盤價</th>
                                <th>漲跌%</th>
                                <th>主1%</th>
                                <th>主5%</th>
                                <th>投信連買</th>
                                <th>動能階段</th>
                              </tr>
                            </thead>
                            <tbody>
                              {topBullStocks.map(s => (
                                <tr
                                  key={s.code}
                                  className="broker-row row-tint-red"
                                  onClick={() => onSelectStock(s.code)}
                                >
                                  <td className="b-col-name">
                                    <strong>{s.code} {s.name}</strong>
                                  </td>
                                  <td>{s.price}</td>
                                  <td className={s.changePct >= 0 ? 'val-up' : 'val-down'}>{s.changePct}%</td>
                                  <td className="val-up">+{s.main1}%</td>
                                  <td className={s.main5 >= 0 ? 'val-up' : 'val-down'}>{s.main5}%</td>
                                  <td className={s.trustConsec >= 0 ? 'val-up' : 'val-down'}>{s.trustConsec}日</td>
                                  <td>{s.momentum?.main?.stageLabel}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="broker-section">
                        <div className="broker-bar green-bar">
                          <span className="broker-bar-title">📉 權值/熱門股主力賣超調節排行 (點擊切換個股K線)</span>
                        </div>
                        <div className="broker-table-scroll">
                          <table className="broker-table">
                            <thead>
                              <tr>
                                <th className="b-col-name">代號 / 名稱</th>
                                <th>收盤價</th>
                                <th>漲跌%</th>
                                <th>主1%</th>
                                <th>主5%</th>
                                <th>投信連買</th>
                                <th>動能階段</th>
                              </tr>
                            </thead>
                            <tbody>
                              {topBearStocks.map(s => (
                                <tr
                                  key={s.code}
                                  className="broker-row row-tint-green"
                                  onClick={() => onSelectStock(s.code)}
                                >
                                  <td className="b-col-name">
                                    <strong>{s.code} {s.name}</strong>
                                  </td>
                                  <td>{s.price}</td>
                                  <td className={s.changePct >= 0 ? 'val-up' : 'val-down'}>{s.changePct}%</td>
                                  <td className="val-down">{s.main1}%</td>
                                  <td className={s.main5 >= 0 ? 'val-up' : 'val-down'}>{s.main5}%</td>
                                  <td className={s.trustConsec >= 0 ? 'val-up' : 'val-down'}>{s.trustConsec}日</td>
                                  <td>{s.momentum?.main?.stageLabel}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </>
            ) : (
            <>
              {/* 主力統計區間摘要 + 主力動向大看板 */}
              <div className="chip-summary-grid">
                <div className="chip-metrics-table">
                  <div className="metric-row">
                    <span className="m-label">統計區間</span>
                    <span className="m-val">{chipAnalysis.startDate} ~ {chipAnalysis.endDate}</span>
                  </div>
                  <div className="metric-row">
                    <span className="m-label">區間成交量</span>
                    <span className="m-val">{chipAnalysis.periodVol.toLocaleString()} 張</span>
                  </div>
                  <div className="metric-row">
                    <span className="m-label">買超前15名合計</span>
                    <span className="m-val val-up">+{chipAnalysis.top15BuySum.toLocaleString()} 張</span>
                  </div>
                  <div className="metric-row">
                    <span className="m-label">賣超前15名合計</span>
                    <span className="m-val val-down">{chipAnalysis.top15SellSum.toLocaleString()} 張</span>
                  </div>
                  <div className="metric-row">
                    <span className="m-label">
                      {periodDays}日主力差額
                      <span className="help-q" onClick={onOpenFormulaModal} title="點擊查看主1/主5/主10公式">?</span>
                    </span>
                    <span className={`m-val ${chipAnalysis.chipNet >= 0 ? 'val-up' : 'val-down'}`}>
                      {chipAnalysis.chipNet.toLocaleString()} 張
                    </span>
                  </div>
                  <div className="metric-row">
                    <span className="m-label">
                      {periodDays}日主力集中(%)
                      <span className="help-q" onClick={onOpenFormulaModal}>?</span>
                    </span>
                    <span className={`m-val ${chipAnalysis.chipConcentrationPct >= 0 ? 'val-up' : 'val-down'}`}>
                      {chipAnalysis.chipConcentrationPct} %
                    </span>
                  </div>
                  <div className="metric-row">
                    <span className="m-label">20日主力集中(%)</span>
                    <span className={`m-val ${chipAnalysis.chip20Pct >= 0 ? 'val-up' : 'val-down'}`}>
                      {chipAnalysis.chip20Pct} %
                    </span>
                  </div>
                  <div className="metric-row">
                    <span className="m-label">佔股本比重</span>
                    <span className="m-val">{chipAnalysis.capitalRatioPct} %</span>
                  </div>
                  <div className="metric-row">
                    <span className="m-label">區間周轉率</span>
                    <span className="m-val">{chipAnalysis.turnoverPct} %</span>
                  </div>
                </div>

                {/* 主力動向大看板 */}
                <div className={`main-force-card ${chipAnalysis.isBullish ? 'bullish' : 'bearish'}`}>
                  <div className="mf-card-header">
                    <div>{chipAnalysis.endDate?.slice(5) || '最新'} ({periodDays}日)</div>
                    <div>主力動向</div>
                  </div>
                  <div className="mf-card-body">
                    <div className="mf-big-status">{chipAnalysis.directionLabel}</div>
                    <div className="mf-big-lots">{chipAnalysis.absChipNet.toLocaleString()} 張</div>
                  </div>
                </div>
              </div>

              {/* 方案 C 視覺升級：前 15 大買方 vs 賣方紅綠拔河條 */}
              {(() => {
                const bSum = Math.max(1, chipAnalysis.top15BuySum);
                const sSum = Math.max(1, Math.abs(chipAnalysis.top15SellSum));
                const buyPct = Math.round((bSum / (bSum + sSum)) * 100);
                return (
                  <div className="detail-tug-strip">
                    <div className="tug-bar-track">
                      <div className="tug-bar-buy" style={{ width: `${buyPct}%` }}>
                        買超前15名 +{chipAnalysis.top15BuySum.toLocaleString()}張 ({buyPct}%)
                      </div>
                      <div className="tug-bar-sell" style={{ width: `${100 - buyPct}%` }}>
                        賣超前15名 {chipAnalysis.top15SellSum.toLocaleString()}張 ({100 - buyPct}%)
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 基本面 9 宮格快覽列 */}
              <div className="fundamental-strip">
                <div className="fund-cell">
                  <div className="fund-title">累計營收<br />YoY(%)</div>
                  <div className={`fund-val ${stock.cumRevYoY >= 0 ? 'val-up' : 'val-down'}`}>{stock.cumRevYoY}</div>
                </div>
                <div className="fund-cell">
                  <div className="fund-title">營收<br />YoY(%)</div>
                  <div className={`fund-val ${stock.revYoY >= 0 ? 'val-up' : 'val-down'}`}>{stock.revYoY}</div>
                </div>
                <div className="fund-cell">
                  <div className="fund-title">營收<br />MoM(%)</div>
                  <div className={`fund-val ${stock.revMoM >= 0 ? 'val-up' : 'val-down'}`}>{stock.revMoM}</div>
                </div>
                <div className="fund-cell">
                  <div className="fund-title">EPS<br />(季)</div>
                  <div className={`fund-val ${stock.epsQ >= 0 ? 'val-up' : 'val-down'}`}>{stock.epsQ}</div>
                </div>
                <div className="fund-cell">
                  <div className="fund-title">EPS<br />(近4季)</div>
                  <div className={`fund-val ${stock.eps4Q >= 0 ? 'val-up' : 'val-down'}`}>{stock.eps4Q}</div>
                </div>
                <div className="fund-cell">
                  <div className="fund-title">本益比</div>
                  <div className="fund-val val-down">{stock.pe}</div>
                </div>
                <div className="fund-cell" title="股淨比低於 0.5 且公司派大買容易是低點">
                  <div className="fund-title">股價<br />淨值比</div>
                  <div className={`fund-val ${stock.pb < 0.5 ? 'val-up' : 'val-down'}`}>{stock.pb}</div>
                </div>
                <div className="fund-cell">
                  <div className="fund-title">殖利率<br />(%)</div>
                  <div className="fund-val val-down">{stock.dividendYield}</div>
                </div>
                <div className="fund-cell">
                  <div className="fund-title">ROE<br />(近4季)</div>
                  <div className="fund-val">{stock.roe}</div>
                </div>
              </div>

              {/* 券商分點區間買賣超雙區塊（緊鄰上下排版，支援獨立捲軸瀏覽15家券商） */}
              <div className="broker-tables-split-container">
                {/* 上半部券商分點表 */}
                <div className="broker-section">
                <div className="broker-bar red-bar">
                  <span className="broker-bar-title">
                    {topBrokerFilter === 'mystery'
                      ? '神秘/地緣券商'
                      : topBrokerFilter === 'topBuy15'
                        ? '區間買超15'
                        : topBrokerFilter === 'swing'
                          ? '波段主力券商'
                          : topBrokerFilter === 'dayTrade'
                            ? '隔日沖主力券商'
                            : topBrokerFilter === 'scalp'
                              ? '當沖大戶券商'
                              : topBrokerFilter === 'retail'
                                ? '散戶集散券商'
                                : topBrokerFilter === 'foreign'
                                  ? '外資主力券商'
                                  : '八大官股行庫'}
                    <small className="broker-settle-note">
                      （損益以 {chipAnalysis.endDate} 收盤 {chipAnalysis.reportClosePrice} 元結算）
                    </small>
                  </span>
                  <div className="broker-bar-right">
                    <span className="broker-filter-label" onClick={onOpenFormulaModal} style={{ cursor: 'pointer' }} title="點擊查看分點區間損益計算公式">
                      ? 損益公式
                    </span>
                    <select
                      className="broker-filter-select"
                      value={topBrokerFilter}
                      onChange={e => setTopBrokerFilter(e.target.value)}
                      id="select-top-broker-mode"
                    >
                      <option value="topBuy15">區間買超前15</option>
                      <option value="swing">💎 波段主力</option>
                      <option value="dayTrade">🔥 隔日沖大戶</option>
                      <option value="mystery">🕵️ 神秘券商</option>
                      <option value="scalp">⚡ 當沖大戶</option>
                      <option value="retail">👥 散戶集散</option>
                      <option value="foreign">🌐 外資主力</option>
                      <option value="gov">🏛️ 八大官股</option>
                    </select>
                  </div>
                </div>

                <div className="broker-table-scroll">
                  <table className="broker-table" id="table-top-brokers">
                    <thead>
                      <tr>
                        <th className="b-col-check" title="勾選連動左側「主力買賣超 / 分點進出」副圖">✓</th>
                        <th className="b-col-name">券商名稱 / 屬性分類</th>
                        <th>買賣超</th>
                        <th>買張</th>
                        <th>賣張</th>
                        <th>買均價</th>
                        <th>賣均價</th>
                        <th>交易量</th>
                        <th title="損益(萬) = 當沖已實現損益 [min(買張,賣張)×(賣均-買均)×0.1] + 留倉未實現損益 [買賣超×(區間收盤價-均價)×0.1]">
                          損益(萬) ⓘ
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {upperBrokerList.map(b => {
                        const isChecked = selectedBrokerIds.includes(b.id);
                        const matched = b.matchedLots ?? Math.min(b.buy, b.sell);
                        const realized = b.realizedWan ?? 0;
                        const unrealized = b.unrealizedWan ?? b.profitWan;
                        const profitTooltip = `【${b.name} (${b.badgeLabel || b.type || '主力分點'}) 區間損益與交易特徵 (結算價 ${chipAnalysis.reportClosePrice} 元)】\n• 分類特徵：${b.desc || '常規主力分點'}\n• 當沖沖銷率：${b.scalpRate ?? 0}%｜留倉率：${b.holdRate ?? 0}%\n• 當沖沖銷 ${matched} 張 × (賣均 ${b.avgSell} - 買均 ${b.avgBuy}) = ${realized >= 0 ? '+' : ''}${realized} 萬\n• 留倉部位 ${b.net >= 0 ? '+' : ''}${b.net} 張 × (收盤 ${chipAnalysis.reportClosePrice} - 成本 ${b.net >= 0 ? b.avgBuy : b.avgSell}) = ${unrealized >= 0 ? '+' : ''}${unrealized} 萬\n• 合計總損益 = ${b.profitWan >= 0 ? '+' : ''}${b.profitWan} 萬`;
                        return (
                          <tr
                            key={b.id}
                            className={`broker-row ${b.net >= 0 ? 'row-tint-red' : 'row-tint-green'} ${
                              isChecked ? 'row-broker-active' : ''
                            }`}
                            onClick={() => toggleBrokerCheck(b.id)}
                            title={profitTooltip}
                          >
                            <td className="b-col-check" onClick={e => toggleBrokerMulti(b.id, e)}>
                              <input type="checkbox" checked={isChecked} onChange={() => {}} />
                            </td>
                            <td className="b-col-name">
                              <div className="b-name-wrapper">
                                <span className="b-name-text">{b.name}</span>
                                {b.badgeLabel && (
                                  <span className={`tag-broker ${b.badgeClass}`} title={b.desc}>
                                    {b.badgeLabel}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className={b.net >= 0 ? 'val-up' : 'val-down'}>{b.net}</td>
                            <td>{b.buy}</td>
                            <td>{b.sell}</td>
                            <td>{b.avgBuy > 0 ? b.avgBuy : '--'}</td>
                            <td>{b.avgSell > 0 ? b.avgSell : '--'}</td>
                            <td>{b.vol}</td>
                            <td className={b.profitWan >= 0 ? 'val-up' : 'val-down'} title={profitTooltip}>
                              {b.profitWan >= 0 ? `+${b.profitWan}` : b.profitWan}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 下半部券商分點表 */}
              <div className="broker-section">
                <div className="broker-bar green-bar">
                  <span className="broker-bar-title">
                    {bottomBrokerFilter === 'topSell15'
                      ? '區間賣超15'
                      : bottomBrokerFilter === 'dayTrade'
                        ? '隔日沖調節券商'
                        : bottomBrokerFilter === 'swing'
                          ? '波段調節券商'
                          : bottomBrokerFilter === 'retail'
                            ? '散戶調節券商'
                            : bottomBrokerFilter === 'foreign'
                              ? '外資券商排行'
                              : '八大官股行庫'}
                    <small className="broker-settle-note">
                      （損益以 {chipAnalysis.endDate} 收盤 {chipAnalysis.reportClosePrice} 元結算）
                    </small>
                  </span>
                  <div className="broker-bar-right">
                    <span className="broker-filter-label" onClick={onOpenFormulaModal} style={{ cursor: 'pointer' }} title="點擊查看分點區間損益計算公式">
                      ? 損益公式
                    </span>
                    <select
                      className="broker-filter-select"
                      value={bottomBrokerFilter}
                      onChange={e => setBottomBrokerFilter(e.target.value)}
                      id="select-bottom-broker-mode"
                    >
                      <option value="topSell15">區間賣超前15</option>
                      <option value="dayTrade">🔥 隔日沖/倒貨</option>
                      <option value="swing">💎 波段調節</option>
                      <option value="retail">👥 散戶集散</option>
                      <option value="foreign">🌐 外資券商</option>
                      <option value="gov">🏛️ 八大官股</option>
                    </select>
                  </div>
                </div>

                <div className="broker-table-scroll">
                  <table className="broker-table" id="table-bottom-brokers">
                    <thead>
                      <tr>
                        <th className="b-col-check" title="勾選連動左側「主力買賣超 / 分點進出」副圖">✓</th>
                        <th className="b-col-name">券商名稱 / 屬性分類</th>
                        <th>買賣超</th>
                        <th>買張</th>
                        <th>賣張</th>
                        <th>買均價</th>
                        <th>賣均價</th>
                        <th>交易量</th>
                        <th title="損益(萬) = 當沖已實現損益 [min(買張,賣張)×(賣均-買均)×0.1] + 留倉未實現損益 [買賣超×(區間收盤價-均價)×0.1]">
                          損益(萬) ⓘ
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {lowerBrokerList.map(b => {
                        const isChecked = selectedBrokerIds.includes(b.id);
                        const matched = b.matchedLots ?? Math.min(b.buy, b.sell);
                        const realized = b.realizedWan ?? 0;
                        const unrealized = b.unrealizedWan ?? b.profitWan;
                        const profitTooltip = `【${b.name} (${b.badgeLabel || b.type || '主力分點'}) 區間損益與交易特徵 (結算價 ${chipAnalysis.reportClosePrice} 元)】\n• 分類特徵：${b.desc || '常規主力分點'}\n• 當沖沖銷率：${b.scalpRate ?? 0}%｜留倉率：${b.holdRate ?? 0}%\n• 當沖沖銷 ${matched} 張 × (賣均 ${b.avgSell} - 買均 ${b.avgBuy}) = ${realized >= 0 ? '+' : ''}${realized} 萬\n• 留倉部位 ${b.net >= 0 ? '+' : ''}${b.net} 張 × (賣均 ${b.avgSell || chipAnalysis.reportClosePrice} - 收盤 ${chipAnalysis.reportClosePrice}) = ${unrealized >= 0 ? '+' : ''}${unrealized} 萬\n• 合計總損益 = ${b.profitWan >= 0 ? '+' : ''}${b.profitWan} 萬`;
                        return (
                          <tr
                            key={b.id}
                            className={`broker-row ${b.net >= 0 ? 'row-tint-red' : 'row-tint-green'} ${
                              isChecked ? 'row-broker-active' : ''
                            }`}
                            onClick={() => toggleBrokerCheck(b.id)}
                            title={profitTooltip}
                          >
                            <td className="b-col-check" onClick={e => toggleBrokerMulti(b.id, e)}>
                              <input type="checkbox" checked={isChecked} onChange={() => {}} />
                            </td>
                            <td className="b-col-name">
                              <div className="b-name-wrapper">
                                <span className="b-name-text">{b.name}</span>
                                {b.badgeLabel && (
                                  <span className={`tag-broker ${b.badgeClass}`} title={b.desc}>
                                    {b.badgeLabel}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className={b.net >= 0 ? 'val-up' : 'val-down'}>{b.net}</td>
                            <td>{b.buy}</td>
                            <td>{b.sell}</td>
                            <td>{b.avgBuy > 0 ? b.avgBuy : '--'}</td>
                            <td>{b.avgSell > 0 ? b.avgSell : '--'}</td>
                            <td>{b.vol}</td>
                            <td className={b.profitWan >= 0 ? 'val-up' : 'val-down'} title={profitTooltip}>
                              {b.profitWan >= 0 ? `+${b.profitWan}` : b.profitWan}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
            )
          ) : rightTab === '體檢表' ? (
            <div className="right-tab-panel">
              <h3>🩺 {stock.code} {stock.name} 六維度籌碼與基本面綜合體檢表</h3>
              <div className="health-check-list">
                {healthChecks.map(hc => (
                  <div key={hc.title} className="health-item-card">
                    <div className="health-top">
                      <strong>{hc.title}</strong>
                      <span className={hc.isGood ? 'val-up' : 'val-down'}>{hc.status} ({hc.score}分)</span>
                    </div>
                    <div className="health-bar-bg">
                      <div
                        className={`health-bar-fill ${hc.isGood ? 'red' : 'green'}`}
                        style={{ width: `${hc.score}%` }}
                      />
                    </div>
                    <div className="health-detail">{hc.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : rightTab === '分點細膩' ? (
            <div className="right-tab-panel">
              <h3>🔍 分點逐日進出明細：【{selectedBrokerNames}】</h3>
              <p className="tab-subdesc">可於「籌碼分析」頁籤點擊任意券商切換檢視對象</p>
              <div className="broker-table-scroll" style={{ maxHeight: '520px' }}>
                <table className="broker-table">
                  <thead>
                    <tr>
                      <th className="b-col-name">日期</th>
                      <th>收盤價</th>
                      <th>買張</th>
                      <th>賣張</th>
                      <th>買賣超</th>
                      <th>買均價</th>
                      <th>累計庫存</th>
                      <th>分點成本線</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...selectedBrokerDailyData].reverse().map(d => (
                      <tr key={d.date} className={(d.brokerNet || 0) >= 0 ? 'row-tint-red' : 'row-tint-green'}>
                        <td className="b-col-name">{d.date}</td>
                        <td>{d.close}</td>
                        <td>{d.buy === null ? '待公布' : d.buy}</td>
                        <td>{d.sell === null ? '待公布' : d.sell}</td>
                        <td className={(d.brokerNet || 0) >= 0 ? 'val-up' : 'val-down'}>
                          {d.brokerNet === null
                            ? '⏳留空'
                            : d.brokerNet >= 0
                              ? `+${d.brokerNet}`
                              : d.brokerNet}
                        </td>
                        <td>{d.avgBuy}</td>
                        <td>{d.brokerCum}</td>
                        <td>{d.brokerCostLine}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : rightTab === '法人目標' ? (
            <div className="right-tab-panel">
              <h3>🎯 外資與本土投顧目標價共識：{stock.targetPrice} 元</h3>
              <p className="tab-subdesc">
                目前股價 {stock.price} 元｜距離共識目標價潛在空間：{' '}
                <strong className={stock.targetPrice >= stock.price ? 'val-up' : 'val-down'}>
                  {(((stock.targetPrice - stock.price) / stock.price) * 100).toFixed(1)}%
                </strong>
              </p>
              <table className="broker-table">
                <thead>
                  <tr>
                    <th className="b-col-name">研究機構</th>
                    <th>最新評等</th>
                    <th>目標價(元)</th>
                    <th>潛在空間</th>
                    <th>預估EPS</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { firm: '台灣摩根士丹利', rating: '優於大盤', mult: 1.02, epsMult: 1.05 },
                    { firm: '摩根大通 (JPM)', rating: '買進', mult: 1.05, epsMult: 1.08 },
                    { firm: '美林證券 (BofA)', rating: '買進', mult: 0.98, epsMult: 1.0 },
                    { firm: '元大投顧', rating: '買進', mult: 1.0, epsMult: 1.02 },
                    { firm: '凱基投顧', rating: '持有', mult: 0.94, epsMult: 0.96 }
                  ].map(rep => {
                    const tp = Math.round(stock.targetPrice * rep.mult);
                    const upPct = (((tp - stock.price) / stock.price) * 100).toFixed(1);
                    return (
                      <tr key={rep.firm}>
                        <td className="b-col-name"><strong>{rep.firm}</strong></td>
                        <td className={rep.rating === '持有' ? '' : 'val-up'}>{rep.rating}</td>
                        <td className="val-up">{tp}</td>
                        <td className={Number(upPct) >= 0 ? 'val-up' : 'val-down'}>{upPct}%</td>
                        <td>{(stock.eps4Q * rep.epsMult).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* 重大事件與新聞頁籤 */
            <div className="right-tab-panel">
              <h3>📢 {stock.code} {stock.name} 重大事件與籌碼快訊</h3>
              <div className="event-timeline">
                <div className="event-card">
                  <span className="event-tag red">重大事件</span>
                  <strong>董事會決議買回庫藏股區間標記（對應左側 K 線粉紅色區塊）</strong>
                  <p>庫藏股執行期間公司派地緣分點與神秘券商逢低承接明顯，形成中期底部支撐。</p>
                </div>
                <div className="event-card">
                  <span className="event-tag blue">籌碼異動</span>
                  <strong>近 {periodDays} 日主力買賣超集中度達 {chipAnalysis.chipConcentrationPct}%</strong>
                  <p>買超前15名合計 {chipAnalysis.top15BuySum} 張，賣超前15名合計 {chipAnalysis.top15SellSum} 張，主力動向判定為「{chipAnalysis.directionLabel}」。</p>
                </div>
                <div className="event-card">
                  <span className="event-tag green">基本面快訊</span>
                  <strong>單月營收年增率 (YoY) {stock.revYoY}%，累計營收年增 {stock.cumRevYoY}%</strong>
                  <p>近四季累計 EPS {stock.eps4Q} 元，目前股價淨值比 {stock.pb} 倍，連續配發股利 {stock.divYears} 年。</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
