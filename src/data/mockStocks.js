// MainBuy 主力雷達 — 台股主力、分點、投信、外資完整資料庫與動能轉折計算引擎

export const BROKER_LIST = [
  { id: 'esun-chengzhong', name: '玉山-城中', type: '神秘', isMystery: true, isDayTrade: false, region: '台北市中正區' },
  { id: 'merrill', name: '美林', type: '外資', isMystery: true, isDayTrade: false, region: '台北市信義區' },
  { id: 'morgan-stanley', name: '台灣摩根士丹利', type: '外資', isMystery: true, isDayTrade: false, region: '台北市信義區' },
  { id: 'jp-morgan', name: '摩根大通', type: '外資', isMystery: true, isDayTrade: false, region: '台北市信義區' },
  { id: 'yuanta-main', name: '元大', type: '本土龍頭', isMystery: true, isDayTrade: false, region: '台北市中山區' },
  { id: 'kgi-main', name: '凱基', type: '本土主力', isMystery: true, isDayTrade: false, region: '台北市中山區' },
  { id: 'kgi-taipei', name: '凱基-台北', type: '隔日沖主力', isMystery: true, isDayTrade: true, region: '台北市中山區' },
  { id: 'ubs', name: '新加坡商瑞銀', type: '外資', isMystery: true, isDayTrade: false, region: '台北市信義區' },
  { id: 'capital-zhongshan', name: '群益金鼎-中山', type: '神秘', isMystery: true, isDayTrade: false, region: '台北市中山區' },
  { id: 'fubon-main', name: '富邦', type: '本土主力', isMystery: true, isDayTrade: false, region: '台北市大安區' },
  { id: 'sinopac', name: '永豐金', type: '本土主力', isMystery: false, isDayTrade: false, region: '台北市中正區' },
  { id: 'oriental', name: '亞東', type: '集團券商', isMystery: false, isDayTrade: false, region: '新北市板橋區' },
  { id: 'goldman', name: '美商高盛', type: '外資', isMystery: false, isDayTrade: false, region: '台北市信義區' },
  { id: 'jihsun', name: '日盛', type: '本土分點', isMystery: false, isDayTrade: false, region: '台北市中山區' },
  { id: 'sinopac-banqiao', name: '永豐金-板橋', type: '地緣分點', isMystery: false, isDayTrade: false, region: '新北市板橋區' },
  { id: 'fubon-jianguo', name: '富邦-建國', type: '隔日沖主力', isMystery: false, isDayTrade: true, region: '台北市大安區' },
  { id: 'yuanta-chengbei', name: '元大-城北', type: '波段主力', isMystery: true, isDayTrade: false, region: '台北市大同區' },
  { id: 'kgi-hsinchu', name: '凱基-新竹', type: '竹科地緣', isMystery: false, isDayTrade: true, region: '新竹市東區' },
  { id: 'yuanta-taichung', name: '元大-台中', type: '中台灣地緣', isMystery: true, isDayTrade: false, region: '台中市西屯區' },
  { id: 'mega-main', name: '兆豐', type: '官股行庫', isMystery: false, isDayTrade: false, region: '台北市中正區', isGov: true },
  { id: 'bot-main', name: '臺銀', type: '官股行庫', isMystery: false, isDayTrade: false, region: '台北市中正區', isGov: true },
  { id: 'first-main', name: '第一金', type: '官股行庫', isMystery: false, isDayTrade: false, region: '台北市中正區', isGov: true },
  { id: 'huanan', name: '華南永昌', type: '官股行庫', isMystery: false, isDayTrade: false, region: '台北市松山區', isGov: true },
  { id: 'macquarie', name: '香港商麥格理', type: '外資', isMystery: false, isDayTrade: false, region: '台北市信義區' },
  { id: 'nomura', name: '台灣野村', type: '外資', isMystery: false, isDayTrade: false, region: '台北市信義區' },
  { id: 'fubon-hsinchu', name: '富邦-新竹', type: '竹科地緣', isMystery: true, isDayTrade: false, region: '新竹市東區' }
];

// 欄位介紹與公式說明
export const FORMULA_DEFINITIONS = [
  {
    key: 'bias',
    title: '乖年【乖離年線】、乖季【乖離季線】、乖月【乖離月線】',
    formula: '(股價 - 均線價格) / 均線價格 × 100%',
    description: '舉例：年線 100，股價 90，乖年 = -10。正乖離過大代表短線漲多易拉回；負乖離過大且主力轉買代表低檔反彈契機。'
  },
  {
    key: 'highLowDist',
    title: '離高 / 離低',
    formula: '離高 = 股價 / 近一年最高價 (折數)；離低 = 股價 / 近一年最低價 (倍數)',
    description: '離高：離一年來高點打幾折（如 8.5 折）；離低：離一年來最低點是幾倍（如 1.6 倍），快速判斷股價在年度區間的位階。'
  },
  {
    key: 'yoyMom',
    title: 'YOY / MOM / 維持率',
    formula: 'YOY = 年營收成長率(%)；MOM = 月營收成長率(%)；維持率 = 擔保品市值 / 融資金額 × 100%',
    description: '維持率低於 130%，融資率過高者容易引發斷頭多殺多；若維持率落底伴隨主力低接則為洗盤訊號。'
  },
  {
    key: 'pbRatio',
    title: '股淨比 (P/B Ratio)',
    formula: '股價 / 每股淨值 (BPS)',
    description: '股價淨值比，低於 0.5 且公司派分點大買，容易是長線大底部低點！'
  },
  {
    key: 'yield',
    title: '殖利率 / 連續年',
    formula: '殖利率 = (現金股利 + 股票股利) × 100 / 股價',
    description: '連續年：連續配發現金股利年數。高殖利率搭配長天期連續配息代表現金流穩健。'
  },
  {
    key: 'main1',
    title: '主 1（當日主力集中度）',
    formula: '((今日買超前15名總量) - (今日賣超前15名總量)) / (當天成交量) × 100',
    description: '衡量單日主力大戶買盤集中程度。主 1 > 15% 代表當日買盤高度鎖定在少數主力分點手中。'
  },
  {
    key: 'main5',
    title: '主 5（五日區間主力集中度）',
    formula: '((五日區間買超的總量) - (五日區間賣超的賣量)) / (五日成交量) × 100',
    description: '衡量一週內波段主力吃貨或出貨力道，能過濾單日隔日沖雜訊。'
  },
  {
    key: 'main10',
    title: '主 10（十日區間主力集中度）',
    formula: '((十日區間買超的總量) - (十日區間賣超的賣量)) / (十日成交量) × 100',
    description: '衡量兩週雙週期的主力沉澱度。當 主1、主5、主10 同為紅字且遞增，代表主力波段鎖碼。'
  }
];

