// Calendar integration will be lazy loaded when needed
// Removed direct import for bundle size optimization (~15kb saved)

// Import shared utilities
import { StringUtils } from './string-utils.ts';
import { StateManager } from './state-manager.ts';
import { apiCall } from './api-service.ts';
import { initMonitoring, logError, measureAsync } from './monitoring.ts';

// APPS SCRIPT URL
const CONFIG = {
    APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwmowzsBLrAOjn-HVtw_LSLf-Gn0jrWdaQMrxaJeulqnhJCQduyyeSvctsWPAXxSAuo/exec',
    BASE_URL: 'https://rolexizmiristinyepark.github.io/randevu_app/',

    // Debug mode - Production'da false olmalı
    DEBUG: false,

    SHIFTS: {
        'morning': { start: 11, end: 18, label: 'Sabah (11:00-18:00)' },
        'evening': { start: 14, end: 21, label: 'Akşam (14:00-21:00)' },
        'full': { start: 11, end: 21, label: 'Full (11:00-21:00)' }
    },
    APPOINTMENT_HOURS: {
        earliest: 11,  // En erken randevu: 11:00 (11-12 aralığı)
        latest: 21,    // En geç randevu: 20:00 (20-21 aralığı)
        interval: 60
    },
    MAX_DAILY_DELIVERY_APPOINTMENTS: 3,  // Teslim randevuları için max limit (günde 3 teslim)
    APPOINTMENT_TYPES: [
        { value: 'delivery', name: 'Saat Teslim Alma' },
        { value: 'service', name: 'Servis & Bakım' },
        { value: 'consultation', name: 'Ürün Danışmanlığı' },
        { value: 'general', name: 'Genel Görüşme' },
        { value: 'shipping', name: 'Gönderi' }
    ]
};

// Export CONFIG to window for api-service.js and other modules
if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
}

// ==================== UTILITY FONKSİYONLARI ====================


// Debug logger - Production'da log'ları devre dışı bırakır
const log = {
    error: (...args) => CONFIG.DEBUG && console.error(...args),
    warn: (...args) => CONFIG.DEBUG && console.warn(...args),
    info: (...args) => CONFIG.DEBUG && console.info(...args),
    log: (...args) => CONFIG.DEBUG && console.log(...args)
};

// ==================== SMOOTH SCROLL & REVEAL ANIMATIONS ====================

/**
 * Bölümü göster ve smooth scroll yap
 * @param {string} sectionId - Section ID
 * @param {boolean} scroll - Scroll yapılsın mı?
 */
function revealSection(sectionId, scroll = true) {
    const section = document.getElementById(sectionId);
    if (!section) return;

    // Display'i göster
    section.style.display = 'block';

    // Animasyon için visible class ekle
    setTimeout(() => {
        section.classList.add('visible');

        // Smooth scroll
        if (scroll) {
            setTimeout(() => {
                section.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                    inline: 'nearest'
                });
            }, 100);
        }
    }, 50);
}

/**
 * Bölümü gizle
 * @param {string} sectionId - Section ID
 */
function hideSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (!section) return;

    section.classList.remove('visible');
    setTimeout(() => {
        section.style.display = 'none';
    }, 500);
}

// Modal utility - Generic modal açma/kapama
const ModalUtils = {
    open(modalId) {
        document.getElementById(modalId)?.classList.add('active');
    },
    close(modalId) {
        document.getElementById(modalId)?.classList.remove('active');
    },
    toggle(modalId) {
        document.getElementById(modalId)?.classList.toggle('active');
    }
};

// ==================== STATE MANAGEMENT ====================

// AppState instance - Centralized state yönetimi
const appState = new StateManager({
    // Calendar state
    currentMonth: new Date(),

    // Selection state
    selectedDate: null,
    selectedStaff: null,
    selectedTime: null,
    selectedShiftType: null,
    selectedAppointmentType: null,

    // Data cache
    staffMembers: [],
    dayShifts: {},
    allAppointments: {}, // Tüm ayın randevuları {date: [appointments]}
    googleCalendarEvents: {}, // Google Calendar'dan gelen etkinlikler {date: [events]}

    // URL state
    specificStaffId: null, // URL parametresinden gelen staff ID

    // Last action
    lastAppointmentData: null // Son oluşturulan randevu bilgileri
});

// TODO: Global değişken kullanımını appState.get/set'e geçir
// Örnek:
//   - selectedDate yerine appState.get('selectedDate')
//   - selectedDate = value yerine appState.set('selectedDate', value)

