<template>
  <div class="staff-manager">
    <div class="manager-header">
      <h2 class="panel-title">Personel Yönetimi</h2>
      <button class="add-btn" @click="openAddModal">
        <span class="add-icon">➕</span>
        Yeni Personel Ekle
      </button>
    </div>

    <!-- Staff List -->
    <div v-if="loading" class="loading-state">
      Personel listesi yükleniyor...
    </div>

    <div v-else-if="staffList.length === 0" class="empty-state">
      <p class="empty-icon">👥</p>
      <p class="empty-text">Henüz personel eklenmemiş.</p>
      <button class="empty-btn" @click="openAddModal">
        İlk Personeli Ekle
      </button>
    </div>

    <div v-else class="staff-table-container">
      <table class="staff-table">
        <thead>
          <tr>
            <th>İsim</th>
            <th>Telefon</th>
            <th>E-posta</th>
            <th>Durum</th>
            <th>İşlemler</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="staff in staffList"
            :key="staff.id"
            :class="{ 'staff-inactive': !staff.active }"
          >
            <td class="staff-name">
              <div class="name-cell">
                <span class="name-avatar">{{ getInitials(staff.name) }}</span>
                <span>{{ staff.name }}</span>
              </div>
            </td>
            <td>{{ formatPhone(staff.phone) }}</td>
            <td>{{ staff.email || '-' }}</td>
            <td>
              <span :class="['status-badge', staff.active ? 'status-active' : 'status-inactive']">
                {{ staff.active ? 'Aktif' : 'Pasif' }}
              </span>
            </td>
            <td class="actions-cell">
              <button
                class="action-btn action-btn--edit"
                @click="openEditModal(staff)"
                title="Düzenle"
              >
                ✏️
              </button>
              <button
                class="action-btn action-btn--toggle"
                @click="toggleStaffStatus(staff)"
                :title="staff.active ? 'Pasif yap' : 'Aktif yap'"
              >
                {{ staff.active ? '👁️' : '🚫' }}
              </button>
              <button
                class="action-btn action-btn--delete"
                @click="deleteStaff(staff)"
                title="Sil"
              >
                🗑️
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Add/Edit Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showModal" class="modal-overlay" @click="closeModal">
          <div class="modal-dialog" @click.stop>
            <div class="modal-header">
              <h3 class="modal-title">
                {{ editingStaff ? 'Personel Düzenle' : 'Yeni Personel Ekle' }}
              </h3>
              <button class="modal-close" @click="closeModal">×</button>
            </div>

            <div class="modal-body">
              <div class="form-group">
                <label>İsim Soyisim *</label>
                <input
                  v-model="formData.name"
                  type="text"
                  placeholder="Ahmet Yılmaz"
                  :class="{ 'error': errors.name }"
                  @input="clearError('name')"
                />
                <span v-if="errors.name" class="error-text">{{ errors.name }}</span>
              </div>

              <div class="form-group">
                <label>Telefon *</label>
                <input
                  v-model="formData.phone"
                  type="tel"
                  placeholder="0555 123 4567"
                  :class="{ 'error': errors.phone }"
                  @input="clearError('phone')"
                />
                <span v-if="errors.phone" class="error-text">{{ errors.phone }}</span>
              </div>

              <div class="form-group">
                <label>E-posta</label>
                <input
                  v-model="formData.email"
                  type="email"
                  placeholder="ornek@email.com (opsiyonel)"
                  :class="{ 'error': errors.email }"
                  @input="clearError('email')"
                />
                <span v-if="errors.email" class="error-text">{{ errors.email }}</span>
              </div>

              <div class="form-group">
                <label class="checkbox-label">
                  <input
                    v-model="formData.active"
                    type="checkbox"
                    class="checkbox-input"
                  />
                  <span>Aktif personel</span>
                </label>
              </div>
            </div>

            <div class="modal-footer">
              <button class="modal-btn modal-btn--secondary" @click="closeModal">
                İptal
              </button>
              <button
                class="modal-btn modal-btn--primary"
                :disabled="submitting"
                @click="submitForm"
              >
                <span v-if="submitting" class="btn-spinner"></span>
                {{ submitting ? 'Kaydediliyor...' : 'Kaydet' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

// Props
interface Props {
  staffList: Staff[];
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  staffList: () => [],
  loading: false
});

// Emits
interface Emits {
  (e: 'add-staff', staff: StaffFormData): void;
  (e: 'edit-staff', id: string | number, staff: StaffFormData): void;
  (e: 'delete-staff', id: string | number): void;
  (e: 'toggle-staff', id: string | number, active: boolean): void;
}

const emit = defineEmits<Emits>();

// Types
interface Staff {
  id: string | number;
  name: string;
  phone: string;
  email?: string;
  active: boolean;
}

interface StaffFormData {
  name: string;
  phone: string;
  email: string;
  active: boolean;
}

interface Errors {
  name?: string;
  phone?: string;
  email?: string;
}

// State
const showModal = ref(false);
const editingStaff = ref<Staff | null>(null);
const submitting = ref(false);
const formData = ref<StaffFormData>({
  name: '',
  phone: '',
  email: '',
  active: true
});
const errors = ref<Errors>({});

// Methods
function openAddModal() {
  editingStaff.value = null;
  formData.value = {
    name: '',
    phone: '',
    email: '',
    active: true
  };
  errors.value = {};
  showModal.value = true;
}

function openEditModal(staff: Staff) {
  editingStaff.value = staff;
  formData.value = {
    name: staff.name,
    phone: staff.phone,
    email: staff.email || '',
    active: staff.active
  };
  errors.value = {};
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
  editingStaff.value = null;
  formData.value = {
    name: '',
    phone: '',
    email: '',
    active: true
  };
  errors.value = {};
}

function validateForm(): boolean {
  errors.value = {};
  let isValid = true;

  if (!formData.value.name.trim()) {
    errors.value.name = 'İsim gereklidir';
    isValid = false;
  } else if (formData.value.name.trim().length < 3) {
    errors.value.name = 'İsim en az 3 karakter olmalıdır';
    isValid = false;
  }

  const phoneDigits = formData.value.phone.replace(/\D/g, '');
  if (!formData.value.phone.trim()) {
    errors.value.phone = 'Telefon gereklidir';
    isValid = false;
  } else if (phoneDigits.length < 10) {
    errors.value.phone = 'Geçerli bir telefon numarası giriniz';
    isValid = false;
  }

  if (formData.value.email.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.value.email)) {
      errors.value.email = 'Geçerli bir e-posta adresi giriniz';
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

async function submitForm() {
  if (!validateForm()) return;

  submitting.value = true;

  try {
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call

    if (editingStaff.value) {
      emit('edit-staff', editingStaff.value.id, { ...formData.value });
    } else {
      emit('add-staff', { ...formData.value });
    }

    closeModal();
  } catch (error) {
    console.error('Form submission error:', error);
    alert('Bir hata oluştu. Lütfen tekrar deneyin.');
  } finally {
    submitting.value = false;
  }
}

function toggleStaffStatus(staff: Staff) {
  const action = staff.active ? 'pasif' : 'aktif';
  if (confirm(`${staff.name} isimli personeli ${action} yapmak istediğinize emin misiniz?`)) {
    emit('toggle-staff', staff.id, !staff.active);
  }
}

function deleteStaff(staff: Staff) {
  if (confirm(`${staff.name} isimli personeli silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`)) {
    emit('delete-staff', staff.id);
  }
}

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatPhone(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `${cleaned.substring(0, 4)} ${cleaned.substring(4, 7)} ${cleaned.substring(7)}`;
  }
  return phone;
}
</script>

<style scoped>
.staff-manager {
  max-width: 1200px;
  margin: 0 auto;
  padding: 30px;
}

.manager-header {
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

.add-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  background: #006039;
  color: white;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: inherit;
}

.add-btn:hover {
  background: #004d2e;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 96, 57, 0.3);
}

.add-icon {
  font-size: 18px;
  line-height: 1;
}

/* Loading & Empty States */
.loading-state,
.empty-state {
  text-align: center;
  padding: 60px 20px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.empty-icon {
  font-size: 64px;
  margin: 0 0 20px 0;
}

.empty-text {
  font-size: 18px;
  color: #666;
  margin: 0 0 25px 0;
}

.empty-btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  background: #006039;
  color: white;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: inherit;
}

.empty-btn:hover {
  background: #004d2e;
  transform: translateY(-2px);
}

/* Staff Table */
.staff-table-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.staff-table {
  width: 100%;
  border-collapse: collapse;
}

.staff-table thead {
  background: #f8f9fa;
}

.staff-table th {
  padding: 15px 20px;
  text-align: left;
  font-size: 14px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.staff-table tbody tr {
  border-bottom: 1px solid #e0e0e0;
  transition: background 0.2s ease;
}

.staff-table tbody tr:hover {
  background: #f8f9fa;
}

.staff-table tbody tr.staff-inactive {
  opacity: 0.6;
}

.staff-table td {
  padding: 15px 20px;
  font-size: 15px;
  color: #2c3e50;
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.name-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #006039, #00804d);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
}

.status-badge {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
}

.status-active {
  background: #d4edda;
  color: #155724;
}

.status-inactive {
  background: #f8d7da;
  color: #721c24;
}

.actions-cell {
  display: flex;
  gap: 8px;
}

.action-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 6px;
  background: #f0f0f0;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn:hover {
  transform: scale(1.1);
}

.action-btn--edit:hover {
  background: #d1ecf1;
}

.action-btn--toggle:hover {
  background: #fff3cd;
}

.action-btn--delete:hover {
  background: #f8d7da;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.modal-dialog {
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  max-width: 500px;
  width: 100%;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 25px;
  border-bottom: 2px solid #e0e0e0;
}

.modal-title {
  font-size: 20px;
  font-weight: 600;
  color: #2c3e50;
  margin: 0;
}

.modal-close {
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: #666;
  font-size: 32px;
  line-height: 1;
  cursor: pointer;
  font-family: inherit;
}

.modal-body {
  padding: 25px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-weight: 600;
  margin-bottom: 8px;
  color: #2c3e50;
}

.form-group input[type="text"],
.form-group input[type="tel"],
.form-group input[type="email"] {
  width: 100%;
  padding: 12px 15px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 15px;
  font-family: inherit;
}

.form-group input.error {
  border-color: #dc3545;
}

.error-text {
  display: block;
  color: #dc3545;
  font-size: 13px;
  margin-top: 5px;
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

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 15px 25px;
  border-top: 2px solid #e0e0e0;
}

.modal-btn {
  padding: 12px 24px;
  border: 2px solid;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: inherit;
}

.modal-btn--secondary {
  background: white;
  border-color: #e0e0e0;
  color: #666;
}

.modal-btn--secondary:hover {
  background: #f8f9fa;
}

.modal-btn--primary {
  background: #006039;
  border-color: #006039;
  color: white;
}

.modal-btn--primary:hover:not(:disabled) {
  background: #004d2e;
}

.modal-btn--primary:disabled {
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

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

/* Responsive */
@media (max-width: 768px) {
  .staff-manager {
    padding: 20px 15px;
  }

  .manager-header {
    flex-direction: column;
    gap: 15px;
    align-items: flex-start;
  }

  .add-btn {
    width: 100%;
    justify-content: center;
  }

  .staff-table-container {
    overflow-x: auto;
  }

  .staff-table {
    min-width: 600px;
  }
}
</style>
