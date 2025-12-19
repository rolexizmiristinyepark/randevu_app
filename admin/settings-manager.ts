/**
 * SETTINGS MANAGER - Ayarlar Yönetimi Modülü
 * Sorumluluklar: Genel ayarlar, WhatsApp API, Slack Webhook entegrasyonları
 */

import { ApiService } from '../api-service';
import { logError } from '../monitoring';
import type { DataStore } from './data-store';

// ==================== TYPE DEFINITIONS ====================

interface ApiResponse<T = unknown> {
    success: boolean;
    error?: string;
    data?: T;
    configured?: boolean;
}

type RecipientType = '' | 'individual' | 'team';

interface WhatsAppTemplate {
    id: string;
    name: string;
    description?: string;
    variableCount: number;
    variables: Record<string, string>;
    trigger: 'time' | 'event' | 'submit';
    scheduledTime?: string;
    isActive: boolean;
    recipientType?: RecipientType;
    recipientTarget?: string;
    createdAt: string;
    updatedAt: string;
}

// ==================== CONSTANTS ====================

const MIN_VARIABLE_COUNT = 1;
const MAX_VARIABLE_COUNT = 10;
const DEFAULT_VARIABLE_COUNT = 3;

const DEFAULT_VARIABLE_OPTIONS: Record<string, string> = {
    personel: 'Personel (Ad Soyad)',
    musteri: 'Müşteri (Ad Soyad)',
    randevu_tarihi: 'Randevu Tarihi',
    randevu_saati: 'Randevu Saati',
    randevu_turu: 'Randevu Türü',
    ek_bilgi: 'Ek Bilgi'
};

// ==================== MODULE STATE ====================

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
    setupEventListeners();
    setupTemplatesEventListeners();

    // Load API integration settings
    loadWhatsAppSettings();
    loadSlackSettings();
}

/**
 * Setup event listeners for settings management
 */
function setupEventListeners(): void {
    // WhatsApp settings save button
    const saveWhatsAppBtn = document.getElementById('saveWhatsAppSettingsBtn');
    saveWhatsAppBtn?.addEventListener('click', () => saveWhatsAppSettings());

    // Slack settings save button
    const saveSlackBtn = document.getElementById('saveSlackSettingsBtn');
    saveSlackBtn?.addEventListener('click', () => saveSlackSettings());
}

/**
 * Create status box element (safe DOM manipulation)
 */
function createStatusBox(text: string, type: 'success' | 'error' | 'warning'): HTMLElement {
    const colors = {
        success: { bg: '#F0F9F5', text: '#2E7D32' },
        error: { bg: '#FFEBEE', text: '#C62828' },
        warning: { bg: '#FFF8E1', text: '#F57F17' }
    };
    const color = colors[type];

    const wrapper = document.createElement('div');
    wrapper.style.cssText = `padding: 12px; background: ${color.bg}; border: 1px solid #E8E8E8; border-radius: 2px;`;

    const textDiv = document.createElement('div');
    textDiv.style.cssText = `font-size: 13px; color: ${color.text}; letter-spacing: 0.5px;`;
    textDiv.textContent = text;

    wrapper.appendChild(textDiv);
    return wrapper;
}

/**
 * Load WhatsApp API settings status
 */
async function loadWhatsAppSettings(): Promise<void> {
    const statusEl = document.getElementById('whatsappApiStatus');
    if (!statusEl) return;

    // Clear previous content
    while (statusEl.firstChild) {
        statusEl.removeChild(statusEl.firstChild);
    }

    try {
        const response = await ApiService.call('getWhatsAppSettings', {}) as ApiResponse;

        if (response.success) {
            if (response.configured) {
                statusEl.appendChild(createStatusBox('WhatsApp API Yapılandırıldı', 'success'));
            } else {
                statusEl.appendChild(createStatusBox('WhatsApp API Yapılandırılmamış', 'error'));
            }
        } else {
            logError(new Error('WhatsApp settings API returned failure'), {
                action: 'loadWhatsAppSettings',
                error: response.error
            });
            statusEl.appendChild(createStatusBox('WhatsApp API durumu kontrol edilemedi', 'warning'));
        }
    } catch (error) {
        logError(error, { action: 'loadWhatsAppSettings', type: 'exception' });
        statusEl.appendChild(createStatusBox('WhatsApp API durumu kontrol edilemedi', 'warning'));
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
        getUI().showAlert('Lütfen tüm alanları doldurun', 'error');
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
            getUI().showAlert('WhatsApp ayarları kaydedildi', 'success');
            phoneNumberIdInput.value = '';
            accessTokenInput.value = '';
            loadWhatsAppSettings();
        } else {
            getUI().showAlert('Hata: ' + response.error, 'error');
        }
    } catch (error: any) {
        getUI().showAlert('Kaydetme hatası: ' + error.message, 'error');
    }
}

