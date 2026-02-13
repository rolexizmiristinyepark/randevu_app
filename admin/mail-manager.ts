/**
 * MAIL MANAGER - Mail Template ve Info Card Yönetimi
 *
 * FAZ 4: Mail entegrasyonu için admin panel modülü
 * v3.10.0: Flow yönetimi unified-flow-manager.ts'e taşındı
 *
 * Sorumluluklar:
 * - Template yönetimi (HTML şablonlar)
 * - Info Card yönetimi (randevu bilgi kartları)
 *
 * NOT: Flow yönetimi artık notification_flows üzerinden yapılmaktadır.
 * Unified Flow Manager kullanınız.
 */

import { ApiService } from '../api-service';
import { logError } from '../monitoring';
import { closeModal } from '../ui-utils';
import { ButtonAnimator, FormDirtyState } from '../button-utils';
import type { DataStore } from './data-store';
import { refreshMailTemplatesCache } from './unified-flow-manager';

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
    template_ids: string[]; // v3.9.74: Multiple templates
    info_card_id: string; // Info card ID'si
    active: boolean;
}

interface MailTemplate {
    id: string;
    name: string;
    subject: string;
    body: string; // HTML content
    recipient: string; // v3.9.74: customer, staff, admin, role_sales, role_greeter, etc.
    info_card_id: string; // v3.9.75: Info card to use with this template
}

interface InfoCardField {
    variable: string;
    label: string;
    order: number;
}

interface MailInfoCard {
    id: string;
    name: string;
    fields: InfoCardField[];
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

// Varsayılan alan başlıkları (kısa ve temiz)
const DEFAULT_FIELD_LABELS: Record<string, string> = {
    'randevu_tarih': 'Tarih',
    'randevu_saat': 'Saat',
    'randevu_turu': 'Konu',
    'personel': 'İlgili',
    'randevu_ek_bilgi': 'Ek Bilgi',
    'magaza': 'Mağaza',
    'musteri': 'Müşteri',
    'musteri_tel': 'Telefon',
    'musteri_mail': 'E-posta',
    'personel_tel': 'İlgili Tel',
    'personel_mail': 'İlgili E-posta',
    'randevu_profili': 'Profil'
};

// ==================== MODULE STATE ====================

let _dataStore: DataStore;
let flows: MailFlow[] = [];
let templates: MailTemplate[] = [];
let infoCards: MailInfoCard[] = [];
let messageVariables: Record<string, string> = {}; // Variables.js'den yüklenir
let lastFocusedField: HTMLInputElement | HTMLTextAreaElement | null = null; // Son focus olan alan
let infoCardFields: InfoCardField[] = []; // Modal için aktif field listesi
let templateModalDirtyState: FormDirtyState | null = null;
let infoCardModalDirtyState: FormDirtyState | null = null;

// ==================== CACHE & RETRY CONFIGURATION ====================

const CACHE_KEYS = {
    FLOWS: 'mail_flows_cache',
    TEMPLATES: 'mail_templates_cache',
    INFO_CARDS: 'mail_info_cards_cache'
};

const RETRY_CONFIG = {
    maxRetries: 3,
    delayMs: 500
};

/**
 * Retry mekanizması ile API çağrısı yap
 * Başarısız olursa cache'ten oku
 */
async function fetchWithRetry<T>(
    action: string,
    cacheKey: string,
    retries = RETRY_CONFIG.maxRetries
): Promise<T[]> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await ApiService.call(action, {}) as ApiResponse<T[]>;

            if (response.success && Array.isArray(response.data)) {
                // Başarılı - cache'e kaydet (boş dizi de geçerli)
                try {
                    localStorage.setItem(cacheKey, JSON.stringify({
                        data: response.data,
                        timestamp: Date.now()
                    }));
                } catch (e) {
                    // localStorage hatası - devam et
                }
                console.info(`[Mail] ${action} loaded ${response.data.length} items`);
                return response.data;
            } else {
                throw new Error(response.error || 'API error');
            }
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            console.warn(`[Mail] ${action} attempt ${attempt}/${retries} failed:`, lastError.message);

            if (attempt < retries) {
                await new Promise(resolve => setTimeout(resolve, RETRY_CONFIG.delayMs * attempt));
            }
        }
    }

    // Tüm denemeler başarısız - cache'ten oku
    console.warn(`[Mail] ${action} failed after ${retries} attempts, trying cache...`);
    try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            const { data } = JSON.parse(cached);
            if (Array.isArray(data)) {
                console.info(`[Mail] Loaded ${data.length} items from cache for ${action}`);
                return data;
            }
        }
    } catch (e) {
        // Cache parse hatası
    }

    // Cache de yoksa hata fırlat
    throw lastError || new Error(`${action} failed`);
}

/**
 * Invalidate cache after successful CRUD operation
 */
