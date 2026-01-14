/**
 * UNIFIED FLOW MANAGER - Birleşik Bildirim Akışları
 *
 * v3.9.75: WhatsApp ve Mail bildirimlerini tek bir flow ile yönetir
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

interface UnifiedFlow {
    id: string;
    name: string;
    description: string;
    trigger: string;
    profiles: string[];
    whatsappTemplateIds: string[];
    mailTemplateIds: string[];
    active: boolean;
}

interface WhatsAppTemplate {
    id: string;
    name: string;
    targetType: string;
}

interface MailTemplate {
    id: string;
    name: string;
    recipient: string;
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

let triggerLabels: Record<string, string> = {};
let recipientLabels: Record<string, string> = {};

// ==================== MODULE STATE ====================

let _dataStore: DataStore;
let unifiedFlows: UnifiedFlow[] = [];
let whatsappTemplates: WhatsAppTemplate[] = [];
let mailTemplates: MailTemplate[] = [];
let flowModalDirtyState: FormDirtyState | null = null;

declare const window: Window & {
    UI: { showAlert: (message: string, type: string) => void; };
};

const getUI = () => window.UI;

// ==================== INITIALIZATION ====================

export function initUnifiedFlowManager(dataStore: DataStore): void {
    _dataStore = dataStore;
    loadTriggers();
    loadRecipients();
    loadWhatsAppTemplates();
    loadMailTemplates();
    loadUnifiedFlows();
    setupEventListeners();
}

function setupEventListeners(): void {
    document.getElementById('addUnifiedFlowBtn')?.addEventListener('click', () => openFlowModal());
    document.getElementById('saveUnifiedFlowBtn')?.addEventListener('click', saveFlow);
    document.getElementById('cancelUnifiedFlowBtn')?.addEventListener('click', () => closeFlowModal());
    document.querySelector('#unifiedFlowModal .modal-overlay')?.addEventListener('click', () => closeFlowModal());
}

// ==================== DATA LOADING ====================

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

async function loadWhatsAppTemplates(): Promise<void> {
    try {
        const response = await ApiService.call('getWhatsAppTemplates', {}) as ApiResponse<WhatsAppTemplate[]>;
        if (response.success && response.data) {
            whatsappTemplates = response.data;
        }
    } catch (error) {
        logError(error, { action: 'loadWhatsAppTemplates' });
    }
}

async function loadMailTemplates(): Promise<void> {
    try {
        const response = await ApiService.call('getMailTemplates', {}) as ApiResponse<MailTemplate[]>;
        if (response.success && response.data) {
            mailTemplates = response.data;
        }
    } catch (error) {
        logError(error, { action: 'loadMailTemplates' });
    }
}

async function loadUnifiedFlows(): Promise<void> {
    try {
        const response = await ApiService.call('getUnifiedFlows', {}) as ApiResponse<UnifiedFlow[]>;
        if (response.success && response.data) {
            unifiedFlows = response.data;
            renderFlowList();
        }
    } catch (error) {
        logError(error, { action: 'loadUnifiedFlows' });
    }
}

// ==================== RENDERING ====================

function renderFlowList(): void {
    const container = document.getElementById('unifiedFlowList');
    if (!container) return;

    // Clear container safely
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    if (unifiedFlows.length === 0) {
        const emptyMsg = document.createElement('p');
        emptyMsg.style.cssText = 'color: #757575; text-align: center; padding: 20px;';
        emptyMsg.textContent = 'No flows defined yet';
        container.appendChild(emptyMsg);
        return;
    }

    unifiedFlows.forEach(flow => {
        container.appendChild(createFlowItem(flow));
    });
}

function createFlowItem(flow: UnifiedFlow): HTMLElement {
    const item = document.createElement('div');
    item.className = 'flow-item mail-list-item';
    item.style.cssText = 'padding: 15px; background: #FAFAFA; border: 1px solid #E8E8E8; border-radius: 4px; margin-bottom: 10px;';

    // Header
    const header = document.createElement('div');
    header.className = 'mail-item-header';

    const left = document.createElement('div');
    left.style.cssText = 'display: flex; align-items: center; gap: 8px;';

    const name = document.createElement('span');
    name.className = 'mail-item-name';
    name.textContent = flow.name;

    const activeBadge = document.createElement('span');
    activeBadge.style.cssText = `font-size: 10px; padding: 2px 6px; border-radius: 3px; background: ${flow.active ? '#4CAF50' : '#9E9E9E'}; color: white;`;
    activeBadge.textContent = flow.active ? 'Active' : 'Inactive';

    left.appendChild(name);
    left.appendChild(activeBadge);

    const right = document.createElement('div');
    right.className = 'mail-item-actions';

    const toggleBtn = createButton(flow.active ? 'Stop' : 'Start', 'btn-secondary btn-small', () => toggleFlow(flow.id));
    const editBtn = createButton('Edit', 'btn-secondary btn-small', () => openFlowModal(flow.id));
    const deleteBtn = createButton('Delete', 'btn-secondary btn-small', () => deleteFlow(flow.id));

    right.appendChild(toggleBtn);
    right.appendChild(editBtn);
    right.appendChild(deleteBtn);

    header.appendChild(left);
    header.appendChild(right);

    // Details
    const details = document.createElement('div');
    details.style.cssText = 'font-size: 12px; color: #757575; margin-top: 8px;';

    const triggerLabel = triggerLabels[flow.trigger] || flow.trigger;
    const triggerSpan = document.createElement('span');
    triggerSpan.textContent = `Trigger: ${triggerLabel}`;
    details.appendChild(triggerSpan);

    if (flow.profiles.length > 0) {
        const profileLabelsText = flow.profiles.map(p => PROFILE_LABELS[p] || p).join(', ');
        const sep = document.createElement('span');
        sep.textContent = ' • ';
        sep.style.color = '#ccc';
        details.appendChild(sep);

        const profileSpan = document.createElement('span');
        profileSpan.textContent = `Profiles: ${profileLabelsText}`;
        details.appendChild(profileSpan);
    }

    item.appendChild(header);
    item.appendChild(details);

    // Templates info - v3.9.13: Show template names instead of count, match styling with details line
    if (flow.whatsappTemplateIds.length > 0 || flow.mailTemplateIds.length > 0) {
        const templatesDiv = document.createElement('div');
        templatesDiv.style.cssText = 'font-size: 12px; color: #757575; margin-top: 4px;';

        // WhatsApp template names
        if (flow.whatsappTemplateIds.length > 0) {
            const waNames = flow.whatsappTemplateIds
                .map(id => whatsappTemplates.find(t => t.id === id)?.name || id)
                .join(', ');
            const waSpan = document.createElement('span');
            waSpan.textContent = `WhatsApp: ${waNames}`;
            templatesDiv.appendChild(waSpan);
        }

        // Separator if both exist
        if (flow.whatsappTemplateIds.length > 0 && flow.mailTemplateIds.length > 0) {
            const sep = document.createElement('span');
            sep.textContent = ' · ';
            sep.style.color = '#ccc';
            templatesDiv.appendChild(sep);
        }

        // Mail template names
        if (flow.mailTemplateIds.length > 0) {
            const mailNames = flow.mailTemplateIds
                .map(id => mailTemplates.find(t => t.id === id)?.name || id)
                .join(', ');
            const mailSpan = document.createElement('span');
            mailSpan.textContent = `Mail: ${mailNames}`;
            templatesDiv.appendChild(mailSpan);
        }

        item.appendChild(templatesDiv);
    }

    return item;
}

function createButton(text: string, className: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = `btn ${className}`;
    btn.textContent = text;
    btn.addEventListener('click', onClick);
    return btn;
}

// ==================== MODAL FUNCTIONS ====================

async function openFlowModal(flowId?: string): Promise<void> {
    const modal = document.getElementById('unifiedFlowModal');
    if (!modal) return;

    // Destroy previous dirty state if exists
    if (flowModalDirtyState) {
        flowModalDirtyState.destroy();
        flowModalDirtyState = null;
    }

    resetFlowForm();
    populateTriggerOptions();

    // Always refresh templates from API to get latest data
    await Promise.all([loadWhatsAppTemplates(), loadMailTemplates()]);

    populateWhatsAppTemplateOptions();
    populateMailTemplateOptions();

    const header = modal.querySelector('.modal-header');
    if (header) {
        header.textContent = flowId ? 'Edit Flow' : 'New Notification Flow';
    }

    if (flowId) {
        const flow = unifiedFlows.find(f => f.id === flowId);
        if (flow) populateFlowForm(flow);
        const editIdInput = document.getElementById('unifiedFlowEditId') as HTMLInputElement;
        if (editIdInput) editIdInput.value = flowId;
    }

    modal.classList.add('active');

    // Initialize FormDirtyState after modal is shown
    flowModalDirtyState = new FormDirtyState({
        container: '#unifiedFlowModal .modal-content',
        saveButton: '#saveUnifiedFlowBtn'
    });
}

/**
 * Close flow modal and cleanup dirty state
 */
