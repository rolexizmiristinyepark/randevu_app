/**
 * STAFF MANAGER - Personel Yönetimi Modülü
 * Sorumluluklar: Personel CRUD, aktif/pasif yapma, personel linkleri
 */

import { apiCall } from '../api-service';
import { ValidationUtils } from '../validation-utils';
import { ErrorUtils } from '../error-utils';
import type { DataStore, StaffMember } from './data-store';

// Module-scoped variables
let dataStore: DataStore;
let currentEditId: number | null = null;

// Global references (accessed via window)
declare const window: Window & {
    CONFIG: any;
    UI: any;
    createElement: (tag: string, attributes?: any, textContent?: string) => HTMLElement;
};

// Lazy accessors to avoid module load order issues
const getUI = () => window.UI;
const getConfig = () => window.CONFIG;
const getCreateElement = () => window.createElement;

/**
 * Initialize Staff Manager module
 */
export async function initStaffManager(store: DataStore): Promise<void> {
    dataStore = store;
    await loadStaff();
    setupEventListeners();
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
        const staffId = parseInt(target.getAttribute('data-staff-id') || '0');

        if (!action || !staffId) return;

        switch (action) {
            case 'edit':
                openEditModal(staffId);
                break;
            case 'toggle':
                toggle(staffId);
                break;
            case 'remove':
                remove(staffId);
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
    const inputPhone = document.getElementById('newStaffPhone') as HTMLInputElement;
    const inputEmail = document.getElementById('newStaffEmail') as HTMLInputElement;
    const name = inputName.value.trim();
    const phone = inputPhone.value.trim();
    const email = inputEmail.value.trim();

    // Validate
    const validation = ValidationUtils.validateStaffForm(name, phone, email);
    if (!validation.valid) {
        getUI().showAlert(validation.message, 'error');
        return;
    }

    try {
        const response = await apiCall('addStaff', { name, phone, email });

        if (response.success) {
            dataStore.staff = response.data as StaffMember[];
            inputName.value = '';
            inputPhone.value = '';
            inputEmail.value = '';
            render();
            getUI().showAlert('✅ ' + name + ' eklendi!', 'success');
        } else {
            ErrorUtils.handleApiError(response as any, 'addStaff', getUI().showAlert.bind(UI));
        }
    } catch (error) {
        ErrorUtils.handleException(error, 'Ekleme', getUI().showAlert.bind(UI));
    }
}

/**
 * Toggle staff active/inactive status
 */
async function toggle(id: number): Promise<void> {
    try {
        const response = await apiCall('toggleStaff', { id });

        if (response.success) {
            dataStore.staff = response.data as StaffMember[];
            render();
            getUI().showAlert('✅ Durum değişti!', 'success');
        } else {
            ErrorUtils.handleApiError(response as any, 'toggleStaff', getUI().showAlert.bind(UI));
        }
    } catch (error) {
        ErrorUtils.handleException(error, 'Güncelleme', getUI().showAlert.bind(UI));
    }
}

/**
 * Remove staff member
 */
async function remove(id: number): Promise<void> {
    const staff = dataStore.staff.find(s => s.id === id);
    if (!staff) return;

    if (!confirm('"' + staff.name + '" silinsin mi?')) return;

    try {
        const response = await apiCall('removeStaff', { id });

        if (response.success) {
            dataStore.staff = response.data as StaffMember[];
            render();
            getUI().showAlert('✅ ' + staff.name + ' silindi!', 'success');
        } else {
            ErrorUtils.handleApiError(response as any, 'removeStaff', getUI().showAlert.bind(UI));
        }
    } catch (error) {
        ErrorUtils.handleException(error, 'Silme', getUI().showAlert.bind(UI));
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
        const emptyMsg = getCreateElement()('p', {
            style: { textAlign: 'center', color: '#999', padding: '20px' }
        }, 'Henüz personel yok');
        list.appendChild(emptyMsg);
        return;
    }

    // Use DocumentFragment for performance
    const fragment = document.createDocumentFragment();

    dataStore.staff.forEach(s => {
        // Staff item container
        const staffItem = getCreateElement()('div', { className: 'staff-item' });

        // Staff info section
        const staffInfo = getCreateElement()('div', { className: 'staff-info' });

        const infoDiv = getCreateElement()('div');
        const nameDiv = getCreateElement()('div', { className: 'staff-name' }, s.name);
        const detailsDiv = getCreateElement()('div', {
            style: { fontSize: '12px', color: '#666', marginTop: '4px' }
        }, `${s.phone || 'Telefon yok'} • ${s.email || 'E-posta yok'}`);

        infoDiv.appendChild(nameDiv);
        infoDiv.appendChild(detailsDiv);
        staffInfo.appendChild(infoDiv);

        // Staff actions section
        const staffActions = getCreateElement()('div', { className: 'staff-actions' });

        // Status span
        const statusSpan = getCreateElement()('span', {
            className: `staff-status ${s.active ? 'status-active' : 'status-inactive'}`
        }, s.active ? 'Aktif' : 'Pasif');

        // Edit button (with data attributes for event delegation)
        const editBtn = getCreateElement()('button', {
            className: 'btn btn-small btn-secondary',
            'data-action': 'edit',
            'data-staff-id': s.id
        }, 'Düzenle');

        // Toggle button
        const toggleBtn = getCreateElement()('button', {
            className: `btn btn-small btn-secondary`,
            'data-action': 'toggle',
            'data-staff-id': s.id
        }, s.active ? 'Pasif' : 'Aktif');

        // Remove button
        const removeBtn = getCreateElement()('button', {
            className: 'btn btn-small btn-secondary',
            'data-action': 'remove',
            'data-staff-id': s.id
        }, 'Sil');

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
        const emptyMsg = getCreateElement()('p', {
            style: { textAlign: 'center', color: '#999', padding: '20px' }
        }, 'Henüz personel yok');
        container.appendChild(emptyMsg);
        return;
    }

    // Grid layout
    const gridContainer = getCreateElement()('div', { className: 'link-grid' });

    activeStaff.forEach(s => {
        const staffLink = `${getConfig().BASE_URL}?staff=${s.id}`;

        // Link card
        const linkCard = getCreateElement()('div', { className: 'link-card' });

        // Header
        const header = getCreateElement()('div', { className: 'link-card-header' }, s.name);

        // Body
        const body = getCreateElement()('div', { className: 'link-card-body' });

        // Link input
        const linkInput = getCreateElement()('input', {
            type: 'text',
            value: staffLink,
            readonly: true,
            id: `staffLink_${s.id}`,
            className: 'link-input'
        }) as HTMLInputElement;

        // Actions
        const actions = getCreateElement()('div', { className: 'link-actions' });

        const copyBtn = getCreateElement()('button', {
            className: 'btn btn-small btn-secondary'
        }, 'Kopyala');
        copyBtn.addEventListener('click', () => copyLink(s.id));

        const openBtn = getCreateElement()('button', {
            className: 'btn btn-small'
        }, 'Aç');
        openBtn.addEventListener('click', () => openLink(s.id));

        actions.appendChild(copyBtn);
        actions.appendChild(openBtn);

        body.appendChild(linkInput);
        body.appendChild(actions);

        linkCard.appendChild(header);
        linkCard.appendChild(body);
        gridContainer.appendChild(linkCard);
    });

    container.appendChild(gridContainer);
}

/**
 * Copy staff link to clipboard
 */
function copyLink(staffId: number): void {
    const input = document.getElementById('staffLink_' + staffId) as HTMLInputElement;
    input.select();
    document.execCommand('copy');
    getUI().showAlert('✅ Link kopyalandı!', 'success');
}

/**
 * Open staff link in new tab
 */
function openLink(staffId: number): void {
    const input = document.getElementById('staffLink_' + staffId) as HTMLInputElement;
    window.open(input.value, '_blank');
}

/**
 * Open edit modal for staff member
 */
function openEditModal(staffId: number): void {
    const staff = dataStore.staff.find(s => s.id === staffId);
    if (!staff) return;

    currentEditId = staffId;
    (document.getElementById('editStaffName') as HTMLInputElement).value = staff.name;
    (document.getElementById('editStaffPhone') as HTMLInputElement).value = staff.phone || '';
    (document.getElementById('editStaffEmail') as HTMLInputElement).value = staff.email || '';
    document.getElementById('editStaffModal')?.classList.add('active');
}

/**
 * Close edit modal
 */
function closeEditModal(): void {
    currentEditId = null;
    document.getElementById('editStaffModal')?.classList.remove('active');
}

/**
 * Save staff edits
 */
async function saveEdit(): Promise<void> {
    const name = (document.getElementById('editStaffName') as HTMLInputElement).value.trim();
    const phone = (document.getElementById('editStaffPhone') as HTMLInputElement).value.trim();
    const email = (document.getElementById('editStaffEmail') as HTMLInputElement).value.trim();

    // Validate
    const validation = ValidationUtils.validateStaffForm(name, phone, email);
    if (!validation.valid) {
        getUI().showAlert(validation.message, 'error');
        return;
    }

    try {
        const response = await apiCall('updateStaff', {
            id: currentEditId,
            name: name,
            phone: phone,
            email: email
        });

        if (response.success) {
            dataStore.staff = response.data as StaffMember[];
            render();
            closeEditModal();
            getUI().showAlert('✅ Personel güncellendi!', 'success');
        } else {
            ErrorUtils.handleApiError(response as any, 'updateStaff', getUI().showAlert.bind(UI));
        }
    } catch (error) {
        ErrorUtils.handleException(error, 'Güncelleme', getUI().showAlert.bind(UI));
    }
}

// Export for potential future use
export { render as renderStaffList };
