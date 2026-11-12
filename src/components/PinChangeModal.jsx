import React, { useState } from 'react';
import { changeCustomPin } from '../services/authService';

export default function PinChangeModal({ isOpen, onClose, onPinChanged }) {
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async e => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!oldPin.trim()) {
      setErrorMsg('請輸入目前使用的 PIN 碼');
      return;
    }
    if (!/^\d{4,6}$/.test(newPin)) {
      setErrorMsg('新 PIN 碼必須為 4 ~ 6 位純數字');
      return;
    }
    if (newPin !== confirmPin) {
      setErrorMsg('兩次輸入的新 PIN 碼不一致，請再次確認');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await changeCustomPin(oldPin, newPin);
      if (res.ok) {
        setSuccessMsg('🎉 私人 PIN 碼修改成功！下次登入請使用新 PIN 碼。');
        setTimeout(() => {
          setOldPin('');
          setNewPin('');
          setConfirmPin('');
          setSuccessMsg('');
          if (onPinChanged) onPinChanged();
          onClose();
        }, 1500);
      } else {
        setErrorMsg(res.error || '修改失敗，請檢查目前舊密碼是否正確');
      }
    } catch {
      setErrorMsg('修改過程發生異常，請重試');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} id="pin-change-modal-backdrop">
      <div className="modal-panel pin-modal-panel" onClick={e => e.stopPropagation()} id="pin-change-panel">
        <div className="modal-header">
          <div>
            <h2 className="modal-title">🔑 修改私人安全通行 PIN 碼</h2>
            <p className="modal-subtitle">設定您專屬的 4 ~ 6 位數字門禁密碼，保護本機看盤隱私</p>
          </div>
          <button className="btn-icon-close" onClick={onClose} id="btn-close-pin-modal">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="pin-change-form">
          <div className="pin-form-field">
            <label className="pin-field-label">目前使用的舊 PIN 碼</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="預設為 888888 或 168168"
              value={oldPin}
              onChange={e => setOldPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="pin-text-input"
              autoFocus
            />
          </div>

          <div className="pin-form-field">
            <label className="pin-field-label">新的 4 ~ 6 位數純數字 PIN 碼</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="例如 123456 或 9999"
              value={newPin}
              onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="pin-text-input"
            />
          </div>

          <div className="pin-form-field">
            <label className="pin-field-label">再次輸入新 PIN 碼以確認</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="請再次輸入相同的新 PIN 碼"
              value={confirmPin}
              onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="pin-text-input"
            />
          </div>

          {errorMsg && <div className="pin-modal-error">⚠️ {errorMsg}</div>}
          {successMsg && <div className="pin-modal-success">{successMsg}</div>}

          <div className="pin-modal-actions">
            <button type="button" className="btn-modal-cancel" onClick={onClose}>
              取消
            </button>
            <button
              type="submit"
              className="btn-modal-confirm"
              disabled={isSubmitting || !oldPin || newPin.length < 4}
            >
              {isSubmitting ? '儲存中...' : '確認變更 PIN 碼'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
