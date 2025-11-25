// Calendar integration will be lazy loaded when needed
// Removed direct import for bundle size optimization (~15kb saved)

// Import base layer components
import { state } from './StateManager';
import { revealSection, hideSection, showAlert, hideAlert, showLoading, ModalUtils } from './UIManager';

// Import flow components
import { selectAppointmentType, selectManagementContact } from './TypeSelectorComponent';
import { changeMonth } from './CalendarComponent';
import { loadStaffMembers, loadSettings } from './StaffSelectorComponent';
// TimeSelectorComponent functions exported to window for calendar-integration.js
import { initAppointmentForm } from './AppointmentFormComponent';
import { handleCalendarAction } from './SuccessPageComponent';
import './SuccessPageComponent'; // For side effects (window exports)

// Import shared utilities
import { apiCall } from './api-service';
import { initMonitoring } from './monitoring';
import { initConfig } from './config-loader';
import { debounce } from './performance-utils';

// ==================== CONFIG - SINGLE SOURCE OF TRUTH ====================
// ⭐ NEW: Config loaded dynamically from backend API
// - Environment variables (APPS_SCRIPT_URL, BASE_URL): Hardcoded
// - Business config (shifts, hours, limits): Fetched from API
// - Cache: localStorage with 1-hour TTL
// - Fallback: Default values if API fails

// Initialize config asynchronously
(async () => {
    const config = await initConfig();
    (window as any).CONFIG = config;
})();

// ==================== UTILITY FONKSİYONLARI ====================


// Debug logger - Production'da log'ları devre dışı bırakır
// ⚠️ Uses window.CONFIG because CONFIG is loaded asynchronously
// Kept for backward compatibility and debugging
// @ts-ignore - Intentionally unused, kept for future use
const _log = {
    error: (...args: any[]) => (window as any).CONFIG?.DEBUG && console.error(...args),
    warn: (...args: any[]) => (window as any).CONFIG?.DEBUG && console.warn(...args),
    info: (...args: any[]) => (window as any).CONFIG?.DEBUG && console.info(...args),
    log: (...args: any[]) => (window as any).CONFIG?.DEBUG && console.log(...args)
};

// ==================== SMOOTH SCROLL & REVEAL ANIMATIONS ====================
// ⭐ REMOVED: UI functions moved to UIManager.ts
// - revealSection, hideSection: imported from UIManager
// - ModalUtils: imported from UIManager
// - showAlert, hideAlert, showLoading, showLoadingError: imported from UIManager

// ButtonUtils imported from button-utils.ts (duplicate removed)

// ==================== STATE MANAGEMENT ====================

// ⭐ NEW: StateManager for centralized state management
// Global variables replaced with state.get/set pattern
// State is initialized in StateManager.ts with default values

// Initialize state with URL parameters and other startup values
state.set('currentMonth', new Date());

// Export state to window for backward compatibility (calendar-integration.js)
if (typeof window !== 'undefined') {
    (window as any).appState = state;
    // For calendar-integration.js: getter/setter for lastAppointmentData
    Object.defineProperty(window, 'lastAppointmentData', {
        get: () => state.get('lastAppointmentData'),
        set: (value) => state.set('lastAppointmentData', value)
    });
}

// ⭐ REMOVED: sessionStorageCache replaced by CacheManager.ts
// Cache is now imported from CacheManager at the top of the file
// All cache.get/set/has/delete/clear operations use the CacheManager instance
// @ts-ignore - Intentionally unused, kept for backward compatibility
const _CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// ==================== CONFIG LOADING (Backend Single Source of Truth) ====================

/**
 * Backend'den CONFIG yükler - tek kaynak prensib i
 * Cache kullanarak performans optimize eder
 * Fallback olarak mevcut CONFIG kullanılır
 */
