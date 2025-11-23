/**
 * APPOINTMENT MANAGER - Randevu Yönetimi Modülü
 * Sorumluluklar: Randevu listeleme, düzenleme, silme, personel atama
 */

import { ApiService } from '../api-service';
import { DateUtils } from '../date-utils';
import { TimeUtils } from '../time-utils';
import { ButtonUtils } from '../button-utils';
import { ErrorUtils } from '../error-utils';
import { escapeHtml } from '../security-helpers';
import type { DataStore } from './data-store';

// Module-scoped variables
let dataStore: DataStore;
let currentEditingAppointment: any = null;
let currentAssigningAppointment: any = null;

// Global references (accessed via window)
declare const window: Window & {
    UI: any;
    createElement: (tag: string, attributes?: any, textContent?: string) => HTMLElement;
};

const { UI, createElement } = window;

/**
 * Initialize Appointment Manager module
 */
export async function initAppointmentManager(store: DataStore): Promise<void> {
    dataStore = store;
    setupEventListeners();
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
    const loadingMsg = createElement('p', {
        style: { textAlign: 'center', padding: '20px' }
    }, 'Yükleniyor...');
    container.appendChild(loadingMsg);

    // Calculate date range from week value
    let startDate: Date;
    let endDate: Date;

    if (filterWeek) {
        const [year, week] = filterWeek.split('-W');
        const firstDayOfYear = new Date(parseInt(year), 0, 1);
        const daysOffset = (parseInt(week) - 1) * 7;
        startDate = new Date(firstDayOfYear.getTime());
        startDate.setDate(firstDayOfYear.getDate() + daysOffset);

        // Find Monday
        const dayOfWeek = startDate.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        startDate.setDate(startDate.getDate() + diff);
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
    } else {
        // Default: This week
        const today = new Date();
        const dayOfWeek = today.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() + diff);
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
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
            render(result.items || []);
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
async function deleteAppointment(eventId: string): Promise<void> {
    if (!confirm('Bu randevuyu silmek istediğinizden emin misiniz?')) return;

    try {
        const result = await ApiService.call('deleteAppointment', { eventId });
        if (result.success) {
            UI.showAlert('✅ Randevu silindi', 'success');
            load();
        } else {
            UI.showAlert('❌ Silme hatası: ' + result.error, 'error');
        }
    } catch (error) {
        UI.showAlert('❌ Silme hatası', 'error');
    }
}

/**
 * Open edit appointment modal
 */
function openEditModal(appointment: any): void {
    currentEditingAppointment = appointment;

    try {
        // Parse date
        const startDate = new Date(appointment.start.dateTime || appointment.start.date);

        // Format date as YYYY-MM-DD for date input
        const year = startDate.getFullYear();
        const month = String(startDate.getMonth() + 1).padStart(2, '0');
        const day = String(startDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        // Format time using TimeUtils
        const currentTime = TimeUtils.toTimeString(startDate);

        // Set date and time values
        (document.getElementById('editAppointmentDate') as HTMLInputElement).value = dateStr;
        (document.getElementById('editAppointmentTime') as HTMLInputElement).value = currentTime;

        // Enable save button if both date and time are set
        (document.getElementById('saveEditAppointmentBtn') as HTMLButtonElement).disabled = false;

        // Show modal
        document.getElementById('editAppointmentModal')?.classList.add('active');
    } catch (error) {
        console.error('Modal açma hatası:', error, appointment);
        UI.showAlert('❌ Randevu tarihi okunamadı', 'error');
    }
}

/**
 * Close edit appointment modal
 */
function closeEditModal(): void {
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

    if (!newDate || !newTime) {
        UI.showAlert('❌ Lütfen tarih ve saat seçin', 'error');
        return;
    }

    try {
        const result = await ApiService.call('updateAppointment', {
            eventId: currentEditingAppointment.id,
            newDate: newDate,
            newTime: newTime
        });

        if (result.success) {
            UI.showAlert('✅ Randevu güncellendi', 'success');
            closeEditModal();
            load();
        } else {
            UI.showAlert('❌ Güncelleme hatası: ' + result.error, 'error');
        }
    } catch (error) {
        UI.showAlert('❌ Güncelleme hatası', 'error');
    }
}

/**
 * Open assign staff modal
 */
function openAssignStaffModal(appointment: any): void {
    currentAssigningAppointment = appointment;

    // Fill appointment info
    const start = new Date(appointment.start.dateTime || appointment.start.date);
    const customerName = appointment.summary?.replace('Randevu: ', '') || 'İsimsiz';
    const dateStr = start.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
    const timeStr = start.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    const infoDiv = document.getElementById('assignStaffInfo');
    if (infoDiv) {
        // 🔒 SECURITY: escapeHtml() ile XSS koruması
        infoDiv.innerHTML = `
            <div style="font-size: 13px; line-height: 1.8; color: #757575;">
                <div><span style="color: #1A1A2E; font-weight: 500;">Müşteri:</span> ${escapeHtml(customerName)}</div>
                <div><span style="color: #1A1A2E; font-weight: 500;">Tarih:</span> ${escapeHtml(dateStr)}</div>
                <div><span style="color: #1A1A2E; font-weight: 500;">Saat:</span> ${escapeHtml(timeStr)}</div>
            </div>
        `;
    }

    // Populate staff dropdown
    const select = document.getElementById('assignStaffSelect') as HTMLSelectElement;
    if (select) {
        select.innerHTML = '<option value="">-- Seçin --</option>';

        const activeStaff = dataStore.staff.filter(s => s.active);
        activeStaff.forEach(staff => {
            const option = createElement('option', { value: staff.id }, staff.name) as HTMLOptionElement;
            select.appendChild(option);
        });
    }

    // Show modal
    document.getElementById('assignStaffModal')?.classList.add('active');
}

/**
 * Close assign staff modal
 */
function closeAssignStaffModal(): void {
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
        UI.showAlert('❌ Lütfen personel seçin', 'error');
        return;
    }

    ButtonUtils.setLoading(btn, 'Atanıyor');

    try {
        const result = await ApiService.call('assignStaffToAppointment', {
            eventId: currentAssigningAppointment.id,
            staffId: staffId
        });

        if (result.success) {
            UI.showAlert('✅ ' + result.staffName + ' atandı', 'success');
            closeAssignStaffModal();
            load();
        } else {
            UI.showAlert('❌ Atama hatası: ' + result.error, 'error');
        }
    } catch (error) {
        UI.showAlert('❌ Atama hatası', 'error');
    } finally {
        ButtonUtils.reset(btn);
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

    // Group by date
    const byDate: Record<string, any[]> = {};
    appointments.forEach(apt => {
        const start = new Date(apt.start.dateTime || apt.start.date);
        const dateKey = DateUtils.toLocalDate(start);
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

        byDate[dateKey].forEach(apt => {
            const start = new Date(apt.start.dateTime || apt.start.date);
            const end = new Date(apt.end.dateTime || apt.end.date);
            const staffId = apt.extendedProperties?.private?.staffId;
            const staff = dataStore.staff.find(s => s.id === parseInt(staffId));
            const phone = apt.extendedProperties?.private?.customerPhone || '-';
            const customerName = apt.summary?.replace('Randevu: ', '') || 'İsimsiz';
            const customerNote = apt.extendedProperties?.private?.customerNote || '';
            const isVipLink = apt.extendedProperties?.private?.isVipLink === 'true';

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

            const staffLabel = createElement('span', { style: { color: '#1A1A2E' } }, 'İlgili: ');
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

            // Edit button
            const editBtn = createElement('button', {
                className: 'btn btn-small btn-secondary'
            }, 'Düzenle');
            editBtn.addEventListener('click', () => {
                openEditModal(apt);
            });

            // Cancel button
            const cancelBtn = createElement('button', {
                className: 'btn btn-small btn-secondary'
            }, 'İptal Et');
            cancelBtn.addEventListener('click', () => {
                deleteAppointment(apt.id);
            });

            buttonsDiv.appendChild(editBtn);
            buttonsDiv.appendChild(cancelBtn);

            // Assign staff button - only for VIP links (#hk, #ok, #hmk) without assigned staff
            const staffName = staff?.name || '-';
            const hasNoStaff = !staffId || !staff || staffName === 'Atanmadı' || staffName === '-';

            if (isVipLink && hasNoStaff) {
                const assignBtn = createElement('button', {
                    className: 'btn btn-small',
                    style: {
                        background: 'linear-gradient(135deg, #C9A55A 0%, #B8944A 100%)',
                        borderColor: '#C9A55A',
                        color: 'white'
                    }
                }, 'İlgili Ata');
                assignBtn.addEventListener('click', () => {
                    openAssignStaffModal(apt);
                });
                buttonsDiv.appendChild(assignBtn);
            }

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
