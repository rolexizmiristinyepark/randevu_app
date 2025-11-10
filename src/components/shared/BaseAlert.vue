<template>
  <Transition name="alert-slide">
    <div
      v-if="show"
      :class="alertClasses"
      role="alert"
    >
      <div class="alert-icon">{{ icon }}</div>
      <div class="alert-content">
        <h4 v-if="title" class="alert-title">{{ title }}</h4>
        <div class="alert-message">
          <slot>{{ message }}</slot>
        </div>
      </div>
      <button
        v-if="dismissible"
        class="alert-close"
        @click="handleClose"
        aria-label="Kapat"
      >
        ×
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue';

// Props
interface Props {
  show?: boolean;
  type?: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message?: string;
  dismissible?: boolean;
  icon?: string;
}

const props = withDefaults(defineProps<Props>(), {
  show: true,
  type: 'info',
  title: '',
  message: '',
  dismissible: true,
  icon: ''
});

// Emits
interface Emits {
  (e: 'update:show', value: boolean): void;
  (e: 'close'): void;
}

const emit = defineEmits<Emits>();

// Computed
const alertClasses = computed(() => {
  const classes = ['base-alert'];
  classes.push(`base-alert--${props.type}`);
  return classes;
});

const icon = computed(() => {
  if (props.icon) return props.icon;

  // Default icons for each type
  const iconMap = {
    success: '✓',
    error: '✗',
    warning: '⚠',
    info: 'ℹ'
  };

  return iconMap[props.type];
});

// Methods
function handleClose() {
  emit('update:show', false);
  emit('close');
}
</script>

<style scoped>
.base-alert {
  display: flex;
  align-items: flex-start;
  gap: 15px;
  padding: 16px 20px;
  border-radius: 10px;
  border-left: 4px solid;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
}

/* Type variants */
.base-alert--success {
  background: #d4edda;
  border-color: #28a745;
  color: #155724;
}

.base-alert--success .alert-icon {
  background: #28a745;
}

.base-alert--error {
  background: #f8d7da;
  border-color: #dc3545;
  color: #721c24;
}

.base-alert--error .alert-icon {
  background: #dc3545;
}

.base-alert--warning {
  background: #fff3cd;
  border-color: #ffc107;
  color: #856404;
}

.base-alert--warning .alert-icon {
  background: #ffc107;
}

.base-alert--info {
  background: #d1ecf1;
  border-color: #17a2b8;
  color: #0c5460;
}

.base-alert--info .alert-icon {
  background: #17a2b8;
}

/* Alert icon */
.alert-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: white;
  font-size: 18px;
  font-weight: bold;
}

/* Alert content */
.alert-content {
  flex: 1;
  min-width: 0;
}

.alert-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 5px 0;
  line-height: 1.3;
}

.alert-message {
  font-size: 14px;
  line-height: 1.5;
  margin: 0;
}

/* Close button */
.alert-close {
  width: 28px;
  height: 28px;
  border: none;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  color: inherit;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: inherit;
}

.alert-close:hover {
  background: rgba(0, 0, 0, 0.2);
}

/* Transitions */
.alert-slide-enter-active,
.alert-slide-leave-active {
  transition: all 0.3s ease;
}

.alert-slide-enter-from {
  transform: translateY(-20px);
  opacity: 0;
}

.alert-slide-leave-to {
  transform: translateX(20px);
  opacity: 0;
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .base-alert {
    padding: 12px 16px;
    gap: 12px;
  }

  .alert-icon {
    width: 28px;
    height: 28px;
    font-size: 16px;
  }

  .alert-title {
    font-size: 15px;
  }

  .alert-message {
    font-size: 13px;
  }

  .alert-close {
    width: 24px;
    height: 24px;
    font-size: 20px;
  }
}
</style>
