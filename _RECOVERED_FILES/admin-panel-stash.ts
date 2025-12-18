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
    UI.showAlert('✅ Link kopyalandı!', 'success');
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
    UI.showAlert('✅ Manuel randevu linki kopyalandı!', 'success');
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
    UI.showAlert('✅ Yönetim-1 linki kopyalandı!', 'success');
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
    UI.showAlert('✅ Yönetim-2 linki kopyalandı!', 'success');
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
    UI.showAlert('✅ Yönetim-3 linki kopyalandı!', 'success');
}

function openManagement3Page(): void {
    const link = (document.getElementById('management3Link') as HTMLInputElement).value;
    if (link && !link.includes('⚠️')) {
        window.open(link, '_blank');
    }
}
//#endregion

//#region Initialization

// AdminAuth yükleme için retry sayacı
let adminAuthRetryCount = 0;
const MAX_ADMIN_AUTH_RETRIES = 100; // 5 saniye (50ms x 100)

/**
 * Loading overlay'i gizle - HER ZAMAN çalışır
 */
function hideLoadingOverlay(): void {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
        loadingOverlay.style.visibility = 'hidden';
        loadingOverlay.style.opacity = '0';
        loadingOverlay.style.pointerEvents = 'none';
    }
}

/**
 * Hata mesajı göster
 */
function showAdminError(message: string): void {
    hideLoadingOverlay();
    document.body.innerHTML = `
        <div style="display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;font-family:sans-serif;background:#f5f5f5;">
            <h1 style="color:#d32f2f;margin-bottom:16px;">⚠️ Yükleme Hatası</h1>
            <p style="color:#666;margin-bottom:24px;">${message}</p>
            <button onclick="location.reload()" style="padding:12px 24px;background:#1976d2;color:white;border:none;border-radius:8px;cursor:pointer;font-size:16px;">
                🔄 Sayfayı Yenile
            </button>
        </div>
    `;
}

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
        adminAuthRetryCount++;

        // Maximum bekleme süresini aştıysa hata göster
        if (adminAuthRetryCount >= MAX_ADMIN_AUTH_RETRIES) {
            console.error('[Admin] AdminAuth modülü yüklenemedi!');
            showAdminError('Admin modülü yüklenemedi. Lütfen sayfayı yenileyin veya önbelleği temizleyin.');
            return;
        }

        // Module not loaded yet, wait a bit and try again
        setTimeout(initAdmin, 50);
        return;
    }

    // AdminAuth yüklendi - önce MUTLAKA loading'i gizle
    hideLoadingOverlay();

    // Authentication kontrolü
    if (!window.AdminAuth.isAuthenticated()) {
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

        // Setup tabs
        setupTabs();

        // Setup links
        setupLinks();

        // Setup week filter for appointments
        setupWeekFilter();

        // Setup link button event listeners
        setupLinkButtons();

        // Hide loading overlay and show tabs
        const loadingOverlay = document.getElementById('loadingOverlay');
        const tabs = document.querySelector('.tabs') as HTMLElement;

        if (loadingOverlay) loadingOverlay.style.display = 'none';
        if (tabs) tabs.style.display = 'flex';

    } catch (error) {
        console.error('Admin panel başlatma hatası:', error);
        logError(error, { context: 'startApp' });
        UI.showAlert('❌ Yönetim paneli başlatılamadı', 'error');
    }
}

/**
 * Setup tab switching
 */
function setupTabs(): void {
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
}
//#endregion

// Start initialization when DOM is ready
document.addEventListener('DOMContentLoaded', initAdmin);
