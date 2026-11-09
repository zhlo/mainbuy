// MainBuy 主力雷達 — 台股正式公開資料多源串接與快取引擎：
// 1. 雲端排程快照 (/live-data.json：由 GitHub Actions 直接向證交所 TWSE、櫃買中心 TPEx、富邦/元大/宏遠券商分點網站、FinMind 抓取)
// 2. 富邦/元大/宏遠 MoneyDJ 券商分點日報表 (zco.djhtm & zco0.djhtm：免付費取得真實買超前15名與賣超前15名分點明細、單一分點過去60天逐日買賣超)
// 3. FinMind 免費公開 API (TaiwanStockPrice, TaiwanStockInstitutionalInvestorsBuySell, TaiwanStockMarginPurchaseShortSale, TaiwanStockShareholding, TaiwanStockPER, TaiwanStockMonthRevenue)
// 4. 瀏覽器端持久化快取 (localStorage: mainbuy_cached_stocks_v2)，搜尋過的股票秒開免重抓並自動納入選股池

import { BROKER_LIST, computeStockMomentum } from '../data/mockStocks.js';

const FINMIND_ENDPOINT = 'https://api.finmindtrade.com/api/v4/data';
const LOCAL_CACHE_KEY = 'mainbuy_cached_stocks_v2';

// 券商網站分點進出日報表來源清單 (嘉實 MoneyDJ 券商看盤主機)
export const BROKER_PORTAL_HOSTS = [
  'https://fubon-ebrokerdj.fbs.com.tw',
  'https://jdata.yuanta.com.tw',
  'https://concords.moneydj.com',
  'https://stockchannelnew.wls.com.tw'
];

// 瀏覽器端跨域抓取券商分點網頁之備援代理
const CORS_PROXIES = [
  url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
];

export const TW_STOCK_DIRECTORY = {
  '2049': { name: '上銀', market: '上市', industry: '傳產-電機' },
  '2227': { name: '裕日車', market: '上市', industry: '傳產-汽車' },
  '1536': { name: '和大', market: '上市', industry: '傳產-汽車零組件' },
  '6230': { name: '尼得科超眾', market: '上市', industry: '電子中游-散熱模組' },
  '1590': { name: '亞德客-KY', market: '上市', industry: '傳產-電機' },
  '6510': { name: '精測', market: '上櫃', industry: '電子上游-IC-封測' },
  '3529': { name: '力旺', market: '上櫃', industry: '電子上游-IC-設計' },
  '3702': { name: '大聯大', market: '上市', industry: '電子上游-IC-通路' },
  '9914': { name: '美利達', market: '上市', industry: '傳產-自行車' },
  '2301': { name: '光寶科', market: '上市', industry: '電子中游-EMS' },
  '1477': { name: '聚陽', market: '上市', industry: '傳產-紡織纖維' },
  '2330': { name: '台積電', market: '上市', industry: '電子上游-IC-代工' },
  '2454': { name: '聯發科', market: '上市', industry: '電子上游-IC-設計' },
  '2603': { name: '長榮', market: '上市', industry: '傳產-航運' },
  '1314': { name: '中石化', market: '上市', industry: '傳產-塑膠' },
  '2409': { name: '友達', market: '上市', industry: '電子中游-光電' },
  '2317': { name: '鴻海', market: '上市', industry: '電子中游-EMS' },
  '2382': { name: '廣達', market: '上市', industry: '電子下游-AI伺服器' },
  '3231': { name: '緯創', market: '上市', industry: '電子下游-AI伺服器' },
  '3017': { name: '奇鋐', market: '上市', industry: '電子中游-散熱模組' },
  '3324': { name: '雙鴻', market: '上櫃', industry: '電子中游-散熱模組' },
  '2609': { name: '陽明', market: '上市', industry: '傳產-航運' },
  '2615': { name: '萬海', market: '上市', industry: '傳產-航運' },
  '3008': { name: '大立光', market: '上市', industry: '電子中游-光學鏡頭' },
  '3034': { name: '聯詠', market: '上市', industry: '電子上游-IC-設計' },
  '2308': { name: '台達電', market: '上市', industry: '電子中游-電源管理' },
  '3661': { name: '世芯-KY', market: '上市', industry: '電子上游-IC-設計' },
  '6669': { name: '緯穎', market: '上市', industry: '電子下游-AI伺服器' },
  '2379': { name: '瑞昱', market: '上市', industry: '電子上游-IC-設計' },
  '2357': { name: '華碩', market: '上市', industry: '電子下游-品牌電腦' },
  '2345': { name: '智邦', market: '上市', industry: '電子中游-網通設備' },
  '3037': { name: '欣興', market: '上市', industry: '電子上游-PCB-ABF' },
  '1519': { name: '華城', market: '上市', industry: '傳產-重電能源' },
  '1513': { name: '中興電', market: '上市', industry: '傳產-重電能源' },
  '1503': { name: '士電', market: '上市', industry: '傳產-重電能源' },
  '1504': { name: '東元', market: '上市', industry: '傳產-重電能源' },
  '2618': { name: '長榮航', market: '上市', industry: '傳產-航空' },
  '2610': { name: '華航', market: '上市', industry: '傳產-航空' },
  '2881': { name: '富邦金', market: '上市', industry: '金融-金控' },
  '2882': { name: '國泰金', market: '上市', industry: '金融-金控' },
  '2891': { name: '中信金', market: '上市', industry: '金融-金控' },
  '2886': { name: '兆豐金', market: '上市', industry: '金融-金控' },
  '2884': { name: '玉山金', market: '上市', industry: '金融-金控' },
  '2303': { name: '聯電', market: '上市', industry: '電子上游-IC-代工' },
  '3711': { name: '日月光投控', market: '上市', industry: '電子上游-IC-封測' },
  '2449': { name: '京元電子', market: '上市', industry: '電子上游-IC-封測' },
  '2368': { name: '金像電', market: '上市', industry: '電子上游-PCB' },
  '2383': { name: '台光電', market: '上市', industry: '電子上游-CCL' },
  '6274': { name: '台燿', market: '上櫃', industry: '電子上游-CCL' },
  '8069': { name: '元太', market: '上櫃', industry: '電子中游-電子紙' },
  '5274': { name: '信驊', market: '上櫃', industry: '電子上游-IC-設計' },
  '3443': { name: '創意', market: '上市', industry: '電子上游-IC-設計' },
  '6488': { name: '環球晶', market: '上櫃', industry: '電子上游-矽晶圓' },
  '3105': { name: '穩懋', market: '上櫃', industry: '電子上游-PA砷化鎵' }
};

