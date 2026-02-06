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
import { initWhatsAppManager } from './admin/whatsapp-manager';
import { initWhatsAppChat } from './admin/whatsapp-chat';
import { initMailManager } from './admin/mail-manager';
import { initUnifiedFlowManager } from './admin/unified-flow-manager';
import { initPermissionManager } from './admin/permission-manager';
import { initProfileSettingsManager } from './admin/profile-settings-manager';
import { setupAllModalCloseHandlers } from './ui-utils';
import EventListenerManager from './event-listener-manager';
import { AdminAuth } from './admin-auth';

// Extend Window interface for admin panel specific properties
declare global {
    interface Window {
        __monitoringInitialized?: boolean;
    }
}
//#endregion

//#region Configuration
// CONFIG - SINGLE SOURCE OF TRUTH
// Config loaded inside initAdmin() to prevent race conditions
// - Environment variables (APPS_SCRIPT_URL, BASE_URL): Hardcoded in config-loader
// - Business config (shifts, hours, limits): Fetched from API
// - Cache: localStorage with 1-hour TTL
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
        // Deactivate all main tabs and hide content
        document.querySelectorAll('.main-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.main-tab-content').forEach(c => {
            c.classList.remove('active');
            (c as HTMLElement).style.display = 'none';
        });

        // Activate selected main tab and show content
        const selectedTab = document.querySelector(`.main-tab[data-maintab="${tabName}"]`);
        const selectedContent = document.getElementById(tabName);

        selectedTab?.classList.add('active');
        if (selectedContent) {
            selectedContent.classList.add('active');
            selectedContent.style.display = 'block';
        }
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

// ⚡ v3.9.13: Consolidated link utility functions (DRY principle - reduced 70 lines to 20)
function copyLinkById(inputId: string, successMessage: string): void {
    const linkInput = document.getElementById(inputId) as HTMLInputElement;
    if (linkInput) {
        navigator.clipboard.writeText(linkInput.value).then(() => {
            UI.showAlert(successMessage, 'success');
        }).catch(() => {
            // Fallback for older browsers
            linkInput.select();
            try { document.execCommand('copy'); } catch (_) { /* noop */ }
            UI.showAlert(successMessage, 'success');
        });
    }
}

function openLinkById(inputId: string): void {
    const link = (document.getElementById(inputId) as HTMLInputElement)?.value;
    if (link && !link.includes('⚠️')) {
        window.open(link, '_blank');
    }
}

// Convenience wrappers for backward compatibility
const copyLink = () => copyLinkById('customerLink', 'Link kopyalandı!');
const openCustomerPage = () => openLinkById('customerLink');
const copyManualLink = () => copyLinkById('manualLink', 'Manuel randevu linki kopyalandı!');
const openManualPage = () => openLinkById('manualLink');
const copyManagement1Link = () => copyLinkById('management1Link', 'Yönetim-1 linki kopyalandı!');
const copyManagement2Link = () => copyLinkById('management2Link', 'Yönetim-2 linki kopyalandı!');
const copyManagement3Link = () => copyLinkById('management3Link', 'Yönetim-3 linki kopyalandı!');
//#endregion

//#region Initialization
/**
 * Initialize admin panel
 */
async function initAdmin(): Promise<void> {
    // Initialize config FIRST (prevents race condition with IIFE)
    const config = await initConfig();
    (window as any).CONFIG = config;

    // Initialize monitoring (Sentry + Web Vitals) - only once
    if (!window.__monitoringInitialized) {
        initMonitoring();
        window.__monitoringInitialized = true;
    }

    // Authentication kontrolü (ES6 import - window global'e bağımlı değil)
    if (!AdminAuth.isAuthenticated()) {
        // Loading overlay'i gizle (login modal görünsün)
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) loadingOverlay.style.display = 'none';

        AdminAuth.showLoginModal();
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
        AdminAuth.addLogoutButton();

        // Start inactivity tracking
        AdminAuth._startActivityTracking();

        // Initialize data store
        const dataStore = initDataStore();

        // Load profile settings first (needed for appointment manager)
        await dataStore.loadProfilAyarlari();

        // Initialize all manager modules in parallel (performance optimization)
        await Promise.all([
            initStaffManager(dataStore),
            initShiftManager(dataStore),
            initSettingsManager(dataStore),
        ]);

        // Second wave: depends on staff/settings being loaded
        await Promise.all([
            initAppointmentManager(dataStore),
            initWhatsAppManager(dataStore),
            initMailManager(dataStore),
            initUnifiedFlowManager(dataStore),
        ]);

        // Permission & profile: depends on all managers being ready
        await initPermissionManager(dataStore);
        await initProfileSettingsManager();

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

        // Setup modal close handlers (overlay click to close)
        setupAllModalCloseHandlers();

        // Hide loading overlay and show main tabs + content
        const loadingOverlay = document.getElementById('loadingOverlay');
        const mainTabs = document.querySelector('.main-tabs') as HTMLElement;
        const activeContent = document.querySelector('.main-tab-content.active') as HTMLElement;

        if (loadingOverlay) loadingOverlay.style.display = 'none';
        if (mainTabs) mainTabs.style.display = 'flex';
        if (activeContent) activeContent.style.display = 'block';

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
                    initWhatsAppChat();
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

    // Render quick links (Genel, Günlük)
    renderQuickLinks();
}

