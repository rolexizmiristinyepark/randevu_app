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

// v3.10.10: WhatsApp message direction filtering + message content logging
// v3.10.9 FIX: updateUnifiedFlow artık active parametresi gönderilmezse mevcut değeri koruyor
function parseJsonSafeMain(jsonStr, defaultValue) {
  if (!jsonStr) return defaultValue;
  if (typeof jsonStr !== 'string') return jsonStr;
  try {
    return JSON.parse(jsonStr);
  } catch (error) {
    return defaultValue;
  }
}

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
  'addWhatsAppFlow', 'createWhatsAppFlow', 'updateWhatsAppFlow', 'deleteWhatsAppFlow',
  // WhatsApp Daily Tasks (v3.4) - getWhatsAppDailyTasks public (read-only)
  'addWhatsAppDailyTask', 'updateWhatsAppDailyTask', 'deleteWhatsAppDailyTask'
];

// v3.0: Session bazlı admin işlemleri (SessionAuthService ile)
// v3.9.70: Read-only "get" action'ları public yapıldı (ilk yüklemede auth hatası vermemesi için)
const SESSION_ADMIN_ACTIONS = [
  'createStaff', 'updateStaffV3', 'getAllLinks', 'regenerateLink',
  // WhatsApp Template CRUD (v3.2) - get public, write protected
  'createWhatsAppTemplate', 'updateWhatsAppTemplate', 'deleteWhatsAppTemplate',
  // WhatsApp Message Log (v4.0) - get public
  // Mail Flow & Template CRUD (v3.9.20) - get public, write protected
  'createMailFlow', 'updateMailFlow', 'deleteMailFlow',
  'createMailTemplate', 'updateMailTemplate', 'deleteMailTemplate',
  // Mail Info Cards (v3.9.35) - get public, write protected
  'createMailInfoCard', 'updateMailInfoCard', 'deleteMailInfoCard',
  // Unified Notification Flows (v3.10) - get public, write protected
  'createUnifiedFlow', 'updateUnifiedFlow', 'deleteUnifiedFlow', 'testUnifiedFlow',
  // Sheet Migration (v3.9.40)
  'fixMailInfoCardsSheet',
  // Header Sync (v3.9.47)
  'syncMailSheetHeaders',
  'debugMailFlowsHeaders'
];

