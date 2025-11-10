/**
 * useAdmin Composable
 * Manages admin panel state and operations
 */

import { ref, computed } from 'vue';
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

export interface Appointment {
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
  createdAt?: string;
}

export interface ShiftAssignment {
  morning: string | number;
  evening: string | number;
  full: string | number;
}

export interface WeekShifts {
  [date: string]: ShiftAssignment;
}

export interface Settings {
  maxDeliveryPerDay: number;
  appointmentDuration: number;
  workingHours: {
    start: string;
    end: string;
  };
  allowWeekendAppointments: boolean;
}

export interface WhatsAppSettings {
  phoneNumberId: string;
  accessToken: string;
  enabled: boolean;
  messageTemplate: string;
}

export interface SlackSettings {
  webhookUrl: string;
  channel: string;
  enabled: boolean;
  notifyOnNewAppointment: boolean;
  notifyOnCancellation: boolean;
  notifyOnReminder: boolean;
}

// Composable
export function useAdmin(apiKey: string) {
  // State
  const activeTab = ref<string>('settings');
  const staffList = ref<Staff[]>([]);
  const appointments = ref<Appointment[]>([]);
  const weekShifts = ref<WeekShifts>({});
  const settings = ref<Settings>({
    maxDeliveryPerDay: 5,
    appointmentDuration: 60,
    workingHours: { start: '09:00', end: '19:00' },
    allowWeekendAppointments: false
  });
  const whatsappSettings = ref<WhatsAppSettings>({
    phoneNumberId: '',
    accessToken: '',
    enabled: false,
    messageTemplate: ''
  });
  const slackSettings = ref<SlackSettings>({
    webhookUrl: '',
    channel: '',
    enabled: false,
    notifyOnNewAppointment: true,
    notifyOnCancellation: true,
    notifyOnReminder: false
  });

  const loading = ref(false);
  const error = ref<string | null>(null);

  // Computed
  const activeStaff = computed(() => {
    return staffList.value.filter(staff => staff.active);
  });

  const appointmentCount = computed(() => {
    return appointments.value.length;
  });

  const upcomingAppointments = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return appointments.value
      .filter(apt => {
        const aptDate = new Date(apt.date + 'T00:00:00');
        return aptDate >= today;
      })
      .sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.time.localeCompare(b.time);
      });
  });

  // Methods
  async function loadStaff(): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const result = await apiCall<{ data: Staff[] }>('getStaff', {}, apiKey);

      if (result.success && result.data) {
        staffList.value = Array.isArray(result.data) ? result.data : [];
      } else {
        throw new Error(result.error || 'Personel listesi yüklenemedi');
      }
    } catch (err) {
      console.error('Error loading staff:', err);
      error.value = err instanceof Error ? err.message : 'Personel listesi yüklenemedi';
    } finally {
      loading.value = false;
    }
  }

  async function addStaff(staffData: Omit<Staff, 'id'>): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const result = await apiCall('addStaff', staffData, apiKey);

      if (result.success) {
        await loadStaff(); // Refresh list
      } else {
        throw new Error(result.error || 'Personel eklenemedi');
      }
    } catch (err) {
      console.error('Error adding staff:', err);
      error.value = err instanceof Error ? err.message : 'Personel eklenemedi';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function editStaff(id: string | number, staffData: Omit<Staff, 'id'>): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const result = await apiCall('updateStaff', { id, ...staffData }, apiKey);

      if (result.success) {
        await loadStaff(); // Refresh list
      } else {
        throw new Error(result.error || 'Personel güncellenemedi');
      }
    } catch (err) {
      console.error('Error editing staff:', err);
      error.value = err instanceof Error ? err.message : 'Personel güncellenemedi';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function toggleStaff(id: string | number, active: boolean): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const result = await apiCall('toggleStaff', { id, active }, apiKey);

      if (result.success) {
        await loadStaff(); // Refresh list
      } else {
        throw new Error(result.error || 'Personel durumu değiştirilemedi');
      }
    } catch (err) {
      console.error('Error toggling staff:', err);
      error.value = err instanceof Error ? err.message : 'Personel durumu değiştirilemedi';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function deleteStaff(id: string | number): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const result = await apiCall('deleteStaff', { id }, apiKey);

      if (result.success) {
        await loadStaff(); // Refresh list
      } else {
        throw new Error(result.error || 'Personel silinemedi');
      }
    } catch (err) {
      console.error('Error deleting staff:', err);
      error.value = err instanceof Error ? err.message : 'Personel silinemedi';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function loadAppointments(): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const result = await apiCall<{ data: Appointment[] }>('getAppointments', {}, apiKey);

      if (result.success && result.data) {
        appointments.value = Array.isArray(result.data) ? result.data : [];
      } else {
        throw new Error(result.error || 'Randevular yüklenemedi');
      }
    } catch (err) {
      console.error('Error loading appointments:', err);
      error.value = err instanceof Error ? err.message : 'Randevular yüklenemedi';
    } finally {
      loading.value = false;
    }
  }

  async function deleteAppointment(id: string | number): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const result = await apiCall('deleteAppointment', { id }, apiKey);

      if (result.success) {
        await loadAppointments(); // Refresh list
      } else {
        throw new Error(result.error || 'Randevu silinemedi');
      }
    } catch (err) {
      console.error('Error deleting appointment:', err);
      error.value = err instanceof Error ? err.message : 'Randevu silinemedi';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function loadShifts(weekStartDate: Date): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const result = await apiCall<{ data: WeekShifts }>('getWeekShifts', { weekStartDate }, apiKey);

      if (result.success && result.data) {
        weekShifts.value = result.data;
      } else {
        throw new Error(result.error || 'Vardiyalar yüklenemedi');
      }
    } catch (err) {
      console.error('Error loading shifts:', err);
      error.value = err instanceof Error ? err.message : 'Vardiyalar yüklenemedi';
    } finally {
      loading.value = false;
    }
  }

  async function saveShifts(shifts: WeekShifts): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const result = await apiCall('saveWeekShifts', { shifts }, apiKey);

      if (result.success) {
        weekShifts.value = shifts;
      } else {
        throw new Error(result.error || 'Vardiyalar kaydedilemedi');
      }
    } catch (err) {
      console.error('Error saving shifts:', err);
      error.value = err instanceof Error ? err.message : 'Vardiyalar kaydedilemedi';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function saveSettings(newSettings: Settings): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const result = await apiCall('updateSettings', newSettings, apiKey);

      if (result.success) {
        settings.value = newSettings;
      } else {
        throw new Error(result.error || 'Ayarlar kaydedilemedi');
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      error.value = err instanceof Error ? err.message : 'Ayarlar kaydedilemedi';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function saveWhatsAppSettings(newSettings: WhatsAppSettings): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const result = await apiCall('updateWhatsAppSettings', newSettings, apiKey);

      if (result.success) {
        whatsappSettings.value = newSettings;
      } else {
        throw new Error(result.error || 'WhatsApp ayarları kaydedilemedi');
      }
    } catch (err) {
      console.error('Error saving WhatsApp settings:', err);
      error.value = err instanceof Error ? err.message : 'WhatsApp ayarları kaydedilemedi';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function saveSlackSettings(newSettings: SlackSettings): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const result = await apiCall('updateSlackSettings', newSettings, apiKey);

      if (result.success) {
        slackSettings.value = newSettings;
      } else {
        throw new Error(result.error || 'Slack ayarları kaydedilemedi');
      }
    } catch (err) {
      console.error('Error saving Slack settings:', err);
      error.value = err instanceof Error ? err.message : 'Slack ayarları kaydedilemedi';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function sendWhatsAppReminder(appointment: Appointment): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const result = await apiCall('sendWhatsAppReminder', { appointmentId: appointment.id }, apiKey);

      if (!result.success) {
        throw new Error(result.error || 'WhatsApp hatırlatması gönderilemedi');
      }
    } catch (err) {
      console.error('Error sending WhatsApp reminder:', err);
      error.value = err instanceof Error ? err.message : 'WhatsApp hatırlatması gönderilemedi';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  function setActiveTab(tab: string): void {
    activeTab.value = tab;
  }

  function clearError(): void {
    error.value = null;
  }

  return {
    // State
    activeTab,
    staffList,
    appointments,
    weekShifts,
    settings,
    whatsappSettings,
    slackSettings,
    loading,
    error,

    // Computed
    activeStaff,
    appointmentCount,
    upcomingAppointments,

    // Methods
    loadStaff,
    addStaff,
    editStaff,
    toggleStaff,
    deleteStaff,
    loadAppointments,
    deleteAppointment,
    loadShifts,
    saveShifts,
    saveSettings,
    saveWhatsAppSettings,
    saveSlackSettings,
    sendWhatsAppReminder,
    setActiveTab,
    clearError
  };
}
