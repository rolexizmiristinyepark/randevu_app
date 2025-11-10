<template>
  <div class="shift-planner">
    <div class="planner-header">
      <h2 class="panel-title">Vardiya Planlama</h2>
      <div class="week-navigation">
        <button class="nav-btn" @click="previousWeek" title="Önceki Hafta">
          ‹
        </button>
        <span class="week-label">{{ weekLabel }}</span>
        <button class="nav-btn" @click="nextWeek" title="Sonraki Hafta">
          ›
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      Vardiya bilgileri yükleniyor...
    </div>

    <div v-else class="shift-grid">
      <div
        v-for="day in weekDays"
        :key="day.date"
        class="day-card"
      >
        <div class="day-header">
          <h3 class="day-name">{{ day.dayName }}</h3>
          <p class="day-date">{{ day.formattedDate }}</p>
        </div>

        <div class="day-shifts">
          <!-- Morning Shift -->
          <div class="shift-row">
            <div class="shift-label">
              <span class="shift-icon">🌅</span>
              <span>Sabah</span>
              <span class="shift-time">09:00-13:00</span>
            </div>
            <select
              v-model="shifts[day.date].morning"
              class="shift-select"
              @change="handleShiftChange(day.date, 'morning')"
            >
              <option value="">Personel seç...</option>
              <option
                v-for="staff in availableStaff"
                :key="staff.id"
                :value="staff.id"
              >
                {{ staff.name }}
              </option>
            </select>
          </div>

          <!-- Evening Shift -->
          <div class="shift-row">
            <div class="shift-label">
              <span class="shift-icon">🌆</span>
              <span>Akşam</span>
              <span class="shift-time">14:00-19:00</span>
            </div>
            <select
              v-model="shifts[day.date].evening"
              class="shift-select"
              @change="handleShiftChange(day.date, 'evening')"
            >
              <option value="">Personel seç...</option>
              <option
                v-for="staff in availableStaff"
                :key="staff.id"
                :value="staff.id"
              >
                {{ staff.name }}
              </option>
            </select>
          </div>

          <!-- Full Day -->
          <div class="shift-row">
            <div class="shift-label">
              <span class="shift-icon">☀️</span>
              <span>Tüm Gün</span>
              <span class="shift-time">09:00-19:00</span>
            </div>
            <select
              v-model="shifts[day.date].full"
              class="shift-select"
              @change="handleShiftChange(day.date, 'full')"
            >
              <option value="">Personel seç...</option>
              <option
                v-for="staff in availableStaff"
                :key="staff.id"
                :value="staff.id"
              >
                {{ staff.name }}
              </option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <div class="planner-footer">
      <button
        class="save-btn"
        :disabled="saving || !hasChanges"
        @click="saveShifts"
      >
        <span v-if="saving" class="btn-spinner"></span>
        {{ saving ? 'Kaydediliyor...' : 'Vardiyaları Kaydet' }}
      </button>
      <button
        v-if="hasChanges"
        class="reset-btn"
        @click="resetChanges"
      >
        Değişiklikleri İptal Et
      </button>
    </div>

    <!-- Staff Summary -->
    <div class="staff-summary">
      <h3 class="summary-title">Haftalık Vardiya Özeti</h3>
      <div class="summary-grid">
        <div
          v-for="staff in staffSummary"
          :key="staff.id"
          class="summary-card"
        >
          <div class="summary-name">{{ staff.name }}</div>
          <div class="summary-count">
            <span class="count-value">{{ staff.shiftCount }}</span>
            <span class="count-label">vardiya</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { DateUtils } from '../../../date-utils.ts';

// Props
interface Props {
  weekDate?: Date;
  availableStaff?: Staff[];
  initialShifts?: WeekShifts;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  weekDate: () => new Date(),
  availableStaff: () => [],
  initialShifts: () => ({}),
  loading: false
});

// Emits
interface Emits {
  (e: 'save-shifts', shifts: WeekShifts): void;
  (e: 'change-week', date: Date): void;
}

const emit = defineEmits<Emits>();

// Types
interface Staff {
  id: string | number;
  name: string;
  active: boolean;
}

interface DayShift {
  morning: string | number;
  evening: string | number;
  full: string | number;
}

interface WeekShifts {
  [date: string]: DayShift;
}

interface WeekDay {
  date: string;
  dayName: string;
  formattedDate: string;
}

// State
const currentWeekStart = ref(getMonday(props.weekDate));
const shifts = ref<WeekShifts>({});
const originalShifts = ref<WeekShifts>({});
const saving = ref(false);

// Computed
const weekLabel = computed(() => {
  const start = new Date(currentWeekStart.value);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  return `${start.getDate()} ${DateUtils.MONTHS_TR[start.getMonth()]} - ${end.getDate()} ${DateUtils.MONTHS_TR[end.getMonth()]} ${end.getFullYear()}`;
});

const weekDays = computed((): WeekDay[] => {
  const days: WeekDay[] = [];
  const start = new Date(currentWeekStart.value);

  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    const dateStr = DateUtils.toLocalDate(date);

    days.push({
      date: dateStr,
      dayName: DateUtils.DAYS_TR[date.getDay()],
      formattedDate: `${date.getDate()} ${DateUtils.MONTHS_TR[date.getMonth()]}`
    });
  }

  return days;
});

const hasChanges = computed(() => {
  return JSON.stringify(shifts.value) !== JSON.stringify(originalShifts.value);
});

