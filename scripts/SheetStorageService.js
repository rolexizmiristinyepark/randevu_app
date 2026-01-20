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

  // Sheet isimleri (v3.10.0 - lowercase unified structure)
  SHEET_NAMES: {
    STAFF: 'staff',
    SHIFTS: 'shifts',
    SETTINGS: 'settings',
    AUDIT_LOG: 'audit_log',
    MESSAGE_LOG: 'message_log',
    SESSIONS: 'sessions',
    APPOINTMENTS: 'appointments',
    LINKS: 'links',
    NOTIFICATION_FLOWS: 'notification_flows',
    WHATSAPP_TEMPLATES: 'whatsapp_templates',
    MAIL_TEMPLATES: 'mail_templates',
    MAIL_INFO_CARDS: 'mail_info_cards',
    DAILY_TASKS: 'daily_tasks'
  },

  // Header tanımları (v3.10.0)
  HEADERS: {
    staff: ['id', 'name', 'phone', 'email', 'active', 'createdAt'],
    shifts: ['date', 'staffId', 'shiftType', 'createdAt'],
    settings: ['key', 'value', 'updatedAt'],
    audit_log: ['timestamp', 'action', 'data', 'userId'],
    message_log: ['id', 'timestamp', 'direction', 'appointmentId', 'phone', 'recipientName', 'templateName', 'templateId', 'status', 'messageId', 'errorMessage', 'staffId', 'staffName', 'staffPhone', 'flowId', 'triggeredBy', 'profile', 'messageContent', 'targetType', 'customerName', 'customerPhone'],
    sessions: ['token', 'odaSifresi', 'staffId', 'staffName', 'staffEmail', 'role', 'permissions', 'createdAt', 'expiresAt'],
    notification_flows: ['id', 'name', 'description', 'trigger', 'profiles', 'whatsappTemplateIds', 'mailTemplateIds', 'active', 'createdAt', 'updatedAt'],
    whatsapp_templates: ['id', 'name', 'content', 'variables', 'active', 'createdAt', 'updatedAt'],
    mail_templates: ['id', 'name', 'subject', 'body', 'recipient', 'infoCardId', 'createdAt', 'updatedAt'],
    mail_info_cards: ['id', 'name', 'fields', 'createdAt', 'updatedAt'],
    daily_tasks: ['id', 'name', 'schedule', 'action', 'params', 'active', 'lastRun', 'createdAt']
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

  /**
   * Sheet header'larını HEADERS constant ile senkronize et
   * Eksik kolonları sheet'in sonuna ekler (mevcut veriyi korur)
   * @param {string} sheetName - Sheet adı
   * @returns {{success: boolean, message: string, addedColumns?: string[]}}
   */
  syncSheetHeaders: function(sheetName) {
    try {
      const ss = this.getSpreadsheet();
      const sheet = ss.getSheetByName(sheetName);

      if (!sheet) {
        return { success: false, error: 'Sheet bulunamadı: ' + sheetName };
      }

      const expectedHeaders = this.HEADERS[sheetName.toUpperCase()] || this.HEADERS[sheetName];
      if (!expectedHeaders) {
        return { success: false, error: 'Header tanımı bulunamadı: ' + sheetName };
      }

      const data = sheet.getDataRange().getValues();
      if (data.length === 0) {
        // Boş sheet - tüm header'ları ekle
        sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
        sheet.getRange(1, 1, 1, expectedHeaders.length).setFontWeight('bold');
        sheet.setFrozenRows(1);
        return { success: true, message: 'Boş sheet\'e header eklendi', addedColumns: expectedHeaders };
      }

      // Mevcut header'ları al ve trim et
      const currentHeaders = data[0].map(h => String(h).trim());

      // Eksik header'ları bul
      const missingHeaders = expectedHeaders.filter(h => !currentHeaders.includes(h));

      if (missingHeaders.length === 0) {
        return { success: true, message: 'Tüm header\'lar mevcut', addedColumns: [] };
      }

      // Eksik header'ları sheet'in sonuna ekle
      const lastCol = currentHeaders.length;
      missingHeaders.forEach((header, index) => {
        const colIndex = lastCol + index + 1;
        // Header'ı ekle
        sheet.getRange(1, colIndex).setValue(header).setFontWeight('bold');

        // Veri satırları için boş değer ekle
        if (data.length > 1) {
          const emptyValues = new Array(data.length - 1).fill(['']);
          sheet.getRange(2, colIndex, data.length - 1, 1).setValues(emptyValues);
        }
      });

      log.info('syncSheetHeaders - Eksik kolonlar eklendi:', { sheetName, missingHeaders });
      return {
        success: true,
        message: missingHeaders.length + ' kolon eklendi: ' + missingHeaders.join(', '),
        addedColumns: missingHeaders
      };
    } catch (error) {
      log.error('syncSheetHeaders hatası:', error);
      return { success: false, error: error.toString() };
    }
  },

  /**
   * Tüm tanımlı sheet'lerin header'larını senkronize et
   * @returns {{success: boolean, results: Object}}
   */
  syncAllSheetHeaders: function() {
    try {
      const results = {};
      const sheetsToSync = ['mail_templates', 'mail_info_cards', 'message_log', 'notification_flows'];

      sheetsToSync.forEach(sheetName => {
        const actualSheetName = this.SHEET_NAMES[sheetName] || sheetName;
        results[sheetName] = this.syncSheetHeaders(actualSheetName);
      });

      log.info('syncAllSheetHeaders tamamlandı:', results);
      return { success: true, results };
    } catch (error) {
      log.error('syncAllSheetHeaders hatası:', error);
      return { success: false, error: error.toString() };
    }
  },

  /**
   * Sheet'e header satırı ekle (varolan veriyi kaydırır)
   * Header olmayan sheet'leri düzeltmek için kullanılır
   * @param {string} sheetName - Sheet adı
   * @returns {{success: boolean, message: string}}
   */
  ensureHeaders: function(sheetName) {
    try {
      const ss = this.getSpreadsheet();
      const sheet = ss.getSheetByName(sheetName);

      if (!sheet) {
        return { success: false, error: 'Sheet bulunamadı: ' + sheetName };
      }

      const expectedHeaders = this.HEADERS[sheetName.toUpperCase()] || this.HEADERS[sheetName];
      if (!expectedHeaders) {
        return { success: false, error: 'Header tanımı bulunamadı: ' + sheetName };
      }

      const data = sheet.getDataRange().getValues();
      if (data.length === 0) {
        // Boş sheet - header ekle
        sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
        sheet.getRange(1, 1, 1, expectedHeaders.length).setFontWeight('bold');
        sheet.setFrozenRows(1);
        return { success: true, message: 'Boş sheet\'e header eklendi' };
      }

      const firstRow = data[0];

      // İlk satır header mı kontrol et (ilk sütun 'id' mi?)
      if (firstRow[0] === expectedHeaders[0]) {
        return { success: true, message: 'Header zaten mevcut' };
      }

      // Header yok - en üste header satırı ekle
      sheet.insertRowBefore(1);
      sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
      sheet.getRange(1, 1, 1, expectedHeaders.length).setFontWeight('bold');
      sheet.setFrozenRows(1);

      log.info('Header eklendi:', sheetName);
      return { success: true, message: 'Header satırı eklendi, veri kaydırıldı' };
    } catch (error) {
      log.error('ensureHeaders hatası:', error);
      return { success: false, error: error.toString() };
    }
  },

  /**
   * mail_info_cards sheet'ini düzelt (header + veri temizliği)
   * Manuel olarak bir kez çalıştırılmalı
   * @returns {{success: boolean, message: string}}
   */
  fixMailInfoCardsSheet: function() {
    try {
      const sheetName = 'mail_info_cards';
      const ss = this.getSpreadsheet();
      let sheet = ss.getSheetByName(sheetName);

      if (!sheet) {
        // Sheet yok, oluştur
        this.getOrCreateSheet(sheetName);
        return { success: true, message: 'Sheet oluşturuldu' };
      }

      // Sheet'i tamamen temizle ve header ekle
      sheet.clear();
      const headers = this.HEADERS.MAIL_INFO_CARDS;
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      sheet.setFrozenRows(1);

      log.info('MAIL_INFO_CARDS sheet temizlendi ve header eklendi');
      return { success: true, message: 'MAIL_INFO_CARDS sheet sıfırlandı. Yeni bilgi kartları oluşturabilirsiniz.' };
    } catch (error) {
      log.error('fixMailInfoCardsSheet hatası:', error);
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

    // Header'ları trim et (gizli boşlukları temizle)
    const headers = data[0].map(h => String(h).trim());
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
   * ✅ v3.9.47: Eksik kolonları otomatik ekler (syncSheetHeaders)
   * @param {string} sheetName - Sheet adı
   * @param {string} idColumn - ID kolonu adı
   * @param {*} idValue - Aranacak ID değeri
   * @param {Object} newData - Güncellenecek veriler
   * @returns {boolean} - Güncelleme başarılı mı
   */
  updateById: function(sheetName, idColumn, idValue, newData) {
    const sheet = this.getOrCreateSheet(sheetName);
    let data = sheet.getDataRange().getValues();

    if (data.length <= 1) return false;

    let headers = data[0].map(h => String(h).trim());
    const idColIndex = headers.indexOf(idColumn);

    if (idColIndex === -1) return false;

    // ✅ v3.9.47: Eksik kolonları kontrol et ve ekle
    const newDataKeys = Object.keys(newData);
    const missingKeys = newDataKeys.filter(key => !headers.includes(key));

    if (missingKeys.length > 0) {
      log.info('updateById - Eksik kolonlar tespit edildi:', { sheetName, missingKeys });

      // syncSheetHeaders ile eksik kolonları ekle
      const syncResult = this.syncSheetHeaders(sheetName);
      if (syncResult.success && syncResult.addedColumns && syncResult.addedColumns.length > 0) {
        log.info('updateById - Kolonlar eklendi:', syncResult.addedColumns);

        // Sheet verilerini yeniden oku (yeni kolonlarla birlikte)
        data = sheet.getDataRange().getValues();
        headers = data[0].map(h => String(h).trim());
      }
    }

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idColIndex]) === String(idValue)) {
        // Satırı güncelle
        headers.forEach((header, colIndex) => {
          if (newData.hasOwnProperty(header)) {
            sheet.getRange(i + 1, colIndex + 1).setValue(newData[header]);
          }
        });
        log.info('updateById - Güncelleme başarılı:', { sheetName, idValue, updatedKeys: newDataKeys });
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

  // ==================== GENERIC CRUD ALIASES ====================
  // Mail.js ve diğer modüller için kullanışlı alias'lar

  /**
   * Bir sheet'teki tüm kayıtları getir
   * @param {string} sheetName - Sheet adı
   * @returns {Array<Object>} - Tüm kayıtlar
   */
  getAll: function(sheetName) {
    return this.readAll(sheetName);
  },

  /**
   * Yeni kayıt ekle
   * @param {string} sheetName - Sheet adı
   * @param {Object} data - Eklenecek veri
   * @returns {Object} - Eklenen veri
   */
  add: function(sheetName, data) {
    return this.appendRow(sheetName, data);
  },

  /**
   * Kayıt güncelle (id bazlı)
   * @param {string} sheetName - Sheet adı
   * @param {string} id - Kayıt ID'si
   * @param {Object} updates - Güncellenecek alanlar
   * @returns {boolean} - Başarı durumu
   */
  update: function(sheetName, id, updates) {
    return this.updateById(sheetName, 'id', id, updates);
  },

  /**
   * Kayıt sil (id bazlı)
   * @param {string} sheetName - Sheet adı
   * @param {string} id - Silinecek kayıt ID'si
   * @returns {boolean} - Başarı durumu
   */
  delete: function(sheetName, id) {
    return this.deleteById(sheetName, 'id', id);
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

  // ==================== MESSAGE LOG OPERATIONS ====================

  /**
   * WhatsApp mesaj logu ekle
   * @param {Object} messageData - Mesaj verisi
   * @returns {Object} Eklenen mesaj logu
   */
  addMessageLog: function(messageData) {
    const id = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const logEntry = {
      id: id,
      timestamp: new Date().toISOString(),
      direction: messageData.direction || 'outgoing',
      appointmentId: messageData.appointmentId || '',
      phone: messageData.phone || '',
      recipientName: messageData.recipientName || '',
      templateName: messageData.templateName || '',
      templateId: messageData.templateId || '',
      status: messageData.status || 'sent',
      messageId: messageData.messageId || '',
      errorMessage: messageData.errorMessage || '',
      staffId: messageData.staffId || '',
      staffName: messageData.staffName || '',
      staffPhone: messageData.staffPhone || '',
      flowId: messageData.flowId || '',
      triggeredBy: messageData.triggeredBy || 'manual',
      profile: messageData.profile || '',
      // v3.10.10: Mesaj içeriği eklendi
      messageContent: messageData.messageContent || '',
      // v3.10.19: targetType, customerName, customerPhone eklendi
      targetType: messageData.targetType || '', // 'customer' veya 'staff'
      customerName: messageData.customerName || '',
      customerPhone: messageData.customerPhone || ''
    };

    this.appendRow(this.SHEET_NAMES.MESSAGE_LOG, logEntry);
    return logEntry;
  },

  /**
   * Mesaj durumunu güncelle (webhook'tan gelen bilgi ile)
   * @param {string} messageId - WhatsApp mesaj ID
   * @param {string} status - Yeni durum (delivered, read, failed)
   * @param {string} errorMessage - Hata mesajı (opsiyonel)
   * @returns {boolean} Güncelleme başarılı mı
   */
  updateMessageStatus: function(messageId, status, errorMessage) {
    const sheet = this.getOrCreateSheet(this.SHEET_NAMES.MESSAGE_LOG);
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) return false;

    const headers = data[0];
    const messageIdColIndex = headers.indexOf('messageId');
    const statusColIndex = headers.indexOf('status');
    const errorColIndex = headers.indexOf('errorMessage');

    if (messageIdColIndex === -1 || statusColIndex === -1) return false;

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][messageIdColIndex]) === String(messageId)) {
        sheet.getRange(i + 1, statusColIndex + 1).setValue(status);
        if (errorMessage && errorColIndex !== -1) {
          sheet.getRange(i + 1, errorColIndex + 1).setValue(errorMessage);
        }
        return true;
      }
    }

    return false;
  },

  /**
   * Mesaj loglarını getir
   * @param {Object} options - Filtreleme seçenekleri
   * @param {string} options.appointmentId - Randevu ID'sine göre filtrele
   * @param {string} options.phone - Telefon numarasına göre filtrele
   * @param {string} options.status - Duruma göre filtrele
   * @param {number} options.limit - Maksimum kayıt sayısı (varsayılan: 100)
   * @param {number} options.offset - Başlangıç indeksi (varsayılan: 0)
   * @returns {Array<Object>} Mesaj logları
   */
  getMessageLogs: function(options) {
    options = options || {};
    const limit = options.limit || 100;
    const offset = options.offset || 0;

    let logs = this.readAll(this.SHEET_NAMES.MESSAGE_LOG);

    // Tarihe göre sırala (en yeniden en eskiye)
    logs.sort(function(a, b) {
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

    // Filtreleme
    if (options.appointmentId) {
      logs = logs.filter(function(log) {
        return log.appointmentId === options.appointmentId;
      });
    }

    if (options.phone) {
      logs = logs.filter(function(log) {
        return log.phone && log.phone.includes(options.phone);
      });
    }

    if (options.status) {
      logs = logs.filter(function(log) {
        return log.status === options.status;
      });
    }

    // v3.10.10: direction filtresi (incoming/outgoing)
    if (options.direction) {
      logs = logs.filter(function(log) {
        return log.direction === options.direction;
      });
    }

    // Pagination
    return logs.slice(offset, offset + limit);
  },

  /**
   * Belirli bir randevu için mesaj geçmişini getir
   * @param {string} appointmentId - Randevu ID
   * @returns {Array<Object>} Mesaj geçmişi
   */
  getAppointmentMessages: function(appointmentId) {
    return this.getMessageLogs({ appointmentId: appointmentId, limit: 50 });
  },

  /**
   * Belirli bir telefon numarası için mesaj geçmişini getir
   * @param {string} phone - Telefon numarası
   * @returns {Array<Object>} Mesaj geçmişi
   */
  getPhoneMessages: function(phone) {
    return this.getMessageLogs({ phone: phone, limit: 50 });
  },

  /**
   * Mesaj istatistiklerini getir (son 24 saat, 7 gün, 30 gün)
   * @returns {Object} İstatistikler
   */
  getMessageStats: function() {
    const logs = this.readAll(this.SHEET_NAMES.MESSAGE_LOG);
    const now = new Date();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const stats = {
      last24h: { total: 0, sent: 0, delivered: 0, read: 0, failed: 0 },
      last7d: { total: 0, sent: 0, delivered: 0, read: 0, failed: 0 },
      last30d: { total: 0, sent: 0, delivered: 0, read: 0, failed: 0 },
      byTemplate: {},
      byProfile: {}
    };

    logs.forEach(function(log) {
      const logDate = new Date(log.timestamp);
      const status = log.status || 'sent';

      // Son 30 gün
      if (logDate >= thirtyDaysAgo) {
        stats.last30d.total++;
        stats.last30d[status] = (stats.last30d[status] || 0) + 1;

        // Template istatistikleri
        if (log.templateName) {
          if (!stats.byTemplate[log.templateName]) {
            stats.byTemplate[log.templateName] = { total: 0, sent: 0, delivered: 0, read: 0, failed: 0 };
          }
          stats.byTemplate[log.templateName].total++;
          stats.byTemplate[log.templateName][status] = (stats.byTemplate[log.templateName][status] || 0) + 1;
        }

        // Profil istatistikleri
        if (log.profile) {
          if (!stats.byProfile[log.profile]) {
            stats.byProfile[log.profile] = { total: 0, sent: 0, delivered: 0, read: 0, failed: 0 };
          }
          stats.byProfile[log.profile].total++;
          stats.byProfile[log.profile][status] = (stats.byProfile[log.profile][status] || 0) + 1;
        }

        // Son 7 gün
        if (logDate >= sevenDaysAgo) {
          stats.last7d.total++;
          stats.last7d[status] = (stats.last7d[status] || 0) + 1;

          // Son 24 saat
          if (logDate >= oneDayAgo) {
            stats.last24h.total++;
            stats.last24h[status] = (stats.last24h[status] || 0) + 1;
          }
        }
      }
    });

    return stats;
  },

  // ==================== MESSAGE LOG RETENTION (KVKK) ====================

  /**
   * KVKK: Eski mesaj loglarını anonimleştir (30 gün sonra)
   * Telefon numarası ve kişi bilgileri anonimleştirilir
   * @returns {{success: boolean, anonymizedCount: number, cutoffDate: string}}
   */
  cleanupOldMessageLogs: function() {
    try {
      const RETENTION_DAYS = 30; // KVKK uyumu: 30 gün saklama süresi
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

      const sheet = this.getOrCreateSheet(this.SHEET_NAMES.MESSAGE_LOG);
      const data = sheet.getDataRange().getValues();

      if (data.length <= 1) {
        return { success: true, anonymizedCount: 0, cutoffDate: cutoffDate.toISOString() };
      }

      const headers = data[0];
      const timestampIdx = headers.indexOf('timestamp');
      const phoneIdx = headers.indexOf('phone');
      const recipientNameIdx = headers.indexOf('recipientName');
      const staffNameIdx = headers.indexOf('staffName');

      let anonymizedCount = 0;

      // 2. satırdan itibaren (header atla)
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const timestamp = new Date(row[timestampIdx]);

        // Cutoff'tan eski kayıtlar
        if (timestamp < cutoffDate) {
          const phone = row[phoneIdx];

          // Zaten anonimleştirilmiş mi kontrol et
          if (phone && phone !== '[Anonimleştirildi]') {
            // Telefon numarasını anonimleştir
            sheet.getRange(i + 1, phoneIdx + 1).setValue('[Anonimleştirildi]');

            // Alıcı adını anonimleştir (sadece ilk harf)
            if (recipientNameIdx >= 0 && row[recipientNameIdx]) {
              const initial = row[recipientNameIdx].substring(0, 1);
              sheet.getRange(i + 1, recipientNameIdx + 1).setValue(initial + '***');
            }

            // Personel adını anonimleştir
            if (staffNameIdx >= 0 && row[staffNameIdx]) {
              const staffInitial = row[staffNameIdx].substring(0, 1);
              sheet.getRange(i + 1, staffNameIdx + 1).setValue(staffInitial + '***');
            }

            anonymizedCount++;
          }
        }
      }

      log.info('MessageLog retention completed:', {
        anonymizedCount: anonymizedCount,
        cutoffDate: cutoffDate.toISOString()
      });

      return {
        success: true,
        anonymizedCount: anonymizedCount,
        cutoffDate: cutoffDate.toISOString()
      };

    } catch (error) {
      log.error('MessageLog retention error:', error);
      return {
        success: false,
        error: error.toString()
      };
    }
  },

  /**
   * Dry-run: Anonimleştirilecek mesaj loglarını say (silmeden)
   * @returns {{success: boolean, count: number, cutoffDate: string}}
   */
  previewMessageLogCleanup: function() {
    try {
      const RETENTION_DAYS = 30;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

      const logs = this.readAll(this.SHEET_NAMES.MESSAGE_LOG);

      const toAnonymize = logs.filter(function(log) {
        const logDate = new Date(log.timestamp);
        return logDate < cutoffDate && log.phone && log.phone !== '[Anonimleştirildi]';
      });

      return {
        success: true,
        count: toAnonymize.length,
        cutoffDate: cutoffDate.toISOString()
      };

    } catch (error) {
      return {
        success: false,
        error: error.toString()
      };
    }
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

// ==================== MESSAGE LOG INITIALIZATION ====================

/**
 * MessageLog Sheet'ini oluştur (v4.0)
 * Apps Script editöründen bu fonksiyonu çalıştırarak MessageLog sheet'ini oluşturabilirsiniz
 * @returns {{success: boolean, message: string}}
 */
function initializeMessageLogSheet() {
  try {
    const sheet = SheetStorageService.getOrCreateSheet(SheetStorageService.SHEET_NAMES.MESSAGE_LOG);
    console.log('MessageLog sheet oluşturuldu/kontrol edildi:', sheet.getName());

    // Header'ları kontrol et
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    console.log('Mevcut headers:', headers);

    return {
      success: true,
      message: 'MessageLog sheet hazır',
      sheetName: sheet.getName(),
      headers: headers
    };
  } catch (error) {
    console.error('initializeMessageLogSheet error:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Test: Manuel mesaj logu ekle
 * @returns {{success: boolean, data?: Object}}
 */
function testAddMessageLog() {
  try {
    const testLog = SheetStorageService.addMessageLog({
      direction: 'outgoing',
      appointmentId: 'TEST_EVENT_123',
      phone: '905321234567',
      recipientName: 'Test Müşteri',
      templateName: 'test_template',
      templateId: 'tmpl_001',
      status: 'sent',
      messageId: 'wamid.TEST123456',
      staffId: '',
      staffName: '',
      flowId: 'flow_001',
      triggeredBy: 'manual_test',
      profile: 'g'
    });

    console.log('Test log eklendi:', testLog);
    return { success: true, data: testLog };
  } catch (error) {
    console.error('testAddMessageLog error:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Test: Mesaj loglarını getir
 * @returns {{success: boolean, data?: Array}}
 */
function testGetMessageLogs() {
  try {
    const logs = SheetStorageService.getMessageLogs({ limit: 10 });
    console.log('Son 10 mesaj logu:', logs);
    return { success: true, data: logs, count: logs.length };
  } catch (error) {
    console.error('testGetMessageLogs error:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Test: Mesaj istatistiklerini getir
 * @returns {{success: boolean, data?: Object}}
 */
function testGetMessageStats() {
  try {
    const stats = SheetStorageService.getMessageStats();
    console.log('Mesaj istatistikleri:', stats);
    return { success: true, data: stats };
  } catch (error) {
    console.error('testGetMessageStats error:', error);
    return { success: false, error: error.toString() };
  }
}

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

// ==================== HEADER SYNC UTILITIES ====================

/**
 * v3.10.1: Tüm Mail sheet'lerinin header'larını senkronize et
 * Apps Script editöründen bu fonksiyonu çalıştırarak
 * eksik kolonları (örn: infoCardId) sheet'lere ekleyebilirsiniz
 * @returns {{success: boolean, results: Object}}
 */
function syncAllMailSheetHeaders() {
  try {
    const results = {
      mail_templates: SheetStorageService.syncSheetHeaders('mail_templates'),
      mail_info_cards: SheetStorageService.syncSheetHeaders('mail_info_cards'),
      notification_flows: SheetStorageService.syncSheetHeaders('notification_flows')
    };

    console.log('syncAllMailSheetHeaders sonuçları:', JSON.stringify(results, null, 2));

    return {
      success: true,
      results: results,
      message: 'Header senkronizasyonu tamamlandı'
    };
  } catch (error) {
    console.error('syncAllMailSheetHeaders hatası:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * v3.10.1: notification_flows sheet'inin header'larını kontrol et ve eksikleri listele
 * Debug için kullanışlı
 * @returns {{success: boolean, data: Object}}
 */
function debugNotificationFlowsHeaders() {
  try {
    const ss = SheetStorageService.getSpreadsheet();
    const sheet = ss.getSheetByName('notification_flows');

    if (!sheet) {
      return { success: false, error: 'notification_flows sheet bulunamadı' };
    }

    const data = sheet.getDataRange().getValues();
    const currentHeaders = data.length > 0 ? data[0].map(h => String(h).trim()) : [];
    const expectedHeaders = SheetStorageService.HEADERS.notification_flows;

    const missing = expectedHeaders.filter(h => !currentHeaders.includes(h));
    const extra = currentHeaders.filter(h => !expectedHeaders.includes(h) && h !== '');

    const result = {
      success: true,
      data: {
        currentHeaders: currentHeaders,
        expectedHeaders: expectedHeaders,
        missingHeaders: missing,
        extraHeaders: extra,
        rowCount: data.length - 1 // header hariç
      }
    };

    console.log('debugNotificationFlowsHeaders:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('debugNotificationFlowsHeaders hatası:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * message_log sheet header'larını senkronize et
 * Eksik kolonları otomatik ekler
 * @returns {{success: boolean, message: string, addedColumns?: string[]}}
 */
function syncMessageLogHeaders() {
  try {
    const result = SheetStorageService.syncSheetHeaders('message_log');
    console.log('syncMessageLogHeaders sonucu:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('syncMessageLogHeaders hatası:', error);
    return { success: false, error: error.toString() };
  }
}

// STORAGE_FEATURE_FLAG artık Storage.js'de tanımlı
