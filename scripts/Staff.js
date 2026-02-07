/**
 * Staff.js
 *
 * Staff and Shift Management Services - v3.0
 *
 * GUNCELLEME_PLANI v3.2 uyumlu:
 * - Güvenli ID (8 karakter, shuffled)
 * - Email + Password login
 * - Role: sales / management
 * - isAdmin yetkisi
 *
 * Dependencies:
 * - Config.js (CONFIG, VALIDATION)
 * - Storage.js (StorageService)
 * - Security.js (LockServiceWrapper, log)
 */

// --- Utility Functions ---
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
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
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
    return phone.replace(/[^0-9+\-\s()]/g, '').trim().substring(0, VALIDATION.PHONE_MAX_LENGTH);
  },

  /**
   * İsmi Title Case formatına çevirir
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
   * Personel doğrulama ve temizleme
   * @param {string} name - İsim
   * @param {string} phone - Telefon
   * @param {string} email - E-posta
   * @returns {{name?: string, phone?: string, email?: string, error?: string}}
   */
  validateAndSanitizeStaff: function(name, phone, email) {
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return { error: CONFIG.ERROR_MESSAGES.NAME_REQUIRED };
    }

    if (email && !this.isValidEmail(email)) {
      return { error: CONFIG.ERROR_MESSAGES.INVALID_EMAIL };
    }

    return {
      name: this.toTitleCase(name),
      phone: phone ? this.sanitizePhone(phone) : '',
      email: email ? email.trim().toLowerCase() : ''
    };
  },

  /**
   * HTML karakterlerini escape eder (XSS koruması)
   * @param {string} str - Escape edilecek string
   * @returns {string} HTML-safe string
   */
  escapeHtml: function(str) {
    if (!str || typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  /**
   * Spreadsheet formula injection koruması
   * @param {string} input - Girdi string
   * @returns {string} Güvenli string
   */
  sanitizeForSpreadsheet: function(input) {
    if (!input || typeof input !== 'string') return '';

    const sanitized = input.trim();
    const formulaStarters = ['=', '+', '-', '@', '|', '\t', '\r', '\n'];

    if (formulaStarters.some(starter => sanitized.startsWith(starter))) {
      return "'" + sanitized;
    }

    return sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  }
};

// --- Staff Management v3.0 ---
/**
 * Staff management service - GUNCELLEME_PLANI v3.2
 * @namespace StaffService
 */
const StaffService = {
  SHEET_NAME: 'staff',

  // Sütun indeksleri (0-based) - Yeni yapı
  COLUMNS: {
    ID: 0,        // string (8 karakter güvenli ID)
    NAME: 1,      // string
    EMAIL: 2,     // string (login için)
    PHONE: 3,     // string
    PASSWORD: 4,  // string (SHA-256 hash)
    ROLE: 5,      // 'sales' | 'management'
    IS_ADMIN: 6,  // boolean
    ACTIVE: 7     // boolean
  },

  /**
   * Güvenli ID üretimi
   * Format: İsim baş harf + 6 random rakam + Soyisim baş harf (shuffled)
   * @param {string} name - Personel adı
   * @returns {string} 8 karakterlik güvenli ID
   */
  generateSecureId: function(name) {
    var parts = name.trim().split(' ');
    var first = parts[0].charAt(0).toLowerCase();
    var last = parts.length > 1
      ? parts[parts.length - 1].charAt(0).toLowerCase()
      : first;

    // Türkçe karakterleri ASCII'ye çevir
    var charMap = {'ı': 'i', 'ğ': 'g', 'ü': 'u', 'ş': 's', 'ö': 'o', 'ç': 'c'};
    first = charMap[first] || first;
    last = charMap[last] || last;

    // 6 random rakam
    var digits = Math.floor(100000 + Math.random() * 900000).toString();

    // 8 karakterlik array: 2 harf + 6 rakam
    var chars = [first, last].concat(digits.split(''));

    // Fisher-Yates shuffle
    for (var i = chars.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = chars[i];
      chars[i] = chars[j];
      chars[j] = temp;
    }

    return chars.join('');
  },

  /**
   * Rastgele salt üret (16 byte = 32 hex karakter)
   * @returns {string} Hex formatında salt
   */
  generateSalt: function() {
    var bytes = [];
    for (var i = 0; i < 16; i++) {
      bytes.push(Math.floor(Math.random() * 256));
    }
    return bytes.map(function(b) {
      return ('0' + (b & 0xFF).toString(16)).slice(-2);
    }).join('');
  },

  /**
   * Şifre hash'leme (SHA-256 + Salt)
   * ⚠️ SECURITY: Salt ile hash - rainbow table saldırılarına karşı koruma
   * @param {string} plainPassword - Düz metin şifre
   * @param {string} [salt] - Opsiyonel salt (yoksa yeni üretilir)
   * @returns {string} Format: "hash:salt" veya sadece hash (legacy uyumluluk)
   */
  hashPassword: function(plainPassword, salt) {
    // Salt yoksa yeni üret
    if (!salt) {
      salt = this.generateSalt();
    }

    // Password + Salt birleştir ve hash'le
    var saltedPassword = plainPassword + salt;
    var hash = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      saltedPassword,
      Utilities.Charset.UTF_8
    );
    var hashHex = hash.map(function(b) {
      return ('0' + (b & 0xFF).toString(16)).slice(-2);
    }).join('');

    // Yeni format: hash:salt
    return hashHex + ':' + salt;
  },

  /**
   * Legacy hash (salt'sız) - sadece eski şifreleri doğrulamak için
   * @deprecated Yeni şifreler için hashPassword() kullanın
   * @param {string} plainPassword - Düz metin şifre
   * @returns {string} SHA-256 hash (hex) - salt'sız
   */
  hashPasswordLegacy: function(plainPassword) {
    var hash = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      plainPassword,
      Utilities.Charset.UTF_8
    );
    return hash.map(function(b) {
      return ('0' + (b & 0xFF).toString(16)).slice(-2);
    }).join('');
  },

  /**
   * Timing-safe string comparison (constant-time)
   * ⚠️ SECURITY: === operatörü timing attack'a açık - bu fonksiyon sabit sürede karşılaştırır
   * @param {string} a - İlk string
   * @param {string} b - İkinci string
   * @returns {boolean} Eşit mi?
   * @private
   */
  _timingSafeEqual: function(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    if (a.length !== b.length) return false;
    var result = 0;
    for (var i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  },

  /**
   * Şifre doğrulama (salt'lı ve legacy destekli)
   * ⚠️ SECURITY: Timing-safe comparison kullanır (timing attack koruması)
   * @param {string} plainPassword - Düz metin şifre
   * @param {string} storedHash - Kaydedilmiş hash (hash:salt veya sadece hash)
   * @returns {boolean} Doğrulama sonucu
   */
  verifyPassword: function(plainPassword, storedHash) {
    if (!storedHash || !plainPassword) return false;

    // Yeni format: hash:salt
    if (storedHash.includes(':')) {
      var parts = storedHash.split(':');
      var hash = parts[0];
      var salt = parts[1];

      // Salt ile hash'le ve karşılaştır
      var saltedPassword = plainPassword + salt;
      var computedHash = Utilities.computeDigest(
        Utilities.DigestAlgorithm.SHA_256,
        saltedPassword,
        Utilities.Charset.UTF_8
      );
      var computedHashHex = computedHash.map(function(b) {
        return ('0' + (b & 0xFF).toString(16)).slice(-2);
      }).join('');

      return this._timingSafeEqual(computedHashHex, hash);
    }

    // Legacy format: sadece hash (salt'sız)
    var legacyHash = this.hashPasswordLegacy(plainPassword);
    return this._timingSafeEqual(legacyHash, storedHash);
  },

  /**
   * Rastgele şifre üretimi (8 karakter)
   * Karıştırılabilir karakterler çıkarıldı: 0,O,1,l,I
   * @returns {string} 8 karakterlik şifre
   */
  generatePassword: function() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    var password = '';
    for (var i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  },

  /**
   * Staff sheet'i al veya oluştur
   * @returns {GoogleAppsScript.Spreadsheet.Sheet}
   */
  getSheet: function() {
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sheet = ss.getSheetByName(this.SHEET_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(this.SHEET_NAME);
      sheet.appendRow(['id', 'name', 'email', 'phone', 'password', 'role', 'isAdmin', 'active']);
      sheet.setFrozenRows(1);
    }

    return sheet;
  },

  /**
   * Tüm personeli getir
   * @returns {Array} Staff listesi
   */
  getAll: function() {
    var sheet = this.getSheet();
    var data = sheet.getDataRange().getValues();
    var staff = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (row[this.COLUMNS.ID]) {
        staff.push({
          id: String(row[this.COLUMNS.ID]),
          name: row[this.COLUMNS.NAME],
          email: row[this.COLUMNS.EMAIL] || '',
          phone: row[this.COLUMNS.PHONE] || '',
          role: row[this.COLUMNS.ROLE] || 'sales',
          isAdmin: row[this.COLUMNS.IS_ADMIN] === true || row[this.COLUMNS.IS_ADMIN] === 'TRUE',
          active: row[this.COLUMNS.ACTIVE] === true || row[this.COLUMNS.ACTIVE] === 'TRUE'
        });
      }
    }

    return staff;
  },

  /**
   * Legacy getStaff - geriye uyumluluk
   * @returns {{success: boolean, data: Array}}
   */
  getStaff: function() {
    return { success: true, data: this.getAll() };
  },

  /**
   * ID ile personel getir
   * @param {string} id - Personel ID
   * @returns {Object|null} Personel objesi
   */
  getById: function(id) {
    var allStaff = this.getAll();
    for (var i = 0; i < allStaff.length; i++) {
      if (allStaff[i].id === String(id)) {
        return allStaff[i];
      }
    }
    return null;
  },

  /**
   * Email ile personel getir (login için)
   * @param {string} email - E-posta adresi
   * @returns {Object|null} Personel objesi (password dahil)
   */
  getByEmail: function(email) {
    var sheet = this.getSheet();
    var data = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (data[i][this.COLUMNS.EMAIL] === email.toLowerCase()) {
        return {
          id: String(data[i][this.COLUMNS.ID]),
          name: data[i][this.COLUMNS.NAME],
          email: data[i][this.COLUMNS.EMAIL],
          phone: data[i][this.COLUMNS.PHONE] || '',
          password: data[i][this.COLUMNS.PASSWORD], // Hash'li şifre
          role: data[i][this.COLUMNS.ROLE] || 'sales',
          isAdmin: data[i][this.COLUMNS.IS_ADMIN] === true || data[i][this.COLUMNS.IS_ADMIN] === 'TRUE',
          active: data[i][this.COLUMNS.ACTIVE] === true || data[i][this.COLUMNS.ACTIVE] === 'TRUE',
          rowIndex: i + 1
        };
      }
    }
    return null;
  },

  /**
   * Role göre personel listesi
   * @param {string} role - 'sales' veya 'management'
   * @returns {Array} Filtrelenmiş staff listesi
   */
  getByRole: function(role) {
    var allStaff = this.getAll();
    return allStaff.filter(function(s) {
      return s.role === role && s.active;
    });
  },

  /**
   * Yeni personel ekle
   * @param {Object} data - {name, email, phone, role, isAdmin}
   * @returns {{success: boolean, id?: string, plainPassword?: string, error?: string}}
   */
  create: function(data) {
    try {
      // Validation
      var validation = Utils.validateAndSanitizeStaff(data.name, data.phone, data.email);
      if (validation.error) {
        return { success: false, error: validation.error };
      }

      // Email zorunlu
      if (!data.email) {
        return { success: false, error: 'E-posta adresi zorunludur' };
      }

      // Email benzersizlik kontrolü
      if (this.getByEmail(data.email)) {
        return { success: false, error: 'Bu e-posta adresi zaten kullanılıyor' };
      }

      var sheet = this.getSheet();

      // ID üret
      var id = this.generateSecureId(validation.name);

      // Şifre üret ve hash'le
      var plainPassword = this.generatePassword();
      var hashedPassword = this.hashPassword(plainPassword);

      // Satır ekle
      sheet.appendRow([
        id,
        Utils.sanitizeForSpreadsheet(validation.name),
        validation.email,
        Utils.sanitizeForSpreadsheet(validation.phone),
        hashedPassword,
        data.role || 'sales',
        data.isAdmin || false,
        true // active
      ]);

      log.info('Yeni personel eklendi', { id: id, name: validation.name });
      SheetStorageService.addAuditLog('STAFF_CREATED', {
        staffId: id,
        name: validation.name,
        email: SecurityService.maskEmail(validation.email),
        role: data.role || 'sales'
      });

      return {
        success: true,
        id: id,
        plainPassword: plainPassword // Email ile gönderilecek
      };
    } catch (error) {
      log.error('Personel ekleme hatası', error);
      SheetStorageService.addAuditLog('STAFF_CREATE_FAILED', {
        error: error.toString()
      });
      return { success: false, error: error.toString() };
    }
  },

  /**
   * Personel güncelle
   * @param {string} id - Personel ID
   * @param {Object} data - Güncellenecek alanlar
   * @returns {{success: boolean, error?: string}}
   */
  update: function(id, data) {
    try {
      var sheet = this.getSheet();
      var dataRange = sheet.getDataRange().getValues();

      for (var i = 1; i < dataRange.length; i++) {
        if (String(dataRange[i][this.COLUMNS.ID]) === String(id)) {
          var rowIndex = i + 1;

          if (data.name) {
            var sanitizedName = Utils.toTitleCase(data.name);
            sheet.getRange(rowIndex, this.COLUMNS.NAME + 1).setValue(Utils.sanitizeForSpreadsheet(sanitizedName));
          }
          if (data.email) {
            sheet.getRange(rowIndex, this.COLUMNS.EMAIL + 1).setValue(data.email.toLowerCase());
          }
          if (data.phone !== undefined) {
            sheet.getRange(rowIndex, this.COLUMNS.PHONE + 1).setValue(Utils.sanitizeForSpreadsheet(data.phone));
          }
          // ⚠️ SECURITY: Yetki değişikliği tespiti (session invalidation için)
          var currentRole = dataRange[i][this.COLUMNS.ROLE];
          var currentIsAdmin = dataRange[i][this.COLUMNS.IS_ADMIN] === true || dataRange[i][this.COLUMNS.IS_ADMIN] === 'TRUE';
          var currentActive = dataRange[i][this.COLUMNS.ACTIVE] === true || dataRange[i][this.COLUMNS.ACTIVE] === 'TRUE';
          var privilegeChanged = false;

          if (data.role) {
            if (data.role !== currentRole) privilegeChanged = true;
            sheet.getRange(rowIndex, this.COLUMNS.ROLE + 1).setValue(data.role);
          }
          if (typeof data.isAdmin !== 'undefined') {
            if (data.isAdmin !== currentIsAdmin) privilegeChanged = true;
            sheet.getRange(rowIndex, this.COLUMNS.IS_ADMIN + 1).setValue(data.isAdmin);
          }
          if (typeof data.active !== 'undefined') {
            if (data.active !== currentActive) privilegeChanged = true;
            sheet.getRange(rowIndex, this.COLUMNS.ACTIVE + 1).setValue(data.active);
          }

          // ⚠️ SECURITY: Yetki değişikliğinde veya hesap deaktivasyonunda mevcut session'ları geçersiz kıl
          if (privilegeChanged) {
            try {
              SessionAuthService.invalidateSessionsByStaffId(id);
              log.info('Yetki değişikliği nedeniyle session\'lar geçersiz kılındı', { staffId: id });
            } catch (sessionError) {
              log.error('Session invalidation hatası (yetki değişikliği):', sessionError);
            }
          }

          log.info('Personel güncellendi', { id: id, privilegeChanged: privilegeChanged });
          SheetStorageService.addAuditLog('STAFF_UPDATED', {
            staffId: id,
            updatedFields: Object.keys(data).filter(function(k) { return data[k] !== undefined; }),
            privilegeChanged: privilegeChanged
          });
          return { success: true };
        }
      }

      SheetStorageService.addAuditLog('STAFF_UPDATE_FAILED', {
        reason: 'STAFF_NOT_FOUND',
        staffId: id
      });
      return { success: false, error: CONFIG.ERROR_MESSAGES.STAFF_NOT_FOUND };
    } catch (error) {
      log.error('Personel güncelleme hatası', error);
      SheetStorageService.addAuditLog('STAFF_UPDATE_FAILED', {
        reason: 'ERROR',
        staffId: id,
        error: error.toString()
      });
      return { success: false, error: error.toString() };
    }
  },

  /**
   * Personel aktif/pasif toggle
   * @param {string} staffId - Personel ID
   * @returns {{success: boolean, data?: Array, error?: string}}
   */
  toggleStaff: function(staffId) {
    var staff = this.getById(staffId);
    if (!staff) {
      return { success: false, error: CONFIG.ERROR_MESSAGES.STAFF_NOT_FOUND };
    }

    var result = this.update(staffId, { active: !staff.active });
    if (result.success) {
      return { success: true, data: this.getAll() };
    }
    return result;
  },

  /**
   * Şifre sıfırla
   * @param {string} email - E-posta adresi
   * @returns {{success: boolean, name?: string, email?: string, plainPassword?: string, error?: string}}
   */
  resetPassword: function(email) {
    try {
      var staff = this.getByEmail(email);
      if (!staff) {
        return { success: false, error: 'E-posta adresi bulunamadı' };
      }

      var sheet = this.getSheet();

      // Yeni şifre üret
      var plainPassword = this.generatePassword();
      var hashedPassword = this.hashPassword(plainPassword);

      // Güncelle
      sheet.getRange(staff.rowIndex, this.COLUMNS.PASSWORD + 1).setValue(hashedPassword);

      log.info('Şifre sıfırlandı', { email: email });

      return {
        success: true,
        name: staff.name,
        email: staff.email,
        plainPassword: plainPassword
      };
    } catch (error) {
      log.error('Şifre sıfırlama hatası', error);
      return { success: false, error: error.toString() };
    }
  },

  /**
   * Şifre değiştir
   * @param {string} staffId - Personel ID
   * @param {string} oldPassword - Eski şifre
   * @param {string} newPassword - Yeni şifre
   * @returns {{success: boolean, error?: string}}
   */
  changePassword: function(staffId, oldPassword, newPassword) {
    try {
      var sheet = this.getSheet();
      var data = sheet.getDataRange().getValues();

      for (var i = 1; i < data.length; i++) {
        if (String(data[i][this.COLUMNS.ID]) === String(staffId)) {
          var currentHash = data[i][this.COLUMNS.PASSWORD];

          // Eski şifre kontrolü (salt'lı ve legacy destekli)
          if (!this.verifyPassword(oldPassword, currentHash)) {
            SheetStorageService.addAuditLog('PASSWORD_CHANGE_FAILED', {
              reason: 'WRONG_OLD_PASSWORD',
              staffId: staffId
            }, staffId);
            return { success: false, error: 'Mevcut şifre hatalı' };
          }

          if (newPassword.length < 6) {
            SheetStorageService.addAuditLog('PASSWORD_CHANGE_FAILED', {
              reason: 'PASSWORD_TOO_SHORT',
              staffId: staffId
            }, staffId);
            return { success: false, error: 'Yeni şifre en az 6 karakter olmalı' };
          }

          // Yeni şifre için salt'lı hash oluştur
          var newHash = this.hashPassword(newPassword);
          sheet.getRange(i + 1, this.COLUMNS.PASSWORD + 1).setValue(newHash);

          log.info('Şifre değiştirildi', { staffId: staffId });
          SheetStorageService.addAuditLog('PASSWORD_CHANGE_SUCCESS', {
            staffId: staffId
          }, staffId);
          return { success: true };
        }
      }

      SheetStorageService.addAuditLog('PASSWORD_CHANGE_FAILED', {
        reason: 'STAFF_NOT_FOUND',
        staffId: staffId
      });
      return { success: false, error: CONFIG.ERROR_MESSAGES.STAFF_NOT_FOUND };
    } catch (error) {
      log.error('Şifre değiştirme hatası', error);
      SheetStorageService.addAuditLog('PASSWORD_CHANGE_FAILED', {
        reason: 'ERROR',
        staffId: staffId,
        error: error.toString()
      });
      return { success: false, error: error.toString() };
    }
  },

  /**
   * Legacy addStaff - geriye uyumluluk
   */
  addStaff: function(name, phone, email) {
    return this.create({ name: name, phone: phone, email: email });
  },

  /**
   * Legacy updateStaff - geriye uyumluluk
   */
  updateStaff: function(staffId, name, phone, email) {
    return this.update(staffId, { name: name, phone: phone, email: email });
  },

  /**
   * Legacy removeStaff - geriye uyumluluk
   */
  removeStaff: function(staffId) {
    return this.update(staffId, { active: false });
  }
};

