<template>
  <div class="shift-selector">
    <h3 class="section-title">Vardiya Seçin</h3>

    <div class="shift-buttons">
      <button
        v-for="shift in shifts"
        :key="shift.value"
        :class="['shift-btn', { 'selected': selectedShift === shift.value }]"
        @click="selectShift(shift.value)"
      >
        <span class="shift-icon">{{ shift.icon }}</span>
        <span class="shift-label">{{ shift.label }}</span>
        <span class="shift-time">{{ shift.time }}</span>
      </button>
    </div>

    <div v-if="selectedShift" class="shift-info">
      <p class="info-text">
        <strong>{{ getCurrentShift()?.label }}</strong> vardiyası seçildi
        <span class="info-time">({{ getCurrentShift()?.time }})</span>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

// Props
interface Props {
  selectedShift?: string;
}

const props = withDefaults(defineProps<Props>(), {
  selectedShift: 'full'
});

// Emits
interface Emits {
  (e: 'update:selectedShift', shift: string): void;
  (e: 'select-shift', shift: ShiftType): void;
}

const emit = defineEmits<Emits>();

// Types
interface ShiftType {
  value: string;
  label: string;
  time: string;
  icon: string;
}

// Data
const shifts: ShiftType[] = [
  {
    value: 'morning',
    label: 'Sabah',
    time: '09:00 - 13:00',
    icon: '🌅'
  },
  {
    value: 'evening',
    label: 'Akşam',
    time: '14:00 - 19:00',
    icon: '🌆'
  },
  {
    value: 'full',
    label: 'Tüm Gün',
    time: '09:00 - 19:00',
    icon: '☀️'
  }
];

// Methods
function selectShift(shiftValue: string) {
  const shift = shifts.find(s => s.value === shiftValue);
  if (shift) {
    emit('update:selectedShift', shiftValue);
    emit('select-shift', shift);
  }
}

function getCurrentShift(): ShiftType | undefined {
  return shifts.find(s => s.value === props.selectedShift);
}
</script>

<style scoped>
.shift-selector {
  margin-top: 30px;
}

.section-title {
  font-size: 18px;
  font-weight: 500;
  margin-bottom: 15px;
  color: #2c3e50;
}

.shift-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 15px;
}

.shift-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 18px 15px;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  background: white;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: inherit;
}

.shift-btn:hover {
  border-color: #006039;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 96, 57, 0.15);
}

.shift-btn.selected {
  border-color: #006039;
  background: linear-gradient(135deg, #f0f9f6 0%, #ffffff 100%);
  box-shadow: 0 4px 12px rgba(0, 96, 57, 0.25);
}

.shift-icon {
  font-size: 32px;
  margin-bottom: 8px;
  line-height: 1;
}

.shift-label {
  font-size: 16px;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 4px;
}

.shift-time {
  font-size: 13px;
  color: #666;
}

.shift-btn.selected .shift-label {
  color: #006039;
}

.shift-btn.selected .shift-time {
  color: #00804d;
  font-weight: 500;
}

.shift-info {
  margin-top: 20px;
  padding: 15px;
  background: #f8f9fa;
  border-left: 4px solid #006039;
  border-radius: 4px;
}

.info-text {
  margin: 0;
  font-size: 15px;
  color: #2c3e50;
}

.info-time {
  color: #666;
  font-weight: normal;
  margin-left: 5px;
}

@media (max-width: 768px) {
  .shift-buttons {
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
  }

  .shift-btn {
    padding: 15px 12px;
  }

  .shift-icon {
    font-size: 28px;
  }

  .shift-label {
    font-size: 15px;
  }

  .shift-time {
    font-size: 12px;
  }
}

@media (max-width: 480px) {
  .shift-buttons {
    grid-template-columns: 1fr;
  }

  .shift-btn {
    flex-direction: row;
    justify-content: flex-start;
    padding: 15px;
  }

  .shift-icon {
    margin-right: 15px;
    margin-bottom: 0;
  }

  .shift-label,
  .shift-time {
    text-align: left;
  }
}
</style>
