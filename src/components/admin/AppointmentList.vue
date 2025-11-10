<template>
  <div class="appointment-list">
    <div class="list-header">
      <h2 class="panel-title">Randevular</h2>
      <div class="filter-controls">
        <select v-model="filterWeek" class="filter-select">
          <option value="current">Bu Hafta</option>
          <option value="next">Gelecek Hafta</option>
          <option value="all">Tümü</option>
        </select>
        <select v-model="filterType" class="filter-select">
          <option value="all">Tüm Tipler</option>
          <option value="teslim">Teslim</option>
          <option value="gorusme">Görüşme</option>
          <option value="servis">Servis</option>
        </select>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      Randevular yükleniyor...
    </div>

    <div v-else-if="filteredAppointments.length === 0" class="empty-state">
      <p class="empty-icon">📅</p>
      <p class="empty-text">
        {{ filterWeek === 'all' ? 'Henüz randevu bulunmuyor.' : 'Bu hafta için randevu bulunmuyor.' }}
      </p>
    </div>

    <div v-else class="appointments-container">
      <div
        v-for="appointment in filteredAppointments"
        :key="appointment.id"
        class="appointment-card"
      >
        <div class="card-header">
          <div class="appointment-type">
            <span class="type-icon">{{ getTypeIcon(appointment.appointmentType) }}</span>
            <span class="type-label">{{ getTypeLabel(appointment.appointmentType) }}</span>
          </div>
          <div class="appointment-status" :class="`status--${appointment.status || 'confirmed'}`">
            {{ getStatusLabel(appointment.status || 'confirmed') }}
          </div>
        </div>

        <div class="card-body">
          <div class="info-row">
            <span class="info-icon">👤</span>
            <div class="info-content">
              <span class="info-label">Müşteri:</span>
              <span class="info-value">{{ appointment.customerName }}</span>
            </div>
          </div>

          <div class="info-row">
            <span class="info-icon">📞</span>
            <div class="info-content">
              <span class="info-label">Telefon:</span>
              <span class="info-value">{{ formatPhone(appointment.customerPhone) }}</span>
            </div>
          </div>

          <div v-if="appointment.customerEmail" class="info-row">
            <span class="info-icon">📧</span>
            <div class="info-content">
              <span class="info-label">E-posta:</span>
              <span class="info-value">{{ appointment.customerEmail }}</span>
            </div>
          </div>

          <div class="info-row">
            <span class="info-icon">📅</span>
            <div class="info-content">
              <span class="info-label">Tarih:</span>
              <span class="info-value">{{ formatDate(appointment.date) }}</span>
            </div>
          </div>

          <div class="info-row">
            <span class="info-icon">⏰</span>
            <div class="info-content">
              <span class="info-label">Saat:</span>
              <span class="info-value">{{ appointment.time }}</span>
            </div>
          </div>

          <div class="info-row">
            <span class="info-icon">👔</span>
            <div class="info-content">
              <span class="info-label">Personel:</span>
              <span class="info-value">{{ appointment.staffName }}</span>
            </div>
          </div>

          <div v-if="appointment.notes" class="info-row info-row--notes">
            <span class="info-icon">📝</span>
            <div class="info-content">
              <span class="info-label">Notlar:</span>
              <span class="info-value">{{ appointment.notes }}</span>
            </div>
          </div>
        </div>

        <div class="card-footer">
          <button
            class="action-btn action-btn--whatsapp"
            @click="sendWhatsAppReminder(appointment)"
            title="WhatsApp hatırlatma gönder"
          >
            💬 WhatsApp
          </button>
          <button
            class="action-btn action-btn--edit"
            @click="editAppointment(appointment)"
            title="Düzenle"
          >
            ✏️ Düzenle
          </button>
          <button
            class="action-btn action-btn--delete"
            @click="deleteAppointment(appointment)"
            title="İptal Et"
          >
            🗑️ İptal
          </button>
        </div>
      </div>
    </div>

    <!-- Summary Section -->
    <div v-if="!loading && filteredAppointments.length > 0" class="summary-section">
      <div class="summary-card">
        <span class="summary-label">Toplam Randevu</span>
        <span class="summary-value">{{ filteredAppointments.length }}</span>
      </div>
      <div class="summary-card">
        <span class="summary-label">Teslim</span>
        <span class="summary-value">{{ getCountByType('teslim') }}</span>
      </div>
      <div class="summary-card">
        <span class="summary-label">Görüşme</span>
        <span class="summary-value">{{ getCountByType('gorusme') }}</span>
      </div>
      <div class="summary-card">
        <span class="summary-label">Servis</span>
        <span class="summary-value">{{ getCountByType('servis') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { DateUtils } from '../../../date-utils.ts';

// Props
interface Props {
  appointments: Appointment[];
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  appointments: () => [],
  loading: false
});

// Emits
interface Emits {
  (e: 'delete-appointment', id: string | number): void;
  (e: 'edit-appointment', appointment: Appointment): void;
  (e: 'send-whatsapp', appointment: Appointment): void;
}

const emit = defineEmits<Emits>();

// Types
interface Appointment {
  id: string | number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  date: string;
  time: string;
  staffName: string;
  appointmentType: string;
  notes?: string;
  status?: 'confirmed' | 'pending' | 'cancelled';
}

// State
const filterWeek = ref<'current' | 'next' | 'all'>('current');
const filterType = ref<string>('all');

// Computed
const filteredAppointments = computed(() => {
  let filtered = [...props.appointments];

  // Filter by week
  if (filterWeek.value !== 'all') {
    const today = new Date();
    const currentWeekStart = getMonday(today);
    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekEnd.getDate() + 6);

    const nextWeekStart = new Date(currentWeekStart);
    nextWeekStart.setDate(nextWeekStart.getDate() + 7);
    const nextWeekEnd = new Date(nextWeekStart);
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 6);

    filtered = filtered.filter(apt => {
      const aptDate = new Date(apt.date + 'T00:00:00');

      if (filterWeek.value === 'current') {
        return aptDate >= currentWeekStart && aptDate <= currentWeekEnd;
      } else if (filterWeek.value === 'next') {
        return aptDate >= nextWeekStart && aptDate <= nextWeekEnd;
      }

      return true;
    });
  }

  // Filter by type
  if (filterType.value !== 'all') {
    filtered = filtered.filter(apt => apt.appointmentType === filterType.value);
  }

  // Sort by date and time
  filtered.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.time.localeCompare(b.time);
  });

  return filtered;
});

