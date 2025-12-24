/**
 * PERMISSION MANAGER - Yetki Yönetim Modülü
 * Admin ve normal kullanıcı yetkilerini yönetir
 */

import type { DataStore, StaffMember } from './data-store';

//#region Types
export interface PermissionConfig {
    section: string;
    admin: 'full' | 'view' | 'none';
    user: 'full' | 'view' | 'none';
}

export interface UserPermissions {
    isAdmin: boolean;
    canView: Set<string>;
    canEdit: Set<string>;
}
//#endregion

//#region State
let dataStore: DataStore;
let currentUser: StaffMember | null = null;
let userPermissions: UserPermissions = {
    isAdmin: false,
    canView: new Set(),
    canEdit: new Set()
};

// Permission matrix based on user's request
const PERMISSION_MATRIX: PermissionConfig[] = [
    // Randevu Sekmesi
    { section: 'links', admin: 'full', user: 'view' },
    { section: 'createAppointment', admin: 'full', user: 'view' },
    { section: 'appointments', admin: 'full', user: 'view' },
    { section: 'settings', admin: 'full', user: 'none' },

    // Bildirim Sekmesi
    { section: 'whatsappFlow', admin: 'full', user: 'none' },
    { section: 'whatsappTemplates', admin: 'full', user: 'none' },
    { section: 'whatsappMessages', admin: 'view', user: 'view' },
    { section: 'mailFlow', admin: 'full', user: 'none' },
    { section: 'mailTemplates', admin: 'full', user: 'none' },
    { section: 'message', admin: 'full', user: 'none' },

    // Team Sekmesi
    { section: 'staff', admin: 'full', user: 'none' },
    { section: 'shifts', admin: 'full', user: 'view' },
    { section: 'admin', admin: 'full', user: 'none' },

    // Apps Sekmesi
    { section: 'teslimOnay', admin: 'full', user: 'view' },
    { section: 'teslimTutanak', admin: 'full', user: 'view' },
    { section: 'teknikServis', admin: 'full', user: 'view' },
    { section: 'katalog', admin: 'full', user: 'view' }
];
//#endregion

//#region Core Functions
/**
 * Initialize permission manager
 */
export async function initPermissionManager(store: DataStore): Promise<void> {
    dataStore = store;

    // Get current user from session
    const authResult = window.AdminAuth?.isAuthenticated();
    if (authResult && typeof authResult === 'object' && authResult.id) {
        const staff = dataStore.staff.find(s => s.id === authResult.id);
        currentUser = staff || null;

        // Fallback: if staff not found in dataStore but authResult has isAdmin
        if (!currentUser && authResult.isAdmin !== undefined) {
            currentUser = {
                id: authResult.id,
                name: authResult.name || '',
                phone: '',
                email: authResult.email || '',
                role: authResult.role || 'sales',
                isAdmin: authResult.isAdmin,
                active: true
            };
        }
    }

    // Calculate permissions
    calculatePermissions();

    // Apply permissions to UI
    applyPermissions();

    // Load admin users list
    loadAdminUsersList();

    console.log('Permission Manager initialized', { isAdmin: userPermissions.isAdmin });
}

/**
 * Calculate user permissions based on admin status
 */
function calculatePermissions(): void {
    const isAdmin = currentUser?.isAdmin === true;

    userPermissions = {
        isAdmin,
        canView: new Set<string>(),
        canEdit: new Set<string>()
    };

    PERMISSION_MATRIX.forEach(config => {
        const permission = isAdmin ? config.admin : config.user;

        if (permission === 'full') {
            userPermissions.canView.add(config.section);
            userPermissions.canEdit.add(config.section);
        } else if (permission === 'view') {
            userPermissions.canView.add(config.section);
        }
        // 'none' means neither view nor edit
    });
}

/**
 * Apply permissions to UI elements
 */
function applyPermissions(): void {
    // Add admin-user class to body if admin
    if (userPermissions.isAdmin) {
        document.body.classList.add('admin-user');
    } else {
        document.body.classList.remove('admin-user');
    }

    // Hide sub-tabs that user can't view
    hideRestrictedSubTabs();

    // Make elements read-only where user can view but not edit
    applyReadOnlyMode();

    // Hide add/edit buttons for restricted sections
    hideRestrictedButtons();
}

/**
 * Hide sub-tabs that user doesn't have permission to view
 */