/**
 * Render quick links (Genel, Günlük - başlıksız)
 */
function renderQuickLinks(): void {
    const container = document.getElementById('quickLinksGrid');
    if (!container) return;

    const quickLinks = [
        { name: 'Genel', code: 'g' },
        { name: 'Günlük', code: 'w' }
    ];

    quickLinks.forEach(link => {
        container.appendChild(createStaticLinkCard(link.name, link.code));
    });
}

/**
 * Create a static link card element
 */
function createStaticLinkCard(name: string, code: string): HTMLElement {
    const card = document.createElement('div');
    card.className = 'link-card';

    const nameDiv = document.createElement('div');
    nameDiv.className = 'link-card-name';
    nameDiv.textContent = name;

    const urlDiv = document.createElement('div');
    urlDiv.className = 'link-card-url';
    const baseUrl = (window as any).CONFIG.BASE_URL;
    urlDiv.textContent = `${baseUrl}#${code}`;

    const btnsDiv = document.createElement('div');
    btnsDiv.className = 'link-card-btns';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'link-btn';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', () => copyProfileLink(code));

    const openBtn = document.createElement('button');
    openBtn.className = 'link-btn link-btn-primary';
    openBtn.textContent = 'Open';
    openBtn.addEventListener('click', () => openProfileLink(code));

    btnsDiv.appendChild(copyBtn);
    btnsDiv.appendChild(openBtn);

    card.appendChild(nameDiv);
    card.appendChild(urlDiv);
    card.appendChild(btnsDiv);

    return card;
}

/**
 * Setup week filter for appointments
 * Varsayılan: Bugün ve sonrası (boş) - Bugün tarihi gösterilir
 * Kullanıcı hafta seçerse: Pazartesi - Pazar tarih aralığı gösterilir
 */
