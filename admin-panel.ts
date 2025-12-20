/**
 * ADMIN PANEL - Koordinatör Modül
 * Tüm admin modüllerini başlatır ve koordine eder
 */

//#region Imports
import { initMonitoring, logError } from './monitoring';
import { initConfig } from './config-loader';
import { showAlertSafe } from './security-helpers';
import { initDataStore } from './admin/data-store';
import { initStaffManager } from './admin/staff-manager';
import { initShiftManager } from './admin/shift-manager';
import { initAppointmentManager, loadAppointments } from './admin/appointment-manager';
import { initSettingsManager } from './admin/settings-manager';
import { initWhatsAppManager, loadSentMessages, loadReceivedMessages } from './admin/whatsapp-manager';

// Extend Window interface for admin panel specific properties
declare global {
    interface Window {
        __monitoringInitialized?: boolean;
    }
}
//#endregion

//#region Configuration
// CONFIG - SINGLE SOURCE OF TRUTH
// Config loaded dynamically from backend API
// - Environment variables (APPS_SCRIPT_URL, BASE_URL): Hardcoded in config-loader
// - Business config (shifts, hours, limits): Fetched from API
// - Cache: localStorage with 1-hour TTL

// Initialize config asynchronously
(async () => {
    const config = await initConfig();
    (window as any).CONFIG = config;
})();
//#endregion

//#region UI Utilities
const UI = {
    showAlert(message: string, type: string) {
        // Güvenli alert - XSS korumalı
        showAlertSafe(message, type, 'alertContainer');
    },

    /**
     * Switch main tab (Randevu, Bildirim, Team, Apps)
     */
    switchMainTab(tabName: string) {
        // Deactivate all main tabs
        document.querySelectorAll('.main-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.main-tab-content').forEach(c => c.classList.remove('active'));

        // Activate selected main tab
        const selectedTab = document.querySelector(`.main-tab[data-maintab="${tabName}"]`);
        const selectedContent = document.getElementById(tabName);

        selectedTab?.classList.add('active');
        selectedContent?.classList.add('active');
    },

    /**
     * Switch sub tab within a main tab
     */
    switchSubTab(mainTabId: string, subTabName: string) {
        const mainContent = document.getElementById(mainTabId);
        if (!mainContent) return;

        // Deactivate all sub tabs within this main tab
        mainContent.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
        mainContent.querySelectorAll('.sub-tab-content').forEach(c => c.classList.remove('active'));

        // Activate selected sub tab
        const selectedTab = mainContent.querySelector(`.sub-tab[data-subtab="${subTabName}"]`);
        const selectedContent = document.getElementById(subTabName);

        selectedTab?.classList.add('active');
        selectedContent?.classList.add('active');

        // Load appointments when switching to appointments sub-tab
        if (subTabName === 'appointments') {
            loadAppointments();
        }
    },

    /**
     * Switch inner tab within a sub tab (WhatsApp, Mail)
     */
    switchInnerTab(subTabId: string, innerTabName: string) {
        const subContent = document.getElementById(subTabId);
        if (!subContent) return;

        // Deactivate all inner tabs within this sub tab
        subContent.querySelectorAll('.inner-tab').forEach(t => t.classList.remove('active'));
        subContent.querySelectorAll('.inner-tab-content').forEach(c => c.classList.remove('active'));

        // Activate selected inner tab
        const selectedTab = subContent.querySelector(`.inner-tab[data-innertab="${innerTabName}"]`);
        const selectedContent = document.getElementById(innerTabName);

        selectedTab?.classList.add('active');
        selectedContent?.classList.add('active');
    },

    // Legacy method for backward compatibility
    switchTab(tabName: string) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        const selectedTab = document.querySelector('.tab[data-tab="' + tabName + '"]');
        const selectedContent = document.getElementById(tabName);

        selectedTab?.classList.add('active');
        selectedContent?.classList.add('active');

        // Load appointments when switching to appointments tab
        if (tabName === 'appointments') {
            // Appointments module will handle this via its own event listeners
        }
    }
};