// ==================== TEST FUNCTIONS ====================

/**
 * Test: İlk admin personeli oluştur
 * Google Apps Script editöründen çalıştırılmalı
 */
function setupTestAdmin() {
  var result = StaffService.create({
    name: 'Serdar Benli',
    email: 'serdarbenliauth@gmail.com',
    phone: '05551234567',
    role: 'management',
    isAdmin: true
  });

  if (result.success) {
    Logger.log('✅ Test admin oluşturuldu!');
    Logger.log('ID: ' + result.id);
    Logger.log('Şifre: ' + result.plainPassword);
    Logger.log('');
    Logger.log('Login bilgileri:');
    Logger.log('Email: serdarbenliauth@gmail.com');
    Logger.log('Password: ' + result.plainPassword);
  } else {
    Logger.log('❌ Hata: ' + result.error);
  }

  return result;
}

/**
 * Mevcut admin şifresini sıfırla ve yeni şifre oluştur
 */
function resetTestAdminPassword() {
  var email = 'serdarbenliauth@gmail.com';
  var result = StaffService.resetPassword(email);

  if (result.success) {
    Logger.log('✅ Şifre sıfırlandı!');
    Logger.log('Email: ' + result.email);
    Logger.log('Yeni Şifre: ' + result.plainPassword);
  } else {
    Logger.log('❌ Hata: ' + result.error);
  }

  return result;
}