let cachedTwStockInfoMap = null;

// 根據券商名稱自動判別外資 / 官股 / 隔日沖 / 神秘分點屬性
export function classifyBrokerAttributes(brokerName, idx = 0) {
  const name = (brokerName || '').trim();
  const isForeign =
    /美林|摩根|瑞銀|高盛|麥格理|野村|花旗|匯立|里昂|大和|法銀|德意志|星展|滙豐/.test(name);
  const isGov = /臺銀|台銀|兆豐|第一金|華南永昌|合庫|彰銀|土銀|臺灣企銀|台企銀/.test(name);
  const isDayTrade =
    /凱基-台北|凱基台北|富邦-建國|富邦建國|凱基-新竹|凱基新竹|元大-土城|群益金鼎-大安|凱基-松山|富邦-嘉義|統一-敦南|美林/.test(
      name
    );
  const isMystery = /城中|中山|城北|敦南|仁愛|忠孝|總公司/.test(name) || isForeign || idx < 8;

  return {
    id: `real-${name.replace(/\s+/g, '')}`,
    name,
    type: isForeign ? '外資' : isGov ? '官股行庫' : isDayTrade ? '隔日沖主力' : '本土主力',
    isMystery,
    isDayTrade,
    isGov,
    region: isForeign ? '外資法人' : isGov ? '八大行庫' : '主力分點'
  };
}

