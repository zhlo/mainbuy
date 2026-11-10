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

          {/* 散戶動向與欄位計算模型說明卡片 */}
          <div className="formula-calculator-box" style={{ marginBottom: '16px' }}>
            <div className="calc-header">
              <span className="calc-badge">數據來源說明</span>
              <strong>👥 散戶動向與主力選股指標之精準度與計算依據</strong>
            </div>
            <div style={{ padding: '10px 14px', fontSize: '13px', lineHeight: '1.7', color: '#cbd5e1' }}>
              <div>
                <strong style={{ color: '#38bdf8' }}>1. 散戶動向數據來源：</strong>
                台灣證券交易所 (TWSE) 官方每日公布三大法人與信用交易，並無官方散戶報表。本系統採市場通用量化模型：
                <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px', color: '#f59e0b' }}>
                  大盤散戶指標 = -(三大法人買賣超 × 0.55) + 融資餘額增減
                </code>
                ，個股散戶指標則以各股融資增減結合三大法人與主力大戶對作部位計算，真實反映散戶追高槓桿與接刀動向。
              </div>
              <div style={{ marginTop: '8px' }}>
                <strong style={{ color: '#38bdf8' }}>2. 主1、主5、主10：</strong>
                嚴格依照證券公會與券商分點報表計算：
                <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px', color: '#34d399' }}>
                  (區間Top15買超總量 - 區間Top15賣超總量) / 區間總成交量 × 100%
                </code>
                ，由官方每日分點成交明細精算。
              </div>
              <div style={{ marginTop: '8px' }}>
                <strong style={{ color: '#38bdf8' }}>3. 外資% 與 投信%：</strong>
                選股主表統一採「當日淨買賣佔比 (淨買賣張數/總成交量×100%)」，個股內頁另行提供「累積持股比率%」，清楚區分短線進出與長線籌碼庫存。
              </div>
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
