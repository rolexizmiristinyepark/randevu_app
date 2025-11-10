<template>
  <div class="time-slots-container">
    <h3 class="section-title">Müsait Saatler</h3>

    <!-- Loading state -->
    <div v-if="loading" class="loading-spinner">
      Saatler yükleniyor...
    </div>

    <!-- Delivery limit warning -->
    <div v-else-if="isDeliveryMaxed" class="alert alert-warning">
      ⚠️ Bu tarih için teslim randevuları dolmuştur. Lütfen başka bir tarih seçin.
    </div>

    <!-- Time slots grid -->
    <div v-else class="time-slots-grid">
      <button
        v-for="slot in slots"
        :key="slot.hour"
        :class="['slot-btn', { 'slot--disabled': !slot.isAvailable }]"
        :disabled="!slot.isAvailable"
        :aria-disabled="!slot.isAvailable"
        :title="slot.isAvailable ? 'Randevu oluştur' : 'Bu saat dolu'"
        @click="selectSlot(slot)"
      >
        {{ slot.time }}
      </button>
    </div>

    <!-- No slots available -->
    <div v-if="!loading && slots.length === 0" class="alert alert-info">
      Bu tarih için müsait saat bulunmamaktadır.
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { apiCall } from '../../api-service.ts';
import type { ApiResponse } from '../../api-service.ts';

// Props
interface Props {
  selectedDate: string | null;
  shiftType: string;
  appointmentType: string;
}

const props = defineProps<Props>();

// Emits
interface Emits {
  (e: 'select-slot', slot: TimeSlot): void;
}

const emit = defineEmits<Emits>();

// Types
interface TimeSlot {
  start: string;
  end: string;
  hour: number;
  time: string;
  isAvailable: boolean;
}

interface DayStatusResponse {
  success: boolean;
  isDeliveryMaxed: boolean;
  availableHours: number[];
  unavailableHours: number[];
  deliveryCount?: number;
}

interface SlotsResponse {
  success: boolean;
  slots: Array<{
    start: string;
    end: string;
    hour: number;
    time: string;
  }>;
}

// State
const loading = ref(false);
const slots = ref<TimeSlot[]>([]);
const isDeliveryMaxed = ref(false);

// Methods
async function loadTimeSlots() {
  if (!props.selectedDate) {
    slots.value = [];
    return;
  }

  loading.value = true;

  try {
    // Parallel API calls
    const [dayStatusResult, slotsResult] = await Promise.all([
      apiCall<DayStatusResponse>('getDayStatus', {
        date: props.selectedDate,
        appointmentType: props.appointmentType
      }),
      apiCall<SlotsResponse>('getDailySlots', {
        date: props.selectedDate,
        shiftType: props.shiftType
      })
    ]);

    if (dayStatusResult.success && dayStatusResult.data && slotsResult.success && slotsResult.data) {
      const availableHours = dayStatusResult.data.availableHours;
      isDeliveryMaxed.value = dayStatusResult.data.isDeliveryMaxed;

      // Map slots with availability
      slots.value = slotsResult.data.slots.map(slot => ({
        ...slot,
        isAvailable: availableHours.includes(slot.hour)
      }));
    }
  } catch (error) {
    console.error('Error loading time slots:', error);
    slots.value = [];
  } finally {
    loading.value = false;
  }
}

function selectSlot(slot: TimeSlot) {
  if (slot.isAvailable) {
    emit('select-slot', slot);
  }
}

// Watchers
watch(
  () => [props.selectedDate, props.shiftType, props.appointmentType],
  () => {
    loadTimeSlots();
  },
  { immediate: true }
);
</script>

<style scoped>
.time-slots-container {
  margin-top: 30px;
}

.section-title {
  font-size: 18px;
  font-weight: 500;
  margin-bottom: 15px;
  color: #2c3e50;
}

.loading-spinner {
  text-align: center;
  padding: 40px;
  color: #666;
}

.alert {
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.alert-warning {
  background-color: #fff3cd;
  border: 1px solid #ffc107;
  color: #856404;
}

.alert-info {
  background-color: #d1ecf1;
  border: 1px solid #17a2b8;
  color: #0c5460;
}

.time-slots-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 15px;
}

.slot-btn {
  padding: 15px 20px;
  border: 2px solid #006039;
  background: white;
  color: #006039;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.slot-btn:hover:not(:disabled) {
  background: #006039;
  color: white;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 96, 57, 0.2);
}

.slot-btn.slot--disabled {
  opacity: 0.35;
  cursor: not-allowed;
  background: #fafafa;
  text-decoration: line-through;
  pointer-events: none;
  color: #bdbdbd;
}

@media (max-width: 768px) {
  .time-slots-grid {
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 10px;
  }

  .slot-btn {
    padding: 12px 15px;
    font-size: 14px;
  }
}
</style>