/**
 * Mevcut test@rolex.com kullanıcısını serdarbenliauth@gmail.com olarak güncelle
 */
function updateTestAdminEmail() {
  var staff = StaffService.getByEmail('test@rolex.com');
  if (!staff) {
    Logger.log('❌ test@rolex.com bulunamadı');
    return { success: false, error: 'Kullanıcı bulunamadı' };
  }

  var result = StaffService.update(staff.id, {
    email: 'serdarbenliauth@gmail.com'
  });

  if (result.success) {
    Logger.log('✅ Email güncellendi: serdarbenliauth@gmail.com');

    // Şifreyi de sıfırla
    var resetResult = StaffService.resetPassword('serdarbenliauth@gmail.com');
    if (resetResult.success) {
      Logger.log('✅ Yeni şifre: ' + resetResult.plainPassword);
    }
    return resetResult;
  } else {
    Logger.log('❌ Hata: ' + result.error);
  }

  return result;
}

/**
 * Test: Sales personeli oluştur
 */
function setupTestSalesStaff() {
  var salesStaff = [
    { name: 'Ece Argun', email: 'ece@rolex.com' },
    { name: 'Gökhan Tokol', email: 'gokhan@rolex.com' },
    { name: 'Gamze', email: 'gamze@rolex.com' }
  ];

  var results = [];

  salesStaff.forEach(function(s) {
    var result = StaffService.create({
      name: s.name,
      email: s.email,
      phone: '',
      role: 'sales',
      isAdmin: false
    });

    if (result.success) {
      Logger.log('✅ ' + s.name + ' oluşturuldu (ID: ' + result.id + ', Şifre: ' + result.plainPassword + ')');
    } else {
      Logger.log('❌ ' + s.name + ' hata: ' + result.error);
    }

    results.push(result);
  });

  return results;
}

