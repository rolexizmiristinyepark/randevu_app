<template>
  <div class="admin-view">
    <!-- Admin Header -->
    <AdminHeader @logout="handleLogout" />

    <!-- Tab Navigation -->
    <TabNavigation
      v-model:active-tab="activeTab"
      :appointment-count="appointmentCount"
      @change-tab="handleTabChange"
    />

    <!-- Main Content -->
    <main class="admin-main">
      <!-- Error Alert -->
      <BaseAlert
        v-if="error"
        type="error"
        title="Hata"
        :message="error"
        :show="!!error"
        @close="clearError"
      />

      <!-- Settings Panel -->
      <SettingsPanel
        v-if="activeTab === 'settings'"
        :settings="settings"
        :last-update="lastUpdate"
        :active-appointments="appointmentCount"
        @save-settings="handleSaveSettings"
        @open-link="handleOpenLink"
        @copy-link="handleCopyLink"
      />

      <!-- Staff Manager -->
      <StaffManager
        v-if="activeTab === 'staff'"
        :staff-list="staffList"
        :loading="loading"
        @add-staff="handleAddStaff"
        @edit-staff="handleEditStaff"
        @delete-staff="handleDeleteStaff"
        @toggle-staff="handleToggleStaff"
      />

      <!-- Shift Planner -->
      <ShiftPlanner
        v-if="activeTab === 'shifts'"
        :week-date="currentWeekDate"
        :available-staff="activeStaff"
        :initial-shifts="weekShifts"
        :loading="loading"
        @save-shifts="handleSaveShifts"
        @change-week="handleChangeWeek"
      />

      <!-- Appointments List -->
      <AppointmentList
        v-if="activeTab === 'appointments'"
        :appointments="appointments"
        :loading="loading"
        @delete-appointment="handleDeleteAppointment"
        @edit-appointment="handleEditAppointment"
        @send-whatsapp="handleSendWhatsApp"
      />

      <!-- WhatsApp Settings -->
      <WhatsAppSettings
        v-if="activeTab === 'whatsapp'"
        :settings="whatsappSettings"
        :stats="whatsappStats"
        @save-settings="handleSaveWhatsAppSettings"
        @test-connection="handleTestWhatsApp"
      />

      <!-- Slack Settings -->
      <SlackSettings
        v-if="activeTab === 'slack'"
        :settings="slackSettings"
        :stats="slackStats"
        @save-settings="handleSaveSlackSettings"
        @test-webhook="handleTestSlack"
      />
    </main>

    <!-- Loading Overlay -->
    <LoadingSpinner
      v-if="loading"
      overlay
      message="Yükleniyor..."
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAdmin } from '../composables/useAdmin';
import type {
  Staff,
  Appointment,
  WeekShifts,
  Settings,
  WhatsAppSettings as WhatsAppSettingsType,
  SlackSettings as SlackSettingsType
} from '../composables/useAdmin';

// Components
import AdminHeader from '../components/admin/AdminHeader.vue';
import TabNavigation from '../components/admin/TabNavigation.vue';
import SettingsPanel from '../components/admin/SettingsPanel.vue';
import StaffManager from '../components/admin/StaffManager.vue';
import ShiftPlanner from '../components/admin/ShiftPlanner.vue';
import AppointmentList from '../components/admin/AppointmentList.vue';
import WhatsAppSettings from '../components/admin/WhatsAppSettings.vue';
import SlackSettings from '../components/admin/SlackSettings.vue';
import BaseAlert from '../components/shared/BaseAlert.vue';
import LoadingSpinner from '../components/shared/LoadingSpinner.vue';

// Get API key from localStorage
const apiKey = localStorage.getItem('adminApiKey') || '';

// Composable
const {
  activeTab,
  staffList,
  appointments,
  weekShifts,
  settings,
  whatsappSettings,
  slackSettings,
  loading,
  error,
  activeStaff,
  appointmentCount,
  upcomingAppointments,
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
} = useAdmin(apiKey);

// Local State
const currentWeekDate = ref(new Date());
const lastUpdate = ref(new Date().toLocaleDateString('tr-TR'));

// Mock stats (would come from backend in production)
const whatsappStats = ref({
  sentThisMonth: 42,
  deliveredThisMonth: 40,
  failedThisMonth: 2
});

