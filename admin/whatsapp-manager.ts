/**
 * WHATSAPP MANAGER - WhatsApp Template Yönetimi
 *
 * FAZ 4: WhatsApp entegrasyonu için admin panel modülü
 * v3.10.0: Flow yönetimi unified-flow-manager.ts'e taşındı
 *
 * Sorumluluklar:
 * - Template yönetimi
 * - Mesaj geçmişi görüntüleme
 *
 * NOT: Flow yönetimi artık notification_flows üzerinden yapılmaktadır.
 * Unified Flow Manager kullanınız.
 */

import { ApiService } from '../api-service';
import { logError } from '../monitoring';
import { closeModal } from '../ui-utils';
import { ButtonAnimator, FormDirtyState } from '../button-utils';
import type { DataStore } from './data-store';

// ==================== TYPE DEFINITIONS ====================

interface ApiResponse<T = unknown> {
    success: boolean;
    error?: string;
    message?: string;
    data?: T;
}

interface WhatsAppFlow {
    id: string;
    name: string;
    description: string;
    profiles: string[];
    trigger: string; // 'RANDEVU_OLUŞTUR' | 'RANDEVU_İPTAL' | 'HATIRLATMA' etc.
    triggerType: 'event' | 'time';
    hatirlatmaSaat?: string; // For time-based: "09:00"
    hatirlatmaZaman?: string; // For time-based: "1_gun_once" | "2_saat_once"
    templateIds: string[];
    active: boolean;
}

interface WhatsAppTemplate {
    id: string;
    name: string;              // User-friendly display name
    metaTemplateName: string;  // Meta Business API template name
    description: string;
    variableCount: number;
    variables: Record<string, string>;
    targetType: string;
    language: string;
    content?: string;          // v3.10.19: WhatsApp şablon içeriği (Meta'daki orijinal metin)
    hasButton?: boolean;       // v3.10.22: WhatsApp şablonunda düğme var mı
    buttonVariable?: string;   // v3.10.22: Düğme için kullanılacak değişken
}

interface WhatsAppMessage {
    id: string;
    phone: string | number;
    templateName: string;
    status: 'sent' | 'delivered' | 'read' | 'failed';
    sentAt?: string;
    error?: string;
    errorMessage?: string; // Backend'den gelen hata mesajı
    messageContent?: string; // v3.10.10: Mesaj içeriği
    timestamp?: string; // Backend'den gelen timestamp
    recipientName?: string;
}

// ==================== CONSTANTS ====================

const PROFILE_LABELS: Record<string, string> = {
    'g': 'general',
    'w': 'walk-in',
    'b': 'boutique',
    'm': 'management',
    's': 'individual',
    'v': 'vip'
};

// TRIGGER_LABELS: API'den yüklenir (Variables.js - MESSAGE_TRIGGERS)
let triggerLabels: Record<string, string> = {};

// RECIPIENT_LABELS: API'den yüklenir (Variables.js - MESSAGE_RECIPIENTS)
let recipientLabels: Record<string, string> = {};

const HATIRLATMA_ZAMAN_LABELS: Record<string, string> = {
    '1_gun_once': '1 gün önce',
    '2_saat_once': '2 saat önce',
    '1_saat_once': '1 saat önce',
    '30_dk_once': '30 dakika önce'
};

// ==================== MODULE STATE ====================

// Note: dataStore assigned for future use
let _dataStore: DataStore;
let flows: WhatsAppFlow[] = [];
let templates: WhatsAppTemplate[] = [];
let messageVariables: Record<string, string> = {};
let templateModalDirtyState: FormDirtyState | null = null;

// Global references (accessed via window)
declare const window: Window & {
    UI: {
        showAlert: (message: string, type: string) => void;
    };
};

const getUI = () => window.UI;

// ==================== INITIALIZATION ====================

/**
 * Initialize WhatsApp Manager module
 */
export async function initWhatsAppManager(store: DataStore): Promise<void> {
    _dataStore = store;
    setupEventListeners();

    // Initial data load
    // v3.10.0: loadFlows() removed - flows are now managed via unified-flow-manager
    await Promise.all([
        loadTemplates(),
        loadMessageVariables(),
        loadTriggers(),
        loadRecipients()
    ]);

    // Populate target select with recipients
    populateTargetSelect();

    // Show deprecation message in flow container
    const flowContainer = document.getElementById('whatsappFlowList');
    if (flowContainer) {
        flowContainer.innerHTML = `
            <div style="padding: 20px; text-align: center; color: #666; background: #f5f5f5; border-radius: 8px;">
                <p style="margin: 0; font-size: 14px;">
                    <strong>v3.10.0:</strong> WhatsApp flow'ları artık "Bildirim Akışları" sekmesinden yönetilmektedir.
                </p>
            </div>
        `;
    }
}

/**
 * Load message variables from backend (Variables.js)
 */
async function loadMessageVariables(): Promise<void> {
    try {
        const response = await ApiService.call('getMessageVariables', {}) as ApiResponse<Record<string, string>>;

        if (response.success && response.data) {
            messageVariables = response.data;
        }
    } catch (error) {
        logError(error, { action: 'loadMessageVariables' });
    }
}

/**
 * Load triggers from backend (Variables.js - MESSAGE_TRIGGERS)
 */
async function loadTriggers(): Promise<void> {
    try {
        const response = await ApiService.call('getTriggers', {}) as ApiResponse<Record<string, string>>;

        if (response.success && response.data) {
            triggerLabels = response.data;
        }
    } catch (error) {
        logError(error, { action: 'loadTriggers' });
    }
}