/**
 * Test: Tüm personelleri listele
 */
function testListAllStaff() {
  var staff = StaffService.getAll();
  Logger.log('Toplam personel: ' + staff.length);
  staff.forEach(function(s) {
    Logger.log(s.id + ' | ' + s.name + ' | ' + s.email + ' | ' + s.role + ' | admin:' + s.isAdmin + ' | active:' + s.active);
  });
  return staff;
}

/**
 * Production personel listesini v3.0 formatında oluştur
 * Staff sheet'i silindikten sonra çalıştır!
 */
function setupProductionStaff() {
  // Production personel listesi
  var staffList = [
    { name: 'Serdar Benli', phone: '5382348625', email: 'serdar.benli@kulahcioglu.com', role: 'management', isAdmin: true },
    { name: 'Ece Argun', phone: '5382348729', email: 'ece.argun@kulahcioglu.com', role: 'sales', isAdmin: false },
    { name: 'Gökhan Tokol', phone: '5382348626', email: 'gokhan.tokol@kulahcioglu.com', role: 'sales', isAdmin: false },
    { name: 'Sırma Karaarslan', phone: '5382348641', email: 'sirma.karaarslan@kulahcioglu.com', role: 'sales', isAdmin: false },
    { name: 'Gamze Tekin', phone: '5382348653', email: 'gamze.tekin@kulahcioglu.com', role: 'sales', isAdmin: false },
    { name: 'Okan Üstündağ', phone: '5363485110', email: 'okan.ustundag@kulahcioglu.com', role: 'sales', isAdmin: false }
  ];

  Logger.log('=== STAFF SETUP BAŞLIYOR ===');
  Logger.log('');

  var results = [];

  staffList.forEach(function(s) {
    var result = StaffService.create({
      name: s.name,
      email: s.email,
      phone: s.phone,
      role: s.role,
      isAdmin: s.isAdmin
    });

    if (result.success) {
      Logger.log('✅ ' + s.name);
      Logger.log('   ID: ' + result.id);
      Logger.log('   Email: ' + s.email);
      Logger.log('   Şifre: ' + result.plainPassword);
      Logger.log('   Role: ' + s.role + (s.isAdmin ? ' (ADMIN)' : ''));
      Logger.log('');
    } else {
      Logger.log('❌ ' + s.name + ' - Hata: ' + result.error);
    }

    results.push(result);
  });

  Logger.log('=== SETUP TAMAMLANDI ===');
  Logger.log('Toplam: ' + results.filter(function(r) { return r.success; }).length + ' personel oluşturuldu');

  return results;
}

