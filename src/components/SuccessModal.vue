<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="modal-backdrop" @click="handleBackdropClick">
        <div class="modal-container" @click.stop>
          <div class="modal-content">
            <!-- Success Icon -->
            <div class="success-icon">
              <div class="checkmark">✓</div>
            </div>

            <!-- Title -->
            <h2 class="modal-title">Randevunuz Oluşturuldu!</h2>

            <!-- Appointment Details -->
            <div v-if="appointmentData" class="appointment-details">
              <div class="detail-row">
                <span class="detail-label">Tarih:</span>
                <span class="detail-value">{{ formattedDate }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Saat:</span>
                <span class="detail-value">{{ appointmentData.time }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Personel:</span>
                <span class="detail-value">{{ appointmentData.staffName }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Randevu Tipi:</span>
                <span class="detail-value">{{ appointmentData.appointmentType }}</span>
              </div>
            </div>

            <!-- Confirmation Message -->
            <p class="confirmation-message">
              Randevu bilgileriniz <strong>{{ appointmentData?.customerEmail || 'telefon numaranıza' }}</strong> gönderildi.
            </p>

            <!-- Calendar Export Buttons -->
            <div class="calendar-buttons">
              <h3 class="calendar-title">Takviminize Ekleyin</h3>
              <div class="button-grid">
                <button
                  class="calendar-btn calendar-btn--google"
                  @click="addToGoogleCalendar"
                  title="Google Takvim'e ekle"
                >
                  <span class="btn-icon">📅</span>
                  Google Takvim
                </button>
                <button
                  class="calendar-btn calendar-btn--apple"
                  @click="addToAppleCalendar"
                  title="Apple Takvim'e ekle"
                >
                  <span class="btn-icon">🍎</span>
                  Apple Takvim
                </button>
                <button
                  class="calendar-btn calendar-btn--outlook"
                  @click="addToOutlookCalendar"
                  title="Outlook'a ekle"
                >
                  <span class="btn-icon">📧</span>
                  Outlook
                </button>
              </div>
            </div>

            <!-- Close Button -->
            <button class="close-btn" @click="handleClose">
              Kapat
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { DateUtils } from '../../date-utils.ts';

// Props
interface Props {
  show: boolean;
  appointmentData?: AppointmentData | null;
}

const props = withDefaults(defineProps<Props>(), {
  show: false,
  appointmentData: null
});

// Emits
interface Emits {
  (e: 'close'): void;
  (e: 'add-to-calendar', provider: CalendarProvider): void;
}

const emit = defineEmits<Emits>();

// Types
interface AppointmentData {
  date: string;
  time: string;
  staffName: string;
  appointmentType: string;
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
}

type CalendarProvider = 'google' | 'apple' | 'outlook';

// Computed
const formattedDate = computed(() => {
  if (!props.appointmentData?.date) return '';
  try {
    const date = new Date(props.appointmentData.date + 'T00:00:00');
    return DateUtils.toTurkishDate(date);
  } catch {
    return props.appointmentData.date;
  }
});

// Methods
function handleBackdropClick() {
  // Allow closing by clicking backdrop
  handleClose();
}

function handleClose() {
  emit('close');
}

function addToGoogleCalendar() {
  emit('add-to-calendar', 'google');
  generateGoogleCalendarLink();
}

function addToAppleCalendar() {
  emit('add-to-calendar', 'apple');
  generateICSFile();
}

function addToOutlookCalendar() {
  emit('add-to-calendar', 'outlook');
  generateOutlookLink();
}

function generateGoogleCalendarLink() {
  if (!props.appointmentData) return;

  const { date, time, staffName, appointmentType } = props.appointmentData;

  // Parse time range (e.g., "14:00 - 15:00")
  const [startTime, endTime] = time.split(' - ');

  // Create start and end datetime
  const startDateTime = new Date(`${date}T${startTime}:00`);
  const endDateTime = new Date(`${date}T${endTime}:00`);

  const title = `Rolex Randevu - ${appointmentType}`;
  const details = `Personel: ${staffName}\nRandevu Tipi: ${appointmentType}`;
  const location = 'Rolex İzmir İstinyepark';

  const startStr = DateUtils.toICSDate(startDateTime).replace(/[-:]/g, '');
  const endStr = DateUtils.toICSDate(endDateTime).replace(/[-:]/g, '');

  const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startStr}/${endStr}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}`;

  window.open(url, '_blank');
}

function generateICSFile() {
  if (!props.appointmentData) return;

  const { date, time, staffName, appointmentType } = props.appointmentData;

  const [startTime, endTime] = time.split(' - ');
  const startDateTime = new Date(`${date}T${startTime}:00`);
  const endDateTime = new Date(`${date}T${endTime}:00`);

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Rolex Izmir Istinyepark//Appointment System//TR',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@rolexizmir.com`,
    `DTSTAMP:${DateUtils.toICSDate(new Date())}`,
    `DTSTART:${DateUtils.toICSDate(startDateTime)}`,
    `DTEND:${DateUtils.toICSDate(endDateTime)}`,
    `SUMMARY:Rolex Randevu - ${appointmentType}`,
    `DESCRIPTION:Personel: ${staffName}\\nRandevu Tipi: ${appointmentType}`,
    'LOCATION:Rolex İzmir İstinyepark',
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `rolex-randevu-${date}.ics`;
  link.click();
}

function generateOutlookLink() {
  if (!props.appointmentData) return;

  const { date, time, staffName, appointmentType } = props.appointmentData;

  const [startTime, endTime] = time.split(' - ');
  const startDateTime = new Date(`${date}T${startTime}:00`);
  const endDateTime = new Date(`${date}T${endTime}:00`);

  const title = `Rolex Randevu - ${appointmentType}`;
  const body = `Personel: ${staffName}\nRandevu Tipi: ${appointmentType}`;
  const location = 'Rolex İzmir İstinyepark';

  const startStr = startDateTime.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const endStr = endDateTime.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const url = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(title)}&startdt=${startStr}&enddt=${endStr}&body=${encodeURIComponent(body)}&location=${encodeURIComponent(location)}`;

  window.open(url, '_blank');
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
  overflow-y: auto;
}

.modal-container {
  max-width: 550px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-content {
  background: white;
  border-radius: 16px;
  padding: 40px 30px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  text-align: center;
}

.success-icon {
  margin-bottom: 20px;
}

.checkmark {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, #006039, #00804d);
  color: white;
  font-size: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
  animation: scaleIn 0.5s ease-out;
  font-weight: bold;
}

@keyframes scaleIn {
  from {
    transform: scale(0);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.modal-title {
  font-size: 26px;
  font-weight: 700;
  color: #2c3e50;
  margin: 0 0 25px 0;
}

.appointment-details {
  background: #f8f9fa;
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 20px;
  text-align: left;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #e0e0e0;
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-label {
  font-weight: 600;
  color: #666;
}

.detail-value {
  font-weight: 600;
  color: #2c3e50;
}

.confirmation-message {
  font-size: 15px;
  color: #555;
  margin: 0 0 30px 0;
  line-height: 1.5;
}

.calendar-buttons {
  margin-bottom: 25px;
}

.calendar-title {
  font-size: 16px;
  font-weight: 600;
  color: #2c3e50;
  margin: 0 0 15px 0;
}

.button-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}

.calendar-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 15px 10px;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  background: white;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 14px;
  font-weight: 600;
  color: #2c3e50;
  font-family: inherit;
}

.calendar-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.calendar-btn--google:hover {
  border-color: #4285f4;
  color: #4285f4;
}

.calendar-btn--apple:hover {
  border-color: #000;
  color: #000;
}

.calendar-btn--outlook:hover {
  border-color: #0078d4;
  color: #0078d4;
}

.btn-icon {
  font-size: 28px;
  line-height: 1;
}

.close-btn {
  width: 100%;
  padding: 15px;
  border: none;
  border-radius: 10px;
  background: #006039;
  color: white;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: inherit;
}

.close-btn:hover {
  background: #004d2e;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 96, 57, 0.3);
}

/* Modal transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-content {
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(30px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@media (max-width: 768px) {
  .modal-content {
    padding: 30px 20px;
  }

  .checkmark {
    width: 70px;
    height: 70px;
    font-size: 42px;
  }

  .modal-title {
    font-size: 22px;
  }

  .button-grid {
    grid-template-columns: 1fr;
  }

  .calendar-btn {
    flex-direction: row;
    justify-content: flex-start;
    padding: 12px 15px;
  }

  .btn-icon {
    font-size: 24px;
  }
}
</style>
