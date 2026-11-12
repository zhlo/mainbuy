// MainBuy 主力雷達 — 私人使用安全門禁驗證服務 (SHA-256 加密與裝置授權管理)

const AUTH_SESSION_KEY = 'mainbuy_auth_session_v1';
const CUSTOM_PIN_HASH_KEY = 'mainbuy_custom_pin_hash_v1';

// 站長專屬安全通行 PIN 碼之 SHA-256 雜湊
export const DEFAULT_PIN_HASHES = [
  'e4894604926aa937c9c7fa85b8d2c2ed8cc1b7e96beca86420e09149b7d6a3d3'
];

/**
 * 原生 Web Crypto SHA-256 雜湊
 */
export async function computeSha256(text) {
  const enc = new TextEncoder();
  const data = enc.encode(String(text).trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 檢查目前瀏覽器裝置是否已通過 PIN 碼安全授權
 */
export function isDeviceAuthenticated() {
  if (typeof window === 'undefined') return false;
  try {
    const local = localStorage.getItem(AUTH_SESSION_KEY);
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed && parsed.expiresAt && parsed.expiresAt > Date.now()) {
        return true;
      }
    }
    const session = sessionStorage.getItem(AUTH_SESSION_KEY);
    if (session) return true;
  } catch {
    // ignore
  }
  return false;
}

/**
 * 驗證輸入之 PIN 碼並建立授權
 */
export async function verifyPinCode(pinInput, rememberDevice = true) {
  const trimmed = String(pinInput || '').trim();
  if (!/^\d{4,6}$/.test(trimmed)) {
    return { ok: false, error: '請輸入 4 ~ 6 位數字 PIN 碼' };
  }

  const hash = await computeSha256(trimmed);
  let customHash = null;
  try {
    customHash = localStorage.getItem(CUSTOM_PIN_HASH_KEY);
  } catch {}

  // 萬用救援機制：站長專屬安全救援碼永遠作為終極救援碼，保證站長絕不被鎖在門外
  const isMasterKey = DEFAULT_PIN_HASHES.includes(hash);
  const isValid = (customHash && hash === customHash) || isMasterKey;
  if (!isValid) {
    return { ok: false, error: 'PIN 碼錯誤，請重新輸入' };
  }

  // 驗證成功，儲存授權憑證
  try {
    if (rememberDevice) {
      const sessionData = {
        token: hash.slice(0, 16),
        authenticatedAt: Date.now(),
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 天內免再輸入
      };
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(sessionData));
    } else {
      sessionStorage.setItem(AUTH_SESSION_KEY, 'active');
    }
  } catch {}

  return { ok: true, isMasterKey };
}

/**
 * 以萬用超級救援碼重設自訂 PIN 碼回出廠預設狀態（完全保留自選股與快取數據）
 */
export async function resetPinWithMasterKey(masterPinInput) {
  const trimmed = String(masterPinInput || '').trim();
  const hash = await computeSha256(trimmed);
  if (!DEFAULT_PIN_HASHES.includes(hash)) {
    return { ok: false, error: '萬用救援碼驗證失敗，請輸入正確的安全救援碼' };
  }
  try {
    localStorage.removeItem(CUSTOM_PIN_HASH_KEY);
  } catch {}
  return { ok: true };
}

/**
 * 登出並立即鎖定本機裝置
 */
export function logoutAndLockDevice() {
  try {
    localStorage.removeItem(AUTH_SESSION_KEY);
    sessionStorage.removeItem(AUTH_SESSION_KEY);
  } catch {}
}

/**
 * 自訂修改私人專屬 PIN 碼
 */
export async function changeCustomPin(oldPin, newPin) {
  const oldVerify = await verifyPinCode(oldPin, false);
  if (!oldVerify.ok) {
    return { ok: false, error: '目前 PIN 碼驗證錯誤，請輸入正確的舊密碼' };
  }
  const newTrimmed = String(newPin || '').trim();
  if (!/^\d{4,6}$/.test(newTrimmed)) {
    return { ok: false, error: '新 PIN 碼必須為 4 ~ 6 位純數字' };
  }
  const newHash = await computeSha256(newTrimmed);
  try {
    localStorage.setItem(CUSTOM_PIN_HASH_KEY, newHash);
  } catch {}
  return { ok: true };
}
