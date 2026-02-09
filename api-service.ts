// ==================== API SERVICE ====================
// Supabase Edge Function adapter - ApiService.call() arayuzu korunuyor
// GAS -> Supabase gecisi: Tum 89+ action ayni sekilde calisir

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Schemas, validateApiResponse } from './validation';

/** Generic API response structure */
interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    // Login response fields
    token?: string;
    staff?: unknown;
    expiresAt?: number;
    // Other top-level fields from Edge Functions
    [key: string]: unknown;
}

/** Protected action types - admin JWT gerektirir */
type ProtectedAction =
    | 'addStaff'
    | 'toggleStaff'
    | 'removeStaff'
    | 'updateStaff'
    | 'saveShifts'
    | 'saveSettings'
    | 'deleteAppointment'
    | 'resetData'
    | 'getSettings'
    | 'regenerateApiKey'
    | 'getTodayWhatsAppReminders'
    | 'createManualAppointment'
    | 'sendWhatsAppReminders'
    | 'updateWhatsAppSettings'
    | 'getWhatsAppSettings'
    | 'updateSlackSettings'
    | 'getSlackSettings'
    | 'addWhatsAppFlow'
    | 'updateWhatsAppFlow'
    | 'deleteWhatsAppFlow'
    | 'addWhatsAppDailyTask'
    | 'updateWhatsAppDailyTask'
    | 'deleteWhatsAppDailyTask'
    | 'createWhatsAppTemplate'
    | 'updateWhatsAppTemplate'
    | 'deleteWhatsAppTemplate'
    | 'getWhatsAppTemplates'
    | 'getAllLinks'
    | 'getWhatsAppVariableOptions'
    | 'createStaff'
    | 'updateStaffV3'
    | 'createBackup'
    | 'listBackups'
    | 'restoreBackup'
    | 'assignStaffToAppointment'
    | 'getMailFlows'
    | 'createMailFlow'
    | 'updateMailFlow'
    | 'deleteMailFlow'
    | 'getMailTemplates'
    | 'createMailTemplate'
    | 'updateMailTemplate'
    | 'deleteMailTemplate'
    | 'getMailInfoCards'
    | 'createMailInfoCard'
    | 'updateMailInfoCard'
    | 'deleteMailInfoCard'
    | 'fixMailInfoCardsSheet'
    | 'syncMailSheetHeaders'
    | 'debugMailFlowsHeaders'
    | 'createUnifiedFlow'
    | 'updateUnifiedFlow'
    | 'deleteUnifiedFlow'
    | 'testUnifiedFlow'
    | 'updateProfilAyarlari'
    | 'resetProfilAyarlari';

/** Public (unauthenticated) action types */
type PublicAction =
    | 'login'
    | 'resetPassword'
    | 'getStaff'
    | 'getConfig'
    | 'getDataVersion'
    | 'getSlotAvailability'
    | 'getDayStatus'
    | 'getDailySlots'
    | 'getMonthShifts'
    | 'getMonthAppointments'
    | 'getGoogleCalendarEvents'
    | 'createAppointment'
    | 'resolveUrl'
    | 'resolveId'
    | 'getProfilAyarlari'
    | 'getAllProfilAyarlari'
    | 'getWeekAppointments'
    | 'updateAppointment'
    | 'getWhatsAppFlows'
    | 'getMessageVariables'
    | 'getTriggers'
    | 'getRecipients'
    | 'getWhatsAppMessages'
    | 'getWhatsAppMessageStats'
    | 'getAppointmentMessages'
    | 'getUnifiedFlows'
    | 'requestDataDeletion'
    | 'getManagementSlotAvailability'
    | 'debugNotificationFlows'
    | 'getCalendarStatus'
    | 'checkTimeSlotAvailability'
    | 'getAvailableStaffForSlot';

/** API action type - tum gecerli action'larin birlesimi */
type ApiAction = ProtectedAction | PublicAction;

/**
 * Action -> Edge Function esleme tablosu
 * Her action hangi Edge Function'a yonlendirilecegini belirler
 */