function setupWeekFilter(): void {
    const filterWeek = document.getElementById('filterWeek') as HTMLInputElement;
    const clearBtn = document.getElementById('clearWeekFilter') as HTMLButtonElement;
    const filterLabel = document.getElementById('filterLabel') as HTMLSpanElement;

    const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
                       'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

    // Tarihi "21 Aralık 2025" formatında göster
    const formatDate = (date: Date): string => {
        return `${date.getDate()} ${MONTHS_TR[date.getMonth()]} ${date.getFullYear()}`;
    };

    // Hafta değerinden Pazartesi ve Pazar tarihlerini hesapla
    const getWeekDates = (weekValue: string): { monday: Date; sunday: Date } => {
        const [year, week] = weekValue.split('-W').map(Number);
        // ISO hafta - 1 Ocak'tan itibaren hesapla
        const jan4 = new Date(year, 0, 4); // 4 Ocak her zaman 1. haftada
        const dayOfWeek = jan4.getDay() || 7; // Pazar = 7
        const monday = new Date(jan4);
        monday.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        return { monday, sunday };
    };

    // Label formatını belirle
    const formatWeekLabel = (weekValue: string): string => {
        if (!weekValue) {
            // Boşken bugün tarihi göster
            return formatDate(new Date());
        }
        // Hafta seçilince tarih aralığı göster
        const { monday, sunday } = getWeekDates(weekValue);
        return `${formatDate(monday)} - ${formatDate(sunday)}`;
    };

    // UI güncelle
    const updateFilterUI = () => {
        const hasValue = !!filterWeek?.value;
        if (clearBtn) clearBtn.style.display = hasValue ? 'inline-block' : 'none';
        if (filterLabel) filterLabel.textContent = formatWeekLabel(filterWeek?.value || '');
        // Toggle has-value class for placeholder visibility
        if (filterWeek) {
            filterWeek.classList.toggle('has-value', hasValue);
        }
    };

    // Week picker click handler
    filterWeek?.addEventListener('click', function(this: HTMLInputElement) {
        try {
            if ('showPicker' in this && typeof this.showPicker === 'function') {
                this.showPicker();
            }
        } catch (error) {
            // showPicker not supported
        }
    });

    // Week change handler - UI güncelle
    filterWeek?.addEventListener('change', updateFilterUI);

    // Clear button handler
    clearBtn?.addEventListener('click', () => {
        if (filterWeek) {
            filterWeek.value = '';
            updateFilterUI();
            // Trigger change event to reload appointments
            filterWeek.dispatchEvent(new Event('change'));
        }
    });

    // Initial UI state
    updateFilterUI();
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
 * Randevu akışını iframe içinde göster
 * v3.7: staffFilter='user' desteği - giriş yapan admin'in ID'sini iframe'e geçir
 */
function openAppointmentForm(code: 'b' | 'm'): void {
    const baseUrl = (window as any).CONFIG.BASE_URL;
    const container = document.getElementById('appointmentFlowContainer');
    const iframe = document.getElementById('appointmentFlowFrame') as HTMLIFrameElement;

    if (container && iframe) {
        // Aktif butonu işaretle
        document.querySelectorAll('.profile-select-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const activeBtn = code === 'b' ? 'selectManuelBtn' : 'selectYonetimBtn';
        document.getElementById(activeBtn)?.classList.add('active');

        // Iframe'i sıfırla ve yeni URL'i ayarla (zorla reload)
        iframe.src = 'about:blank';
        container.style.display = 'block';

        // v3.7: Giriş yapan admin'in staff ID'sini al (staffFilter='user' için)
        const currentUser = AdminAuth.getCurrentUser();
        const autoStaffParam = currentUser?.id ? `?autoStaff=${currentUser.id}` : '';

        // Kısa gecikme ile yeni src ayarla
        setTimeout(() => {
            iframe.src = baseUrl + autoStaffParam + '#' + code;
        }, 50);

        // Scroll to iframe
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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
        const result = await response.json();

        // API returns { success: true, data: [...] }
        const staffList = result.data || result.staff || [];

        if (result.success && staffList.length > 0) {
            // Özel Müşteri = role: management
            const managementList: Array<{ id: string; name: string }> = [];
            // Personel = role: sales
            const salesList: Array<{ id: string; name: string }> = [];

            staffList.forEach((s: any) => {
                if (!s.active) return;
                if (s.role === 'management') {
                    managementList.push({ id: s.id, name: s.name });
                } else if (s.role === 'sales') {
                    salesList.push({ id: s.id, name: s.name });
                }
            });

            displayVipLinks(managementList);
            displayStaffLinks(salesList);
        }
    } catch (error) {
        console.error('Profile links yüklenemedi:', error);
    }
}

/**
 * Display VIP links (Management role)
 */
function displayVipLinks(vipList: Array<{ id: string; name: string }>): void {
    const container = document.getElementById('vipLinksGrid');
    if (!container) return;

    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    if (vipList.length === 0) {
        const emptyP = document.createElement('p');
        emptyP.style.cssText = 'color:#999;font-size:13px;';
        emptyP.textContent = 'Yönetim personeli bulunmuyor';
        container.appendChild(emptyP);
        return;
    }

    // Grid layout - 2 column
    container.className = 'link-grid';

    vipList.forEach(vip => {
        container.appendChild(createLinkCard(vip.name, 'v', vip.id));
    });

    // Son tek karta full-width class ekle
    if (vipList.length % 2 === 1 && container.lastElementChild) {
        container.lastElementChild.classList.add('link-card-full');
    }
}

/**
 * Display Staff links (Sales role)
 */
function displayStaffLinks(staffList: Array<{ id: string; name: string }>): void {
    const container = document.getElementById('staffLinks');
    if (!container) return;

    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    if (staffList.length === 0) {
        const emptyP = document.createElement('p');
        emptyP.style.cssText = 'color:#999;font-size:13px;';
        emptyP.textContent = 'Satış personeli bulunmuyor';
        container.appendChild(emptyP);
        return;
    }

    // Grid layout - 2 column
    container.className = 'link-grid';

    staffList.forEach(s => {
        container.appendChild(createLinkCard(s.name, 's', s.id));
    });

    // Son tek karta full-width class ekle
    if (staffList.length % 2 === 1 && container.lastElementChild) {
        container.lastElementChild.classList.add('link-card-full');
    }
}

/**
 * Create a link card element
 */
function createLinkCard(name: string, type: string, id: string): HTMLElement {
    const card = document.createElement('div');
    card.className = 'link-card';

    const nameDiv = document.createElement('div');
    nameDiv.className = 'link-card-name';
    nameDiv.textContent = name;

    const urlDiv = document.createElement('div');
    urlDiv.className = 'link-card-url';
    const baseUrl = (window as any).CONFIG.BASE_URL;
    urlDiv.textContent = `${baseUrl}#${type}/${id}`;

    const btnsDiv = document.createElement('div');
    btnsDiv.className = 'link-card-btns';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'link-btn';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', () => copyStaffLink(type, id));

    const openBtn = document.createElement('button');
    openBtn.className = 'link-btn link-btn-primary';
    openBtn.textContent = 'Open';
    openBtn.addEventListener('click', () => openStaffLink(type, id));

    btnsDiv.appendChild(copyBtn);
    btnsDiv.appendChild(openBtn);

    card.appendChild(nameDiv);
    card.appendChild(urlDiv);
    card.appendChild(btnsDiv);

    return card;
}
//#endregion

//#region Event Listener Cleanup
// Global event listener manager for admin panel cleanup
export const adminEventManager = new EventListenerManager();

// Export for use in admin sub-modules
if (typeof window !== 'undefined') {
    (window as any).adminEventManager = adminEventManager;
}

// Cleanup on page unload to prevent memory leaks
window.addEventListener('beforeunload', () => {
    adminEventManager.cleanup();
});
//#endregion

// Start initialization when DOM is ready
document.addEventListener('DOMContentLoaded', initAdmin);
