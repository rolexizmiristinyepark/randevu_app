<template>
  <div class="settings-panel">
    <h2 class="panel-title">Sistem Ayarları</h2>

    <!-- Quick Links Section -->
    <section class="settings-section">
      <h3 class="section-title">Hızlı Linkler</h3>
      <div class="link-grid">
        <div class="link-card">
          <div class="link-icon">🌐</div>
          <div class="link-content">
            <h4 class="link-title">Müşteri Sayfası</h4>
            <p class="link-description">Randevu oluşturma sayfası</p>
            <div class="link-actions">
              <button class="link-btn link-btn--primary" @click="openCustomerPage">
                Sayfaya Git
              </button>
              <button class="link-btn link-btn--secondary" @click="copyCustomerLink">
                Linki Kopyala
              </button>
            </div>
          </div>
        </div>

        <div class="link-card">
          <div class="link-icon">🔐</div>
          <div class="link-content">
            <h4 class="link-title">Admin Paneli</h4>
            <p class="link-description">Yönetim paneli</p>
            <div class="link-actions">
              <button class="link-btn link-btn--primary" @click="openAdminPage">
                Sayfaya Git
              </button>
              <button class="link-btn link-btn--secondary" @click="copyAdminLink">
                Linki Kopyala
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Appointment Settings Section -->
    <section class="settings-section">
      <h3 class="section-title">Randevu Ayarları</h3>
      <div class="settings-form">
        <div class="form-row">
          <label class="form-label">Maksimum Teslim Randevusu (Günlük)</label>
          <input
            v-model.number="localSettings.maxDeliveryPerDay"
            type="number"
            min="1"
            max="20"
            class="form-input"
          />
          <p class="form-help">Her gün için maksimum teslim randevusu sayısı</p>
        </div>

        <div class="form-row">
          <label class="form-label">Randevu Süresi (Dakika)</label>
          <input
            v-model.number="localSettings.appointmentDuration"
            type="number"
            min="30"
            max="120"
            step="15"
            class="form-input"
          />
          <p class="form-help">Her randevunun süresi</p>
        </div>

        <div class="form-row">
          <label class="form-label">Çalışma Saatleri</label>
          <div class="time-range">
            <input
              v-model="localSettings.workingHours.start"
              type="time"
              class="form-input form-input--time"
            />
            <span class="time-separator">-</span>
            <input
              v-model="localSettings.workingHours.end"
              type="time"
              class="form-input form-input--time"
            />
          </div>
          <p class="form-help">İş günü çalışma saatleri</p>
        </div>

        <div class="form-row">
          <label class="form-label form-label--checkbox">
            <input
              v-model="localSettings.allowWeekendAppointments"
              type="checkbox"
              class="form-checkbox"
            />
            <span>Hafta sonu randevuları</span>
          </label>
          <p class="form-help">Cumartesi ve Pazar günleri için randevu alınabilir</p>
        </div>

        <div class="form-actions">
          <button
            class="save-btn"
            :disabled="saving"
            @click="saveSettings"
          >
            <span v-if="saving" class="btn-spinner"></span>
            {{ saving ? 'Kaydediliyor...' : 'Ayarları Kaydet' }}
          </button>
        </div>
      </div>
    </section>

    <!-- System Info Section -->
    <section class="settings-section">
      <h3 class="section-title">Sistem Bilgisi</h3>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">Versiyon:</span>
          <span class="info-value">v3.0.0 (Vue 3)</span>
        </div>
        <div class="info-item">
          <span class="info-label">Son Güncelleme:</span>
          <span class="info-value">{{ lastUpdate }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Aktif Randevular:</span>
          <span class="info-value">{{ activeAppointments }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

// Props
interface Props {
  settings?: Settings;
  lastUpdate?: string;
  activeAppointments?: number;
}

const props = withDefaults(defineProps<Props>(), {
  settings: () => ({
    maxDeliveryPerDay: 5,
    appointmentDuration: 60,
    workingHours: { start: '09:00', end: '19:00' },
    allowWeekendAppointments: false
  }),
  lastUpdate: new Date().toLocaleDateString('tr-TR'),
  activeAppointments: 0
});

// Emits
interface Emits {
  (e: 'save-settings', settings: Settings): void;
  (e: 'open-link', type: 'customer' | 'admin'): void;
  (e: 'copy-link', type: 'customer' | 'admin'): void;
}

const emit = defineEmits<Emits>();

// Types
interface Settings {
  maxDeliveryPerDay: number;
  appointmentDuration: number;
  workingHours: {
    start: string;
    end: string;
  };
  allowWeekendAppointments: boolean;
}

// State
const localSettings = ref<Settings>({ ...props.settings });
const saving = ref(false);

// Methods
function openCustomerPage() {
  emit('open-link', 'customer');
  window.open(window.location.origin + window.location.pathname.replace('admin.html', 'index.html'), '_blank');
}

function openAdminPage() {
  emit('open-link', 'admin');
  window.open(window.location.origin + window.location.pathname, '_blank');
}

async function copyCustomerLink() {
  const link = window.location.origin + window.location.pathname.replace('admin.html', 'index.html');
  try {
    await navigator.clipboard.writeText(link);
    alert('Müşteri sayfası linki kopyalandı!');
    emit('copy-link', 'customer');
  } catch (error) {
    console.error('Link kopyalama hatası:', error);
    alert('Link kopyalanamadı. Lütfen manuel olarak kopyalayın:\n' + link);
  }
}

async function copyAdminLink() {
  const link = window.location.origin + window.location.pathname;
  try {
    await navigator.clipboard.writeText(link);
    alert('Admin paneli linki kopyalandı!');
    emit('copy-link', 'admin');
  } catch (error) {
    console.error('Link kopyalama hatası:', error);
    alert('Link kopyalanamadı. Lütfen manuel olarak kopyalayın:\n' + link);
  }
}

async function saveSettings() {
  saving.value = true;
  try {
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call
    emit('save-settings', { ...localSettings.value });
    alert('Ayarlar başarıyla kaydedildi!');
  } catch (error) {
    console.error('Ayarlar kaydedilemedi:', error);
    alert('Ayarlar kaydedilirken bir hata oluştu.');
  } finally {
    saving.value = false;
  }
}

// Lifecycle
onMounted(() => {
  localSettings.value = { ...props.settings };
});
</script>

<style scoped>
.settings-panel {
  max-width: 1200px;
  margin: 0 auto;
  padding: 30px;
}

.panel-title {
  font-size: 28px;
  font-weight: 700;
  color: #2c3e50;
  margin: 0 0 30px 0;
}

.settings-section {
  background: white;
  border-radius: 12px;
  padding: 25px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  margin-bottom: 25px;
}

.section-title {
  font-size: 20px;
  font-weight: 600;
  color: #2c3e50;
  margin: 0 0 20px 0;
  padding-bottom: 10px;
  border-bottom: 2px solid #e0e0e0;
}

/* Link Grid */
.link-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.link-card {
  display: flex;
  gap: 15px;
  padding: 20px;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  background: #fafafa;
}

.link-icon {
  font-size: 40px;
  line-height: 1;
}

.link-content {
  flex: 1;
}

.link-title {
  font-size: 18px;
  font-weight: 600;
  color: #2c3e50;
  margin: 0 0 5px 0;
}

.link-description {
  font-size: 14px;
  color: #666;
  margin: 0 0 15px 0;
}

.link-actions {
  display: flex;
  gap: 10px;
}

.link-btn {
  padding: 8px 16px;
  border: 2px solid;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;
}

.link-btn--primary {
  background: #006039;
  border-color: #006039;
  color: white;
}

.link-btn--primary:hover {
  background: #004d2e;
  border-color: #004d2e;
}

.link-btn--secondary {
  background: white;
  border-color: #006039;
  color: #006039;
}

.link-btn--secondary:hover {
  background: #f0f9f6;
}

/* Settings Form */
.settings-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 15px;
  font-weight: 600;
  color: #2c3e50;
}

.form-label--checkbox {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.form-input {
  padding: 12px 15px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 15px;
  font-family: inherit;
  transition: border-color 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: #006039;
}

.form-input--time {
  max-width: 150px;
}

.time-range {
  display: flex;
  align-items: center;
  gap: 10px;
}

.time-separator {
  font-size: 18px;
  font-weight: 600;
  color: #666;
}

.form-checkbox {
  width: 20px;
  height: 20px;
  cursor: pointer;
}

.form-help {
  font-size: 13px;
  color: #666;
  margin: 0;
}

.form-actions {
  margin-top: 10px;
}

.save-btn {
  padding: 14px 32px;
  border: none;
  border-radius: 8px;
  background: #006039;
  color: white;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: inherit;
}

.save-btn:hover:not(:disabled) {
  background: #004d2e;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 96, 57, 0.3);
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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

/* Info Grid */
.info-grid {
  display: grid;
  gap: 15px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid #e0e0e0;
}

.info-item:last-child {
  border-bottom: none;
}

.info-label {
  font-weight: 600;
  color: #666;
}

.info-value {
  font-weight: 600;
  color: #2c3e50;
}

/* Responsive */
@media (max-width: 768px) {
  .settings-panel {
    padding: 20px 15px;
  }

  .panel-title {
    font-size: 24px;
  }

  .link-grid {
    grid-template-columns: 1fr;
  }

  .link-card {
    flex-direction: column;
    text-align: center;
  }

  .link-actions {
    flex-direction: column;
  }

  .link-btn {
    width: 100%;
  }

  .time-range {
    flex-direction: column;
    align-items: flex-start;
  }

  .form-input--time {
    max-width: 100%;
    width: 100%;
  }
}
</style>