function closeFlowModal(): void {
    // Destroy dirty state
    if (flowModalDirtyState) {
        flowModalDirtyState.destroy();
        flowModalDirtyState = null;
    }
    closeModal('unifiedFlowModal');
}

function resetFlowForm(): void {
    (document.getElementById('unifiedFlowName') as HTMLInputElement).value = '';
    (document.getElementById('unifiedFlowDescription') as HTMLInputElement).value = '';
    (document.getElementById('unifiedFlowEditId') as HTMLInputElement).value = '';

    document.querySelectorAll<HTMLInputElement>('input[name="unifiedFlowProfiles"]').forEach(cb => {
        cb.checked = false;
    });
}

function populateTriggerOptions(): void {
    const container = document.getElementById('unifiedFlowTriggerOptions');
    if (!container) return;

    while (container.firstChild) container.removeChild(container.firstChild);

    for (const [key, label] of Object.entries(triggerLabels)) {
        const labelEl = document.createElement('label');
        labelEl.className = 'radio-label';

        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'unifiedFlowTrigger';
        radio.value = key;

        labelEl.appendChild(radio);
        labelEl.appendChild(document.createTextNode(label.toLowerCase()));
        container.appendChild(labelEl);
    }
}

function populateWhatsAppTemplateOptions(): void {
    const container = document.getElementById('unifiedFlowWhatsAppTemplates');
    if (!container) return;

    while (container.firstChild) container.removeChild(container.firstChild);

    if (whatsappTemplates.length === 0) {
        const msg = document.createElement('p');
        msg.style.cssText = 'color: #888; font-size: 12px;';
        msg.textContent = 'No WhatsApp template';
        container.appendChild(msg);
        return;
    }

    whatsappTemplates.forEach(template => {
        const labelEl = document.createElement('label');
        labelEl.className = 'checkbox-label';
        labelEl.style.cssText = 'display: flex; align-items: center; gap: 6px; margin-bottom: 4px;';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = 'unifiedFlowWhatsAppTemplates';
        checkbox.value = template.id;

        labelEl.appendChild(checkbox);
        labelEl.appendChild(document.createTextNode(template.name));
        container.appendChild(labelEl);
    });
}

