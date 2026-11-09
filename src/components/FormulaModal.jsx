import React, { useState } from 'react';
import { FORMULA_DEFINITIONS } from '../data/mockStocks';

export default function FormulaModal({ isOpen, onClose }) {
  const [calcBuy15, setCalcBuy15] = useState(642);
  const [calcSell15, setCalcSell15] = useState(1593);
  const [calcVol, setCalcVol] = useState(3132);

  if (!isOpen) return null;

  const calcResult = calcVol > 0
    ? (((Number(calcBuy15) - Number(calcSell15)) / Number(calcVol)) * 100).toFixed(2)
    : '0.00';

  return (
    <div className="modal-backdrop" onClick={onClose} id="formula-modal-backdrop">
      <div className="modal-panel" onClick={e => e.stopPropagation()} id="formula-modal-panel">
        <div className="modal-header">
          <div>
            <h2 className="modal-title">欄位介紹與核心籌碼公式說明（對應參考圖 3）</h2>
            <p className="modal-subtitle">
              掌握主力集中度（主1 / 主5 / 主10）、均線乖離、維持率與低檔價值股判讀邏輯
            </p>
          </div>
          <button className="btn-icon-close" onClick={onClose} id="btn-close-formula-modal">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="formula-grid">
            {FORMULA_DEFINITIONS.map(item => (
              <div key={item.key} className="formula-card">
                <div className="formula-card-title">{item.title}</div>
                <div className="formula-code">{item.formula}</div>
                <p className="formula-desc">{item.description}</p>
              </div>
            ))}
          </div>

          <div className="formula-calculator-box">
            <div className="calc-header">
              <span className="calc-badge">互動驗算器</span>
              <strong>主力籌碼集中度（主 1 / 主 5 / 主 10）即時試算</strong>
              <span className="calc-hint">預設帶入圖 2「2049 上銀」當日數據：買超 642 張、賣超 1,593 張、成交量 3,132 張</span>
            </div>
            <div className="calc-inputs">
              <label className="calc-field">
                <span>區間買超前 15 名總量 (張)</span>
                <input
                  type="number"
                  value={calcBuy15}
                  onChange={e => setCalcBuy15(e.target.value)}
                  id="input-calc-buy15"
                />
              </label>
              <label className="calc-field">
                <span>區間賣超前 15 名總量 (張)</span>
                <input
                  type="number"
                  value={calcSell15}
                  onChange={e => setCalcSell15(e.target.value)}
                  id="input-calc-sell15"
                />
              </label>
              <label className="calc-field">
                <span>區間總成交量 (張)</span>
                <input
                  type="number"
                  value={calcVol}
                  onChange={e => setCalcVol(e.target.value)}
                  id="input-calc-vol"
                />
              </label>
              <div className="calc-output">
                <span>計算結果（籌碼集中度 %）</span>
                <strong className={Number(calcResult) >= 0 ? 'val-up' : 'val-down'}>
                  {calcResult}% ({Number(calcBuy15) - Number(calcSell15)} 張)
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
