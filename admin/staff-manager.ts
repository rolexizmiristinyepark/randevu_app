/**
 * STAFF MANAGER - Personel Yönetimi Modülü
 * Sorumluluklar: Personel CRUD, aktif/pasif yapma, personel linkleri
 */

import { apiCall } from '../api-service';
import { ValidationUtils } from '../validation-utils';
import { ErrorUtils } from '../error-utils';
import { ButtonAnimator, FormDirtyState } from '../button-utils';
import { formatPhoneForDisplay } from '../security-helpers';
import { initPhoneInput, getPhoneNumber, setPhoneNumber, destroyPhoneInput } from '../phone-input';
import type { DataStore } from './data-store';

// Module-scoped variables
let dataStore: DataStore;
let currentEditId: string | null = null;
let editModalDirtyState: FormDirtyState | null = null;

// Global references (accessed via window)
declare const window: Window & {
    CONFIG: any;
    UI: any;
};

// Lazy accessors to avoid module load order issues
const getUI = () => window.UI;
const getConfig = () => window.CONFIG;

/**
 * Helper: Create DOM element with attributes
 */
function createElement(tag: string, attrs?: Record<string, any>, text?: string): HTMLElement {
    const el = document.createElement(tag);
    if (attrs) {
        Object.entries(attrs).forEach(([key, value]) => {
            if (key === 'className') {
                el.className = value;
            } else if (key === 'style' && typeof value === 'object') {
                Object.assign(el.style, value);
            } else if (key.startsWith('data-')) {
                el.setAttribute(key, value);
            } else {
                (el as any)[key] = value;
            }
        });
    }
    if (text) el.textContent = text;
    return el;
}

// ButtonAnimator is imported from button-utils.ts

/**
 * Initialize Staff Manager module
 */
export async function initStaffManager(store: DataStore): Promise<void> {
    dataStore = store;
    await loadStaff();
    setupEventListeners();

    // Initialize phone input for new staff form (lazy-loaded)
    await initPhoneInput('newStaffPhone');
}

/**
 * Load staff data and render
 */
async function loadStaff(): Promise<void> {
    await dataStore.loadStaff();
    render();
}

/**
 * Setup event listeners for staff management
 */
function setupEventListeners(): void {
    // Add staff button
    const addBtn = document.getElementById('addStaffBtn');
    addBtn?.addEventListener('click', () => add());

    // Event delegation for staff list actions (edit, toggle, remove)
    const staffList = document.getElementById('staffList');
    staffList?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const action = target.getAttribute('data-action');
        const staffId = target.getAttribute('data-staff-id');

        if (!action || !staffId) return;

        // Get button element for loading state
        const button = target.tagName === 'BUTTON' ? target as HTMLButtonElement : null;

        switch (action) {
            case 'edit':
                openEditModal(staffId);
                break;
            case 'toggle':
                toggle(staffId, button || undefined);
                break;
            case 'remove':
                remove(staffId, button || undefined);
                break;
        }
    });

    // Edit modal buttons
    const cancelEditBtn = document.getElementById('cancelEditStaffBtn');
    cancelEditBtn?.addEventListener('click', () => closeEditModal());

    const saveEditBtn = document.getElementById('saveEditStaffBtn');
    saveEditBtn?.addEventListener('click', () => saveEdit());
}

/**
 * Add new staff member
 */
async function add(): Promise<void> {
    const inputName = document.getElementById('newStaffName') as HTMLInputElement;
    const inputEmail = document.getElementById('newStaffEmail') as HTMLInputElement;
    const inputRole = document.getElementById('newStaffRole') as HTMLSelectElement;
    const inputIsAdmin = document.getElementById('newStaffIsAdmin') as HTMLInputElement;

    const name = inputName.value.trim();
    // Telefonu intl-tel-input'tan al (E.164 format, + olmadan: 905321234567)
    const phone = getPhoneNumber('newStaffPhone');
    const email = inputEmail.value.trim();
    const role = inputRole.value;
    const isAdmin = inputIsAdmin.checked;

    // Validate
    const validation = ValidationUtils.validateStaffForm(name, phone, email);
    if (!validation.valid) {
        getUI().showAlert(validation.message, 'error');
        return;
    }

    try {
        const response = await apiCall('addStaff', { name, phone, email, role, isAdmin: isAdmin ? 'true' : 'false' });

        if (response.success) {
            // Backend doesn't return updated list, reload from API
            await dataStore.loadStaff();
            inputName.value = '';
            // Reset phone input
            destroyPhoneInput('newStaffPhone');
            await initPhoneInput('newStaffPhone');
            inputEmail.value = '';
            inputRole.value = 'sales';
            inputIsAdmin.checked = false;
            render();
            getUI().showAlert(name + ' eklendi!', 'success');
        } else {
            ErrorUtils.handleApiError(response as any, 'addStaff', getUI().showAlert.bind(getUI()));
        }
    } catch (error) {
        ErrorUtils.handleException(error, 'Ekleme', getUI().showAlert.bind(getUI()));
    }
}

