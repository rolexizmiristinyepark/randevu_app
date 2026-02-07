/**
 * Auth.js
 *
 * Authentication Service - v3.0
 *
 * GUNCELLEME_PLANI v3.2 uyumlu:
 * - Email + Password login (API Key yerine)
 * - Session bazli auth (10 dakika timeout)
 * - Sifre sifirlama
 *
 * Dependencies:
 * - Config.js (CONFIG)
 * - Staff.js (StaffService)
 * - Security.js (log)
 */

// ==================== BRUTE FORCE PROTECTION ====================
/**
 * Brute force saldırılarına karşı koruma
 * CacheService kullanarak IP/email bazlı rate limiting
 */
const BruteForceProtection = {
  MAX_ATTEMPTS: 5,              // Maksimum başarısız deneme
  LOCKOUT_DURATION: 15 * 60,    // Kilitleme süresi (saniye) - 15 dakika
  ATTEMPT_WINDOW: 5 * 60,       // Deneme penceresi (saniye) - 5 dakika

  /**
   * Cache key oluştur
   * @param {string} email - E-posta adresi
   * @returns {string} Cache key
   */
  getCacheKey: function(email) {
    // Email'i normalize et ve hash'le (PII koruma)
    const normalizedEmail = (email || '').toLowerCase().trim();
    const hash = Utilities.computeDigest(
      Utilities.DigestAlgorithm.MD5,
      normalizedEmail,
      Utilities.Charset.UTF_8
    ).map(function(b) {
      return ('0' + (b & 0xFF).toString(16)).slice(-2);
    }).join('');
    return 'login_attempts_' + hash;
  },

  /**
   * Giriş denemesini kontrol et
   * @param {string} email - E-posta adresi
   * @returns {{allowed: boolean, remainingAttempts?: number, lockoutSeconds?: number}}
   */
  checkAttempt: function(email) {
    const cache = CacheService.getScriptCache();
    const key = this.getCacheKey(email);
    const data = cache.get(key);

    if (!data) {
      return { allowed: true, remainingAttempts: this.MAX_ATTEMPTS };
    }

    try {
      const attempts = JSON.parse(data);

      // Lockout aktif mi kontrol et
      if (attempts.lockedUntil) {
        const now = new Date().getTime();
        if (now < attempts.lockedUntil) {
          const lockoutSeconds = Math.ceil((attempts.lockedUntil - now) / 1000);
          log.warn('Login blocked - lockout active', { email: email, lockoutSeconds: lockoutSeconds });
          return { allowed: false, lockoutSeconds: lockoutSeconds };
        }
        // Lockout süresi dolmuş, reset
        cache.remove(key);
        return { allowed: true, remainingAttempts: this.MAX_ATTEMPTS };
      }

      // Deneme sayısını kontrol et
      if (attempts.count >= this.MAX_ATTEMPTS) {
        log.warn('Login blocked - max attempts reached', { email: email });
        return { allowed: false, lockoutSeconds: this.LOCKOUT_DURATION };
      }

      return { allowed: true, remainingAttempts: this.MAX_ATTEMPTS - attempts.count };
    } catch (e) {
      // Parse hatası - reset
      cache.remove(key);
      return { allowed: true, remainingAttempts: this.MAX_ATTEMPTS };
    }
  },

  /**
   * Başarısız giriş denemesini kaydet
   * @param {string} email - E-posta adresi
   */
  recordFailedAttempt: function(email) {
    const cache = CacheService.getScriptCache();
    const key = this.getCacheKey(email);
    const data = cache.get(key);

    let attempts = { count: 0 };
    if (data) {
      try {
        attempts = JSON.parse(data);
      } catch (e) {
        attempts = { count: 0 };
      }
    }

    attempts.count++;

    // Maksimum denemeye ulaşıldıysa lockout uygula
    if (attempts.count >= this.MAX_ATTEMPTS) {
      attempts.lockedUntil = new Date().getTime() + (this.LOCKOUT_DURATION * 1000);
      log.warn('Account locked due to failed attempts', { email: email, lockoutMinutes: this.LOCKOUT_DURATION / 60 });
    }

    // Cache'e kaydet
    cache.put(key, JSON.stringify(attempts), this.ATTEMPT_WINDOW);
  },

  /**
   * Başarılı giriş sonrası kayıtları temizle
   * @param {string} email - E-posta adresi
   */
  clearAttempts: function(email) {
    const cache = CacheService.getScriptCache();
    const key = this.getCacheKey(email);
    cache.remove(key);
  }
};