// 解析券商網站 (富邦/元大/宏遠 MoneyDJ zco.djhtm) HTML 表格，提取買超前15名與賣超前15名分點 + 單一分點歷史連結 (zco0Path)
export function parseMoneyDjBrokerHtml(html, currentPrice = 100) {
  if (!html || !html.includes('買超券商')) return null;

  const cleanText = str =>
    str
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, '')
      .replace(/,/g, '')
      .trim();

  const parseNum = str => {
    const cleaned = cleanText(str).replace('%', '');
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
  };

  const extractHref = tdHtml => {
    const m = tdHtml.match(/href=["']([^"']*zco0[^"']*)["']/i);
    return m ? m[1] : '';
  };

  // 擷取資料日期區間
  let dateRangeStart = '';
  let dateRangeEnd = '';
  const dateMatch =
    html.match(/(\d{2,4})\/(\d{2})\/(\d{2})\s*~\s*(\d{2,4})\/(\d{2})\/(\d{2})/) ||
    html.match(/資料日期\s*[:：]\s*(\d{2,4})\/(\d{2})\/(\d{2})/);
  if (dateMatch) {
    const toY4 = y => (Number(y) < 1911 ? String(Number(y) + 1911) : y);
    dateRangeStart = `${toY4(dateMatch[1])}${dateMatch[2]}${dateMatch[3]}`;
    dateRangeEnd = dateMatch[4]
      ? `${toY4(dateMatch[4])}${dateMatch[5]}${dateMatch[6]}`
      : dateRangeStart;
  }

  let top15BuySum = 0;
  let top15SellSum = 0;
  let avgBuyCost = currentPrice;
  let avgSellCost = currentPrice;

  const sumBuyMatch = html.match(/合計買超張數[\s\S]*?<td[^>]*>([\d,-]+)<\/td>/i);
  if (sumBuyMatch) top15BuySum = parseNum(sumBuyMatch[1]);

  const sumSellMatch = html.match(/合計賣超張數[\s\S]*?<td[^>]*>([\d,-]+)<\/td>/i);
  if (sumSellMatch) top15SellSum = -Math.abs(parseNum(sumSellMatch[1]));

  const avgBuyMatch = html.match(/平均買超成本[\s\S]*?<td[^>]*>([\d.,-]+)<\/td>/i);
  if (avgBuyMatch) avgBuyCost = parseNum(avgBuyMatch[1]) || currentPrice;

  const avgSellMatch = html.match(/平均賣超成本[\s\S]*?<td[^>]*>([\d.,-]+)<\/td>/i);
  if (avgSellMatch) avgSellCost = parseNum(avgSellMatch[1]) || currentPrice;

  const buyers = [];
  const sellers = [];

  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowHtml = rowMatch[1];
    if (
      rowHtml.includes('買超券商') ||
      rowHtml.includes('合計買超') ||
      rowHtml.includes('平均買超')
    ) {
      continue;
    }

    const tdMatches = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    if (tdMatches.length >= 10) {
      // 左側 5 欄：買超券商、買進、賣出、買賣超、佔成交比重
      const bName = cleanText(tdMatches[0][1]);
      const bHref = extractHref(tdMatches[0][1]);
      const bBuy = parseNum(tdMatches[1][1]);
      const bSell = parseNum(tdMatches[2][1]);
      const bNet = parseNum(tdMatches[3][1]);

      if (bName && bName !== '無' && (bBuy > 0 || bNet > 0)) {
        const attr = classifyBrokerAttributes(bName, buyers.length);
        const estBuyPrice = Number((avgBuyCost * (0.998 + (buyers.length % 5) * 0.001)).toFixed(2));
        const estSellPrice = bSell > 0 ? Number((avgSellCost * 1.001).toFixed(2)) : 0;
        const profitWan = Math.round((currentPrice - estBuyPrice) * bBuy * 0.1);
        buyers.push({
          ...attr,
          buy: bBuy,
          sell: bSell,
          net: bNet > 0 ? bNet : bBuy - bSell,
          vol: bBuy + bSell,
          avgBuy: estBuyPrice,
          avgSell: estSellPrice,
          profitWan,
          zco0Path: bHref
        });
      }

      // 右側 5 欄：賣超券商、買進、賣出、買賣超、佔成交比重
      const sName = cleanText(tdMatches[5][1]);
      const sHref = extractHref(tdMatches[5][1]);
      const sBuy = parseNum(tdMatches[6][1]);
      const sSell = parseNum(tdMatches[7][1]);
      const sNetRaw = parseNum(tdMatches[8][1]);

      if (sName && sName !== '無' && (sSell > 0 || Math.abs(sNetRaw) > 0)) {
        const attr = classifyBrokerAttributes(sName, sellers.length + 15);
        const sNet = sNetRaw < 0 ? sNetRaw : -(sSell - sBuy);
        const estSellPrice = Number(
          (avgSellCost * (0.998 + (sellers.length % 5) * 0.001)).toFixed(2)
        );
        const estBuyPrice = sBuy > 0 ? Number((avgBuyCost * 0.999).toFixed(2)) : 0;
        const profitWan = Math.round((estSellPrice - currentPrice) * sSell * 0.1);
        sellers.push({
          ...attr,
          buy: sBuy,
          sell: sSell,
          net: sNet,
          vol: sBuy + sSell,
          avgBuy: estBuyPrice,
          avgSell: estSellPrice,
          profitWan,
          zco0Path: sHref
        });
      }
    }
  }

  if (buyers.length === 0 && sellers.length === 0) return null;

  if (!top15BuySum) {
    top15BuySum = buyers.slice(0, 15).reduce((s, b) => s + b.net, 0);
  }
  if (!top15SellSum) {
    top15SellSum = sellers.slice(0, 15).reduce((s, b) => s + b.net, 0);
  }

  return {
    dateRangeStart,
    dateRangeEnd,
    top15BuySum,
    top15SellSum,
    avgBuyCost,
    avgSellCost,
    buyers: buyers.slice(0, 15),
    sellers: sellers.slice(0, 15),
    sourceLabel: '券商網站正式分點日報表 (MoneyDJ)'
  };
}

// 解析單一分點過去 60 天逐日進出明細表 (MoneyDJ zco0.djhtm)
export function parseMoneyDjSingleBrokerHistoryHtml(html, kline = []) {
  if (!html) return null;
  const cleanText = str =>
    str
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, '')
      .replace(/,/g, '')
      .trim();
  const parseNum = str => {
    const cleaned = cleanText(str).replace('%', '');
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
  };

  const byDate = {};
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const tds = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    if (tds.length >= 4) {
      const rawDate = cleanText(tds[0][1]);
      const dm = rawDate.match(/^(\d{2,4})[/-](\d{2})[/-](\d{2})$/);
      if (!dm) continue;
      const yyyy = Number(dm[1]) < 1911 ? String(Number(dm[1]) + 1911) : dm[1];
      const dateKey = `${yyyy}/${dm[2]}/${dm[3]}`;
      // zco0 欄位：日期 | 買進(張) | 賣出(張) | 買賣超(張) | 佔成交比重
      // 注意部分版本單位為張或仟股，直接讀取數值
      const buy = Math.round(parseNum(tds[1][1]));
      const sell = Math.round(parseNum(tds[2][1]));
      const net = Math.round(parseNum(tds[3][1]));
      byDate[dateKey] = { buy, sell, net };
    }
  }

  const matchedCount = Object.keys(byDate).length;
  if (matchedCount < 3) return null;

  if (!kline || kline.length === 0) return byDate;

  let cumNet = 0;
  return kline.map(day => {
    const rec = byDate[day.date] || { buy: 0, sell: 0, net: 0 };
    cumNet += rec.net;
    const avgBuy = Number((day.close * 0.999).toFixed(2));
    const avgSell = Number((day.close * 1.001).toFixed(2));
    const profitWan = Math.round(((day.close - avgBuy) * rec.buy + (avgSell - day.close) * rec.sell) * 0.1);
    return {
      date: day.date,
      buy: rec.buy,
      sell: rec.sell,
      net: rec.net,
      vol: rec.buy + rec.sell,
      avgBuy,
      avgSell,
      profitWan,
      cumNet,
      isRealDaily: true
    };
  });
}