/**
 * Load recipients from backend (Variables.js - MESSAGE_RECIPIENTS)
 */
async function loadRecipients(): Promise<void> {
    try {
        const response = await ApiService.call('getRecipients', {}) as ApiResponse<Record<string, string>>;

        if (response.success && response.data) {
            recipientLabels = response.data;
        }
    } catch (error) {
        logError(error, { action: 'loadRecipients' });
    }
}

/**
 * Populate target select with recipients from backend
 */
function populateTargetSelect(): void {
    const select = document.getElementById('templateTargetType') as HTMLSelectElement;
    if (!select) return;

    // Clear existing options
    while (select.firstChild) {
        select.removeChild(select.firstChild);
    }

    Object.entries(recipientLabels).forEach(([key, label]) => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = label;
        select.appendChild(option);
    });
}

/**
 * Populate button variable select with message variables
 */
function populateButtonVariableSelect(): void {
    const select = document.getElementById('templateButtonVariable') as HTMLSelectElement;
    if (!select) return;

    // Clear existing options
    while (select.firstChild) {
        select.removeChild(select.firstChild);
    }

    Object.entries(messageVariables).forEach(([key, label]) => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = label;
        select.appendChild(option);
    });
}

/**
 * Setup all event listeners
 */
function setupEventListeners(): void {
    // v3.10.0: Flow button disabled - flows are managed via unified-flow-manager
    // document.getElementById('addWhatsAppFlowBtn')?.addEventListener('click', () => openFlowModal());

    // Template buttons
    document.getElementById('addTemplateBtn')?.addEventListener('click', () => openTemplateModal());

    // v3.10.0: Flow Modal handlers disabled - flows are managed via unified-flow-manager
    // document.getElementById('cancelFlowBtn')?.addEventListener('click', () => closeModal('whatsappFlowModal'));
    // document.getElementById('saveFlowBtn')?.addEventListener('click', saveFlow);
    // document.querySelector('#whatsappFlowModal .modal-overlay')?.addEventListener('click', () => closeModal('whatsappFlowModal'));

    // Template Modal handlers
    document.getElementById('cancelTemplateBtn')?.addEventListener('click', () => closeModal('whatsappTemplateModal'));
    document.getElementById('saveTemplateBtn')?.addEventListener('click', saveTemplate);
    document.querySelector('#whatsappTemplateModal .modal-overlay')?.addEventListener('click', () => closeModal('whatsappTemplateModal'));

    // v3.10.0: Trigger type change disabled - flows are managed via unified-flow-manager
    // document.getElementById('flowTriggerType')?.addEventListener('change', (e) => {
    //     const value = (e.target as HTMLSelectElement).value;
    //     const timeOptions = document.getElementById('timeBasedOptions');
    //     const eventOptions = document.getElementById('eventBasedOptions');
    //     if (timeOptions) timeOptions.style.display = value === 'time' ? 'block' : 'none';
    //     if (eventOptions) eventOptions.style.display = value === 'event' ? 'block' : 'none';
    // });

    // Template variable count change - generate variable inputs
    document.getElementById('templateVariableCount')?.addEventListener('change', (e) => {
        const count = parseInt((e.target as HTMLInputElement).value) || 0;
        generateVariableInputs(count);
    });

    // Button checkbox change - show/hide button variable selector
    document.getElementById('templateHasButton')?.addEventListener('change', (e) => {
        const checked = (e.target as HTMLInputElement).checked;
        const container = document.getElementById('templateButtonVariableContainer');
        if (container) {
            container.style.display = checked ? 'block' : 'none';
            if (checked) {
                populateButtonVariableSelect();
            }
        }
    });

    // Modal close handlers (escape key)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });
}

// ==================== FLOW MANAGEMENT ====================

/**
 * Load all flows from backend
 */
async function loadFlows(): Promise<void> {
    const container = document.getElementById('whatsappFlowList');

    showContainerLoading(container);

    try {
        const response = await ApiService.call('getWhatsAppFlows', {}) as ApiResponse<WhatsAppFlow[]>;

        if (response.success && response.data) {
            flows = response.data;
            renderFlows();
        } else {
            showContainerError(container, response.error || 'Yüklenemedi');
        }
    } catch (error) {
        logError(error, { action: 'loadFlows' });
        showContainerError(container, 'Bağlantı hatası');
    }
}

/**
 * Render all flows in single container
 */
function renderFlows(): void {
    renderFlowList('whatsappFlowList', flows);
}

/**
 * Render a list of flows
 */
function renderFlowList(containerId: string, flowList: WhatsAppFlow[]): void {
    const container = document.getElementById(containerId);
    if (!container) return;

    clearContainer(container);

    if (flowList.length === 0) {
        showContainerEmpty(container, 'Henüz flow eklenmemiş');
        return;
    }

    flowList.forEach(flow => {
        const item = createFlowItem(flow);
        container.appendChild(item);
    });
}

/**
 * Create a flow item element
 */
