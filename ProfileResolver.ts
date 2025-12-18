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
      ayarlar: resp.ayarlar || null,
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

  // v3.6: Set specificStaffId for staff links (#s/{id}, #v/{id})
  if (info.staffData?.id) {
    state.set('specificStaffId', info.staffData.id);
    state.set('linkedStaffId', info.staffData.id);
    state.set('linkedStaffName', info.staffData.name);
    state.set('linkedStaffRole', info.staffData.role);
  } else if (info.staffId) {
    // Fallback: Use URL staffId if staffData not available
    state.set('specificStaffId', info.staffId);
  }
}

/**
 * UI uygula
 */
export function applyProfileUI(info: ProfileInfo): void {
  const header = document.getElementById('staffHeader');
  if (header) {
    // Profil tipine göre başlık belirle
    let headerText = 'Randevu Sistemi';
    if (info.code === 'v') {
      // VIP profili - kişi adı gösterilmez
      headerText = 'Özel Müşteri Randevu Sistemi';
    } else if (info.code === 's' && info.staffData?.name) {
      // Staff profili - kişi adı gösterilir
      headerText = info.staffData.name;
    } else if (info.code === 'b') {
      headerText = 'Mağaza Randevu Sistemi';
    } else if (info.code === 'm') {
      headerText = 'Yönetim Randevu Sistemi';
    } else if (info.code === 'g') {
      headerText = 'Genel Randevu Sistemi';
    } else if (info.code === 'w') {
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
 */
export function showInvalidProfileError(message?: string): void {
  const container = document.getElementById('alertContainer');
  if (container) {
    container.innerHTML = `
      <div style="margin:20px 0;padding:15px;background:#fff3cd;border:1px solid #ffc107;border-radius:8px;text-align:center;color:#856404">
        <strong>⚠️ Geçersiz Link</strong><br>
        ${message || 'Bu link geçerli değil.'}<br>
        Lütfen linki kontrol edin.
      </div>`;
  }
}

// Legacy exports
export const getIdFromURL = () => parseURL().legacyId;
export const showInvalidIdError = showInvalidProfileError;