// Expose UI globally for modules
window.UI = UI;

// Link utility functions
function copyLink(): void {
    const linkInput = document.getElementById('customerLink') as HTMLInputElement;
    linkInput.select();
    document.execCommand('copy');
    UI.showAlert('Link kopyalandı!', 'success');
}

function openCustomerPage(): void {
    const link = (document.getElementById('customerLink') as HTMLInputElement).value;
    if (link && !link.includes('⚠️')) {
        window.open(link, '_blank');
    }
}

function copyManualLink(): void {
    const linkInput = document.getElementById('manualLink') as HTMLInputElement;
    linkInput.select();
    document.execCommand('copy');
    UI.showAlert('Manuel randevu linki kopyalandı!', 'success');
}

function openManualPage(): void {
    const link = (document.getElementById('manualLink') as HTMLInputElement).value;
    if (link && !link.includes('⚠️')) {
        window.open(link, '_blank');
    }
}

// Management link functions (VIP links: #hk, #ok, #hmk)
function copyManagement1Link(): void {
    const linkInput = document.getElementById('management1Link') as HTMLInputElement;
    linkInput.select();
    document.execCommand('copy');
    UI.showAlert('Yönetim-1 linki kopyalandı!', 'success');
}

function openManagement1Page(): void {
    const link = (document.getElementById('management1Link') as HTMLInputElement).value;
    if (link && !link.includes('⚠️')) {
        window.open(link, '_blank');
    }
}

function copyManagement2Link(): void {
    const linkInput = document.getElementById('management2Link') as HTMLInputElement;
    linkInput.select();
    document.execCommand('copy');
    UI.showAlert('Yönetim-2 linki kopyalandı!', 'success');
}

function openManagement2Page(): void {
    const link = (document.getElementById('management2Link') as HTMLInputElement).value;
    if (link && !link.includes('⚠️')) {
        window.open(link, '_blank');
    }
}

function copyManagement3Link(): void {
    const linkInput = document.getElementById('management3Link') as HTMLInputElement;
    linkInput.select();
    document.execCommand('copy');
    UI.showAlert('Yönetim-3 linki kopyalandı!', 'success');
}

function openManagement3Page(): void {
    const link = (document.getElementById('management3Link') as HTMLInputElement).value;
    if (link && !link.includes('⚠️')) {
        window.open(link, '_blank');
    }
}
//#endregion

//#region Initialization
/**
 * Initialize admin panel
 */
function initAdmin(): void {
    // Initialize monitoring (Sentry + Web Vitals) - only once
    if (!window.__monitoringInitialized) {
        initMonitoring();
        window.__monitoringInitialized = true;
    }

    // Check if AdminAuth module is loaded
    if (typeof window.AdminAuth === 'undefined') {
        // Module not loaded yet, wait a bit and try again
        setTimeout(initAdmin, 50);
        return;
    }

    // Authentication kontrolü
    if (!window.AdminAuth.isAuthenticated()) {
        // Loading overlay'i gizle (login modal görünsün)
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) loadingOverlay.style.display = 'none';

        window.AdminAuth.showLoginModal();
        return;
    }

    // Initialize the rest of the app
    startApp();
}

/**
 * Start the application after authentication
 */
async function startApp(): Promise<void> {
    try {
        // Add logout button
        window.AdminAuth.addLogoutButton();

        // Start inactivity tracking (15 min timeout)
        window.AdminAuth._startActivityTracking();

        // Initialize data store
        const dataStore = initDataStore();

        // Initialize all manager modules
        await initStaffManager(dataStore);
        await initShiftManager(dataStore);
        await initAppointmentManager(dataStore);
        await initSettingsManager(dataStore);
        await initWhatsAppManager(dataStore);

        // Setup tabs
        setupTabs();

        // Setup links
        setupLinks();

        // Setup week filter for appointments
        setupWeekFilter();

        // Setup link button event listeners
        setupLinkButtons();

        // Setup randevu oluştur butonları
        setupCreateAppointmentButtons();

        // Hide loading overlay and show main tabs
        const loadingOverlay = document.getElementById('loadingOverlay');
        const mainTabs = document.querySelector('.main-tabs') as HTMLElement;

        if (loadingOverlay) loadingOverlay.style.display = 'none';
        if (mainTabs) mainTabs.style.display = 'flex';

    } catch (error) {
        console.error('Admin panel başlatma hatası:', error);
        logError(error, { context: 'startApp' });
        UI.showAlert('Yönetim paneli başlatılamadı', 'error');
    }
}