function createFlowItem(flow: WhatsAppFlow): HTMLElement {
    const item = document.createElement('div');
    item.className = 'flow-item mail-list-item';
    item.style.cssText = 'padding: 15px; background: #FAFAFA; border: 1px solid #E8E8E8; border-radius: 4px; margin-bottom: 10px;';

    // Trigger type'ı flow'dan al
    const isTimeBased = flow.triggerType === 'time' || flow.trigger === 'HATIRLATMA';

    // Header row - responsive
    const header = document.createElement('div');
    header.className = 'mail-item-header';

    // Left: Name + Status
    const left = document.createElement('div');
    left.className = 'mail-item-name';
    left.style.cssText = 'display: flex; align-items: center; gap: 10px; flex-wrap: wrap;';

    const name = document.createElement('strong');
    name.textContent = flow.name;

    const status = document.createElement('span');
    status.style.cssText = `padding: 2px 8px; border-radius: 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; ${flow.active ? 'background: #E8F5E9; color: #2E7D32;' : 'background: #FFEBEE; color: #C62828;'}`;
    status.textContent = flow.active ? 'Active' : 'Inactive';

    left.appendChild(name);
    left.appendChild(status);

    // Right: Actions - responsive
    const right = document.createElement('div');
    right.className = 'mail-item-actions';

    const editBtn = createButton('Edit', 'btn-secondary btn-small', () => editFlow(flow.id));
    const toggleBtn = createButton(flow.active ? 'Stop' : 'Start', 'btn-secondary btn-small', () => toggleFlow(flow.id));
    const deleteBtn = createButton('Delete', 'btn-secondary btn-small', () => deleteFlow(flow.id));

    right.appendChild(editBtn);
    right.appendChild(toggleBtn);
    right.appendChild(deleteBtn);

    header.appendChild(left);
    header.appendChild(right);

    // Details row
    const details = document.createElement('div');
    details.style.cssText = 'font-size: 12px; color: #757575; display: flex; flex-wrap: wrap; gap: 15px;';

    // Profiles
    const profilesText = flow.profiles.map(p => PROFILE_LABELS[p] || p).join(', ');
    const profilesSpan = document.createElement('span');
    profilesSpan.textContent = profilesText;
    details.appendChild(profilesSpan);

    // Trigger
    const triggerSpan = document.createElement('span');
    if (isTimeBased) {
        const zamanLabel = HATIRLATMA_ZAMAN_LABELS[flow.hatirlatmaZaman || ''] || flow.hatirlatmaZaman;
        triggerSpan.textContent = (flow.hatirlatmaSaat || '') + ' - ' + zamanLabel;
    } else {
        triggerSpan.textContent = (triggerLabels[flow.trigger] || flow.trigger);
    }
    details.appendChild(triggerSpan);

    // Template count
    const templateSpan = document.createElement('span');
    templateSpan.textContent = flow.templateIds.length + ' şablon';
    details.appendChild(templateSpan);

    item.appendChild(header);
    item.appendChild(details);

    return item;
}

/**
 * Open flow creation/edit modal
 */
function openFlowModal(flowId?: string): void {
    const modal = document.getElementById('whatsappFlowModal');
    if (!modal) return;

    // Reset form
    resetFlowForm();

    // Get type from existing flow or default to 'event'
    let type: 'time' | 'event' = 'event';
    if (flowId) {
        const existingFlow = flows.find(f => f.id === flowId);
        if (existingFlow) {
            type = existingFlow.triggerType === 'time' ? 'time' : 'event';
        }
    }

    // Set trigger type
    const triggerTypeSelect = document.getElementById('flowTriggerType') as HTMLSelectElement;
    if (triggerTypeSelect) {
        triggerTypeSelect.value = type;
        // Trigger change event to show/hide options
        triggerTypeSelect.dispatchEvent(new Event('change'));
    }

    // Update modal header
    const header = modal.querySelector('.modal-header');
    if (header) {
        header.textContent = flowId ? 'Edit Flow' : 'New WhatsApp Flow';
    }

    // If editing, populate form with existing data
    if (flowId) {
        const flow = flows.find(f => f.id === flowId);
        if (flow) {
            populateFlowForm(flow);
        }
        const editIdInput = document.getElementById('flowEditId') as HTMLInputElement;
        if (editIdInput) editIdInput.value = flowId;
    }

    // Populate template options
    populateTemplateSelect();

    // Show modal
    modal.classList.add('active');
}

/**
 * Reset flow form to defaults
 */
function resetFlowForm(): void {
    (document.getElementById('flowName') as HTMLInputElement).value = '';
    (document.getElementById('flowDescription') as HTMLInputElement).value = '';
    (document.getElementById('flowTime') as HTMLInputElement).value = '09:00';
    (document.getElementById('flowTimeBefore') as HTMLSelectElement).value = '1_gun_once';
    (document.getElementById('flowTrigger') as HTMLSelectElement).value = 'RANDEVU_OLUŞTUR';
    (document.getElementById('flowEditId') as HTMLInputElement).value = '';

    // Uncheck all profile checkboxes
    document.querySelectorAll('input[name="flowProfiles"]').forEach(cb => {
        (cb as HTMLInputElement).checked = false;
    });

    // Clear template selection
    const templateSelect = document.getElementById('flowTemplates') as HTMLSelectElement;
    if (templateSelect) {
        Array.from(templateSelect.options).forEach(opt => opt.selected = false);
    }
}

/**
 * Populate flow form with existing flow data
 */
function populateFlowForm(flow: WhatsAppFlow): void {
    (document.getElementById('flowName') as HTMLInputElement).value = flow.name;
    (document.getElementById('flowDescription') as HTMLInputElement).value = flow.description || '';
    (document.getElementById('flowTriggerType') as HTMLSelectElement).value = flow.triggerType;

    if (flow.triggerType === 'time') {
        (document.getElementById('flowTime') as HTMLInputElement).value = flow.hatirlatmaSaat || '09:00';
        (document.getElementById('flowTimeBefore') as HTMLSelectElement).value = flow.hatirlatmaZaman || '1_gun_once';
    } else {
        (document.getElementById('flowTrigger') as HTMLSelectElement).value = flow.trigger;
    }

    // Check profile checkboxes
    flow.profiles.forEach(profile => {
        const checkbox = document.querySelector(`input[name="flowProfiles"][value="${profile}"]`) as HTMLInputElement;
        if (checkbox) checkbox.checked = true;
    });
}

