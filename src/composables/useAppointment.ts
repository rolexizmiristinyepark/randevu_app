/**
 * useAppointment Composable
 * Manages customer appointment booking state and logic
 */

import { ref, computed, Ref } from 'vue';
import { apiCall } from '../../api-service';
import type { ApiResponse } from '../../api-service';

// Types
export interface Staff {
  id: string | number;
  name: string;
  phone: string;
  email?: string;
  active: boolean;
}

export interface TimeSlot {
  start: string;
  end: string;
  hour: number;
  time: string;
  isAvailable: boolean;
}

export interface AppointmentFormData {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  notes: string;
}

export interface AppointmentData extends AppointmentFormData {
  appointmentType: string;
  selectedDate: string;
  selectedTime: string;
  selectedStaff: string | number;
  staffName: string;
  shiftType: string;
}

export interface AppointmentResponse {
  success: boolean;
  appointmentId?: string | number;
  message?: string;
}

// Composable
export function useAppointment() {
  // State
  const appointmentType = ref<string>('');
  const selectedStaff = ref<Staff | null>(null);
  const selectedStaffId = ref<string | number>('');
  const selectedDate = ref<string | null>(null);
  const selectedTime = ref<string | null>(null);
  const shiftType = ref<string>('full');
  const staffMembers = ref<Staff[]>([]);
  const timeSlots = ref<TimeSlot[]>([]);
  const formData = ref<AppointmentFormData>({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    notes: ''
  });

  const loading = ref(false);
  const submitting = ref(false);
  const error = ref<string | null>(null);

  // Computed
  const canSelectDate = computed(() => {
    return !!(appointmentType.value && selectedStaffId.value && shiftType.value);
  });

  const canSelectTime = computed(() => {
    return !!(canSelectDate.value && selectedDate.value);
  });

  const canSubmit = computed(() => {
    return !!(
      appointmentType.value &&
      selectedStaffId.value &&
      selectedDate.value &&
      selectedTime.value &&
      formData.value.customerName.trim() &&
      formData.value.customerPhone.trim()
    );
  });

  const appointmentSummary = computed(() => {
    if (!canSubmit.value) return null;

    return {
      type: appointmentType.value,
      date: selectedDate.value,
      time: selectedTime.value,
      staff: selectedStaff.value?.name || '',
      customer: formData.value.customerName
    };
  });

  // Methods
  async function loadStaff(): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const result = await apiCall<{ data: Staff[] }>('getStaff');

      if (result.success && result.data) {
        staffMembers.value = Array.isArray(result.data) ? result.data : [];
      } else {
        throw new Error(result.error || 'Personel listesi yüklenemedi');
      }
    } catch (err) {
      console.error('Error loading staff:', err);
      error.value = err instanceof Error ? err.message : 'Personel listesi yüklenemedi';
      staffMembers.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function loadAvailableTimeSlots(): Promise<void> {
    if (!selectedDate.value || !appointmentType.value) {
      timeSlots.value = [];
      return;
    }

    loading.value = true;
    error.value = null;

    try {
      // Load both day status and slots in parallel
      const [dayStatusResult, slotsResult] = await Promise.all([
        apiCall<{
          isDeliveryMaxed: boolean;
          availableHours: number[];
          unavailableHours: number[];
        }>('getDayStatus', {
          date: selectedDate.value,
          appointmentType: appointmentType.value
        }),
        apiCall<{
          slots: Array<{
            start: string;
            end: string;
            hour: number;
            time: string;
          }>;
        }>('getDailySlots', {
          date: selectedDate.value,
          shiftType: shiftType.value
        })
      ]);

      if (
        dayStatusResult.success &&
        dayStatusResult.data &&
        slotsResult.success &&
        slotsResult.data
      ) {
        const availableHours = dayStatusResult.data.availableHours || [];

        timeSlots.value = slotsResult.data.slots.map(slot => ({
          ...slot,
          isAvailable: availableHours.includes(slot.hour)
        }));
      } else {
        throw new Error('Saat bilgileri yüklenemedi');
      }
    } catch (err) {
      console.error('Error loading time slots:', err);
      error.value = err instanceof Error ? err.message : 'Saat bilgileri yüklenemedi';
      timeSlots.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function createAppointment(): Promise<AppointmentResponse> {
    if (!canSubmit.value) {
      throw new Error('Lütfen tüm gerekli alanları doldurun');
    }

    submitting.value = true;
    error.value = null;

    try {
      const appointmentData: AppointmentData = {
        appointmentType: appointmentType.value,
        selectedDate: selectedDate.value!,
        selectedTime: selectedTime.value!,
        selectedStaff: selectedStaffId.value,
        staffName: selectedStaff.value?.name || '',
        shiftType: shiftType.value,
        ...formData.value
      };

      const result = await apiCall<AppointmentResponse>('createAppointment', appointmentData);

      if (result.success) {
        return {
          success: true,
          appointmentId: result.data?.appointmentId,
          message: result.data?.message || 'Randevu başarıyla oluşturuldu'
        };
      } else {
        throw new Error(result.error || 'Randevu oluşturulamadı');
      }
    } catch (err) {
      console.error('Error creating appointment:', err);
      error.value = err instanceof Error ? err.message : 'Randevu oluşturulamadı';
      throw err;
    } finally {
      submitting.value = false;
    }
  }

  function selectAppointmentType(type: string): void {
    appointmentType.value = type;
  }

  function selectStaff(staff: Staff): void {
    selectedStaff.value = staff;
    selectedStaffId.value = staff.id;
  }

  function selectShift(shift: string): void {
    shiftType.value = shift;
    // Reset time selection when shift changes
    selectedTime.value = null;
  }

  function selectDate(date: string): void {
    selectedDate.value = date;
    // Reset time selection when date changes
    selectedTime.value = null;
  }

  function selectTimeSlot(slot: TimeSlot): void {
    if (slot.isAvailable) {
      selectedTime.value = slot.time;
    }
  }

  function resetAppointment(): void {
    appointmentType.value = '';
    selectedStaff.value = null;
    selectedStaffId.value = '';
    selectedDate.value = null;
    selectedTime.value = null;
    shiftType.value = 'full';
    timeSlots.value = [];
    formData.value = {
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      notes: ''
    };
    error.value = null;
  }

  return {
    // State
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

    // Computed
    canSelectDate,
    canSelectTime,
    canSubmit,
    appointmentSummary,

    // Methods
    loadStaff,
    loadAvailableTimeSlots,
    createAppointment,
    selectAppointmentType,
    selectStaff,
    selectShift,
    selectDate,
    selectTimeSlot,
    resetAppointment
  };
}
