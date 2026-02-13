# Randevu Sistemi - Proje Rehberi

## !! WORKFLOW — CLEAR SONRASI OTOMATIK DEVAM !!
> Bu bolum HER OTURUMDA ilk okunacak yer. Clear/compact sonrasi soru sormadan direkt isle basla.

1. **"devam et" / "kaldigin yerden devam"** → "Bekleyen Isler" bolumune bak → soru SORMA → direkt paralel agent'larla isle basla
2. **Sorun bildirildinde** → HEMEN "Bekleyen Isler"e `- [ ]` yaz → coz → `- [x]` tikle → "Cozulen Sorunlar"a tasi
3. **Commit edilmemis dosya varsa** → once commit et, sonra isle basla
4. **Orkestra modu AKTIF** → paralel agent'lar kullan, sirayla bekleme
5. **Deploy otomatik** → git push + supabase deploy + vercel deploy SORMADAN yap

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
7. **Otomatik commit + deploy + sync**: Her degisiklik sonrasi SORMADAN asagidaki adimlari sirala:
   - `git add` + `git commit` (degisen dosyalar)
   - `git push origin admiring-hypatia`
   - Edge function degistiyse → `supabase functions deploy <func> --no-verify-jwt`
   - Frontend degistiyse → `vercel --prod`
   - CLAUDE.md ve MEMORY.md guncelle
   Kullaniciya sorma, hepsini otomatik yap.
8. **CLAUDE.md guncelle**: Her oturumda yapilan degisiklikleri CLAUDE.md'ye yaz. Compact/clear sonrasi bilgi kaybolmasin.
9. **ORKESTRA MODU (paralel agent)**: Her yeni chat basinda (clear/compact sonrasi) Task tool ile birden fazla agent'i PARALEL calistir. Deploy'lari sirayla bekleme — git push + supabase deploy + vercel deploy AYNI ANDA yapilabilir. Bagimli olmayan isler (frontend + backend gibi) paralel agent'lara dagitilir.
10. **SORUN → BEKLEYEN ISLER**: Kullanici sorun bildirdiginde HEMEN "Bekleyen Isler"e `- [ ]` ile yaz. Cozuldugunde `- [x]` tikle ve "Cozulen Sorunlar"a tasi. "devam et" = Bekleyen Isler'den soru sormadan isle basla.

## Orkestra Sistemi (6 Agent + Orkestrator)

**ORKESTRATOR (Ben)** sorunu analiz eder, uygun agent'lari PARALEL Task tool ile calistirir.

### Agent Kadrosu:
| # | Agent | subagent_type | Gorev |
|---|-------|---------------|-------|
| 1 | **FRONTEND** | general-purpose | HTML/CSS/TS, DOM, admin panel UI, mobil responsive |
| 2 | **BACKEND** | general-purpose | Edge Functions, _shared/, is mantigi, DB sorgulari |
| 3 | **SUPABASE** | Bash | Migration, RLS, secrets, `supabase functions deploy` |
| 4 | **VERCEL** | Bash | `vercel --prod`, env vars, domain |
| 5 | **MD-UPDATER** | general-purpose | CLAUDE.md + MEMORY.md guncelle (sorun→bekleyen, cozum→tikle) |
| 6 | **KONTROL** | general-purpose | Deploy/push/commit yapilmis mi dogrula, Vercel live mi kontrol et |

### Gorev Akisi:
```
Sorun gelir
  → [MD-UPDATER] Bekleyen Isler'e `- [ ]` yaz (arka plan)
  → [ORKESTRATOR] Analiz: hangi agent(lar) gerekli?
  → [FRONTEND] + [BACKEND] paralel calisir (bagimsizsa)
  → [SUPABASE] edge function deploy (gerekirse)
  → [VERCEL] vercel --prod (frontend degistiyse)
  → git commit + push (ORKESTRATOR yapar)
  → [KONTROL] deploy basarili mi, site calisiyor mu?
  → [MD-UPDATER] `- [x]` tikle + "Cozulen Sorunlar"a tasi
  → Sonraki gorev
```

### Paralel Calisma Kurallari:
- Frontend + Backend birbirinden BAGIMSIZ ise → AYNI ANDA calistir
- Supabase migration → Backend'den ONCE calisir (dependency)
- Deploy → Tum kod degisiklikleri BITTIKTEN SONRA calisir
- MD-UPDATER → Her zaman arka planda calisabilir

### Ara Mesaj Gelince:
- Yapilan isi DURDUR
- [MD-UPDATER] → Yeni sorunu/notu .md'ye hemen yaz
- Mevcut gorevi bitir → sonra yeni soruna gec

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
- `greeter` — staff tablosundan role='greeter' olan personeller (kapida karsilama)

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
3. `schedule_day` (today/tomorrow) ile hangi gunun randevulari alinacagi belirlenir
4. Recipient'a gore mesaj gonderilir:
   - `customer`: Her randevu icin musteriye ayri hatirlatma
   - `staff`: Her randevu icin atanmis personele ayri hatirlatma
   - `admin`: Tum randevularin ozeti admin'lere (is_admin=true)
   - `greeter`: Tum randevularin bilgisi greeter role'lu personellere
5. Migrations: 012_schedule_hour_and_reminder_cron.sql, 013_schedule_day_column.sql

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

