/**
 * BatchLoader.ts
 *
 * Network optimization through batched data loading.
 * Loads multiple independent API calls in parallel using Promise.all.
 */

import { apiCall } from './api-service';
import { state } from './StateManager';
import { createDebugLogger } from './debug-logger';

const log = createDebugLogger('BatchLoader');

interface LoadResult {
    success: boolean;
    loadedData: {
        settings?: boolean;
        staff?: boolean;
        profilAyarlari?: boolean;
    };
    errors: string[];
}

/**
 * Load initial data for customer page in parallel.
 * Combines multiple API calls into a single batch for network optimization.
 *
 * @param profil - Profile identifier for profilAyarlari API call
 * @returns LoadResult with success status and loaded data flags
 *
 * @example
 * ```ts
 * const result = await loadInitialCustomerData('default');
 * if (result.success) {
 *   // All data loaded successfully
 * }
 * ```
 */
export async function loadInitialCustomerData(profil: string): Promise<LoadResult> {
    const result: LoadResult = {
        success: false,
        loadedData: {},
        errors: []
    };

    const startTime = performance.now();

    try {
        // Batch all independent API calls together
        const [staffResponse, settingsResponse, profilAyarlariResponse] = await Promise.all([
            apiCall('getStaff').catch(err => ({ success: false, error: String(err) })),
            apiCall('getSettings').catch(err => ({ success: false, error: String(err) })),
            apiCall('getProfilAyarlari', { profil }).catch(err => ({ success: false, error: String(err) }))
        ]);

        // Process staff response
        if (staffResponse.success) {
            state.set('staffMembers', staffResponse.data as any[]);
            result.loadedData.staff = true;
        } else {
            result.errors.push(`Staff: ${staffResponse.error || 'Unknown error'}`);
        }

        // Process settings response
        if (settingsResponse.success) {
            const config = (window as any).CONFIG;
            const data = settingsResponse.data as any;
            if (config) {
                config.APPOINTMENT_HOURS = config.APPOINTMENT_HOURS || {};
                config.MAX_DAILY_DELIVERY_APPOINTMENTS = data.maxDaily || 4;
            }
            result.loadedData.settings = true;
        } else {
            result.errors.push(`Settings: ${settingsResponse.error || 'Unknown error'}`);
        }

        // Process profilAyarlari response
        if (profilAyarlariResponse.success) {
            state.set('profilAyarlari', profilAyarlariResponse.data);
            result.loadedData.profilAyarlari = true;
        } else {
            // profilAyarlari is optional, just log warning
            log.warn('Profil ayarları yüklenemedi:', profilAyarlariResponse.error);
        }

        // Overall success if critical data loaded
        result.success = result.loadedData.staff === true || result.loadedData.settings === true;

        const endTime = performance.now();
        log.info(`Batch load completed in ${(endTime - startTime).toFixed(0)}ms`, result.loadedData);

    } catch (error) {
        log.error('Batch load failed:', error);
        result.errors.push(String(error));
    }

    return result;
}

/**
 * Load initial data for admin panel in parallel.
 * Combines multiple API calls for admin dashboard.
 *
 * @param apiKey - Admin API key for authenticated requests
 * @returns LoadResult with success status
 */
export async function loadInitialAdminData(apiKey: string): Promise<LoadResult> {
    const result: LoadResult = {
        success: false,
        loadedData: {},
        errors: []
    };

    const startTime = performance.now();

    try {
        // Admin panel batch loads
        const [staffResponse, settingsResponse] = await Promise.all([
            apiCall('getStaff').catch(err => ({ success: false, error: String(err) })),
            apiCall('getSettings', {}, apiKey).catch(err => ({ success: false, error: String(err) }))
        ]);

        if (staffResponse.success) {
            state.set('staffMembers', staffResponse.data as any[]);
            result.loadedData.staff = true;
        } else {
            result.errors.push(`Staff: ${staffResponse.error}`);
        }

        if (settingsResponse.success) {
            result.loadedData.settings = true;
        } else {
            result.errors.push(`Settings: ${settingsResponse.error}`);
        }

        result.success = result.loadedData.staff === true && result.loadedData.settings === true;

        const endTime = performance.now();
        log.info(`Admin batch load completed in ${(endTime - startTime).toFixed(0)}ms`, result.loadedData);

    } catch (error) {
        log.error('Admin batch load failed:', error);
        result.errors.push(String(error));
    }

    return result;
}

// Export for use in app.ts and admin-panel.ts
export default {
    loadInitialCustomerData,
    loadInitialAdminData
};

// Window export for debugging
if (typeof window !== 'undefined') {
    (window as any).BatchLoader = { loadInitialCustomerData, loadInitialAdminData };
}
