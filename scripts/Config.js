// ==================== CONFIGURATION ====================
// Global configuration, constants, and enums
// Deploy: New Deployment → Web App → Execute as: Me, Anyone can access

const DEBUG = false;

const CONFIG = {
  // Calendar & Storage
  // ⚠️ SECURITY: CALENDAR_ID Script Properties'den yüklenir (loadExternalConfigs)
  CALENDAR_ID: 'primary', // Default fallback - Production'da Script Properties'den override edilir
  TIMEZONE: 'Europe/Istanbul',
  PROPERTIES_KEY: 'RANDEVU_DATA',
  API_KEY_PROPERTY: 'ADMIN_API_KEY', // Admin API key için property

  // Security & Abuse Prevention
  // 🔒 SECURITY: TURNSTILE_SECRET_KEY Script Properties'den yüklenir (loadExternalConfigs)
  // ⚠️ HARDCODED SECRET KALDIRILDI - Script Properties zorunlu (production)
  // Development: Cloudflare test key otomatik kullanılır (1x0000000000000000000000000000000)
  TURNSTILE_SECRET_KEY: null, // Script Properties'den yüklenecek
  RATE_LIMIT_MAX_REQUESTS: 10,      // 10 istek
  RATE_LIMIT_WINDOW_SECONDS: 600,   // 10 dakika (600 saniye)

  // Environment detection helper
  get IS_DEVELOPMENT() {
    // Development mode: CALENDAR_ID = 'primary' (default)
    // Production mode: CALENDAR_ID Script Properties'den yüklenir
    return this.CALENDAR_ID === 'primary';
  },

  // WhatsApp Business Cloud API
  WHATSAPP_API_VERSION: 'v18.0',
  WHATSAPP_PHONE_NUMBER_ID: '', // Meta Business'tan alınacak
  WHATSAPP_ACCESS_TOKEN: '', // Meta Business'tan alınacak (permanent token)
  WHATSAPP_BUSINESS_ACCOUNT_ID: '', // Meta Business'tan alınacak

  // Slack Webhook (Script Properties'den yüklenecek)
  SLACK_WEBHOOK_URL: '',

  // Company Info
  COMPANY_NAME: 'Rolex İzmir İstinyepark',
  COMPANY_LOCATION: 'Rolex İzmir İstinyepark',
  COMPANY_EMAIL: 'istinyeparkrolex35@gmail.com',
  ADMIN_EMAIL: 'istinyeparkrolex35@gmail.com',

  // Appointment Types
  APPOINTMENT_TYPES: {
    DELIVERY: 'delivery',
    SHIPPING: 'shipping',      // YENİ: Gönderi (teslim limiti içinde)
    MEETING: 'meeting',
    SERVICE: 'service',        // YENİ: Teknik Servis
    MANAGEMENT: 'management'   // YENİ: Yönetim Randevusu
  },

  // Appointment Type Labels
  APPOINTMENT_TYPE_LABELS: {
    delivery: 'Teslim',
    shipping: 'Gönderi',       // YENİ
    meeting: 'Görüşme',
    service: 'Teknik Servis',
    management: 'Yönetim'
  },

  // Service Names (Email "Konu" alanı için)
  SERVICE_NAMES: {
    delivery: 'Saat Teslimi',
    shipping: 'Gönderi',       // YENİ
    meeting: 'Görüşme',
    service: 'Teknik Servis',
    management: 'Yönetim'
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
  // Sabah: 11-18 çalışma → Randevular: 11:00-17:00 (en son slot 17:00-18:00)
  // Akşam: 14-21 çalışma → Randevular: 14:00-20:00 (en son slot 20:00-21:00)
  // Full: 11-21 çalışma → Randevular: 11:00-20:00 (en son slot 20:00-21:00)
  SHIFT_HOURS: {
    morning: { start: '11:00', end: '18:00' },
    evening: { start: '14:00', end: '21:00' },
    full: { start: '11:00', end: '21:00' }
  },

  // Email Template Texts
  EMAIL_TEMPLATES: {
    CUSTOMER: {
      GREETING: 'Sayın',
      CONFIRMATION: 'Randevunuz başarı ile onaylanmıştır. Sizi mağazamızda ağırlamayı sabırsızlıkla bekliyoruz. Randevunuza zamanında gelmenizi rica ederiz.',
      SECTION_TITLE: 'RANDEVU BİLGİLERİ',
      LABELS: {
        DATE: 'Tarih',
        TIME: 'Saat',
        SUBJECT: 'Konu',
        CONTACT_PERSON: 'İlgili',
        STORE: 'Mağaza',
        NOTES: 'Ek Bilgi'
      },
      CHANGE_CONTACT_INFO: 'Randevunuzda herhangi bir değişiklik yapmanız gerektiği takdirde veya herhangi bir sorunuz olması durumunda lütfen randevu öncesinde ilgili danışman ile irtibata geçiniz.',
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
  // ⚠️ SOURCE OF TRUTH: calendar-config.ts (manuel sync gerekli - Apps Script TS import yapamıyor)
  ICS_TEMPLATES: {
    CUSTOMER_TYPES: {
      delivery: 'Saat Takdimi',
      service: 'Servis & Bakım',      // Frontend ile sync (Teknik Servis → Servis & Bakım)
      consultation: 'Ürün Danışmanlığı', // Frontend'den eklendi
      general: 'Genel Görüşme',       // Frontend'den eklendi
      meeting: 'Genel Görüşme',       // Alias for 'general'
      management: 'Yönetim'
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

// ==================== SLOT UNIVERSE & SHIFT HELPERS ====================

/**
 * ⭐⭐⭐⭐⭐ CORE: Slot Evreni Tanımı
 *
 * Sabit slot başlangıç saatleri: 11, 12, 13, 14, 15, 16, 17, 18, 19, 20
 * Her slot 1 saat (60 dakika) sürer
 * Yarım saat veya değişken süreler YOK
 *
 * Örnek:
 * - 11:00-12:00 (slot başlangıcı: 11)
 * - 12:00-13:00 (slot başlangıcı: 12)
 * - ...
 * - 20:00-21:00 (slot başlangıcı: 20)
 */
const SLOT_UNIVERSE = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

/**
 * Vardiya tipine göre slot filtresi
 * morning: 11-18 çalışma (11,12,13,14,15,16,17 slotları → en son 17:00 slotu yani 17:00-18:00)
 * evening: 14-21 çalışma (14,15,16,17,18,19,20 slotları → en son 20:00 slotu yani 20:00-21:00)
 * full: 11-21 çalışma (11-20 slotları → en son 20:00 slotu yani 20:00-21:00)
 * management: Vardiya sınırı yok - tüm çalışma saatleri (yönetim randevuları için)
 */
const SHIFT_SLOT_FILTERS = {
  morning: [11, 12, 13, 14, 15, 16, 17],  // 11:00-18:00 (en son slot 17:00-18:00)
  evening: [14, 15, 16, 17, 18, 19, 20],  // 14:00-21:00 (en son slot 20:00-21:00)
  full: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],  // 11:00-21:00 (en son slot 20:00-21:00)
  management: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]  // Yönetim için vardiya sınırı yok, tüm slotlar
};

/**
 * Sistem sabitleri - Magic number'ları burada tanımla
 */
const CONSTANTS = {
  // Cache süreleri
  CACHE_DURATION_SECONDS: 900,        // 15 dakika
  FRONTEND_CACHE_TTL_MS: 3600000,     // 1 saat
  
  // Timeout süreleri
  API_TIMEOUT_MS: 30000,              // 30 saniye
  LOCK_TIMEOUT_MS: 15000,             // 15 saniye
  INACTIVITY_TIMEOUT_MS: 600000,      // 10 dakika
  
  // Rate limiting
  RATE_LIMIT_WINDOW_SECONDS: 600,     // 10 dakika
  RATE_LIMIT_MAX_REQUESTS: 10,        // 10 istek
  
  // Retry
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_BACKOFF_BASE_MS: 1000,        // 1 saniye
  RETRY_BACKOFF_MAX_MS: 5000,         // 5 saniye
  
  // Data retention
  RETENTION_DAYS: 30,                 // KVKK saklama süresi
  MAX_BACKUPS: 7                      // Maksimum yedek sayısı
};
