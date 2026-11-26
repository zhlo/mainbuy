import React, { useState, useEffect, useCallback } from 'react';
import { verifyPinCode, resetPinWithMasterKey } from '../services/authService';
import { useIsMobile } from '../hooks/useIsMobile';

export default function AuthGateModal({ onUnlockSuccess }) {
  const isMobile = useIsMobile(768);
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

  const submitPinValue = useCallback(
    async targetPin => {
      const val = String(targetPin ?? pin).trim();
      if (!val || val.length < 4) {
        setErrorMsg('請輸入 4 ~ 6 位數字安全通行 PIN 碼');
        return;
      }
      setIsVerifying(true);
      setErrorMsg('');

      try {
        const res = await verifyPinCode(val, rememberDevice);
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
    },
    [pin, rememberDevice, onUnlockSuccess]
  );

  const handleSubmit = async e => {
    if (e) e.preventDefault();
    await submitPinValue(pin);
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
        submitPinValue(targetKey);
      }, 650);
    } else {
      setRecoveryError(res.error || '安全救援碼驗證失敗，請確認後重試');
    }
  };

  // 手機版大型九宮格數字鍵盤按鍵處理
  const handleKeypadDigit = useCallback(
    digit => {
      if (isVerifying) return;
      if (showRecoveryBox) {
        setMasterRecoveryPin(prev => (prev.length < 6 ? prev + digit : prev));
        if (recoveryError) setRecoveryError('');
      } else {
        setPin(prev => (prev.length < 6 ? prev + digit : prev));
        if (errorMsg) setErrorMsg('');
      }
    },
    [isVerifying, showRecoveryBox, recoveryError, errorMsg]
  );

  const handleKeypadBackspace = useCallback(() => {
    if (isVerifying) return;
    if (showRecoveryBox) {
      setMasterRecoveryPin(prev => prev.slice(0, -1));
      if (recoveryError) setRecoveryError('');
    } else {
      setPin(prev => prev.slice(0, -1));
      if (errorMsg) setErrorMsg('');
    }
  }, [isVerifying, showRecoveryBox, recoveryError, errorMsg]);

  const handleKeypadClear = useCallback(() => {
    if (isVerifying) return;
    if (showRecoveryBox) {
      setMasterRecoveryPin('');
      setRecoveryError('');
    } else {
      setPin('');
      setErrorMsg('');
    }
  }, [isVerifying, showRecoveryBox]);

  // 手機模式下若連接實體鍵盤亦同步支援數字鍵與 Enter
  useEffect(() => {
    if (!isMobile) return undefined;
    const onKeyDown = e => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleKeypadDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleKeypadBackspace();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (!showRecoveryBox && pin.length >= 4) {
          submitPinValue(pin);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMobile, handleKeypadDigit, handleKeypadBackspace, showRecoveryBox, pin, submitPinValue]);

  return (
    <div className="auth-gate-overlay" id="auth-gate-screen">
      <div className={`auth-gate-card ${isMobile ? 'auth-gate-mobile-card' : ''}`}>
        {/* 頂部標誌（未解鎖前完全隱藏所有頂部選單與免責說明文字） */}
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

            {isMobile ? (
              <div
                className={`mobile-pin-display-box ${errorMsg ? 'has-error' : ''}`}
                id="mobile-pin-display"
                aria-live="polite"
              >
                {pin.length === 0 ? (
                  <span className="mobile-pin-placeholder">請點按下方數字鍵盤</span>
                ) : showPin ? (
                  <span className="mobile-pin-digits">{pin}</span>
                ) : (
                  <span className="mobile-pin-bullets">{'●'.repeat(pin.length)}</span>
                )}
              </div>
            ) : (
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
            )}

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

          {/* 手機專屬：大型好按九宮格數字鍵盤 */}
          {isMobile && (
            <div className="mobile-numpad-grid" id="mobile-pin-numpad" role="group" aria-label="PIN 數字鍵盤">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                <button
                  key={num}
                  type="button"
                  className="mobile-numpad-btn"
                  onClick={() => handleKeypadDigit(num)}
                  id={`btn-numpad-${num}`}
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                className="mobile-numpad-btn numpad-fn-btn"
                onClick={handleKeypadClear}
                id="btn-numpad-clear"
              >
                清除
              </button>
              <button
                type="button"
                className="mobile-numpad-btn"
                onClick={() => handleKeypadDigit('0')}
                id="btn-numpad-0"
              >
                0
              </button>
              <button
                type="button"
                className="mobile-numpad-btn numpad-fn-btn"
                onClick={handleKeypadBackspace}
                id="btn-numpad-backspace"
                aria-label="退格刪除"
              >
                ⌫
              </button>
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
                type={showPin ? 'text' : 'password'}
                inputMode={isMobile ? 'none' : 'numeric'}
                readOnly={isMobile}
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