function hideRestrictedSubTabs(): void {
    // Settings sub-tab (under Randevu)
    if (!userPermissions.canView.has('settings')) {
        const settingsTab = document.querySelector('.sub-tab[data-subtab="settings"]');
        settingsTab?.classList.add('hidden');
        (settingsTab as HTMLElement)?.style.setProperty('display', 'none');
    }

    // Staff sub-tab (under Team)
    if (!userPermissions.canView.has('staff')) {
        const staffTab = document.querySelector('.sub-tab[data-subtab="staff"]');
        staffTab?.classList.add('hidden');
        (staffTab as HTMLElement)?.style.setProperty('display', 'none');
    }

    // Admin sub-tab (under Team)
    if (!userPermissions.canView.has('admin')) {
        const adminTab = document.querySelector('.sub-tab[data-subtab="admin"]');
        adminTab?.classList.add('hidden');
        (adminTab as HTMLElement)?.style.setProperty('display', 'none');
    }

    // WhatsApp Flow and Templates inner tabs
    if (!userPermissions.canView.has('whatsappFlow')) {
        const flowTab = document.querySelector('.inner-tab[data-innertab="whatsappFlow"]');
        flowTab?.classList.add('hidden');
        (flowTab as HTMLElement)?.style.setProperty('display', 'none');
    }

    if (!userPermissions.canView.has('whatsappTemplates')) {
        const templatesTab = document.querySelector('.inner-tab[data-innertab="whatsappTemplates"]');
        templatesTab?.classList.add('hidden');
        (templatesTab as HTMLElement)?.style.setProperty('display', 'none');
    }

    // Mail sub-tab
    if (!userPermissions.canView.has('mailFlow') && !userPermissions.canView.has('mailTemplates')) {
        const mailTab = document.querySelector('.sub-tab[data-subtab="mail"]');
        mailTab?.classList.add('hidden');
        (mailTab as HTMLElement)?.style.setProperty('display', 'none');
    }

    // Message sub-tab - kept visible but disabled if user can't view
    // No action needed here as tabs are already in correct state

    // If user can only view WhatsApp messages, switch to messages tab by default
    if (!userPermissions.isAdmin && userPermissions.canView.has('whatsappMessages')) {
        const messagesTab = document.querySelector('.inner-tab[data-innertab="whatsappMessages"]');
        if (messagesTab) {
            // Trigger click to switch to messages tab
            setTimeout(() => {
                (messagesTab as HTMLElement).click();
            }, 100);
        }
    }
}

/**
 * Apply read-only mode to sections user can view but not edit
 */
function applyReadOnlyMode(): void {
    // Shifts section - view only for non-admins
    if (userPermissions.canView.has('shifts') && !userPermissions.canEdit.has('shifts')) {
        const shiftsContent = document.getElementById('shifts');
        if (shiftsContent) {
            // Hide save button
            const saveBtn = shiftsContent.querySelector('#saveShiftsBtn');
            (saveBtn as HTMLElement)?.style.setProperty('display', 'none');

            // Disable shift selects
            shiftsContent.querySelectorAll('.shift-table select').forEach(select => {
                (select as HTMLSelectElement).disabled = true;
            });
        }
    }

    // Links section - hide VIP management for non-admins
    if (userPermissions.canView.has('links') && !userPermissions.canEdit.has('links')) {
        // Users can still copy/open links but can't add new VIPs
    }

    // Appointments section - view only for non-admins
    if (userPermissions.canView.has('appointments') && !userPermissions.canEdit.has('appointments')) {
        // Non-admins can view but edit buttons will be hidden per-item
    }
}

/**
 * Hide add/edit buttons for restricted sections
 */
function hideRestrictedButtons(): void {
    if (!userPermissions.isAdmin) {
        // WhatsApp - hide add flow/template buttons
        document.getElementById('addTimeBasedFlowBtn')?.style.setProperty('display', 'none');
        document.getElementById('addEventBasedFlowBtn')?.style.setProperty('display', 'none');
        document.getElementById('addTemplateBtn')?.style.setProperty('display', 'none');

        // Mail - hide add buttons
        document.getElementById('addMailFlowBtn')?.style.setProperty('display', 'none');
        document.getElementById('addMailTemplateBtn')?.style.setProperty('display', 'none');

        // Staff - hide add button
        const addStaffCard = document.querySelector('#staff .card:first-child');
        (addStaffCard as HTMLElement)?.style.setProperty('display', 'none');

        // Settings - already hidden via sub-tab
    }
}

