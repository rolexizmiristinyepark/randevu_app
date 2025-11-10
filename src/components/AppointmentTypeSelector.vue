<template>
  <div class="appointment-type-selector">
    <h3 class="section-title">Randevu Tipini Seçin</h3>

    <div class="type-grid">
      <div
        v-for="type in appointmentTypes"
        :key="type.value"
        :class="['type-card', { 'selected': selectedType === type.value }]"
        @click="selectType(type.value)"
      >
        <div class="type-icon">{{ type.icon }}</div>
        <div class="type-content">
          <h4 class="type-title">{{ type.label }}</h4>
          <p class="type-description">{{ type.description }}</p>
          <span v-if="type.duration" class="type-duration">{{ type.duration }}</span>
        </div>
        <div v-if="selectedType === type.value" class="selected-indicator">
          ✓
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

// Props
interface Props {
  selectedType?: string | null;
}

const props = withDefaults(defineProps<Props>(), {
  selectedType: null
});

// Emits
interface Emits {
  (e: 'update:selectedType', type: string): void;
  (e: 'select-type', type: AppointmentType): void;
}

const emit = defineEmits<Emits>();

// Types
interface AppointmentType {
  value: string;
  label: string;
  description: string;
  icon: string;
  duration?: string;
}

// Data
const appointmentTypes: AppointmentType[] = [
  {
    value: 'teslim',
    label: 'Teslim',
    description: 'Yeni ürün teslimi veya ürün teslim alma',
    icon: '📦',
    duration: '~30 dakika'
  },
  {
    value: 'gorusme',
    label: 'Görüşme',
    description: 'Genel danışma ve ürün inceleme',
    icon: '💼',
    duration: '~45 dakika'
  },
  {
    value: 'servis',
    label: 'Servis',
    description: 'Ürün servisi ve bakım hizmetleri',
    icon: '🔧',
    duration: '~60 dakika'
  }
];

// Methods
function selectType(typeValue: string) {
  const type = appointmentTypes.find(t => t.value === typeValue);
  if (type) {
    emit('update:selectedType', typeValue);
    emit('select-type', type);
  }
}
</script>

<style scoped>
.appointment-type-selector {
  margin-top: 30px;
}

.section-title {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 20px;
  color: #2c3e50;
}

.type-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
}

.type-card {
  display: flex;
  align-items: flex-start;
  padding: 20px;
  border: 3px solid #e0e0e0;
  border-radius: 12px;
  background: white;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  min-height: 140px;
}

.type-card:hover {
  border-color: #006039;
  transform: translateY(-4px);
  box-shadow: 0 6px 20px rgba(0, 96, 57, 0.15);
}

.type-card.selected {
  border-color: #006039;
  background: linear-gradient(135deg, #f0f9f6 0%, #ffffff 100%);
  box-shadow: 0 6px 20px rgba(0, 96, 57, 0.25);
}

.type-icon {
  font-size: 48px;
  margin-right: 15px;
  flex-shrink: 0;
  line-height: 1;
}

.type-content {
  flex: 1;
  min-width: 0;
}

.type-title {
  font-size: 18px;
  font-weight: 600;
  color: #2c3e50;
  margin: 0 0 8px 0;
}

.type-description {
  font-size: 14px;
  color: #666;
  margin: 0 0 8px 0;
  line-height: 1.4;
}

.type-duration {
  display: inline-block;
  font-size: 12px;
  color: #006039;
  background: #e8f5e9;
  padding: 4px 10px;
  border-radius: 12px;
  font-weight: 500;
}

.selected-indicator {
  position: absolute;
  top: 15px;
  right: 15px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #006039;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: bold;
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .type-grid {
    grid-template-columns: 1fr;
  }

  .type-card {
    padding: 15px;
    min-height: 120px;
  }

  .type-icon {
    font-size: 40px;
    margin-right: 12px;
  }

  .type-title {
    font-size: 16px;
  }

  .type-description {
    font-size: 13px;
  }

  .selected-indicator {
    width: 28px;
    height: 28px;
    font-size: 16px;
  }
}

@media (max-width: 480px) {
  .type-card {
    flex-direction: column;
    text-align: center;
  }

  .type-icon {
    margin-right: 0;
    margin-bottom: 10px;
  }

  .selected-indicator {
    top: 10px;
    right: 10px;
  }
}
</style>
