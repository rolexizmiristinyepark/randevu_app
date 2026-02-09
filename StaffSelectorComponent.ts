/**
 * StaffSelectorComponent.ts
 *
 * Staff member loading and selection
 * Extracted from app.ts (lines 705-814)
 */

import { state, Staff } from './StateManager';
import { revealSection, hideSection } from './UIManager';
import { createElement } from './security-helpers';
import { apiCall } from './api-service';
import { createDebugLogger } from './debug-logger';

// Debug logger - uses centralized debug module
const log = createDebugLogger('StaffSelector');

// ==================== DATA LOADING ====================

/**
 * Load staff members from backend
 */
export async function loadStaffMembers(): Promise<void> {
    // Silent data loading (no message to user)
    try {
        const response = await apiCall('getStaff');
        if (response.success) {
            state.set('staffMembers', response.data as any[]);
        } else {
            log.error('Staff members could not be loaded:', response.error);
        }
    } catch (error) {
        log.error('API error:', error);
    }
}

/**
 * Load settings from backend
 */
export async function loadSettings(): Promise<void> {
    try {
        const response = await apiCall('getSettings');
        if (response.success) {
            // Update CONFIG with server settings (use window.CONFIG for safety)
            const config = (window as any).CONFIG;
            const data = response.data as any;
            if (config) {
                config.APPOINTMENT_HOURS = config.APPOINTMENT_HOURS || {};
                // NOT: interval artık profil ayarlarından geliyor (profilAyarlari.slotGrid ve .duration)
                // Burada sadece maxDaily güncelleniyor (teslim limiti)
                config.MAX_DAILY_DELIVERY_APPOINTMENTS = data.maxDaily || 4;
            }
        }
    } catch (error) {
        log.error('Settings could not be loaded:', error);
    }
}

// ==================== STAFF DISPLAY ====================

/**
 * Display available staff members for selected date
 */