/**
 * Setup hierarchical tab switching (main-tabs > sub-tabs > inner-tabs)
 */
function setupTabs(): void {
    // Main tabs (Randevu, Bildirim, Team, Apps)
    document.querySelectorAll('.main-tab').forEach(tab => {
        tab.addEventListener('click', function(this: HTMLElement) {
            const tabName = this.dataset.maintab;
            if (tabName) {
                UI.switchMainTab(tabName);
            }
        });
    });

    // Sub tabs (within each main tab)
    document.querySelectorAll('.sub-tab').forEach(tab => {
        tab.addEventListener('click', function(this: HTMLElement) {
            // Skip disabled tabs
            if (this.classList.contains('disabled')) return;

            const subTabName = this.dataset.subtab;
            // Find parent main-tab-content
            const mainContent = this.closest('.main-tab-content');
            const mainTabId = mainContent?.id;

            if (subTabName && mainTabId) {
                UI.switchSubTab(mainTabId, subTabName);
            }
        });
    });

    // Inner tabs (WhatsApp, Mail)
    document.querySelectorAll('.inner-tab').forEach(tab => {
        tab.addEventListener('click', function(this: HTMLElement) {
            const innerTabName = this.dataset.innertab;
            // Find parent sub-tab-content
            const subContent = this.closest('.sub-tab-content');
            const subTabId = subContent?.id;

            if (innerTabName && subTabId) {
                UI.switchInnerTab(subTabId, innerTabName);

                // Load messages when switching to WhatsApp messages tab
                if (innerTabName === 'whatsappMessages') {
                    loadSentMessages();
                    loadReceivedMessages();
                }
            }
        });
    });

    // Legacy: Support for old .tab class (backward compatibility)
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function(this: HTMLElement) {
            const tabName = this.dataset.tab;
            if (tabName) {
                UI.switchTab(tabName);

                // Randevular sekmesine geçince randevuları yükle
                if (tabName === 'appointments') {
                    loadAppointments();
                }
            }
        });
    });
}

/**
 * Setup links (customer, manual, management)
 */
function setupLinks(): void {
    // Customer link setup
    const linkInput = document.getElementById('customerLink') as HTMLInputElement;
    if (linkInput) linkInput.value = (window as any).CONFIG.BASE_URL;

    // Manuel randevu link setup (staff=0 parametreli)
    const manualLinkInput = document.getElementById('manualLink') as HTMLInputElement;
    if (manualLinkInput) manualLinkInput.value = (window as any).CONFIG.BASE_URL + '?staff=0';

    // Yönetim linkleri setup (VIP linkler - hash routing for GitHub Pages)
    const management1LinkInput = document.getElementById('management1Link') as HTMLInputElement;
    if (management1LinkInput) management1LinkInput.value = (window as any).CONFIG.BASE_URL + '#hk';

    const management2LinkInput = document.getElementById('management2Link') as HTMLInputElement;
    if (management2LinkInput) management2LinkInput.value = (window as any).CONFIG.BASE_URL + '#ok';

    const management3LinkInput = document.getElementById('management3Link') as HTMLInputElement;
    if (management3LinkInput) management3LinkInput.value = (window as any).CONFIG.BASE_URL + '#hmk';
}

/**
 * Setup week filter for appointments (set to current week)
 */
