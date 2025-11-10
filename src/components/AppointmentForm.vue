<template>
  <div v-if="showForm" class="appointment-form">
    <h3 class="form-title">Randevu Bilgileri</h3>

    <div class="form-group">
      <label for="customerName">Ad Soyad *</label>
      <input
        id="customerName"
        v-model="formData.customerName"
        type="text"
        placeholder="Adınız ve soyadınız"
        required
        :class="{ 'error': errors.customerName }"
        @input="clearError('customerName')"
      />
      <span v-if="errors.customerName" class="error-message">{{ errors.customerName }}</span>
    </div>

    <div class="form-group">
      <label for="customerPhone">Telefon *</label>
      <input
        id="customerPhone"
        v-model="formData.customerPhone"
        type="tel"
        placeholder="0555 123 4567"
        required
        :class="{ 'error': errors.customerPhone }"
        @input="clearError('customerPhone')"
      />
      <span v-if="errors.customerPhone" class="error-message">{{ errors.customerPhone }}</span>
    </div>

    <div class="form-group">
      <label for="customerEmail">E-posta</label>
      <input
        id="customerEmail"
        v-model="formData.customerEmail"
        type="email"
        placeholder="ornek@email.com (opsiyonel)"
        :class="{ 'error': errors.customerEmail }"
        @input="clearError('customerEmail')"
      />
      <span v-if="errors.customerEmail" class="error-message">{{ errors.customerEmail }}</span>
    </div>

    <div class="form-group">
      <label for="notes">Notlar</label>
      <textarea
        id="notes"
        v-model="formData.notes"
        placeholder="Varsa eklemek istediğiniz notlar..."
        rows="3"
      ></textarea>
    </div>

    <div class="form-actions">
      <button
        type="button"
        class="btn btn-primary"
        :disabled="isSubmitting"
        @click="handleSubmit"
      >
        <span v-if="isSubmitting" class="spinner"></span>
        {{ isSubmitting ? 'Oluşturuluyor...' : 'Randevuyu Onayla' }}
      </button>
    </div>

    <div class="form-summary">
      <h4>Randevu Özeti</h4>
      <div class="summary-item">
        <strong>Tarih:</strong> {{ formattedDate }}
      </div>
      <div class="summary-item">
        <strong>Saat:</strong> {{ selectedTime }}
      </div>
      <div class="summary-item">
        <strong>Personel:</strong> {{ staffName }}
      </div>
      <div class="summary-item">
        <strong>Randevu Tipi:</strong> {{ appointmentTypeLabel }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { DateUtils } from '../../date-utils.ts';
import { StringUtils } from '../../string-utils.ts';

// Props
interface Props {
  showForm: boolean;
  selectedDate: string | null;
  selectedTime: string | null;
  staffName: string;
  appointmentTypeLabel: string;
}

const props = defineProps<Props>();

// Emits
interface Emits {
  (e: 'submit', data: AppointmentData): void;
}

const emit = defineEmits<Emits>();

// Types
interface FormData {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  notes: string;
}

interface AppointmentData extends FormData {
  selectedDate: string;
  selectedTime: string;
}

interface Errors {
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
}

// State
const formData = ref<FormData>({
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  notes: ''
});

const errors = ref<Errors>({});
const isSubmitting = ref(false);

// Computed
const formattedDate = computed(() => {
  if (!props.selectedDate) return '-';
  try {
    const date = new Date(props.selectedDate + 'T00:00:00');
    return DateUtils.toTurkishDate(date);
  } catch {
    return props.selectedDate;
  }
});

// Methods
function validateForm(): boolean {
  errors.value = {};
  let isValid = true;

  // Name validation
  if (!formData.value.customerName.trim()) {
    errors.value.customerName = 'Ad soyad gereklidir';
    isValid = false;
  } else if (formData.value.customerName.trim().length < 3) {
    errors.value.customerName = 'Ad soyad en az 3 karakter olmalıdır';
    isValid = false;
  }

  // Phone validation
  const phoneDigits = formData.value.customerPhone.replace(/\D/g, '');
  if (!formData.value.customerPhone.trim()) {
    errors.value.customerPhone = 'Telefon numarası gereklidir';
    isValid = false;
  } else if (phoneDigits.length < 10) {
    errors.value.customerPhone = 'Geçerli bir telefon numarası giriniz';
    isValid = false;
  }

  // Email validation (optional but must be valid if provided)
  if (formData.value.customerEmail.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.value.customerEmail)) {
      errors.value.customerEmail = 'Geçerli bir e-posta adresi giriniz';
      isValid = false;
    }
  }

  return isValid;
}

function clearError(field: keyof Errors) {
  if (errors.value[field]) {
    delete errors.value[field];
  }
}

async function handleSubmit() {
  if (!validateForm()) {
    return;
  }

  if (!props.selectedDate || !props.selectedTime) {
    return;
  }

  isSubmitting.value = true;

  try {
    // Format data
    const appointmentData: AppointmentData = {
      customerName: StringUtils.toTitleCase(formData.value.customerName.trim()) || formData.value.customerName.trim(),
      customerPhone: formData.value.customerPhone.trim(),
      customerEmail: formData.value.customerEmail.trim(),
      notes: formData.value.notes.trim(),
      selectedDate: props.selectedDate,
      selectedTime: props.selectedTime
    };

    emit('submit', appointmentData);
  } finally {
    isSubmitting.value = false;
  }
}

// Reset form
function resetForm() {
  formData.value = {
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    notes: ''
  };
  errors.value = {};
  isSubmitting.value = false;
}

// Expose reset for parent
defineExpose({
  resetForm
});
</script>

<style scoped>
.appointment-form {
  background: white;
  border-radius: 12px;
  padding: 30px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-top: 30px;
}

.form-title {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 25px;
  color: #2c3e50;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-weight: 500;
  margin-bottom: 8px;
  color: #2c3e50;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 12px 15px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 0.3s ease;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #006039;
}

.form-group input.error,
.form-group textarea.error {
  border-color: #dc3545;
}

.error-message {
  display: block;
  color: #dc3545;
  font-size: 14px;
  margin-top: 5px;
}

.form-actions {
  margin-top: 30px;
}

.btn {
  width: 100%;
  padding: 15px 30px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.btn-primary {
  background: #006039;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #004d2e;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 96, 57, 0.3);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.spinner {
  width: 18px;
  height: 18px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.form-summary {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 2px solid #e0e0e0;
}

.form-summary h4 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 15px;
  color: #2c3e50;
}

.summary-item {
  padding: 8px 0;
  font-size: 15px;
  color: #555;
}

.summary-item strong {
  color: #2c3e50;
  margin-right: 8px;
}

@media (max-width: 768px) {
  .appointment-form {
    padding: 20px;
  }

  .form-title {
    font-size: 18px;
  }
}
</style>