const ACTION_TO_FUNCTION: Record<string, string> = {
    // Auth
    login: 'auth',
    logout: 'auth',
    resetPassword: 'auth',
    changePassword: 'auth',
    validateSession: 'auth',
    regenerateApiKey: 'auth',

    // Appointments
    createAppointment: 'appointments',
    getAppointments: 'appointments',
    getWeekAppointments: 'appointments',
    getMonthAppointments: 'appointments',
    deleteAppointment: 'appointments',
    updateAppointment: 'appointments',
    assignStaffToAppointment: 'appointments',
    createManualAppointment: 'appointments',
    getDayStatus: 'appointments',
    getDailySlots: 'appointments',
    getSlotAvailability: 'appointments',
    getManagementSlotAvailability: 'appointments',
    getAvailableStaffForSlot: 'appointments',
    checkTimeSlotAvailability: 'appointments',

    // Staff
    getStaff: 'staff',
    createStaff: 'staff',
    updateStaffV3: 'staff',
    addStaff: 'staff',
    updateStaff: 'staff',
    toggleStaff: 'staff',
    removeStaff: 'staff',
    getAllLinks: 'staff',
    regenerateLink: 'staff',
    saveShifts: 'staff',
    getMonthShifts: 'staff',

    // Config
    getConfig: 'config',
    getProfilAyarlari: 'config',
    getAllProfilAyarlari: 'config',
    updateProfilAyarlari: 'config',
    resetProfilAyarlari: 'config',
    getDataVersion: 'config',
    test: 'config',
    healthCheck: 'config',
    getDebugLogs: 'config',

    // Settings
    getSettings: 'settings',
    saveSettings: 'settings',
    resetData: 'settings',
    createBackup: 'settings',
    listBackups: 'settings',
    restoreBackup: 'settings',

    // WhatsApp
    sendWhatsAppReminders: 'whatsapp',
    getTodayWhatsAppReminders: 'whatsapp',
    updateWhatsAppSettings: 'whatsapp',
    getWhatsAppSettings: 'whatsapp',
    getWhatsAppMessages: 'whatsapp',
    getWhatsAppMessageStats: 'whatsapp',
    getAppointmentMessages: 'whatsapp',
    createWhatsAppTemplate: 'whatsapp',
    updateWhatsAppTemplate: 'whatsapp',
    deleteWhatsAppTemplate: 'whatsapp',
    getWhatsAppTemplates: 'whatsapp',
    getWhatsAppVariableOptions: 'whatsapp',
    getWhatsAppFlows: 'whatsapp',
    getWhatsAppDailyTasks: 'whatsapp',
    addWhatsAppFlow: 'whatsapp',
    createWhatsAppFlow: 'whatsapp',
    updateWhatsAppFlow: 'whatsapp',
    deleteWhatsAppFlow: 'whatsapp',
    addWhatsAppDailyTask: 'whatsapp',
    updateWhatsAppDailyTask: 'whatsapp',
    deleteWhatsAppDailyTask: 'whatsapp',

    // Mail & Notifications
    getMailFlows: 'mail',
    createMailFlow: 'mail',
    updateMailFlow: 'mail',
    deleteMailFlow: 'mail',
    getMailTemplates: 'mail',
    createMailTemplate: 'mail',
    updateMailTemplate: 'mail',
    deleteMailTemplate: 'mail',
    getMailInfoCards: 'mail',
    createMailInfoCard: 'mail',
    updateMailInfoCard: 'mail',
    deleteMailInfoCard: 'mail',
    getUnifiedFlows: 'mail',
    createUnifiedFlow: 'mail',
    updateUnifiedFlow: 'mail',
    deleteUnifiedFlow: 'mail',
    testUnifiedFlow: 'mail',
    getMessageVariables: 'mail',
    getTriggers: 'mail',
    getRecipients: 'mail',
    debugNotificationFlows: 'mail',
    requestDataDeletion: 'mail',
    fixMailInfoCardsSheet: 'mail',
    syncMailSheetHeaders: 'mail',
    debugMailFlowsHeaders: 'mail',

    // Slack
    updateSlackSettings: 'slack',
    getSlackSettings: 'slack',
    sendDailySlackReminders: 'slack',

    // Calendar Sync
    syncToCalendar: 'calendar-sync',
    getCalendarEvents: 'calendar-sync',
    getCalendarStatus: 'calendar-sync',
    getGoogleCalendarEvents: 'calendar-sync',

    // Links
    resolveUrl: 'links',
    resolveId: 'links',

    // Notifications
    sendEmail: 'notifications',
    generateICS: 'notifications',
    triggerNotificationFlow: 'notifications',
};

/** Supabase client singleton */
let _supabase: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
    if (_supabase) return _supabase;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY .env dosyasinda tanimlanmalidir');
    }

    _supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
        },
    });

    return _supabase;
}

/** Supabase client'i disariya ac (admin-auth, realtime icin) */
export function getSupabase(): SupabaseClient {
    return getSupabaseClient();
}

