/**
 * Settings.gs
 *
 * Application Settings and Configuration Management
 *
 * This module handles application settings (interval, maxDaily), public configuration
 * for the frontend, and external configuration loading from Script Properties.
 *
 * Services:
 * - SettingsService: Application settings management
 * - ConfigService: Public configuration for frontend
 *
 * Functions:
 * - loadExternalConfigs: Load sensitive configs from Script Properties
 * - loadWhatsAppConfig: Backward compatibility wrapper
 *
 * Dependencies:
 * - Config.gs (CONFIG, VALIDATION)
 * - Storage.gs (StorageService)
 * - Security.gs (LockServiceWrapper, log)
 */

// --- Settings Management ---
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

// --- Config Management ---
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

// --- External Configuration Loaders ---

/**
 * Load external sensitive configurations from Script Properties
 * Includes Calendar ID, Turnstile Secret, WhatsApp credentials, Slack webhook
 *
 * Security Notes:
 * - Calendar ID: Gmail account (sensitive)
 * - Turnstile Secret: Critical for bot protection
 * - WhatsApp credentials: Business API tokens
 * - Slack webhook: Notification URL
 *
 * Development Mode (CALENDAR_ID = 'primary'):
 *   - TURNSTILE_SECRET_KEY yoksa Cloudflare test key kullanılır
 *   - Uyarı mesajı loglanır
 */
function loadExternalConfigs() {
  const scriptProperties = PropertiesService.getScriptProperties();

  // 🔒 SECURITY: Calendar ID (Gmail hesabı - sensitive)
  const calendarId = scriptProperties.getProperty('CALENDAR_ID');
  if (calendarId) {
    CONFIG.CALENDAR_ID = calendarId;
    log.info('✅ Calendar ID yüklendi (Script Properties)', { env: 'production' });
  } else {
    log.info('⚠️ Calendar ID bulunamadı, fallback kullanılıyor', {
      fallback: 'primary',
      env: 'development'
    });
  }

  // 🔒 SECURITY: Cloudflare Turnstile Secret (CRITICAL)
  const turnstileSecret = scriptProperties.getProperty('TURNSTILE_SECRET_KEY');

  if (turnstileSecret) {
    // ✅ PRODUCTION: Secret Properties'den yüklendi
    CONFIG.TURNSTILE_SECRET_KEY = turnstileSecret;
    log.info('✅ Turnstile secret yüklendi (Script Properties)', {
      source: 'Script Properties',
      env: CONFIG.IS_DEVELOPMENT ? 'development' : 'production'
    });
  } else {
    // ⚠️ SECRET BULUNAMADI
    if (CONFIG.IS_DEVELOPMENT) {
      // DEVELOPMENT MODE: Cloudflare test key kullan
      CONFIG.TURNSTILE_SECRET_KEY = '1x0000000000000000000000000000000';
      log.warn('⚠️ DEVELOPMENT MODE: Turnstile test key kullanılıyor', {
        warning: 'Script Properties\'de TURNSTILE_SECRET_KEY tanımlı değil',
        fallback: 'Cloudflare test key (1x0000...)',
        action: 'Production\'da Script Properties\'i ayarlayın'
      });
    } else {
      // PRODUCTION MODE: HATA - Secret zorunlu!
      const errorMsg =
        '🚨 CRITICAL: TURNSTILE_SECRET_KEY Script Properties\'de tanımlı değil!\n' +
        'Çözüm:\n' +
        '1. Google Apps Script Editor\'ü açın\n' +
        '2. Project Settings → Script Properties\n' +
        '3. Add property:\n' +
        '   Key: TURNSTILE_SECRET_KEY\n' +
        '   Value: <your-cloudflare-turnstile-secret>\n' +
        '4. Script\'i yeniden deploy edin';

      log.error(errorMsg, {
        env: 'production',
        calendarId: CONFIG.CALENDAR_ID
      });

      throw new Error(errorMsg);
    }
  }

  // 🔒 SECURITY: WhatsApp Business API Credentials
  CONFIG.WHATSAPP_PHONE_NUMBER_ID = scriptProperties.getProperty('WHATSAPP_PHONE_NUMBER_ID') || '';
  CONFIG.WHATSAPP_ACCESS_TOKEN = scriptProperties.getProperty('WHATSAPP_ACCESS_TOKEN') || '';
  CONFIG.WHATSAPP_BUSINESS_ACCOUNT_ID = scriptProperties.getProperty('WHATSAPP_BUSINESS_ACCOUNT_ID') || '';

  // 🔒 SECURITY: Slack Webhook URL
  CONFIG.SLACK_WEBHOOK_URL = scriptProperties.getProperty('SLACK_WEBHOOK_URL') || '';

  // Summary log
  log.info('📋 External configs yüklendi', {
    environment: CONFIG.IS_DEVELOPMENT ? 'development' : 'production',
    calendarId: CONFIG.CALENDAR_ID,
    hasTurnstileKey: !!CONFIG.TURNSTILE_SECRET_KEY,
    hasWhatsAppCredentials: !!(CONFIG.WHATSAPP_PHONE_NUMBER_ID && CONFIG.WHATSAPP_ACCESS_TOKEN),
    hasSlackWebhook: !!CONFIG.SLACK_WEBHOOK_URL
  });
}

// Backward compatibility
function loadWhatsAppConfig() {
  loadExternalConfigs();
}

// Script başlatıldığında config'leri yükle
loadExternalConfigs();
