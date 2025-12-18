/**
 * Slack.gs
 *
 * Slack Integration Service
 *
 * This module handles Slack webhook integration for daily appointment reminders
 * and notifications using Slack Block Kit for formatted messages.
 *
 * Services:
 * - SlackService: Slack webhook operations and message formatting
 *
 * Dependencies:
 * - Config.gs (CONFIG)
 * - WhatsApp.gs (WhatsAppService)
 * - Auth.gs (AuthService)
 * - Security.gs (log)
 */

// --- Slack Service ---
/**
 * Slack webhook integration service
 * Handles daily reminders and Slack settings management
 * @namespace SlackService
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

      // ✅ YENİ: Audit log
      log.info('🔒 AUDIT: Slack settings updated', {
        timestamp: new Date().toISOString(),
        action: 'SLACK_SETTINGS_UPDATE',
        configured: !!webhookUrl
      });

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
      'delivery': 'Saat Takdim',
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
              text: `*İlgili Personel:*\n${apt.staffName}`
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
  }
};

// ==================== TRIGGER FUNCTIONS ====================
// Bu fonksiyonlar Google Apps Script trigger'ları tarafından çağrılır

/**
 * Günlük Slack hatırlatmaları gönder
 * Time-based trigger tarafından çağrılır (örn: her gün 09:00)
 * API key gerektirmez (server-side çalışır)
 */
function sendDailySlackReminders() {
  try {
    // Slack Webhook URL'i Script Properties'den al
    const scriptProperties = PropertiesService.getScriptProperties();
    const webhookUrl = scriptProperties.getProperty('SLACK_WEBHOOK_URL');

    if (!webhookUrl) {
      log.warn('Slack Webhook URL yapılandırılmamış - bildirim gönderilmedi');
      return {
        success: false,
        error: 'Slack Webhook URL yapılandırılmamış'
      };
    }

    // Bugünün tarihini hesapla
    const today = new Date();
    const todayDateStr = Utilities.formatDate(today, CONFIG.TIMEZONE || 'Europe/Istanbul', 'yyyy-MM-dd');
    const todayFormatted = Utilities.formatDate(today, CONFIG.TIMEZONE || 'Europe/Istanbul', 'd MMMM yyyy, EEEE');

    log.info('Günlük Slack bildirimi gönderiliyor:', todayDateStr);

    // Bugünün randevularını al
    const reminders = WhatsAppService.getTodayWhatsAppReminders(todayDateStr);

    if (!reminders.success) {
      log.error('Randevular alınamadı:', reminders.error);
      return { success: false, error: reminders.error };
    }

    const appointments = reminders.data || [];

    // Slack mesajını formatla
    const slackMessage = SlackService.formatSlackMessage(appointments, todayFormatted);

    // Slack'e gönder
    const response = UrlFetchApp.fetch(webhookUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(slackMessage),
      muteHttpExceptions: true
    });

    const responseCode = response.getResponseCode();

    if (responseCode === 200) {
      log.info('Slack bildirimi başarıyla gönderildi. Randevu sayısı:', appointments.length);
      return {
        success: true,
        appointmentCount: appointments.length,
        date: todayDateStr
      };
    } else {
      log.error('Slack webhook hatası:', response.getContentText());
      return {
        success: false,
        error: 'Slack webhook hatası: ' + responseCode
      };
    }

  } catch (error) {
    log.error('sendDailySlackReminders hatası:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}
