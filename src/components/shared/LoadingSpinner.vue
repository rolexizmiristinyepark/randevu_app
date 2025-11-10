<template>
  <div :class="containerClasses">
    <div :class="spinnerClasses">
      <div class="spinner-ring"></div>
      <div class="spinner-ring"></div>
      <div class="spinner-ring"></div>
      <div class="spinner-ring"></div>
    </div>
    <p v-if="message" class="spinner-message">{{ message }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

// Props
interface Props {
  size?: 'small' | 'medium' | 'large';
  message?: string;
  overlay?: boolean;
  color?: string;
}

const props = withDefaults(defineProps<Props>(), {
  size: 'medium',
  message: '',
  overlay: false,
  color: '#006039'
});

// Computed
const containerClasses = computed(() => {
  const classes = ['loading-spinner-container'];
  if (props.overlay) classes.push('loading-spinner-container--overlay');
  return classes;
});

const spinnerClasses = computed(() => {
  const classes = ['loading-spinner'];
  classes.push(`loading-spinner--${props.size}`);
  return classes;
});
</script>

<style scoped>
.loading-spinner-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.loading-spinner-container--overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  z-index: 9998;
}

.loading-spinner {
  position: relative;
  display: inline-block;
}

/* Sizes */
.loading-spinner--small {
  width: 40px;
  height: 40px;
}

.loading-spinner--medium {
  width: 60px;
  height: 60px;
}

.loading-spinner--large {
  width: 80px;
  height: 80px;
}

.spinner-ring {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: 4px solid transparent;
  border-top-color: v-bind(color);
  border-radius: 50%;
  animation: spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
}

.spinner-ring:nth-child(1) {
  animation-delay: -0.45s;
}

.spinner-ring:nth-child(2) {
  animation-delay: -0.3s;
  opacity: 0.7;
}

.spinner-ring:nth-child(3) {
  animation-delay: -0.15s;
  opacity: 0.5;
}

.spinner-ring:nth-child(4) {
  opacity: 0.3;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.spinner-message {
  margin-top: 20px;
  font-size: 16px;
  color: #666;
  text-align: center;
  font-weight: 500;
}

/* Responsive */
@media (max-width: 768px) {
  .loading-spinner-container {
    padding: 15px;
  }

  .loading-spinner--small {
    width: 35px;
    height: 35px;
  }

  .loading-spinner--medium {
    width: 50px;
    height: 50px;
  }

  .loading-spinner--large {
    width: 70px;
    height: 70px;
  }

  .spinner-message {
    font-size: 14px;
    margin-top: 15px;
  }
}
</style>
