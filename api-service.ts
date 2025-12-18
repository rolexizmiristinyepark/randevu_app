// ==================== API SERVICE ====================
// Unified API call handler for both authenticated and unauthenticated requests
// Eliminates code duplication between admin.html and admin-auth.js

import { Schemas, validateApiResponse } from './validation';

/** Generic API response structure */
interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
}

/** API Service configuration */
interface Config {
    APPS_SCRIPT_URL: string;
    [key: string]: unknown;
}

/** Protected action types */
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
    | 'getWhatsAppVariableOptions';

/** API action type (protected + public) */
type ApiAction = ProtectedAction | string;

const ApiService = {
    // List of actions that require API key authentication
    PROTECTED_ACTIONS: [
        'addStaff', 'toggleStaff', 'removeStaff', 'updateStaff',
        'saveShifts', 'saveSettings', 'deleteAppointment', 'resetData',
        'getSettings', 'regenerateApiKey',
        'getTodayWhatsAppReminders',    // YENİ: v3.0
        'createManualAppointment',      // YENİ: v3.0
        'sendWhatsAppReminders',        // YENİ: WhatsApp Business API
        'updateWhatsAppSettings',       // YENİ: WhatsApp Business API
        'getWhatsAppSettings',          // YENİ: WhatsApp Business API
        'updateSlackSettings',          // YENİ: Slack Webhook
        'getSlackSettings',             // YENİ: Slack Webhook
        'updateProfilAyarlari',         // v3.3: Profil ayarları
        'resetProfilAyarlari',          // v3.3: Profil ayarları sıfırla
        'addWhatsAppFlow',              // v3.4: WhatsApp Flow Sistemi
        'updateWhatsAppFlow',           // v3.4: WhatsApp Flow Sistemi
        'deleteWhatsAppFlow',           // v3.4: WhatsApp Flow Sistemi
        'addWhatsAppDailyTask',         // v3.4: WhatsApp Günlük Görevler
        'updateWhatsAppDailyTask',      // v3.4: WhatsApp Günlük Görevler
        'deleteWhatsAppDailyTask',      // v3.4: WhatsApp Günlük Görevler
        'createWhatsAppTemplate',       // v3.4: WhatsApp Template CRUD
        'updateWhatsAppTemplate',       // v3.4: WhatsApp Template CRUD
        'deleteWhatsAppTemplate',       // v3.4: WhatsApp Template CRUD
        'getWhatsAppTemplates',         // v3.4: WhatsApp Template CRUD
        'getAllLinks',                  // v3.0: Session auth
        'getWhatsAppVariableOptions'    // v3.4: WhatsApp Template CRUD
    ] as const,

    // Validation map for actions that support Zod validation
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
        apiKey: string | null = null
    ): Promise<ApiResponse<T>> {
        // Check if action requires authentication
        if (this.PROTECTED_ACTIONS.includes(action as ProtectedAction)) {
            // Check for API key or AdminAuth session token
            let key = apiKey;

            if (!key && typeof (window as any).AdminAuth !== 'undefined') {
                // Try to get session token
                key = (window as any).AdminAuth.getSessionToken?.() || null;
                console.log('[API] Session token retrieved:', key ? `${key.substring(0, 8)}...` : 'null');
            }

            // If no API key and AdminAuth is available, show login modal
            if (!key && typeof (window as any).AdminAuth !== 'undefined') {
                (window as any).AdminAuth.showLoginModal();
                return Promise.reject(new Error('Authentication required'));
            }

            return this._makeRequest<T>(action, params, key);
        }

        // Non-protected actions don't need API key
        return this._makeRequest<T>(action, params, null);
    },

    /**
     * Internal method to make the actual Fetch API request
     * ✅ GÜVENLİK: Protected actions POST + JSON body kullanır (API key URL'de ASLA görünmez)
     * ✅ Public actions GET kullanır (performans)
     * @private
     */
    _makeRequest<T = unknown>(
        action: ApiAction,
        params: Record<string, unknown> = {},
        apiKey: string | null = null
    ): Promise<ApiResponse<T>> {
        return new Promise(async (resolve, reject) => {
            try {
                // ✅ HARDCODED FALLBACK - Env vars başarısız olursa kullanılır
                const FALLBACK_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzBHaKk0MJPZ88EuY_AYnZatCQZo3CKbM2O-yw-EIlHJu5DAOqnq5ZgkMPR8Z3u7m3bIQ/exec';

                // Get APPS_SCRIPT_URL - try CONFIG first, then environment variable, then fallback
                let appsScriptUrl: string | null = null;

                // 1. Try global CONFIG (set after initConfig)
                if (typeof window !== 'undefined' && (window as any).CONFIG?.APPS_SCRIPT_URL) {
                    appsScriptUrl = (window as any).CONFIG.APPS_SCRIPT_URL;
                }
                // 2. Try globalThis CONFIG
                else if (typeof (globalThis as any).CONFIG?.APPS_SCRIPT_URL !== 'undefined') {
                    appsScriptUrl = (globalThis as any).CONFIG.APPS_SCRIPT_URL;
                }
                // 3. Try environment variable (for initial config load)
                else if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APPS_SCRIPT_URL && import.meta.env.VITE_APPS_SCRIPT_URL !== 'undefined' && import.meta.env.VITE_APPS_SCRIPT_URL !== '') {
                    appsScriptUrl = import.meta.env.VITE_APPS_SCRIPT_URL;
                }
                // 4. ✅ FALLBACK: Hardcoded production URL (last resort)
                else {
                    console.warn('⚠️ Using fallback APPS_SCRIPT_URL - env vars not loaded');
                    appsScriptUrl = FALLBACK_APPS_SCRIPT_URL;
                }

                // Final validation
                if (!appsScriptUrl || !appsScriptUrl.startsWith('https://')) {
                    reject(new Error('Invalid APPS_SCRIPT_URL configuration'));
                    return;
                }

                // 🔍 DEBUG: Log used URL
                console.log(`[API] ${action} -> ${appsScriptUrl.substring(0, 80)}...`);

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 saniye timeout

                let response: Response;

                // 🔒 GÜVENLİK: Protected actions için POST + JSON body kullan
                // API key URL'de ASLA görünmez (browser history, server logs güvenli)
                const isProtectedAction = this.PROTECTED_ACTIONS.includes(action as ProtectedAction);

                if (isProtectedAction && apiKey) {
                    // ✅ POST + JSON Body - API key güvenli
                    console.log('[API] Sending protected action with apiKey:', apiKey ? `${apiKey.substring(0, 8)}...` : 'null');
                    const requestBody = {
                        action,
                        apiKey,
                        ...params
                    };

                    response = await fetch(appsScriptUrl, {
                        method: 'POST',
                        mode: 'cors',
                        credentials: 'omit',
                        signal: controller.signal,
                        headers: {
                            'Content-Type': 'text/plain', // Google Apps Script CORS için
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify(requestBody)
                    });
                } else {
                    // ✅ GET - Public actions (API key yok)
                    const queryParams = new URLSearchParams();
                    queryParams.append('action', action);

                    for (const [key, value] of Object.entries(params)) {
                        if (value !== undefined && value !== null) {
                            queryParams.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
                        }
                    }

                    const url = `${appsScriptUrl}?${queryParams.toString()}`;

                    response = await fetch(url, {
                        method: 'GET',
                        mode: 'cors',
                        credentials: 'omit',
                        signal: controller.signal,
                        headers: {
                            'Accept': 'application/json'
                        }
                    });
                }

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                // JSON response'u parse et
                const data = await response.json() as ApiResponse<T>;

                // Zod validation (gradual adoption - warn but don't fail)
                const validationSchema = ApiService.VALIDATION_MAP[action as keyof typeof ApiService.VALIDATION_MAP];
                if (validationSchema) {
                    try {
                        const validatedData = validateApiResponse(
                            validationSchema as any,
                            data,
                            action
                        );
                        resolve(validatedData as ApiResponse<T>);
                        return;
                    } catch (validationError) {
                        // Log validation error but continue with unvalidated data (backward compatibility)
                        console.warn(`[Validation Warning] ${action} validation failed:`, validationError);
                        console.warn('Continuing with unvalidated data for backward compatibility');
                    }
                }

                // Başarılı response kontrolü (fallback for non-validated or failed validation)
                if (data && typeof data === 'object') {
                    // Session expired veya auth hatası kontrolü
                    if (!data.success && (data as any).requiresAuth) {
                        console.warn('[API] Session expired or auth failed:', (data as any).debug, (data as any).sessionDebug);
                        // NOT: clearSession yapmıyoruz çünkü paralel API çağrıları var
                        // Kullanıcı zaten login modal'ı görecek
                    }
                    resolve(data);
                } else {
                    throw new Error('Geçersiz API yanıtı');
                }

            } catch (error) {
                if (error instanceof Error) {
                    if (error.name === 'AbortError') {
                        reject(new Error('Timeout - API cevap vermedi'));
                    } else if (error.message.includes('Failed to fetch')) {
                        reject(new Error('API bağlantısı kurulamadı. CORS veya ağ hatası.'));
                    } else {
                        reject(error);
                    }
                } else {
                    reject(new Error('Unknown error'));
                }
            }
        });
    },

    testApiKey(apiKey: string): Promise<ApiResponse> {
        return this._makeRequest('getSettings', {}, apiKey);
    }
};

// ==================== LEGACY COMPATIBILITY ====================
// Backward compatible global functions (geriye dönük uyumluluk için)
// ✅ Artık modern Fetch API kullanıyor (JSONP değil)

/**
 * Legacy apiCall function for backward compatibility
 * Automatically routes to ApiService with Fetch API
 */
function apiCall<T = unknown>(
    action: ApiAction,
    params: Record<string, unknown> = {}
): Promise<ApiResponse<T>> {
    return ApiService.call<T>(action, params);
}

/**
 * Legacy apiCallWithKey function for backward compatibility
 * Used by admin authentication system - Now uses Fetch API
 */
function apiCallWithKey<T = unknown>(
    action: ApiAction,
    params: Record<string, unknown> = {},
    apiKey: string
): Promise<ApiResponse<T>> {
    return ApiService.call<T>(action, params, apiKey);
}

// Export types and service
export type { ApiResponse, ApiAction, ProtectedAction };
export { ApiService, apiCall, apiCallWithKey };

// Also expose globally for backward compatibility
if (typeof window !== 'undefined') {
    (window as any).ApiService = ApiService;
    (window as any).apiCall = apiCall;
    (window as any).apiCallWithKey = apiCallWithKey;
}
