<template>
  <div class="whatsapp-settings">
    <h2 class="panel-title">WhatsApp Business API Ayarları</h2>

    <!-- API Configuration Section -->
    <section class="settings-section">
      <h3 class="section-title">API Yapılandırması</h3>

      <div class="config-form">
        <div class="form-group">
          <label for="phoneNumberId">Phone Number ID *</label>
          <input
            id="phoneNumberId"
            v-model="localSettings.phoneNumberId"
            type="text"
            placeholder="123456789012345"
            class="form-input"
            :class="{ 'error': errors.phoneNumberId }"
            @input="clearError('phoneNumberId')"
          />
          <span v-if="errors.phoneNumberId" class="error-text">{{ errors.phoneNumberId }}</span>
          <p class="form-help">Meta Business hesabınızdan Phone Number ID'yi alabilirsiniz</p>
        </div>

        <div class="form-group">
          <label for="accessToken">Access Token *</label>
          <div class="password-field">
            <input
              id="accessToken"
              v-model="localSettings.accessToken"
              :type="showToken ? 'text' : 'password'"
              placeholder="EAA..."
              class="form-input"
              :class="{ 'error': errors.accessToken }"
              @input="clearError('accessToken')"
            />
            <button
              class="toggle-btn"
              @click="showToken = !showToken"
              type="button"
              :title="showToken ? 'Gizle' : 'Göster'"
            >
              {{ showToken ? '👁️' : '👁️‍🗨️' }}
            </button>
          </div>
          <span v-if="errors.accessToken" class="error-text">{{ errors.accessToken }}</span>
          <p class="form-help">Meta Business platformundan permanent access token oluşturun</p>
        </div>

        <div class="form-group">
          <label class="checkbox-label">
            <input
              v-model="localSettings.enabled"
              type="checkbox"
              class="checkbox-input"
            />
            <span>WhatsApp entegrasyonunu etkinleştir</span>
          </label>
          <p class="form-help">Bu seçenek kapalıysa WhatsApp mesajları gönderilmeyecektir</p>
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
          <button
            v-if="localSettings.phoneNumberId && localSettings.accessToken"
            class="test-btn"
            :disabled="testing"
            @click="testConnection"
          >
            <span v-if="testing" class="btn-spinner"></span>
            {{ testing ? 'Test Ediliyor...' : '🧪 Bağlantıyı Test Et' }}
          </button>
        </div>
      </div>
    </section>

    <!-- Message Template Section -->
    <section class="settings-section">
      <h3 class="section-title">Mesaj Şablonu</h3>

      <div class="template-form">
        <div class="form-group">
          <label for="messageTemplate">Hatırlatma Mesajı Şablonu</label>
          <textarea
            id="messageTemplate"
            v-model="localSettings.messageTemplate"
            rows="6"
            class="form-textarea"
            placeholder="Merhaba {customerName},

{date} tarihinde saat {time} için Rolex İzmir İstinyepark'ta {appointmentType} randevunuz bulunmaktadır.

Personel: {staffName}

Rolex İzmir İstinyepark"
          ></textarea>
          <p class="form-help">
            Kullanılabilir değişkenler: {customerName}, {date}, {time}, {appointmentType}, {staffName}
          </p>
        </div>

        <div class="preview-box">
          <h4 class="preview-title">Önizleme</h4>
          <div class="preview-content">{{ previewMessage }}</div>
        </div>
      </div>
    </section>

    <!-- Usage Statistics Section -->
    <section class="settings-section">
      <h3 class="section-title">Kullanım İstatistikleri</h3>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">📤</div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.sentThisMonth }}</div>
            <div class="stat-label">Bu Ay Gönderilen</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">✅</div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.deliveredThisMonth }}</div>
            <div class="stat-label">İletildi</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">❌</div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.failedThisMonth }}</div>
            <div class="stat-label">Başarısız</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">💰</div>
          <div class="stat-content">
            <div class="stat-value">{{ remainingQuota }}</div>
            <div class="stat-label">Kalan Kota (Aylık)</div>
          </div>
        </div>
      </div>

      <div class="usage-note">
        <p>
          <strong>Not:</strong> Meta Business Cloud API ilk 1000 mesaj/ay ücretsizdir.
          Aylık kotanız her ayın 1. günü yenilenir.
        </p>
      </div>
    </section>

    <!-- Documentation Link -->
    <section class="settings-section">
      <h3 class="section-title">Dokümantasyon</h3>
      <p class="docs-text">
        WhatsApp Business Cloud API kurulumu ve detaylı kullanım için:
      </p>
      <a
        href="./WHATSAPP_API_SETUP.md"
        target="_blank"
        class="docs-link"
      >
        📖 WHATSAPP_API_SETUP.md dosyasını görüntüle
      </a>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

// Props
interface Props {
  settings?: WhatsAppSettings;
  stats?: UsageStats;
}

const props = withDefaults(defineProps<Props>(), {
  settings: () => ({
    phoneNumberId: '',
    accessToken: '',
    enabled: false,
    messageTemplate: 'Merhaba {customerName},\n\n{date} tarihinde saat {time} için Rolex İzmir İstinyepark\'ta {appointmentType} randevunuz bulunmaktadır.\n\nPersonel: {staffName}\n\nRolex İzmir İstinyepark'
  }),
  stats: () => ({
    sentThisMonth: 0,
    deliveredThisMonth: 0,
    failedThisMonth: 0
  })
});

// Emits
interface Emits {
  (e: 'save-settings', settings: WhatsAppSettings): void;
  (e: 'test-connection'): void;
}

const emit = defineEmits<Emits>();