export function displayAvailableStaff(): void {
    const staffList = document.getElementById('staffList');
    if (!staffList) return;

    // Clear existing content safely
    while (staffList.firstChild) {
        staffList.removeChild(staffList.firstChild);
    }

    const staffMembers = state.get('staffMembers');
    const selectedDate = state.get('selectedDate');
    const dayShifts = state.get('dayShifts');
    const profilAyarlari = state.get('profilAyarlari');
    const staffFilter = profilAyarlari?.staffFilter || 'all';

    // v3.5: Filter staff by role
    let filteredStaff = staffMembers;
    if (staffFilter.startsWith('role:')) {
        const targetRole = staffFilter.substring(5);
        filteredStaff = staffMembers.filter((s: Staff) => s.role === targetRole);
    }
    // 'all' shows everyone, 'none'/'self'/'user'/'linked' handled in app.ts (section hidden)

    if (filteredStaff.length === 0) {
        // Safe DOM manipulation
        const emptyDiv = createElement('div', {
            style: 'grid-column: 1/-1; text-align: center; padding: 40px;'
        });
        const spinner = createElement('div', {
            className: 'spinner',
            style: 'margin: 0 auto 20px;'
        });
        const reloadBtn = createElement('button', {
            className: 'btn',
            style: 'padding: 12px 30px;'
        }) as HTMLButtonElement;
        reloadBtn.textContent = 'Yenile';
        reloadBtn.addEventListener('click', () => location.reload());

        emptyDiv.appendChild(spinner);
        emptyDiv.appendChild(reloadBtn);
        staffList.appendChild(emptyDiv);
        return;
    }

    const dayShiftsForDate = dayShifts[selectedDate!] || {};

    // v3.8: vardiyaKontrolu=false ise tüm personeller müsait görünsün
    const vardiyaKontrolu = profilAyarlari?.vardiyaKontrolu !== false; // default true

    // v3.9: Önceden seçili staff'ı hatırla (gün değiştiğinde korunması için)
    const previouslySelectedStaff = state.get('selectedStaff');

    // ⚡ v3.9.13 PERFORMANCE: Use DocumentFragment to batch DOM updates (single reflow)
    const fragment = document.createDocumentFragment();

    filteredStaff.forEach((staff: Staff) => {
        if (!staff.active) return;

        const shiftType = dayShiftsForDate[staff.id];
        // v3.8: vardiyaKontrolu=false ise tüm personeller müsait
        const isWorking = vardiyaKontrolu ? !!shiftType : true;
        // v3.8: vardiyaKontrolu=false ise 'full' kullan
        const effectiveShiftType = vardiyaKontrolu ? (shiftType || 'full') : 'full';

        const card = document.createElement('div');
        card.className = 'staff-card' + (!isWorking ? ' unavailable' : '');

        // v3.9: Önceden seçili staff'ı işaretle
        if (previouslySelectedStaff && String(staff.id) === String(previouslySelectedStaff) && isWorking) {
            card.classList.add('selected');
        }

        // Safe DOM manipulation - XSS protection
        const nameDiv = createElement('div', { className: 'staff-name' });
        nameDiv.textContent = staff.name;
        card.appendChild(nameDiv);

        if (isWorking) {
            // ⚡ PERFORMANCE: Async handler for dynamic imports
            card.addEventListener('click', (e) => void selectStaff(staff.id, effectiveShiftType, e));
        } else {
            card.style.opacity = '0.5';
            card.style.cursor = 'not-allowed';
        }

        fragment.appendChild(card);
    });

    // ⚡ v3.9.13: Single DOM update instead of N updates
    staffList.appendChild(fragment);

    // v3.9: Önceden seçili ve hala müsait staff varsa, saat section'ını da göster
    if (previouslySelectedStaff) {
        const selectedStaffData = filteredStaff.find((s: Staff) => String(s.id) === String(previouslySelectedStaff) && s.active);
        if (selectedStaffData) {
            const shiftType = dayShiftsForDate[selectedStaffData.id];
            const isWorking = vardiyaKontrolu ? !!shiftType : true;
            if (isWorking) {
                const effectiveShiftType = vardiyaKontrolu ? (shiftType || 'full') : 'full';
                state.set('selectedShiftType', effectiveShiftType);
                // Saat section'ını göster
                import('./TimeSelectorComponent').then(({ displayAvailableTimeSlots }) => {
                    displayAvailableTimeSlots();
                    revealSection('timeSection');
                });
            }
        }
    }
}

// ==================== STAFF SELECTION ====================

/**
 * Select a staff member
 */
/**
 * ⚡ PERFORMANCE: Async for dynamic imports
 */
export async function selectStaff(staffId: string, shiftType: string, event?: MouseEvent): Promise<void> {
    state.set('selectedStaff', String(staffId));
    state.set('selectedShiftType', shiftType);
    const staffMembers = state.get('staffMembers');

    // Show staff name in header
    const staff = staffMembers.find((s: Staff) => s.id === String(staffId));
    if (staff) {
        const header = document.getElementById('staffHeader');
        if (header) {
            header.textContent = staff.name;
            header.style.visibility = 'visible';
        }
    }

    // ⚡ PERFORMANCE: Only update previous selected element (reduce reflow)
    const prev = document.querySelector('.staff-card.selected');
    if (prev) prev.classList.remove('selected');
    if (event && event.currentTarget) {
        (event.currentTarget as HTMLElement).classList.add('selected');
    }

    // Show time slots section
    // ⚡ PERFORMANCE: Dynamic import for better tree-shaking
    const { displayAvailableTimeSlots } = await import('./TimeSelectorComponent');
    displayAvailableTimeSlots();
    revealSection('timeSection');
    hideSection('detailsSection');
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) submitBtn.style.display = 'none';
}

// ==================== EXPORT ====================

export const StaffSelector = {
    loadStaffMembers,
    loadSettings,
    displayAvailableStaff,
    selectStaff,
};

// Export to window for HTML onclick handlers
if (typeof window !== 'undefined') {
    (window as any).selectStaff = selectStaff;
    (window as any).displayAvailableStaff = displayAvailableStaff;
    (window as any).loadStaffMembers = loadStaffMembers;
    (window as any).loadSettings = loadSettings;
    (window as any).StaffSelector = StaffSelector;
}
