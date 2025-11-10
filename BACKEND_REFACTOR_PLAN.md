# Backend Modülerleştirme Planı

## Mevcut Durum

**Dosya**: `apps-script-backend.js`
**Boyut**: 3385 satır
**Sorun**: Tek bir dev dosyada tüm backend logic → Bakım zorluğu, test edilemezlik

## Hedef Modüler Yapı

### 1. **config.js** (60 satır)
```javascript
const DEBUG = false;
const CONFIG = { ... };
const log = { ... };

// Exports (Google Apps Script global scope)
```

**İçerik**:
- DEBUG flag
- CONFIG objesi (calendar, timezone, company info, etc.)
- log utility (debug mode ile)

---

### 2. **pii-utils.js** (50 satır)
```javascript
/**
 * PII (Personally Identifiable Information) Utilities
 * KVKK/GDPR uyumlu maskeleme
 */

function maskEmail(email) { ... }
function maskPhone(phone) { ... }
```

**İçerik**:
- maskEmail()
- maskPhone()
- PII-safe logging helpers

---

### 3. **date-utils.js** (80 satır)
```javascript
/**
 * Date & Time Utilities
 * Epoch-minute standard for time comparisons
 */

function dateTimeToEpochMinute(date, time) { ... }
function dateToEpochMinute(dateObj) { ... }
function checkTimeOverlap(start1, end1, start2, end2) { ... }
function getDateRange(dateStr) { ... }
function formatAppointmentDateTime(dateStr, timeStr) { ... }
```

**İçerik**:
- Tarih formatlamaları
- Epoch-minute dönüşümleri
- Time overlap detection

---

### 4. **slot-utils.js** (200 satır)
```javascript
/**
 * Slot Universe & Business Rules
 * Randevu slot yönetimi ve validasyon
 */

const SLOT_UNIVERSE = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const SHIFT_SLOT_FILTERS = { ... };

function getSlotsByShift(shiftType) { ... }
function getDailySlots(date, shiftType) { ... }
function isSlotFree(date, hour) { ... }
function getDeliveryCount(date) { ... }
function getDeliveryCountByStaff(date, staffId) { ... }
function validateReservation(payload) { ... }
function getDayStatus(date, appointmentType) { ... }
```

**İçerik**:
- SLOT_UNIVERSE sabit dizisi
- Shift filtreler (morning/evening/full)
- Slot availability checking
- Delivery limits (global + per-staff)
- Validation master function

---

### 5. **calendar-service.js** (150 satır)
```javascript
/**
 * Google Calendar Integration
 * Takvim CRUD operations
 */

function getCalendar() { ... }
function mapEventToAppointment(event) { ... }
function getGoogleCalendarEvents(startDateStr, endDateStr, staffId) { ... }
function getAppointments(date, options) { ... }
function getWeekAppointments(startDateStr, endDateStr) { ... }
function getMonthAppointments(month) { ... }
function deleteAppointment(eventId) { ... }
```

**İçerik**:
- Calendar instance getter
- Event CRUD operations
- Mapping helpers (Calendar Event → Appointment)

---

### 6. **email-service.js** (300 satır)
```javascript
/**
 * Email Notifications
 * Müşteri + Staff email templates
 */

function generateEmailTemplate(type, data) { ... }
function getCustomerEmailTemplate(data) { ... }
function getStaffEmailTemplate(data) { ... }
function generateCustomerICS(data) { ... }
```

**İçerik**:
- HTML email templates
- ICS calendar file generation
- Email sending logic

---

### 7. **whatsapp-service.js** (250 satır)
```javascript
/**
 * WhatsApp Business Cloud API
 * Meta Business integration
 */

function sendWhatsAppMessage(phoneNumber, customerName, appointmentDateTime, staffName, appointmentType, staffPhone) { ... }
function getTodayWhatsAppReminders(date) { ... }
function sendWhatsAppReminders(date, apiKey) { ... }
```

**İçerik**:
- WhatsApp Cloud API calls
- Message formatting
- Reminder system
- API error handling

---

### 8. **slack-service.js** (50 satır)
```javascript
/**
 * Slack Webhook Integration
 * Bildirimler için Slack
 */

function sendSlackNotification(message, channel) { ... }
```

**İçerik**:
- Slack webhook calls
- Notification formatting

---

### 9. **staff-service.js** (150 satır)
```javascript
/**
 * Staff Management
 * Personel CRUD operations
 */

function getStaff() { ... }
function addStaff(name, phone, email) { ... }
function toggleStaff(staffId) { ... }
function removeStaff(staffId) { ... }
function updateStaff(staffId, name, phone, email) { ... }
function validateAndSanitizeStaff(name, phone, email) { ... }
```

**İçerik**:
- Staff CRUD
- Staff validation
- Staff shift management

---

### 10. **appointment-service.js** (500 satır)
```javascript
/**
 * Appointment Management
 * Randevu CRUD + business logic
 */

function createAppointment(params) { ... }
function createManualAppointment(params) { ... }
function checkTimeSlotAvailability(date, staffId, shiftType, appointmentType, interval) { ... }
```

**İçerik**:
- Appointment creation (customer-facing)
- Manual appointment creation (admin)
- Availability checking
- Business rule enforcement
- Email/WhatsApp notifications trigger

---

### 11. **auth-service.js** (120 satır)
```javascript
/**
 * Authentication & Authorization
 * Admin API key management
 */

function generateApiKey() { ... }
function saveApiKey(key) { ... }
function getApiKey() { ... }
function validateApiKey(providedKey) { ... }
function regenerateApiKey(oldKey) { ... }
function initializeApiKey() { ... }
```

