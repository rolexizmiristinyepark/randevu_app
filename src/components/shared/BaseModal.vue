<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="show"
        class="modal-overlay"
        @click="handleOverlayClick"
      >
        <Transition name="modal-slide">
          <div
            v-if="show"
            :class="modalClasses"
            @click.stop
          >
            <!-- Header -->
            <div v-if="$slots.header || title" class="modal-header">
              <slot name="header">
                <h3 class="modal-title">{{ title }}</h3>
              </slot>
              <button
                v-if="showCloseButton"
                class="modal-close"
                @click="handleClose"
                aria-label="Kapat"
              >
                ×
              </button>
            </div>

            <!-- Body -->
            <div class="modal-body">
              <slot></slot>
            </div>

            <!-- Footer -->
            <div v-if="$slots.footer" class="modal-footer">
              <slot name="footer"></slot>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';

// Props
interface Props {
  show: boolean;
  title?: string;
  size?: 'small' | 'medium' | 'large' | 'full';
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  show: false,
  title: '',
  size: 'medium',
  showCloseButton: true,
  closeOnOverlayClick: true,
  closeOnEscape: true
});

// Emits
interface Emits {
  (e: 'update:show', value: boolean): void;
  (e: 'close'): void;
}

const emit = defineEmits<Emits>();

// Computed
const modalClasses = computed(() => {
  const classes = ['modal-dialog'];
  classes.push(`modal-dialog--${props.size}`);
  return classes;
});

// Methods
function handleClose() {
  emit('update:show', false);
  emit('close');
}

function handleOverlayClick() {
  if (props.closeOnOverlayClick) {
    handleClose();
  }
}

function handleEscapeKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.closeOnEscape && props.show) {
    handleClose();
  }
}

// Watch for show changes to handle body scroll
watch(() => props.show, (newValue) => {
  if (newValue) {
    document.body.style.overflow = 'hidden';
    if (props.closeOnEscape) {
      document.addEventListener('keydown', handleEscapeKey);
    }
  } else {
    document.body.style.overflow = '';
    document.removeEventListener('keydown', handleEscapeKey);
  }
});
</script>

<style scoped>
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
  overflow-y: auto;
}

.modal-dialog {
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  max-height: 90vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

/* Sizes */
.modal-dialog--small {
  width: 100%;
  max-width: 400px;
}

.modal-dialog--medium {
  width: 100%;
  max-width: 600px;
}

.modal-dialog--large {
  width: 100%;
  max-width: 900px;
}

.modal-dialog--full {
  width: 95%;
  max-width: 1200px;
  max-height: 95vh;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
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
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-family: inherit;
}

.modal-close:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #2c3e50;
}

.modal-body {
  padding: 25px;
  flex: 1;
  overflow-y: auto;
}

.modal-footer {
  padding: 15px 25px;
  border-top: 2px solid #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

/* Transitions */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-slide-enter-active,
.modal-slide-leave-active {
  transition: all 0.3s ease;
}

.modal-slide-enter-from {
  transform: translateY(-30px);
  opacity: 0;
}

.modal-slide-leave-to {
  transform: translateY(30px);
  opacity: 0;
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .modal-overlay {
    padding: 10px;
  }

  .modal-dialog {
    max-height: 95vh;
  }

  .modal-dialog--small,
  .modal-dialog--medium,
  .modal-dialog--large,
  .modal-dialog--full {
    width: 100%;
    max-width: 100%;
  }

  .modal-header {
    padding: 15px 20px;
  }

  .modal-title {
    font-size: 18px;
  }

  .modal-body {
    padding: 20px;
  }

  .modal-footer {
    padding: 12px 20px;
  }
}

/* Scrollbar styling for modal body */
.modal-body::-webkit-scrollbar {
  width: 8px;
}

.modal-body::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.modal-body::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 4px;
}

.modal-body::-webkit-scrollbar-thumb:hover {
  background: #999;
}
</style>
