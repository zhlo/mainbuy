// 全台股上市櫃（TWSE + TPEx 約 1,990+ 檔）100% 正式官方資料批次抓取腳本
// 透過臺灣證券交易所 (TWSE) 與櫃買中心 (TPEx) 官方公開批次 API：
// 1. 抓取近 22 個交易日全市場每日收盤行情 (MI_INDEX / stk_quote_result.php)
//    -> 精準計算每檔真實 20日布林帶寬、上通道斜率、下通道斜率、月線斜率、月線乖離與 22 日 K 線
// 2. 抓取近 10 個交易日全市場三大法人買賣超 (T86 / 3itrade_hedge_result.php)
//    -> 精準計算外資/投信/自營商連買賣天數、佔成交量比與動能轉折階段 (第1天轉買/5天偏買/10天偏買/偏賣)
// 3. 抓取全市場最新本益比、股價淨值比、殖利率與產業分類 (BWIBBU_ALL / peratio_analysis / t187ap03)
// 產出精簡高速 public/market-stocks.json 供全市場選股池瞬開使用

import fs from 'node:fs/promises';
import path from 'node:path';
import { computeStockMomentum } from '../src/data/mockStocks.js';

const INDUSTRY_CODE_MAP = {
  '01': '水泥工業',
  '02': '食品工業',
  '03': '塑膠工業',
  '04': '紡織纖維',
  '05': '電機機械',
  '06': '電器電纜',
  '07': '化學生技',
  '08': '玻璃陶瓷',
  '09': '造紙工業',
  '10': '鋼鐵工業',
  '11': '橡膠工業',
  '12': '汽車工業',
  '13': '電子工業',
  '14': '建材營造',
  '15': '航運業',
  '16': '觀光餐旅',
  '17': '金融保險',
  '18': '貿易百貨',
  '19': '綜合',
  '20': '其他',
  '21': '化學工業',
  '22': '生技醫療',
  '23': '油電燃氣',
  '24': '半導體業',
  '25': '電腦週邊',
  '26': '光電業',
  '27': '通信網路',
  '28': '電子零組件',
  '29': '電子通路',
  '30': '資訊服務',
  '31': '其他電子',
  '32': '文化創意',
  '33': '農業科技',
  '34': '電子商務',
  '35': '綠能環保',
  '36': '數位雲端',
  '37': '運動休閒',
  '38': '居家生活'
};

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*'
};

function parseNum(val) {
  if (val === null || val === undefined) return NaN;
  const s = String(val).replace(/,/g, '').replace(/\s+/g, '').trim();
  if (!s || s === '--' || s === '---' || s === 'N/A' || s === '除息' || s === '除權') return NaN;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

function classifyCandleType(open, high, low, close) {
  if (close < open) return 'black-body';
  if (Math.abs(close - open) <= close * 0.002) {
    return high - close > close - low ? 'doji-bottom' : 'red-t';
  }
  const body = Math.abs(close - open);
  const range = Math.max(0.01, high - low);
  if (body / range > 0.65) return 'red-full';
  if (high - close > body) return 'red-high';
  return 'red-cross';
}

function toRocDateSlash(yyyymmdd) {
  const y = parseInt(yyyymmdd.slice(0, 4), 10) - 1911;
  const m = yyyymmdd.slice(4, 6);
  const d = yyyymmdd.slice(6, 8);
  return `${y}/${m}/${d}`;
}

function toSlashDate(yyyymmdd) {
  return `${yyyymmdd.slice(0, 4)}/${yyyymmdd.slice(4, 6)}/${yyyymmdd.slice(6, 8)}`;
}

async function fetchJsonWithRetry(url, retries = 2, timeoutMs = 15000, fetchOptions = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
        headers: { ...HEADERS, ...(fetchOptions.headers || {}) }
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt === retries) return null;
      await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  return null;
}