// Backward compatibility için global değişkenleri tut (kademeli geçiş için)
const currentMonth = appState.get('currentMonth');
let selectedDate = appState.get('selectedDate');
let selectedStaff = appState.get('selectedStaff');
let selectedTime = appState.get('selectedTime');
let selectedShiftType = appState.get('selectedShiftType');
let selectedAppointmentType = appState.get('selectedAppointmentType');
let staffMembers = appState.get('staffMembers');
let dayShifts = appState.get('dayShifts');
let allAppointments = appState.get('allAppointments');
let googleCalendarEvents = appState.get('googleCalendarEvents');
let specificStaffId = appState.get('specificStaffId');
let lastAppointmentData = appState.get('lastAppointmentData');
let managementLevel = null; // YENİ: Yönetim linki seviyesi (1, 2, 3)
let isManagementLink = false; // YENİ: Yönetim linki mi?

// Export to window for calendar-integration.js module access
if (typeof window !== 'undefined') {
    window.lastAppointmentData = null;
}

// SessionStorage tabanlı cache mekanizması - API çağrılarını optimize eder
// Sayfa yenilemelerinde de çalışır, tarayıcı kapatılınca temizlenir
const CACHE_DURATION = 1800000; // 30 dakika (milisaniye) - Otomatik expire
const CACHE_PREFIX = 'rolex_cache_'; // sessionStorage key prefix

// SessionStorage cache helper - Map API ile aynı interface + auto-expiration
const sessionStorageCache = {
    get(key) {
        try {
            const item = sessionStorage.getItem(CACHE_PREFIX + key);
            if (!item) return undefined;

            const cached = JSON.parse(item);

            // Timestamp kontrolü - Expire olmuş mu?
            if (cached.timestamp && (Date.now() - cached.timestamp > CACHE_DURATION)) {
                log.info(`Cache expired for key: ${key} (${Math.floor((Date.now() - cached.timestamp) / 60000)} dakika önce)`);
                this.delete(key);
                return undefined;
            }

            return cached.value;
        } catch (e) {
            log.warn('SessionStorage okuma hatası:', e);
            return undefined;
        }
    },

    set(key, value) {
        try {
            // Timestamp ile birlikte sakla
            const cacheObject = {
                value: value,
                timestamp: Date.now()
            };
            sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(cacheObject));
        } catch (e) {
            log.warn('SessionStorage yazma hatası (quota aşımı olabilir):', e);
            // Quota aşımı durumunda eski cache'leri temizle
            this.clear();
        }
    },

    has(key) {
        // Sadece varlık değil, expire kontrolü de yap
        const item = this.get(key);
        return item !== undefined;
    },

    delete(key) {
        sessionStorage.removeItem(CACHE_PREFIX + key);
    },

    clear() {
        // Sadece kendi prefix'imizle başlayanları temizle
        Object.keys(sessionStorage).forEach(key => {
            if (key.startsWith(CACHE_PREFIX)) {
                sessionStorage.removeItem(key);
            }
        });
    }
};

const monthCache = sessionStorageCache;

// ==================== CONFIG LOADING (Backend Single Source of Truth) ====================

/**
 * Backend'den CONFIG yükler - tek kaynak prensib i
 * Cache kullanarak performans optimize eder
 * Fallback olarak mevcut CONFIG kullanılır
 */
async function loadConfig() {
    try {
        // Cache kontrolü (30 dakika)
        const cached = sessionStorageCache.get('backend_config');
        if (cached) {
            log.info('Config loaded from cache');
            return cached;
        }

        log.info('Loading config from backend...');
        const result = await apiCall('getConfig', {});

        if (result.success && result.data) {
            // Cache'e kaydet
            sessionStorageCache.set('backend_config', result.data);
            log.info('Config loaded from backend successfully');
            return result.data;
        } else {
            throw new Error(result.error || 'Config loading failed');
        }
    } catch (error) {
        log.warn('Config loading failed, using fallback:', error);
        // Fallback - mevcut CONFIG kullan
        return null;
    }
}

/**
 * Backend config ile mevcut CONFIG'i merge eder
 */
