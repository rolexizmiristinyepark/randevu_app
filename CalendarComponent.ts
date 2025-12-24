/**
 * CalendarComponent.ts
 *
 * Calendar rendering and month navigation
 * Extracted from app.ts (lines 332-567)
 */

import { state, type Shift, type Appointment, type CalendarEvent } from './StateManager';
import { cache } from './CacheManager';
import { revealSection, hideSection, showCalendarLoading, hideCalendarLoading, hideAlert, showAlert } from './UIManager';
import { DateUtils } from './date-utils';
import { apiCall } from './api-service';
import { logError } from './monitoring';
import { memoize } from './performance-utils';

// ==================== CONSTANTS ====================

const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// Debug logger - Production'da log'ları devre dışı bırakır
const log = {
    error: (...args: any[]) => (window as any).CONFIG?.DEBUG && console.error(...args),
    warn: (...args: any[]) => (window as any).CONFIG?.DEBUG && console.warn(...args),
    info: (...args: any[]) => (window as any).CONFIG?.DEBUG && console.info(...args),
    log: (...args: any[]) => (window as any).CONFIG?.DEBUG && console.log(...args)
};

// ==================== MONTH NAVIGATION ====================

/**
 * Change month - Smart loading with cache optimization
 */
export async function changeMonth(direction: 1 | -1): Promise<void> {
    const currentMonth = state.get('currentMonth');
    currentMonth.setMonth(currentMonth.getMonth() + direction);
    state.set('currentMonth', currentMonth);

    // First render from cache (fast UX)
    const monthStr = currentMonth.toISOString().slice(0, 7);
    const specificStaffId = state.get('specificStaffId');
    const selectedAppointmentType = state.get('selectedAppointmentType');
    // ⚡ PERFORMANCE FIX: Include appointmentType in cache key to prevent stale data
    const cacheKey = `${monthStr}_${specificStaffId || 'all'}_${selectedAppointmentType || 'general'}`;

    if (cache.has(cacheKey)) {
        const cached = cache.get<any>(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            // Cache available, render directly (no API call)
            state.set('dayShifts', cached.data.dayShifts || {});
            state.set('allAppointments', cached.data.allAppointments || {});
            state.set('googleCalendarEvents', cached.data.googleCalendarEvents || {});
            // ⚡ BUG FIX: Clear memoization cache before re-render to prevent stale availability data
            clearAvailabilityCache();
            renderCalendar();
            return; // Return immediately
        }
    }

    // No cache or expired, call API
    renderCalendar();
    await loadMonthData();
}

// ==================== CALENDAR RENDERING ====================

/**
 * Render calendar (optimized with DocumentFragment)
 */