/**
 * Populate template select with available templates (using safe DOM methods)
 */
function populateTemplateSelect(): void {
    const select = document.getElementById('flowTemplates') as HTMLSelectElement;
    if (!select) return;

    // Clear existing options using safe DOM method
    while (select.firstChild) {
        select.removeChild(select.firstChild);
    }

    // Add template options using safe DOM methods
    templates.forEach(template => {
        const option = document.createElement('option');
        option.value = template.id;
        const targetLabel = recipientLabels[template.targetType] || template.targetType;
        option.textContent = `${template.name} (${targetLabel})`;
        select.appendChild(option);
    });
}

/**
 * Save flow to backend
 */
async function saveFlow(): Promise<void> {
    const saveBtn = document.getElementById('saveFlowBtn') as HTMLButtonElement;

    const name = (document.getElementById('flowName') as HTMLInputElement).value.trim();
    const description = (document.getElementById('flowDescription') as HTMLInputElement).value.trim();
    const triggerType = (document.getElementById('flowTriggerType') as HTMLSelectElement).value as 'time' | 'event';
    const editId = (document.getElementById('flowEditId') as HTMLInputElement).value;

    // Validation
    if (!name) {
        getUI().showAlert('Flow adı gereklidir', 'error');
        return;
    }

    // Get selected profiles
    const profiles: string[] = [];
    document.querySelectorAll('input[name="flowProfiles"]:checked').forEach(cb => {
        profiles.push((cb as HTMLInputElement).value);
    });

    if (profiles.length === 0) {
        getUI().showAlert('En az bir profil seçmelisiniz', 'error');
        return;
    }

    // Get selected templates
    const templateSelect = document.getElementById('flowTemplates') as HTMLSelectElement;
    const templateIds = Array.from(templateSelect.selectedOptions).map(opt => opt.value);

    if (templateIds.length === 0) {
        getUI().showAlert('En az bir şablon seçmelisiniz', 'error');
        return;
    }

    // Build flow data
    const flowData: Partial<WhatsAppFlow> = {
        name,
        description,
        triggerType,
        profiles,
        templateIds,
        active: true
    };

    if (triggerType === 'time') {
        flowData.trigger = 'HATIRLATMA';
        flowData.hatirlatmaSaat = (document.getElementById('flowTime') as HTMLInputElement).value;
        flowData.hatirlatmaZaman = (document.getElementById('flowTimeBefore') as HTMLSelectElement).value;
    } else {
        flowData.trigger = (document.getElementById('flowTrigger') as HTMLSelectElement).value;
    }

    // Add loading state
    if (saveBtn) {
        ButtonAnimator.start(saveBtn);
    }

    try {
        const action = editId ? 'updateWhatsAppFlow' : 'addWhatsAppFlow';
        const params = editId ? { id: editId, ...flowData } : flowData;

        const response = await ApiService.call(action, params) as ApiResponse;

        if (response.success) {
            if (saveBtn) {
                ButtonAnimator.success(saveBtn);
            }
            getUI().showAlert(editId ? 'Flow güncellendi' : 'Flow oluşturuldu', 'success');
            setTimeout(() => {
                closeModal('whatsappFlowModal');
                loadFlows();
            }, 1000);
        } else {
            throw new Error(response.error || 'Bilinmeyen hata');
        }
    } catch (error) {
        if (saveBtn) {
            ButtonAnimator.error(saveBtn);
        }
        logError(error, { action: 'saveFlow' });
        getUI().showAlert('Kaydetme hatası: ' + (error as Error).message, 'error');
    }
}

/**
 * Edit existing flow
 */
function editFlow(flowId: string): void {
    const flow = flows.find(f => f.id === flowId);
    if (!flow) {
        getUI().showAlert('Flow bulunamadı', 'error');
        return;
    }

    openFlowModal(flowId);
}

/**
 * Toggle flow active status
 */
async function toggleFlow(flowId: string): Promise<void> {
    const flow = flows.find(f => f.id === flowId);
    if (!flow) {
        getUI().showAlert('Flow bulunamadı', 'error');
        return;
    }

    try {
        const response = await ApiService.call('updateWhatsAppFlow', {
            id: flowId,
            active: !flow.active
        }) as ApiResponse;

        if (response.success) {
            getUI().showAlert('Flow durumu güncellendi', 'success');
            await loadFlows();
        } else {
            getUI().showAlert('Hata: ' + (response.error || 'Bilinmeyen hata'), 'error');
        }
    } catch (error) {
        logError(error, { action: 'toggleFlow', flowId });
        getUI().showAlert('Güncelleme hatası', 'error');
    }
}

/**
 * Delete a flow
 */
async function deleteFlow(flowId: string): Promise<void> {
    if (!confirm('Bu flow\'u silmek istediğinizden emin misiniz?')) return;

    try {
        const response = await ApiService.call('deleteWhatsAppFlow', { id: flowId }) as ApiResponse;

        if (response.success) {
            getUI().showAlert('Flow silindi', 'success');
            await loadFlows();
        } else {
            getUI().showAlert('Hata: ' + (response.error || 'Bilinmeyen hata'), 'error');
        }
    } catch (error) {
        logError(error, { action: 'deleteFlow', flowId });
        getUI().showAlert('Silme hatası', 'error');
    }
}