/**
 * Load Slack Webhook settings status
 */
async function loadSlackSettings(): Promise<void> {
    const statusEl = document.getElementById('slackStatus');
    if (!statusEl) return;

    // Clear previous content
    while (statusEl.firstChild) {
        statusEl.removeChild(statusEl.firstChild);
    }

    try {
        const response = await ApiService.call('getSlackSettings', {}) as ApiResponse;

        if (response.success) {
            if (response.configured) {
                statusEl.appendChild(createStatusBox('Slack Webhook Yapılandırıldı', 'success'));
            } else {
                statusEl.appendChild(createStatusBox('Slack Webhook Yapılandırılmamış', 'error'));
            }
        } else {
            logError(new Error('Slack settings API returned failure'), {
                action: 'loadSlackSettings',
                error: response.error
            });
            statusEl.appendChild(createStatusBox('Slack durumu kontrol edilemedi', 'warning'));
        }
    } catch (error) {
        logError(error, { action: 'loadSlackSettings', type: 'exception' });
        statusEl.appendChild(createStatusBox('Slack durumu kontrol edilemedi', 'warning'));
    }
}

/**
 * Save Slack Webhook settings
 */
async function saveSlackSettings(): Promise<void> {
    const webhookUrlInput = document.getElementById('slackWebhookUrl') as HTMLInputElement;
    const webhookUrl = webhookUrlInput?.value.trim();

    if (!webhookUrl) {
        getUI().showAlert('Lütfen Slack Webhook URL girin', 'error');
        return;
    }

    if (!webhookUrl.startsWith('https://hooks.slack.com/')) {
        getUI().showAlert('Geçerli bir Slack Webhook URL girin', 'error');
        return;
    }

    try {
        const response = await ApiService.call('updateSlackSettings', {
            webhookUrl: webhookUrl
        });

        if (response.success) {
            getUI().showAlert('Slack ayarları kaydedildi', 'success');
            webhookUrlInput.value = '';
            loadSlackSettings();
        } else {
            getUI().showAlert('Hata: ' + response.error, 'error');
        }
    } catch (error: any) {
        getUI().showAlert('Kaydetme hatası: ' + error.message, 'error');
    }
}

// ==================== WHATSAPP TEMPLATES ====================

let variableOptions: Record<string, string> = {};
let isLoadingTemplate = false;

/**
 * Setup WhatsApp Templates event listeners
 */
export function setupTemplatesEventListeners(): void {
    // Sub-tab switching
    document.querySelectorAll('.sub-tabs .tab').forEach(tab => {
        tab.addEventListener('click', function(this: HTMLElement) {
            const subtab = this.dataset.subtab;
            if (!subtab) return;

            // Switch sub-tabs
            document.querySelectorAll('.sub-tabs .tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.sub-tab-content').forEach(c => c.classList.remove('active'));

            this.classList.add('active');
            document.getElementById(subtab)?.classList.add('active');

            // Load templates when switching to templates tab
            if (subtab === 'whatsappTemplates') {
                loadTemplates();
                loadVariableOptions();
            }
        });
    });

    // Add template button
    document.getElementById('addTemplateBtn')?.addEventListener('click', addTemplate);

    // Trigger type change - show/hide scheduled time
    document.getElementById('newTemplateTrigger')?.addEventListener('change', function(this: HTMLSelectElement) {
        const scheduledTimeGroup = document.getElementById('scheduledTimeGroup');
        if (scheduledTimeGroup) {
            scheduledTimeGroup.style.display = this.value === 'time' ? 'block' : 'none';
        }
    });

    // Variable count change - update variable selects with validation
    document.getElementById('newTemplateVariableCount')?.addEventListener('change', function(this: HTMLInputElement) {
        const rawCount = parseInt(this.value) || DEFAULT_VARIABLE_COUNT;
        const validatedCount = Math.max(MIN_VARIABLE_COUNT, Math.min(MAX_VARIABLE_COUNT, rawCount));
        this.value = validatedCount.toString();
        renderVariableSelects(validatedCount);
    });

    // Initial variable selects
    renderVariableSelects(DEFAULT_VARIABLE_COUNT);
}