// 根據序列計算「第1天轉買、5天內偏買、10天內偏買、近期20天偏買、第1天轉賣、5天偏賣、10天偏賣」
export function analyzeSeriesMomentum(series = []) {
  const len = series.length;
  if (len === 0) {
    return {
      recent10: [],
      today: 0,
      net5: 0,
      net10: 0,
      net20: 0,
      buyDays5: 0,
      buyDays10: 0,
      buyDays20: 0,
      sellDays5: 0,
      sellDays10: 0,
      isDay1Buy: false,
      is5DBuy: false,
      is10DBuy: false,
      is20DBuy: false,
      isDay1Sell: false,
      is5DSell: false,
      is10DSell: false,
      tag: '盤整',
      tagType: 'neutral'
    };
  }

  const recent10 = series.slice(-10);
  const recent5 = series.slice(-5);
  const recent20 = series.slice(-20);

  const today = series[len - 1] || 0;
  const prev1 = len >= 2 ? series[len - 2] : 0;
  const prev2 = len >= 3 ? series[len - 3] : 0;
  const prev3 = len >= 4 ? series[len - 4] : 0;

  const net5 = recent5.reduce((s, v) => s + v, 0);
  const net10 = recent10.reduce((s, v) => s + v, 0);
  const net20 = recent20.reduce((s, v) => s + v, 0);

  const buyDays5 = recent5.filter(v => v > 0).length;
  const sellDays5 = recent5.filter(v => v < 0).length;
  const buyDays10 = recent10.filter(v => v > 0).length;
  const sellDays10 = recent10.filter(v => v < 0).length;
  const buyDays20 = recent20.filter(v => v > 0).length;

  // 第一天轉買：昨天 <= 0，且前 3 天至少 2 天 <= 0，今天正式 > 0
  const prevSellCount = [prev1, prev2, prev3].filter(v => v <= 0).length;
  const isDay1Buy = today > 0 && prev1 <= 0 && prevSellCount >= 2;

  // 第一天轉賣：昨天 >= 0，且前 3 天至少 2 天 >= 0，今天正式 < 0
  const prevBuyCount = [prev1, prev2, prev3].filter(v => v >= 0).length;
  const isDay1Sell = today < 0 && prev1 >= 0 && prevBuyCount >= 2;

  const is5DBuy = buyDays5 >= 3 && net5 > 0;
  const is10DBuy = buyDays10 >= 6 && net10 > 0;
  const is20DBuy = buyDays20 >= 11 && net20 > 0;

  const is5DSell = sellDays5 >= 3 && net5 < 0;
  const is10DSell = sellDays10 >= 6 && net10 < 0;

  let tag = '區間震盪';
  let tagType = 'neutral';
  if (isDay1Buy) {
    tag = '🔥第1天轉買';
    tagType = 'day1-buy';
  } else if (is5DBuy && is10DBuy) {
    tag = '🚀5/10日強買';
    tagType = 'strong-buy';
  } else if (is5DBuy) {
    tag = '📈5天內偏買';
    tagType = 'buy-5d';
  } else if (is10DBuy) {
    tag = '📈10天內偏買';
    tagType = 'buy-10d';
  } else if (is20DBuy) {
    tag = '💎近期偏買';
    tagType = 'buy-20d';
  } else if (isDay1Sell) {
    tag = '⚠️第1天轉賣';
    tagType = 'day1-sell';
  } else if (is5DSell && is10DSell) {
    tag = '📉5/10日偏賣';
    tagType = 'sell-10d';
  } else if (is5DSell) {
    tag = '📉5天內偏賣';
    tagType = 'sell-5d';
  }

  return {
    recent10,
    today,
    net5,
    net10,
    net20,
    buyDays5,
    buyDays10,
    buyDays20,
    sellDays5,
    sellDays10,
    isDay1Buy,
    is5DBuy,
    is10DBuy,
    is20DBuy,
    isDay1Sell,
    is5DSell,
    is10DSell,
    tag,
    tagType
  };
}

export function computeStockMomentum(kline = []) {
  const mainMom = analyzeSeriesMomentum(kline.map(d => d.mainNet || 0));
  const trustMom = analyzeSeriesMomentum(kline.map(d => d.trustNet || 0));
  const foreignMom = analyzeSeriesMomentum(kline.map(d => d.foreignNet || 0));
  return {
    main: mainMom,
    trust: trustMom,
    foreign: foreignMom
  };
}

