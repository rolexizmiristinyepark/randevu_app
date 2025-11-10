<template>
  <div class="customer-view">
    <!-- Header -->
    <header class="app-header">
      <div class="header-content">
        <h1 class="header-title">Rolex İzmir İstinyepark</h1>
        <p class="header-subtitle">Randevu Sistemi</p>
      </div>
    </header>

    <main class="app-main">
      <div class="container">
        <!-- Error Alert -->
        <BaseAlert
          v-if="error"
          type="error"
          title="Hata"
          :message="error"
          :show="!!error"
          @close="clearError"
        />

        <!-- Step 1: Appointment Type Selection -->
        <AppointmentTypeSelector
          v-model:selected-type="appointmentType"
          @select-type="handleTypeSelect"
        />

        <!-- Step 2: Staff Selection -->
        <StaffSelector
          v-if="appointmentType"
          v-model:selected-staff-id="selectedStaffId"
          @select-staff="handleStaffSelect"
        />

        <!-- Step 3: Shift Selection -->
        <ShiftSelector
          v-if="selectedStaffId"
          v-model:selected-shift="shiftType"
          @select-shift="handleShiftSelect"
        />

        <!-- Step 4: Calendar -->
        <Calendar
          v-if="canSelectDate"
          v-model:selected-date="selectedDate"
          :available-dates="availableDates"
          :loading="calendarLoading"
          @select-date="handleDateSelect"
          @change-month="handleMonthChange"
        />

        <!-- Step 5: Time Slot Selection -->
        <TimeSlotPicker
          v-if="selectedDate"
          :selected-date="selectedDate"
          :shift-type="shiftType"
          :appointment-type="appointmentType"
          @select-slot="handleTimeSlotSelect"
        />

        <!-- Step 6: Customer Form -->
        <AppointmentForm
          ref="appointmentFormRef"
          v-if="selectedTime"
          :show-form="!!selectedTime"
          :selected-date="selectedDate"
          :selected-time="selectedTime"
          :staff-name="selectedStaff?.name || ''"
          :appointment-type-label="getAppointmentTypeLabel(appointmentType)"
          @submit="handleFormSubmit"
        />
      </div>
    </main>

    <!-- Success Modal -->
    <SuccessModal
      :show="showSuccessModal"
      :appointment-data="successAppointmentData"
      @close="handleSuccessClose"
      @add-to-calendar="handleAddToCalendar"
    />

    <!-- Loading Overlay -->
    <LoadingSpinner
      v-if="submitting"
      overlay
      message="Randevunuz oluşturuluyor..."
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useAppointment } from '../composables/useAppointment';
import type { Staff, TimeSlot, AppointmentFormData } from '../composables/useAppointment';

// Components
import AppointmentTypeSelector from '../components/AppointmentTypeSelector.vue';
import StaffSelector from '../components/StaffSelector.vue';
import ShiftSelector from '../components/ShiftSelector.vue';
import Calendar from '../components/Calendar.vue';
import TimeSlotPicker from '../components/TimeSlotPicker.vue';
import AppointmentForm from '../components/AppointmentForm.vue';
import SuccessModal from '../components/SuccessModal.vue';
import BaseAlert from '../components/shared/BaseAlert.vue';
import LoadingSpinner from '../components/shared/LoadingSpinner.vue';

// Composable
const {
  appointmentType,
  selectedStaff,
  selectedStaffId,
  selectedDate,
  selectedTime,
  shiftType,
  staffMembers,
  timeSlots,
  formData,
  loading,
  submitting,
  error,
  canSelectDate,
  canSelectTime,
  canSubmit,
  appointmentSummary,
  loadStaff,
  loadAvailableTimeSlots,
  createAppointment,
  selectAppointmentType,
  selectStaff,
  selectShift,
  selectDate,
  selectTimeSlot,
  resetAppointment
} = useAppointment();

// Local State
const appointmentFormRef = ref<InstanceType<typeof AppointmentForm> | null>(null);
const showSuccessModal = ref(false);
const successAppointmentData = ref<any>(null);
const availableDates = ref<string[]>([]);
const calendarLoading = ref(false);

// Methods
function handleTypeSelect(type: any) {
  selectAppointmentType(type.value);
  scrollToNextStep();
}