/**
 * Load variable options from backend
 */
async function loadVariableOptions(): Promise<void> {
    try {
        const response = await ApiService.call('getWhatsAppVariableOptions', {}) as ApiResponse<Record<string, string>>;

        if (response.success && response.data) {
            variableOptions = response.data;
        } else {
            logError(new Error('Variable options API returned failure or no data'), {
                action: 'loadVariableOptions',
                error: response.error
            });
            useFallbackVariables();
            getUI().showAlert('Değişken seçenekleri yüklenemedi, varsayılan değerler kullanılıyor', 'warning');
        }

        const currentCount = parseInt((document.getElementById('newTemplateVariableCount') as HTMLInputElement)?.value) || DEFAULT_VARIABLE_COUNT;
        renderVariableSelects(currentCount);
    } catch (error) {
        logError(error, { action: 'loadVariableOptions', type: 'exception' });
        useFallbackVariables();
        getUI().showAlert('Değişken seçenekleri yüklenemedi, varsayılan değerler kullanılıyor', 'warning');

        const currentCount = parseInt((document.getElementById('newTemplateVariableCount') as HTMLInputElement)?.value) || DEFAULT_VARIABLE_COUNT;
        renderVariableSelects(currentCount);
    }
}

/**
 * Use fallback variable options when API fails
 */
function useFallbackVariables(): void {
    variableOptions = { ...DEFAULT_VARIABLE_OPTIONS };
}

/**
 * Render variable select dropdowns (safe DOM manipulation)
 */
function renderVariableSelects(count: number): void {
    const container = document.getElementById('templateVariablesContainer');
    if (!container) return;

    // Clear container safely
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    for (let i = 1; i <= count; i++) {
        const div = document.createElement('div');
        div.className = 'input-group';

        const label = document.createElement('label');
        label.setAttribute('for', `templateVar${i}`);
        label.textContent = `Değişken ${i}`;

        const select = document.createElement('select');
        select.id = `templateVar${i}`;

        Object.entries(variableOptions).forEach(([key, labelText]) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = labelText;
            select.appendChild(option);
        });

        div.appendChild(label);
        div.appendChild(select);
        container.appendChild(div);
    }
}

/**
 * Clear container and show message
 */
function showContainerMessage(container: HTMLElement, text: string, isError: boolean = false): void {
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
    const p = document.createElement('p');
    p.style.cssText = `color: ${isError ? '#C62828' : '#666'}; font-size: 14px;`;
    p.textContent = text;
    container.appendChild(p);
}

/**
 * Load WhatsApp templates list
 */
async function loadTemplates(): Promise<void> {
    const container = document.getElementById('templatesList');
    if (!container) return;

    // Show loading
    showContainerMessage(container, 'Yükleniyor...');

    try {
        const response = await ApiService.call('getWhatsAppTemplates', {}) as ApiResponse<WhatsAppTemplate[]>;

        if (response.success) {
            const templates = response.data || [];
            renderTemplatesList(templates);
        } else {
            logError(new Error('Templates API returned failure'), {
                action: 'loadTemplates',
                error: response.error
            });
            showContainerMessage(container, `Şablonlar yüklenemedi: ${response.error || 'Bilinmeyen hata'}`, true);
        }
    } catch (error) {
        logError(error, { action: 'loadTemplates', type: 'exception' });
        const errorMessage = error instanceof Error ? error.message : 'Bağlantı hatası';
        showContainerMessage(container, `Şablonlar yüklenemedi: ${errorMessage}`, true);
    }
}

/**
 * Render templates list (safe DOM manipulation)
 */
