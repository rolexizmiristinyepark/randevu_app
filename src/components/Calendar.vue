<template>
  <div class="calendar">
    <div class="calendar-header">
      <button
        class="nav-btn"
        @click="previousMonth"
        :disabled="!canGoPrevious"
        title="Önceki ay"
      >
        ‹
      </button>

      <h3 class="month-title">
        {{ MONTHS_TR[currentMonth] }} {{ currentYear }}
      </h3>

      <button
        class="nav-btn"
        @click="nextMonth"
        :disabled="!canGoNext"
        title="Sonraki ay"
      >
        ›
      </button>
    </div>

    <div class="calendar-grid">
      <!-- Day headers -->
      <div
        v-for="day in DAYS_SHORT_TR"
        :key="day"
        class="day-header"
      >
        {{ day }}
      </div>

      <!-- Calendar days -->
      <button
        v-for="day in calendarDays"
        :key="`${day.date || 'empty'}-${day.dayNumber}`"
        :class="getDayClasses(day)"
        :disabled="!day.isClickable"
        @click="selectDate(day)"
      >
        {{ day.dayNumber || '' }}
      </button>
    </div>

    <div v-if="loading" class="calendar-loading">
      Müsaitlik durumu yükleniyor...
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { DateUtils } from '../../date-utils.ts';

// Props
interface Props {
  selectedDate?: string | null;
  availableDates?: string[];
  loading?: boolean;
  minDate?: Date;
  maxMonthsAhead?: number;
}

const props = withDefaults(defineProps<Props>(), {
  selectedDate: null,
  availableDates: () => [],
  loading: false,
  minDate: () => new Date(),
  maxMonthsAhead: 3
});

// Emits
interface Emits {
  (e: 'select-date', date: string): void;
  (e: 'change-month', year: number, month: number): void;
}

const emit = defineEmits<Emits>();

// Types
interface CalendarDay {
  date: string | null;
  dayNumber: number | null;
  isToday: boolean;
  isSelected: boolean;
  isAvailable: boolean;
  isPast: boolean;
  isCurrentMonth: boolean;
  isClickable: boolean;
}

// Constants
const MONTHS_TR = DateUtils.MONTHS_TR;
const DAYS_SHORT_TR = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as const;

// State
const today = new Date();
const currentMonth = ref(today.getMonth());
const currentYear = ref(today.getFullYear());

// Computed
const canGoPrevious = computed(() => {
  const current = new Date(currentYear.value, currentMonth.value, 1);
  const min = new Date(props.minDate.getFullYear(), props.minDate.getMonth(), 1);
  return current > min;
});

const canGoNext = computed(() => {
  const maxDate = new Date(today);
  maxDate.setMonth(maxDate.getMonth() + props.maxMonthsAhead);

  const current = new Date(currentYear.value, currentMonth.value, 1);
  const max = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);

  return current < max;
});

const calendarDays = computed((): CalendarDay[] => {
  const firstDay = new Date(currentYear.value, currentMonth.value, 1);
  const lastDay = new Date(currentYear.value, currentMonth.value + 1, 0);

  // Adjust first day to Monday (0=Mon, 6=Sun in Turkish week)
  let firstDayOfWeek = firstDay.getDay() - 1;
  if (firstDayOfWeek === -1) firstDayOfWeek = 6; // Sunday

  const days: CalendarDay[] = [];

  // Previous month padding
  for (let i = 0; i < firstDayOfWeek; i++) {
    days.push({
      date: null,
      dayNumber: null,
      isToday: false,
      isSelected: false,
      isAvailable: false,
      isPast: true,
      isCurrentMonth: false,
      isClickable: false
    });
  }

  // Current month days
  const todayStr = DateUtils.toLocalDate(today);

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(currentYear.value, currentMonth.value, day);
    const dateStr = DateUtils.toLocalDate(date);
    const isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const isAvailable = props.availableDates.includes(dateStr);

    days.push({
      date: dateStr,
      dayNumber: day,
      isToday: dateStr === todayStr,
      isSelected: dateStr === props.selectedDate,
      isAvailable: isAvailable && !isPast,
      isPast,
      isCurrentMonth: true,
      isClickable: isAvailable && !isPast
    });
  }

  return days;
});

