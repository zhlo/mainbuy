import React, { useState } from 'react';
import { verifyPinCode, resetPinWithMasterKey } from '../services/authService';

export default function AuthGateModal({ onUnlockSuccess }) {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // 忘記密碼與萬用救援狀態
  const [showRecoveryBox, setShowRecoveryBox] = useState(false);
  const [masterRecoveryPin, setMasterRecoveryPin] = useState('');
  const [recoveryMsg, setRecoveryMsg] = useState('');
  const [recoveryError, setRecoveryError] = useState('');

  const handleSubmit = async e => {
    if (e) e.preventDefault();
    if (!pin.trim()) {
      setErrorMsg('請輸入 4 ~ 6 位數字安全通行 PIN 碼');
      return;
    }
    setIsVerifying(true);
    setErrorMsg('');

    try {
      const res = await verifyPinCode(pin, rememberDevice);
      if (res.ok) {
        onUnlockSuccess();
      } else {
        setErrorMsg(res.error || 'PIN 碼錯誤，請重新輸入');
        setPin('');
      }
    } catch {
      setErrorMsg('驗證過程發生異常，請重試');
    } finally {
      setIsVerifying(false);
    }
  };

  // 使用萬用救援碼一鍵重設自訂密碼回預設出廠狀態
  const handleResetWithMasterKey = async (quickFill = false) => {
    const targetKey = quickFill ? '888888' : masterRecoveryPin.trim();
    if (!targetKey) {
      setRecoveryError('請輸入萬用超級救援碼（例如 888888）');
      return;
    }
    setRecoveryError('');
    setRecoveryMsg('');

    const res = await resetPinWithMasterKey(targetKey);
    if (res.ok) {
      setRecoveryMsg('🎉 已成功重設 PIN 碼回出廠預設狀態！您的自選股與所有設定均完好保留。');
      setPin(targetKey);
      setTimeout(() => {
        handleSubmit();
      }, 800);
    } else {
      setRecoveryError(res.error || '萬用救援碼驗證失敗');
    }
  };

  return (
    <div className="auth-gate-overlay" id="auth-gate-screen">
      <div className="auth-gate-card">
        {/* 頂部標誌 */}
        <div className="auth-gate-header">
          <div className="auth-shield-icon">🛡️</div>
          <h1 className="auth-gate-title">MainBuy 主力雷達</h1>
          <p className="auth-gate-subtitle">私人專案研究專用工作站・安全通行驗證</p>
        </div>

        {/* 核心免責聲明與使用提示區塊 */}
        <div className="auth-disclaimer-card">
          <div className="disclaimer-header">
            <span className="disclaimer-badge">⚠️ 重要使用須知與免責聲明</span>
          </div>
          <ul className="disclaimer-list">
            <li>
              <strong>個人學術與策略研究用途：</strong>
              本系統僅供個人回測分析與量化研究使用，非公開營業平台，亦不構成任何證券之要約、推薦或投資買賣建議。
            </li>
            <li>
              <strong>資料可能延遲或非最新：</strong>
              站內所有行情數據、K 線及券商分點報表均擷取自證交所、櫃買中心與券商公開網站，可能因排程同步時間差而產生延遲，或存在盤後校正前後之計算偏差。
            </li>
            <li>
              <strong>獨立判斷盈虧自負：</strong>
              任何投資決策皆具有市場風險，使用者應秉持獨立思考並審慎評估，切勿直接作為實際下單交易依據。
            </li>
          </ul>
        </div>

        {/* PIN 碼輸入表單 */}
        <form className="auth-gate-form" onSubmit={handleSubmit}>
          <div className="auth-input-group">
            <label className="auth-input-label" htmlFor="auth-pin-input">
              <span>私人安全通行 PIN 碼 (4 ~ 6 位數字)</span>
              <button
                type="button"
                className="btn-toggle-eye"
                onClick={() => setShowPin(p => !p)}
                title={showPin ? '隱藏密碼' : '顯示密碼'}
              >
                {showPin ? '👁️ 隱藏' : '🔒 顯示'}
              </button>
            </label>

            <div className="pin-input-wrapper">
              <input
                id="auth-pin-input"
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoFocus
                placeholder="請輸入 4~6 位數字 PIN 碼"
                value={pin}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setPin(val);
                  if (errorMsg) setErrorMsg('');
                }}
                className={`auth-pin-input ${errorMsg ? 'has-error' : ''}`}
              />
            </div>

            {/* 圓點進度指示器 */}
            <div className="pin-dots-indicator">
              {[0, 1, 2, 3, 4, 5].map(idx => (
                <span
                  key={idx}
                  className={`pin-dot ${idx < pin.length ? 'filled' : ''}`}
                />
              ))}
            </div>
          </div>

          {/* 錯誤提示 */}
          {errorMsg && (
            <div className="auth-error-banner animate-shake" id="auth-error-banner">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* 記住此裝置選項 */}
          <label className="auth-remember-checkbox">
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={e => setRememberDevice(e.target.checked)}
              id="checkbox-remember-device"
            />
            <span className="remember-text">記住此裝置（30 天內在此瀏覽器免再輸入 PIN 碼）</span>
          </label>

          {/* 解鎖按鈕 */}
          <button
            type="submit"
            className="btn-auth-unlock"
            disabled={isVerifying || pin.length < 4}
            id="btn-auth-unlock"
          >
            {isVerifying ? '驗證通行碼中...' : '🔓 驗證並解鎖進入工作站'}
          </button>

          <div className="auth-forgot-link-row">
            <button
              type="button"
              className="btn-toggle-forgot"
              onClick={() => setShowRecoveryBox(p => !p)}
              id="btn-toggle-forgot-pin"
            >
              {showRecoveryBox ? '收合救援選單 ▲' : '忘記自訂 PIN 碼？點此緊急救援 ▼'}
            </button>
          </div>
        </form>

        {/* 忘記密碼與萬用救援區塊 */}
        {showRecoveryBox && (
          <div className="auth-recovery-box" id="auth-recovery-box">
            <div className="recovery-box-header">
              <span className="recovery-badge">🔑 萬用救援機制</span>
              <strong className="recovery-title">不小心忘了自訂 PIN 碼？</strong>
            </div>
            <p className="recovery-desc">
              系統底層內建<strong>萬用超級救援碼</strong>（永遠有效），輸入萬用碼可直接解鎖或一鍵重設自訂密碼回預設狀態，<strong>您的自選股清單與快取資料均會完好保留</strong>！
            </p>

            <div className="recovery-quick-action">
              <button
                type="button"
                className="btn-quick-master-unlock"
                onClick={() => handleResetWithMasterKey(true)}
                id="btn-quick-master-reset"
              >
                ⚡ 一鍵使用萬用碼 (888888) 重設並直接登入
              </button>
            </div>

            <div className="recovery-manual-row">
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="或輸入萬用碼 (888888 / 168168)"
                value={masterRecoveryPin}
                onChange={e => setMasterRecoveryPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="recovery-input"
                id="input-master-recovery-pin"
              />
              <button
                type="button"
                className="btn-recovery-submit"
                onClick={() => handleResetWithMasterKey(false)}
                disabled={masterRecoveryPin.length < 4}
                id="btn-submit-recovery-pin"
              >
                重設 PIN 碼
              </button>
            </div>

            {recoveryError && <div className="recovery-alert-error">⚠️ {recoveryError}</div>}
            {recoveryMsg && <div className="recovery-alert-success">{recoveryMsg}</div>}
          </div>
        )}

        {/* 底部預設 PIN 碼友善提示 */}
        <div className="auth-gate-footer-hint">
          <span>💡 出廠預設通行碼與萬用救援碼均為 <strong>888888</strong> 或 <strong>168168</strong></span>
        </div>
      </div>
    </div>
  );
}
