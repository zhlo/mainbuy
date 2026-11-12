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

  // 使用專屬安全救援碼重設自訂密碼回預設狀態
  const handleResetWithMasterKey = async () => {
    const targetKey = masterRecoveryPin.trim();
    if (!targetKey) {
      setRecoveryError('請輸入專屬安全救援碼');
      return;
    }
    setRecoveryError('');
    setRecoveryMsg('');

    const res = await resetPinWithMasterKey(targetKey);
    if (res.ok) {
      setRecoveryMsg('🎉 已成功驗證救援碼並重設 PIN 碼！您的自選股與所有設定均完好保留。');
      setPin(targetKey);
      setTimeout(() => {
        handleSubmit();
      }, 800);
    } else {
      setRecoveryError(res.error || '安全救援碼驗證失敗，請確認後重試');
    }
  };

  return (
    <div className="auth-gate-overlay" id="auth-gate-screen">
      <div className="auth-gate-card">
        {/* 頂部標誌 */}
        <div className="auth-gate-header">
          <div className="auth-shield-icon">🛡️</div>
          <h1 className="auth-gate-title">MainBuy 主力雷達</h1>
        </div>

        {/* PIN 碼輸入表單 */}
        <form className="auth-gate-form" onSubmit={handleSubmit}>
          <div className="auth-input-group">
            <label className="auth-input-label" htmlFor="auth-pin-input">
              <span>PIN 碼 (4 ~ 6 位數字)</span>
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
                placeholder="請輸入 PIN 碼"
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
            <span className="remember-text">記住此裝置（30 天內在此瀏覽器免再輸入）</span>
          </label>

          {/* 解鎖按鈕 */}
          <button
            type="submit"
            className="btn-auth-unlock"
            disabled={isVerifying || pin.length < 4}
            id="btn-auth-unlock"
          >
            {isVerifying ? '驗證中...' : '🔓 解鎖進入'}
          </button>

          <div className="auth-forgot-link-row">
            <button
              type="button"
              className="btn-toggle-forgot"
              onClick={() => setShowRecoveryBox(p => !p)}
              id="btn-toggle-forgot-pin"
            >
              {showRecoveryBox ? '收合救援選單 ▲' : '忘記 PIN 碼？點此救援 ▼'}
            </button>
          </div>
        </form>

        {/* 忘記密碼與救援區塊 */}
        {showRecoveryBox && (
          <div className="auth-recovery-box" id="auth-recovery-box">
            <div className="recovery-manual-row">
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="請輸入救援碼 (6 位數)"
                value={masterRecoveryPin}
                onChange={e => setMasterRecoveryPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="recovery-input"
                id="input-master-recovery-pin"
              />
              <button
                type="button"
                className="btn-recovery-submit"
                onClick={handleResetWithMasterKey}
                disabled={masterRecoveryPin.length < 4}
                id="btn-submit-recovery-pin"
              >
                驗證救援碼
              </button>
            </div>

            {recoveryError && <div className="recovery-alert-error">⚠️ {recoveryError}</div>}
            {recoveryMsg && <div className="recovery-alert-success">{recoveryMsg}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