// ==================== SESSION AUTH SERVICE ====================
/**
 * Session-based authentication service
 * Bu, birincil (primary) kimlik dogrulama servisidir.
 * @namespace SessionAuthService
 */
const SessionAuthService = {
  SESSION_DURATION: 24 * 60 * 60 * 1000, // 24 saat (ms)

  /**
   * Login islemi (Brute Force korumalı)
   * @param {string} email - E-posta adresi
   * @param {string} password - Sifre
   * @returns {{success: boolean, token?: string, staff?: Object, expiresAt?: number, error?: string, lockoutSeconds?: number}}
   */
  login: function(email, password) {
    try {
      if (!email || !password) {
        return { success: false, error: 'E-posta ve sifre zorunludur' };
      }

      // ⚠️ SECURITY: Brute force kontrolü
      var bruteCheck = BruteForceProtection.checkAttempt(email);
      if (!bruteCheck.allowed) {
        const lockoutMinutes = Math.ceil(bruteCheck.lockoutSeconds / 60);
        return {
          success: false,
          error: 'Cok fazla basarisiz deneme. ' + lockoutMinutes + ' dakika sonra tekrar deneyin.',
          lockoutSeconds: bruteCheck.lockoutSeconds
        };
      }

      // Email ile personeli bul
      var staff = StaffService.getByEmail(email);

      if (!staff) {
        BruteForceProtection.recordFailedAttempt(email);
        log.warn('Login basarisiz - email bulunamadi', { email: email });
        // ✅ AUDIT: Başarısız giriş denemesi
        SheetStorageService.addAuditLog('LOGIN_FAILED', { reason: 'EMAIL_NOT_FOUND', email: SecurityService.maskEmail(email) });
        return { success: false, error: 'Gecersiz e-posta veya sifre' };
      }

      if (!staff.active) {
        BruteForceProtection.recordFailedAttempt(email);
        log.warn('Login basarisiz - hesap pasif', { email: email });
        // ✅ AUDIT: Pasif hesap girişi
        SheetStorageService.addAuditLog('LOGIN_FAILED', { reason: 'ACCOUNT_INACTIVE', staffId: staff.id });
        return { success: false, error: 'Hesabiniz pasif durumda' };
      }

      // Şifre kontrolü (salt'lı ve legacy destekli)
      if (!StaffService.verifyPassword(password, staff.password)) {
        BruteForceProtection.recordFailedAttempt(email);
        log.warn('Login basarisiz - yanlis sifre', { email: email });
        // ✅ AUDIT: Yanlış şifre
        SheetStorageService.addAuditLog('LOGIN_FAILED', { reason: 'WRONG_PASSWORD', staffId: staff.id });
        return { success: false, error: 'Gecersiz e-posta veya sifre' };
      }

      // Başarılı giriş - deneme sayacını temizle
      BruteForceProtection.clearAttempts(email);

      // ⚠️ SECURITY: Session fixation koruması - eski session'ları temizle
      // Aynı kullanıcıya ait tüm aktif session'ları sil (single active session)
      var sessions = this.getSessions();
      var invalidatedCount = 0;
      for (var existingToken in sessions) {
        if (sessions[existingToken].staffId === staff.id) {
          delete sessions[existingToken];
          invalidatedCount++;
        }
      }
      if (invalidatedCount > 0) {
        log.info('Eski session\'lar temizlendi', { staffId: staff.id, count: invalidatedCount });
      }

      // Session token uret
      var sessionToken = Utilities.getUuid();
      var expiresAt = new Date().getTime() + this.SESSION_DURATION;

      // Session'i kaydet (eski session'lar zaten temizlendi)
      sessions[sessionToken] = {
        staffId: staff.id,
        email: staff.email,
        name: staff.name,
        role: staff.role,
        isAdmin: staff.isAdmin,
        expiresAt: expiresAt,
        createdAt: new Date().getTime()
      };
      this.saveSessions(sessions);

      log.info('Login basarili', { email: email, staffId: staff.id });
      // ✅ AUDIT: Başarılı giriş
      SheetStorageService.addAuditLog('LOGIN_SUCCESS', { staffId: staff.id, staffName: staff.name }, staff.id);

      return {
        success: true,
        token: sessionToken,
        staff: {
          id: staff.id,
          name: staff.name,
          email: staff.email,
          role: staff.role,
          isAdmin: staff.isAdmin
        },
        expiresAt: expiresAt
      };
    } catch (error) {
      log.error('Login hatasi', error);
      return { success: false, error: 'Giris islemi basarisiz' };
    }
  },

  /**
   * Session dogrula
   * @param {string} token - Session token
   * @returns {{valid: boolean, staff?: Object, expiresAt?: number, error?: string}}
   */
  validateSession: function(token) {
    try {
      if (!token) {
        return { valid: false, error: 'Token gerekli' };
      }

      var sessions = this.getSessions();
      var session = sessions[token];

      if (!session) {
        return {
          valid: false,
          error: 'Gecersiz session'
        };
      }

      // Sure kontrolu
      var now = new Date().getTime();
      if (now > session.expiresAt) {
        delete sessions[token];
        this.saveSessions(sessions);
        return { valid: false, error: 'Session suresi doldu' };
      }

      // Session'i yenile (sliding expiration)
      session.expiresAt = now + this.SESSION_DURATION;
      sessions[token] = session;
      this.saveSessions(sessions);

      return {
        valid: true,
        staff: {
          id: session.staffId,
          name: session.name,
          email: session.email,
          role: session.role,
          isAdmin: session.isAdmin
        },
        expiresAt: session.expiresAt
      };
    } catch (error) {
      log.error('Session validation hatasi', error);
      return { valid: false, error: 'Session dogrulama hatasi' };
    }
  },

  /**
   * Logout
   * @param {string} token - Session token
   * @returns {{success: boolean}}
   */
  logout: function(token) {
    try {
      var sessions = this.getSessions();
      if (sessions[token]) {
        var sessionData = sessions[token];
        var staffId = sessionData.staff ? sessionData.staff.id : null;
        delete sessions[token];
        this.saveSessions(sessions);
        log.info('Logout basarili', { token: token.substring(0, 8) + '...' });
        SheetStorageService.addAuditLog('LOGOUT', {
          staffId: staffId
        }, staffId);
      }
      return { success: true };
    } catch (error) {
      log.error('Logout hatasi', error);
      return { success: true }; // Logout her zaman basarili kabul edilir
    }
  },

  /**
   * Sifre sifirlama
   * @param {string} email - E-posta adresi
   * @returns {{success: boolean, message?: string, error?: string}}
   */
  resetPassword: function(email) {
    try {
      var result = StaffService.resetPassword(email);

      if (!result.success) {
        SheetStorageService.addAuditLog('PASSWORD_RESET_FAILED', {
          reason: result.error || 'UNKNOWN',
          email: SecurityService.maskEmail(email)
        });
        return result;
      }

      // Email gonder
      try {
        var emailBody = 'Merhaba ' + result.name + ',\n\n' +
          'Randevu sistemi yeni sifreniz:\n\n' +
          'E-posta: ' + result.email + '\n' +
          'Sifre: ' + result.plainPassword + '\n\n' +
          'Giris: https://rolexizmiristinyepark.github.io/randevu_app/admin.html\n\n' +
          'Guvenliginiz icin sifrenizi kimseyle paylasmay in.\n\n' +
          CONFIG.COMPANY_NAME;

        MailApp.sendEmail({
          to: result.email,
          subject: 'Randevu Sistemi - Yeni Sifreniz',
          body: emailBody,
          name: CONFIG.COMPANY_NAME
        });

        log.info('Sifre sifirlama e-postasi gonderildi', { email: email });
        SheetStorageService.addAuditLog('PASSWORD_RESET_SUCCESS', {
          staffId: result.staffId,
          email: SecurityService.maskEmail(email)
        }, result.staffId);
        return { success: true, message: 'Yeni sifre e-posta adresinize gonderildi' };
      } catch (e) {
        log.error('Sifre sifirlama e-postasi gonderilemedi', e);
        SheetStorageService.addAuditLog('PASSWORD_RESET_FAILED', {
          reason: 'EMAIL_SEND_FAILED',
          email: SecurityService.maskEmail(email),
          error: e.message
        });
        return { success: false, error: 'E-posta gonderilemedi: ' + e.message };
      }
    } catch (error) {
      log.error('Sifre sifirlama hatasi', error);
      SheetStorageService.addAuditLog('PASSWORD_RESET_FAILED', {
        reason: 'SYSTEM_ERROR',
        email: SecurityService.maskEmail(email),
        error: error.toString()
      });
      return { success: false, error: 'Sifre sifirlama islemi basarisiz' };
    }
  },

  /**
   * Sifre degistir
   * @param {string} token - Session token
   * @param {string} oldPassword - Mevcut sifre
   * @param {string} newPassword - Yeni sifre
   * @returns {{success: boolean, error?: string}}
   */
  changePassword: function(token, oldPassword, newPassword) {
    try {
      var sessionResult = this.validateSession(token);
      if (!sessionResult.valid) {
        SheetStorageService.addAuditLog('PASSWORD_CHANGE_FAILED', {
          reason: 'INVALID_SESSION'
        });
        return { success: false, error: 'Gecersiz session' };
      }

      return StaffService.changePassword(sessionResult.staff.id, oldPassword, newPassword);
    } catch (error) {
      log.error('Sifre degistirme hatasi', error);
      SheetStorageService.addAuditLog('PASSWORD_CHANGE_FAILED', {
        reason: 'AUTH_ERROR',
        error: error.toString()
      });
      return { success: false, error: 'Sifre degistirme islemi basarisiz' };
    }
  },

  // ==================== HELPER FUNCTIONS ====================
  // Session'lar artik Spreadsheet'te saklaniyor (deployment-bagimsiz)

  /**
   * Session'lari getir (Spreadsheet'ten)
   * @returns {Object} Sessions objesi
   */
  getSessions: function() {
    try {
      var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
      var sheet = ss.getSheetByName('sessions');

      // Sheet yoksa olustur
      if (!sheet) {
        sheet = ss.insertSheet('sessions');
        sheet.getRange(1, 1, 1, 4).setValues([['TOKEN', 'DATA', 'EXPIRES_AT', 'CREATED_AT']]);
        return {};
      }

      var data = sheet.getDataRange().getValues();
      if (data.length <= 1) return {};

      var sessions = {};
      var now = new Date().getTime();

      for (var i = 1; i < data.length; i++) {
        var token = data[i][0];
        var sessionData = data[i][1];
        var expiresAt = parseInt(data[i][2], 10); // String olabilir, number'a çevir

        // Suresi dolmamis session'lari al
        if (token && !isNaN(expiresAt) && expiresAt > now) {
          try {
            // sessionData string veya object olabilir
            var parsedData = typeof sessionData === 'string' ? JSON.parse(sessionData) : sessionData;
            sessions[token] = parsedData;
            sessions[token].expiresAt = expiresAt;
          } catch (e) {
            log.warn('Session parse error');
          }
        }
      }

      return sessions;
    } catch (e) {
      log.error('getSessions error:', e);
      return {};
    }
  },

  /**
   * Session'lari kaydet (Spreadsheet'e)
   * @param {Object} sessions - Sessions objesi
   */
  saveSessions: function(sessions) {
    try {
      var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
      var sheet = ss.getSheetByName('sessions');

      // Sheet yoksa olustur
      if (!sheet) {
        sheet = ss.insertSheet('sessions');
        sheet.getRange(1, 1, 1, 4).setValues([['TOKEN', 'DATA', 'EXPIRES_AT', 'CREATED_AT']]);
      }

      // Mevcut verileri temizle (header haric)
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
      }

      // Yeni session'lari ekle
      var rows = [];
      for (var token in sessions) {
        var session = sessions[token];
        var sessionCopy = JSON.parse(JSON.stringify(session));
        var expiresAt = sessionCopy.expiresAt;
        delete sessionCopy.expiresAt; // expiresAt ayri kolonda

        rows.push([
          token,
          JSON.stringify(sessionCopy),
          expiresAt,
          session.createdAt || new Date().getTime()
        ]);
      }

      if (rows.length > 0) {
        sheet.getRange(2, 1, rows.length, 4).setValues(rows);
      }
    } catch (e) {
      log.error('saveSessions error:', e);
    }
  },

  /**
   * Belirli bir staff'a ait tüm session'ları geçersiz kıl
   * ⚠️ SECURITY: Yetki değişikliği veya hesap deaktivasyonunda çağrılır
   * @param {string} staffId - Personel ID
   * @returns {{invalidated: number}}
   */
  invalidateSessionsByStaffId: function(staffId) {
    var sessions = this.getSessions();
    var invalidated = 0;

    for (var token in sessions) {
      if (sessions[token].staffId === String(staffId)) {
        delete sessions[token];
        invalidated++;
      }
    }

    if (invalidated > 0) {
      this.saveSessions(sessions);
      log.info('Session\'lar geçersiz kılındı', { staffId: staffId, count: invalidated });
      SheetStorageService.addAuditLog('SESSIONS_INVALIDATED', {
        staffId: staffId,
        count: invalidated,
        reason: 'privilege_change'
      });
    }

    return { invalidated: invalidated };
  },

  /**
   * Eski session'lari temizle (gunde 1 kez calistirilmali)
   * @returns {{cleaned: number}}
   */
  cleanupSessions: function() {
    var sessions = this.getSessions();
    var now = new Date().getTime();
    var cleaned = 0;

    for (var token in sessions) {
      if (sessions[token].expiresAt < now) {
        delete sessions[token];
        cleaned++;
      }
    }

    this.saveSessions(sessions);
    log.info('Session temizligi yapildi', { cleaned: cleaned });
    return { cleaned: cleaned };
  }
};