/**
 * Toggle staff active/inactive status
 */
async function toggle(id: string, button?: HTMLButtonElement): Promise<void> {
    if (button) ButtonAnimator.start(button);

    try {
        const response = await apiCall('toggleStaff', { id });

        if (response.success) {
            if (button) ButtonAnimator.success(button, false);
            // Backend doesn't return updated list, reload from API
            setTimeout(async () => {
                await dataStore.loadStaff();
                render();
            }, 500);
            getUI().showAlert('Durum değişti!', 'success');
        } else {
            if (button) ButtonAnimator.error(button);
            ErrorUtils.handleApiError(response as any, 'toggleStaff', getUI().showAlert.bind(getUI()));
        }
    } catch (error) {
        if (button) ButtonAnimator.error(button);
        ErrorUtils.handleException(error, 'Güncelleme', getUI().showAlert.bind(getUI()));
    }
}

/**
 * Remove staff member
 */
async function remove(id: string, button?: HTMLButtonElement): Promise<void> {
    const staff = dataStore.staff.find(s => s.id === id);
    if (!staff) return;

    if (!confirm('"' + staff.name + '" silinsin mi?')) return;

    if (button) ButtonAnimator.start(button);

    try {
        const response = await apiCall('removeStaff', { id });

        if (response.success) {
            if (button) ButtonAnimator.success(button, false);
            // Backend doesn't return updated list, reload from API
            setTimeout(async () => {
                await dataStore.loadStaff();
                render();
            }, 500);
            getUI().showAlert(staff.name + ' silindi!', 'success');
        } else {
            if (button) ButtonAnimator.error(button);
            ErrorUtils.handleApiError(response as any, 'removeStaff', getUI().showAlert.bind(getUI()));
        }
    } catch (error) {
        if (button) ButtonAnimator.error(button);
        ErrorUtils.handleException(error, 'Silme', getUI().showAlert.bind(getUI()));
    }
}

/**
 * Render staff list
 */
