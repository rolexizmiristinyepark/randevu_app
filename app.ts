// Calendar integration will be lazy loaded when needed
// Removed direct import for bundle size optimization (~15kb saved)

// Import base layer components
import { state } from './StateManager';
import { cache } from './CacheManager';
import { UIManager, revealSection, hideSection, showAlert, hideAlert, showLoading, showLoadingError, ModalUtils } from './UIManager';

// Import flow components
import { selectAppointmentType, selectManagementContact } from './TypeSelectorComponent';
import { renderCalendar, changeMonth, loadMonthData } from './CalendarComponent';
import { loadStaffMembers, loadSettings, displayAvailableStaff, selectStaff } from './StaffSelectorComponent';
import { displayAvailableTimeSlots, selectTimeSlot } from './TimeSelectorComponent';

// Import shared utilities
import { StringUtils } from './string-utils';
import { ButtonUtils } from './button-utils';
import { showAlertSafe } from './security-helpers';
import { apiCall } from './api-service';
import { initMonitoring, logError, measureAsync } from './monitoring';
import { initConfig, Config } from './config-loader';
import rolexLogoUrl from './assets/rolex-logo.svg';

// ==================== CONFIG - SINGLE SOURCE OF TRUTH ====================
// ⭐ NEW: Config loaded dynamically from backend API
// - Environment variables (APPS_SCRIPT_URL, BASE_URL): Hardcoded
// - Business config (shifts, hours, limits): Fetched from API
// - Cache: localStorage with 1-hour TTL
// - Fallback: Default values if API fails

let CONFIG: Config;

// Initialize config asynchronously
(async () => {
    CONFIG = await initConfig();
    // CONFIG now available globally via window.CONFIG
})();

// ==================== UTILITY FONKSİYONLARI ====================


