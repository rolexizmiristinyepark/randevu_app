// ==================== GOOGLE SHEETS STORAGE SERVICE ====================
// FAZ 2: PropertiesService limitlerini aşmak için Google Sheets tabanlı veri katmanı
// Bu dosyayı Google Apps Script projesine ekleyin

/**
 * Google Sheets tabanlı veri saklama servisi
 * PropertiesService'in 9KB-100KB limitini aşmak için tasarlandı
 *
 * Sheet Yapısı:
 * - Staff: id, name, phone, email, active, createdAt
 * - Shifts: date, staffId, shiftType, createdAt
 * - Settings: key, value, updatedAt
 * - AuditLog: timestamp, action, data, userId (opsiyonel)
 *
 * @namespace SheetStorageService
 */
const SheetStorageService = {
  // Spreadsheet ID - Script Properties'den yüklenecek
  _spreadsheetId: null,
  _spreadsheet: null,

  // Sheet isimleri
  SHEET_NAMES: {
    STAFF: 'Staff',
    SHIFTS: 'Shifts',
    SETTINGS: 'Settings',
    AUDIT_LOG: 'AuditLog'
  },

  // Header tanımları
  HEADERS: {
    STAFF: ['id', 'name', 'phone', 'email', 'active', 'createdAt'],
    SHIFTS: ['date', 'staffId', 'shiftType', 'createdAt'],
    SETTINGS: ['key', 'value', 'updatedAt'],
    AUDITLOG: ['timestamp', 'action', 'data', 'userId']
  },

  // ==================== INITIALIZATION ====================

  /**
   * Spreadsheet ID'yi Script Properties'den yükle
   * @private
   */
  _loadSpreadsheetId: function() {
    if (!this._spreadsheetId) {
      const props = PropertiesService.getScriptProperties();
      this._spreadsheetId = props.getProperty('SHEETS_DATABASE_ID');

      if (!this._spreadsheetId) {
        throw new Error('KRİTİK: SHEETS_DATABASE_ID Script Properties\'de tanımlı değil! ' +
          'Google Sheets\'te yeni bir Spreadsheet oluşturun ve ID\'sini Script Properties\'e ekleyin.');
      }
    }
    return this._spreadsheetId;
  },

  /**
   * Spreadsheet objesini al (lazy loading)
   * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
   */
  getSpreadsheet: function() {
    if (!this._spreadsheet) {
      const id = this._loadSpreadsheetId();
      this._spreadsheet = SpreadsheetApp.openById(id);

      if (!this._spreadsheet) {
        throw new Error('Spreadsheet açılamadı. ID: ' + id);
      }
    }
    return this._spreadsheet;
  },

  /**
   * Sheet'i al veya oluştur (with headers)
   * @param {string} sheetName - Sheet adı
   * @returns {GoogleAppsScript.Spreadsheet.Sheet}
   */
  getOrCreateSheet: function(sheetName) {
    const ss = this.getSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      // Sheet yok, oluştur
      sheet = ss.insertSheet(sheetName);

      // Header'ları ekle
      const headers = this.HEADERS[sheetName.toUpperCase()] || this.HEADERS[sheetName];
      if (headers) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
        sheet.setFrozenRows(1);
      }

      log.info('Yeni sheet oluşturuldu:', sheetName);
    }

    return sheet;
  },

  /**
   * Veritabanını initialize et (tüm sheet'leri oluştur)
   * Manuel olarak bir kez çalıştırılmalı
   * @returns {{success: boolean, message: string}}
   */
  initializeDatabase: function() {
    try {
      const ss = this.getSpreadsheet();

      // Tüm sheet'leri oluştur
      Object.values(this.SHEET_NAMES).forEach(sheetName => {
        this.getOrCreateSheet(sheetName);
      });

      log.info('Veritabanı initialize edildi');
      return { success: true, message: 'Veritabanı başarıyla oluşturuldu' };
    } catch (error) {
      log.error('Veritabanı initialization hatası:', error);
      return { success: false, error: error.toString() };
    }
  },

  // ==================== GENERIC CRUD OPERATIONS ====================

  /**
   * Sheet'ten tüm verileri oku (header hariç)
   * @param {string} sheetName - Sheet adı
   * @returns {Array<Object>} - Objeler dizisi
   */
  readAll: function(sheetName) {
    const sheet = this.getOrCreateSheet(sheetName);
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) return []; // Sadece header var

    const headers = data[0];
    return data.slice(1).map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      return obj;
    });
  },

  /**
   * Sheet'e yeni satır ekle
   * @param {string} sheetName - Sheet adı
   * @param {Object} rowData - Eklenecek veri
   * @returns {Object} - Eklenen veri (id ile birlikte)
   */
  appendRow: function(sheetName, rowData) {
    const sheet = this.getOrCreateSheet(sheetName);
    const headers = this.HEADERS[sheetName.toUpperCase()] || this.HEADERS[sheetName];

    // Header sırasına göre değerleri diziye çevir
    const values = headers.map(header => rowData[header] ?? '');

    sheet.appendRow(values);
    return rowData;
  },

  /**
   * Sheet'teki tüm verileri değiştir (header korunur)
   * @param {string} sheetName - Sheet adı
   * @param {Array<Object>} dataArray - Yeni veri dizisi
   */
  replaceAll: function(sheetName, dataArray) {
    const sheet = this.getOrCreateSheet(sheetName);
    const headers = this.HEADERS[sheetName.toUpperCase()] || this.HEADERS[sheetName];

    // Null/undefined kontrolü
    if (!headers) {
      throw new Error('Headers bulunamadı: ' + sheetName);
    }
    if (!dataArray || !Array.isArray(dataArray)) {
      console.log('dataArray boş veya geçersiz, atlanıyor:', sheetName);
      return;
    }

    // Mevcut verileri temizle (header hariç)
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clear();
    }

    if (dataArray.length === 0) return;

    // Yeni verileri yaz
    const rows = dataArray.map(obj =>
      headers.map(header => (obj && obj[header] !== undefined) ? obj[header] : '')
    );

    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  },

  /**
   * Belirli bir satırı güncelle (id bazlı)
   * @param {string} sheetName - Sheet adı
   * @param {string} idColumn - ID kolonu adı
   * @param {*} idValue - Aranacak ID değeri
   * @param {Object} newData - Güncellenecek veriler
   * @returns {boolean} - Güncelleme başarılı mı
   */
  updateById: function(sheetName, idColumn, idValue, newData) {
    const sheet = this.getOrCreateSheet(sheetName);
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) return false;

    const headers = data[0];
    const idColIndex = headers.indexOf(idColumn);

    if (idColIndex === -1) return false;

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idColIndex]) === String(idValue)) {
        // Satırı güncelle
        headers.forEach((header, colIndex) => {
          if (newData.hasOwnProperty(header)) {
            sheet.getRange(i + 1, colIndex + 1).setValue(newData[header]);
          }
        });
        return true;
      }
    }

    return false;
  },

  /**
   * Belirli bir satırı sil (id bazlı)
   * @param {string} sheetName - Sheet adı
   * @param {string} idColumn - ID kolonu adı
   * @param {*} idValue - Silinecek ID değeri
   * @returns {boolean} - Silme başarılı mı
   */
  deleteById: function(sheetName, idColumn, idValue) {
    const sheet = this.getOrCreateSheet(sheetName);
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) return false;

    const headers = data[0];
    const idColIndex = headers.indexOf(idColumn);

    if (idColIndex === -1) return false;

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idColIndex]) === String(idValue)) {
        sheet.deleteRow(i + 1);
        return true;
      }
    }

    return false;
  },

  // ==================== STAFF OPERATIONS ====================

  /**
   * Tüm staff listesini getir
   * @returns {Array<Object>} Staff listesi
   */
  getStaff: function() {
    const staff = this.readAll(this.SHEET_NAMES.STAFF);

    // Boolean dönüşümü (Sheet'ten string olarak gelebilir)
    return staff.map(s => ({
      ...s,
      id: parseInt(s.id) || s.id,
      active: s.active === true || s.active === 'true' || s.active === 'TRUE'
    }));
  },

  /**
   * Staff listesini kaydet (tümünü değiştir)
   * @param {Array<Object>} staffList - Staff listesi
   */
  saveStaff: function(staffList) {
    // Null/undefined kontrolü
    if (!staffList || !Array.isArray(staffList)) {
      console.log('staffList boş veya geçersiz');
      return;
    }

    // createdAt ekle (yoksa)
    const now = new Date().toISOString();
    const enrichedList = staffList.map(s => ({
      ...s,
      createdAt: s.createdAt || now
    }));

    this.replaceAll(this.SHEET_NAMES.STAFF, enrichedList);
  },

  /**
   * Yeni staff ekle
   * @param {Object} staff - Staff objesi
   * @returns {Object} Eklenen staff
   */
  addStaff: function(staff) {
    const existingStaff = this.getStaff();
    const maxId = existingStaff.length > 0
      ? Math.max(...existingStaff.map(s => parseInt(s.id) || 0))
      : 0;

    const newStaff = {
      id: maxId + 1,
      name: staff.name || '',
      phone: staff.phone || '',
      email: staff.email || '',
      active: true,
      createdAt: new Date().toISOString()
    };

    this.appendRow(this.SHEET_NAMES.STAFF, newStaff);
    return newStaff;
  },

  // ==================== SHIFTS OPERATIONS ====================

  /**
   * Tüm shift'leri getir
   * @returns {Object} Shifts objesi { 'YYYY-MM-DD': { staffId: 'shiftType' } }
   */
  getShifts: function() {
    const rawShifts = this.readAll(this.SHEET_NAMES.SHIFTS);

    // Sheet formatından eski formata dönüştür
    const shifts = {};
    rawShifts.forEach(shift => {
      if (!shift.date) return;

      if (!shifts[shift.date]) {
        shifts[shift.date] = {};
      }
      shifts[shift.date][shift.staffId] = shift.shiftType;
    });

    return shifts;
  },

  /**
   * Shifts'leri kaydet
   * @param {Object} shiftsData - Format: { 'YYYY-MM-DD': { staffId: 'morning|evening|full' } }
   */
  saveShifts: function(shiftsData) {
    // Null/undefined kontrolü
    if (!shiftsData || typeof shiftsData !== 'object') {
      console.log('shiftsData boş veya geçersiz');
      return;
    }

    const now = new Date().toISOString();

    // Obje formatından array formatına dönüştür
    const shiftRows = [];
    Object.keys(shiftsData).forEach(date => {
      const dateShifts = shiftsData[date];
      if (dateShifts && typeof dateShifts === 'object') {
        Object.keys(dateShifts).forEach(staffId => {
          shiftRows.push({
            date: date,
            staffId: staffId,
            shiftType: dateShifts[staffId],
            createdAt: now
          });
        });
      }
    });

    this.replaceAll(this.SHEET_NAMES.SHIFTS, shiftRows);
  },

  /**
   * Belirli tarihlerin shift'lerini güncelle (merge)
   * @param {Object} newShiftsData - Güncellenecek shift'ler
   */
  updateShifts: function(newShiftsData) {
    const existingShifts = this.getShifts();

    // Mevcut verilerle birleştir
    Object.keys(newShiftsData).forEach(date => {
      existingShifts[date] = newShiftsData[date];
    });

    this.saveShifts(existingShifts);
  },

  /**
   * Belirli bir ayın shift'lerini getir
   * @param {string} month - YYYY-MM formatında ay
   * @returns {Object} Shifts objesi
   */
  getMonthShifts: function(month) {
    const allShifts = this.getShifts();
    const monthShifts = {};

    Object.keys(allShifts).forEach(date => {
      if (date.startsWith(month)) {
        monthShifts[date] = allShifts[date];
      }
    });

    return monthShifts;
  },

  // ==================== SETTINGS OPERATIONS ====================

  /**
   * Tüm settings'leri getir
   * @returns {Object} Settings objesi
   */
  getSettings: function() {
    const rawSettings = this.readAll(this.SHEET_NAMES.SETTINGS);

    // Array formatından obje formatına dönüştür
    const settings = {};
    rawSettings.forEach(s => {
      // JSON değerleri parse et
      try {
        settings[s.key] = JSON.parse(s.value);
      } catch (e) {
        settings[s.key] = s.value;
      }
    });

    // Varsayılan değerler
    return {
      interval: settings.interval || 60,
      maxDaily: settings.maxDaily || 4,
      ...settings
    };
  },

  /**
   * Settings'leri kaydet
   * @param {Object} settingsData - Settings objesi
   */
  saveSettings: function(settingsData) {
    // Null/undefined kontrolü
    if (!settingsData || typeof settingsData !== 'object') {
      console.log('settingsData boş veya geçersiz');
      return;
    }

    const now = new Date().toISOString();

    // Obje formatından array formatına dönüştür
    const settingRows = Object.keys(settingsData).map(key => ({
      key: key,
      value: typeof settingsData[key] === 'object'
        ? JSON.stringify(settingsData[key])
        : String(settingsData[key]),
      updatedAt: now
    }));

    this.replaceAll(this.SHEET_NAMES.SETTINGS, settingRows);
  },

  /**
   * Tek bir setting'i güncelle
   * @param {string} key - Setting anahtarı
   * @param {*} value - Setting değeri
   */
  setSetting: function(key, value) {
    const settings = this.getSettings();
    settings[key] = value;
    this.saveSettings(settings);
  },

  // ==================== AUDIT LOG OPERATIONS ====================

  /**
   * Audit log kaydı ekle
   * @param {string} action - Yapılan aksiyon
   * @param {Object} data - Log verisi
   * @param {string} userId - Kullanıcı ID (opsiyonel)
   */
  addAuditLog: function(action, data, userId) {
    this.appendRow(this.SHEET_NAMES.AUDIT_LOG, {
      timestamp: new Date().toISOString(),
      action: action,
      data: typeof data === 'object' ? JSON.stringify(data) : String(data),
      userId: userId || 'system'
    });
  },

  // ==================== COMPATIBILITY LAYER ====================
  // Mevcut StorageService API'si ile uyumluluk için

  /**
   * Mevcut StorageService.getData() uyumlu fonksiyon
   * @returns {Object} { staff, shifts, settings }
   */
  getData: function() {
    return {
      staff: this.getStaff(),
      shifts: this.getShifts(),
      settings: this.getSettings()
    };
  },

  /**
   * Mevcut StorageService.saveData() uyumlu fonksiyon
   * @param {Object} data - { staff, shifts, settings }
   */
  saveData: function(data) {
    if (data.staff) this.saveStaff(data.staff);
    if (data.shifts) this.saveShifts(data.shifts);
    if (data.settings) this.saveSettings(data.settings);

    // Audit log
    this.addAuditLog('DATA_SAVE', {
      staffCount: data.staff?.length,
      shiftsCount: Object.keys(data.shifts || {}).length
    });
  },

  /**
   * Veriyi sıfırla ve varsayılan değerleri yükle
   * @returns {{success: boolean, message: string}}
   */
  resetData: function() {
    try {
      // Varsayılan staff
      const defaultStaff = [
        { id: 1, name: 'Serdar Benli', phone: '', email: '', active: true },
        { id: 2, name: 'Ece Argun', phone: '', email: '', active: true },
        { id: 3, name: 'Gökhan Tokol', phone: '', email: '', active: true },
        { id: 4, name: 'Sırma', phone: '', email: '', active: true },
        { id: 5, name: 'Gamze', phone: '', email: '', active: true },
        { id: 6, name: 'Okan', phone: '', email: '', active: true }
      ];

      const defaultSettings = {
        interval: 60,
        maxDaily: 4
      };

      this.saveStaff(defaultStaff);
      this.saveShifts({});
      this.saveSettings(defaultSettings);

      this.addAuditLog('DATA_RESET', { reason: 'Manual reset' });

      return { success: true, message: 'Veriler sıfırlandı ve varsayılan değerler yüklendi' };
    } catch (error) {
      return { success: false, error: error.toString() };
    }
  }
};