function mergeConfig(backendConfig) {
    if (!backendConfig) return;

    try {
        // SHIFTS güncelle
        if (backendConfig.shifts) {
            CONFIG.SHIFTS = {
                'morning': {
                    start: parseInt(backendConfig.shifts.morning.start.split(':')[0]),
                    end: parseInt(backendConfig.shifts.morning.end.split(':')[0]),
                    label: `Sabah (${backendConfig.shifts.morning.start}-${backendConfig.shifts.morning.end})`
                },
                'evening': {
                    start: parseInt(backendConfig.shifts.evening.start.split(':')[0]),
                    end: parseInt(backendConfig.shifts.evening.end.split(':')[0]),
                    label: `Akşam (${backendConfig.shifts.evening.start}-${backendConfig.shifts.evening.end})`
                },
                'full': {
                    start: parseInt(backendConfig.shifts.full.start.split(':')[0]),
                    end: parseInt(backendConfig.shifts.full.end.split(':')[0]),
                    label: `Full (${backendConfig.shifts.full.start}-${backendConfig.shifts.full.end})`
                }
            };
        }

        // APPOINTMENT_HOURS güncelle
        if (backendConfig.appointmentHours) {
            CONFIG.APPOINTMENT_HOURS = {
                earliest: backendConfig.appointmentHours.earliest,
                latest: backendConfig.appointmentHours.latest,
                interval: backendConfig.appointmentHours.interval
            };
        }

        // MAX_DAILY güncelle
        if (backendConfig.maxDailyDeliveryAppointments !== undefined) {
            CONFIG.MAX_DAILY_DELIVERY_APPOINTMENTS = backendConfig.maxDailyDeliveryAppointments;
        }

        log.info('Config merged successfully:', CONFIG);
    } catch (error) {
        log.error('Config merge error:', error);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize monitoring (Sentry + Web Vitals)
    initMonitoring();

    // Backend'den config yükle (tek kaynak prensibi)
    const backendConfig = await measureAsync('loadConfig', () => loadConfig());
    mergeConfig(backendConfig);
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
    specificStaffId = urlParams.get('staff');

    // YENİ: URL pathname veya hash'den yönetim linkini kontrol et
    const pathname = window.location.pathname;
    const hash = window.location.hash.replace('#/', '').replace('#', '');
    const basePath = import.meta.env.BASE_URL || '/';
    const relativePath = pathname.replace(basePath, '').replace(/^\//, '');

    // Hash routing (GitHub Pages için) veya path routing
    const route = hash || relativePath;

    if (route === 'hk') {
        managementLevel = 1;
        isManagementLink = true;
    } else if (route === 'ok') {
        managementLevel = 2;
        isManagementLink = true;
    } else if (route === 'hmk') {
        managementLevel = 3;
        isManagementLink = true;
    }

    // Yönetim linki ise UI'yi ayarla
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
    else if (specificStaffId === '0') {
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
            const staff = staffMembers.find(s => s.id == specificStaffId);
            if (staff) {
                const header = document.getElementById('staffHeader');
                header.textContent = staff.name;
                header.style.visibility = 'visible';
                selectedStaff = parseInt(specificStaffId);
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

    // Calendar navigation buttons
    document.getElementById('prevMonthBtn')?.addEventListener('click', () => changeMonth(-1));
    document.getElementById('nextMonthBtn')?.addEventListener('click', () => changeMonth(1));
});

// Randevu tipi seçimi
function selectAppointmentType(type) {
    selectedAppointmentType = type;

    // ⚡ PERFORMANS: Sadece önceki seçili elementi güncelle (reflow azaltma)
    const prev = document.querySelector('.type-card.selected');
    if (prev) prev.classList.remove('selected');
    document.querySelector(`.type-card[data-type="${type}"]`).classList.add('selected');

    // Takvimi göster ve yükle (animasyonlu + smooth scroll)
    revealSection('calendarSection');
    renderCalendar();
    loadMonthData();
}

// Ay değiştir - Smart loading ile optimize edilmiş
async function changeMonth(direction) {
    currentMonth.setMonth(currentMonth.getMonth() + direction);

    // Önce cache'den render et (hızlı UX)
    const monthStr = currentMonth.toISOString().slice(0, 7);
    const cacheKey = `${monthStr}_${specificStaffId || 'all'}`;

    if (monthCache.has(cacheKey)) {
        const cached = monthCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_DURATION) {
            // Cache varsa direkt render (API çağrısı yok)
            dayShifts = cached.data.dayShifts || {};
            allAppointments = cached.data.allAppointments || {};
            googleCalendarEvents = cached.data.googleCalendarEvents || {};
            renderCalendar();
            return; // Hemen dön
        }
    }

    // Cache yoksa veya expired ise API çağır
    renderCalendar();
    await loadMonthData();
}

// Takvimi render et (DocumentFragment ile optimize edilmiş)
function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
        'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const dayNames = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

    document.getElementById('currentMonth').textContent =
        monthNames[currentMonth.getMonth()] + ' ' + currentMonth.getFullYear();

    // Grid'i temizle
    grid.innerHTML = '';

    // DocumentFragment ile performansı artır (tek seferde DOM'a ekle)
    const fragment = document.createDocumentFragment();

    // Gün başlıklarını ekle
    dayNames.forEach(day => {
        const header = document.createElement('div');
        header.className = 'day-header';
        header.textContent = day;
        fragment.appendChild(header);
    });

    // Ayın ilk gününü bul
    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    let dayOfWeek = firstDay.getDay();
    dayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Pazartesi'den başlat

    // Önceki ayın günleri
    for (let i = 0; i < dayOfWeek; i++) {
        const day = document.createElement('div');
        day.className = 'calendar-day other-month';
        fragment.appendChild(day);
    }

    // Bu ayın günleri
    const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let day = 1; day <= daysInMonth; day++) {
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        dayEl.textContent = day;

        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        date.setHours(0, 0, 0, 0);
        const dateStr = DateUtils.toLocalDate(date);

        // data-date attribute ekle
        dayEl.setAttribute('data-date', dateStr);

        // Geçmiş günler - staff=0, yönetim randevusu veya yönetim linki için bugüne izin ver
        const allowToday = specificStaffId === '0' || selectedAppointmentType === 'management' || isManagementLink;
        if (date < today || (date.getTime() === today.getTime() && !allowToday)) {
            dayEl.classList.add('past');
        } else {
            // Müsaitliği kontrol et
            const availability = checkDayAvailability(dateStr);
            if (availability.available) {
                dayEl.classList.add('available');
                dayEl.onclick = () => selectDay(dateStr);
            } else {
                dayEl.classList.add('unavailable');
                dayEl.title = availability.reason || 'Müsait değil';
            }
        }

        fragment.appendChild(dayEl);
    }

    // Tüm elementleri tek seferde DOM'a ekle (performans iyileştirmesi)
    grid.appendChild(fragment);
}

