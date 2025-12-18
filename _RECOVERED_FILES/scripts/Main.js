/**
 * Main.gs
 *
 * Main Entry Points and Request Routing
 *
 * This module provides the main entry points for the Google Apps Script Web App:
 * - doGet: HTTP GET request handler
 * - doPost: HTTP POST request handler
 * - doOptions: CORS preflight handler
 *
 * Routes requests to appropriate service handlers based on action parameter.
 *
 * Dependencies:
 * - All other modules (Config, Security, Auth, Storage, Staff, Settings, Calendar,
 *   Appointments, Validation, Notifications, WhatsApp, Slack)
 */

// Admin işlemleri için API key gereken action'lar
const ADMIN_ACTIONS = [
  'addStaff', 'toggleStaff', 'removeStaff', 'updateStaff',
  'saveShifts', 'saveSettings', 'deleteAppointment', 'resetData',
  'regenerateApiKey',
  'createManualAppointment',
  'getTodayWhatsAppReminders',
  'sendWhatsAppReminders',
  'updateWhatsAppSettings',
  'getWhatsAppSettings',
  'updateSlackSettings',
  'getSlackSettings',
  // Backup management
  'createBackup', 'listBackups', 'restoreBackup'
];

// Action handler map - daha okunabilir ve yönetilebilir
const ACTION_HANDLERS = {
  // Test & Health Check
  'test': () => ({ status: 'ok', message: 'Apps Script çalışıyor!' }),

  // Health Check Endpoint - Sistem durumunu kontrol eder
  'healthCheck': () => {
    const startTime = Date.now();
    const checks = {
      calendar: false,
      storage: false,
      cache: false
    };

    try {
      // 1. Calendar bağlantısı kontrol
      const calendar = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
      checks.calendar = !!calendar;

      // 2. Storage (PropertiesService) kontrol
      const props = PropertiesService.getScriptProperties();
      const testKey = props.getProperty(CONFIG.PROPERTIES_KEY);
      checks.storage = testKey !== undefined; // null olabilir ama undefined olmamalı

      // 3. Cache (CacheService) kontrol
      const cache = CacheService.getScriptCache();
      cache.put('health_check_test', 'ok', 10);
      const cacheTest = cache.get('health_check_test');
      checks.cache = cacheTest === 'ok';
      cache.remove('health_check_test');

    } catch (error) {
      log.error('Health check error:', error);
    }

    const allHealthy = checks.calendar && checks.storage && checks.cache;
    const responseTime = Date.now() - startTime;

    return {
      success: true,
      status: allHealthy ? 'healthy' : 'degraded',
      checks: checks,
      responseTime: responseTime + 'ms',
      timestamp: new Date().toISOString(),
      version: CONFIG.VERSION || '2.0.0'
    };
  },

  // API Key management
  'initializeApiKey': () => AuthService.initializeApiKey(),
  'regenerateApiKey': (e) => AuthService.regenerateApiKey(e.parameter.oldKey),

  // Staff management
  'getStaff': () => StaffService.getStaff(),
  'addStaff': (e) => StaffService.addStaff(e.parameter.name, e.parameter.phone, e.parameter.email),
  'toggleStaff': (e) => StaffService.toggleStaff(e.parameter.id),
  'removeStaff': (e) => StaffService.removeStaff(e.parameter.id),
  'updateStaff': (e) => StaffService.updateStaff(e.parameter.id, e.parameter.name, e.parameter.phone, e.parameter.email),

  // Shifts management
  'getShifts': (e) => ShiftService.getShifts(e.parameter.date),
  'getMonthShifts': (e) => ShiftService.getMonthShifts(e.parameter.month),
  'saveShifts': (e) => ShiftService.saveShifts(JSON.parse(e.parameter.shifts)),

  // Settings management
  'getSettings': () => SettingsService.getSettings(),
  'saveSettings': (e) => SettingsService.saveSettings(e.parameter),

  // Data version (cache invalidation)
  'getDataVersion': () => VersionService.getDataVersion(),

  // Appointments
  'getAppointments': (e) => AppointmentService.getAppointments(e.parameter.date, {
    countOnly: e.parameter.countOnly === 'true',
    appointmentType: e.parameter.appointmentType || null
  }),
  'getWeekAppointments': (e) => AppointmentService.getWeekAppointments(e.parameter.startDate, e.parameter.endDate),
  'deleteAppointment': (e) => AppointmentService.deleteAppointment(e.parameter.eventId),
  'updateAppointment': (e) => AppointmentService.updateAppointment(e.parameter.eventId, e.parameter.newDate, e.parameter.newTime),
  'getAvailableSlotsForEdit': (e) => AvailabilityService.getAvailableSlotsForEdit(e.parameter.date, e.parameter.currentEventId, e.parameter.appointmentType),
  'assignStaffToAppointment': (e) => AppointmentService.assignStaff(e.parameter.eventId, e.parameter.staffId),
  'getMonthAppointments': (e) => AppointmentService.getMonthAppointments(e.parameter.month),
  'getGoogleCalendarEvents': (e) => CalendarService.getGoogleEvents(e.parameter.startDate, e.parameter.endDate, e.parameter.staffId),
  'createAppointment': (e) => createAppointment(e.parameter),

  // Availability calculation (server-side blocking logic)
  'checkTimeSlotAvailability': (e) => AvailabilityService.checkTimeSlotAvailability(
    e.parameter.date,
    e.parameter.staffId,
    e.parameter.shiftType,
    e.parameter.appointmentType,
    e.parameter.interval
  ),

  // WhatsApp ve Manuel Randevu
  'getTodayWhatsAppReminders': (e) => WhatsAppService.getTodayWhatsAppReminders(e.parameter.date),
  'createManualAppointment': (e) => AppointmentService.createManual(e.parameter),

  // WhatsApp Business Cloud API
  'sendWhatsAppReminders': (e) => WhatsAppService.sendWhatsAppReminders(e.parameter.date, e.parameter.apiKey),

  // Slack Webhook
  'updateSlackSettings': (e) => SlackService.updateSlackSettings(e.parameter.webhookUrl, e.parameter.apiKey),
  'getSlackSettings': (e) => SlackService.getSlackSettings(e.parameter.apiKey),

  // Backup Management (admin only)
  'createBackup': () => BackupService.createBackup('manual'),
  'listBackups': () => BackupService.listBackups(),
  'restoreBackup': (e) => BackupService.restoreBackup(e.parameter.backupId),

  // Config management (public - no auth required)
  'getConfig': () => ConfigService.getConfig(),

  // Slot Universe & Business Rules
  'getDayStatus': (e) => AvailabilityService.getDayStatus(e.parameter.date, e.parameter.appointmentType),
  'getDailySlots': (e) => ({
    success: true,
    slots: SlotService.getDailySlots(e.parameter.date, e.parameter.shiftType || 'full')
  }),
  'validateReservation': (e) => ValidationService.validateReservation({
    date: e.parameter.date,
    hour: parseInt(e.parameter.hour),
    appointmentType: e.parameter.appointmentType,
    staffId: e.parameter.staffId
  }),

  // Yönetim Linki API'leri (hk, ok, hmk)
  'getManagementSlotAvailability': (e) => AvailabilityService.getManagementSlots(
    e.parameter.date,
    parseInt(e.parameter.managementLevel)
  ),
  'getAvailableStaffForSlot': (e) => AvailabilityService.getAvailableStaffForSlot(
    e.parameter.date,
    e.parameter.time
  ),

  // Data management
  'resetData': () => StorageService.resetData()
};

