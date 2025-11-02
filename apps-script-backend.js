// ==================== GOOGLE APPS SCRIPT BACKEND ====================
// Bu dosyayı Google Apps Script'e yapıştırın ve deploy edin
// Deploy → New Deployment → Web App → Execute as: Me, Who has access: Anyone

// Debug mode - Production'da false olmalı
const DEBUG = false;

// Debug logger - Production'da log'ları devre dışı bırakır
const log = {
  error: (...args) => DEBUG && console.error(...args),
  warn: (...args) => DEBUG && console.warn(...args),
  info: (...args) => DEBUG && console.info(...args),
  log: (...args) => DEBUG && console.log(...args)
};

const CONFIG = {
  // Calendar & Storage
  CALENDAR_ID: 'primary', // veya 'sizin@gmail.com'
  TIMEZONE: 'Europe/Istanbul',
  PROPERTIES_KEY: 'RANDEVU_DATA',
  API_KEY_PROPERTY: 'ADMIN_API_KEY', // Admin API key için property

  // WhatsApp Business Cloud API
  WHATSAPP_API_VERSION: 'v18.0',
  WHATSAPP_PHONE_NUMBER_ID: '', // Meta Business'tan alınacak
  WHATSAPP_ACCESS_TOKEN: '', // Meta Business'tan alınacak (permanent token)
  WHATSAPP_BUSINESS_ACCOUNT_ID: '', // Meta Business'tan alınacak

  // Company Info
  COMPANY_NAME: 'Rolex İzmir İstinyepark',
  COMPANY_LOCATION: 'Rolex İzmir İstinyepark',
  COMPANY_EMAIL: 'istinyeparkrolex35@gmail.com',
  ADMIN_EMAIL: 'istinyeparkrolex35@gmail.com',

  // Appointment Types
  APPOINTMENT_TYPES: {
    DELIVERY: 'delivery',
    MEETING: 'meeting',
    SERVICE: 'service',        // YENİ: Teknik Servis
    MANAGEMENT: 'management'   // YENİ: Yönetim Randevusu
  },

  // Appointment Type Labels
  APPOINTMENT_TYPE_LABELS: {
    delivery: 'Teslim',
    meeting: 'Görüşme',
    service: 'Teknik Servis',     // YENİ
    management: 'Yönetim'          // YENİ
  },

  // Service Names (Email "Konu" alanı için)
  SERVICE_NAMES: {
    delivery: 'Saat Teslimi',
    meeting: 'Görüşme',
    service: 'Teknik Servis',      // YENİ
    management: 'Yönetim'           // YENİ
  },

  // Email Subjects
  EMAIL_SUBJECTS: {
    CUSTOMER_CONFIRMATION: 'Randevunuz Onaylandı - Rolex İzmir İstinyepark',
    STAFF_NOTIFICATION: 'Yeni Randevu',
    API_KEY_RENEWED: 'API Key Yenilendi - Rolex Randevu Sistemi',
    API_KEY_INITIAL: 'API Key - Rolex Randevu Sistemi'
  },

  // Error Messages
  ERROR_MESSAGES: {
    CALENDAR_NOT_FOUND: 'Takvim yapılandırması bulunamadı.',
    NAME_REQUIRED: 'İsim zorunludur',
    INVALID_EMAIL: 'Geçersiz e-posta adresi',
    INVALID_DATE_FORMAT: 'Geçersiz tarih formatı (YYYY-MM-DD bekleniyor)',
    INVALID_TIME_FORMAT: 'Geçersiz saat formatı (HH:MM bekleniyor)',
    CUSTOMER_NAME_REQUIRED: 'Müşteri adı zorunludur',
    CUSTOMER_PHONE_REQUIRED: 'Müşteri telefonu zorunludur',
    STAFF_NOT_FOUND: 'Çalışan bulunamadı',
    APPOINTMENT_NOT_FOUND: 'Randevu bulunamadı',
    STAFF_REQUIRED: 'Çalışan seçilmelidir',
    INVALID_APPOINTMENT_TYPE: 'Geçersiz randevu tipi',
    INVALID_SHIFT_TYPE: 'Geçersiz vardiya tipi',
    INVALID_API_KEY: 'Geçersiz API key',
    AUTH_ERROR: 'Yetkilendirme hatası. Geçerli bir API key gereklidir.',
    UNKNOWN_ACTION: 'Bilinmeyen aksiyon',
    SERVER_ERROR: 'Sunucuda bir hata oluştu. Lütfen tekrar deneyin.',
    EMAIL_SEND_FAILED: 'E-posta gönderilemedi',
    MAX_DELIVERY_REACHED: 'Bu gün için maksimum {max} teslim randevusu oluşturulabilir',
    DAILY_DELIVERY_LIMIT: 'Günlük teslim randevu limiti ({max}) doldu',
    PAST_TIME: 'Geçmiş saat',
    TABLES_FULL: 'Servis masaları dolu (max 2)',
    DELIVERY_CONFLICT: 'Bu saatte başka teslim randevusu var',
    STAFF_CONFLICT: 'Çalışanın bu saatte randevusu var'
  },

  // Success Messages
  SUCCESS_MESSAGES: {
    APPOINTMENT_CREATED: 'Randevu başarıyla oluşturuldu',
    APPOINTMENT_DELETED: 'Randevu silindi',
    DATA_RESET: 'Veriler sıfırlandı ve yeni staff listesi yüklendi',
    API_KEY_SENT: 'API key e-posta ile gönderildi'
  },

  // Date and Time Localization
  LOCALIZATION: {
    MONTHS: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
             'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
    DAYS: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']
  },

  // Shift Hours (used in availability calculation)
  SHIFT_HOURS: {
    morning: { start: '10:00', end: '14:30' },
    evening: { start: '14:30', end: '19:00' },
    full: { start: '10:00', end: '19:00' }
  },

  // Email Template Texts
  EMAIL_TEMPLATES: {
    CUSTOMER: {
      GREETING: 'Sayın',
      CONFIRMATION: 'Randevunuz başarı ile onaylanmıştır.',
      LOOKING_FORWARD: 'Sizi mağazamızda ağırlamayı sabırsızlıkla bekliyoruz. Randevunuza zamanında gelmenizi rica ederiz.',
      SECTION_TITLE: 'RANDEVU BİLGİLERİ',
      LABELS: {
        DATE: 'Tarih',
        TIME: 'Saat',
        SUBJECT: 'Konu',
        CONTACT_PERSON: 'İlgili',
        STORE: 'Mağaza',
        NOTES: 'Ek Bilgi'
      },
      CHANGE_INFO: 'Randevunuzda herhangi bir değişiklik yapmanız gerektiği takdirde, lütfen en geç 24 saat öncesinden ilgili danışman ile irtibata geçiniz.',
      CONTACT_INFO: 'En kısa sürede sizinle buluşmayı sabırsızlıkla bekliyoruz. Herhangi bir sorunuz olması durumunda bizimle iletişime geçmekten çekinmeyin.',
      CLOSING: 'Saygılarımızla'
    },
    // YENİ: Randevu türüne göre dinamik içerik blokları
    DELIVERY: {
      INFO: 'Teslimat esnasında kimlik belgenizi yanınızda bulundurmanızı hatırlatmak isteriz. Ayrıca, saatinizin bakım ve kullanım koşulları hakkında kapsamlı bilgilendirme yapılacağından, teslimat için yaklaşık 30 dakikalık bir süre ayırmanızı öneririz.'
    },
    SERVICE: {
      INFO: 'Teknik servis randevunuz için saatinizi ve ilgili belgeleri (garanti kartı vb.) yanınızda getirmenizi rica ederiz. Uzman ekibimiz saatinizin durumu hakkında size detaylı bilgi verecektir.'
    },
    MEETING: {
      INFO: 'Görüşme randevumuzda size en iyi şekilde yardımcı olabilmemiz için özel bir zaman ayırdık.'
    },
    STAFF: {
      GREETING: 'Sayın',
      NOTIFICATION: 'Aşağıda detayları belirtilen randevu tarafınıza atanmıştır.',
      SECTION_TITLE: 'RANDEVU BİLGİLERİ',
      LABELS: {
        CUSTOMER: 'Müşteri',
        CONTACT: 'İletişim',
        EMAIL: 'E-posta',
        DATE: 'Tarih',
        TIME: 'Saat',
        SUBJECT: 'Konu',
        CONTACT_PERSON: 'İlgili',
        NOTES: 'Ek Bilgi'
      },
      PREPARATION: 'Randevuya ilişkin gerekli hazırlıkların tamamlanması rica olunur.',
      CLOSING: 'Saygılarımızla'
    },
    COMMON: {
      NOT_SPECIFIED: 'Belirtilmedi'
    }
  },

  // ICS Calendar Texts
  ICS_TEMPLATES: {
    CUSTOMER_TYPES: {
      delivery: 'Saat Takdimi',
      service: 'Teknik Servis',      // YENİ
      meeting: 'Genel Görüşme',
      management: 'Yönetim'           // YENİ
    },
    SECTION_TITLE: 'RANDEVU BİLGİLERİ',
    LABELS: {
      CONTACT_PERSON: 'İlgili',
      CONTACT: 'İletişim',
      EMAIL: 'E-posta',
      DATE: 'Tarih',
      TIME: 'Saat',
      SUBJECT: 'Konu',
      NOTES: 'Ek Bilgi'
    },
    REMINDERS: {
      ON_TIME: 'Randevunuza zamanında gelmenizi rica ederiz.',
      BRING_ID: 'Lütfen kimlik belgenizi yanınızda bulundurun.',
      BRING_WATCH: 'Lütfen saatinizi ve ilgili belgeleri yanınızda getirin.'  // YENİ
    },
    CONFIRMED: 'Randevunuz onaylandı',
    PRODID: '-//Rolex İzmir İstinyepark//Randevu Sistemi//TR',
    ORGANIZER_NAME: 'Rolex İzmir İstinyepark'
  }
};

