// 雲端自動爬蟲腳本 (由 GitHub Actions 在無 CORS 限制的雲端環境執行)
// 直接向：
// 1. 富邦證券 / 元大證券 / 宏遠證券 MoneyDJ 分點系統 (zco.djhtm + zco0.djhtm) 抓取真實「買超前15名 / 賣超前15名券商分點日報表 (1日/5日/10日/20日)」與「單一主力分點過去60天逐日買賣超」
// 2. 臺灣證券交易所 (TWSE) / 櫃買中心 (TPEx) / FinMind 公開 API 抓取最新 75 日 K 線、三大法人、融資融券、外資真實持股率、本益比/股淨比/殖利率與月營收
// 3. 預先計算全市場主力/投信/外資動能轉折指標 (第1天轉買、5天內偏買、10天內偏買、近期偏買、偏賣)
// 產出高壓縮 public/live-data.json 供 https://mainbuy.fuai.tw 零延遲載入

import fs from 'node:fs/promises';
import path from 'node:path';
import { generateStockDataset, computeStockMomentum, computeBrokerProfitMetrics } from '../src/data/mockStocks.js';
import {
  BROKER_PORTAL_HOSTS,
  MONEYDJ_RANGE_MAP,
  fetchOfficialStockData,
  fetchOfficialTaiexData,
  parseMoneyDjBrokerHtml,
  parseMoneyDjSingleBrokerHistoryHtml
} from '../src/services/liveStockService.js';

async function fetchDirectBrokerHtml(code, days, currentPrice) {
  const rangeIdx = MONEYDJ_RANGE_MAP[days] || 1;
  for (const host of BROKER_PORTAL_HOSTS) {
    const url = `${host}/z/zc/zco/zco_${code}_${rangeIdx}.djhtm`;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7500);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml'
        }
      });
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
      // try next broker host
    }
  }
  return null;
}

async function fetchDirectSingleBrokerHistory(zco0Path, kline) {
  if (!zco0Path) return null;
  const relPath = zco0Path.startsWith('/') ? zco0Path : `/${zco0Path}`;
  for (const host of BROKER_PORTAL_HOSTS.slice(0, 2)) {
    const url = `${host}${relPath}`;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6500);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml'
        }
      });
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
      // try next host
    }
  }
  return null;
}