function render(): void {
    const list = document.getElementById('staffList');
    const countElement = document.getElementById('staffCount');

    if (!list || !countElement) return;

    countElement.textContent = dataStore.staff.filter(s => s.active).length.toString();

    // Clear
    list.textContent = '';

    if (dataStore.staff.length === 0) {
        const emptyMsg = createElement('p', {
            style: { textAlign: 'center', color: '#999', padding: '20px' }
        }, 'Henüz personel yok');
        list.appendChild(emptyMsg);
        // v3.10.46: Staff yoksa da links bölümünü render et (boş mesaj göstermek için)
        renderLinks();
        return;
    }

    // Use DocumentFragment for performance
    const fragment = document.createDocumentFragment();

    dataStore.staff.forEach(s => {
        // Staff item container
        const staffItem = createElement('div', { className: 'staff-item' });

        // Staff info section
        const staffInfo = createElement('div', { className: 'staff-info' });

        const infoDiv = createElement('div');
        const nameDiv = createElement('div', { className: 'staff-name' });
        nameDiv.textContent = s.name;

        // v3.10.34: Admin rozeti
        if (s.isAdmin) {
            const adminBadge = createElement('span', {
                className: 'admin-badge',
                style: {
                    marginLeft: '8px',
                    padding: '2px 6px',
                    fontSize: '10px',
                    fontWeight: '600',
                    backgroundColor: '#7c3aed',
                    color: '#fff',
                    borderRadius: '4px',
                    verticalAlign: 'middle'
                }
            }, 'ADMIN');
            nameDiv.appendChild(adminBadge);
        }

        // Telefon numarasını +90 formatında göster
        const displayPhone = s.phone ? formatPhoneForDisplay(s.phone) : 'Telefon yok';
        const detailsDiv = createElement('div', {
            style: { fontSize: '12px', color: '#666', marginTop: '4px' }
        }, `${displayPhone} • ${s.email || 'E-posta yok'}`);

        infoDiv.appendChild(nameDiv);
        infoDiv.appendChild(detailsDiv);
        staffInfo.appendChild(infoDiv);

        // Staff actions section
        const staffActions = createElement('div', { className: 'staff-actions' });

        // Status span
        const statusSpan = createElement('span', {
            className: `staff-status ${s.active ? 'status-active' : 'status-inactive'}`
        }, s.active ? 'Active' : 'Inactive');

        // Edit button (with data attributes for event delegation)
        const editBtn = createElement('button', {
            className: 'btn btn-small btn-secondary',
            'data-action': 'edit',
            'data-staff-id': s.id
        }, 'Edit');

        // Toggle button
        const toggleBtn = createElement('button', {
            className: `btn btn-small btn-secondary`,
            'data-action': 'toggle',
            'data-staff-id': s.id
        }, s.active ? 'Inactive' : 'Active');

        // Remove button
        const removeBtn = createElement('button', {
            className: 'btn btn-small btn-secondary',
            'data-action': 'remove',
            'data-staff-id': s.id
        }, 'Delete');

        staffActions.appendChild(statusSpan);
        staffActions.appendChild(editBtn);
        staffActions.appendChild(toggleBtn);
        staffActions.appendChild(removeBtn);

        staffItem.appendChild(staffInfo);
        staffItem.appendChild(staffActions);
        fragment.appendChild(staffItem);
    });

    list.appendChild(fragment);

    // Update staff links
    renderLinks();
}

/**
 * Render staff links (customer page links for each staff member)
 */
function renderLinks(): void {
    const container = document.getElementById('staffLinks');
    if (!container) return;

    // Clear
    container.textContent = '';

    const activeStaff = dataStore.staff.filter(s => s.active);

    if (activeStaff.length === 0) {
        const emptyMsg = createElement('p', {
            style: { textAlign: 'center', color: '#999', padding: '20px' }
        }, 'Henüz personel yok');
        container.appendChild(emptyMsg);
        return;
    }

    // Grid layout
    const gridContainer = createElement('div', { className: 'link-grid' });

    activeStaff.forEach(s => {
        const staffLink = `${getConfig().BASE_URL}#s/${s.personel_id || s.id}`;

        // Link card
        const linkCard = createElement('div', { className: 'link-card' });

        // Header
        const header = createElement('div', { className: 'link-card-header' }, s.name);

        // Body
        const body = createElement('div', { className: 'link-card-body' });

        // Link input
        const linkInput = createElement('input', {
            type: 'text',
            value: staffLink,
            readonly: true,
            id: `staffLink_${s.id}`,
            className: 'link-input'
        }) as HTMLInputElement;

        // Actions
        const actions = createElement('div', { className: 'link-actions' });

        const copyBtn = createElement('button', {
            className: 'btn btn-small btn-secondary'
        }, 'Copy');
        copyBtn.addEventListener('click', () => copyLink(s.id));

        const openBtn = createElement('button', {
            className: 'btn btn-small'
        }, 'Open');
        openBtn.addEventListener('click', () => openLink(s.id));

        actions.appendChild(copyBtn);
        actions.appendChild(openBtn);

        body.appendChild(linkInput);
        body.appendChild(actions);

        linkCard.appendChild(header);
        linkCard.appendChild(body);
        gridContainer.appendChild(linkCard);
    });

    // Son tek karta full-width class ekle
    if (activeStaff.length % 2 === 1) {
        const lastCard = gridContainer.lastElementChild as HTMLElement;
        if (lastCard) lastCard.classList.add('link-card-full');
    }

    container.appendChild(gridContainer);

    // v3.10.46: VIP links bölümünü de render et
    renderVipLinks();
}

/**
 * Render VIP links section (Özel Müşteri)
 * v3.10.46: VIP müşteri linkleri (#v/staffId formatında)
 */