// Validation Constants
const VALIDATION = {
  STRING_MAX_LENGTH: 100,
  PHONE_MAX_LENGTH: 20,
  NOTE_MAX_LENGTH: 500,
  INTERVAL_MIN: 15,
  INTERVAL_MAX: 240,
  MAX_DAILY_MIN: 1,
  MAX_DAILY_MAX: 20
};

// ==================== DATE UTILITIES ====================
// Tarih formatlama fonksiyonları - tek yerden yönetim

const DateUtils = {
  /**
   * YYYY-MM-DD formatında tarih döndürür (local timezone)
   * @param {Date} date - Formatlanacak tarih
   * @returns {string} YYYY-MM-DD formatında tarih
   */
  toLocalDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * ICS takvim formatında tarih döndürür (YYYYMMDDTHHmmss)
   * @param {Date} date - Formatlanacak tarih
   * @returns {string} ICS formatında tarih
   */
  toICSDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}T${hours}${minutes}${seconds}`;
  },

  /**
   * Türkçe okunabilir formatta tarih döndürür
   * Örnek: "12 Ekim 2025, Salı"
   * @param {string} dateStr - YYYY-MM-DD formatında tarih string
   * @returns {string} Türkçe formatında tarih
   */
  toTurkishDate(dateStr) {
    const d = new Date(dateStr);
    return `${d.getDate()} ${CONFIG.LOCALIZATION.MONTHS[d.getMonth()]} ${d.getFullYear()}, ${CONFIG.LOCALIZATION.DAYS[d.getDay()]}`;
  }
};

// ==================== UTILITY FUNCTIONS ====================
// Validation ve Sanitization
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  // Basit email regex - RFC 5322 compliant değil ama pratik
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

function sanitizeString(str, maxLength) {
  if (!str || typeof str !== 'string') return '';
  // Trim ve max length uygula
  return str.trim().substring(0, maxLength);
}

function sanitizePhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  // Sadece rakam, +, -, boşluk ve parantez karakterlerine izin ver
  return phone.replace(/[^0-9+\-\s()]/g, '').trim().substring(0, VALIDATION.PHONE_MAX_LENGTH);
}

/**
 * İsmi Title Case formatına çevirir (Her Kelimenin İlk Harfi Büyük)
 * Örnek: "SERDAR BENLİ" → "Serdar Benli", "serdar benli" → "Serdar Benli"
 * @param {string} name - Formatlanacak isim
 * @returns {string} Title Case formatında isim
 */
function toTitleCase(name) {
  if (!name || typeof name !== 'string') return '';

  return name
    .trim()
    .toLowerCase()
    .split(' ')
    .map(word => {
      if (word.length === 0) return word;
      // İlk harfi büyük, geri kalanı küçük
      return word.charAt(0).toLocaleUpperCase('tr-TR') + word.slice(1);
    })
    .join(' ');
}

// Takvim nesnesini döndür - merkezi hata yönetimi ile
function getCalendar() {
  const calendar = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
  if (!calendar) {
    log.error('Takvim bulunamadı. CALENDAR_ID kontrol edin:', CONFIG.CALENDAR_ID);
    throw new Error(CONFIG.ERROR_MESSAGES.CALENDAR_NOT_FOUND);
  }
  return calendar;
}

// Tarih aralığı hesaplama - kod tekrarını önler
function getDateRange(dateStr) {
  const startDate = new Date(dateStr + 'T00:00:00');
  const endDate = new Date(dateStr + 'T23:59:59');
  return { startDate, endDate };
}

// Personel doğrulama ve temizleme - DRY prensibi
function validateAndSanitizeStaff(name, phone, email) {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return { error: CONFIG.ERROR_MESSAGES.NAME_REQUIRED };
  }
  if (email && !isValidEmail(email)) {
    return { error: CONFIG.ERROR_MESSAGES.INVALID_EMAIL };
  }
  return {
    name: toTitleCase(sanitizeString(name, VALIDATION.STRING_MAX_LENGTH)),
    phone: sanitizePhone(phone),
    email: email ? sanitizeString(email, VALIDATION.STRING_MAX_LENGTH) : ''
  };
}

// Event'i appointment objesine çevir (getAppointments, getWeekAppointments, getMonthAppointments için)
function mapEventToAppointment(event) {
  return {
    id: event.getId(),
    summary: event.getTitle(),
    start: { dateTime: event.getStartTime().toISOString() },
    end: { dateTime: event.getEndTime().toISOString() },
    extendedProperties: {
      private: event.getTag('staffId') ? {
        staffId: event.getTag('staffId'),
        customerPhone: event.getTag('customerPhone'),
        shiftType: event.getTag('shiftType'),
        appointmentType: event.getTag('appointmentType')
      } : {}
    }
  };
}

// Email template'leri - kod organizasyonu için ayrı fonksiyonlar

// Generic email template builder - DRY prensibi
function generateEmailTemplate(type, data) {
  const config = CONFIG.EMAIL_TEMPLATES[type.toUpperCase()];
  if (!config) throw new Error(`Geçersiz email template tipi: ${type}`);

  const { GREETING, SECTION_TITLE, LABELS, CLOSING } = config;

  // Ana mesaj (type'a göre farklı)
  const mainText = type === 'customer'
    ? `${config.CONFIRMATION}<br>${config.LOOKING_FORWARD}`
    : config.NOTIFICATION;

  // Tablo satırları - config'deki label'lara göre dinamik
  const tableRows = Object.entries(LABELS).map(([key, label]) => {
    const value = data[key] || CONFIG.EMAIL_TEMPLATES.COMMON.NOT_SPECIFIED;
    return `
      <tr>
        <td style="padding: 8px 12px 8px 0; font-weight: bold; width: 35%; vertical-align: top;">${label}</td>
        <td style="padding: 8px 0; vertical-align: top; word-wrap: break-word;">${value}</td>
      </tr>
    `;
  }).join('');

  // Customer için ekstra paragraflar - DİNAMİK YAPI
  let additionalContent = '';
  if (type === 'customer') {
    // Randevu türüne göre dinamik içerik seç
    let typeSpecificInfo = '';
    const { appointmentType } = data;
    if (appointmentType === CONFIG.APPOINTMENT_TYPES.DELIVERY && CONFIG.EMAIL_TEMPLATES.DELIVERY) {
      typeSpecificInfo = `<p style="line-height: 1.8;">${CONFIG.EMAIL_TEMPLATES.DELIVERY.INFO}</p>`;
    } else if (appointmentType === CONFIG.APPOINTMENT_TYPES.SERVICE && CONFIG.EMAIL_TEMPLATES.SERVICE) {
      typeSpecificInfo = `<p style="line-height: 1.8;">${CONFIG.EMAIL_TEMPLATES.SERVICE.INFO}</p>`;
    } else if (CONFIG.EMAIL_TEMPLATES.MEETING) {
      typeSpecificInfo = `<p style="line-height: 1.8;">${CONFIG.EMAIL_TEMPLATES.MEETING.INFO}</p>`;
    }

    additionalContent = `
      ${typeSpecificInfo}
      <p style="line-height: 1.8;">${config.CHANGE_INFO}</p>
      <p style="line-height: 1.8;">${config.CONTACT_INFO}</p>
      <p style="margin-top: 30px; line-height: 1.8;">
        <strong>Tel:</strong> ${data.staffPhone}<br>
        <strong>E-posta:</strong> ${data.staffEmail}
      </p>
    `;
  } else {
    additionalContent = `<p>${config.PREPARATION}</p>`;
  }

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <p>${GREETING} ${data.name},</p>
      <p>${mainText}</p>

      <div style="margin: 30px 0; padding: 20px; background: #f9f9f9; border-left: 3px solid #C9A55A;">
        <h3 style="margin-top: 0; color: #1A1A2E; font-weight: normal; letter-spacing: 1px;">${SECTION_TITLE}</h3>
        <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
          ${tableRows}
        </table>
      </div>

      ${additionalContent}

      <p style="margin-top: 30px;">
        ${CLOSING},<br>
        <strong>${CONFIG.COMPANY_NAME}</strong>
      </p>
    </div>
  `;
}

function getCustomerEmailTemplate(data) {
  // Generic template builder kullan - DİNAMİK İÇERİK İÇİN appointmentType eklendi
  return generateEmailTemplate('customer', {
    name: data.customerName,
    DATE: data.formattedDate,
    TIME: data.time,
    SUBJECT: data.serviceName,
    CONTACT_PERSON: data.staffName,
    STORE: CONFIG.COMPANY_NAME,
    NOTES: data.customerNote || '',
    staffPhone: data.staffPhone,
    staffEmail: data.staffEmail,
    appointmentType: data.appointmentType  // YENİ: Dinamik içerik için
  });
}

