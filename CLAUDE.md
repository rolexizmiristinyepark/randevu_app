# Randevu Sistemi - Proje Rehberi

## Proje Ozeti
Rolex Istanbul butik randevu sistemi. GAS'tan Supabase'e gecis tamamlandi (Phase 0-7).
Frontend: Vite + TypeScript | Backend: Supabase Edge Functions (Deno) | DB: Supabase PostgreSQL (Frankfurt)

## Kritik Kurallar

1. **innerHTML YASAK** - Security hook bloklar. DOM API kullan (createElement/appendChild)
2. **JWT**: TUM edge functions `--no-verify-jwt` ile deploy edilmeli. Auth `requireAdmin()` ile function icinde kontrol ediliyor
3. **Turkce UI** - Tum kullanici-gorunur stringler Turkce
4. **`.env.development` gitignored** - commit etme
5. **`Object.defineProperty` icin `configurable: true`** - Vite HMR uyumlulugu (admin-auth.ts)
6. **Adapter pattern**: api-service.ts 89+ GAS action'i 13 Supabase Edge Function'a mapliyor

## Dosya Yapisi

```
supabase/functions/          # Backend Edge Functions
  _shared/                   # Ortak moduller
    cors.ts                  # CORS + JSON response helpers
    gmail-sender.ts          # Gmail SMTP (ESKI - artik kullanilmiyor)
    resend-sender.ts         # Resend API email sender (AKTIF)
    google-calendar.ts       # Google Calendar sync
    supabase-client.ts       # Supabase client + requireAdmin
    whatsapp-sender.ts       # WhatsApp Business API
    variables.ts             # Template degisken sistemi
    security.ts              # Turnstile, rate limit, audit log
    validation.ts            # Input validasyonu
    types.ts                 # Ortak tipler
  appointments/              # Randevu CRUD + slot + notification trigger
  auth/                      # Admin login/logout
  calendar-sync/             # Google Calendar sync
  config/                    # Profil/gun/saat/kapasite config
  links/                     # URL kisaltma
  mail/                      # Mail template/flow/info card CRUD
  notifications/             # Bildirim gonderimi (email + whatsapp)
  settings/                  # Genel ayarlar
  slack/                     # Slack webhook
  staff/                     # Personel CRUD
  webhook-whatsapp/          # WhatsApp incoming webhook
  whatsapp/                  # WhatsApp template CRUD

api-service.ts               # Frontend -> Edge Function adapter
admin-auth.ts                # Supabase Auth entegrasyonu
config-loader.ts             # Config yukleme ve cache
admin-panel.ts               # Admin panel mantigi
```

## Email Sistemi (AKTIF SORUN)

### Mimari
- `resend-sender.ts`: Resend HTTP API kullanir (sendEmail + sendGmail alias)
- `appointments/index.ts` satir 13: `import { sendGmail } from '../_shared/resend-sender.ts'`
- `notifications/index.ts` satir 11: Ayni import
- Env: `RESEND_API_KEY` (set edilmis), `ADMIN_EMAIL`, `GMAIL_USER`

### Notification Flow
1. Randevu olusturulunca `triggerAppointmentNotification()` cagirilir (appointments/index.ts:999)
2. `notification_flows` tablosundan `trigger='appointment_create'` olan aktif flow'lar cekilir
3. Her flow icin: WhatsApp template'leri + Mail template'leri islenip gonderilir
4. Sonuc `_debug.notification` olarak response'a eklenir

### Duzeltilen Buglar
- **appointments/index.ts:1025**: `return;` -> `return notifResult;` (DUZELTILDI)
- **appointments/index.ts: Admin email**: Staff tablosundan (is_admin=true, active=true) email alinarak tum admin'lere gonderiliyor (DUZELTILDI)
- **resend-sender.ts**: From adresi `istinye@kulahcioglu.com` (DOGRU)

### Resend Gecis Durumu
- Resend hesap: `istinyeparkrolex35` (resend.com), domain: `kulahcioglu.com`, region: EU
- Gonderici: `istinyepark@kulahcioglu.com`
- DNS kayitlari (DKIM, SPF, DMARC) IT'ye gonderildi - IT ekledi mi kontrol edilmeli
- `RESEND_API_KEY` Supabase secrets'a eklenmis
- `gmail-sender.ts` -> `resend-sender.ts` gecisi tamamlanmis (import'lar guncellenmis)

## Deploy

```bash
# Edge Function deploy (MUTLAKA --no-verify-jwt kullan!)
supabase functions deploy appointments --no-verify-jwt
supabase functions deploy notifications --no-verify-jwt
supabase functions deploy mail --no-verify-jwt
# ... diger functions icin de ayni

# Migration
supabase db push

# Frontend (GitHub Actions ile otomatik)
git push origin admiring-hypatia
```

## Dev Server

```bash
supabase start          # Lokal Supabase
npm run dev             # Frontend (port 3000)
supabase functions serve  # Edge Functions lokal test
```

## Supabase Secrets (Prod)
RESEND_API_KEY, ADMIN_EMAIL, GMAIL_USER, GMAIL_APP_PASSWORD,
GOOGLE_CALENDAR_ID, GOOGLE_SERVICE_ACCOUNT_KEY,
WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID,
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL

## Onemli Tablolar
- `appointments` - Randevular
- `staff` - Personel (is_admin, email, phone, active)
- `notification_flows` - Bildirim akislari (trigger, profiles, whatsapp_template_ids, mail_template_ids)
- `mail_templates` - Email sablonlari (recipient: customer/staff/admin)
- `whatsapp_templates` - WhatsApp sablonlari
- `mail_info_cards` - Email bilgi kartlari
- `message_log` - Tum gonderim loglari

## Button Utility
```typescript
import { ButtonAnimator } from '../button-utils';
ButtonAnimator.start(btn);    // Islem basinda
ButtonAnimator.success(btn);  // Basarili
ButtonAnimator.error(btn);    // Hata
```