// ==================== TEMPLATE MANAGEMENT ====================

/**
 * Load all templates from backend
 */
async function loadTemplates(): Promise<void> {
    const container = document.getElementById('templatesList');
    showContainerLoading(container);

    try {
        const response = await ApiService.call('getWhatsAppTemplates', {}) as ApiResponse<WhatsAppTemplate[]>;

        if (response.success && response.data) {
            templates = response.data;
            renderTemplates();
        } else {
            showContainerError(container, response.error || 'Yüklenemedi');
        }
    } catch (error) {
        logError(error, { action: 'loadTemplates' });
        showContainerError(container, 'Bağlantı hatası');
    }
}

/**
 * Get badge color based on target type
 */
function getBadgeColor(targetType: string): string {
    const colors: Record<string, string> = {
        'customer': '#2196F3',
        'staff': '#9C27B0',
        'admin': '#F44336',
        'today_customers': '#4CAF50',
        'today_staffs': '#FF9800',
        'tomorrow_customers': '#00BCD4',
        'tomorrow_staffs': '#795548'
    };
    return colors[targetType] || '#607D8B';
}

/**
 * Render templates list
 */
function renderTemplates(): void {
    const container = document.getElementById('templatesList');
    if (!container) return;

    clearContainer(container);

    if (templates.length === 0) {
        showContainerEmpty(container, 'Henüz şablon eklenmemiş');
        return;
    }

    templates.forEach(template => {
        const item = createTemplateItem(template);
        container.appendChild(item);
    });
}

/**
 * Create a template item element - Matches flow card design
 */
function createTemplateItem(template: WhatsAppTemplate): HTMLElement {
    const item = document.createElement('div');
    item.className = 'template-item mail-list-item';
    item.style.cssText = 'padding: 15px; background: #FAFAFA; border: 1px solid #E8E8E8; border-radius: 4px; margin-bottom: 10px;';

    // Header
    const header = document.createElement('div');
    header.className = 'mail-item-header';

    // Left: Display Name + Target type badge
    const left = document.createElement('div');
    left.style.cssText = 'display: flex; align-items: center; gap: 8px;';

    const name = document.createElement('span');
    name.className = 'mail-item-name';
    name.textContent = template.name;

    const targetBadge = document.createElement('span');
    const badgeColor = getBadgeColor(template.targetType);
    targetBadge.style.cssText = `font-size: 10px; padding: 2px 6px; border-radius: 3px; background: ${badgeColor}; color: white;`;
    targetBadge.textContent = recipientLabels[template.targetType] || template.targetType;

    left.appendChild(name);
    left.appendChild(targetBadge);

    // Right: Actions
    const right = document.createElement('div');
    right.className = 'mail-item-actions';

    const editBtn = createButton('Edit', 'btn-secondary btn-small', () => editTemplate(template.id));
    const deleteBtn = createButton('Delete', 'btn-secondary btn-small', () => deleteTemplate(template.id));

    right.appendChild(editBtn);
    right.appendChild(deleteBtn);

    header.appendChild(left);
    header.appendChild(right);

    // Details - vertical layout with bold labels (matching flow card)
    const details = document.createElement('div');
    details.style.cssText = 'font-size: 12px; margin-top: 10px; display: flex; flex-direction: column; gap: 4px;';

    // Helper function to create a row with bold label
    const createRow = (label: string, value: string): HTMLElement => {
        const row = document.createElement('div');
        const labelSpan = document.createElement('span');
        labelSpan.style.cssText = 'font-weight: 600; color: #555;';
        labelSpan.textContent = `${label}: `;
        const valueSpan = document.createElement('span');
        valueSpan.style.cssText = 'color: #757575;';
        valueSpan.textContent = value;
        row.appendChild(labelSpan);
        row.appendChild(valueSpan);
        return row;
    };

    // Meta template name
    details.appendChild(createRow('Meta', template.metaTemplateName || template.name));

    // Description (if exists)
    if (template.description) {
        details.appendChild(createRow('Description', template.description));
    }

    // Variables and Language
    details.appendChild(createRow('Variables', String(template.variableCount || 0)));
    details.appendChild(createRow('Language', (template.language || 'tr').toUpperCase()));

    item.appendChild(header);
    item.appendChild(details);

    return item;
}

/**
 * Open template modal
 */
function openTemplateModal(templateId?: string): void {
    const modal = document.getElementById('whatsappTemplateModal');
    if (!modal) return;

    // Destroy previous dirty state if exists
    if (templateModalDirtyState) {
        templateModalDirtyState.destroy();
        templateModalDirtyState = null;
    }

    // Reset form
    resetTemplateForm();

    // Update modal header
    const header = modal.querySelector('.modal-header');
    if (header) {
        header.textContent = templateId ? 'Edit Template' : 'Add WhatsApp Template';
    }

    // If editing, populate form with existing data
    if (templateId) {
        const template = templates.find(t => t.id === templateId);
        if (template) {
            populateTemplateForm(template);
        }
        const editIdInput = document.getElementById('templateEditId') as HTMLInputElement;
        if (editIdInput) editIdInput.value = templateId;
    }

    // Show modal
    modal.classList.add('active');

    // Initialize FormDirtyState after modal is shown
    templateModalDirtyState = new FormDirtyState({
        container: '#whatsappTemplateModal .modal-content',
        saveButton: '#saveTemplateBtn'
    });
}

/**
 * Reset template form to defaults
 */