export function renderCalendar(): void {
    const currentMonth = state.get('currentMonth');
    const grid = document.getElementById('calendarGrid');
    if (!grid) return;

    const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
        'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const dayNames = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

    const monthLabel = document.getElementById('currentMonth');
    if (monthLabel) {
        monthLabel.textContent = monthNames[currentMonth.getMonth()] + ' ' + currentMonth.getFullYear();
    }

    // Clear grid
    grid.innerHTML = '';

    // Use DocumentFragment for better performance (single DOM insertion)
    const fragment = document.createDocumentFragment();

    // Add day headers
    dayNames.forEach(day => {
        const header = document.createElement('div');
        header.className = 'day-header';
        header.textContent = day;
        fragment.appendChild(header);
    });

    // Find first day of month
    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    let dayOfWeek = firstDay.getDay();
    dayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Start from Monday

    // Previous month days
    for (let i = 0; i < dayOfWeek; i++) {
        const day = document.createElement('div');
        day.className = 'calendar-day other-month';
        fragment.appendChild(day);
    }

    // Days of current month
    const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const specificStaffId = state.get('specificStaffId');
    const selectedAppointmentType = state.get('selectedAppointmentType');
    // v3.9: Tüm mantık profil ayarlarına göre çalışır
    const profilAyarlari = state.get('profilAyarlari');
    const takvimFiltresi = profilAyarlari?.takvimFiltresi || 'withtoday';
    const sameDayBooking = profilAyarlari?.sameDayBooking ?? true;
    const assignByAdmin = profilAyarlari?.assignByAdmin === true;

    for (let day = 1; day <= daysInMonth; day++) {
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        dayEl.textContent = String(day);

        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        date.setHours(0, 0, 0, 0);
        const dateStr = DateUtils.toLocalDate(date);

        // Add data-date attribute
        dayEl.setAttribute('data-date', dateStr);

        // Takvim filtresi kontrolü
        const isToday = date.getTime() === today.getTime();

        // 'onlytoday' filtresi: sadece bugün seçilebilir (takvim normalde gizli olmalı)
        if (takvimFiltresi === 'onlytoday' && !isToday) {
            dayEl.classList.add('unavailable');
            dayEl.title = 'Sadece bugün için randevu alınabilir';
            fragment.appendChild(dayEl);
            continue;
        }

        // 'withouttoday' filtresi: bugün seçilemez, yarın ve sonrası
        if (takvimFiltresi === 'withouttoday' && isToday) {
            dayEl.classList.add('past');
            dayEl.title = 'Bugün için randevu alınamaz';
            fragment.appendChild(dayEl);
            continue;
        }

        // v3.9: Bugün seçimi profil ayarlarına göre (isManagementLink kaldırıldı)
        // - staff=0 veya management appointment
        // - assignByAdmin=true (backend personel atayacak)
        // - sameDayBooking=true
        // - takvimFiltresi='withtoday'
        const allowToday = specificStaffId === '0' || selectedAppointmentType === 'management' || assignByAdmin || sameDayBooking || takvimFiltresi === 'withtoday';
        if (date < today || (isToday && !allowToday)) {
            dayEl.classList.add('past');
        } else {
            // Check availability
            const availability = checkDayAvailability(dateStr);
            if (availability.available) {
                dayEl.classList.add('available');
                // ⚡ PERFORMANCE: Async handler for dynamic imports
                dayEl.onclick = () => void selectDay(dateStr);
            } else {
                dayEl.classList.add('unavailable');
                dayEl.title = availability.reason || 'Müsait değil';
            }
        }

        fragment.appendChild(dayEl);
    }

    // Add all elements to DOM at once (performance improvement)
    grid.appendChild(fragment);
}

// ==================== DAY AVAILABILITY ====================

/**
 * Check day availability (base implementation)
 * ⚠️ This is the raw function - use checkDayAvailabilityMemoized for performance
 */