async function getRecentTradingDates(count = 23) {
  // 優先從 public/live-data.json 的 2330 或 TAIEX K 線取得 100% 真實台股交易日曆
  try {
    const livePath = path.resolve(process.cwd(), 'public/live-data.json');
    const live = JSON.parse(await fs.readFile(livePath, 'utf8'));
    const refStock = live.stocks?.find(s => s.code === '2330') || live.stocks?.[0];
    if (refStock?.kline?.length >= count) {
      return refStock.kline.slice(-count).map(d => d.compactDate || d.date.replace(/\//g, ''));
    }
  } catch {
    // fallback below
  }

  // 備援：以過去 40 天平日推算
  const dates = [];
  const now = new Date();
  for (let i = 0; i < 45 && dates.length < count; i++) {
    const d = new Date(now.getTime() - i * 86400000);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    dates.unshift(`${yyyy}${mm}${dd}`);
  }
  return dates;
}

async function fetchTwseDay(compactDate) {
  const url = `https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX?date=${compactDate}&type=ALLBUT0999&response=json`;
  const json = await fetchJsonWithRetry(url);
  if (!json || json.stat !== 'OK' || !Array.isArray(json.tables)) return null;
  const tbl = json.tables.find(t => Array.isArray(t.fields) && t.fields.includes('證券代號'));
  if (!tbl || !Array.isArray(tbl.data)) return null;

  const map = new Map();
  for (const r of tbl.data) {
    const code = String(r[0] || '').trim();
    if (!/^\d{4}$/.test(code)) continue;
    const close = parseNum(r[8]);
    if (!Number.isFinite(close) || close <= 0) continue;
    const open = parseNum(r[5]) || close;
    const high = parseNum(r[6]) || close;
    const low = parseNum(r[7]) || close;
    const volShares = parseNum(r[2]) || 0;
    const signStr = String(r[9] || '');
    const diffAbs = parseNum(r[10]) || 0;
    const change = signStr.includes('-') ? -diffAbs : signStr.includes('+') ? diffAbs : 0;
    const pe = parseNum(r[15]);
    map.set(code, {
      code,
      name: String(r[1] || '').trim(),
      market: '上市',
      open,
      high,
      low,
      close,
      change: Number(change.toFixed(2)),
      volume: Math.round(volShares / 1000),
      pe: Number.isFinite(pe) ? pe : 0
    });
  }
  return map;
}

async function fetchTpexDay(compactDate) {
  const slashDate = toSlashDate(compactDate);
  const url = 'https://www.tpex.org.tw/www/zh-tw/afterTrading/otc';
  const json = await fetchJsonWithRetry(url, 2, 15000, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `date=${encodeURIComponent(slashDate)}&type=EW&response=json`
  });
  const tbl = json?.tables?.[0];
  if (!tbl || !Array.isArray(tbl.data) || tbl.data.length === 0) return null;
  // 嚴格校驗回傳日期必須與請求日期相符，杜絕日期錯置
  if (json.date && String(json.date).replace(/\D/g, '') !== compactDate) return null;

  const map = new Map();
  for (const r of tbl.data) {
    const code = String(r[0] || '').trim();
    if (!/^\d{4}$/.test(code)) continue;
    const close = parseNum(r[2]);
    if (!Number.isFinite(close) || close <= 0) continue;
    const change = parseNum(r[3]) || 0;
    const open = parseNum(r[4]) || close;
    const high = parseNum(r[5]) || close;
    const low = parseNum(r[6]) || close;
    const volShares = parseNum(r[7]) || 0;
    map.set(code, {
      code,
      name: String(r[1] || '').trim(),
      market: '上櫃',
      open,
      high,
      low,
      close,
      change: Number(change.toFixed(2)),
      volume: Math.round(volShares / 1000),
      pe: 0
    });
  }
  return map;
}

async function fetchTwseInstDay(compactDate) {
  const url = `https://www.twse.com.tw/rwd/zh/fund/T86?date=${compactDate}&selectType=ALLBUT0999&response=json`;
  const json = await fetchJsonWithRetry(url);
  if (!json || json.stat !== 'OK' || !Array.isArray(json.data)) return null;

  const map = new Map();
  for (const r of json.data) {
    const code = String(r[0] || '').trim();
    if (!/^\d{4}$/.test(code)) continue;
    const foreign = Math.round(((parseNum(r[4]) || 0) + (parseNum(r[7]) || 0)) / 1000);
    const trust = Math.round((parseNum(r[10]) || 0) / 1000);
    const dealer = Math.round((parseNum(r[11]) || 0) / 1000);
    map.set(code, { foreign, trust, dealer });
  }
  return map;
}

async function fetchTpexInstDay(compactDate) {
  const slashDate = toSlashDate(compactDate);
  const url = 'https://www.tpex.org.tw/www/zh-tw/insti/dailyTrade';
  const json = await fetchJsonWithRetry(url, 2, 15000, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `type=Daily&sect=EW&date=${encodeURIComponent(slashDate)}&response=json`
  });
  const rows = json?.tables?.[0]?.data;
  if (!Array.isArray(rows) || rows.length === 0) return null;
  if (json.date && String(json.date).replace(/\D/g, '') !== compactDate) return null;

  const map = new Map();
  for (const r of rows) {
    const code = String(r[0] || '').trim();
    if (!/^\d{4}$/.test(code)) continue;
    const foreign = Math.round((parseNum(r[10]) || 0) / 1000);
    const trust = Math.round((parseNum(r[13]) || 0) / 1000);
    const dealer = Math.round((parseNum(r[22]) || 0) / 1000);
    map.set(code, { foreign, trust, dealer });
  }
  return map;
}

