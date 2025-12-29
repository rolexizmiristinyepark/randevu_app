/**
 * WHATSAPP MANAGER - WhatsApp Flow ve Template Yönetimi
 *
 * FAZ 4: WhatsApp entegrasyonu için admin panel modülü
 *
 * Sorumluluklar:
 * - Flow yönetimi (zaman bazlı + olay bazlı)
 * - Template yönetimi
 * - Mesaj geçmişi görüntüleme
 */

import { ApiService } from '../api-service';
import { logError } from '../monitoring';
import { closeModal } from '../ui-utils';
import { ButtonAnimator } from '../button-utils';
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
    name: string;
    description: string;
    variableCount: number;
    variables: Record<string, string>;
    targetType: 'customer' | 'staff';
    language: string;
}

interface WhatsAppMessage {
    id: string;
    phone: string;
    templateName: string;
    status: 'sent' | 'delivered' | 'read' | 'failed';
    sentAt: string;
    error?: string;
}

// ==================== CONSTANTS ====================

const PROFILE_LABELS: Record<string, string> = {
    'g': 'Genel',
    'w': 'Walk-in',
    'b': 'Butik',
    'm': 'Yönetim',
    's': 'Bireysel',
    'v': 'Özel Müşteri'
};

const TRIGGER_LABELS: Record<string, string> = {
    'RANDEVU_OLUŞTUR': 'Randevu Oluşturuldu',
    'RANDEVU_İPTAL': 'Randevu İptal Edildi',
    'RANDEVU_GÜNCELLE': 'Randevu Güncellendi',
    'HATIRLATMA': 'Hatırlatma',
    'PERSONEL_ATAMA': 'Personel Atandı'
};

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

// Global references (accessed via window)
declare const window: Window & {
    UI: {
        showAlert: (message: string, type: string) => void;
    };
};

const getUI = () => window.UI;

// ==================== HELPER FUNCTIONS ====================

/**
 * Copy variable to clipboard with visual feedback
 */
function copyVariableToClipboard(varName: string, element: HTMLElement): void {
    const variableText = `{{${varName}}}`;

    navigator.clipboard.writeText(variableText).then(() => {
        // Visual feedback
        element.classList.add('copied');
        const originalText = element.textContent;
        element.textContent = '✓ Kopyalandı';

        setTimeout(() => {
            element.classList.remove('copied');
            element.textContent = originalText;
        }, 1500);
    }).catch(() => {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = variableText;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);

        // Visual feedback
        element.classList.add('copied');
        const originalText = element.textContent;
        element.textContent = '✓ Kopyalandı';

        setTimeout(() => {
            element.classList.remove('copied');
            element.textContent = originalText;
        }, 1500);
    });
}

// ==================== INITIALIZATION ====================

/**
 * Initialize WhatsApp Manager module
 */
export async function initWhatsAppManager(store: DataStore): Promise<void> {
    _dataStore = store;
    setupEventListeners();

    // Initial data load
    await Promise.all([
        loadFlows(),
        loadTemplates()
    ]);
}

/**
 * Setup all event listeners
 */
