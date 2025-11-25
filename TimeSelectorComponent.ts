/**
 * TimeSelectorComponent.ts
 *
 * Time slot display and selection
 * Extracted from app.ts (lines 822-1094)
 */

import { state } from './StateManager';
import { revealSection, hideSection } from './UIManager';
import { apiCall } from './api-service';
import { logError } from './monitoring';

// Debug logger
const log = {
    error: (...args: any[]) => (window as any).CONFIG?.DEBUG && console.error(...args),
    warn: (...args: any[]) => (window as any).CONFIG?.DEBUG && console.warn(...args),
    info: (...args: any[]) => (window as any).CONFIG?.DEBUG && console.info(...args),
    log: (...args: any[]) => (window as any).CONFIG?.DEBUG && console.log(...args)
};

// ==================== TIME SLOT DISPLAY ====================

/**
 * ⭐⭐⭐⭐⭐ CORE: Get available hours from backend and display
 * Backend = Single Source of Truth
 * Slot Universe: 11-20 full hours
 * Booked hours: faded and unclickable
 */
export async function displayAvailableTimeSlots(): Promise<void> {
    const container = document.getElementById('timeSlots');
    if (!container) return;

    container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 20px;"><div class="spinner"></div></div>';

    const selectedDate = state.get('selectedDate');
    const selectedShiftType = state.get('selectedShiftType');
    const selectedAppointmentType = state.get('selectedAppointmentType');
    const isManagementLink = state.get('isManagementLink');
    const managementLevel = state.get('managementLevel');

    // Check required parameters
    // Don't check shifts for VIP links (staff will be assigned later)
    if (isManagementLink) {
        if (!selectedDate || !selectedAppointmentType) {
            container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 20px; color: #dc3545;">Lütfen önce tarih ve randevu türü seçin.</div>';
            return;
        }
    } else {
        if (!selectedDate || !selectedShiftType || !selectedAppointmentType) {
            container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 20px; color: #dc3545;">Lütfen önce tarih, vardiya ve randevu türü seçin.</div>';
            return;
        }
    }

    try {
        // VIP links (hk, ok, hmk) - Special logic for ALL appointment types
        if (isManagementLink) {
            // Spinner already visible, API call in progress...

            // Get all VIP appointments from backend for this day
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

            const { slots } = appointmentsResult.data as any;

            // Clear spinner, render slots
            container.innerHTML = '';

            // Check if today - to filter past times
            const today = new Date();
            const todayStr = today.getFullYear() + '-' +
                           String(today.getMonth() + 1).padStart(2, '0') + '-' +
                           String(today.getDate()).padStart(2, '0');
            const isToday = selectedDate === todayStr;
            const currentHour = today.getHours();
            const currentMinute = today.getMinutes();

            // Remove duplicate slots (20:00 can appear twice)
            const uniqueSlots: any[] = [];
            const seenTimes = new Set<string>();
            slots.forEach((slot: any) => {
                if (!seenTimes.has(slot.time)) {
                    seenTimes.add(slot.time);
                    uniqueSlots.push(slot);
                }
            });

            // Render slots
            uniqueSlots.forEach((slot: any) => {
                // For VIP links, only show full hours (filter out half hours)
                const [slotHour, slotMinute] = slot.time.split(':').map(Number);
                if (slotMinute !== 0) {
                    return; // Half hour slot, don't show (VIP links use 1-hour slots)
                }

                // If today and past time, skip
                if (isToday) {
                    if (slotHour < currentHour || (slotHour === currentHour && slotMinute <= currentMinute)) {
                        return; // Past slot, don't show
                    }
                }

                const btn = document.createElement('div');

                if (slot.available) {
                    // ✅ AVAILABLE - Less than 2 appointments in this slot
                    btn.className = 'slot-btn';
                    btn.textContent = slot.time;
                    if (slot.count === 1) {
                        btn.title = `Bu saatte 1 randevu var (2. randevu olabilir)`;
                    }
                    btn.addEventListener('click', () => selectTimeSlot(slot.time, btn));
                } else {
                    // ❌ FULL - Already 2 appointments in this slot
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

        // Normal management appointment (Management type selected from staff=0)
        if (selectedAppointmentType === 'management') {
            container.innerHTML = '';

            // Normal management appointment (selected from staff=0) - all hours available (with half hours)
            const managementSlots: { time: string }[] = [];

            // All hours and half hours from 10:00 to 20:00
            for (let hour = 10; hour <= 20; hour++) {
                managementSlots.push({ time: `${hour}:00` });
                if (hour < 20) { // Don't add 20:30, end at 20:00
                    managementSlots.push({ time: `${hour}:30` });
                }
            }

            // Check if today - to filter past times
            const today = new Date();
            const todayStr = today.getFullYear() + '-' +
                           String(today.getMonth() + 1).padStart(2, '0') + '-' +
                           String(today.getDate()).padStart(2, '0');
            const isToday = selectedDate === todayStr;
            const currentHour = today.getHours();
            const currentMinute = today.getMinutes();

            // Render all slots as available
            managementSlots.forEach(slot => {
                // If today and past time, skip
                if (isToday) {
                    const [slotHour, slotMinute] = slot.time.split(':').map(Number);
                    if (slotHour !== undefined && slotMinute !== undefined &&
                        (slotHour < currentHour || (slotHour === currentHour && slotMinute <= currentMinute))) {
                        return; // Past slot, don't show
                    }
                }

                const btn = document.createElement('div');
                btn.className = 'slot-btn';
                btn.textContent = slot.time;
                btn.addEventListener('click', () => selectTimeSlot(slot.time, btn));
                container.appendChild(btn);
            });
            return;
        }

        // ⭐ NEW: getDayStatus endpoint - all business rules at once
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

        const { availableHours } = dayStatusResult.data as any;
        const { slots } = slotsResult.data as any;

        container.innerHTML = '';

        // NOTE: Delivery limit check is done in calendar (day disabled)
        // This function should not be reached because day is already unselectable

        // Check if today - to filter past times for staff=0
        const today = new Date();
        const todayStr = today.getFullYear() + '-' +
                       String(today.getMonth() + 1).padStart(2, '0') + '-' +
                       String(today.getDate()).padStart(2, '0');
        const isToday = selectedDate === todayStr;
        const currentHour = today.getHours();
        const currentMinute = today.getMinutes();
        const specificStaffId = state.get('specificStaffId');
        const isStaff0 = specificStaffId === '0';

        // If no available hours, show info
        if (availableHours.length === 0) {
            const infoDiv = document.createElement('div');
            infoDiv.style.cssText = 'grid-column: 1/-1; text-align: center; padding: 20px; color: #dc3545;';
            infoDiv.textContent = 'Bu gün için müsait saat bulunmamaktadır.';
            container.appendChild(infoDiv);
            return;
        }

        // Render slots
        slots.forEach((slot: any) => {
            // staff=0 + today + past time, skip
            if (isStaff0 && isToday) {
                const [slotHour, slotMinute] = slot.time.split(':').map(Number);
                if (slotHour < currentHour || (slotHour === currentHour && slotMinute <= currentMinute)) {
                    return; // Past slot, don't show
                }
            }

            const btn = document.createElement('div');
            const isAvailable = availableHours.includes(slot.hour);

            if (isAvailable) {
                // ✅ AVAILABLE - normal, clickable
                btn.className = 'slot-btn';
                btn.textContent = slot.time;
                btn.addEventListener('click', () => selectTimeSlot(slot.time, btn));
            } else {
                // ❌ FULL - faded, unclickable, aria-disabled
                btn.className = 'slot-btn slot--disabled';
                btn.textContent = slot.time;
                btn.title = 'Bu saat dolu';
                btn.setAttribute('aria-disabled', 'true');
                // pointer-events: none will be handled in CSS
            }

            container.appendChild(btn);
        });

    } catch (error) {
        log.error('displayAvailableTimeSlots error:', error);
        logError(error, { context: 'displayAvailableTimeSlots', date: selectedDate, shiftType: selectedShiftType });
        container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 20px; color: #dc3545;">Saatler yüklenirken bir hata oluştu. Lütfen sayfayı yenileyin.</div>';
    }
}

// ==================== TIME SLOT SELECTION ====================

/**
 * Select a time slot
 */
export function selectTimeSlot(timeStr: string, element: HTMLElement): void {
    state.set('selectedTime', timeStr);
    const isManagementLink = state.get('isManagementLink');
    const selectedAppointmentType = state.get('selectedAppointmentType');
    const selectedStaff = state.get('selectedStaff');

    // ⚡ PERFORMANCE: Only update previous selected element (reduce reflow)
    const prev = document.querySelector('.slot-btn.selected');
    if (prev) prev.classList.remove('selected');
    element.classList.add('selected');

    // Management link (hk, ok, hmk) - go directly to form
    if (isManagementLink) {
        // No staff selection, backend will randomly assign
        state.set('selectedStaff', -1); // Placeholder: Backend will randomly assign

        // Show form directly
        revealSection('detailsSection');
        const turnstileContainer = document.getElementById('turnstileContainer');
        if (turnstileContainer) turnstileContainer.style.display = 'block';
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) submitBtn.style.display = 'block';

        // Keep staff section hidden
        hideSection('staffSection');
    }
    // Manual appointment management (staff=0) - go directly to form
    else if (selectedAppointmentType === 'management' && selectedStaff === 0) {
        // HK/OK already selected (from inline buttons), show form directly
        hideSection('staffSection');
        revealSection('detailsSection');
        const turnstileContainer = document.getElementById('turnstileContainer');
        if (turnstileContainer) turnstileContainer.style.display = 'block';
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) submitBtn.style.display = 'block';
    } else {
        revealSection('detailsSection');
        const turnstileContainer = document.getElementById('turnstileContainer');
        if (turnstileContainer) turnstileContainer.style.display = 'block';
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) submitBtn.style.display = 'block';
    }
}

// ==================== EXPORT ====================

export const TimeSelector = {
    displayAvailableTimeSlots,
    selectTimeSlot,
};

// Export to window for HTML onclick handlers
if (typeof window !== 'undefined') {
    (window as any).selectTimeSlot = selectTimeSlot;
    (window as any).displayAvailableTimeSlots = displayAvailableTimeSlots;
    (window as any).TimeSelector = TimeSelector;
}
