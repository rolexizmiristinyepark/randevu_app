/**
 * WhatsApp.gs
 *
 * WhatsApp Business API Integration Service
 *
 * This module handles WhatsApp message sending, appointment reminders,
 * and WhatsApp settings management using Meta WhatsApp Cloud API.
 *
 * Services:
 * - WhatsAppService: WhatsApp message operations and reminder management
 *
 * Dependencies:
 * - Config.gs (CONFIG)
 * - Calendar.gs (CalendarService, DateUtils)
 * - Storage.gs (StorageService)
 * - Staff.gs (Utils)
 * - Auth.gs (AuthService)
 * - Settings.gs (loadExternalConfigs)
 * - Security.gs (log)
 */

// ==================== WHATSAPP WEBHOOK HANDLER ====================
/**
 * WhatsApp Webhook Handler
 * Meta WhatsApp Cloud API'dan gelen delivery status güncellemelerini işler
 * Status types: sent, delivered, read, failed
 * @param {Object} webhookData - Meta'dan gelen webhook verisi
 */
function handleWhatsAppWebhook(webhookData) {
  try {
    if (!webhookData.entry || !Array.isArray(webhookData.entry)) {
      console.log('Invalid webhook data: no entry array');
      return;
    }

    for (const entry of webhookData.entry) {
      if (!entry.changes || !Array.isArray(entry.changes)) continue;

      for (const change of entry.changes) {
        if (change.field !== 'messages') continue;

        const value = change.value;
        if (!value) continue;

        // Status updates
        if (value.statuses && Array.isArray(value.statuses)) {
          for (const status of value.statuses) {
            const messageId = status.id;
            const statusType = status.status; // sent, delivered, read, failed
            const timestamp = status.timestamp;
            const recipientId = status.recipient_id;

            // Error handling for failed messages
            let errorMessage = '';
            if (status.errors && status.errors.length > 0) {
              errorMessage = status.errors.map(e => e.message || e.title).join('; ');
            }

            // Update message status in MessageLog sheet
            try {
              const updated = SheetStorageService.updateMessageStatus(messageId, statusType, errorMessage);
              if (updated) {
                console.log(`Message status updated: ${messageId} -> ${statusType}`);
              }
            } catch (updateError) {
              console.error('Failed to update message status:', updateError);
            }
          }
        }

        // Incoming messages - v3.10.12: Mesaj içeriği kaydediliyor (7 gün sonra otomatik silinecek - KVKK uyumlu)
        if (value.messages && Array.isArray(value.messages)) {
          for (const message of value.messages) {
            try {
              // Mesaj içeriğini al (text, image caption, vb.)
              let messageContent = '';
              if (message.type === 'text' && message.text) {
                messageContent = message.text.body || '';
              } else if (message.type === 'image' && message.image) {
                messageContent = '[Resim]' + (message.image.caption ? ': ' + message.image.caption : '');
              } else if (message.type === 'video' && message.video) {
                messageContent = '[Video]' + (message.video.caption ? ': ' + message.video.caption : '');
              } else if (message.type === 'audio') {
                messageContent = '[Ses Mesajı]';
              } else if (message.type === 'document' && message.document) {
                messageContent = '[Dosya]: ' + (message.document.filename || 'dosya');
              } else if (message.type === 'location' && message.location) {
                messageContent = '[Konum]: ' + message.location.latitude + ', ' + message.location.longitude;
              } else if (message.type === 'contacts') {
                messageContent = '[Kişi Paylaşımı]';
              } else if (message.type === 'sticker') {
                messageContent = '[Çıkartma]';
              } else {
                messageContent = '[' + (message.type || 'Bilinmeyen') + ']';
              }

              // Gönderen bilgisi (contacts dizisinden)
              let senderName = '';
              if (value.contacts && value.contacts.length > 0) {
                const contact = value.contacts.find(c => c.wa_id === message.from);
                if (contact && contact.profile) {
                  senderName = contact.profile.name || '';
                }
              }

              SheetStorageService.addMessageLog({
                direction: 'incoming',
                phone: message.from || '',
                recipientName: senderName,
                templateName: message.type || 'text',
                templateId: '',
                status: 'received',
                messageId: message.id || '',
                triggeredBy: 'webhook',
                messageContent: messageContent
              });

              console.log('Incoming message logged: ' + message.from + ' - ' + message.type);
            } catch (logError) {
              console.error('Failed to log incoming message:', logError);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('handleWhatsAppWebhook error:', error);
  }
}

// ==================== KVKK UYUMLU OTOMATİK TEMİZLİK ====================
/**
 * v3.10.12: 7 günden eski mesaj içeriklerini siler (KVKK uyumlu veri minimizasyonu)
 * Bu fonksiyon günlük trigger ile çalıştırılmalıdır:
 * Apps Script > Triggers > Add Trigger > cleanupOldMessageContent > Time-driven > Day timer
 */
function cleanupOldMessageContent() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('whatsapp_message_log');

    if (!sheet) {
      console.log('cleanupOldMessageContent: whatsapp_message_log sheet bulunamadı');
      return { success: false, error: 'Sheet not found' };
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // Sütun indexlerini bul
    const timestampCol = headers.indexOf('timestamp');
    const contentCol = headers.indexOf('messageContent');
    const directionCol = headers.indexOf('direction');

    if (timestampCol === -1 || contentCol === -1) {
      console.log('cleanupOldMessageContent: Gerekli sütunlar bulunamadı');
      return { success: false, error: 'Required columns not found' };
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    let cleanedCount = 0;

    // 7 günden eski incoming mesajların içeriğini temizle
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const timestamp = row[timestampCol];
      const content = row[contentCol];
      const direction = row[directionCol];

      // Sadece incoming mesajları temizle (gönderilen template mesajlar kalabilir)
      if (direction === 'incoming' && content && content !== '[Silindi - KVKK]') {
        let rowDate;
        if (timestamp instanceof Date) {
          rowDate = timestamp;
        } else if (typeof timestamp === 'string') {
          rowDate = new Date(timestamp);
        } else {
          continue;
        }

        if (rowDate < sevenDaysAgo) {
          // İçeriği temizle, kaydı silme (audit trail için)
          sheet.getRange(i + 1, contentCol + 1).setValue('[Silindi - KVKK]');
          cleanedCount++;
        }
      }
    }

    console.log('cleanupOldMessageContent: ' + cleanedCount + ' mesaj içeriği temizlendi');
    return { success: true, cleanedCount: cleanedCount };
  } catch (error) {
    console.error('cleanupOldMessageContent error:', error);
    return { success: false, error: error.message };
  }
}

// ==================== DEBUG SHEET LOG ====================
/**
 * 🔍 DEBUG: Sheet'e log yazar (doPost içinde bile çalışır!)
 * Google Sheets'te "FlowDebugLog" sheet'i oluşturur ve oraya yazar
 * @param {string} message - Log mesajı
 * @param {Object} data - Opsiyonel data objesi
 */
function debugSheetLog(message, data) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let sheet = ss.getSheetByName('FlowDebugLog');

    // Sheet yoksa oluştur
    if (!sheet) {
      sheet = ss.insertSheet('FlowDebugLog');
      sheet.appendRow(['Timestamp', 'Message', 'Data']);
    }

    // En son 100 satırı tut (performans için)
    const lastRow = sheet.getLastRow();
    if (lastRow > 100) {
      sheet.deleteRows(2, lastRow - 100);
    }

    // Log yaz
    const timestamp = new Date().toISOString();
    const dataStr = data ? JSON.stringify(data) : '';
    sheet.appendRow([timestamp, message, dataStr]);
  } catch (e) {
    // Sheet log hatası ana işlemi etkilemesin
    console.error('debugSheetLog error:', e);
  }
}

/**
 * Debug loglarını oku (API endpoint)
 * @param {number} limit - Kaç satır döndürülsün (default: 50)
 * @returns {Object} { success: true, data: [...] }
 */
function getDebugLogs(limit) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('FlowDebugLog');

    if (!sheet) {
      return { success: true, data: [], message: 'FlowDebugLog sheet bulunamadı' };
    }

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return { success: true, data: [], message: 'Log yok' };
    }

    const numRows = Math.min(limit || 50, lastRow - 1);
    const startRow = Math.max(2, lastRow - numRows + 1);
    const data = sheet.getRange(startRow, 1, numRows, 3).getValues();

    // En yeniden eskiye sırala
    const logs = data.reverse().map(row => ({
      timestamp: row[0],
      message: row[1],
      data: row[2]
    }));

    return { success: true, data: logs };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * 🧪 TEST FUNCTION - Apps Script editöründen çalıştır
 * Flow sistemini test eder - GENEL profil ile APPOINTMENT_CREATE tetikler
 *
 * KULLANIM:
 * 1. Apps Script editörüne git
 * 2. testFlowTrigger fonksiyonunu seç
 * 3. Çalıştır butonuna bas
 * 4. Execution Log'da sonucu gör
 */
function testFlowTrigger() {
  Logger.log('=== TEST FLOW TRIGGER START ===');

  // v3.6: Dinamik olarak ilk aktif staff'ı bul
  const allStaff = StaffService.getAll();
  const activeStaff = allStaff.find(s => s.active && s.phone);

  if (!activeStaff) {
    Logger.log('❌ Aktif ve telefonu olan staff bulunamadı!');
    return;
  }

  Logger.log('📋 Test için kullanılacak staff: id=' + activeStaff.id + ', name=' + activeStaff.name);

  // Test event data - GENEL profilden gelen randevu simülasyonu
  const testEventData = {
    eventId: 'TEST_EVENT_' + new Date().getTime(),
    customerName: 'Pınar Benli',
    customerPhone: '905323112522',
    customerEmail: 'serdarbenliauth@gmail.com',
    staffId: activeStaff.id,  // v3.6: Dinamik 8-karakterli secure ID
    staffName: activeStaff.name,
    appointmentDate: '15 Aralık 2025',
    appointmentTime: '11:00',
    appointmentType: 'Görüşme',
    linkType: 'general',
    profile: 'g'  // GENEL profil - Flow'da seçili olmalı
  };

  Logger.log('Test eventData: ' + JSON.stringify(testEventData));

  try {
    // 1. Flow'ları kontrol et
    const flowsResult = getWhatsAppFlows();
    Logger.log('📋 Flows: ' + JSON.stringify(flowsResult));

    // 2. Template'leri kontrol et
    const templatesResult = getWhatsAppTemplates();
    Logger.log('📋 Templates: ' + JSON.stringify(templatesResult));

    // 3. Flow tetikle
    Logger.log('🚀 Triggering flow...');
    const result = triggerFlowForEvent('APPOINTMENT_CREATE', testEventData);
    Logger.log('✅ triggerFlowForEvent result: ' + JSON.stringify(result));
  } catch (error) {
    Logger.log('❌ ERROR: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
  }

  Logger.log('=== TEST FLOW TRIGGER END ===');
}

/**
 * TEST: Okan Üstündağ'a personel bildirimi gönder
 * Apps Script editöründe bu fonksiyonu çalıştır
 */
function testOkanNotification() {
  Logger.log('=== TEST OKAN NOTIFICATION START ===');

  // 1. Okan'ı bul
  const allStaff = StaffService.getAll();
  const okan = allStaff.find(s => s.name && s.name.toLowerCase().includes('okan'));

  if (!okan) {
    Logger.log('❌ Okan bulunamadı!');
    return;
  }

  Logger.log('✅ Okan bulundu: id=' + okan.id + ', phone=' + okan.phone);

  // 2. personel_bildirim template'ini bul
  const templatesResult = getWhatsAppTemplates();
  const staffTemplate = templatesResult.data.find(t => t.name === 'personel_bildirim');

  if (!staffTemplate) {
    Logger.log('❌ personel_bildirim template bulunamadı!');
    return;
  }

  Logger.log('✅ Template bulundu: ' + staffTemplate.name + ', targetType=' + staffTemplate.targetType);

  // 3. Okan'a mesaj gönder
  const testEventData = {
    eventId: 'TEST_OKAN_' + new Date().getTime(),
    customerName: 'Test Müşteri',
    customerPhone: '905551234567',
    customerEmail: 'test@test.com',
    staffId: okan.id,
    staffName: okan.name,
    appointmentDate: '17 Aralık 2025',
    appointmentTime: '15:00',
    appointmentType: 'Görüşme',
    linkType: 'general',
    profile: 'g'
  };

  Logger.log('🚀 Sending to Okan with eventData.staffId=' + testEventData.staffId);

  const result = processFlowTemplate(staffTemplate, testEventData);
  Logger.log('📋 Result: ' + JSON.stringify(result));

  Logger.log('=== TEST OKAN NOTIFICATION END ===');
}

/**
 * TEST: Gerçek randevu gibi triggerFlowForEvent'i test et
 * Bu fonksiyon tam olarak createAppointment'ın yaptığını simüle eder
 */
function testRealAppointmentFlow() {
  Logger.log('=== TEST REAL APPOINTMENT FLOW START ===');

  // 1. Okan'ı bul (gerçek randevudaki gibi)
  const allStaff = StaffService.getAll();
  const okan = allStaff.find(s => s.name && s.name.toLowerCase().includes('okan'));

  if (!okan) {
    Logger.log('❌ Okan bulunamadı!');
    return;
  }

  Logger.log('✅ Staff: id=' + okan.id + ', name=' + okan.name);

  // 2. Tam olarak createAppointment'ın gönderdiği eventData
  const eventData = {
    eventId: 'TEST_REAL_' + new Date().getTime(),
    customerName: 'Test Müşteri',
    customerPhone: '905323112522',
    customerEmail: 'test@test.com',
    staffId: okan.id,  // u80o4071
    staffName: okan.name,
    appointmentDate: '17 Aralık 2025',
    appointmentTime: '16:00',
    appointmentType: 'Görüşme',
    linkType: 'general',
    profile: 'g'  // genel profil = 'g'
  };

  Logger.log('📋 eventData: ' + JSON.stringify(eventData));

  // 3. triggerFlowForEvent çağır (createAppointment'ın yaptığı gibi)
  Logger.log('🚀 Calling triggerFlowForEvent("APPOINTMENT_CREATE", eventData)...');
  const result = triggerFlowForEvent('APPOINTMENT_CREATE', eventData);
  Logger.log('📋 triggerFlowForEvent result: ' + JSON.stringify(result));

  Logger.log('=== TEST REAL APPOINTMENT FLOW END ===');
}

/**
 * DEBUG: Staff template gönderimini test et
 * Apps Script editöründe bu fonksiyonu çalıştır
 */
function debugStaffNotification() {
  Logger.log('=== DEBUG STAFF NOTIFICATION START ===');

  // 1. Tüm staff'ı getir
  const allStaff = StaffService.getAll();
  Logger.log('📋 All Staff (' + allStaff.length + '):');
  allStaff.forEach((s, i) => {
    Logger.log('  [' + i + '] id=' + s.id + ', name=' + s.name + ', phone=' + s.phone + ', active=' + s.active);
  });

  // 2. personel_bildirim template'ini bul
  const templatesResult = getWhatsAppTemplates();
  Logger.log('📋 Templates result: ' + JSON.stringify(templatesResult.success));

  const staffTemplate = templatesResult.data.find(t => t.name === 'personel_bildirim');
  if (staffTemplate) {
    Logger.log('✅ personel_bildirim template BULUNDU:');
    Logger.log('   id: ' + staffTemplate.id);
    Logger.log('   targetType: ' + staffTemplate.targetType);
    Logger.log('   language: ' + staffTemplate.language);
  } else {
    Logger.log('❌ personel_bildirim template BULUNAMADI!');
  }

  // 3. Test: staffId=1 için getStaffById (eski format)
  const staff1 = getStaffById('1');
  Logger.log('📋 getStaffById("1"): ' + JSON.stringify(staff1));

  // 3b. "Okan Üstündağ" personelini bul ve ID'sini test et
  const okan = allStaff.find(s => s.name && s.name.toLowerCase().includes('okan'));
  if (okan) {
    Logger.log('📋 Okan bulundu: id=' + okan.id + ', name=' + okan.name + ', phone=' + okan.phone);
    const okanById = getStaffById(okan.id);
    Logger.log('📋 getStaffById("' + okan.id + '"): ' + JSON.stringify(okanById));
  } else {
    Logger.log('❌ Okan bulunamadı!');
  }

  // 4. İlk aktif staff'ı bul ve test et
  const activeStaff = allStaff.find(s => s.active && s.phone);
  if (activeStaff) {
    Logger.log('✅ Aktif staff bulundu: ' + activeStaff.name + ', phone: ' + activeStaff.phone);

    // 5. Bu staff için manuel processFlowTemplate test
    if (staffTemplate) {
      const testEventData = {
        eventId: 'DEBUG_TEST',
        customerName: 'Test Müşteri',
        customerPhone: '905551234567',
        staffId: activeStaff.id,
        staffName: activeStaff.name,
        appointmentDate: '15 Aralık 2025',
        appointmentTime: '14:00',
        appointmentType: 'Görüşme',
        profile: 'staff'
      };

      Logger.log('🚀 Manuel processFlowTemplate testi...');
      Logger.log('   eventData.staffId: ' + testEventData.staffId);

      const result = processFlowTemplate(staffTemplate, testEventData);
      Logger.log('📋 processFlowTemplate result: ' + JSON.stringify(result));
    }
  } else {
    Logger.log('❌ Aktif ve telefonu olan staff bulunamadı!');
  }

  Logger.log('=== DEBUG STAFF NOTIFICATION END ===');
}

// --- WhatsApp Service ---
/**
 * WhatsApp Business API integration service
 * Handles WhatsApp message sending, reminders, and settings management
 * @namespace WhatsAppService
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

        // WhatsApp Web linki (eski link formatı - artık sadece görüntüleme için)
        const message = `Sayın ${customerName}, ${timeStr}'teki ${staffName} ile ${appointmentTypeName} randevunuz var.`;
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
   * Send WhatsApp message using dynamic template from admin panel
   * YENİ: Recipient sistemi - Template'in recipient ayarlarına göre gönderim yapar
   * @param {Object} appointmentData - Randevu verileri
   * @param {Object} template - Kullanılacak template (opsiyonel, yoksa ilk aktif template kullanılır)
   * @returns {{success: boolean, sent: number, failed: number, results: Array}}
   */
  sendWhatsAppMessageWithTemplate: function(appointmentData, template) {
    try {
      // Config kontrolü
      if (!CONFIG.WHATSAPP_PHONE_NUMBER_ID || !CONFIG.WHATSAPP_ACCESS_TOKEN) {
        throw new Error('WhatsApp API ayarları yapılmamış! WHATSAPP_PHONE_NUMBER_ID ve WHATSAPP_ACCESS_TOKEN gerekli.');
      }

      // Template yoksa aktif template'lerden ilkini al
      if (!template) {
        const activeTemplates = WhatsAppTemplateService.getActiveTemplates();
        if (activeTemplates.length === 0) {
          return { success: false, error: 'Aktif WhatsApp template bulunamadı. Admin panelinden template ekleyin.' };
        }
        template = activeTemplates[0];
      }

      // YENİ: Recipient sistemi - Template'de recipient tanımlanmışsa o sistemi kullan
      if (template.recipientType && template.recipientTarget) {
        return this._sendToMultipleRecipients(appointmentData, template);
      }

      // VARSAYILAN: Recipient tanımlanmamışsa müşteriye gönder (eski template'ler için)
      const defaultTemplate = {
        ...template,
        recipientType: 'individual',
        recipientTarget: 'customer',
        recipientList: []
      };
      return this._sendToMultipleRecipients(appointmentData, defaultTemplate);

    } catch (error) {
      log.error('sendWhatsAppMessageWithTemplate hatası:', error);
      return {
        success: false,
        error: error.toString()
      };
    }
  },

  /**
   * YENİ: Template recipient ayarlarına göre çoklu alıcıya gönderim
   * @param {Object} appointmentData - Randevu verileri
   * @param {Object} template - Template verisi
   * @returns {{success: boolean, sent: number, failed: number, results: Array}}
   */
  _sendToMultipleRecipients: function(appointmentData, template) {
    try {
      const recipients = this._getTemplateRecipients(template, appointmentData);
      
      if (recipients.length === 0) {
        return { success: false, sent: 0, failed: 0, error: 'Alıcı bulunamadı', results: [] };
      }

      // 🔒 KVKV: Kişisel veri loglama - sadece sayı bilgisi
      log.info('Çoklu gönderim başlatıldı:', { template: template.name, recipientCount: recipients.length });

      let sentCount = 0;
      let failedCount = 0;
      const results = [];

      // Her alıcıya gönder
      for (var i = 0; i < recipients.length; i++) {
        var recipient = recipients[i];
        var result = this._sendToSingleRecipient(appointmentData, template, recipient.phone);

        if (result.success) {
          sentCount++;
          // 🔒 KVKV: Telefon ve isim loglanmıyor, sadece durum
          results.push({
            recipient: this._maskPersonalData(recipient.name),
            phone: this._maskPhoneNumber(recipient.phone),
            role: recipient.role || '',
            status: 'sent',
            messageId: result.messageId,
            timestamp: new Date().toISOString()
          });
        } else {
          failedCount++;
          results.push({
            recipient: this._maskPersonalData(recipient.name),
            phone: this._maskPhoneNumber(recipient.phone),
            role: recipient.role || '',
            status: 'failed',
            error: result.error,
            timestamp: new Date().toISOString()
          });
        }

        // 🔒 GÜVENLİK: Rate limiting artırıldı
        Utilities.sleep(200); // 200ms (eskiden 150ms)
      }

      // 🔒 KVKV: Sadece sayısal bilgi logla
      log.info('Çoklu gönderim tamamlandı:', { sentCount, failedCount, templateUsed: template.name });

      return {
        success: sentCount > 0,
        sent: sentCount,
        failed: failedCount,
        total: recipients.length,
        template: template.name,
        results: results
      };

    } catch (error) {
      log.error('_sendToMultipleRecipients hatası:', error);
      return {
        success: false,
        sent: 0,
        failed: 0,
        error: error.toString(),
        results: []
      };
    }
  },

  /**
   * YENİ: Template'in recipient ayarlarından alıcı listesi oluştur
   * @param {Object} template - Template verisi
   * @param {Object} appointmentData - Randevu verileri (müşteri dahil etmek için)
   * @returns {Array} Alıcı listesi [{name, phone, role}]
   */
  _getTemplateRecipients: function(template, appointmentData) {
    const recipients = [];

    try {
      // Staff verilerini al
      const data = StorageService.getData();
      const staffList = data.staff || [];

      if (template.recipientType === 'individual') {
        if (template.recipientTarget === 'staff') {
          // Seçili personellere gönder
          const selectedStaffIds = template.recipientList || [];
          
          for (var i = 0; i < selectedStaffIds.length; i++) {
            var staffId = selectedStaffIds[i];
            var staff = staffList.find(function(s) { return s.id === staffId; });
            
            if (staff && staff.phone) {
              var cleanPhone = staff.phone.replace(/\D/g, '');
              if (cleanPhone) {
                cleanPhone = cleanPhone.startsWith('0') ? '90' + cleanPhone.substring(1) : cleanPhone;
                recipients.push({
                  name: staff.name,
                  phone: cleanPhone,
                  role: staff.role || 'staff',
                  type: 'staff',
                  id: staff.id
                });
              }
            }
          }
        } else if (template.recipientTarget === 'customer') {
          // Müşteriye gönder
          const customerPhone = appointmentData.customerPhone || appointmentData.phone || '';
          const cleanPhone = customerPhone.replace(/[^0-9]/g, '');
          
          if (cleanPhone) {
            recipients.push({
              name: appointmentData.customerName || 'Değerli Müşterimiz',
              phone: cleanPhone.startsWith('0') ? '90' + cleanPhone.substring(1) : cleanPhone,
              role: 'customer',
              type: 'customer'
            });
          }
        }
      } else if (template.recipientType === 'team') {
        // Role bazında ekibe gönder
        const targetRole = template.recipientTarget; // 'ADMIN', 'SALES', 'RECEPTION'
        
        for (var i = 0; i < staffList.length; i++) {
          var staff = staffList[i];
          var staffRole = (staff.role || '').toUpperCase();
          
          if (staffRole === targetRole && staff.phone) {
            var cleanPhone = staff.phone.replace(/\D/g, '');
            if (cleanPhone) {
              cleanPhone = cleanPhone.startsWith('0') ? '90' + cleanPhone.substring(1) : cleanPhone;
              recipients.push({
                name: staff.name,
                phone: cleanPhone,
                role: staff.role || 'staff',
                type: 'team',
                id: staff.id
              });
            }
          }
        }
      }

      log.info('Template recipients oluşturuldu:', { 
        recipientType: template.recipientType, 
        recipientTarget: template.recipientTarget, 
        count: recipients.length 
      });

    } catch (error) {
      log.error('_getTemplateRecipients hatası:', error);
    }

    return recipients;
  },

  /**
   * Tek bir alıcıya WhatsApp mesajı gönder
   * @param {Object} appointmentData - Randevu verileri
   * @param {Object} template - Template verisi
   * @param {string} phone - Telefon numarası
   * @returns {{success: boolean, messageId?: string, error?: string}}
   */
  _sendToSingleRecipient: function(appointmentData, template, phone) {
    try {
      // Telefon numarasını string'e çevir ve temizle (sadece rakamlar)
      const phoneStr = String(phone || '');
      let cleanPhone = phoneStr.replace(/[^0-9]/g, '');

      if (!cleanPhone) {
        return { success: false, error: 'Telefon numarası bulunamadı' };
      }

      // WhatsApp API için telefon formatı düzeltmesi
      // 05XXXXXXXXX -> 905XXXXXXXXX (Türkiye formatı)
      if (cleanPhone.startsWith('0') && cleanPhone.length === 11) {
        cleanPhone = '9' + cleanPhone; // 05XX -> 905XX
      }
      // 5XXXXXXXXX -> 905XXXXXXXXX (10 haneli, 0 olmadan)
      else if (cleanPhone.startsWith('5') && cleanPhone.length === 10) {
        cleanPhone = '90' + cleanPhone;
      }

      console.log(`[_sendToSingleRecipient] Original phone: ${phoneStr}, Clean phone: ${cleanPhone}`);

      // Meta WhatsApp Cloud API endpoint
      const url = `https://graph.facebook.com/${CONFIG.WHATSAPP_API_VERSION}/${CONFIG.WHATSAPP_PHONE_NUMBER_ID}/messages`;

      // Template parametrelerini oluştur
      const parameters = WhatsAppTemplateService.buildTemplateParameters(template, appointmentData);

      // WhatsApp template components
      const components = [
        {
          type: "body",
          parameters: parameters
        }
      ];

      // WhatsApp template payload
      // v3.10.14: Use metaTemplateName for Meta API, fallback to name for backwards compatibility
      const metaTemplateName = template.metaTemplateName || template.name;
      const payload = {
        messaging_product: 'whatsapp',
        to: cleanPhone,
        type: 'template',
        template: {
          name: metaTemplateName, // Meta Business'taki template adı (metaTemplateName)
          language: { code: template.language || 'en' }, // Template'in WhatsApp Business'taki dili
          components: components
        }
      };

      // API çağrısı
      const options = {
        method: 'post',
        contentType: 'application/json',
        headers: { 'Authorization': `Bearer ${CONFIG.WHATSAPP_ACCESS_TOKEN}` },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };

      const response = UrlFetchApp.fetch(url, options);
      const responseCode = response.getResponseCode();
      const responseData = JSON.parse(response.getContentText());

      if (responseCode === 200) {
        const messageId = responseData.messages[0].id;

        // v3.10.19: Mesaj içeriğini template content'ten oluştur (değişkenleri doldurarak)
        let messageContent = '';
        if (template.content) {
          // Template content'indeki {{1}}, {{2}} gibi placeholders'ları değerlerle değiştir
          messageContent = template.content;
          parameters.forEach((p, index) => {
            const placeholder = '{{' + (index + 1) + '}}';
            messageContent = messageContent.replace(placeholder, p.text || '');
          });
        } else {
          // Fallback: parametrelerden oluştur (eski davranış)
          messageContent = parameters.map(p => p.text || '').join(' | ');
        }

        // MESSAGE_LOG: Başarılı gönderimi logla
        try {
          // v3.10.19: targetType'a göre recipientName belirle
          const isCustomerMessage = template.targetType === 'customer';
          SheetStorageService.addMessageLog({
            direction: 'outgoing',
            appointmentId: appointmentData.eventId || '',
            phone: cleanPhone,
            recipientName: isCustomerMessage ? appointmentData.customerName : appointmentData.staffName || '',
            templateName: template.name,
            templateId: template.id || '',
            status: 'sent',
            messageId: messageId,
            staffId: appointmentData.staffId || '',
            staffName: appointmentData.staffName || '',
            staffPhone: appointmentData.staffPhone || '',
            flowId: appointmentData._flowId || '',
            triggeredBy: appointmentData._triggeredBy || 'manual',
            profile: appointmentData.profile || appointmentData.linkType || '',
            messageContent: messageContent,
            // v3.10.19: Yeni alanlar
            targetType: template.targetType || '',
            customerName: appointmentData.customerName || '',
            customerPhone: appointmentData.customerPhone || ''
          });
        } catch (logError) {
          console.error('Message log error (non-critical):', logError);
        }

        return {
          success: true,
          messageId: messageId,
          phone: cleanPhone,
          templateUsed: template.name
        };
      } else {
        log.error('WhatsApp API hatası:', responseData);

        // MESSAGE_LOG: Başarısız gönderimi logla
        // v3.10.19: Mesaj içeriğini template content'ten oluştur (hata durumunda da)
        let failedMessageContent = '';
        if (template.content) {
          failedMessageContent = template.content;
          parameters.forEach((p, index) => {
            const placeholder = '{{' + (index + 1) + '}}';
            failedMessageContent = failedMessageContent.replace(placeholder, p.text || '');
          });
        } else {
          failedMessageContent = parameters.map(p => p.text || '').join(' | ');
        }
        try {
          // v3.10.19: targetType'a göre recipientName belirle
          const isCustomerMessageFailed = template.targetType === 'customer';
          SheetStorageService.addMessageLog({
            direction: 'outgoing',
            appointmentId: appointmentData.eventId || '',
            phone: cleanPhone,
            recipientName: isCustomerMessageFailed ? appointmentData.customerName : appointmentData.staffName || '',
            templateName: template.name,
            templateId: template.id || '',
            status: 'failed',
            messageId: '',
            errorMessage: responseData.error?.message || 'Bilinmeyen hata',
            staffId: appointmentData.staffId || '',
            staffName: appointmentData.staffName || '',
            staffPhone: appointmentData.staffPhone || '',
            flowId: appointmentData._flowId || '',
            triggeredBy: appointmentData._triggeredBy || 'manual',
            profile: appointmentData.profile || appointmentData.linkType || '',
            messageContent: failedMessageContent,
            // v3.10.19: Yeni alanlar
            targetType: template.targetType || '',
            customerName: appointmentData.customerName || '',
            customerPhone: appointmentData.customerPhone || ''
          });
        } catch (logError) {
          console.error('Message log error (non-critical):', logError);
        }

        return {
          success: false,
          error: responseData.error?.message || 'Bilinmeyen hata',
          errorCode: responseData.error?.code,
          errorDetails: responseData.error
        };
      }

    } catch (error) {
      log.error('_sendToSingleRecipient hatası:', error);
      return {
        success: false,
        error: error.toString()
      };
    }
  },

  /**
   * Tüm aktif template'ler ile mesaj gönder (her template için ayrı mesaj)
   * @param {Object} appointmentData - Randevu verileri
   * @returns {{success: boolean, results: Array}}
   */
  sendAllTemplateMessages: function(appointmentData) {
    const activeTemplates = WhatsAppTemplateService.getActiveTemplates();
    const results = [];

    if (activeTemplates.length === 0) {
      return { success: false, error: 'Aktif template bulunamadı', results: [] };
    }

    for (var i = 0; i < activeTemplates.length; i++) {
      var template = activeTemplates[i];
      var result = this.sendWhatsAppMessageWithTemplate(appointmentData, template);
      results.push({
        templateName: template.name,
        success: result.success,
        messageId: result.messageId,
        error: result.error
      });
    }

    return {
      success: results.some(function(r) { return r.success; }),
      results: results
    };
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

      // YENİ: Template bazlı gönderim - Her randevu için tüm aktif template'leri çalıştır
      for (const reminder of reminders.data) {
        const appointmentData = {
          customerName: reminder.customerName,
          customerPhone: reminder.link ? reminder.link.split('/').pop().split('?')[0] : '',
          date: reminder.date,
          time: reminder.time,
          staffName: reminder.staffName,
          appointmentType: reminder.appointmentType,
          staffPhone: reminder.staffPhone || ''
        };

        // Aktif template'leri al ve gönder
        const activeTemplates = WhatsAppTemplateService.getActiveTemplates().filter(function(t) {
          return t.trigger === 'time'; // Sadece zaman bazlı template'ler
        });

        for (const template of activeTemplates) {
          try {
            const result = this.sendWhatsAppMessageWithTemplate(appointmentData, template);
            
            if (result.success) {
              sentCount += result.sent || 1;
              if (result.results && result.results.length > 0) {
                results.push(...result.results.map(r => ({
                  customer: reminder.customerName,
                  recipient: r.recipient,
                  phone: r.phone,
                  status: r.status,
                  messageId: r.messageId,
                  template: template.name
                })));
              } else {
                results.push({
                  customer: reminder.customerName,
                  phone: appointmentData.customerPhone,
                  status: 'success',
                  messageId: result.messageId,
                  template: template.name
                });
              }
            } else {
              failedCount += result.failed || 1;
              results.push({
                customer: reminder.customerName,
                phone: appointmentData.customerPhone,
                status: 'failed',
                error: result.error,
                template: template.name
              });
            }

            // Rate limiting
            Utilities.sleep(150);
          } catch (e) {
            failedCount++;
            results.push({
              customer: reminder.customerName,
              template: template.name,
              status: 'error',
              error: e.toString()
            });
          }
        }
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
   * Event bazlı WhatsApp mesajı gönder
   * Randevu oluşturulduğunda, iptal edildiğinde vs. çağrılır
   * @param {string} eventType - Event tipi (on_appointment_created, on_appointment_cancelled, vs.)
   * @param {Object} appointmentData - Randevu verileri
   * @returns {{success: boolean, results: Array}}
   */
  sendEventTriggeredMessages: function(eventType, appointmentData) {
    try {
      // WhatsApp config yükle
      loadExternalConfigs();

      // Bu event için tanımlı template'leri bul
      const templates = WhatsAppTemplateService.getTemplatesByTrigger(eventType);

      if (templates.length === 0) {
        log.info('Bu event için template tanımlı değil:', eventType);
        return { success: true, sent: 0, message: 'Bu event için template yok' };
      }

      const results = [];
      let sentCount = 0;
      let failedCount = 0;

      // Her template için mesaj gönder
      for (var i = 0; i < templates.length; i++) {
        var template = templates[i];

        try {
          var result = this.sendWhatsAppMessageWithTemplate(appointmentData, template);

          if (result.success) {
            sentCount++;
            results.push({
              templateName: template.name,
              status: 'sent',
              messageId: result.messageId
            });
          } else {
            failedCount++;
            results.push({
              templateName: template.name,
              status: 'failed',
              error: result.error
            });
          }

          // Rate limiting
          Utilities.sleep(100);

        } catch (e) {
          failedCount++;
          results.push({
            templateName: template.name,
            status: 'error',
            error: e.toString()
          });
        }
      }

      log.info('Event triggered messages sent:', { event: eventType, sent: sentCount, failed: failedCount });

      return {
        success: sentCount > 0,
        event: eventType,
        sent: sentCount,
        failed: failedCount,
        results: results
      };

    } catch (error) {
      log.error('sendEventTriggeredMessages hatası:', error);
      return {
        success: false,
        error: error.toString()
      };
    }
  }
};

// ==================== EVENT HANDLER FONKSİYONLARI ====================
/**
 * Bu fonksiyonlar randevu işlemlerinden sonra çağrılır
 * trigger='event' olan tüm template'ler çalıştırılır
 */

/**
 * Event bazlı template'leri çalıştır
 * Tüm 'event' trigger'lı template'ler için mesaj gönderir
 * @param {Object} appointmentData - Randevu verileri
 * @param {string} eventType - Event tipi (bilgi amaçlı log için)
 */
function _triggerEventTemplates(appointmentData, eventType) {
  try {
    loadExternalConfigs();

    // Event bazlı tüm template'leri bul
    const templates = WhatsAppTemplateService.getActiveTemplates().filter(function(t) {
      return t.trigger === 'event';
    });

    if (templates.length === 0) {
      Logger.log('Event bazlı template bulunamadı');
      return { success: true, sent: 0, message: 'Event template yok' };
    }

    Logger.log('Event tetiklendi (' + eventType + '): ' + templates.length + ' template çalıştırılacak');

    const results = [];
    let sentCount = 0;
    let failedCount = 0;

    for (var i = 0; i < templates.length; i++) {
      var template = templates[i];
      try {
        var result = WhatsAppService.sendWhatsAppMessageWithTemplate(appointmentData, template);
        if (result.success) {
          sentCount++;
          results.push({ template: template.name, status: 'sent' });
        } else {
          failedCount++;
          results.push({ template: template.name, status: 'failed', error: result.error });
        }
        Utilities.sleep(100);
      } catch (e) {
        failedCount++;
        results.push({ template: template.name, status: 'error', error: e.toString() });
      }
    }

    Logger.log('Event templates tamamlandı: ' + sentCount + ' gönderildi, ' + failedCount + ' başarısız');
    return { success: sentCount > 0, sent: sentCount, failed: failedCount, results: results };

  } catch (error) {
    Logger.log('Event template hatası: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * Randevu oluşturulduğunda çağır
 * @param {Object} appointmentData - Randevu verileri
 */
function onAppointmentCreated(appointmentData) {
  return _triggerEventTemplates(appointmentData, 'created');
}

/**
 * Randevu iptal edildiğinde çağır
 * @param {Object} appointmentData - Randevu verileri
 */
function onAppointmentCancelled(appointmentData) {
  return _triggerEventTemplates(appointmentData, 'cancelled');
}

/**
 * Randevu düzenlendiğinde çağır
 * @param {Object} appointmentData - Randevu verileri
 */
function onAppointmentUpdated(appointmentData) {
  return _triggerEventTemplates(appointmentData, 'updated');
}

/**
 * İlgili atandığında çağır
 * @param {Object} appointmentData - Randevu verileri
 */
function onStaffAssigned(appointmentData) {
  return _triggerEventTemplates(appointmentData, 'staff_assigned');
}

// ==================== SUBMIT (MANUEL) TRIGGER ====================
/**
 * Manuel tetikleme - Butona basınca çağrılır
 * Sadece trigger='submit' olan template'leri çalıştırır
 * @param {Object} appointmentData - Randevu verileri
 * @returns {{success: boolean, sent: number, failed: number, results: Array}}
 */
function sendWhatsAppManual(appointmentData) {
  try {
    loadExternalConfigs();

    // Submit trigger'lı tüm template'leri bul
    const templates = WhatsAppTemplateService.getActiveTemplates().filter(function(t) {
      return t.trigger === 'submit';
    });

    if (templates.length === 0) {
      Logger.log('Manuel tetikleme için template bulunamadı');
      return { success: false, sent: 0, error: 'Manuel tetikleme için template tanımlı değil' };
    }

    Logger.log('Manuel tetikleme: ' + templates.length + ' template çalıştırılacak');

    const results = [];
    let sentCount = 0;
    let failedCount = 0;

    for (var i = 0; i < templates.length; i++) {
      var template = templates[i];
      try {
        var result = WhatsAppService.sendWhatsAppMessageWithTemplate(appointmentData, template);
        if (result.success) {
          sentCount++;
          results.push({ template: template.name, status: 'sent', messageId: result.messageId });
        } else {
          failedCount++;
          results.push({ template: template.name, status: 'failed', error: result.error });
        }
        Utilities.sleep(100);
      } catch (e) {
        failedCount++;
        results.push({ template: template.name, status: 'error', error: e.toString() });
      }
    }

    Logger.log('Manuel tetikleme tamamlandı: ' + sentCount + ' gönderildi, ' + failedCount + ' başarısız');
    return { success: sentCount > 0, sent: sentCount, failed: failedCount, results: results };

  } catch (error) {
    Logger.log('Manuel tetikleme hatası: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

// ==================== TRIGGER TİPLERİ ====================
/**
 * WhatsApp template trigger tipleri - 3 tip
 * time: Zaman bazlı - Her gün belirli saatte çalışır
 * event: Olay bazlı - Randevu oluşturulunca/güncellenince/iptal olunca çalışır
 * submit: Manuel tetikleme - Butona basınca çalışır
 */
const WHATSAPP_TRIGGER_TYPES = {
  'time': {
    label: 'Zaman Bazlı (Her Gün Belirli Saatte)',
    description: 'Yarınki randevular için hatırlatma gönderir'
  },
  'event': {
    label: 'Olay Bazlı (Randevu İşlemlerinde)',
    description: 'Randevu oluşturulunca, güncellenince veya iptal olunca mesaj gönderir'
  },
  'submit': {
    label: 'Manuel Tetikleme (Butona Basınca)',
    description: 'WhatsApp Gönder butonuna basınca mesaj gönderir'
  }
};

/**
 * Trigger tiplerini admin panel formatında döndür
 */
function getWhatsAppTriggerTypes() {
  const types = {};
  for (var key in WHATSAPP_TRIGGER_TYPES) {
    types[key] = WHATSAPP_TRIGGER_TYPES[key].label;
  }
  return { success: true, data: types };
}

// ==================== GLOBAL DEĞİŞKEN SİSTEMİ ====================
/**
 * WhatsApp mesaj değişkenleri - Backend ve Admin Panel senkronize
 * Bu değişkenler hem backend'de hem admin panel'de kullanılır
 * Yeni değişken eklemek için sadece buraya ekleyin
 */
/**
 * Telefon numarasını görüntüleme formatına dönüştür
 * Tüm numaralar + ile gösterilir (tıklanabilir, uluslararası standart)
 * WhatsApp recipient hariç her yerde kullanılır
 *
 * Örnek:
 * - 905321234567 -> +90 532 123 45 67
 * - 05321234567 -> +90 532 123 45 67
 * - 5321234567 -> +90 532 123 45 67
 */
function formatPhoneNumber(phone) {
  if (!phone) return '';

  // Sadece rakamları al
  var digits = String(phone).replace(/[^0-9]/g, '');
  if (!digits) return '';

  // 0 ile başlıyorsa kaldır
  if (digits.startsWith('0') && !digits.startsWith('00')) {
    digits = digits.substring(1);
  }

  // 00 ile başlıyorsa kaldır (uluslararası arama prefixi)
  if (digits.startsWith('00')) {
    digits = digits.substring(2);
  }

  // Türkiye formatı: +90 5XX XXX XX XX
  if (digits.startsWith('90') && digits.length === 12) {
    return '+' + digits.substring(0, 2) + ' ' +
           digits.substring(2, 5) + ' ' +
           digits.substring(5, 8) + ' ' +
           digits.substring(8, 10) + ' ' +
           digits.substring(10);
  }

  // 10 haneli TR numarası (5 ile başlıyor)
  if (digits.length === 10 && digits.startsWith('5')) {
    return '+90 ' + digits.substring(0, 3) + ' ' +
           digits.substring(3, 6) + ' ' +
           digits.substring(6, 8) + ' ' +
           digits.substring(8);
  }

  // Diğer ülkeler: sadece + ekle
  return '+' + digits;
}

// WhatsApp değişkenleri artık Variables.js'den gelir (MESSAGE_VARIABLES)
// Backward compatibility için WHATSAPP_VARIABLES = MESSAGE_VARIABLES referansı
// Tüm değişkenler: musteri, musteri_tel, musteri_mail, randevu_tarihi, randevu_saati,
// randevu_ek_bilgi, personel, personel_tel, personel_mail, randevu_turu, randevu_profili

// Eski key'leri yeni key'lere map et (backward compatibility)
const WHATSAPP_VARIABLE_KEY_MAP = {
  'musteri_email': 'musteri_mail',
  'ek_bilgi': 'randevu_ek_bilgi',
  'personel_email': 'personel_mail'
};

// WHATSAPP_VARIABLES artık MESSAGE_VARIABLES'ı kullanır
function getWhatsAppVariable(key, data) {
  // Eski key'i yeni key'e çevir
  var actualKey = WHATSAPP_VARIABLE_KEY_MAP[key] || key;
  return getVariableValue(actualKey, data);
}

/**
 * Değişken listesini admin panel formatında döndür
 * Admin panel bu fonksiyonu çağırarak değişken listesini alır
 * Artık merkezi MESSAGE_VARIABLES kullanılır
 */
function getWhatsAppVariableOptions() {
  return getMessageVariables();
}

// ==================== WHATSAPP TEMPLATE SERVICE (v4.0) ====================
/**
 * WhatsApp Template yönetimi
 * Dinamik template ekleme, düzenleme, silme işlemleri
 * Admin panel'den eklenen template'ler otomatik çalışır
 */
const WhatsAppTemplateService = {
  STORAGE_KEY: 'WHATSAPP_TEMPLATES',

  /**
   * Tüm aktif template'leri getir
   */
  getActiveTemplates: function() {
    return this.getAll().filter(function(t) { return t.isActive !== false; });
  },

  /**
   * Belirli bir trigger tipine sahip template'leri getir
   * @param {string} triggerType - Trigger tipi (on_appointment_created, daily_scheduled, vs.)
   */
  getTemplatesByTrigger: function(triggerType) {
    return this.getActiveTemplates().filter(function(t) {
      return t.trigger === triggerType;
    });
  },

  /**
   * Belirli bir saatte çalışacak template'leri getir
   * @param {string} hour - Saat (örn: "09:00")
   */
  getTemplatesByScheduledTime: function(hour) {
    return this.getActiveTemplates().filter(function(t) {
      return t.trigger === 'daily_scheduled' && t.scheduledTime === hour;
    });
  },

  /**
   * Belirli bir template'i ID ile getir
   */
  getById: function(id) {
    return this.getAll().find(function(t) { return t.id === id; });
  },

  /**
   * Randevu verilerinden değişken değerini al (Variables.js'den)
   */
  getVariableValue: function(variableKey, appointmentData) {
    // Eski key'leri yeni key'lere map et (backward compatibility)
    var actualKey = WHATSAPP_VARIABLE_KEY_MAP[variableKey] || variableKey;
    return getVariableValue(actualKey, appointmentData);
  },

  /**
   * Template için WhatsApp API parametrelerini oluştur
   * v3.10.35: Her slot için parametre ekle (eksik değişkenler için '-' kullan)
   */
  buildTemplateParameters: function(template, appointmentData) {
    const parameters = [];

    // Template'deki değişkenleri sırayla işle
    // ÖNEMLİ: Meta API tam olarak variableCount kadar parametre bekler
    for (var i = 1; i <= template.variableCount; i++) {
      var variableKey = template.variables[i];
      var value = '-'; // Default değer (tanımsız değişkenler için)
      if (variableKey) {
        value = this.getVariableValue(variableKey, appointmentData) || '-';
      }
      parameters.push({ type: "text", text: value });
    }

    return parameters;
  },

  /**
   * Tüm template'leri getir
   */
  getAll: function() {
    try {
      const props = PropertiesService.getScriptProperties();
      const data = props.getProperty(this.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      log.error('WhatsAppTemplateService.getAll error:', error);
      return [];
    }
  },

  /**
   * Template ekle - 🔒 GÜVENLİK: Validation ve sanitization
   */
  create: function(template) {
    try {
      const templates = this.getAll();

      // 🔒 GÜVENLİK: Input validation ve sanitization
      const securityValidation = this._validateTemplateInput(template);
      if (!securityValidation.isValid) {
        log.warn('Template güvenlik validation failed', { reason: securityValidation.reason });
        return { success: false, error: securityValidation.reason };
      }

      // Template adı zorunlu
      const sanitizedName = this._sanitizeInput(template.name);
      if (!sanitizedName || sanitizedName.length < 3 || sanitizedName.length > 50) {
        return { success: false, error: 'Template adı 3-50 karakter arası olmalı ve geçerli karakterler içermeli' };
      }

      // Aynı isimde template var mı kontrol et
      if (templates.find(t => t.name === sanitizedName)) {
        return { success: false, error: 'Bu isimde bir template zaten var' };
      }

      // 🔒 GÜVENLİK: Template sayısı limiti (DoS koruması)
      if (templates.length >= 20) {
        return { success: false, error: 'Maksimum 20 template oluşturabilirsiniz' };
      }

      // 🔒 GÜVENLİK: Sanitized ve validated template oluştur
      const newTemplate = {
        id: Utilities.getUuid(),
        name: sanitizedName,
        description: this._sanitizeInput(template.description || '').substring(0, 200), // Max 200 karakter
        variableCount: Math.min(Math.max(parseInt(template.variableCount) || 1, 1), 10), // 1-10 arası
        variables: this._sanitizeVariables(template.variables || {}),
        trigger: this._validateTriggerType(template.trigger), 
        scheduledTime: this._validateScheduledTime(template.scheduledTime),
        isActive: template.isActive !== false,
        recipientType: this._validateRecipientType(template.recipientType),
        recipientTarget: this._sanitizeInput(template.recipientTarget || ''),
        recipientList: this._validateRecipientList(template.recipientList),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'admin', // 🔒 Audit trail için
        lastUsed: null // 🔒 Kullanım tracking
      };

      templates.push(newTemplate);
      this._save(templates);

      return { success: true, data: newTemplate };
    } catch (error) {
      log.error('WhatsAppTemplateService.create error:', error);
      return { success: false, error: 'Template oluşturulamadı' };
    }
  },

  /**
   * Template güncelle
   */
  update: function(id, updates) {
    try {
      const templates = this.getAll();
      const index = templates.findIndex(t => t.id === id);

      if (index === -1) {
        return { success: false, error: 'Template bulunamadı' };
      }

      // İsim değişiyorsa ve başka bir template aynı isme sahipse hata ver
      if (updates.name && updates.name !== templates[index].name) {
        if (templates.find(t => t.name === updates.name && t.id !== id)) {
          return { success: false, error: 'Bu isimde bir template zaten var' };
        }
      }

      templates[index] = {
        ...templates[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      this._save(templates);

      return { success: true, data: templates[index] };
    } catch (error) {
      log.error('WhatsAppTemplateService.update error:', error);
      return { success: false, error: 'Template güncellenemedi' };
    }
  },

  /**
   * Template sil
   */
  delete: function(id) {
    try {
      const templates = this.getAll();
      const index = templates.findIndex(t => t.id === id);

      if (index === -1) {
        return { success: false, error: 'Template bulunamadı' };
      }

      templates.splice(index, 1);
      this._save(templates);

      return { success: true };
    } catch (error) {
      log.error('WhatsAppTemplateService.delete error:', error);
      return { success: false, error: 'Template silinemedi' };
    }
  },

  /**
   * Değişken seçeneklerini getir (global sistemden)
   */
  getVariableOptions: function() {
    return getWhatsAppVariableOptions();
  },

  /**
   * Template'leri kaydet
   */
  _save: function(templates) {
    const props = PropertiesService.getScriptProperties();
    props.setProperty(this.STORAGE_KEY, JSON.stringify(templates));
  },

  // 🔒 GÜVENLİK FONKSİYONLARI

  /**
   * Template input validation - XSS ve injection koruması
   */
  _validateTemplateInput: function(template) {
    try {
      // Null/undefined kontrolü
      if (!template || typeof template !== 'object') {
        return { isValid: false, reason: 'Geçersiz template verisi' };
      }

      // Tehlikeli karakterler kontrolü
      const dangerousPatterns = [
        /<script/i, /<\/script/i, /javascript:/i, /vbscript:/i,
        /onload=/i, /onerror=/i, /onclick=/i, /eval\s*\(/i,
        /document\.cookie/i, /window\.location/i, /<iframe/i,
        /SELECT.*FROM/i, /INSERT.*INTO/i, /UPDATE.*SET/i, /DELETE.*FROM/i
      ];

      const fieldsToCheck = [template.name, template.description];
      
      for (const field of fieldsToCheck) {
        if (field && typeof field === 'string') {
          for (const pattern of dangerousPatterns) {
            if (pattern.test(field)) {
              return { isValid: false, reason: 'Güvenlik: Tehlikeli karakter tespit edildi' };
            }
          }
        }
      }

      return { isValid: true };
    } catch (error) {
      return { isValid: false, reason: 'Validation hatası' };
    }
  },

  /**
   * Input sanitization - XSS koruması
   */
  _sanitizeInput: function(input) {
    if (!input || typeof input !== 'string') return '';
    
    return input
      .replace(/[<>\"'&]/g, '') // Tehlikeli karakterleri kaldır
      .replace(/\s+/g, ' ') // Çoklu boşlukları tek yap
      .trim()
      .substring(0, 500); // Max 500 karakter
  },

  /**
   * Variables sanitization
   */
  _sanitizeVariables: function(variables) {
    const sanitized = {};
    // MESSAGE_VARIABLES (Variables.js) + eski key'ler
    const allowedKeys = Object.keys(MESSAGE_VARIABLES).concat(Object.keys(WHATSAPP_VARIABLE_KEY_MAP));

    for (const key in variables) {
      if (variables.hasOwnProperty(key)) {
        const sanitizedKey = this._sanitizeInput(key);
        const sanitizedValue = this._sanitizeInput(variables[key]);

        // Sadece bilinen variable key'leri kabul et
        if (allowedKeys.includes(sanitizedValue)) {
          sanitized[sanitizedKey] = sanitizedValue;
        }
      }
    }
    return sanitized;
  },

  /**
   * Trigger type validation
   */
  _validateTriggerType: function(trigger) {
    const allowedTriggers = ['time', 'event', 'submit'];
    return allowedTriggers.includes(trigger) ? trigger : 'time';
  },

  /**
   * Scheduled time validation
   */
  _validateScheduledTime: function(scheduledTime) {
    if (!scheduledTime) return '10:00';
    
    // HH:MM formatı kontrol et
    const timePattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timePattern.test(scheduledTime) ? scheduledTime : '10:00';
  },

  /**
   * Recipient type validation
   */
  _validateRecipientType: function(recipientType) {
    const allowedTypes = ['individual', 'team'];
    return allowedTypes.includes(recipientType) ? recipientType : '';
  },

  /**
   * Recipient list validation
   */
  _validateRecipientList: function(recipientList) {
    try {
      let list = [];
      
      if (typeof recipientList === 'string') {
        list = JSON.parse(recipientList);
      } else if (Array.isArray(recipientList)) {
        list = recipientList;
      }

      // Array kontrolü ve sanitization
      if (!Array.isArray(list)) return [];
      
      return list
        .filter(item => typeof item === 'string')
        .map(item => this._sanitizeInput(item))
        .filter(item => item.length > 0)
        .slice(0, 10); // Max 10 recipient
        
    } catch (error) {
      return [];
    }
  }
};

// ==================== TRIGGER FUNCTIONS ====================
// Bu fonksiyonlar Google Apps Script trigger'ları tarafından çağrılır

/**
 * Günlük WhatsApp hatırlatmaları gönder
 * Time-based trigger tarafından çağrılır (örn: her gün 09:00)
 * API key gerektirmez (server-side çalışır)
 */
/**
 * WhatsApp ayarlarını test et ve debug bilgisi döndür
 * Apps Script Editor'de çalıştırın ve Execution Log'u kontrol edin
 */
function testWhatsAppSetup() {
  // 🔒 SECURITY: Test fonksiyonu sadece DEBUG modunda çalışır
  if (!DEBUG) {
    Logger.log('⚠️ Test fonksiyonu sadece DEBUG modunda çalışır');
    return { error: 'Test fonksiyonu sadece DEBUG modunda çalışır' };
  }
  
  const scriptProperties = PropertiesService.getScriptProperties();
  const phoneNumberId = scriptProperties.getProperty('WHATSAPP_PHONE_NUMBER_ID');
  const accessToken = scriptProperties.getProperty('WHATSAPP_ACCESS_TOKEN');

  Logger.log('=== WhatsApp Setup Test ===');
  Logger.log('WHATSAPP_PHONE_NUMBER_ID: ' + (phoneNumberId ? '✅ Ayarlanmış' : '❌ EKSİK'));
  Logger.log('WHATSAPP_ACCESS_TOKEN: ' + (accessToken ? '✅ Ayarlanmış' : '❌ EKSİK'));

  // YARININ randevularını kontrol et (hatırlatma bir gün önce gönderilir)
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = Utilities.formatDate(tomorrow, 'Europe/Istanbul', 'yyyy-MM-dd');
  Logger.log('Yarının tarihi: ' + dateStr);

  try {
    const reminders = WhatsAppService.getTodayWhatsAppReminders(dateStr);
    Logger.log('Randevu sorgusu: ' + (reminders.success ? '✅ Başarılı' : '❌ Hata: ' + reminders.error));
    Logger.log('Yarınki randevu sayısı: ' + (reminders.data ? reminders.data.length : 0));

    if (reminders.data && reminders.data.length > 0) {
      reminders.data.forEach(function(r, i) {
        Logger.log('Randevu ' + (i+1) + ': ' + r.customerName + ' - ' + r.phone + ' - ' + r.time);
      });
    }
  } catch (e) {
    Logger.log('Randevu sorgusu hatası: ' + e.toString());
  }

  return {
    phoneNumberId: !!phoneNumberId,
    accessToken: !!accessToken,
    date: dateStr
  };
}

function sendDailyWhatsAppReminders() {
  try {
    // YARININ tarihini al (hatırlatma bir gün önce gönderilir)
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = Utilities.formatDate(tomorrow, 'Europe/Istanbul', 'yyyy-MM-dd');

    Logger.log('Yarınki randevular için WhatsApp hatırlatmaları başlatılıyor: ' + dateStr);

    // WhatsApp ayarlarını kontrol et
    const scriptProperties = PropertiesService.getScriptProperties();
    const phoneNumberId = scriptProperties.getProperty('WHATSAPP_PHONE_NUMBER_ID');
    const accessToken = scriptProperties.getProperty('WHATSAPP_ACCESS_TOKEN');

    if (!phoneNumberId || !accessToken) {
      log.warn('WhatsApp ayarları yapılandırılmamış - hatırlatmalar gönderilmedi');
      return {
        success: false,
        error: 'WhatsApp ayarları yapılandırılmamış'
      };
    }

    // Bugünkü randevuları al
    const reminders = WhatsAppService.getTodayWhatsAppReminders(dateStr);

    if (!reminders.success || reminders.data.length === 0) {
      log.info('Bugün gönderilecek hatırlatma yok');
      return {
        success: true,
        sent: 0,
        message: 'Gönderilecek hatırlatma yok'
      };
    }

    log.info('Gönderilecek hatırlatma sayısı:', reminders.data.length);

    let sentCount = 0;
    let failedCount = 0;
    const results = [];

    // YENİ: Template bazlı gönderim - Her randevu için tüm zaman bazlı template'leri çalıştır
    reminders.data.forEach(function(reminder) {
      const appointmentData = {
        customerName: reminder.customerName,
        customerPhone: reminder.link ? reminder.link.split('/').pop().split('?')[0] : '',
        date: reminder.date,
        time: reminder.time,
        staffName: reminder.staffName,
        appointmentType: reminder.appointmentType,
        staffPhone: reminder.staffPhone || ''
      };

      // Zaman bazlı tüm aktif template'leri al
      const timeTemplates = WhatsAppTemplateService.getActiveTemplates().filter(function(t) {
        return t.trigger === 'time';
      });

      timeTemplates.forEach(function(template) {
        try {
          const result = WhatsAppService.sendWhatsAppMessageWithTemplate(appointmentData, template);
          
          if (result.success) {
            sentCount += result.sent || 1;
            if (result.results && result.results.length > 0) {
              result.results.forEach(function(r) {
                results.push({ 
                  customer: reminder.customerName,
                  recipient: r.recipient,
                  phone: r.phone, 
                  status: r.status,
                  template: template.name
                });
              });
            } else {
              results.push({ phone: appointmentData.customerPhone, status: 'sent', template: template.name });
            }
          } else {
            failedCount += result.failed || 1;
            results.push({ phone: appointmentData.customerPhone, status: 'failed', error: result.error, template: template.name });
          }

          // Rate limiting
          Utilities.sleep(150);

        } catch (e) {
          failedCount++;
          results.push({ customer: reminder.customerName, template: template.name, status: 'error', error: e.toString() });
        }
      });
    });

    log.info('WhatsApp hatırlatmaları tamamlandı:', { sent: sentCount, failed: failedCount });

    return {
      success: true,
      sent: sentCount,
      failed: failedCount,
      total: reminders.data.length
    };

  } catch (error) {
    log.error('sendDailyWhatsAppReminders hatası:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

// ==================== NUMARALI TEMPLATE TRIGGER FONKSIYONLARI ====================
/**
 * Bu fonksiyonları Google Apps Script'te trigger olarak kurabilirsiniz.
 * Her biri sırasıyla 1., 2., 3., 4., 5. template'i işler.
 * Template yoksa sessizce atlar.
 *
 * Kullanım:
 * 1. Google Apps Script'te Triggers > Add Trigger
 * 2. sendTemplate1, sendTemplate2 vs. seçin
 * 3. Time-based trigger olarak ayarlayın (örn: her gün 09:00)
 *
 * Admin panelden template eklediğinizde otomatik olarak çalışır!
 */

/**
 * Belirli numaralı template için hatırlatma gönder
 * @param {number} templateIndex - Template sırası (0-based)
 */
function _sendTemplateByIndex(templateIndex) {
  try {
    // WhatsApp ayarlarını yükle
    loadExternalConfigs();

    const templates = WhatsAppTemplateService.getAll();

    // Bu index'te template var mı kontrol et
    if (!templates[templateIndex]) {
      Logger.log('Template #' + (templateIndex + 1) + ' bulunamadı - atlanıyor');
      return { success: true, skipped: true, message: 'Template bulunamadı' };
    }

    const template = templates[templateIndex];

    // Template aktif mi kontrol et
    if (template.isActive === false) {
      Logger.log('Template #' + (templateIndex + 1) + ' (' + template.name + ') pasif - atlanıyor');
      return { success: true, skipped: true, message: 'Template pasif' };
    }

    // Sadece 'time' trigger tipi bu fonksiyonla çalışır
    // 'event' → randevu işlemlerinde otomatik çalışır
    // 'submit' → manuel butona basınca çalışır
    if (template.trigger !== 'time') {
      Logger.log('Template #' + (templateIndex + 1) + ' (' + template.name + ') trigger tipi: ' + template.trigger + ' - zaman trigger\'ı atlanıyor');
      return { success: true, skipped: true, message: template.trigger + ' tipli template' };
    }

    Logger.log('Template #' + (templateIndex + 1) + ' (' + template.name + ') için hatırlatmalar gönderiliyor...');

    // YARININ tarihini al
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = Utilities.formatDate(tomorrow, 'Europe/Istanbul', 'yyyy-MM-dd');

    // Randevuları al
    const reminders = WhatsAppService.getTodayWhatsAppReminders(dateStr);

    if (!reminders.success || !reminders.data || reminders.data.length === 0) {
      Logger.log('Yarın için randevu yok');
      return { success: true, sent: 0, message: 'Randevu yok' };
    }

    let sentCount = 0;
    let failedCount = 0;
    const results = [];

    // Her randevu için bu template ile mesaj gönder
    reminders.data.forEach(function(reminder) {
      try {
        // Randevu verisini hazırla
        const appointmentData = {
          customerName: reminder.customerName,
          customerPhone: reminder.link ? reminder.link.split('/').pop().split('?')[0] : '',
          date: reminder.date,
          time: reminder.time,
          staffName: reminder.staffName,
          appointmentType: reminder.appointmentType,
          staffPhone: reminder.staffPhone
        };

        const result = WhatsAppService.sendWhatsAppMessageWithTemplate(appointmentData, template);

        if (result.success) {
          sentCount += result.sent || 1;
          if (result.results && result.results.length > 0) {
            result.results.forEach(function(r) {
              results.push({
                customer: reminder.customerName,
                recipient: r.recipient,
                phone: r.phone,
                status: r.status,
                messageId: r.messageId
              });
            });
          } else {
            results.push({ customer: reminder.customerName, status: 'sent', messageId: result.messageId });
          }
        } else {
          failedCount += result.failed || 1;
          results.push({ customer: reminder.customerName, status: 'failed', error: result.error });
        }

        // Rate limiting
        Utilities.sleep(100);

      } catch (e) {
        failedCount++;
        results.push({ customer: reminder.customerName, status: 'error', error: e.toString() });
      }
    });

    Logger.log('Template #' + (templateIndex + 1) + ' tamamlandı: ' + sentCount + ' gönderildi, ' + failedCount + ' başarısız');

    return {
      success: true,
      templateName: template.name,
      templateIndex: templateIndex + 1,
      sent: sentCount,
      failed: failedCount,
      total: reminders.data.length,
      results: results
    };

  } catch (error) {
    Logger.log('Template #' + (templateIndex + 1) + ' hatası: ' + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

// === TRIGGER FONKSİYONLARI ===
// Bu fonksiyonları Apps Script'te trigger olarak ayarlayın

/** Template 1 için trigger - İlk template'i gönderir */
function sendTemplate1() {
  return _sendTemplateByIndex(0);
}

/** Template 2 için trigger - İkinci template'i gönderir */
function sendTemplate2() {
  return _sendTemplateByIndex(1);
}

/** Template 3 için trigger - Üçüncü template'i gönderir */
function sendTemplate3() {
  return _sendTemplateByIndex(2);
}

/** Template 4 için trigger - Dördüncü template'i gönderir */
function sendTemplate4() {
  return _sendTemplateByIndex(3);
}

/** Template 5 için trigger - Beşinci template'i gönderir */
function sendTemplate5() {
  return _sendTemplateByIndex(4);
}

/** Tüm aktif template'leri tek seferde gönder (isteğe bağlı) */
function sendAllTemplates() {
  const results = [];
  for (var i = 0; i < 5; i++) {
    var result = _sendTemplateByIndex(i);
    if (!result.skipped) {
      results.push(result);
    }
  }
  return {
    success: true,
    templatesProcessed: results.length,
    results: results
  };
}

// === TRIGGER KURULUM FONKSİYONU ===
/**
 * WhatsApp template trigger'larını otomatik kur
 * Bu fonksiyonu Apps Script'te BİR KEZ çalıştır!
 * 5 adet trigger oluşturur: sendTemplate1-5, her gün saat 10:00'da
 *
 * Kullanım: Apps Script editöründe setupWhatsAppTriggers fonksiyonunu seç ve çalıştır
 */
function setupWhatsAppTriggers() {
  // Önce mevcut WhatsApp trigger'larını temizle
  const existingTriggers = ScriptApp.getProjectTriggers();
  let deletedCount = 0;

  existingTriggers.forEach(function(trigger) {
    const funcName = trigger.getHandlerFunction();
    if (funcName.startsWith('sendTemplate') || funcName === 'sendAllTemplates') {
      ScriptApp.deleteTrigger(trigger);
      deletedCount++;
    }
  });

  Logger.log(deletedCount + ' eski trigger silindi');

  // 5 template için trigger oluştur - Her gün saat 10:00 (TR)
  const templateFunctions = ['sendTemplate1', 'sendTemplate2', 'sendTemplate3', 'sendTemplate4', 'sendTemplate5'];
  let createdCount = 0;

  templateFunctions.forEach(function(funcName) {
    ScriptApp.newTrigger(funcName)
      .timeBased()
      .everyDays(1)
      .atHour(10)  // Saat 10:00
      .inTimezone('Europe/Istanbul')
      .create();
    createdCount++;
    Logger.log('Trigger oluşturuldu: ' + funcName + ' - Her gün 10:00');
  });

  Logger.log('Toplam ' + createdCount + ' trigger oluşturuldu');

  return {
    success: true,
    deleted: deletedCount,
    created: createdCount,
    message: createdCount + ' trigger oluşturuldu (her gün 10:00 TR)'
  };
}

// === v3.10.18: HOURLY SCHEDULED FLOW SYSTEM ===

/**
 * Saatlik çalışan trigger fonksiyonu
 * Her saat başı çalışır, o saate ayarlı flow'ları çalıştırır
 *
 * Bu fonksiyon setupHourlyFlowTrigger() ile kurulur
 */
function runHourlyScheduledFlows() {
  try {
    // Türkiye saatini al
    var now = new Date();
    var currentHour = parseInt(Utilities.formatDate(now, 'Europe/Istanbul', 'HH'));

    Logger.log('⏰ [runHourlyScheduledFlows] Current hour (TR): ' + currentHour);

    // notification_flows tablosundan aktif time-based flow'ları al
    var flowsResult = getNotificationFlows();
    if (!flowsResult.success) {
      Logger.log('❌ Flow\'lar yüklenemedi');
      return { success: false, error: 'Flow\'lar yüklenemedi' };
    }

    // HATIRLATMA trigger'lı ve scheduleHour'u şimdiki saate eşit olan flow'ları filtrele
    var matchingFlows = flowsResult.data.filter(function(flow) {
      var flowHour = parseInt(flow.scheduleHour || '10');
      var isTimeBased = flow.trigger === 'HATIRLATMA';
      var isActive = flow.active === true || flow.active === 'true';
      var hourMatches = flowHour === currentHour;

      Logger.log('📋 Flow: ' + flow.name + ' | trigger=' + flow.trigger + ' | scheduleHour=' + flowHour + ' | active=' + isActive + ' | matches=' + (isTimeBased && isActive && hourMatches));

      return isTimeBased && isActive && hourMatches;
    });

    Logger.log('✅ Çalışacak flow sayısı: ' + matchingFlows.length);

    if (matchingFlows.length === 0) {
      return { success: true, processed: 0, message: 'Bu saat için flow yok' };
    }

    // YARININ tarihini al (hatırlatma bir gün önce gönderilir)
    var tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    var dateStr = Utilities.formatDate(tomorrow, 'Europe/Istanbul', 'yyyy-MM-dd');

    // Yarınki randevuları al
    var reminders = WhatsAppService.getTodayWhatsAppReminders(dateStr);

    if (!reminders.success || reminders.data.length === 0) {
      Logger.log('📭 Yarın için randevu yok');
      return { success: true, processed: 0, message: 'Gönderilecek hatırlatma yok' };
    }

    Logger.log('📅 Yarınki randevu sayısı: ' + reminders.data.length);

    var results = [];

    // Her flow için
    matchingFlows.forEach(function(flow) {
      Logger.log('🔄 Processing flow: ' + flow.name);

      // Her randevu için
      reminders.data.forEach(function(reminder) {
        // Profile kontrolü
        var appointmentProfile = reminder.profile || 'g';
        if (flow.profiles && flow.profiles.length > 0 && flow.profiles.indexOf(appointmentProfile) === -1) {
          Logger.log('⏭️ Skipping - profile mismatch: ' + appointmentProfile);
          return; // Bu randevu bu flow için uygun değil
        }

        var appointmentData = {
          customerName: reminder.customerName,
          customerPhone: reminder.link ? reminder.link.split('/').pop().split('?')[0] : '',
          date: reminder.date,
          time: reminder.time,
          staffName: reminder.staffName,
          appointmentType: reminder.appointmentType,
          staffPhone: reminder.staffPhone || '',
          profile: appointmentProfile
        };

        // WhatsApp template'leri gönder
        if (flow.whatsappTemplateIds && flow.whatsappTemplateIds.length > 0) {
          flow.whatsappTemplateIds.forEach(function(templateId) {
            try {
              var result = sendWhatsAppByTemplate(templateId, appointmentData);
              results.push({ flow: flow.name, template: templateId, type: 'whatsapp', result: result });
            } catch (e) {
              Logger.log('❌ WhatsApp error: ' + e.toString());
              results.push({ flow: flow.name, template: templateId, type: 'whatsapp', error: e.toString() });
            }
          });
        }

        // Mail template'leri gönder
        if (flow.mailTemplateIds && flow.mailTemplateIds.length > 0) {
          flow.mailTemplateIds.forEach(function(templateId) {
            try {
              var result = sendMailByTemplate(templateId, appointmentData);
              results.push({ flow: flow.name, template: templateId, type: 'mail', result: result });
            } catch (e) {
              Logger.log('❌ Mail error: ' + e.toString());
              results.push({ flow: flow.name, template: templateId, type: 'mail', error: e.toString() });
            }
          });
        }
      });
    });

    Logger.log('✅ Toplam işlem: ' + results.length);

    return {
      success: true,
      hour: currentHour,
      flowsProcessed: matchingFlows.length,
      results: results
    };

  } catch (error) {
    Logger.log('❌ runHourlyScheduledFlows error: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * Saatlik flow trigger'ını kur
 * Bu fonksiyonu Apps Script editöründe BİR KEZ çalıştır!
 *
 * Her saat başı runHourlyScheduledFlows() fonksiyonunu çalıştırır
 */
function setupHourlyFlowTrigger() {
  // Önce mevcut hourly trigger'ı sil
  var existingTriggers = ScriptApp.getProjectTriggers();
  var deletedCount = 0;

  existingTriggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'runHourlyScheduledFlows') {
      ScriptApp.deleteTrigger(trigger);
      deletedCount++;
    }
  });

  Logger.log(deletedCount + ' eski hourly trigger silindi');

  // Yeni saatlik trigger oluştur
  ScriptApp.newTrigger('runHourlyScheduledFlows')
    .timeBased()
    .everyHours(1)
    .create();

  Logger.log('✅ Hourly flow trigger oluşturuldu - Her saat başı çalışacak');

  return {
    success: true,
    message: 'Hourly flow trigger kuruldu. Her saat başı runHourlyScheduledFlows çalışacak.'
  };
}

/**
 * Mevcut trigger'ları listele (debug için)
 */
function listAllTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  var list = [];

  triggers.forEach(function(trigger) {
    list.push({
      function: trigger.getHandlerFunction(),
      type: trigger.getEventType().toString(),
      id: trigger.getUniqueId()
    });
  });

  Logger.log('Mevcut triggerlar: ' + JSON.stringify(list, null, 2));
  return { success: true, triggers: list };
}

// 🔒 KVKK: Kişisel veri maskeleme helper fonksiyonları
function _maskPersonalData(name) {
    if (!name || typeof name !== 'string') return '';
    if (name.length <= 2) return name;
    return name.substring(0, 2) + '***';
}

function _maskPhoneNumber(phone) {
    if (!phone || typeof phone !== 'string') return '';
    // Remove non-numeric characters for masking
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 6) return phone; // Too short to mask safely
    return cleanPhone.substring(0, 3) + '****' + cleanPhone.substring(cleanPhone.length - 2);
}

/**
 * 🔄 AKIŞ YÖNETİMİ API - Flow Management API Endpoints
 */

/**
 * Event tetiklendiğinde ilgili flow'ları çalıştır
 * @param {string} trigger - Trigger türü (APPOINTMENT_CREATE, APPOINTMENT_UPDATE, vb.)
 * @param {Object} eventData - Event bilgileri
 * @returns {Object} Sonuç
 */
function triggerFlowForEvent(trigger, eventData) {
  try {
    console.log('🔥 [triggerFlowForEvent] START - trigger:', trigger);

    // v3.10.38: Trigger constant → flow key mapping (flows stored with lowercase keys)
    const TRIGGER_TO_FLOW_KEY = {
      'APPOINTMENT_CREATE': 'create',
      'APPOINTMENT_CANCEL': 'cancel',
      'APPOINTMENT_UPDATE': 'update',
      'STAFF_ASSIGNED': 'assign'
    };
    const triggerKey = TRIGGER_TO_FLOW_KEY[trigger] || trigger;
    console.log('🔥 [triggerFlowForEvent] triggerKey (converted):', triggerKey);

    // Aktif flow'ları getir
    const flowsResult = getWhatsAppFlows();
    console.log('🔥 [triggerFlowForEvent] getWhatsAppFlows result:', JSON.stringify(flowsResult));

    if (!flowsResult.success) return { success: false, message: 'Flow\'lar yüklenemedi' };

    console.log('🔥 [triggerFlowForEvent] Total flows:', flowsResult.data.length);

    // Debug: Tüm flow'ları logla
    flowsResult.data.forEach((flow, idx) => {
      console.log(`🔥 [triggerFlowForEvent] Flow[${idx}]: name=${flow.name}, trigger=${flow.trigger}, triggerType=${flow.triggerType}, active=${flow.active}, profiles=${JSON.stringify(flow.profiles)}`);
    });

    // Bu trigger için aktif flow'ları filtrele
    // triggerType boşsa veya EVENT ise kabul et (default: EVENT)
    // v3.10.37: triggerKey (İngilizce) kullan
    const activeFlows = flowsResult.data.filter(flow =>
      flow.active &&
      flow.trigger === triggerKey &&
      (!flow.triggerType || flow.triggerType === 'EVENT')
    );

    console.log('🔥 [triggerFlowForEvent] Filtered activeFlows count:', activeFlows.length);

    if (activeFlows.length === 0) {
      console.log(`🔥 [triggerFlowForEvent] ${trigger} için aktif flow bulunamadı`);
      return { success: true, message: 'Aktif flow yok', sentCount: 0 };
    }
    
    let totalSent = 0;
    const errors = [];

    // Event'ten profil bilgisini al
    const appointmentProfile = eventData.profile || extractProfileFromAppointment(eventData);

    console.log(`[triggerFlowForEvent] trigger: ${trigger}, eventData.profile: ${eventData.profile}, appointmentProfile: ${appointmentProfile}`);
    console.log(`[triggerFlowForEvent] activeFlows count: ${activeFlows.length}`);

    for (const flow of activeFlows) {
      console.log(`[triggerFlowForEvent] Checking flow: ${flow.name}, flow.profiles: ${JSON.stringify(flow.profiles)}`);

      // Profil kontrolü
      if (flow.profiles && flow.profiles.length > 0) {
        if (!flow.profiles.includes(appointmentProfile)) {
          console.log(`Flow ${flow.name} profil eşleşmedi. Beklenen: ${flow.profiles.join(',')}, Gelen: ${appointmentProfile}`);
          continue;
        }
        console.log(`[triggerFlowForEvent] Flow ${flow.name} profil eşleşti!`);
      }
      
      // Template'leri al
      const templatesResult = getWhatsAppTemplates();
      console.log(`🔍 [triggerFlowForEvent] Flow ${flow.name} - getWhatsAppTemplates result:`, JSON.stringify({success: templatesResult.success, count: templatesResult.data?.length}));
      if (!templatesResult.success) {
        console.log(`❌ [triggerFlowForEvent] Flow ${flow.name} - Templates yüklenemedi!`);
        continue;
      }

      console.log(`🔍 [triggerFlowForEvent] Flow ${flow.name} - flow.templateIds: ${JSON.stringify(flow.templateIds)}`);
      console.log(`🔍 [triggerFlowForEvent] Flow ${flow.name} - All template IDs: ${JSON.stringify(templatesResult.data.map(t => t.id))}`);

      const flowTemplates = templatesResult.data.filter(t =>
        flow.templateIds.includes(t.id)
      );

      console.log(`🔍 [triggerFlowForEvent] Flow ${flow.name} - Matched flowTemplates count: ${flowTemplates.length}`);
      if (flowTemplates.length === 0) {
        console.log(`❌ [triggerFlowForEvent] Flow ${flow.name} - Template eşleşmesi YOK! flow.templateIds: ${JSON.stringify(flow.templateIds)}`);
        errors.push(`Flow ${flow.name}: Template eşleşmesi bulunamadı`);
        continue;
      }

      // Her template için mesaj gönder
      for (const template of flowTemplates) {
        console.log(`📤 [triggerFlowForEvent] Flow ${flow.name} - Processing template: ${template.name}, targetType: ${template.targetType}`);
        try {
          const sendResult = processFlowTemplate(template, eventData);
          console.log(`📤 [triggerFlowForEvent] Flow ${flow.name} - Template ${template.name} sendResult:`, JSON.stringify(sendResult));
          if (sendResult.success) {
            totalSent++;
            console.log(`✅ [triggerFlowForEvent] Flow ${flow.name} - Template ${template.name} BAŞARILI!`);
          } else {
            console.log(`❌ [triggerFlowForEvent] Flow ${flow.name} - Template ${template.name} BAŞARISIZ: ${sendResult.message}`);
            errors.push(`Template ${template.name}: ${sendResult.message}`);
          }
        } catch (templateError) {
          console.log(`❌ [triggerFlowForEvent] Flow ${flow.name} - Template ${template.name} EXCEPTION: ${templateError.toString()}`);
          errors.push(`Template ${template.name}: ${templateError.toString()}`);
        }
      }
    }
    
    return {
      success: true,
      message: `${totalSent} mesaj gönderildi`,
      sentCount: totalSent,
      errors: errors.length > 0 ? errors : undefined
    };
    
  } catch (error) {
    console.error('triggerFlowForEvent error:', error);
    return { success: false, message: error.toString() };
  }
}

/**
 * Flow template'ini işle ve mesaj gönder
 * @param {Object} template - Template bilgileri
 * @param {Object} eventData - Event bilgileri
 * @returns {Object} Gönderim sonucu
 */
function processFlowTemplate(template, eventData) {
  try {
    console.log(`[processFlowTemplate] template.name: ${template.name}, template.targetType: ${template.targetType}`);
    console.log(`[processFlowTemplate] eventData keys:`, Object.keys(eventData || {}).join(', '));
    console.log(`[processFlowTemplate] eventData.customerPhone: ${eventData.customerPhone}, eventData.staffId: ${eventData.staffId}`);

    // Target type'a göre alıcıları belirle
    let recipients = [];

    switch (template.targetType) {
      case 'customer':
        if (eventData.customerPhone) {
          recipients.push({
            phone: eventData.customerPhone,
            name: eventData.customerName
          });
        }
        break;
        
      case 'staff':
        console.log(`[processFlowTemplate] STAFF case - eventData.staffId: ${eventData.staffId}`);
        if (eventData.staffId) {
          const staff = getStaffById(eventData.staffId);
          console.log(`[processFlowTemplate] STAFF case - getStaffById result:`, JSON.stringify(staff));
          if (staff && staff.phone) {
            console.log(`[processFlowTemplate] STAFF case - Adding recipient: ${staff.name}, phone: ${staff.phone}`);
            recipients.push({
              phone: staff.phone,
              name: staff.name
            });
          } else {
            console.log(`[processFlowTemplate] STAFF case - Staff not found or no phone! staff:`, staff ? `name=${staff.name}, phone=${staff.phone}` : 'null');
          }
        } else {
          console.log(`[processFlowTemplate] STAFF case - No staffId in eventData!`);
        }
        break;
        
      case 'all_day_customers':
        // Günün tüm randevularını al
        const appointmentsResult = getTodayAppointments();
        if (appointmentsResult.success) {
          appointmentsResult.data.forEach(apt => {
            if (apt.customerPhone) {
              recipients.push({
                phone: apt.customerPhone,
                name: apt.customerName
              });
            }
          });
        }
        break;
        
      case 'admin':
      case 'sales':
      case 'reception':
        // Role göre personel listesi
        const staffResult = getStaffByRole(template.targetType);
        if (staffResult.success) {
          staffResult.data.forEach(s => {
            if (s.phone) {
              recipients.push({
                phone: s.phone,
                name: s.name
              });
            }
          });
        }
        break;
    }
    
    console.log(`[processFlowTemplate] recipients count: ${recipients.length}`);

    if (recipients.length === 0) {
      console.log(`[processFlowTemplate] No recipients found for targetType: ${template.targetType}`);
      return { success: false, message: `Alıcı bulunamadı (targetType: ${template.targetType})` };
    }

    // Her alıcıya mesaj gönder
    let sentCount = 0;
    const errors = [];

    for (const recipient of recipients) {
      try {
        console.log(`[processFlowTemplate] Sending to: ${recipient.name}, phone: ${recipient.phone}`);

        // ✅ DOĞRU MİMARİ:
        // - eventData: Orijinal randevu verileri (müşteri, personel, tarih, saat) - DEĞİŞMEZ
        // - recipient.phone: Mesajın gönderileceği telefon numarası (3. parametre)
        // Template değişkenleri eventData'dan alınır, gönderim adresi recipient.phone'dan

        // WhatsApp mesajı gönder - WhatsAppService kullan
        const sendResult = WhatsAppService._sendToSingleRecipient(eventData, template, recipient.phone);

        console.log(`[processFlowTemplate] Send result for ${recipient.name}:`, JSON.stringify(sendResult));

        if (sendResult.success) {
          sentCount++;
        } else {
          errors.push(`${recipient.name}: ${sendResult.error || sendResult.message || 'Bilinmeyen hata'}`);
        }
      } catch (error) {
        console.error(`[processFlowTemplate] Error sending to ${recipient.name}:`, error);
        errors.push(`${recipient.name}: ${error.toString()}`);
      }
    }
    
    return {
      success: sentCount > 0,
      message: `${sentCount}/${recipients.length} mesaj gönderildi`,
      sentCount: sentCount,
      errors: errors.length > 0 ? errors : undefined
    };
    
  } catch (error) {
    console.error('processFlowTemplate error:', error);
    return { success: false, message: error.toString() };
  }
}

/**
 * Randevudan profil bilgisini çıkar
 * @param {Object} eventData - Event bilgileri
 * @returns {string} Profil kodu
 */
function extractProfileFromAppointment(eventData) {
  // v3.10.4: Önce eventData.profil kontrol et (eski format uyumluluğu)
  if (eventData.profil) {
    const PROFILE_KEY_TO_CODE = {
      'genel': 'g', 'gunluk': 'w', 'boutique': 'b',
      'yonetim': 'm', 'personel': 's', 'vip': 'v'
    };
    return PROFILE_KEY_TO_CODE[eventData.profil] || eventData.profil || 'g';
  }

  // linkType'dan profili belirle (tek harfli kod formatında)
  if (eventData.linkType === 'vip') return 'v';
  if (eventData.linkType === 'staff') return 's';
  if (eventData.linkType === 'walkin') return 'w';
  if (eventData.linkType === 'management') return 'm';
  if (eventData.linkType === 'boutique') return 'b';
  return 'g'; // default: genel
}

/**
 * ID ile personel bilgisi getir
 * @param {string} staffId - Personel ID
 * @returns {Object|null} Personel bilgisi
 */
function getStaffById(staffId) {
  try {
    console.log(`[getStaffById] Looking for staffId: ${staffId} (type: ${typeof staffId})`);

    // StaffService kullan - Google Sheets'ten doğru okur
    const allStaff = StaffService.getAll();
    console.log(`[getStaffById] Total staff count: ${allStaff.length}`);

    // staffId'yi string'e çevir ve karşılaştır
    const staffIdStr = String(staffId);
    const found = allStaff.find(s => String(s.id) === staffIdStr);

    console.log(`[getStaffById] Found staff:`, found ? `id=${found.id}, name=${found.name}, phone=${found.phone}` : 'null');
    return found || null;
  } catch (error) {
    console.error('[getStaffById] Error:', error);
    return null;
  }
}

/**
 * Role göre personel listesi getir
 * @param {string} role - Personel rolü veya 'admin' (isAdmin: true olanlar)
 * @returns {Object} Personel listesi
 */
function getStaffByRole(role) {
  try {
    // StaffService kullan - Google Sheets'ten doğru okur
    const allStaff = StaffService.getAll();
    let staff;

    console.log(`[getStaffByRole] Total staff count: ${allStaff.length}`);

    // Debug: Tüm staff'ı logla
    allStaff.forEach(s => {
      console.log(`[getStaffByRole] Staff: ${s.name}, phone: ${s.phone}, role: ${s.role}, isAdmin: ${s.isAdmin}, active: ${s.active}`);
    });

    // 'admin' özel durum - isAdmin: true olanları getir
    if (role === 'admin') {
      staff = allStaff.filter(s => s.active && s.isAdmin === true);
      console.log(`[getStaffByRole] admin filter - found ${staff.length} staff with isAdmin:true`);
    } else {
      // Diğer roller için role field'ını kontrol et
      staff = allStaff.filter(s => s.active && s.role === role);
      console.log(`[getStaffByRole] role=${role} filter - found ${staff.length} staff`);
    }

    // Debug: Filtrelenmiş staff listesini logla
    staff.forEach(s => {
      console.log(`[getStaffByRole] Filtered: ${s.name}, phone: ${s.phone}, role: ${s.role}, isAdmin: ${s.isAdmin}`);
    });

    return { success: true, data: staff };
  } catch (error) {
    console.error('getStaffByRole error:', error);
    return { success: false, message: error.toString(), data: [] };
  }
}

/**
 * Bugünün randevularını getir
 * @returns {Object} Randevu listesi
 */
function getTodayAppointments() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const calendar = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
    const events = calendar.getEvents(today, tomorrow);
    
    const appointments = events.map(event => {
      const customerName = event.getTitle().split(' - ')[0] || '';
      const customerPhone = event.getTag('customerPhone') || '';
      const customerEmail = event.getTag('customerEmail') || '';
      const staffId = event.getTag('staffId') || '';
      
      return {
        id: event.getId(),
        customerName: customerName,
        customerPhone: customerPhone,
        customerEmail: customerEmail,
        staffId: staffId,
        startTime: event.getStartTime(),
        endTime: event.getEndTime()
      };
    });
    
    return { success: true, data: appointments };
  } catch (error) {
    console.error('getTodayAppointments error:', error);
    return { success: false, message: error.toString(), data: [] };
  }
}

/**
 * Template değişkenlerini hazırla
 * @param {Object} templateVars - Template değişken tanımları
 * @param {Object} eventData - Event bilgileri
 * @param {Object} recipient - Alıcı bilgileri
 * @returns {Array} Değişken değerleri
 */
function prepareTemplateVariables(templateVars, eventData, recipient) {
  const variables = [];
  
  if (!templateVars) return variables;
  
  // Template'teki her değişken için değer belirle
  Object.keys(templateVars).forEach(varKey => {
    const varType = templateVars[varKey];
    let value = '';
    
    switch (varType) {
      case 'CUSTOMER_NAME':
        value = eventData.customerName || 'Değerli Müşteri';
        break;
      case 'STAFF_NAME':
        value = eventData.staffName || 'İlgili Personel';
        break;
      case 'APPOINTMENT_DATE':
        value = eventData.appointmentDate || '';
        break;
      case 'APPOINTMENT_TIME':
        value = eventData.appointmentTime || '';
        break;
      case 'APPOINTMENT_TYPE':
        value = eventData.appointmentType || '';
        break;
      case 'RECIPIENT_NAME':
        value = recipient.name || '';
        break;
      default:
        value = eventData[varType] || '';
    }
    
    variables.push(value);
  });
  
  return variables;
}

// ==================== v3.10.0: NOTIFICATION FLOWS (UNIFIED) ====================
/**
 * v3.10.5: notification_flows tablosundan WhatsApp için flow'ları getir
 * FIX: Header-based parsing kullan (hardcoded index yerine)
 * FIX: SheetStorageService ile aynı spreadsheet kullan
 */
function getNotificationFlowsForWhatsApp() {
  try {
    // v3.10.5: SheetStorageService kullan - tutarlı veri kaynağı
    const allFlows = SheetStorageService.getAll('notification_flows');

    if (!allFlows || allFlows.length === 0) {
      console.log('[getNotificationFlowsForWhatsApp] notification_flows sheet boş veya bulunamadı');
      return { success: true, data: [] };
    }

    const parseJsonSafe = (val, defaultVal) => {
      if (!val) return defaultVal;
      if (Array.isArray(val)) return val;
      try {
        return JSON.parse(val);
      } catch {
        return defaultVal;
      }
    };

    // v3.10.5: Header-based parsing ile gelen veriyi kullan
    const flows = allFlows.map(row => ({
      id: String(row.id || ''),
      name: String(row.name || ''),
      description: String(row.description || ''),
      trigger: String(row.trigger || ''),
      profiles: parseJsonSafe(row.profiles, []),
      whatsappTemplateIds: parseJsonSafe(row.whatsappTemplateIds, []),
      mailTemplateIds: parseJsonSafe(row.mailTemplateIds, []),
      active: row.active === true || row.active === 'TRUE' || row.active === 'true',
      createdAt: row.createdAt || '',
      updatedAt: row.updatedAt || ''
    })).filter(flow => flow.id && flow.whatsappTemplateIds && flow.whatsappTemplateIds.length > 0);

    console.log('[getNotificationFlowsForWhatsApp] Found', flows.length, 'flows with WhatsApp templates');

    return { success: true, data: flows };
  } catch (error) {
    console.error('getNotificationFlowsForWhatsApp error:', error);
    return { success: false, message: error.toString() };
  }
}

/**
 * @deprecated v3.10.0: Eski FLOWS sheet'i artık kullanılmıyor. notification_flows kullanın.
 * Backward compatibility için getNotificationFlowsForWhatsApp() döner
 */
function getWhatsAppFlows() {
  console.warn('[DEPRECATED] getWhatsAppFlows is deprecated. Use getNotificationFlowsForWhatsApp() instead.');
  // v3.10.0: Backward compatibility - notification_flows'tan oku, eski formatı simüle et
  const result = getNotificationFlowsForWhatsApp();
  if (!result.success) return result;

  // Eski format: templateIds olarak map et
  const mappedFlows = result.data.map(flow => ({
    ...flow,
    templateIds: flow.whatsappTemplateIds, // backward compatibility
    triggerType: 'EVENT' // default triggerType
  }));

  return { success: true, data: mappedFlows };
}

/**
 * @deprecated v3.10.0: Tekil akış getir - FLOWS sheet kaldırıldı
 * Notification flows için getNotificationFlow() kullanın
 */
function getWhatsAppFlow(params) {
  console.warn('[DEPRECATED] getWhatsAppFlow is deprecated. Use getNotificationFlow() instead.');
  return { success: false, message: 'DEPRECATED: FLOWS sheet kaldırıldı. notification_flows kullanın.' };
}

/**
 * @deprecated v3.10.0: Yeni akış ekle - FLOWS sheet kaldırıldı
 * Notification flows için createNotificationFlow() kullanın
 */
function addWhatsAppFlow(params) {
  console.warn('[DEPRECATED] addWhatsAppFlow is deprecated. Use createNotificationFlow() instead.');
  return { success: false, message: 'DEPRECATED: FLOWS sheet kaldırıldı. notification_flows kullanın.' };
}

/**
 * @deprecated v3.10.0: Akışı güncelle - FLOWS sheet kaldırıldı
 * Notification flows için updateNotificationFlow() kullanın
 */
function updateWhatsAppFlow(params) {
  console.warn('[DEPRECATED] updateWhatsAppFlow is deprecated. Use updateNotificationFlow() instead.');
  return { success: false, message: 'DEPRECATED: FLOWS sheet kaldırıldı. notification_flows kullanın.' };
}

/**
 * @deprecated v3.10.0: Akışı sil - FLOWS sheet kaldırıldı
 * Notification flows için deleteNotificationFlow() kullanın
 */
function deleteWhatsAppFlow(params) {
  console.warn('[DEPRECATED] deleteWhatsAppFlow is deprecated. Use deleteNotificationFlow() instead.');
  return { success: false, message: 'DEPRECATED: FLOWS sheet kaldırıldı. notification_flows kullanın.' };
}

/**
 * 🎯 TEMPLATE YÖNETİMİ API - Template Management API Endpoints (Yeni Basitleştirilmiş Sistem)
 */

/**
 * Template oluştur (yeni basitleştirilmiş sistem)
 * v3.10.14: Added metaTemplateName field for Meta Business API template name
 */
function createWhatsAppTemplate(params) {
  try {
    console.log('[createWhatsAppTemplate] params:', JSON.stringify(params));
    // v3.10.23: buttonType ve buttonStaticValue eklendi
    const { name, metaTemplateName, description, variableCount, variables, targetType, language, content, hasButton, buttonType, buttonVariable, buttonStaticValue } = params;

    if (!name || !metaTemplateName || !targetType || variableCount === undefined) {
      console.log('[createWhatsAppTemplate] Missing required fields - name:', name, 'metaTemplateName:', metaTemplateName, 'targetType:', targetType, 'variableCount:', variableCount);
      return { success: false, message: 'Gerekli alanlar: name, metaTemplateName, targetType, variableCount' };
    }

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let sheet = ss.getSheetByName('whatsapp_templates');

    // TEMPLATES sheet yoksa oluştur (v3.10.23: BUTTON_TYPE, BUTTON_STATIC_VALUE eklendi)
    if (!sheet) {
      console.log('[createWhatsAppTemplate] TEMPLATES sheet not found, creating...');
      sheet = ss.insertSheet('whatsapp_templates');
      sheet.getRange(1, 1, 1, 13).setValues([['ID', 'NAME', 'META_TEMPLATE_NAME', 'DESCRIPTION', 'VARIABLE_COUNT', 'VARIABLES', 'TARGET_TYPE', 'LANGUAGE', 'CONTENT', 'HAS_BUTTON', 'BUTTON_TYPE', 'BUTTON_VARIABLE', 'BUTTON_STATIC_VALUE']]);
      console.log('[createWhatsAppTemplate] TEMPLATES sheet created with headers');
    } else {
      // Mevcut sheet'e eksik kolonları ekle
      var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      if (!headers.includes('META_TEMPLATE_NAME')) {
        const nameColIdx = headers.indexOf('NAME');
        if (nameColIdx >= 0) {
          sheet.insertColumnAfter(nameColIdx + 1);
          sheet.getRange(1, nameColIdx + 2).setValue('META_TEMPLATE_NAME');
          console.log('[createWhatsAppTemplate] META_TEMPLATE_NAME column added after NAME');
          headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        }
      }
      if (!headers.includes('LANGUAGE')) {
        const lastCol = sheet.getLastColumn() + 1;
        sheet.getRange(1, lastCol).setValue('LANGUAGE');
        console.log('[createWhatsAppTemplate] LANGUAGE column added to existing sheet');
        headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      }
      if (!headers.includes('CONTENT')) {
        const lastCol = sheet.getLastColumn() + 1;
        sheet.getRange(1, lastCol).setValue('CONTENT');
        console.log('[createWhatsAppTemplate] CONTENT column added to existing sheet');
        headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      }
      // v3.10.22: HAS_BUTTON kolonu yoksa ekle
      if (!headers.includes('HAS_BUTTON')) {
        const lastCol = sheet.getLastColumn() + 1;
        sheet.getRange(1, lastCol).setValue('HAS_BUTTON');
        console.log('[createWhatsAppTemplate] HAS_BUTTON column added to existing sheet');
        headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      }
      // v3.10.23: BUTTON_TYPE kolonu yoksa ekle
      if (!headers.includes('BUTTON_TYPE')) {
        const lastCol = sheet.getLastColumn() + 1;
        sheet.getRange(1, lastCol).setValue('BUTTON_TYPE');
        console.log('[createWhatsAppTemplate] BUTTON_TYPE column added to existing sheet');
        headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      }
      // v3.10.22: BUTTON_VARIABLE kolonu yoksa ekle
      if (!headers.includes('BUTTON_VARIABLE')) {
        const lastCol = sheet.getLastColumn() + 1;
        sheet.getRange(1, lastCol).setValue('BUTTON_VARIABLE');
        console.log('[createWhatsAppTemplate] BUTTON_VARIABLE column added to existing sheet');
        headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      }
      // v3.10.23: BUTTON_STATIC_VALUE kolonu yoksa ekle
      if (!headers.includes('BUTTON_STATIC_VALUE')) {
        const lastCol = sheet.getLastColumn() + 1;
        sheet.getRange(1, lastCol).setValue('BUTTON_STATIC_VALUE');
        console.log('[createWhatsAppTemplate] BUTTON_STATIC_VALUE column added to existing sheet');
      }
    }

    // Re-read headers after potential column additions
    const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const templateId = 'tmpl_' + Date.now();

    // Build row based on current headers (v3.10.19: content, v3.10.22: hasButton, buttonVariable eklendi)
    const newRow = currentHeaders.map(function(header) {
      switch(header) {
        case 'ID': return templateId;
        case 'NAME': return name;
        case 'META_TEMPLATE_NAME': return metaTemplateName;
        case 'DESCRIPTION': return description || '';
        case 'VARIABLE_COUNT': return variableCount;
        case 'VARIABLES': return JSON.stringify(variables || {});
        case 'TARGET_TYPE': return targetType;
        case 'LANGUAGE': return language || 'en';
        case 'CONTENT': return content || '';
        case 'HAS_BUTTON': return hasButton ? 'true' : 'false';
        case 'BUTTON_TYPE': return buttonType || 'dynamic';
        case 'BUTTON_VARIABLE': return buttonVariable || '';
        case 'BUTTON_STATIC_VALUE': return buttonStaticValue || '';
        default: return '';
      }
    });

    console.log('[createWhatsAppTemplate] Appending row:', JSON.stringify(newRow));
    sheet.appendRow(newRow);
    console.log('[createWhatsAppTemplate] Row appended successfully, templateId:', templateId);

    return { success: true, message: 'Template başarıyla oluşturuldu', data: { id: templateId } };
  } catch (error) {
    console.error('[createWhatsAppTemplate] error:', error);
    return { success: false, message: error.toString() };
  }
}

/**
 * Template güncelle (yeni basitleştirilmiş sistem)
 * v3.10.14: Added metaTemplateName field support
 * v3.10.19: Added content field support
 * v3.10.23: Added buttonType and buttonStaticValue field support
 */
function updateWhatsAppTemplate(params) {
  try {
    console.log('[updateWhatsAppTemplate] params:', JSON.stringify(params));
    // v3.10.23: buttonType ve buttonStaticValue eklendi
    const { id, name, metaTemplateName, description, variableCount, variables, targetType, language, content, hasButton, buttonType, buttonVariable, buttonStaticValue } = params;
    console.log('[updateWhatsAppTemplate] id:', id, 'metaTemplateName:', metaTemplateName, 'targetType:', targetType, 'language:', language);

    if (!id) return { success: false, message: 'Template ID gerekli' };

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('whatsapp_templates');
    if (!sheet) return { success: false, message: 'Template sheet bulunamadı' };

    // Get headers and ensure all columns exist
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    // Add META_TEMPLATE_NAME column if missing
    if (!headers.includes('META_TEMPLATE_NAME')) {
      const nameColIdx = headers.indexOf('NAME');
      if (nameColIdx >= 0) {
        sheet.insertColumnAfter(nameColIdx + 1);
        sheet.getRange(1, nameColIdx + 2).setValue('META_TEMPLATE_NAME');
        console.log('[updateWhatsAppTemplate] META_TEMPLATE_NAME column added');
        headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      }
    }

    // Add LANGUAGE column if missing
    if (!headers.includes('LANGUAGE')) {
      const lastCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, lastCol).setValue('LANGUAGE');
      console.log('[updateWhatsAppTemplate] LANGUAGE column added');
      headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    }

    // v3.10.19: Add CONTENT column if missing
    if (!headers.includes('CONTENT')) {
      const lastCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, lastCol).setValue('CONTENT');
      console.log('[updateWhatsAppTemplate] CONTENT column added');
      headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    }

    // v3.10.22: Add HAS_BUTTON column if missing
    if (!headers.includes('HAS_BUTTON')) {
      const lastCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, lastCol).setValue('HAS_BUTTON');
      console.log('[updateWhatsAppTemplate] HAS_BUTTON column added');
      headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    }

    // v3.10.23: Add BUTTON_TYPE column if missing
    if (!headers.includes('BUTTON_TYPE')) {
      const lastCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, lastCol).setValue('BUTTON_TYPE');
      console.log('[updateWhatsAppTemplate] BUTTON_TYPE column added');
      headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    }

    // v3.10.22: Add BUTTON_VARIABLE column if missing
    if (!headers.includes('BUTTON_VARIABLE')) {
      const lastCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, lastCol).setValue('BUTTON_VARIABLE');
      console.log('[updateWhatsAppTemplate] BUTTON_VARIABLE column added');
      headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    }

    // v3.10.23: Add BUTTON_STATIC_VALUE column if missing
    if (!headers.includes('BUTTON_STATIC_VALUE')) {
      const lastCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, lastCol).setValue('BUTTON_STATIC_VALUE');
      console.log('[updateWhatsAppTemplate] BUTTON_STATIC_VALUE column added');
      headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    }

    const data = sheet.getDataRange().getValues();
    console.log('[updateWhatsAppTemplate] sheet data rows:', data.length);

    const rowIndex = data.findIndex(row => String(row[0]) === String(id));
    console.log('[updateWhatsAppTemplate] rowIndex:', rowIndex);

    if (rowIndex === -1) return { success: false, message: 'Template bulunamadı: ' + id };

    // Get column indices
    const getColIndex = function(colName) { return headers.indexOf(colName) + 1; };

    // Update the row using column names (rowIndex + 1 for 1-based indexing)
    if (name) sheet.getRange(rowIndex + 1, getColIndex('NAME')).setValue(name);
    if (metaTemplateName) sheet.getRange(rowIndex + 1, getColIndex('META_TEMPLATE_NAME')).setValue(metaTemplateName);
    if (description !== undefined) sheet.getRange(rowIndex + 1, getColIndex('DESCRIPTION')).setValue(description);
    if (variableCount !== undefined) sheet.getRange(rowIndex + 1, getColIndex('VARIABLE_COUNT')).setValue(variableCount);
    if (variables) sheet.getRange(rowIndex + 1, getColIndex('VARIABLES')).setValue(JSON.stringify(variables));
    if (targetType) sheet.getRange(rowIndex + 1, getColIndex('TARGET_TYPE')).setValue(targetType);
    if (language) sheet.getRange(rowIndex + 1, getColIndex('LANGUAGE')).setValue(language);
    // v3.10.19: content alanı güncelleme
    if (content !== undefined) sheet.getRange(rowIndex + 1, getColIndex('CONTENT')).setValue(content);
    // v3.10.23: hasButton, buttonType, buttonVariable, buttonStaticValue güncelleme
    if (hasButton !== undefined) sheet.getRange(rowIndex + 1, getColIndex('HAS_BUTTON')).setValue(hasButton ? 'true' : 'false');
    if (buttonType !== undefined) sheet.getRange(rowIndex + 1, getColIndex('BUTTON_TYPE')).setValue(buttonType);
    if (buttonVariable !== undefined) sheet.getRange(rowIndex + 1, getColIndex('BUTTON_VARIABLE')).setValue(buttonVariable);
    if (buttonStaticValue !== undefined) sheet.getRange(rowIndex + 1, getColIndex('BUTTON_STATIC_VALUE')).setValue(buttonStaticValue);

    return { success: true, message: 'Template başarıyla güncellendi' };
  } catch (error) {
    console.error('updateWhatsAppTemplate error:', error);
    return { success: false, message: error.toString() };
  }
}

/**
 * Template listesi getir (yeni basitleştirilmiş sistem)
 * v3.10.14: Added metaTemplateName field support
 */
function getWhatsAppTemplates() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('whatsapp_templates');
    if (!sheet) {
      // Eğer TEMPLATES sheet'i yoksa oluştur (v3.10.23: BUTTON_TYPE, BUTTON_STATIC_VALUE kolonları eklendi)
      const templates = ss.insertSheet('whatsapp_templates');
      templates.getRange(1, 1, 1, 13).setValues([['ID', 'NAME', 'META_TEMPLATE_NAME', 'DESCRIPTION', 'VARIABLE_COUNT', 'VARIABLES', 'TARGET_TYPE', 'LANGUAGE', 'CONTENT', 'HAS_BUTTON', 'BUTTON_TYPE', 'BUTTON_VARIABLE', 'BUTTON_STATIC_VALUE']]);
      return { success: true, data: [] };
    }

    // Get column indices from headers
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const getColIndex = function(colName) { return headers.indexOf(colName); };

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: true, data: [] };

    const templates = data.slice(1).map(function(row) {
      var variables = {};
      var variablesCol = getColIndex('VARIABLES');
      if (variablesCol >= 0 && row[variablesCol]) {
        try { variables = JSON.parse(row[variablesCol]); } catch(e) {}
      }

      // Get metaTemplateName - column may or may not exist
      var metaTemplateNameCol = getColIndex('META_TEMPLATE_NAME');
      var nameCol = getColIndex('NAME');
      var metaTemplateName = metaTemplateNameCol >= 0 ? (row[metaTemplateNameCol] || '') : '';
      var displayName = nameCol >= 0 ? (row[nameCol] || '') : '';

      // v3.10.16: metaTemplateName boşsa boş bırak - _sendToSingleRecipient zaten fallback yapıyor

      // v3.10.19: content alanı eklendi
      var contentCol = getColIndex('CONTENT');
      var content = contentCol >= 0 ? (row[contentCol] || '') : '';

      // v3.10.23: Button alanları eklendi (buttonType, buttonStaticValue)
      var hasButtonCol = getColIndex('HAS_BUTTON');
      var hasButton = hasButtonCol >= 0 ? (row[hasButtonCol] === 'true' || row[hasButtonCol] === true) : false;
      var buttonTypeCol = getColIndex('BUTTON_TYPE');
      var buttonType = buttonTypeCol >= 0 ? (row[buttonTypeCol] || 'dynamic') : 'dynamic';
      var buttonVariableCol = getColIndex('BUTTON_VARIABLE');
      var buttonVariable = buttonVariableCol >= 0 ? (row[buttonVariableCol] || '') : '';
      var buttonStaticValueCol = getColIndex('BUTTON_STATIC_VALUE');
      var buttonStaticValue = buttonStaticValueCol >= 0 ? (row[buttonStaticValueCol] || '') : '';

      return {
        id: row[getColIndex('ID')] || '',
        name: displayName,
        metaTemplateName: metaTemplateName,
        description: row[getColIndex('DESCRIPTION')] || '',
        variableCount: Number(row[getColIndex('VARIABLE_COUNT')]) || 0,
        variables: variables,
        targetType: row[getColIndex('TARGET_TYPE')] || '',
        language: row[getColIndex('LANGUAGE')] || 'en',
        content: content, // v3.10.19: WhatsApp şablon içeriği
        hasButton: hasButton, // v3.10.22: Düğme var mı?
        buttonType: buttonType, // v3.10.23: Düğme tipi (dynamic/static)
        buttonVariable: buttonVariable, // v3.10.22: Düğme değişkeni (dynamic için)
        buttonStaticValue: buttonStaticValue // v3.10.23: Düğme serbest yazı değeri (static için)
      };
    }).filter(function(template) { return template.id; });

    return { success: true, data: templates };
  } catch (error) {
    console.error('getWhatsAppTemplates error:', error);
    return { success: false, message: error.toString() };
  }
}

/**
 * Template sil
 */
function deleteWhatsAppTemplate(params) {
  try {
    const templateId = params.id;
    if (!templateId) return { success: false, message: 'Template ID gerekli' };

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('whatsapp_templates');
    if (!sheet) return { success: false, message: 'Template sheet bulunamadı' };

    const data = sheet.getDataRange().getValues();
    const rowIndex = data.findIndex(row => row[0] === templateId);

    if (rowIndex === -1) return { success: false, message: 'Template bulunamadı' };

    sheet.deleteRow(rowIndex + 1);

    return { success: true, message: 'Template başarıyla silindi' };
  } catch (error) {
    console.error('deleteWhatsAppTemplate error:', error);
    return { success: false, message: error.toString() };
  }
}

/**
 * 📅 GÜNLüK GÖREVLER API - Daily Tasks API Endpoints
 */

/**
 * Günlük görevleri getir
 */
function getDailyTasks() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('daily_tasks');
    if (!sheet) {
      // Eğer DAILY_TASKS sheet'i yoksa oluştur
      const dailyTasks = ss.insertSheet('daily_tasks');
      dailyTasks.getRange(1, 1, 1, 6).setValues([['ID', 'NAME', 'DESCRIPTION', 'TIME', 'TARGET_DAY', 'TEMPLATE_ID', 'ACTIVE']]);
      return { success: true, data: [] };
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: true, data: [] };

    const tasks = data.slice(1).map(row => ({
      id: row[0] || '',
      name: row[1] || '',
      description: row[2] || '',
      time: row[3] || '',
      targetDay: row[4] || '',
      templateId: row[5] || '',
      active: row[6] === true || row[6] === 'TRUE'
    })).filter(task => task.id);

    return { success: true, data: tasks };
  } catch (error) {
    console.error('getDailyTasks error:', error);
    return { success: false, message: error.toString() };
  }
}

/**
 * Tekil günlük görev getir
 */
function getDailyTask(params) {
  try {
    const taskId = params.id;
    if (!taskId) return { success: false, message: 'Task ID gerekli' };

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('daily_tasks');
    if (!sheet) return { success: false, message: 'Daily tasks sheet bulunamadı' };

    const data = sheet.getDataRange().getValues();
    const taskRow = data.find(row => row[0] === taskId);

    if (!taskRow) return { success: false, message: 'Görev bulunamadı' };

    const task = {
      id: taskRow[0],
      name: taskRow[1],
      description: taskRow[2],
      time: taskRow[3],
      targetDay: taskRow[4],
      templateId: taskRow[5],
      active: taskRow[6] === true || taskRow[6] === 'TRUE'
    };

    return { success: true, data: task };
  } catch (error) {
    console.error('getDailyTask error:', error);
    return { success: false, message: error.toString() };
  }
}

/**
 * Yeni günlük görev ekle
 */
function addDailyTask(params) {
  try {
    const { name, description, time, targetDay, templateId, active } = params;
    
    if (!name || !time || !targetDay || !templateId) {
      return { success: false, message: 'Gerekli alanlar: name, time, targetDay, templateId' };
    }

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('daily_tasks');
    if (!sheet) return { success: false, message: 'Daily tasks sheet bulunamadı' };

    const taskId = 'task_' + Date.now();
    const newRow = [
      taskId,
      name,
      description || '',
      time,
      targetDay,
      templateId,
      active !== false ? true : false
    ];

    sheet.appendRow(newRow);

    return { success: true, message: 'Günlük görev başarıyla eklendi', data: { id: taskId } };
  } catch (error) {
    console.error('addDailyTask error:', error);
    return { success: false, message: error.toString() };
  }
}

/**
 * Günlük görevi güncelle
 */
function updateDailyTask(params) {
  try {
    const { id, name, description, time, targetDay, templateId, active } = params;
    
    if (!id) return { success: false, message: 'Task ID gerekli' };

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('daily_tasks');
    if (!sheet) return { success: false, message: 'Daily tasks sheet bulunamadı' };

    const data = sheet.getDataRange().getValues();
    const rowIndex = data.findIndex(row => row[0] === id);

    if (rowIndex === -1) return { success: false, message: 'Görev bulunamadı' };

    // Update the row (rowIndex + 1 for 1-based indexing)
    if (name) sheet.getRange(rowIndex + 1, 2).setValue(name);
    if (description !== undefined) sheet.getRange(rowIndex + 1, 3).setValue(description);
    if (time) sheet.getRange(rowIndex + 1, 4).setValue(time);
    if (targetDay) sheet.getRange(rowIndex + 1, 5).setValue(targetDay);
    if (templateId) sheet.getRange(rowIndex + 1, 6).setValue(templateId);
    if (active !== undefined) sheet.getRange(rowIndex + 1, 7).setValue(active);

    return { success: true, message: 'Günlük görev başarıyla güncellendi' };
  } catch (error) {
    console.error('updateDailyTask error:', error);
    return { success: false, message: error.toString() };
  }
}

/**
 * Günlük görevi sil
 */
function deleteDailyTask(params) {
  try {
    const taskId = params.id;
    if (!taskId) return { success: false, message: 'Task ID gerekli' };

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('daily_tasks');
    if (!sheet) return { success: false, message: 'Daily tasks sheet bulunamadı' };

    const data = sheet.getDataRange().getValues();
    const rowIndex = data.findIndex(row => row[0] === taskId);

    if (rowIndex === -1) return { success: false, message: 'Görev bulunamadı' };

    sheet.deleteRow(rowIndex + 1);

    return { success: true, message: 'Günlük görev başarıyla silindi' };
  } catch (error) {
    console.error('deleteDailyTask error:', error);
    return { success: false, message: error.toString() };
  }
}

/**
 * Mevcut WhatsApp trigger'larını listele
 */
function listWhatsAppTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  const whatsappTriggers = [];

  triggers.forEach(function(trigger) {
    const funcName = trigger.getHandlerFunction();
    if (funcName.startsWith('sendTemplate') || funcName === 'sendAllTemplates') {
      whatsappTriggers.push({
        function: funcName,
        type: trigger.getEventType().toString(),
        id: trigger.getUniqueId()
      });
    }
  });

  Logger.log('WhatsApp Trigger\'lar: ' + JSON.stringify(whatsappTriggers, null, 2));
  return { success: true, triggers: whatsappTriggers };
}

/**
 * Tüm WhatsApp trigger'larını sil
 */
function deleteWhatsAppTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  let deletedCount = 0;

  triggers.forEach(function(trigger) {
    const funcName = trigger.getHandlerFunction();
    if (funcName.startsWith('sendTemplate') || funcName === 'sendAllTemplates') {
      ScriptApp.deleteTrigger(trigger);
      deletedCount++;
    }
  });

  Logger.log(deletedCount + ' trigger silindi');
  return { success: true, deleted: deletedCount };
}
