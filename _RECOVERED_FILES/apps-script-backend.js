// ==================== GOOGLE APPS SCRIPT BACKEND ====================
// Bu dosyayı Google Apps Script'e yapıştırın ve deploy edin
// Deploy → New Deployment → Web App → Execute as: Me, Who has access: Anyone

// Debug mode - Production'da false olmalı
const DEBUG = false;

// ==================== SECURITY SERVICE (PII MASKELEME + KVKK/GDPR + ABUSE PREVENTION) ====================
/**
 * Security service for PII masking, KVKK/GDPR compliance, rate limiting, and bot protection
 * @namespace SecurityService
 */
const SecurityService = {
  /**
   * E-posta adresini maskeler (log için)
   * @param {string} email - E-posta adresi
   * @returns {string} Maskelenmiş e-posta
   */
  maskEmail: function(email) {
    if (!email || typeof email !== 'string') return '[email hidden]';

    const [local, domain] = email.split('@');
    if (!local || !domain) return '[invalid email]';

    if (local.length <= 2) return email;

    const maskedLocal = local[0] + '***' + local[local.length - 1];
    const [domainName, ...ext] = domain.split('.');
    if (domainName.length <= 2) return `${maskedLocal}@${domain}`;

    const maskedDomain = domainName[0] + '***.' + ext.join('.');
    return `${maskedLocal}@${maskedDomain}`;
  },

  /**
   * Telefon numarasını maskeler (log için)
   * @param {string} phone - Telefon numarası
   * @returns {string} Maskelenmiş telefon
   */
  maskPhone: function(phone) {
    if (!phone || typeof phone !== 'string') return '[phone hidden]';

    const digits = phone.replace(/\D/g, '');
    if (digits.length < 6) return '***';

    const start = digits.substring(0, 4);
    const end = digits.substring(digits.length - 2);

    return phone.includes(' ') ? `${start} *** ** ${end}` : `${start}***${end}`;
  },

  /**
   * PII verilerini SHA-256 hash'e çevirir (KVKK uyumu için)
   * Log'larda kişisel bilgi görünmez, ama rate limiting çalışır
   * @param {string} phone - Telefon numarası
   * @param {string} email - E-posta adresi
   * @returns {string} SHA-256 hash
   */
  hashIdentifier: function(phone, email) {
    const raw = (phone || '') + '_' + (email || '');
    const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw);
    return bytes.map(function(b) {
      return ((b + 256) % 256).toString(16).padStart(2, '0');
    }).join('');
  },

  /**
   * Rate limiting kontrolü - CacheService ile IP bazlı
   * 10 dakika içinde max 10 istek
   * @param {string} identifier - IP veya fingerprint
   * @returns {{allowed: boolean, remaining: number, resetTime: number}} Rate limit durumu
   */
  checkRateLimit: function(identifier) {
    try {
      const cache = CacheService.getScriptCache();
      const cacheKey = 'rate_limit_' + identifier;

      // Mevcut istek sayısını al
      const cached = cache.get(cacheKey);
      const now = Date.now();

      if (!cached) {
        // İlk istek - yeni kova oluştur
        const data = {
          count: 1,
          firstRequest: now
        };
        cache.put(cacheKey, JSON.stringify(data), CONFIG.RATE_LIMIT_WINDOW_SECONDS);

        return {
          allowed: true,
          remaining: CONFIG.RATE_LIMIT_MAX_REQUESTS - 1,
          resetTime: now + (CONFIG.RATE_LIMIT_WINDOW_SECONDS * 1000)
        };
      }

      const data = JSON.parse(cached);

      // Limit aşıldı mı?
      if (data.count >= CONFIG.RATE_LIMIT_MAX_REQUESTS) {
        const resetTime = data.firstRequest + (CONFIG.RATE_LIMIT_WINDOW_SECONDS * 1000);
        return {
          allowed: false,
          remaining: 0,
          resetTime: resetTime
        };
      }

      // İstek sayısını artır
      data.count++;
      cache.put(cacheKey, JSON.stringify(data), CONFIG.RATE_LIMIT_WINDOW_SECONDS);

      return {
        allowed: true,
        remaining: CONFIG.RATE_LIMIT_MAX_REQUESTS - data.count,
        resetTime: data.firstRequest + (CONFIG.RATE_LIMIT_WINDOW_SECONDS * 1000)
      };

    } catch (error) {
      log.error('Rate limit kontrolü hatası:', error);
      // Hata durumunda izin ver (fail-open)
      return { allowed: true, remaining: -1, resetTime: 0 };
    }
  },

  /**
   * Cloudflare Turnstile token doğrulama
   * @param {string} token - Client'tan gelen Turnstile token
   * @returns {{success: boolean, error?: string}} Doğrulama sonucu
   */
  verifyTurnstileToken: function(token) {
    try {
      if (!token) {
        return { success: false, error: 'Turnstile token bulunamadı' };
      }

      // Cloudflare Turnstile siteverify endpoint
      const url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

      const payload = {
        secret: CONFIG.TURNSTILE_SECRET_KEY,
        response: token
      };

      const options = {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };

      const response = UrlFetchApp.fetch(url, options);
      const result = JSON.parse(response.getContentText());

      if (result.success) {
        return { success: true };
      } else {
        log.warn('Turnstile doğrulama başarısız:', result['error-codes']);
        return {
          success: false,
          error: 'Robot kontrolü başarısız: ' + (result['error-codes'] || []).join(', ')
        };
      }

    } catch (error) {
      log.error('Turnstile doğrulama hatası:', error);
      // 🔒 SECURITY: Test bypass KALDIRILDI - production güvenliği için
      // Hata durumunda asla başarılı dönme (bot koruması aktif kalmalı)
      return { success: false, error: 'Doğrulama hatası: ' + error.message };
    }
  }
};

// Debug logger - Production'da log'ları devre dışı bırakır
// KVKK/GDPR: PII verileri loglanmadan önce maskelenmeli
const log = {
  error: (...args) => DEBUG && console.error(...args),
  warn: (...args) => DEBUG && console.warn(...args),
  info: (...args) => DEBUG && console.info(...args),
  log: (...args) => DEBUG && console.log(...args),

  // PII-safe loggers (SecurityService kullanır)
  errorPII: (message, email, phone) => DEBUG && console.error(message, SecurityService.maskEmail(email), SecurityService.maskPhone(phone)),
  infoPII: (message, email, phone) => DEBUG && console.info(message, SecurityService.maskEmail(email), SecurityService.maskPhone(phone))
};

// ==================== LOCK SERVICE (RACE CONDITION PROTECTION) ====================
/**
 * Lock service wrapper for race condition protection
 * @namespace LockServiceWrapper
 */
const LockServiceWrapper = {
  /**
   * Critical section'ları kilitleyerek race condition'ı önler
   * @param {Function} fn - Kilitli çalıştırılacak fonksiyon
   * @param {number} timeout - Lock timeout (ms), default 30000 (30 saniye)
   * @param {number} maxRetries - Başarısız olursa kaç kere deneyeceği, default 3
   * @returns {*} Fonksiyonun return değeri
   * @throws {Error} Lock alınamazsa veya timeout olursa
   *
   * @example
   * const result = LockServiceWrapper.withLock(() => {
   *   const data = StorageService.getData();
   *   data.counter++;
   *   StorageService.saveData(data);
   *   return data.counter;
   * });
   */
  withLock: function(fn, timeout = 30000, maxRetries = 3) {
    const lock = LockService.getScriptLock();
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Lock'u almayı dene
        const hasLock = lock.tryLock(timeout);

        if (!hasLock) {
          throw new Error(`Lock timeout after ${timeout}ms (attempt ${attempt}/${maxRetries})`);
        }

        try {
          // Critical section'ı çalıştır
          log.info(`Lock acquired (attempt ${attempt}/${maxRetries})`);
          const result = fn();
          log.info('Lock operation completed successfully');
          return result;
        } finally {
          // Her durumda lock'u serbest bırak
          lock.releaseLock();
          log.info('Lock released');
        }
      } catch (error) {
        lastError = error;
        log.error(`Lock attempt ${attempt}/${maxRetries} failed:`, error.message);

        // Son deneme değilse, kısa bir süre bekle (exponential backoff)
        if (attempt < maxRetries) {
          const waitMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Max 5 saniye
          log.info(`Waiting ${waitMs}ms before retry...`);
          Utilities.sleep(waitMs);
        }
      }
    }

    // Tüm denemeler başarısız
    throw new Error(`Failed to acquire lock after ${maxRetries} attempts. Last error: ${lastError.message}`);
  }
};

// ==================== AUTHENTICATION SERVICE ====================
/**
 * API Key authentication service
 * @namespace AuthService
 */
const AuthService = {
  /**
   * Generate a new random API key with 'RLX_' prefix
   * @returns {string} Generated API key (format: RLX_[32 random chars])
   */
  generateApiKey: function() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = 'RLX_'; // Prefix for Rolex
    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  },

  /**
   * Save API key to PropertiesService
   * @param {string} key - API key to save
   * @returns {string} Saved key
   */
  saveApiKey: function(key) {
    const props = PropertiesService.getScriptProperties();
    props.setProperty(CONFIG.API_KEY_PROPERTY, key);
    return key;
  },

  /**
   * Get stored API key (creates new one if doesn't exist)
   * @returns {string} Current API key
   */
  getApiKey: function() {
    const props = PropertiesService.getScriptProperties();
    let key = props.getProperty(CONFIG.API_KEY_PROPERTY);

    // Eğer key yoksa yeni oluştur
    if (!key) {
      key = this.generateApiKey();
      this.saveApiKey(key);
    }

    return key;
  },

  /**
   * Validate provided API key against stored key
   * @param {string} providedKey - API key to validate
   * @returns {boolean} True if valid
   */
  validateApiKey: function(providedKey) {
    if (!providedKey) return false;

    const storedKey = this.getApiKey();
    return providedKey === storedKey;
  },

  /**
   * Regenerate API key (requires old key for verification)
   * Sends email notification to admin
   * @param {string} oldKey - Current API key for verification
   * @returns {{success: boolean, apiKey?: string, error?: string}} Regeneration result
   */
  regenerateApiKey: function(oldKey) {
    if (!this.validateApiKey(oldKey)) {
      return { success: false, error: CONFIG.ERROR_MESSAGES.INVALID_API_KEY };
    }

    const newKey = this.generateApiKey();
    this.saveApiKey(newKey);

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
  },

  /**
   * Initialize API key and send to admin email
   * Used for initial setup or manual key retrieval
   * @returns {{success: boolean, apiKey: string, message?: string, warning?: string}} Initialization result
   */
  initializeApiKey: function() {
    const existingKey = this.getApiKey();

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
};

const CONFIG = {
  // Calendar & Storage
  // ⚠️ SECURITY: CALENDAR_ID Script Properties'den yüklenir (loadExternalConfigs)
  CALENDAR_ID: 'primary', // Default fallback - Production'da Script Properties'den override edilir
  TIMEZONE: 'Europe/Istanbul',
  PROPERTIES_KEY: 'RANDEVU_DATA',
  API_KEY_PROPERTY: 'ADMIN_API_KEY', // Admin API key için property

  // Security & Abuse Prevention
  // 🔒 SECURITY: TURNSTILE_SECRET_KEY Script Properties'den yüklenir (loadExternalConfigs)
  // Hardcoded fallback KALDIRILDI - Script Properties ZORUNLU
  TURNSTILE_SECRET_KEY: '', // 🔒 Script Properties'den yüklenecek, fallback YOK
  RATE_LIMIT_MAX_REQUESTS: 10,      // 10 istek
  RATE_LIMIT_WINDOW_SECONDS: 600,   // 10 dakika (600 saniye)

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

// ==================== DATE UTILITIES ====================
// Tarih formatlama fonksiyonları - DateUtils'e taşındı (line 814)

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
 * Vardiya tipine göre filtrelenmiş slot saatlerini döndürür
 * @param {string} shiftType - 'morning', 'evening', veya 'full'
 * @returns {number[]} Slot başlangıç saatleri dizisi
 */
/**
 * Slot generation and availability service
 * @namespace SlotService
 */
const SlotService = {
  /**
   * Get available hours for a shift type
   * @param {string} shiftType - Shift type ('morning', 'evening', 'full')
   * @returns {number[]} Array of hours
   */
  getSlotsByShift: function(shiftType) {
    return SHIFT_SLOT_FILTERS[shiftType] || SHIFT_SLOT_FILTERS.full;
  },

  /**
   * Generate daily slot objects for a specific date
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {string} shiftType - Shift type (optional, default: 'full')
   * @returns {Object[]} Slot objects [{start, end, hour, time}]
   */
  getDailySlots: function(date, shiftType = 'full') {
    const hours = this.getSlotsByShift(shiftType);

    return hours.map(hour => {
      const startDate = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`);
      const endDate = new Date(startDate);
      endDate.setHours(endDate.getHours() + 1);

      return {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        hour: hour,
        time: `${String(hour).padStart(2, '0')}:00`
      };
    });
  },

  /**
   * Check if a time slot is free (CORE RULE: Max 1 appointment per hour)
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {number} hour - Hour (11-20)
   * @returns {boolean} True if slot is free, false if occupied
   */
  isSlotFree: function(date, hour) {
    try {
      const calendar = CalendarService.getCalendar();
      const slotStart = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`);
      const slotEnd = new Date(slotStart);
      slotEnd.setHours(slotEnd.getHours() + 1);

      const events = calendar.getEvents(slotStart, slotEnd);

      // KURAL: 0 randevu olmalı (tür fark etmez)
      return events.length === 0;
    } catch (error) {
      log.error('isSlotFree error:', error);
      return false; // Hata durumunda safe side: dolu kabul et
    }
  }
};

/**
 * ⭐⭐⭐⭐⭐ CORE: Teslim + Gönderi randevusu global limiti
 * Bir günde toplam 3 teslim/gönderi randevusu alınabilir (toplamda)
 * Gönderi de teslim limiti içinde sayılır
 *
 * @param {string} date - YYYY-MM-DD formatında tarih
 * @returns {number} O gün için teslim + gönderi randevusu sayısı
 */
// getDeliveryCount - AvailabilityService namespace'ine taşındı (line 2353)
// getDeliveryCountByStaff - AvailabilityService namespace'ine taşındı (line 2384)

// validateReservation - ValidationService namespace'ine taşındı (line 2370)
// getDayStatus - AvailabilityService namespace'ine taşındı (line 2417)

// ==================== UTILITY FUNCTIONS ====================
/**
 * Utility functions for validation, sanitization, and formatting
 * @namespace Utils
 */
const Utils = {
  /**
   * E-posta adresini validate eder
   * @param {string} email - E-posta adresi
   * @returns {boolean} Geçerli mi?
   */
  isValidEmail: function(email) {
    if (!email || typeof email !== 'string') return false;
    // Basit email regex - RFC 5322 compliant değil ama pratik
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  },

  /**
   * String'i sanitize eder (trim + max length)
   * @param {string} str - String
   * @param {number} maxLength - Maximum uzunluk
   * @returns {string} Sanitized string
   */
  sanitizeString: function(str, maxLength) {
    if (!str || typeof str !== 'string') return '';
    return str.trim().substring(0, maxLength);
  },

  /**
   * Telefon numarasını sanitize eder
   * @param {string} phone - Telefon numarası
   * @returns {string} Sanitized telefon
   */
  sanitizePhone: function(phone) {
    if (!phone || typeof phone !== 'string') return '';
    // Sadece rakam, +, -, boşluk ve parantez karakterlerine izin ver
    return phone.replace(/[^0-9+\-\s()]/g, '').trim().substring(0, VALIDATION.PHONE_MAX_LENGTH);
  },

  /**
   * İsmi Title Case formatına çevirir (Her Kelimenin İlk Harfi Büyük)
   * Örnek: "SERDAR BENLİ" → "Serdar Benli"
   * @param {string} name - Formatlanacak isim
   * @returns {string} Title Case formatında isim
   */
  toTitleCase: function(name) {
    if (!name || typeof name !== 'string') return '';

    return name
      .trim()
      .toLowerCase()
      .split(' ')
      .map(word => {
        if (word.length === 0) return word;
        return word.charAt(0).toLocaleUpperCase('tr-TR') + word.slice(1);
      })
      .join(' ');
  },

  /**
   * Personel doğrulama ve temizleme - DRY prensibi
   * @param {string} name - İsim
   * @param {string} phone - Telefon
   * @param {string} email - E-posta
   * @returns {{name?: string, phone?: string, email?: string, error?: string}} Validation sonucu
   */
  validateAndSanitizeStaff: function(name, phone, email) {
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return { error: CONFIG.ERROR_MESSAGES.NAME_REQUIRED };
    }

    if (!phone || typeof phone !== 'string' || phone.trim().length === 0) {
      return { error: CONFIG.ERROR_MESSAGES.PHONE_REQUIRED };
    }

    if (email && !this.isValidEmail(email)) {
      return { error: CONFIG.ERROR_MESSAGES.INVALID_EMAIL };
    }

    return {
      name: this.toTitleCase(name),
      phone: this.sanitizePhone(phone),
      email: email ? email.trim().toLowerCase() : ''
    };
  }
};