function invalidateCache(cacheKey: string): void {
    try {
        localStorage.removeItem(cacheKey);
    } catch (e) {
        // localStorage hatası - devam et
    }
}

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
    // v3.10.0: loadFlows() removed - flows are now managed via unified-flow-manager
    await Promise.all([
        loadTemplates(),
        loadInfoCards(),
        loadMessageVariables(),
        loadTriggers(),
        loadRecipients()
    ]);

    // Show deprecation message in flow container
    const flowContainer = document.getElementById('mailFlowList');
    if (flowContainer) {
        while (flowContainer.firstChild) flowContainer.removeChild(flowContainer.firstChild);
        const mailDeprecationDiv = document.createElement('div');
        mailDeprecationDiv.style.cssText = 'padding: 20px; text-align: center; color: #666; background: #f5f5f5; border-radius: 8px;';
        const mailDeprecationP = document.createElement('p');
        mailDeprecationP.style.cssText = 'margin: 0; font-size: 14px;';
        const mailBold = document.createElement('strong');
        mailBold.textContent = 'v3.10.0:';
        mailDeprecationP.appendChild(mailBold);
        mailDeprecationP.appendChild(document.createTextNode(' Mail flow\'ları artık "Bildirim Akışları" sekmesinden yönetilmektedir.'));
        mailDeprecationDiv.appendChild(mailDeprecationP);
        flowContainer.appendChild(mailDeprecationDiv);
    }

    // Debug: Expose data to window for console access
    (window as any).mailTemplates = templates;
    (window as any).mailInfoCards = infoCards;
}

/**
 * Setup all event listeners
 */
function setupEventListeners(): void {
    // v3.10.0: Flow button disabled - flows are managed via unified-flow-manager
    // document.getElementById('addMailFlowBtn')?.addEventListener('click', () => openFlowModal());

    // Template button
    document.getElementById('addMailTemplateBtn')?.addEventListener('click', () => openTemplateModal());

    // Info Card button
    document.getElementById('addMailInfoCardBtn')?.addEventListener('click', () => openInfoCardModal());

    // v3.10.0: Flow Modal handlers disabled - flows are managed via unified-flow-manager
    // document.getElementById('cancelMailFlowBtn')?.addEventListener('click', () => closeModal('mailFlowModal'));
    // document.getElementById('saveMailFlowBtn')?.addEventListener('click', saveFlow);
    // document.querySelector('#mailFlowModal .modal-overlay')?.addEventListener('click', () => closeModal('mailFlowModal'));

    // Template Modal handlers
    document.getElementById('cancelMailTemplateBtn')?.addEventListener('click', () => closeModal('mailTemplateModal'));
    document.getElementById('saveMailTemplateBtn')?.addEventListener('click', saveTemplate);
    document.querySelector('#mailTemplateModal .modal-overlay')?.addEventListener('click', () => closeModal('mailTemplateModal'));

    // Info Card Modal handlers
    document.getElementById('cancelMailInfoCardBtn')?.addEventListener('click', () => closeModal('mailInfoCardModal'));
    document.getElementById('saveMailInfoCardBtn')?.addEventListener('click', saveInfoCard);
    document.querySelector('#mailInfoCardModal .modal-overlay')?.addEventListener('click', () => closeModal('mailInfoCardModal'));

    // Track last focused field for variable insertion
    const subjectField = document.getElementById('mailTemplateSubject') as HTMLInputElement;
    const bodyField = document.getElementById('mailTemplateBody') as HTMLTextAreaElement;

    subjectField?.addEventListener('focus', () => { lastFocusedField = subjectField; });
    bodyField?.addEventListener('focus', () => { lastFocusedField = bodyField; });

    // Modal close handlers (escape key)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });
}

// ==================== FLOW MANAGEMENT ====================

/**
 * Load all flows from backend with retry and cache
 */