function setupWeekFilter(): void {
    const today = new Date();
    const year = today.getFullYear();
    const firstDayOfYear = new Date(year, 0, 1);
    const pastDaysOfYear = (today.getTime() - firstDayOfYear.getTime()) / 86400000;
    const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);

    const filterWeek = document.getElementById('filterWeek') as HTMLInputElement;
    if (filterWeek) {
        filterWeek.value = `${year}-W${String(weekNumber).padStart(2, '0')}`;
    }

    // Add week picker click handler
    filterWeek?.addEventListener('click', function(this: HTMLInputElement) {
        try {
            if ('showPicker' in this && typeof this.showPicker === 'function') {
                this.showPicker();
            }
        } catch (error) {
            // showPicker not supported, continue with normal behavior
            console.log('showPicker not supported');
        }
    });
}

/**
 * Setup link button event listeners
 */
function setupLinkButtons(): void {
    // Customer link buttons
    document.getElementById('copyLinkBtn')?.addEventListener('click', copyLink);
    document.getElementById('openCustomerBtn')?.addEventListener('click', openCustomerPage);

    // Manual link buttons
    document.getElementById('copyManualLinkBtn')?.addEventListener('click', copyManualLink);
    document.getElementById('openManualBtn')?.addEventListener('click', openManualPage);

    // Management link buttons
    document.getElementById('copyManagement1Btn')?.addEventListener('click', copyManagement1Link);
    document.getElementById('openManagement1Btn')?.addEventListener('click', openManagement1Page);

    document.getElementById('copyManagement2Btn')?.addEventListener('click', copyManagement2Link);
    document.getElementById('openManagement2Btn')?.addEventListener('click', openManagement2Page);

    document.getElementById('copyManagement3Btn')?.addEventListener('click', copyManagement3Link);
    document.getElementById('openManagement3Btn')?.addEventListener('click', openManagement3Page);

    // Profile link buttons (Linkler sekmesi)
    document.querySelectorAll('[data-copy-profile]').forEach(btn => {
        btn.addEventListener('click', function(this: HTMLElement) {
            const profile = this.dataset.copyProfile;
            if (profile) copyProfileLink(profile);
        });
    });

    document.querySelectorAll('[data-open-profile]').forEach(btn => {
        btn.addEventListener('click', function(this: HTMLElement) {
            const profile = this.dataset.openProfile;
            if (profile) openProfileLink(profile);
        });
    });

    // Load VIP and Staff links
    loadProfileLinks();
}

/**
 * Setup randevu oluştur butonları - aynı sekmede açılır
 */
function setupCreateAppointmentButtons(): void {
    // Mağaza butonu (#b profili)
    document.getElementById('selectManuelBtn')?.addEventListener('click', () => {
        openAppointmentForm('b');
    });

    // Yönetim butonu (#m profili)
    document.getElementById('selectYonetimBtn')?.addEventListener('click', () => {
        openAppointmentForm('m');
    });
}

/**
 * Randevu formunu aynı sekmede aç
 */
function openAppointmentForm(code: 'b' | 'm'): void {
    const baseUrl = (window as any).CONFIG.BASE_URL;
    window.location.href = baseUrl + '#' + code;
}

/**
 * Copy profile link to clipboard
 */
function copyProfileLink(profile: string): void {
    const baseUrl = (window as any).CONFIG.BASE_URL;
    const link = `${baseUrl}#${profile}`;
    navigator.clipboard.writeText(link).then(() => {
        UI.showAlert('Link kopyalandı!', 'success');
    }).catch(() => {
        UI.showAlert('Kopyalama başarısız', 'error');
    });
}

/**
 * Open profile link in new tab
 */
function openProfileLink(profile: string): void {
    const baseUrl = (window as any).CONFIG.BASE_URL;
    const link = `${baseUrl}#${profile}`;
    window.open(link, '_blank');
}

/**
 * Copy staff link to clipboard
 */
function copyStaffLink(type: string, id: string): void {
    const baseUrl = (window as any).CONFIG.BASE_URL;
    const link = `${baseUrl}#${type}/${id}`;
    navigator.clipboard.writeText(link).then(() => {
        UI.showAlert('Link kopyalandı!', 'success');
    }).catch(() => {
        UI.showAlert('Kopyalama başarısız', 'error');
    });
}

/**
 * Open staff link in new tab
 */