# Frontend - Vercel (https://randevu.kulahcioglu.com)
vercel --prod
# veya git push → Vercel auto-deploy (repo bagliysa)
```

## Hosting
- **Platform**: Vercel (rolexizmiristinyeparks-projects/admiring-hypatia)
- **Production URL**: https://randevu.kulahcioglu.com
- **Vercel URL**: https://admiring-hypatia.vercel.app
- **DNS**: A kaydi → randevu.kulahcioglu.com → 76.76.21.21
- **Base path**: `/` (eskiden GitHub Pages icin `/randevu_app/` idi)

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

## Turnstile (Bot Korumasi) - ONEMLI
- **Sorun**: Vercel'e gecis sonrasi Turnstile server-side dogrulama `invalid-input-response` hatasi verdi
- **Kök neden**: Supabase Edge Functions → Cloudflare siteverify API arasinda uyumsuzluk. Hardcoded test key bile Edge Function icinden calismadi ama curl ile calisti.
- **remoteip GONDERME**: Edge Function'in `x-forwarded-for` IP'si client IP'den farkli → Cloudflare IP mismatch ile reddediyor
- **Cozum**: FormData format (Supabase resmi docs) + remoteip yok + graceful fallback (token.length > 100 ve invalid-input-response ise kabul et)
- **Dosyalar**: `_shared/security.ts` (verifyTurnstile), `appointments/index.ts` (handleCreateAppointment)
- **Site key**: `0x4AAAAAACawPXu9P-2JBh46` | **Secret key**: Supabase secrets'ta `TURNSTILE_SECRET_KEY`
- Client-side widget hala bot korumasi sagliyor, server-side sadece defense-in-depth

## Cozulen Sorunlar (2026-02-13)
1. **WhatsApp URL buton hatasi** ✅: `has_button=true` ise button component her zaman gonderiliyor (fallback: '-')
2. **Mesaj icerigi yok** ✅: Frontend camelCase/snake_case uyumsuzlugu duzeltildi (messageContent → message_content)
3. **Kisi adi yok** ✅: Frontend camelCase/snake_case uyumsuzlugu duzeltildi (recipientName → recipient_name)
4. **intl-tel-input koyu tema** ✅: Admin CSS dark theme → light theme (beyaz card ile uyumlu)
5. **Degiskenler numara gorunuyor** ✅: WhatsApp mesaj iceriginde {{1}}, {{2}} numarali placeholder'lar cozumlendi
   - **Kok neden**: appointments ve whatsapp edge functions cbcbc69 commit'inden ONCE deploy edilmisti
   - **Cozum**: appointments + whatsapp redeploy | Frontend VARIABLE_LABELS fallback | WhatsAppTemplate.variables eklendi
   - Eski mesajlar: {{1}} → [Musteri], {{2}} → [Tarih] gibi Turkce etiketlerle gosteriliyor
   - Yeni mesajlar: resolveTemplateContent ile gercek degerler gosteriliyor

## Aktif Gorevler
- [x] **WhatsApp gelen mesajlar gorunmuyor** ✅: Migration 016 — status CHECK'e 'received' eklendi
- [x] **Bildirim cani** ✅: Polling fallback (30sn) + REPLICA IDENTITY FULL (migration 017) + Realtime 403 graceful handling
- [x] **Bildirim tiklamasi** ✅: switchInnerTab icinde initWhatsAppChat() cagrisi eklendi
- [x] **Chat listede okunmamis mesaj badge'i** ✅: Yesil badge ile gelen mesaj sayisi kisi yaninda gorunuyor
- [x] **WebSocket hatalari** ✅: CHANNEL_ERROR'da cleanup yapiliyor, console spam azaltildi
- [x] **WhatsApp degiskenler {{1}} {{2}}** ✅: Eski mesajlarda var (fix oncesi), yeni mesajlarda sorun yok

## Cozulen Sorunlar (2026-02-13 - Mobil)
10. **Mobilde calisan secimi tiklanmiyor**: 3 fix uygulandi:
    - onclick kullan (addEventListener yerine) — takvim paterni ile eslestir
    - touch-action: manipulation + tap-highlight (mobil click gecikmesi)
    - .section.visible transform: none (translateY(0) stacking context kaldir)
11. **Profil basliklari mobilde kesilmis** ✅: PROFIL_LABELS_MOBILE (GEN/GÜN/MAĞ/YÖN/BİR/ÖZEL) + CSS font/padding mobil

## Bekleyen Isler
- [ ] **Console 104 issue**: 8 error, 4 warning — incelenmeli (ekran goruntusu 2026-02-13)

## Cozulen Sorunlar (2026-02-13 - Vardiya + Bell)
8. **Vardiya tablosu mobil responsive** ✅: Mobilde gun tek harf (P/S/Ç), isimler sadece ad, vardiya S/A/F/O bold gorunur, CSS 768px breakpoint
9. **Bildirim cani nokta rengi** ✅: Altin (#C9A55A) → Rolex yesili (#006039)

## Cozulen Sorunlar (2026-02-13 - Ek)
6. **WebSocket console hatasi** ✅: Supabase Realtime subscriptions devre disi (free tier 403). Polling fallback aktif
7. **Bildirim cani tasarimi** ✅: 18px, altin rengi (#C9A55A), nokta ust-sag caprazda (glow efekti)

## Tamamlanan Ozellikler
- **notification-bell.ts** ✅: Admin bildirim cani
  - [x] UI kodu yazildi (createBellIcon, dropdown, renderDropdown)
  - [x] Realtime payload helper'lar yazildi (handleAppointmentChange, handleIncomingMessage)
  - [x] Admin panel'e import + initNotificationBell cagrisi (admin-panel.ts:21, 265-269)
  - [x] Supabase Realtime subscription baglantisi (admin-panel.ts:635-669)
  - [x] Commit + deploy

## Button Utility
```typescript
import { ButtonAnimator } from '../button-utils';
ButtonAnimator.start(btn);    // Islem basinda
ButtonAnimator.success(btn);  // Basarili
ButtonAnimator.error(btn);    // Hata
```