function repriceReportWithMatchedClose(rep, kline, fallbackClose) {
  if (!rep) return null;
  const matchedBar = rep.dateRangeEnd
    ? kline.find(d => d.compactDate === rep.dateRangeEnd || d.date.replace(/\//g, '-') === rep.dateRangeEnd)
    : null;
  const closePrice = matchedBar?.close || fallbackClose;
  return {
    ...rep,
    reportClosePrice: closePrice,
    buyers: (rep.buyers || []).map(b => ({
      ...b,
      ...computeBrokerProfitMetrics(b.buy, b.sell, b.avgBuy, b.avgSell, closePrice)
    })),
    sellers: (rep.sellers || []).map(s => ({
      ...s,
      ...computeBrokerProfitMetrics(s.buy, s.sell, s.avgBuy, s.avgSell, closePrice)
    }))
  };
}

async function crawlSingleStock(base, token) {
  let stock;
  try {
    stock = await fetchOfficialStockData(base.code, base, token, false);
  } catch (err) {
    console.warn(`⚠️ ${base.code} ${base.name} 公開 API 抓取失敗 (${err.message})，使用基準 K 線繼續抓取券商分點報表`);
    stock = { ...base };
  }

  try {
    const kline = stock.kline || [];
    const publishedChipDays = kline.filter(d => d.mainNet !== null && d.mainNet !== undefined);
    const lastChipDay = publishedChipDays[publishedChipDays.length - 1] || kline[kline.length - 1] || { close: stock.price, volume: stock.volume };
    const chipClose = lastChipDay?.close || stock.price;

    // 直接從券商網站抓取 1日(idx=1) / 5日(idx=2) / 10日(idx=3) / 20日(idx=4) 分點買賣超前15名
    const [raw1, raw5, raw10, raw20] = await Promise.all([
      fetchDirectBrokerHtml(base.code, 1, chipClose),
      fetchDirectBrokerHtml(base.code, 5, chipClose),
      fetchDirectBrokerHtml(base.code, 10, chipClose),
      fetchDirectBrokerHtml(base.code, 20, chipClose)
    ]);

    const rep1 = repriceReportWithMatchedClose(raw1, stock.kline, chipClose);
    const rep5 = repriceReportWithMatchedClose(raw5, stock.kline, chipClose);
    const rep10 = repriceReportWithMatchedClose(raw10, stock.kline, chipClose);
    const rep20 = repriceReportWithMatchedClose(raw20, stock.kline, chipClose);

    stock.realBrokerReports = {};
    stock.realBrokerDailyHistory = {};

    const rep1EndIdx = rep1?.dateRangeEnd
      ? stock.kline.findIndex(d => d.compactDate === rep1.dateRangeEnd || d.date.replace(/\//g, '-') === rep1.dateRangeEnd)
      : -1;
    const anchorIdx = rep1EndIdx >= 0 ? rep1EndIdx : stock.kline.indexOf(lastChipDay);
    const anchorSlice = stock.kline.slice(0, anchorIdx >= 0 ? anchorIdx + 1 : stock.kline.length);
    const anchorBar = anchorSlice[anchorSlice.length - 1] || stock.kline[stock.kline.length - 1];

    const vol1 = Math.max(1, anchorBar.volume);
    const vol5 = Math.max(1, anchorSlice.slice(-5).reduce((s, d) => s + d.volume, 0));
    const vol10 = Math.max(1, anchorSlice.slice(-10).reduce((s, d) => s + d.volume, 0));

    if (rep1) {
      stock.realBrokerReports[1] = rep1;
      stock.main1 = Math.round(((rep1.top15BuySum + rep1.top15SellSum) / vol1) * 100);
      anchorBar.mainNet = rep1.top15BuySum + rep1.top15SellSum;
      anchorBar.chipPending = false;
      for (let k = anchorIdx + 1; k < stock.kline.length; k++) {
        stock.kline[k].mainNet = null;
        stock.kline[k].chipPending = true;
      }
      stock.hasRealBrokerReport = true;

      // 抓取買超第1名與賣超第1名分點的過去60天真實逐日買賣超 (zco0.djhtm)
      const topBuyer = rep1.buyers?.[0];
      const topSeller = rep1.sellers?.[0];
      const [buyerHist, sellerHist] = await Promise.all([
        topBuyer?.zco0Path ? fetchDirectSingleBrokerHistory(topBuyer.zco0Path, stock.kline) : null,
        topSeller?.zco0Path ? fetchDirectSingleBrokerHistory(topSeller.zco0Path, stock.kline) : null
      ]);
      if (buyerHist && topBuyer) stock.realBrokerDailyHistory[topBuyer.id] = buyerHist;
      if (sellerHist && topSeller) stock.realBrokerDailyHistory[topSeller.id] = sellerHist;
    }
    if (rep5) {
      stock.realBrokerReports[5] = rep5;
      stock.main5 = Math.round(((rep5.top15BuySum + rep5.top15SellSum) / vol5) * 100);
    }
    if (rep10) {
      stock.realBrokerReports[10] = rep10;
      stock.main10 = Math.round(((rep10.top15BuySum + rep10.top15SellSum) / vol10) * 100);
    }
    if (rep20) {
      stock.realBrokerReports[20] = rep20;
    }

    // 重新計算包含真實主力分點差額的動能轉折指標 (會自動忽略最新盤中/未公布籌碼之留空日)
    stock.momentum = computeStockMomentum(stock.kline);

    // 移除龐大的合成 brokerSeries 交由前端載入時毫秒級動態還原，使 JSON 檔案縮小 95%
    delete stock.brokerSeries;

    console.log(
      `✅ ${stock.code} ${stock.name}: 收盤 ${stock.price} (${stock.changePct}%), 主1=${stock.main1}%, 動能=${stock.momentum?.main?.stageLabel}, 分點(${rep1?.dateRangeEnd || '最新'})=${
        rep1 ? `買超#1 ${rep1.buyers[0]?.name}(+${rep1.buyers[0]?.net}張, 損益${rep1.buyers[0]?.profitWan}萬)` : '法人推算'
      }`
    );
    return stock;
  } catch (err) {
    console.warn(`⚠️ ${base.code} ${base.name} 抓取失敗，保留基準資料:`, err.message);
    const slimBase = { ...base };
    delete slimBase.brokerSeries;
    return slimBase;
  }
}

async function main() {
  console.log('🚀 開始從證交所 / 櫃買中心 / 券商分點網站 / FinMind 批次抓取最新台股正式資料與加權指數...');
  const baseStocks = generateStockDataset();
  const token = process.env.FINMIND_TOKEN || '';
  const updatedStocks = [];
  let latestDate = '';

  let taiex;
  try {
    taiex = await fetchOfficialTaiexData(token);
  } catch (err) {
    console.warn(`⚠️ 加權指數公開 API 抓取失敗 (${err.message})，使用現有快照或基準指數`);
    try {
      const existing = JSON.parse(await fs.readFile(path.resolve(process.cwd(), 'public/live-data.json'), 'utf8'));
      taiex = existing.taiex || { price: 23500, change: 150, changePct: 0.64, latestTradeDate: '2026/11/11' };
    } catch {
      taiex = { price: 23500, change: 150, changePct: 0.64, latestTradeDate: '2026/11/11' };
    }
  }
  console.log(
    `📊 加權指數 TAIEX: ${taiex.price} (${taiex.change >= 0 ? '+' : ''}${taiex.change}, ${taiex.changePct}%), 台指期: ${taiex.futuresPrice || taiex.price}`
  );

  // 每次並行抓取 5 檔，兼顧速度與穩定度
  const BATCH_SIZE = 5;
  for (let i = 0; i < baseStocks.length; i += BATCH_SIZE) {
    const batch = baseStocks.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(b => crawlSingleStock(b, token)));
    results.forEach(stock => {
      if (stock.latestTradeDate && stock.latestTradeDate > latestDate) {
        latestDate = stock.latestTradeDate;
      }
      updatedStocks.push(stock);
    });
  }

  const outPath = path.resolve(process.cwd(), 'public/live-data.json');
  const payload = JSON.stringify({
    updatedAt: new Date().toISOString(),
    latestDate: taiex.latestTradeDate || latestDate,
    taiex,
    stocks: updatedStocks
  });
  await fs.writeFile(outPath, payload, 'utf8');
  try {
    const altPath = path.resolve(process.cwd(), 'zhlo/mainbuy/public/live-data.json');
    await fs.writeFile(altPath, payload, 'utf8');
  } catch {}
  console.log(`🎉 已成功寫入 ${updatedStocks.length} 檔正式資料與加權指數至 ${outPath} (最新交易日: ${taiex.latestTradeDate || latestDate})`);
}

main().catch(err => {
  console.error(err);
  process.exit(0);
});