// v3.9.70: Public read-only actions (auth gerektirmez)
// Admin paneli ilk yüklemesinde sorunsuz çalışması için
const PUBLIC_ADMIN_ACTIONS = [
  'getWhatsAppTemplates', 'getWhatsAppVariableOptions',
  'getWhatsAppMessages', 'getWhatsAppMessageStats', 'getAppointmentMessages',
  'getMailFlows', 'getMailTemplates', 'getMailInfoCards',
  'getDebugLogs',  // Debug logları okuma
  'getUnifiedFlows',  // v3.10: Unified notification flows
  'getMessageVariables', 'getTriggers', 'getRecipients',
  'debugNotificationFlows'  // v3.10.7: Diagnostic endpoint
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
    try {
      // Validate profil parameter
      if (!e.parameter.profil) {
        return { success: false, error: 'Profil parametresi gerekli' };
      }

      // Parse updates - handle both string and object
      var updates = {};
      if (e.parameter.updates) {
        if (typeof e.parameter.updates === 'string') {
          updates = JSON.parse(e.parameter.updates);
        } else {
          updates = e.parameter.updates;
        }
      }

      return ProfilAyarlariService.update(e.parameter.profil, updates);
    } catch (parseError) {
      log.error('updateProfilAyarlari parse hatası:', parseError);
      return { success: false, error: 'Geçersiz veri formatı: ' + parseError.message };
    }
  },
  'resetProfilAyarlari': () => ProfilAyarlariService.reset(),

  // Slot Universe & Business Rules
  // v3.9.4: profil parametresinden maxSlotAppointment al
  'getDayStatus': (e) => {
    let maxSlotAppointment = 1; // default
    if (e.parameter.profil) {
      const profilAyarlari = ProfilAyarlariService.get(e.parameter.profil);
      maxSlotAppointment = profilAyarlari?.maxSlotAppointment || 1;
    } else if (e.parameter.maxSlotAppointment) {
      maxSlotAppointment = parseInt(e.parameter.maxSlotAppointment) || 1;
    }
    return AvailabilityService.getDayStatus(e.parameter.date, e.parameter.appointmentType, maxSlotAppointment);
  },
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
  // v3.9.12: Slot availability endpoint - per-slot availability for staffFilter=none and assignByAdmin
  'getSlotAvailability': (e) => {
    const slotGrid = parseInt(e.parameter.slotGrid) || 60;
    const slotLimit = parseInt(e.parameter.slotLimit) || 1;
    return AvailabilityService.getSlotAvailability(e.parameter.date, slotGrid, slotLimit);
  },
  'validateReservation': (e) => ValidationService.validateReservation({
    date: e.parameter.date,
    hour: parseInt(e.parameter.hour),
    appointmentType: e.parameter.appointmentType,
    staffId: e.parameter.staffId
  }),

  // Yönetim Linki API'leri (hk, ok, hmk)
  // v3.9.19: profil parametresi ile slot limiti profil ayarlarından alınır
  'getManagementSlotAvailability': (e) => AvailabilityService.getManagementSlots(
    e.parameter.date,
    e.parameter.profil || 'genel'
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
        metaTemplateName: e.parameter.metaTemplateName,
        description: e.parameter.description,
        variableCount: e.parameter.variableCount,
        variables: typeof e.parameter.variables === 'string' ? JSON.parse(e.parameter.variables) : (e.parameter.variables || {}),
        targetType: e.parameter.targetType,
        language: e.parameter.language || 'en',
        content: e.parameter.content || '',
        // v3.10.24: Button fields
        hasButton: e.parameter.hasButton === 'true' || e.parameter.hasButton === true,
        buttonVariable: e.parameter.buttonVariable || ''
      };
      log.info('[createWhatsAppTemplate-handler] params:', JSON.stringify(params));
      return createWhatsAppTemplate(params);
    } catch (handlerError) {
      log.error('[createWhatsAppTemplate-handler] error:', handlerError);
      return { success: false, error: handlerError.toString(), handlerError: true };
    }
  },
  'updateWhatsAppTemplate': (e) => {
    // v3.10.20: Debug log - content parametresi gelip gelmediğini kontrol et
    log.info('[updateWhatsAppTemplate-handler] e.parameter keys:', Object.keys(e.parameter || {}).join(', '));
    log.info('[updateWhatsAppTemplate-handler] content value:', e.parameter.content);
    log.info('[updateWhatsAppTemplate-handler] content type:', typeof e.parameter.content);

    const params = {
      id: e.parameter.id,
      name: e.parameter.name,
      metaTemplateName: e.parameter.metaTemplateName,
      description: e.parameter.description,
      variableCount: e.parameter.variableCount,
      language: e.parameter.language,
      variables: typeof e.parameter.variables === 'string' ? JSON.parse(e.parameter.variables) : (e.parameter.variables || {}),
      targetType: e.parameter.targetType,
      content: e.parameter.content,
      // v3.10.24: Button fields
      hasButton: e.parameter.hasButton === 'true' || e.parameter.hasButton === true,
      buttonVariable: e.parameter.buttonVariable || ''
    };

    log.info('[updateWhatsAppTemplate-handler] params:', JSON.stringify(params));
    return updateWhatsAppTemplate(params);
  },
  'deleteWhatsAppTemplate': (e) => deleteWhatsAppTemplate({ id: e.parameter.id }),
  'getWhatsAppVariableOptions': () => getWhatsAppVariableOptions(),

  // WhatsApp Message Log (v4.0)
  // v3.10.10: type parametresi direction filtrelemesi için eklendi
  'getWhatsAppMessages': (e) => ({
    success: true,
    data: SheetStorageService.getMessageLogs({
      appointmentId: e.parameter.appointmentId || null,
      phone: e.parameter.phone || null,
      status: e.parameter.status || null,
      direction: e.parameter.type === 'received' ? 'incoming' : (e.parameter.type === 'sent' ? 'outgoing' : null),
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
  'createWhatsAppFlow': (e) => addWhatsAppFlow(e.parameter),  // alias for addWhatsAppFlow
  'updateWhatsAppFlow': (e) => updateWhatsAppFlow(e.parameter),
  'deleteWhatsAppFlow': (e) => deleteWhatsAppFlow(e.parameter),

  // WhatsApp Daily Tasks (v3.4)
  'getWhatsAppDailyTasks': () => getWhatsAppDailyTasks(),
  'addWhatsAppDailyTask': (e) => addWhatsAppDailyTask(e.parameter),
  'updateWhatsAppDailyTask': (e) => updateWhatsAppDailyTask(e.parameter),
  'deleteWhatsAppDailyTask': (e) => deleteWhatsAppDailyTask(e.parameter),

  // Mail Flow & Template CRUD (v3.9.20)
  'getMailFlows': () => getMailFlows(),
  'createMailFlow': (e) => {
    try {
      const params = {
        name: e.parameter.name,
        description: e.parameter.description,
        profiles: typeof e.parameter.profiles === 'string' ? JSON.parse(e.parameter.profiles) : (e.parameter.profiles || []),
        triggers: typeof e.parameter.triggers === 'string' ? JSON.parse(e.parameter.triggers) : (e.parameter.triggers || []),
        templateId: e.parameter.templateId,
        infoCardId: e.parameter.infoCardId || '',
        target: e.parameter.target || 'customer',
        active: e.parameter.active !== false && e.parameter.active !== 'false'
      };
      return createMailFlow(params);
    } catch (handlerError) {
      log.error('[createMailFlow-handler] error:', handlerError);
      return { success: false, error: handlerError.toString() };
    }
  },
  'updateMailFlow': (e) => {
    try {
      const params = {
        id: e.parameter.id,
        name: e.parameter.name,
        description: e.parameter.description,
        profiles: typeof e.parameter.profiles === 'string' ? JSON.parse(e.parameter.profiles) : e.parameter.profiles,
        triggers: typeof e.parameter.triggers === 'string' ? JSON.parse(e.parameter.triggers) : e.parameter.triggers,
        templateId: e.parameter.templateId,
        infoCardId: e.parameter.infoCardId,
        target: e.parameter.target,
        active: e.parameter.active === true || e.parameter.active === 'true'
      };
      return updateMailFlow(params);
    } catch (handlerError) {
      log.error('[updateMailFlow-handler] error:', handlerError);
      return { success: false, error: handlerError.toString() };
    }
  },
  'deleteMailFlow': (e) => deleteMailFlow({ id: e.parameter.id }),

  'getMailTemplates': () => getMailTemplates(),
  'createMailTemplate': (e) => {
    try {
      const params = {
        name: e.parameter.name,
        subject: e.parameter.subject,
        body: e.parameter.body,
        recipient: e.parameter.recipient,      // v3.10.3
        infoCardId: e.parameter.infoCardId     // v3.10.3
      };
      return createMailTemplate(params);
    } catch (handlerError) {
      log.error('[createMailTemplate-handler] error:', handlerError);
      return { success: false, error: handlerError.toString() };
    }
  },
  'updateMailTemplate': (e) => {
    try {
      const params = {
        id: e.parameter.id,
        name: e.parameter.name,
        subject: e.parameter.subject,
        body: e.parameter.body,
        recipient: e.parameter.recipient,      // v3.10.3
        infoCardId: e.parameter.infoCardId     // v3.10.3
      };
      return updateMailTemplate(params);
    } catch (handlerError) {
      log.error('[updateMailTemplate-handler] error:', handlerError);
      return { success: false, error: handlerError.toString() };
    }
  },
  'deleteMailTemplate': (e) => deleteMailTemplate({ id: e.parameter.id }),

  // Mail Info Cards (v3.9.35)
  'getMailInfoCards': () => getMailInfoCards(),
  'createMailInfoCard': (e) => {
    try {
      // fields array veya string olabilir - POST'ta array, GET'te string gelir
      let fields = [];
      if (e.parameter.fields) {
        if (typeof e.parameter.fields === 'string') {
          fields = JSON.parse(e.parameter.fields);
        } else {
          fields = e.parameter.fields; // Zaten array
        }
      }
      const params = {
        name: e.parameter.name,
        fields: fields
      };
      return createMailInfoCard(params);
    } catch (handlerError) {
      log.error('[createMailInfoCard-handler] error:', handlerError);
      return { success: false, error: handlerError.toString() };
    }
  },
  'updateMailInfoCard': (e) => {
    try {
      // fields array veya string olabilir - POST'ta array, GET'te string gelir
      let fields = undefined;
      if (e.parameter.fields !== undefined) {
        if (typeof e.parameter.fields === 'string') {
          fields = JSON.parse(e.parameter.fields);
        } else {
          fields = e.parameter.fields; // Zaten array
        }
      }
      const params = {
        id: e.parameter.id,
        name: e.parameter.name,
        fields: fields
      };
      return updateMailInfoCard(params);
    } catch (handlerError) {
      log.error('[updateMailInfoCard-handler] error:', handlerError);
      return { success: false, error: handlerError.toString() };
    }
  },
  'deleteMailInfoCard': (e) => deleteMailInfoCard({ id: e.parameter.id }),

  // Sheet Migration (v3.9.40)
  'fixMailInfoCardsSheet': () => SheetStorageService.fixMailInfoCardsSheet(),

  // Header Sync (v3.9.47)
  'syncMailSheetHeaders': () => syncMailSheetHeaders(),
  'debugMailFlowsHeaders': () => debugMailFlowsHeaders(),

  // Merkezi değişkenler, trigger'lar ve recipient'lar - Variables.js'den
  'getMessageVariables': () => getMessageVariables(),
  'getTriggers': () => getTriggers(),
  'getRecipients': () => getRecipients(),

  // Unified Notification Flows (v3.10)
  'getUnifiedFlows': () => getNotificationFlows(),

  // Debug logları okuma
  'getDebugLogs': (e) => getDebugLogs(parseInt(e.parameter.limit) || 50),

  // v3.10.7: Debug endpoint for diagnosing notification flow issues
  // v3.10.40: FIX - Trigger ve profile dönüşümleri eklendi (gerçek flow mantığı ile uyumlu)
  'debugNotificationFlows': (e) => {
    try {
      const triggerInput = e.parameter.trigger || 'appointment_create';
      const profileCodeInput = e.parameter.profileCode || 's';

      // v3.10.49: Trigger artık direkt appointment_* formatında
      const triggerKey = triggerInput;

      // v3.10.40: Profile code → English profile mapping (s → individual)
      const PROFILE_TO_EN = {
        'genel': 'general', 'gunluk': 'walk-in', 'personel': 'individual',
        'boutique': 'boutique', 'yonetim': 'management', 'vip': 'vip',
        'g': 'general', 'w': 'walk-in', 's': 'individual',
        'b': 'boutique', 'm': 'management', 'v': 'vip'
      };
      const profileKey = PROFILE_TO_EN[profileCodeInput] || profileCodeInput;

      // Get raw data from sheet
      const allFlows = SheetStorageService.getAll('notification_flows');
      const allMailTemplates = SheetStorageService.getAll('mail_templates');
      const allWhatsAppTemplates = SheetStorageService.getAll('whatsapp_templates');

      // v3.10.50: Profile normalization (URL short codes → flow profile names)
      const PROFILE_MAP = {
        'g': 'general', 'w': 'walk-in', 's': 'individual',
        'b': 'boutique', 'm': 'management', 'v': 'vip'
      };

      // Analyze each flow
      const flowAnalysis = allFlows.map((flow, idx) => {
        const rawProfiles = parseJsonSafeMain(flow.profiles, []);
        const mailTemplateIds = parseJsonSafeMain(flow.mailTemplateIds, []);
        const whatsappTemplateIds = parseJsonSafeMain(flow.whatsappTemplateIds, []);

        // v3.10.50: Trigger direkt kullanılır, profile normalize edilir
        const flowTrigger = String(flow.trigger || '');
        const normalizedProfiles = Array.isArray(rawProfiles)
          ? rawProfiles.map(p => PROFILE_MAP[p] || p)
          : rawProfiles;

        const isActive = flow.active === true || flow.active === 'true' || flow.active === 'TRUE';
        // v3.10.50: Direkt karşılaştırma
        const triggerMatches = flowTrigger === triggerKey;
        const profileMatches = normalizedProfiles.includes(profileKey);

        return {
          index: idx,
          id: flow.id,
          name: flow.name,
          raw: {
            active: flow.active,
            activeType: typeof flow.active,
            trigger: flow.trigger,
            profiles: flow.profiles,
            mailTemplateIds: flow.mailTemplateIds,
            whatsappTemplateIds: flow.whatsappTemplateIds
          },
          normalized: {
            trigger: flowTrigger,
            profiles: normalizedProfiles
          },
          parsed: {
            isActive,
            mailTemplateIds,
            whatsappTemplateIds
          },
          matching: {
            triggerMatches,
            profileMatches,
            wouldMatchForMail: isActive && triggerMatches && profileMatches && mailTemplateIds.length > 0,
            wouldMatchForWhatsApp: isActive && triggerMatches && profileMatches && whatsappTemplateIds.length > 0
          }
        };
      });

      return {
        success: true,
        data: {
          // v3.10.40: Hem input hem dönüştürülmüş değerleri göster
          testTriggerInput: triggerInput,
          testTriggerKey: triggerKey,
          testProfileCodeInput: profileCodeInput,
          testProfileKey: profileKey,
          sheetHeaders: {
            notification_flows: SheetStorageService.HEADERS.notification_flows
          },
          totalFlows: allFlows.length,
          totalMailTemplates: allMailTemplates.length,
          totalWhatsAppTemplates: allWhatsAppTemplates.length,
          flowAnalysis: flowAnalysis
        }
      };
    } catch (error) {
      return { success: false, error: error.toString() };
    }
  },
  'createUnifiedFlow': (e) => {
    try {
      // v3.10.8: FIX - Doğru parametre isimleri kullan (whatsappTemplateIds, mailTemplateIds)
      const params = {
        name: e.parameter.name,
        description: e.parameter.description,
        trigger: e.parameter.trigger,
        profiles: typeof e.parameter.profiles === 'string' ? JSON.parse(e.parameter.profiles) : (e.parameter.profiles || []),
        whatsappTemplateIds: typeof e.parameter.whatsappTemplateIds === 'string' ? JSON.parse(e.parameter.whatsappTemplateIds) : (e.parameter.whatsappTemplateIds || []),
        mailTemplateIds: typeof e.parameter.mailTemplateIds === 'string' ? JSON.parse(e.parameter.mailTemplateIds) : (e.parameter.mailTemplateIds || []),
        active: e.parameter.active !== false && e.parameter.active !== 'false'
      };
      return createNotificationFlow(params);
    } catch (handlerError) {
      log.error('[createUnifiedFlow-handler] error:', handlerError);
      return { success: false, error: handlerError.toString() };
    }
  },
  'updateUnifiedFlow': (e) => {
    try {
      // v3.10.9: FIX - active gönderilmezse undefined bırak (mevcut değeri korumak için)
      const params = {
        id: e.parameter.id,
        name: e.parameter.name,
        description: e.parameter.description,
        trigger: e.parameter.trigger,
        profiles: typeof e.parameter.profiles === 'string' ? JSON.parse(e.parameter.profiles) : e.parameter.profiles,
        whatsappTemplateIds: typeof e.parameter.whatsappTemplateIds === 'string' ? JSON.parse(e.parameter.whatsappTemplateIds) : e.parameter.whatsappTemplateIds,
        mailTemplateIds: typeof e.parameter.mailTemplateIds === 'string' ? JSON.parse(e.parameter.mailTemplateIds) : e.parameter.mailTemplateIds,
        // v3.10.9: active parametresi gönderilmezse undefined bırak - updateNotificationFlow mevcut değeri koruyacak
        active: e.parameter.active !== undefined ? (e.parameter.active === true || e.parameter.active === 'true') : undefined
      };
      return updateNotificationFlow(params);
    } catch (handlerError) {
      log.error('[updateUnifiedFlow-handler] error:', handlerError);
      return { success: false, error: handlerError.toString() };
    }
  },
  'deleteUnifiedFlow': (e) => deleteNotificationFlow({ id: e.parameter.id }),
  'testUnifiedFlow': (e) => testNotificationFlow({
    flowId: e.parameter.flowId,
    testData: typeof e.parameter.testData === 'string' ? JSON.parse(e.parameter.testData) : e.parameter.testData
  })
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
          // Session token veya API key ile yetkilendirme
          log.debug('[AUTH] Checking auth for action: ' + action);
          var sessionResult = SessionAuthService.validateSession(apiKey);
          if (sessionResult.valid) {
            log.debug('[AUTH] Session valid');
            isAuthorized = true;
          } else if (AuthService.validateApiKey(apiKey)) {
            log.debug('[AUTH] API key valid');
            isAuthorized = true;
          } else {
            log.warn('[AUTH] Authorization failed for action: ' + action);
          }
        } else {
          log.warn('[AUTH] No token for protected action: ' + action);
        }

        if (!isAuthorized) {
          response = {
            success: false,
            error: CONFIG.ERROR_MESSAGES.AUTH_ERROR,
            requiresAuth: true
            // ⚠️ SECURITY: Debug info removed - was exposing session validation details
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
        error: DEBUG ? `DEBUG: ${handlerError.message || handlerError.toString()}` : CONFIG.ERROR_MESSAGES.SERVER_ERROR,
        errorId: errorId,
        debugStack: DEBUG ? (handlerError.stack || '').substring(0, 500) : undefined
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
        error: DEBUG ? `DEBUG MAIN: ${mainError.message || mainError.toString()}` : CONFIG.ERROR_MESSAGES.SERVER_ERROR,
        errorId: errorId,
        debugStack: DEBUG ? (mainError.stack || '').substring(0, 500) : undefined
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