// Günün müsaitliğini kontrol et
function checkDayAvailability(dateStr) {
    // YENİ: Yönetim randevusu için tüm günler müsait
    if (selectedAppointmentType === 'management') {
        return { available: true };
    }

    // Vardiya kontrolü
    if (specificStaffId && specificStaffId !== '0') {
        // Normal staff linki - sadece o çalışanın vardiyasını kontrol et
        const staffHasShift = dayShifts[dateStr] && dayShifts[dateStr][specificStaffId];
        if (!staffHasShift) {
            return { available: false, reason: 'İlgili çalışan bu gün müsait değil' };
        }
    } else {
        // Genel link veya staff=0 - herhangi bir çalışan vardiyası var mı kontrol et
        const hasShifts = dayShifts[dateStr] && Object.keys(dayShifts[dateStr]).length > 0;
        if (!hasShifts) {
            return { available: false, reason: 'Çalışan yok' };
        }
    }

    // Google Calendar'dan TESLİM ve GÖNDERİ randevularını say (toplamda max 3)
    const calendarEvents = googleCalendarEvents[dateStr] || [];
    const now = new Date();
    const todayStr = DateUtils.toLocalDate(now);

    const deliveryCount = calendarEvents.filter(event => {
        // Teslim VE gönderi randevularını say (ikisi toplamda)
        const appointmentType = event.extendedProperties?.private?.appointmentType;
        if (appointmentType !== 'delivery' && appointmentType !== 'shipping') {
            return false;
        }

        // Eğer bugünse ve saat geçmişse sayma
        if (dateStr === todayStr && event.start) {
            // Backend'den gelen time field'ını kullan
            const eventTime = event.start.time || (() => {
                const t = new Date(event.start.dateTime);
                return String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
            })();
            const currentTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
            if (eventTime < currentTime) {
                return false;
            }
        }

        return true;
    }).length;

    // Teslim/Gönderi randevusu için max 3 kontrolü (toplamda)
    if (selectedAppointmentType === 'delivery' || selectedAppointmentType === 'shipping') {
        if (deliveryCount >= CONFIG.MAX_DAILY_DELIVERY_APPOINTMENTS) {
            return { available: false, reason: `Teslim/gönderi randevuları dolu (${deliveryCount}/${CONFIG.MAX_DAILY_DELIVERY_APPOINTMENTS})` };
        }
    }

    return { available: true };
}

// Gün seç
function selectDay(dateStr) {
    selectedDate = dateStr;

    // ⚡ PERFORMANS: Sadece önceki ve yeni seçili elementleri güncelle (reflow azaltma)
    const prev = document.querySelector('.calendar-day.selected');
    if (prev) prev.classList.remove('selected');

    const newDay = document.querySelector(`.calendar-day[data-date="${dateStr}"]`);
    if (newDay) newDay.classList.add('selected');

    // YENİ: staff=0 ve management randevusu için direkt saat seçimine geç
    if (specificStaffId === '0' && selectedAppointmentType === 'management') {
        // Yönetim randevusu için vardiya sınırı yok - tüm saatler müsait
        selectedStaff = 0;
        selectedShiftType = 'management';
        displayAvailableTimeSlots();
        revealSection('timeSection');
        hideSection('staffSection');
        hideSection('detailsSection');
        document.getElementById('submitBtn').style.display = 'none';
    }
    // staff=0 ama diğer türler (delivery, service, meeting) için çalışan seçimi göster
    else if (specificStaffId === '0' && selectedAppointmentType !== 'management') {
        displayAvailableStaff();
        revealSection('staffSection');
        hideSection('timeSection');
        hideSection('detailsSection');
        document.getElementById('submitBtn').style.display = 'none';
    }
    // Çalışan seçimi göster (genel link) - Yönetim linki DEĞİLSE
    else if (!specificStaffId && !isManagementLink) {
        displayAvailableStaff();
        revealSection('staffSection');
        hideSection('timeSection');
        hideSection('detailsSection');
        document.getElementById('submitBtn').style.display = 'none';
    }
    // Yönetim linki ise direkt saat seçimine geç
    else if (isManagementLink) {
        displayAvailableTimeSlots();
        hideSection('staffSection');
        revealSection('timeSection');
        hideSection('detailsSection');
        document.getElementById('submitBtn').style.display = 'none';
    } else {
        // Normal staff link (staff=1, staff=2, vb.) - direkt saat seçimine geç
        selectedStaff = parseInt(specificStaffId);
        const shiftType = dayShifts[dateStr]?.[parseInt(specificStaffId)];
        if (shiftType) {
            selectedShiftType = shiftType;
            displayAvailableTimeSlots();
            revealSection('timeSection');
            hideSection('detailsSection');
            document.getElementById('submitBtn').style.display = 'none';
        }
    }
}