function resetTemplateForm(): void {
    (document.getElementById('templateDisplayName') as HTMLInputElement).value = '';
    (document.getElementById('templateName') as HTMLInputElement).value = '';
    (document.getElementById('templateDescription') as HTMLInputElement).value = '';
    (document.getElementById('templateContent') as HTMLTextAreaElement).value = ''; // v3.10.19
    (document.getElementById('templateTargetType') as HTMLSelectElement).value = 'customer';
    (document.getElementById('templateLanguage') as HTMLSelectElement).value = 'tr';
    (document.getElementById('templateVariableCount') as HTMLInputElement).value = '0';
    (document.getElementById('templateEditId') as HTMLInputElement).value = '';

    // Reset button fields
    const hasButtonCheckbox = document.getElementById('templateHasButton') as HTMLInputElement;
    if (hasButtonCheckbox) hasButtonCheckbox.checked = false;
    const buttonContainer = document.getElementById('templateButtonVariableContainer');
    if (buttonContainer) buttonContainer.style.display = 'none';

    // Clear variable inputs
    const container = document.getElementById('templateVariablesContainer');
    if (container) {
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }
    }
}

/**
 * Populate template form with existing data
 */
function populateTemplateForm(template: WhatsAppTemplate): void {
    (document.getElementById('templateDisplayName') as HTMLInputElement).value = template.name || '';
    (document.getElementById('templateName') as HTMLInputElement).value = template.metaTemplateName || '';
    (document.getElementById('templateDescription') as HTMLInputElement).value = template.description || '';
    (document.getElementById('templateContent') as HTMLTextAreaElement).value = template.content || ''; // v3.10.19
    (document.getElementById('templateTargetType') as HTMLSelectElement).value = template.targetType;
    (document.getElementById('templateLanguage') as HTMLSelectElement).value = template.language || 'tr';
    (document.getElementById('templateVariableCount') as HTMLInputElement).value = String(template.variableCount || 0);

    // Generate variable inputs and populate
    generateVariableInputs(template.variableCount || 0);

    // Populate variable values
    if (template.variables) {
        Object.entries(template.variables).forEach(([key, value]) => {
            const input = document.getElementById(`var_${key}`) as HTMLInputElement;
            if (input) input.value = value;
        });
    }

    // Populate button fields
    const hasButtonCheckbox = document.getElementById('templateHasButton') as HTMLInputElement;
    const buttonContainer = document.getElementById('templateButtonVariableContainer');
    if (hasButtonCheckbox && buttonContainer) {
        hasButtonCheckbox.checked = template.hasButton || false;
        buttonContainer.style.display = template.hasButton ? 'block' : 'none';
        if (template.hasButton) {
            populateButtonVariableSelect();
            const buttonSelect = document.getElementById('templateButtonVariable') as HTMLSelectElement;
            if (buttonSelect && template.buttonVariable) {
                buttonSelect.value = template.buttonVariable;
            }
        }
    }
}

/**
 * Generate variable input fields - Table-like design
 */
function generateVariableInputs(count: number): void {
    const container = document.getElementById('templateVariablesContainer');
    if (!container) return;

    // Save existing values before clearing
    const existingValues: Record<string, string> = {};
    for (let i = 1; i <= 20; i++) {
        const existingSelect = document.getElementById(`var_${i}`) as HTMLSelectElement;
        if (existingSelect && existingSelect.value) {
            existingValues[String(i)] = existingSelect.value;
        }
    }

    // Clear existing
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    if (count === 0) return;

    // Create table container
    const table = document.createElement('div');
    table.style.cssText = 'border: 1px solid #E8E8E8; border-radius: 8px; overflow: hidden; margin-top: 15px;';

    // Create variable rows
    for (let i = 1; i <= count; i++) {
        const row = document.createElement('div');
        row.style.cssText = `display: flex; align-items: center; ${i < count ? 'border-bottom: 1px solid #E8E8E8;' : ''}`;

        // Left: Variable badge
        const badge = document.createElement('div');
        badge.style.cssText = 'width: 100px; padding: 16px 20px; background: #F5F5F0; font-family: monospace; font-size: 14px; color: #1A1A2E; flex-shrink: 0; border-right: 1px solid #E8E8E8;';
        badge.textContent = `{{${i}}}`;

        // Right: Dropdown
        const selectWrapper = document.createElement('div');
        selectWrapper.style.cssText = 'flex: 1; padding: 8px 12px;';

        const select = document.createElement('select');
        select.id = `var_${i}`;
        select.style.cssText = 'width: 100%; padding: 10px 12px; border: 1px solid #E8E8E8; border-radius: 4px; font-size: 14px; background: white; cursor: pointer;';

        // Add default empty option
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = 'Seçiniz...';
        select.appendChild(defaultOpt);

        // Add options from loaded messageVariables
        for (const [key, labelText] of Object.entries(messageVariables)) {
            const optionEl = document.createElement('option');
            optionEl.value = key;
            optionEl.textContent = labelText;
            // Restore previously selected value
            if (existingValues[String(i)] === key) {
                optionEl.selected = true;
            }
            select.appendChild(optionEl);
        }

        selectWrapper.appendChild(select);
        row.appendChild(badge);
        row.appendChild(selectWrapper);
        table.appendChild(row);
    }

    container.appendChild(table);

    // Refresh dirty state to capture new dynamic inputs
    if (templateModalDirtyState) {
        templateModalDirtyState.refresh();
    }
}

/**
 * Save template to backend
 */