// ==================== MIGRATION UTILITIES ====================

/**
 * PropertiesService'den Google Sheets'e veri migrationı
 * BU FONKSİYONU SADECE BİR KEZ ÇALIŞTIRIN!
 * @returns {{success: boolean, message: string, data?: Object}}
 */
function migratePropertiesToSheets() {
  try {
    const props = PropertiesService.getScriptProperties();
    const oldDataJson = props.getProperty('RANDEVU_DATA');

    if (!oldDataJson) {
      return {
        success: false,
        message: 'PropertiesService\'de veri bulunamadı (RANDEVU_DATA key\'i yok)'
      };
    }

    const oldData = JSON.parse(oldDataJson);
    console.log('Parsed data keys:', Object.keys(oldData));

    // Veritabanını initialize et
    SheetStorageService.initializeDatabase();
    console.log('Database initialized');

    // Staff'ı migrate et
    console.log('Staff migrating... Type:', typeof oldData.staff, 'IsArray:', Array.isArray(oldData.staff));
    if (oldData.staff && Array.isArray(oldData.staff) && oldData.staff.length > 0) {
      SheetStorageService.saveStaff(oldData.staff);
      console.log('Staff migrate edildi:', oldData.staff.length, 'kayıt');
    }

    // Shifts'i migrate et
    console.log('Shifts migrating... Type:', typeof oldData.shifts);
    if (oldData.shifts && typeof oldData.shifts === 'object' && Object.keys(oldData.shifts).length > 0) {
      SheetStorageService.saveShifts(oldData.shifts);
      console.log('Shifts migrate edildi:', Object.keys(oldData.shifts).length, 'gün');
    }

    // Settings'i migrate et
    console.log('Settings migrating... Type:', typeof oldData.settings);
    if (oldData.settings && typeof oldData.settings === 'object') {
      SheetStorageService.saveSettings(oldData.settings);
      console.log('Settings migrate edildi');
    }

    // Audit log
    SheetStorageService.addAuditLog('MIGRATION_COMPLETE', {
      source: 'PropertiesService',
      staffCount: oldData.staff?.length || 0,
      shiftsCount: Object.keys(oldData.shifts || {}).length,
      settings: oldData.settings
    });

    // Backup olarak eski veriyi sakla
    props.setProperty('RANDEVU_DATA_BACKUP_' + Date.now(), oldDataJson);

    return {
      success: true,
      message: 'Migration başarılı! PropertiesService verisi Google Sheets\'e taşındı.',
      data: {
        staffCount: oldData.staff?.length || 0,
        shiftsCount: Object.keys(oldData.shifts || {}).length,
        hasSettings: !!oldData.settings
      }
    };

  } catch (error) {
    log.error('Migration hatası:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Migration sonrası doğrulama
 * Sheets verisini PropertiesService verisiyle karşılaştırır
 * @returns {{success: boolean, message: string, comparison?: Object}}
 */
function verifyMigration() {
  try {
    const props = PropertiesService.getScriptProperties();
    const oldDataJson = props.getProperty('RANDEVU_DATA');

    if (!oldDataJson) {
      return { success: true, message: 'PropertiesService\'de veri yok, karşılaştırma yapılamadı' };
    }

    const oldData = JSON.parse(oldDataJson);
    const newData = SheetStorageService.getData();

    const comparison = {
      staff: {
        old: oldData.staff?.length || 0,
        new: newData.staff?.length || 0,
        match: (oldData.staff?.length || 0) === (newData.staff?.length || 0)
      },
      shifts: {
        old: Object.keys(oldData.shifts || {}).length,
        new: Object.keys(newData.shifts || {}).length,
        match: Object.keys(oldData.shifts || {}).length === Object.keys(newData.shifts || {}).length
      },
      settings: {
        old: oldData.settings,
        new: newData.settings,
        match: JSON.stringify(oldData.settings) === JSON.stringify(newData.settings)
      }
    };

    const allMatch = comparison.staff.match && comparison.shifts.match && comparison.settings.match;

    return {
      success: allMatch,
      message: allMatch
        ? 'Migration doğrulandı! Tüm veriler eşleşiyor.'
        : 'UYARI: Bazı veriler eşleşmiyor, detayları kontrol edin.',
      comparison: comparison
    };

  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Migration sonrası eski veriyi temizle
 * SADECE verifyMigration() başarılı olduktan sonra çalıştırın!
 * @returns {{success: boolean, message: string}}
 */
function cleanupOldPropertiesData() {
  try {
    // Önce doğrulama yap
    const verification = verifyMigration();
    if (!verification.success) {
      return {
        success: false,
        message: 'Migration doğrulanmadı, temizlik yapılmadı. Önce verileri kontrol edin.',
        verification: verification
      };
    }

    const props = PropertiesService.getScriptProperties();

    // Eski veriyi sil
    props.deleteProperty('RANDEVU_DATA');

    SheetStorageService.addAuditLog('CLEANUP_COMPLETE', {
      deletedKey: 'RANDEVU_DATA',
      timestamp: new Date().toISOString()
    });

    return {
      success: true,
      message: 'Eski PropertiesService verisi temizlendi. Artık Google Sheets kullanılıyor.'
    };

  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// STORAGE_FEATURE_FLAG artık Storage.js'de tanımlı
