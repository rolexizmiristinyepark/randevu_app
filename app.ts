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
import { initConfig, checkAndInvalidateCache } from './config-loader';
import { debounce } from './performance-utils';

// Import profile resolver (v3.2 - unified ?id=xxx format)
import { initProfileFromURL, applyProfileUI, showInvalidIdError, ProfilInfo } from './ProfileResolver';

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

    // Cache senkronizasyonu
    await checkAndInvalidateCache();

    // ⚠️ Config is loaded via initConfig() IIFE (line 22) - no need to load here
    // CONFIG available globally via window.CONFIG after async initialization

    // ==================== TURNSTILE WIDGET INIT ====================
    // Turnstile widget'ı index.html'deki inline script ile render ediliyor
    // Site key: window.TURNSTILE_SITE_KEY (config-loader.ts'den)

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

    // ==================== v3.2: Unified ?id=xxx URL Format ====================
    // Backend'den ID tipini çözümle ve profil belirle
    const profileInfo: ProfilInfo = await initProfileFromURL();

    // Geçersiz ID ise uyarı göster
    if (!profileInfo.isValid && profileInfo.id) {
        showInvalidIdError();
    }

    // Profil bazlı UI ayarlarını uygula
    applyProfileUI(profileInfo);

    // v3.2: Profil ayarlarını backend'den yükle
    let profilAyarlari: any = null;
    try {
        const ayarResponse = await apiCall('getProfilAyarlari', { profil: profileInfo.profil });
        if (ayarResponse.success) {
            profilAyarlari = ayarResponse.data;
            state.set('profilAyarlari', profilAyarlari);
        }
    } catch (e) {
        console.warn('Profil ayarları yüklenemedi:', e);
    }

    // v3.4: Profil ayarlarına göre UI düzenle
    // takvimFiltresi: 'bugun' = takvim gösterilmez, bugün otomatik seçilir
    //                 'hepsi' = takvim gösterilir, müşteri seçer
    let todayOnlyCalendar = false;
    if (profilAyarlari) {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        // Takvim filtresi kontrolü
        if (profilAyarlari.takvimFiltresi === 'bugun') {
            // Sadece bugün: Takvim gösterilmez, bugün otomatik seçilir
            state.set('selectedDate', todayStr);
            todayOnlyCalendar = true;
        } else {
            // Tüm günler: Varsayılan tarih sameDayBooking'e göre
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const defaultDate = profilAyarlari.sameDayBooking
                ? todayStr
                : tomorrow.toISOString().split('T')[0];
            state.set('selectedDate', defaultDate);
        }

        // v3.5: staffFilter kontrolü
        // - none: Personel seçimi gösterilmez, admin sonradan atar
        // - self: URL'deki personel otomatik seçilir, personel seçimi gösterilmez
        // - all/role:sales/role:management: Personel listesi gösterilir (filtreleme StaffSelectorComponent'te)
        if (profilAyarlari.staffFilter === 'none' || profilAyarlari.staffFilter === 'self') {
            hideSection('staffSection');
        }

    }

    // v3.4: allowedTypes'a göre randevu türü kartlarını filtrele
    // 1 tür seçili → otomatik seç ve gizle, 2+ tür → müşteri seçsin
    // NOT: Tek tür kontrolü aşağıda revealSection'dan sonra yapılacak (sıralama önemli)
    let singleTypeSelected = false;
    if (profilAyarlari?.allowedTypes && profilAyarlari.allowedTypes.length > 0) {
        const allowedTypes = profilAyarlari.allowedTypes;
        const typeCards = [
            { id: 'typeDelivery', type: 'delivery' },
            { id: 'typeService', type: 'service' },
            { id: 'typeMeeting', type: 'meeting' },
            { id: 'typeShipping', type: 'shipping' },
            { id: 'typeManagement', type: 'management' }
        ];

        // Kartları filtrele
        typeCards.forEach(card => {
            const element = document.getElementById(card.id);
            if (element) {
                if (allowedTypes.includes(card.type)) {
                    element.style.display = '';
                } else {
                    element.style.display = 'none';
                }
            }
        });

        // 1 tür seçili ise: otomatik seç (gizleme aşağıda yapılacak)
        if (allowedTypes.length === 1) {
            state.set('selectedAppointmentType', allowedTypes[0]);
            singleTypeSelected = true;
        }
        // 2+ tür seçili ise: müşteri seçsin (kartlar görünür)
    }

    // Ana spinner zaten gösteriliyor, sadece verilerini yükle
    const typesContainer = document.getElementById('appointmentTypesContainer');

    // Load settings first
    await loadSettings();

    // Initialize appointment form
    initAppointmentForm();

    // Staff verilerini yükle
    await loadStaffMembers();

    // Personel linki ise selectedStaff'ı ayarla
    if (profileInfo.profil === 'personel' && profileInfo.data?.id) {
        const staffMembers = state.get('staffMembers');
        const staff = staffMembers.find((s: any) => s.id === profileInfo.data?.id);
        if (staff) {
            state.set('selectedStaff', staff.id);
        }
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

    // Buton section'ını göster ve animate et (tek tür seçili değilse)
    if (!singleTypeSelected) {
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
    } else {
        // Tek tür seçili: Section'ı gizle
        if (todayOnlyCalendar) {
            // Sadece bugün: Takvimi de gizle, direkt staff/time'a geç
            const { selectDay } = await import('./CalendarComponent');
            await selectDay(state.get('selectedDate')!);
        } else {
            // Tüm günler: Takvimi göster
            const { renderCalendar, loadMonthData } = await import('./CalendarComponent');
            revealSection('calendarSection');
            renderCalendar();
            await loadMonthData();
        }
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