/**
 * HTTP GET request handler
 * Routes requests to appropriate service handlers
 * @param {Object} e - Event parameter with query parameters
 * @returns {ContentService.TextOutput} JSON response
 */
function doGet(e) {
  try {
    const action = e.parameter.action;
    const apiKey = e.parameter.apiKey;

    let response = {};

    try {
      // Admin action kontrolü - API key gerekli mi?
      if (ADMIN_ACTIONS.includes(action)) {
        if (!AuthService.validateApiKey(apiKey)) {
          response = {
            success: false,
            error: CONFIG.ERROR_MESSAGES.AUTH_ERROR,
            requiresAuth: true
          };
        } else {
          // API key geçerli, handler'ı çalıştır
          const handler = ACTION_HANDLERS[action];
          if (!handler) {
            response = { success: false, error: CONFIG.ERROR_MESSAGES.UNKNOWN_ACTION + ': ' + action };
          } else {
            response = handler(e);
          }
        }
      } else {
        // Normal action (API key gerekmez)
        const handler = ACTION_HANDLERS[action];

        if (!handler) {
          response = { success: false, error: CONFIG.ERROR_MESSAGES.UNKNOWN_ACTION + ': ' + action };
        } else {
          response = handler(e);
        }
      }
    } catch (error) {
      // Detaylı hata bilgisini sadece sunucu tarafında logla (güvenlik)
      log.error('API Hatası:', {
        message: error.message,
        stack: error.stack,
        action: action,
        parameters: e.parameter
      });
      // Kullanıcıya sadece genel hata mesajı gönder
      response = { success: false, error: CONFIG.ERROR_MESSAGES.SERVER_ERROR };
    }

    // Her zaman JSON döndür
    const output = ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);

    // CORS: Google Apps Script otomatik olarak Access-Control-Allow-Origin: * ekler
    return output;

  } catch (mainError) {
    // En dıştaki catch - JSON döndür
    log.error('Ana hata:', mainError);

    const errorResponse = { success: false, error: mainError.toString() };

    return ContentService
      .createTextOutput(JSON.stringify(errorResponse))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * HTTP POST request handler
 * Handles POST requests with JSON body (more secure for sensitive data)
 * @param {Object} e - Event parameter with POST data
 * @returns {ContentService.TextOutput} JSON response
 */
function doPost(e) {
  try {
    // POST body'sini parse et (JSON)
    if (!e.postData || !e.postData.contents) {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          error: 'POST body boş olamaz'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const params = JSON.parse(e.postData.contents);
    const action = params.action;
    const apiKey = params.apiKey;

    log.info('POST request received:', action);

    let response = {};

    try {
      // Admin action kontrolü - API key gerekli mi?
      if (ADMIN_ACTIONS.includes(action)) {
        if (!AuthService.validateApiKey(apiKey)) {
          response = {
            success: false,
            error: CONFIG.ERROR_MESSAGES.AUTH_ERROR,
            requiresAuth: true
          };
        } else {
          // API key geçerli, handler'ı çalıştır
          const handler = ACTION_HANDLERS[action];
          if (!handler) {
            response = { success: false, error: CONFIG.ERROR_MESSAGES.UNKNOWN_ACTION + ': ' + action };
          } else {
            // Handler'a params'ı e.parameter formatında geçir (backward compatibility)
            response = handler({ parameter: params });
          }
        }
      } else {
        // Normal action (API key gerekmez)
        const handler = ACTION_HANDLERS[action];

        if (!handler) {
          response = { success: false, error: CONFIG.ERROR_MESSAGES.UNKNOWN_ACTION + ': ' + action };
        } else {
          response = handler({ parameter: params });
        }
      }
    } catch (handlerError) {
      log.error('Handler error:', handlerError);
      response = { success: false, error: handlerError.toString() };
    }

    // JSON döndür
    return ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (mainError) {
    log.error('doPost error:', mainError);
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: CONFIG.ERROR_MESSAGES.SERVER_ERROR + ': ' + mainError.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle OPTIONS preflight requests for CORS
 * Modern browsers send OPTIONS request before POST/GET for CORS validation
 * @param {Object} e - Event parameter
 * @returns {ContentService.TextOutput} Empty response
 */
function doOptions(e) {
  return ContentService
    .createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}