// ⚠️ REMOVED: loadConfig() and mergeConfig() - replaced by config-loader.ts
// Config is now loaded via initConfig() (line 22) with localStorage cache
// Old functions created duplicate API calls and race conditions

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize monitoring (Sentry + Web Vitals)
    initMonitoring();

    // ⚠️ Config is loaded via initConfig() IIFE (line 22) - no need to load here
    // CONFIG available globally via window.CONFIG after async initialization

    // ==================== EVENT LISTENERS (HER SAYFA İÇİN) ====================
    // Calendar modal buttons - Lazy loaded handlers
    document.getElementById('calendarAppleBtn')?.addEventListener('click', handleCalendarAction);
    document.getElementById('calendarGoogleBtn')?.addEventListener('click', handleCalendarAction);
    document.getElementById('calendarOutlookBtn')?.addEventListener('click', handleCalendarAction);
    document.getElementById('calendarICSBtn')?.addEventListener('click', handleCalendarAction);
    document.getElementById('calendarModalCloseBtn')?.addEventListener('click', () => ModalUtils.close('calendarModal'));

    // Guide modal event listener
    document.getElementById('guideCloseBtn')?.addEventListener('click', () => ModalUtils.close('guideModal'));

    // ==================== CUSTOMER PAGE INIT ====================
    // Guard: Bu kod sadece customer sayfası (index.html) için çalışmalı
    if (!document.getElementById('appointmentTypesContainer')) {
        return; // Admin sayfasında customer init'i atlat
    }

    // URL parametrelerini hemen kontrol et (API beklemeden)
    const urlParams = new URLSearchParams(window.location.search);
    const specificStaffIdParam = urlParams.get('staff');
    state.set('specificStaffId', specificStaffIdParam);

    // YENİ: URL pathname veya hash'den yönetim linkini kontrol et
    const pathname = window.location.pathname;
    const hash = window.location.hash.replace('#/', '').replace('#', '');
    const basePath = import.meta.env.BASE_URL || '/';
    const relativePath = pathname.replace(basePath, '').replace(/^\//, '');

    // Hash routing (GitHub Pages için) veya path routing
    const route = hash || relativePath;

    if (route === 'hk') {
        state.set('managementLevel', 1);
        state.set('isManagementLink', true);
    } else if (route === 'ok') {
        state.set('managementLevel', 2);
        state.set('isManagementLink', true);
    } else if (route === 'hmk') {
        state.set('managementLevel', 3);
        state.set('isManagementLink', true);
    }

    // Yönetim linki ise UI'yi ayarla
    const isManagementLink = state.get('isManagementLink');
    if (isManagementLink) {
        const header = document.getElementById('staffHeader');
        if (header) {
            header.textContent = 'Randevu Sistemi';
            header.style.visibility = 'visible';
        }

        // Randevu türü seçimi göster (Teslim, Teknik Servis, Görüşme, vs.)
        // selectedAppointmentType henüz seçilmedi - kullanıcı seçecek

        // Gönderi ve Yönetim butonlarını gizle (sadece normal randevu türleri)
        const typeShipping = document.getElementById('typeShipping');
        const typeManagement = document.getElementById('typeManagement');
        if (typeShipping) typeShipping.style.display = 'none';
        if (typeManagement) typeManagement.style.display = 'none';

        // Staff seçimini gizle (random atama yapılacak)
        hideSection('staffSection');
    }
    // YENİ: staff=0 için UI'yi hemen ayarla (API beklemeden)
    const specificStaffId = state.get('specificStaffId');
    if (specificStaffId === '0') {
        const header = document.getElementById('staffHeader');
        if (header) {
            header.textContent = 'Randevu Sistemi';
            header.style.visibility = 'visible';
        }

        // Gönderi ve Yönetim butonlarını göster ve grid'i ayarla
        const typeShipping = document.getElementById('typeShipping');
        const typeManagement = document.getElementById('typeManagement');
        if (typeShipping) typeShipping.style.display = 'block';
        if (typeManagement) typeManagement.style.display = 'block';
        const typesContainer = document.getElementById('appointmentTypesContainer');
        if (typesContainer) typesContainer.style.gridTemplateColumns = 'repeat(2, 1fr)';
    } else if (!specificStaffId) {
        // Normal link için butonları ortala
        const typesContainer = document.getElementById('appointmentTypesContainer');
        if (typesContainer) typesContainer.style.justifyContent = 'center';
    }

    // Ana spinner zaten gösteriliyor, sadece verilerini yükle
    const typesContainer = document.getElementById('appointmentTypesContainer');

    // Load settings first
    await loadSettings();

    // Initialize appointment form
    initAppointmentForm();

    // Staff verilerini yükle
    if (specificStaffId) {
        await loadStaffMembers();

        // Normal staff link için header'ı güncelle
        if (specificStaffId !== '0') {
            const staffMembers = state.get('staffMembers');
            const staff = staffMembers.find((s: any) => s.id == specificStaffId);
            if (staff) {
                const header = document.getElementById('staffHeader');
                if (header) {
                    header.textContent = staff.name;
                    header.style.visibility = 'visible';
                }
                state.set('selectedStaff', parseInt(specificStaffId));
            }
        }
    } else {
        await loadStaffMembers();
    }

    // Ana spinner'ı gizle ve butonları göster
    const mainSpinner = document.getElementById('mainLoadingSpinner');
    if (mainSpinner) {
        mainSpinner.style.display = 'none';
    }

    // ⚡ FIX: Submit butonu ve Turnstile'ı kesinlikle gizle (slot seçilene kadar görünmemeli)
    const submitBtn = document.getElementById('submitBtn');
    const turnstileContainer = document.getElementById('turnstileContainer');
    if (submitBtn) submitBtn.style.display = 'none';
    if (turnstileContainer) turnstileContainer.style.display = 'none';

    // Buton section'ını göster ve animate et
    if (typesContainer) {
        typesContainer.style.display = 'grid';
    }
    revealSection('appointmentTypesSection', false);

    // İlk yükleme animasyonu: Randevu tipi seçimini göster
    const appointmentTypesSection = document.getElementById('appointmentTypesContainer')?.parentElement;
    if (appointmentTypesSection && appointmentTypesSection.classList.contains('section')) {
        setTimeout(() => {
            appointmentTypesSection.classList.add('visible');
        }, 100);
    }

    // Appointment type cards event listeners (async due to dynamic imports)
    document.getElementById('typeDelivery')?.addEventListener('click', () => void selectAppointmentType('delivery'));
    document.getElementById('typeService')?.addEventListener('click', () => void selectAppointmentType('service'));
    document.getElementById('typeMeeting')?.addEventListener('click', () => void selectAppointmentType('meeting'));
    document.getElementById('typeShipping')?.addEventListener('click', () => void selectAppointmentType('shipping'));
    document.getElementById('typeManagement')?.addEventListener('click', () => void selectAppointmentType('management'));

    // HK/OK sub-buton event listeners (async due to dynamic imports)
    document.getElementById('selectHK')?.addEventListener('click', (e) => {
        e.stopPropagation(); // Yönetim kartının tıklanmasını engelle
        void selectManagementContact('HK', 'Haluk Külahçıoğlu');
    });
    document.getElementById('selectOK')?.addEventListener('click', (e) => {
        e.stopPropagation(); // Yönetim kartının tıklanmasını engelle
        void selectManagementContact('OK', 'Onur Külahçıoğlu');
    });

    // Calendar navigation buttons
    // ⚡ PERFORMANCE: Debounce to prevent rapid API spam from fast clicking
    const debouncedChangeMonth = debounce(changeMonth, 300);
    document.getElementById('prevMonthBtn')?.addEventListener('click', () => debouncedChangeMonth(-1));
    document.getElementById('nextMonthBtn')?.addEventListener('click', () => debouncedChangeMonth(1));
});

