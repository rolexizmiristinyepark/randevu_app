// ==================== CONFIGURATION ====================
// Global configuration, constants, and enums
// Deploy: New Deployment → Web App → Execute as: Me, Anyone can access

const DEBUG = true; // TEST ORTAMI

const CONFIG = {
  // Calendar & Storage
  // ⚠️ SECURITY: CALENDAR_ID Script Properties'den yüklenir (loadExternalConfigs)
  CALENDAR_ID: 'primary', // Default fallback - Production'da Script Properties'den override edilir
  TIMEZONE: 'Europe/Istanbul',
  PROPERTIES_KEY: 'RANDEVU_DATA',
  API_KEY_PROPERTY: 'ADMIN_API_KEY', // Admin API key için property

  // TEST ORTAMI - Spreadsheet ID
  SPREADSHEET_ID: '1VQDzsvycpxg52gOzlD6CS-JA6e6LYcbWGBdFyM0fl7c', // Randevu_Database_Test

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
  // 🔒 SECURITY: E-posta adresleri Script Properties'den yüklenir (loadExternalConfigs)
  // Default fallback'ler sadece development için
  COMPANY_NAME: 'Rolex İzmir İstinyepark',
  COMPANY_LOCATION: 'Rolex İzmir İstinyepark',
  COMPANY_EMAIL: '', // Script Properties'den yüklenecek
  ADMIN_EMAIL: '',   // Script Properties'den yüklenecek

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
    general: 'Görüşme',        // Alias for meeting
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
      general: 'Görüşme',       // Frontend'den eklendi
      meeting: 'Görüşme',       // Alias for 'general'
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

// ==================== PROFIL AYARLARI (v3.2) ====================
/**
 * Her profil için randevu kuralları
 *
 * Ayar Açıklamaları:
 * - sameDayBooking: Aynı gün randevu alınabilir mi
 * - maxSlotAppointment: Slot başı max randevu (0=∞)
 * - slotGrid: Slot süresi (30 veya 60 dakika)
 * - maxDailyPerStaff: Personel başı günlük max (0=∞)
 * - maxDailyDelivery: Günlük teslim+gönderi max (0=∞)
 * - duration: Randevu süresi (30 veya 60 dakika)
 * - assignByAdmin: İlgili admin tarafından mı atanır
 * - allowedTypes: Seçilebilir randevu türleri
 * - staffFilter: Personel filtresi (role:sales, role:management, self)
 * - showCalendar: Takvim gösterilsin mi (false ise takvim gizli)
 * - takvimFiltresi: Takvim filtresi (onlytoday, withtoday, withouttoday)
 * - defaultType: Varsayılan randevu türü (boşsa müşteri seçer)
 * - showTypeSelection: Varsayılan tür varsa seçimi göster mi (true: göster, false: gizle)
 * - vardiyaKontrolu: Vardiya kontrolü (true: vardiyaya göre, false: tüm günler/slotlar müsait)
 */
/**
 * PROFIL_AYARLARI v3.3
 *
 * URL Kodları:
 * - #w → gunluk (walk-in)
 * - #g → genel
 * - #b → boutique (manuel/mağaza)
 * - #m → yonetim (management)
 * - #s/{id} → personel (staff)
 * - #v/{id} → vip
 *
 * idKontrol:
 * - false: Sadece profil kodu yeterli (#w, #g, #b, #m)
 * - true: Personel ID gerekli ve kontrol edilir (#s/{id}, #v/{id})
 */
const PROFIL_AYARLARI = {
  // #g - Genel link (idKontrol: false)
  genel: {
    code: 'g',
    idKontrol: false,
    sameDayBooking: false,
    maxSlotAppointment: 1,
    slotGrid: 60,
    maxDailyPerStaff: 0,
    maxDailyDelivery: 3,
    duration: 60,
    assignByAdmin: false,
    allowedTypes: ['delivery', 'meeting', 'shipping', 'service'],
    staffFilter: 'role:sales',
    showCalendar: true,
    takvimFiltresi: 'withtoday',
    defaultType: '',  // Müşteri seçer
    showTypeSelection: true,
    vardiyaKontrolu: true  // v3.8: true=vardiyaya göre, false=tüm günler/slotlar müsait
  },
  // #s/{id} - Personel linki (idKontrol: true)
  personel: {
    code: 's',
    idKontrol: true,
    expectedRole: 'sales',
    sameDayBooking: false,
    maxSlotAppointment: 1,
    slotGrid: 60,
    maxDailyPerStaff: 0,
    maxDailyDelivery: 3,
    duration: 60,
    assignByAdmin: false,
    allowedTypes: ['delivery', 'meeting', 'shipping', 'service'],
    staffFilter: 'self',
    showCalendar: true,
    takvimFiltresi: 'withtoday',
    defaultType: '',  // Müşteri seçer
    showTypeSelection: true,
    vardiyaKontrolu: true  // v3.8: true=vardiyaya göre, false=tüm günler/slotlar müsait
  },
  // #v/{id} - VIP linki (idKontrol: true)
  vip: {
    code: 'v',
    idKontrol: true,
    expectedRole: 'management',
    sameDayBooking: true,
    maxSlotAppointment: 2,
    slotGrid: 30,
    maxDailyPerStaff: 0,
    maxDailyDelivery: 0,
    duration: 30,
    assignByAdmin: true,
    allowedTypes: ['delivery', 'meeting', 'service'],
    staffFilter: 'role:sales',
    showCalendar: true,
    takvimFiltresi: 'withtoday',
    defaultType: '',  // Müşteri seçer
    showTypeSelection: true,
    vardiyaKontrolu: true  // v3.8: true=vardiyaya göre, false=tüm günler/slotlar müsait
  },
  // #b - Boutique/Mağaza (idKontrol: false)
  boutique: {
    code: 'b',
    idKontrol: false,
    sameDayBooking: true,
    maxSlotAppointment: 2,
    slotGrid: 30,
    maxDailyPerStaff: 0,
    maxDailyDelivery: 0,
    duration: 60,
    assignByAdmin: false,
    allowedTypes: ['delivery', 'meeting', 'shipping', 'service'],
    staffFilter: 'role:sales',
    showCalendar: true,
    takvimFiltresi: 'withtoday',
    defaultType: '',  // Müşteri seçer
    showTypeSelection: true,
    vardiyaKontrolu: true  // v3.8: true=vardiyaya göre, false=tüm günler/slotlar müsait
  },
  // #m - Yönetim (idKontrol: false)
  yonetim: {
    code: 'm',
    idKontrol: false,
    sameDayBooking: true,
    maxSlotAppointment: 2,
    slotGrid: 60,
    maxDailyPerStaff: 0,
    maxDailyDelivery: 0,
    duration: 60,
    assignByAdmin: true,
    allowedTypes: ['delivery', 'meeting', 'shipping', 'service'],
    staffFilter: 'role:management',
    showCalendar: true,
    takvimFiltresi: 'withtoday',
    defaultType: '',  // Müşteri seçer
    showTypeSelection: true,
    vardiyaKontrolu: true  // v3.8: true=vardiyaya göre, false=tüm günler/slotlar müsait
  },
  // #w - Walk-in/Günlük (idKontrol: false)
  gunluk: {
    code: 'w',
    idKontrol: false,
    sameDayBooking: true,
    maxSlotAppointment: 2,
    slotGrid: 30,
    maxDailyPerStaff: 0,
    maxDailyDelivery: 0,
    duration: 30,
    assignByAdmin: true,
    allowedTypes: ['meeting'],
    staffFilter: 'none',  // Personel seçimi yok, admin atar
    showCalendar: false,
    takvimFiltresi: 'onlytoday',
    vardiyaKontrolu: true  // v3.8: true=vardiyaya göre, false=tüm günler/slotlar müsait
  }
};

// Kod -> Profil mapping
var PROFILE_CODE_MAP = {
  w: 'gunluk',
  g: 'genel',
  b: 'boutique',
  m: 'yonetim',
  s: 'personel',
  v: 'vip'
};

// linkType -> Profil mapping (Frontend'den gelen linkType'ı profil adına çevirir)
var LINK_TYPE_TO_PROFILE = {
  walkin: 'gunluk',
  general: 'genel',
  staff: 'personel',
  vip: 'vip',
  management: 'yonetim',
  boutique: 'boutique'
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

// ==================== PROFIL AYARLARI SERVICE ====================
/**
 * Profil Ayarları yönetim servisi
 * PropertiesService'te saklanır, runtime'da override edilebilir
 */
var ProfilAyarlariService = {
  STORAGE_KEY: 'profil_ayarlari_v3',

  /**
   * Varsayılan profil ayarlarını al (hardcoded)
   */
  getDefaults: function() {
    return PROFIL_AYARLARI;
  },

  /**
   * Kaydedilmiş profil ayarlarını al (varsa), yoksa default
   */
  getAll: function() {
    try {
      var props = PropertiesService.getScriptProperties();
      var saved = props.getProperty(this.STORAGE_KEY);

      if (saved) {
        var parsed = JSON.parse(saved);
        // Merge with defaults (yeni eklenen alanlar için)
        return this._mergeWithDefaults(parsed);
      }

      return this.getDefaults();
    } catch (error) {
      log.error('ProfilAyarlari getAll hatası', error);
      return this.getDefaults();
    }
  },

  /**
   * Tek profil ayarını al
   */
  get: function(profilKey) {
    var all = this.getAll();
    return all[profilKey] || all.genel;
  },

  /**
   * Profil ayarını güncelle
   */
  update: function(profilKey, updates) {
    try {
      var all = this.getAll();

      if (!all[profilKey]) {
        return { success: false, error: 'Profil bulunamadı: ' + profilKey };
      }

      // Sadece izin verilen alanları güncelle
      var allowedFields = [
        'sameDayBooking', 'maxSlotAppointment', 'slotGrid',
        'maxDailyPerStaff', 'maxDailyDelivery', 'duration',
        'assignByAdmin', 'allowedTypes', 'staffFilter', 'showCalendar', 'takvimFiltresi', 'defaultType', 'showTypeSelection',
        'vardiyaKontrolu'  // v3.8: Vardiya kontrolü ayarı
      ];

      for (var field in updates) {
        if (allowedFields.indexOf(field) !== -1) {
          all[profilKey][field] = updates[field];
        }
      }

      // Kaydet
      var props = PropertiesService.getScriptProperties();
      props.setProperty(this.STORAGE_KEY, JSON.stringify(all));

      // Global'i de güncelle (runtime için)
      PROFIL_AYARLARI[profilKey] = all[profilKey];

      log.info('Profil ayarı güncellendi', { profil: profilKey, updates: Object.keys(updates) });

      return { success: true, data: all[profilKey] };
    } catch (error) {
      log.error('ProfilAyarlari update hatası', error);
      return { success: false, error: error.toString() };
    }
  },

  /**
   * Tüm profil ayarlarını sıfırla (varsayılana dön)
   */
  reset: function() {
    try {
      var props = PropertiesService.getScriptProperties();
      props.deleteProperty(this.STORAGE_KEY);
      log.info('Profil ayarları sıfırlandı');
      return { success: true };
    } catch (error) {
      log.error('ProfilAyarlari reset hatası', error);
      return { success: false, error: error.toString() };
    }
  },

  /**
   * Kaydedilmiş ayarları varsayılanlarla birleştir
   */
  _mergeWithDefaults: function(saved) {
    var defaults = this.getDefaults();
    var result = {};

    for (var key in defaults) {
      if (saved[key]) {
        // Saved varsa, default ile merge et (eksik alanlar için)
        result[key] = {};
        for (var field in defaults[key]) {
          result[key][field] = saved[key].hasOwnProperty(field)
            ? saved[key][field]
            : defaults[key][field];
        }
      } else {
        // Saved yoksa default kullan
        result[key] = defaults[key];
      }
    }

    return result;
  }
};

/**
 * linkType'tan profil ayarlarını döner
 * ProfilAyarlariService tanımlandıktan sonra çağrılmalı
 * @param {string} linkType - Frontend'den gelen link tipi (general, staff, vip, walkin, management, boutique)
 * @returns {Object} Profil ayarları
 */
function getProfilAyarlariByLinkType(linkType) {
  var profilKey = LINK_TYPE_TO_PROFILE[linkType] || 'genel';
  return ProfilAyarlariService.get(profilKey);
}