function generateCustomerICS(data) {
  const { staffName, staffPhone, staffEmail, date, time, duration, appointmentType, customerNote, formattedDate } = data;

  // Başlangıç ve bitiş zamanları
  const startDateTime = new Date(date + 'T' + time + ':00');
  const endDateTime = new Date(startDateTime.getTime() + (duration * 60 * 1000));

  // Müşteri takvimi için randevu türü adı
  const appointmentTypeName = CONFIG.ICS_TEMPLATES.CUSTOMER_TYPES[appointmentType] ||
    CONFIG.SERVICE_NAMES[appointmentType] || appointmentType;

  // Event başlığı: İzmir İstinyepark Rolex - İlgili (Görüşme Türü)
  const summary = `İzmir İstinyepark Rolex - ${staffName} (${appointmentTypeName})`;

  // Description - DİNAMİK YAPI: Randevu türüne göre farklı hatırlatmalar
  let description = `${CONFIG.ICS_TEMPLATES.SECTION_TITLE}\\n\\n`;
  description += `${CONFIG.ICS_TEMPLATES.LABELS.CONTACT_PERSON}: ${staffName}\\n`;
  description += `${CONFIG.ICS_TEMPLATES.LABELS.CONTACT}: ${staffPhone || CONFIG.EMAIL_TEMPLATES.COMMON.NOT_SPECIFIED}\\n`;
  description += `${CONFIG.ICS_TEMPLATES.LABELS.EMAIL}: ${staffEmail || CONFIG.EMAIL_TEMPLATES.COMMON.NOT_SPECIFIED}\\n`;
  description += `${CONFIG.ICS_TEMPLATES.LABELS.DATE}: ${formattedDate}\\n`;
  description += `${CONFIG.ICS_TEMPLATES.LABELS.TIME}: ${time}\\n`;
  description += `${CONFIG.ICS_TEMPLATES.LABELS.SUBJECT}: ${appointmentTypeName}\\n`;
  if (customerNote) {
    description += `${CONFIG.ICS_TEMPLATES.LABELS.NOTES}: ${customerNote}\\n`;
  }
  description += `\\n${CONFIG.ICS_TEMPLATES.REMINDERS.ON_TIME}`;
  // Randevu türüne göre özel hatırlatmalar
  if (appointmentType === CONFIG.APPOINTMENT_TYPES.DELIVERY) {
    description += `\\n${CONFIG.ICS_TEMPLATES.REMINDERS.BRING_ID}`;
  } else if (appointmentType === CONFIG.APPOINTMENT_TYPES.SERVICE) {
    description += `\\n${CONFIG.ICS_TEMPLATES.REMINDERS.BRING_WATCH}`;
  }

  // ÇOKLU ALARM SİSTEMİ - 3 Farklı Alarm
  // Alarm 1: 1 gün önce
  // Alarm 2: Randevu günü sabah 10:00 Türkiye saati (UTC+3 → 07:00 UTC)
  // Alarm 3: 1 saat önce
  const appointmentDate = new Date(date);
  const alarmYear = appointmentDate.getFullYear();
  const alarmMonth = String(appointmentDate.getMonth() + 1).padStart(2, '0');
  const alarmDay = String(appointmentDate.getDate()).padStart(2, '0');
  const alarm10AM_UTC = `VALUE=DATE-TIME:${alarmYear}${alarmMonth}${alarmDay}T070000Z`;

  // ICS içeriği - VTIMEZONE tanımı ile + 3 ALARM
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${CONFIG.ICS_TEMPLATES.PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE',
    'TZID:Europe/Istanbul',
    'BEGIN:STANDARD',
    'DTSTART:19701025T040000',
    'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10',
    'TZOFFSETFROM:+0300',
    'TZOFFSETTO:+0300',
    'TZNAME:+03',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:rolex-${Date.now()}@istinyepark.com`,
    `DTSTAMP:${DateUtils.toICSDate(new Date())}Z`,
    `DTSTART;TZID=Europe/Istanbul:${DateUtils.toICSDate(startDateTime)}`,
    `DTEND;TZID=Europe/Istanbul:${DateUtils.toICSDate(endDateTime)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${CONFIG.COMPANY_LOCATION}`,
    `STATUS:${CONFIG.ICS_TEMPLATES.CONFIRMED}`,
    `ORGANIZER;CN=${CONFIG.ICS_TEMPLATES.ORGANIZER_NAME}:mailto:${CONFIG.COMPANY_EMAIL}`,
    // ALARM 1: 1 saat önce
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    `DESCRIPTION:Randevunuz 1 saat sonra: ${summary}`,
    'END:VALARM',
    // ALARM 2: 1 gün önce
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    `DESCRIPTION:Randevunuz yarın: ${summary}`,
    'END:VALARM',
    // ALARM 3: Randevu günü sabah 10:00
    'BEGIN:VALARM',
    `TRIGGER;${alarm10AM_UTC}`,
    'ACTION:DISPLAY',
    `DESCRIPTION:Bugün randevunuz var: ${summary}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  return icsContent;
}

function getStaffEmailTemplate(data) {
  // Generic template builder kullan
  return generateEmailTemplate('staff', {
    name: data.staffName,
    CUSTOMER: data.customerName,
    CONTACT: data.customerPhone,
    EMAIL: data.customerEmail,
    DATE: data.formattedDate,
    TIME: data.time,
    SUBJECT: data.serviceName,
    CONTACT_PERSON: data.staffName,
    NOTES: data.customerNote || ''
  });
}

// ==================== API KEY MANAGEMENT ====================
// Admin fonksiyonları için API key yönetimi

// API Key oluştur/yenile
function generateApiKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = 'RLX_'; // Prefix for Rolex
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

// API Key'i kaydet
function saveApiKey(key) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty(CONFIG.API_KEY_PROPERTY, key);
  return key;
}

// API Key'i getir
function getApiKey() {
  const props = PropertiesService.getScriptProperties();
  let key = props.getProperty(CONFIG.API_KEY_PROPERTY);

  // Eğer key yoksa yeni oluştur
  if (!key) {
    key = generateApiKey();
    saveApiKey(key);
  }

  return key;
}

// API Key doğrula
function validateApiKey(providedKey) {
  if (!providedKey) return false;

  const storedKey = getApiKey();
  return providedKey === storedKey;
}

// API Key'i yenile (eski key ile doğrulama gerekir)
function regenerateApiKey(oldKey) {
  if (!validateApiKey(oldKey)) {
    return { success: false, error: CONFIG.ERROR_MESSAGES.INVALID_API_KEY };
  }

  const newKey = generateApiKey();
  saveApiKey(newKey);

  // Admin'e e-posta gönder
  try {
    MailApp.sendEmail({
      to: CONFIG.ADMIN_EMAIL,
      subject: CONFIG.EMAIL_SUBJECTS.API_KEY_RENEWED,
      name: CONFIG.COMPANY_NAME,
      htmlBody: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h3>API Key Yenilendi</h3>
          <p>Randevu sistemi admin paneli API key'iniz yenilenmiştir.</p>
          <div style="background: #f5f5f5; padding: 15px; margin: 20px 0; font-family: monospace;">
            ${newKey}
          </div>
          <p><strong>Önemli:</strong> Bu key'i güvenli bir yerde saklayın ve kimseyle paylaşmayın.</p>
          <p>Tarih: ${new Date().toLocaleString('tr-TR')}</p>
        </div>
      `
    });
  } catch (e) {
    log.error('API key yenileme e-postası gönderilemedi:', e);
  }

  return { success: true, apiKey: newKey };
}

// İlk kurulum - API key oluştur ve admin'e gönder
function initializeApiKey() {
  const existingKey = getApiKey();

  // Admin'e e-posta gönder
  try {
    MailApp.sendEmail({
      to: CONFIG.ADMIN_EMAIL,
      subject: CONFIG.EMAIL_SUBJECTS.API_KEY_INITIAL,
      name: CONFIG.COMPANY_NAME,
      htmlBody: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h3>Randevu Sistemi API Key</h3>
          <p>Admin paneline erişim için API key'iniz:</p>
          <div style="background: #f5f5f5; padding: 15px; margin: 20px 0; font-family: monospace; word-break: break-all;">
            ${existingKey}
          </div>
          <p><strong>Önemli:</strong> Bu key'i güvenli bir yerde saklayın ve kimseyle paylaşmayın.</p>
          <p>Admin paneline giriş yaparken bu key'i kullanın.</p>
        </div>
      `
    });
    return { success: true, message: CONFIG.SUCCESS_MESSAGES.API_KEY_SENT, apiKey: existingKey };
  } catch (e) {
    log.error('API key e-postası gönderilemedi:', e);
    // E-posta gönderilmese bile API key'i döndür
    return { success: true, apiKey: existingKey, warning: 'API key oluşturuldu ancak e-posta gönderilemedi' };
  }
}

// ==================== CACHE (Script-wide with CacheService) ====================
// Google Apps Script CacheService kullanarak gerçek cache implementasyonu
// 15 dakika süre ile cache tutulur - API performansını dramatik şekilde artırır

const CACHE_DURATION = 900; // 15 dakika (saniye cinsinden)
const DATA_CACHE_KEY = 'app_data';

// CacheService helper - DRY prensibi
function getCache() {
  return CacheService.getScriptCache();
}

// ==================== MAIN HANDLER ====================
// Admin işlemleri için API key gereken action'lar
const ADMIN_ACTIONS = [
  'addStaff', 'toggleStaff', 'removeStaff', 'updateStaff',
  'saveShifts', 'saveSettings', 'deleteAppointment', 'resetData',
  'regenerateApiKey',
  'createManualAppointment',      // YENİ
  'getTodayWhatsAppReminders',    // YENİ
  'sendWhatsAppReminders',        // YENİ: WhatsApp Business API
  'updateWhatsAppSettings',       // YENİ: WhatsApp Business API
  'getWhatsAppSettings'           // YENİ: WhatsApp Business API
];

// Action handler map - daha okunabilir ve yönetilebilir
const ACTION_HANDLERS = {
  // Test
  'test': () => ({ status: 'ok', message: 'Apps Script çalışıyor!' }),

  // API Key management
  'initializeApiKey': () => initializeApiKey(),
  'regenerateApiKey': (e) => regenerateApiKey(e.parameter.oldKey),

  // Staff management
  'getStaff': () => getStaff(),
  'addStaff': (e) => addStaff(e.parameter.name, e.parameter.phone, e.parameter.email),
  'toggleStaff': (e) => toggleStaff(e.parameter.id),
  'removeStaff': (e) => removeStaff(e.parameter.id),
  'updateStaff': (e) => updateStaff(e.parameter.id, e.parameter.name, e.parameter.phone, e.parameter.email),

  // Shifts management
  'getShifts': (e) => getShifts(e.parameter.date),
  'getMonthShifts': (e) => getMonthShifts(e.parameter.month),
  'saveShifts': (e) => saveShifts(JSON.parse(e.parameter.shifts)),

  // Settings management
  'getSettings': () => getSettings(),
  'saveSettings': (e) => saveSettings(e.parameter),

  // Appointments
  'getAppointments': (e) => getAppointments(e.parameter.date, {
    countOnly: e.parameter.countOnly === 'true',
    appointmentType: e.parameter.appointmentType || null
  }),
  'getWeekAppointments': (e) => getWeekAppointments(e.parameter.startDate, e.parameter.endDate),
  'deleteAppointment': (e) => deleteAppointment(e.parameter.eventId),
  'getMonthAppointments': (e) => getMonthAppointments(e.parameter.month),
  'getGoogleCalendarEvents': (e) => getGoogleCalendarEvents(e.parameter.startDate, e.parameter.endDate, e.parameter.staffId),
  'createAppointment': (e) => createAppointment(e.parameter),

  // Availability calculation (server-side blocking logic)
  'checkTimeSlotAvailability': (e) => checkTimeSlotAvailability(
    e.parameter.date,
    e.parameter.staffId,
    e.parameter.shiftType,
    e.parameter.appointmentType,
    e.parameter.interval
  ),

  // YENİ: WhatsApp ve Manuel Randevu
  'getTodayWhatsAppReminders': (e) => getTodayWhatsAppReminders(e.parameter.date),
  'createManualAppointment': (e) => createManualAppointment(e.parameter),

  // WhatsApp Business Cloud API
  'sendWhatsAppReminders': (e) => sendWhatsAppReminders(e.parameter.date, e.parameter.apiKey),
  'updateWhatsAppSettings': (e) => updateWhatsAppSettings(JSON.parse(e.parameter.settings), e.parameter.apiKey),
  'getWhatsAppSettings': (e) => getWhatsAppSettings(e.parameter.apiKey),

  // Data management
  'resetData': () => resetData()
};

function doGet(e) {
  try {
    const action = e.parameter.action;
    const apiKey = e.parameter.apiKey; // API key parametresi
    // ✅ GÜVENLİK GÜNCELLEMESİ: JSONP desteği kaldırıldı - sadece JSON döndürülür

    let response = {};

    try {
      // Admin action kontrolü - API key gerekli mi?
      if (ADMIN_ACTIONS.includes(action)) {
        if (!validateApiKey(apiKey)) {
          response = {
            success: false,
            error: CONFIG.ERROR_MESSAGES.AUTH_ERROR,
            requiresAuth: true
          };
        } else {
          // API key geçerli, handler'ı çalıştır
          const handler = ACTION_HANDLERS[action];
          if (!handler) {
            response = { success: false, error: CONFIG.ERROR_MESSAGES.UNKNOWN_ACTION + ': ' + action };
          } else {
            response = handler(e);
          }
        }
      } else {
        // Normal action (API key gerekmez)
        const handler = ACTION_HANDLERS[action];

        if (!handler) {
          response = { success: false, error: CONFIG.ERROR_MESSAGES.UNKNOWN_ACTION + ': ' + action };
        } else {
          response = handler(e);
        }
      }
    } catch (error) {
      // Detaylı hata bilgisini sadece sunucu tarafında logla (güvenlik)
      log.error('API Hatası:', {
        message: error.message,
        stack: error.stack,
        action: action,
        parameters: e.parameter
      });
      // Kullanıcıya sadece genel hata mesajı gönder
      response = { success: false, error: CONFIG.ERROR_MESSAGES.SERVER_ERROR };
    }

    // ✅ Her zaman JSON döndür (JSONP desteği kaldırıldı - güvenlik iyileştirmesi)
    const output = ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);

    // CORS: Google Apps Script otomatik olarak Access-Control-Allow-Origin: * ekler
    return output;

  } catch (mainError) {
    // En dıştaki catch - JSON döndür
    log.error('Ana hata:', mainError);

    const errorResponse = { success: false, error: mainError.toString() };

    return ContentService
      .createTextOutput(JSON.stringify(errorResponse))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ==================== DATA STORAGE ====================
function getData() {
  const cache = getCache();

  // 1. Cache'den veriyi kontrol et
  const cachedData = cache.get(DATA_CACHE_KEY);
  if (cachedData) {
    try {
      return JSON.parse(cachedData);
    } catch (e) {
      log.warn('Cache parse hatası:', e);
      // Cache bozuksa devam et, PropertiesService'den oku
    }
  }

  // 2. Cache'de yok, PropertiesService'den oku
  const props = PropertiesService.getScriptProperties();
  const data = props.getProperty(CONFIG.PROPERTIES_KEY);

  if (!data) {
    // 3. Varsayılan veri
    const defaultData = {
      staff: [
        { id: 1, name: 'Serdar Benli', active: true },
        { id: 2, name: 'Ece Argun', active: true },
        { id: 3, name: 'Gökhan Tokol', active: true },
        { id: 4, name: 'Sırma', active: true },
        { id: 5, name: 'Gamze', active: true },
        { id: 6, name: 'Okan', active: true }
      ],
      shifts: {}, // { 'YYYY-MM-DD': { staffId: 'morning|evening|full' } }
      settings: {
        interval: 60,
        maxDaily: 4
      }
    };
    saveData(defaultData);
    return defaultData;
  }

  // 4. Parse et ve cache'e kaydet
  const parsedData = JSON.parse(data);
  try {
    cache.put(DATA_CACHE_KEY, data, CACHE_DURATION);
  } catch (e) {
    log.warn('Cache yazma hatası (veri çok büyük olabilir):', e);
    // Cache yazılamazsa da devam et, sadece performans etkilenir
  }

  return parsedData;
}

function saveData(data) {
  const props = PropertiesService.getScriptProperties();
  const jsonData = JSON.stringify(data);

  // 1. PropertiesService'e kaydet
  props.setProperty(CONFIG.PROPERTIES_KEY, jsonData);

  // 2. Cache'i temizle (veri değiştiği için)
  const cache = getCache();
  cache.remove(DATA_CACHE_KEY);

  // 3. Yeni veriyi cache'e yaz (sonraki okumalar için)
  try {
    cache.put(DATA_CACHE_KEY, jsonData, CACHE_DURATION);
  } catch (e) {
    log.warn('Cache yazma hatası:', e);
    // Cache yazılamazsa da devam et
  }
}

// Tüm veriyi sıfırla ve yeni default data yükle
function resetData() {
  try {
    const props = PropertiesService.getScriptProperties();
    props.deleteProperty(CONFIG.PROPERTIES_KEY);

    // Cache'i temizle
    const cache = getCache();
    cache.remove(DATA_CACHE_KEY);

    // Yeni default data yüklenir
    getData();

    return { success: true, message: CONFIG.SUCCESS_MESSAGES.DATA_RESET };
  } catch (error) {
    log.error('Reset data error:', error);
    return { success: false, error: error.toString() };
  }
}

// ==================== API FUNCTIONS ====================

// ==================== STAFF MANAGEMENT ====================

// Çalışanları getir
function getStaff() {
  const data = getData();
  return { success: true, data: data.staff || [] };
}

// Çalışan ekle
function addStaff(name, phone, email) {
  try {
    // Validation ve sanitization - DRY prensibi
    const validationResult = validateAndSanitizeStaff(name, phone, email);
    if (validationResult.error) {
      return { success: false, error: validationResult.error };
    }

    const data = getData();
    const newId = data.staff.length > 0 ? Math.max(...data.staff.map(s => s.id)) + 1 : 1;
    data.staff.push({
      id: newId,
      name: validationResult.name,
      phone: validationResult.phone,
      email: validationResult.email,
      active: true
    });
    saveData(data);
    return { success: true, data: data.staff };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Çalışan aktif/pasif yap
function toggleStaff(staffId) {
  try {
    const data = getData();
    const staff = data.staff.find(s => s.id === parseInt(staffId));
    if (staff) {
      staff.active = !staff.active;
      saveData(data);
      return { success: true, data: data.staff };
    }
    return { success: false, error: CONFIG.ERROR_MESSAGES.STAFF_NOT_FOUND };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Çalışan sil
function removeStaff(staffId) {
  try {
    const data = getData();
    data.staff = data.staff.filter(s => s.id !== parseInt(staffId));

    // Vardiyalardan da sil
    Object.keys(data.shifts).forEach(date => {
      if (data.shifts[date][staffId]) {
        delete data.shifts[date][staffId];
      }
    });

    saveData(data);
    return { success: true, data: data.staff };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Çalışan güncelle
function updateStaff(staffId, name, phone, email) {
  try {
    // Validation ve sanitization - DRY prensibi
    const validationResult = validateAndSanitizeStaff(name, phone, email);
    if (validationResult.error) {
      return { success: false, error: validationResult.error };
    }

    const data = getData();
    const staff = data.staff.find(s => s.id === parseInt(staffId));
    if (staff) {
      staff.name = validationResult.name;
      staff.phone = validationResult.phone;
      staff.email = validationResult.email;
      saveData(data);
      return { success: true, data: data.staff };
    }
    return { success: false, error: CONFIG.ERROR_MESSAGES.STAFF_NOT_FOUND };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// ==================== SETTINGS MANAGEMENT ====================

// Ayarları getir
function getSettings() {
  const data = getData();
  return {
    success: true,
    data: data.settings || { interval: 60, maxDaily: 4 }
  };
}

// Ayarları kaydet
function saveSettings(params) {
  try {
    // Validation
    const interval = parseInt(params.interval);
    const maxDaily = parseInt(params.maxDaily);

    if (isNaN(interval) || interval < VALIDATION.INTERVAL_MIN || interval > VALIDATION.INTERVAL_MAX) {
      return { success: false, error: `Randevu süresi ${VALIDATION.INTERVAL_MIN}-${VALIDATION.INTERVAL_MAX} dakika arasında olmalıdır` };
    }

    if (isNaN(maxDaily) || maxDaily < VALIDATION.MAX_DAILY_MIN || maxDaily > VALIDATION.MAX_DAILY_MAX) {
      return { success: false, error: `Günlük maksimum randevu sayısı ${VALIDATION.MAX_DAILY_MIN}-${VALIDATION.MAX_DAILY_MAX} arasında olmalıdır` };
    }

    const data = getData();
    data.settings = {
      interval: interval,
      maxDaily: maxDaily
    };
    saveData(data);
    return { success: true, data: data.settings };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// ==================== SHIFTS MANAGEMENT ====================

// Vardiyaları kaydet
function saveShifts(shiftsData) {
  try {
    const data = getData();
    // shiftsData format: { 'YYYY-MM-DD': { staffId: 'morning|evening|full' } }
    Object.keys(shiftsData).forEach(date => {
      if (!data.shifts[date]) {
        data.shifts[date] = {};
      }
      data.shifts[date] = shiftsData[date];
    });
    saveData(data);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Belirli bir gün için vardiyaları getir
function getShifts(date) {
  const data = getData();
  const shifts = data.shifts || {};
  return { success: true, data: shifts[date] || {} };
}

// Bir ay için tüm vardiyaları getir
function getMonthShifts(month) {
  const data = getData();
  const shifts = data.shifts || {};
  const monthShifts = {};

  // YYYY-MM formatında gelen ay parametresi
  Object.keys(shifts).forEach(date => {
    if (date.startsWith(month)) {
      monthShifts[date] = shifts[date];
    }
  });

  return { success: true, data: monthShifts };
}

// Belirli bir gün için randevuları getir
// options.countOnly: true → Sadece sayı döndür
// options.appointmentType: 'delivery'|'meeting' → Sadece bu tipteki randevuları say/döndür
function getAppointments(date, options = {}) {
  const { countOnly = false, appointmentType = null } = options;

  try {
    const calendar = getCalendar();
    const { startDate, endDate } = getDateRange(date);
    let events = calendar.getEvents(startDate, endDate);

    // appointmentType filtresi varsa uygula
    if (appointmentType) {
      events = events.filter(event => {
        const eventType = event.getTag('appointmentType');
        return eventType === appointmentType;
      });
    }

    // Sadece count istendiyse, map'leme yapmadan döndür (performans optimizasyonu)
    if (countOnly) {
      return { success: true, count: events.length };
    }

    // Tüm veri istendiyse map'le
    const appointments = events.map(event => mapEventToAppointment(event));
    return { success: true, items: appointments };

  } catch (error) {
    log.error('getAppointments hatası:', error);
    return countOnly
      ? { success: true, count: 0 }
      : { success: true, items: [] };
  }
}

// Haftalık randevuları getir
function getWeekAppointments(startDateStr, endDateStr) {
  try {
    const calendar = getCalendar();
    const startDate = new Date(startDateStr + 'T00:00:00');
    const endDate = new Date(endDateStr + 'T23:59:59');
    const events = calendar.getEvents(startDate, endDate);

    const appointments = events.map(event => mapEventToAppointment(event));
    return { success: true, items: appointments };

  } catch (error) {
    log.error('getWeekAppointments hatası:', error);
    return { success: true, items: [] };
  }
}

// Randevu sil
function deleteAppointment(eventId) {
  try {
    const calendar = getCalendar();
    const event = calendar.getEventById(eventId);
    if (!event) {
      return { success: false, error: CONFIG.ERROR_MESSAGES.APPOINTMENT_NOT_FOUND };
    }

    event.deleteEvent();
    log.info('Randevu silindi:', eventId);
    return { success: true, message: CONFIG.SUCCESS_MESSAGES.APPOINTMENT_DELETED };
  } catch (error) {
    log.error('deleteAppointment hatası:', error);
    return { success: false, error: error.toString() };
  }
}

// Bir ay için tüm randevuları getir
function getMonthAppointments(month) {
  try {
    const calendar = getCalendar();

    // YYYY-MM formatından tarihleri oluştur
    const [year, monthNum] = month.split('-');
    const startDate = new Date(year, parseInt(monthNum) - 1, 1);
    const endDate = new Date(year, parseInt(monthNum), 0, 23, 59, 59);
    const events = calendar.getEvents(startDate, endDate);

    // Tarihe göre grupla
    const appointmentsByDate = {};

    events.forEach(event => {
      const eventDate = Utilities.formatDate(
        event.getStartTime(),
        CONFIG.TIMEZONE,
        'yyyy-MM-dd'
      );

      if (!appointmentsByDate[eventDate]) {
        appointmentsByDate[eventDate] = [];
      }

      appointmentsByDate[eventDate].push(mapEventToAppointment(event));
    });

    return { success: true, data: appointmentsByDate };

  } catch (error) {
    log.error('getMonthAppointments hatası:', error);
    return { success: true, data: {} };
  }
}

// Google Calendar'dan mevcut etkinlikleri getir
function getGoogleCalendarEvents(startDateStr, endDateStr, staffId) {
  try {
    const calendar = getCalendar();
    const startDate = new Date(startDateStr + 'T00:00:00');
    const endDate = new Date(endDateStr + 'T23:59:59');
    const events = calendar.getEvents(startDate, endDate);

    // Tarihe göre grupla
    const eventsByDate = {};

    events.forEach(event => {
      const eventDate = Utilities.formatDate(
        event.getStartTime(),
        CONFIG.TIMEZONE,
        'yyyy-MM-dd'
      );

      // staffId filtresi varsa uygula
      const eventStaffId = event.getTag('staffId');
      if (staffId !== 'all' && eventStaffId && eventStaffId !== staffId) {
        return; // Bu staff'a ait değil, atla
      }

      if (!eventsByDate[eventDate]) {
        eventsByDate[eventDate] = [];
      }

      // Start ve end time'ları Türkiye timezone'ında formatla
      const startTimeFormatted = Utilities.formatDate(
        event.getStartTime(),
        CONFIG.TIMEZONE,
        'yyyy-MM-dd\'T\'HH:mm:ss'
      );
      const endTimeFormatted = Utilities.formatDate(
        event.getEndTime(),
        CONFIG.TIMEZONE,
        'yyyy-MM-dd\'T\'HH:mm:ss'
      );
      // Sadece saat bilgisi (HH:mm formatında)
      const startTimeOnly = Utilities.formatDate(
        event.getStartTime(),
        CONFIG.TIMEZONE,
        'HH:mm'
      );

      eventsByDate[eventDate].push({
        id: event.getId(),
        summary: event.getTitle(),
        start: {
          dateTime: startTimeFormatted,
          time: startTimeOnly  // Ek alan: sadece saat
        },
        end: { dateTime: endTimeFormatted },
        extendedProperties: {
          private: {
            staffId: eventStaffId || '',
            appointmentType: event.getTag('appointmentType') || '',
            customerPhone: event.getTag('customerPhone') || ''
          }
        }
      });
    });

    return { success: true, data: eventsByDate };

  } catch (error) {
    log.error('getGoogleCalendarEvents hatası:', error);
    return { success: true, data: {} };
  }
}

// Randevu oluştur
function createAppointment(params) {
  try {
    const {
      date,
      time,
      staffId,
      staffName,
      customerName,
      customerPhone,
      customerEmail,
      customerNote,
      shiftType,
      appointmentType,
      duration
    } = params;

    // ===== VALIDATION =====
    // Date validation (YYYY-MM-DD format)
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { success: false, error: CONFIG.ERROR_MESSAGES.INVALID_DATE_FORMAT };
    }

    // Time validation (HH:MM format)
    if (!time || !/^\d{2}:\d{2}$/.test(time)) {
      return { success: false, error: CONFIG.ERROR_MESSAGES.INVALID_TIME_FORMAT };
    }

    // Customer name validation
    if (!customerName || typeof customerName !== 'string' || customerName.trim().length === 0) {
      return { success: false, error: CONFIG.ERROR_MESSAGES.CUSTOMER_NAME_REQUIRED };
    }

    // Customer phone validation
    if (!customerPhone || typeof customerPhone !== 'string' || customerPhone.trim().length === 0) {
      return { success: false, error: CONFIG.ERROR_MESSAGES.CUSTOMER_PHONE_REQUIRED };
    }

    // Email validation (optional but if provided must be valid)
    if (customerEmail && !isValidEmail(customerEmail)) {
      return { success: false, error: CONFIG.ERROR_MESSAGES.INVALID_EMAIL };
    }

    // Appointment type validation
    const validTypes = Object.values(CONFIG.APPOINTMENT_TYPES);
    if (!appointmentType || !validTypes.includes(appointmentType)) {
      return { success: false, error: CONFIG.ERROR_MESSAGES.INVALID_APPOINTMENT_TYPE };
    }

    // Duration validation
    const durationNum = parseInt(duration);
    if (isNaN(durationNum) || durationNum < VALIDATION.INTERVAL_MIN || durationNum > VALIDATION.INTERVAL_MAX) {
      return { success: false, error: `Randevu süresi ${VALIDATION.INTERVAL_MIN}-${VALIDATION.INTERVAL_MAX} dakika arasında olmalıdır` };
    }

    // Staff ID validation
    if (!staffId) {
      return { success: false, error: CONFIG.ERROR_MESSAGES.STAFF_REQUIRED };
    }

    // Sanitize inputs
    const sanitizedCustomerName = toTitleCase(sanitizeString(customerName, VALIDATION.STRING_MAX_LENGTH));
    const sanitizedCustomerPhone = sanitizePhone(customerPhone);
    const sanitizedCustomerEmail = customerEmail ? sanitizeString(customerEmail, VALIDATION.STRING_MAX_LENGTH) : '';
    const sanitizedCustomerNote = customerNote ? sanitizeString(customerNote, VALIDATION.NOTE_MAX_LENGTH) : '';
    const sanitizedStaffName = staffName ? toTitleCase(sanitizeString(staffName, VALIDATION.STRING_MAX_LENGTH)) : '';

    // getData() - tek seferlik çağrı (DRY prensibi)
    const data = getData();

    // Randevu tipi kontrolü - Teslim randevusu için max kontrolü
    if (appointmentType === CONFIG.APPOINTMENT_TYPES.DELIVERY) {
      const maxDelivery = data.settings?.maxDaily || 4;

      // Partial response: Sadece delivery randevularının sayısını al (performans optimizasyonu)
      const countResult = getAppointments(date, {
        countOnly: true,
        appointmentType: CONFIG.APPOINTMENT_TYPES.DELIVERY
      });

      if (countResult.success && countResult.count >= maxDelivery) {
        return {
          success: false,
          error: CONFIG.ERROR_MESSAGES.MAX_DELIVERY_REACHED.replace('{max}', maxDelivery)
        };
      }
    }

    const calendar = getCalendar();

    // Başlangıç ve bitiş zamanlarını oluştur
    const startDateTime = new Date(date + 'T' + time + ':00');
    const endDateTime = new Date(startDateTime.getTime() + (durationNum * 60 * 1000));

    // Event başlığı - sanitized değerleri kullan
    const appointmentTypeLabel = CONFIG.APPOINTMENT_TYPE_LABELS[appointmentType] || appointmentType;
    const title = `${sanitizedCustomerName} - ${sanitizedStaffName} (${appointmentTypeLabel})`;

    // Event açıklaması - sanitized değerleri kullan
    const description = `
Randevu Detayları:
─────────────────
Müşteri: ${sanitizedCustomerName}
Telefon: ${sanitizedCustomerPhone}
E-posta: ${sanitizedCustomerEmail || CONFIG.EMAIL_TEMPLATES.COMMON.NOT_SPECIFIED}
İlgili: ${sanitizedStaffName}
Konu: ${appointmentTypeLabel}

${sanitizedCustomerNote ? 'Not: ' + sanitizedCustomerNote : ''}

Bu randevu otomatik olarak oluşturulmuştur.
    `.trim();

    // Event oluştur
    const event = calendar.createEvent(title, startDateTime, endDateTime, {
      description: description,
      location: ''
    });

    // Ek bilgileri tag olarak ekle (extendedProperties yerine) - sanitized değerleri kullan
    event.setTag('staffId', String(staffId));
    event.setTag('customerPhone', sanitizedCustomerPhone);
    event.setTag('customerEmail', sanitizedCustomerEmail);
    event.setTag('shiftType', shiftType);
    event.setTag('appointmentType', appointmentType);

    // Tarih formatla (7 Ekim 2025, Salı) - DateUtils kullan
    const formattedDate = DateUtils.toTurkishDate(date);
    const serviceName = CONFIG.SERVICE_NAMES[appointmentType] || appointmentType;

    // Staff bilgisini çek (data zaten yukarıda çekildi)
    const staff = data.staff.find(s => s.id === parseInt(staffId));
    const staffPhone = staff?.phone ?? '';
    const staffEmail = staff?.email ?? '';

    // E-posta bildirimi - Müşteriye (sanitized değerleri kullan)
    if (sanitizedCustomerEmail) {
      try {
        // ICS dosyası oluştur
        const icsContent = generateCustomerICS({
          staffName: sanitizedStaffName,
          staffPhone,
          staffEmail,
          date,
          time,
          duration: durationNum,
          appointmentType,
          customerNote: sanitizedCustomerNote,
          formattedDate
        });

        // ICS dosyasını blob olarak oluştur
        const icsBlob = Utilities.newBlob(icsContent, 'text/calendar', 'randevu.ics');

        MailApp.sendEmail({
          to: sanitizedCustomerEmail,
          subject: CONFIG.EMAIL_SUBJECTS.CUSTOMER_CONFIRMATION,
          name: CONFIG.COMPANY_NAME,
          replyTo: staffEmail || CONFIG.ADMIN_EMAIL,
          htmlBody: getCustomerEmailTemplate({
            customerName: sanitizedCustomerName,
            formattedDate,
            time,
            serviceName,
            staffName: sanitizedStaffName,
            customerNote: sanitizedCustomerNote,
            staffPhone,
            staffEmail,
            appointmentType    // YENİ: Dinamik içerik için
          }),
          attachments: [icsBlob]
        });
      } catch (emailError) {
        log.error('Müşteri e-postası gönderilemedi:', emailError);
      }
    }

    // E-posta bildirimi - Çalışana ve Admin (sanitized değerleri kullan)
    try {
      const staffEmailBody = getStaffEmailTemplate({
        staffName: sanitizedStaffName,
        customerName: sanitizedCustomerName,
        customerPhone: sanitizedCustomerPhone,
        customerEmail: sanitizedCustomerEmail,
        formattedDate,
        time,
        serviceName,
        customerNote: sanitizedCustomerNote
      });

      // Çalışana gönder
      if (staff && staff.email) {
        MailApp.sendEmail({
          to: staff.email,
          subject: `${CONFIG.EMAIL_SUBJECTS.STAFF_NOTIFICATION} - ${sanitizedCustomerName}`,
          name: CONFIG.COMPANY_NAME,
          htmlBody: staffEmailBody
        });
      }

      // Admin'e gönder
      MailApp.sendEmail({
        to: CONFIG.ADMIN_EMAIL,
        subject: `${CONFIG.EMAIL_SUBJECTS.STAFF_NOTIFICATION} - ${sanitizedCustomerName}`,
        name: CONFIG.COMPANY_NAME,
        htmlBody: staffEmailBody
      });

    } catch (staffEmailError) {
      log.error('Çalışan/Admin e-postası gönderilemedi:', staffEmailError);
    }

    return {
      success: true,
      eventId: event.getId(),
      message: CONFIG.SUCCESS_MESSAGES.APPOINTMENT_CREATED
    };

  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// ==================== WHATSAPP HATIRLATMA ====================
// YENİ: WhatsApp hatırlatma linklerini oluştur
/**
 * Belirli bir tarihteki randevular için WhatsApp hatırlatma linkleri oluşturur
 * @param {string} date - YYYY-MM-DD formatında tarih
 * @returns {Object} { success: true, data: [{ customerName, startTime, link }] }
 */
function getTodayWhatsAppReminders(date) {
  try {
    const targetDate = date ? new Date(date + 'T00:00:00') : new Date();
    const calendar = getCalendar();
    const { startDate, endDate } = getDateRange(DateUtils.toLocalDate(targetDate).slice(0, 10));
    const events = calendar.getEvents(startDate, endDate);

    const reminders = events.map(event => {
      const phoneTag = event.getTag('customerPhone');
      if (!phoneTag) return null; // Telefonu yoksa atla

      const appointmentType = event.getTag('appointmentType') || 'Randevu';

      // Event title formatı: "Müşteri Adı - Personel (Tür)"
      const title = event.getTitle();
      const parts = title.split(' - ');
      const customerName = toTitleCase(parts[0]) || 'Değerli Müşterimiz';

      // İlgili kişi ve randevu türü
      let staffName = 'Temsilcimiz';
      let appointmentTypeName = CONFIG.APPOINTMENT_TYPE_LABELS[appointmentType] || 'Randevu';

      if (parts.length > 1) {
        // "Personel (Tür)" kısmını parse et
        const secondPart = parts[1];
        const match = secondPart.match(/^(.+?)\s*\((.+?)\)$/);
        if (match) {
          const parsedStaffName = match[1].trim();
          // HK ve OK kısaltmalarını koruyoruz, diğerlerini Title Case yapıyoruz
          staffName = (parsedStaffName === 'HK' || parsedStaffName === 'OK') ? parsedStaffName : toTitleCase(parsedStaffName);
          appointmentTypeName = match[2].trim(); // "Yönetim" veya "Teslim"
        } else {
          const parsedStaffName = secondPart.trim();
          staffName = (parsedStaffName === 'HK' || parsedStaffName === 'OK') ? parsedStaffName : toTitleCase(parsedStaffName);
        }
      }

      const startTime = Utilities.formatDate(event.getStartTime(), CONFIG.TIMEZONE, 'HH:mm');

      // Yeni WhatsApp mesajı formatı
      const message = `Sayın ${customerName},\n\nBugün saat ${startTime}'teki ${staffName} ile ${appointmentTypeName} randevunuzu hatırlatmak isteriz. Randevunuzda bir değişiklik yapmanız gerekirse lütfen bizi önceden bilgilendiriniz.\n\nSaygılarımızla,\n\nRolex İzmir İstinyepark`;
      const encodedMessage = encodeURIComponent(message);

      // Türkiye telefon formatı: 05XX XXX XX XX → 905XXXXXXXXX
      const cleanPhone = phoneTag.replace(/\D/g, ''); // Sadece rakamlar
      const phone = cleanPhone.startsWith('0') ? '90' + cleanPhone.substring(1) : cleanPhone;
      const link = `https://wa.me/${phone}?text=${encodedMessage}`;

      return { customerName, startTime, staffName, appointmentType: appointmentTypeName, link };
    }).filter(Boolean); // null'ları filtrele

    return { success: true, data: reminders };
  } catch (error) {
    log.error('getTodayWhatsAppReminders error:', error);
    return { success: false, error: 'Hatırlatmalar oluşturulurken bir hata oluştu.' };
  }
}

// ==================== MANUEL RANDEVU OLUŞTURMA ====================
// YENİ: Admin panelinden manuel randevu oluşturma
/**
 * Manuel randevu oluşturur (admin paneli için)
 * MANAGEMENT tipi randevular için limitler uygulanmaz ve e-posta gönderilmez
 * @param {Object} params - { date, time, staffId, customerName, customerPhone, customerEmail, customerNote, appointmentType, duration }
 * @returns {Object} { success, eventId?, error? }
 */
function createManualAppointment(params) {
  try {
    const { date, time, staffId, customerName, customerPhone, customerEmail, customerNote, appointmentType, duration } = params;

    // Temel validasyon
    if (!date || !time || !customerName || !staffId) {
      return { success: false, error: 'Tarih, saat, müşteri adı ve personel zorunludur.' };
    }

    const data = getData();
    const staff = data.staff.find(s => s.id == staffId);
    if (!staff) return { success: false, error: CONFIG.ERROR_MESSAGES.STAFF_NOT_FOUND };

    const isManagement = appointmentType === CONFIG.APPOINTMENT_TYPES.MANAGEMENT;

    // Sanitization
    const sanitizedCustomerName = toTitleCase(sanitizeString(customerName, VALIDATION.STRING_MAX_LENGTH));
    const sanitizedCustomerPhone = sanitizePhone(customerPhone);
    const sanitizedCustomerEmail = customerEmail ? sanitizeString(customerEmail, VALIDATION.STRING_MAX_LENGTH) : '';
    const sanitizedCustomerNote = customerNote ? sanitizeString(customerNote, VALIDATION.NOTE_MAX_LENGTH) : '';

    // Başlangıç ve bitiş zamanları
    const durationNum = parseInt(duration) || 60;
    const startDateTime = new Date(`${date}T${time}:00`);
    const endDateTime = new Date(startDateTime.getTime() + (durationNum * 60 * 1000));

    // Event başlığı
    const appointmentTypeLabel = CONFIG.APPOINTMENT_TYPE_LABELS[appointmentType] || appointmentType;
    const title = `${sanitizedCustomerName} - ${staff.name} (${appointmentTypeLabel})`;

    // Event açıklaması
    const description = `Müşteri: ${sanitizedCustomerName}\nTelefon: ${sanitizedCustomerPhone}\nE-posta: ${sanitizedCustomerEmail}\nNot: ${sanitizedCustomerNote}`;

    // Event oluştur
    const calendar = getCalendar();
    const event = calendar.createEvent(title, startDateTime, endDateTime, { description });

    // Tag'leri ekle
    event.setTag('staffId', String(staffId));
    event.setTag('appointmentType', appointmentType);
    event.setTag('customerPhone', sanitizedCustomerPhone);
    event.setTag('customerEmail', sanitizedCustomerEmail);

    // YÖNETİM randevusu değilse ve e-posta varsa, müşteriye e-posta gönder
    if (!isManagement && sanitizedCustomerEmail && isValidEmail(sanitizedCustomerEmail)) {
      try {
        const formattedDate = DateUtils.toTurkishDate(date);
        const serviceName = CONFIG.SERVICE_NAMES[appointmentType] || appointmentType;

        // ICS oluştur
        const icsContent = generateCustomerICS({
          staffName: staff.name,
          staffPhone: staff.phone || '',
          staffEmail: staff.email || '',
          date,
          time,
          duration: durationNum,
          appointmentType,
          customerNote: sanitizedCustomerNote,
          formattedDate
        });

        const icsBlob = Utilities.newBlob(icsContent, 'text/calendar', 'randevu.ics');

        // E-posta gönder
        MailApp.sendEmail({
          to: sanitizedCustomerEmail,
          subject: CONFIG.EMAIL_SUBJECTS.CUSTOMER_CONFIRMATION,
          name: CONFIG.COMPANY_NAME,
          replyTo: staff.email || CONFIG.ADMIN_EMAIL,
          htmlBody: getCustomerEmailTemplate({
            customerName: sanitizedCustomerName,
            formattedDate,
            time,
            serviceName,
            staffName: staff.name,
            customerNote: sanitizedCustomerNote,
            staffPhone: staff.phone || '',
            staffEmail: staff.email || '',
            appointmentType
          }),
          attachments: [icsBlob]
        });
      } catch (emailError) {
        log.error('Manuel randevu e-posta gönderilemedi:', emailError);
      }
    }

    return { success: true, eventId: event.getId(), message: 'Manuel randevu oluşturuldu.' };
  } catch (error) {
    log.error('createManualAppointment error:', error);
    return { success: false, error: error.toString() };
  }
}

// ==================== AVAILABILITY CALCULATION ====================
// ✅ Tek kaynak: Tüm blokaj kuralları server'da hesaplanır
// Maksimum 2 masa / teslim blokajı mantığı

/**
 * Belirli bir gün için tüm zaman slotlarının müsaitlik durumunu hesapla
 * @param {string} date - YYYY-MM-DD formatında tarih
 * @param {string} staffId - Çalışan ID'si
 * @param {string} shiftType - Vardiya tipi ('morning', 'evening', 'full')
 * @param {string} appointmentType - Randevu tipi ('delivery', 'meeting')
 * @param {number} interval - Randevu süresi (dakika)
 * @returns {Object} { success: true, slots: [{time: 'HH:MM', available: boolean, reason: string}] }
 */
function checkTimeSlotAvailability(date, staffId, shiftType, appointmentType, interval) {
  try {
    // Parametreleri valide et
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { success: false, error: CONFIG.ERROR_MESSAGES.INVALID_DATE_FORMAT };
    }

    const intervalNum = parseInt(interval);
    if (isNaN(intervalNum) || intervalNum < VALIDATION.INTERVAL_MIN) {
      return { success: false, error: 'Geçersiz interval değeri' };
    }

    // Vardiya saatlerini CONFIG'den al
    const shift = CONFIG.SHIFT_HOURS[shiftType];
    if (!shift) {
      return { success: false, error: CONFIG.ERROR_MESSAGES.INVALID_SHIFT_TYPE };
    }

    // Zaman slotlarını oluştur
    const slots = [];
    const [startHour, startMinute] = shift.start.split(':').map(Number);
    const [endHour, endMinute] = shift.end.split(':').map(Number);
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    for (let minutes = startMinutes; minutes < endMinutes; minutes += intervalNum) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      const timeStr = String(hours).padStart(2, '0') + ':' + String(mins).padStart(2, '0');
      slots.push(timeStr);
    }

    // Google Calendar'dan randevuları getir
    const calendar = getCalendar();
    const { startDate, endDate } = getDateRange(date);
    const events = calendar.getEvents(startDate, endDate);

    // Data ayarlarını al (günlük max teslim sayısı için)
    const data = getData();
    const maxDelivery = data.settings?.maxDaily || 4;

    // Teslim randevusu sayısını hesapla (günlük limit kontrolü için)
    let dailyDeliveryCount = 0;
    if (appointmentType === CONFIG.APPOINTMENT_TYPES.DELIVERY) {
      dailyDeliveryCount = events.filter(event => {
        const eventType = event.getTag('appointmentType');
        if (eventType !== CONFIG.APPOINTMENT_TYPES.DELIVERY) {
          return false;
        }

        // Bugünse ve saat geçmişse sayma
        const now = new Date();
        const todayStr = Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyy-MM-dd');

        if (date === todayStr) {
          const eventTime = Utilities.formatDate(
            event.getStartTime(),
            CONFIG.TIMEZONE,
            'HH:mm'
          );
          const currentTime = Utilities.formatDate(now, CONFIG.TIMEZONE, 'HH:mm');
          if (eventTime < currentTime) {
            return false;
          }
        }

        return true;
      }).length;

      // Eğer günlük limit dolmuşsa, tüm slotları bloke et
      if (dailyDeliveryCount >= maxDelivery) {
        return {
          success: true,
          slots: slots.map(time => ({
            time: time,
            available: false,
            reason: CONFIG.ERROR_MESSAGES.DAILY_DELIVERY_LIMIT.replace('{max}', maxDelivery)
          })),
          dailyDeliveryCount: dailyDeliveryCount
        };
      }
    }

    // Şu anki zaman (geçmiş slot kontrolü için)
    const now = new Date();
    const todayStr = Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyy-MM-dd');
    const currentTime = date === todayStr ? Utilities.formatDate(now, CONFIG.TIMEZONE, 'HH:mm') : null;

    // Her slot için müsaitlik kontrolü
    const availabilityResults = slots.map(timeStr => {
      // 1. Geçmiş zaman kontrolü (bugünse)
      if (currentTime && timeStr <= currentTime) {
        return {
          time: timeStr,
          available: false,
          reason: CONFIG.ERROR_MESSAGES.PAST_TIME
        };
      }

      // 2. Bu saatteki tüm randevuları bul
      const sameTimeEvents = events.filter(event => {
        const eventTime = Utilities.formatDate(
          event.getStartTime(),
          CONFIG.TIMEZONE,
          'HH:mm'
        );
        return eventTime === timeStr;
      });

      // 3. Maksimum 2 servis masası kontrolü
      if (sameTimeEvents.length >= 2) {
        return {
          time: timeStr,
          available: false,
          reason: CONFIG.ERROR_MESSAGES.TABLES_FULL
        };
      }

      // 4. Teslim randevusu özel kuralları
      if (appointmentType === CONFIG.APPOINTMENT_TYPES.DELIVERY) {
        // Aynı saatte başka teslim randevusu var mı?
        const hasDeliveryAtSameTime = sameTimeEvents.some(event => {
          const eventType = event.getTag('appointmentType');
          return eventType === CONFIG.APPOINTMENT_TYPES.DELIVERY;
        });

        if (hasDeliveryAtSameTime) {
          return {
            time: timeStr,
            available: false,
            reason: CONFIG.ERROR_MESSAGES.DELIVERY_CONFLICT
          };
        }
      }

      // 5. Aynı çalışanda randevu var mı?
      const staffConflict = sameTimeEvents.some(event => {
        const eventStaffId = event.getTag('staffId');
        return eventStaffId && eventStaffId === String(staffId);
      });

      if (staffConflict) {
        return {
          time: timeStr,
          available: false,
          reason: CONFIG.ERROR_MESSAGES.STAFF_CONFLICT
        };
      }

      // Tüm kontroller geçildi, slot müsait
      return {
        time: timeStr,
        available: true,
        reason: ''
      };
    });

    return {
      success: true,
      slots: availabilityResults,
      dailyDeliveryCount: dailyDeliveryCount,
      maxDelivery: maxDelivery
    };

  } catch (error) {
    log.error('checkTimeSlotAvailability hatası:', error);
    return { success: false, error: error.toString() };
  }
}

// ==================== WHATSAPP BUSINESS CLOUD API ====================

/**
 * WhatsApp Business Cloud API ile TEMPLATE mesaj gönder
 * @param {string} phoneNumber - Alıcı telefon numarası (90XXXXXXXXXX formatında)
 * @param {string} customerName - Müşteri adı ({{1}} parametresi)
 * @param {string} appointmentDateTime - Randevu tarih ve saat ({{2}} parametresi, örn: "21 Ekim 2025, 14:30")
 * @returns {Object} - {success: boolean, messageId?: string, error?: string}
 */
function sendWhatsAppMessage(phoneNumber, customerName, appointmentDateTime) {
  try {
    // Config kontrolü
    if (!CONFIG.WHATSAPP_PHONE_NUMBER_ID || !CONFIG.WHATSAPP_ACCESS_TOKEN) {
      throw new Error('WhatsApp API ayarları yapılmamış! WHATSAPP_PHONE_NUMBER_ID ve WHATSAPP_ACCESS_TOKEN gerekli.');
    }

    // Telefon numarasını temizle (sadece rakamlar)
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');

    // Meta WhatsApp Cloud API endpoint
    const url = `https://graph.facebook.com/${CONFIG.WHATSAPP_API_VERSION}/${CONFIG.WHATSAPP_PHONE_NUMBER_ID}/messages`;

    // Template payload (Meta onaylı template kullanıyoruz)
    const payload = {
      messaging_product: 'whatsapp',
      to: cleanPhone,
      type: 'template',
      template: {
        name: 'randevu_hatirlatma_v1',  // Template name
        language: {
          code: 'tr'  // Turkish
        },
        components: [
          {
            type: 'body',
            parameters: [
              {
                type: 'text',
                text: customerName  // {{1}} - Müşteri adı
              },
              {
                type: 'text',
                text: appointmentDateTime  // {{2}} - Tarih ve saat
              }
            ]
          }
        ]
      }
    };

    // API çağrısı
    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'Authorization': `Bearer ${CONFIG.WHATSAPP_ACCESS_TOKEN}`
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseData = JSON.parse(response.getContentText());

    if (responseCode === 200) {
      log.info('WhatsApp template mesajı gönderildi:', responseData);
      return {
        success: true,
        messageId: responseData.messages[0].id,
        phone: cleanPhone
      };
    } else {
      log.error('WhatsApp API hatası:', responseData);
      return {
        success: false,
        error: responseData.error?.message || 'Bilinmeyen hata',
        errorCode: responseData.error?.code,
        errorDetails: responseData.error
      };
    }

  } catch (error) {
    log.error('sendWhatsAppMessage hatası:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Tarih ve saati Türkçe formata çevir (21 Ekim 2025, 14:30)
 * @param {string} dateStr - YYYY-MM-DD formatında tarih
 * @param {string} timeStr - HH:MM formatında saat
 * @returns {string} - Türkçe formatlanmış tarih ve saat
 */
function formatAppointmentDateTime(dateStr, timeStr) {
  const months = {
    '01': 'Ocak', '02': 'Şubat', '03': 'Mart', '04': 'Nisan',
    '05': 'Mayıs', '06': 'Haziran', '07': 'Temmuz', '08': 'Ağustos',
    '09': 'Eylül', '10': 'Ekim', '11': 'Kasım', '12': 'Aralık'
  };

  const [year, month, day] = dateStr.split('-');
  const monthName = months[month] || month;

  return `${parseInt(day)} ${monthName} ${year}, ${timeStr}`;
}

/**
 * Bugünkü randevular için WhatsApp hatırlatmaları gönder
 * @param {string} date - Tarih (YYYY-MM-DD formatında)
 * @param {string} apiKey - Admin API key
 * @returns {Object} - {success: boolean, sent: number, failed: number, details: []}
 */
function sendWhatsAppReminders(date, apiKey) {
  try {
    // API key kontrolü
    if (!validateApiKey(apiKey)) {
      throw new Error('Geçersiz API key');
    }

    // WhatsApp config yükle
    loadWhatsAppConfig();

    // Bugünkü randevuları al
    const reminders = getTodayWhatsAppReminders(date);

    if (!reminders.success || reminders.data.length === 0) {
      return {
        success: true,
        sent: 0,
        failed: 0,
        message: 'Bu tarihte randevu bulunamadı'
      };
    }

    const results = [];
    let sentCount = 0;
    let failedCount = 0;

    // Her randevu için mesaj gönder
    for (const reminder of reminders.data) {
      // Link'ten telefon çıkar
      const linkParts = reminder.link.split('?');
      const phone = linkParts[0].split('/').pop();

      // Müşteri adı
      const customerName = reminder.customerName;

      // Tarih ve saati formatla (21 Ekim 2025, 14:30)
      const appointmentDateTime = formatAppointmentDateTime(reminder.date, reminder.time);

      // WhatsApp template mesajı gönder
      const result = sendWhatsAppMessage(phone, customerName, appointmentDateTime);

      if (result.success) {
        sentCount++;
        results.push({
          customer: customerName,
          phone: phone,
          status: 'success',
          messageId: result.messageId
        });
      } else {
        failedCount++;
        results.push({
          customer: customerName,
          phone: phone,
          status: 'failed',
          error: result.error
        });
      }

      // Rate limiting - Meta: 80 mesaj/saniye, ama güvenli olmak için bekleyelim
      Utilities.sleep(100); // 100ms bekle
    }

    return {
      success: true,
      sent: sentCount,
      failed: failedCount,
      total: reminders.data.length,
      details: results
    };

  } catch (error) {
    log.error('sendWhatsAppReminders hatası:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * WhatsApp API ayarlarını güncelle (sadece admin)
 * @param {Object} settings - {phoneNumberId, accessToken, businessAccountId}
 * @param {string} apiKey - Admin API key
 * @returns {Object} - {success: boolean}
 */
function updateWhatsAppSettings(settings, apiKey) {
  try {
    // API key kontrolü
    if (!validateApiKey(apiKey)) {
      throw new Error('Geçersiz API key');
    }

    // Settings'i Script Properties'e kaydet
    const scriptProperties = PropertiesService.getScriptProperties();

    if (settings.phoneNumberId) {
      scriptProperties.setProperty('WHATSAPP_PHONE_NUMBER_ID', settings.phoneNumberId);
    }
    if (settings.accessToken) {
      scriptProperties.setProperty('WHATSAPP_ACCESS_TOKEN', settings.accessToken);
    }
    if (settings.businessAccountId) {
      scriptProperties.setProperty('WHATSAPP_BUSINESS_ACCOUNT_ID', settings.businessAccountId);
    }

    return {
      success: true,
      message: 'WhatsApp ayarları güncellendi'
    };

  } catch (error) {
    log.error('updateWhatsAppSettings hatası:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * WhatsApp API ayarlarını getir (sadece durum, token gösterme)
 * @param {string} apiKey - Admin API key
 * @returns {Object} - {success: boolean, configured: boolean}
 */
function getWhatsAppSettings(apiKey) {
  try {
    // API key kontrolü
    if (!validateApiKey(apiKey)) {
      throw new Error('Geçersiz API key');
    }

    const scriptProperties = PropertiesService.getScriptProperties();
    const phoneNumberId = scriptProperties.getProperty('WHATSAPP_PHONE_NUMBER_ID');
    const accessToken = scriptProperties.getProperty('WHATSAPP_ACCESS_TOKEN');
    const businessAccountId = scriptProperties.getProperty('WHATSAPP_BUSINESS_ACCOUNT_ID');

    return {
      success: true,
      configured: !!(phoneNumberId && accessToken),
      hasPhoneNumberId: !!phoneNumberId,
      hasAccessToken: !!accessToken,
      hasBusinessAccountId: !!businessAccountId
    };

  } catch (error) {
    log.error('getWhatsAppSettings hatası:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

// ==================== WHATSAPP HELPER ====================

/**
 * Script Properties'den WhatsApp config'i yükle (internal kullanım)
 */
function loadWhatsAppConfig() {
  const scriptProperties = PropertiesService.getScriptProperties();

  CONFIG.WHATSAPP_PHONE_NUMBER_ID = scriptProperties.getProperty('WHATSAPP_PHONE_NUMBER_ID') || '';
  CONFIG.WHATSAPP_ACCESS_TOKEN = scriptProperties.getProperty('WHATSAPP_ACCESS_TOKEN') || '';
  CONFIG.WHATSAPP_BUSINESS_ACCOUNT_ID = scriptProperties.getProperty('WHATSAPP_BUSINESS_ACCOUNT_ID') || '';
}

// Script başlatıldığında config'i yükle
loadWhatsAppConfig();

