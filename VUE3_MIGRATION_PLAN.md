# Vue 3 Migration Plan

## Mevcut Durum

**Mimari**: Vanilla JavaScript (DOM manipulation)
**Dosyalar**:
- `app.js` (1200+ satır) - Monolithic customer app
- `admin-panel.js` (1300+ satır) - Monolithic admin app

**Sorunlar**:
- ❌ Manual DOM manipulation
- ❌ Event listener hell
- ❌ State management karmaşık
- ❌ Kod tekrarı
- ❌ Test edilemez
- ❌ Reactivity manuel

## Hedef Mimari: Vue 3 + Composition API

**Avantajlar**:
- ✅ Declarative UI
- ✅ Reactive state
- ✅ Component reusability
- ✅ TypeScript support
- ✅ Test edilebilir
- ✅ Modern developer experience

---

## Migration Strategy

### Phase 1: Infrastructure (✅ TAMAMLANDI)

**Yapılanlar**:
- ✅ Vue 3 installed (v3.5.24)
- ✅ @vitejs/plugin-vue installed
- ✅ vite.config.js updated with Vue plugin
- ✅ Example component created: `TimeSlotPicker.vue`

**vite.config.js**:
```javascript
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  // ...
});
```

---

### Phase 2: Component Library

**Hedef**: Mevcut UI'yi Vue component'larına dönüştür

#### Customer App Components

