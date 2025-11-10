<template>
  <nav class="tab-navigation">
    <div class="tab-container">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="['tab-btn', { 'tab-btn--active': activeTab === tab.id }]"
        @click="selectTab(tab.id)"
      >
        <span class="tab-icon">{{ tab.icon }}</span>
        <span class="tab-label">{{ tab.label }}</span>
        <span v-if="tab.badge" class="tab-badge">{{ tab.badge }}</span>
      </button>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue';

// Props
interface Props {
  activeTab: string;
  appointmentCount?: number;
}

const props = withDefaults(defineProps<Props>(), {
  activeTab: 'settings',
  appointmentCount: 0
});

// Emits
interface Emits {
  (e: 'update:activeTab', tabId: string): void;
  (e: 'change-tab', tabId: string): void;
}

const emit = defineEmits<Emits>();

// Types
interface Tab {
  id: string;
  label: string;
  icon: string;
  badge?: number | string;
}

// Computed
const tabs = computed((): Tab[] => [
  {
    id: 'settings',
    label: 'Ayarlar',
    icon: '⚙️'
  },
  {
    id: 'staff',
    label: 'Personel',
    icon: '👥'
  },
  {
    id: 'shifts',
    label: 'Vardiyalar',
    icon: '📅'
  },
  {
    id: 'appointments',
    label: 'Randevular',
    icon: '📋',
    badge: props.appointmentCount > 0 ? props.appointmentCount : undefined
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    icon: '💬'
  },
  {
    id: 'slack',
    label: 'Slack',
    icon: '📢'
  }
]);

// Methods
function selectTab(tabId: string) {
  emit('update:activeTab', tabId);
  emit('change-tab', tabId);
}
</script>

<style scoped>
.tab-navigation {
  background: white;
  border-bottom: 2px solid #e0e0e0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  position: sticky;
  top: 84px; /* Below header */
  z-index: 90;
}

.tab-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 30px;
  display: flex;
  gap: 5px;
  overflow-x: auto;
  scrollbar-width: thin;
}

.tab-container::-webkit-scrollbar {
  height: 4px;
}

.tab-container::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.tab-container::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 2px;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 24px;
  border: none;
  background: transparent;
  color: #666;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  white-space: nowrap;
  border-bottom: 3px solid transparent;
  font-family: inherit;
}

.tab-btn:hover {
  color: #006039;
  background: rgba(0, 96, 57, 0.05);
}

.tab-btn--active {
  color: #006039;
  border-bottom-color: #006039;
  background: rgba(0, 96, 57, 0.05);
}

.tab-icon {
  font-size: 20px;
  line-height: 1;
}

.tab-label {
  line-height: 1;
}

.tab-badge {
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  background: #dc3545;
  color: white;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

@media (max-width: 1024px) {
  .tab-navigation {
    top: 64px; /* Adjusted for smaller header */
  }

  .tab-container {
    padding: 0 20px;
  }

  .tab-btn {
    padding: 14px 20px;
    font-size: 14px;
  }

  .tab-icon {
    font-size: 18px;
  }
}

@media (max-width: 768px) {
  .tab-navigation {
    top: 59px;
  }

  .tab-container {
    padding: 0 15px;
    gap: 0;
  }

  .tab-btn {
    padding: 12px 16px;
    font-size: 13px;
  }

  .tab-icon {
    font-size: 16px;
  }

  .tab-badge {
    min-width: 18px;
    height: 18px;
    font-size: 11px;
  }
}

@media (max-width: 480px) {
  .tab-btn {
    flex-direction: column;
    padding: 10px 12px;
    gap: 4px;
  }

  .tab-label {
    font-size: 11px;
  }
}
</style>