function populateMailTemplateOptions(): void {
    const container = document.getElementById('unifiedFlowMailTemplates');
    if (!container) return;

    while (container.firstChild) container.removeChild(container.firstChild);

    if (mailTemplates.length === 0) {
        const msg = document.createElement('p');
        msg.style.cssText = 'color: #888; font-size: 12px;';
        msg.textContent = 'No Mail template';
        container.appendChild(msg);
        return;
    }

    mailTemplates.forEach(template => {
        const labelEl = document.createElement('label');
        labelEl.className = 'checkbox-label';
        labelEl.style.cssText = 'display: flex; align-items: center; gap: 6px; margin-bottom: 4px;';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = 'unifiedFlowMailTemplates';
        checkbox.value = template.id;

        labelEl.appendChild(checkbox);
        labelEl.appendChild(document.createTextNode(template.name));
        container.appendChild(labelEl);
    });
}

function populateFlowForm(flow: UnifiedFlow): void {
    (document.getElementById('unifiedFlowName') as HTMLInputElement).value = flow.name;
    (document.getElementById('unifiedFlowDescription') as HTMLInputElement).value = flow.description || '';

    const triggerRadio = document.querySelector(`input[name="unifiedFlowTrigger"][value="${flow.trigger}"]`) as HTMLInputElement;
    if (triggerRadio) triggerRadio.checked = true;

    flow.profiles.forEach(profile => {
        const checkbox = document.querySelector(`input[name="unifiedFlowProfiles"][value="${profile}"]`) as HTMLInputElement;
        if (checkbox) checkbox.checked = true;
    });

    flow.whatsappTemplateIds.forEach(id => {
        const checkbox = document.querySelector(`input[name="unifiedFlowWhatsAppTemplates"][value="${id}"]`) as HTMLInputElement;
        if (checkbox) checkbox.checked = true;
    });

    flow.mailTemplateIds.forEach(id => {
        const checkbox = document.querySelector(`input[name="unifiedFlowMailTemplates"][value="${id}"]`) as HTMLInputElement;
        if (checkbox) checkbox.checked = true;
    });
}