**src/components/customer/**

1. **AppointmentTypeSelector.vue**
   - Randevu tipi seçimi (Teslim, Görüşme, Servis)
   - Props: `selectedType`
   - Emits: `update:selectedType`

2. **StaffSelector.vue**
   - Personel seçimi
   - Props: `staffMembers`, `selectedStaffId`
   - Emits: `update:selectedStaffId`

3. **ShiftSelector.vue**
   - Vardiya seçimi (Sabah/Akşam/Full)
   - Props: `selectedShift`
   - Emits: `update:selectedShift`

4. **Calendar.vue**
   - Ay takvimi
   - Props: `currentMonth`, `availableDates`
   - Emits: `select-date`, `change-month`

5. **TimeSlotPicker.vue** (✅ ÖRNEK OLUŞTURULDU)
   - Saat seçimi
   - Props: `selectedDate`, `shiftType`, `appointmentType`
   - Emits: `select-slot`

6. **AppointmentForm.vue**
   - Müşteri bilgileri formu
   - Props: `appointmentDetails`
   - Emits: `submit`

7. **SuccessModal.vue**
   - Başarı bildirimi + takvim butonları
   - Props: `appointmentData`, `show`
   - Emits: `close`, `add-to-calendar`

#### Admin App Components

**src/components/admin/**

1. **AdminHeader.vue**
   - Header + logout button

2. **TabNavigation.vue**
   - Tab switcher (Ayarlar, Personel, Vardiya, Randevular)
   - Props: `activeTab`
   - Emits: `update:activeTab`

3. **SettingsPanel.vue**
   - Randevu ayarları + link'ler
   - Props: `settings`
   - Emits: `update:settings`

4. **StaffManager.vue**
   - Personel CRUD
   - Props: `staffList`
   - Emits: `add-staff`, `edit-staff`, `delete-staff`

5. **ShiftPlanner.vue**
   - Vardiya planlama
   - Props: `weekDate`, `shifts`
   - Emits: `save-shifts`

6. **AppointmentList.vue**
   - Randevu listesi
   - Props: `appointments`, `filterWeek`
   - Emits: `delete-appointment`

7. **WhatsAppSettings.vue**
   - WhatsApp API ayarları

8. **SlackSettings.vue**
   - Slack webhook ayarları

#### Shared Components

**src/components/shared/**

1. **BaseButton.vue**
   - Reusable button component

2. **BaseModal.vue**
   - Modal wrapper

3. **BaseAlert.vue**
   - Alert/notification component

4. **LoadingSpinner.vue**
   - Loading indicator

---

### Phase 3: State Management (Pinia veya Composables)

**Option A: Pinia (Recommended)**

```bash
npm install pinia
```

**stores/appointment.ts**:
```typescript
import { defineStore } from 'pinia';

export const useAppointmentStore = defineStore('appointment', {
  state: () => ({
    selectedDate: null,
    selectedStaff: null,
    selectedTime: null,
    selectedShiftType: 'full',
    selectedAppointmentType: null,
    staffMembers: [],
    // ...
  }),

  getters: {
    canSubmitAppointment(): boolean {
      return !!(
        this.selectedDate &&
        this.selectedStaff &&
        this.selectedTime &&
        this.selectedAppointmentType
      );
    }
  },

  actions: {
    async loadStaffMembers() {
      const result = await apiCall('getStaff');
      if (result.success) {
        this.staffMembers = result.data;
      }
    },

    async createAppointment(customerData) {
      // ...
    }
  }
});
```

**Option B: Composables (Lighter)**

**composables/useAppointment.ts**:
```typescript
import { ref, computed } from 'vue';

export function useAppointment() {
  const selectedDate = ref<string | null>(null);
  const selectedStaff = ref<string | null>(null);
  // ...

  const canSubmit = computed(() => {
    return !!(selectedDate.value && selectedStaff.value);
  });

  async function loadStaff() {
    // ...
  }

  return {
    selectedDate,
    selectedStaff,
    canSubmit,
    loadStaff
  };
}
```

---

### Phase 4: Router (Optional - SPA için)

**router/index.ts**:
```typescript
import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory('/randevu_app/'),
  routes: [
    {
      path: '/',
      name: 'customer',
      component: () => import('../views/CustomerView.vue')
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('../views/AdminView.vue'),
      meta: { requiresAuth: true }
    }
  ]
});
```

---

### Phase 5: Views (Top-level pages)

**src/views/CustomerView.vue**:
```vue
<template>
  <div class="customer-app">
    <AppointmentTypeSelector v-model="appointmentType" />
    <StaffSelector v-model="selectedStaff" :staff-members="staff" />
    <Calendar v-model="selectedDate" />
    <TimeSlotPicker
      :selected-date="selectedDate"
      :shift-type="shiftType"
      :appointment-type="appointmentType"
      @select-slot="onSlotSelect"
    />
    <AppointmentForm @submit="createAppointment" />
  </div>
</template>

<script setup lang="ts">
import { useAppointmentStore } from '../stores/appointment';

const store = useAppointmentStore();
// ...
</script>
```

**src/views/AdminView.vue**:
```vue
<template>
  <div class="admin-app">
    <AdminHeader />
    <TabNavigation v-model:active-tab="activeTab" />

    <SettingsPanel v-if="activeTab === 'settings'" />
    <StaffManager v-if="activeTab === 'staff'" />
    <ShiftPlanner v-if="activeTab === 'shifts'" />
    <AppointmentList v-if="activeTab === 'appointments'" />
  </div>
</template>
```

---

### Phase 6: Main Entry Points

**src/customer.ts** (new):
```typescript
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import CustomerView from './views/CustomerView.vue';
import { initMonitoring } from './monitoring.ts';

// Initialize monitoring
initMonitoring();

// Create Vue app
const app = createApp(CustomerView);

// Use Pinia
const pinia = createPinia();
app.use(pinia);

// Mount
app.mount('#app');
```

**src/admin.ts** (new):
```typescript
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import AdminView from './views/AdminView.vue';
import { initMonitoring } from './monitoring.ts';

initMonitoring();

const app = createApp(AdminView);
const pinia = createPinia();
app.use(pinia);

app.mount('#app');
```

**index.html**:
```html
<!DOCTYPE html>
<html lang="tr">
<head>
  <!-- ... -->
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/customer.ts"></script>
</body>
</html>
```

---

## Migration Checklist

### Phase 1: Infrastructure ✅
- [x] Vue 3 installation
- [x] Vite plugin configuration
- [x] Example component

### Phase 2: Components (In Progress)
- [ ] Create component structure
- [ ] TimeSlotPicker.vue (✅ ÖRNEK)
- [ ] AppointmentTypeSelector.vue
- [ ] StaffSelector.vue
- [ ] Calendar.vue
- [ ] AppointmentForm.vue
- [ ] SuccessModal.vue
- [ ] Admin components (8 adet)
- [ ] Shared components (4 adet)

### Phase 3: State Management
- [ ] Choose Pinia vs Composables
- [ ] Create stores/composables
- [ ] Migrate state from app.js
- [ ] Migrate state from admin-panel.js

### Phase 4: Views
- [ ] CustomerView.vue
- [ ] AdminView.vue

### Phase 5: Entry Points
- [ ] src/customer.ts
- [ ] src/admin.ts
- [ ] Update index.html
- [ ] Update admin.html

### Phase 6: Integration
- [ ] Connect components
- [ ] Wire up events
- [ ] Test all flows

### Phase 7: Testing
- [ ] Component tests (Vitest + @vue/test-utils)
- [ ] E2E tests (Playwright)

### Phase 8: Cleanup
- [ ] Remove app.js
- [ ] Remove admin-panel.js
- [ ] Update documentation

---

## Breaking Changes & Considerations

### 1. **Bundle Size**
Vue 3 runtime: ~40 kB (gzip)
- Mevcut customer chunk: 7.62 kB
- Vue ile: ~48 kB (still under 50 kB limit ✓)

### 2. **Browser Support**
Vue 3 requires ES2015+ (IE11 not supported)
- Modern browsers only ✓

### 3. **Learning Curve**
Team needs to learn:
- Composition API
- Reactive state
- Component lifecycle
- Vue directives

### 4. **Development Experience**
- ✅ Better DX with Vue DevTools
- ✅ Hot Module Replacement
- ✅ Component reusability
- ✅ TypeScript support

---

## Example: Before & After

### Before (Vanilla JS)

**app.js** (1200 lines):
```javascript
function displayAvailableTimeSlots() {
  const container = document.getElementById('timeSlots');
  container.innerHTML = ''; // Clear

  // Fetch data
  const result = await apiCall('getDayStatus', {...});

  // Manual DOM creation
  slots.forEach(slot => {
    const btn = document.createElement('div');
    btn.className = slot.isAvailable ? 'slot-btn' : 'slot-btn slot--disabled';
    btn.textContent = slot.time;
    btn.addEventListener('click', () => selectTimeSlot(slot));
    container.appendChild(btn);
  });
}
```

### After (Vue 3)

**TimeSlotPicker.vue** (150 lines):
```vue
<template>
  <div class="time-slots-grid">
    <button
      v-for="slot in slots"
      :key="slot.hour"
      :class="['slot-btn', { 'slot--disabled': !slot.isAvailable }]"
      @click="selectSlot(slot)"
    >
      {{ slot.time }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const slots = ref([]);

watch(() => props.selectedDate, async () => {
  const result = await apiCall('getDayStatus', {...});
  slots.value = result.data.slots;
});
</script>
```

✅ **Benefits**:
- Declarative (what, not how)
- Reactive (automatic updates)
- Testable (mount component, assert)
- Reusable (drop-in anywhere)
- TypeScript (type safety)

---

## Timeline Estimate

- **Phase 1**: Infrastructure ✅ (DONE)
- **Phase 2**: Components (2-3 weeks)
- **Phase 3**: State Management (1 week)
- **Phase 4-5**: Views + Entry (1 week)
- **Phase 6**: Integration (1 week)
- **Phase 7**: Testing (1 week)
- **Phase 8**: Cleanup (3 days)

**Total**: ~7-8 weeks for full migration

---

## Recommendation

**Gradual Migration**:
1. ✅ Start with infrastructure (DONE)
2. ✅ Create example component (DONE: TimeSlotPicker.vue)
3. Migrate one customer feature at a time
4. Run old & new side-by-side
5. Switch over when ready
6. Remove old code

**Not Recommended**:
- ❌ Big bang migration (risky)
- ❌ Migrate admin first (too complex)
- ❌ No component tests (regression risk)

---

## Next Steps

1. **Review TimeSlotPicker.vue** example
2. **Decide on state management** (Pinia vs Composables)
3. **Create component library** (one by one)
4. **Write component tests** (as you go)
5. **Integrate gradually** (feature by feature)

---

## Resources

- [Vue 3 Docs](https://vuejs.org)
- [Composition API](https://vuejs.org/guide/extras/composition-api-faq.html)
- [Pinia](https://pinia.vuejs.org)
- [@vue/test-utils](https://test-utils.vuejs.org)
- [Vite + Vue](https://vitejs.dev/guide/features.html#vue)

---

## Status

**Current**: Phase 1 complete (infrastructure + example)
**Next**: Create component library (Phase 2)
