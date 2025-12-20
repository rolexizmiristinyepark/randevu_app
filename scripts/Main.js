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

// Admin işlemleri için API key gereken action'lar (legacy)
// v3.0: Session token ile admin işlemleri için SESSION_ADMIN_ACTIONS kullanılıyor
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
  'createBackup', 'listBackups', 'restoreBackup',
  // Profil ayarları (v3.3)
  'updateProfilAyarlari', 'resetProfilAyarlari',
  // WhatsApp Flow System (v3.4) - getWhatsAppFlows public (read-only)
  'addWhatsAppFlow', 'updateWhatsAppFlow', 'deleteWhatsAppFlow',
  // WhatsApp Daily Tasks (v3.4) - getWhatsAppDailyTasks public (read-only)
  'addWhatsAppDailyTask', 'updateWhatsAppDailyTask', 'deleteWhatsAppDailyTask'
];

// v3.0: Session bazlı admin işlemleri (SessionAuthService ile)
const SESSION_ADMIN_ACTIONS = [
  'createStaff', 'updateStaffV3', 'getAllLinks', 'regenerateLink',
  // WhatsApp Template CRUD (v3.2)
  'getWhatsAppTemplates', 'createWhatsAppTemplate', 'updateWhatsAppTemplate', 'deleteWhatsAppTemplate', 'getWhatsAppVariableOptions',
  // WhatsApp Message Log (v4.0)
  'getWhatsAppMessages', 'getWhatsAppMessageStats', 'getAppointmentMessages'
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

  // Staff management (legacy)
  'getStaff': () => StaffService.getStaff(),
  'addStaff': (e) => StaffService.addStaff(e.parameter.name, e.parameter.phone, e.parameter.email),
  'toggleStaff': (e) => StaffService.toggleStaff(e.parameter.id),
  'removeStaff': (e) => StaffService.removeStaff(e.parameter.id),
  'updateStaff': (e) => StaffService.updateStaff(e.parameter.id, e.parameter.name, e.parameter.phone, e.parameter.email),

  // Staff management v3.0 (session bazlı)
  'getStaffByRole': (e) => ({ success: true, data: StaffService.getByRole(e.parameter.role) }),
  'createStaff': (e) => StaffService.create({
    name: e.parameter.name,
    email: e.parameter.email,
    phone: e.parameter.phone,
    role: e.parameter.role,
    isAdmin: e.parameter.isAdmin === 'true'
  }),
  'updateStaffV3': (e) => StaffService.update(e.parameter.id, {
    name: e.parameter.name,
    email: e.parameter.email,
    phone: e.parameter.phone,
    role: e.parameter.role,
    isAdmin: e.parameter.isAdmin === 'true',
    active: e.parameter.active === 'true'
  }),

  // Session Auth v3.0
  'login': (e) => SessionAuthService.login(e.parameter.email, e.parameter.password),
  'validateSession': (e) => SessionAuthService.validateSession(e.parameter.token),
  'logout': (e) => SessionAuthService.logout(e.parameter.token),
  'resetPassword': (e) => SessionAuthService.resetPassword(e.parameter.email),
  'changePassword': (e) => SessionAuthService.changePassword(e.parameter.token, e.parameter.oldPassword, e.parameter.newPassword),

  // Links v3.3 (basit hash format: #w, #g, #b, #m, #s/{id}, #v/{id})
  'resolveUrl': (e) => UrlResolver.resolve(e.parameter.hash),
  'resolveId': (e) => LegacyResolver.resolve(e.parameter.id),
  'getAllLinks': () => LinkAggregator.getAllLinks(),
  'buildProfileUrl': (e) => ({ success: true, url: UrlResolver.buildUrl(e.parameter.code, e.parameter.staffId) }),

  // Shifts management
  'getShifts': (e) => ShiftService.getShifts(e.parameter.date),
  'getMonthShifts': (e) => ShiftService.getMonthShifts(e.parameter.month),
  'saveShifts': (e) => ShiftService.saveShifts(JSON.parse(e.parameter.shifts)),

  // Settings management
  'getSettings': () => SettingsService.getSettings(),
  'saveSettings': (e) => SettingsService.saveSettings(e.parameter),

  // Data version (cache invalidation)
  'getDataVersion': () => VersionService.getDataVersion(),
  'checkStorageUsage': () => PropertiesStorageService.checkStorageUsage(),

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

  // WhatsApp Business API Settings
  'updateWhatsAppSettings': (e) => {
    const props = PropertiesService.getScriptProperties();
    if (e.parameter.phoneNumberId) {
      props.setProperty('WHATSAPP_PHONE_NUMBER_ID', e.parameter.phoneNumberId);
    }
    if (e.parameter.accessToken) {
      props.setProperty('WHATSAPP_ACCESS_TOKEN', e.parameter.accessToken);
    }
    log.info('[WhatsApp Settings] Updated - Phone ID: ' + (e.parameter.phoneNumberId ? 'SET' : 'unchanged'));
    return { success: true, message: 'WhatsApp ayarları kaydedildi' };
  },
  'getWhatsAppSettings': () => {
    const props = PropertiesService.getScriptProperties();
    return {
      success: true,
      data: {
        phoneNumberId: props.getProperty('WHATSAPP_PHONE_NUMBER_ID') || '',
        hasAccessToken: !!props.getProperty('WHATSAPP_ACCESS_TOKEN')
      }
    };
  },

  // Slack Webhook
  'updateSlackSettings': (e) => SlackService.updateSlackSettings(e.parameter.webhookUrl, e.parameter.apiKey),
  'getSlackSettings': (e) => SlackService.getSlackSettings(e.parameter.apiKey),

  // Backup Management (admin only)
  'createBackup': () => BackupService.createBackup('manual'),
  'listBackups': () => BackupService.listBackups(),
  'restoreBackup': (e) => BackupService.restoreBackup(e.parameter.backupId),

  // Config management (public - no auth required)
  'getConfig': () => ConfigService.getConfig(),

  // Profil ayarları (v3.3 - dinamik)
  'getProfilAyarlari': (e) => ({
    success: true,
    data: ProfilAyarlariService.get(e.parameter.profil),
    profil: e.parameter.profil || 'genel'
  }),
  'getAllProfilAyarlari': () => ({ success: true, data: ProfilAyarlariService.getAll() }),
  'updateProfilAyarlari': (e) => {
    var updates = e.parameter.updates ? JSON.parse(e.parameter.updates) : {};
    return ProfilAyarlariService.update(e.parameter.profil, updates);
  },
  'resetProfilAyarlari': () => ProfilAyarlariService.reset(),

  // Slot Universe & Business Rules
  'getDayStatus': (e) => AvailabilityService.getDayStatus(e.parameter.date, e.parameter.appointmentType),
  'getDailySlots': (e) => {
    // linkType varsa profil ayarlarından slotGrid'i al
    let slotGrid = 60;
    if (e.parameter.linkType) {
      const profilAyarlari = getProfilAyarlariByLinkType(e.parameter.linkType);
      slotGrid = profilAyarlari?.slotGrid || 60;
    } else if (e.parameter.slotGrid) {
      slotGrid = parseInt(e.parameter.slotGrid) || 60;
    }
    return {
      success: true,
      slots: SlotService.getDailySlots(e.parameter.date, e.parameter.shiftType || 'full', slotGrid)
    };
  },
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
  'resetData': () => StorageService.resetData(),

  // WhatsApp Template CRUD (v3.4 - Sheets-based system with targetType)
  'getWhatsAppTemplates': () => getWhatsAppTemplates(),
  'createWhatsAppTemplate': (e) => {
    try {
      const params = {
        name: e.parameter.name,
        description: e.parameter.description,
        variableCount: e.parameter.variableCount,
        variables: typeof e.parameter.variables === 'string' ? JSON.parse(e.parameter.variables) : (e.parameter.variables || {}),
        targetType: e.parameter.targetType,
        language: e.parameter.language || 'en'
      };
      log.info('[createWhatsAppTemplate-handler] params:', JSON.stringify(params));
      return createWhatsAppTemplate(params);
    } catch (handlerError) {
      log.error('[createWhatsAppTemplate-handler] error:', handlerError);
      return { success: false, error: handlerError.toString(), handlerError: true };
    }
  },
  'updateWhatsAppTemplate': (e) => updateWhatsAppTemplate({
    id: e.parameter.id,
    name: e.parameter.name,
    description: e.parameter.description,
    variableCount: e.parameter.variableCount,
    language: e.parameter.language,
    variables: typeof e.parameter.variables === 'string' ? JSON.parse(e.parameter.variables) : (e.parameter.variables || {}),
    targetType: e.parameter.targetType
  }),
  'deleteWhatsAppTemplate': (e) => deleteWhatsAppTemplate({ id: e.parameter.id }),
  'getWhatsAppVariableOptions': () => getWhatsAppVariableOptions(),

  // WhatsApp Message Log (v4.0)
  'getWhatsAppMessages': (e) => ({
    success: true,
    data: SheetStorageService.getMessageLogs({
      appointmentId: e.parameter.appointmentId || null,
      phone: e.parameter.phone || null,
      status: e.parameter.status || null,
      limit: parseInt(e.parameter.limit) || 100,
      offset: parseInt(e.parameter.offset) || 0
    })
  }),
  'getWhatsAppMessageStats': () => ({
    success: true,
    data: SheetStorageService.getMessageStats()
  }),
  'getAppointmentMessages': (e) => ({
    success: true,
    data: SheetStorageService.getAppointmentMessages(e.parameter.appointmentId)
  }),

  // WhatsApp Flow System (v3.4)
  'getWhatsAppFlows': () => getWhatsAppFlows(),
  'getWhatsAppFlow': (e) => getWhatsAppFlow(e.parameter),
  'addWhatsAppFlow': (e) => addWhatsAppFlow(e.parameter),
  'updateWhatsAppFlow': (e) => updateWhatsAppFlow(e.parameter),
  'deleteWhatsAppFlow': (e) => deleteWhatsAppFlow(e.parameter),

  // WhatsApp Daily Tasks (v3.4)
  'getWhatsAppDailyTasks': () => getWhatsAppDailyTasks(),
  'addWhatsAppDailyTask': (e) => addWhatsAppDailyTask(e.parameter),
  'updateWhatsAppDailyTask': (e) => updateWhatsAppDailyTask(e.parameter),
  'deleteWhatsAppDailyTask': (e) => deleteWhatsAppDailyTask(e.parameter)
};