async function saveTemplate(): Promise<void> {
    const saveBtn = document.getElementById('saveTemplateBtn') as HTMLButtonElement;

    const displayName = (document.getElementById('templateDisplayName') as HTMLInputElement).value.trim();
    const metaTemplateName = (document.getElementById('templateName') as HTMLInputElement).value.trim();
    const description = (document.getElementById('templateDescription') as HTMLInputElement).value.trim();
    const content = (document.getElementById('templateContent') as HTMLTextAreaElement).value.trim(); // v3.10.19
    const targetType = (document.getElementById('templateTargetType') as HTMLSelectElement).value;
    const language = (document.getElementById('templateLanguage') as HTMLSelectElement).value;
    const variableCount = parseInt((document.getElementById('templateVariableCount') as HTMLInputElement).value) || 0;
    const editId = (document.getElementById('templateEditId') as HTMLInputElement).value;

    // Validation
    if (!displayName) {
        getUI().showAlert('Template name is required', 'error');
        return;
    }
    if (!metaTemplateName) {
        getUI().showAlert('Meta template name is required', 'error');
        return;
    }

    // Collect variables
    const variables: Record<string, string> = {};
    for (let i = 1; i <= variableCount; i++) {
        const select = document.getElementById(`var_${i}`) as HTMLSelectElement;
        if (select && select.value) {
            variables[String(i)] = select.value;
        }
    }

    // Get button fields
    const hasButton = (document.getElementById('templateHasButton') as HTMLInputElement)?.checked || false;
    const buttonVariable = hasButton ? (document.getElementById('templateButtonVariable') as HTMLSelectElement)?.value || '' : '';

    // Build template data (v3.10.19: content eklendi, v3.10.22: button fields eklendi)
    const templateData: Partial<WhatsAppTemplate> = {
        name: displayName,
        metaTemplateName,
        description,
        content,
        targetType,
        language,
        variableCount,
        variables,
        hasButton,
        buttonVariable
    };

    // v3.10.20: Debug log - content gönderilip gönderilmediğini kontrol et
    console.log('[saveTemplate] content value:', content);
    console.log('[saveTemplate] content length:', content?.length);
    console.log('[saveTemplate] templateData:', JSON.stringify(templateData));

    // Add loading state
    if (saveBtn) {
        ButtonAnimator.start(saveBtn);
    }

    try {
        const action = editId ? 'updateWhatsAppTemplate' : 'createWhatsAppTemplate';
        const params = editId ? { id: editId, ...templateData } : templateData;

        const response = await ApiService.call(action, params) as ApiResponse;

        if (response.success) {
            if (saveBtn) {
                ButtonAnimator.success(saveBtn);
            }
            getUI().showAlert(editId ? 'Şablon güncellendi' : 'Şablon oluşturuldu', 'success');
            setTimeout(() => {
                closeModal('whatsappTemplateModal');
                loadTemplates();
            }, 1000);
        } else {
            throw new Error(response.error || 'Bilinmeyen hata');
        }
    } catch (error) {
        if (saveBtn) {
            ButtonAnimator.error(saveBtn);
        }
        logError(error, { action: 'saveTemplate' });
        getUI().showAlert('Kaydetme hatası: ' + (error as Error).message, 'error');
    }
}

/**
 * Edit template
 */
function editTemplate(templateId: string): void {
    openTemplateModal(templateId);
}

/**
 * Delete template
 */
async function deleteTemplate(templateId: string): Promise<void> {
    if (!confirm('Bu şablonu silmek istediğinizden emin misiniz?')) return;

    try {
        const response = await ApiService.call('deleteWhatsAppTemplate', { id: templateId }) as ApiResponse;

        if (response.success) {
            getUI().showAlert('Şablon silindi', 'success');
            await loadTemplates();
        } else {
            getUI().showAlert('Hata: ' + (response.error || 'Bilinmeyen hata'), 'error');
        }
    } catch (error) {
        logError(error, { action: 'deleteTemplate', templateId });
        getUI().showAlert('Silme hatası', 'error');
    }
}

// ==================== MESSAGE HISTORY ====================

/**
 * Load sent messages
 */
export async function loadSentMessages(): Promise<void> {
    const container = document.getElementById('sentMessagesList');
    showContainerLoading(container);

    try {
        const response = await ApiService.call('getWhatsAppMessages', { type: 'sent' }) as ApiResponse<WhatsAppMessage[]>;

        if (response.success && response.data) {
            renderMessages(container!, response.data, 'sent');
        } else {
            showContainerEmpty(container, 'Henüz mesaj yok');
        }
    } catch (error) {
        logError(error, { action: 'loadSentMessages' });
        showContainerEmpty(container, 'Henüz mesaj yok');
    }
}

/**
 * Load received messages
 */
export async function loadReceivedMessages(): Promise<void> {
    const container = document.getElementById('receivedMessagesList');
    showContainerLoading(container);

    try {
        const response = await ApiService.call('getWhatsAppMessages', { type: 'received' }) as ApiResponse<WhatsAppMessage[]>;

        if (response.success && response.data) {
            renderMessages(container!, response.data, 'received');
        } else {
            showContainerEmpty(container, 'Henüz mesaj yok');
        }
    } catch (error) {
        logError(error, { action: 'loadReceivedMessages' });
        showContainerEmpty(container, 'Henüz mesaj yok');
    }
}

/**
 * Render messages list
 */
