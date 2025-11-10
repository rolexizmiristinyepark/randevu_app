<template>
  <button
    :type="type"
    :class="buttonClasses"
    :disabled="disabled || loading"
    @click="handleClick"
  >
    <span v-if="loading" class="button-spinner"></span>
    <span v-if="icon && !loading" class="button-icon">{{ icon }}</span>
    <span class="button-text">
      <slot>{{ label }}</slot>
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';

// Props
interface Props {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: string;
  label?: string;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'medium',
  type: 'button',
  disabled: false,
  loading: false,
  fullWidth: false,
  icon: '',
  label: ''
});

// Emits
interface Emits {
  (e: 'click', event: MouseEvent): void;
}

const emit = defineEmits<Emits>();

// Computed
const buttonClasses = computed(() => {
  const classes = ['base-button'];

  // Variant classes
  classes.push(`base-button--${props.variant}`);

  // Size classes
  classes.push(`base-button--${props.size}`);

  // State classes
  if (props.disabled) classes.push('base-button--disabled');
  if (props.loading) classes.push('base-button--loading');
  if (props.fullWidth) classes.push('base-button--full-width');

  return classes;
});

// Methods
function handleClick(event: MouseEvent) {
  if (!props.disabled && !props.loading) {
    emit('click', event);
  }
}
</script>

<style scoped>
.base-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 2px solid transparent;
  border-radius: 8px;
  font-family: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  white-space: nowrap;
}

.base-button:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(0, 96, 57, 0.2);
}

/* Sizes */
.base-button--small {
  padding: 8px 16px;
  font-size: 14px;
}

.base-button--medium {
  padding: 12px 24px;
  font-size: 16px;
}

.base-button--large {
  padding: 16px 32px;
  font-size: 18px;
}

/* Full width */
.base-button--full-width {
  width: 100%;
}

/* Variants */
.base-button--primary {
  background: #006039;
  color: white;
  border-color: #006039;
}

.base-button--primary:hover:not(:disabled) {
  background: #004d2e;
  border-color: #004d2e;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 96, 57, 0.3);
}

.base-button--secondary {
  background: white;
  color: #006039;
  border-color: #006039;
}

.base-button--secondary:hover:not(:disabled) {
  background: #006039;
  color: white;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 96, 57, 0.2);
}

.base-button--danger {
  background: #dc3545;
  color: white;
  border-color: #dc3545;
}

.base-button--danger:hover:not(:disabled) {
  background: #c82333;
  border-color: #c82333;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
}

.base-button--success {
  background: #28a745;
  color: white;
  border-color: #28a745;
}

.base-button--success:hover:not(:disabled) {
  background: #218838;
  border-color: #218838;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
}

.base-button--ghost {
  background: transparent;
  color: #006039;
  border-color: transparent;
}

.base-button--ghost:hover:not(:disabled) {
  background: rgba(0, 96, 57, 0.1);
  border-color: transparent;
}

/* Disabled state */
.base-button--disabled,
.base-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
}

/* Loading state */
.base-button--loading {
  cursor: wait;
}

.button-spinner {
  width: 18px;
  height: 18px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

.base-button--secondary .button-spinner,
.base-button--ghost .button-spinner {
  border-color: rgba(0, 96, 57, 0.3);
  border-top-color: #006039;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.button-icon {
  font-size: 1.2em;
  line-height: 1;
}

.button-text {
  line-height: 1.2;
}

@media (max-width: 768px) {
  .base-button--small {
    padding: 6px 14px;
    font-size: 13px;
  }

  .base-button--medium {
    padding: 10px 20px;
    font-size: 15px;
  }

  .base-button--large {
    padding: 14px 28px;
    font-size: 17px;
  }
}
</style>