const slackStats = ref({
  sentThisMonth: 38,
  successThisMonth: 37,
  failedThisMonth: 1
});

// Methods
function handleLogout() {
  // Clear auth and redirect
  localStorage.removeItem('adminApiKey');
  window.location.href = 'admin.html';
}

function handleTabChange(tabId: string) {
  setActiveTab(tabId);

  // Load data for the selected tab
  loadTabData(tabId);
}

async function loadTabData(tabId: string) {
  switch (tabId) {
    case 'staff':
      await loadStaff();
      break;
    case 'shifts':
      await loadShifts(currentWeekDate.value);
      break;
    case 'appointments':
      await loadAppointments();
      break;
    default:
      break;
  }
}

// Settings handlers
async function handleSaveSettings(newSettings: Settings) {
  try {
    await saveSettings(newSettings);
  } catch (err) {
    console.error('Save settings error:', err);
  }
}

function handleOpenLink(type: 'customer' | 'admin') {
  console.log(`Opening ${type} link`);
}

function handleCopyLink(type: 'customer' | 'admin') {
  console.log(`Copying ${type} link`);
}

// Staff handlers
async function handleAddStaff(staffData: Omit<Staff, 'id'>) {
  try {
    await addStaff(staffData);
    alert('Personel başarıyla eklendi!');
  } catch (err) {
    console.error('Add staff error:', err);
  }
}

async function handleEditStaff(id: string | number, staffData: Omit<Staff, 'id'>) {
  try {
    await editStaff(id, staffData);
    alert('Personel başarıyla güncellendi!');
  } catch (err) {
    console.error('Edit staff error:', err);
  }
}

async function handleToggleStaff(id: string | number, active: boolean) {
  try {
    await toggleStaff(id, active);
  } catch (err) {
    console.error('Toggle staff error:', err);
  }
}

async function handleDeleteStaff(id: string | number) {
  try {
    await deleteStaff(id);
    alert('Personel başarıyla silindi!');
  } catch (err) {
    console.error('Delete staff error:', err);
  }
}

// Shift handlers
async function handleSaveShifts(shifts: WeekShifts) {
  try {
    await saveShifts(shifts);
  } catch (err) {
    console.error('Save shifts error:', err);
  }
}

function handleChangeWeek(date: Date) {
  currentWeekDate.value = date;
  loadShifts(date);
}

// Appointment handlers
async function handleDeleteAppointment(id: string | number) {
  try {
    await deleteAppointment(id);
    alert('Randevu başarıyla silindi!');
  } catch (err) {
    console.error('Delete appointment error:', err);
  }
}

function handleEditAppointment(appointment: Appointment) {
  console.log('Edit appointment:', appointment);
  // Would open edit modal in production
}

async function handleSendWhatsApp(appointment: Appointment) {
  try {
    await sendWhatsAppReminder(appointment);
    alert('WhatsApp hatırlatması gönderildi!');
  } catch (err) {
    console.error('Send WhatsApp error:', err);
  }
}

// WhatsApp handlers
async function handleSaveWhatsAppSettings(newSettings: WhatsAppSettingsType) {
  try {
    await saveWhatsAppSettings(newSettings);
  } catch (err) {
    console.error('Save WhatsApp settings error:', err);
  }
}

function handleTestWhatsApp() {
  console.log('Testing WhatsApp connection');
}

// Slack handlers
async function handleSaveSlackSettings(newSettings: SlackSettingsType) {
  try {
    await saveSlackSettings(newSettings);
  } catch (err) {
    console.error('Save Slack settings error:', err);
  }
}

function handleTestSlack() {
  console.log('Testing Slack webhook');
}

// Lifecycle
onMounted(async () => {
  // Check authentication
  if (!apiKey) {
    window.location.href = 'admin.html';
    return;
  }

  // Load initial data
  await loadStaff();
  await loadAppointments();
});
</script>

<style scoped>
.admin-view {
  min-height: 100vh;
  background: #f5f7fa;
}

.admin-main {
  min-height: calc(100vh - 160px);
  padding-top: 20px;
}

@media (max-width: 768px) {
  .admin-main {
    min-height: calc(100vh - 140px);
    padding-top: 15px;
  }
}
</style>