/**
 * Debug: Sheet durumunu kontrol et
 */
function debugCheckSheets() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheets = ss.getSheets();

  Logger.log('=== SPREADSHEET SHEETS ===');
  sheets.forEach(function(sheet, index) {
    Logger.log((index + 1) + '. ' + sheet.getName() + ' (' + sheet.getLastRow() + ' satır)');
  });

  // Staff sheet kontrol
  var staffSheet = ss.getSheetByName('staff');
  if (staffSheet) {
    Logger.log('');
    Logger.log('=== STAFF SHEET İÇERİĞİ ===');
    var data = staffSheet.getDataRange().getValues();
    data.forEach(function(row, i) {
      Logger.log('Row ' + i + ': ' + JSON.stringify(row));
    });
  } else {
    Logger.log('');
    Logger.log('⚠️ Staff sheet bulunamadı!');
  }

  // Links sheet kontrol
  var linksSheet = ss.getSheetByName('links');
  if (linksSheet) {
    Logger.log('');
    Logger.log('=== LINKS SHEET İÇERİĞİ ===');
    var linksData = linksSheet.getDataRange().getValues();
    linksData.forEach(function(row, i) {
      Logger.log('Row ' + i + ': ' + JSON.stringify(row));
    });
  }

  return { sheets: sheets.map(function(s) { return s.getName(); }) };
}

