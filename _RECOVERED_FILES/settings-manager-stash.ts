/**
 * SETTINGS MANAGER - Ayarlar Yönetimi Modülü
 * Sorumluluklar: Genel randevu ayarları (interval, maxDaily)
 * NOT: WhatsApp ve Slack ayarları artık Script Properties'den yönetiliyor
 */

import { ApiService } from '../api-service';
import { ButtonUtils } from '../button-utils';
import { ErrorUtils } from '../error-utils';
import type { DataStore } from './data-store';

// Module-scoped variables
let dataStore: DataStore;

// Global references (accessed via window)
declare const window: Window & {
    UI: any;
};

// Lazy accessor to avoid module load order issues
const getUI = () => window.UI;

/**
 * Initialize Settings Manager module
 */
export async function initSettingsManager(store: DataStore): Promise<void> {
    dataStore = store;
    await loadSettings();
    setupEventListeners();
}

/**
 * Setup event listeners for settings management
 */
function setupEventListeners(): void {
    // General settings save button
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    saveSettingsBtn?.addEventListener('click', () => save());
}

/**
 * Load general settings (interval, maxDaily)
 */
async function loadSettings(): Promise<void> {
    try {
        await dataStore.loadSettings();
        const intervalInput = document.getElementById('interval') as HTMLInputElement;
        const maxDailyInput = document.getElementById('maxDaily') as HTMLInputElement;

        if (intervalInput) intervalInput.value = String(dataStore.settings.interval || 60);
        if (maxDailyInput) maxDailyInput.value = String(dataStore.settings.maxDaily || 4);
    } catch (error) {
        console.error('Ayarlar yüklenemedi:', error);
    }
}

/**
 * Save general settings (interval, maxDaily)
 */
async function save(): Promise<void> {
    const btn = document.getElementById('saveSettingsBtn') as HTMLButtonElement;
    const intervalInput = document.getElementById('interval') as HTMLInputElement;
    const maxDailyInput = document.getElementById('maxDaily') as HTMLInputElement;

    if (!btn || !intervalInput || !maxDailyInput) return;

    ButtonUtils.setLoading(btn, 'Kaydediliyor');

    try {
        const response = await ApiService.call('saveSettings', {
            interval: intervalInput.value,
            maxDaily: maxDailyInput.value
        });

        if (response.success) {
            dataStore.settings = response.data as any;
            getUI().showAlert('✅ Ayarlar kaydedildi!', 'success');
        } else {
            ErrorUtils.handleApiError(response as any, 'saveSettings', getUI().showAlert.bind(getUI()));
        }
    } catch (error) {
        ErrorUtils.handleException(error, 'Kaydetme', getUI().showAlert.bind(getUI()));
    } finally {
        ButtonUtils.reset(btn);
    }
}

// Export for potential future use
export { loadSettings as loadGeneralSettings, save as saveGeneralSettings };
