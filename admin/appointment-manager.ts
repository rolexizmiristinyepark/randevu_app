/**
 * APPOINTMENT MANAGER - Randevu Yönetimi Modülü
 * Sorumluluklar: Randevu listeleme, düzenleme, silme, personel atama
 */

import { ApiService } from '../api-service';
import { DateUtils } from '../date-utils';

import { ButtonAnimator, FormDirtyState } from '../button-utils';
import { createElement } from '../security-helpers';
import type { DataStore } from './data-store';
import { AdminAuth } from '../admin-auth';

// Module-scoped variables
let dataStore: DataStore;
let currentEditingAppointment: any = null;
let currentAssigningAppointment: any = null;
let editModalDirtyState: FormDirtyState | null = null;
let assignModalDirtyState: FormDirtyState | null = null;
// v3.10.44: Store event listener reference for cleanup
let editModalDirtyCheckFn: (() => void) | null = null;

// Global references (accessed via window)
declare const window: Window & {
    UI: any;
};

// Lazy accessors to avoid module load order issues
const getUI = () => window.UI;

/**
 * v3.9: Türkçe karakter normalizasyonu
 * Farklı Unicode İ/ı varyantlarını standart Türkçe karakterlere çevirir
 * Örn: Latin Extended-B İ (U+0130) → Turkish İ
 */
function normalizeTurkishChars(text: string): string {
    if (!text) return text;
    return text
        // İ varyantları (dotted capital I)
        .replace(/\u0130/g, 'İ')  // Latin Capital Letter I With Dot Above
        .replace(/İ/g, 'İ')      // Normalize any other İ variants
        // ı varyantları (dotless lowercase i)
        .replace(/\u0131/g, 'ı')  // Latin Small Letter Dotless I
        // Diğer Türkçe karakterler
        .replace(/Ş/g, 'Ş').replace(/ş/g, 'ş')
        .replace(/Ğ/g, 'Ğ').replace(/ğ/g, 'ğ')
        .replace(/Ü/g, 'Ü').replace(/ü/g, 'ü')
        .replace(/Ö/g, 'Ö').replace(/ö/g, 'ö')
        .replace(/Ç/g, 'Ç').replace(/ç/g, 'ç');
}

/**
 * Initialize Appointment Manager module
 */
export async function initAppointmentManager(store: DataStore): Promise<void> {
    dataStore = store;
    setupEventListeners();

    // v3.9.10: Profil ayarlarını yükle (İlgili Ata butonu için)
    await dataStore.loadProfilAyarlari();
}

/**
 * Setup event listeners for appointment management
 */
function setupEventListeners(): void {
    // Week filter change
    const filterWeek = document.getElementById('filterWeek');
    filterWeek?.addEventListener('change', () => load());

    // Edit appointment modal buttons
    const cancelEditBtn = document.getElementById('cancelEditAppointmentBtn');
    cancelEditBtn?.addEventListener('click', () => closeEditModal());

    const saveEditBtn = document.getElementById('saveEditAppointmentBtn');
    saveEditBtn?.addEventListener('click', () => saveEditedAppointment());

    // Assign staff modal buttons
    const cancelAssignBtn = document.getElementById('cancelAssignStaffBtn');
    cancelAssignBtn?.addEventListener('click', () => closeAssignStaffModal());

    const saveAssignBtn = document.getElementById('saveAssignStaffBtn');
    saveAssignBtn?.addEventListener('click', () => saveAssignedStaff());
}

/**
 * Load week appointments with optional week filter
 */