/**
 * Test: Login akışını test et
 * Admin email ile şifre sıfırlayıp login dene
 */
function testLoginFlow() {
  var email = 'serdar.benli@kulahcioglu.com';

  // Önce personeli bul
  var staff = StaffService.getByEmail(email);
  if (!staff) {
    Logger.log('❌ ' + email + ' bulunamadı.');
    return;
  }

  Logger.log('=== PERSONEL BULUNDU ===');
  Logger.log('ID: ' + staff.id);
  Logger.log('Ad: ' + staff.name);
  Logger.log('Email: ' + staff.email);
  Logger.log('Role: ' + staff.role);
  Logger.log('isAdmin: ' + staff.isAdmin);
  Logger.log('');

  // Şifreyi sıfırla ve yeni şifre al
  var resetResult = StaffService.resetPassword(email);
  if (!resetResult.success) {
    Logger.log('❌ Şifre sıfırlama hatası: ' + resetResult.error);
    return;
  }

  Logger.log('=== ŞİFRE SIFIRLANDI ===');
  Logger.log('Yeni şifre: ' + resetResult.plainPassword);
  Logger.log('');

  // Login dene
  var loginResult = SessionAuthService.login(email, resetResult.plainPassword);

  if (loginResult.success) {
    Logger.log('=== LOGIN BAŞARILI ===');
    Logger.log('Token: ' + loginResult.token.substring(0, 8) + '...');
    Logger.log('Staff ID: ' + loginResult.staff.id);
    Logger.log('Staff Name: ' + loginResult.staff.name);
    Logger.log('isAdmin: ' + loginResult.staff.isAdmin);
    Logger.log('Expires: ' + new Date(loginResult.expiresAt).toISOString());
    Logger.log('');

    // Session'ı doğrula
    var validateResult = SessionAuthService.validateSession(loginResult.token);
    Logger.log('=== SESSION DOĞRULAMA ===');
    Logger.log('Valid: ' + validateResult.valid);
    if (validateResult.valid) {
      Logger.log('Staff: ' + validateResult.staff.name);
    }
  } else {
    Logger.log('❌ Login hatası: ' + loginResult.error);
  }

  return loginResult;
}