function renderVipLinks(): void {
    const container = document.getElementById('vipLinksGrid');
    if (!container) return;

    // Clear
    container.textContent = '';

    const activeStaff = dataStore.staff.filter(s => s.active);

    if (activeStaff.length === 0) {
        const emptyMsg = createElement('p', {
            style: { textAlign: 'center', color: '#999', padding: '20px' }
        }, 'VIP linkler için önce personel ekleyin');
        container.appendChild(emptyMsg);
        return;
    }

    // Grid layout
    const gridContainer = createElement('div', { className: 'link-grid' });

    activeStaff.forEach(s => {
        const vipLink = `${getConfig().BASE_URL}#v/${s.id}`;

        // Link card
        const linkCard = createElement('div', { className: 'link-card' });

        // Header
        const header = createElement('div', { className: 'link-card-header' }, `${s.name} (VIP)`);

        // Body
        const body = createElement('div', { className: 'link-card-body' });

        // Link input
        const linkInput = createElement('input', {
            type: 'text',
            value: vipLink,
            readonly: true,
            id: `vipLink_${s.id}`,
            className: 'link-input'
        }) as HTMLInputElement;

        // Actions
        const actions = createElement('div', { className: 'link-actions' });

        const copyBtn = createElement('button', {
            className: 'btn btn-small btn-secondary'
        }, 'Copy');
        copyBtn.addEventListener('click', () => copyVipLink(s.id));

        const openBtn = createElement('button', {
            className: 'btn btn-small'
        }, 'Open');
        openBtn.addEventListener('click', () => openVipLink(s.id));

        actions.appendChild(copyBtn);
        actions.appendChild(openBtn);

        body.appendChild(linkInput);
        body.appendChild(actions);

        linkCard.appendChild(header);
        linkCard.appendChild(body);
        gridContainer.appendChild(linkCard);
    });

    // Son tek karta full-width class ekle
    if (activeStaff.length % 2 === 1) {
        const lastCard = gridContainer.lastElementChild as HTMLElement;
        if (lastCard) lastCard.classList.add('link-card-full');
    }

    container.appendChild(gridContainer);
}

/**
 * Copy VIP link to clipboard
 */
async function copyVipLink(staffId: string): Promise<void> {
    const input = document.getElementById(`vipLink_${staffId}`) as HTMLInputElement;
    if (!input) {
        getUI().showAlert('Link bulunamadı!', 'error');
        return;
    }

    try {
        await navigator.clipboard.writeText(input.value);
        getUI().showAlert('VIP link kopyalandı!', 'success');
    } catch {
        input.select();
        document.execCommand('copy');
        getUI().showAlert('VIP link kopyalandı!', 'success');
    }
}

/**
 * Open VIP link in new tab
 */
function openVipLink(staffId: string): void {
    const input = document.getElementById(`vipLink_${staffId}`) as HTMLInputElement;
    if (!input) {
        getUI().showAlert('Link bulunamadı!', 'error');
        return;
    }
    window.open(input.value, '_blank');
}

/**
 * Copy staff link to clipboard
 */
async function copyLink(staffId: string): Promise<void> {
    const input = document.getElementById(`staffLink_${staffId}`) as HTMLInputElement;
    if (!input) {
        getUI().showAlert('Link bulunamadı!', 'error');
        return;
    }

    try {
        await navigator.clipboard.writeText(input.value);
        getUI().showAlert('Link kopyalandı!', 'success');
    } catch {
        // Fallback for older browsers
        input.select();
        document.execCommand('copy');
        getUI().showAlert('Link kopyalandı!', 'success');
    }
}

/**
 * Open staff link in new tab
 */
function openLink(staffId: string): void {
    const input = document.getElementById(`staffLink_${staffId}`) as HTMLInputElement;
    if (!input) {
        getUI().showAlert('Link bulunamadı!', 'error');
        return;
    }
    window.open(input.value, '_blank');
}

/**
 * Open edit modal for staff member
 */