// ==================== LEGACY API KEY SERVICE ====================
/**
 * @deprecated DEPRECATED - Bu servis v3.0'dan itibaren kullanilmamalidir.
 * Yerine SessionAuthService kullanin.
 *
 * API Key authentication service (legacy - geriye uyumluluk)
 *
 * GUVENLIK NOTU (2024-12):
 * - Bu sistem yalnizca geriye donuk uyumluluk icin korunmaktadir
 * - Yeni gelistirmelerde SessionAuthService tercih edilmelidir
 * - Session-based auth daha guvenlidir (sliding expiration, logout destegi)
 * - API key sistemi gelecekte kaldirilacaktir
 * - API key'ler uzun omurludur ve calinabildiklerinde riski yuksek
 *
 * @namespace AuthService
 * @deprecated v3.0'dan itibaren SessionAuthService kullanin
 */
const AuthService = {
  /**
   * @deprecated API key sistemi yerine SessionAuthService.login() kullanin
   * Generate a new random API key with 'RLX_' prefix
   * @returns {string} Generated API key
   */
  generateApiKey: function() {
    return 'RLX_' + Utilities.getUuid().replace(/-/g, '');
  },

  /**
   * @deprecated API key sistemi yerine session token kullanin
   * Save API key to PropertiesService
   * @param {string} key - API key to save
   * @returns {string} Saved key
   */
  saveApiKey: function(key) {
    var props = PropertiesService.getScriptProperties();
    props.setProperty(CONFIG.API_KEY_PROPERTY, key);
    return key;
  },

  /**
   * @deprecated API key sistemi yerine SessionAuthService.getSessionToken() kullanin
   * Get stored API key
   * @returns {string} Current API key
   */
  getApiKey: function() {
    var props = PropertiesService.getScriptProperties();
    var key = props.getProperty(CONFIG.API_KEY_PROPERTY);

    if (!key) {
      key = this.generateApiKey();
      this.saveApiKey(key);
    }

    return key;
  },

  /**
   * @deprecated API key sistemi yerine SessionAuthService.validateSession() kullanin
   * Validate provided API key
   * @param {string} providedKey - API key to validate
   * @returns {boolean} True if valid
   */
  validateApiKey: function(providedKey) {
    if (!providedKey) return false;
    var storedKey = this.getApiKey();
    return providedKey === storedKey;
  },

  /**
   * @deprecated API key yenileme yerine sifre degistirme ozelligini kullanin
   * Regenerate API key
   * @param {string} oldKey - Current API key for verification
   * @returns {{success: boolean, apiKey?: string, error?: string}}
   */
  regenerateApiKey: function(oldKey) {
    if (!this.validateApiKey(oldKey)) {
      return { success: false, error: CONFIG.ERROR_MESSAGES.INVALID_API_KEY };
    }

    var newKey = this.generateApiKey();
    this.saveApiKey(newKey);

    log.info('API key yenilendi');

    // Admin'e e-posta gonder
    try {
      MailApp.sendEmail({
        to: CONFIG.ADMIN_EMAIL,
        subject: CONFIG.EMAIL_SUBJECTS.API_KEY_RENEWED,
        name: CONFIG.COMPANY_NAME,
        htmlBody: '<div style="font-family: Arial, sans-serif;"><h3>API Key Yenilendi</h3><p>Yeni API Key: <code>' + newKey + '</code></p></div>'
      });
    } catch (e) {
      log.error('API key yenileme e-postasi gonderilemedi', e);
    }

    return { success: true, apiKey: newKey };
  },

  /**
   * @deprecated Bu fonksiyon sadece geriye donuk uyumluluk icin korunmaktadir
   * Initialize API key and send to admin email
   * @returns {{success: boolean, apiKey: string}}
   */
  initializeApiKey: function() {
    var existingKey = this.getApiKey();

    try {
      MailApp.sendEmail({
        to: CONFIG.ADMIN_EMAIL,
        subject: CONFIG.EMAIL_SUBJECTS.API_KEY_INITIAL,
        name: CONFIG.COMPANY_NAME,
        htmlBody: '<div style="font-family: Arial, sans-serif;"><h3>API Key</h3><p>API Key: <code>' + existingKey + '</code></p></div>'
      });
      return { success: true, message: 'API key e-posta ile gonderildi', apiKey: existingKey };
    } catch (e) {
      log.error('API key e-postasi gonderilemedi', e);
      return { success: true, apiKey: existingKey, warning: 'E-posta gonderilemedi' };
    }
  }
};