async function loadFlows(): Promise<void> {
    const container = document.getElementById('mailFlowList');
    showContainerLoading(container);

    try {
        flows = await fetchWithRetry<MailFlow>('getMailFlows', CACHE_KEYS.FLOWS);
        renderFlows();
    } catch (error) {
        logError(error, { action: 'loadMailFlows' });
        // Hata durumunda retry butonlu mesaj göster
        showContainerError(container, 'Flow\'lar yüklenemedi', loadFlows);
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
 * Create a flow item element - Matches unified flow card design
 */
function createFlowItem(flow: MailFlow): HTMLElement {
    const item = document.createElement('div');
    item.className = 'flow-item mail-list-item';
    item.style.cssText = 'padding: 15px; background: #FAFAFA; border: 1px solid #E8E8E8; border-radius: 4px; margin-bottom: 10px;';

    // Header
    const header = document.createElement('div');
    header.className = 'mail-item-header';

    // Left: Name + Status badge
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

    // Right: Actions
    const right = document.createElement('div');
    right.className = 'mail-item-actions';

    const toggleBtn = createButton(flow.active ? 'Inactive' : 'Active', 'btn-secondary btn-small', () => toggleFlow(flow.id));
    const editBtn = createButton('Edit', 'btn-secondary btn-small', () => editFlow(flow.id));
    const deleteBtn = createButton('Delete', 'btn-secondary btn-small', () => deleteFlow(flow.id));

    right.appendChild(toggleBtn);
    right.appendChild(editBtn);
    right.appendChild(deleteBtn);

    header.appendChild(left);
    header.appendChild(right);

    // Details - vertical layout with bold labels (matching unified flow card)
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

    // Profiles
    const profilesText = flow.profiles.map(p => PROFILE_LABELS[p] || p).join(', ');
    details.appendChild(createRow('Profiles', profilesText));

    // Triggers
    const triggersText = flow.triggers.map(t => triggerLabels[t] || t).join(', ');
    details.appendChild(createRow('Triggers', triggersText));

    // Templates
    const templateNames = flow.template_ids
        .map(id => templates.find(t => t.id === id)?.name)
        .filter(Boolean);
    details.appendChild(createRow('Templates', templateNames.length > 0 ? templateNames.join(', ') : 'No template selected'));

    // Info Card
    const info_card_id = flow.info_card_id || 'ics_default';
    const infoCard = infoCards.find(c => c.id === info_card_id);
    details.appendChild(createRow('Info Card', infoCard?.name || 'ICS (Default)'));

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
        header.textContent = flowId ? 'Edit Flow' : 'New Flow';
    }

    // Populate template options FIRST (before setting values)
    populateTemplateSelect();

    // Populate info card options FIRST (before setting values)
    populateInfoCardSelect();

    // If editing, populate form with existing data AFTER options are loaded
    if (flowId) {
        const flow = flows.find(f => f.id === flowId);
        if (flow) {
            populateFlowForm(flow);
        }
        const editIdInput = document.getElementById('mailFlowEditId') as HTMLInputElement;
        if (editIdInput) editIdInput.value = flowId;
    }

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

    // Uncheck all template checkboxes - v3.9.74: Multiple templates
    document.querySelectorAll('input[name="mailFlowTemplates"]').forEach(cb => {
        (cb as HTMLInputElement).checked = false;
    });

    // Clear info card selection
    const infoCardSelect = document.getElementById('mailFlowInfoCards') as HTMLSelectElement;
    if (infoCardSelect) {
        infoCardSelect.value = '';
    }
}

/**
 * Populate flow form with existing flow data
 */
function populateFlowForm(flow: MailFlow): void {
    (document.getElementById('mailFlowName') as HTMLInputElement).value = flow.name;
    (document.getElementById('mailFlowDescription') as HTMLInputElement).value = flow.description || '';

    // Set info card select
    const infoCardSelect = document.getElementById('mailFlowInfoCards') as HTMLSelectElement;
    if (infoCardSelect && flow.info_card_id) {
        infoCardSelect.value = flow.info_card_id;
        // Verify selection was successful
        if (infoCardSelect.value !== flow.info_card_id) {
            console.warn('[Mail] Info card not found in options:', flow.info_card_id);
            console.warn('[Mail] Available options:', Array.from(infoCardSelect.options).map(o => o.value));
        }
    }

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

    // Check template checkboxes - v3.9.74: Multiple templates
    flow.template_ids.forEach(templateId => {
        const checkbox = document.querySelector(`input[name="mailFlowTemplates"][value="${templateId}"]`) as HTMLInputElement;
        if (checkbox) checkbox.checked = true;
    });
}

/**
 * Populate template checkboxes with available templates
 * v3.9.74: Changed from select to checkboxes for multiple templates
 */
function populateTemplateSelect(): void {
    const container = document.getElementById('mailFlowTemplatesContainer');
    if (!container) return;

    // Clear existing checkboxes
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    if (templates.length === 0) {
        const p = document.createElement('p');
        p.style.cssText = 'color: #757575; font-size: 12px; margin: 0;';
        p.textContent = 'Henüz şablon tanımlanmamış';
        container.appendChild(p);
        return;
    }

    // Add template checkboxes - include recipient info
    templates.forEach(template => {
        const label = document.createElement('label');
        label.className = 'checkbox-label';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = 'mailFlowTemplates';
        checkbox.value = template.id;

        const recipientLabel = recipientLabels[template.recipient] || template.recipient || 'müşteri';

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(`${template.name} → ${recipientLabel.toLowerCase()}`));
        container.appendChild(label);
    });
}

/**
 * Populate info card select with available info cards
 */
function populateInfoCardSelect(): void {
    const select = document.getElementById('mailFlowInfoCards') as HTMLSelectElement;
    if (!select) return;

    // Store current value before clearing
    const currentValue = select.value;

    // Clear ALL existing options
    while (select.firstChild) {
        select.removeChild(select.firstChild);
    }

    // Add empty/default option
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = 'Varsayılan (info card yok)';
    select.appendChild(emptyOption);

    // Add info card options
    infoCards.forEach(card => {
        const option = document.createElement('option');
        option.value = card.id;
        option.textContent = card.name;
        select.appendChild(option);
    });

    // Restore previous value if it exists in new options
    if (currentValue && Array.from(select.options).some(opt => opt.value === currentValue)) {
        select.value = currentValue;
    }
}

/**
 * Save flow to backend
 */