// ==================== CRUD OPERATIONS ====================

async function saveFlow(): Promise<void> {
    const saveBtn = document.getElementById('saveUnifiedFlowBtn') as HTMLButtonElement;

    const name = (document.getElementById('unifiedFlowName') as HTMLInputElement).value.trim();
    const description = (document.getElementById('unifiedFlowDescription') as HTMLInputElement).value.trim();
    const editId = (document.getElementById('unifiedFlowEditId') as HTMLInputElement).value;

    const triggerRadio = document.querySelector('input[name="unifiedFlowTrigger"]:checked') as HTMLInputElement;
    const trigger = triggerRadio?.value || '';

    const profileCheckboxes = document.querySelectorAll<HTMLInputElement>('input[name="unifiedFlowProfiles"]:checked');
    const profiles = Array.from(profileCheckboxes).map(cb => cb.value);

    const waCheckboxes = document.querySelectorAll<HTMLInputElement>('input[name="unifiedFlowWhatsAppTemplates"]:checked');
    const whatsappTemplateIds = Array.from(waCheckboxes).map(cb => cb.value);

    const mailCheckboxes = document.querySelectorAll<HTMLInputElement>('input[name="unifiedFlowMailTemplates"]:checked');
    const mailTemplateIds = Array.from(mailCheckboxes).map(cb => cb.value);

    if (!name) { getUI().showAlert('Name is required', 'error'); return; }
    if (!trigger) { getUI().showAlert('Select a trigger', 'error'); return; }
    if (profiles.length === 0) { getUI().showAlert('Select at least one profile', 'error'); return; }
    if (whatsappTemplateIds.length === 0 && mailTemplateIds.length === 0) {
        getUI().showAlert('Select at least one template', 'error');
        return;
    }

    const flowData: Partial<UnifiedFlow> = { name, description, trigger, profiles, whatsappTemplateIds, mailTemplateIds };

    if (saveBtn) ButtonAnimator.start(saveBtn);

    try {
        const action = editId ? 'updateUnifiedFlow' : 'createUnifiedFlow';
        const params = editId ? { id: editId, ...flowData } : flowData;

        const response = await ApiService.call(action, params) as ApiResponse;

        if (response.success) {
            if (saveBtn) ButtonAnimator.success(saveBtn);
            getUI().showAlert(editId ? 'Flow updated' : 'Flow created', 'success');
            setTimeout(() => { closeFlowModal(); loadUnifiedFlows(); }, 1000);
        } else {
            throw new Error(response.error || 'Unknown error');
        }
    } catch (error) {
        if (saveBtn) ButtonAnimator.error(saveBtn);
        logError(error, { action: 'saveUnifiedFlow' });
        getUI().showAlert('Save error: ' + (error as Error).message, 'error');
    }
}

async function toggleFlow(flowId: string): Promise<void> {
    try {
        const flow = unifiedFlows.find(f => f.id === flowId);
        if (!flow) return;

        const response = await ApiService.call('updateUnifiedFlow', { id: flowId, active: !flow.active }) as ApiResponse;

        if (response.success) {
            getUI().showAlert(flow.active ? 'Flow stopped' : 'Flow started', 'success');
            loadUnifiedFlows();
        } else {
            throw new Error(response.error || 'Update error');
        }
    } catch (error) {
        logError(error, { action: 'toggleUnifiedFlow' });
        getUI().showAlert('Error: ' + (error as Error).message, 'error');
    }
}

async function deleteFlow(flowId: string): Promise<void> {
    if (!confirm('Are you sure you want to delete this flow?')) return;

    try {
        const response = await ApiService.call('deleteUnifiedFlow', { id: flowId }) as ApiResponse;

        if (response.success) {
            getUI().showAlert('Flow deleted', 'success');
            loadUnifiedFlows();
        } else {
            throw new Error(response.error || 'Delete error');
        }
    } catch (error) {
        logError(error, { action: 'deleteUnifiedFlow' });
        getUI().showAlert('Error: ' + (error as Error).message, 'error');
    }
}
