import React, { useState } from 'react';

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
  const [refreshInterval, setRefreshInterval] = useState(dataSourceConfig.refreshInterval || 5);
  const [savedNotice, setSavedNotice] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveConfig({
      mode,
      finmindToken,
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
            <h2 className="modal-title">⚙️ 台股正式資料來源與 API 串接設定</h2>
            <p className="modal-subtitle">
              預設已開啟 FinMind 台股公開 API 直連，自動抓取最新交易日之正式 K 線、三大法人買賣超、融資融券與本益比/股淨比
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
                直接從瀏覽器連線 FinMind 台股公開資料庫（免金鑰即可查詢 `TaiwanStockPrice` 日K線、`TaiwanStockInstitutionalInvestorsBuySell` 三大法人買賣超、`TaiwanStockMarginPurchaseShortSale` 融資融券、`TaiwanStockPER` 本益比/股淨比/殖利率），並支援在頂部輸入任意 4 碼台股代號即時抓取！
              </p>
            </div>

            <div
              className={`formula-card selectable-card ${mode === 'simulated' ? 'card-active' : ''}`}
              onClick={() => setMode('simulated')}
            >
              <div className="formula-card-title">
                <input type="radio" checked={mode === 'simulated'} onChange={() => setMode('simulated')} />{' '}
                📦 模式 B：固定參考截圖基準資料（離線對照模式）
              </div>
              <p className="formula-desc">
                鎖定參考截圖 1 與截圖 2（2049 上銀 403.5 元、玉山-城中、美林等分點）之精準基準數值，適合離線展示或與原始截圖逐欄對照。
              </p>
            </div>
          </div>

          <div className="formula-calculator-box">
            <div className="calc-header">
              <span className="calc-badge">進階選填</span>
              <strong>FinMind API Token（提高連線額度 / 解鎖進階分點日報表）</strong>
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