async function saveFlow(): Promise<void> {
    const saveBtn = document.getElementById('saveMailFlowBtn') as HTMLButtonElement;

    const name = (document.getElementById('mailFlowName') as HTMLInputElement).value.trim();
    const description = (document.getElementById('mailFlowDescription') as HTMLInputElement).value.trim();
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

    // Get selected templates - v3.9.74: Multiple templates
    const template_ids: string[] = [];
    document.querySelectorAll('input[name="mailFlowTemplates"]:checked').forEach(cb => {
        template_ids.push((cb as HTMLInputElement).value);
    });

    if (template_ids.length === 0) {
        getUI().showAlert('En az bir şablon seçmelisiniz', 'error');
        return;
    }

    // Get selected info card
    const infoCardSelect = document.getElementById('mailFlowInfoCards') as HTMLSelectElement;
    const info_card_id = infoCardSelect?.value || '';

    // Build flow data
    const flowData: Partial<MailFlow> = {
        name,
        description,
        triggers,
        profiles,
        template_ids,
        info_card_id,
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
        templates = await fetchWithRetry<MailTemplate>('getMailTemplates', CACHE_KEYS.TEMPLATES);
        renderTemplates();
    } catch (error) {
        logError(error, { action: 'loadMailTemplates' });
        showContainerError(container, 'Şablonlar yüklenemedi', loadTemplates);
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
 * v3.9.74: Recipients are now in template level, not flow level
 */
async function loadRecipients(): Promise<void> {
    try {
        const response = await ApiService.call('getRecipients', {}) as ApiResponse<Record<string, string>>;

        if (response.success && response.data) {
            recipientLabels = response.data;
            // v3.9.74: populateTemplateRecipientOptions is called when template modal opens
        }
    } catch (error) {
        logError(error, { action: 'loadRecipients' });
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

        // Click to insert at cursor position
        code.addEventListener('click', () => {
            const varText = `{{${key}}}`;
            insertVariableAtCursor(varText);
        });

        container.appendChild(code);
    }
}

/**
 * Insert variable text at cursor position in last focused field
 */
function insertVariableAtCursor(varText: string): void {
    // Default to body field if no field was focused
    if (!lastFocusedField) {
        lastFocusedField = document.getElementById('mailTemplateBody') as HTMLTextAreaElement;
    }

    if (!lastFocusedField) {
        getUI().showAlert('Lütfen önce bir metin alanına tıklayın', 'error');
        return;
    }

    const field = lastFocusedField;
    const start = field.selectionStart || 0;
    const end = field.selectionEnd || 0;
    const currentValue = field.value;

    // Insert at cursor position
    field.value = currentValue.substring(0, start) + varText + currentValue.substring(end);

    // Move cursor after inserted text
    const newPos = start + varText.length;
    field.setSelectionRange(newPos, newPos);

    // Re-focus the field
    field.focus();
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
 * Create a template item element - Matches unified flow card design
 */
function createTemplateItem(template: MailTemplate): HTMLElement {
    const item = document.createElement('div');
    item.className = 'template-item mail-list-item';
    item.style.cssText = 'padding: 15px; background: #FAFAFA; border: 1px solid #E8E8E8; border-radius: 4px; margin-bottom: 10px;';

    // Header
    const header = document.createElement('div');
    header.className = 'mail-item-header';

    // Left: Name + Recipient badge
    const left = document.createElement('div');
    left.style.cssText = 'display: flex; align-items: center; gap: 8px;';

    const name = document.createElement('span');
    name.className = 'mail-item-name';
    name.textContent = template.name;

    const recipientBadge = document.createElement('span');
    const recipientLabel = recipientLabels[template.recipient] || template.recipient || 'Customer';
    const isCustomer = template.recipient === 'customer' || !template.recipient;
    recipientBadge.style.cssText = `font-size: 10px; padding: 2px 6px; border-radius: 3px; background: ${isCustomer ? '#2196F3' : '#9C27B0'}; color: white;`;
    recipientBadge.textContent = recipientLabel;

    left.appendChild(name);
    left.appendChild(recipientBadge);

    // Right: Actions
    const right = document.createElement('div');
    right.className = 'mail-item-actions';

    const editBtn = createButton('Edit', 'btn-secondary btn-small', () => editTemplate(template.id));
    const deleteBtn = createButton('Delete', 'btn-secondary btn-small', () => deleteTemplate(template.id));

    right.appendChild(editBtn);
    right.appendChild(deleteBtn);

    header.appendChild(left);
    header.appendChild(right);

    // Details - vertical layout with bold labels (matching unified flow card)
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

    // Subject
    details.appendChild(createRow('Subject', template.subject));

    // Info Card
    if (template.info_card_id) {
        const card = infoCards.find(c => c.id === template.info_card_id);
        if (card) {
            details.appendChild(createRow('Info Card', card.name));
        }
    }

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

    // Destroy previous dirty state if exists
    if (templateModalDirtyState) {
        templateModalDirtyState.destroy();
        templateModalDirtyState = null;
    }

    // Reset form
    resetTemplateForm();

    // Değişkenleri göster
    populateMailVariablesContainer();

    // Populate recipient options - v3.9.74
    populateTemplateRecipientOptions();

    // Populate info card select - v3.9.75
    populateTemplateInfoCardSelect();

    // Update modal header
    const header = modal.querySelector('.modal-header');
    if (header) {
        header.textContent = templateId ? 'Edit Template' : 'New Template';
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

    // Initialize FormDirtyState - button disabled until changes made
    templateModalDirtyState = new FormDirtyState({
        container: '#mailTemplateModal .modal-content',
        saveButton: '#saveMailTemplateBtn'
    });
}

/**
 * Populate recipient options in template modal - v3.9.74
 */
function populateTemplateRecipientOptions(): void {
    const container = document.getElementById('mailTemplateRecipientOptions');
    if (!container) return;

    // Clear existing
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    // Add radio buttons for each recipient
    for (const [key, label] of Object.entries(recipientLabels)) {
        const labelEl = document.createElement('label');
        labelEl.className = 'radio-label';

        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'mailTemplateRecipient';
        radio.value = key;
        if (key === 'customer') radio.checked = true; // Default

        labelEl.appendChild(radio);
        labelEl.appendChild(document.createTextNode(label.toLowerCase()));
        container.appendChild(labelEl);
    }
}

/**
 * Populate info card select in template modal - v3.9.76
 */
function populateTemplateInfoCardSelect(): void {
    const select = document.getElementById('mailTemplateInfoCard') as HTMLSelectElement;
    if (!select) {
        console.warn('[Mail] mailTemplateInfoCard select not found');
        return;
    }

    // Keep first option (default), clear rest
    while (select.options.length > 1) {
        select.remove(1);
    }

    // Add info cards as options
    infoCards.forEach(card => {
        const option = document.createElement('option');
        option.value = card.id;
        option.textContent = card.name;
        select.appendChild(option);
    });
}

/**
 * Reset template form to defaults
 */
function resetTemplateForm(): void {
    (document.getElementById('mailTemplateName') as HTMLInputElement).value = '';
    (document.getElementById('mailTemplateSubject') as HTMLInputElement).value = '';
    (document.getElementById('mailTemplateBody') as HTMLTextAreaElement).value = '';
    (document.getElementById('mailTemplateEditId') as HTMLInputElement).value = '';

    // Reset recipient to customer (default) - v3.9.74
    const customerRadio = document.querySelector('input[name="mailTemplateRecipient"][value="customer"]') as HTMLInputElement;
    if (customerRadio) customerRadio.checked = true;

    // Reset info card select - v3.9.75
    const infoCardSelect = document.getElementById('mailTemplateInfoCard') as HTMLSelectElement;
    if (infoCardSelect) infoCardSelect.value = '';
}

/**
 * Populate template form with existing data
 */
function populateTemplateForm(template: MailTemplate): void {
    (document.getElementById('mailTemplateName') as HTMLInputElement).value = template.name;
    (document.getElementById('mailTemplateSubject') as HTMLInputElement).value = template.subject;
    (document.getElementById('mailTemplateBody') as HTMLTextAreaElement).value = template.body;

    // Set recipient radio button - v3.9.74
    const recipient = template.recipient || 'customer';
    const recipientRadio = document.querySelector(`input[name="mailTemplateRecipient"][value="${recipient}"]`) as HTMLInputElement;
    if (recipientRadio) recipientRadio.checked = true;

    // Set info card select - v3.9.75
    const infoCardSelect = document.getElementById('mailTemplateInfoCard') as HTMLSelectElement;
    if (infoCardSelect) infoCardSelect.value = template.info_card_id || '';
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

    // Get selected recipient - v3.9.74
    const recipientRadio = document.querySelector('input[name="mailTemplateRecipient"]:checked') as HTMLInputElement;
    const recipient = recipientRadio?.value || 'customer';

    // Get selected info card - v3.9.75
    const infoCardSelect = document.getElementById('mailTemplateInfoCard') as HTMLSelectElement;
    const info_card_id = infoCardSelect?.value || '';

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
        body,
        recipient,
        info_card_id
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

            // Refresh unified flow manager cache in background
            refreshMailTemplatesCache();

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

            // Refresh unified flow manager cache in background
            refreshMailTemplatesCache();

            await loadTemplates();
        } else {
            getUI().showAlert('Hata: ' + (response.error || 'Bilinmeyen hata'), 'error');
        }
    } catch (error) {
        logError(error, { action: 'deleteMailTemplate', templateId });
        getUI().showAlert('Silme hatası', 'error');
    }
}

// ==================== INFO CARD MANAGEMENT ====================

/**
 * Load all info cards from backend
 */
async function loadInfoCards(): Promise<void> {
    const container = document.getElementById('mailInfoCardsList');
    showContainerLoading(container);

    try {
        infoCards = await fetchWithRetry<MailInfoCard>('getMailInfoCards', CACHE_KEYS.INFO_CARDS);
        renderInfoCards();
    } catch (error) {
        logError(error, { action: 'loadMailInfoCards' });
        showContainerError(container, 'Info card\'lar yüklenemedi', loadInfoCards);
    }
}

/**
 * Render info cards in container
 */
function renderInfoCards(): void {
    const container = document.getElementById('mailInfoCardsList');
    if (!container) return;

    clearContainer(container);

    if (infoCards.length === 0) {
        showContainerEmpty(container, 'Henüz info card tanımlanmamış');
        return;
    }

    infoCards.forEach(card => {
        const item = createInfoCardItem(card);
        container.appendChild(item);
    });
}

/**
 * Create an info card item element
 */
function createInfoCardItem(card: MailInfoCard): HTMLElement {
    const item = document.createElement('div');
    item.className = 'info-card-item mail-list-item';
    item.style.cssText = 'padding: 15px; background: #FAFAFA; border: 1px solid #E8E8E8; border-radius: 4px; margin-bottom: 10px;';

    // Header - responsive
    const header = document.createElement('div');
    header.className = 'mail-item-header';

    // Left: Name
    const name = document.createElement('span');
    name.className = 'mail-item-name';
    name.textContent = card.name;

    // Right: Actions
    const right = document.createElement('div');
    right.className = 'mail-item-actions';

    const editBtn = createButton('Edit', 'btn-secondary btn-small', () => editInfoCard(card.id));
    const deleteBtn = createButton('Delete', 'btn-secondary btn-small', () => deleteInfoCard(card.id));

    right.appendChild(editBtn);
    right.appendChild(deleteBtn);

    header.appendChild(name);
    header.appendChild(right);

    // Details - Fields with separators
    const details = document.createElement('div');
    details.style.cssText = 'font-size: 12px; color: #757575; font-weight: 400;';

    const fieldsText = card.fields.map(f => f.label).join(' • ');
    details.textContent = fieldsText || 'No fields';

    item.appendChild(header);
    item.appendChild(details);

    return item;
}

/**
 * Open info card modal
 */
function openInfoCardModal(cardId?: string): void {
    const modal = document.getElementById('mailInfoCardModal');
    if (!modal) return;

    // Destroy previous dirty state if exists
    if (infoCardModalDirtyState) {
        infoCardModalDirtyState.destroy();
        infoCardModalDirtyState = null;
    }

    // Reset form
    resetInfoCardForm();

    // Update modal header
    const header = modal.querySelector('.modal-header');
    if (header) {
        header.textContent = cardId ? 'Edit Info Card' : 'New Info Card';
    }

    // Populate variable chips
    populateVariableChips();

    // If editing, populate form with existing data
    if (cardId) {
        const card = infoCards.find(c => c.id === cardId);
        if (card) {
            populateInfoCardForm(card);
        }
        const editIdInput = document.getElementById('mailInfoCardEditId') as HTMLInputElement;
        if (editIdInput) editIdInput.value = cardId;
    }

    // Show modal
    modal.classList.add('active');

    // Initialize FormDirtyState - button disabled until changes made
    // Note: Info card has dynamic fields, so we also need to call refresh() when fields change
    infoCardModalDirtyState = new FormDirtyState({
        container: '#mailInfoCardModal .modal-content',
        saveButton: '#saveMailInfoCardBtn'
    });
}

/**
 * Reset info card form
 */
function resetInfoCardForm(): void {
    (document.getElementById('mailInfoCardName') as HTMLInputElement).value = '';
    (document.getElementById('mailInfoCardEditId') as HTMLInputElement).value = '';

    // Clear fields list
    infoCardFields = [];
    renderInfoCardFields();
    updateInfoCardPreview();
}

/**
 * Populate info card form with existing data
 */
function populateInfoCardForm(card: MailInfoCard): void {
    (document.getElementById('mailInfoCardName') as HTMLInputElement).value = card.name;

    // Set fields
    infoCardFields = [...card.fields].sort((a, b) => a.order - b.order);
    populateVariableChips(); // Re-render chips to show which are selected
    renderInfoCardFields();
    updateInfoCardPreview();
}

/**
 * Populate variable chips - clickable buttons for adding variables
 */
function populateVariableChips(): void {
    const container = document.getElementById('infoCardVariableChips');
    if (!container) return;

    // Clear existing chips
    while (container.firstChild) container.removeChild(container.firstChild);

    // Add variable chips
    for (const [key, label] of Object.entries(messageVariables)) {
        // Check if already added
        const isAdded = infoCardFields.some(f => f.variable === key);

        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'variable-chip';
        chip.dataset.variable = key;
        chip.textContent = label;
        chip.style.cssText = `
            padding: 6px 12px;
            border: 1px solid ${isAdded ? '#E8E8E8' : '#C9A55A'};
            border-radius: 20px;
            background: ${isAdded ? '#F5F5F0' : 'white'};
            color: ${isAdded ? '#999' : '#1A1A2E'};
            font-size: 13px;
            cursor: ${isAdded ? 'default' : 'pointer'};
            transition: all 0.2s ease;
            ${isAdded ? 'text-decoration: line-through;' : ''}
        `;

        if (!isAdded) {
            chip.addEventListener('mouseenter', () => {
                chip.style.background = '#C9A55A';
                chip.style.color = 'white';
            });
            chip.addEventListener('mouseleave', () => {
                chip.style.background = 'white';
                chip.style.color = '#1A1A2E';
            });
            chip.addEventListener('click', () => addInfoCardFieldFromChip(key));
        }

        container.appendChild(chip);
    }
}

/**
 * Add field from chip click
 */
function addInfoCardFieldFromChip(variable: string): void {
    // Check if already added
    if (infoCardFields.some(f => f.variable === variable)) {
        return;
    }

    // Get label - use short default labels
    const label = DEFAULT_FIELD_LABELS[variable] || messageVariables[variable] || variable;

    // Add field
    infoCardFields.push({
        variable,
        label,
        order: infoCardFields.length
    });

    // Re-render chips (to show as disabled) and fields
    populateVariableChips();
    renderInfoCardFields();
    updateInfoCardPreview();

    // Refresh dirty state for new dynamic inputs
    if (infoCardModalDirtyState) {
        infoCardModalDirtyState.refresh();
    }
}


/**
 * Render info card fields list
 */
function renderInfoCardFields(): void {
    const container = document.getElementById('infoCardFieldsList');
    const emptyMsg = document.getElementById('infoCardFieldsEmpty');

    if (!container) return;

    // Clear container
    clearContainer(container);

    if (infoCardFields.length === 0) {
        // Show empty message
        const p = document.createElement('p');
        p.id = 'infoCardFieldsEmpty';
        p.style.cssText = 'color: #757575; text-align: center; padding: 20px; margin: 0;';
        p.textContent = 'Henüz alan seçilmedi';
        container.appendChild(p);
        return;
    }

    // Create sortable list
    infoCardFields.forEach((field, index) => {
        const item = document.createElement('div');
        item.className = 'info-card-field-item';
        item.draggable = true;
        item.dataset.index = String(index);
        item.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: white; border: 1px solid #E8E8E8; border-radius: 4px; margin-bottom: 8px; cursor: move;';

        // Left: Drag handle + Label input
        const left = document.createElement('div');
        left.style.cssText = 'display: flex; align-items: center; gap: 10px; flex: 1;';

        const dragHandle = document.createElement('span');
        dragHandle.textContent = '⋮⋮';
        dragHandle.style.cssText = 'color: #999; cursor: move;';

        const labelInput = document.createElement('input');
        labelInput.type = 'text';
        labelInput.value = field.label;
        labelInput.style.cssText = 'flex: 1; padding: 6px 10px; border: 1px solid #E8E8E8; border-radius: 4px; font-size: 13px;';
        labelInput.placeholder = 'Başlık';
        labelInput.addEventListener('input', () => {
            infoCardFields[index].label = labelInput.value;
            updateInfoCardPreview();
        });

        const varBadge = document.createElement('code');
        varBadge.textContent = `{{${field.variable}}}`;
        varBadge.style.cssText = 'padding: 3px 6px; background: #F5F5F0; border-radius: 3px; font-size: 11px; color: #666;';

        left.appendChild(dragHandle);
        left.appendChild(labelInput);
        left.appendChild(varBadge);

        // Right: Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.textContent = '✕';
        deleteBtn.style.cssText = 'background: none; border: none; color: #C62828; cursor: pointer; font-size: 16px; padding: 5px 10px;';
        deleteBtn.addEventListener('click', () => {
            infoCardFields.splice(index, 1);
            // Update order
            infoCardFields.forEach((f, i) => f.order = i);
            populateVariableChips(); // Re-enable chip
            renderInfoCardFields();
            updateInfoCardPreview();
        });

        item.appendChild(left);
        item.appendChild(deleteBtn);

        // Drag events
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer?.setData('text/plain', String(index));
            item.style.opacity = '0.5';
        });

        item.addEventListener('dragend', () => {
            item.style.opacity = '1';
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            item.style.borderColor = '#C9A55A';
        });

        item.addEventListener('dragleave', () => {
            item.style.borderColor = '#E8E8E8';
        });

        item.addEventListener('drop', (e) => {
            e.preventDefault();
            item.style.borderColor = '#E8E8E8';

            const fromIndex = parseInt(e.dataTransfer?.getData('text/plain') || '0', 10);
            const toIndex = index;

            if (fromIndex !== toIndex) {
                // Reorder
                const [removed] = infoCardFields.splice(fromIndex, 1);
                infoCardFields.splice(toIndex, 0, removed);

                // Update order
                infoCardFields.forEach((f, i) => f.order = i);

                renderInfoCardFields();
                updateInfoCardPreview();
            }
        });

        container.appendChild(item);
    });
}