function renderMessages(container: HTMLElement, messages: WhatsAppMessage[], _type: 'sent' | 'received'): void {
    clearContainer(container);

    if (messages.length === 0) {
        showContainerEmpty(container, 'Henüz mesaj yok');
        return;
    }

    messages.forEach(msg => {
        const item = document.createElement('div');
        item.style.cssText = 'padding: 12px; background: #FAFAFA; border: 1px solid #E8E8E8; border-radius: 4px; margin-bottom: 8px; font-size: 13px; cursor: pointer; transition: background 0.2s;';

        // Hover efekti
        item.addEventListener('mouseenter', () => { item.style.background = '#f0f0f0'; });
        item.addEventListener('mouseleave', () => { item.style.background = '#FAFAFA'; });

        const header = document.createElement('div');
        header.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';

        // Sol taraf: Telefon + Alıcı adı
        const leftSide = document.createElement('div');

        const phone = document.createElement('span');
        phone.style.fontWeight = '500';
        phone.textContent = String(msg.phone || '');
        leftSide.appendChild(phone);

        // Alıcı adı varsa göster
        if (msg.recipientName) {
            const recipientSpan = document.createElement('span');
            recipientSpan.style.cssText = 'margin-left: 8px; color: #757575; font-size: 12px;';
            recipientSpan.textContent = `(${msg.recipientName})`;
            leftSide.appendChild(recipientSpan);
        }

        const time = document.createElement('span');
        time.style.cssText = 'color: #757575; font-size: 11px;';
        const dateStr = msg.timestamp || msg.sentAt;
        time.textContent = dateStr ? new Date(dateStr).toLocaleString('tr-TR') : '';

        header.appendChild(leftSide);
        header.appendChild(time);

        const template = document.createElement('div');
        template.style.cssText = 'margin-top: 5px; color: #757575;';
        template.textContent = msg.templateName || '';

        const statusSpan = document.createElement('span');
        const statusColors: Record<string, string> = {
            'sent': '#1976D2',
            'delivered': '#388E3C',
            'read': '#2E7D32',
            'failed': '#C62828'
        };
        statusSpan.style.cssText = `margin-left: 10px; color: ${statusColors[msg.status] || '#757575'}; font-size: 11px; font-weight: 500;`;
        statusSpan.textContent = (msg.status || '').toUpperCase();
        template.appendChild(statusSpan);

        item.appendChild(header);
        item.appendChild(template);

        // v3.10.10: Mesaj içeriği göster
        if (msg.messageContent) {
            const content = document.createElement('div');
            content.style.cssText = 'margin-top: 8px; padding: 8px; background: #fff; border-radius: 4px; color: #333; font-size: 12px; border-left: 3px solid #C9A55A;';
            content.textContent = msg.messageContent;
            item.appendChild(content);
        }

        // v3.10.10: Hata mesajı göster (failed durumunda)
        const errorText = msg.errorMessage || msg.error;
        if (msg.status === 'failed' && errorText) {
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = 'margin-top: 5px; color: #C62828; font-size: 11px; background: #FFEBEE; padding: 6px 8px; border-radius: 4px;';
            errorDiv.textContent = `Hata: ${errorText}`;
            item.appendChild(errorDiv);
        }

        // Tıklama ile detay göster (expandable) - DOM API kullanarak güvenli
        item.addEventListener('click', () => {
            const existingDetail = item.querySelector('.message-detail');
            if (existingDetail) {
                existingDetail.remove();
                return;
            }

            const detail = document.createElement('div');
            detail.className = 'message-detail';
            detail.style.cssText = 'margin-top: 10px; padding: 10px; background: #fff; border: 1px solid #E8E8E8; border-radius: 4px; font-size: 11px; color: #555;';

            const msgRecord = msg as unknown as Record<string, string>;
            const fields = [
                { label: 'ID', value: msg.id || '-' },
                { label: 'Template ID', value: msgRecord.templateId || '-' },
                { label: 'Staff', value: msgRecord.staffName || '-' },
                { label: 'Profil', value: msgRecord.profile || '-' }
            ];

            fields.forEach((field, idx) => {
                const row = document.createElement('div');
                if (idx < fields.length - 1) row.style.marginBottom = '4px';
                const label = document.createElement('strong');
                label.textContent = field.label + ': ';
                row.appendChild(label);
                row.appendChild(document.createTextNode(field.value));
                detail.appendChild(row);
            });

            item.appendChild(detail);
        });

        container.appendChild(item);
    });
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Create a button element
 */
function createButton(text: string, className: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'btn ' + className;
    btn.textContent = text;
    btn.addEventListener('click', onClick);
    return btn;
}

/**
 * Clear container contents
 */
function clearContainer(container: HTMLElement | null): void {
    if (!container) return;
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
}

/**
 * Show loading state in container
 */
function showContainerLoading(container: HTMLElement | null): void {
    if (!container) return;
    clearContainer(container);
    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    container.appendChild(spinner);
}

/**
 * Show error message in container
 */
function showContainerError(container: HTMLElement | null, message: string): void {
    if (!container) return;
    clearContainer(container);
    const p = document.createElement('p');
    p.style.cssText = 'color: #C62828; font-size: 13px;';
    p.textContent = message;
    container.appendChild(p);
}

/**
 * Show empty state in container
 */
function showContainerEmpty(container: HTMLElement | null, message: string): void {
    if (!container) return;
    clearContainer(container);
    const p = document.createElement('p');
    p.style.cssText = 'color: #888; font-size: 13px;';
    p.textContent = message;
    container.appendChild(p);
}

/**
 * Close all modals
 */
function closeAllModals(): void {
    // Destroy dirty state
    if (templateModalDirtyState) {
        templateModalDirtyState.destroy();
        templateModalDirtyState = null;
    }

    document.querySelectorAll('.modal.active').forEach(modal => {
        modal.classList.remove('active');
    });
}
