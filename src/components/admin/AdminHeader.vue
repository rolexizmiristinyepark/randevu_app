<template>
  <header class="admin-header">
    <div class="header-content">
      <div class="header-brand">
        <h1 class="brand-title">Rolex İzmir İstinyepark</h1>
        <span class="brand-subtitle">Yönetim Paneli</span>
      </div>

      <div class="header-actions">
        <button
          class="logout-btn"
          @click="handleLogout"
          title="Çıkış yap"
        >
          <span class="logout-icon">🚪</span>
          <span class="logout-text">Çıkış</span>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
// Emits
interface Emits {
  (e: 'logout'): void;
}

const emit = defineEmits<Emits>();

// Methods
function handleLogout() {
  if (confirm('Çıkış yapmak istediğinize emin misiniz?')) {
    emit('logout');
  }
}
</script>

<style scoped>
.admin-header {
  background: linear-gradient(135deg, #006039 0%, #00804d 100%);
  color: white;
  padding: 20px 30px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-brand {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.brand-title {
  font-size: 24px;
  font-weight: 700;
  margin: 0;
  color: white;
  letter-spacing: -0.5px;
}

.brand-subtitle {
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 15px;
}

.logout-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: inherit;
}

.logout-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.5);
  transform: translateY(-2px);
}

.logout-icon {
  font-size: 18px;
  line-height: 1;
}

.logout-text {
  line-height: 1;
}

@media (max-width: 768px) {
  .admin-header {
    padding: 15px 20px;
  }

  .brand-title {
    font-size: 18px;
  }

  .brand-subtitle {
    font-size: 11px;
  }

  .logout-btn {
    padding: 8px 16px;
    font-size: 14px;
  }

  .logout-icon {
    font-size: 16px;
  }
}

@media (max-width: 480px) {
  .brand-title {
    font-size: 16px;
  }

  .brand-subtitle {
    display: none;
  }

  .logout-text {
    display: none;
  }

  .logout-btn {
    padding: 8px 12px;
  }
}
</style>
