// ==================== SECURITY SERVICE ====================
// PII masking, rate limiting, bot protection, and lock management

/**
 * PII masking, rate limiting, bot protection
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
      
      // 🔒 SECURITY: Fail-closed pattern - hata durumunda GÜVENLİK ÖNCELİKLİ
      // Rate limit kontrol edilemiyorsa isteği REDDET
      // Bu, potansiyel DDoS veya abuse durumlarında koruma sağlar
      // ⚠️ BU DAVRANIŞI DEĞİŞTİRMEYİN - Güvenlik kritik!
      return {
        allowed: false,  // ✅ DOĞRU: Hata durumunda reddet
        remaining: 0,
        resetTime: Date.now() + 60000,
        error: 'Rate limit service error - please try again later'
      };
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

// ==================== DEBUG LOGGER ====================
// Debug logger - Production'da log'ları devre dışı bırakır
// KVKK/GDPR: PII verileri loglanmadan önce maskelenmeli

const log = {
  error: (...args) => DEBUG && console.error(...args),
  warn: (...args) => DEBUG && console.warn(...args),
  info: (...args) => DEBUG && console.info(...args),
  debug: (...args) => DEBUG && console.log('[DEBUG]', ...args),  // v3.9.9: debug metodu eklendi
  log: (...args) => DEBUG && console.log(...args),

  // PII-safe loggers (SecurityService kullanır)
  errorPII: (message, email, phone) => DEBUG && console.error(message, SecurityService.maskEmail(email), SecurityService.maskPhone(phone)),
  infoPII: (message, email, phone) => DEBUG && console.info(message, SecurityService.maskEmail(email), SecurityService.maskPhone(phone))
};

// ==================== LOCK SERVICE ====================
/**
 * Lock service wrapper for race condition protection
 * @namespace LockServiceWrapper
 */
const LockServiceWrapper = {
  // Farklı işlemler için önerilen timeout'lar
  TIMEOUTS: {
    APPOINTMENT_CREATE: 10000,  // 10 saniye
    APPOINTMENT_UPDATE: 10000,  // 10 saniye
    STAFF_OPERATION: 5000,      // 5 saniye
    SETTINGS_SAVE: 5000,        // 5 saniye
    DEFAULT: 15000              // 15 saniye (eski 30'dan düşürüldü)
  },

  /**
   * Critical section'ları kilitleyerek race condition'ı önler
   * @param {Function} fn - Kilitli çalıştırılacak fonksiyon
   * @param {number} timeout - Lock timeout (ms), default 15000
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
   * }, LockServiceWrapper.TIMEOUTS.APPOINTMENT_CREATE);
   */
  withLock: function(fn, timeout = this.TIMEOUTS.DEFAULT, maxRetries = 3) {
    // ⚠️ PERFORMANCE: getDocumentLock() kullanılıyor (getScriptLock() yerine)
    // - getScriptLock(): Tüm script için global lock - tüm kullanıcıları bloklar
    // - getDocumentLock(): Sadece bu spreadsheet için lock - daha iyi parallelism
    // Bu uygulama tek bir spreadsheet kullandığı için DocumentLock yeterli
    const lock = LockService.getDocumentLock();
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