function checkDayAvailabilityBase(dateStr: string): { available: boolean; reason?: string } {
    const selectedAppointmentType = state.get('selectedAppointmentType');
    const specificStaffId = state.get('specificStaffId');
    const dayShifts = state.get('dayShifts');
    const googleCalendarEvents = state.get('googleCalendarEvents');
    const profilAyarlari = state.get('profilAyarlari');

    // NEW: All days available for management appointments
    if (selectedAppointmentType === 'management') {
        return { available: true };
    }

    // v3.8: vardiyaKontrolu=false ise vardiya kontrolünü atla, tüm günler müsait
    const vardiyaKontrolu = profilAyarlari?.vardiyaKontrolu !== false; // default true

    // Shift check (vardiyaKontrolu true ise)
    if (vardiyaKontrolu) {
        if (specificStaffId && specificStaffId !== '0') {
            // Normal staff link - check only that staff's shift
            // v3.6: Support both numeric IDs and secure string IDs
            const shifts = dayShifts[dateStr];
            const staffHasShift = shifts && (shifts[specificStaffId] || shifts[parseInt(specificStaffId)]);

            if (!staffHasShift) {
                return { available: false, reason: 'İlgili çalışan bu gün müsait değil' };
            }
        } else {
            // General link or staff=0 - check if any staff has shift
            const hasShifts = dayShifts[dateStr] && Object.keys(dayShifts[dateStr]).length > 0;
            if (!hasShifts) {
                return { available: false, reason: 'Çalışan yok' };
            }
        }
    }

    // Count DELIVERY and SHIPPING appointments from Google Calendar (max 3 total)
    const calendarEvents = googleCalendarEvents[dateStr] || [];
    const now = new Date();
    const todayStr = DateUtils.toLocalDate(now);

    const deliveryCount = calendarEvents.filter((event: any) => {
        // Count both delivery AND shipping appointments (total)
        const appointmentType = event.extendedProperties?.private?.appointmentType;
        if (appointmentType !== 'delivery' && appointmentType !== 'shipping') {
            return false;
        }

        // If today and time has passed, don't count
        if (dateStr === todayStr && event.start) {
            // Use time field from backend
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

    // Max 3 check for delivery/shipping appointments (total)
    if (selectedAppointmentType === 'delivery' || selectedAppointmentType === 'shipping') {
        const maxDaily = (window as any).CONFIG?.MAX_DAILY_DELIVERY_APPOINTMENTS || 4;
        if (deliveryCount >= maxDaily) {
            return { available: false, reason: `Saat takdim/gönderi randevuları dolu (${deliveryCount}/${maxDaily})` };
        }
    }

    return { available: true };
}

/**
 * Memoized version of checkDayAvailability
 * ⚡ PERFORMANCE: Caches results per dateStr to avoid repeated calculations (28-31 calls per render)
 * Cache is automatically cleared when state changes by clearAvailabilityCache()
 */
export const checkDayAvailability = memoize(checkDayAvailabilityBase);

/**
 * Clear availability cache - Call when data changes (after loadMonthData, type change, etc.)
 */
export function clearAvailabilityCache(): void {
    checkDayAvailability.clearCache();
}

// ==================== DAY SELECTION ====================

/**
 * Select a day
 * ⚡ PERFORMANCE: Async to support dynamic imports (better tree-shaking)
 */
export async function selectDay(dateStr: string): Promise<void> {
    state.set('selectedDate', dateStr);
    const specificStaffId = state.get('specificStaffId');
    const selectedAppointmentType = state.get('selectedAppointmentType');
    const dayShifts = state.get('dayShifts');
    // v3.9: Tüm mantık profil ayarlarına göre çalışır
    const profilAyarlari = state.get('profilAyarlari');
    const staffFilter = profilAyarlari?.staffFilter || 'all';
    const assignByAdmin = profilAyarlari?.assignByAdmin === true;
    const idKontrolu = profilAyarlari?.idKontrolu === true;

    // ⚡ PERFORMANCE: Only update previous and new selected elements (reduce reflow)
    const prev = document.querySelector('.calendar-day.selected');
    if (prev) prev.classList.remove('selected');

    const newDay = document.querySelector(`.calendar-day[data-date="${dateStr}"]`);
    if (newDay) newDay.classList.add('selected');

    // v3.5: staffFilter === 'none' - skip staff selection, go directly to time
    if (staffFilter === 'none') {
        state.set('selectedStaff', null); // No staff assigned, admin will assign later
        state.set('selectedShiftType', 'full'); // Default shift type for time slots
        const { displayAvailableTimeSlots } = await import('./TimeSelectorComponent');
        displayAvailableTimeSlots();
        revealSection('timeSection');
        hideSection('staffSection');
        hideSection('detailsSection');
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) submitBtn.style.display = 'none';
        return;
    }

    // v3.8: vardiyaKontrolu kontrolü
    const vardiyaKontrolu = profilAyarlari?.vardiyaKontrolu !== false; // default true

    // v3.6: staffFilter === 'self' - auto-select staff from URL ID, hide staff section
    if (staffFilter === 'self' && specificStaffId && specificStaffId !== '0') {
        state.set('selectedStaff', specificStaffId); // Use secure ID from URL (string)
        // v3.8: vardiyaKontrolu=false ise tüm slotlar için 'full' kullan
        const shiftType = vardiyaKontrolu
            ? (dayShifts[dateStr]?.[specificStaffId] || dayShifts[dateStr]?.[parseInt(specificStaffId)] || 'full')
            : 'full';
        state.set('selectedShiftType', shiftType);
        const { displayAvailableTimeSlots } = await import('./TimeSelectorComponent');
        displayAvailableTimeSlots();
        revealSection('timeSection');
        hideSection('staffSection');
        hideSection('detailsSection');
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) submitBtn.style.display = 'none';
        return;
    }

    // v3.7: staffFilter === 'user' - auto-select logged-in admin's staff, hide staff section
    // Not: iframe'de AdminAuth erişilemez, app.ts'te URL parametresinden selectedStaff ayarlanmış olmalı
    if (staffFilter === 'user') {
        // Önce state'teki selectedStaff'ı kontrol et (iframe için app.ts'te ayarlanmış olabilir)
        let userStaffId = state.get('selectedStaff');

        // Fallback: iframe dışında (doğrudan customer form) AdminAuth dene
        if (!userStaffId) {
            const currentUser = (window as any).AdminAuth?.getCurrentUser?.();
            userStaffId = currentUser?.id;
            if (userStaffId) {
                state.set('selectedStaff', userStaffId);
            }
        }

        if (userStaffId) {
            // v3.8: vardiyaKontrolu=false ise tüm slotlar için 'full' kullan
            const shiftType = vardiyaKontrolu
                ? (dayShifts[dateStr]?.[userStaffId] || dayShifts[dateStr]?.[parseInt(userStaffId)] || 'full')
                : 'full';
            state.set('selectedShiftType', shiftType);
            const { displayAvailableTimeSlots } = await import('./TimeSelectorComponent');
            displayAvailableTimeSlots();
            revealSection('timeSection');
            hideSection('staffSection');
            hideSection('detailsSection');
            const submitBtn = document.getElementById('submitBtn');
            if (submitBtn) submitBtn.style.display = 'none';
            return;
        }
    }

    // NEW: For staff=0 and management appointment, go directly to time selection
    if (specificStaffId === '0' && selectedAppointmentType === 'management') {
        // No shift limit for management appointments - all hours available
        state.set('selectedStaff', 0);
        state.set('selectedShiftType', 'management');
        // ⚡ PERFORMANCE: Dynamic import for better tree-shaking and code splitting
        const { displayAvailableTimeSlots } = await import('./TimeSelectorComponent');
        displayAvailableTimeSlots();
        revealSection('timeSection');
        hideSection('staffSection');
        hideSection('detailsSection');
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) submitBtn.style.display = 'none';
    }
    // staff=0 but other types (delivery, service, meeting) - show staff selection
    else if (specificStaffId === '0' && selectedAppointmentType !== 'management') {
        // ⚡ PERFORMANCE: Dynamic import for better tree-shaking and code splitting
        const { displayAvailableStaff } = await import('./StaffSelectorComponent');
        displayAvailableStaff();
        revealSection('staffSection');
        hideSection('timeSection');
        hideSection('detailsSection');
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) submitBtn.style.display = 'none';
    }
    // v3.9: assignByAdmin=true ise personel seçimi atla, direkt saat seçimine git
    else if (assignByAdmin) {
        state.set('selectedShiftType', 'full'); // Tüm saatler
        const { displayAvailableTimeSlots } = await import('./TimeSelectorComponent');
        displayAvailableTimeSlots();
        hideSection('staffSection');
        revealSection('timeSection');
        hideSection('detailsSection');
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) submitBtn.style.display = 'none';
    }
    // Personel seçimi göster (staffFilter === 'all' ve specificStaffId yok)
    else if (!specificStaffId && staffFilter === 'all') {
        // ⚡ PERFORMANCE: Dynamic import for better tree-shaking and code splitting
        const { displayAvailableStaff } = await import('./StaffSelectorComponent');
        displayAvailableStaff();
        revealSection('staffSection');
        hideSection('timeSection');
        hideSection('detailsSection');
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) submitBtn.style.display = 'none';
    } else {
        // Normal staff link (staff=1, staff=2, etc.) - go directly to time selection
        state.set('selectedStaff', parseInt(specificStaffId!));
        // v3.9: vardiyaKontrolu=false ise vardiya kontrolü atla, 'full' kullan
        const shiftType = vardiyaKontrolu
            ? dayShifts[dateStr]?.[parseInt(specificStaffId!)]
            : 'full';
        if (shiftType) {
            state.set('selectedShiftType', shiftType);
            // ⚡ PERFORMANCE: Dynamic import for better tree-shaking and code splitting
            const { displayAvailableTimeSlots } = await import('./TimeSelectorComponent');
            displayAvailableTimeSlots();
            revealSection('timeSection');
            hideSection('detailsSection');
            const submitBtn = document.getElementById('submitBtn');
            if (submitBtn) submitBtn.style.display = 'none';
        }
    }
}