// ⭐ TypeSelector functions moved to TypeSelectorComponent.ts
// ⭐ Calendar functions moved to CalendarComponent.ts (changeMonth, renderCalendar, checkDayAvailability, selectDay, loadMonthData)

// GÜVENLİ FETCH API İMPLEMENTASYONU
// JSONP yerine modern Fetch API kullanımı - XSS ve CSRF koruması

// API çağrısı için wrapper - Tutarlı hata yönetimi
// Kept for backward compatibility - currently unused but may be needed
// @ts-ignore - Intentionally unused, kept for future use
async function _safeApiCall(action: string, params: any = {}, options: {
    successMessage?: string;
    errorPrefix?: string;
    onSuccess?: (response: any) => void;
    onError?: (error: any) => void;
    showLoading?: boolean;
} = {}) {
    const {
        successMessage,
        errorPrefix = 'Hata',
        onSuccess,
        onError,
        showLoading: shouldShowLoading = false
    } = options;

    if (shouldShowLoading) showLoading();

    try {
        const response = await apiCall(action, params);

        if (response.success) {
            if (successMessage) showAlert(successMessage, 'success');
            if (onSuccess) onSuccess(response);
            return response;
        } else {
            const msg = `❌ ${errorPrefix}: ${response.error}`;
            showAlert(msg, 'error');
            if (onError) onError(response);
            return response;
        }
    } catch (error: any) {
        const msg = `❌ ${errorPrefix}: ${error?.message || 'Bilinmeyen hata'}`;
        showAlert(msg, 'error');
        if (onError) onError(error);
        throw error;
    } finally {
        if (shouldShowLoading) hideAlert();
    }
}

// apiCall function moved to api-service.js (DRY principle)
// Now imported at the top of this file

// ⭐ StaffSelector functions moved to StaffSelectorComponent.ts (loadStaffMembers, loadSettings, displayAvailableStaff, selectStaff)

// ⭐ TimeSelector functions moved to TimeSelectorComponent.ts (displayAvailableTimeSlots, selectTimeSlot)

// ⭐ Form submission moved to AppointmentFormComponent.ts (initAppointmentForm)

// ⭐ Success page and calendar functions moved to SuccessPageComponent.ts (showSuccessPage, handleCalendarAction, addToCalendar, onTurnstileSuccess)