**İçerik**:
- API key generation
- API key validation
- API key rotation

---

### 12. **rate-limit-service.js** (150 satır)
```javascript
/**
 * Security & Abuse Prevention
 * Rate limiting + Cloudflare Turnstile
 */

function checkRateLimit(identifier) { ... }
function verifyTurnstileToken(token) { ... }
```

**İçerik**:
- Rate limiting (10 requests / 10 min)
- Turnstile verification
- IP/identifier tracking

---

### 13. **storage-service.js** (100 satır)
```javascript
/**
 * Data Storage
 * Script Properties CRUD
 */

function getData() { ... }
function saveData(data) { ... }
function resetData() { ... }
```

**İçerik**:
- Script Properties operations
- Staff data persistence
- Shift data persistence
- Settings persistence

---

### 14. **cache-service.js** (50 satır)
```javascript
/**
 * Caching Layer
 * CacheService wrapper
 */

function getCache() { ... }
```

**İçerik**:
- CacheService instance
- Cache helpers

---

### 15. **main.js** (200 satır)
```javascript
/**
 * Main Entry Point
 * doGet/doPost handlers + routing
 */

function doGet(e) { ... }

const ACTION_HANDLERS = {
  getStaff: (e) => getStaff(),
  addStaff: (e) => addStaff(...),
  createAppointment: (e) => createAppointment(...),
  // ... all actions
};
```

**İçerik**:
- doGet handler (API endpoint)
- Action routing
- Request validation
- Response formatting

---

## Deployment Strategy

### Option 1: Monolith (Mevcut)
**Pros**: Tek dosya, kolay deploy
**Cons**: 3385 satır, bakım zorluğu

**Kullanım**:
```bash
# Manuel olarak Google Apps Script'e yapıştır
# Deploy → New Deployment → Web App
```

---

### Option 2: Clasp (Modular)
**Pros**: Modüler yapı, version control, test edilebilir
**Cons**: clasp setup gerekli, Google hesap erişimi

**Kurulum**:
```bash
# 1. clasp kurulumu
npm install -g @google/clasp

# 2. Google Apps Script API aktif et
# https://script.google.com/home/usersettings

# 3. Login
clasp login

# 4. Yeni proje oluştur veya mevcut projeye bağlan
clasp create --title "Rolex Randevu Backend"
# veya
clasp clone <SCRIPT_ID>

# 5. Dosya yapısı
backend/
├── config.js
├── pii-utils.js
├── date-utils.js
├── slot-utils.js
├── calendar-service.js
├── email-service.js
├── whatsapp-service.js
├── slack-service.js
├── staff-service.js
├── appointment-service.js
├── auth-service.js
├── rate-limit-service.js
├── storage-service.js
├── cache-service.js
├── main.js
└── appsscript.json

# 6. Push to Google Apps Script
clasp push

# 7. Deploy
clasp deploy --description "Modular backend v1"
```

**clasp.json**:
```json
{
  "scriptId": "YOUR_SCRIPT_ID",
  "rootDir": "./backend"
}
```

**appsscript.json**:
```json
{
  "timeZone": "Europe/Istanbul",
  "dependencies": {
    "enabledAdvancedServices": [
      {
        "userSymbol": "Calendar",
        "version": "v3",
        "serviceId": "calendar"
      }
    ]
  },
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE"
  }
}
```

---

## Migration Checklist

- [ ] **Faz 1**: Utility modülleri ayır
  - [ ] config.js
  - [ ] pii-utils.js
  - [ ] date-utils.js
  - [ ] slot-utils.js

- [ ] **Faz 2**: Service modülleri ayır
  - [ ] calendar-service.js
  - [ ] email-service.js
  - [ ] whatsapp-service.js
  - [ ] slack-service.js

- [ ] **Faz 3**: Business logic modülleri
  - [ ] staff-service.js
  - [ ] appointment-service.js
  - [ ] auth-service.js
  - [ ] rate-limit-service.js
  - [ ] storage-service.js

- [ ] **Faz 4**: Main handler
  - [ ] main.js
  - [ ] ACTION_HANDLERS routing

- [ ] **Faz 5**: Testing
  - [ ] Unit tests (clasp + gas-local emulator)
  - [ ] Integration tests

- [ ] **Faz 6**: Deployment
  - [ ] clasp push
  - [ ] Deploy as Web App
  - [ ] Test production endpoints

---

## Notlar

1. **Global Scope**: Google Apps Script tüm fonksiyonları global scope'ta çalıştırır. Modüller arası import/export yok, sadece dosya sıralaması önemli.

2. **Execution Order**: Google Apps Script dosyaları alfabetik sırada yürütülür. Bu yüzden:
   - `01-config.js`
   - `02-pii-utils.js`
   - ...
   - `99-main.js`

3. **Testing**: Google Apps Script'te test yazmak için:
   - [gas-local](https://github.com/mzagorny/gas-local) emulator
   - [GasT](https://github.com/zixia/gast) test framework
   - [Clasp + Jest](https://github.com/googleapis/clasp)

4. **Alternative**: Backend'i tamamen Node.js + Express'e taşımak ve Google Calendar API kullanmak (büyük refactor).

---

## Sonuç

Backend modülerleştirmesi **manuel clasp deployment** gerektirir. Bu rehber kullanılarak:
1. Modül yapısı oluşturulabilir
2. clasp ile deploy edilebilir
3. Version control altına alınabilir
4. Test edilebilir hale gelir

**Tavsiye**: Production'da hemen değil, test ortamında önce deneyin.