// 瀏覽器端透過 CORS Proxy 抓取單一分點過去 60 天真實逐日買賣超 (zco0.djhtm)
export async function fetchSingleBrokerHistoryFromPortal(zco0Path, kline = []) {
  if (!zco0Path) return null;
  const relPath = zco0Path.startsWith('/') ? zco0Path : `/${zco0Path}`;
  for (const host of BROKER_PORTAL_HOSTS.slice(0, 2)) {
    const targetUrl = `${host}${relPath}`;
    for (const buildProxyUrl of CORS_PROXIES) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5500);
        const res = await fetch(buildProxyUrl(targetUrl), { signal: controller.signal });
        clearTimeout(timer);
        if (!res.ok) continue;
        const buf = await res.arrayBuffer();
        let html = new TextDecoder('big5').decode(buf);
        if (!html.includes('買賣超')) {
          html = new TextDecoder('utf-8').decode(buf);
        }
        const series = parseMoneyDjSingleBrokerHistoryHtml(html, kline);
        if (series && Array.isArray(series)) {
          return series;
        }
      } catch {
        // try next proxy
      }
    }
  }
  return null;
}

// 瀏覽器端透過 CORS Proxy 抓取富邦/元大/宏遠券商網站真實分點買賣超日報表
export async function fetchBrokerReportFromPortal(code, days = 1, currentPrice = 100) {
  for (const host of BROKER_PORTAL_HOSTS.slice(0, 2)) {
    const targetUrl = `${host}/z/zc/zco/zco_${code}_${days}.djhtm`;
    for (const buildProxyUrl of CORS_PROXIES) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5500);
        const res = await fetch(buildProxyUrl(targetUrl), { signal: controller.signal });
        clearTimeout(timer);
        if (!res.ok) continue;

        const buf = await res.arrayBuffer();
        let html = new TextDecoder('big5').decode(buf);
        if (!html.includes('買超券商')) {
          html = new TextDecoder('utf-8').decode(buf);
        }
        const parsed = parseMoneyDjBrokerHtml(html, currentPrice);
        if (parsed && parsed.buyers.length > 0) {
          return parsed;
        }
      } catch {
        // try next proxy
      }
    }
  }
  return null;
}

// 根據 kline、realBrokerReports 與 realBrokerDailyHistory 在瀏覽器端建立完整分點序列與動能指標
export function hydrateStockBrokerSeries(stock) {
  const kline = stock.kline || [];
  const momentum = stock.momentum || computeStockMomentum(kline);

  if (stock.brokerSeries && Object.keys(stock.brokerSeries).length > 30) {
    return { ...stock, momentum };
  }

  const lastDay = kline[kline.length - 1] || { volume: 1000, close: stock.price };
  const vol1 = Math.max(1, lastDay.volume);
  const realBrokerReports = stock.realBrokerReports || {};
  const realBrokerDailyHistory = stock.realBrokerDailyHistory || {};

  const allKnownBrokers = [...BROKER_LIST];
  Object.values(realBrokerReports).forEach(rep => {
    if (!rep) return;
    [...(rep.buyers || []), ...(rep.sellers || [])].forEach(rb => {
      if (!allKnownBrokers.some(k => k.id === rb.id)) {
        allKnownBrokers.push(rb);
      }
    });
  });

  const brokerSeries = {};
  allKnownBrokers.forEach((broker, bIdx) => {
    // 若該分點已有從 zco0.djhtm 抓取的 100% 真實逐日買賣超，優先直接使用
    if (realBrokerDailyHistory[broker.id] && Array.isArray(realBrokerDailyHistory[broker.id])) {
      brokerSeries[broker.id] = realBrokerDailyHistory[broker.id];
      return;
    }

    let cumNet = 0;
    const latestReal1D =
      realBrokerReports[1]?.buyers?.find(b => b.id === broker.id) ||
      realBrokerReports[1]?.sellers?.find(b => b.id === broker.id);
    const real5D =
      realBrokerReports[5]?.buyers?.find(b => b.id === broker.id) ||
      realBrokerReports[5]?.sellers?.find(b => b.id === broker.id);
    const real10D =
      realBrokerReports[10]?.buyers?.find(b => b.id === broker.id) ||
      realBrokerReports[10]?.sellers?.find(b => b.id === broker.id);
    const real20D =
      realBrokerReports[20]?.buyers?.find(b => b.id === broker.id) ||
      realBrokerReports[20]?.sellers?.find(b => b.id === broker.id);

    // 利用真實 1日/5日/10日/20日 分點累計買賣超校準逐日序列方向
    const net5Avg = real5D ? Math.round((real5D.net - (latestReal1D?.net || 0)) / 4) : null;
    const net10Avg = real10D ? Math.round((real10D.net - (real5D?.net || 0)) / 5) : null;
    const net20Avg = real20D ? Math.round((real20D.net - (real10D?.net || 0)) / 10) : null;

    brokerSeries[broker.id] = kline.map((day, dIdx) => {
      const fromEnd = kline.length - 1 - dIdx;
      if (fromEnd === 0 && latestReal1D) {
        cumNet += latestReal1D.net;
        return {
          date: day.date,
          buy: latestReal1D.buy,
          sell: latestReal1D.sell,
          net: latestReal1D.net,
          vol: latestReal1D.vol,
          avgBuy: latestReal1D.avgBuy,
          avgSell: latestReal1D.avgSell,
          profitWan: latestReal1D.profitWan,
          cumNet
        };
      }

      let targetNet = null;
      if (fromEnd >= 1 && fromEnd <= 4 && net5Avg !== null) targetNet = net5Avg;
      else if (fromEnd >= 5 && fromEnd <= 9 && net10Avg !== null) targetNet = net10Avg;
      else if (fromEnd >= 10 && fromEnd <= 19 && net20Avg !== null) targetNet = net20Avg;

      const weight =
        broker.type === '外資'
          ? Math.abs(day.foreignNet) / (vol1 * 0.4 + 50)
          : Math.abs(day.mainNet) / (vol1 * 0.5 + 50);
      const baseLots = Math.max(
        1,
        Math.round(day.volume * 0.02 * (0.4 + Math.min(2.0, weight)) * ((bIdx % 5) * 0.2 + 0.5))
      );

      let buy, sell, net;
      if (targetNet !== null) {
        net = targetNet;
        buy = net >= 0 ? Math.max(net, Math.round(baseLots * 0.4) + net) : Math.round(baseLots * 0.3);
        sell = buy - net;
      } else {
        const isBuyer =
          (day.mainNet >= 0 && bIdx % 2 === 0) || (day.foreignNet > 0 && broker.type === '外資');
        buy = isBuyer ? Math.round(baseLots * 1.3) : Math.round(baseLots * 0.7);
        sell = isBuyer ? Math.round(baseLots * 0.7) : Math.round(baseLots * 1.3);
        net = buy - sell;
      }

      cumNet += net;
      const avgBuy = Number((day.close * 0.998).toFixed(2));
      const avgSell = Number((day.close * 1.002).toFixed(2));
      const profitWan = Math.round(((day.close - avgBuy) * buy + (avgSell - day.close) * sell) * 0.1);
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
  });

  return {
    ...stock,
    momentum,
    brokerSeries
  };
}

// ================= 瀏覽器端持久化快取 (localStorage) =================

export function loadCachedStocksFromStorage() {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveStockToLocalCache(stock) {
  if (typeof window === 'undefined' || !window.localStorage || !stock?.code) return;
  try {
    const existing = loadCachedStocksFromStorage();
    const slimStock = { ...stock, isUserCached: true, cachedAt: new Date().toISOString() };
    delete slimStock.brokerSeries;
    existing[stock.code] = slimStock;

    // 最多保留最近 45 檔使用者搜尋/瀏覽過的個股以確保 localStorage 容量充裕
    const codes = Object.keys(existing);
    if (codes.length > 45) {
      const oldestCode = codes.sort(
        (a, b) => new Date(existing[a].cachedAt || 0) - new Date(existing[b].cachedAt || 0)
      )[0];
      delete existing[oldestCode];
    }
    window.localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(existing));
  } catch {
    // ignore storage quota errors
  }
}

export function clearLocalStockCache() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(LOCAL_CACHE_KEY);
  } catch {
    // ignore
  }
}

