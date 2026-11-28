/**
 * MainBuy 主力雷達 — 專屬券商分點 & Yahoo K線 Cloudflare Worker 代理
 *
 * 部署方式（免費方案每日 100,000 次請求，3 分鐘完成）：
 * 1. 登入 Cloudflare Dashboard -> Workers & Pages -> Create -> Create Worker
 * 2. 命名為 mainbuy-broker-proxy -> 點 Deploy -> 點 Edit code
 * 3. 將本檔案全文貼上並點右上角 Deploy
 * 4. 複製產生的網址（例如 https://mainbuy-broker-proxy.你的帳號.workers.dev）
 * 5. 回到 https://mainbuy.fuai.tw/ -> 點「⚙️ 資料源」-> 貼上「專屬分點代理網址」並儲存即可！
 */

const ALLOWED_TARGET_HOSTS = new Set([
  'fubon-ebrokerdj.fbs.com.tw',
  'jdata.yuanta.com.tw',
  'concords.moneydj.com',
  'stockchannelnew.wls.com.tw',
  'query1.finance.yahoo.com',
  'query2.finance.yahoo.com'
]);

const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/mainbuy\.fuai\.tw$/i,
  /^http:\/\/localhost(:\d+)?$/i,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/i
];

function getCorsOrigin(request) {
  const origin = request.headers.get('Origin') || '';
  if (ALLOWED_ORIGIN_PATTERNS.some(re => re.test(origin))) {
    return origin;
  }
  return 'https://mainbuy.fuai.tw';
}

function buildCorsHeaders(request, extra = {}) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
    ...extra
  };
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // 處理瀏覽器 CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: buildCorsHeaders(request)
      });
    }

    if (request.method !== 'GET') {
      return new Response(JSON.stringify({ ok: false, error: 'Method Not Allowed' }), {
        status: 405,
        headers: buildCorsHeaders(request, { 'Content-Type': 'application/json; charset=utf-8' })
      });
    }

    // 健康檢查端點：GET /health
    if (url.pathname === '/health' || url.pathname === '/ping') {
      return new Response(
        JSON.stringify({
          ok: true,
          service: 'mainbuy-broker-proxy',
          allowedHosts: Array.from(ALLOWED_TARGET_HOSTS),
          timestamp: new Date().toISOString()
        }),
        {
          status: 200,
          headers: buildCorsHeaders(request, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store'
          })
        }
      );
    }

    const targetParam = url.searchParams.get('url');
    if (!targetParam) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Missing required query parameter: ?url=<encoded_url>'
        }),
        {
          status: 400,
          headers: buildCorsHeaders(request, { 'Content-Type': 'application/json; charset=utf-8' })
        }
      );
    }

    let targetUrl;
    try {
      targetUrl = new URL(targetParam);
    } catch {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid target URL' }), {
        status: 400,
        headers: buildCorsHeaders(request, { 'Content-Type': 'application/json; charset=utf-8' })
      });
    }

    // 嚴格白名單校驗，防止成為開放式代理遭濫用
    if (targetUrl.protocol !== 'https:' || !ALLOWED_TARGET_HOSTS.has(targetUrl.hostname)) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: `Host not allowed: ${targetUrl.hostname}`
        }),
        {
          status: 403,
          headers: buildCorsHeaders(request, { 'Content-Type': 'application/json; charset=utf-8' })
        }
      );
    }

    try {
      const upstreamRes = await fetch(targetUrl.toString(), {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
          Referer: `${targetUrl.origin}/`
        },
        cf: {
          // 邊緣快取 5 分鐘，兼顧盤後更新速度與極致回應速度
          cacheTtl: 300,
          cacheEverything: true
        }
      });

      // 原封不動透傳二進位位元組（保留券商網頁原始 Big5 編碼，避免中文券商名稱亂碼）
      const bodyBuffer = await upstreamRes.arrayBuffer();
      const contentType =
        upstreamRes.headers.get('Content-Type') || 'text/html; charset=big5';

      return new Response(bodyBuffer, {
        status: upstreamRes.status,
        headers: buildCorsHeaders(request, {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=180'
        })
      });
    } catch (err) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: `Upstream fetch failed: ${err?.message || String(err)}`
        }),
        {
          status: 502,
          headers: buildCorsHeaders(request, { 'Content-Type': 'application/json; charset=utf-8' })
        }
      );
    }
  }
};