/**
 * Update info card preview
 */
function updateInfoCardPreview(): void {
    const preview = document.getElementById('infoCardPreview');
    if (!preview) return;

    if (infoCardFields.length === 0) {
        while (preview.firstChild) preview.removeChild(preview.firstChild);
        const emptyP = document.createElement('p');
        emptyP.style.cssText = 'color: #757575; text-align: center; padding: 30px; margin: 0;';
        emptyP.textContent = 'Alan ekleyerek önizlemeyi görün';
        preview.appendChild(emptyP);
        return;
    }

    // Clear preview
    while (preview.firstChild) preview.removeChild(preview.firstChild);

    // Title
    const title = document.createElement('h2');
    title.style.cssText = 'margin: 0 0 20px 0; font-size: 16px; font-weight: 400; letter-spacing: 1px; color: #1a1a1a;';
    title.textContent = 'RANDEVU BİLGİLERİ';
    preview.appendChild(title);

    // Rows
    infoCardFields.forEach(field => {
        let exampleValue = '';
        switch (field.variable) {
            case 'randevu_tarih': exampleValue = '31 Aralık 2025, Çarşamba'; break;
            case 'randevu_saat': exampleValue = '12:00'; break;
            case 'randevu_turu': exampleValue = 'Görüşme'; break;
            case 'personel': exampleValue = 'Atanmadı'; break;
            case 'personel_tel': exampleValue = '+90 532 123 4567'; break;
            case 'personel_mail': exampleValue = 'personel@example.com'; break;
            case 'magaza': exampleValue = 'Rolex İzmir İstinyepark'; break;
            case 'randevu_ek_bilgi': exampleValue = 'özel müşteri test 1'; break;
            case 'musteri': exampleValue = 'Ahmet Yılmaz'; break;
            case 'musteri_tel': exampleValue = '+90 532 987 6543'; break;
            case 'musteri_mail': exampleValue = 'ahmet@example.com'; break;
            case 'randevu_profili': exampleValue = 'VIP'; break;
            default: exampleValue = '{{' + field.variable + '}}';
        }

        const row = document.createElement('div');
        row.style.cssText = 'display: flex; padding: 12px 0; border-bottom: 1px solid #f0f0f0;';
        const labelDiv = document.createElement('div');
        labelDiv.style.cssText = 'width: 120px; color: #666666; font-size: 14px; flex-shrink: 0;';
        labelDiv.textContent = field.label;
        const valueDiv = document.createElement('div');
        valueDiv.style.cssText = 'color: #1a1a1a; font-size: 14px;';
        valueDiv.textContent = exampleValue;
        row.appendChild(labelDiv);
        row.appendChild(valueDiv);
        preview.appendChild(row);
    });
}