function setupEventListeners(): void {
    // Flow buttons
    document.getElementById('addTimeBasedFlowBtn')?.addEventListener('click', () => openFlowModal('time'));
    document.getElementById('addEventBasedFlowBtn')?.addEventListener('click', () => openFlowModal('event'));

    // Template buttons
    document.getElementById('addTemplateBtn')?.addEventListener('click', () => openTemplateModal());

    // Flow Modal handlers
    document.getElementById('cancelFlowBtn')?.addEventListener('click', () => closeModal('whatsappFlowModal'));
    document.getElementById('saveFlowBtn')?.addEventListener('click', saveFlow);
    document.querySelector('#whatsappFlowModal .modal-overlay')?.addEventListener('click', () => closeModal('whatsappFlowModal'));

    // Template Modal handlers
    document.getElementById('cancelTemplateBtn')?.addEventListener('click', () => closeModal('whatsappTemplateModal'));
    document.getElementById('saveTemplateBtn')?.addEventListener('click', saveTemplate);
    document.querySelector('#whatsappTemplateModal .modal-overlay')?.addEventListener('click', () => closeModal('whatsappTemplateModal'));

    // Trigger type change - show/hide time vs event options
    document.getElementById('flowTriggerType')?.addEventListener('change', (e) => {
        const value = (e.target as HTMLSelectElement).value;
        const timeOptions = document.getElementById('timeBasedOptions');
        const eventOptions = document.getElementById('eventBasedOptions');
        if (timeOptions) timeOptions.style.display = value === 'time' ? 'block' : 'none';
        if (eventOptions) eventOptions.style.display = value === 'event' ? 'block' : 'none';
    });

    // Template variable count change - generate variable inputs
    document.getElementById('templateVariableCount')?.addEventListener('change', (e) => {
        const count = parseInt((e.target as HTMLInputElement).value) || 0;
        generateVariableInputs(count);
    });

    // Variable reference panel toggle
    document.getElementById('toggleVarRefBtn')?.addEventListener('click', () => {
        const content = document.getElementById('variableReferenceContent');
        const toggle = document.getElementById('variableRefToggle');
        if (content && toggle) {
            const isHidden = content.style.display === 'none';
            content.style.display = isHidden ? 'block' : 'none';
            toggle.textContent = isHidden ? '▲ Gizle' : '▼ Göster';
        }
    });

    // Variable tag click - copy to clipboard
    document.querySelectorAll('.var-tag').forEach(tag => {
        tag.addEventListener('click', (e) => {
            const varName = (e.target as HTMLElement).dataset.var;
            if (varName) {
                copyVariableToClipboard(varName, e.target as HTMLElement);
            }
        });
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
    const timeBasedContainer = document.getElementById('timeBasedFlowList');
    const eventBasedContainer = document.getElementById('eventBasedFlowList');

    showContainerLoading(timeBasedContainer);
    showContainerLoading(eventBasedContainer);

    try {
        const response = await ApiService.call('getWhatsAppFlows', {}) as ApiResponse<WhatsAppFlow[]>;

        if (response.success && response.data) {
            flows = response.data;
            renderFlows();
        } else {
            showContainerError(timeBasedContainer, response.error || 'Yüklenemedi');
            showContainerError(eventBasedContainer, response.error || 'Yüklenemedi');
        }
    } catch (error) {
        logError(error, { action: 'loadFlows' });
        showContainerError(timeBasedContainer, 'Bağlantı hatası');
        showContainerError(eventBasedContainer, 'Bağlantı hatası');
    }
}

/**
 * Render flows in their respective containers
 */
function renderFlows(): void {
    const timeBasedFlows = flows.filter(f => f.triggerType === 'time' || f.trigger === 'HATIRLATMA');
    const eventBasedFlows = flows.filter(f => f.triggerType === 'event' && f.trigger !== 'HATIRLATMA');

    renderFlowList('timeBasedFlowList', timeBasedFlows, 'time');
    renderFlowList('eventBasedFlowList', eventBasedFlows, 'event');
}

/**
 * Render a list of flows
 */
function renderFlowList(containerId: string, flowList: WhatsAppFlow[], type: 'time' | 'event'): void {
    const container = document.getElementById(containerId);
    if (!container) return;

    clearContainer(container);

    if (flowList.length === 0) {
        const emptyMsg = type === 'time'
            ? 'Henüz zaman bazlı flow eklenmemiş'
            : 'Henüz olay bazlı flow eklenmemiş';
        showContainerEmpty(container, emptyMsg);
        return;
    }

    flowList.forEach(flow => {
        const item = createFlowItem(flow, type);
        container.appendChild(item);
    });
}

/**
 * Create a flow item element
 */
function createFlowItem(flow: WhatsAppFlow, type: 'time' | 'event'): HTMLElement {
    const item = document.createElement('div');
    item.className = 'flow-item';
    item.style.cssText = 'padding: 15px; background: #FAFAFA; border: 1px solid #E8E8E8; border-radius: 4px; margin-bottom: 10px;';

    // Header row
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;';

    // Left: Name + Status
    const left = document.createElement('div');
    left.style.cssText = 'display: flex; align-items: center; gap: 10px;';

    const name = document.createElement('strong');
    name.style.color = '#1A1A2E';
    name.textContent = flow.name;

    const status = document.createElement('span');
    status.style.cssText = `padding: 2px 8px; border-radius: 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; ${flow.active ? 'background: #E8F5E9; color: #2E7D32;' : 'background: #FFEBEE; color: #C62828;'}`;
    status.textContent = flow.active ? 'Aktif' : 'Pasif';

    left.appendChild(name);
    left.appendChild(status);

    // Right: Actions
    const right = document.createElement('div');
    right.style.cssText = 'display: flex; gap: 8px;';

    const editBtn = createButton('Düzenle', 'btn-secondary btn-small', () => editFlow(flow.id));
    const toggleBtn = createButton(flow.active ? 'Durdur' : 'Başlat', 'btn-secondary btn-small', () => toggleFlow(flow.id));
    const deleteBtn = createButton('Sil', 'btn-secondary btn-small', () => deleteFlow(flow.id));
    deleteBtn.style.color = '#C62828';

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
    profilesSpan.textContent = '📋 ' + profilesText;
    details.appendChild(profilesSpan);

    // Trigger
    const triggerSpan = document.createElement('span');
    if (type === 'time') {
        const zamanLabel = HATIRLATMA_ZAMAN_LABELS[flow.hatirlatmaZaman || ''] || flow.hatirlatmaZaman;
        triggerSpan.textContent = '⏰ ' + (flow.hatirlatmaSaat || '') + ' - ' + zamanLabel;
    } else {
        triggerSpan.textContent = '⚡ ' + (TRIGGER_LABELS[flow.trigger] || flow.trigger);
    }
    details.appendChild(triggerSpan);

    // Template count
    const templateSpan = document.createElement('span');
    templateSpan.textContent = '📨 ' + flow.templateIds.length + ' şablon';
    details.appendChild(templateSpan);

    item.appendChild(header);
    item.appendChild(details);

    return item;
}

/**
 * Open flow creation/edit modal
 */
function openFlowModal(type: 'time' | 'event', flowId?: string): void {
    const modal = document.getElementById('whatsappFlowModal');
    if (!modal) return;

    // Reset form
    resetFlowForm();

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
        header.textContent = flowId ? 'Flow Düzenle' : `Yeni ${type === 'time' ? 'Zaman Bazlı' : 'Olay Bazlı'} Flow`;
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
        option.textContent = `${template.name} (${template.targetType === 'customer' ? 'Müşteri' : 'Personel'})`;
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
        const action = editId ? 'updateWhatsAppFlow' : 'createWhatsAppFlow';
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

    openFlowModal(flow.triggerType === 'time' ? 'time' : 'event', flowId);
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
 * Create a template item element
 */
function createTemplateItem(template: WhatsAppTemplate): HTMLElement {
    const item = document.createElement('div');
    item.className = 'template-item';
    item.style.cssText = 'padding: 15px; background: #FAFAFA; border: 1px solid #E8E8E8; border-radius: 4px; margin-bottom: 10px;';

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;';

    // Left: Name + Target type badge
    const left = document.createElement('div');
    left.style.cssText = 'display: flex; align-items: center; gap: 10px;';

    const name = document.createElement('strong');
    name.style.color = '#1A1A2E';
    name.textContent = template.name;

    const targetBadge = document.createElement('span');
    targetBadge.style.cssText = 'padding: 2px 8px; border-radius: 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; background: #E3F2FD; color: #1976D2;';
    targetBadge.textContent = template.targetType === 'customer' ? 'Müşteri' : 'Personel';

    left.appendChild(name);
    left.appendChild(targetBadge);

    // Right: Actions
    const right = document.createElement('div');
    right.style.cssText = 'display: flex; gap: 8px;';

    const editBtn = createButton('Düzenle', 'btn-secondary btn-small', () => editTemplate(template.id));
    const deleteBtn = createButton('Sil', 'btn-secondary btn-small', () => deleteTemplate(template.id));
    deleteBtn.style.color = '#C62828';

    right.appendChild(editBtn);
    right.appendChild(deleteBtn);

    header.appendChild(left);
    header.appendChild(right);

    // Details
    const details = document.createElement('div');
    details.style.cssText = 'font-size: 12px; color: #757575;';

    let detailsText = template.description || '';
    if (detailsText) detailsText += ' • ';
    detailsText += template.variableCount + ' değişken';
    detailsText += ' • Dil: ' + (template.language || 'tr').toUpperCase();

    details.textContent = detailsText;

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

    // Reset form
    resetTemplateForm();

    // Update modal header
    const header = modal.querySelector('.modal-header');
    if (header) {
        header.textContent = templateId ? 'Şablon Düzenle' : 'WhatsApp Şablonu Ekle';
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
}

/**
 * Reset template form to defaults
 */
function resetTemplateForm(): void {
    (document.getElementById('templateName') as HTMLInputElement).value = '';
    (document.getElementById('templateDescription') as HTMLInputElement).value = '';
    (document.getElementById('templateTargetType') as HTMLSelectElement).value = 'customer';
    (document.getElementById('templateLanguage') as HTMLSelectElement).value = 'tr';
    (document.getElementById('templateVariableCount') as HTMLInputElement).value = '0';
    (document.getElementById('templateEditId') as HTMLInputElement).value = '';

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
    (document.getElementById('templateName') as HTMLInputElement).value = template.name;
    (document.getElementById('templateDescription') as HTMLInputElement).value = template.description || '';
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
}

/**
 * Generate variable input fields
 */
function generateVariableInputs(count: number): void {
    const container = document.getElementById('templateVariablesContainer');
    if (!container) return;

    // Clear existing
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    if (count === 0) return;

    // Create header
    const header = document.createElement('label');
    header.style.cssText = 'display: block; margin-top: 15px; margin-bottom: 10px; font-weight: 500;';
    header.textContent = 'Değişken Tanımları';
    container.appendChild(header);

    // Create variable inputs
    for (let i = 1; i <= count; i++) {
        const inputGroup = document.createElement('div');
        inputGroup.className = 'input-group';
        inputGroup.style.marginBottom = '10px';

        const label = document.createElement('label');
        label.setAttribute('for', `var_${i}`);
        label.textContent = `{{${i}}} değişkeni`;

        const select = document.createElement('select');
        select.id = `var_${i}`;
        select.style.width = '100%';

        // Add options for common variables
        const options = [
            { value: '', label: 'Seçiniz...' },
            { value: 'ISIM', label: 'Müşteri Adı' },
            { value: 'SOYISIM', label: 'Müşteri Soyadı' },
            { value: 'TARIH', label: 'Randevu Tarihi' },
            { value: 'SAAT', label: 'Randevu Saati' },
            { value: 'TELEFON', label: 'Telefon' },
            { value: 'PERSONEL', label: 'Personel Adı' },
            { value: 'MAGAZA', label: 'Mağaza Adı' }
        ];

        options.forEach(opt => {
            const optionEl = document.createElement('option');
            optionEl.value = opt.value;
            optionEl.textContent = opt.label;
            select.appendChild(optionEl);
        });

        inputGroup.appendChild(label);
        inputGroup.appendChild(select);
        container.appendChild(inputGroup);
    }
}

/**
 * Save template to backend
 */
async function saveTemplate(): Promise<void> {
    const saveBtn = document.getElementById('saveTemplateBtn') as HTMLButtonElement;

    const name = (document.getElementById('templateName') as HTMLInputElement).value.trim();
    const description = (document.getElementById('templateDescription') as HTMLInputElement).value.trim();
    const targetType = (document.getElementById('templateTargetType') as HTMLSelectElement).value as 'customer' | 'staff';
    const language = (document.getElementById('templateLanguage') as HTMLSelectElement).value;
    const variableCount = parseInt((document.getElementById('templateVariableCount') as HTMLInputElement).value) || 0;
    const editId = (document.getElementById('templateEditId') as HTMLInputElement).value;

    // Validation
    if (!name) {
        getUI().showAlert('Şablon adı gereklidir', 'error');
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

    // Build template data
    const templateData: Partial<WhatsAppTemplate> = {
        name,
        description,
        targetType,
        language,
        variableCount,
        variables
    };

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
        item.style.cssText = 'padding: 12px; background: #FAFAFA; border: 1px solid #E8E8E8; border-radius: 4px; margin-bottom: 8px; font-size: 13px;';

        const header = document.createElement('div');
        header.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';

        const phone = document.createElement('span');
        phone.style.fontWeight = '500';
        phone.textContent = msg.phone;

        const time = document.createElement('span');
        time.style.cssText = 'color: #757575; font-size: 11px;';
        time.textContent = new Date(msg.sentAt).toLocaleString('tr-TR');

        header.appendChild(phone);
        header.appendChild(time);

        const template = document.createElement('div');
        template.style.cssText = 'margin-top: 5px; color: #757575;';
        template.textContent = msg.templateName;

        const statusSpan = document.createElement('span');
        const statusColors: Record<string, string> = {
            'sent': '#1976D2',
            'delivered': '#388E3C',
            'read': '#2E7D32',
            'failed': '#C62828'
        };
        statusSpan.style.cssText = `margin-left: 10px; color: ${statusColors[msg.status] || '#757575'}; font-size: 11px;`;
        statusSpan.textContent = msg.status.toUpperCase();
        template.appendChild(statusSpan);

        item.appendChild(header);
        item.appendChild(template);
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
    document.querySelectorAll('.modal.active').forEach(modal => {
        modal.classList.remove('active');
    });
}