// ==================== STANDALONE FUNCTIONS ====================

/**
 * Session temizligi - Trigger ile gunde 1 kez calistir
 *
 * KURULUM TALIMATLARI:
 * 1. Google Apps Script Editor'de Triggers menusune gidin
 * 2. "Add Trigger" tiklayin
 * 3. Fonksiyon: cleanupExpiredSessions
 * 4. Event source: Time-driven
 * 5. Type: Day timer
 * 6. Time of day: 03:00 - 04:00 (gece saati onerilir)
 *
 * Bu trigger suresi dolmus session'lari temizler ve
 * veritabani sismesini onler.
 */
function cleanupExpiredSessions() {
  return SessionAuthService.cleanupSessions();
}

/**
 * Test: Login islemi
 */
function testLogin() {
  var result = SessionAuthService.login('test@rolex.com', 'test1234');
  Logger.log('Login result: ' + JSON.stringify(result));
  return result;
}

/**
 * DEBUG: Session sheet'ini kontrol et
 * Google Apps Script'te bu fonksiyonu manuel çalıştırarak debug yapabilirsiniz
 */
function debugSessions() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  Logger.log('Spreadsheet ID: ' + CONFIG.SPREADSHEET_ID);
  Logger.log('Spreadsheet Name: ' + ss.getName());

  // Tüm sheet isimlerini listele
  var sheets = ss.getSheets();
  Logger.log('Available sheets: ' + sheets.map(function(s) { return s.getName(); }).join(', '));

  // SESSIONS sheet'ini bul
  var sessionsSheet = ss.getSheetByName('sessions');
  if (!sessionsSheet) {
    Logger.log('❌ SESSIONS sheet bulunamadi!');
    return { error: 'SESSIONS sheet not found', availableSheets: sheets.map(function(s) { return s.getName(); }) };
  }

  Logger.log('✅ SESSIONS sheet bulundu');

  // Verileri oku
  var data = sessionsSheet.getDataRange().getValues();
  Logger.log('Total rows: ' + data.length);

  if (data.length > 0) {
    Logger.log('Headers: ' + JSON.stringify(data[0]));
  }

  if (data.length > 1) {
    for (var i = 1; i < data.length; i++) {
      Logger.log('Row ' + i + ': token=' + (data[i][0] ? String(data[i][0]).substring(0, 8) + '...' : 'empty') +
                 ', expiresAt=' + data[i][2] +
                 ', type=' + typeof data[i][2]);
    }
  }

  // getSessions fonksiyonunu test et
  var sessions = SessionAuthService.getSessions();
  Logger.log('Parsed sessions count: ' + Object.keys(sessions).length);
  Logger.log('Session tokens: ' + Object.keys(sessions).map(function(k) { return k.substring(0, 8); }).join(', '));

  return {
    spreadsheetId: CONFIG.SPREADSHEET_ID,
    spreadsheetName: ss.getName(),
    availableSheets: sheets.map(function(s) { return s.getName(); }),
    sessionsSheetFound: true,
    totalRows: data.length,
    parsedSessionsCount: Object.keys(sessions).length
  };
}

/**
 * @deprecated API key sistemi kullanilmamalidir
 * Send API Key to admin email (legacy)
 */
function sendApiKeyToAdmin() {
  return AuthService.initializeApiKey();
}

/**
 * @deprecated API key sistemi kullanilmamalidir
 * Get current API Key (legacy)
 */
function showCurrentApiKey() {
  var key = AuthService.getApiKey();
  Logger.log('Current API Key: ' + key);
  return key;
}