// YENİ: Yönetim randevuları için HK ve OK seçenekleri
function displayManagementOptions() {
    const staffList = document.getElementById('staffList');
    staffList.innerHTML = '';

    const managementOptions = [
        { id: 'HK', name: 'Haluk Külahçıoğlu' },
        { id: 'OK', name: 'Onur Külahçıoğlu' }
    ];

    managementOptions.forEach(option => {
        const card = document.createElement('div');
        card.className = 'staff-card';
        const nameDiv = createElement('div', { className: 'staff-name' }, option.name);
        card.appendChild(nameDiv);
        card.addEventListener('click', (e) => selectManagementOption(option, e));
        staffList.appendChild(card);
    });
}

// YENİ: Yönetim seçeneği (HK veya OK) seçildiğinde
function selectManagementOption(option, event) {
    // İlgili kişi olarak bu seçeneği kaydet (staffName yerine kullanılacak)
    selectedStaff = 0; // staff ID olarak 0
    window.managementContactPerson = option.id; // HK veya OK (kısa form)

    // Header'da seçilen seçeneği göster
    const header = document.getElementById('staffHeader');
    header.textContent = option.name; // Tam isim göster
    header.style.visibility = 'visible';

    // Seçili kartı işaretle
    const prev = document.querySelector('.staff-card.selected');
    if (prev) prev.classList.remove('selected');
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('selected');
    }

    // Staff section'ı gizle, takvimi göster (tarih ve saat seçimi için)
    hideSection('staffSection');
    revealSection('calendarSection');
    renderCalendar();
    loadMonthData();

    // Detayları gizle (saat seçilince gösterilecek)
    hideSection('detailsSection');
    document.getElementById('turnstileContainer').style.display = 'none';
    document.getElementById('submitBtn').style.display = 'none';
}

// Ayın verilerini yükle (Cache destekli)
async function loadMonthData() {
    const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    const monthStr = currentMonth.toISOString().slice(0, 7); // YYYY-MM

    // Cache kontrolü
    const cacheKey = `${monthStr}_${specificStaffId || 'all'}`;
    if (monthCache.has(cacheKey)) {
        const cached = monthCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_DURATION) {
            // Cache hala geçerli, önbelleği kullan
            dayShifts = cached.data.dayShifts || {};
            allAppointments = cached.data.allAppointments || {};
            googleCalendarEvents = cached.data.googleCalendarEvents || {};
            renderCalendar();
            return;
        }
    }

    showLoading();

    try {
        // Vardiyaları ve randevuları paralel yükle
        const [shiftsResult, appointmentsResult, calendarResult] = await Promise.all([
            apiCall('getMonthShifts', { month: monthStr }),
            apiCall('getMonthAppointments', { month: monthStr }),
            apiCall('getGoogleCalendarEvents', {
                startDate: DateUtils.toLocalDate(startDate),
                endDate: DateUtils.toLocalDate(endDate),
                staffId: specificStaffId || 'all'
            })
        ]);

        if (shiftsResult.success) {
            dayShifts = shiftsResult.data || {};
        }

        if (appointmentsResult.success) {
            allAppointments = appointmentsResult.data || {};
        }

        if (calendarResult.success) {
            googleCalendarEvents = calendarResult.data || {};
        }

        // Veriyi cache'e kaydet
        monthCache.set(cacheKey, {
            timestamp: Date.now(),
            data: {
                dayShifts: { ...dayShifts },
                allAppointments: { ...allAppointments },
                googleCalendarEvents: { ...googleCalendarEvents }
            }
        });

        renderCalendar(); // Takvimi yeniden render et
        hideAlert();
    } catch (error) {
        log.error('Veri yukleme hatasi:', error);
        logError(error, { context: 'loadAllData' });
        showLoadingError();
    }
}

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

async function loadStaffMembers() {
    // Sessiz data loading (kullanıcıya mesaj gösterme)
    try {
        const response = await apiCall('getStaff');
        if (response.success) {
            staffMembers = response.data;
        } else {
            log.error('Calisanlar yuklenemedi:', response.error);
        }
    } catch (error) {
        log.error('API hatasi:', error);
    }
}

