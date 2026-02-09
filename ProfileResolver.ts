/**
 * ProfileResolver.ts - v3.3
 *
 * URL: #w, #g, #b, #m, #s/{id}, #v/{id}
 * Legacy: ?id=xxx
 */

import { apiCall } from './api-service';
import { state } from './StateManager';

export type ProfileCode = 'w' | 'g' | 'b' | 'm' | 's' | 'v';

// Backend response
export interface ResolveResponse {
  success: boolean;
  code?: string;
  profil?: string;
  ayarlar?: Record<string, unknown>;
  profilAyarlari?: Record<string, unknown>; // Backend bu field name ile döner
  staff?: { id: string; name: string; role: string; email?: string };
  error?: string;
}

export interface ProfileInfo {
  code: ProfileCode | null;
  profil: string;
  staffId: string | null;
  staffData: ResolveResponse['staff'] | null;
  ayarlar: Record<string, unknown> | null;
  isValid: boolean;
}

/**
 * URL parse
 */
export function parseURL(): { code: ProfileCode | null; staffId: string | null; legacyId: string | null } {
  const hash = window.location.hash;
  const search = window.location.search;

  // Yeni format: #w veya #s/abc123
  if (hash && hash.length >= 2) {
    const clean = hash.substring(1);
    const code = clean.charAt(0).toLowerCase();

    if (['w', 'g', 'b', 'm', 's', 'v'].includes(code)) {
      const staffId = (clean.length > 2 && clean.charAt(1) === '/') ? clean.substring(2) : null;
      return { code: code as ProfileCode, staffId, legacyId: null };
    }
  }

  // Legacy: ?id=xxx
  if (search) {
    const id = new URLSearchParams(search).get('id');
    if (id) return { code: null, staffId: null, legacyId: id };
  }

  return { code: null, staffId: null, legacyId: null };
}

/**
 * Backend'den URL çözümle
 */
async function resolveFromBackend(hash: string): Promise<ResolveResponse> {
  try {
    return await apiCall('resolveUrl', { hash }) as ResolveResponse;
  } catch {
    return { success: false, error: 'API hatası' };
  }
}

/**
 * Legacy ID çözümle
 */
async function resolveLegacyId(id: string): Promise<ResolveResponse> {
  try {
    return await apiCall('resolveId', { id }) as ResolveResponse;
  } catch {
    return { success: false, error: 'API hatası' };
  }
}

/**
 * URL'den profil bilgisini al
 */
export async function initProfileFromURL(): Promise<ProfileInfo> {
  const { code, staffId, legacyId } = parseURL();

  // Legacy format
  if (legacyId) {
    const resp = await resolveLegacyId(legacyId);
    const info: ProfileInfo = {
      code: resp.success ? (resp.profil === 'vip' ? 'v' : 's') : null,
      profil: resp.profil || 'genel',
      staffId: legacyId,
      staffData: resp.staff || null,
      ayarlar: null,
      isValid: resp.success
    };
    if (!resp.success) state.set('profileError', resp.error);
    saveToState(info);
    return info;
  }

  // Yeni format
  if (code) {
    const hash = staffId ? `#${code}/${staffId}` : `#${code}`;
    const resp = await resolveFromBackend(hash);

    const info: ProfileInfo = {
      code,
      profil: resp.profil || 'genel',
      staffId,
      staffData: resp.staff || null,
      ayarlar: resp.profilAyarlari || resp.ayarlar || null,
      isValid: resp.success
    };
    if (!resp.success) state.set('profileError', resp.error);
    saveToState(info);
    return info;
  }

  // Default: genel
  const info: ProfileInfo = {
    code: 'g',
    profil: 'genel',
    staffId: null,
    staffData: null,
    ayarlar: null,
    isValid: true
  };
  saveToState(info);
  return info;
}

function saveToState(info: ProfileInfo): void {
  state.set('currentProfile', info.profil);
  state.set('profileCode', info.code);
  state.set('profileAyarlar', info.ayarlar);

  // v3.9: idKontrolu profil ayarına göre personel ID set et
  // Link kodu kontrolü yerine profil ayarları kullanılır
  const idKontrolu = (info.ayarlar as any)?.idKontrolu === true;

  if (idKontrolu && info.staffData?.id) {
    // Profil ayarlarında idKontrolu=true VE staffData var
    state.set('specificStaffId', info.staffData.id);
    state.set('linkedStaffId', info.staffData.id);
    state.set('linkedStaffName', info.staffData.name);
    state.set('linkedStaffRole', info.staffData.role);
  } else if (idKontrolu && info.staffId) {
    // Fallback: staffData yok ama URL'de ID var
    state.set('specificStaffId', info.staffId);
  }
  // idKontrolu=false ise specificStaffId set edilmez
}

/**
 * UI uygula
 */
export function applyProfileUI(info: ProfileInfo): void {
  const header = document.getElementById('staffHeader');
  if (header) {
    // v3.9.19f: Profil tipine göre başlık belirle
    let headerText = 'Randevu Sistemi';
    if (info.code === 'v') {
      // VIP profili (Özel Müşteri)
      headerText = 'Özel Müşteri Randevu Sistemi';
    } else if (info.code === 's') {
      // Bireysel profil - URL'deki ID'nin sahibinin adı
      headerText = info.staffData?.name || 'Randevu Sistemi';
    } else if (info.code === 'b') {
      // Boutique - admin panelinden oluşturulan (olduğu gibi kalsın)
      headerText = 'Mağaza Randevu Sistemi';
    } else if (info.code === 'm') {
      // Yönetim - admin panelinden oluşturulan (olduğu gibi kalsın)
      headerText = 'Yönetim Randevu Sistemi';
    } else if (info.code === 'g') {
      // Genel profil - sadece "Randevu Sistemi"
      headerText = 'Randevu Sistemi';
    } else if (info.code === 'w') {
      // Günlük profil
      headerText = 'Günlük Randevu Sistemi';
    }
    header.textContent = headerText;
    header.style.visibility = 'visible';
  }

  // NOT: Gönderi ve Yönetim kartları artık app.ts'de profilAyarlari.allowedTypes'a göre dinamik olarak filtreleniyor
  // Burada hardcoded gizleme kaldırıldı (backend PROFIL_AYARLARI ile senkronizasyon)
}

/**
 * Hata göster
 * 🔒 GÜVENLİK: DOM API kullanılıyor (XSS koruması)
 */
export function showInvalidProfileError(message?: string): void {
  const container = document.getElementById('alertContainer');
  if (container) {
    // Clear existing content safely
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    // Create alert div
    const alertDiv = document.createElement('div');
    alertDiv.style.cssText = 'margin:20px 0;padding:15px;background:#fff3cd;border:1px solid #ffc107;border-radius:8px;text-align:center;color:#856404';

    // Create title
    const title = document.createElement('strong');
    title.textContent = '⚠️ Geçersiz Link';
    alertDiv.appendChild(title);
    alertDiv.appendChild(document.createElement('br'));

    // Create message text (safely escaped via textContent)
    const messageSpan = document.createElement('span');
    messageSpan.textContent = message || 'Bu link geçerli değil.';
    alertDiv.appendChild(messageSpan);
    alertDiv.appendChild(document.createElement('br'));

    // Create info text
    const infoSpan = document.createElement('span');
    infoSpan.textContent = 'Lütfen linki kontrol edin.';
    alertDiv.appendChild(infoSpan);

    container.appendChild(alertDiv);
  }
}

// Legacy exports
export const getIdFromURL = () => parseURL().legacyId;
export const showInvalidIdError = showInvalidProfileError;