async function openEditModal(staffId: string): Promise<void> {
    try {
        const staff = dataStore.staff.find(s => s.id === staffId);
        if (!staff) {
            console.error('Staff not found:', staffId);
            return;
        }

        // Destroy previous dirty state if exists
        if (editModalDirtyState) {
            editModalDirtyState.destroy();
            editModalDirtyState = null;
        }

        currentEditId = staffId;

        const nameInput = document.getElementById('editStaffName') as HTMLInputElement;
        const emailInput = document.getElementById('editStaffEmail') as HTMLInputElement;
        const roleSelect = document.getElementById('editStaffRole') as HTMLSelectElement;
        const isAdminCheckbox = document.getElementById('editStaffIsAdmin') as HTMLInputElement;
        const modal = document.getElementById('editStaffModal');

        if (nameInput) nameInput.value = staff.name;
        if (emailInput) emailInput.value = staff.email || '';
        if (roleSelect) roleSelect.value = staff.role || 'sales';
        if (isAdminCheckbox) isAdminCheckbox.checked = staff.isAdmin || false;

        // Initialize phone input for edit modal and set value (lazy-loaded)
        destroyPhoneInput('editStaffPhone');
        await initPhoneInput('editStaffPhone');
        // Set phone number (with + prefix for intl-tel-input)
        if (staff.phone) {
            setPhoneNumber('editStaffPhone', String(staff.phone));
        }

        modal?.classList.add('active');

        // Initialize FormDirtyState after modal is shown
        editModalDirtyState = new FormDirtyState({
            container: '#editStaffModal .modal-content',
            saveButton: '#saveEditStaffBtn'
        });
    } catch (error) {
        console.error('Error opening edit modal:', error);
        getUI().showAlert('Modal açılırken hata oluştu', 'error');
    }
}

/**
 * Close edit modal
 */
function closeEditModal(): void {
    // Reset save button animation state
    const saveBtn = document.getElementById('saveEditStaffBtn');
    if (saveBtn) ButtonAnimator.reset(saveBtn);

    // Destroy dirty state
    if (editModalDirtyState) {
        editModalDirtyState.destroy();
        editModalDirtyState = null;
    }
    currentEditId = null;
    document.getElementById('editStaffModal')?.classList.remove('active');
}

/**
 * Save staff edits
 */
async function saveEdit(): Promise<void> {
    const saveBtn = document.getElementById('saveEditStaffBtn') as HTMLButtonElement;
    const name = (document.getElementById('editStaffName') as HTMLInputElement).value.trim();
    // Telefonu intl-tel-input'tan al (E.164 format, + olmadan: 905321234567)
    const phone = getPhoneNumber('editStaffPhone');
    const email = (document.getElementById('editStaffEmail') as HTMLInputElement).value.trim();
    const role = (document.getElementById('editStaffRole') as HTMLSelectElement).value;
    const isAdmin = (document.getElementById('editStaffIsAdmin') as HTMLInputElement).checked;

    // Validate
    const validation = ValidationUtils.validateStaffForm(name, phone, email);
    if (!validation.valid) {
        getUI().showAlert(validation.message, 'error');
        return;
    }

    // v3.10.34: Get current staff's active status to preserve it
    const currentStaff = dataStore.staff.find(s => s.id === currentEditId);
    const currentActive = currentStaff?.active !== false; // Default to true if undefined

    // Start button animation
    if (saveBtn) ButtonAnimator.start(saveBtn);

    try {
        // v3.10.18: updateStaffV3 kullan - role ve isAdmin kaydetmek için
        // v3.10.34: active alanını da gönder (mevcut değeri koru)
        const response = await apiCall('updateStaffV3', {
            id: currentEditId,
            name: name,
            phone: phone,
            email: email,
            role: role,
            isAdmin: isAdmin ? 'true' : 'false',
            active: currentActive ? 'true' : 'false'
        });

        if (response.success) {
            if (saveBtn) ButtonAnimator.success(saveBtn, false);
            // Backend doesn't return updated list, reload from API
            setTimeout(async () => {
                await dataStore.loadStaff();
                render();
                closeEditModal();
            }, 500);
            getUI().showAlert('Personel güncellendi!', 'success');
        } else {
            if (saveBtn) ButtonAnimator.error(saveBtn);
            ErrorUtils.handleApiError(response as any, 'updateStaffV3', getUI().showAlert.bind(getUI()));
        }
    } catch (error) {
        if (saveBtn) ButtonAnimator.error(saveBtn);
        ErrorUtils.handleException(error, 'Güncelleme', getUI().showAlert.bind(getUI()));
    }
}

// Export for potential future use
export { render as renderStaffList };