async function load(): Promise<void> {
    const filterWeekInput = document.getElementById('filterWeek') as HTMLInputElement;
    const filterWeek = filterWeekInput?.value;
    const container = document.getElementById('appointmentsList');

    if (!container) return;

    // Clear and show loading
    container.textContent = '';
    const loadingSpinner = createElement('div', { className: 'loading-spinner' });
    container.appendChild(loadingSpinner);

    // Calculate date range from week value
    let startDate: Date;
    let endDate: Date;

    if (filterWeek) {
        // Specific week selected - show that week
        const [year, week] = filterWeek.split('-W');
        const firstDayOfYear = new Date(parseInt(year || '0'), 0, 1);
        const daysOffset = (parseInt(week || '0') - 1) * 7;
        startDate = new Date(firstDayOfYear.getTime());
        startDate.setDate(firstDayOfYear.getDate() + daysOffset);

        // Find Monday
        const dayOfWeek = startDate.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        startDate.setDate(startDate.getDate() + diff);
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
    } else {
        // Default: Today and next 30 days (future appointments)
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 30);
    }

    try {
        const result = await ApiService.call('getWeekAppointments', {
            startDate: DateUtils.toLocalDate(startDate),
            endDate: DateUtils.toLocalDate(endDate)
        });

        if (result.error) {
            container.textContent = '';
            const errorMsg = createElement('p', {
                style: { textAlign: 'center', color: '#dc3545', padding: '20px' }
            }, '❌ Hata: ' + result.error);
            container.appendChild(errorMsg);
        } else {
            render((result as any).items || []);
        }
    } catch (error) {
        container.textContent = '';
        const errorMsg = createElement('p', {
            style: { textAlign: 'center', color: '#dc3545', padding: '20px' }
        }, '❌ Yükleme hatası');
        container.appendChild(errorMsg);
    }
}

/**
 * Delete appointment
 */
async function deleteAppointment(eventId: string, button?: HTMLButtonElement): Promise<void> {
    if (!confirm('Bu randevuyu silmek istediğinizden emin misiniz?')) return;

    // Start button animation
    if (button) ButtonAnimator.start(button);

    try {
        const result = await ApiService.call('deleteAppointment', { eventId });
        if (result.success) {
            if (button) ButtonAnimator.success(button, false);
            getUI().showAlert('Randevu silindi', 'success');
            // Wait for animation then reload
            setTimeout(() => load(), 800);
        } else {
            if (button) ButtonAnimator.error(button);
            // API key hatası için özel mesaj
            if ((result as any).requiresAuth || result.error?.includes('Yetkilendirme')) {
                getUI().showAlert('Oturum süresi dolmuş. Lütfen çıkış yapıp tekrar giriş yapın.', 'error');
                // 3 saniye sonra logout
                setTimeout(() => {
                    if (confirm('Oturum süresi dolmuş. Çıkış yapılsın mı?')) {
                        AdminAuth.logout();
                    }
                }, 500);
            } else {
                getUI().showAlert('Silme hatası: ' + result.error, 'error');
            }
        }
    } catch (error) {
        if (button) ButtonAnimator.error(button);
        const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
        if (errorMessage.includes('Authentication')) {
            getUI().showAlert('Oturum gerekli. Lütfen giriş yapın.', 'error');
        } else {
            getUI().showAlert('Silme hatası: ' + errorMessage, 'error');
        }
    }
}

/**
 * Open edit appointment modal
 */
function openEditModal(appointment: any): void {
    currentEditingAppointment = appointment;

    // Destroy previous dirty state if exists
    if (editModalDirtyState) {
        editModalDirtyState.destroy();
        editModalDirtyState = null;
    }

    try {
        // Supabase flat record: appointment.date = "YYYY-MM-DD", appointment.start_time = "HH:MM:SS"
        const dateStr = appointment.date; // Already YYYY-MM-DD

        // Format time: start_time is "HH:MM:SS", we need "HH:MM"
        const currentTime = appointment.start_time ? appointment.start_time.substring(0, 5) : '11:00';

        // Get input elements
        const dateInput = document.getElementById('editAppointmentDate') as HTMLInputElement;
        const timeSelect = document.getElementById('editAppointmentTime') as HTMLSelectElement;
        const saveBtn = document.getElementById('saveEditAppointmentBtn') as HTMLButtonElement;

        // v3.10.45: Reset button state when modal opens (fix empty button bug)
        // ButtonAnimator.start() clears button content, must restore it
        if (saveBtn) {
            saveBtn.classList.remove('btn-animating', 'btn-loading', 'btn-success', 'btn-error');
            saveBtn.textContent = 'Save';
            saveBtn.disabled = true;
        }

        // Set date and time values
        dateInput.value = dateStr;
        timeSelect.value = currentTime;

        // Show modal first (so elements are visible for FormDirtyState)
        document.getElementById('editAppointmentModal')?.classList.add('active');

        // v3.10.44: Store original values for manual comparison
        const originalDate = dateStr;
        const originalTime = currentTime;

        // Manual dirty check function (workaround for native date picker issues)
        editModalDirtyCheckFn = () => {
            const hasChanges = dateInput.value !== originalDate || timeSelect.value !== originalTime;
            if (saveBtn) {
                saveBtn.disabled = !hasChanges;
                if (hasChanges) {
                    saveBtn.classList.remove('btn-pristine');
                    saveBtn.classList.add('btn-dirty');
                } else {
                    saveBtn.classList.add('btn-pristine');
                    saveBtn.classList.remove('btn-dirty');
                }
            }
        };

        // Add event listeners for both input types
        // Using multiple events to ensure we catch all changes (especially for native date picker)
        dateInput.addEventListener('input', editModalDirtyCheckFn);
        dateInput.addEventListener('change', editModalDirtyCheckFn);
        dateInput.addEventListener('blur', editModalDirtyCheckFn);
        timeSelect.addEventListener('change', editModalDirtyCheckFn);

        // Initialize FormDirtyState as backup (for any other inputs that might be added)
        editModalDirtyState = new FormDirtyState({
            container: '#editAppointmentModal .modal-content',
            saveButton: '#saveEditAppointmentBtn'
        });
    } catch (error) {
        console.error('Modal açma hatası:', error, appointment);
        getUI().showAlert('Randevu tarihi okunamadı', 'error');
    }
}

