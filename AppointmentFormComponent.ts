/**
 * AppointmentFormComponent.ts
 *
 * Appointment form submission and validation
 * Extracted from app.ts (lines 293-412)
 */

import { state, Staff } from './StateManager';
import { showAlert } from './UIManager';
import { showSuccessPage } from './SuccessPageComponent';
import { StringUtils } from './string-utils';
import { ButtonUtils } from './button-utils';
import { apiCall } from './api-service';
import { logError } from './monitoring';
import { sanitizeName, sanitizePhone, sanitizeEmail, sanitizeInput } from './security-helpers';

// ==================== TURNSTILE RESET ====================

/**
 * Reset Cloudflare Turnstile widget
 * Called after failed submission to get a new token
 */
function resetTurnstile(): void {
    try {
        // Clear stored token
        (window as any).turnstileToken = null;
        (window as any).turnstileVerified = false;
        const turnstile = (window as any).turnstile;
        if (turnstile) {
            const widgetContainer = document.getElementById('turnstileWidget');
            if (widgetContainer) {
                turnstile.reset(widgetContainer);
            }
        }
    } catch (error) {
        console.warn('Turnstile reset failed:', error);
    }
}

// ==================== FORM SUBMISSION ====================

/**
 * Initialize appointment form submit handler
 */
export function initAppointmentForm(): void {
    const submitBtn = document.getElementById('submitBtn');
    console.error('[FORM] initAppointmentForm called, submitBtn:', !!submitBtn);
    if (!submitBtn) return;

    submitBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
            await handleFormSubmit();
        } catch (err) {
            console.error('[FORM] UNCAUGHT ERROR IN handleFormSubmit:', err);
        }
    });
}

/**
 * Handle form submission
 */