// --- Shifts Management ---
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
      return LockServiceWrapper.withLock(() => {
        const data = StorageService.getData();
        Object.keys(shiftsData).forEach(date => {
          if (!data.shifts[date]) {
            data.shifts[date] = {};
          }
          data.shifts[date] = shiftsData[date];
        });
        StorageService.saveData(data);

        // Audit log - vardiya değişiklikleri
        SheetStorageService.addAuditLog('SHIFTS_UPDATED', {
          datesModified: Object.keys(shiftsData),
          shiftsCount: Object.keys(shiftsData).length
        });

        return { success: true };
      });
    } catch (error) {
      SheetStorageService.addAuditLog('SHIFTS_UPDATE_FAILED', {
        error: error.toString()
      });
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

    Object.keys(shifts).forEach(date => {
      if (date.startsWith(month)) {
        monthShifts[date] = shifts[date];
      }
    });

    return { success: true, data: monthShifts };
  }
};

/**
 * Mevcut Staff sheet'teki personellere ID ve şifre üret
 * Google Sheets'te manuel eklenen personeller için çalıştır
 *
 * Sheet formatı: name, email, phone, role, isAdmin, active
 * Bu fonksiyon: id ve password sütunlarını doldurur
 */
function generateCredentialsForExistingStaff() {
  var sheet = StaffService.getSheet();
  var data = sheet.getDataRange().getValues();

  Logger.log('=== KREDENSİYAL ÜRETİMİ BAŞLIYOR ===');
  Logger.log('');

  var results = [];

  // Header satırını atla (i=1'den başla)
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var name = row[StaffService.COLUMNS.NAME];
    var email = row[StaffService.COLUMNS.EMAIL];
    var existingId = row[StaffService.COLUMNS.ID];
    var existingPassword = row[StaffService.COLUMNS.PASSWORD];

    if (!name || !email) {
      Logger.log('⚠️ Satır ' + (i+1) + ' atlandı - name veya email boş');
      continue;
    }

    var rowIndex = i + 1;
    var updated = false;
    var newId = existingId;
    var newPassword = null;

    // ID yoksa üret
    if (!existingId) {
      newId = StaffService.generateSecureId(name);
      sheet.getRange(rowIndex, StaffService.COLUMNS.ID + 1).setValue(newId);
      updated = true;
    }

    // Password yoksa üret
    if (!existingPassword) {
      var plainPassword = StaffService.generatePassword();
      var hashedPassword = StaffService.hashPassword(plainPassword);
      sheet.getRange(rowIndex, StaffService.COLUMNS.PASSWORD + 1).setValue(hashedPassword);
      newPassword = plainPassword;
      updated = true;
    }

    if (updated) {
      Logger.log('✅ ' + name);
      Logger.log('   Email: ' + email);
      if (!existingId) Logger.log('   Yeni ID: ' + newId);
      if (newPassword) Logger.log('   Yeni Şifre: ' + newPassword);
      Logger.log('');

      results.push({
        name: name,
        email: email,
        id: newId,
        plainPassword: newPassword
      });
    } else {
      Logger.log('⏭️ ' + name + ' - zaten ID ve şifre var');
    }
  }

  Logger.log('=== TAMAMLANDI ===');
  Logger.log('Güncellenen: ' + results.length + ' personel');

  return results;
}
