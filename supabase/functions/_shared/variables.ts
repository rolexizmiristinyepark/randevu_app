// Template degisken cozumleme
// GAS kaynak: Variables.js (MESSAGE_VARIABLES, replaceMessageVariables)

const TR_MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];
const TR_DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

const TYPE_LABELS: Record<string, string> = {
  meeting: 'Görüşme',
  delivery: 'Teslim',
  shipping: 'Gönderi',
  service: 'Teknik Servis',
  management: 'Yönetim',
};

const PROFILE_LABELS: Record<string, string> = {
  w: 'Walk-in', g: 'Genel', s: 'Bireysel',
  b: 'Mağaza', m: 'Yönetim', v: 'Özel Müşteri',
};

/**
 * Telefon numarasini +90XXXXXXXXXX formatina cevir
 */
export function formatPhoneWithCountryCode(phone: string): string {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('90') && digits.length >= 12) return '+' + digits;
  if (digits.startsWith('0') && digits.length === 11) return '+90' + digits.substring(1);
  if (digits.length === 10 && digits.startsWith('5')) return '+90' + digits;
  if (phone.startsWith('+')) return phone.replace(/\s/g, '');
  return '+' + digits;
}

/**
 * ISO tarihini Turkce formata cevir: "25 Aralik 2025, Persembe"
 */
export function formatTurkishDate(dateStr: string): string {
  if (!dateStr) return '';
  // Zaten formatliysa dondur
  if (TR_MONTHS.some((m) => dateStr.includes(m))) return dateStr;
  // ISO format
  if (dateStr.includes('-') && dateStr.length >= 10) {
    const d = new Date(dateStr.substring(0, 10) + 'T12:00:00');
    if (!isNaN(d.getTime())) {
      return `${d.getDate()} ${TR_MONTHS[d.getMonth()]} ${d.getFullYear()}, ${TR_DAYS[d.getDay()]}`;
    }
  }
  return dateStr;
}

// deno-lint-ignore no-explicit-any
type VarData = Record<string, any>;

/**
 * Mesaj degiskeni tanimlari
 * GAS: MESSAGE_VARIABLES
 */
const MESSAGE_VARIABLES: Record<string, { label: string; getValue: (data: VarData) => string }> = {
  musteri: {
    label: 'customer: Ahmet Yılmaz',
    getValue: (data) => {
      if (data.customerName?.includes(' ')) return data.customerName;
      const name = data.customerName || data.name || '';
      const surname = data.customerSurname || data.surname || '';
      return name && surname ? `${name} ${surname}` : name || surname || '';
    },
  },
  musteri_tel: {
    label: 'customer phone: +905323112522',
    getValue: (data) => formatPhoneWithCountryCode(data.customerPhone || data.phone || ''),
  },
  musteri_mail: {
    label: 'customer email: ahmet@email.com',
    getValue: (data) => data.customerEmail || data.email || '',
  },
  randevu_tarihi: {
    label: 'appointment date: 25 December 2025, Friday',
    getValue: (data) => formatTurkishDate(data.date || data.appointmentDate || ''),
  },
  randevu_saati: {
    label: 'appointment time: 14:00',
    getValue: (data) => data.time || data.appointmentTime || data.startTime || '',
  },
  randevu_ek_bilgi: {
    label: 'appointment note',
    getValue: (data) => data.customerNote || data.extraInfo || data.description || data.notes || '',
  },
  personel: {
    label: 'staff: Mehmet Kaya',
    getValue: (data) => data.staffName || data.assignedStaff || 'Atanacak',
  },
  personel_id: {
    label: 'staff id: 123',
    getValue: (data) => String(data.staffId || ''),
  },
  personel_tel: {
    label: 'staff phone: +905551234567',
    getValue: (data) => formatPhoneWithCountryCode(data.staffPhone || ''),
  },
  personel_mail: {
    label: 'staff email: mehmet@rolex.com',
    getValue: (data) => data.staffEmail || '',
  },
  randevu_turu: {
    label: 'appointment type: meeting',
    getValue: (data) => {
      const type = data.appointmentType || data.type || '';
      return TYPE_LABELS[type.toLowerCase()] || type;
    },
  },
  randevu_profili: {
    label: 'appointment profile: general',
    getValue: (data) => {
      const profile = data.profile || data.linkType || '';
      return PROFILE_LABELS[profile.toLowerCase()] || profile;
    },
  },
  profil_sahibi: {
    label: 'profile owner: Serdar Benli',
    getValue: (data) => data.staffName || data.profileOwner || '',
  },
};

/**
 * Mesaj icindeki {{degisken}} placeholder'larini gercek degerlerle degistir
 * GAS: replaceMessageVariables
 */
export function replaceMessageVariables(text: string, data: VarData): string {
  if (!text) return '';
  let result = text;
  for (const key in MESSAGE_VARIABLES) {
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
    const value = MESSAGE_VARIABLES[key].getValue(data);
    result = result.replace(pattern, value || '');
  }
  return result;
}

/**
 * Admin panel icin degisken listesini dondur
 * GAS: getMessageVariables
 */
export function getMessageVariableOptions(): Record<string, string> {
  const options: Record<string, string> = {};
  for (const key in MESSAGE_VARIABLES) {
    options[key] = MESSAGE_VARIABLES[key].label;
  }
  return options;
}

/**
 * Trigger tanimlari
 * GAS: MESSAGE_TRIGGERS
 */
export const MESSAGE_TRIGGERS: Record<string, string> = {
  appointment_create: 'appointment_create',
  appointment_cancel: 'appointment_cancel',
  appointment_update: 'appointment_update',
  appointment_assign: 'appointment_assign',
};

/**
 * Alici tanimlari
 * Event-based: customer, staff, admin
 * Time-based (HATIRLATMA): customer, staff, admin, greeter
 * Gun secimi schedule_day ile yapilir (today/tomorrow)
 */
export const MESSAGE_RECIPIENTS: Record<string, string> = {
  admin: 'admin',
  customer: 'customer',
  staff: 'assigned staff',
  greeter: 'greeter',
};

/**
 * Email body'sindeki \n karakterlerini HTML'e cevir
 * \n\n → paragraf sonu/basi (</p><p>)
 * \n   → satir sonu (<br>)
 * Sonuc <p>...</p> ile sarmalanir
 */
export function formatEmailBody(text: string): string {
  if (!text) return '';
  // Once \n\n'leri paragraf ayiricina cevir
  let html = text.replace(/\n\n/g, '</p><p>');
  // Kalan \n'leri <br>'ye cevir
  html = html.replace(/\n/g, '<br>');
  // Tamami <p>...</p> ile sarmala
  return `<p>${html}</p>`;
}
