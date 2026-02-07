// Input dogrulama - GAS Security.js + Validation.js'den port
// sanitizeForSpreadsheet, escapeHtml, email/phone regex, string uzunluk limitleri

const VALIDATION = {
  STRING_MAX_LENGTH: 100,
  PHONE_MAX_LENGTH: 20,
  NOTE_MAX_LENGTH: 500,
  INTERVAL_MIN: 15,
  INTERVAL_MAX: 240,
  MAX_DAILY_MIN: 1,
  MAX_DAILY_MAX: 20,
};

/**
 * Spreadsheet formula injection korumasi
 * GAS: Utils.sanitizeForSpreadsheet
 */
export function sanitizeForSpreadsheet(input: string): string {
  if (!input || typeof input !== 'string') return '';
  const sanitized = input.trim();
  const formulaStarters = ['=', '+', '-', '@', '|', '\t', '\r', '\n'];
  if (formulaStarters.some((s) => sanitized.startsWith(s))) {
    return "'" + sanitized;
  }
  return sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

/**
 * HTML escape (XSS korumasi)
 * GAS: Utils.escapeHtml
 */
export function escapeHtml(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Email dogrulama
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
}

/**
 * Telefon numarasi dogrulama (sadece rakam + bazi karakterler)
 */
export function sanitizePhone(phone: string): string {
  if (!phone || typeof phone !== 'string') return '';
  return phone
    .replace(/[^0-9+\-\s()]/g, '')
    .trim()
    .substring(0, VALIDATION.PHONE_MAX_LENGTH);
}

/**
 * String sanitize (trim + max length)
 */
export function sanitizeString(str: string, maxLength = VALIDATION.STRING_MAX_LENGTH): string {
  if (!str || typeof str !== 'string') return '';
  return str.trim().substring(0, maxLength);
}

/**
 * Ismi Title Case formatina cevir
 */
export function toTitleCase(name: string): string {
  if (!name || typeof name !== 'string') return '';
  return name
    .trim()
    .toLowerCase()
    .split(' ')
    .map((word) => (word.length === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');
}

/**
 * Randevu olusturma icin input dogrulama
 */
export function validateAppointmentInput(params: Record<string, unknown>): {
  valid: boolean;
  error?: string;
  sanitized?: Record<string, unknown>;
} {
  const customerName = sanitizeString(String(params.customerName || ''));
  if (!customerName) return { valid: false, error: 'Müşteri adı zorunludur' };

  const customerPhone = sanitizePhone(String(params.customerPhone || ''));
  if (!customerPhone) return { valid: false, error: 'Müşteri telefonu zorunludur' };

  const date = String(params.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { valid: false, error: 'Geçersiz tarih formatı (YYYY-MM-DD bekleniyor)' };
  }

  const time = String(params.time || '');
  if (!/^\d{2}:\d{2}$/.test(time)) {
    return { valid: false, error: 'Geçersiz saat formatı (HH:MM bekleniyor)' };
  }

  const validTypes = ['delivery', 'shipping', 'meeting', 'service', 'management'];
  const appointmentType = String(params.appointmentType || 'meeting');
  if (!validTypes.includes(appointmentType)) {
    return { valid: false, error: 'Geçersiz randevu tipi' };
  }

  return {
    valid: true,
    sanitized: {
      customerName: toTitleCase(customerName),
      customerPhone,
      customerEmail: params.customerEmail ? sanitizeString(String(params.customerEmail)) : '',
      customerNote: params.customerNote
        ? sanitizeString(String(params.customerNote), VALIDATION.NOTE_MAX_LENGTH)
        : '',
      date,
      time,
      appointmentType,
      staffId: params.staffId ? Number(params.staffId) : null,
      duration: Number(params.duration) || 60,
      shiftType: String(params.shiftType || 'full'),
      profile: String(params.profil || params.profile || 'g'),
      isVipLink: params.isVipLink === true || params.isVipLink === 'true',
      assignByAdmin: params.assignByAdmin === true || params.assignByAdmin === 'true',
      kvkkConsent: params.kvkkConsent === true || params.kvkkConsent === 'true',
    },
  };
}

export { VALIDATION };