function calcConsecutiveDays(arr) {
  if (!arr.length) return 0;
  let last = arr[arr.length - 1];
  if (last === 0) return 0;
  const sign = last > 0 ? 1 : -1;
  let count = 0;
  for (let i = arr.length - 1; i >= 0; i--) {
    if (sign > 0 && arr[i] > 0) count++;
    else if (sign < 0 && arr[i] < 0) count--;
    else break;
  }
  return count;
}

async function main() {
  const t0 = Date.now();
  console.log('🌐 開始抓取全台股上市 (TWSE) + 上櫃 (TPEx) 完整選股池官方真實資料...');

  const tradingDates = await getRecentTradingDates(22);
  console.log(`📅 目標交易日範圍 (${tradingDates.length} 天): ${tradingDates[0]} ~ ${tradingDates[tradingDates.length - 1]}`);

  // 1. 並行抓取靜態基本面與估值 (本益比 / 股淨比 / 殖利率 / 產業分類)
  const [twseVal, tpexVal, twseCorp, tpexCorp] = await Promise.all([
    fetchJsonWithRetry('https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL'),
    fetchJsonWithRetry('https://www.tpex.org.tw/openapi/v1/tpex_mainboard_peratio_analysis'),
    fetchJsonWithRetry('https://openapi.twse.com.tw/v1/opendata/t187ap03_L'),
    fetchJsonWithRetry('https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap03_O')
  ]);

  const valuationMap = new Map();
  if (Array.isArray(twseVal)) {
    for (const r of twseVal) {
      const code = String(r.Code || '').trim();
      if (!/^\d{4}$/.test(code)) continue;
      valuationMap.set(code, {
        pe: parseNum(r.PEratio) || 0,
        pb: parseNum(r.PBratio) || 0,
        dividendYield: parseNum(r.DividendYield) || 0
      });
    }
  }
  if (Array.isArray(tpexVal)) {
    for (const r of tpexVal) {
      const code = String(r.SecuritiesCompanyCode || '').trim();
      if (!/^\d{4}$/.test(code)) continue;
      valuationMap.set(code, {
        pe: parseNum(r.PriceEarningRatio) || 0,
        pb: parseNum(r.PriceBookRatio) || 0,
        dividendYield: parseNum(r.YieldRatio) || 0
      });
    }
  }

  const industryMap = new Map();
  if (Array.isArray(twseCorp)) {
    for (const r of twseCorp) {
      const code = String(r['公司代號'] || '').trim();
      if (!/^\d{4}$/.test(code)) continue;
      const indCode = String(r['產業別'] || '').trim().padStart(2, '0');
      industryMap.set(code, INDUSTRY_CODE_MAP[indCode] || '其他');
    }
  }
  if (Array.isArray(tpexCorp)) {
    for (const r of tpexCorp) {
      const code = String(r.SecuritiesCompanyCode || '').trim();
      if (!/^\d{4}$/.test(code)) continue;
      const indCode = String(r.SecuritiesIndustryCode || '').trim().padStart(2, '0');
      industryMap.set(code, INDUSTRY_CODE_MAP[indCode] || '其他');
    }
  }

  console.log(`📋 已載入估值表 (${valuationMap.size} 檔) 與產業分類 (${industryMap.size} 檔)`);

  // 2. 分批抓取 22 個交易日之全市場收盤價 (每次 3 天並行，避免證交所/櫃買限流)
  const dailyQuotesByDate = new Map(); // date -> Map(code -> quote)
  const validDates = [];

  for (let i = 0; i < tradingDates.length; i += 3) {
    const chunk = tradingDates.slice(i, i + 3);
    const results = await Promise.all(
      chunk.map(async dt => {
        const [twseMap, tpexMap] = await Promise.all([fetchTwseDay(dt), fetchTpexDay(dt)]);
        return { dt, twseMap, tpexMap };
      })
    );
    for (const { dt, twseMap, tpexMap } of results) {
      const merged = new Map();
      if (twseMap) twseMap.forEach((v, k) => merged.set(k, v));
      if (tpexMap) tpexMap.forEach((v, k) => merged.set(k, v));
      if (merged.size > 500) {
        dailyQuotesByDate.set(dt, merged);
        validDates.push(dt);
      }
    }
    await new Promise(r => setTimeout(r, 350));
  }

  validDates.sort();
  console.log(`📈 成功抓取 ${validDates.length} 個完整全市場交易日行情 (${validDates[0]} ~ ${validDates[validDates.length - 1]})`);

  // 3. 分批抓取全部 22 個交易日之全市場三大法人買賣超（完全不依賴 FinMind，杜絕任何 chipPending 缺口）
  const instDates = validDates;
  const dailyInstByDate = new Map();

  for (let i = 0; i < instDates.length; i += 3) {
    const chunk = instDates.slice(i, i + 3);
    const results = await Promise.all(
      chunk.map(async dt => {
        const [twseI, tpexI] = await Promise.all([fetchTwseInstDay(dt), fetchTpexInstDay(dt)]);
        return { dt, twseI, tpexI };
      })
    );
    for (const { dt, twseI, tpexI } of results) {
      const merged = new Map();
      if (twseI) twseI.forEach((v, k) => merged.set(k, v));
      if (tpexI) tpexI.forEach((v, k) => merged.set(k, v));
      if (merged.size > 200) {
        dailyInstByDate.set(dt, merged);
      }
    }
    await new Promise(r => setTimeout(r, 350));
  }

  console.log(`🏦 成功抓取 ${dailyInstByDate.size} 個完整全市場三大法人買賣超日報`);

  // 4. 以最新一個完整交易日為基準，組裝所有上市櫃個股資料
  const latestCompactDate = validDates[validDates.length - 1];
  const latestMap = dailyQuotesByDate.get(latestCompactDate);
  if (!latestMap || latestMap.size === 0) {
    throw new Error('無法取得最新全市場交易日資料！');
  }

  const allStocks = [];
  for (const [code, latestQ] of latestMap.entries()) {
    const kline = [];
    for (let idx = 0; idx < validDates.length; idx++) {
      const dt = validDates[idx];
      const q = dailyQuotesByDate.get(dt)?.get(code);
      if (!q) continue;
      const prevClose = kline.length > 0 ? kline[kline.length - 1].close : q.close - q.change;
      const changePct = prevClose > 0 ? Number(((q.change / prevClose) * 100).toFixed(2)) : 0;
      const inst = dailyInstByDate.get(dt)?.get(code);
      const foreignNet = inst ? inst.foreign : 0;
      const trustNet = inst ? inst.trust : 0;
      const dealerNet = inst ? inst.dealer : 0;
      // 非精選 51 檔之全市場選股池，以官方三大法人淨買賣超合計作為主力籌碼基準（點入個股後自動補抓券商分點）
      const mainNet = inst ? foreignNet + trustNet + dealerNet : 0;

      kline.push({
        date: toSlashDate(dt),
        compactDate: dt,
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.close,
        change: q.change,
        changePct,
        volume: q.volume,
        foreignNet,
        trustNet,
        dealerNet,
        mainNet,
        chipPending: false
      });
    }

    if (kline.length === 0) continue;

    // 計算均線與布林軌道 (MA5, MA10, MA20, bollUpper, bollLower)
    for (let i = 0; i < kline.length; i++) {
      const s5 = kline.slice(Math.max(0, i - 4), i + 1);
      const s10 = kline.slice(Math.max(0, i - 9), i + 1);
      const s20 = kline.slice(Math.max(0, i - 19), i + 1);
      const ma5 = s5.reduce((a, b) => a + b.close, 0) / s5.length;
      const ma10 = s10.reduce((a, b) => a + b.close, 0) / s10.length;
      const ma20 = s20.reduce((a, b) => a + b.close, 0) / s20.length;
      const variance = s20.reduce((a, b) => a + Math.pow(b.close - ma20, 2), 0) / s20.length;
      const std = Math.sqrt(variance);

      kline[i].ma5 = Number(ma5.toFixed(2));
      kline[i].ma10 = Number(ma10.toFixed(2));
      kline[i].ma20 = Number(ma20.toFixed(2));
      kline[i].bollUpper = Number((ma20 + 2 * std).toFixed(2));
      kline[i].bollLower = Number((ma20 - 2 * std).toFixed(2));
    }

    const lastBar = kline[kline.length - 1];
    const prevBar = kline.length >= 2 ? kline[kline.length - 2] : lastBar;

    // 布林帶寬與三斜率
    const bandWidth =
      lastBar.bollUpper && lastBar.bollLower
        ? Number((((lastBar.bollUpper / Math.max(0.01, lastBar.bollLower)) - 1) * 100).toFixed(1))
        : 0;
    const bandPos =
      lastBar.bollUpper && lastBar.bollLower
        ? Math.round(((lastBar.close - lastBar.bollLower) / Math.max(0.01, lastBar.bollUpper - lastBar.bollLower)) * 12)
        : 6;
    const upperSlope =
      lastBar.bollUpper && prevBar.bollUpper
        ? Number((((lastBar.bollUpper / prevBar.bollUpper) - 1) * 100).toFixed(2))
        : 0;
    const lowerSlope =
      lastBar.bollLower && prevBar.bollLower
        ? Number((((lastBar.bollLower / prevBar.bollLower) - 1) * 100).toFixed(2))
        : 0;
    const monthSlope =
      lastBar.ma20 && prevBar.ma20
        ? Number((((lastBar.ma20 / prevBar.ma20) - 1) * 100).toFixed(2))
        : 0;
    const biasMonth =
      lastBar.ma20 > 0 ? Number((((lastBar.close - lastBar.ma20) / lastBar.ma20) * 100).toFixed(1)) : 0;

    // 主力與法人指標
    const vol1 = Math.max(1, lastBar.volume);
    const vol5 = Math.max(1, kline.slice(-5).reduce((s, d) => s + d.volume, 0));
    const vol10 = Math.max(1, kline.slice(-10).reduce((s, d) => s + d.volume, 0));

    const main1 = Math.round((lastBar.mainNet / vol1) * 100);
    const main5 = Math.round((kline.slice(-5).reduce((s, d) => s + d.mainNet, 0) / vol5) * 100);
    const main10 = Math.round((kline.slice(-10).reduce((s, d) => s + d.mainNet, 0) / vol10) * 100);

    const foreignPct = Math.round((lastBar.foreignNet / vol1) * 100);
    const trustPct = Math.round((lastBar.trustNet / vol1) * 100);
    const dealerPct = Math.round((lastBar.dealerNet / vol1) * 100);

    const recent10 = kline.slice(-10);
    const foreignConsec = calcConsecutiveDays(recent10.map(d => d.foreignNet));
    const trustConsec = calcConsecutiveDays(recent10.map(d => d.trustNet));
    const mainConsec = calcConsecutiveDays(recent10.map(d => d.mainNet));

    const momentum = computeStockMomentum(kline);
    const val = valuationMap.get(code) || { pe: latestQ.pe || 0, pb: 0, dividendYield: 0 };

    // 精簡版 K 線（僅存必要欄位以壓縮 JSON 體積）
    const compactKline = kline.map(d => ({
      date: d.date,
      compactDate: d.compactDate,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      change: d.change,
      changePct: d.changePct,
      volume: d.volume,
      ma5: d.ma5,
      ma20: d.ma20,
      bollUpper: d.bollUpper,
      bollLower: d.bollLower,
      foreignNet: d.foreignNet,
      trustNet: d.trustNet,
      dealerNet: d.dealerNet,
      mainNet: d.mainNet
    }));

    allStocks.push({
      code,
      name: latestQ.name,
      market: latestQ.market,
      industry: industryMap.get(code) || '其他',
      price: lastBar.close,
      change: lastBar.change,
      changePct: lastBar.changePct,
      volume: lastBar.volume,
      candleType: classifyCandleType(lastBar.open, lastBar.high, lastBar.low, lastBar.close),
      latestTradeDate: lastBar.date,
      bandWidth,
      bandPos,
      upperSlope,
      lowerSlope,
      monthSlope,
      biasMonth,
      biasQuarter: 0,
      main1,
      main5,
      main10,
      mainConsec,
      foreignPct,
      trustPct,
      dealerPct,
      foreignConsec,
      trustConsec,
      pe: Number((val.pe || latestQ.pe || 0).toFixed(2)),
      pb: Number((val.pb || 0).toFixed(2)),
      dividendYield: Number((val.dividendYield || 0).toFixed(2)),
      momentum,
      kline: compactKline,
      isLiveSynced: true,
      hasRealBrokerReport: false,
      isFullMarketSummary: true
    });
  }

  // 依成交量由大到小預設排序，讓熱門高流動性股票自然排在前面
  allStocks.sort((a, b) => (b.volume || 0) - (a.volume || 0));

  const twseCount = allStocks.filter(s => s.market === '上市').length;
  const tpexCount = allStocks.filter(s => s.market === '上櫃').length;

  const payload = JSON.stringify({
    updatedAt: new Date().toISOString(),
    latestDate: toSlashDate(latestCompactDate),
    totalCount: allStocks.length,
    twseCount,
    tpexCount,
    stocks: allStocks
  });

  const outPath = path.resolve(process.cwd(), 'public/market-stocks.json');
  await fs.writeFile(outPath, payload, 'utf8');
  try {
    const altPath = path.resolve(process.cwd(), 'zhlo/mainbuy/public/market-stocks.json');
    await fs.writeFile(altPath, payload, 'utf8');
  } catch {}

  const sizeMb = (Buffer.byteLength(payload, 'utf8') / (1024 * 1024)).toFixed(2);
  const elapsedSec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(
    `🎉 全台股選股池建置完成！共 ${allStocks.length} 檔（上市 ${twseCount} 檔 + 上櫃 ${tpexCount} 檔），檔案大小 ${sizeMb} MB，耗時 ${elapsedSec} 秒`
  );
}

main().catch(err => {
  console.error('❌ 全台股抓取失敗:', err);
  process.exit(1);
});