// 擴充預設個股清單至 36 檔各產業熱門代表股
const BASE_STOCKS = [
  { code: '2049', name: '上銀', market: '上市', industry: '傳產-電機', price: 403.5, change: -12.0, changePct: -2.89, candleType: 'black-body', inCount: 2, inVol: 48, outCount: 0, outVol: 0, volume: 3132, warrantAmt: 1420, monthSlope: -0.1, lastWeekSlope: 0.2, nextWeekSlope: -0.3, bandWidth: 11, bandPos: 3, mainConsec: -2, foreignConsec: 1, trustConsec: 2, main1: -30, main5: -8, main10: -4, foreignPct: 48.1, trustPct: 2.4, dealerPct: 0.8, dayTradePct: 31, marginPct: 12, shortPct: 0.43, shortMarginRatio: 3.6, biasYear: 14, biasQuarter: 3.2, biasMonth: -3.5, fromHigh: 8.6, fromLow: 1.85, maintRatio: 158, cumRevYoY: 69.75, revYoY: 53.21, revMoM: -5.07, epsQ: 1.78, eps4Q: 5.83, pe: 34.4, pb: 4.87, dividendYield: 0.53, divYears: 12, roe: 7.0, targetPrice: 525, capitalShares: 327000, treasuryPeriod: [22, 42] },
  { code: '2227', name: '裕日車', market: '上市', industry: '傳產-汽車', price: 274.5, change: 9.0, changePct: 3.4, candleType: 'red-high', inCount: 1, inVol: 16, outCount: 0, outVol: 0, volume: 707, warrantAmt: 310, monthSlope: 0.3, lastWeekSlope: 1.3, nextWeekSlope: -0.8, bandWidth: 9, bandPos: 12, mainConsec: 1, foreignConsec: 1, trustConsec: 1, main1: 30, main5: 18, main10: 13, foreignPct: 2, trustPct: 36, dealerPct: 0, dayTradePct: 0, marginPct: 0, shortPct: 0, shortMarginRatio: 0, biasYear: 7, biasQuarter: 4.5, biasMonth: 2.8, fromHigh: 9.2, fromLow: 1.28, maintRatio: 168, cumRevYoY: 18.4, revYoY: 22.1, revMoM: 6.4, epsQ: 4.12, eps4Q: 15.6, pe: 17.6, pb: 3.82, dividendYield: 5.8, divYears: 15, roe: 21.4, targetPrice: 315, capitalShares: 300000 },
  { code: '1536', name: '和大', market: '上市', industry: '傳產-汽車零組件', price: 114.0, change: 0.0, changePct: 0.0, candleType: 'doji-bottom', inCount: 1, inVol: 149, outCount: 0, outVol: 0, volume: 3321, warrantAmt: 890, monthSlope: 0.0, lastWeekSlope: -0.2, nextWeekSlope: 0.1, bandWidth: 11, bandPos: 5, mainConsec: 3, foreignConsec: -1, trustConsec: 2, main1: 21, main5: 7, main10: 3, foreignPct: -3, trustPct: 36, dealerPct: 1, dayTradePct: 22, marginPct: -13, shortPct: 0, shortMarginRatio: 2.8, biasYear: 13, biasQuarter: 5.1, biasMonth: 1.2, fromHigh: 8.8, fromLow: 1.45, maintRatio: 154, cumRevYoY: 24.5, revYoY: 28.0, revMoM: 3.1, epsQ: 0.85, eps4Q: 2.95, pe: 38.6, pb: 2.65, dividendYield: 2.1, divYears: 14, roe: 9.2, targetPrice: 138, capitalShares: 279000 },
  { code: '6230', name: '尼得科超眾', market: '上市', industry: '電子中游-散熱模組', price: 224.0, change: 4.0, changePct: 1.8, candleType: 'red-cross', inCount: 1, inVol: 14, outCount: 0, outVol: 0, volume: 467, warrantAmt: 260, monthSlope: 0.1, lastWeekSlope: 0.3, nextWeekSlope: -0.2, bandWidth: 10, bandPos: 8, mainConsec: 3, foreignConsec: 3, trustConsec: 2, main1: 24, main5: 32, main10: 26, foreignPct: 6, trustPct: 22, dealerPct: 4, dayTradePct: 16, marginPct: -2, shortPct: 0, shortMarginRatio: 0.2, biasYear: 7, biasQuarter: 4.2, biasMonth: 2.1, fromHigh: 8.4, fromLow: 1.38, maintRatio: 165, cumRevYoY: 31.2, revYoY: 35.8, revMoM: 8.2, epsQ: 2.45, eps4Q: 8.9, pe: 25.2, pb: 4.12, dividendYield: 1.9, divYears: 10, roe: 16.5, targetPrice: 265, capitalShares: 86300 },
  { code: '1590', name: '亞德客-KY', market: '上市', industry: '傳產-電機', price: 966.0, change: 16.0, changePct: 1.7, candleType: 'red-full', inCount: 1, inVol: 34, outCount: 0, outVol: 0, volume: 386, warrantAmt: 1850, monthSlope: -0.1, lastWeekSlope: -1.0, nextWeekSlope: 0.3, bandWidth: 12, bandPos: -1, mainConsec: 1, foreignConsec: 1, trustConsec: 1, main1: 19, main5: 1, main10: 1, foreignPct: 0, trustPct: 16, dealerPct: 0, dayTradePct: 29, marginPct: 3, shortPct: 0, shortMarginRatio: 0, biasYear: 33, biasQuarter: 8.4, biasMonth: 0.9, fromHigh: 9.1, fromLow: 2.15, maintRatio: 172, cumRevYoY: 42.1, revYoY: 46.5, revMoM: 11.2, epsQ: 8.15, eps4Q: 29.8, pe: 32.4, pb: 6.45, dividendYield: 1.2, divYears: 11, roe: 22.8, targetPrice: 1150, capitalShares: 200000 },
  { code: '6510', name: '精測', market: '上櫃', industry: '電子上游-IC-封測', price: 910.0, change: 8.0, changePct: 0.9, candleType: 'red-t', inCount: 0, inVol: 0, outCount: 1, outVol: 42, volume: 347, warrantAmt: 1230, monthSlope: 0.0, lastWeekSlope: 0.4, nextWeekSlope: -0.2, bandWidth: 12, bandPos: 8, mainConsec: 3, foreignConsec: -1, trustConsec: 2, main1: 12, main5: 14, main10: 16, foreignPct: -1, trustPct: 14, dealerPct: -7, dayTradePct: 71, marginPct: -15, shortPct: 2, shortMarginRatio: 6.8, biasYear: 20, biasQuarter: 6.5, biasMonth: 3.1, fromHigh: 8.9, fromLow: 1.72, maintRatio: 161, cumRevYoY: 19.8, revYoY: 24.3, revMoM: 4.5, epsQ: 6.8, eps4Q: 25.4, pe: 35.8, pb: 4.95, dividendYield: 1.5, divYears: 9, roe: 15.9, targetPrice: 1050, capitalShares: 32800 },
  { code: '3529', name: '力旺', market: '上櫃', industry: '電子上游-IC-設計', price: 861.0, change: 13.0, changePct: 1.5, candleType: 'red-full', inCount: 1, inVol: 60, outCount: 0, outVol: 0, volume: 745, warrantAmt: 2190, monthSlope: 0.0, lastWeekSlope: 0.1, nextWeekSlope: -0.1, bandWidth: 15, bandPos: 7, mainConsec: 4, foreignConsec: -2, trustConsec: 15, main1: 11, main5: 4, main10: 3, foreignPct: -2, trustPct: 14, dealerPct: 2, dayTradePct: 82, marginPct: -2, shortPct: 0, shortMarginRatio: 12.2, biasYear: 58, biasQuarter: 18.2, biasMonth: 5.4, fromHigh: 9.4, fromLow: 2.65, maintRatio: 175, cumRevYoY: 36.4, revYoY: 41.2, revMoM: 14.8, epsQ: 3.92, eps4Q: 14.2, pe: 60.6, pb: 24.5, dividendYield: 1.1, divYears: 10, roe: 39.2, targetPrice: 980, capitalShares: 74600 },
  { code: '3702', name: '大聯大', market: '上市', industry: '電子上游-IC-通路', price: 47.8, change: -0.05, changePct: -0.1, candleType: 'red-cross', inCount: 1, inVol: 442, outCount: 0, outVol: 0, volume: 2879, warrantAmt: 420, monthSlope: 0.3, lastWeekSlope: 0.4, nextWeekSlope: 0.2, bandWidth: 10, bandPos: 7, mainConsec: 3, foreignConsec: -4, trustConsec: 5, main1: 15, main5: 5, main10: 9, foreignPct: -24, trustPct: 13, dealerPct: -2, dayTradePct: 7, marginPct: -1, shortPct: 0, shortMarginRatio: 0.7, biasYear: 17, biasQuarter: 6.2, biasMonth: 2.4, fromHigh: 9.5, fromLow: 1.32, maintRatio: 169, cumRevYoY: 28.9, revYoY: 33.4, revMoM: 5.9, epsQ: 1.42, eps4Q: 5.18, pe: 9.2, pb: 1.24, dividendYield: 6.4, divYears: 16, roe: 14.1, targetPrice: 56, capitalShares: 1679000 },
  { code: '9914', name: '美利達', market: '上市', industry: '傳產-自行車', price: 311.0, change: 5.5, changePct: 1.8, candleType: 'red-high', inCount: 0, inVol: 0, outCount: 1, outVol: 32, volume: 567, warrantAmt: 680, monthSlope: 0.4, lastWeekSlope: 0.4, nextWeekSlope: 0.0, bandWidth: 22, bandPos: 4, mainConsec: 1, foreignConsec: 3, trustConsec: 1, main1: 24, main5: 2, main10: 11, foreignPct: 17, trustPct: 11, dealerPct: 6, dayTradePct: 19, marginPct: 1, shortPct: 0, shortMarginRatio: 17.7, biasYear: 34, biasQuarter: 11.4, biasMonth: 4.1, fromHigh: 9.6, fromLow: 1.95, maintRatio: 171, cumRevYoY: 21.3, revYoY: 25.7, revMoM: 7.2, epsQ: 3.65, eps4Q: 13.4, pe: 23.2, pb: 5.15, dividendYield: 2.9, divYears: 18, roe: 23.5, targetPrice: 360, capitalShares: 299000 },
  { code: '2301', name: '光寶科', market: '上市', industry: '電子中游-EMS', price: 61.6, change: 0.0, changePct: 0.0, candleType: 'red-t', inCount: 0, inVol: 0, outCount: 1, outVol: 1008, volume: 3632, warrantAmt: 950, monthSlope: 0.1, lastWeekSlope: 0.3, nextWeekSlope: -0.1, bandWidth: 10, bandPos: 6, mainConsec: 3, foreignConsec: 2, trustConsec: 5, main1: 16, main5: 10, main10: 10, foreignPct: 6, trustPct: 10, dealerPct: 1, dayTradePct: 10, marginPct: -3, shortPct: 0, shortMarginRatio: 1.7, biasYear: 25, biasQuarter: 7.8, biasMonth: 2.9, fromHigh: 9.3, fromLow: 1.48, maintRatio: 166, cumRevYoY: 14.2, revYoY: 18.6, revMoM: 4.1, epsQ: 1.18, eps4Q: 4.35, pe: 14.2, pb: 1.92, dividendYield: 5.5, divYears: 20, roe: 13.8, targetPrice: 72, capitalShares: 2350000 },
  { code: '1477', name: '聚陽', market: '上市', industry: '傳產-紡織纖維', price: 236.5, change: 11.0, changePct: 4.9, candleType: 'red-full', inCount: 1, inVol: 221, outCount: 0, outVol: 0, volume: 6733, warrantAmt: 1640, monthSlope: 0.5, lastWeekSlope: 1.8, nextWeekSlope: -0.6, bandWidth: 21, bandPos: 10, mainConsec: 3, foreignConsec: 3, trustConsec: 5, main1: 22, main5: 18, main10: 12, foreignPct: 12, trustPct: 7, dealerPct: 0, dayTradePct: 5, marginPct: 2, shortPct: 1, shortMarginRatio: 9.9, biasYear: 35, biasQuarter: 14.2, biasMonth: 6.8, fromHigh: 9.8, fromLow: 1.88, maintRatio: 174, cumRevYoY: 26.8, revYoY: 31.5, revMoM: 9.4, epsQ: 3.12, eps4Q: 11.2, pe: 21.1, pb: 4.65, dividendYield: 4.2, divYears: 17, roe: 22.1, targetPrice: 275, capitalShares: 241000 },
  { code: '2330', name: '台積電', market: '上市', industry: '電子上游-IC-代工', price: 598.0, change: 9.0, changePct: 1.53, candleType: 'red-full', inCount: 0, inVol: 0, outCount: 2, outVol: 685, volume: 28450, warrantAmt: 15800, monthSlope: 0.4, lastWeekSlope: 0.9, nextWeekSlope: 0.3, bandWidth: 14, bandPos: 9, mainConsec: 4, foreignConsec: 4, trustConsec: 8, main1: 27, main5: 22, main10: 19, foreignPct: 74, trustPct: 18, dealerPct: 3, dayTradePct: 14, marginPct: 1, shortPct: 0, shortMarginRatio: 1.8, biasYear: 28, biasQuarter: 9.6, biasMonth: 3.8, fromHigh: 9.4, fromLow: 1.62, maintRatio: 179, cumRevYoY: 33.4, revYoY: 38.2, revMoM: 10.5, epsQ: 6.1, eps4Q: 22.8, pe: 26.2, pb: 6.8, dividendYield: 1.9, divYears: 19, roe: 28.4, targetPrice: 680, capitalShares: 25930000 },
  { code: '2454', name: '聯發科', market: '上市', industry: '電子上游-IC-設計', price: 942.0, change: 24.0, changePct: 2.61, candleType: 'red-full', inCount: 0, inVol: 0, outCount: 1, outVol: 186, volume: 6840, warrantAmt: 8920, monthSlope: 0.6, lastWeekSlope: 1.5, nextWeekSlope: 0.4, bandWidth: 23, bandPos: 11, mainConsec: 5, foreignConsec: 3, trustConsec: 7, main1: 29, main5: 24, main10: 21, foreignPct: 62, trustPct: 21, dealerPct: 4, dayTradePct: 26, marginPct: 4, shortPct: 1, shortMarginRatio: 4.5, biasYear: 36, biasQuarter: 12.8, biasMonth: 5.9, fromHigh: 9.7, fromLow: 1.92, maintRatio: 176, cumRevYoY: 48.2, revYoY: 54.6, revMoM: 12.1, epsQ: 11.5, eps4Q: 41.2, pe: 22.9, pb: 4.1, dividendYield: 4.8, divYears: 15, roe: 19.6, targetPrice: 1120, capitalShares: 1590000 },
  { code: '2603', name: '長榮', market: '上市', industry: '傳產-航運', price: 146.5, change: 6.5, changePct: 4.64, candleType: 'red-full', inCount: 0, inVol: 0, outCount: 3, outVol: 1540, volume: 89420, warrantAmt: 7650, monthSlope: 0.8, lastWeekSlope: 2.1, nextWeekSlope: 0.9, bandWidth: 25, bandPos: 12, mainConsec: 6, foreignConsec: 5, trustConsec: 4, main1: 31, main5: 25, main10: 20, foreignPct: 31, trustPct: 14, dealerPct: 5, dayTradePct: 48, marginPct: 8, shortPct: 3, shortMarginRatio: 8.4, biasYear: 44, biasQuarter: 16.5, biasMonth: 8.2, fromHigh: 9.6, fromLow: 2.4, maintRatio: 168, cumRevYoY: 85.4, revYoY: 96.2, revMoM: 18.4, epsQ: 7.8, eps4Q: 24.5, pe: 6.0, pb: 0.46, dividendYield: 7.2, divYears: 5, roe: 34.2, targetPrice: 185, capitalShares: 2116000 },
  { code: '1314', name: '中石化', market: '上市', industry: '傳產-塑膠', price: 11.25, change: 0.35, changePct: 3.21, candleType: 'red-high', inCount: 0, inVol: 0, outCount: 2, outVol: 820, volume: 42150, warrantAmt: 320, monthSlope: 0.2, lastWeekSlope: 0.7, nextWeekSlope: 0.3, bandWidth: 9, bandPos: 10, mainConsec: 4, foreignConsec: 2, trustConsec: 1, main1: 23, main5: 19, main10: 15, foreignPct: 12, trustPct: 3, dealerPct: 2, dayTradePct: 18, marginPct: 5, shortPct: 1, shortMarginRatio: 3.1, biasYear: 6, biasQuarter: 4.1, biasMonth: 2.5, fromHigh: 8.2, fromLow: 1.22, maintRatio: 162, cumRevYoY: 22.6, revYoY: 29.4, revMoM: 6.8, epsQ: 0.32, eps4Q: 1.05, pe: 10.7, pb: 0.42, dividendYield: 4.5, divYears: 6, roe: 6.8, targetPrice: 14.5, capitalShares: 3780000 },
  { code: '2409', name: '友達', market: '上市', industry: '電子中游-光電', price: 17.85, change: -0.65, changePct: -3.51, candleType: 'black-body', inCount: 3, inVol: 960, outCount: 0, outVol: 0, volume: 65300, warrantAmt: 1120, monthSlope: -0.4, lastWeekSlope: -1.1, nextWeekSlope: -0.5, bandWidth: 16, bandPos: -2, mainConsec: -4, foreignConsec: -3, trustConsec: -2, main1: -22, main5: -16, main10: -11, foreignPct: -18, trustPct: -6, dealerPct: -4, dayTradePct: 34, marginPct: 28, shortPct: 1, shortMarginRatio: 2.1, biasYear: -12, biasQuarter: -8.4, biasMonth: -6.2, fromHigh: 6.8, fromLow: 1.08, maintRatio: 126, cumRevYoY: -4.2, revYoY: -8.5, revMoM: -3.4, epsQ: -0.25, eps4Q: 0.45, pe: 39.6, pb: 0.78, dividendYield: 2.8, divYears: 4, roe: 3.1, targetPrice: 20.0, capitalShares: 9620000 },
  // 擴充熱門 AI 伺服器、散熱、IC 設計、重電、航運、金融代表股
  { code: '2317', name: '鴻海', market: '上市', industry: '電子中游-EMS', price: 212.0, change: 4.5, changePct: 2.17, candleType: 'red-full', inCount: 0, inVol: 0, outCount: 3, outVol: 1420, volume: 78500, warrantAmt: 9400, monthSlope: 0.5, lastWeekSlope: 1.2, nextWeekSlope: 0.4, bandWidth: 16, bandPos: 9, mainConsec: 1, foreignConsec: 1, trustConsec: 4, main1: 18, main5: 14, main10: 12, foreignPct: 42, trustPct: 8, dealerPct: 2, dayTradePct: 21, marginPct: 3, shortPct: 1, shortMarginRatio: 2.4, biasYear: 32, biasQuarter: 11.2, biasMonth: 4.5, fromHigh: 9.5, fromLow: 1.98, maintRatio: 174, cumRevYoY: 19.5, revYoY: 22.8, revMoM: 6.2, epsQ: 3.15, eps4Q: 11.4, pe: 18.6, pb: 1.85, dividendYield: 2.6, divYears: 25, roe: 11.2, targetPrice: 250, capitalShares: 13860000 },
  { code: '2382', name: '廣達', market: '上市', industry: '電子下游-AI伺服器', price: 315.0, change: 7.0, changePct: 2.27, candleType: 'red-high', inCount: 0, inVol: 0, outCount: 2, outVol: 620, volume: 34200, warrantAmt: 6100, monthSlope: 0.6, lastWeekSlope: 1.4, nextWeekSlope: 0.5, bandWidth: 18, bandPos: 10, mainConsec: 5, foreignConsec: 4, trustConsec: 6, main1: 25, main5: 20, main10: 17, foreignPct: 28, trustPct: 11, dealerPct: 3, dayTradePct: 29, marginPct: 2, shortPct: 1, shortMarginRatio: 3.8, biasYear: 38, biasQuarter: 13.5, biasMonth: 5.2, fromHigh: 9.4, fromLow: 2.1, maintRatio: 176, cumRevYoY: 45.2, revYoY: 58.4, revMoM: 9.8, epsQ: 3.85, eps4Q: 13.6, pe: 23.1, pb: 6.2, dividendYield: 3.1, divYears: 22, roe: 26.8, targetPrice: 365, capitalShares: 3860000 },
  { code: '3231', name: '緯創', market: '上市', industry: '電子下游-AI伺服器', price: 118.5, change: 3.5, changePct: 3.04, candleType: 'red-full', inCount: 0, inVol: 0, outCount: 2, outVol: 890, volume: 64100, warrantAmt: 5200, monthSlope: 0.4, lastWeekSlope: 1.1, nextWeekSlope: 0.3, bandWidth: 14, bandPos: 9, mainConsec: 1, foreignConsec: 1, trustConsec: 3, main1: 22, main5: 15, main10: 9, foreignPct: 26, trustPct: 9, dealerPct: 2, dayTradePct: 38, marginPct: 4, shortPct: 1, shortMarginRatio: 4.1, biasYear: 18, biasQuarter: 8.4, biasMonth: 4.1, fromHigh: 8.9, fromLow: 1.56, maintRatio: 168, cumRevYoY: 22.1, revYoY: 27.5, revMoM: 5.4, epsQ: 1.55, eps4Q: 5.8, pe: 20.4, pb: 2.85, dividendYield: 2.5, divYears: 18, roe: 14.5, targetPrice: 145, capitalShares: 2890000 },
  { code: '6669', name: '緯穎', market: '上市', industry: '電子下游-AI伺服器', price: 2180.0, change: 55.0, changePct: 2.59, candleType: 'red-full', inCount: 0, inVol: 0, outCount: 1, outVol: 85, volume: 2150, warrantAmt: 4800, monthSlope: 0.7, lastWeekSlope: 1.6, nextWeekSlope: 0.5, bandWidth: 19, bandPos: 10, mainConsec: 4, foreignConsec: 3, trustConsec: 5, main1: 28, main5: 21, main10: 18, foreignPct: 45, trustPct: 15, dealerPct: 2, dayTradePct: 32, marginPct: 1, shortPct: 0, shortMarginRatio: 2.9, biasYear: 42, biasQuarter: 14.8, biasMonth: 6.4, fromHigh: 9.1, fromLow: 2.05, maintRatio: 181, cumRevYoY: 64.2, revYoY: 78.5, revMoM: 12.6, epsQ: 32.5, eps4Q: 112.0, pe: 19.5, pb: 8.4, dividendYield: 2.3, divYears: 7, roe: 38.6, targetPrice: 2600, capitalShares: 174800 },
  { code: '3017', name: '奇鋐', market: '上市', industry: '電子中游-散熱模組', price: 658.0, change: 18.0, changePct: 2.81, candleType: 'red-full', inCount: 0, inVol: 0, outCount: 2, outVol: 340, volume: 12400, warrantAmt: 5600, monthSlope: 0.5, lastWeekSlope: 1.3, nextWeekSlope: 0.4, bandWidth: 17, bandPos: 9, mainConsec: 1, foreignConsec: 2, trustConsec: 4, main1: 20, main5: 16, main10: 14, foreignPct: 38, trustPct: 16, dealerPct: 3, dayTradePct: 44, marginPct: 3, shortPct: 1, shortMarginRatio: 5.2, biasYear: 35, biasQuarter: 11.6, biasMonth: 4.8, fromHigh: 9.0, fromLow: 2.2, maintRatio: 172, cumRevYoY: 28.4, revYoY: 34.1, revMoM: 7.5, epsQ: 5.4, eps4Q: 19.8, pe: 33.2, pb: 9.1, dividendYield: 1.4, divYears: 15, roe: 29.4, targetPrice: 780, capitalShares: 383000 },
  { code: '3324', name: '雙鴻', market: '上櫃', industry: '電子中游-散熱模組', price: 692.0, change: -14.0, changePct: -1.98, candleType: 'black-body', inCount: 2, inVol: 180, outCount: 0, outVol: 0, volume: 5840, warrantAmt: 3400, monthSlope: -0.2, lastWeekSlope: -0.6, nextWeekSlope: -0.2, bandWidth: 16, bandPos: 3, mainConsec: -1, foreignConsec: -2, trustConsec: 1, main1: -14, main5: -6, main10: 4, foreignPct: 18, trustPct: 12, dealerPct: -2, dayTradePct: 52, marginPct: 6, shortPct: 1, shortMarginRatio: 4.8, biasYear: 19, biasQuarter: -2.1, biasMonth: -4.2, fromHigh: 7.8, fromLow: 1.85, maintRatio: 156, cumRevYoY: 26.8, revYoY: 31.2, revMoM: 2.4, epsQ: 5.1, eps4Q: 18.6, pe: 37.2, pb: 7.8, dividendYield: 1.3, divYears: 12, roe: 24.5, targetPrice: 820, capitalShares: 89600 },
  { code: '3034', name: '聯詠', market: '上市', industry: '電子上游-IC-設計', price: 536.0, change: 8.0, changePct: 1.52, candleType: 'red-high', inCount: 0, inVol: 0, outCount: 1, outVol: 145, volume: 4620, warrantAmt: 2100, monthSlope: 0.2, lastWeekSlope: 0.6, nextWeekSlope: 0.2, bandWidth: 11, bandPos: 8, mainConsec: 3, foreignConsec: 2, trustConsec: 6, main1: 17, main5: 13, main10: 11, foreignPct: 54, trustPct: 14, dealerPct: 1, dayTradePct: 19, marginPct: -1, shortPct: 0, shortMarginRatio: 1.9, biasYear: 12, biasQuarter: 5.4, biasMonth: 2.6, fromHigh: 8.8, fromLow: 1.35, maintRatio: 173, cumRevYoY: 12.4, revYoY: 15.8, revMoM: 3.9, epsQ: 8.6, eps4Q: 34.2, pe: 15.7, pb: 4.6, dividendYield: 5.9, divYears: 21, roe: 31.2, targetPrice: 610, capitalShares: 608500 },
  { code: '3661', name: '世芯-KY', market: '上市', industry: '電子上游-IC-設計', price: 2465.0, change: -45.0, changePct: -1.79, candleType: 'black-body', inCount: 2, inVol: 95, outCount: 0, outVol: 0, volume: 3280, warrantAmt: 6800, monthSlope: -0.3, lastWeekSlope: -0.8, nextWeekSlope: -0.4, bandWidth: 21, bandPos: 2, mainConsec: -3, foreignConsec: -2, trustConsec: -1, main1: -18, main5: -12, main10: -9, foreignPct: 64, trustPct: 9, dealerPct: -3, dayTradePct: 49, marginPct: 7, shortPct: 1, shortMarginRatio: 3.4, biasYear: -6, biasQuarter: -5.2, biasMonth: -3.8, fromHigh: 6.4, fromLow: 1.28, maintRatio: 148, cumRevYoY: 58.4, revYoY: 62.1, revMoM: 4.5, epsQ: 19.8, eps4Q: 72.5, pe: 34.0, pb: 7.9, dividendYield: 0.9, divYears: 8, roe: 26.4, targetPrice: 3100, capitalShares: 80600 },
  { code: '2308', name: '台達電', market: '上市', industry: '電子中游-電源管理', price: 398.0, change: 6.5, changePct: 1.66, candleType: 'red-full', inCount: 0, inVol: 0, outCount: 1, outVol: 260, volume: 8920, warrantAmt: 3100, monthSlope: 0.3, lastWeekSlope: 0.8, nextWeekSlope: 0.2, bandWidth: 12, bandPos: 8, mainConsec: 4, foreignConsec: 3, trustConsec: 5, main1: 21, main5: 16, main10: 14, foreignPct: 68, trustPct: 12, dealerPct: 2, dayTradePct: 15, marginPct: 0, shortPct: 0, shortMarginRatio: 1.2, biasYear: 22, biasQuarter: 7.4, biasMonth: 3.1, fromHigh: 9.3, fromLow: 1.48, maintRatio: 178, cumRevYoY: 14.8, revYoY: 18.2, revMoM: 5.1, epsQ: 3.6, eps4Q: 13.8, pe: 28.8, pb: 4.9, dividendYield: 1.8, divYears: 24, roe: 17.6, targetPrice: 450, capitalShares: 2597000 },
  { code: '1519', name: '華城', market: '上市', industry: '傳產-重電綠能', price: 645.0, change: 22.0, changePct: 3.53, candleType: 'red-full', inCount: 0, inVol: 0, outCount: 2, outVol: 410, volume: 9650, warrantAmt: 4200, monthSlope: 0.6, lastWeekSlope: 1.5, nextWeekSlope: 0.5, bandWidth: 18, bandPos: 10, mainConsec: 1, foreignConsec: 1, trustConsec: 2, main1: 19, main5: 11, main10: 8, foreignPct: 19, trustPct: 8, dealerPct: 2, dayTradePct: 54, marginPct: 4, shortPct: 2, shortMarginRatio: 9.6, biasYear: 46, biasQuarter: 12.4, biasMonth: 5.6, fromHigh: 7.6, fromLow: 2.45, maintRatio: 167, cumRevYoY: 56.2, revYoY: 64.8, revMoM: 11.4, epsQ: 4.2, eps4Q: 14.8, pe: 43.6, pb: 14.2, dividendYield: 1.1, divYears: 10, roe: 35.8, targetPrice: 760, capitalShares: 287000 },
  { code: '1513', name: '中興電', market: '上市', industry: '傳產-重電綠能', price: 168.5, change: 4.0, changePct: 2.43, candleType: 'red-high', inCount: 0, inVol: 0, outCount: 1, outVol: 520, volume: 18400, warrantAmt: 2400, monthSlope: 0.3, lastWeekSlope: 0.9, nextWeekSlope: 0.3, bandWidth: 13, bandPos: 8, mainConsec: 2, foreignConsec: 2, trustConsec: 3, main1: 16, main5: 12, main10: 9, foreignPct: 22, trustPct: 9, dealerPct: 1, dayTradePct: 36, marginPct: 2, shortPct: 1, shortMarginRatio: 4.2, biasYear: 24, biasQuarter: 6.8, biasMonth: 3.2, fromHigh: 8.1, fromLow: 1.65, maintRatio: 169, cumRevYoY: 18.9, revYoY: 23.4, revMoM: 6.1, epsQ: 1.95, eps4Q: 7.4, pe: 22.8, pb: 4.8, dividendYield: 2.4, divYears: 11, roe: 21.2, targetPrice: 205, capitalShares: 495000 },
  { code: '2609', name: '陽明', market: '上市', industry: '傳產-航運', price: 72.8, change: 2.1, changePct: 2.97, candleType: 'red-full', inCount: 0, inVol: 0, outCount: 2, outVol: 1180, volume: 58900, warrantAmt: 3200, monthSlope: 0.5, lastWeekSlope: 1.3, nextWeekSlope: 0.4, bandWidth: 16, bandPos: 9, mainConsec: 3, foreignConsec: 3, trustConsec: 2, main1: 21, main5: 15, main10: 12, foreignPct: 24, trustPct: 6, dealerPct: 3, dayTradePct: 41, marginPct: 5, shortPct: 1, shortMarginRatio: 5.6, biasYear: 29, biasQuarter: 10.2, biasMonth: 4.6, fromHigh: 8.9, fromLow: 1.72, maintRatio: 166, cumRevYoY: 62.4, revYoY: 74.1, revMoM: 12.8, epsQ: 3.9, eps4Q: 12.6, pe: 5.8, pb: 0.82, dividendYield: 5.5, divYears: 3, roe: 18.4, targetPrice: 88, capitalShares: 3492000 },
  { code: '3008', name: '大立光', market: '上市', industry: '電子中游-光學鏡頭', price: 2540.0, change: 35.0, changePct: 1.4, candleType: 'red-cross', inCount: 0, inVol: 0, outCount: 1, outVol: 45, volume: 820, warrantAmt: 2900, monthSlope: 0.2, lastWeekSlope: 0.5, nextWeekSlope: 0.1, bandWidth: 11, bandPos: 7, mainConsec: 2, foreignConsec: 1, trustConsec: 3, main1: 18, main5: 14, main10: 11, foreignPct: 39, trustPct: 7, dealerPct: 1, dayTradePct: 22, marginPct: -1, shortPct: 0, shortMarginRatio: 1.4, biasYear: 11, biasQuarter: 4.2, biasMonth: 1.9, fromHigh: 8.4, fromLow: 1.28, maintRatio: 175, cumRevYoY: 24.1, revYoY: 28.6, revMoM: 6.4, epsQ: 42.5, eps4Q: 158.0, pe: 16.1, pb: 2.1, dividendYield: 3.4, divYears: 20, roe: 14.2, targetPrice: 2950, capitalShares: 133400 },
  { code: '2345', name: '智邦', market: '上市', industry: '電子中游-網通設備', price: 562.0, change: 14.0, changePct: 2.55, candleType: 'red-full', inCount: 0, inVol: 0, outCount: 1, outVol: 190, volume: 4120, warrantAmt: 2600, monthSlope: 0.4, lastWeekSlope: 1.1, nextWeekSlope: 0.3, bandWidth: 15, bandPos: 9, mainConsec: 4, foreignConsec: 3, trustConsec: 6, main1: 23, main5: 18, main10: 16, foreignPct: 58, trustPct: 17, dealerPct: 2, dayTradePct: 24, marginPct: 1, shortPct: 0, shortMarginRatio: 2.1, biasYear: 27, biasQuarter: 9.2, biasMonth: 4.1, fromHigh: 9.3, fromLow: 1.58, maintRatio: 177, cumRevYoY: 21.8, revYoY: 29.4, revMoM: 8.2, epsQ: 4.85, eps4Q: 18.2, pe: 30.9, pb: 7.4, dividendYield: 1.8, divYears: 16, roe: 25.6, targetPrice: 650, capitalShares: 560000 }
];

function seededRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function generateStockDataset() {
  const tradingDays = [];
  const baseDate = new Date('2021-03-23T00:00:00');
  let d = new Date(baseDate);
  while (tradingDays.length < 75) {
    const dayOfWeek = d.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      tradingDays.unshift({
        iso: `${yyyy}-${mm}-${dd}`,
        slash: `${yyyy}/${mm}/${dd}`,
        compact: `${yyyy}${mm}${dd}`,
        short: `${mm}/${dd}`
      });
    }
    d.setDate(d.getDate() - 1);
  }

  return BASE_STOCKS.map((stock, stockIdx) => {
    const kline = [];
    const totalDays = tradingDays.length;
    let rawPrices = [100];
    for (let i = 1; i < totalDays; i++) {
      const seed = parseInt(stock.code, 10) * 1000 + i * 37;
      const r = seededRandom(seed) - 0.482;
      const trendBias = stock.code === '2049'
        ? (i < 42 ? 0.008 : i < 55 ? -0.004 : -0.002)
        : (stock.changePct >= 0 ? 0.003 : -0.002);
      const pct = r * 0.038 + trendBias;
      rawPrices.push(rawPrices[i - 1] * (1 + pct));
    }
    const scale = stock.price / rawPrices[totalDays - 1];

    let cumMainNet = stock.code === '2049' ? 6800 : Math.round(stock.volume * 2.2);
    let foreignHold = stock.code === '2049' ? 156200 : Math.round(stock.capitalShares * Math.max(0.08, Math.abs(stock.foreignPct) / 100));
    let trustHold = stock.code === '2049' ? 7400 : Math.round(stock.capitalShares * Math.max(0.03, Math.abs(stock.trustPct) / 100));
    let cumDealer = stock.code === '2049' ? -79 : 120;
    let shortBal = stock.code === '2049' ? 325 : Math.round(stock.volume * 0.25);
    let marginBal = Math.round(stock.volume * 3.5);
    let kVal = 50;
    let dVal = 50;

    for (let i = 0; i < totalDays; i++) {
      const isLast = i === totalDays - 1;
      const seed = parseInt(stock.code, 10) * 2000 + i * 71;
      const close = isLast
        ? stock.price
        : Number((rawPrices[i] * scale).toFixed(stock.price >= 100 ? 1 : 2));
      const prevClose = i === 0
        ? Number((close * 0.99).toFixed(2))
        : kline[i - 1].close;

      let open, high, low;
      if (isLast) {
        const diff = stock.change;
        open = Number((close - diff * 0.65).toFixed(1));
        high = Number((Math.max(open, close) + Math.abs(diff) * 0.45 + 0.5).toFixed(1));
        low = Number((Math.min(open, close) - Math.abs(diff) * 0.35 - 0.5).toFixed(1));
      } else {
        const intraSeed = seededRandom(seed + 3) - 0.5;
        open = Number((prevClose * (1 + intraSeed * 0.015)).toFixed(1));
        const maxOC = Math.max(open, close);
        const minOC = Math.min(open, close);
        high = Number((maxOC * (1 + seededRandom(seed + 7) * 0.018)).toFixed(1));
        low = Number((minOC * (1 - seededRandom(seed + 11) * 0.018)).toFixed(1));
      }

      const dayChange = Number((close - prevClose).toFixed(2));
      const dayChangePct = Number(((dayChange / prevClose) * 100).toFixed(2));
      const vol = isLast
        ? stock.volume
        : Math.max(150, Math.round(stock.volume * (0.55 + seededRandom(seed + 19) * 1.15)));

      let mainNet, foreignNet, trustNet, dealerNet, shortDiff, marginDiff;
      if (isLast && stock.code === '2049') {
        mainNet = -951;
        foreignNet = -486;
        trustNet = 68;
        dealerNet = -18;
        shortDiff = 30;
        marginDiff = 85;
      } else {
        // 針對不同個股塑造清晰的「第一天買、5天偏買、10天偏買、偏賣」形態
        const recentOffset = totalDays - 1 - i;
        let dir = dayChange >= 0 ? 1 : -1;
        if (stock.mainConsec === 1 && recentOffset > 0 && recentOffset <= 3) {
          dir = -1; // 塑造前3日賣超、今日第1天轉買！
        } else if (stock.mainConsec >= 3 && recentOffset <= 9) {
          dir = recentOffset % 4 === 2 ? -0.4 : 1.2; // 5天/10天偏買
        } else if (stock.mainConsec < 0 && recentOffset <= 5) {
          dir = -1.1; // 近期偏賣
        }
        mainNet = isLast
          ? Math.round((stock.main1 / 100) * vol)
          : Math.round(dir * vol * (0.04 + seededRandom(seed + 23) * 0.18));
        foreignNet = Math.round(mainNet * (0.55 + (seededRandom(seed + 31) - 0.4) * 0.5));
        trustNet =
          stock.trustConsec === 1 && recentOffset > 0 && recentOffset <= 3
            ? -Math.abs(Math.round(vol * 0.03))
            : stock.trustConsec >= 2 && recentOffset <= 8
              ? Math.abs(Math.round(vol * 0.04))
              : Math.round(mainNet * (0.28 + (seededRandom(seed + 37) - 0.35) * 0.4));
        dealerNet = Math.round(mainNet * 0.12 * (seededRandom(seed + 41) - 0.45));
        shortDiff = Math.round((seededRandom(seed + 43) - 0.48) * 45);
        marginDiff = Math.round(-mainNet * 0.18 + (seededRandom(seed + 47) - 0.5) * 60);
      }

      cumMainNet += mainNet;
      foreignHold = Math.max(500, foreignHold + foreignNet);
      trustHold = Math.max(100, trustHold + trustNet);
      cumDealer += dealerNet;
      shortBal = Math.max(10, shortBal + shortDiff);
      marginBal = Math.max(200, marginBal + marginDiff);

      const foreignHoldPct = Number(((foreignHold / stock.capitalShares) * 100).toFixed(1));
      const trustHoldPct = Number(((trustHold / stock.capitalShares) * 100).toFixed(1));
      const shortHoldPct = Number(((shortBal / stock.capitalShares) * 100).toFixed(2));

      kline.push({
        index: i,
        date: tradingDays[i].slash,
        compactDate: tradingDays[i].compact,
        shortDate: tradingDays[i].short,
        open,
        high,
        low,
        close,
        change: isLast ? stock.change : dayChange,
        changePct: isLast ? stock.changePct : dayChangePct,
        volume: vol,
        mainNet,
        cumMainNet,
        foreignNet,
        foreignHold,
        foreignHoldPct: isLast && stock.code === '2049' ? 48.1 : foreignHoldPct,
        trustNet,
        trustHold,
        trustHoldPct: isLast && stock.code === '2049' ? 2.4 : trustHoldPct,
        dealerNet,
        cumDealer,
        shortDiff,
        shortBal: isLast && stock.code === '2049' ? 355 : shortBal,
        shortHoldPct: isLast && stock.code === '2049' ? 0.43 : shortHoldPct,
        marginDiff,
        marginBal
      });
    }

    for (let i = 0; i < totalDays; i++) {
      const slice5 = kline.slice(Math.max(0, i - 4), i + 1);
      const slice10 = kline.slice(Math.max(0, i - 9), i + 1);
      const slice20 = kline.slice(Math.max(0, i - 19), i + 1);
      const slice60 = kline.slice(Math.max(0, i - 59), i + 1);

      const ma5 = slice5.reduce((s, d) => s + d.close, 0) / slice5.length;
      const ma10 = slice10.reduce((s, d) => s + d.close, 0) / slice10.length;
      const ma20 = slice20.reduce((s, d) => s + d.close, 0) / slice20.length;
      const ma60 = slice60.reduce((s, d) => s + d.close, 0) / slice60.length;

      const variance = slice20.reduce((s, d) => s + Math.pow(d.close - ma20, 2), 0) / slice20.length;
      const stdDev = Math.sqrt(variance);
      const bollUpper = ma20 + 2 * stdDev;
      const bollLower = ma20 - 2 * stdDev;

      const slice9 = kline.slice(Math.max(0, i - 8), i + 1);
      const high9 = Math.max(...slice9.map(d => d.high));
      const low9 = Math.min(...slice9.map(d => d.low));
      const rsv = high9 === low9 ? 50 : ((kline[i].close - low9) / (high9 - low9)) * 100;
      kVal = (2 / 3) * kVal + (1 / 3) * rsv;
      dVal = (2 / 3) * dVal + (1 / 3) * kVal;

      kline[i].ma5 = Number(ma5.toFixed(2));
      kline[i].ma10 = Number(ma10.toFixed(2));
      kline[i].ma20 = Number(ma20.toFixed(2));
      kline[i].ma60 = Number(ma60.toFixed(2));
      kline[i].bollUpper = Number(bollUpper.toFixed(2));
      kline[i].bollLower = Number(bollLower.toFixed(2));
      kline[i].k = Number(kVal.toFixed(2));
      kline[i].d = Number(dVal.toFixed(2));
    }

    const brokerSeries = {};
    BROKER_LIST.forEach((broker, bIdx) => {
      let cumNet = -200 + Math.round((seededRandom(stockIdx * 99 + bIdx * 13) - 0.5) * 400);
      const daily = kline.map((day, dIdx) => {
        const bSeed = parseInt(stock.code, 10) * 500 + bIdx * 97 + dIdx * 31;
        let buy = Math.max(0, Math.round(seededRandom(bSeed) * (day.volume * 0.045)));
        let sell = Math.max(0, Math.round(seededRandom(bSeed + 5) * (day.volume * 0.045)));

        if (day.mainNet > 0 && bIdx < 10) {
          buy = Math.round(buy * 1.45);
        } else if (day.mainNet < 0 && bIdx >= 10 && bIdx < 20) {
          sell = Math.round(sell * 1.45);
        }

        let avgBuy = Number((day.close * (0.996 + seededRandom(bSeed + 9) * 0.008)).toFixed(2));
        let avgSell = Number((day.close * (0.996 + seededRandom(bSeed + 13) * 0.008)).toFixed(2));
        let profitWan = Math.round(((day.close - avgBuy) * buy + (avgSell - day.close) * sell) * 0.1);

        const net = buy - sell;
        cumNet += net;
        return {
          date: day.date,
          buy,
          sell,
          net,
          vol: buy + sell,
          avgBuy,
          avgSell,
          profitWan,
          cumNet
        };
      });
      brokerSeries[broker.id] = daily;
    });

    const momentum = computeStockMomentum(kline);

    return {
      ...stock,
      kline,
      brokerSeries,
      momentum
    };
  });
}