// Methods
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function getTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    'teslim': '📦',
    'gorusme': '💼',
    'servis': '🔧'
  };
  return icons[type] || '📅';
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'teslim': 'Teslim',
    'gorusme': 'Görüşme',
    'servis': 'Servis'
  };
  return labels[type] || type;
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    'confirmed': 'Onaylandı',
    'pending': 'Beklemede',
    'cancelled': 'İptal Edildi'
  };
  return labels[status] || status;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr + 'T00:00:00');
    return DateUtils.toTurkishDate(date);
  } catch {
    return dateStr;
  }
}

function formatPhone(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `${cleaned.substring(0, 4)} ${cleaned.substring(4, 7)} ${cleaned.substring(7)}`;
  }
  return phone;
}

function getCountByType(type: string): number {
  return filteredAppointments.value.filter(apt => apt.appointmentType === type).length;
}

function sendWhatsAppReminder(appointment: Appointment) {
  emit('send-whatsapp', appointment);
}

function editAppointment(appointment: Appointment) {
  emit('edit-appointment', appointment);
}

function deleteAppointment(appointment: Appointment) {
  if (confirm(`${appointment.customerName} için randevuyu iptal etmek istediğinize emin misiniz?`)) {
    emit('delete-appointment', appointment.id);
  }
}
</script>

<style scoped>
.appointment-list {
  max-width: 1400px;
  margin: 0 auto;
  padding: 30px;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.panel-title {
  font-size: 28px;
  font-weight: 700;
  color: #2c3e50;
  margin: 0;
}

.filter-controls {
  display: flex;
  gap: 10px;
}

.filter-select {
  padding: 10px 15px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.filter-select:focus {
  outline: none;
  border-color: #006039;
}

/* States */
.loading-state,
.empty-state {
  text-align: center;
  padding: 60px 20px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.empty-icon {
  font-size: 64px;
  margin: 0 0 20px 0;
}

.empty-text {
  font-size: 18px;
  color: #666;
  margin: 0;
}

/* Appointments Container */
.appointments-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.appointment-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.appointment-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background: #f8f9fa;
  border-bottom: 2px solid #e0e0e0;
}

.appointment-type {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #2c3e50;
}

.type-icon {
  font-size: 20px;
  line-height: 1;
}

.appointment-status {
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.status--confirmed {
  background: #d4edda;
  color: #155724;
}

.status--pending {
  background: #fff3cd;
  color: #856404;
}

.status--cancelled {
  background: #f8d7da;
  color: #721c24;
}

.card-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.info-row--notes {
  flex-direction: column;
}

.info-icon {
  font-size: 18px;
  line-height: 1;
  flex-shrink: 0;
}

.info-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.info-label {
  font-size: 13px;
  color: #666;
  font-weight: 500;
}

.info-value {
  font-size: 15px;
  color: #2c3e50;
  font-weight: 600;
}

.card-footer {
  display: flex;
  gap: 8px;
  padding: 15px 20px;
  background: #f8f9fa;
  border-top: 2px solid #e0e0e0;
}

.action-btn {
  flex: 1;
  padding: 10px 15px;
  border: 2px solid;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;
}

.action-btn--whatsapp {
  background: white;
  border-color: #25d366;
  color: #25d366;
}

.action-btn--whatsapp:hover {
  background: #25d366;
  color: white;
}

.action-btn--edit {
  background: white;
  border-color: #17a2b8;
  color: #17a2b8;
}

.action-btn--edit:hover {
  background: #17a2b8;
  color: white;
}

.action-btn--delete {
  background: white;
  border-color: #dc3545;
  color: #dc3545;
}

.action-btn--delete:hover {
  background: #dc3545;
  color: white;
}

/* Summary Section */
.summary-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
}

.summary-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.summary-label {
  font-size: 14px;
  font-weight: 600;
  color: #666;
  text-align: center;
}

.summary-value {
  font-size: 32px;
  font-weight: 700;
  color: #006039;
  line-height: 1;
}

/* Responsive */
@media (max-width: 1024px) {
  .appointments-container {
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  }
}

@media (max-width: 768px) {
  .appointment-list {
    padding: 20px 15px;
  }

  .list-header {
    flex-direction: column;
    gap: 15px;
    align-items: flex-start;
  }

  .filter-controls {
    width: 100%;
    flex-direction: column;
  }

  .filter-select {
    width: 100%;
  }

  .appointments-container {
    grid-template-columns: 1fr;
  }

  .card-footer {
    flex-direction: column;
  }

  .action-btn {
    width: 100%;
  }
}
</style>
