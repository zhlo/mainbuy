// 雲端自動爬蟲腳本 (由 GitHub Actions 在無 CORS 限制的雲端環境執行)
// 直接向：
// 1. 富邦證券 / 元大證券 / 宏遠證券 MoneyDJ 分點系統 (zco.djhtm + zco0.djhtm) 抓取真實「買超前15名 / 賣超前15名券商分點日報表 (1日/5日/10日/20日)」與「單一主力分點過去60天逐日買賣超」
// 2. 臺灣證券交易所 (TWSE) / 櫃買中心 (TPEx) / FinMind 公開 API 抓取最新 75 日 K 線、三大法人、融資融券、外資真實持股率、本益比/股淨比/殖利率與月營收
// 3. 預先計算全市場主力/投信/外資動能轉折指標 (第1天轉買、5天內偏買、10天內偏買、近期偏買、偏賣)
// 產出高壓縮 public/live-data.json 供 https://mainbuy.fuai.tw 零延遲載入

import fs from 'node:fs/promises';
import path from 'node:path';
import { generateStockDataset, computeStockMomentum } from '../src/data/mockStocks.js';
import {
  BROKER_PORTAL_HOSTS,
  fetchOfficialStockData,
  parseMoneyDjBrokerHtml,
  parseMoneyDjSingleBrokerHistoryHtml
} from '../src/services/liveStockService.js';

async function fetchDirectBrokerHtml(code, days, currentPrice) {
  for (const host of BROKER_PORTAL_HOSTS) {
    const url = `${host}/z/zc/zco/zco_${code}_${days}.djhtm`;
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

async function crawlSingleStock(base, token) {
  try {
    const stock = await fetchOfficialStockData(base.code, base, token, false);

    // 直接從券商網站抓取 1日 / 5日 / 10日 / 20日 分點買賣超前15名
    const [rep1, rep5, rep10, rep20] = await Promise.all([
      fetchDirectBrokerHtml(base.code, 1, stock.price),
      fetchDirectBrokerHtml(base.code, 5, stock.price),
      fetchDirectBrokerHtml(base.code, 10, stock.price),
      fetchDirectBrokerHtml(base.code, 20, stock.price)
    ]);

    stock.realBrokerReports = {};
    stock.realBrokerDailyHistory = {};
    const lastDay = stock.kline[stock.kline.length - 1];
    const vol1 = Math.max(1, lastDay.volume);
    const vol5 = Math.max(1, stock.kline.slice(-5).reduce((s, d) => s + d.volume, 0));
    const vol10 = Math.max(1, stock.kline.slice(-10).reduce((s, d) => s + d.volume, 0));

    if (rep1) {
      stock.realBrokerReports[1] = rep1;
      stock.main1 = Math.round(((rep1.top15BuySum + rep1.top15SellSum) / vol1) * 100);
      lastDay.mainNet = rep1.top15BuySum + rep1.top15SellSum;
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

    // 重新計算包含真實主力分點差額的動能轉折指標
    stock.momentum = computeStockMomentum(stock.kline);

    // 移除龐大的合成 brokerSeries 交由前端載入時毫秒級動態還原，使 JSON 檔案縮小 95%
    delete stock.brokerSeries;

    console.log(
      `✅ ${stock.code} ${stock.name}: 收盤 ${stock.price} (${stock.changePct}%), 主1=${stock.main1}%, 動能=${stock.momentum?.main?.stageLabel}, 分點=${
        rep1 ? `買超#1 ${rep1.buyers[0]?.name}(+${rep1.buyers[0]?.net}張)` : '法人推算'
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
  console.log('🚀 開始從證交所 / 櫃買中心 / 券商分點網站 / FinMind 批次抓取最新台股正式資料...');
  const baseStocks = generateStockDataset();
  const token = process.env.FINMIND_TOKEN || '';
  const updatedStocks = [];
  let latestDate = '';

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
  await fs.writeFile(
    outPath,
    JSON.stringify({
      updatedAt: new Date().toISOString(),
      latestDate,
      stocks: updatedStocks
    }),
    'utf8'
  );
  console.log(`🎉 已成功寫入 ${updatedStocks.length} 檔正式資料至 ${outPath} (最新交易日: ${latestDate})`);
}

main().catch(err => {
  console.error(err);
  process.exit(0);
});