// Methods
function previousMonth() {
  if (!canGoPrevious.value) return;

  if (currentMonth.value === 0) {
    currentMonth.value = 11;
    currentYear.value--;
  } else {
    currentMonth.value--;
  }

  emit('change-month', currentYear.value, currentMonth.value);
}

function nextMonth() {
  if (!canGoNext.value) return;

  if (currentMonth.value === 11) {
    currentMonth.value = 0;
    currentYear.value++;
  } else {
    currentMonth.value++;
  }

  emit('change-month', currentYear.value, currentMonth.value);
}

function selectDate(day: CalendarDay) {
  if (day.isClickable && day.date) {
    emit('select-date', day.date);
  }
}

function getDayClasses(day: CalendarDay): string[] {
  const classes = ['calendar-day'];

  if (!day.isCurrentMonth) classes.push('calendar-day--empty');
  if (day.isToday) classes.push('calendar-day--today');
  if (day.isSelected) classes.push('calendar-day--selected');
  if (day.isAvailable) classes.push('calendar-day--available');
  if (day.isPast && day.isCurrentMonth) classes.push('calendar-day--past');
  if (!day.isClickable && day.isCurrentMonth) classes.push('calendar-day--disabled');

  return classes;
}

// Watchers
watch(() => [currentYear.value, currentMonth.value], () => {
  emit('change-month', currentYear.value, currentMonth.value);
});

// Lifecycle
onMounted(() => {
  emit('change-month', currentYear.value, currentMonth.value);
});
</script>

<style scoped>
.calendar {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-top: 30px;
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.month-title {
  font-size: 20px;
  font-weight: 600;
  color: #2c3e50;
  margin: 0;
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
  color: #2c3e50;
  font-family: inherit;
}

.nav-btn:hover:not(:disabled) {
  border-color: #006039;
  color: #006039;
  transform: scale(1.05);
}

.nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
}

.day-header {
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: #666;
  padding: 8px 0;
  text-transform: uppercase;
}

.calendar-day {
  aspect-ratio: 1;
  border: 2px solid #e0e0e0;
  background: white;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #2c3e50;
  font-family: inherit;
}

.calendar-day--empty {
  border: none;
  background: transparent;
  pointer-events: none;
}

.calendar-day--past {
  color: #bdbdbd;
  background: #fafafa;
  cursor: not-allowed;
}

.calendar-day--disabled {
  opacity: 0.4;
  cursor: not-allowed;
  text-decoration: line-through;
}

.calendar-day--available:not(.calendar-day--selected) {
  border-color: #006039;
  background: #f0f9f6;
  font-weight: 600;
}

.calendar-day--available:hover:not(:disabled):not(.calendar-day--selected) {
  background: #006039;
  color: white;
  transform: scale(1.1);
  box-shadow: 0 2px 8px rgba(0, 96, 57, 0.3);
}

.calendar-day--today {
  border-color: #ffc107;
  background: #fff9e6;
}

.calendar-day--selected {
  border-color: #006039;
  background: #006039;
  color: white;
  font-weight: 700;
  box-shadow: 0 4px 12px rgba(0, 96, 57, 0.4);
}

.calendar-loading {
  margin-top: 15px;
  text-align: center;
  font-size: 14px;
  color: #666;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 6px;
}

@media (max-width: 768px) {
  .calendar {
    padding: 15px;
  }

  .month-title {
    font-size: 18px;
  }

  .nav-btn {
    width: 36px;
    height: 36px;
    font-size: 20px;
  }

  .calendar-grid {
    gap: 6px;
  }

  .day-header {
    font-size: 11px;
    padding: 6px 0;
  }

  .calendar-day {
    font-size: 14px;
  }
}

@media (max-width: 480px) {
  .calendar {
    padding: 12px;
  }

  .month-title {
    font-size: 16px;
  }

  .nav-btn {
    width: 32px;
    height: 32px;
    font-size: 18px;
  }

  .calendar-grid {
    gap: 4px;
  }

  .day-header {
    font-size: 10px;
  }

  .calendar-day {
    font-size: 13px;
  }
}
</style>