function renderTemplatesList(templates: WhatsAppTemplate[]): void {
    const container = document.getElementById('templatesList');
    if (!container) return;

    // Clear container
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    if (templates.length === 0) {
        const emptyP = document.createElement('p');
        emptyP.style.cssText = 'color: #666; font-size: 14px;';
        emptyP.textContent = 'Henüz şablon eklenmemiş';
        container.appendChild(emptyP);
        return;
    }

    const triggerLabels: Record<string, string> = {
        'time': 'Zaman Bazlı',
        'event': 'Olay Bazlı',
        'submit': 'Manuel'
    };

    templates.forEach(t => {
        const item = document.createElement('div');
        item.className = 'template-item';
        item.style.cssText = 'padding: 15px; background: #f9f9f9; border-radius: 8px; margin-bottom: 10px;';

        // Header row
        const headerRow = document.createElement('div');
        headerRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';

        // Left side - name and status
        const leftDiv = document.createElement('div');
        const nameStrong = document.createElement('strong');
        nameStrong.textContent = t.name;

        const statusSpan = document.createElement('span');
        statusSpan.style.cssText = `margin-left: 10px; padding: 2px 8px; background: ${t.isActive ? '#E8F5E9' : '#FFEBEE'}; color: ${t.isActive ? '#2E7D32' : '#C62828'}; font-size: 12px; border-radius: 4px;`;
        statusSpan.textContent = t.isActive ? 'Aktif' : 'Pasif';

        leftDiv.appendChild(nameStrong);
        leftDiv.appendChild(statusSpan);

        // Right side - buttons
        const rightDiv = document.createElement('div');

        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'btn btn-small btn-secondary';
        toggleBtn.textContent = t.isActive ? 'Pasif Yap' : 'Aktif Yap';
        toggleBtn.addEventListener('click', () => toggleTemplate(t.id));

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-small btn-secondary';
        deleteBtn.style.color = '#C62828';
        deleteBtn.textContent = 'Sil';
        deleteBtn.addEventListener('click', () => deleteTemplate(t.id));

        rightDiv.appendChild(toggleBtn);
        rightDiv.appendChild(deleteBtn);

        headerRow.appendChild(leftDiv);
        headerRow.appendChild(rightDiv);

        // Details row
        const detailsDiv = document.createElement('div');
        detailsDiv.style.cssText = 'margin-top: 8px; font-size: 13px; color: #666;';

        let detailsText = '';
        if (t.description) detailsText += t.description + ' • ';
        detailsText += triggerLabels[t.trigger] || t.trigger;
        if (t.trigger === 'time' && t.scheduledTime) detailsText += ' (' + t.scheduledTime + ')';
        detailsText += ' • ' + t.variableCount + ' değişken';

        detailsDiv.textContent = detailsText;

        item.appendChild(headerRow);
        item.appendChild(detailsDiv);
        container.appendChild(item);
    });
}

/**
 * Set button loading state
 */
function setButtonLoading(buttonId: string, isLoading: boolean, loadingText: string, normalText: string): void {
    const btn = document.getElementById(buttonId) as HTMLButtonElement;
    if (btn) {
        btn.disabled = isLoading;
        btn.textContent = isLoading ? loadingText : normalText;
    }
}

/**
 * Add new template
 */
async function addTemplate(): Promise<void> {
    if (isLoadingTemplate) return;

    const name = (document.getElementById('newTemplateName') as HTMLInputElement)?.value.trim();
    const description = (document.getElementById('newTemplateDescription') as HTMLInputElement)?.value.trim();
    const trigger = (document.getElementById('newTemplateTrigger') as HTMLSelectElement)?.value as 'time' | 'event' | 'submit';
    const scheduledTime = (document.getElementById('newTemplateScheduledTime') as HTMLInputElement)?.value;
    const rawCount = parseInt((document.getElementById('newTemplateVariableCount') as HTMLInputElement)?.value) || DEFAULT_VARIABLE_COUNT;
    const variableCount = Math.max(MIN_VARIABLE_COUNT, Math.min(MAX_VARIABLE_COUNT, rawCount));
    const recipientType = (document.getElementById('newTemplateRecipientType') as HTMLSelectElement)?.value as RecipientType;
    const isActive = (document.getElementById('newTemplateIsActive') as HTMLInputElement)?.checked;

    if (!name) {
        getUI().showAlert('Şablon adı gerekli', 'error');
        return;
    }

    // Validate trigger-scheduledTime relationship
    if (trigger === 'time' && !scheduledTime) {
        getUI().showAlert('Zaman bazlı tetikleyici için gönderim saati gerekli', 'error');
        return;
    }

    // Collect variables
    const variables: Record<string, string> = {};
    for (let i = 1; i <= variableCount; i++) {
        const select = document.getElementById(`templateVar${i}`) as HTMLSelectElement;
        if (select) {
            variables[i.toString()] = select.value;
        }
    }

    isLoadingTemplate = true;
    setButtonLoading('addTemplateBtn', true, 'Ekleniyor...', 'Şablon Ekle');

    try {
        const response = await ApiService.call('createWhatsAppTemplate', {
            template: JSON.stringify({
                name,
                description,
                trigger,
                scheduledTime: trigger === 'time' ? scheduledTime : null,
                variableCount,
                variables,
                recipientType: recipientType || '',
                isActive
            })
        }) as ApiResponse;

        if (response.success) {
            getUI().showAlert('Şablon eklendi', 'success');
            // Reset form
            (document.getElementById('newTemplateName') as HTMLInputElement).value = '';
            (document.getElementById('newTemplateDescription') as HTMLInputElement).value = '';
            loadTemplates();
        } else {
            logError(new Error('Create template failed'), {
                action: 'addTemplate',
                templateName: name,
                error: response.error
            });
            getUI().showAlert('Hata: ' + (response.error || 'Bilinmeyen hata'), 'error');
        }
    } catch (error) {
        logError(error, {
            action: 'addTemplate',
            templateName: name,
            type: 'exception'
        });
        const errorMessage = error instanceof Error ? error.message : 'Bağlantı hatası';
        getUI().showAlert('Ekleme hatası: ' + errorMessage, 'error');
    } finally {
        isLoadingTemplate = false;
        setButtonLoading('addTemplateBtn', false, 'Ekleniyor...', 'Şablon Ekle');
    }
}