function handleStaffSelect(staff: Staff) {
  selectStaff(staff);
  scrollToNextStep();
}

function handleShiftSelect(shift: any) {
  selectShift(shift.value);
  scrollToNextStep();
}

function handleDateSelect(date: string) {
  selectDate(date);
  scrollToNextStep();
}

function handleTimeSlotSelect(slot: TimeSlot) {
  selectTimeSlot(slot);
  scrollToNextStep();
}

function handleMonthChange(year: number, month: number) {
  // Load available dates for the selected month
  loadAvailableDatesForMonth(year, month);
}

async function handleFormSubmit(customerData: AppointmentFormData) {
  try {
    const result = await createAppointment();

    if (result.success) {
      // Prepare success modal data
      successAppointmentData.value = {
        date: selectedDate.value,
        time: selectedTime.value,
        staffName: selectedStaff.value?.name,
        appointmentType: getAppointmentTypeLabel(appointmentType.value),
        customerName: customerData.customerName,
        customerEmail: customerData.customerEmail,
        customerPhone: customerData.customerPhone
      };

      showSuccessModal.value = true;

      // Reset form
      if (appointmentFormRef.value) {
        appointmentFormRef.value.resetForm();
      }
    }
  } catch (err) {
    console.error('Form submission error:', err);
    // Error is already set in the composable
  }
}

function handleSuccessClose() {
  showSuccessModal.value = false;
  successAppointmentData.value = null;

  // Reset entire appointment flow
  resetAppointment();

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleAddToCalendar(provider: string) {
  console.log(`Adding to ${provider} calendar`);
  // Calendar export is handled in SuccessModal component
}

function clearError() {
  error.value = null;
}

function getAppointmentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'teslim': 'Teslim',
    'gorusme': 'Görüşme',
    'servis': 'Servis'
  };
  return labels[type] || type;
}

async function loadAvailableDatesForMonth(year: number, month: number) {
  calendarLoading.value = true;

  try {
    // This would normally call an API to get available dates for the month
    // For now, we'll just simulate it
    availableDates.value = []; // Placeholder
  } catch (err) {
    console.error('Error loading available dates:', err);
  } finally {
    calendarLoading.value = false;
  }
}

function scrollToNextStep() {
  // Smooth scroll to next step
  setTimeout(() => {
    const elements = document.querySelectorAll('.appointment-type-selector, .staff-selector, .shift-selector, .calendar, .time-slots-container, .appointment-form');
    const lastVisibleElement = Array.from(elements).filter(el => {
      const rect = el.getBoundingClientRect();
      return rect.height > 0;
    }).pop();

    if (lastVisibleElement) {
      lastVisibleElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, 100);
}

// Lifecycle
onMounted(async () => {
  // Load staff members on mount
  await loadStaff();

  // Check for URL parameters (appointment type)
  const urlParams = new URLSearchParams(window.location.search);
  const typeParam = urlParams.get('type');

  if (typeParam) {
    selectAppointmentType(typeParam);
  }
});

// Watchers
watch(selectedDate, () => {
  if (selectedDate.value && appointmentType.value) {
    loadAvailableTimeSlots();
  }
});

watch(shiftType, () => {
  if (selectedDate.value) {
    loadAvailableTimeSlots();
  }
});
</script>

<style scoped>
.customer-view {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #e9ecef 100%);
}

.app-header {
  background: linear-gradient(135deg, #006039 0%, #00804d 100%);
  color: white;
  padding: 40px 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  text-align: center;
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
}

.header-title {
  font-size: 36px;
  font-weight: 700;
  margin: 0 0 10px 0;
  letter-spacing: -0.5px;
}

.header-subtitle {
  font-size: 18px;
  margin: 0;
  opacity: 0.95;
  font-weight: 500;
}

.app-main {
  padding: 40px 20px;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
}

@media (max-width: 768px) {
  .app-header {
    padding: 30px 20px;
  }

  .header-title {
    font-size: 28px;
  }

  .header-subtitle {
    font-size: 16px;
  }

  .app-main {
    padding: 30px 15px;
  }
}

@media (max-width: 480px) {
  .app-header {
    padding: 25px 15px;
  }

  .header-title {
    font-size: 24px;
  }

  .header-subtitle {
    font-size: 14px;
  }

  .app-main {
    padding: 20px 10px;
  }
}
</style>