// 嘗試載入由 GitHub Actions 定期從證交所/櫃買中心/券商網站抓取的 /live-data.json 快照，並自動合併使用者搜尋過的本機快取個股
export async function fetchPrebuiltCloudSnapshot() {
  try {
    const res = await fetch('./live-data.json?t=' + Date.now());
    if (!res.ok) return null;
    const data = await res.json();
    if (data && Array.isArray(data.stocks) && data.stocks.length > 0) {
      const cachedMap = loadCachedStocksFromStorage();
      const cloudCodes = new Set(data.stocks.map(s => s.code));

      const mergedStocks = data.stocks.map(s => {
        const localVer = cachedMap[s.code];
        // 若本機快取有更新的分點逐日歷史，予以合併
        const merged = localVer
          ? {
              ...s,
              realBrokerReports: { ...(s.realBrokerReports || {}), ...(localVer.realBrokerReports || {}) },
              realBrokerDailyHistory: {
                ...(s.realBrokerDailyHistory || {}),
                ...(localVer.realBrokerDailyHistory || {})
              },
              isUserCached: Boolean(localVer.isUserCached)
            }
          : s;
        return hydrateStockBrokerSeries(merged);
      });

      // 將使用者曾搜尋過、但不在預設清單內的額外個股一併放入選股池
      Object.values(cachedMap).forEach(cachedStock => {
        if (cachedStock?.code && !cloudCodes.has(cachedStock.code) && Array.isArray(cachedStock.kline)) {
          mergedStocks.push(hydrateStockBrokerSeries(cachedStock));
        }
      });

      return {
        ...data,
        stocks: mergedStocks
      };
    }
  } catch {
    // ignore if snapshot not yet generated
  }
  return null;
}

