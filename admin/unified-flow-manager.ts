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
    scheduleHour?: string; // For time-based flows: hour in TR time (08-18)
}

interface WhatsAppTemplate {
    id: string;
    name: string;              // User-friendly display name
    metaTemplateName?: string; // Meta Business API template name
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

export async function initUnifiedFlowManager(dataStore: DataStore): Promise<void> {
    _dataStore = dataStore;

    // Load templates first (in parallel) - needed for name lookup in flow list
    await Promise.all([
        loadTriggers(),
        loadRecipients(),
        loadWhatsAppTemplates(),
        loadMailTemplates()
    ]);

    // Now load flows (templates are ready for name lookup)
    await loadUnifiedFlows();

    setupEventListeners();
}

function setupEventListeners(): void {
    document.getElementById('addUnifiedFlowBtn')?.addEventListener('click', () => openFlowModal());
    document.getElementById('saveUnifiedFlowBtn')?.addEventListener('click', saveFlow);
    document.getElementById('cancelUnifiedFlowBtn')?.addEventListener('click', () => closeFlowModal());
    document.querySelector('#unifiedFlowModal .modal-overlay')?.addEventListener('click', () => closeFlowModal());

    // Flow type toggle (Event Based / Time Based)
    document.querySelectorAll<HTMLInputElement>('input[name="unifiedFlowType"]').forEach(radio => {
        radio.addEventListener('change', toggleFlowType);
    });
}

/**
 * Toggle between Event Based and Time Based flow type
 */
function toggleFlowType(): void {
    const flowType = (document.querySelector('input[name="unifiedFlowType"]:checked') as HTMLInputElement)?.value;
    const triggerSection = document.getElementById('triggerSection');
    const timeBasedInfo = document.getElementById('timeBasedInfo');

    if (flowType === 'event') {
        if (triggerSection) triggerSection.style.display = 'block';
        if (timeBasedInfo) timeBasedInfo.style.display = 'none';
    } else {
        if (triggerSection) triggerSection.style.display = 'none';
        if (timeBasedInfo) timeBasedInfo.style.display = 'block';
    }
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

/**
 * Exported for other managers to refresh cache after template changes
 */
export async function refreshWhatsAppTemplatesCache(): Promise<void> {
    await loadWhatsAppTemplates();
}

export async function refreshMailTemplatesCache(): Promise<void> {
    await loadMailTemplates();
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

    // v3.10.15: Inactive/Active instead of Stop/Start
    const toggleBtn = createButton(flow.active ? 'Inactive' : 'Active', 'btn-secondary btn-small', () => toggleFlow(flow.id));
    const editBtn = createButton('Edit', 'btn-secondary btn-small', () => openFlowModal(flow.id));
    const deleteBtn = createButton('Delete', 'btn-secondary btn-small', () => deleteFlow(flow.id));

    right.appendChild(toggleBtn);
    right.appendChild(editBtn);
    right.appendChild(deleteBtn);

    header.appendChild(left);
    header.appendChild(right);

    // v3.10.15: Details - vertical layout with bold labels
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

    // Type/Trigger row - show differently for time-based vs event-based
    const isTimeBased = flow.trigger === 'HATIRLATMA';
    if (isTimeBased) {
        details.appendChild(createRow('Type', 'time based'));
        const hour = flow.scheduleHour || '10';
        details.appendChild(createRow('Schedule', `Daily at ${hour}:00`));
    } else {
        details.appendChild(createRow('Type', 'event based'));
        const triggerLabel = triggerLabels[flow.trigger] || flow.trigger;
        details.appendChild(createRow('Trigger', triggerLabel));
    }

    // Profiles row
    if (flow.profiles.length > 0) {
        const profileLabelsText = flow.profiles.map(p => PROFILE_LABELS[p] || p).join(', ');
        details.appendChild(createRow('Profiles', profileLabelsText));
    }

    // WhatsApp templates row
    if (flow.whatsappTemplateIds.length > 0) {
        const waNames = flow.whatsappTemplateIds
            .map(id => whatsappTemplates.find(t => t.id === id)?.name || id)
            .join(', ');
        details.appendChild(createRow('WhatsApp', waNames));
    }

    // Mail templates row
    if (flow.mailTemplateIds.length > 0) {
        const mailNames = flow.mailTemplateIds
            .map(id => mailTemplates.find(t => t.id === id)?.name || id)
            .join(', ');
        details.appendChild(createRow('Mail', mailNames));
    }

    item.appendChild(header);
    item.appendChild(details);

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

    // Use cached templates for instant modal open
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

    // Reset flow type to Event Based
    const eventRadio = document.querySelector('input[name="unifiedFlowType"][value="event"]') as HTMLInputElement;
    if (eventRadio) eventRadio.checked = true;
    toggleFlowType();

    // Reset trigger selection
    document.querySelectorAll<HTMLInputElement>('input[name="unifiedFlowTrigger"]').forEach(radio => {
        radio.checked = false;
    });

    // Reset schedule hour to default (10:00)
    const scheduleHourSelect = document.getElementById('unifiedFlowScheduleHour') as HTMLSelectElement;
    if (scheduleHourSelect) scheduleHourSelect.value = '10';

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

    // Set flow type based on trigger (HATIRLATMA = time based, others = event based)
    const isTimeBased = flow.trigger === 'HATIRLATMA';
    const flowTypeRadio = document.querySelector(`input[name="unifiedFlowType"][value="${isTimeBased ? 'time' : 'event'}"]`) as HTMLInputElement;
    if (flowTypeRadio) flowTypeRadio.checked = true;
    toggleFlowType();

    // Set trigger for event-based flows
    if (!isTimeBased) {
        const triggerRadio = document.querySelector(`input[name="unifiedFlowTrigger"][value="${flow.trigger}"]`) as HTMLInputElement;
        if (triggerRadio) triggerRadio.checked = true;
    }

    // Set schedule hour for time-based flows
    if (isTimeBased && flow.scheduleHour) {
        const scheduleHourSelect = document.getElementById('unifiedFlowScheduleHour') as HTMLSelectElement;
        if (scheduleHourSelect) scheduleHourSelect.value = flow.scheduleHour;
    }

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

    // Get flow type (event or time)
    const flowTypeRadio = document.querySelector('input[name="unifiedFlowType"]:checked') as HTMLInputElement;
    const flowType = flowTypeRadio?.value || 'event';

    // Set trigger based on flow type
    let trigger: string;
    let scheduleHour: string | undefined;
    if (flowType === 'time') {
        trigger = 'HATIRLATMA'; // Time-based trigger
        const scheduleHourSelect = document.getElementById('unifiedFlowScheduleHour') as HTMLSelectElement;
        scheduleHour = scheduleHourSelect?.value || '10';
    } else {
        const triggerRadio = document.querySelector('input[name="unifiedFlowTrigger"]:checked') as HTMLInputElement;
        trigger = triggerRadio?.value || '';
    }

    const profileCheckboxes = document.querySelectorAll<HTMLInputElement>('input[name="unifiedFlowProfiles"]:checked');
    const profiles = Array.from(profileCheckboxes).map(cb => cb.value);

    const waCheckboxes = document.querySelectorAll<HTMLInputElement>('input[name="unifiedFlowWhatsAppTemplates"]:checked');
    const whatsappTemplateIds = Array.from(waCheckboxes).map(cb => cb.value);

    const mailCheckboxes = document.querySelectorAll<HTMLInputElement>('input[name="unifiedFlowMailTemplates"]:checked');
    const mailTemplateIds = Array.from(mailCheckboxes).map(cb => cb.value);

    if (!name) { getUI().showAlert('Name is required', 'error'); return; }
    if (flowType === 'event' && !trigger) { getUI().showAlert('Select a trigger', 'error'); return; }
    if (profiles.length === 0) { getUI().showAlert('Select at least one profile', 'error'); return; }
    if (whatsappTemplateIds.length === 0 && mailTemplateIds.length === 0) {
        getUI().showAlert('Select at least one template', 'error');
        return;
    }

    const flowData: Partial<UnifiedFlow> = { name, description, trigger, profiles, whatsappTemplateIds, mailTemplateIds, scheduleHour };

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
            getUI().showAlert(flow.active ? 'Flow deactivated' : 'Flow activated', 'success');
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