/**
 * Close edit appointment modal
 */
function closeEditModal(): void {
    // v3.10.44: Remove manual event listeners
    if (editModalDirtyCheckFn) {
        const dateInput = document.getElementById('editAppointmentDate');
        const timeSelect = document.getElementById('editAppointmentTime');
        if (dateInput) {
            dateInput.removeEventListener('input', editModalDirtyCheckFn);
            dateInput.removeEventListener('change', editModalDirtyCheckFn);
            dateInput.removeEventListener('blur', editModalDirtyCheckFn);
        }
        if (timeSelect) {
            timeSelect.removeEventListener('change', editModalDirtyCheckFn);
        }
        editModalDirtyCheckFn = null;
    }

    // Destroy dirty state
    if (editModalDirtyState) {
        editModalDirtyState.destroy();
        editModalDirtyState = null;
    }
    document.getElementById('editAppointmentModal')?.classList.remove('active');
    currentEditingAppointment = null;
}

/**
 * Save edited appointment
 */
async function saveEditedAppointment(): Promise<void> {
    if (!currentEditingAppointment) return;

    const newDate = (document.getElementById('editAppointmentDate') as HTMLInputElement).value;
    const newTime = (document.getElementById('editAppointmentTime') as HTMLInputElement).value;
    const saveBtn = document.getElementById('saveEditAppointmentBtn') as HTMLButtonElement;

    if (!newDate || !newTime) {
        getUI().showAlert('Lütfen tarih ve saat seçin', 'error');
        return;
    }

    // Start button animation
    ButtonAnimator.start(saveBtn);

    try {
        const result = await ApiService.call('updateAppointment', {
            eventId: currentEditingAppointment.id,
            newDate: newDate,
            newTime: newTime
        });

        if (result.success) {
            ButtonAnimator.success(saveBtn, false);
            getUI().showAlert('Randevu güncellendi', 'success');
            setTimeout(() => {
                closeEditModal();
                load();
            }, 800);
        } else {
            ButtonAnimator.error(saveBtn);
            getUI().showAlert('Güncelleme hatası: ' + result.error, 'error');
        }
    } catch (error) {
        ButtonAnimator.error(saveBtn);
        getUI().showAlert('Güncelleme hatası', 'error');
    }
}

/**
 * Open assign staff modal
 */