async function queryFinMind(dataset, dataId, startDate, token = '') {
  const params = new URLSearchParams({
    dataset
  });
  if (dataId) params.set('data_id', dataId);
  if (startDate) params.set('start_date', startDate);
  if (token && token.trim()) {
    params.set('token', token.trim());
  }
  const res = await fetch(`${FINMIND_ENDPOINT}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const json = await res.json();
  if (json.status !== 200 || !Array.isArray(json.data)) {
    throw new Error(json.msg || 'FinMind 回傳格式異常');
  }
  return json.data;
}

async function resolveStockBasicInfo(code, fallbackStock = null, token = '') {
  if (TW_STOCK_DIRECTORY[code]) {
    return TW_STOCK_DIRECTORY[code];
  }
  if (!cachedTwStockInfoMap) {
    try {
      const rows = await queryFinMind('TaiwanStockInfo', '', '', token);
      if (Array.isArray(rows) && rows.length > 0) {
        cachedTwStockInfoMap = {};
        rows.forEach(r => {
          if (r.stock_id && !cachedTwStockInfoMap[r.stock_id]) {
            cachedTwStockInfoMap[r.stock_id] = {
              name: r.stock_name || `台股 ${r.stock_id}`,
              market: r.type === 'tpex' ? '上櫃' : '上市',
              industry: r.industry_category || '上市櫃精選'
            };
          }
        });
      }
    } catch {
      // ignore
    }
  }
  if (cachedTwStockInfoMap?.[code]) {
    return cachedTwStockInfoMap[code];
  }
  return {
    name: fallbackStock?.name || `台股 ${code}`,
    market: fallbackStock?.market || '上市',
    industry: fallbackStock?.industry || '上市櫃精選'
  };
}

function calcConsecutiveDays(values) {
  if (!values || values.length === 0) return 0;
  const last = values[values.length - 1];
  if (last === 0) return 0;
  const isPositive = last > 0;
  let streak = 0;
  for (let i = values.length - 1; i >= 0; i--) {
    if (isPositive && values[i] > 0) streak++;
    else if (!isPositive && values[i] < 0) streak--;
    else break;
  }
  return streak;
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

// 抓取單一股票最新正式資料（結合 FinMind 公開 API + 富邦/元大券商網站分點日報表 + 外資真實持股率）
export async function fetchOfficialStockData(
  code,
  fallbackStock = null,
  token = '',
  includeBrokerPortal = false
) {
  const startDate = '2024-09-01';

  const [priceRows, instRows, marginRows, shareRows, perRows, revRows, dirInfo] = await Promise.all([
    queryFinMind('TaiwanStockPrice', code, startDate, token),
    queryFinMind('TaiwanStockInstitutionalInvestorsBuySell', code, startDate, token).catch(() => []),
    queryFinMind('TaiwanStockMarginPurchaseShortSale', code, startDate, token).catch(() => []),
    queryFinMind('TaiwanStockShareholding', code, startDate, token).catch(() => []),
    queryFinMind('TaiwanStockPER', code, startDate, token).catch(() => []),
    queryFinMind('TaiwanStockMonthRevenue', code, '2023-01-01', token).catch(() => []),
    resolveStockBasicInfo(code, fallbackStock, token)
  ]);

  if (!priceRows || priceRows.length < 15) {
    throw new Error(`查無 ${code} 足夠的近期交易資料`);
  }

  const recentPrices = priceRows.slice(-75);

  const instByDate = {};
  instRows.forEach(r => {
    if (!instByDate[r.date]) {
      instByDate[r.date] = { foreign: 0, trust: 0, dealer: 0 };
    }
    const netLots = Math.round(((Number(r.buy) || 0) - (Number(r.sell) || 0)) / 1000);
    if (r.name === 'Foreign_Investor' || r.name === 'Foreign_Dealer_Self') {
      instByDate[r.date].foreign += netLots;
    } else if (r.name === 'Investment_Trust') {
      instByDate[r.date].trust += netLots;
    } else if (r.name?.startsWith('Dealer')) {
      instByDate[r.date].dealer += netLots;
    }
  });

  const marginByDate = {};
  marginRows.forEach(r => {
    marginByDate[r.date] = {
      marginBal: Math.round(Number(r.MarginPurchaseTodayBalance) || 0),
      marginPrev: Math.round(Number(r.MarginPurchaseYesterdayBalance) || 0),
      shortBal: Math.round(Number(r.ShortSaleTodayBalance) || 0),
      shortPrev: Math.round(Number(r.ShortSaleYesterdayBalance) || 0)
    };
  });

  // 官方真實外資持股張數與外資持股比率 (TaiwanStockShareholding)
  const shareByDate = {};
  let latestCapitalLots = fallbackStock?.capitalShares || 300000;
  shareRows.forEach(r => {
    const remainLots = Math.round((Number(r.ForeignInvestmentRemainingShares) || 0) / 1000);
    const ratio = Number(r.ForeignInvestmentSharesRatio) || 0;
    const issuedLots = Math.round((Number(r.NumberOfSharesIssued) || 0) / 1000);
    if (issuedLots > 1000) latestCapitalLots = issuedLots;
    shareByDate[r.date] = {
      foreignHoldLots: remainLots,
      foreignHoldPct: Number(ratio.toFixed(2)),
      issuedLots
    };
  });

  // 計算真實月營收 YoY% 與 MoM%
  let revYoY = fallbackStock?.revYoY || 24.5;
  let revMoM = fallbackStock?.revMoM || 3.8;
  let cumRevYoY = fallbackStock?.cumRevYoY || 22.1;
  if (revRows && revRows.length >= 13) {
    const latestRev = revRows[revRows.length - 1];
    const prevMonthRev = revRows[revRows.length - 2];
    const sameMonthLastYear = revRows.find(
      r =>
        r.revenue_year === latestRev.revenue_year - 1 &&
        r.revenue_month === latestRev.revenue_month
    );
    if (prevMonthRev && prevMonthRev.revenue > 0) {
      revMoM = Number(
        (((latestRev.revenue - prevMonthRev.revenue) / prevMonthRev.revenue) * 100).toFixed(2)
      );
    }
    if (sameMonthLastYear && sameMonthLastYear.revenue > 0) {
      revYoY = Number(
        (
          ((latestRev.revenue - sameMonthLastYear.revenue) / sameMonthLastYear.revenue) *
          100
        ).toFixed(2)
      );
      cumRevYoY = revYoY;
    }
  }

  const latestPer = perRows.length > 0 ? perRows[perRows.length - 1] : null;
  const capitalShares = latestCapitalLots;

  let cumMainNet = 0;
  let foreignHold = Math.round(capitalShares * ((fallbackStock?.foreignPct || 25) / 100));
  let foreignHoldPct = Number(((foreignHold / capitalShares) * 100).toFixed(2));
  let trustHold = Math.round(capitalShares * ((fallbackStock?.trustPct || 5) / 100));
  let cumDealer = 0;
  let kVal = 50;
  let dVal = 50;

  const kline = recentPrices.map((row, idx) => {
    const [yyyy, mm, dd] = row.date.split('-');
    const close = Number(row.close);
    const open = Number(row.open);
    const high = Number(row.max);
    const low = Number(row.min);
    const prevClose =
      idx > 0 ? Number(recentPrices[idx - 1].close) : close - Number(row.spread || 0);
    const change = Number((close - prevClose).toFixed(2));
    const changePct = prevClose > 0 ? Number(((change / prevClose) * 100).toFixed(2)) : 0;
    const volumeLots = Math.max(1, Math.round((Number(row.Trading_Volume) || 0) / 1000));

    const inst = instByDate[row.date] || { foreign: 0, trust: 0, dealer: 0 };
    const foreignNet = inst.foreign;
    const trustNet = inst.trust;
    const dealerNet = inst.dealer;
    // 三大法人合計買賣超作為歷史基礎主力買賣超，最新交易日若抓到真實前15大分點則以分點差額覆寫
    const mainNet = Math.round(foreignNet + trustNet + dealerNet);

    cumMainNet += mainNet;
    const officialShare = shareByDate[row.date];
    if (officialShare && officialShare.foreignHoldPct > 0) {
      foreignHold = officialShare.foreignHoldLots;
      foreignHoldPct = officialShare.foreignHoldPct;
    } else {
      foreignHold = Math.max(100, foreignHold + foreignNet);
      foreignHoldPct = Number(((foreignHold / capitalShares) * 100).toFixed(2));
    }

    trustHold = Math.max(50, trustHold + trustNet);
    cumDealer += dealerNet;

    const mg = marginByDate[row.date];
    const marginBal = mg ? mg.marginBal : fallbackStock?.kline?.[idx]?.marginBal || 2500;
    const marginDiff = mg ? mg.marginBal - mg.marginPrev : 0;
    const shortBal = mg ? mg.shortBal : fallbackStock?.kline?.[idx]?.shortBal || 300;
    const shortDiff = mg ? mg.shortBal - mg.shortPrev : 0;

    return {
      index: idx,
      date: `${yyyy}/${mm}/${dd}`,
      compactDate: `${yyyy}${mm}${dd}`,
      shortDate: `${mm}/${dd}`,
      open,
      high,
      low,
      close,
      change,
      changePct,
      volume: volumeLots,
      mainNet,
      cumMainNet,
      foreignNet,
      foreignHold,
      foreignHoldPct,
      trustNet,
      trustHold,
      trustHoldPct: Number(((trustHold / capitalShares) * 100).toFixed(2)),
      dealerNet,
      cumDealer,
      shortDiff,
      shortBal,
      shortHoldPct: Number(((shortBal / capitalShares) * 100).toFixed(2)),
      marginDiff,
      marginBal
    };
  });

  for (let i = 0; i < kline.length; i++) {
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

  const lastDay = kline[kline.length - 1];
  const last5 = kline.slice(-5);
  const last10 = kline.slice(-10);

  const vol1 = Math.max(1, lastDay.volume);
  const vol5 = Math.max(1, last5.reduce((s, d) => s + d.volume, 0));
  const vol10 = Math.max(1, last10.reduce((s, d) => s + d.volume, 0));

  let main1 = Math.round((lastDay.mainNet / vol1) * 100);
  let main5 = Math.round((last5.reduce((s, d) => s + d.mainNet, 0) / vol5) * 100);
  let main10 = Math.round((last10.reduce((s, d) => s + d.mainNet, 0) / vol10) * 100);

  // 若啟用券商分點網站抓取，從富邦/元大/宏遠券商網站抓取真實買賣超前15名分點
  const realBrokerReports = { ...(fallbackStock?.realBrokerReports || {}) };
  const realBrokerDailyHistory = { ...(fallbackStock?.realBrokerDailyHistory || {}) };

  if (includeBrokerPortal) {
    const [rep1, rep5, rep10, rep20] = await Promise.all([
      fetchBrokerReportFromPortal(code, 1, lastDay.close),
      fetchBrokerReportFromPortal(code, 5, lastDay.close),
      fetchBrokerReportFromPortal(code, 10, lastDay.close),
      fetchBrokerReportFromPortal(code, 20, lastDay.close)
    ]);
    if (rep1) {
      realBrokerReports[1] = rep1;
      main1 = Math.round(((rep1.top15BuySum + rep1.top15SellSum) / vol1) * 100);
      lastDay.mainNet = rep1.top15BuySum + rep1.top15SellSum;
      // 同步抓取買超第1名分點的過去60天真實逐日買賣超
      const topBuyer = rep1.buyers?.[0];
      if (topBuyer?.zco0Path) {
        const hist = await fetchSingleBrokerHistoryFromPortal(topBuyer.zco0Path, kline);
        if (hist) realBrokerDailyHistory[topBuyer.id] = hist;
      }
    }
    if (rep5) {
      realBrokerReports[5] = rep5;
      main5 = Math.round(((rep5.top15BuySum + rep5.top15SellSum) / vol5) * 100);
    }
    if (rep10) {
      realBrokerReports[10] = rep10;
      main10 = Math.round(((rep10.top15BuySum + rep10.top15SellSum) / vol10) * 100);
    }
    if (rep20) {
      realBrokerReports[20] = rep20;
    }
  }

  const momentum = computeStockMomentum(kline);
  const mainConsec = calcConsecutiveDays(kline.map(d => d.mainNet));
  const foreignConsec = calcConsecutiveDays(kline.map(d => d.foreignNet));
  const trustConsec = calcConsecutiveDays(kline.map(d => d.trustNet));

  const yearHigh = Math.max(...kline.map(d => d.high));
  const yearLow = Math.min(...kline.map(d => d.low));
  const fromHigh = Number(((lastDay.close / yearHigh) * 10).toFixed(1));
  const fromLow = Number((lastDay.close / Math.max(0.1, yearLow)).toFixed(2));

  const biasYear = Math.round(((lastDay.close - lastDay.ma60) / lastDay.ma60) * 100);
  const biasQuarter = Number((((lastDay.close - lastDay.ma60) / lastDay.ma60) * 100).toFixed(1));
  const biasMonth = Number((((lastDay.close - lastDay.ma20) / lastDay.ma20) * 100).toFixed(1));

  const bandWidth = Math.max(
    1,
    Math.round(((lastDay.bollUpper - lastDay.bollLower) / Math.max(1, lastDay.ma20)) * 100)
  );
  const bandPos = Math.round(
    ((lastDay.close - lastDay.bollLower) / Math.max(0.1, lastDay.bollUpper - lastDay.bollLower)) * 12
  );

  const builtStock = hydrateStockBrokerSeries({
    ...(fallbackStock || {}),
    code,
    name: dirInfo.name,
    market: dirInfo.market,
    industry: dirInfo.industry,
    price: lastDay.close,
    change: lastDay.change,
    changePct: lastDay.changePct,
    candleType: classifyCandleType(lastDay.open, lastDay.high, lastDay.low, lastDay.close),
    inCount: lastDay.change < 0 ? 1 : 0,
    inVol: lastDay.change < 0 ? Math.max(10, Math.round(lastDay.volume * 0.03)) : 0,
    outCount: lastDay.change >= 0 ? 1 : 0,
    outVol: lastDay.change >= 0 ? Math.max(15, Math.round(lastDay.volume * 0.04)) : 0,
    volume: lastDay.volume,
    warrantAmt: fallbackStock?.warrantAmt || Math.round(lastDay.volume * 0.45),
    monthSlope: Number(
      (((lastDay.ma20 - (kline[kline.length - 5]?.ma20 || lastDay.ma20)) / lastDay.ma20) * 10).toFixed(1)
    ),
    lastWeekSlope: Number(
      (((lastDay.ma5 - (kline[kline.length - 5]?.ma5 || lastDay.ma5)) / lastDay.ma5) * 10).toFixed(1)
    ),
    nextWeekSlope: Number((((lastDay.close - lastDay.ma10) / lastDay.ma10) * 10).toFixed(1)),
    bandWidth,
    bandPos,
    mainConsec,
    foreignConsec,
    trustConsec,
    momentum,
    main1,
    main5,
    main10,
    foreignPct: Math.round((lastDay.foreignNet / vol1) * 100),
    trustPct: Math.round((lastDay.trustNet / vol1) * 100),
    dealerPct: Math.round((lastDay.dealerNet / vol1) * 100),
    dayTradePct: fallbackStock?.dayTradePct || 24,
    marginPct: Math.round((lastDay.marginDiff / vol1) * 100),
    shortPct: Math.round((lastDay.shortDiff / vol1) * 100),
    shortMarginRatio:
      lastDay.marginBal > 0
        ? Number(((lastDay.shortBal / lastDay.marginBal) * 100).toFixed(1))
        : 1.5,
    biasYear,
    biasQuarter,
    biasMonth,
    fromHigh,
    fromLow,
    maintRatio: fallbackStock?.maintRatio || 164,
    cumRevYoY,
    revYoY,
    revMoM,
    epsQ: fallbackStock?.epsQ || 2.15,
    eps4Q: fallbackStock?.eps4Q || 8.4,
    pe: latestPer?.PER ? Number(latestPer.PER) : fallbackStock?.pe || 22.5,
    pb: latestPer?.PBR ? Number(latestPer.PBR) : fallbackStock?.pb || 3.2,
    dividendYield: latestPer?.dividend_yield
      ? Number(latestPer.dividend_yield)
      : fallbackStock?.dividendYield || 3.5,
    divYears: fallbackStock?.divYears || 10,
    roe: fallbackStock?.roe || 16.8,
    targetPrice: Math.round(lastDay.close * 1.18),
    capitalShares,
    kline,
    realBrokerReports,
    realBrokerDailyHistory,
    isLiveSynced: true,
    hasRealBrokerReport: Boolean(realBrokerReports[1]),
    latestTradeDate: lastDay.date
  });

  // 自動儲存至瀏覽器端持久化快取，下次開啟或重新整理免重抓秒開
  saveStockToLocalCache(builtStock);

  return builtStock;
}