async function handleFormSubmit(): Promise<void> {
    console.error('[SUBMIT] handleFormSubmit ENTERED');
    // Input sanitization - XSS ve injection koruması
    const rawName = (document.getElementById('customerName') as HTMLInputElement).value;
    const rawPhone = (document.getElementById('customerPhone') as HTMLInputElement).value;
    const rawEmail = (document.getElementById('customerEmail') as HTMLInputElement).value;
    const rawNote = (document.getElementById('customerNote') as HTMLTextAreaElement).value;

    const name = StringUtils.toTitleCase(sanitizeName(rawName));
    const phone = sanitizePhone(rawPhone);
    const email = sanitizeEmail(rawEmail);
    const note = sanitizeInput(rawNote, { maxLength: 500 });

    // Get state values
    const selectedAppointmentType = state.get('selectedAppointmentType');
    const selectedDate = state.get('selectedDate');
    const selectedStaff = state.get('selectedStaff');
    const selectedTime = state.get('selectedTime');
    const selectedShiftType = state.get('selectedShiftType');
    const isManagementLink = state.get('isManagementLink');
    const managementLevel = state.get('managementLevel');
    const staffMembers = state.get('staffMembers');

    // KVKK consent check
    const kvkkConsent = document.getElementById('kvkkConsent') as HTMLInputElement;
    if (!kvkkConsent?.checked) {
        showAlert('Lütfen KVKK aydınlatma metnini okuyup onay veriniz.', 'error');
        const kvkkContainer = document.getElementById('kvkkContainer');
        if (kvkkContainer) kvkkContainer.classList.add('error');
        return;
    }
    // Remove error state if checked
    const kvkkContainer = document.getElementById('kvkkContainer');
    if (kvkkContainer) kvkkContainer.classList.remove('error');

    // Cloudflare Turnstile token - always get fresh from widget
    let turnstileToken = (window as any).turnstile?.getResponse();
    if (!turnstileToken) {
        // Fallback to stored token from callback
        turnstileToken = (window as any).turnstileToken;
    }
    if (!turnstileToken) {
        showAlert('Lütfen robot kontrolünü tamamlayın.', 'error');
        console.error('[SUBMIT] Turnstile token missing');
        return;
    }
    console.error('[SUBMIT] Token found, length:', turnstileToken.length);

    if (!selectedAppointmentType) {
        showAlert('Lutfen randevu tipi secin.', 'error');
        console.error('[SUBMIT] No appointment type');
        return;
    }

    // NEW: selectedStaff can be -1 (management link random), 0 (normal management), positive number (staff)
    if (!selectedDate || selectedStaff === null || selectedStaff === undefined || !selectedTime) {
        showAlert('Lutfen tarih, calisan ve saat secin.', 'error');
        console.error('[SUBMIT] Missing:', { selectedDate, selectedStaff, selectedTime });
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

    const btn = document.getElementById('submitBtn') as HTMLButtonElement;
    ButtonUtils.setLoading(btn, 'Randevu oluşturuluyor');

    // NEW: For staff=0, use managementContactPerson instead of staffName
    let staffName: string;
    let staff: Staff | undefined = undefined;
    let assignedStaffId: number | null = selectedStaff;

    // If management link (hk, ok, hmk) - don't assign staff, admin will assign
    if (isManagementLink) {
        // Create appointment without staff assignment
        assignedStaffId = null;
        staffName = 'Atanmadı'; // Placeholder
    } else if (selectedStaff === 0) {
        staffName = (window as any).managementContactPerson || 'Yönetim';
        assignedStaffId = 0;
    } else {
        staff = staffMembers.find((s: Staff) => s.id == selectedStaff);
        if (!staff) {
            showAlert('Çalışan bilgisi bulunamadı. Lütfen sayfayı yenileyin.', 'error');
            btn.disabled = false;
            btn.textContent = 'Randevuyu Onayla';
            return;
        }
        staffName = staff.name;
    }

    try {
        console.error('[SUBMIT] Making API call createAppointment...');
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
            managementLevel: managementLevel,  // Management link level (1, 2, 3 or null)
            isVipLink: isManagementLink,  // VIP link flag (#hk, #ok, #hmk)
            kvkkConsent: true  // KVKK onayı (frontend'de zaten kontrol edildi)
        });

        console.error('[SUBMIT] API result:', JSON.stringify(result));
        if (result.success) {
            // Save last appointment data
            const appointmentData = {
                customerName: name,
                customerPhone: phone,
                customerEmail: email,
                customerNote: note,
                staffName: staffName,
                staffPhone: staff?.phone || '',
                staffEmail: staff?.email || '',
                date: selectedDate!,
                time: selectedTime!,
                appointmentType: selectedAppointmentType!,
                duration: (window as any).CONFIG?.APPOINTMENT_HOURS?.interval || 30
            };
            state.set('lastAppointmentData', appointmentData);

            // Export to window for calendar-integration.js module access
            // (window.lastAppointmentData is already configured as getter/setter)

            showSuccessPage(selectedDate!, selectedTime!, staffName, note);
        } else {
            showAlert('Randevu olusturulamadi: ' + (result.error || 'Bilinmeyen hata'), 'error');
            ButtonUtils.reset(btn);
            // ⚡ FIX: Reset Turnstile widget after error (token is single-use)
            resetTurnstile();
        }
    } catch (error) {
        console.error('[SUBMIT] CATCH ERROR:', error);
        logError(error as Error, { context: 'confirmAppointment', selectedStaff, selectedDate, selectedTime });
        showAlert('Randevu oluşturulamadı. Lütfen tekrar deneyiniz.', 'error');
        ButtonUtils.reset(btn);
        // ⚡ FIX: Reset Turnstile widget after error (token is single-use)
        resetTurnstile();
    }
}

// ==================== EXPORT ====================

export const AppointmentForm = {
    initAppointmentForm,
};

// Export to window
if (typeof window !== 'undefined') {
    (window as any).initAppointmentForm = initAppointmentForm;
    (window as any).AppointmentForm = AppointmentForm;
    (window as any).handleFormSubmit = handleFormSubmit;
}
