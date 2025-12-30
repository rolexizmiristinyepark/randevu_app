/**
 * MAIL MANAGER - Mail Flow ve Template Yönetimi
 *
 * FAZ 4: Mail entegrasyonu için admin panel modülü
 *
 * Sorumluluklar:
 * - Flow yönetimi (olay bazlı mail gönderimi)
 * - Template yönetimi (HTML şablonlar)
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

interface MailFlow {
    id: string;
    name: string;
    description: string;
    profiles: string[];
    triggers: string[]; // ['RANDEVU_OLUŞTUR', 'RANDEVU_İPTAL', etc.]
    templateId: string;
    active: boolean;
}

interface MailTemplate {
    id: string;
    name: string;
    subject: string;
    body: string; // HTML content
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

// ==================== MODULE STATE ====================

let _dataStore: DataStore;
let flows: MailFlow[] = [];
let templates: MailTemplate[] = [];
let messageVariables: Record<string, string> = {}; // { key: label }

// Global references (accessed via window)
declare const window: Window & {
    UI: {
        showAlert: (message: string, type: string) => void;
    };
};

const getUI = () => window.UI;

// ==================== INITIALIZATION ====================

/**
 * Initialize Mail Manager module
 */
export async function initMailManager(store: DataStore): Promise<void> {
    _dataStore = store;
    setupEventListeners();

    // Initial data load
    await Promise.all([
        loadFlows(),
        loadTemplates(),
        loadMessageVariables()
    ]);
}

/**
 * Setup all event listeners
 */
function setupEventListeners(): void {
    // Flow button
    document.getElementById('addMailFlowBtn')?.addEventListener('click', () => openFlowModal());

    // Template button
    document.getElementById('addMailTemplateBtn')?.addEventListener('click', () => openTemplateModal());

    // Flow Modal handlers
    document.getElementById('cancelMailFlowBtn')?.addEventListener('click', () => closeModal('mailFlowModal'));
    document.getElementById('saveMailFlowBtn')?.addEventListener('click', saveFlow);
    document.querySelector('#mailFlowModal .modal-overlay')?.addEventListener('click', () => closeModal('mailFlowModal'));

    // Template Modal handlers
    document.getElementById('cancelMailTemplateBtn')?.addEventListener('click', () => closeModal('mailTemplateModal'));
    document.getElementById('saveMailTemplateBtn')?.addEventListener('click', saveTemplate);
    document.querySelector('#mailTemplateModal .modal-overlay')?.addEventListener('click', () => closeModal('mailTemplateModal'));

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
    const container = document.getElementById('mailFlowList');
    showContainerLoading(container);

    try {
        const response = await ApiService.call('getMailFlows', {}) as ApiResponse<MailFlow[]>;

        if (response.success && response.data) {
            flows = response.data;
            renderFlows();
        } else {
            // No flows yet - show empty state
            showContainerEmpty(container, 'Henüz flow tanımlanmamış');
        }
    } catch (error) {
        logError(error, { action: 'loadMailFlows' });
        showContainerEmpty(container, 'Henüz flow tanımlanmamış');
    }
}

/**
 * Render flows in container
 */
function renderFlows(): void {
    const container = document.getElementById('mailFlowList');
    if (!container) return;

    clearContainer(container);

    if (flows.length === 0) {
        showContainerEmpty(container, 'Henüz flow tanımlanmamış');
        return;
    }

    flows.forEach(flow => {
        const item = createFlowItem(flow);
        container.appendChild(item);
    });
}

/**
 * Create a flow item element
 */
function createFlowItem(flow: MailFlow): HTMLElement {
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

    // Triggers
    const triggersText = flow.triggers.map(t => TRIGGER_LABELS[t] || t).join(', ');
    const triggerSpan = document.createElement('span');
    triggerSpan.textContent = '⚡ ' + triggersText;
    details.appendChild(triggerSpan);

    // Template
    const template = templates.find(t => t.id === flow.templateId);
    const templateSpan = document.createElement('span');
    templateSpan.textContent = '📨 ' + (template?.name || 'Şablon seçilmemiş');
    details.appendChild(templateSpan);

    item.appendChild(header);
    item.appendChild(details);

    return item;
}

/**
 * Open flow creation/edit modal
 */
