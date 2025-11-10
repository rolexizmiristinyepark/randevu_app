// ==================== API SERVICE ====================
// Unified API call handler for both authenticated and unauthenticated requests
// Eliminates code duplication between admin.html and admin-auth.js

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
    | 'getSlackSettings';

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
        'getSlackSettings'              // YENİ: Slack Webhook
    ] as const,

    call<T = unknown>(
        action: ApiAction,
        params: Record<string, unknown> = {},
        apiKey: string | null = null
    ): Promise<ApiResponse<T>> {
        // Check if action requires authentication
        if (this.PROTECTED_ACTIONS.includes(action as ProtectedAction)) {
            // Check for API key or AdminAuth
            const key = apiKey || (typeof (window as any).AdminAuth !== 'undefined'
                ? (window as any).AdminAuth.isAuthenticated()
                : null);

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
     * ✅ GÜVENLİK GÜNCELLEMESİ: JSONP'den Fetch API'ye geçildi
     * @private
     */
    _makeRequest<T = unknown>(
        action: ApiAction,
        params: Record<string, unknown> = {},
        apiKey: string | null = null
    ): Promise<ApiResponse<T>> {
        return new Promise(async (resolve, reject) => {
            try {
                // Build request parameters
                const allParams: Record<string, unknown> = { ...params, action };
                if (apiKey) {
                    allParams.apiKey = apiKey;
                }

                // Get CONFIG from global scope
                const config = typeof window !== 'undefined' && (window as any).CONFIG
                    ? (window as any).CONFIG as Config
                    : typeof (globalThis as any).CONFIG !== 'undefined'
                        ? (globalThis as any).CONFIG as Config
                        : null;

                if (!config || !config.APPS_SCRIPT_URL) {
                    reject(new Error('CONFIG not defined'));
                    return;
                }

                const url = config.APPS_SCRIPT_URL + '?' + new URLSearchParams(
                    Object.entries(allParams).map(([k, v]) => [k, String(v)])
                ).toString();

                // Fetch API ile güvenli istek
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 saniye timeout

                const response = await fetch(url, {
                    method: 'GET',
                    mode: 'cors',
                    credentials: 'omit',
                    signal: controller.signal,
                    headers: {
                        'Accept': 'application/json'
                    }
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                // JSON response'u parse et
                const data = await response.json() as ApiResponse<T>;

                // Başarılı response kontrolü
                if (data && typeof data === 'object') {
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