/**
 * Check if user can view a section
 */
export function canView(section: string): boolean {
    return userPermissions.canView.has(section);
}

/**
 * Check if user can edit a section
 */
export function canEdit(section: string): boolean {
    return userPermissions.canEdit.has(section);
}

/**
 * Check if current user is admin
 */
export function isAdmin(): boolean {
    return userPermissions.isAdmin;
}

/**
 * Get current user
 */
export function getCurrentUser(): StaffMember | null {
    return currentUser;
}
//#endregion

//#region Admin Users List
/**
 * Load and display admin users list using safe DOM methods
 */
function loadAdminUsersList(): void {
    const container = document.getElementById('adminUsersList');
    if (!container) return;

    // Clear container safely
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    try {
        const staff = dataStore.staff;
        const adminUsers = staff.filter(s => s.isAdmin === true);

        if (adminUsers.length === 0) {
            const emptyMsg = document.createElement('p');
            emptyMsg.style.cssText = 'color:#888;font-size:13px;';
            emptyMsg.textContent = 'Admin yetkili kullanıcı bulunmuyor.';
            container.appendChild(emptyMsg);
            return;
        }

        adminUsers.forEach(admin => {
            const item = createAdminUserItem(admin);
            container.appendChild(item);
        });

    } catch (error) {
        console.error('Admin listesi yüklenemedi:', error);
        const errorMsg = document.createElement('p');
        errorMsg.style.cssText = 'color:#C62828;font-size:13px;';
        errorMsg.textContent = 'Admin listesi yüklenemedi.';
        container.appendChild(errorMsg);
    }
}

/**
 * Create admin user item element using safe DOM methods
 */
function createAdminUserItem(admin: StaffMember): HTMLElement {
    const item = document.createElement('div');
    item.className = 'admin-user-item';

    const info = document.createElement('div');
    info.className = 'admin-user-info';

    const avatar = document.createElement('div');
    avatar.className = 'admin-user-avatar';
    avatar.textContent = getInitials(admin.name);

    const textContainer = document.createElement('div');

    const nameDiv = document.createElement('div');
    nameDiv.className = 'admin-user-name';
    nameDiv.textContent = admin.name;

    const roleDiv = document.createElement('div');
    roleDiv.className = 'admin-user-role';
    roleDiv.textContent = getRoleName(admin.role);

    textContainer.appendChild(nameDiv);
    textContainer.appendChild(roleDiv);

    info.appendChild(avatar);
    info.appendChild(textContainer);

    const badge = document.createElement('span');
    badge.className = 'perm-badge perm-full';
    badge.textContent = 'Admin';

    item.appendChild(info);
    item.appendChild(badge);

    return item;
}

/**
 * Get initials from name
 */
function getInitials(name: string): string {
    return name
        .split(' ')
        .map(part => part.charAt(0).toUpperCase())
        .slice(0, 2)
        .join('');
}

/**
 * Get role display name
 */
function getRoleName(role: string): string {
    const roles: Record<string, string> = {
        'sales': 'Satış',
        'management': 'Yönetim',
        'greeter': 'Karşılayıcı'
    };
    return roles[role] || role;
}
//#endregion

//#region Permission Helpers for Other Modules
/**
 * Hide element if user doesn't have permission
 */
export function hideIfNoPermission(element: HTMLElement | null, section: string): void {
    if (!element) return;

    if (!canView(section)) {
        element.style.display = 'none';
    }
}

/**
 * Disable element if user can't edit
 */
export function disableIfNoEdit(element: HTMLElement | null, section: string): void {
    if (!element) return;

    if (!canEdit(section)) {
        if (element instanceof HTMLButtonElement ||
            element instanceof HTMLInputElement ||
            element instanceof HTMLSelectElement) {
            element.disabled = true;
        }
        element.style.opacity = '0.6';
        element.style.pointerEvents = 'none';
    }
}

/**
 * Wrap action with permission check
 */
export function withPermission<T>(section: string, action: () => T, fallback?: T): T | undefined {
    if (canEdit(section)) {
        return action();
    }
    console.warn(`Permission denied for section: ${section}`);
    return fallback;
}
//#endregion