async function loadSettings() {
    try {
        const response = await apiCall('getSettings');
        if (response.success) {
            // Update CONFIG with server settings
            CONFIG.APPOINTMENT_HOURS.interval = response.data.interval || 60;
            CONFIG.MAX_DAILY_DELIVERY_APPOINTMENTS = response.data.maxDaily || 4;
        }
    } catch (error) {
        log.error('Ayarlar yuklenemedi:', error);
    }
}

function displayAvailableStaff() {
    const staffList = document.getElementById('staffList');
    staffList.innerHTML = '';

    if (staffMembers.length === 0) {
        // Güvenli DOM manipülasyonu
        const emptyDiv = createElement('div', {
            style: { gridColumn: '1/-1', textAlign: 'center', padding: '40px' }
        });
        const spinner = createElement('div', {
            className: 'spinner',
            style: { margin: '0 auto 20px' }
        });
        const reloadBtn = createElement('button', {
            className: 'btn',
            style: { padding: '12px 30px' }
        }, 'Yenile');
        reloadBtn.addEventListener('click', () => location.reload());

        emptyDiv.appendChild(spinner);
        emptyDiv.appendChild(reloadBtn);
        staffList.appendChild(emptyDiv);
        return;
    }

    const dayShiftsForDate = dayShifts[selectedDate] || {};

    staffMembers.forEach(staff => {
        if (!staff.active) return;

        const shiftType = dayShiftsForDate[staff.id];
        const isWorking = !!shiftType;

        const card = document.createElement('div');
        card.className = 'staff-card' + (!isWorking ? ' unavailable' : '');

        // Güvenli DOM manipülasyonu - XSS koruması
        const nameDiv = createElement('div', { className: 'staff-name' }, staff.name);
        card.appendChild(nameDiv);

        if (isWorking) {
            card.addEventListener('click', (e) => selectStaff(staff.id, shiftType, e));
        } else {
            card.style.opacity = '0.5';
            card.style.cursor = 'not-allowed';
        }

        staffList.appendChild(card);
    });
}

function selectStaff(staffId, shiftType, event) {
    selectedStaff = parseInt(staffId);
    selectedShiftType = shiftType;

    // Header'da ilgili adını göster
    const staff = staffMembers.find(s => s.id === parseInt(staffId));
    if (staff) {
        const header = document.getElementById('staffHeader');
        header.textContent = staff.name;
        header.style.visibility = 'visible';
    }

    // ⚡ PERFORMANS: Sadece önceki seçili elementi güncelle (reflow azaltma)
    const prev = document.querySelector('.staff-card.selected');
    if (prev) prev.classList.remove('selected');
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('selected');
    }

    displayAvailableTimeSlots();
    revealSection('timeSection');
    hideSection('detailsSection');
    document.getElementById('submitBtn').style.display = 'none';
}

/**
 * ⭐⭐⭐⭐⭐ CORE: Müsait saatleri backend'den al ve göster
 * Backend = Single Source of Truth
 * Slot Evreni: 11-20 arası tam saatler
 * Dolu saatler: silik ve tıklanamaz
 */