// ==================== DATA LOADING ====================

/**
 * Load month data (Cache supported)
 */
export async function loadMonthData(): Promise<void> {
    const currentMonth = state.get('currentMonth');
    const specificStaffId = state.get('specificStaffId');
    const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    const monthStr = currentMonth.toISOString().slice(0, 7); // YYYY-MM

    // ⚡ UX: Show loading overlay immediately (before any checks)
    showCalendarLoading();

    // ⭐ VERSION-BASED CACHE INVALIDATION
    // When admin deletes/edits appointment, backend increments version → cache invalidate
    try {
        const cachedVersion = sessionStorage.getItem('dataVersion');
        const versionResult = await apiCall('getDataVersion');

        if (versionResult.success && versionResult.data) {
            const serverVersion = String(versionResult.data);

            // If version changed, clear cache
            if (cachedVersion && cachedVersion !== serverVersion) {
                cache.clear();
                log.info('Cache invalidated: version changed', { old: cachedVersion, new: serverVersion });
            }

            // Save new version
            sessionStorage.setItem('dataVersion', serverVersion);
        }
    } catch (error) {
        log.warn('Version check failed, continuing with cache:', error);
        // Version check error doesn't prevent cache usage
    }

    // Cache check
    const selectedAppointmentType = state.get('selectedAppointmentType');
    // ⚡ PERFORMANCE FIX: Include appointmentType in cache key to prevent stale data
    const cacheKey = `${monthStr}_${specificStaffId || 'all'}_${selectedAppointmentType || 'general'}`;
    if (cache.has(cacheKey)) {
        const cached = cache.get<any>(cacheKey);
        // ⚡ BUG FIX: Validate cache data - dayShifts must have entries for calendar to work
        const hasValidData = cached?.data?.dayShifts && Object.keys(cached.data.dayShifts).length > 0;

        if (cached && Date.now() - cached.timestamp < CACHE_DURATION && hasValidData) {
            // Cache still valid, use it
            state.set('dayShifts', cached.data.dayShifts || {});
            state.set('allAppointments', cached.data.allAppointments || {});
            state.set('googleCalendarEvents', cached.data.googleCalendarEvents || {});
            // ⚡ BUG FIX: Clear memoization cache before re-render to prevent stale availability data
            clearAvailabilityCache();
            renderCalendar();
            hideCalendarLoading(); // Hide overlay after cache hit
            return;
        }
    }

    try {
        // Load shifts and appointments in parallel
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
            state.set('dayShifts', (shiftsResult.data || {}) as Record<string, Shift>);
        }

        if (appointmentsResult.success) {
            state.set('allAppointments', (appointmentsResult.data || {}) as Record<string, Appointment[]>);
        }

        if (calendarResult.success) {
            state.set('googleCalendarEvents', (calendarResult.data || {}) as Record<string, CalendarEvent[]>);
        }

        // Save data to cache
        const dayShifts = state.get('dayShifts');
        const allAppointments = state.get('allAppointments');
        const googleCalendarEvents = state.get('googleCalendarEvents');

        cache.set(cacheKey, {
            timestamp: Date.now(),
            data: {
                dayShifts: { ...dayShifts },
                allAppointments: { ...allAppointments },
                googleCalendarEvents: { ...googleCalendarEvents }
            }
        });

        // ⚡ PERFORMANCE: Clear memoization cache after new data loaded
        clearAvailabilityCache();

        renderCalendar(); // Re-render calendar with new data
        hideCalendarLoading(); // Remove overlay
        hideAlert();
    } catch (error) {
        log.error('Data loading error:', error);
        logError(error, { context: 'loadAllData' });
        // Show error in alert instead of replacing entire page
        showAlert('Takvim verileri yüklenemedi. Lütfen sayfayı yenileyin.', 'error');
        hideCalendarLoading(); // Remove overlay even on error
        renderCalendar(); // Re-render calendar with existing data
    }
}

// ==================== EXPORT ====================

export const CalendarComponent = {
    renderCalendar,
    changeMonth,
    checkDayAvailability,
    selectDay,
    loadMonthData,
};

// Export to window for HTML onclick handlers
if (typeof window !== 'undefined') {
    (window as any).changeMonth = changeMonth;
    (window as any).renderCalendar = renderCalendar;
    (window as any).selectDay = selectDay;
    (window as any).CalendarComponent = CalendarComponent;
}
