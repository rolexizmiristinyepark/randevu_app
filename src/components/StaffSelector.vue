<template>
  <div class="staff-selector">
    <h3 class="section-title">İlgili Personel Seçin</h3>

    <div v-if="loading" class="loading-spinner">
      Personel listesi yükleniyor...
    </div>

    <div v-else-if="filteredStaff.length === 0" class="alert alert-info">
      Seçilen vardiya için müsait personel bulunmamaktadır.
    </div>

    <div v-else class="staff-grid">
      <div
        v-for="staff in filteredStaff"
        :key="staff.id"
        :class="['staff-card', { 'selected': selectedStaffId === staff.id }]"
        @click="selectStaff(staff)"
      >
        <div class="staff-avatar">
          {{ getInitials(staff.name) }}
        </div>
        <div class="staff-info">
          <h4 class="staff-name">{{ staff.name }}</h4>
          <p class="staff-phone">{{ formatPhone(staff.phone) }}</p>
        </div>
        <div v-if="selectedStaffId === staff.id" class="selected-indicator">
          ✓
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { apiCall } from '../../api-service.ts';
import type { ApiResponse } from '../../api-service.ts';

// Props
interface Props {
  selectedStaffId?: string | number | null;
  shiftType?: string;
}

const props = withDefaults(defineProps<Props>(), {
  selectedStaffId: null,
  shiftType: 'full'
});

// Emits
interface Emits {
  (e: 'update:selectedStaffId', staffId: string | number): void;
  (e: 'select-staff', staff: Staff): void;
}

const emit = defineEmits<Emits>();

// Types
interface Staff {
  id: string | number;
  name: string;
  phone: string;
  email?: string;
  active?: boolean;
}

interface StaffResponse {
  success: boolean;
  data: Staff[];
}

// State
const loading = ref(false);
const staffMembers = ref<Staff[]>([]);

// Computed
const filteredStaff = computed(() => {
  return staffMembers.value.filter(staff => staff.active !== false);
});

// Methods
async function loadStaff() {
  loading.value = true;

  try {
    const result = await apiCall<StaffResponse>('getStaff');

    if (result.success && result.data) {
      staffMembers.value = Array.isArray(result.data) ? result.data : [];
    }
  } catch (error) {
    console.error('Error loading staff:', error);
    staffMembers.value = [];
  } finally {
    loading.value = false;
  }
}

function selectStaff(staff: Staff) {
  emit('update:selectedStaffId', staff.id);
  emit('select-staff', staff);
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

  // Format: 0555 123 4567
  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.length === 11) {
    return `${cleaned.substring(0, 4)} ${cleaned.substring(4, 7)} ${cleaned.substring(7)}`;
  }

  return phone;
}

// Lifecycle
onMounted(() => {
  loadStaff();
});
</script>

<style scoped>
.staff-selector {
  margin-top: 30px;
}

.section-title {
  font-size: 18px;
  font-weight: 500;
  margin-bottom: 15px;
  color: #2c3e50;
}

.loading-spinner {
  text-align: center;
  padding: 40px;
  color: #666;
}

.alert {
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.alert-info {
  background-color: #d1ecf1;
  border: 1px solid #17a2b8;
  color: #0c5460;
}

.staff-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 15px;
}

.staff-card {
  display: flex;
  align-items: center;
  padding: 15px;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  background: white;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
}

.staff-card:hover {
  border-color: #006039;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 96, 57, 0.15);
}

.staff-card.selected {
  border-color: #006039;
  background: #f0f9f6;
  box-shadow: 0 4px 12px rgba(0, 96, 57, 0.2);
}

.staff-avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: linear-gradient(135deg, #006039, #00804d);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 600;
  flex-shrink: 0;
  margin-right: 15px;
}

.staff-info {
  flex: 1;
  min-width: 0;
}

.staff-name {
  font-size: 16px;
  font-weight: 600;
  color: #2c3e50;
  margin: 0 0 5px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.staff-phone {
  font-size: 14px;
  color: #666;
  margin: 0;
}

.selected-indicator {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #006039;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: bold;
  flex-shrink: 0;
  margin-left: 10px;
}

@media (max-width: 768px) {
  .staff-grid {
    grid-template-columns: 1fr;
  }

  .staff-card {
    padding: 12px;
  }

  .staff-avatar {
    width: 45px;
    height: 45px;
    font-size: 16px;
  }

  .staff-name {
    font-size: 15px;
  }

  .staff-phone {
    font-size: 13px;
  }
}
</style>