function openAssignStaffModal(appointment: any): void {
    currentAssigningAppointment = appointment;

    // Destroy previous dirty state if exists
    if (assignModalDirtyState) {
        assignModalDirtyState.destroy();
        assignModalDirtyState = null;
    }

    // Fill appointment info (Supabase flat record)
    const start = new Date(`${appointment.date}T${appointment.start_time}`);
    const customerName = appointment.customer_name || 'İsimsiz';
    const customerNote = appointment.customer_note || '';
    const dateStr = start.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
    const timeStr = start.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    const infoDiv = document.getElementById('assignStaffInfo');
    if (infoDiv) {
        // 🔒 SECURITY: DOM tabanlı güvenli render
        infoDiv.textContent = '';
        const container = createElement('div', { style: { fontSize: '13px', lineHeight: '1.8', color: '#757575' } });

        const createRow = (label: string, value: string) => {
            const row = createElement('div');
            const labelSpan = createElement('span', { style: { color: '#1A1A2E', fontWeight: '500' } }, label);
            row.appendChild(labelSpan);
            row.appendChild(document.createTextNode(value));
            return row;
        };

        container.appendChild(createRow('Müşteri: ', customerName));
        container.appendChild(createRow('Tarih: ', dateStr));
        container.appendChild(createRow('Saat: ', timeStr));
        if (customerNote) {
            container.appendChild(createRow('Not: ', customerNote));
        }

        infoDiv.appendChild(container);
    }

    // Populate staff dropdown (mevcut atanmış personeli hariç tut)
    const select = document.getElementById('assignStaffSelect') as HTMLSelectElement;
    const currentStaffId = appointment.staff_id;
    // v3.10.55: Use same logic as list - check if staff is actually assigned
    const currentStaff = currentStaffId ? dataStore.staff.find(s => String(s.id) === String(currentStaffId)) : null;
    const currentStaffName = currentStaff?.name || '';
    const hasNoStaff = !currentStaffId || !currentStaff || currentStaffName === 'Atanacak' || currentStaffName === 'Atanmadı' || currentStaffName === '-';
    const isChanging = !hasNoStaff;  // Only "Change" if staff is actually assigned

    if (select) {
        while (select.firstChild) select.removeChild(select.firstChild);
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = '-- Seçin --';
        select.appendChild(defaultOpt);

        const activeStaff = dataStore.staff.filter(s =>
            s.active &&
            s.role === 'sales' &&
            String(s.id) !== String(currentStaffId)  // Mevcut personeli hariç tut
        );
        activeStaff.forEach(staff => {
            const option = createElement('option', { value: staff.id }, staff.name) as HTMLOptionElement;
            select.appendChild(option);
        });
    }

    // Modal başlık ve buton metnini güncelle
    const modalHeader = document.querySelector('#assignStaffModal .modal-header');
    const saveBtn = document.getElementById('saveAssignStaffBtn') as HTMLButtonElement;
    if (modalHeader) {
        modalHeader.textContent = isChanging ? 'Change Staff' : 'Assign Staff';
    }
    if (saveBtn) {
        // v3.9.70: Reset button state when modal opens (fix disabled button bug)
        saveBtn.classList.remove('btn-animating', 'btn-loading', 'btn-success', 'btn-error');
        saveBtn.textContent = isChanging ? 'Change' : 'Assign';
    }

    // Show modal
    document.getElementById('assignStaffModal')?.classList.add('active');

    // Initialize FormDirtyState - button disabled until selection made
    assignModalDirtyState = new FormDirtyState({
        container: '#assignStaffModal .modal-content',
        saveButton: '#saveAssignStaffBtn'
    });
}

/**
 * Close assign staff modal
 */
function closeAssignStaffModal(): void {
    // Destroy dirty state
    if (assignModalDirtyState) {
        assignModalDirtyState.destroy();
        assignModalDirtyState = null;
    }
    document.getElementById('assignStaffModal')?.classList.remove('active');
    currentAssigningAppointment = null;
}

/**
 * Save assigned staff
 */
async function saveAssignedStaff(): Promise<void> {
    if (!currentAssigningAppointment) return;

    const staffId = (document.getElementById('assignStaffSelect') as HTMLSelectElement).value;
    const btn = document.getElementById('saveAssignStaffBtn') as HTMLButtonElement;

    if (!staffId) {
        getUI().showAlert('Lütfen personel seçin', 'error');
        return;
    }

    // Start button animation
    ButtonAnimator.start(btn);

    try {
        const result = await ApiService.call('assignStaffToAppointment', {
            eventId: currentAssigningAppointment.id,
            staffId: staffId
        });

        if (result.success) {
            ButtonAnimator.success(btn, false);
            getUI().showAlert((result as any).staffName + ' atandı', 'success');
            setTimeout(() => {
                closeAssignStaffModal();
                load();
            }, 800);
        } else {
            ButtonAnimator.error(btn);
            const debugInfo = (result as any).debug ? ` (debug: ${JSON.stringify((result as any).debug)})` : '';
            getUI().showAlert('Atama hatası: ' + result.error + debugInfo, 'error');
        }
    } catch (error) {
        ButtonAnimator.error(btn);
        console.error('[assignStaff] Error:', error);
        getUI().showAlert('Atama hatası', 'error');
    }
}