const staffSummary = computed(() => {
  const summary: { [key: string]: { id: string | number; name: string; shiftCount: number } } = {};

  props.availableStaff.forEach(staff => {
    summary[staff.id] = {
      id: staff.id,
      name: staff.name,
      shiftCount: 0
    };
  });

  Object.values(shifts.value).forEach(dayShift => {
    if (dayShift.morning && summary[dayShift.morning]) {
      summary[dayShift.morning].shiftCount++;
    }
    if (dayShift.evening && summary[dayShift.evening]) {
      summary[dayShift.evening].shiftCount++;
    }
    if (dayShift.full && summary[dayShift.full]) {
      summary[dayShift.full].shiftCount++;
    }
  });

  return Object.values(summary).sort((a, b) => b.shiftCount - a.shiftCount);
});

// Methods
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
}

function previousWeek() {
  const newStart = new Date(currentWeekStart.value);
  newStart.setDate(newStart.getDate() - 7);
  currentWeekStart.value = newStart;
  emit('change-week', newStart);
}

function nextWeek() {
  const newStart = new Date(currentWeekStart.value);
  newStart.setDate(newStart.getDate() + 7);
  currentWeekStart.value = newStart;
  emit('change-week', newStart);
}

function initializeShifts() {
  const newShifts: WeekShifts = {};

  weekDays.value.forEach(day => {
    newShifts[day.date] = props.initialShifts[day.date] || {
      morning: '',
      evening: '',
      full: ''
    };
  });

  shifts.value = newShifts;
  originalShifts.value = JSON.parse(JSON.stringify(newShifts));
}

function handleShiftChange(date: string, shiftType: 'morning' | 'evening' | 'full') {
  // Optional: Add validation logic here
  console.log(`Shift changed: ${date} - ${shiftType} - ${shifts.value[date][shiftType]}`);
}

async function saveShifts() {
  saving.value = true;

  try {
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call
    emit('save-shifts', { ...shifts.value });
    originalShifts.value = JSON.parse(JSON.stringify(shifts.value));
    alert('Vardiyalar başarıyla kaydedildi!');
  } catch (error) {
    console.error('Shifts save error:', error);
    alert('Vardiyalar kaydedilirken bir hata oluştu.');
  } finally {
    saving.value = false;
  }
}

function resetChanges() {
  if (confirm('Tüm değişiklikler kaybolacak. Devam etmek istiyor musunuz?')) {
    shifts.value = JSON.parse(JSON.stringify(originalShifts.value));
  }
}

// Watchers
watch(() => currentWeekStart.value, () => {
  initializeShifts();
});

// Lifecycle
onMounted(() => {
  initializeShifts();
});
</script>

<style scoped>
.shift-planner {
  max-width: 1400px;
  margin: 0 auto;
  padding: 30px;
}

.planner-header {
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

.week-navigation {
  display: flex;
  align-items: center;
  gap: 15px;
}

.nav-btn {
  width: 40px;
  height: 40px;
  border: 2px solid #e0e0e0;
  background: white;
  border-radius: 8px;
  font-size: 24px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: inherit;
}

.nav-btn:hover {
  border-color: #006039;
  color: #006039;
  transform: scale(1.05);
}

.week-label {
  font-size: 16px;
  font-weight: 600;
  color: #2c3e50;
  min-width: 200px;
  text-align: center;
}

.loading-state {
  text-align: center;
  padding: 60px 20px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

/* Shift Grid */
.shift-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.day-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.day-header {
  background: linear-gradient(135deg, #006039, #00804d);
  color: white;
  padding: 15px 20px;
  text-align: center;
}

.day-name {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 4px 0;
}

.day-date {
  font-size: 14px;
  margin: 0;
  opacity: 0.9;
}

.day-shifts {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.shift-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shift-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #2c3e50;
}

.shift-icon {
  font-size: 18px;
  line-height: 1;
}

.shift-time {
  font-size: 12px;
  color: #666;
  margin-left: auto;
}

.shift-select {
  padding: 10px 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.shift-select:focus {
  outline: none;
  border-color: #006039;
}

.shift-select option {
  padding: 10px;
}

/* Footer */
.planner-footer {
  display: flex;
  gap: 15px;
  justify-content: center;
  margin-bottom: 30px;
}

.save-btn,
.reset-btn {
  padding: 14px 32px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: inherit;
}

.save-btn {
  background: #006039;
  color: white;
}

.save-btn:hover:not(:disabled) {
  background: #004d2e;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 96, 57, 0.3);
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.reset-btn {
  background: white;
  color: #dc3545;
  border: 2px solid #dc3545;
}

.reset-btn:hover {
  background: #dc3545;
  color: white;
}

.btn-spinner {
  width: 18px;
  height: 18px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Staff Summary */
.staff-summary {
  background: white;
  border-radius: 12px;
  padding: 25px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.summary-title {
  font-size: 20px;
  font-weight: 600;
  color: #2c3e50;
  margin: 0 0 20px 0;
  padding-bottom: 10px;
  border-bottom: 2px solid #e0e0e0;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 15px;
}

.summary-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
}

.summary-name {
  font-weight: 600;
  color: #2c3e50;
}

.summary-count {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.count-value {
  font-size: 24px;
  font-weight: 700;
  color: #006039;
  line-height: 1;
}

.count-label {
  font-size: 12px;
  color: #666;
}

/* Responsive */
@media (max-width: 1200px) {
  .shift-grid {
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  }
}

@media (max-width: 768px) {
  .shift-planner {
    padding: 20px 15px;
  }

  .planner-header {
    flex-direction: column;
    gap: 20px;
    align-items: flex-start;
  }

  .panel-title {
    font-size: 24px;
  }

  .shift-grid {
    grid-template-columns: 1fr;
  }

  .planner-footer {
    flex-direction: column;
  }

  .save-btn,
  .reset-btn {
    width: 100%;
    justify-content: center;
  }

  .summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