async function displayAvailableTimeSlots() {
    const container = document.getElementById('timeSlots');
    container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 20px;"><div class="spinner"></div></div>';

    // Gerekli parametreleri kontrol et
    if (!selectedDate || !selectedShiftType || !selectedAppointmentType) {
        container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 20px; color: #dc3545;">Lütfen önce tarih, vardiya ve randevu türü seçin.</div>';
        return;
    }

    try {
        // Yönetim randevusu için özel logic
        if (selectedAppointmentType === 'management') {
            container.innerHTML = '';

            // Yönetim linki ise (hk, ok, hmk) backend'den slot doluluk durumunu al
            if (isManagementLink) {
                // Backend'den bu gün için tüm randevuları al
                const appointmentsResult = await apiCall('getManagementSlotAvailability', {
                    date: selectedDate,
                    managementLevel: managementLevel
                });

                if (!appointmentsResult.success) {
                    const errorDiv = document.createElement('div');
                    errorDiv.style.cssText = 'grid-column: 1/-1; text-align: center; padding: 20px; color: #dc3545;';
                    errorDiv.textContent = 'Müsait saatler yüklenemedi';
                    container.appendChild(errorDiv);
                    return;
                }

                const { slots } = appointmentsResult;

                // Slot'ları render et
                slots.forEach(slot => {
                    const btn = document.createElement('div');

                    if (slot.available) {
                        // ✅ MÜSAİT - Slot'ta < 2 randevu var
                        btn.className = 'slot-btn';
                        btn.textContent = slot.time;
                        if (slot.count === 1) {
                            btn.title = `Bu saatte 1 randevu var (2. randevu olabilir)`;
                        }
                        btn.addEventListener('click', () => selectTimeSlot(slot.time, btn));
                    } else {
                        // ❌ DOLU - Slot'ta zaten 2 randevu var
                        btn.className = 'slot-btn disabled';
                        btn.textContent = slot.time;
                        btn.title = 'Bu saat dolu (2 randevu)';
                        btn.style.opacity = '0.4';
                        btn.style.cursor = 'not-allowed';
                        btn.setAttribute('aria-disabled', 'true');
                    }

                    container.appendChild(btn);
                });
                return;
            }

            // Normal yönetim randevusu (staff=0'dan seçilen) - tüm saatler müsait (buçuklarla)
            const managementSlots = [];

            // 10:00'dan 21:00'a kadar tüm saatler ve buçuklar
            for (let hour = 10; hour <= 20; hour++) {
                managementSlots.push({ time: `${hour}:00` });
                managementSlots.push({ time: `${hour}:30` });
            }
            managementSlots.push({ time: '21:00' });

            // Tüm slotları müsait olarak render et
            managementSlots.forEach(slot => {
                const btn = document.createElement('div');
                btn.className = 'slot-btn';
                btn.textContent = slot.time;
                btn.addEventListener('click', () => selectTimeSlot(slot.time, btn));
                container.appendChild(btn);
            });
            return;
        }

        // ⭐ YENİ: getDayStatus endpoint - tüm business rules tek seferde
        const [dayStatusResult, slotsResult] = await Promise.all([
            apiCall('getDayStatus', {
                date: selectedDate,
                appointmentType: selectedAppointmentType
            }),
            apiCall('getDailySlots', {
                date: selectedDate,
                shiftType: selectedShiftType
            })
        ]);

        if (!dayStatusResult.success || !slotsResult.success) {
            container.textContent = '';
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = 'grid-column: 1/-1; text-align: center; padding: 20px; color: #dc3545;';
            errorDiv.textContent = 'Müsait saatler yüklenemedi';
            container.appendChild(errorDiv);
            return;
        }

        const { isDeliveryMaxed, availableHours, unavailableHours, deliveryCount } = dayStatusResult;
        const { slots } = slotsResult;

        container.innerHTML = '';

        // NOT: Teslim limiti kontrolü takvimde yapılıyor (gün disabled)
        // Bu fonksiyona ulaşılmamalı çünkü gün zaten seçilemiyor

        // Hiç müsait saat yoksa bilgi
        if (availableHours.length === 0) {
            const infoDiv = document.createElement('div');
            infoDiv.style.cssText = 'grid-column: 1/-1; text-align: center; padding: 20px; color: #dc3545;';
            infoDiv.textContent = 'Bu gün için müsait saat bulunmamaktadır.';
            container.appendChild(infoDiv);
            return;
        }

        // Slot'ları render et
        slots.forEach(slot => {
            const btn = document.createElement('div');
            const isAvailable = availableHours.includes(slot.hour);

            if (isAvailable) {
                // ✅ MÜSAİT - normal, tıklanabilir
                btn.className = 'slot-btn';
                btn.textContent = slot.time;
                btn.addEventListener('click', () => selectTimeSlot(slot.time, btn));
            } else {
                // ❌ DOLU - silik, tıklanamaz, aria-disabled
                btn.className = 'slot-btn slot--disabled';
                btn.textContent = slot.time;
                btn.title = 'Bu saat dolu';
                btn.setAttribute('aria-disabled', 'true');
                // pointer-events: none CSS ile halledilecek
            }

            container.appendChild(btn);
        });

    } catch (error) {
        log.error('displayAvailableTimeSlots hatası:', error);
        logError(error, { context: 'displayAvailableTimeSlots', date: selectedDate, shiftType: selectedShiftType });
        container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 20px; color: #dc3545;">Saatler yüklenirken bir hata oluştu. Lütfen sayfayı yenileyin.</div>';
    }
}

function selectTimeSlot(timeStr, element) {
    selectedTime = timeStr;

    // ⚡ PERFORMANS: Sadece önceki seçili elementi güncelle (reflow azaltma)
    const prev = document.querySelector('.slot-btn.selected');
    if (prev) prev.classList.remove('selected');
    element.classList.add('selected');

    // Yönetim linki ise (hk, ok, hmk) direkt form'a geç
    if (isManagementLink) {
        // Personel seçimi yok, backend'de random atama yapılacak
        selectedStaff = -1; // Placeholder: Backend random atayacak

        // Direkt form göster
        revealSection('detailsSection');
        document.getElementById('turnstileContainer').style.display = 'block';
        document.getElementById('submitBtn').style.display = 'block';

        // Staff section'ı gizli tut
        hideSection('staffSection');
    }
    // Normal yönetim randevusu (staff=0'dan gelen) için HK/OK seçimi göster
    else if (selectedAppointmentType === 'management') {
        displayManagementOptions();
        revealSection('staffSection');
        hideSection('detailsSection');
        document.getElementById('turnstileContainer').style.display = 'none';
        document.getElementById('submitBtn').style.display = 'none';
    } else {
        revealSection('detailsSection');
        document.getElementById('turnstileContainer').style.display = 'block';
        document.getElementById('submitBtn').style.display = 'block';
    }
}

