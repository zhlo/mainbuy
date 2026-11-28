import React, { useState } from 'react';
import { buildCustomProxyUrl } from '../services/liveStockService';

export default function DataSourceModal({
  isOpen,
  onClose,
  dataSourceConfig,
  onSaveConfig,
  onTriggerSync,
  syncState
}) {
  const [mode, setMode] = useState(dataSourceConfig.mode || 'live');
  const [finmindToken, setFinmindToken] = useState(dataSourceConfig.finmindToken || '');
  const [brokerProxyUrl, setBrokerProxyUrl] = useState(dataSourceConfig.brokerProxyUrl || '');
  const [refreshInterval, setRefreshInterval] = useState(dataSourceConfig.refreshInterval || 5);
  const [savedNotice, setSavedNotice] = useState(false);
  const [proxyTestStatus, setProxyTestStatus] = useState({ state: 'idle', msg: '' });

  if (!isOpen) return null;

  const handleTestProxy = async () => {
    const trimmed = brokerProxyUrl.trim();
    if (!trimmed) {
      setProxyTestStatus({ state: 'error', msg: '⚠️ 請先輸入 Cloudflare Worker 代理網址' });
      return;
    }
    setProxyTestStatus({ state: 'testing', msg: '⏳ 正在測試專屬分點代理連線 (以 2355 測試)...' });
    try {
      const testTarget = 'https://fubon-ebrokerdj.fbs.com.tw/z/zc/zco/zco_2355_1.djhtm';
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(buildCustomProxyUrl(trimmed, testTarget), {
        signal: controller.signal
      });
      clearTimeout(timer);
      if (!res.ok) {
        setProxyTestStatus({ state: 'error', msg: `❌ 代理回應異常 (HTTP ${res.status})` });
        return;
      }
      const buf = await res.arrayBuffer();
      const big5 = new TextDecoder('big5').decode(buf);
      const utf8 = new TextDecoder('utf-8').decode(buf);
      if (big5.includes('買超券商') || utf8.includes('買超券商')) {
        setProxyTestStatus({
          state: 'ok',
          msg: '✅ 代理連線成功！已成功解碼官方真實分點日報表（全台股 1,900+ 檔皆可即時查分點）'
        });
      } else {
        setProxyTestStatus({
          state: 'error',
          msg: '⚠️ 連線有回應但未偵測到券商分點表格，請確認 Worker 程式碼是否正確部署'
        });
      }
    } catch (err) {
      setProxyTestStatus({
        state: 'error',
        msg: `❌ 無法連線至代理網址：${err?.message || '網路或 CORS 錯誤'}`
      });
    }
  };

  const handleSave = () => {
    onSaveConfig({
      mode,
      finmindToken: finmindToken.trim(),
      brokerProxyUrl: brokerProxyUrl.trim(),
      refreshInterval: Number(refreshInterval)
    });
    if (mode === 'live' && onTriggerSync) {
      onTriggerSync();
    }
    setSavedNotice(true);
    setTimeout(() => {
      setSavedNotice(false);
      onClose();
    }, 600);
  };

  return (
    <div className="modal-backdrop" onClick={onClose} id="datasource-modal-backdrop">
      <div className="modal-panel" onClick={e => e.stopPropagation()} id="datasource-modal-panel">
        <div className="modal-header">
          <div>
            <h2 className="modal-title">⚙️ 台股正式資料來源與專屬分點代理設定</h2>
            <p className="modal-subtitle">
              雲端精選股每日自動同步真實分點；設定專屬 Cloudflare Worker 代理即可於瀏覽器任意查詢全台股 1,900+ 檔即時分點
            </p>
          </div>
          <button className="btn-icon-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="formula-grid">
            <div
              className={`formula-card selectable-card ${mode === 'live' ? 'card-active' : ''}`}
              onClick={() => setMode('live')}
            >
              <div className="formula-card-title">
                <input type="radio" checked={mode === 'live'} onChange={() => setMode('live')} />{' '}
                🟢 模式 A：自動抓取台股最新正式公開資料（預設啟用）
              </div>
              <p className="formula-desc">
                優先載入 GitHub Actions 雲端快照，並支援連線 FinMind 台股公開資料庫與券商分點網站，於頂部輸入任意 4 碼台股代號即時查詢與快取。
              </p>
            </div>

            <div
              className={`formula-card selectable-card ${mode === 'simulated' ? 'card-active' : ''}`}
              onClick={() => setMode('simulated')}
            >
              <div className="formula-card-title">
                <input type="radio" checked={mode === 'simulated'} onChange={() => setMode('simulated')} />{' '}
                📦 模式 B：固定參考基準資料（離線對照模式）
              </div>
              <p className="formula-desc">
                離線對照模式，適合無網路環境檢視操作介面與欄位公式計算。
              </p>
            </div>
          </div>

          {/* 專屬 Cloudflare Worker 分點代理設定 */}
          <div className="formula-calculator-box" style={{ marginBottom: '16px' }}>
            <div className="calc-header">
              <span className="calc-badge">推薦設定</span>
              <strong>🌐 專屬券商分點代理網址（Cloudflare Worker Proxy URL）</strong>
            </div>
            <div style={{ padding: '10px 14px', fontSize: '13px', lineHeight: '1.6', color: '#cbd5e1' }}>
              <div style={{ marginBottom: '8px' }}>
                公開免費 CORS 代理常因限流或 403 失效，導致非雲端預抓個股查無分點。請貼上您部署於 Cloudflare Workers 的專屬代理網址（專案內已附 <code>cloudflare-worker/broker-proxy.js</code>），設定後全市場任意 4 碼台股皆可秒查 1/5/10/20 日與 60 日真實分點：
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="url"
                  placeholder="例：https://mainbuy-broker-proxy.your-account.workers.dev"
                  value={brokerProxyUrl}
                  onChange={e => {
                    setBrokerProxyUrl(e.target.value);
                    if (proxyTestStatus.state !== 'idle') setProxyTestStatus({ state: 'idle', msg: '' });
                  }}
                  style={{
                    flex: '1 1 260px',
                    height: '38px',
                    padding: '0 10px',
                    borderRadius: '6px',
                    border: '1px solid #475569',
                    background: '#0f172a',
                    color: '#f8fafc',
                    fontSize: '13px'
                  }}
                  id="input-broker-proxy-url"
                />
                <button
                  type="button"
                  className="btn-toolbar-action blue-text"
                  onClick={handleTestProxy}
                  disabled={proxyTestStatus.state === 'testing'}
                  style={{ height: '38px', padding: '0 14px', borderRadius: '6px' }}
                  id="btn-test-broker-proxy"
                >
                  {proxyTestStatus.state === 'testing' ? '測試中...' : '🧪 測試連線'}
                </button>
              </div>
              {proxyTestStatus.msg && (
                <div
                  style={{
                    marginTop: '8px',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    fontSize: '12.5px',
                    background:
                      proxyTestStatus.state === 'ok'
                        ? 'rgba(34, 197, 94, 0.16)'
                        : proxyTestStatus.state === 'error'
                          ? 'rgba(239, 68, 68, 0.16)'
                          : 'rgba(56, 189, 248, 0.14)',
                    color:
                      proxyTestStatus.state === 'ok'
                        ? '#86efac'
                        : proxyTestStatus.state === 'error'
                          ? '#fca5a5'
                          : '#7dd3fc'
                  }}
                >
                  {proxyTestStatus.msg}
                </div>
              )}
            </div>
          </div>

          <div className="formula-calculator-box">
            <div className="calc-header">
              <span className="calc-badge">進階選填</span>
              <strong>FinMind API Token（提高連線額度）</strong>
              {syncState?.latestDate && (
                <span className="calc-hint">目前最新同步交易日：{syncState.latestDate}</span>
              )}
            </div>
            <div className="calc-inputs">
              <label className="calc-field">
                <span>FinMind API Token (免填即可抓股價與法人)</span>
                <input
                  type="password"
                  placeholder="選填：輸入 FinMind Token..."
                  value={finmindToken}
                  onChange={e => setFinmindToken(e.target.value)}
                />
              </label>
              <label className="calc-field">
                <span>盤中自動刷價週期 (秒)</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={refreshInterval}
                  onChange={e => setRefreshInterval(e.target.value)}
                />
              </label>
              <div className="calc-field">
                <button className="btn-save-strategy" onClick={handleSave} style={{ height: '36px' }}>
                  {savedNotice ? '✓ 已儲存並同步' : '儲存並立即同步正式資料'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