// ==================== DATE UTILITIES ====================
/**
 * Date and time utility functions
 * @namespace DateUtils
 */
const DateUtils = {
  /**
   * Tarih ve saat string'ini epoch-minute'a çevirir (dakika cinsinden Unix timestamp)
   * Standart: 1970-01-01T00:00 UTC'den itibaren geçen dakika sayısı
   *
   * @param {string} date - YYYY-MM-DD formatında tarih
   * @param {string} time - HH:MM formatında saat
   * @returns {number} Epoch minute (dakika cinsinden timestamp)
   *
   * @example
   * DateUtils.dateTimeToEpochMinute('2025-01-15', '14:30') → 29073150
   */
  dateTimeToEpochMinute: function(date, time) {
    const dateTime = new Date(date + 'T' + time + ':00');
    return Math.floor(dateTime.getTime() / 60000); // milliseconds → minutes
  },

  /**
   * Date objesini epoch-minute'a çevirir
   *
   * @param {Date} dateObj - JavaScript Date objesi
   * @returns {number} Epoch minute
   */
  dateToEpochMinute: function(dateObj) {
    return Math.floor(dateObj.getTime() / 60000);
  },

  /**
   * İki zaman aralığının çakışıp çakışmadığını kontrol eder
   * Standart: [start, end) interval (start dahil, end hariç)
   *
   * Çakışma mantığı:
   * - [10:00, 11:00) ve [10:30, 11:30) → ÇAKIŞIR (10:30-11:00 ortak)
   * - [10:00, 11:00) ve [11:00, 12:00) → ÇAKIŞMAZ (end hariç)
   * - [10:00, 11:00) ve [09:00, 10:30) → ÇAKIŞIR (10:00-10:30 ortak)
   *
   * @param {number} start1 - 1. aralık başlangıcı (epoch minute)
   * @param {number} end1 - 1. aralık bitişi (epoch minute, hariç)
   * @param {number} start2 - 2. aralık başlangıcı (epoch minute)
   * @param {number} end2 - 2. aralık bitişi (epoch minute, hariç)
   * @returns {boolean} Çakışma var mı?
   *
   * @example
   * // Test cases:
   * DateUtils.checkTimeOverlap(600, 660, 630, 690) → true   // [10:00-11:00) ve [10:30-11:30) ÇAKIŞIR
   * DateUtils.checkTimeOverlap(600, 660, 660, 720) → false  // [10:00-11:00) ve [11:00-12:00) ÇAKIŞMAZ
   */
  checkTimeOverlap: function(start1, end1, start2, end2) {
    // İki aralık çakışır eğer:
    // start1 < end2 VE start2 < end1
    // (end hariç olduğu için = yok)
    return start1 < end2 && start2 < end1;
  },

  /**
   * Tarih string'inden başlangıç ve bitiş Date objelerini oluşturur
   * @param {string} dateStr - YYYY-MM-DD formatında tarih
   * @returns {{startDate: Date, endDate: Date}} Gün başı ve gün sonu
   */
  getDateRange: function(dateStr) {
    const startDate = new Date(dateStr + 'T00:00:00');
    const endDate = new Date(dateStr + 'T23:59:59');
    return { startDate, endDate };
  },

  /**
   * Tarih ve saati Türkçe formatta string'e çevirir
   * @param {string} dateStr - YYYY-MM-DD formatında tarih
   * @param {string} timeStr - HH:MM formatında saat
   * @returns {string} Formatlanmış tarih-saat (örn: "15 Ocak 2025, 14:30")
   */
  formatAppointmentDateTime: function(dateStr, timeStr) {
    const months = {
      '01': 'Ocak', '02': 'Şubat', '03': 'Mart', '04': 'Nisan',
      '05': 'Mayıs', '06': 'Haziran', '07': 'Temmuz', '08': 'Ağustos',
      '09': 'Eylül', '10': 'Ekim', '11': 'Kasım', '12': 'Aralık'
    };

    const [year, month, day] = dateStr.split('-');
    const monthName = months[month] || month;

    return `${parseInt(day)} ${monthName} ${year}, ${timeStr}`;
  },

  /**
   * YYYY-MM-DD formatında tarih döndürür (local timezone)
   * @param {Date} date - Formatlanacak tarih
   * @returns {string} YYYY-MM-DD formatında tarih
   */
  toLocalDate: function(date) {
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
  toICSDate: function(date) {
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
  toTurkishDate: function(dateStr) {
    const d = new Date(dateStr);
    return `${d.getDate()} ${CONFIG.LOCALIZATION.MONTHS[d.getMonth()]} ${d.getFullYear()}, ${CONFIG.LOCALIZATION.DAYS[d.getDay()]}`;
  }
};

/**
 * Google Calendar service wrapper
 * @namespace CalendarService
 */
const CalendarService = {
  /**
   * Get Google Calendar instance with error handling
   * @returns {GoogleAppsScript.Calendar.Calendar} Calendar instance
   * @throws {Error} If calendar not found
   */
  getCalendar: function() {
    const calendar = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
    if (!calendar) {
      log.error('Takvim bulunamadı. CALENDAR_ID kontrol edin:', CONFIG.CALENDAR_ID);
      throw new Error(CONFIG.ERROR_MESSAGES.CALENDAR_NOT_FOUND);
    }
    return calendar;
  }
};

// Event'i appointment objesine çevir (getAppointments, getWeekAppointments, getMonthAppointments için)
// mapEventToAppointment - AppointmentService namespace'ine taşındı (line 2073)

// Email template'leri - kod organizasyonu için ayrı fonksiyonlar

// Generic email template builder - DRY prensibi
// generateEmailTemplate - NotificationService namespace'ine taşındı (line 2419)
 

// getCustomerEmailTemplate - NotificationService namespace'ine taşındı (line 2377)
 

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

// getStaffEmailTemplate - NotificationService namespace'ine taşındı (line 2398)
 

// ==================== API KEY MANAGEMENT ====================
// Admin fonksiyonları için API key yönetimi
// API Key fonksiyonları - AuthService namespace'ine taşındı (line 238)

// ==================== CACHE (Script-wide with CacheService) ====================
// Google Apps Script CacheService kullanarak gerçek cache implementasyonu
// 15 dakika süre ile cache tutulur - API performansını dramatik şekilde artırır

const CACHE_DURATION = 900; // 15 dakika (saniye cinsinden)
const DATA_CACHE_KEY = 'app_data';

/**
 * CacheService wrapper for DRY principle
 * @namespace CacheServiceWrapper
 */
const CacheServiceWrapper = {
  /**
   * Get script-level cache instance
   * @returns {Cache} Google Apps Script CacheService.Cache instance
   */
  getCache: function() {
    return CacheService.getScriptCache();
  }
};

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
  'getWhatsAppSettings',          // YENİ: WhatsApp Business API
  'updateSlackSettings',          // YENİ: Slack Webhook
  'getSlackSettings'              // YENİ: Slack Webhook
];

// Action handler map - daha okunabilir ve yönetilebilir
const ACTION_HANDLERS = {
  // Test
  'test': () => ({ status: 'ok', message: 'Apps Script çalışıyor!' }),

  // API Key management
  'initializeApiKey': () => AuthService.initializeApiKey(),
  'regenerateApiKey': (e) => AuthService.regenerateApiKey(e.parameter.oldKey),

  // Staff management
  'getStaff': () => StaffService.getStaff(),
  'addStaff': (e) => StaffService.addStaff(e.parameter.name, e.parameter.phone, e.parameter.email),
  'toggleStaff': (e) => StaffService.toggleStaff(e.parameter.id),
  'removeStaff': (e) => StaffService.removeStaff(e.parameter.id),
  'updateStaff': (e) => StaffService.updateStaff(e.parameter.id, e.parameter.name, e.parameter.phone, e.parameter.email),

  // Shifts management
  'getShifts': (e) => ShiftService.getShifts(e.parameter.date),
  'getMonthShifts': (e) => ShiftService.getMonthShifts(e.parameter.month),
  'saveShifts': (e) => ShiftService.saveShifts(JSON.parse(e.parameter.shifts)),

  // Settings management
  'getSettings': () => SettingsService.getSettings(),
  'saveSettings': (e) => SettingsService.saveSettings(e.parameter),

  // Data version (cache invalidation)
  'getDataVersion': () => VersionService.getDataVersion(),

  // Appointments
  'getAppointments': (e) => AppointmentService.getAppointments(e.parameter.date, {
    countOnly: e.parameter.countOnly === 'true',
    appointmentType: e.parameter.appointmentType || null
  }),
  'getWeekAppointments': (e) => AppointmentService.getWeekAppointments(e.parameter.startDate, e.parameter.endDate),
  'deleteAppointment': (e) => AppointmentService.deleteAppointment(e.parameter.eventId),
  'updateAppointment': (e) => AppointmentService.updateAppointment(e.parameter.eventId, e.parameter.newDate, e.parameter.newTime),
  'getAvailableSlotsForEdit': (e) => AvailabilityService.getAvailableSlotsForEdit(e.parameter.date, e.parameter.currentEventId, e.parameter.appointmentType),
  'assignStaffToAppointment': (e) => assignStaffToAppointment(e.parameter.eventId, e.parameter.staffId),
  'getMonthAppointments': (e) => AppointmentService.getMonthAppointments(e.parameter.month),
  'getGoogleCalendarEvents': (e) => getGoogleCalendarEvents(e.parameter.startDate, e.parameter.endDate, e.parameter.staffId),
  'createAppointment': (e) => createAppointment(e.parameter),

  // Availability calculation (server-side blocking logic)
  'checkTimeSlotAvailability': (e) => AvailabilityService.checkTimeSlotAvailability(
    e.parameter.date,
    e.parameter.staffId,
    e.parameter.shiftType,
    e.parameter.appointmentType,
    e.parameter.interval
  ),

  // YENİ: WhatsApp ve Manuel Randevu
  'getTodayWhatsAppReminders': (e) => WhatsAppService.getTodayWhatsAppReminders(e.parameter.date),
  'createManualAppointment': (e) => createManualAppointment(e.parameter),

  // WhatsApp Business Cloud API
  'sendWhatsAppReminders': (e) => WhatsAppService.sendWhatsAppReminders(e.parameter.date, e.parameter.apiKey),
  'updateWhatsAppSettings': (e) => WhatsAppService.updateWhatsAppSettings(JSON.parse(e.parameter.settings), e.parameter.apiKey),
  'getWhatsAppSettings': (e) => WhatsAppService.getWhatsAppSettings(e.parameter.apiKey),

  // Slack Webhook
  'updateSlackSettings': (e) => SlackService.updateSlackSettings(e.parameter.webhookUrl, e.parameter.apiKey),
  'getSlackSettings': (e) => SlackService.getSlackSettings(e.parameter.apiKey),

  // Config management (public - no auth required)
  'getConfig': () => ConfigService.getConfig(),

  // ⭐⭐⭐⭐⭐ NEW: Slot Universe & Business Rules
  'getDayStatus': (e) => AvailabilityService.getDayStatus(e.parameter.date, e.parameter.appointmentType),
  'getDailySlots': (e) => ({
    success: true,
    slots: SlotService.getDailySlots(e.parameter.date, e.parameter.shiftType || 'full')
  }),
  'validateReservation': (e) => ValidationService.validateReservation({
    date: e.parameter.date,
    hour: parseInt(e.parameter.hour),
    appointmentType: e.parameter.appointmentType,
    staffId: e.parameter.staffId
  }),

  // ⭐ YENİ: Yönetim Linki API'leri (hk, ok, hmk)
  'getManagementSlotAvailability': (e) => getManagementSlotAvailability(
    e.parameter.date,
    parseInt(e.parameter.managementLevel)
  ),
  'getAvailableStaffForSlot': (e) => AvailabilityService.getAvailableStaffForSlot(
    e.parameter.date,
    e.parameter.time
  ),

  // Data management
  'resetData': () => StorageService.resetData()
};

function doGet(e) {
  try {
    const action = e.parameter.action;
    // ✅ GÜVENLİK GÜNCELLEMESİ: JSONP desteği kaldırıldı - sadece JSON döndürülür

    let response = {};

    try {
      // 🔒 GÜVENLİK: Admin actions için GET YASAK - POST zorunlu
      // API key URL'de görünmemeli (browser history, server logs güvenliği)
      if (ADMIN_ACTIONS.includes(action)) {
        log.warn('Admin action attempted via GET:', action);
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            error: 'Güvenlik: Admin işlemleri için POST kullanın. GET ile admin işlemi yapılamaz.',
            requiresPost: true
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      // Public action - GET ile devam et
      const handler = ACTION_HANDLERS[action];

      if (!handler) {
        response = { success: false, error: CONFIG.ERROR_MESSAGES.UNKNOWN_ACTION + ': ' + action };
      } else {
        response = handler(e);
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

// ==================== POST REQUEST HANDLER ====================
// ⭐ GÜVENLİK: POST + JSON body ile API key koruması
// API key artık URL'de görünmez (server logs, browser history güvenli)
function doPost(e) {
  try {
    // POST body'sini parse et (JSON)
    if (!e.postData || !e.postData.contents) {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          error: 'POST body boş olamaz'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const params = JSON.parse(e.postData.contents);
    const action = params.action;
    const apiKey = params.apiKey;

    log.info('POST request received:', action);

    let response = {};

    try {
      // Admin action kontrolü - API key gerekli mi?
      if (ADMIN_ACTIONS.includes(action)) {
        if (!AuthService.validateApiKey(apiKey)) {
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
            // ⭐ Handler'a params'ı e.parameter formatında geçir (backward compatibility)
            response = handler({ parameter: params });
          }
        }
      } else {
        // Normal action (API key gerekmez)
        const handler = ACTION_HANDLERS[action];

        if (!handler) {
          response = { success: false, error: CONFIG.ERROR_MESSAGES.UNKNOWN_ACTION + ': ' + action };
        } else {
          response = handler({ parameter: params });
        }
      }
    } catch (handlerError) {
      log.error('Handler error:', handlerError);
      response = { success: false, error: handlerError.toString() };
    }

    // JSON döndür
    return ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (mainError) {
    log.error('doPost error:', mainError);
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: CONFIG.ERROR_MESSAGES.SERVER_ERROR + ': ' + mainError.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ==================== DATA STORAGE ====================
/**
 * Data storage service using PropertiesService + CacheService
 * @namespace StorageService
 */
const StorageService = {
  /**
   * Veriyi getir (Cache + PropertiesService)
   * @returns {Object} Data object
   */
  getData: function() {
  const cache = CacheServiceWrapper.getCache();

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
        maxDaily: 3
      }
    };
    this.saveData(defaultData);
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
  },

  /**
   * Veriyi kaydet (PropertiesService + Cache invalidation)
   * @param {Object} data - Kaydedilecek data
   */
  saveData: function(data) {
    const props = PropertiesService.getScriptProperties();
    const jsonData = JSON.stringify(data);

    // 1. PropertiesService'e kaydet
    props.setProperty(CONFIG.PROPERTIES_KEY, jsonData);

    // 2. Cache'i temizle (veri değiştiği için)
    const cache = CacheServiceWrapper.getCache();
    cache.remove(DATA_CACHE_KEY);

    // 3. Yeni veriyi cache'e yaz (sonraki okumalar için)
    try {
      cache.put(DATA_CACHE_KEY, jsonData, CACHE_DURATION);
    } catch (e) {
      log.warn('Cache yazma hatası:', e);
      // Cache yazılamazsa da devam et
    }
  },

  /**
   * Tüm veriyi sıfırla ve yeni default data yükle
   * @returns {{success: boolean, message?: string, error?: string}} Reset sonucu
   */
  resetData: function() {
    try {
      const props = PropertiesService.getScriptProperties();
      props.deleteProperty(CONFIG.PROPERTIES_KEY);

      // Cache'i temizle
      const cache = CacheServiceWrapper.getCache();
      cache.remove(DATA_CACHE_KEY);

      // Yeni default data yüklenir
      this.getData();

      return { success: true, message: CONFIG.SUCCESS_MESSAGES.DATA_RESET };
    } catch (error) {
      log.error('Reset data error:', error);
      return { success: false, error: error.toString() };
    }
  }
};

// ==================== DATA VERSION MANAGEMENT ====================
// ⭐ Cache invalidation için version tracking
// Frontend cache'i invalidate etmek için kullanılır

const DATA_VERSION_KEY = 'DATA_VERSION';

/**
 * Data version management service for cache invalidation
 * @namespace VersionService
 */
const VersionService = {
  /**
   * Get current data version (for frontend cache invalidation)
   * @returns {{success: boolean, data?: string, error?: string}} Current version
   */
  getDataVersion: function() {
    try {
      const props = PropertiesService.getScriptProperties();
      const version = props.getProperty(DATA_VERSION_KEY) || Date.now().toString();

      // İlk kez çağrılıyorsa, version initialize et
      if (!props.getProperty(DATA_VERSION_KEY)) {
        props.setProperty(DATA_VERSION_KEY, version);
      }

      return { success: true, data: version };
    } catch (error) {
      log.error('getDataVersion error:', error);
      return { success: false, error: error.toString() };
    }
  },

  /**
   * Increment data version (triggers cache invalidation)
   * Called after appointments create/delete/update
   * @returns {{success: boolean, version?: string, error?: string}} New version
   */
  incrementDataVersion: function() {
    try {
      const props = PropertiesService.getScriptProperties();
      const newVersion = Date.now().toString();
      props.setProperty(DATA_VERSION_KEY, newVersion);

      log.info('Data version incremented:', newVersion);
      return { success: true, version: newVersion };
    } catch (error) {
      log.error('incrementDataVersion error:', error);
      // Version increment başarısız olsa bile devam et (critical değil)
      return { success: false, error: error.toString() };
    }
  }
};

// ==================== API FUNCTIONS ====================

// ==================== STAFF MANAGEMENT ====================
/**
 * Staff management service
 * @namespace StaffService
 */
const StaffService = {
  /**
   * Get all staff members
   * @returns {{success: boolean, data: Array}} Staff list
   */
  getStaff: function() {
    const data = StorageService.getData();
    return { success: true, data: data.staff || [] };
  },

  /**
   * Add new staff member (with validation, sanitization, and race condition protection)
   * @param {string} name - Staff name
   * @param {string} phone - Phone number
   * @param {string} email - Email address
   * @returns {{success: boolean, data?: Array, error?: string}} Result with updated staff list
   */
  addStaff: function(name, phone, email) {
    try {
      // Validation ve sanitization - DRY prensibi
      const validationResult = Utils.validateAndSanitizeStaff(name, phone, email);
      if (validationResult.error) {
        return { success: false, error: validationResult.error };
      }

      // Lock ile getData → modify → saveData atomik yap
      return LockServiceWrapper.withLock(() => {
        const data = StorageService.getData();
        const newId = data.staff.length > 0 ? Math.max(...data.staff.map(s => s.id)) + 1 : 1;
        data.staff.push({
          id: newId,
          name: validationResult.name,
          phone: validationResult.phone,
          email: validationResult.email,
          active: true
        });
        StorageService.saveData(data);
        return { success: true, data: data.staff };
      });
    } catch (error) {
      return { success: false, error: error.toString() };
    }
  },

  /**
   * Toggle staff active/inactive status
   * @param {number|string} staffId - Staff ID
   * @returns {{success: boolean, data?: Array, error?: string}} Result with updated staff list
   */
  toggleStaff: function(staffId) {
    try {
      // Lock ile getData → modify → saveData atomik yap
      return LockServiceWrapper.withLock(() => {
        const data = StorageService.getData();
        const staff = data.staff.find(s => s.id === parseInt(staffId));
        if (staff) {
          staff.active = !staff.active;
          StorageService.saveData(data);
          return { success: true, data: data.staff };
        }
        return { success: false, error: CONFIG.ERROR_MESSAGES.STAFF_NOT_FOUND };
      });
    } catch (error) {
      return { success: false, error: error.toString() };
    }
  },

  /**
   * Remove staff member and clear from all shifts
   * @param {number|string} staffId - Staff ID
   * @returns {{success: boolean, data?: Array, error?: string}} Result with updated staff list
   */
  removeStaff: function(staffId) {
    try {
      // Lock ile getData → modify → saveData atomik yap
      return LockServiceWrapper.withLock(() => {
        const data = StorageService.getData();
        data.staff = data.staff.filter(s => s.id !== parseInt(staffId));

        // Vardiyalardan da sil
        Object.keys(data.shifts).forEach(date => {
          if (data.shifts[date][staffId]) {
            delete data.shifts[date][staffId];
          }
        });

        StorageService.saveData(data);
        return { success: true, data: data.staff };
      });
    } catch (error) {
      return { success: false, error: error.toString() };
    }
  },

  /**
   * Update staff member details (with validation and sanitization)
   * @param {number|string} staffId - Staff ID
   * @param {string} name - New name
   * @param {string} phone - New phone
   * @param {string} email - New email
   * @returns {{success: boolean, data?: Array, error?: string}} Result with updated staff list
   */
  updateStaff: function(staffId, name, phone, email) {
    try {
      // Validation ve sanitization - DRY prensibi
      const validationResult = Utils.validateAndSanitizeStaff(name, phone, email);
      if (validationResult.error) {
        return { success: false, error: validationResult.error };
      }

      // Lock ile getData → modify → saveData atomik yap
      return LockServiceWrapper.withLock(() => {
        const data = StorageService.getData();
        const staff = data.staff.find(s => s.id === parseInt(staffId));
        if (staff) {
          staff.name = validationResult.name;
          staff.phone = validationResult.phone;
          staff.email = validationResult.email;
          StorageService.saveData(data);
          return { success: true, data: data.staff };
        }
        return { success: false, error: CONFIG.ERROR_MESSAGES.STAFF_NOT_FOUND };
      });
    } catch (error) {
      return { success: false, error: error.toString() };
    }
  }
};

// ==================== SETTINGS MANAGEMENT ====================
/**
 * Application settings service (interval, maxDaily limits)
 * @namespace SettingsService
 */
const SettingsService = {
  /**
   * Get application settings
   * @returns {{success: boolean, data: {interval: number, maxDaily: number}}} Settings object
   */
  getSettings: function() {
    const data = StorageService.getData();
    return {
      success: true,
      data: data.settings || { interval: 60, maxDaily: 4 }
    };
  },

  /**
   * Save application settings (with validation and race condition protection)
   * @param {{interval: number|string, maxDaily: number|string}} params - Settings to save
   * @returns {{success: boolean, data?: {interval: number, maxDaily: number}, error?: string}} Result
   */
  saveSettings: function(params) {
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

      // Lock ile getData → modify → saveData atomik yap
      return LockServiceWrapper.withLock(() => {
        const data = StorageService.getData();
        data.settings = {
          interval: interval,
          maxDaily: maxDaily
        };
        StorageService.saveData(data);
        return { success: true, data: data.settings };
      });
    } catch (error) {
      return { success: false, error: error.toString() };
    }
  }
};

// getConfig - ConfigService namespace'ine taşındı (line 2074)

// ==================== SHIFTS MANAGEMENT ====================
/**
 * Staff shift scheduling service (morning/evening/full shifts)
 * @namespace ShiftService
 */
const ShiftService = {
  /**
   * Save shifts for one or more dates (with race condition protection)
   * @param {Object.<string, Object.<string, string>>} shiftsData - Format: { 'YYYY-MM-DD': { staffId: 'morning|evening|full' } }
   * @returns {{success: boolean, error?: string}} Save result
   */
  saveShifts: function(shiftsData) {
    try {
      // Lock ile getData → modify → saveData atomik yap
      return LockServiceWrapper.withLock(() => {
        const data = StorageService.getData();
        // shiftsData format: { 'YYYY-MM-DD': { staffId: 'morning|evening|full' } }
        Object.keys(shiftsData).forEach(date => {
          if (!data.shifts[date]) {
            data.shifts[date] = {};
          }
          data.shifts[date] = shiftsData[date];
        });
        StorageService.saveData(data);
        return { success: true };
      });
    } catch (error) {
      return { success: false, error: error.toString() };
    }
  },

  /**
   * Get shifts for a specific date
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {{success: boolean, data: Object.<string, string>}} Shifts for date
   */
  getShifts: function(date) {
    const data = StorageService.getData();
    const shifts = data.shifts || {};
    return { success: true, data: shifts[date] || {} };
  },

  /**
   * Get all shifts for a specific month
   * @param {string} month - Month in YYYY-MM format
   * @returns {{success: boolean, data: Object.<string, Object>}} All shifts for month
   */
  getMonthShifts: function(month) {
    const data = StorageService.getData();
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
};

// ==================== CONFIG MANAGEMENT ====================
/**
 * Public configuration service for frontend
 * Returns non-sensitive configuration (excludes API keys and secrets)
 * @namespace ConfigService
 */
const ConfigService = {
  /**
   * Get public configuration for frontend
   * @returns {{success: boolean, data: {shifts: Object, appointmentHours: Object, maxDailyDeliveryAppointments: number, appointmentTypes: Array, appointmentTypeLabels: Object, serviceNames: Object, companyName: string, companyLocation: string, validation: Object}}}
   */
  getConfig: function() {
    try {
      const data = StorageService.getData();
      const settings = data.settings || { interval: 60, maxDaily: 4 };

      return {
        success: true,
        data: {
          // Shift hours
          shifts: CONFIG.SHIFT_HOURS,

          // Appointment hours (earliest, latest, interval from settings)
          appointmentHours: {
            earliest: 11,  // En erken randevu: 11:00
            latest: 21,    // En geç randevu: 20:00
            interval: settings.interval
          },

          // Max daily appointments
          maxDailyDeliveryAppointments: settings.maxDaily,

          // Appointment types
          appointmentTypes: CONFIG.APPOINTMENT_TYPES,
          appointmentTypeLabels: CONFIG.APPOINTMENT_TYPE_LABELS,
          serviceNames: CONFIG.SERVICE_NAMES,

          // Company info (public)
          companyName: CONFIG.COMPANY_NAME,
          companyLocation: CONFIG.COMPANY_LOCATION,

          // Validation limits
          validation: {
            intervalMin: VALIDATION.INTERVAL_MIN,
            intervalMax: VALIDATION.INTERVAL_MAX,
            maxDailyMin: VALIDATION.MAX_DAILY_MIN,
            maxDailyMax: VALIDATION.MAX_DAILY_MAX
          }
        }
      };
    } catch (error) {
      log.error('getConfig error:', error);
      return {
        success: false,
        error: CONFIG.ERROR_MESSAGES.SERVER_ERROR
      };
    }
  }
};

// ==================== APPOINTMENTS MANAGEMENT ====================
/**
 * Appointment CRUD service - Google Calendar integration
 * @namespace AppointmentService
 */
const AppointmentService = {
  /**
   * Map Google Calendar event to appointment object (helper)
   * @param {GoogleAppsScript.Calendar.CalendarEvent} event - Calendar event
   * @returns {Object} Appointment object
   * @private
   */
  mapEventToAppointment: function(event) {
    return {
      id: event.getId(),
      summary: event.getTitle(),
      start: { dateTime: event.getStartTime().toISOString() },
      end: { dateTime: event.getEndTime().toISOString() },
      extendedProperties: {
        private: event.getTag('staffId') ? {
          staffId: event.getTag('staffId'),
          customerPhone: event.getTag('customerPhone'),
          customerEmail: event.getTag('customerEmail'),
          customerNote: event.getTag('customerNote') || '',
          shiftType: event.getTag('shiftType'),
          appointmentType: event.getTag('appointmentType'),
          isVipLink: event.getTag('isVipLink') || 'false'
        } : {}
      }
    };
  },

  /**
   * Get appointments for a specific date
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {{countOnly?: boolean, appointmentType?: string}} options - Query options
   * @returns {{success: boolean, count?: number, items?: Array}} Appointments or count
   */
  getAppointments: function(date, options = {}) {
  const { countOnly = false, appointmentType = null } = options;

  try {
    const calendar = CalendarService.getCalendar();
    const { startDate, endDate } = DateUtils.getDateRange(date);
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
    const appointments = events.map(event => this.mapEventToAppointment(event));
    return { success: true, items: appointments };

  } catch (error) {
    log.error('getAppointments hatası:', error);
    return countOnly
      ? { success: true, count: 0 }
      : { success: true, items: [] };
  }
  },

  /**
   * Get appointments for a week date range
   * @param {string} startDateStr - Start date (YYYY-MM-DD)
   * @param {string} endDateStr - End date (YYYY-MM-DD)
   * @returns {{success: boolean, items: Array}} Week appointments
   */
  getWeekAppointments: function(startDateStr, endDateStr) {
  try {
    const calendar = CalendarService.getCalendar();
    const startDate = new Date(startDateStr + 'T00:00:00');
    const endDate = new Date(endDateStr + 'T23:59:59');
    const events = calendar.getEvents(startDate, endDate);

    const appointments = events.map(event => this.mapEventToAppointment(event));
    return { success: true, items: appointments };

  } catch (error) {
    log.error('getWeekAppointments hatası:', error);
    return { success: true, items: [] };
  }
  },

  /**
   * Delete an appointment
   * @param {string} eventId - Google Calendar event ID
   * @returns {{success: boolean, message?: string, error?: string}} Delete result
   */
  deleteAppointment: function(eventId) {
  try {
    const calendar = CalendarService.getCalendar();
    const event = calendar.getEventById(eventId);
    if (!event) {
      return { success: false, error: CONFIG.ERROR_MESSAGES.APPOINTMENT_NOT_FOUND };
    }

    event.deleteEvent();
    log.info('Randevu silindi:', eventId);

    // ⭐ Cache invalidation: Version increment
    VersionService.incrementDataVersion();

    return { success: true, message: CONFIG.SUCCESS_MESSAGES.APPOINTMENT_DELETED };
  } catch (error) {
    log.error('deleteAppointment hatası:', error);
    return { success: false, error: error.toString() };
  }
  },

  /**
   * Update appointment date and time
   * @param {string} eventId - Google Calendar event ID
   * @param {string} newDate - New date (YYYY-MM-DD)
   * @param {string} newTime - New time (HH:MM)
   * @returns {{success: boolean, message?: string, error?: string}} Update result
   */
  updateAppointment: function(eventId, newDate, newTime) {
  try {
    const calendar = CalendarService.getCalendar();
    const event = calendar.getEventById(eventId);

    if (!event) {
      return { success: false, error: CONFIG.ERROR_MESSAGES.APPOINTMENT_NOT_FOUND };
    }

    // Mevcut randevu bilgilerini al
    const appointmentType = event.getTag('appointmentType');
    const currentStart = event.getStartTime();
    const currentEnd = event.getEndTime();
    const durationMs = currentEnd.getTime() - currentStart.getTime();

    // Yeni başlangıç ve bitiş zamanları
    const newStartDateTime = new Date(newDate + 'T' + newTime + ':00');
    const newEndDateTime = new Date(newStartDateTime.getTime() + durationMs);

    // ===== RACE CONDITION PROTECTION =====
    // updateAppointment için lock (overlap check + update atomik olmalı)
    let updateResult;
    try {
      updateResult = LockServiceWrapper.withLock(() => {
        log.info('Lock acquired - updating appointment');

        // YÖNETİM RANDEVUSU → VALİDATION BYPASS
        if (appointmentType === CONFIG.APPOINTMENT_TYPES.MANAGEMENT || appointmentType === 'management') {
          event.setTime(newStartDateTime, newEndDateTime);
          log.info('Yönetim randevusu güncellendi (validation bypass):', eventId);
          return { success: true, message: 'Randevu başarıyla güncellendi' };
        }

        // NORMAL RANDEVULAR → VALİDATION YAP
        const hour = parseInt(newTime.split(':')[0]);

        // 1. SLOT KONTROLÜ: Aynı saatte başka randevu var mı? (kendisi hariç)
        const overlappingEvents = calendar.getEvents(newStartDateTime, newEndDateTime);
        const otherEvents = overlappingEvents.filter(e => e.getId() !== eventId);

        if (otherEvents.length > 0) {
          return {
            success: false,
            error: 'Bu saat dolu. Lütfen başka bir saat seçin.'
          };
        }

        // 2. TESLİM RANDEVUSU → GÜNLÜK LİMİT KONTROLÜ
        if (appointmentType === CONFIG.APPOINTMENT_TYPES.DELIVERY || appointmentType === 'delivery') {
          const data = StorageService.getData();
          const maxDaily = data.settings?.maxDaily || 4;

          // O gündeki teslim randevularını say (kendisi hariç)
          const dayStart = new Date(newDate + 'T00:00:00');
          const dayEnd = new Date(newDate + 'T23:59:59');
          const dayEvents = calendar.getEvents(dayStart, dayEnd);

          const deliveryCount = dayEvents.filter(e => {
            const type = e.getTag('appointmentType');
            const id = e.getId();
            return (type === 'delivery' || type === CONFIG.APPOINTMENT_TYPES.DELIVERY) && id !== eventId;
          }).length;

          if (deliveryCount >= maxDaily) {
            return {
              success: false,
              error: `Bu gün için teslim randevuları dolu (maksimum ${maxDaily}).`
            };
          }
        }

        // VALİDATION BAŞARILI → Randevuyu güncelle
        event.setTime(newStartDateTime, newEndDateTime);
        log.info('Appointment updated successfully - releasing lock');
        return { success: true, message: 'Randevu başarıyla güncellendi' };
      });
    } catch (lockError) {
      log.error('Lock acquisition failed for update:', lockError.message);
      return {
        success: false,
        error: 'Randevu güncelleme sırasında bir hata oluştu. Lütfen tekrar deneyin.'
      };
    }

    // ⭐ Cache invalidation: Version increment (only if update successful)
    if (updateResult && updateResult.success) {
      VersionService.incrementDataVersion();
    }

    // Lock'dan dönen sonucu return et
    return updateResult;

  } catch (error) {
    log.error('updateAppointment hatası:', error);
    return { success: false, error: error.toString() };
  }
  },

  /**
   * Get appointments for entire month (grouped by date)
   * @param {string} month - Month in YYYY-MM format
   * @returns {{success: boolean, data: Object}} Appointments grouped by date
   */
  getMonthAppointments: function(month) {
    try {
      const calendar = CalendarService.getCalendar();

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

        appointmentsByDate[eventDate].push(this.mapEventToAppointment(event));
      });

      return { success: true, data: appointmentsByDate };

    } catch (error) {
      log.error('getMonthAppointments hatası:', error);
      return { success: true, data: {} };
    }
  }
};

// ==================== AVAILABILITY SERVICE ====================
/**
 * Slot and staff availability checking service
 * Handles business rules: delivery limits, slot conflicts, shift availability
 * @namespace AvailabilityService
 */
const AvailabilityService = {
  /**
   * Get total delivery+shipping appointment count for a date
   * Used for daily limit enforcement (max 3 delivery/shipping per day)
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {number} Number of delivery+shipping appointments
   */
  getDeliveryCount: function(date) {
    try {
      const calendar = CalendarService.getCalendar();
      const dayStart = new Date(`${date}T00:00:00`);
      const dayEnd = new Date(`${date}T23:59:59`);

      const events = calendar.getEvents(dayStart, dayEnd);

      // 'delivery' VE 'shipping' tipindeki randevuları say (ikisi de aynı limit içinde)
      const deliveryCount = events.filter(event => {
        const type = event.getTag('appointmentType');
        return (
          type === CONFIG.APPOINTMENT_TYPES.DELIVERY || type === 'delivery' ||
          type === CONFIG.APPOINTMENT_TYPES.SHIPPING || type === 'shipping'
        );
      }).length;

      return deliveryCount;
    } catch (error) {
      log.error('getDeliveryCount error:', error);
      return 999; // Hata durumunda safe side: limit aşılmış kabul et
    }
  },

  /**
   * Get delivery+shipping count for specific staff member on a date
   * Used for per-staff limit enforcement (max 2 delivery/shipping per staff per day)
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {string} staffId - Staff member ID
   * @returns {number} Number of delivery+shipping appointments for this staff
   */
  getDeliveryCountByStaff: function(date, staffId) {
    try {
      const calendar = CalendarService.getCalendar();
      const dayStart = new Date(`${date}T00:00:00`);
      const dayEnd = new Date(`${date}T23:59:59`);

      const events = calendar.getEvents(dayStart, dayEnd);

      // Bu personelin 'delivery' VE 'shipping' randevularını say (ikisi de aynı limit içinde)
      const deliveryCount = events.filter(event => {
        const type = event.getTag('appointmentType');
        const eventStaffId = event.getTag('staffId');

        return (
          (type === CONFIG.APPOINTMENT_TYPES.DELIVERY || type === 'delivery' ||
           type === CONFIG.APPOINTMENT_TYPES.SHIPPING || type === 'shipping') &&
          eventStaffId === String(staffId)
        );
      }).length;

      return deliveryCount;
    } catch (error) {
      log.error('getDeliveryCountByStaff error:', error);
      return 999; // Hata durumunda safe side: limit aşılmış kabul et
    }
  },

  /**
   * Get day status for UI (available/unavailable hours, delivery limits)
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {string} appointmentType - Optional appointment type for delivery limit check
   * @returns {{success: boolean, isDeliveryMaxed: boolean, availableHours: Array<number>, unavailableHours: Array<number>, deliveryCount: number}}
   */
  getDayStatus: function(date, appointmentType = null) {
    try {
      // Teslim/Gönderi limiti kontrolü (ikisi toplamda max 3)
      const isDeliveryOrShipping = (
        appointmentType === 'delivery' || appointmentType === CONFIG.APPOINTMENT_TYPES.DELIVERY ||
        appointmentType === 'shipping' || appointmentType === CONFIG.APPOINTMENT_TYPES.SHIPPING
      );
      const isDeliveryMaxed = isDeliveryOrShipping ? this.getDeliveryCount(date) >= 3 : false;

      // Tüm slotlar için availability check
      const availableHours = [];
      const unavailableHours = [];

      SLOT_UNIVERSE.forEach(hour => {
        if (SlotService.isSlotFree(date, hour)) {
          availableHours.push(hour);
        } else {
          unavailableHours.push(hour);
        }
      });

      return {
        success: true,
        isDeliveryMaxed,
        availableHours,
        unavailableHours,
        deliveryCount: this.getDeliveryCount(date)
      };
    } catch (error) {
      log.error('getDayStatus error:', error);
      return {
        success: false,
        error: CONFIG.ERROR_MESSAGES.SERVER_ERROR
      };
    }
  },

  /**
   * Check time slot availability for a specific date, staff, shift and appointment type
   * Server-side single source of truth for slot blocking rules
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {string} staffId - Staff ID
   * @param {string} shiftType - Shift type ('morning', 'evening', 'full')
   * @param {string} appointmentType - Appointment type
   * @param {number} interval - Appointment duration in minutes
   * @returns {{success: boolean, slots?: Array<{time: string, available: boolean, reason: string}>, dailyDeliveryCount?: number, maxDelivery?: number, error?: string}}
   */
  checkTimeSlotAvailability: function(date, staffId, shiftType, appointmentType, interval) {
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
      const calendar = CalendarService.getCalendar();
      const { startDate, endDate } = DateUtils.getDateRange(date);
      const events = calendar.getEvents(startDate, endDate);

      // Data ayarlarını al (günlük max teslim sayısı için)
      const data = StorageService.getData();
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

      // Her slot için müsaitlik kontrolü (EPOCH-MINUTE STANDARD)
      const availabilityResults = slots.map(timeStr => {
        // 1. Geçmiş zaman kontrolü (bugünse)
        if (currentTime && timeStr <= currentTime) {
          return {
            time: timeStr,
            available: false,
            reason: CONFIG.ERROR_MESSAGES.PAST_TIME
          };
        }

        // 2. Slot'un epoch-minute aralığı [start, end)
        const slotStart = DateUtils.dateTimeToEpochMinute(date, timeStr);
        const slotEnd = slotStart + intervalNum; // interval dakika cinsinden

        // 3. Bu slot ile ÇAKIŞAN randevuları bul (epoch-minute standardı ile)
        // DEĞİŞKEN SÜRELİ randevular için de doğru çalışır
        const overlappingEvents = events.filter(event => {
          const eventStart = DateUtils.dateToEpochMinute(event.getStartTime());
          const eventEnd = DateUtils.dateToEpochMinute(event.getEndTime());

          // [start, end) standardı ile çakışma kontrolü
          return DateUtils.checkTimeOverlap(slotStart, slotEnd, eventStart, eventEnd);
        });

        const overlappingCount = overlappingEvents.length;

        // 4. SERVER-SIDE SINGLE SOURCE OF TRUTH KURAL:
        // **1 SAATE 1 RANDEVU** (tür/link farketmeksizin)
        // TEK İSTİSNA: Yönetim randevusu → o saate 2 randevu olabilir

        // 4a. Çakışan randevu yok → MÜSAİT
        if (overlappingCount === 0) {
          return {
            time: timeStr,
            available: true,
            reason: ''
          };
        }

        // 4b. 1 çakışan randevu var
        if (overlappingCount === 1) {
          // Yönetim randevusu ekleniyor VE mevcut yönetim değil → MÜSAİT
          const existingType = overlappingEvents[0].getTag('appointmentType');

          if (appointmentType === CONFIG.APPOINTMENT_TYPES.MANAGEMENT &&
              existingType !== CONFIG.APPOINTMENT_TYPES.MANAGEMENT) {
            return {
              time: timeStr,
              available: true,
              reason: ''
            };
          }

          // Diğer tüm durumlar → DOLU
          return {
            time: timeStr,
            available: false,
            reason: 'Bu saat dolu'
          };
        }

        // 4c. 2 veya daha fazla çakışan randevu var → DOLU
        if (overlappingCount >= 2) {
          return {
            time: timeStr,
            available: false,
            reason: 'Bu saat dolu'
          };
        }

        // Fallback (teoride buraya gelmemeli)
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
  },

  /**
   * Get available time slots for editing an appointment (admin panel)
   * Excludes the current event being edited from occupancy check
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {string} currentEventId - Event ID being edited (to exclude from check)
   * @param {string} appointmentType - Appointment type for delivery limit check
   * @returns {{success: boolean, availableSlots?: Array<string>, dailyLimitReached?: boolean, occupiedSlots?: Array<string>, deliveryCount?: number, maxDaily?: number, error?: string}}
   */
  getAvailableSlotsForEdit: function(date, currentEventId, appointmentType) {
    try {
      // Parametreleri valide et
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return { success: false, error: CONFIG.ERROR_MESSAGES.INVALID_DATE_FORMAT };
      }

      const calendar = CalendarService.getCalendar();
      const data = StorageService.getData();
      const settings = data.settings || {};
      const interval = parseInt(settings.interval) || 60;

      // O günün başlangıç ve bitiş zamanları
      const dayStart = new Date(date + 'T00:00:00');
      const dayEnd = new Date(date + 'T23:59:59');

      // O gündeki tüm randevuları çek
      const dayEvents = calendar.getEvents(dayStart, dayEnd);

      // Dolu slotları bul (currentEventId hariç)
      const occupiedSlots = [];
      let deliveryCount = 0;

      dayEvents.forEach(event => {
        const eventId = event.getId();

        // Düzenlenmekte olan randevuyu hariç tut
        if (eventId === currentEventId) return;

        // Slot'u kaydet
        const startTime = event.getStartTime();
        const hours = String(startTime.getHours()).padStart(2, '0');
        const minutes = String(startTime.getMinutes()).padStart(2, '0');
        occupiedSlots.push(`${hours}:${minutes}`);

        // Teslim randevularını say
        const type = event.getTag('appointmentType');
        if (type === 'delivery' || type === CONFIG.APPOINTMENT_TYPES.DELIVERY) {
          deliveryCount++;
        }
      });

      // Teslim randevuları için günlük limit kontrolü
      let dailyLimitReached = false;
      if (appointmentType === 'delivery' || appointmentType === CONFIG.APPOINTMENT_TYPES.DELIVERY) {
        const maxDaily = parseInt(settings.maxDaily) || 4;
        if (deliveryCount >= maxDaily) {
          dailyLimitReached = true;
        }
      }

      // Tüm olası slotları oluştur (11:00 - 20:00 arası)
      const allSlots = [];
      const startHour = 11;
      const endHour = 20;

      for (let hour = startHour; hour <= endHour; hour++) {
        for (let minute = 0; minute < 60; minute += interval) {
          const timeStr = String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
          allSlots.push(timeStr);
        }
      }

      // Boş slotları filtrele
      const availableSlots = allSlots.filter(slot => !occupiedSlots.includes(slot));

      return {
        success: true,
        availableSlots: availableSlots,
        dailyLimitReached: dailyLimitReached,
        occupiedSlots: occupiedSlots,
        deliveryCount: deliveryCount,
        maxDaily: parseInt(settings.maxDaily) || 4
      };

    } catch (error) {
      log.error('getAvailableSlotsForEdit hatası:', error);
      return { success: false, error: error.toString() };
    }
  },

  /**
   * Get available staff for a specific time slot
   * Checks shift assignments and existing appointments
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {string} time - Time in HH:MM format
   * @returns {{success: boolean, availableStaff?: Array<{id: number, name: string, shift: string}>, error?: string}}
   */
  getAvailableStaffForSlot: function(date, time) {
    try {
      const data = StorageService.getData();
      const calendar = CalendarService.getCalendar();

      // Saat bilgisini parse et
      const [hourStr, minuteStr] = time.split(':');
      const targetHour = parseInt(hourStr);

      // O günün vardiya bilgilerini al
      const dayShifts = data.shifts[date] || {};

      // Tüm aktif personelleri al
      const activeStaff = data.staff.filter(s => s.active);

      // O saat için müsait personelleri filtrele
      const availableStaff = activeStaff.filter(staff => {
        const shift = dayShifts[staff.id];

        // Vardiya yoksa müsait değil
        if (!shift) return false;

        // Vardiya saatlerini kontrol et
        const shiftHours = CONFIG.SHIFT_HOURS[shift];
        if (!shiftHours) return false;

        const shiftStart = parseInt(shiftHours.start.split(':')[0]);
        const shiftEnd = parseInt(shiftHours.end.split(':')[0]);

        // Hedef saat vardiya içinde mi?
        if (targetHour < shiftStart || targetHour >= shiftEnd) {
          return false;
        }

        // O saatte başka randevusu var mı kontrol et
        const slotStart = new Date(date + `T${time}:00`);
        const slotEnd = new Date(slotStart.getTime() + (60 * 60 * 1000)); // +1 saat

        const staffEvents = calendar.getEvents(slotStart, slotEnd);
        const hasConflict = staffEvents.some(event => {
          const eventStaffId = parseInt(event.getTag('staffId'));
          return eventStaffId === staff.id;
        });

        return !hasConflict;
      });

      // Sonuç döndür
      return {
        success: true,
        availableStaff: availableStaff.map(staff => ({
          id: staff.id,
          name: staff.name,
          shift: dayShifts[staff.id]
        }))
      };

    } catch (error) {
      log.error('getAvailableStaffForSlot hatası:', error);
      return {
        success: false,
        error: error.toString()
      };
    }
  }
};

// ==================== VALIDATION SERVICE ====================
/**
 * Business rules validation service
 * Validates appointment reservations against all business rules
 * @namespace ValidationService
 */
const ValidationService = {
  /**
   * Validate appointment reservation against all business rules
   * CORE validation with race condition protection
   * @param {Object} payload - {date, hour, appointmentType, staffId, isVipLink}
   * @returns {{valid: boolean, error?: string, isDayMaxed?: boolean, suggestAlternatives?: boolean}}
   */
  validateReservation: function(payload) {
    const { date, hour, appointmentType, staffId, isVipLink } = payload;

    try {
      // YÖNETİM RANDEVUSU EXCEPTION: Yönetim randevuları için tüm kontrolleri bypass et
      if (appointmentType === CONFIG.APPOINTMENT_TYPES.MANAGEMENT || appointmentType === 'management') {
        return { valid: true };
      }

      // VIP LINK EXCEPTION: VIP linkler için slot kontrolünü bypass et (max 2 randevu)
      // Google Apps Script e.parameter'dan gelen değerler string olabilir ("true"/"false")
      const isVip = isVipLink === true || isVipLink === 'true';
      if (isVip) {
        return { valid: true };
      }

      // KURAL 1: Slot evreninde mi? (11-20 arası tam saat)
      if (!SLOT_UNIVERSE.includes(parseInt(hour))) {
        return {
          valid: false,
          error: `Geçersiz saat. Sadece ${SLOT_UNIVERSE[0]}:00-${SLOT_UNIVERSE[SLOT_UNIVERSE.length - 1]}:00 arası randevu alınabilir.`
        };
      }

      // KURAL 2: Slot boş mu? (saat başına 1 randevu)
      if (!SlotService.isSlotFree(date, hour)) {
        return {
          valid: false,
          error: 'Bu saat dolu. Lütfen başka bir saat seçin.',
          suggestAlternatives: true
        };
      }

      // KURAL 3: Teslim/Gönderi ise - Global limit kontrolü (max 3/gün, ikisi toplamda)
      const isDeliveryOrShipping = (
        appointmentType === CONFIG.APPOINTMENT_TYPES.DELIVERY || appointmentType === 'delivery' ||
        appointmentType === CONFIG.APPOINTMENT_TYPES.SHIPPING || appointmentType === 'shipping'
      );

      if (isDeliveryOrShipping) {
        const deliveryCount = AvailabilityService.getDeliveryCount(date);

        if (deliveryCount >= 3) {
          return {
            valid: false,
            error: 'Bu gün için teslim/gönderi randevu limiti doldu (max 3). Lütfen başka bir gün seçin.',
            isDayMaxed: true
          };
        }

        // KURAL 4: KALDIRILDI - Personel bazlı teslim limiti artık yok
        // Sadece global günlük limit (max 3) geçerli
      }

      // Tüm kontroller geçildi
      return { valid: true };

    } catch (error) {
      log.error('validateReservation error:', error);
      return {
        valid: false,
        error: CONFIG.ERROR_MESSAGES.SERVER_ERROR
      };
    }
  }
};

// ==================== NOTIFICATION SERVICE ====================
/**
 * Email notification and calendar file generation service
 * Handles customer and staff email templates, ICS calendar files
 * @namespace NotificationService
 */
const NotificationService = {
  /**
   * Get customer email HTML template
   * @param {Object} data - {customerName, formattedDate, time, serviceName, staffName, staffPhone, staffEmail, customerNote, appointmentType}
   * @returns {string} HTML email template
   */
  getCustomerEmailTemplate: function(data) {
    // Generic template builder kullan - DİNAMİK İÇERİK İÇİN appointmentType eklendi
    return this.generateEmailTemplate('customer', {
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
  },

  /**
   * Get staff email HTML template
   * @param {Object} data - {staffName, customerName, customerPhone, customerEmail, formattedDate, time, serviceName, customerNote}
   * @returns {string} HTML email template
   */
  getStaffEmailTemplate: function(data) {
    // Generic template builder kullan
    return this.generateEmailTemplate('staff', {
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
  },

  /**
   * Generate email HTML template (customer or staff)
   * @param {string} type - 'customer' or 'staff'
   * @param {Object} data - Template data
   * @returns {string} HTML email template
   */
  generateEmailTemplate: function(type, data) {
    const config = CONFIG.EMAIL_TEMPLATES[type.toUpperCase()];
    if (!config) throw new Error(`Geçersiz email template tipi: ${type}`);

    const { GREETING, SECTION_TITLE, LABELS, CLOSING } = config;

    // Tablo satırları - config'deki label'lara göre dinamik
    const tableRows = Object.entries(LABELS).map(([key, label]) => {
      const value = data[key] || CONFIG.EMAIL_TEMPLATES.COMMON.NOT_SPECIFIED;
      return `
      <tr>
        <td style="padding: 8px 12px 8px 0; font-weight: 400; width: 35%; vertical-align: top; color: #555;">${label}</td>
        <td style="padding: 8px 0; vertical-align: top; word-wrap: break-word; color: #333;">${value}</td>
      </tr>
    `;
    }).join('');

    // Customer email için yeni yapı
    if (type === 'customer') {
      // Randevu türüne göre dinamik içerik seç
      let typeSpecificInfo = '';
      const { appointmentType } = data;
      if (appointmentType === CONFIG.APPOINTMENT_TYPES.DELIVERY && CONFIG.EMAIL_TEMPLATES.DELIVERY) {
        typeSpecificInfo = CONFIG.EMAIL_TEMPLATES.DELIVERY.INFO;
      } else if (appointmentType === CONFIG.APPOINTMENT_TYPES.SERVICE && CONFIG.EMAIL_TEMPLATES.SERVICE) {
        typeSpecificInfo = CONFIG.EMAIL_TEMPLATES.SERVICE.INFO;
      } else if (CONFIG.EMAIL_TEMPLATES.MEETING) {
        typeSpecificInfo = CONFIG.EMAIL_TEMPLATES.MEETING.INFO;
      }

      return `
      <div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="margin: 30px 0; padding: 20px; background: #f9f9f9; border-left: 3px solid #C9A55A;">
          <h3 style="margin-top: 0; color: #1A1A2E; font-weight: 400; letter-spacing: 1px; font-size: 16px;">${SECTION_TITLE}</h3>
          <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
            ${tableRows}
          </table>
        </div>

        <p style="line-height: 1.8; font-weight: 400;">${GREETING} ${data.name},</p>

        <p style="line-height: 1.8; font-weight: 400;">${config.CONFIRMATION}</p>

        <p style="line-height: 1.8; font-weight: 400;">${typeSpecificInfo}</p>

        <p style="line-height: 1.8; font-weight: 400;">${config.CHANGE_CONTACT_INFO}</p>

        <p style="margin-top: 20px; line-height: 1.8; font-weight: 400;">
          <span style="font-weight: 400;">Tel:</span> ${data.staffPhone}<br>
          <span style="font-weight: 400;">E-posta:</span> ${data.staffEmail}
        </p>

        <p style="margin-top: 30px; font-weight: 400;">
          ${CLOSING},<br>
          <span style="font-weight: 400;">${CONFIG.COMPANY_NAME}</span>
        </p>
      </div>
    `;
    }
    // Staff email için eski yapı korundu
    else {
      const mainText = config.NOTIFICATION;
      const additionalContent = `<p style="font-weight: 400;">${config.PREPARATION}</p>`;

      return `
      <div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <p style="font-weight: 400;">${GREETING} ${data.name},</p>
        <p style="font-weight: 400;">${mainText}</p>

        <div style="margin: 30px 0; padding: 20px; background: #f9f9f9; border-left: 3px solid #C9A55A;">
          <h3 style="margin-top: 0; color: #1A1A2E; font-weight: 400; letter-spacing: 1px; font-size: 16px;">${SECTION_TITLE}</h3>
          <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
            ${tableRows}
          </table>
        </div>

        ${additionalContent}

        <p style="margin-top: 30px; font-weight: 400;">
          ${CLOSING},<br>
          <span style="font-weight: 400;">${CONFIG.COMPANY_NAME}</span>
        </p>
      </div>
    `;
    }
  }
};

// ==================== WHATSAPP SERVICE ====================
/**
 * WhatsApp Business API integration service
 * Handles WhatsApp message sending, reminders, and settings management
 */
const WhatsAppService = {
  /**
   * Get today's WhatsApp reminders
   * @param {string} date - Date in YYYY-MM-DD format (optional, defaults to today)
   * @returns {{success: boolean, data?: Array, error?: string}}
   */
  getTodayWhatsAppReminders: function(date) {
    try {
      const targetDate = date ? new Date(date + 'T00:00:00') : new Date();
      const calendar = CalendarService.getCalendar();
      const { startDate, endDate } = DateUtils.getDateRange(DateUtils.toLocalDate(targetDate).slice(0, 10));
      const events = calendar.getEvents(startDate, endDate);

      // Staff verilerini al
      const data = StorageService.getData();

      const reminders = events.map(event => {
        const phoneTag = event.getTag('customerPhone');
        if (!phoneTag) return null; // Telefonu yoksa atla

        const appointmentType = event.getTag('appointmentType') || 'Randevu';
        const staffId = event.getTag('staffId');

        // Event title formatı: "Müşteri Adı - Personel (Tür)"
        const title = event.getTitle();
        const parts = title.split(' - ');
        const customerName = Utils.toTitleCase(parts[0]) || 'Değerli Müşterimiz';

        // İlgili kişi ve randevu türü
        let staffName = 'Temsilcimiz';
        let appointmentTypeName = CONFIG.APPOINTMENT_TYPE_LABELS[appointmentType] || 'randevu';

        if (parts.length > 1) {
          // "Personel (Tür)" kısmını parse et
          const secondPart = parts[1];
          const match = secondPart.match(/^(.+?)\s*\((.+?)\)$/);
          if (match) {
            const parsedStaffName = match[1].trim();
            // HK ve OK kısaltmalarını koruyoruz, diğerlerini Title Case yapıyoruz
            staffName = (parsedStaffName === 'HK' || parsedStaffName === 'OK') ? parsedStaffName : Utils.toTitleCase(parsedStaffName);
            appointmentTypeName = match[2].trim().toLowerCase(); // "yönetim" veya "teslim" (KÜÇÜK HARF)
          } else {
            const parsedStaffName = secondPart.trim();
            staffName = (parsedStaffName === 'HK' || parsedStaffName === 'OK') ? parsedStaffName : Utils.toTitleCase(parsedStaffName);
          }
        }

        // Staff phone numarasını bul
        let staffPhone = '';
        if (staffId) {
          const staff = data.staff.find(s => s.id == staffId);
          if (staff && staff.phone) {
            // Telefon numarasını temizle ve formatla
            const cleanStaffPhone = staff.phone.replace(/\D/g, '');
            staffPhone = cleanStaffPhone.startsWith('0') ? '90' + cleanStaffPhone.substring(1) : cleanStaffPhone;
          }
        }

        // Tarih ve saat bilgilerini çıkar
        const eventDateTime = event.getStartTime();
        const dateStr = Utilities.formatDate(eventDateTime, CONFIG.TIMEZONE, 'yyyy-MM-dd');
        const timeStr = Utilities.formatDate(eventDateTime, CONFIG.TIMEZONE, 'HH:mm');

        // Yeni WhatsApp mesajı formatı (eski link için)
        const message = `Sayın ${customerName},\n\nBugün saat ${timeStr}'teki ${staffName} ile ${appointmentTypeName} randevunuzu hatırlatmak isteriz. Randevunuzda bir değişiklik yapmanız gerekirse lütfen bizi önceden bilgilendiriniz.\n\nSaygılarımızla,\n\nRolex İzmir İstinyepark`;
        const encodedMessage = encodeURIComponent(message);

        // Türkiye telefon formatı: 05XX XXX XX XX → 905XXXXXXXXX
        const cleanPhone = phoneTag.replace(/\D/g, ''); // Sadece rakamlar
        const phone = cleanPhone.startsWith('0') ? '90' + cleanPhone.substring(1) : cleanPhone;
        const link = `https://wa.me/${phone}?text=${encodedMessage}`;

        return {
          customerName,
          date: dateStr,           // YYYY-MM-DD formatı
          time: timeStr,           // HH:MM formatı
          startTime: timeStr,      // Eski uyumluluk için
          staffName,
          staffPhone,              // YENİ: Personel telefonu
          appointmentType: appointmentTypeName,
          link
        };
      }).filter(Boolean); // null'ları filtrele

      return { success: true, data: reminders };
    } catch (error) {
      log.error('getTodayWhatsAppReminders error:', error);
      return { success: false, error: 'Hatırlatmalar oluşturulurken bir hata oluştu.' };
    }
  },

  /**
   * Send WhatsApp message using Meta WhatsApp Cloud API
   * @param {string} phoneNumber - Phone number (will be cleaned)
   * @param {string} customerName - Customer name ({{1}})
   * @param {string} appointmentDateTime - Appointment date and time ({{2}})
   * @param {string} staffName - Staff name ({{3}})
   * @param {string} appointmentType - Appointment type ({{4}})
   * @param {string} staffPhone - Staff phone number (for button)
   * @returns {{success: boolean, messageId?: string, error?: string}}
   */
  sendWhatsAppMessage: function(phoneNumber, customerName, appointmentDateTime, staffName, appointmentType, staffPhone) {
    try {
      // Config kontrolü
      if (!CONFIG.WHATSAPP_PHONE_NUMBER_ID || !CONFIG.WHATSAPP_ACCESS_TOKEN) {
        throw new Error('WhatsApp API ayarları yapılmamış! WHATSAPP_PHONE_NUMBER_ID ve WHATSAPP_ACCESS_TOKEN gerekli.');
      }

      // Telefon numarasını temizle (sadece rakamlar)
      const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');

      // Meta WhatsApp Cloud API endpoint
      const url = `https://graph.facebook.com/${CONFIG.WHATSAPP_API_VERSION}/${CONFIG.WHATSAPP_PHONE_NUMBER_ID}/messages`;

      // Template adını türkçeleştir
      const typeMapping = {
        'delivery': 'Teslim',
        'shipping': 'Gönderi',
        'service': 'Teknik Servis',
        'meeting': 'Görüşme',
        'management': 'Yönetim'
      };
      const translatedType = typeMapping[appointmentType.toLowerCase()] || appointmentType;

      // WhatsApp template components
      const components = [
        {
          type: "body",
          parameters: [
            {
              type: "text",
              text: customerName  // {{1}}
            },
            {
              type: "text",
              text: appointmentDateTime  // {{2}}
            },
            {
              type: "text",
              text: staffName  // {{3}}
            },
            {
              type: "text",
              text: translatedType  // {{4}}
            }
          ]
        }
      ];

      // WhatsApp template payload
      const payload = {
        messaging_product: 'whatsapp',
        to: cleanPhone,
        type: 'template',
        template: {
          name: 'randevu_hatirlatma_v1',
          language: {
            code: 'tr'
          },
          components: components
        }
      };

      // Debug: Payload'u logla
      log.info('WhatsApp API Payload:', JSON.stringify(payload, null, 2));

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
  },

  /**
   * Send WhatsApp reminders for a specific date (admin action)
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {string} apiKey - Admin API key
   * @returns {{success: boolean, sent: number, failed: number, details: Array}}
   */
  sendWhatsAppReminders: function(date, apiKey) {
    try {
      // API key kontrolü
      if (!AuthService.validateApiKey(apiKey)) {
        throw new Error('Geçersiz API key');
      }

      // WhatsApp config yükle
      loadExternalConfigs();

      // Bugünkü randevuları al
      const reminders = this.getTodayWhatsAppReminders(date);

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
        const appointmentDateTime = DateUtils.formatAppointmentDateTime(reminder.date, reminder.time);

        // İlgili personel
        const staffName = reminder.staffName;

        // Görüşme türü (küçük harf)
        const appointmentType = reminder.appointmentType.toLowerCase();

        // Personel telefonu
        const staffPhone = reminder.staffPhone || '';

        // WhatsApp template mesajı gönder (4 parametreli + button)
        const result = this.sendWhatsAppMessage(
          phone,
          customerName,
          appointmentDateTime,
          staffName,
          appointmentType,
          staffPhone
        );

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
  },

  /**
   * Daily automatic WhatsApp reminders (trigger function)
   * Sends reminders for tomorrow's appointments
   * NOTE: Called automatically by time-driven trigger, no API key needed
   * @returns {{success: boolean, sent: number, failed: number, date: string}}
   */
  sendDailyWhatsAppReminders: function() {
    try {
      // WhatsApp config yükle
      loadExternalConfigs();

      // Config kontrolü
      if (!CONFIG.WHATSAPP_PHONE_NUMBER_ID || !CONFIG.WHATSAPP_ACCESS_TOKEN) {
        log.error('WhatsApp API ayarları yapılmamış! Otomatik mesajlar gönderilemez.');
        return {
          success: false,
          error: 'WhatsApp API ayarları yapılmamış'
        };
      }

      // Yarının tarihini hesapla (ertesi gün)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowDateStr = Utilities.formatDate(tomorrow, CONFIG.TIMEZONE, 'yyyy-MM-dd');

      log.info(`Otomatik WhatsApp hatırlatıcıları gönderiliyor: ${tomorrowDateStr}`);

      // Yarının randevularını al
      const reminders = this.getTodayWhatsAppReminders(tomorrowDateStr);

      if (!reminders.success || reminders.data.length === 0) {
        log.info(`${tomorrowDateStr} tarihinde randevu bulunamadı.`);
        return {
          success: true,
          sent: 0,
          failed: 0,
          message: 'Yarın için randevu yok'
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
        const appointmentDateTime = DateUtils.formatAppointmentDateTime(reminder.date, reminder.time);

        // İlgili personel
        const staffName = reminder.staffName;

        // Görüşme türü (küçük harf)
        const appointmentType = reminder.appointmentType.toLowerCase();

        // Personel telefonu
        const staffPhone = reminder.staffPhone || '';

        // WhatsApp template mesajı gönder (4 parametreli + button)
        const result = this.sendWhatsAppMessage(
          phone,
          customerName,
          appointmentDateTime,
          staffName,
          appointmentType,
          staffPhone
        );

        if (result.success) {
          sentCount++;
          results.push({
            customer: customerName,
            phone: phone,
            status: 'success',
            messageId: result.messageId
          });
          log.info(`✅ Mesaj gönderildi: ${customerName} (${phone})`);
        } else {
          failedCount++;
          results.push({
            customer: customerName,
            phone: phone,
            status: 'failed',
            error: result.error
          });
          log.error(`❌ Mesaj gönderilemedi: ${customerName} (${phone}) - ${result.error}`);
        }

        // Rate limiting - Meta: 80 mesaj/saniye, ama güvenli olmak için bekleyelim
        Utilities.sleep(100); // 100ms bekle
      }

      const summary = {
        success: true,
        sent: sentCount,
        failed: failedCount,
        total: reminders.data.length,
        date: tomorrowDateStr,
        details: results
      };

      log.info(`Otomatik gönderim tamamlandı: ${sentCount} başarılı, ${failedCount} başarısız`);

      // İsteğe bağlı: Sonuçları e-posta ile bildir (admin'e)
      if (failedCount > 0) {
        this.sendAdminNotification(summary);
      }

      return summary;

    } catch (error) {
      log.error('sendDailyWhatsAppReminders hatası:', error);
      return {
        success: false,
        error: error.toString()
      };
    }
  },

  /**
   * Send admin notification about automatic reminder results
   * (Optional - only sends if there are failures)
   * @param {Object} summary - Summary object from sendDailyWhatsAppReminders
   */
  sendAdminNotification: function(summary) {
    try {
      const subject = `WhatsApp Hatırlatıcıları - ${summary.failed} Başarısız`;

      let body = `Otomatik WhatsApp hatırlatıcıları gönderildi:\n\n`;
      body += `Tarih: ${summary.date}\n`;
      body += `Toplam: ${summary.total}\n`;
      body += `✅ Başarılı: ${summary.sent}\n`;
      body += `❌ Başarısız: ${summary.failed}\n\n`;

      if (summary.failed > 0) {
        body += `Başarısız Mesajlar:\n`;
        summary.details.filter(d => d.status === 'failed').forEach(detail => {
          body += `- ${detail.customer} (${detail.phone}): ${detail.error}\n`;
        });
      }

      MailApp.sendEmail({
        to: CONFIG.ADMIN_EMAIL,
        subject: subject,
        body: body
      });

      log.info('Admin bildirim e-postası gönderildi');
    } catch (error) {
      log.error('Admin bildirim hatası:', error);
    }
  },

  /**
   * Update WhatsApp API settings (admin only)
   * @param {Object} settings - {phoneNumberId, accessToken, businessAccountId}
   * @param {string} apiKey - Admin API key
   * @returns {{success: boolean, message?: string, error?: string}}
   */
  updateWhatsAppSettings: function(settings, apiKey) {
    try {
      // API key kontrolü
      if (!AuthService.validateApiKey(apiKey)) {
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
  },

  /**
   * Get WhatsApp API settings status (admin only)
   * Returns configuration status without exposing tokens
   * @param {string} apiKey - Admin API key
   * @returns {{success: boolean, configured: boolean, hasPhoneNumberId: boolean, hasAccessToken: boolean}}
   */
  getWhatsAppSettings: function(apiKey) {
    try {
      // API key kontrolü
      if (!AuthService.validateApiKey(apiKey)) {
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
  },

  /**
   * Test WhatsApp message sending (for debugging)
   * Sends a test message to a predefined phone number
   */
  testWhatsAppMessage: function() {
    console.log('===== WHATSAPP TEST BAŞLADI =====\n');

    // Test telefon numarası
    const TEST_PHONE = '+905382348625';

    console.log('Test telefonu:', TEST_PHONE);
    console.log('');

    // 1. WhatsApp API ayarlarını kontrol et
    console.log('1. WhatsApp API ayarları kontrol ediliyor...');

    const props = PropertiesService.getScriptProperties();
    const phoneNumberId = props.getProperty('WHATSAPP_PHONE_NUMBER_ID');
    const accessToken = props.getProperty('WHATSAPP_ACCESS_TOKEN');

    if (!phoneNumberId || !accessToken) {
      console.error('❌ HATA: WhatsApp API ayarları yapılmamış!');
      console.error('Admin panelden Phone Number ID ve Access Token ekleyin.');
      return;
    }

    console.log('✅ WhatsApp API ayarları bulundu');
    console.log('Phone Number ID:', phoneNumberId.substring(0, 5) + '...');
    console.log('Access Token:', accessToken.substring(0, 10) + '...');
    console.log('');

    // 2. Test randevusu verisi oluştur
    console.log('2. Test mesajı hazırlanıyor...');

    const testData = {
      customerName: 'Test Müşteri',
      appointmentDateTime: '15 Kasım 2025, 14:00',
      staffName: 'Gökhan Tokol',
      appointmentType: 'Teslim',
      staffPhone: '+905382348625'
    };

    console.log('Test verisi:', JSON.stringify(testData, null, 2));
    console.log('');

    // 3. WhatsApp mesajı gönder
    console.log('3. WhatsApp mesajı gönderiliyor...');

    try {
      const result = this.sendWhatsAppMessage(
        TEST_PHONE,
        testData.customerName,
        testData.appointmentDateTime,
        testData.staffName,
        testData.appointmentType,
        testData.staffPhone
      );

      if (result.success) {
        console.log('');
        console.log('✅ BAŞARILI! WhatsApp mesajı gönderildi!');
        console.log('Message ID:', result.messageId);
        console.log('');
        console.log('📱 Telefonunuzu kontrol edin:', TEST_PHONE);
        console.log('');
        console.log('✅ WhatsApp API çalışıyor!');
      } else {
        console.error('');
        console.error('❌ BAŞARISIZ! Mesaj gönderilemedi');
        console.error('Hata:', result.error);
        console.error('Hata Kodu:', result.errorCode);
        console.error('');
        console.error('TAM HATA DETAYI:');
        console.error(JSON.stringify(result.errorDetails, null, 2));
        console.error('');
        console.error('SORUN GİDERME:');
        console.error('1. Phone Number ID doğru mu?');
        console.error('2. Access Token geçerli mi? (permanent token)');
        console.error('3. Test numarası Meta\'da kayıtlı mı?');
        console.error('4. Ödeme yöntemi eklendi mi?');
        console.error('5. Template parametreleri doğru mu?');
      }

    } catch (error) {
      console.error('');
      console.error('❌ İSTİSNA HATASI!');
      console.error('Hata:', error.toString());
      console.error('Stack:', error.stack);
    }

    console.log('');
    console.log('===== TEST TAMAMLANDI =====');
  }
};

// ==================== SLACK SERVICE ====================
/**
 * Slack Webhook integration service
 * Handles Slack notifications and settings management
 */
const SlackService = {
  /**
   * Update Slack Webhook settings (admin only)
   * @param {string} webhookUrl - Slack Webhook URL
   * @param {string} apiKey - Admin API key
   * @returns {{success: boolean, message?: string, error?: string}}
   */
  updateSlackSettings: function(webhookUrl, apiKey) {
    try {
      // API key kontrolü
      if (!AuthService.validateApiKey(apiKey)) {
        throw new Error('Geçersiz API key');
      }

      // URL validasyonu
      if (!webhookUrl || !webhookUrl.startsWith('https://hooks.slack.com/')) {
        throw new Error('Geçerli bir Slack Webhook URL gerekli');
      }

      // Settings'i Script Properties'e kaydet
      const scriptProperties = PropertiesService.getScriptProperties();
      scriptProperties.setProperty('SLACK_WEBHOOK_URL', webhookUrl);

      // Config'i güncelle
      CONFIG.SLACK_WEBHOOK_URL = webhookUrl;

      return {
        success: true,
        message: 'Slack ayarları güncellendi'
      };

    } catch (error) {
      log.error('updateSlackSettings hatası:', error);
      return {
        success: false,
        error: error.toString()
      };
    }
  },

  /**
   * Get Slack Webhook settings status (admin only)
   * Returns configuration status without exposing webhook URL
   * @param {string} apiKey - Admin API key
   * @returns {{success: boolean, configured: boolean}}
   */
  getSlackSettings: function(apiKey) {
    try {
      // API key kontrolü
      if (!AuthService.validateApiKey(apiKey)) {
        throw new Error('Geçersiz API key');
      }

      const scriptProperties = PropertiesService.getScriptProperties();
      const webhookUrl = scriptProperties.getProperty('SLACK_WEBHOOK_URL');

      return {
        success: true,
        configured: !!webhookUrl
      };

    } catch (error) {
      log.error('getSlackSettings hatası:', error);
      return {
        success: false,
        error: error.toString()
      };
    }
  },

  /**
   * Daily automatic Slack reminders (trigger function)
   * Sends today's appointments to Slack
   * NOTE: Called automatically by time-driven trigger, no API key needed
   * @returns {{success: boolean, appointmentCount: number, date: string}}
   */
  sendDailySlackReminders: function() {
    try {
      // Bugünün tarihini hesapla
      const today = new Date();
      const todayDateStr = Utilities.formatDate(today, CONFIG.TIMEZONE, 'yyyy-MM-dd');
      const todayFormatted = Utilities.formatDate(today, CONFIG.TIMEZONE, 'd MMMM yyyy, EEEE');

      log.info(`Slack bildirimi gönderiliyor: ${todayDateStr}`);

      // Bugünün randevularını al
      const reminders = WhatsAppService.getTodayWhatsAppReminders(todayDateStr);

      if (!reminders.success) {
        log.error('Randevular alınamadı:', reminders.error);
        return { success: false, error: reminders.error };
      }

      const appointments = reminders.data || [];

      // Slack mesajını formatla
      const slackMessage = this.formatSlackMessage(appointments, todayFormatted);

      // Slack'e gönder
      const response = UrlFetchApp.fetch(CONFIG.SLACK_WEBHOOK_URL, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(slackMessage),
        muteHttpExceptions: true
      });

      const responseCode = response.getResponseCode();

      if (responseCode === 200) {
        log.info(`Slack bildirimi başarıyla gönderildi. Randevu sayısı: ${appointments.length}`);
        return {
          success: true,
          appointmentCount: appointments.length,
          date: todayDateStr
        };
      } else {
        log.error('Slack webhook hatası:', response.getContentText());
        return {
          success: false,
          error: `Slack webhook hatası: ${responseCode}`
        };
      }

    } catch (error) {
      log.error('sendDailySlackReminders hatası:', error);
      return {
        success: false,
        error: error.toString()
      };
    }
  },

  /**
   * Format Slack message using Slack Block Kit
   * Modern, readable format similar to the website design
   * @param {Array} appointments - Array of appointment objects
   * @param {string} dateFormatted - Formatted date string
   * @returns {{blocks: Array}} Slack Block Kit message
   */
  formatSlackMessage: function(appointments, dateFormatted) {
    const appointmentTypeEmojis = {
      'delivery': '📦',
      'service': '🔧',
      'meeting': '💼',
      'management': '👔'
    };

    const appointmentTypeNames = {
      'delivery': 'Teslim',
      'service': 'Teknik Servis',
      'meeting': 'Görüşme',
      'management': 'Yönetim'
    };

    // Header - Daha modern
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📅 BUGÜNÜN RANDEVULARI',
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${dateFormatted}*\n_${CONFIG.COMPANY_NAME}_`
        }
      },
      {
        type: 'divider'
      }
    ];

    // Randevular yoksa
    if (appointments.length === 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ':sparkles: *Bugün randevu yok!*'
        }
      });
    } else {
      // Her randevu için - fields kullanarak daha organize
      appointments.forEach((apt, index) => {
        const emoji = appointmentTypeEmojis[apt.appointmentType] || '📋';
        const typeName = appointmentTypeNames[apt.appointmentType] || apt.appointmentType;

        // Randevu kartı
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${emoji} ${typeName}*\n🕐 *${apt.time}*`
          },
          fields: [
            {
              type: 'mrkdwn',
              text: `*Müşteri:*\n${apt.customerName}`
            },
            {
              type: 'mrkdwn',
              text: `*Telefon:*\n${apt.customerPhone}`
            },
            {
              type: 'mrkdwn',
              text: `*İlgili Personel:*\n${apt.staffName}`
            },
            {
              type: 'mrkdwn',
              text: apt.customerNote ? `*Not:*\n_${apt.customerNote}_` : '*Not:*\n-'
            }
          ]
        });

        // Son randevudan sonra divider ekleme
        if (index < appointments.length - 1) {
          blocks.push({
            type: 'divider'
          });
        }
      });

      // Footer - Daha belirgin
      blocks.push(
        {
          type: 'divider'
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `📊 *Toplam: ${appointments.length} randevu*`
          }
        }
      );
    }

    return { blocks };
  },

  /**
   * Test Slack integration (for debugging)
   * Step-by-step test of Slack webhook configuration
   */
  testSlackIntegration: function() {
    console.log('===== SLACK ENTEGRASYON TESTİ BAŞLADI =====');

    // 1. Script Properties'den Webhook URL'i kontrol et
    console.log('\n1. Webhook URL kontrolü...');
    const scriptProperties = PropertiesService.getScriptProperties();
    const webhookUrl = scriptProperties.getProperty('SLACK_WEBHOOK_URL');

    if (!webhookUrl) {
      console.error('❌ HATA: SLACK_WEBHOOK_URL Script Properties\'de bulunamadı!');
      console.log('ÇÖZÜM: Admin panelden Slack Webhook URL\'ini kaydedin.');
      return;
    }

    console.log('✅ Webhook URL bulundu:', webhookUrl.substring(0, 50) + '...');

    // 2. Config'i yükle ve kontrol et
    console.log('\n2. Config yükleme...');
    loadExternalConfigs();

    if (!CONFIG.SLACK_WEBHOOK_URL) {
      console.error('❌ HATA: CONFIG.SLACK_WEBHOOK_URL yüklenemedi!');
      return;
    }

    console.log('✅ Config yüklendi');

    // 3. Bugünün randevularını kontrol et
    console.log('\n3. Bugünün randevuları kontrol ediliyor...');
    const today = new Date();
    const todayDateStr = Utilities.formatDate(today, CONFIG.TIMEZONE, 'yyyy-MM-dd');
    console.log('Tarih:', todayDateStr);

    const reminders = WhatsAppService.getTodayWhatsAppReminders(todayDateStr);

    if (!reminders.success) {
      console.error('❌ HATA: Randevular alınamadı:', reminders.error);
      return;
    }

    const appointments = reminders.data || [];
    console.log('✅ Randevu sayısı:', appointments.length);

    if (appointments.length > 0) {
      console.log('İlk randevu:', appointments[0]);
    } else {
      console.log('⚠️ UYARI: Bugün için randevu yok!');
    }

    // 4. Slack mesajını hazırla
    console.log('\n4. Slack mesajı hazırlanıyor...');
    const todayFormatted = Utilities.formatDate(today, CONFIG.TIMEZONE, 'd MMMM yyyy, EEEE');
    const slackMessage = this.formatSlackMessage(appointments, todayFormatted);
    console.log('✅ Mesaj hazırlandı');
    console.log('Block sayısı:', slackMessage.blocks.length);

    // 5. Slack'e gönder
    console.log('\n5. Slack\'e gönderiliyor...');

    try {
      const response = UrlFetchApp.fetch(CONFIG.SLACK_WEBHOOK_URL, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(slackMessage),
        muteHttpExceptions: true
      });

      const responseCode = response.getResponseCode();
      const responseText = response.getContentText();

      console.log('HTTP Response Code:', responseCode);
      console.log('Response Text:', responseText);

      if (responseCode === 200) {
        console.log('\n✅ BAŞARILI! Slack\'e mesaj gönderildi!');
        console.log('Slack kanalınızı kontrol edin.');
      } else {
        console.error('\n❌ HATA: Slack webhook hatası!');
        console.error('Response Code:', responseCode);
        console.error('Response:', responseText);
      }

    } catch (error) {
      console.error('\n❌ HATA: İstek gönderilemedi!');
      console.error('Hata:', error.toString());
      console.error('Stack:', error.stack);
    }

    console.log('\n===== TEST TAMAMLANDI =====');
  }
};

// Appointment helper functions moved to AppointmentService namespace (line 2066)

/**
 * Admin panel randevu düzenleme için o günün mevcut slotlarını döndür
 * @param {string} date - Tarih (YYYY-MM-DD)
 * @param {string} currentEventId - Düzenlenmekte olan randevunun ID'si (hariç tutulacak)
 * @param {string} appointmentType - Randevu tipi ('delivery', 'meeting', 'management')
 * @returns {object} - { success, availableSlots: ['09:00', '10:00', ...], dailyLimitReached: boolean }
 */
// getAvailableSlotsForEdit - AvailabilityService namespace'ine taşındı (line 2476)
 

// Randevuya personel ata (VIP linkler için)
function assignStaffToAppointment(eventId, staffId) {
  try {
    const calendar = CalendarService.getCalendar();
    const event = calendar.getEventById(eventId);

    if (!event) {
      return { success: false, error: CONFIG.ERROR_MESSAGES.APPOINTMENT_NOT_FOUND };
    }

    // Staff bilgilerini al
    const data = StorageService.getData();
    const staff = data.staff.find(s => s.id === parseInt(staffId));

    if (!staff) {
      return { success: false, error: 'Personel bulunamadı' };
    }

    // Event tag'ini güncelle
    event.setTag('staffId', String(staffId));

    // Event title'ı güncelle (staff ismini ekle)
    const currentTitle = event.getTitle();
    // "Müşteri İsmi - Atanmadı (Randevu Türü) (HK)" formatından "Müşteri İsmi - Staff İsmi (Randevu Türü) (HK)" formatına çevir
    const newTitle = currentTitle.replace(/- Atanmadı/, `- ${staff.name}`);
    event.setTitle(newTitle);

    // Description'ı güncelle (staff bilgilerini ekle)
    const currentDesc = event.getDescription();
    const staffInfo = `\n\n--- İLGİLİ PERSONEL ---\nİsim: ${staff.name}\nTelefon: ${staff.phone}\nE-posta: ${staff.email}`;

    // Eğer "--- İLGİLİ PERSONEL ---" zaten varsa değiştir, yoksa ekle
    let newDesc;
    if (currentDesc.includes('--- İLGİLİ PERSONEL ---')) {
      // Mevcut staff bilgisini değiştir
      newDesc = currentDesc.replace(/\n\n--- İLGİLİ PERSONEL ---[\s\S]*?(?=\n\n---|$)/, staffInfo);
    } else {
      // Yeni staff bilgisi ekle
      newDesc = currentDesc + staffInfo;
    }
    event.setDescription(newDesc);

    log.info('Personel atandı:', eventId, staffId, staff.name);
    return {
      success: true,
      message: `${staff.name} başarıyla atandı`,
      staffName: staff.name
    };

  } catch (error) {
    log.error('assignStaffToAppointment hatası:', error);
    return { success: false, error: error.toString() };
  }
}

// getMonthAppointments - AppointmentService namespace'ine taşındı (line 2290)

// Google Calendar'dan mevcut etkinlikleri getir
function getGoogleCalendarEvents(startDateStr, endDateStr, staffId) {
  try {
    const calendar = CalendarService.getCalendar();
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
      const eventAppointmentType = event.getTag('appointmentType');

      // ÖNEMLİ: TESLİM randevuları için staffId filtresini ATLAMA
      // Çünkü aynı saatte başka personelde teslim olup olmadığını kontrol etmemiz gerekiyor
      const isDelivery = eventAppointmentType === CONFIG.APPOINTMENT_TYPES.DELIVERY;

      if (!isDelivery && staffId !== 'all' && eventStaffId && eventStaffId !== staffId) {
        return; // Bu staff'a ait değil VE teslim değil, atla
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

// ==================== RANDEVU OLUŞTURMA ====================
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
      duration,
      turnstileToken,
      managementLevel,
      isVipLink,
      kvkkConsent  // KVKK onayı
    } = params;

    // ===== SECURITY CHECKS =====
    // 1. Cloudflare Turnstile bot kontrolü
    const turnstileResult = SecurityService.verifyTurnstileToken(turnstileToken);
    if (!turnstileResult.success) {
      log.warn('Turnstile doğrulama başarısız:', turnstileResult.error);
      return {
        success: false,
        error: turnstileResult.error || 'Robot kontrolü başarısız oldu. Lütfen sayfayı yenileyin.'
      };
    }

    // 2. Rate limiting - Hash bazlı (KVKK uyumu - PII log'larda görünmez)
    const identifier = SecurityService.hashIdentifier(customerPhone, customerEmail);
    const rateLimit = SecurityService.checkRateLimit(identifier);

    if (!rateLimit.allowed) {
      const waitMinutes = Math.ceil((rateLimit.resetTime - Date.now()) / 60000);
      log.warn('Rate limit aşıldı:', identifier, rateLimit);
      return {
        success: false,
        error: `Çok fazla istek gönderdiniz. Lütfen ${waitMinutes} dakika sonra tekrar deneyin.`
      };
    }

    log.info('Rate limit OK - Kalan istek:', rateLimit.remaining);

    // ===== VALIDATION =====
    // KVKK consent validation
    if (!kvkkConsent) {
      log.warn('KVKK onayı verilmedi');
      return {
        success: false,
        error: 'KVKK aydınlatma metnini onaylamanız gerekmektedir.'
      };
    }

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
    if (customerEmail && !Utils.isValidEmail(customerEmail)) {
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
    const sanitizedCustomerName = Utils.toTitleCase(Utils.sanitizeString(customerName, VALIDATION.STRING_MAX_LENGTH));
    const sanitizedCustomerPhone = Utils.sanitizePhone(customerPhone);
    const sanitizedCustomerEmail = customerEmail ? Utils.sanitizeString(customerEmail, VALIDATION.STRING_MAX_LENGTH) : '';
    const sanitizedCustomerNote = customerNote ? Utils.sanitizeString(customerNote, VALIDATION.NOTE_MAX_LENGTH) : '';
    const sanitizedStaffName = staffName ? Utils.toTitleCase(Utils.sanitizeString(staffName, VALIDATION.STRING_MAX_LENGTH)) : '';

    // StorageService.getData() - tek seferlik çağrı (DRY prensibi)
    const data = StorageService.getData();

    // ⭐⭐⭐⭐⭐ CRITICAL: Master Validation (Race Condition Protection)
    // Tüm business rules'ları bir arada kontrol et
    const hour = parseInt(time.split(':')[0]);
    const validation = ValidationService.validateReservation({
      date,
      hour,
      appointmentType,
      staffId,
      isVipLink
    });

    if (!validation.valid) {
      log.warn('Reservation validation failed:', validation.error);
      return {
        success: false,
        error: validation.error,
        suggestAlternatives: validation.suggestAlternatives,
        isDayMaxed: validation.isDayMaxed
      };
    }

    log.info('Validation passed - creating appointment');

    // ===== RACE CONDITION PROTECTION =====
    // withLock() ile critical section'ı koru (Calendar check + create atomik olmalı)
    // Bu sayede aynı anda 2 kişi aynı saate randevu alamaz
    let event;
    try {
      event = LockServiceWrapper.withLock(() => {
        log.info('Lock acquired - starting critical section (Calendar check + create)');

        // ===== LEGACY RANDEVU ÇAKIŞMA KONTROLÜ (EPOCH-MINUTE STANDARD) =====
        // Not: validateReservation zaten kontrol ediyor ama backward compatibility için tutuldu
        // KURAL: 1 SAATE 1 RANDEVU (tür/link farketmeksizin)
        // TEK İSTİSNA: Yönetim randevusu → o saate 2 randevu olabilir
        // STANDART: [start, end) interval (start dahil, end hariç)

        const calendar = CalendarService.getCalendar();

    // Yeni randevunun epoch-minute aralığı
    const newStart = DateUtils.dateTimeToEpochMinute(date, time);
    const newEnd = newStart + durationNum; // duration dakika cinsinden

    // O günün tüm randevularını al (kesin çakışma kontrolü için)
    const { startDate, endDate } = DateUtils.getDateRange(date);
    const allEventsToday = calendar.getEvents(startDate, endDate);

    // Çakışan randevuları filtrele (epoch-minute ile)
    const overlappingEvents = allEventsToday.filter(event => {
      const eventStart = DateUtils.dateToEpochMinute(event.getStartTime());
      const eventEnd = DateUtils.dateToEpochMinute(event.getEndTime());

      // checkTimeOverlap: [start, end) standardı ile çakışma kontrolü
      return DateUtils.checkTimeOverlap(newStart, newEnd, eventStart, eventEnd);
    });

    const overlappingCount = overlappingEvents.length;

    // YÖNETİM RANDEVUSU EXCEPTION: Yönetim randevuları her zaman çakışabilir
    if (appointmentType === CONFIG.APPOINTMENT_TYPES.MANAGEMENT) {
      // OK, yönetim randevusu için çakışma kontrolünü bypass et
      log.info('Yönetim randevusu - çakışma kontrolü bypass edildi');
    }
    // 1a. Çakışan randevu yok → Devam et
    else if (overlappingCount === 0) {
      // OK, devam et
    }
    // 1b. 1 çakışan randevu var
    else if (overlappingCount === 1) {
      // Mevcut randevu bilgilerini al
      const existingType = overlappingEvents[0].getTag('appointmentType');
      const existingIsVipTag = overlappingEvents[0].getTag('isVipLink');
      const existingTitle = overlappingEvents[0].getTitle();

      // VIP link kontrolü (yeni tag veya eski başlık kontrolü)
      const existingIsVip = existingIsVipTag === 'true' ||
                           existingTitle.includes('(HK)') ||
                           existingTitle.includes('(OK)') ||
                           existingTitle.includes('(HMK)');

      // Yeni randevu VIP mi? (string/boolean karşılaştırması)
      const newIsVip = isVipLink === true || isVipLink === 'true';

      // VIP LINK → HER ZAMAN 2. RANDEVU EKLENEBİLİR (mevcut randevu ne olursa olsun)
      if (newIsVip) {
        // OK, devam et
      }
      // Yönetim randevusu üzerine → OK
      else if (existingType === CONFIG.APPOINTMENT_TYPES.MANAGEMENT) {
        // OK, yönetim randevusu üzerine normal randevu eklenebilir
      }
      // Diğer durumlar → BLOKE
      else {
        // Normal randevu üzerine normal randevu eklenemez → BLOKE
        return {
          success: false,
          error: 'Bu saat dolu. Lütfen başka bir saat seçin.'
        };
      }
    }
    // 1c. 2 veya daha fazla çakışan randevu var → BLOKE
    else if (overlappingCount >= 2) {
      return {
        success: false,
        error: 'Bu saat dolu. Lütfen başka bir saat seçin.'
      };
    }

    // Event oluşturma için Date objelerine ihtiyacımız var
    const startDateTime = new Date(date + 'T' + time + ':00');
    const endDateTime = new Date(startDateTime.getTime() + (durationNum * 60 * 1000));

    // 2. Randevu tipi kontrolü - Teslim randevusu için günlük max kontrolü
    if (appointmentType === CONFIG.APPOINTMENT_TYPES.DELIVERY) {
      const maxDelivery = data.settings?.maxDaily || 3;

      // Partial response: Sadece delivery randevularının sayısını al (performans optimizasyonu)
      const countResult = AppointmentService.getAppointments(date, {
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

    // Event başlığı - sanitized değerleri kullan
    const appointmentTypeLabel = CONFIG.APPOINTMENT_TYPE_LABELS[appointmentType] || appointmentType;

    // Yönetim linki bilgisini ekle (HK, OK, HMK)
    let managementSuffix = '';
    if (managementLevel === 1) {
      managementSuffix = ' (HK)';
    } else if (managementLevel === 2) {
      managementSuffix = ' (OK)';
    } else if (managementLevel === 3) {
      managementSuffix = ' (HMK)';
    }

    const title = `${sanitizedCustomerName} - ${sanitizedStaffName} (${appointmentTypeLabel})${managementSuffix}`;

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
        event.setTag('customerNote', sanitizedCustomerNote || '');
        event.setTag('shiftType', shiftType);
        event.setTag('appointmentType', appointmentType);
        event.setTag('isVipLink', isVipLink ? 'true' : 'false');

        log.info('Calendar event created successfully - releasing lock');
        return event; // Event'i return et, lock serbest bırakılacak
      }); // withLock() sonu
    } catch (lockError) {
      log.error('Lock acquisition failed:', lockError.message);
      return {
        success: false,
        error: 'Randevu oluşturma sırasında bir hata oluştu. Lütfen tekrar deneyin.'
      };
    }

    // Lock işlemi tamamlandı - Event veya error object döndü
    // Eğer çakışma tespit edildiyse, error object return edilmiştir
    if (event && event.success === false) {
      log.info('Calendar conflict detected during lock - returning error');
      return event; // Error object'i hemen return et, email gönderme
    }

    // Lock serbest bırakıldı - Email gönderme ve diğer işlemler lock dışında devam edebilir

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
          htmlBody: NotificationService.getCustomerEmailTemplate({
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
      const staffEmailBody = NotificationService.getStaffEmailTemplate({
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

    // ⭐ Cache invalidation: Version increment
    VersionService.incrementDataVersion();

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
// getTodayWhatsAppReminders - WhatsAppService namespace'ine taşındı (line 2873)
/* eslint-disable no-undef */

// ==================== RANDEVU SİSTEMİ ====================
// YENİ: Admin panelinden randevu oluşturma
/**
 * Randevu oluşturur (admin paneli için)
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

    const data = StorageService.getData();
    const staff = data.staff.find(s => s.id == staffId);
    if (!staff) return { success: false, error: CONFIG.ERROR_MESSAGES.STAFF_NOT_FOUND };

    const isManagement = appointmentType === CONFIG.APPOINTMENT_TYPES.MANAGEMENT;

    // Sanitization (customer + staff)
    const sanitizedCustomerName = Utils.toTitleCase(Utils.sanitizeString(customerName, VALIDATION.STRING_MAX_LENGTH));
    const sanitizedCustomerPhone = Utils.sanitizePhone(customerPhone);
    const sanitizedCustomerEmail = customerEmail ? Utils.sanitizeString(customerEmail, VALIDATION.STRING_MAX_LENGTH) : '';
    const sanitizedCustomerNote = customerNote ? Utils.sanitizeString(customerNote, VALIDATION.NOTE_MAX_LENGTH) : '';
    const sanitizedStaffName = Utils.toTitleCase(Utils.sanitizeString(staff.name, VALIDATION.STRING_MAX_LENGTH));

    // Başlangıç ve bitiş zamanları
    const durationNum = parseInt(duration) || 60;
    const startDateTime = new Date(`${date}T${time}:00`);
    const endDateTime = new Date(startDateTime.getTime() + (durationNum * 60 * 1000));

    // Event başlığı - sanitized değerleri kullan
    const appointmentTypeLabel = CONFIG.APPOINTMENT_TYPE_LABELS[appointmentType] || appointmentType;

    // Yönetim linki bilgisini ekle (HK, OK, HMK)
    let managementSuffix = '';
    if (managementLevel === 1) {
      managementSuffix = ' (HK)';
    } else if (managementLevel === 2) {
      managementSuffix = ' (OK)';
    } else if (managementLevel === 3) {
      managementSuffix = ' (HMK)';
    }

    const title = `${sanitizedCustomerName} - ${sanitizedStaffName} (${appointmentTypeLabel})${managementSuffix}`;

    // Event açıklaması
    const description = `Müşteri: ${sanitizedCustomerName}\nTelefon: ${sanitizedCustomerPhone}\nE-posta: ${sanitizedCustomerEmail}\nNot: ${sanitizedCustomerNote}`;

    // ===== RACE CONDITION PROTECTION =====
    // Manuel randevu oluşturma için lock (Calendar write atomik olmalı)
    let event;
    try {
      event = LockServiceWrapper.withLock(() => {
        log.info('Lock acquired - creating manual appointment');

        const calendar = CalendarService.getCalendar();
        const event = calendar.createEvent(title, startDateTime, endDateTime, { description });

        // Tag'leri ekle
        event.setTag('staffId', String(staffId));
        event.setTag('appointmentType', appointmentType);
        event.setTag('customerPhone', sanitizedCustomerPhone);
        event.setTag('customerEmail', sanitizedCustomerEmail);

        log.info('Manual appointment created successfully - releasing lock');
        return event;
      });
    } catch (lockError) {
      log.error('Lock acquisition failed for manual appointment:', lockError.message);
      return {
        success: false,
        error: 'Randevu oluşturma sırasında bir hata oluştu. Lütfen tekrar deneyin.'
      };
    }

    // YÖNETİM randevusu değilse ve e-posta varsa, müşteriye e-posta gönder
    if (!isManagement && sanitizedCustomerEmail && Utils.isValidEmail(sanitizedCustomerEmail)) {
      try {
        const formattedDate = DateUtils.toTurkishDate(date);
        const serviceName = CONFIG.SERVICE_NAMES[appointmentType] || appointmentType;

        // ICS oluştur - sanitized staff name kullan
        const icsContent = generateCustomerICS({
          staffName: sanitizedStaffName,
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
          htmlBody: NotificationService.getCustomerEmailTemplate({
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

    // ⭐ Cache invalidation: Version increment
    VersionService.incrementDataVersion();

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
// checkTimeSlotAvailability - AvailabilityService namespace'ine taşındı (line 2288)
 

// ==================== WHATSAPP BUSINESS CLOUD API ====================

/**
 * WhatsApp Business Cloud API ile TEMPLATE mesaj gönder (4 parametreli + button)
 * @param {string} phoneNumber - Alıcı telefon numarası (90XXXXXXXXXX formatında)
 * @param {string} customerName - Müşteri adı ({{1}} parametresi)
 * @param {string} appointmentDateTime - Randevu tarih ve saat ({{2}} parametresi, örn: "21 Ekim 2025, 14:30")
 * @param {string} staffName - İlgili personel ({{3}} parametresi)
 * @param {string} appointmentType - Görüşme türü ({{4}} parametresi, küçük harf: "teslim", "görüşme")
 * @param {string} staffPhone - Personel telefon numarası (button için, 90XXXXXXXXXX formatında)
 * @returns {Object} - {success: boolean, messageId?: string, error?: string}
 */
// sendWhatsAppMessage - WhatsAppService namespace'ine taşındı (line 2968)
 

/**
 * Tarih ve saati Türkçe formata çevir (21 Ekim 2025, 14:30)
 * @param {string} dateStr - YYYY-MM-DD formatında tarih
 * @param {string} timeStr - HH:MM formatında saat
 * @returns {string} - Türkçe formatlanmış tarih ve saat
 * MOVED TO: DateUtils.formatAppointmentDateTime (line 845)
 */

/**
 * Bugünkü randevular için WhatsApp hatırlatmaları gönder
 * @param {string} date - Tarih (YYYY-MM-DD formatında)
 * @param {string} apiKey - Admin API key
 * @returns {Object} - {success: boolean, sent: number, failed: number, details: []}
 */
// sendWhatsAppReminders - WhatsAppService namespace'ine taşındı (line 3080)
/* eslint-disable no-undef */

/**
 * GÜNLÜK OTOMATİK WHATSAPP HATIRLAT İCİLERİ
 * Her gün sabah 10:00'da çalışır (Time-driven trigger ile)
 * Ertesi günün randevuları için WhatsApp mesajı gönderir
 *
 * NOT: Bu fonksiyon trigger tarafından otomatik çağrılır, API key gerekmez
 *
 * Kurulum:
 * 1. Apps Script editörde: Triggers (⏰) → Add Trigger
 * 2. Function: sendDailyWhatsAppReminders
 * 3. Event source: Time-driven
 * 4. Type: Day timer
 * 5. Time: 10am to 11am
 * 6. Save
 */
// sendDailyWhatsAppReminders - WhatsAppService namespace'ine taşındı (line 3182)
/* eslint-disable no-undef */

/**
 * Admin'e otomatik gönderim sonuçlarını e-posta ile bildir
 * (Opsiyonel - sadece hata varsa gönderir)
 */
// sendAdminNotification - WhatsAppService namespace'ine taşındı (line 3307)
 

/**
 * WhatsApp API ayarlarını güncelle (sadece admin)
 * @param {Object} settings - {phoneNumberId, accessToken, businessAccountId}
 * @param {string} apiKey - Admin API key
 * @returns {Object} - {success: boolean}
 */
// updateWhatsAppSettings - WhatsAppService namespace'ine taşındı (line 3342)
 

/**
 * WhatsApp API ayarlarını getir (sadece durum, token gösterme)
 * @param {string} apiKey - Admin API key
 * @returns {Object} - {success: boolean, configured: boolean}
 */
// getWhatsAppSettings - WhatsAppService namespace'ine taşındı (line 3382)
 

/**
 * Slack Webhook ayarlarını güncelle (sadece admin)
 * @param {string} webhookUrl - Slack Webhook URL
 * @param {string} apiKey - Admin API key
 * @returns {Object} - {success: boolean}
 */
// updateSlackSettings - SlackService namespace'ine taşındı (line 3518)
 

/**
 * Slack Webhook ayarlarını getir (sadece durum, URL gösterme)
 * @param {string} apiKey - Admin API key
 * @returns {Object} - {success: boolean, configured: boolean}
 */
// getSlackSettings - SlackService namespace'ine taşındı (line 3557)


// ==================== DATA RETENTION SERVICE (KVKK) ====================
/**
 * KVKK Madde 7 uyumu için veri saklama ve temizleme servisi
 * Eski randevuları otomatik olarak anonimleştirir veya siler
 * @namespace DataRetentionService
 */
const DataRetentionService = {
  // 1 ay (30 gün) saklama süresi
  RETENTION_DAYS: 30,

  /**
   * Eski randevuları temizle (anonimleştir)
   * Haftalık trigger ile otomatik çalıştırılır
   * @returns {{success: boolean, anonymizedCount: number, error?: string}}
   */
  cleanupOldAppointments: function() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.RETENTION_DAYS);

      const calendar = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
      if (!calendar) {
        log.error('DataRetention: Takvim bulunamadı');
        return { success: false, error: 'Takvim bulunamadı' };
      }

      // 2020'den cutoff tarihine kadar olan etkinlikleri al
      const startDate = new Date(2020, 0, 1);
      const oldEvents = calendar.getEvents(startDate, cutoffDate);

      let anonymizedCount = 0;

      oldEvents.forEach(function(event) {
        const title = event.getTitle();
        // Randevu event'lerini tanımla (zaten anonimleştirilmişleri atla)
        if ((title.includes('Teslim') || title.includes('Servis') ||
             title.includes('Görüşme') || title.includes('Gönderi') ||
             title.includes('Yönetim')) && !title.includes('[Arşiv]')) {

          // Anonimleştir (tamamen silmek yerine istatistik için sakla)
          event.setTitle('[Arşiv] Randevu - ' + event.getStartTime().toISOString().split('T')[0]);
          event.setDescription('Müşteri bilgileri KVKK gereği silindi. Tarih: ' + new Date().toISOString());

          anonymizedCount++;
        }
      });

      log.info('DataRetention: ' + anonymizedCount + ' randevu anonimleştirildi');

      return {
        success: true,
        anonymizedCount: anonymizedCount,
        cutoffDate: cutoffDate.toISOString()
      };

    } catch (error) {
      log.error('DataRetention hatası:', error);
      return { success: false, error: error.toString() };
    }
  },

  /**
   * Saklama politikası bilgisini döndür
   * @returns {{retentionDays: number, description: string}}
   */
  getRetentionPolicy: function() {
    return {
      retentionDays: this.RETENTION_DAYS,
      description: 'Kişisel veriler ' + this.RETENTION_DAYS + ' gün sonra anonimleştirilir (KVKK Madde 7)'
    };
  }
};

/**
 * Haftalık veri temizleme trigger fonksiyonu
 * Apps Script Triggers ile çalıştırılır:
 * 1. Apps Script editörde: Triggers (⏰) → Add Trigger
 * 2. Function: runDataRetention
 * 3. Event source: Time-driven
 * 4. Type: Week timer
 * 5. Day: Sunday, Time: 03:00-04:00
 */
function runDataRetention() {
  log.info('DataRetention: Haftalık temizlik başlıyor...');
  const result = DataRetentionService.cleanupOldAppointments();
  log.info('DataRetention: Sonuç:', result);
  return result;
}

/**
 * Manuel test için - DataRetention'ı test et (DRY RUN)
 * Gerçekte silmez, sadece kaç kayıt etkileneceğini gösterir
 */
function testDataRetention() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - DataRetentionService.RETENTION_DAYS);

  const calendar = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
  if (!calendar) {
    console.log('Takvim bulunamadı');
    return;
  }

  const startDate = new Date(2020, 0, 1);
  const oldEvents = calendar.getEvents(startDate, cutoffDate);

  let count = 0;
  oldEvents.forEach(function(event) {
    const title = event.getTitle();
    if ((title.includes('Teslim') || title.includes('Servis') ||
         title.includes('Görüşme') || title.includes('Gönderi') ||
         title.includes('Yönetim')) && !title.includes('[Arşiv]')) {
      count++;
      console.log('Anonimleştirilecek: ' + title + ' - ' + event.getStartTime());
    }
  });

  console.log('Toplam anonimleştirilecek: ' + count + ' randevu');
  console.log('Cutoff tarihi: ' + cutoffDate);
  return { wouldAnonymize: count, cutoffDate: cutoffDate };
}

// ==================== EXTERNAL CONFIG HELPER ====================

/**
 * Script Properties'den external config'leri yükle (internal kullanım)
 * 🔒 SECURITY: Tüm sensitive data (API keys, secrets, credentials) bu fonksiyonla yüklenir
 * ✅ GitHub'a commit edilmez (Script Properties'de saklanır)
 */
function loadExternalConfigs() {
  const scriptProperties = PropertiesService.getScriptProperties();

  // 🔒 SECURITY: Calendar ID (Gmail hesabı - sensitive)
  const calendarId = scriptProperties.getProperty('CALENDAR_ID');
  if (calendarId) {
    CONFIG.CALENDAR_ID = calendarId;
  }

  // 🔒 SECURITY: Cloudflare Turnstile Secret - ZORUNLU
  const turnstileSecret = scriptProperties.getProperty('TURNSTILE_SECRET_KEY');
  if (!turnstileSecret || turnstileSecret.trim() === '') {
    throw new Error('KRİTİK: TURNSTILE_SECRET_KEY Script Properties\'de tanımlı değil! Google Apps Script > Project Settings > Script Properties\'e ekleyin.');
  }
  CONFIG.TURNSTILE_SECRET_KEY = turnstileSecret;

  // 🔒 SECURITY: WhatsApp Business API Credentials
  CONFIG.WHATSAPP_PHONE_NUMBER_ID = scriptProperties.getProperty('WHATSAPP_PHONE_NUMBER_ID') || '';
  CONFIG.WHATSAPP_ACCESS_TOKEN = scriptProperties.getProperty('WHATSAPP_ACCESS_TOKEN') || '';
  CONFIG.WHATSAPP_BUSINESS_ACCOUNT_ID = scriptProperties.getProperty('WHATSAPP_BUSINESS_ACCOUNT_ID') || '';

  // 🔒 SECURITY: Slack Webhook URL
  CONFIG.SLACK_WEBHOOK_URL = scriptProperties.getProperty('SLACK_WEBHOOK_URL') || '';
}

// Backward compatibility
function loadWhatsAppConfig() {
  loadExternalConfigs();
}

// Script başlatıldığında config'leri yükle
loadExternalConfigs();

// ==================== SLACK ENTEGRASYONU ====================

/**
 * GÜNLÜK OTOMATİK SLACK BİLDİRİMLERİ
 * Her gün sabah 10:00'da çalışır (Time-driven trigger ile)
 * Bugünün randevularını Slack'e gönderir
 *
 * NOT: Bu fonksiyon trigger tarafından otomatik çağrılır, API key gerekmez
 *
 * Kurulum:
 * 1. Apps Script editörde: Triggers (⏰) → Add Trigger
 * 2. Function: sendDailySlackReminders
 * 3. Event source: Time-driven
 * 4. Type: Day timer
 * 5. Time: 10am to 11am
 * 6. Save
 */
// sendDailySlackReminders - SlackService namespace'ine taşındı (line 3587)
/* eslint-disable no-undef */

/**
 * Slack mesajını formatla (Slack Block Kit kullanarak)
 * Sitedeki tasarıma benzer, modern ve okunabilir format
 */
// formatSlackMessage - SlackService namespace'ine taşındı (line 3650)
 

/**
 * TEST FONKSİYONU - Slack entegrasyonunu adım adım test et
 * Apps Script editöründe bu fonksiyonu çalıştırın ve console output'u kontrol edin
 */
// testSlackIntegration - SlackService namespace'ine taşındı (line 3759)
/* eslint-disable no-undef */

// ==================== YÖNETİM LİNKİ API'LERİ (HK, OK, HMK) ====================

/**
 * Yönetim linki için slot müsaitliğini döndür
 * Bir gün için tüm slotları ve her slottaki randevu sayısını döndürür
 * Max 2 randevu/slot kuralı uygulanır
 *
 * @param {string} date - YYYY-MM-DD formatında tarih
 * @param {number} managementLevel - Yönetim linki seviyesi (1, 2, 3)
 * @returns {object} - { success, slots: [{ time, count, available }] }
 */
function getManagementSlotAvailability(date, managementLevel) {
  try {
    const calendar = CalendarService.getCalendar();
    const startDate = new Date(date + 'T00:00:00');
    const endDate = new Date(date + 'T23:59:59');

    // O gün için tüm randevuları al
    const events = calendar.getEvents(startDate, endDate);

    // Slot'ları oluştur: 10:00'dan 20:00'a kadar tam saatler ve buçuklar
    const slots = [];
    for (let hour = 10; hour <= 20; hour++) {
      slots.push(`${hour}:00`);
      if (hour < 20) { // 20:30'u ekleme, 20:00'da bitir
        slots.push(`${hour}:30`);
      }
    }

    // Her slot için randevu sayısını hesapla
    const slotCounts = {};
    slots.forEach(slot => {
      slotCounts[slot] = 0;
    });

    // VIP linklerden gelen randevuları say (tüm randevu türleri dahil)
    events.forEach(event => {
      const eventTime = event.getStartTime();
      const hours = eventTime.getHours();
      const minutes = eventTime.getMinutes();
      const timeStr = `${hours}:${minutes === 0 ? '00' : minutes}`;

      const isVipLink = event.getTag('isVipLink');
      const title = event.getTitle();

      // VIP linklerden gelen TÜM randevu türlerini say (Teslim, Servis, Görüşme, Management)
      // Yeni randevular: isVipLink === 'true'
      // Eski randevular: başlıkta (HK), (OK), veya (HMK) var
      const isVip = isVipLink === 'true' || title.includes('(HK)') || title.includes('(OK)') || title.includes('(HMK)');

      if (isVip) {
        if (slotCounts.hasOwnProperty(timeStr)) {
          slotCounts[timeStr]++;
        }
      }
    });

    // Slot availability listesi oluştur
    const availabilityList = slots.map(slot => ({
      time: slot,
      count: slotCounts[slot],
      available: slotCounts[slot] < 2  // Max 2 randevu/slot
    }));

    return {
      success: true,
      slots: availabilityList
    };

  } catch (error) {
    log.error('getManagementSlotAvailability hatası:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Belirli bir slot için müsait personelleri döndür (random atama için)
 * Müsait personel = vardiyada + o saatte başka randevusu yok
 *
 * @param {string} date - YYYY-MM-DD formatında tarih
 * @param {string} time - HH:MM formatında saat (örn: "14:00")
 * @returns {object} - { success, availableStaff: [{ id, name, shift }] }
 */
// getAvailableStaffForSlot - AvailabilityService namespace'ine taşındı (line 2564)
 

// ==================== WHATSAPP TEST FUNCTION ====================

/**
 * WhatsApp mesajı test fonksiyonu
 * Google Apps Script editor'de Run butonu ile çalıştırın
 *
 * KULLANIM:
 * 1. Apps Script editor'ü açın
 * 2. Fonksiyon dropdown'dan "testWhatsAppMessage" seçin
 * 3. ▶ Run butonuna tıklayın
 * 4. Execution log'u kontrol edin
 * 5. Telefonunuzu kontrol edin - mesaj geldi mi?
 */
// testWhatsAppMessage - WhatsAppService namespace'ine taşındı (line 3415)
/* eslint-disable no-undef */