document.getElementById('submitBtn')?.addEventListener('click', async () => {
    const name = StringUtils.toTitleCase(document.getElementById('customerName').value.trim());
    const phone = document.getElementById('customerPhone').value.trim();
    const email = document.getElementById('customerEmail').value.trim();
    const note = document.getElementById('customerNote').value.trim();

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
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-spinner"></span> Randevu oluşturuluyor...';

    // YENİ: staff=0 için staffName yerine managementContactPerson kullan
    let staffName;
    let staff = null;
    let assignedStaffId = selectedStaff;

    // Yönetim linki ise (hk, ok, hmk) - random staff atama
    if (isManagementLink) {
        // Backend'den bu slot için müsait personeli al
        const availableStaffResult = await apiCall('getAvailableStaffForSlot', {
            date: selectedDate,
            time: selectedTime
        });

        if (!availableStaffResult.success || availableStaffResult.availableStaff.length === 0) {
            showAlert('Bu saat için müsait personel bulunamadı. Lütfen başka bir saat seçin.', 'error');
            btn.disabled = false;
            btn.textContent = 'Randevuyu Onayla';
            return;
        }

        // Random staff seç
        const availableStaff = availableStaffResult.availableStaff;
        const randomIndex = Math.floor(Math.random() * availableStaff.length);
        staff = availableStaff[randomIndex];
        assignedStaffId = staff.id;
        staffName = staff.name;
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
            duration: CONFIG.APPOINTMENT_HOURS.interval,
            turnstileToken: turnstileToken,  // Bot protection token
            managementLevel: managementLevel  // Yönetim linki seviyesi (1, 2, 3 veya null)
        });

        if (result.success) {
            // Son randevu bilgilerini kaydet
            lastAppointmentData = {
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
                duration: CONFIG.APPOINTMENT_HOURS.interval
            };

            // Export to window for calendar-integration.js module access
            window.lastAppointmentData = lastAppointmentData;

            showSuccessPage(selectedDate, selectedTime, staffName, note);
        } else {
            showAlert('Randevu olusturulamadi: ' + (result.error || 'Bilinmeyen hata'), 'error');
            btn.disabled = false;
            btn.textContent = 'Randevuyu Onayla';
        }
    } catch (error) {
        logError(error, { context: 'confirmAppointment', selectedStaff, selectedDate, selectedTime });
        showAlert('Randevu oluşturulamadı. Lütfen tekrar deneyiniz.', 'error');
        btn.disabled = false;
        btn.textContent = 'Randevuyu Onayla';
    }
});

function showAlert(message, type) {
    // Güvenli DOM manipülasyonu kullan
    showAlertSafe(message, type, 'alertContainer');
}

function hideAlert() {
    const container = document.getElementById('alertContainer');
    if (container) container.textContent = '';
}

function showLoading() {
    const container = document.getElementById('alertContainer');
    if (!container) return;
    container.textContent = '';
    const loadingDiv = createElement('div', { className: 'loading' });
    const spinnerDiv = createElement('div', { className: 'spinner' });
    loadingDiv.appendChild(spinnerDiv);
    container.appendChild(loadingDiv);
}

function showLoadingError() {
    const container = document.querySelector('.container');
    container.textContent = ''; // Önce temizle

    // Header oluştur (güvenli DOM manipülasyonu)
    const header = createElement('div', { className: 'header' });

    // Logo'yu direkt oluştur (Vite base path ile)
    const basePath = import.meta.env.BASE_URL || '/';
    const logo = createElement('img', {
        src: basePath + 'assets/rolex-logo.svg',
        className: 'rolex-logo',
        alt: 'Rolex Logo'
    });
    header.appendChild(logo);

    const title = createElement('h2', {
        style: {
            margin: '20px 0 2px',
            fontSize: '14px',
            fontWeight: 'normal',
            letterSpacing: '1px',
            textAlign: 'center',
            color: '#757575',
            fontFamily: "'Montserrat', sans-serif"
        }
    }, 'Rolex İzmir İstinyepark');
    header.appendChild(title);

    // Loading error container oluştur
    const errorContainer = createElement('div', { className: 'loading-error-container' });
    const spinner = createElement('div', { className: 'spinner' });
    const reloadBtn = createElement('button', {
        className: 'btn',
        id: 'reloadBtn',
        style: {
            marginTop: '40px',
            padding: '12px 30px'
        }
    }, 'Yeniden Dene');

    errorContainer.appendChild(spinner);
    errorContainer.appendChild(reloadBtn);

    // Container'a ekle
    container.appendChild(header);
    container.appendChild(errorContainer);

    // Event listener'ı ekle (dinamik olarak oluşturulan element için)
    setTimeout(() => {
        const btn = document.getElementById('reloadBtn');
        if (btn) {
            btn.addEventListener('click', () => location.reload());
        }
    }, 0);
}

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
            log.info('Lazy loading calendar-integration.js...');
            const module = await import('./calendar-integration.js');
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
