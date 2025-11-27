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
            { type: "text", text: customerName },  // {{1}}
            { type: "text", text: appointmentDateTime },  // {{2}}
            { type: "text", text: staffName },  // {{3}}
            { type: "text", text: translatedType }  // {{4}}
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
          language: { code: 'tr' },
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
        const linkParts = reminder.link.split('?');
        const phone = linkParts[0].split('/').pop();
        const appointmentDateTime = DateUtils.formatAppointmentDateTime(reminder.date, reminder.time);

        const result = this.sendWhatsAppMessage(
          phone,
          reminder.customerName,
          appointmentDateTime,
          reminder.staffName,
          reminder.appointmentType.toLowerCase(),
          reminder.staffPhone || ''
        );

        if (result.success) {
          sentCount++;
          results.push({
            customer: reminder.customerName,
            phone: phone,
            status: 'success',
            messageId: result.messageId
          });
        } else {
          failedCount++;
          results.push({
            customer: reminder.customerName,
            phone: phone,
            status: 'failed',
            error: result.error
          });
        }

        // Rate limiting - Meta: 80 mesaj/saniye
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
  const scriptProperties = PropertiesService.getScriptProperties();
  const phoneNumberId = scriptProperties.getProperty('WHATSAPP_PHONE_NUMBER_ID');
  const accessToken = scriptProperties.getProperty('WHATSAPP_ACCESS_TOKEN');

  Logger.log('=== WhatsApp Setup Test ===');
  Logger.log('WHATSAPP_PHONE_NUMBER_ID: ' + (phoneNumberId ? '✅ Ayarlanmış (' + phoneNumberId.substring(0, 5) + '...)' : '❌ EKSİK'));
  Logger.log('WHATSAPP_ACCESS_TOKEN: ' + (accessToken ? '✅ Ayarlanmış (' + accessToken.substring(0, 10) + '...)' : '❌ EKSİK'));

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

    // Her randevu için mesaj gönder
    reminders.data.forEach(function(reminder) {
      try {
        const result = WhatsAppService.sendWhatsAppMessage(
          reminder.phone,
          reminder.customerName,
          reminder.dateTime,
          reminder.staffName,
          reminder.appointmentType,
          reminder.staffPhone
        );

        if (result.success) {
          sentCount++;
          results.push({ phone: reminder.phone, status: 'sent' });
        } else {
          failedCount++;
          results.push({ phone: reminder.phone, status: 'failed', error: result.error });
        }

        // Rate limiting
        Utilities.sleep(100);

      } catch (e) {
        failedCount++;
        results.push({ phone: reminder.phone, status: 'error', error: e.toString() });
      }
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
