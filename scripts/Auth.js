/**
 * Auth.js
 *
 * Authentication Service - v3.0
 *
 * GUNCELLEME_PLANI v3.2 uyumlu:
 * - Email + Password login (API Key yerine)
 * - Session bazlı auth (10 dakika timeout)
 * - Şifre sıfırlama
 *
 * Dependencies:
 * - Config.js (CONFIG)
 * - Staff.js (StaffService)
 * - Security.js (log)
 */

// ==================== SESSION AUTH SERVICE ====================
/**
 * Session-based authentication service
 * @namespace SessionAuthService
 */
const SessionAuthService = {
  SESSION_DURATION: 10 * 60 * 1000, // 10 dakika (ms)

  /**
   * Login işlemi
   * @param {string} email - E-posta adresi
   * @param {string} password - Şifre
   * @returns {{success: boolean, token?: string, staff?: Object, expiresAt?: number, error?: string}}
   */
  login: function(email, password) {
    try {
      if (!email || !password) {
        return { success: false, error: 'E-posta ve şifre zorunludur' };
      }

      // Email ile personeli bul
      var staff = StaffService.getByEmail(email);

      if (!staff) {
        log.warn('Login başarısız - email bulunamadı', { email: email });
        return { success: false, error: 'Geçersiz e-posta veya şifre' };
      }

      if (!staff.active) {
        log.warn('Login başarısız - hesap pasif', { email: email });
        return { success: false, error: 'Hesabınız pasif durumda' };
      }

      // Şifre kontrolü
      var hashedInput = StaffService.hashPassword(password);
      if (hashedInput !== staff.password) {
        log.warn('Login başarısız - yanlış şifre', { email: email });
        return { success: false, error: 'Geçersiz e-posta veya şifre' };
      }

      // Session token üret
      var sessionToken = Utilities.getUuid();
      var expiresAt = new Date().getTime() + this.SESSION_DURATION;

      // Session'ı kaydet
      var sessions = this.getSessions();
      log.info('[LOGIN-DEBUG] Sessions before save: ' + Object.keys(sessions).length);
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

      // Verify save
      var verifySession = this.getSessions();
      log.info('[LOGIN-DEBUG] Sessions after save: ' + Object.keys(verifySession).length);
      log.info('[LOGIN-DEBUG] New token prefix: ' + sessionToken.substring(0, 8));

      log.info('Login başarılı', { email: email, staffId: staff.id });

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
      log.error('Login hatası', error);
      return { success: false, error: 'Giriş işlemi başarısız' };
    }
  },

  /**
   * Session doğrula
   * @param {string} token - Session token
   * @returns {{valid: boolean, staff?: Object, expiresAt?: number, error?: string}}
   */
  validateSession: function(token) {
    try {
      if (!token) {
        return { valid: false, error: 'Token gerekli' };
      }

      var sessions = this.getSessions();
      var sessionKeys = Object.keys(sessions);
      log.info('[SESSION-DEBUG] Stored sessions count: ' + sessionKeys.length);
      log.info('[SESSION-DEBUG] Looking for token: ' + token.substring(0, 8) + '...');
      log.info('[SESSION-DEBUG] Stored token prefixes: ' + sessionKeys.map(function(k) { return k.substring(0, 8); }).join(', '));

      var session = sessions[token];

      if (!session) {
        return {
          valid: false,
          error: 'Geçersiz session - token bulunamadı',
          debug: {
            storedCount: sessionKeys.length,
            lookingFor: token.substring(0, 8),
            storedPrefixes: sessionKeys.map(function(k) { return k.substring(0, 8); })
          }
        };
      }

      // Süre kontrolü
      var now = new Date().getTime();
      if (now > session.expiresAt) {
        delete sessions[token];
        this.saveSessions(sessions);
        return { valid: false, error: 'Session süresi doldu' };
      }

      // Session'ı yenile (sliding expiration)
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
      log.error('Session validation hatası', error);
      return { valid: false, error: 'Session doğrulama hatası' };
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
        delete sessions[token];
        this.saveSessions(sessions);
        log.info('Logout başarılı', { token: token.substring(0, 8) + '...' });
      }
      return { success: true };
    } catch (error) {
      log.error('Logout hatası', error);
      return { success: true }; // Logout her zaman başarılı kabul edilir
    }
  },

  /**
   * Şifre sıfırlama
   * @param {string} email - E-posta adresi
   * @returns {{success: boolean, message?: string, error?: string}}
   */
  resetPassword: function(email) {
    try {
      var result = StaffService.resetPassword(email);

      if (!result.success) {
        return result;
      }

      // Email gönder
      try {
        var emailBody = 'Merhaba ' + result.name + ',\n\n' +
          'Randevu sistemi yeni şifreniz:\n\n' +
          'E-posta: ' + result.email + '\n' +
          'Şifre: ' + result.plainPassword + '\n\n' +
          'Giriş: https://rolexizmiristinyepark.github.io/randevu_app/admin.html\n\n' +
          'Güvenliğiniz için şifrenizi kimseyle paylaşmayın.\n\n' +
          CONFIG.COMPANY_NAME;

        MailApp.sendEmail({
          to: result.email,
          subject: 'Randevu Sistemi - Yeni Şifreniz',
          body: emailBody,
          name: CONFIG.COMPANY_NAME
        });

        log.info('Şifre sıfırlama e-postası gönderildi', { email: email });
        return { success: true, message: 'Yeni şifre e-posta adresinize gönderildi' };
      } catch (e) {
        log.error('Şifre sıfırlama e-postası gönderilemedi', e);
        return { success: false, error: 'E-posta gönderilemedi: ' + e.message };
      }
    } catch (error) {
      log.error('Şifre sıfırlama hatası', error);
      return { success: false, error: 'Şifre sıfırlama işlemi başarısız' };
    }
  },

  /**
   * Şifre değiştir
   * @param {string} token - Session token
   * @param {string} oldPassword - Mevcut şifre
   * @param {string} newPassword - Yeni şifre
   * @returns {{success: boolean, error?: string}}
   */
  changePassword: function(token, oldPassword, newPassword) {
    try {
      var sessionResult = this.validateSession(token);
      if (!sessionResult.valid) {
        return { success: false, error: 'Geçersiz session' };
      }

      return StaffService.changePassword(sessionResult.staff.id, oldPassword, newPassword);
    } catch (error) {
      log.error('Şifre değiştirme hatası', error);
      return { success: false, error: 'Şifre değiştirme işlemi başarısız' };
    }
  },

  // ==================== HELPER FUNCTIONS ====================
  // Session'lar artık Spreadsheet'te saklanıyor (deployment-bağımsız)

  /**
   * Session'ları getir (Spreadsheet'ten)
   * @returns {Object} Sessions objesi
   */
  getSessions: function() {
    try {
      var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
      var sheet = ss.getSheetByName('SESSIONS');

      // Sheet yoksa oluştur
      if (!sheet) {
        sheet = ss.insertSheet('SESSIONS');
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
        var expiresAt = data[i][2];

        // Süresi dolmamış session'ları al
        if (token && expiresAt > now) {
          try {
            sessions[token] = JSON.parse(sessionData);
            sessions[token].expiresAt = expiresAt;
          } catch (e) {
            // Parse hatası, bu session'ı atla
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
   * Session'ları kaydet (Spreadsheet'e)
   * @param {Object} sessions - Sessions objesi
   */
  saveSessions: function(sessions) {
    try {
      var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
      var sheet = ss.getSheetByName('SESSIONS');

      // Sheet yoksa oluştur
      if (!sheet) {
        sheet = ss.insertSheet('SESSIONS');
        sheet.getRange(1, 1, 1, 4).setValues([['TOKEN', 'DATA', 'EXPIRES_AT', 'CREATED_AT']]);
      }

      // Mevcut verileri temizle (header hariç)
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
      }

      // Yeni session'ları ekle
      var rows = [];
      for (var token in sessions) {
        var session = sessions[token];
        var sessionCopy = JSON.parse(JSON.stringify(session));
        var expiresAt = sessionCopy.expiresAt;
        delete sessionCopy.expiresAt; // expiresAt ayrı kolonda

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
   * Eski session'ları temizle (günde 1 kez çalıştırılmalı)
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
    log.info('Session temizliği yapıldı', { cleaned: cleaned });
    return { cleaned: cleaned };
  }
};

// ==================== LEGACY API KEY SERVICE ====================
/**
 * API Key authentication service (legacy - geriye uyumluluk)
 * @namespace AuthService
 */
const AuthService = {
  /**
   * Generate a new random API key with 'RLX_' prefix
   * @returns {string} Generated API key
   */
  generateApiKey: function() {
    return 'RLX_' + Utilities.getUuid().replace(/-/g, '');
  },

  /**
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

    // Admin'e e-posta gönder
    try {
      MailApp.sendEmail({
        to: CONFIG.ADMIN_EMAIL,
        subject: CONFIG.EMAIL_SUBJECTS.API_KEY_RENEWED,
        name: CONFIG.COMPANY_NAME,
        htmlBody: '<div style="font-family: Arial, sans-serif;"><h3>API Key Yenilendi</h3><p>Yeni API Key: <code>' + newKey + '</code></p></div>'
      });
    } catch (e) {
      log.error('API key yenileme e-postası gönderilemedi', e);
    }

    return { success: true, apiKey: newKey };
  },

  /**
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
      return { success: true, message: 'API key e-posta ile gönderildi', apiKey: existingKey };
    } catch (e) {
      log.error('API key e-postası gönderilemedi', e);
      return { success: true, apiKey: existingKey, warning: 'E-posta gönderilemedi' };
    }
  }
};

// ==================== STANDALONE FUNCTIONS ====================

/**
 * Session temizliği - Trigger ile günde 1 kez çalıştır
 */
function cleanupExpiredSessions() {
  return SessionAuthService.cleanupSessions();
}

/**
 * Test: Login işlemi
 */
function testLogin() {
  var result = SessionAuthService.login('test@rolex.com', 'test1234');
  Logger.log('Login result: ' + JSON.stringify(result));
  return result;
}

/**
 * Send API Key to admin email (legacy)
 */
function sendApiKeyToAdmin() {
  return AuthService.initializeApiKey();
}

/**
 * Get current API Key (legacy)
 */
function showCurrentApiKey() {
  var key = AuthService.getApiKey();
  Logger.log('Current API Key: ' + key);
  return key;
}
