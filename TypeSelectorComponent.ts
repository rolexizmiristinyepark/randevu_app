/**
 * TypeSelectorComponent.ts
 *
 * Handles appointment type selection and management contact selection
 * Extracted from app.ts (lines 240-329)
 */

import { state } from './StateManager';
import { revealSection } from './UIManager';

// ==================== TYPES ====================

export type AppointmentType = 'delivery' | 'service' | 'meeting' | 'shipping' | 'management';

// ==================== MANAGEMENT CONTACT SELECTION ====================

/**
 * Select management contact person (HK or OK) for management appointments
 */
export function selectManagementContact(contactId: string, contactName: string): void {
    // Set management type
    state.set('selectedAppointmentType', 'management');
    state.set('selectedStaff', 0);
    state.set('managementContactPerson', contactId); // HK or OK
    (window as any).managementContactPerson = contactId; // Backward compatibility

    // Remove selected class from all management buttons
    document.querySelectorAll('.management-sub-btn').forEach(btn => {
        btn.classList.remove('selected');
    });

    // Add selected class to clicked button
    const clickedBtn = document.querySelector(`[data-management="${contactId}"]`);
    if (clickedBtn) {
        clickedBtn.classList.add('selected');
    }

    // Update header
    const header = document.getElementById('staffHeader');
    if (header) {
        header.textContent = contactName;
        header.style.visibility = 'visible';
    }

    // NOTE: Don't hide sub-options - selected button should remain visible
    // Keep buttons open so user can see their selection

    // Reveal calendar section
    const { renderCalendar, loadMonthData } = require('./CalendarComponent');
    revealSection('calendarSection');
    renderCalendar();
    loadMonthData();
}

// ==================== APPOINTMENT TYPE SELECTION ====================

/**
 * Handle appointment type selection
 * @param type - The appointment type (delivery, service, meeting, shipping, management)
 */
export function selectAppointmentType(type: AppointmentType): void {
    // If management type is selected, show HK/OK buttons first
    if (type === 'management') {
        const managementCard = document.getElementById('typeManagement');
        const subOptions = document.getElementById('managementSubOptions');

        if (!managementCard || !subOptions) return;

        // Toggle sub-options (open/close)
        if (subOptions.classList.contains('show')) {
            subOptions.classList.remove('show');
            managementCard.classList.remove('management-expanded');
            managementCard.classList.remove('selected');
            state.set('selectedAppointmentType', null);
        } else {
            // Remove selection from other cards
            const prev = document.querySelector('.type-card.selected');
            if (prev) {
                prev.classList.remove('selected');
                const prevSub = prev.querySelector('.management-sub-options');
                if (prevSub) prevSub.classList.remove('show');
            }

            // Select and expand management card
            managementCard.classList.add('selected');
            managementCard.classList.add('management-expanded');

            // Show sub-options with animation
            subOptions.style.display = 'flex';
            setTimeout(() => {
                subOptions.classList.add('show');
            }, 10);
        }
        return; // Don't show calendar yet, wait for HK/OK selection
    }

    // For other types, normal flow
    state.set('selectedAppointmentType', type);

    // ⚡ PERFORMANCE: Only update previous selected element (reduce reflow)
    const prev = document.querySelector('.type-card.selected');
    if (prev) {
        prev.classList.remove('selected');
        prev.classList.remove('management-expanded');
        const prevSub = prev.querySelector('.management-sub-options');
        if (prevSub) {
            prevSub.classList.remove('show');
            setTimeout(() => {
                (prevSub as HTMLElement).style.display = 'none';
            }, 400);
        }
    }

    const selectedCard = document.querySelector(`.type-card[data-type="${type}"]`);
    if (selectedCard) {
        selectedCard.classList.add('selected');
    }

    // Reveal calendar and load data (animated + smooth scroll)
    const { renderCalendar, loadMonthData } = require('./CalendarComponent');
    revealSection('calendarSection');
    renderCalendar();
    loadMonthData();
}

// ==================== EXPORT ====================

export const TypeSelector = {
    selectAppointmentType,
    selectManagementContact,
};

// Export to window for HTML onclick handlers
if (typeof window !== 'undefined') {
    (window as any).selectAppointmentType = selectAppointmentType;
    (window as any).selectManagementContact = selectManagementContact;
    (window as any).TypeSelector = TypeSelector;
}
