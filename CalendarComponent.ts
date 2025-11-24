/**
 * CalendarComponent.ts
 *
 * Calendar rendering and month navigation
 * Extracted from app.ts (lines 332-567)
 */

import { state } from './StateManager';
import { cache } from './CacheManager';
import { revealSection, hideSection, showLoading, hideAlert, showLoadingError } from './UIManager';
import { DateUtils } from './date-utils';
import { apiCall } from './api-service';
import { logError } from './monitoring';

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
    const cacheKey = `${monthStr}_${specificStaffId || 'all'}`;

    if (cache.has(cacheKey)) {
        const cached = cache.get<any>(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            // Cache available, render directly (no API call)
            state.set('dayShifts', cached.data.dayShifts || {});
            state.set('allAppointments', cached.data.allAppointments || {});
            state.set('googleCalendarEvents', cached.data.googleCalendarEvents || {});
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
    const isManagementLink = state.get('isManagementLink');

    for (let day = 1; day <= daysInMonth; day++) {
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        dayEl.textContent = String(day);

        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        date.setHours(0, 0, 0, 0);
        const dateStr = DateUtils.toLocalDate(date);

        // Add data-date attribute
        dayEl.setAttribute('data-date', dateStr);

        // Past days - allow today for staff=0, management appointments or management links
        const allowToday = specificStaffId === '0' || selectedAppointmentType === 'management' || isManagementLink;
        if (date < today || (date.getTime() === today.getTime() && !allowToday)) {
            dayEl.classList.add('past');
        } else {
            // Check availability
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

    // Add all elements to DOM at once (performance improvement)
    grid.appendChild(fragment);
}

// ==================== DAY AVAILABILITY ====================

/**
 * Check day availability
 */
export function checkDayAvailability(dateStr: string): { available: boolean; reason?: string } {
    const selectedAppointmentType = state.get('selectedAppointmentType');
    const specificStaffId = state.get('specificStaffId');
    const dayShifts = state.get('dayShifts');
    const googleCalendarEvents = state.get('googleCalendarEvents');

    // NEW: All days available for management appointments
    if (selectedAppointmentType === 'management') {
        return { available: true };
    }

    // Shift check
    if (specificStaffId && specificStaffId !== '0') {
        // Normal staff link - check only that staff's shift
        const staffHasShift = dayShifts[dateStr] && dayShifts[dateStr][specificStaffId];
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
            return { available: false, reason: `Teslim/gönderi randevuları dolu (${deliveryCount}/${maxDaily})` };
        }
    }

    return { available: true };
}

// ==================== DAY SELECTION ====================

/**
 * Select a day
 */
export function selectDay(dateStr: string): void {
    state.set('selectedDate', dateStr);
    const specificStaffId = state.get('specificStaffId');
    const selectedAppointmentType = state.get('selectedAppointmentType');
    const isManagementLink = state.get('isManagementLink');
    const dayShifts = state.get('dayShifts');

    // ⚡ PERFORMANCE: Only update previous and new selected elements (reduce reflow)
    const prev = document.querySelector('.calendar-day.selected');
    if (prev) prev.classList.remove('selected');

    const newDay = document.querySelector(`.calendar-day[data-date="${dateStr}"]`);
    if (newDay) newDay.classList.add('selected');

    // NEW: For staff=0 and management appointment, go directly to time selection
    if (specificStaffId === '0' && selectedAppointmentType === 'management') {
        // No shift limit for management appointments - all hours available
        state.set('selectedStaff', 0);
        state.set('selectedShiftType', 'management');
        const { displayAvailableTimeSlots } = require('./TimeSelectorComponent');
        displayAvailableTimeSlots();
        revealSection('timeSection');
        hideSection('staffSection');
        hideSection('detailsSection');
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) submitBtn.style.display = 'none';
    }
    // staff=0 but other types (delivery, service, meeting) - show staff selection
    else if (specificStaffId === '0' && selectedAppointmentType !== 'management') {
        const { displayAvailableStaff } = require('./StaffSelectorComponent');
        displayAvailableStaff();
        revealSection('staffSection');
        hideSection('timeSection');
        hideSection('detailsSection');
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) submitBtn.style.display = 'none';
    }
    // Show staff selection (general link) - NOT for management links
    else if (!specificStaffId && !isManagementLink) {
        const { displayAvailableStaff } = require('./StaffSelectorComponent');
        displayAvailableStaff();
        revealSection('staffSection');
        hideSection('timeSection');
        hideSection('detailsSection');
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) submitBtn.style.display = 'none';
    }
    // Management link - go directly to time selection
    else if (isManagementLink) {
        state.set('selectedShiftType', 'management'); // Placeholder shift type for VIP links
        const { displayAvailableTimeSlots } = require('./TimeSelectorComponent');
        displayAvailableTimeSlots();
        hideSection('staffSection');
        revealSection('timeSection');
        hideSection('detailsSection');
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) submitBtn.style.display = 'none';
    } else {
        // Normal staff link (staff=1, staff=2, etc.) - go directly to time selection
        state.set('selectedStaff', parseInt(specificStaffId!));
        const shiftType = dayShifts[dateStr]?.[parseInt(specificStaffId!)];
        if (shiftType) {
            state.set('selectedShiftType', shiftType);
            const { displayAvailableTimeSlots } = require('./TimeSelectorComponent');
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

    // ⭐ VERSION-BASED CACHE INVALIDATION
    // When admin deletes/edits appointment, backend increments version → cache invalidate
    try {
        const cachedVersion = sessionStorage.getItem('dataVersion');
        const versionResult = await apiCall('getDataVersion');

        if (versionResult.success && versionResult.data) {
            const serverVersion = versionResult.data;

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
    const cacheKey = `${monthStr}_${specificStaffId || 'all'}`;
    if (cache.has(cacheKey)) {
        const cached = cache.get<any>(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            // Cache still valid, use it
            state.set('dayShifts', cached.data.dayShifts || {});
            state.set('allAppointments', cached.data.allAppointments || {});
            state.set('googleCalendarEvents', cached.data.googleCalendarEvents || {});
            renderCalendar();
            return;
        }
    }

    showLoading();

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
            state.set('dayShifts', shiftsResult.data || {});
        }

        if (appointmentsResult.success) {
            state.set('allAppointments', appointmentsResult.data || {});
        }

        if (calendarResult.success) {
            state.set('googleCalendarEvents', calendarResult.data || {});
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

        renderCalendar(); // Re-render calendar
        hideAlert();
    } catch (error) {
        log.error('Data loading error:', error);
        logError(error, { context: 'loadAllData' });
        showLoadingError();
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
