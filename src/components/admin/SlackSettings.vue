<template>
  <div class="slack-settings">
    <h2 class="panel-title">Slack Entegrasyonu</h2>

    <!-- Webhook Configuration Section -->
    <section class="settings-section">
      <h3 class="section-title">Webhook Yapılandırması</h3>

      <div class="config-form">
        <div class="form-group">
          <label for="webhookUrl">Slack Webhook URL *</label>
          <div class="password-field">
            <input
              id="webhookUrl"
              v-model="localSettings.webhookUrl"
              :type="showWebhook ? 'text' : 'password'"
              placeholder="https://hooks.slack.com/services/..."
              class="form-input"
              :class="{ 'error': errors.webhookUrl }"
              @input="clearError('webhookUrl')"
            />
            <button
              class="toggle-btn"
              @click="showWebhook = !showWebhook"
              type="button"
              :title="showWebhook ? 'Gizle' : 'Göster'"
            >
              {{ showWebhook ? '👁️' : '👁️‍🗨️' }}
            </button>
          </div>
          <span v-if="errors.webhookUrl" class="error-text">{{ errors.webhookUrl }}</span>
          <p class="form-help">Slack workspace'inizde Incoming Webhook oluşturun</p>
        </div>

        <div class="form-group">
          <label for="channel">Kanal Adı</label>
          <input
            id="channel"
            v-model="localSettings.channel"
            type="text"
            placeholder="#randevular (opsiyonel)"
            class="form-input"
          />
          <p class="form-help">Bildirim gönderilecek kanal (boş bırakılırsa webhook'un varsayılan kanalı kullanılır)</p>
        </div>

        <div class="form-group">
          <label class="checkbox-label">
            <input
              v-model="localSettings.enabled"
              type="checkbox"
              class="checkbox-input"
            />
            <span>Slack bildirimleri etkin</span>
          </label>
          <p class="form-help">Bu seçenek kapalıysa Slack bildirimleri gönderilmeyecektir</p>
        </div>

        <div class="notification-options">
          <h4 class="options-title">Bildirim Türleri</h4>
          <label class="checkbox-label">
            <input
              v-model="localSettings.notifyOnNewAppointment"
              type="checkbox"
              class="checkbox-input"
            />
            <span>Yeni randevu oluşturulduğunda</span>
          </label>
          <label class="checkbox-label">
            <input
              v-model="localSettings.notifyOnCancellation"
              type="checkbox"
              class="checkbox-input"
            />
            <span>Randevu iptal edildiğinde</span>
          </label>
          <label class="checkbox-label">
            <input
              v-model="localSettings.notifyOnReminder"
              type="checkbox"
              class="checkbox-input"
            />
            <span>Randevu hatırlatması gönderildiğinde</span>
          </label>
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
            v-if="localSettings.webhookUrl"
            class="test-btn"
            :disabled="testing"
            @click="testWebhook"
          >
            <span v-if="testing" class="btn-spinner"></span>
            {{ testing ? 'Test Ediliyor...' : '🧪 Webhook Test Et' }}
          </button>
        </div>
      </div>
    </section>

    <!-- Message Preview Section -->
    <section class="settings-section">
      <h3 class="section-title">Bildirim Önizleme</h3>

      <div class="preview-container">
        <div class="slack-message">
          <div class="message-header">
            <span class="bot-name">Randevu Bot</span>
            <span class="bot-tag">APP</span>
            <span class="message-time">şimdi</span>
          </div>

          <div class="message-content">
            <div class="message-icon">📅</div>
            <div class="message-body">
              <div class="message-title">Yeni Randevu Oluşturuldu</div>
              <div class="message-details">
                <div class="detail-row">
                  <span class="detail-label">Müşteri:</span>
                  <span class="detail-value">Ahmet Yılmaz</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Tarih:</span>
                  <span class="detail-value">15 Kasım 2025, Cuma - 14:00</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Personel:</span>
                  <span class="detail-value">Mehmet Demir</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Tip:</span>
                  <span class="detail-value">Teslim</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Usage Statistics Section -->
    <section class="settings-section">
      <h3 class="section-title">İstatistikler</h3>

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
            <div class="stat-value">{{ stats.successThisMonth }}</div>
            <div class="stat-label">Başarılı</div>
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
          <div class="stat-icon">📊</div>
          <div class="stat-content">
            <div class="stat-value">{{ successRate }}%</div>
            <div class="stat-label">Başarı Oranı</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Documentation Section -->
    <section class="settings-section">
      <h3 class="section-title">Slack Webhook Nasıl Oluşturulur?</h3>

      <ol class="setup-steps">
        <li>
          <strong>Slack workspace'inizde</strong> Apps bölümüne gidin
        </li>
        <li>
          <strong>"Incoming Webhooks"</strong> uygulamasını arayın ve ekleyin
        </li>
        <li>
          <strong>"Add New Webhook to Workspace"</strong> butonuna tıklayın
        </li>
        <li>
          Bildirimlerin gönderileceği <strong>kanalı seçin</strong>
        </li>
        <li>
          Oluşturulan <strong>Webhook URL'ini kopyalayın</strong> ve yukarıdaki alana yapıştırın
        </li>
      </ol>

      <div class="docs-links">
        <a
          href="https://api.slack.com/messaging/webhooks"
          target="_blank"
          rel="noopener noreferrer"
          class="docs-link"
        >
          📖 Slack Webhook Dokümantasyonu
        </a>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

// Props
interface Props {
  settings?: SlackSettings;
  stats?: UsageStats;
}

const props = withDefaults(defineProps<Props>(), {
  settings: () => ({
    webhookUrl: '',
    channel: '',
    enabled: false,
    notifyOnNewAppointment: true,
    notifyOnCancellation: true,
    notifyOnReminder: false
  }),
  stats: () => ({
    sentThisMonth: 0,
    successThisMonth: 0,
    failedThisMonth: 0
  })
});

// Emits
interface Emits {
  (e: 'save-settings', settings: SlackSettings): void;
  (e: 'test-webhook'): void;
}

const emit = defineEmits<Emits>();

// Types
interface SlackSettings {
  webhookUrl: string;
  channel: string;
  enabled: boolean;
  notifyOnNewAppointment: boolean;
  notifyOnCancellation: boolean;
  notifyOnReminder: boolean;
}

interface UsageStats {
  sentThisMonth: number;
  successThisMonth: number;
  failedThisMonth: number;
}

interface Errors {
  webhookUrl?: string;
}

// State
const localSettings = ref<SlackSettings>({ ...props.settings });
const errors = ref<Errors>({});
const saving = ref(false);
const testing = ref(false);
const showWebhook = ref(false);

// Computed
const successRate = computed(() => {
  if (props.stats.sentThisMonth === 0) return 0;
  return Math.round((props.stats.successThisMonth / props.stats.sentThisMonth) * 100);
});

// Methods
function validateSettings(): boolean {
  errors.value = {};
  let isValid = true;

  if (!localSettings.value.webhookUrl.trim()) {
    errors.value.webhookUrl = 'Webhook URL gereklidir';
    isValid = false;
  } else if (!localSettings.value.webhookUrl.startsWith('https://hooks.slack.com/')) {
    errors.value.webhookUrl = 'Geçerli bir Slack webhook URL\'i giriniz';
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
    alert('Slack ayarları başarıyla kaydedildi!');
  } catch (error) {
    console.error('Settings save error:', error);
    alert('Ayarlar kaydedilirken bir hata oluştu.');
  } finally {
    saving.value = false;
  }
}

async function testWebhook() {
  testing.value = true;

  try {
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate webhook test
    emit('test-webhook');
    alert('✅ Slack webhook testi başarılı! Kanalınızı kontrol edin.');
  } catch (error) {
    console.error('Webhook test error:', error);
    alert('❌ Webhook testi başarısız. Lütfen URL\'i kontrol edin.');
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
.slack-settings {
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
.config-form {
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
  border-color: #611f69;
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
  font-size: 15px;
}

.checkbox-input {
  width: 20px;
  height: 20px;
  cursor: pointer;
}

.notification-options {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.options-title {
  font-size: 15px;
  font-weight: 600;
  color: #2c3e50;
  margin: 0 0 5px 0;
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
  background: #611f69;
  color: white;
}

.save-btn:hover:not(:disabled) {
  background: #4a154b;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(97, 31, 105, 0.3);
}

.test-btn {
  background: white;
  border: 2px solid #611f69;
  color: #611f69;
}

.test-btn:hover:not(:disabled) {
  background: #611f69;
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

/* Slack Message Preview */
.preview-container {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
}

.slack-message {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 15px;
  max-width: 600px;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.bot-name {
  font-weight: 700;
  color: #1d1c1d;
  font-size: 15px;
}

.bot-tag {
  background: #e0e0e0;
  color: #616061;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.message-time {
  color: #616061;
  font-size: 12px;
  margin-left: auto;
}

.message-content {
  display: flex;
  gap: 12px;
}

.message-icon {
  font-size: 32px;
  line-height: 1;
}

.message-body {
  flex: 1;
}

.message-title {
  font-size: 16px;
  font-weight: 700;
  color: #1d1c1d;
  margin-bottom: 10px;
}

.message-details {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.detail-row {
  display: flex;
  gap: 8px;
  font-size: 14px;
}

.detail-label {
  font-weight: 600;
  color: #616061;
}

.detail-value {
  color: #1d1c1d;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
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

/* Setup Steps */
.setup-steps {
  padding-left: 20px;
  margin: 0 0 20px 0;
}

.setup-steps li {
  margin-bottom: 12px;
  font-size: 15px;
  color: #2c3e50;
  line-height: 1.6;
}

.setup-steps strong {
  color: #611f69;
}

.docs-links {
  display: flex;
  gap: 10px;
}

.docs-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: #611f69;
  color: white;
  text-decoration: none;
  border-radius: 8px;
  font-weight: 600;
  transition: all 0.3s ease;
}

.docs-link:hover {
  background: #4a154b;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(97, 31, 105, 0.3);
}

/* Responsive */
@media (max-width: 768px) {
  .slack-settings {
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

  .slack-message {
    max-width: 100%;
  }
}
</style>
