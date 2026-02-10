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
7. **Otomatik commit + deploy**: Her degisiklik sonrasi SORMADAN commit yap. Edge function degisti ise deploy et. Kullaniciya sorma, direkt yap.
8. **CLAUDE.md guncelle**: Her oturumda yapilan degisiklikleri CLAUDE.md'ye yaz. Compact/clear sonrasi bilgi kaybolmasin.

## Dosya Yapisi

```
supabase/functions/          # Backend Edge Functions
  _shared/                   # Ortak moduller
    cors.ts                  # CORS + JSON response helpers
    gmail-sender.ts          # Gmail SMTP (ESKI - artik kullanilmiyor)
    resend-sender.ts         # Resend API email sender (AKTIF)
    google-calendar.ts       # Calendar sync/update/delete
    supabase-client.ts       # Supabase client + requireAdmin
    whatsapp-sender.ts       # WhatsApp Business API + buildEventData
    variables.ts             # Template degisken sistemi + triggers + recipients
    security.ts              # Turnstile, rate limit, audit log
    validation.ts            # Input validasyonu
    types.ts                 # Ortak tipler
  appointments/              # Randevu CRUD + slot + notification trigger
  notifications/             # Bildirim: email/whatsapp/ICS + zamanlanmis hatirlatma
  mail/                      # Mail template/flow/info card CRUD
  auth/ config/ staff/ settings/ links/ slack/
  whatsapp/ webhook-whatsapp/ calendar-sync/

admin/unified-flow-manager.ts  # Admin panel bildirim akis yonetimi
api-service.ts                 # Frontend -> Edge Function adapter
admin-auth.ts                  # Supabase Auth
config-loader.ts               # Config yukleme ve cache
```

## Bildirim Sistemi (TAMAMLANDI)

### Trigger'lar (variables.ts MESSAGE_TRIGGERS)
- `appointment_create` — Randevu olusturulunca (createAppointment)
- `appointment_cancel` — Randevu iptal edilince (deleteAppointment)
- `appointment_update` — Randevu tarih/saat degisince (updateAppointment)
- `appointment_assign` — Personel ataninca (assignStaffToAppointment)
- `HATIRLATMA` — Zamanlanmis hatirlatma (pg_cron, her saat basinda)

### Recipient'lar (variables.ts MESSAGE_RECIPIENTS)
- `admin` — staff tablosundan is_admin=true olanlarin emailleri
- `customer` — Randevu sahibi musteri
- `staff` — Atanmis personel
- `today_customers` — Bugunun randevulu musterileri (hatirlatma)
- `today_staffs` — Bugunun randevulu personelleri (hatirlatma)
- `tomorrow_customers` — Yarinin randevulu musterileri
- `tomorrow_staffs` — Yarinin randevulu personelleri

### Template Degiskenleri (variables.ts MESSAGE_VARIABLES)
| Degisken | Aciklama | eventData field |
|----------|----------|-----------------|
| `{{musteri}}` | Musteri adi soyadi | customerName |
| `{{musteri_tel}}` | Musteri telefonu | customerPhone |
| `{{musteri_mail}}` | Musteri emaili | customerEmail |
| `{{randevu_tarihi}}` | Turkce tarih (25 Ocak 2025, Cumartesi) | date |
| `{{randevu_saati}}` | Saat (14:00) | time (start_time:0-5) |
| `{{randevu_ek_bilgi}}` | Musteri notu | customerNote |
| `{{personel}}` | Personel adi | staffName |
| `{{personel_id}}` | Personel ID | staffId |
| `{{personel_tel}}` | Personel telefonu | staffPhone |
| `{{personel_mail}}` | Personel emaili | staffEmail |
| `{{randevu_turu}}` | Tur etiketi (Gorusme/Teslim/...) | appointmentType |
| `{{randevu_profili}}` | Profil etiketi (Genel/Walk-in/...) | profile |
| `{{profil_sahibi}}` | Profil sahibi personel | linkedStaffName |

### Randevu Turleri (DB constraint)
delivery, shipping, meeting, service, management

### Profil Kodlari
g=Genel, w=Walk-in, b=Magaza, m=Yonetim, s=Bireysel, v=Ozel Musteri

### Zamanlanmis Hatirlatma Akisi
1. pg_cron her saat basinda `triggerScheduledReminders` action'i cagirir
2. Istanbul saatine gore notification_flows tablosunda `trigger='HATIRLATMA'` ve `schedule_hour=currentHour` eslesen flow'lar bulunur
3. today/tomorrow randevulari cekilir, template'deki recipient'a gore ilgili kisilere gonderilir
4. Migration: 012_schedule_hour_and_reminder_cron.sql

## Google Calendar Sync (TAMAMLANDI)
| Islem | Calendar | Fonksiyon |
|-------|----------|-----------|
| createAppointment | Event olustur | syncAppointmentToCalendar |
| createManualAppointment | Event olustur | syncAppointmentToCalendar |
| updateAppointment | Event guncelle | updateCalendarEvent |
| assignStaffToAppointment | Baslik guncelle | updateCalendarEvent |
| deleteAppointment | Event sil | deleteCalendarEvent |

Calendar baslik formati: `Musteri - Personel (Profil) / Tur`

## Email Sistemi (TAMAMLANDI)
- Resend HTTP API (resend-sender.ts), gonderici: `istinye@kulahcioglu.com`
- Admin email: staff tablosundan is_admin=true (ADMIN_EMAIL env var DEGIL)
- DNS dogrulanmis, RESEND_API_KEY set edilmis
- Test basarili (2025-02-10)

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

## Supabase Secrets (Prod)
RESEND_API_KEY, ADMIN_EMAIL, GMAIL_USER, GMAIL_APP_PASSWORD,
GOOGLE_CALENDAR_ID, GOOGLE_SERVICE_ACCOUNT_KEY,
WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID,
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL

## Onemli Tablolar
- `appointments` — Randevular (google_event_id, appointment_type, profile, staff_id)
- `staff` — Personel (is_admin, email, phone, active)
- `notification_flows` — Bildirim akislari (trigger, schedule_hour, profiles, wa/mail template ids)
- `mail_templates` — Email sablonlari (recipient: customer/staff/admin)
- `whatsapp_templates` — WhatsApp sablonlari (target_type: customer/staff/admin)
- `mail_info_cards` — Email bilgi kartlari
- `message_log` — Tum gonderim loglari

## Button Utility
```typescript
import { ButtonAnimator } from '../button-utils';
ButtonAnimator.start(btn);    // Islem basinda
ButtonAnimator.success(btn);  // Basarili
ButtonAnimator.error(btn);    // Hata
```
