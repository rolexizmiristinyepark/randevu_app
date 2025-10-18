// ==================== API SERVICE ====================
// Unified API call handler for both authenticated and unauthenticated requests
// Eliminates code duplication between admin.html and admin-auth.js

const ApiService = {
    // List of actions that require API key authentication
    PROTECTED_ACTIONS: [
        'addStaff', 'toggleStaff', 'removeStaff', 'updateStaff',
        'saveShifts', 'saveSettings', 'deleteAppointment', 'resetData',
        'getSettings'
    ],

    /**
     * Main API call method - automatically handles authentication for protected actions
     * @param {string} action - The API action to call
     * @param {Object} params - Parameters to send with the request
     * @param {string} apiKey - Optional API key (will use stored key if not provided)
     * @returns {Promise} API response
     */
    call(action, params = {}, apiKey = null) {
        // Check if action requires authentication
        if (this.PROTECTED_ACTIONS.includes(action)) {
            const key = apiKey || (typeof AdminAuth !== 'undefined' ? AdminAuth.isAuthenticated() : null);

            // If no API key and AdminAuth is available, show login modal
            if (!key && typeof AdminAuth !== 'undefined') {
                AdminAuth.showLoginModal();
                return Promise.reject(new Error('Authentication required'));
            }

            return this._makeRequest(action, params, key);
        }

        // Non-protected actions don't need API key
        return this._makeRequest(action, params, null);
    },

    /**
     * Internal method to make the actual Fetch API request
     * ✅ GÜVENLİK GÜNCELLEMESİ: JSONP'den Fetch API'ye geçildi
     * @private
     */
    _makeRequest(action, params = {}, apiKey = null) {
        return new Promise(async (resolve, reject) => {
            try {
                // Build request parameters
                const allParams = { ...params, action };
                if (apiKey) {
                    allParams.apiKey = apiKey;
                }

                // Get CONFIG from global scope (window.CONFIG for ES6 modules)
                const config = typeof window !== 'undefined' && window.CONFIG ? window.CONFIG :
                               typeof CONFIG !== 'undefined' ? CONFIG : null;

                if (!config || !config.APPS_SCRIPT_URL) {
                    reject(new Error('CONFIG not defined'));
                    return;
                }

                const url = config.APPS_SCRIPT_URL + '?' + new URLSearchParams(allParams).toString();

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
                const data = await response.json();

                // Başarılı response kontrolü
                if (data && typeof data === 'object') {
                    resolve(data);
                } else {
                    throw new Error('Geçersiz API yanıtı');
                }

            } catch (error) {
                if (error.name === 'AbortError') {
                    reject(new Error('Timeout - API cevap vermedi'));
                } else if (error.message.includes('Failed to fetch')) {
                    reject(new Error('API bağlantısı kurulamadı. CORS veya ağ hatası.'));
                } else {
                    reject(error);
                }
            }
        });
    },

    /**
     * Test API key validity by making a test call
     * Used by authentication system to validate keys
     * @param {string} apiKey - The API key to test
     * @returns {Promise} API response
     */
    testApiKey(apiKey) {
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
function apiCall(action, params = {}) {
    return ApiService.call(action, params);
}

/**
 * Legacy apiCallWithKey function for backward compatibility
 * Used by admin authentication system - Now uses Fetch API
 */
function apiCallWithKey(action, params = {}, apiKey) {
    return ApiService.call(action, params, apiKey);
}

// Export for ES6 modules
export { ApiService, apiCall, apiCallWithKey };

// Also expose globally for backward compatibility
if (typeof window !== 'undefined') {
    window.ApiService = ApiService;
    window.apiCall = apiCall;
    window.apiCallWithKey = apiCallWithKey;
}