/**
 * HTTP GET request handler
 * Routes requests to appropriate service handlers
 * @param {Object} e - Event parameter with query parameters
 * @returns {ContentService.TextOutput} JSON response
 */
function doGet(e) {
  try {
    // WhatsApp Webhook Verification (Meta requirement)
    // 🔒 GÜVENLİK: Token Script Properties'den alınmalı, hardcoded değer yok
    if (e.parameter['hub.mode'] === 'subscribe' && e.parameter['hub.verify_token']) {
      const verifyToken = PropertiesService.getScriptProperties().getProperty('WHATSAPP_WEBHOOK_VERIFY_TOKEN');

      // Token yapılandırılmamışsa güvenli bir şekilde hata döndür
      if (!verifyToken) {
        log.error('WHATSAPP_WEBHOOK_VERIFY_TOKEN Script Property ayarlanmamış');
        return ContentService
          .createTextOutput('Webhook not configured')
          .setMimeType(ContentService.MimeType.TEXT);
      }

      if (e.parameter['hub.verify_token'] === verifyToken) {
        // Return the challenge to verify the webhook
        return ContentService
          .createTextOutput(e.parameter['hub.challenge'])
          .setMimeType(ContentService.MimeType.TEXT);
      } else {
        return ContentService
          .createTextOutput('Verification failed')
          .setMimeType(ContentService.MimeType.TEXT);
      }
    }

    const action = e.parameter.action;
    const apiKey = e.parameter.apiKey;

    let response = {};

    try {
      // Admin action kontrolü - API key veya Session token gerekli mi?
      // ADMIN_ACTIONS veya SESSION_ADMIN_ACTIONS içindeki action'lar için auth gerekli
      const requiresAuth = ADMIN_ACTIONS.includes(action) || SESSION_ADMIN_ACTIONS.includes(action);

      if (requiresAuth) {
        // Önce session token kontrol et, sonra API key
        var isAuthorized = false;

        if (apiKey) {
          // Session token mı yoksa API key mi?
          var sessionResult = SessionAuthService.validateSession(apiKey);
          if (sessionResult.valid) {
            isAuthorized = true;
          } else if (AuthService.validateApiKey(apiKey)) {
            isAuthorized = true;
          }
        }

        if (!isAuthorized) {
          response = {
            success: false,
            error: CONFIG.ERROR_MESSAGES.AUTH_ERROR,
            requiresAuth: true
          };
        } else {
          // Auth geçerli, handler'ı çalıştır
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
      // ✅ YENİ: Error ID oluştur (destek için referans)
      const errorId = Utilities.getUuid().substring(0, 8).toUpperCase();
      
      // Detaylı log (server-side)
      log.error(`[${errorId}] API Hatası:`, {
        message: error.message,
        stack: error.stack,
        action: action,
        parameters: Object.keys(e.parameter || {})  // Sadece key'ler, value'lar değil
      });
      
      // ✅ YENİ: Kullanıcıya generic mesaj + error ID
      response = { 
        success: false, 
        error: CONFIG.ERROR_MESSAGES.SERVER_ERROR,
        errorId: errorId  // Destek için referans kodu
      };
    }

    // Her zaman JSON döndür
    const output = ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);

    // CORS: Google Apps Script otomatik olarak Access-Control-Allow-Origin: * ekler
    return output;

  } catch (mainError) {
    // En dıştaki catch - JSON döndür (generic mesaj, detay sızdırma)
    const errorId = Utilities.getUuid().substring(0, 8).toUpperCase();
    log.error(`[${errorId}] doGet ana hata:`, mainError);

    const errorResponse = {
      success: false,
      error: CONFIG.ERROR_MESSAGES.SERVER_ERROR,
      errorId: errorId
    };

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

    // WhatsApp Webhook Status Updates (Meta callback)
    if (params.object === 'whatsapp_business_account' && params.entry) {
      try {
        handleWhatsAppWebhook(params);
      } catch (webhookError) {
        console.error('WhatsApp webhook error:', webhookError);
      }
      // Meta expects 200 OK response
      return ContentService
        .createTextOutput('OK')
        .setMimeType(ContentService.MimeType.TEXT);
    }

    const action = params.action;
    const apiKey = params.apiKey;

    log.info('POST request received:', action);

    let response = {};

    try {
      // Admin action kontrolü - API key veya Session token gerekli mi?
      // ADMIN_ACTIONS veya SESSION_ADMIN_ACTIONS içindeki action'lar için auth gerekli
      const requiresAuth = ADMIN_ACTIONS.includes(action) || SESSION_ADMIN_ACTIONS.includes(action);

      if (requiresAuth) {
        // Önce session token kontrol et, sonra API key
        var isAuthorized = false;

        if (apiKey) {
          // Session token mı yoksa API key mi?
          log.info('[AUTH-DEBUG] Checking auth for action: ' + action + ', token prefix: ' + (apiKey ? apiKey.substring(0, 8) : 'null'));
          var sessionResult = SessionAuthService.validateSession(apiKey);
          log.info('[AUTH-DEBUG] Session validation result: ' + JSON.stringify(sessionResult));
          if (sessionResult.valid) {
            log.info('[AUTH-DEBUG] Session token valid!');
            isAuthorized = true;
          } else if (AuthService.validateApiKey(apiKey)) {
            log.info('[AUTH-DEBUG] API key valid!');
            isAuthorized = true;
          } else {
            log.warn('[AUTH-DEBUG] Neither session nor API key valid');
          }
        } else {
          log.warn('[AUTH-DEBUG] No apiKey provided for protected action: ' + action);
        }

        if (!isAuthorized) {
          response = {
            success: false,
            error: CONFIG.ERROR_MESSAGES.AUTH_ERROR,
            requiresAuth: true,
            debug: sessionResult ? sessionResult.error : 'no apiKey provided',
            sessionDebug: sessionResult?.debug || null
          };
        } else {
          // Auth geçerli, handler'ı çalıştır
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
      // Generic mesaj, detay sızdırma
      const errorId = Utilities.getUuid().substring(0, 8).toUpperCase();
      log.error(`[${errorId}] doPost handler error:`, handlerError);
      response = {
        success: false,
        error: CONFIG.ERROR_MESSAGES.SERVER_ERROR,
        errorId: errorId
      };
    }

    // JSON döndür
    return ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (mainError) {
    // Generic mesaj, detay sızdırma
    const errorId = Utilities.getUuid().substring(0, 8).toUpperCase();
    log.error(`[${errorId}] doPost ana hata:`, mainError);
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: CONFIG.ERROR_MESSAGES.SERVER_ERROR,
        errorId: errorId
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
