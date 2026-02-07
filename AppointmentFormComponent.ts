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
import { ButtonAnimator } from './button-utils';
import { apiCall } from './api-service';
import { logError } from './monitoring';
import { sanitizeName, sanitizeEmail, sanitizeInput } from './security-helpers';
import { initPhoneInput, getPhoneNumber } from './phone-input';
import { createDebugLogger } from './debug-logger';

// Debug logger - uses centralized debug module
const log = createDebugLogger('AppointmentForm');

// ==================== TURNSTILE RESET ====================

/**
 * Reset Cloudflare Turnstile widget
 * Called after failed submission to get a new token
 */
function resetTurnstile(): void {
    try {
        const turnstile = (window as any).turnstile;
        if (turnstile) {
            // Get the widget ID from the container
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
export async function initAppointmentForm(): Promise<void> {
    const submitBtn = document.getElementById('submitBtn');
    if (!submitBtn) return;

    // Initialize phone input with intl-tel-input (lazy-loaded)
    await initPhoneInput('customerPhone');

    submitBtn.addEventListener('click', handleFormSubmit);
}

/**
 * Handle form submission
 */
async function handleFormSubmit(): Promise<void> {
    // Input sanitization - XSS ve injection koruması
    const rawName = (document.getElementById('customerName') as HTMLInputElement).value;
    const rawEmail = (document.getElementById('customerEmail') as HTMLInputElement).value;
    const rawNote = (document.getElementById('customerNote') as HTMLTextAreaElement).value;

    const name = StringUtils.toTitleCase(sanitizeName(rawName));
    // Telefonu intl-tel-input'tan al (E.164 format, + olmadan: 905321234567)
    const phone = getPhoneNumber('customerPhone');
    const email = sanitizeEmail(rawEmail);
    const note = sanitizeInput(rawNote, { maxLength: 500 });

    // Get state values
    const selectedAppointmentType = state.get('selectedAppointmentType');
    const selectedDate = state.get('selectedDate');
    const selectedStaff = state.get('selectedStaff');
    const selectedTime = state.get('selectedTime');
    const selectedShiftType = state.get('selectedShiftType');
    const staffMembers = state.get('staffMembers');
    // v3.9: Profil ayarlarına göre çalışır (isManagementLink kaldırıldı)
    const profilAyarlari = state.get('profilAyarlari');
    const assignByAdmin = profilAyarlari?.assignByAdmin === true;

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

    // Cloudflare Turnstile token check
    const turnstileToken = (window as any).turnstile?.getResponse();
    if (!turnstileToken) {
        showAlert('Lütfen robot kontrolünü tamamlayın.', 'error');
        return;
    }

    if (!selectedAppointmentType) {
        showAlert('Lutfen randevu tipi secin.', 'error');
        return;
    }

    // NEW: selectedStaff can be -1 (assignByAdmin random), 0 (normal management), positive number (staff), or null (staffFilter === 'none')
    const staffFilter = profilAyarlari?.staffFilter || 'all';

    // staffFilter === 'none' allows null staff (admin assigns later)
    const staffRequired = staffFilter !== 'none';
    if (!selectedDate || (staffRequired && (selectedStaff === null || selectedStaff === undefined)) || !selectedTime) {
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

    const btn = document.getElementById('submitBtn') as HTMLButtonElement;
    ButtonAnimator.start(btn);

    // NEW: For staff=0, use managementContactPerson instead of staffName
    let staffName: string;
    let staff: Staff | undefined = undefined;
    // v3.6: staffId artık 8-karakterli secure ID (string) olabilir
    let assignedStaffId: string | number | null = selectedStaff;

    // v3.9: assignByAdmin=true ise personel atama, admin atayacak
    if (assignByAdmin) {
        // Create appointment without staff assignment
        assignedStaffId = null;
        staffName = 'Atanmadı'; // Placeholder
    } else if (staffFilter === 'none') {
        // Walk-in customers - admin assigns staff later
        assignedStaffId = null;
        staffName = 'Atanmadı';
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

    // v3.9: Profil adını gönder (linkType kaldırıldı)
    const currentProfile = state.get('currentProfile');
    // v3.9.17: idKontrolu profiller için link sahibi bilgisi
    const linkedStaffId = state.get('linkedStaffId');
    const linkedStaffName = state.get('linkedStaffName');

    // v3.9.13: DEBUG log removed for security (PII protection)
    log.log('createAppointment context:', { profile: currentProfile, assignByAdmin });

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
            duration: profilAyarlari?.duration || 60,
            turnstileToken: turnstileToken,  // Bot protection token
            profil: currentProfile,  // v3.9: Profil adı
            assignByAdmin: assignByAdmin,  // v3.9: Admin atama flag
            linkedStaffId: linkedStaffId,  // v3.9.17: URL'deki ID (link sahibi)
            linkedStaffName: linkedStaffName,  // v3.9.17: Link sahibinin adı
            kvkkConsent: kvkkConsent.checked  // KVKK onayı (checkbox değeri)
        });

        if (result.success) {
            // Show success animation
            ButtonAnimator.success(btn, false);

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

            // Wait for success animation then show success page
            setTimeout(() => {
                showSuccessPage(selectedDate!, selectedTime!, staffName, note);
            }, 800);
        } else {
            ButtonAnimator.error(btn);
            showAlert('Randevu olusturulamadi: ' + (result.error || 'Bilinmeyen hata'), 'error');
            // ⚡ FIX: Reset Turnstile widget after error (token is single-use)
            resetTurnstile();
        }
    } catch (error) {
        ButtonAnimator.error(btn);
        logError(error as Error, { context: 'confirmAppointment', selectedStaff, selectedDate, selectedTime });
        showAlert('Randevu oluşturulamadı. Lütfen tekrar deneyiniz.', 'error');
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
}
