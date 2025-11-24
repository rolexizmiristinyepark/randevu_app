/**
 * SETTINGS MANAGER - Ayarlar Yönetimi Modülü
 * Sorumluluklar: Genel ayarlar, WhatsApp API, Slack Webhook entegrasyonları
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

const { UI } = window;

/**
 * Initialize Settings Manager module
 */
export async function initSettingsManager(store: DataStore): Promise<void> {
    dataStore = store;
    await loadSettings();
    setupEventListeners();

    // Load API integration settings
    loadWhatsAppSettings();
    loadSlackSettings();
}

/**
 * Setup event listeners for settings management
 */
function setupEventListeners(): void {
    // General settings save button
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    saveSettingsBtn?.addEventListener('click', () => save());

    // WhatsApp settings save button
    const saveWhatsAppBtn = document.getElementById('saveWhatsAppSettingsBtn');
    saveWhatsAppBtn?.addEventListener('click', () => saveWhatsAppSettings());

    // Slack settings save button
    const saveSlackBtn = document.getElementById('saveSlackSettingsBtn');
    saveSlackBtn?.addEventListener('click', () => saveSlackSettings());
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
            UI.showAlert('✅ Ayarlar kaydedildi!', 'success');
        } else {
            ErrorUtils.handleApiError(response as any, 'saveSettings', UI.showAlert.bind(UI));
        }
    } catch (error) {
        ErrorUtils.handleException(error, 'Kaydetme', UI.showAlert.bind(UI));
    } finally {
        ButtonUtils.reset(btn);
    }
}

/**
 * Load WhatsApp API settings status
 */
async function loadWhatsAppSettings(): Promise<void> {
    try {
        const response = await ApiService.call('getWhatsAppSettings', {});
        if (response.success) {
            const statusEl = document.getElementById('whatsappApiStatus');
            if (!statusEl) return;

            if ((response as any).configured) {
                statusEl.innerHTML = `
                    <div style="padding: 12px; background: #F0F9F5; border: 1px solid #E8E8E8; border-radius: 2px;">
                        <div style="font-size: 13px; color: #2E7D32; letter-spacing: 0.5px;">
                            WhatsApp API Yapılandırıldı
                        </div>
                    </div>
                `;
            } else {
                statusEl.innerHTML = `
                    <div style="padding: 12px; background: #FFEBEE; border: 1px solid #E8E8E8; border-radius: 2px;">
                        <div style="font-size: 13px; color: #C62828; letter-spacing: 0.5px;">
                            WhatsApp API Yapılandırılmamış
                        </div>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('WhatsApp ayarları yüklenemedi:', error);
    }
}

/**
 * Save WhatsApp API settings
 */
async function saveWhatsAppSettings(): Promise<void> {
    const phoneNumberIdInput = document.getElementById('whatsappPhoneNumberId') as HTMLInputElement;
    const accessTokenInput = document.getElementById('whatsappAccessToken') as HTMLInputElement;

    const phoneNumberId = phoneNumberIdInput?.value.trim();
    const accessToken = accessTokenInput?.value.trim();

    if (!phoneNumberId || !accessToken) {
        UI.showAlert('❌ Lütfen tüm alanları doldurun', 'error');
        return;
    }

    try {
        const response = await ApiService.call('updateWhatsAppSettings', {
            settings: JSON.stringify({
                phoneNumberId: phoneNumberId,
                accessToken: accessToken
            })
        });

        if (response.success) {
            UI.showAlert('✅ WhatsApp ayarları kaydedildi', 'success');
            phoneNumberIdInput.value = '';
            accessTokenInput.value = '';
            loadWhatsAppSettings();
        } else {
            UI.showAlert('❌ Hata: ' + response.error, 'error');
        }
    } catch (error: any) {
        UI.showAlert('❌ Kaydetme hatası: ' + error.message, 'error');
    }
}

/**
 * Load Slack Webhook settings status
 */
async function loadSlackSettings(): Promise<void> {
    try {
        const response = await ApiService.call('getSlackSettings', {});
        if (response.success) {
            const statusEl = document.getElementById('slackStatus');
            if (!statusEl) return;

            if ((response as any).configured) {
                statusEl.innerHTML = `
                    <div style="padding: 12px; background: #F0F9F5; border: 1px solid #E8E8E8; border-radius: 2px;">
                        <div style="font-size: 13px; color: #2E7D32; letter-spacing: 0.5px;">
                            Slack Webhook Yapılandırıldı
                        </div>
                    </div>
                `;
            } else {
                statusEl.innerHTML = `
                    <div style="padding: 12px; background: #FFEBEE; border: 1px solid #E8E8E8; border-radius: 2px;">
                        <div style="font-size: 13px; color: #C62828; letter-spacing: 0.5px;">
                            Slack Webhook Yapılandırılmamış
                        </div>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('Slack ayarları yüklenemedi:', error);
    }
}

/**
 * Save Slack Webhook settings
 */
async function saveSlackSettings(): Promise<void> {
    const webhookUrlInput = document.getElementById('slackWebhookUrl') as HTMLInputElement;
    const webhookUrl = webhookUrlInput?.value.trim();

    if (!webhookUrl) {
        UI.showAlert('❌ Lütfen Slack Webhook URL girin', 'error');
        return;
    }

    if (!webhookUrl.startsWith('https://hooks.slack.com/')) {
        UI.showAlert('❌ Geçerli bir Slack Webhook URL girin', 'error');
        return;
    }

    try {
        const response = await ApiService.call('updateSlackSettings', {
            webhookUrl: webhookUrl
        });

        if (response.success) {
            UI.showAlert('✅ Slack ayarları kaydedildi', 'success');
            webhookUrlInput.value = '';
            loadSlackSettings();
        } else {
            UI.showAlert('❌ Hata: ' + response.error, 'error');
        }
    } catch (error: any) {
        UI.showAlert('❌ Kaydetme hatası: ' + error.message, 'error');
    }
}

// Export for potential future use
export { loadSettings as loadGeneralSettings, save as saveGeneralSettings };