const ApiService = {
    PROTECTED_ACTIONS: [
        'addStaff', 'toggleStaff', 'removeStaff', 'updateStaff',
        'saveShifts', 'saveSettings', 'deleteAppointment', 'resetData',
        'getSettings', 'regenerateApiKey',
        'getTodayWhatsAppReminders', 'createManualAppointment',
        'sendWhatsAppReminders', 'updateWhatsAppSettings', 'getWhatsAppSettings',
        'updateSlackSettings', 'getSlackSettings',
        'updateProfilAyarlari', 'resetProfilAyarlari',
        'addWhatsAppFlow', 'updateWhatsAppFlow', 'deleteWhatsAppFlow',
        'createWhatsAppTemplate', 'updateWhatsAppTemplate', 'deleteWhatsAppTemplate',
        'addWhatsAppDailyTask', 'updateWhatsAppDailyTask', 'deleteWhatsAppDailyTask',
        'getWhatsAppTemplates', 'getAllLinks', 'getWhatsAppVariableOptions',
        'createStaff', 'updateStaffV3',
        'createBackup', 'listBackups', 'restoreBackup',
        'assignStaffToAppointment',
        'getMailFlows', 'createMailFlow', 'updateMailFlow', 'deleteMailFlow',
        'getMailTemplates', 'createMailTemplate', 'updateMailTemplate', 'deleteMailTemplate',
        'getMailInfoCards', 'createMailInfoCard', 'updateMailInfoCard', 'deleteMailInfoCard',
        'fixMailInfoCardsSheet', 'syncMailSheetHeaders', 'debugMailFlowsHeaders',
        'createUnifiedFlow', 'updateUnifiedFlow', 'deleteUnifiedFlow', 'testUnifiedFlow',
    ] as const,

    VALIDATION_MAP: {
        'getStaff': Schemas.GetStaff,
        'getSettings': Schemas.GetSettings,
        'getMonthShifts': Schemas.GetMonthShifts,
        'getMonthAppointments': Schemas.GetMonthAppointments,
        'getGoogleCalendarEvents': Schemas.GetGoogleCalendarEvents,
        'getDayStatus': Schemas.GetDayStatus,
        'getDailySlots': Schemas.GetDailySlots,
        'getManagementSlotAvailability': Schemas.GetManagementSlotAvailability,
        'getDataVersion': Schemas.GetDataVersion,
        'createAppointment': Schemas.CreateAppointment,
    } as const,

    call<T = unknown>(
        action: ApiAction,
        params: Record<string, unknown> = {},
        _apiKey: string | null = null
    ): Promise<ApiResponse<T>> {
        // Protected action'lar icin Supabase Auth session kontrolu
        if (this.PROTECTED_ACTIONS.includes(action as ProtectedAction)) {
            // Supabase Auth session otomatik JWT ekler
            // Ek kontrol: session yoksa login modal goster
            const supabase = getSupabaseClient();
            return supabase.auth.getSession().then(({ data: { session } }) => {
                if (!session) {
                    // AdminAuth varsa login modal goster
                    if (typeof (window as any).AdminAuth !== 'undefined') {
                        (window as any).AdminAuth.showLoginModal();
                    }
                    return Promise.reject(new Error('Authentication required'));
                }
                return this._makeRequest<T>(action, params);
            });
        }

        return this._makeRequest<T>(action, params);
    },

    async _makeRequest<T = unknown>(
        action: ApiAction,
        params: Record<string, unknown> = {},
        _retried = false
    ): Promise<ApiResponse<T>> {
        try {
            const supabase = getSupabaseClient();

            // Action'i Edge Function'a esle
            const functionName = ACTION_TO_FUNCTION[action];
            if (!functionName) {
                throw new Error(`Bilinmeyen action: ${action}`);
            }

            // Edge Function'i cagir - Supabase otomatik JWT header ekler
            const { data, error, response: httpResponse } = await supabase.functions.invoke(functionName, {
                body: { action, ...params },
            }) as { data: any; error: any; response?: Response };

            if (error) {
                const status = httpResponse?.status;

                // 401: JWT expired — session refresh dene, tek retry
                if (!_retried && status === 401) {
                    const { error: refreshError } = await supabase.auth.refreshSession();
                    if (!refreshError) {
                        return this._makeRequest<T>(action, params, true);
                    }
                    // Refresh başarısız: session temizle, anon key ile devam
                    await supabase.auth.signOut();
                    return this._makeRequest<T>(action, params, true);
                }

                const errorMessage = error.message || 'Edge Function hatasi';
                throw new Error(errorMessage);
            }

            const response = data as ApiResponse<T>;

            // Zod validation (gradual adoption)
            const validationSchema = ApiService.VALIDATION_MAP[action as keyof typeof ApiService.VALIDATION_MAP];
            if (validationSchema) {
                try {
                    const validatedData = validateApiResponse(
                        validationSchema as any,
                        response,
                        action
                    );
                    return validatedData as ApiResponse<T>;
                } catch (validationError) {
                    console.warn(`[Validation Warning] ${action} validation failed:`, validationError);
                }
            }

            if (response && typeof response === 'object') {
                return response;
            } else {
                throw new Error('Gecersiz API yaniti');
            }
        } catch (error) {
            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    throw new Error('Timeout - API cevap vermedi');
                } else if (error.message.includes('Failed to fetch')) {
                    throw new Error('API baglantisi kurulamadi. CORS veya ag hatasi.');
                } else {
                    throw error;
                }
            } else {
                throw new Error('Unknown error');
            }
        }
    },

    testApiKey(_apiKey: string): Promise<ApiResponse> {
        return this._makeRequest('getSettings', {});
    }
};

// ==================== LEGACY COMPATIBILITY ====================

function apiCall<T = unknown>(
    action: ApiAction,
    params: Record<string, unknown> = {}
): Promise<ApiResponse<T>> {
    return ApiService.call<T>(action, params);
}

function apiCallWithKey<T = unknown>(
    action: ApiAction,
    params: Record<string, unknown> = {},
    _apiKey: string
): Promise<ApiResponse<T>> {
    return ApiService.call<T>(action, params);
}

export type { ApiResponse, ApiAction, ProtectedAction, PublicAction };
export { ApiService, apiCall, apiCallWithKey };