// Debug logger - Production'da log'ları devre dışı bırakır
// ⚠️ Uses window.CONFIG because CONFIG is loaded asynchronously
const log = {
    error: (...args) => (window as any).CONFIG?.DEBUG && console.error(...args),
    warn: (...args) => (window as any).CONFIG?.DEBUG && console.warn(...args),
    info: (...args) => (window as any).CONFIG?.DEBUG && console.info(...args),
    log: (...args) => (window as any).CONFIG?.DEBUG && console.log(...args)
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
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes - kept for backward compatibility

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
        header.textContent = 'Randevu Sistemi';
        header.style.visibility = 'visible';

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
        header.textContent = 'Randevu Sistemi';
        header.style.visibility = 'visible';

        // Gönderi ve Yönetim butonlarını göster ve grid'i ayarla
        document.getElementById('typeShipping').style.display = 'block';
        document.getElementById('typeManagement').style.display = 'block';
        const typesContainer = document.getElementById('appointmentTypesContainer');
        typesContainer.style.gridTemplateColumns = 'repeat(2, 1fr)';
    } else if (!specificStaffId) {
        // Normal link için butonları ortala
        const typesContainer = document.getElementById('appointmentTypesContainer');
        typesContainer.style.justifyContent = 'center';
    }

    // Ana spinner zaten gösteriliyor, sadece verilerini yükle
    const typesContainer = document.getElementById('appointmentTypesContainer');

    // Load settings first
    await loadSettings();

    // Staff verilerini yükle
    if (specificStaffId) {
        await loadStaffMembers();

        // Normal staff link için header'ı güncelle
        if (specificStaffId !== '0') {
            const staffMembers = state.get('staffMembers');
            const staff = staffMembers.find(s => s.id == specificStaffId);
            if (staff) {
                const header = document.getElementById('staffHeader');
                header.textContent = staff.name;
                header.style.visibility = 'visible';
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

    // Buton section'ını göster ve animate et
    typesContainer.style.display = 'grid';
    revealSection('appointmentTypesSection', false);

    // İlk yükleme animasyonu: Randevu tipi seçimini göster
    const appointmentTypesSection = document.getElementById('appointmentTypesContainer')?.parentElement;
    if (appointmentTypesSection && appointmentTypesSection.classList.contains('section')) {
        setTimeout(() => {
            appointmentTypesSection.classList.add('visible');
        }, 100);
    }

    // Appointment type cards event listeners
    document.getElementById('typeDelivery')?.addEventListener('click', () => selectAppointmentType('delivery'));
    document.getElementById('typeService')?.addEventListener('click', () => selectAppointmentType('service'));
    document.getElementById('typeMeeting')?.addEventListener('click', () => selectAppointmentType('meeting'));
    document.getElementById('typeShipping')?.addEventListener('click', () => selectAppointmentType('shipping'));
    document.getElementById('typeManagement')?.addEventListener('click', () => selectAppointmentType('management'));

    // HK/OK sub-buton event listeners
    document.getElementById('selectHK')?.addEventListener('click', (e) => {
        e.stopPropagation(); // Yönetim kartının tıklanmasını engelle
        selectManagementContact('HK', 'Haluk Külahçıoğlu');
    });
    document.getElementById('selectOK')?.addEventListener('click', (e) => {
        e.stopPropagation(); // Yönetim kartının tıklanmasını engelle
        selectManagementContact('OK', 'Onur Külahçıoğlu');
    });

    // Calendar navigation buttons
    document.getElementById('prevMonthBtn')?.addEventListener('click', () => changeMonth(-1));
    document.getElementById('nextMonthBtn')?.addEventListener('click', () => changeMonth(1));
});

// ⭐ TypeSelector functions moved to TypeSelectorComponent.ts
// ⭐ Calendar functions moved to CalendarComponent.ts (changeMonth, renderCalendar, checkDayAvailability, selectDay, loadMonthData)

// GÜVENLİ FETCH API İMPLEMENTASYONU
// JSONP yerine modern Fetch API kullanımı - XSS ve CSRF koruması

// API çağrısı için wrapper - Tutarlı hata yönetimi
async function safeApiCall(action, params = {}, options = {}) {
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
    } catch (error) {
        const msg = `❌ ${errorPrefix}: ${error.message}`;
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

document.getElementById('submitBtn')?.addEventListener('click', async () => {
    const name = StringUtils.toTitleCase(document.getElementById('customerName').value.trim());
    const phone = document.getElementById('customerPhone').value.trim();
    const email = document.getElementById('customerEmail').value.trim();
    const note = document.getElementById('customerNote').value.trim();

    // Get state values
    const selectedAppointmentType = state.get('selectedAppointmentType');
    const selectedDate = state.get('selectedDate');
    const selectedStaff = state.get('selectedStaff');
    const selectedTime = state.get('selectedTime');
    const selectedShiftType = state.get('selectedShiftType');
    const isManagementLink = state.get('isManagementLink');
    const managementLevel = state.get('managementLevel');
    const staffMembers = state.get('staffMembers');

    // Cloudflare Turnstile token kontrolü
    const turnstileToken = window.turnstile?.getResponse();
    if (!turnstileToken) {
        showAlert('Lütfen robot kontrolünü tamamlayın.', 'error');
        return;
    }

    if (!selectedAppointmentType) {
        showAlert('Lutfen randevu tipi secin.', 'error');
        return;
    }

    // YENİ: selectedStaff için -1 (yönetim linki random), 0 (normal yönetim), pozitif sayı (personel) geçerli
    if (!selectedDate || selectedStaff === null || selectedStaff === undefined || !selectedTime) {
        showAlert('Lutfen tarih, calisan ve saat secin.', 'error');
        return;
    }

    if (!name || !phone) {
        showAlert('Lutfen ad ve telefon bilgilerinizi girin.', 'error');
        return;
    }

    if (!email) {
        showAlert('Lutfen e-posta adresinizi girin.', 'error');
        return;
    }

    const btn = document.getElementById('submitBtn');
    ButtonUtils.setLoading(btn, 'Randevu oluşturuluyor');

    // YENİ: staff=0 için staffName yerine managementContactPerson kullan
    let staffName;
    let staff = null;
    let assignedStaffId = selectedStaff;

    // Yönetim linki ise (hk, ok, hmk) - personel ataması yapma, admin atayacak
    if (isManagementLink) {
        // Personel atanmamış randevu olarak oluştur
        assignedStaffId = null;
        staffName = 'Atanmadı'; // Placeholder
    } else if (selectedStaff === 0) {
        staffName = window.managementContactPerson || 'Yönetim';
        assignedStaffId = 0;
    } else {
        staff = staffMembers.find(s => s.id == selectedStaff);
        if (!staff) {
            showAlert('Çalışan bilgisi bulunamadı. Lütfen sayfayı yenileyin.', 'error');
            btn.disabled = false;
            btn.textContent = 'Randevuyu Onayla';
            return;
        }
        staffName = staff.name;
    }

    try {
        const result = await apiCall('createAppointment', {
            date: selectedDate,
            time: selectedTime,
            staffId: assignedStaffId,
            staffName: staffName,
            customerName: name,
            customerPhone: phone,
            customerEmail: email,
            customerNote: note,
            shiftType: selectedShiftType,
            appointmentType: selectedAppointmentType,
            duration: (window as any).CONFIG?.APPOINTMENT_HOURS?.interval || 30,
            turnstileToken: turnstileToken,  // Bot protection token
            managementLevel: managementLevel,  // Yönetim linki seviyesi (1, 2, 3 veya null)
            isVipLink: isManagementLink  // VIP link flag (#hk, #ok, #hmk)
        });

        if (result.success) {
            // Son randevu bilgilerini kaydet
            const appointmentData = {
                customerName: name,
                customerPhone: phone,
                customerEmail: email,
                customerNote: note,
                staffName: staffName,
                staffPhone: staff?.phone || '',
                staffEmail: staff?.email || '',
                date: selectedDate,
                time: selectedTime,
                appointmentType: selectedAppointmentType,
                duration: (window as any).CONFIG?.APPOINTMENT_HOURS?.interval || 30
            };
            state.set('lastAppointmentData', appointmentData);

            // Export to window for calendar-integration.js module access
            // (window.lastAppointmentData is already configured as getter/setter at line 118)

            showSuccessPage(selectedDate, selectedTime, staffName, note);
        } else {
            showAlert('Randevu olusturulamadi: ' + (result.error || 'Bilinmeyen hata'), 'error');
            ButtonUtils.reset(btn);
        }
    } catch (error) {
        logError(error, { context: 'confirmAppointment', selectedStaff, selectedDate, selectedTime });
        showAlert('Randevu oluşturulamadı. Lütfen tekrar deneyiniz.', 'error');
        ButtonUtils.reset(btn);
    }
});

// ⭐ REMOVED: Alert and loading functions moved to UIManager.ts
// - showAlert, hideAlert, showLoading, showLoadingError: imported from UIManager
// These functions are now imported at the top of the file

function showSuccessPage(dateStr, timeStr, staffName, customerNote) {
    const container = document.querySelector('.container');
    container.textContent = ''; // Önce temizle

    // Güvenli DOM manipülasyonu ile içerik oluştur
    const safeContent = createSuccessPageSafe(dateStr, timeStr, staffName, customerNote);
    container.appendChild(safeContent);

    // Event listener'ı HTML eklendikten SONRA ekle
    setTimeout(() => {
        const calendarBtn = document.getElementById('addToCalendarBtn');
        if (calendarBtn) {
            calendarBtn.addEventListener('click', addToCalendar);
        } else {
            log.error('Takvime Ekle butonu bulunamadı!');
        }
    }, 100);
}

// ==================== CALENDAR INTEGRATION (Lazy Loading) ====================

/**
 * Calendar buton tıklamalarını handle et
 * Lazy loading ile calendar modülünü dinamik yükler (bundle size optimization)
 * İlk tıklamada modül yüklenir, sonraki tıklamalarda cache'den kullanılır
 * @param {Event} event - Click event
 */
async function handleCalendarAction(event) {
    const buttonId = event.target.id;

    try {
        // Lazy load calendar integration (first click only)
        if (!window.CalendarIntegration) {
            log.info('Lazy loading calendar-integration...');
            const module = await import('./calendar-integration');
            window.CalendarIntegration = module;
            log.info('Calendar integration loaded successfully');
        }

        // Buton ID'sine göre doğru fonksiyonu çağır
        // Not: Her fonksiyon kendi hata yönetimini yapar
        switch (buttonId) {
            case 'calendarAppleBtn':
                window.CalendarIntegration.addToCalendarApple();
                break;
            case 'calendarGoogleBtn':
                window.CalendarIntegration.addToCalendarGoogle();
                break;
            case 'calendarOutlookBtn':
                window.CalendarIntegration.addToCalendarOutlook();
                break;
            case 'calendarICSBtn':
                window.CalendarIntegration.downloadICSUniversal();
                break;
        }
    } catch (error) {
        log.error('Calendar integration yükleme hatası:', error);
        logError(error, { context: 'handleCalendarAction', buttonId: event.target.id });
        alert('Takvim entegrasyonu yüklenirken bir hata oluştu. Lütfen tekrar deneyin.');
    }
}

/**
 * Takvime ekleme modal'ını aç
 */
function addToCalendar() {
    ModalUtils.open('calendarModal');
}

/**
 * Cloudflare Turnstile callback - Bot protection başarılı olduğunda çağrılır
 * HTML'de data-callback="onTurnstileSuccess" ile tanımlı
 */
(window as any).onTurnstileSuccess = function(token: string) {
    console.log('Turnstile başarılı, token alındı');
    // Submit butonunu göster
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
        submitBtn.style.display = 'block';
    }
};