function openFlowModal(flowId?: string): void {
    const modal = document.getElementById('mailFlowModal');
    if (!modal) return;

    // Reset form
    resetFlowForm();

    // Update modal header
    const header = modal.querySelector('.modal-header');
    if (header) {
        header.textContent = flowId ? 'Flow Düzenle' : 'Yeni Flow';
    }

    // If editing, populate form with existing data
    if (flowId) {
        const flow = flows.find(f => f.id === flowId);
        if (flow) {
            populateFlowForm(flow);
        }
        const editIdInput = document.getElementById('mailFlowEditId') as HTMLInputElement;
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
    (document.getElementById('mailFlowName') as HTMLInputElement).value = '';
    (document.getElementById('mailFlowDescription') as HTMLInputElement).value = '';
    (document.getElementById('mailFlowEditId') as HTMLInputElement).value = '';

    // Uncheck all trigger checkboxes
    document.querySelectorAll('input[name="mailFlowTriggers"]').forEach(cb => {
        (cb as HTMLInputElement).checked = false;
    });

    // Uncheck all profile checkboxes
    document.querySelectorAll('input[name="mailFlowProfiles"]').forEach(cb => {
        (cb as HTMLInputElement).checked = false;
    });

    // Clear template selection
    const templateSelect = document.getElementById('mailFlowTemplates') as HTMLSelectElement;
    if (templateSelect) {
        templateSelect.value = '';
    }
}

/**
 * Populate flow form with existing flow data
 */
function populateFlowForm(flow: MailFlow): void {
    (document.getElementById('mailFlowName') as HTMLInputElement).value = flow.name;
    (document.getElementById('mailFlowDescription') as HTMLInputElement).value = flow.description || '';
    (document.getElementById('mailFlowTemplates') as HTMLSelectElement).value = flow.templateId || '';

    // Check trigger checkboxes
    flow.triggers.forEach(trigger => {
        const checkbox = document.querySelector(`input[name="mailFlowTriggers"][value="${trigger}"]`) as HTMLInputElement;
        if (checkbox) checkbox.checked = true;
    });

    // Check profile checkboxes
    flow.profiles.forEach(profile => {
        const checkbox = document.querySelector(`input[name="mailFlowProfiles"][value="${profile}"]`) as HTMLInputElement;
        if (checkbox) checkbox.checked = true;
    });
}

/**
 * Populate template select with available templates
 */
function populateTemplateSelect(): void {
    const select = document.getElementById('mailFlowTemplates') as HTMLSelectElement;
    if (!select) return;

    // Clear existing options
    while (select.firstChild) {
        select.removeChild(select.firstChild);
    }

    // Add empty option
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = 'Şablon seçiniz...';
    select.appendChild(emptyOption);

    // Add template options
    templates.forEach(template => {
        const option = document.createElement('option');
        option.value = template.id;
        option.textContent = template.name;
        select.appendChild(option);
    });
}

/**
 * Save flow to backend
 */
async function saveFlow(): Promise<void> {
    const saveBtn = document.getElementById('saveMailFlowBtn') as HTMLButtonElement;

    const name = (document.getElementById('mailFlowName') as HTMLInputElement).value.trim();
    const description = (document.getElementById('mailFlowDescription') as HTMLInputElement).value.trim();
    const templateId = (document.getElementById('mailFlowTemplates') as HTMLSelectElement).value;
    const editId = (document.getElementById('mailFlowEditId') as HTMLInputElement).value;

    // Validation
    if (!name) {
        getUI().showAlert('Flow adı gereklidir', 'error');
        return;
    }

    // Get selected triggers
    const triggers: string[] = [];
    document.querySelectorAll('input[name="mailFlowTriggers"]:checked').forEach(cb => {
        triggers.push((cb as HTMLInputElement).value);
    });

    if (triggers.length === 0) {
        getUI().showAlert('En az bir tetikleyici seçmelisiniz', 'error');
        return;
    }

    // Get selected profiles
    const profiles: string[] = [];
    document.querySelectorAll('input[name="mailFlowProfiles"]:checked').forEach(cb => {
        profiles.push((cb as HTMLInputElement).value);
    });

    if (profiles.length === 0) {
        getUI().showAlert('En az bir profil seçmelisiniz', 'error');
        return;
    }

    if (!templateId) {
        getUI().showAlert('Bir şablon seçmelisiniz', 'error');
        return;
    }

    // Build flow data
    const flowData: Partial<MailFlow> = {
        name,
        description,
        triggers,
        profiles,
        templateId,
        active: true
    };

    // Add loading state
    if (saveBtn) {
        ButtonAnimator.start(saveBtn);
    }

    try {
        const action = editId ? 'updateMailFlow' : 'createMailFlow';
        const params = editId ? { id: editId, ...flowData } : flowData;

        const response = await ApiService.call(action, params) as ApiResponse;

        if (response.success) {
            if (saveBtn) {
                ButtonAnimator.success(saveBtn);
            }
            getUI().showAlert(editId ? 'Flow güncellendi' : 'Flow oluşturuldu', 'success');
            setTimeout(() => {
                closeModal('mailFlowModal');
                loadFlows();
            }, 1000);
        } else {
            throw new Error(response.error || 'Bilinmeyen hata');
        }
    } catch (error) {
        if (saveBtn) {
            ButtonAnimator.error(saveBtn);
        }
        logError(error, { action: 'saveMailFlow' });
        getUI().showAlert('Kaydetme hatası: ' + (error as Error).message, 'error');
    }
}

/**
 * Edit existing flow
 */
function editFlow(flowId: string): void {
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
        const response = await ApiService.call('updateMailFlow', {
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
        logError(error, { action: 'toggleMailFlow', flowId });
        getUI().showAlert('Güncelleme hatası', 'error');
    }
}

/**
 * Delete a flow
 */
async function deleteFlow(flowId: string): Promise<void> {
    if (!confirm('Bu flow\'u silmek istediğinizden emin misiniz?')) return;

    try {
        const response = await ApiService.call('deleteMailFlow', { id: flowId }) as ApiResponse;

        if (response.success) {
            getUI().showAlert('Flow silindi', 'success');
            await loadFlows();
        } else {
            getUI().showAlert('Hata: ' + (response.error || 'Bilinmeyen hata'), 'error');
        }
    } catch (error) {
        logError(error, { action: 'deleteMailFlow', flowId });
        getUI().showAlert('Silme hatası', 'error');
    }
}

// ==================== TEMPLATE MANAGEMENT ====================

/**
 * Load all templates from backend
 */
async function loadTemplates(): Promise<void> {
    const container = document.getElementById('mailTemplatesList');
    showContainerLoading(container);

    try {
        const response = await ApiService.call('getMailTemplates', {}) as ApiResponse<MailTemplate[]>;

        if (response.success && response.data) {
            templates = response.data;
            renderTemplates();
        } else {
            // No templates yet - show empty state
            showContainerEmpty(container, 'Henüz şablon tanımlanmamış');
        }
    } catch (error) {
        logError(error, { action: 'loadMailTemplates' });
        showContainerEmpty(container, 'Henüz şablon tanımlanmamış');
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
            populateMailVariablesContainer();
        }
    } catch (error) {
        logError(error, { action: 'loadMessageVariables' });
    }
}

/**
 * Populate the mail variables container with clickable variable buttons
 */
function populateMailVariablesContainer(): void {
    const container = document.getElementById('mailVariablesContainer');
    if (!container) return;

    // Clear existing children safely
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    for (const [key, label] of Object.entries(messageVariables)) {
        const code = document.createElement('code');
        code.style.cssText = 'padding: 4px 8px; background: #F5F5F0; border-radius: 4px; font-size: 12px; cursor: pointer; display: inline-block;';
        code.setAttribute('data-var', `{{${key}}}`);
        code.setAttribute('title', label);
        code.textContent = `{{${key}}}`;

        // Click to copy
        code.addEventListener('click', () => {
            const varText = `{{${key}}}`;
            navigator.clipboard.writeText(varText).then(() => {
                getUI().showAlert(`${varText} kopyalandı`, 'success');
            }).catch(() => {
                // Fallback for older browsers
                const textarea = document.createElement('textarea');
                textarea.value = varText;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                getUI().showAlert(`${varText} kopyalandı`, 'success');
            });
        });

        container.appendChild(code);
    }
}

/**
 * Render templates list
 */
function renderTemplates(): void {
    const container = document.getElementById('mailTemplatesList');
    if (!container) return;

    clearContainer(container);

    if (templates.length === 0) {
        showContainerEmpty(container, 'Henüz şablon tanımlanmamış');
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
function createTemplateItem(template: MailTemplate): HTMLElement {
    const item = document.createElement('div');
    item.className = 'template-item';
    item.style.cssText = 'padding: 15px; background: #FAFAFA; border: 1px solid #E8E8E8; border-radius: 4px; margin-bottom: 10px;';

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;';

    // Left: Name
    const name = document.createElement('strong');
    name.style.color = '#1A1A2E';
    name.textContent = template.name;

    // Right: Actions
    const right = document.createElement('div');
    right.style.cssText = 'display: flex; gap: 8px;';

    const editBtn = createButton('Düzenle', 'btn-secondary btn-small', () => editTemplate(template.id));
    const deleteBtn = createButton('Sil', 'btn-secondary btn-small', () => deleteTemplate(template.id));
    deleteBtn.style.color = '#C62828';

    right.appendChild(editBtn);
    right.appendChild(deleteBtn);

    header.appendChild(name);
    header.appendChild(right);

    // Details - Subject
    const details = document.createElement('div');
    details.style.cssText = 'font-size: 12px; color: #757575;';
    details.textContent = '📧 Konu: ' + template.subject;

    item.appendChild(header);
    item.appendChild(details);

    return item;
}

/**
 * Open template modal
 */
function openTemplateModal(templateId?: string): void {
    const modal = document.getElementById('mailTemplateModal');
    if (!modal) return;

    // Reset form
    resetTemplateForm();

    // Update modal header
    const header = modal.querySelector('.modal-header');
    if (header) {
        header.textContent = templateId ? 'Şablon Düzenle' : 'Yeni Şablon';
    }

    // If editing, populate form with existing data
    if (templateId) {
        const template = templates.find(t => t.id === templateId);
        if (template) {
            populateTemplateForm(template);
        }
        const editIdInput = document.getElementById('mailTemplateEditId') as HTMLInputElement;
        if (editIdInput) editIdInput.value = templateId;
    }

    // Show modal
    modal.classList.add('active');
}

/**
 * Reset template form to defaults
 */
function resetTemplateForm(): void {
    (document.getElementById('mailTemplateName') as HTMLInputElement).value = '';
    (document.getElementById('mailTemplateSubject') as HTMLInputElement).value = '';
    (document.getElementById('mailTemplateBody') as HTMLTextAreaElement).value = '';
    (document.getElementById('mailTemplateEditId') as HTMLInputElement).value = '';
}

/**
 * Populate template form with existing data
 */
function populateTemplateForm(template: MailTemplate): void {
    (document.getElementById('mailTemplateName') as HTMLInputElement).value = template.name;
    (document.getElementById('mailTemplateSubject') as HTMLInputElement).value = template.subject;
    (document.getElementById('mailTemplateBody') as HTMLTextAreaElement).value = template.body;
}

/**
 * Save template to backend
 */
async function saveTemplate(): Promise<void> {
    const saveBtn = document.getElementById('saveMailTemplateBtn') as HTMLButtonElement;

    const name = (document.getElementById('mailTemplateName') as HTMLInputElement).value.trim();
    const subject = (document.getElementById('mailTemplateSubject') as HTMLInputElement).value.trim();
    const body = (document.getElementById('mailTemplateBody') as HTMLTextAreaElement).value.trim();
    const editId = (document.getElementById('mailTemplateEditId') as HTMLInputElement).value;

    // Validation
    if (!name) {
        getUI().showAlert('Şablon adı gereklidir', 'error');
        return;
    }

    if (!subject) {
        getUI().showAlert('Konu gereklidir', 'error');
        return;
    }

    if (!body) {
        getUI().showAlert('İçerik gereklidir', 'error');
        return;
    }

    // Build template data
    const templateData: Partial<MailTemplate> = {
        name,
        subject,
        body
    };

    // Add loading state
    if (saveBtn) {
        ButtonAnimator.start(saveBtn);
    }

    try {
        const action = editId ? 'updateMailTemplate' : 'createMailTemplate';
        const params = editId ? { id: editId, ...templateData } : templateData;

        const response = await ApiService.call(action, params) as ApiResponse;

        if (response.success) {
            if (saveBtn) {
                ButtonAnimator.success(saveBtn);
            }
            getUI().showAlert(editId ? 'Şablon güncellendi' : 'Şablon oluşturuldu', 'success');
            setTimeout(() => {
                closeModal('mailTemplateModal');
                loadTemplates();
            }, 1000);
        } else {
            throw new Error(response.error || 'Bilinmeyen hata');
        }
    } catch (error) {
        if (saveBtn) {
            ButtonAnimator.error(saveBtn);
        }
        logError(error, { action: 'saveMailTemplate' });
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
        const response = await ApiService.call('deleteMailTemplate', { id: templateId }) as ApiResponse;

        if (response.success) {
            getUI().showAlert('Şablon silindi', 'success');
            await loadTemplates();
        } else {
            getUI().showAlert('Hata: ' + (response.error || 'Bilinmeyen hata'), 'error');
        }
    } catch (error) {
        logError(error, { action: 'deleteMailTemplate', templateId });
        getUI().showAlert('Silme hatası', 'error');
    }
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
 * Show empty state in container
 */
function showContainerEmpty(container: HTMLElement | null, message: string): void {
    if (!container) return;
    clearContainer(container);
    const p = document.createElement('p');
    p.style.cssText = 'color: #757575; text-align: center; padding: 20px;';
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