/**
 * Toggle template active status
 */
async function toggleTemplate(id: string): Promise<void> {
    try {
        // First get current template
        const response = await ApiService.call('getWhatsAppTemplates', {}) as ApiResponse<WhatsAppTemplate[]>;

        if (!response.success) {
            logError(new Error('Failed to fetch templates for toggle'), {
                action: 'toggleTemplate',
                templateId: id,
                error: response.error
            });
            getUI().showAlert('Şablon durumu değiştirilemedi: Veri yüklenemedi', 'error');
            return;
        }

        const templates = response.data || [];
        const template = templates.find((t: WhatsAppTemplate) => t.id === id);

        if (!template) {
            logError(new Error('Template not found for toggle'), {
                action: 'toggleTemplate',
                templateId: id,
                availableIds: templates.map(t => t.id)
            });
            getUI().showAlert('Şablon bulunamadı - liste yenileniyor', 'error');
            loadTemplates();
            return;
        }

        // Update with toggled status
        const updateResponse = await ApiService.call('updateWhatsAppTemplate', {
            id,
            updates: JSON.stringify({ isActive: !template.isActive })
        }) as ApiResponse;

        if (updateResponse.success) {
            getUI().showAlert('Şablon durumu güncellendi', 'success');
            loadTemplates();
        } else {
            logError(new Error('Toggle template failed'), {
                action: 'toggleTemplate',
                templateId: id,
                error: updateResponse.error
            });
            getUI().showAlert('Hata: ' + (updateResponse.error || 'Bilinmeyen hata'), 'error');
        }
    } catch (error) {
        logError(error, {
            action: 'toggleTemplate',
            templateId: id,
            type: 'exception'
        });
        const errorMessage = error instanceof Error ? error.message : 'Bağlantı hatası';
        getUI().showAlert('Güncelleme hatası: ' + errorMessage, 'error');
    }
}

/**
 * Delete template
 */
async function deleteTemplate(id: string): Promise<void> {
    if (!confirm('Bu şablonu silmek istediğinizden emin misiniz?')) return;

    try {
        const response = await ApiService.call('deleteWhatsAppTemplate', { id }) as ApiResponse;

        if (response.success) {
            getUI().showAlert('Şablon silindi', 'success');
            loadTemplates();
        } else {
            logError(new Error('Delete template failed'), {
                action: 'deleteTemplate',
                templateId: id,
                error: response.error
            });
            getUI().showAlert('Hata: ' + (response.error || 'Bilinmeyen hata'), 'error');
        }
    } catch (error) {
        logError(error, {
            action: 'deleteTemplate',
            templateId: id,
            type: 'exception'
        });
        const errorMessage = error instanceof Error ? error.message : 'Bağlantı hatası';
        getUI().showAlert('Silme hatası: ' + errorMessage, 'error');
    }
}