export function computePeriodChipAnalysis(stock, endIdx, periodDays = 1) {
  const kline = stock.kline;
  const safeEnd = Math.min(Math.max(0, endIdx), kline.length - 1);
  const startIdx = Math.max(0, safeEnd - periodDays + 1);
  const periodSlice = kline.slice(startIdx, safeEnd + 1);

  const startDate = periodSlice[0]?.compactDate || '';
  const endDate = periodSlice[periodSlice.length - 1]?.compactDate || '';
  const periodVol = periodSlice.reduce((s, d) => s + d.volume, 0);

  const isLatestEnd = safeEnd === kline.length - 1;
  const realReport =
    isLatestEnd && stock.realBrokerReports
      ? stock.realBrokerReports[periodDays] || stock.realBrokerReports[1]
      : null;

  if (realReport && realReport.buyers?.length > 0) {
    const topBuyers = realReport.buyers;
    const topSellers = realReport.sellers;
    const allReal = [...topBuyers, ...topSellers];

    const top15BuySum =
      realReport.top15BuySum ||
      topBuyers.slice(0, 15).reduce((s, b) => s + b.net, 0);
    const top15SellSum =
      realReport.top15SellSum ||
      topSellers.slice(0, 15).reduce((s, b) => s + b.net, 0);

    const chipNet = top15BuySum + top15SellSum;
    const chipConcentrationPct =
      periodVol > 0 ? Number(((chipNet / periodVol) * 100).toFixed(2)) : 0;

    const start20 = Math.max(0, safeEnd - 19);
    const vol20 = kline.slice(start20, safeEnd + 1).reduce((s, d) => s + d.volume, 0);
    const main20 = kline.slice(start20, safeEnd + 1).reduce((s, d) => s + d.mainNet, 0);
    const chip20Pct =
      stock.realBrokerReports?.[20] && vol20 > 0
        ? Number(
            (
              ((stock.realBrokerReports[20].top15BuySum +
                stock.realBrokerReports[20].top15SellSum) /
                vol20) *
              100
            ).toFixed(2)
          )
        : vol20 > 0
          ? Number(((main20 / vol20) * 100).toFixed(2))
          : 0;

    const capitalRatioPct = Number(((chipNet / (stock.capitalShares || 300000)) * 100).toFixed(2));
    const turnoverPct = Number(((periodVol / (stock.capitalShares || 300000)) * 100).toFixed(2));

    let directionLabel = '盤整';
    let isBullish = chipNet >= 0;
    if (chipConcentrationPct >= 12) directionLabel = '大買';
    else if (chipConcentrationPct > 0) directionLabel = '小買';
    else if (chipConcentrationPct <= -12) directionLabel = '大賣';
    else directionLabel = '小賣';

    return {
      startDate: realReport.dateRangeStart || startDate,
      endDate: realReport.dateRangeEnd || endDate,
      startIdx,
      endIdx: safeEnd,
      periodVol,
      top15BuySum,
      top15SellSum,
      chipNet,
      chipConcentrationPct,
      chip20Pct,
      capitalRatioPct,
      turnoverPct,
      directionLabel,
      isBullish,
      absChipNet: Math.abs(chipNet),
      mysteryBrokers: topBuyers.slice(0, 15),
      topBuyers: topBuyers.slice(0, 15),
      topSellers: topSellers.slice(0, 15),
      dayTradeBrokers: allReal.filter(b => b.isDayTrade),
      foreignBrokers: allReal.filter(b => b.type === '外資'),
      govBrokers: allReal.filter(b => b.isGov),
      allBrokers: allReal,
      isRealBrokerReport: true,
      brokerSourceLabel: realReport.sourceLabel || '券商分點正式日報表'
    };
  }

  const brokerStats = BROKER_LIST.map(broker => {
    const series = stock.brokerSeries?.[broker.id]?.slice(startIdx, safeEnd + 1) || [];
    let buy = 0;
    let sell = 0;
    let buyCost = 0;
    let sellRev = 0;
    let profitWan = 0;

    series.forEach(item => {
      buy += item.buy;
      sell += item.sell;
      buyCost += item.buy * (item.avgBuy || periodSlice[periodSlice.length - 1]?.close || stock.price);
      sellRev += item.sell * (item.avgSell || periodSlice[periodSlice.length - 1]?.close || stock.price);
      profitWan += item.profitWan;
    });

    const net = buy - sell;
    const vol = buy + sell;
    const avgBuy = buy > 0 ? Number((buyCost / buy).toFixed(2)) : 0;
    const avgSell = sell > 0 ? Number((sellRev / sell).toFixed(2)) : 0;

    return {
      ...broker,
      buy,
      sell,
      net,
      vol,
      avgBuy,
      avgSell,
      profitWan
    };
  });

  const buyersSorted = [...brokerStats].filter(b => b.net > 0).sort((a, b) => b.net - a.net);
  const sellersSorted = [...brokerStats].filter(b => b.net < 0).sort((a, b) => a.net - b.net);
  const mysteryBrokers = [...brokerStats].filter(b => b.isMystery);

  const top15BuySum = buyersSorted.slice(0, 15).reduce((s, b) => s + b.net, 0);
  const top15SellSum = sellersSorted.slice(0, 15).reduce((s, b) => s + b.net, 0);

  const chipNet = top15BuySum + top15SellSum;
  const chipConcentrationPct =
    periodVol > 0 ? Number(((chipNet / periodVol) * 100).toFixed(2)) : 0;

  const start20 = Math.max(0, safeEnd - 19);
  const vol20 = kline.slice(start20, safeEnd + 1).reduce((s, d) => s + d.volume, 0);
  const main20 = kline.slice(start20, safeEnd + 1).reduce((s, d) => s + d.mainNet, 0);
  const chip20Pct = vol20 > 0 ? Number(((main20 / vol20) * 100).toFixed(2)) : 0;

  const capitalRatioPct = Number(((chipNet / stock.capitalShares) * 100).toFixed(2));
  const turnoverPct = Number(((periodVol / stock.capitalShares) * 100).toFixed(2));

  let directionLabel = '盤整';
  let isBullish = chipNet >= 0;
  if (chipConcentrationPct >= 15) directionLabel = '大買';
  else if (chipConcentrationPct > 0) directionLabel = '小買';
  else if (chipConcentrationPct <= -15) directionLabel = '大賣';
  else directionLabel = '小賣';

  return {
    startDate,
    endDate,
    startIdx,
    endIdx: safeEnd,
    periodVol,
    top15BuySum,
    top15SellSum,
    chipNet,
    chipConcentrationPct,
    chip20Pct,
    capitalRatioPct,
    turnoverPct,
    directionLabel,
    isBullish,
    absChipNet: Math.abs(chipNet),
    mysteryBrokers,
    topBuyers: buyersSorted.slice(0, 15),
    topSellers: sellersSorted.slice(0, 15),
    dayTradeBrokers: brokerStats.filter(b => b.isDayTrade),
    foreignBrokers: brokerStats.filter(b => b.type === '外資'),
    govBrokers: brokerStats.filter(b => b.isGov),
    allBrokers: brokerStats
  };
}