/**
 * Escape HTML characters
 */
function escapeHtml(str: string): string {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Save info card to backend
 */
async function saveInfoCard(): Promise<void> {
    const saveBtn = document.getElementById('saveMailInfoCardBtn') as HTMLButtonElement;

    const name = (document.getElementById('mailInfoCardName') as HTMLInputElement).value.trim();
    const editId = (document.getElementById('mailInfoCardEditId') as HTMLInputElement).value;

    // Validation
    if (!name) {
        getUI().showAlert('Info card adı gereklidir', 'error');
        return;
    }

    if (infoCardFields.length === 0) {
        getUI().showAlert('En az bir alan eklemelisiniz', 'error');
        return;
    }

    // Build data - fields'ı array olarak gönder, backend stringify edecek
    const cardData = {
        name,
        fields: infoCardFields  // Array olarak gönder, JSON.stringify backend'de yapılacak
    };

    // Add loading state
    if (saveBtn) {
        ButtonAnimator.start(saveBtn);
    }

    try {
        const action = editId ? 'updateMailInfoCard' : 'createMailInfoCard';
        const params = editId ? { id: editId, ...cardData } : cardData;

        const response = await ApiService.call(action, params) as ApiResponse;

        if (response.success) {
            if (saveBtn) {
                ButtonAnimator.success(saveBtn);
            }
            getUI().showAlert(editId ? 'Info card güncellendi' : 'Info card oluşturuldu', 'success');
            setTimeout(() => {
                closeModal('mailInfoCardModal');
                loadInfoCards();
            }, 1000);
        } else {
            throw new Error(response.error || 'Bilinmeyen hata');
        }
    } catch (error) {
        if (saveBtn) {
            ButtonAnimator.error(saveBtn);
        }
        logError(error, { action: 'saveMailInfoCard' });
        getUI().showAlert('Kaydetme hatası: ' + (error as Error).message, 'error');
    }
}

/**
 * Edit info card
 */
function editInfoCard(cardId: string): void {
    openInfoCardModal(cardId);
}

/**
 * Delete info card
 */
async function deleteInfoCard(cardId: string): Promise<void> {
    if (!confirm('Bu info card\'ı silmek istediğinizden emin misiniz?')) return;

    try {
        const response = await ApiService.call('deleteMailInfoCard', { id: cardId }) as ApiResponse;

        if (response.success) {
            getUI().showAlert('Info card silindi', 'success');
            await loadInfoCards();
        } else {
            getUI().showAlert('Hata: ' + (response.error || 'Bilinmeyen hata'), 'error');
        }
    } catch (error) {
        logError(error, { action: 'deleteMailInfoCard', cardId });
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
 * Show error state with retry button in container
 */
function showContainerError(container: HTMLElement | null, message: string, retryFn: () => void): void {
    if (!container) return;
    clearContainer(container);

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'text-align: center; padding: 20px;';

    const p = document.createElement('p');
    p.style.cssText = 'color: #d32f2f; margin-bottom: 10px;';
    p.textContent = message;

    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn btn-small';
    retryBtn.textContent = 'Tekrar Dene';
    retryBtn.onclick = retryFn;

    wrapper.appendChild(p);
    wrapper.appendChild(retryBtn);
    container.appendChild(wrapper);
}

/**
 * Close all modals
 */
function closeAllModals(): void {
    // Destroy dirty states
    if (templateModalDirtyState) {
        templateModalDirtyState.destroy();
        templateModalDirtyState = null;
    }
    if (infoCardModalDirtyState) {
        infoCardModalDirtyState.destroy();
        infoCardModalDirtyState = null;
    }

    document.querySelectorAll('.modal.active').forEach(modal => {
        modal.classList.remove('active');
    });
}