/**
 * Render appointments list grouped by date
 */
function render(appointments: any[]): void {
    const container = document.getElementById('appointmentsList');
    if (!container) return;

    // Clear
    container.textContent = '';

    if (appointments.length === 0) {
        const emptyMsg = createElement('p', {
            style: { textAlign: 'center', color: '#999', padding: '20px' }
        }, 'Randevu bulunamadı');
        container.appendChild(emptyMsg);
        return;
    }

    // Group by date (Supabase flat record: apt.date = "YYYY-MM-DD")
    const byDate: Record<string, any[]> = {};
    appointments.forEach(apt => {
        const dateKey = apt.date; // Supabase: flat "YYYY-MM-DD" string
        if (!byDate[dateKey]) byDate[dateKey] = [];
        byDate[dateKey].push(apt);
    });

    // Use DocumentFragment for performance
    const fragment = document.createDocumentFragment();

    Object.keys(byDate).sort().forEach(dateKey => {
        const date = new Date(dateKey + 'T12:00:00');

        // Date header
        const dateHeader = createElement('h3', {
            style: {
                margin: '20px 0 12px 0',
                color: '#1A1A2E',
                fontSize: '14px',
                fontWeight: '400',
                letterSpacing: '1px',
                textTransform: 'uppercase'
            }
        }, date.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' }));
        fragment.appendChild(dateHeader);

        (byDate[dateKey] || []).forEach(apt => {
            // Supabase flat record: date + start_time/end_time (HH:MM:SS)
            const start = new Date(`${apt.date}T${apt.start_time}`);
            const end = new Date(`${apt.date}T${apt.end_time}`);
            const staffId = apt.staff_id;
            const staff = dataStore.staff.find(s => String(s.id) === String(staffId));
            const phone = apt.customer_phone || '-';
            let customerName = apt.customer_name || 'İsimsiz';
            // v3.9: Türkçe karakter normalizasyonu (İ/ı sorunları için)
            customerName = normalizeTurkishChars(customerName);
            const customerNote = apt.customer_note || '';

            // Appointment card container
            const aptCard = createElement('div', {
                style: {
                    background: 'white',
                    padding: '18px',
                    borderRadius: '2px',
                    border: '1px solid #E8E8E8',
                    marginBottom: '12px'
                }
            });

            // Main flex container
            const flexContainer = createElement('div', {
                style: { display: 'flex', justifyContent: 'space-between', alignItems: 'start' }
            });

            // Left side - appointment details
            const detailsDiv = createElement('div', {
                style: { flex: '1' }
            });

            // Time range
            const startTime = start.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
            const endTime = end.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
            const timeDiv = createElement('div', {
                style: {
                    fontWeight: '400',
                    color: '#1A1A2E',
                    fontSize: '15px',
                    marginBottom: '10px',
                    letterSpacing: '0.5px'
                }
            }, `${startTime} - ${endTime}`);

            // Details text
            const infoDiv = createElement('div', {
                style: { fontSize: '13px', lineHeight: '1.8', color: '#757575' }
            });

            const customerLabel = createElement('span', { style: { color: '#1A1A2E' } }, 'Müşteri: ');
            infoDiv.appendChild(customerLabel);
            infoDiv.appendChild(document.createTextNode(customerName));
            infoDiv.appendChild(createElement('br'));

            const phoneLabel = createElement('span', { style: { color: '#1A1A2E' } }, 'Telefon: ');
            infoDiv.appendChild(phoneLabel);
            infoDiv.appendChild(document.createTextNode(phone));
            infoDiv.appendChild(createElement('br'));

            const staffLabel = createElement('span', { style: { color: '#1A1A2E' } }, 'Staff: ');
            infoDiv.appendChild(staffLabel);
            infoDiv.appendChild(document.createTextNode(staff?.name || '-'));

            if (customerNote) {
                infoDiv.appendChild(createElement('br'));
                const noteLabel = createElement('span', { style: { color: '#1A1A2E' } }, 'Not: ');
                infoDiv.appendChild(noteLabel);
                infoDiv.appendChild(document.createTextNode(customerNote));
            }

            detailsDiv.appendChild(timeDiv);
            detailsDiv.appendChild(infoDiv);

            // Right side - action buttons
            const buttonsDiv = createElement('div', {
                style: { display: 'flex', flexDirection: 'column', gap: '8px' }
            });

            // Button width (all buttons same width)
            const btnWidth = '145px';

            // Assign staff button - show based on profile's assignByAdmin setting
            const staffName = staff?.name || '-';
            const hasNoStaff = !staffId || !staff || staffName === 'Atanacak' || staffName === 'Atanmadı' || staffName === '-';

            // v3.9: Profil ayarlarından assignByAdmin kontrolü
            // Sadece profilde assignByAdmin=true ise buton göster
            const appointmentProfil = apt.profile || '';
            const profilAyari = dataStore.profilAyarlari[appointmentProfil];
            const showAssignButton = profilAyari?.assignByAdmin === true;

            // Button order: 1. Assign Staff (if applicable), 2. Edit, 3. Delete
            if (showAssignButton) {
                if (hasNoStaff) {
                    // No staff assigned - "Assign Staff" button
                    const assignBtn = createElement('button', {
                        className: 'btn btn-small',
                        style: {
                            width: btnWidth,
                            background: 'linear-gradient(135deg, #C9A55A 0%, #B8944A 100%)',
                            borderColor: '#C9A55A',
                            color: 'white'
                        }
                    }, 'Assign Staff');
                    assignBtn.addEventListener('click', () => {
                        openAssignStaffModal(apt);
                    });
                    buttonsDiv.appendChild(assignBtn);
                } else {
                    // Staff assigned - "Change Staff" button (same gold color)
                    const changeBtn = createElement('button', {
                        className: 'btn btn-small',
                        style: {
                            width: btnWidth,
                            background: 'linear-gradient(135deg, #C9A55A 0%, #B8944A 100%)',
                            borderColor: '#C9A55A',
                            color: 'white'
                        }
                    }, 'Change Staff');
                    changeBtn.addEventListener('click', () => {
                        openAssignStaffModal(apt);
                    });
                    buttonsDiv.appendChild(changeBtn);
                }
            }

            // Edit button
            const editBtn = createElement('button', {
                className: 'btn btn-small btn-secondary',
                style: { width: btnWidth }
            }, 'Edit') as HTMLButtonElement;
            editBtn.addEventListener('click', () => {
                openEditModal(apt);
            });
            buttonsDiv.appendChild(editBtn);

            // Cancel button
            const cancelBtn = createElement('button', {
                className: 'btn btn-small btn-secondary',
                style: { width: btnWidth }
            }, 'Cancel') as HTMLButtonElement;
            cancelBtn.addEventListener('click', () => {
                deleteAppointment(apt.id, cancelBtn);
            });
            buttonsDiv.appendChild(cancelBtn);

            flexContainer.appendChild(detailsDiv);
            flexContainer.appendChild(buttonsDiv);
            aptCard.appendChild(flexContainer);
            fragment.appendChild(aptCard);
        });
    });

    container.appendChild(fragment);
}

/**
 * Send WhatsApp message
 */
// @ts-ignore - Future WhatsApp integration
function sendWhatsApp(phone: string, customerName: string, dateTime: string): void {
    // Clean phone number (digits only)
    const cleanPhone = phone.replace(/\D/g, '');
    // Add +90 prefix if not present
    const fullPhone = cleanPhone.startsWith('90') ? cleanPhone : '90' + cleanPhone;

    const message = encodeURIComponent(
        `Merhaba ${customerName},\n\n` +
        `${dateTime} tarihli randevunuzu onaylıyoruz.\n\n` +
        `Görüşmek üzere!`
    );

    window.open(`https://wa.me/${fullPhone}?text=${message}`, '_blank');
}

// Export for potential future use
export { load as loadAppointments, render as renderAppointmentList };