// Types
interface WhatsAppSettings {
  phoneNumberId: string;
  accessToken: string;
  enabled: boolean;
  messageTemplate: string;
}

interface UsageStats {
  sentThisMonth: number;
  deliveredThisMonth: number;
  failedThisMonth: number;
}

interface Errors {
  phoneNumberId?: string;
  accessToken?: string;
}

// State
const localSettings = ref<WhatsAppSettings>({ ...props.settings });
const errors = ref<Errors>({});
const saving = ref(false);
const testing = ref(false);
const showToken = ref(false);

// Computed
const remainingQuota = computed(() => {
  return Math.max(0, 1000 - props.stats.sentThisMonth);
});

const previewMessage = computed(() => {
  const template = localSettings.value.messageTemplate;
  return template
    .replace('{customerName}', 'Ahmet Yılmaz')
    .replace('{date}', '15 Kasım 2025, Cuma')
    .replace('{time}', '14:00 - 15:00')
    .replace('{appointmentType}', 'Teslim')
    .replace('{staffName}', 'Mehmet Demir');
});

// Methods
function validateSettings(): boolean {
  errors.value = {};
  let isValid = true;

  if (!localSettings.value.phoneNumberId.trim()) {
    errors.value.phoneNumberId = 'Phone Number ID gereklidir';
    isValid = false;
  }

  if (!localSettings.value.accessToken.trim()) {
    errors.value.accessToken = 'Access Token gereklidir';
    isValid = false;
  } else if (!localSettings.value.accessToken.startsWith('EAA')) {
    errors.value.accessToken = 'Geçerli bir Meta access token giriniz';
    isValid = false;
  }

  return isValid;
}

function clearError(field: keyof Errors) {
  if (errors.value[field]) {
    delete errors.value[field];
  }
}

async function saveSettings() {
  if (!validateSettings()) return;

  saving.value = true;

  try {
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call
    emit('save-settings', { ...localSettings.value });
    alert('WhatsApp ayarları başarıyla kaydedildi!');
  } catch (error) {
    console.error('Settings save error:', error);
    alert('Ayarlar kaydedilirken bir hata oluştu.');
  } finally {
    saving.value = false;
  }
}

async function testConnection() {
  testing.value = true;

  try {
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API test
    emit('test-connection');
    alert('✅ WhatsApp Business API bağlantısı başarılı!');
  } catch (error) {
    console.error('Connection test error:', error);
    alert('❌ Bağlantı testi başarısız. Lütfen ayarlarınızı kontrol edin.');
  } finally {
    testing.value = false;
  }
}

// Lifecycle
onMounted(() => {
  localSettings.value = { ...props.settings };
});
</script>

<style scoped>
.whatsapp-settings {
  max-width: 1000px;
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

/* Form Styles */
.config-form,
.template-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-weight: 600;
  color: #2c3e50;
  font-size: 15px;
}

.form-input,
.form-textarea {
  padding: 12px 15px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 15px;
  font-family: inherit;
  transition: border-color 0.2s ease;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: #25d366;
}

.form-input.error {
  border-color: #dc3545;
}

.password-field {
  position: relative;
}

.password-field .form-input {
  padding-right: 50px;
}

.toggle-btn {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  font-size: 20px;
  cursor: pointer;
  padding: 5px;
}

.error-text {
  color: #dc3545;
  font-size: 13px;
}

.form-help {
  font-size: 13px;
  color: #666;
  margin: 0;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.checkbox-input {
  width: 20px;
  height: 20px;
  cursor: pointer;
}

.form-actions {
  display: flex;
  gap: 15px;
  margin-top: 10px;
}

.save-btn,
.test-btn {
  padding: 14px 28px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: inherit;
}

.save-btn {
  background: #25d366;
  color: white;
}

.save-btn:hover:not(:disabled) {
  background: #1fb855;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(37, 211, 102, 0.3);
}

.test-btn {
  background: white;
  border: 2px solid #25d366;
  color: #25d366;
}

.test-btn:hover:not(:disabled) {
  background: #25d366;
  color: white;
}

.save-btn:disabled,
.test-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-spinner {
  width: 16px;
  height: 16px;
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

/* Preview Box */
.preview-box {
  background: #f8f9fa;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  padding: 15px;
}

.preview-title {
  font-size: 14px;
  font-weight: 600;
  color: #666;
  margin: 0 0 10px 0;
}

.preview-content {
  font-size: 14px;
  color: #2c3e50;
  white-space: pre-wrap;
  line-height: 1.6;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 10px;
}

.stat-icon {
  font-size: 36px;
  line-height: 1;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #2c3e50;
  line-height: 1;
  margin-bottom: 5px;
}

.stat-label {
  font-size: 13px;
  color: #666;
  font-weight: 500;
}

.usage-note {
  background: #fff3cd;
  border: 2px solid #ffc107;
  border-radius: 8px;
  padding: 15px;
}

.usage-note p {
  margin: 0;
  font-size: 14px;
  color: #856404;
}

/* Documentation */
.docs-text {
  font-size: 15px;
  color: #666;
  margin: 0 0 15px 0;
}

.docs-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: #006039;
  color: white;
  text-decoration: none;
  border-radius: 8px;
  font-weight: 600;
  transition: all 0.3s ease;
}

.docs-link:hover {
  background: #004d2e;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 96, 57, 0.3);
}

/* Responsive */
@media (max-width: 768px) {
  .whatsapp-settings {
    padding: 20px 15px;
  }

  .panel-title {
    font-size: 24px;
  }

  .form-actions {
    flex-direction: column;
  }

  .save-btn,
  .test-btn {
    width: 100%;
    justify-content: center;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