function openStaffLink(type: string, id: string): void {
    const baseUrl = (window as any).CONFIG.BASE_URL;
    const link = `${baseUrl}#${type}/${id}`;
    window.open(link, '_blank');
}

/**
 * Load VIP and Staff profile links
 */
async function loadProfileLinks(): Promise<void> {
    try {
        const response = await fetch((window as any).CONFIG.APPS_SCRIPT_URL + '?action=getStaff');
        const data = await response.json();

        if (data.success && data.staff) {
            const vipList: Array<{ id: string; name: string }> = [];
            const staffList: Array<{ id: string; name: string }> = [];

            data.staff.forEach((s: any) => {
                if (s.isVip) {
                    vipList.push({ id: s.id, name: s.name });
                }
                staffList.push({ id: s.id, name: s.name });
            });

            displayVipLinks(vipList);
            displayStaffLinks(staffList);
        }
    } catch (error) {
        console.error('Profile links yüklenemedi:', error);
    }
}

/**
 * Display VIP links
 */
function displayVipLinks(vipList: Array<{ id: string; name: string }>): void {
    const container = document.getElementById('vipLinksGrid');
    if (!container) return;

    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    if (vipList.length === 0) {
        const emptyP = document.createElement('p');
        emptyP.style.cssText = 'color:#666;font-size:14px;';
        emptyP.textContent = 'VIP personeli bulunmuyor';
        container.appendChild(emptyP);
        return;
    }

    vipList.forEach(vip => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px;background:#f9f9f9;border-radius:8px;margin-bottom:10px;';

        const nameSpan = document.createElement('span');
        nameSpan.style.cssText = 'flex:0 0 120px;font-weight:500;';
        nameSpan.textContent = vip.name;

        const codeEl = document.createElement('code');
        codeEl.style.cssText = 'flex:1;font-size:13px;color:#666;';
        codeEl.textContent = `#v/${vip.id}`;

        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn btn-small btn-secondary';
        copyBtn.textContent = 'Kopyala';
        copyBtn.addEventListener('click', () => copyStaffLink('v', vip.id));

        const openBtn = document.createElement('button');
        openBtn.className = 'btn btn-small';
        openBtn.textContent = 'Aç';
        openBtn.addEventListener('click', () => openStaffLink('v', vip.id));

        row.appendChild(nameSpan);
        row.appendChild(codeEl);
        row.appendChild(copyBtn);
        row.appendChild(openBtn);
        container.appendChild(row);
    });
}

/**
 * Display Staff links
 */
function displayStaffLinks(staffList: Array<{ id: string; name: string }>): void {
    const container = document.getElementById('staffLinks');
    if (!container) return;

    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    if (staffList.length === 0) {
        const emptyP = document.createElement('p');
        emptyP.style.cssText = 'color:#666;font-size:14px;';
        emptyP.textContent = 'Personel bulunmuyor';
        container.appendChild(emptyP);
        return;
    }

    staffList.forEach(s => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px;background:#f9f9f9;border-radius:8px;margin-bottom:10px;';

        const nameSpan = document.createElement('span');
        nameSpan.style.cssText = 'flex:0 0 120px;font-weight:500;';
        nameSpan.textContent = s.name;

        const codeEl = document.createElement('code');
        codeEl.style.cssText = 'flex:1;font-size:13px;color:#666;';
        codeEl.textContent = `#s/${s.id}`;

        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn btn-small btn-secondary';
        copyBtn.textContent = 'Kopyala';
        copyBtn.addEventListener('click', () => copyStaffLink('s', s.id));

        const openBtn = document.createElement('button');
        openBtn.className = 'btn btn-small';
        openBtn.textContent = 'Aç';
        openBtn.addEventListener('click', () => openStaffLink('s', s.id));

        row.appendChild(nameSpan);
        row.appendChild(codeEl);
        row.appendChild(copyBtn);
        row.appendChild(openBtn);
        container.appendChild(row);
    });
}
//#endregion

// Start initialization when DOM is ready
document.addEventListener('DOMContentLoaded', initAdmin);
