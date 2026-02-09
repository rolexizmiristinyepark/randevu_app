/**
 * TimeSelectorComponent.ts
 *
 * Time slot display and selection
 * Extracted from app.ts (lines 822-1094)
 */

import { state } from './StateManager';
import { revealSection, hideSection, showAlert } from './UIManager';
import { apiCall } from './api-service';
import { logError } from './monitoring';
import { createDebugLogger } from './debug-logger';

// Debug logger - uses centralized debug module
const log = createDebugLogger('TimeSelector');

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

    while (container.firstChild) container.removeChild(container.firstChild);
    const spinnerWrapper = document.createElement('div');
    spinnerWrapper.style.cssText = 'grid-column: 1/-1; text-align: center; padding: 20px;';
    const spinnerEl = document.createElement('div');
    spinnerEl.className = 'spinner';
    spinnerWrapper.appendChild(spinnerEl);
    container.appendChild(spinnerWrapper);

    const selectedDate = state.get('selectedDate');
    const selectedShiftType = state.get('selectedShiftType');
    const selectedAppointmentType = state.get('selectedAppointmentType');

    // v3.9: Tüm mantık profil ayarlarına göre çalışır (link bazlı değil)
    const profilAyarlari = state.get('profilAyarlari');
    const staffFilter = profilAyarlari?.staffFilter || 'all';
    const vardiyaKontrolu = profilAyarlari?.vardiyaKontrolu !== false; // default true
    const assignByAdmin = profilAyarlari?.assignByAdmin === true;

    // Vardiya kontrolü olmayan durumlar:
    // - staffFilter === 'none' (admin personel atayacak)
    // - vardiyaKontrolu === false (tüm slotlar vardiyadan bağımsız)
    // - assignByAdmin === true (admin personel atayacak)
    const skipShiftCheck = staffFilter === 'none' || !vardiyaKontrolu || assignByAdmin;

    if (skipShiftCheck) {
        if (!selectedDate || !selectedAppointmentType) {
            container.textContent = 'Lütfen önce tarih ve randevu türü seçin.';
            return;
        }
    } else {
        if (!selectedDate || !selectedShiftType || !selectedAppointmentType) {
            container.textContent = 'Lütfen önce tarih, vardiya ve randevu türü seçin.';
            return;
        }
    }

    try {
        // staffFilter === 'none' - Walk-in customers, show all slots (admin assigns staff later)
        // v3.9.12: Backend'den slot müsaitliği al (maxSlotAppointment kontrolü için)
        if (staffFilter === 'none') {
            const slotGrid = profilAyarlari?.slotGrid || 60;
            const maxSlotAppointment = profilAyarlari?.maxSlotAppointment || 1;

            // v3.9.12: Backend'den slot müsaitliği al
            const availabilityResult = await apiCall('getSlotAvailability', {
                date: selectedDate,
                slotGrid: slotGrid,
                slotLimit: maxSlotAppointment
            });

            // Clear spinner
            while (container.firstChild) container.removeChild(container.firstChild);

            if (!availabilityResult.success) {
                const errorDiv = document.createElement('div');
                errorDiv.style.cssText = 'grid-column: 1/-1; text-align: center; padding: 20px; color: #dc3545;';
                errorDiv.textContent = 'Müsait saatler yüklenemedi';
                container.appendChild(errorDiv);
                return;
            }

            const { slots } = availabilityResult.data as any;

            // Generate slots for today based on slotGrid
            const today = new Date();
            const todayStr = today.getFullYear() + '-' +
                           String(today.getMonth() + 1).padStart(2, '0') + '-' +
                           String(today.getDate()).padStart(2, '0');
            const isToday = selectedDate === todayStr;
            const currentHour = today.getHours();
            const currentMinute = today.getMinutes();

            // v3.9.12: Debug log
            log.log('[TimeSlots] staffFilter=none', { selectedDate, todayStr, isToday, currentHour, currentMinute, slotGrid, maxSlotAppointment, slotsCount: slots?.length });

            // v3.9.12: Count available future slots
            let availableFutureSlotsCount = 0;

            // Render slots from backend (with availability info)
            slots.forEach((slot: any) => {
                const [slotHour, slotMinute] = slot.time.split(':').map(Number);

                // Skip past times if today
                if (isToday && (slotHour < currentHour || (slotHour === currentHour && slotMinute <= currentMinute))) {
                    return;
                }

                const btn = document.createElement('div');

                if (slot.available) {
                    // ✅ AVAILABLE
                    btn.className = 'slot-btn';
                    btn.textContent = slot.time;
                    if (slot.count > 0) {
                        btn.title = `Bu saatte ${slot.count} randevu var`;
                    }
                    btn.addEventListener('click', () => selectTimeSlot(slot.time, btn));
                    availableFutureSlotsCount++;
                } else {
                    // ❌ FULL - Disabled
                    btn.className = 'slot-btn disabled';
                    btn.textContent = slot.time;
                    btn.title = `Bu saat dolu (${maxSlotAppointment} randevu)`;
                    btn.style.opacity = '0.4';
                    btn.style.cursor = 'not-allowed';
                    btn.setAttribute('aria-disabled', 'true');
                }

                container.appendChild(btn);
            });

            // v3.9.12: If no slots available (all past or full) - show alternate buttons for onlytoday profiles
            const takvimFiltresi = profilAyarlari?.takvimFiltresi;
            if (container.children.length === 0 || availableFutureSlotsCount === 0) {
                if (takvimFiltresi === 'onlytoday') {
                    // Sadece alternatif butonları göster (hata mesajı yok)
                    renderAlternateBookingButtons(container, true);
                } else if (container.children.length === 0) {
                    const infoDiv = document.createElement('div');
                    infoDiv.style.cssText = 'grid-column: 1/-1; text-align: center; padding: 20px; color: #dc3545;';
                    infoDiv.textContent = 'Bugün için müsait saat kalmamıştır.';
                    container.appendChild(infoDiv);
                    // v3.9: 'onlytoday' profilleri için alternatif randevu butonları
                    renderAlternateBookingButtons(container);
                }
                return;
            }

            // v3.9: 'onlytoday' profilleri için alternatif randevu butonları
            renderAlternateBookingButtons(container);
            return;
        }

        // v3.9: assignByAdmin=true ise slot müsaitliğini backend'den al
        // v3.9.4: slotLimit → maxSlotAppointment düzeltmesi
        if (assignByAdmin) {
            const slotLimit = profilAyarlari?.maxSlotAppointment || 2;  // v3.9.4: doğru alan adı
            const slotGrid = profilAyarlari?.slotGrid || 60;

            // Backend'den slot müsaitliğini al
            const availabilityResult = await apiCall('getSlotAvailability', {
                date: selectedDate,
                slotGrid: slotGrid,
                slotLimit: slotLimit
            });

            if (!availabilityResult.success) {
                const errorDiv = document.createElement('div');
                errorDiv.style.cssText = 'grid-column: 1/-1; text-align: center; padding: 20px; color: #dc3545;';
                errorDiv.textContent = 'Müsait saatler yüklenemedi';
                container.appendChild(errorDiv);
                return;
            }

            const { slots } = availabilityResult.data as any;

            // Clear spinner with DOM method
            while (container.firstChild) container.removeChild(container.firstChild);

            // Check if today - to filter past times
            const today = new Date();
            const todayStr = today.getFullYear() + '-' +
                           String(today.getMonth() + 1).padStart(2, '0') + '-' +
                           String(today.getDate()).padStart(2, '0');
            const isToday = selectedDate === todayStr;
            const currentHour = today.getHours();
            const currentMinute = today.getMinutes();

            // v3.9.11: Debug log
            log.log('[TimeSlots] assignByAdmin', { selectedDate, todayStr, isToday, currentHour, currentMinute, slotGrid, slotLimit });

            // Remove duplicate slots
            const uniqueSlots: any[] = [];
            const seenTimes = new Set<string>();
            slots.forEach((slot: any) => {
                if (!seenTimes.has(slot.time)) {
                    seenTimes.add(slot.time);
                    uniqueSlots.push(slot);
                }
            });

            // v3.9.11: Count available future slots
            let availableFutureSlotsCount = 0;

            // Render slots
            uniqueSlots.forEach((slot: any) => {
                const [slotHour, slotMinute] = slot.time.split(':').map(Number);

                // If today and past time, skip
                if (isToday) {
                    if (slotHour < currentHour || (slotHour === currentHour && slotMinute <= currentMinute)) {
                        return; // Past slot, don't show
                    }
                }

                const btn = document.createElement('div');

                if (slot.available) {
                    // ✅ AVAILABLE - Less than slotLimit appointments
                    btn.className = 'slot-btn';
                    btn.textContent = slot.time;
                    if (slot.count > 0) {
                        btn.title = `Bu saatte ${slot.count} randevu var`;
                    }
                    btn.addEventListener('click', () => selectTimeSlot(slot.time, btn));
                    availableFutureSlotsCount++;
                } else {
                    // ❌ FULL - Already at slotLimit
                    btn.className = 'slot-btn disabled';
                    btn.textContent = slot.time;
                    btn.title = `Bu saat dolu (${slotLimit} randevu)`;
                    btn.style.opacity = '0.4';
                    btn.style.cursor = 'not-allowed';
                    btn.setAttribute('aria-disabled', 'true');
                }

                container.appendChild(btn);
            });

            // v3.9.11: If no available slots (all past or all full) - handle onlytoday profile
            const takvimFiltresi = profilAyarlari?.takvimFiltresi;
            if (container.children.length === 0 || availableFutureSlotsCount === 0) {
                if (takvimFiltresi === 'onlytoday') {
                    // Sadece alternatif butonları göster
                    renderAlternateBookingButtons(container, true);
                } else if (container.children.length === 0) {
                    const infoDiv = document.createElement('div');
                    infoDiv.style.cssText = 'grid-column: 1/-1; text-align: center; padding: 20px; color: #dc3545;';
                    infoDiv.textContent = 'Bugün için müsait saat kalmamıştır.';
                    container.appendChild(infoDiv);
                }
                return;
            }

            // v3.9: 'onlytoday' profilleri için alternatif randevu butonları
            renderAlternateBookingButtons(container);
            return;
        }

        // Normal management appointment (Management type selected from staff=0)
        if (selectedAppointmentType === 'management') {
            while (container.firstChild) container.removeChild(container.firstChild);

            // Management appointment - all hours available (with half hours)
            const managementSlots: { time: string }[] = [];

            // v3.9.19: Hizmet saatleri 11:00 - 20:30 (çalışma 10-22, hizmet 11-21)
            for (let hour = 11; hour <= 20; hour++) {
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

            // v3.9: 'onlytoday' profilleri için alternatif randevu butonları
            renderAlternateBookingButtons(container);
            return;
        }

        // v3.9: Profil ayarlarından slotGrid al (linkType kaldırıldı)
        const slotGrid = profilAyarlari?.slotGrid || 60;
        // v3.9.4: maxSlotAppointment profil ayarından al
        const maxSlotAppointment = profilAyarlari?.maxSlotAppointment || 1;
        const profilCode = profilAyarlari?.code || 'g';

        // v3.9.13: DEBUG log removed for security (PII protection)
        log.log('getDailySlots params:', { slotGrid, maxSlotAppointment, profilCode });

        // v3.8: vardiyaKontrolu=false ise tüm çalışma saatlerini getir (shiftType='full')
        const effectiveShiftType = vardiyaKontrolu ? selectedShiftType : 'full';

        // v3.9.20: Staff bazlı filtreleme - self/linked profillerde sadece kendi randevularını say
        const selectedStaffForFilter = state.get('selectedStaff');

        const [dayStatusResult, slotsResult] = await Promise.all([
            apiCall('getDayStatus', {
                date: selectedDate,
                appointmentType: selectedAppointmentType,
                maxSlotAppointment: maxSlotAppointment,
                ...(selectedStaffForFilter ? { staffId: selectedStaffForFilter } : {})
            }),
            apiCall('getDailySlots', {
                date: selectedDate,
                shiftType: effectiveShiftType,
                slotGrid: slotGrid  // v3.9: linkType yerine doğrudan slotGrid gönder
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

        // Handle both response formats: { data: { availableHours } } or { availableHours }
        const dayStatusData = (dayStatusResult as any).data || dayStatusResult;
        const slotsData = (slotsResult as any).data || slotsResult;
        const { availableHours } = dayStatusData as any;
        const { slots } = slotsData as any;

        while (container.firstChild) container.removeChild(container.firstChild);

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

        // v3.9.11: Debug log
        log.log('[TimeSlots] normalFlow', { selectedDate, todayStr, isToday, currentHour, currentMinute, slotGrid, availableHours: availableHours.length });

        // If no available hours, show info
        if (availableHours.length === 0) {
            const takvimFiltresi = profilAyarlari?.takvimFiltresi;
            if (takvimFiltresi === 'onlytoday') {
                // Sadece alternatif butonları göster
                renderAlternateBookingButtons(container, true);
            } else {
                const infoDiv = document.createElement('div');
                infoDiv.style.cssText = 'grid-column: 1/-1; text-align: center; padding: 20px; color: #dc3545;';
                infoDiv.textContent = 'Bu gün için müsait saat bulunmamaktadır.';
                container.appendChild(infoDiv);
                // v3.9: 'onlytoday' profilleri için alternatif randevu butonları
                renderAlternateBookingButtons(container);
            }
            return;
        }

        // v3.9.11: Count available future slots for onlytoday check
        let availableFutureSlotsCount = 0;

        // Render slots
        slots.forEach((slot: any) => {
            // v3.9: Bugün için geçmiş saatleri filtrele (tüm durumlar için)
            // Önceden sadece staff=0 için yapılıyordu, şimdi isToday ise her zaman kontrol
            if (isToday) {
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
                availableFutureSlotsCount++;
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

        // v3.9.11: If no available future slots - handle onlytoday profile
        const takvimFiltresi = profilAyarlari?.takvimFiltresi;
        if (container.children.length === 0 || availableFutureSlotsCount === 0) {
            if (takvimFiltresi === 'onlytoday') {
                // Sadece alternatif butonları göster
                renderAlternateBookingButtons(container, true);
            } else if (container.children.length === 0) {
                const infoDiv = document.createElement('div');
                infoDiv.style.cssText = 'grid-column: 1/-1; text-align: center; padding: 20px; color: #dc3545;';
                infoDiv.textContent = 'Bugün için müsait saat kalmamıştır.';
                container.appendChild(infoDiv);
            }
            return;
        }

        // v3.9: 'onlytoday' profilleri için alternatif randevu butonları
        renderAlternateBookingButtons(container);

    } catch (error) {
        log.error('displayAvailableTimeSlots error:', error);
        logError(error, { context: 'displayAvailableTimeSlots', date: selectedDate, shiftType: selectedShiftType });
        while (container.firstChild) container.removeChild(container.firstChild);
        const errDiv = document.createElement('div');
        errDiv.style.cssText = 'grid-column: 1/-1; text-align: center; padding: 20px; color: #dc3545;';
        errDiv.textContent = 'Saatler yüklenirken bir hata oluştu. Lütfen sayfayı yenileyin.';
        container.appendChild(errDiv);
    }
}

// ==================== ALTERNATE BOOKING BUTTONS ====================

/**
 * Render alternate booking buttons for 'onlytoday' profile
 * Shows "Randevu Al" and "Linki Paylaş" buttons
 * @param container - Container element to append buttons to
 * @param noSlotsAvailable - If true, shows only buttons (no error message) and hides time section title
 */
function renderAlternateBookingButtons(container: HTMLElement, noSlotsAvailable: boolean = false): void {
    const profilAyarlari = state.get('profilAyarlari');
    const takvimFiltresi = profilAyarlari?.takvimFiltresi;

    // Only show for 'onlytoday' profiles
    if (takvimFiltresi !== 'onlytoday') return;

    // v3.9.11: Tüm slotlar geçmişse, time section başlığını gizle ve bilgi mesajı göster
    if (noSlotsAvailable) {
        // Time section heading'i gizle
        const timeSection = document.getElementById('timeSection');
        const heading = timeSection?.querySelector('h2');
        if (heading) heading.style.display = 'none';

        // Bilgi mesajı ekle
        const infoDiv = document.createElement('div');
        infoDiv.style.cssText = 'grid-column: 1/-1; text-align: center; padding: 20px; color: #666;';
        infoDiv.textContent = 'Bugün için randevu slotları dolmuştur. Genel randevu linkini kullanabilirsiniz.';
        container.appendChild(infoDiv);
    }

    // Create button container - same row, responsive stacking
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'alternate-booking-container';
    buttonContainer.style.cssText = `
        grid-column: 1/-1;
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 20px;
        justify-content: center;
    `;

    // Button 1: Randevu Al (opens general link in new tab)
    const bookBtn = document.createElement('button');
    bookBtn.type = 'button';
    bookBtn.className = 'btn btn-auto';
    bookBtn.textContent = 'Randevu Al';
    bookBtn.addEventListener('click', () => {
        const baseUrl = window.location.origin + window.location.pathname;
        const generalLink = baseUrl + '#g';
        window.open(generalLink, '_blank');
    });
    buttonContainer.appendChild(bookBtn);

    // Button 2: Linki Paylaş (copies to clipboard)
    const shareBtn = document.createElement('button');
    shareBtn.type = 'button';
    shareBtn.className = 'btn btn-auto';
    shareBtn.textContent = 'Linki Paylaş';
    shareBtn.addEventListener('click', async () => {
        const baseUrl = window.location.origin + window.location.pathname;
        const generalLink = baseUrl + '#g';

        try {
            await navigator.clipboard.writeText(generalLink);
            showAlert('Link kopyalandı!', 'success');

            // Visual feedback - dark background like active state
            const originalText = shareBtn.textContent;
            shareBtn.textContent = 'Kopyalandı!';
            shareBtn.style.background = '#1A1A2E';
            shareBtn.style.color = '#FAFAFA';
            shareBtn.style.borderColor = '#1A1A2E';

            setTimeout(() => {
                shareBtn.textContent = originalText;
                shareBtn.style.background = '';
                shareBtn.style.color = '';
                shareBtn.style.borderColor = '';
            }, 2000);
        } catch (err) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = generalLink;
            textArea.style.cssText = 'position: fixed; left: -9999px;';
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showAlert('Link kopyalandı!', 'success');
        }
    });
    buttonContainer.appendChild(shareBtn);

    container.appendChild(buttonContainer);
}

// ==================== TIME SLOT SELECTION ====================

/**
 * Select a time slot
 */
export function selectTimeSlot(timeStr: string, element: HTMLElement): void {
    state.set('selectedTime', timeStr);
    const selectedAppointmentType = state.get('selectedAppointmentType');
    const selectedStaff = state.get('selectedStaff');

    // v3.9: Tüm mantık profil ayarlarına göre çalışır
    const profilAyarlari = state.get('profilAyarlari');
    const staffFilter = profilAyarlari?.staffFilter || 'all';
    const assignByAdmin = profilAyarlari?.assignByAdmin === true;

    // ⚡ PERFORMANCE: Only update previous selected element (reduce reflow)
    const prev = document.querySelector('.slot-btn.selected');
    if (prev) prev.classList.remove('selected');
    element.classList.add('selected');

    // Helper: Form bölümlerini göster
    const showFormSections = () => {
        revealSection('detailsSection');
        const kvkkContainer = document.getElementById('kvkkContainer');
        if (kvkkContainer) kvkkContainer.style.display = 'block';
        const turnstileContainer = document.getElementById('turnstileContainer');
        if (turnstileContainer) turnstileContainer.style.display = 'block';
        // Only show submit if Turnstile already verified
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn && (window as any).turnstileVerified) submitBtn.style.display = 'block';
    };

    // v3.9: Personel seçimi atlanacak durumlar (profil ayarlarına göre)
    // - staffFilter === 'none': Müşteri geldi, personel yok
    // - assignByAdmin === true: Backend rastgele atayacak
    // - Management randevusu (staff=0'dan seçilmiş)
    const skipStaffSelection = staffFilter === 'none' ||
                                assignByAdmin ||
                                (selectedAppointmentType === 'management' && selectedStaff === 0);

    if (skipStaffSelection) {
        // assignByAdmin ise backend rastgele atayacak
        if (assignByAdmin) {
            state.set('selectedStaff', -1); // Placeholder: Backend will randomly assign
        }
        hideSection('staffSection');
        showFormSections();
    } else {
        // Normal akış: Form göster
        showFormSections();
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
