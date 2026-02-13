# Randevu Sistemi - Proje Rehberi

> **Bu dosya Claude Code'un beynidir.** Her `/clear` sonrasi bu dosya okunur ve kaldigin yerden devam edilir.

---

## !! CLEAR SONRASI PROTOKOL !!

1. **Bu dosyayi oku** — Gorev durumlarini tara
2. **Oncelik sirasi:**
   - 🟡 Yarim kalan isler (EN ONCELIKLI)
   - 🔴 Bekleyen isler
   - 🟢 Tamamlanmis ama deploy edilmemis isler
3. **Soru SORMA** — direkt paralel agent'larla isle basla
4. **Commit edilmemis dosya varsa** → once commit et
5. **Deploy otomatik** → git push + supabase deploy + vercel deploy SORMADAN yap

---

## 📋 GOREV DURUMU

### 🔴 BEKLEYEN
<!-- Kullanici yeni is soylediginde buraya ekle -->
<!-- Format: - [ ] #ID | Aciklama | Oncelik: Yuksek/Orta/Dusuk -->

- [ ] #1 | Console 104 issue — DOM null safety + gereksiz console.log temizligi | Oncelik: Dusuk
- [ ] #17 | WhatsApp sohbet silme butonu (kişi barı sağ üst) | Oncelik: Orta
- [ ] #18 | WhatsApp 24 saat kuralı — aynı gün sohbetlerde serbest mesaj gönderme | Oncelik: Yuksek

### 🟡 COZUME DEVAM EDIYOR
<!-- Is basladiginda buraya tasi -->

_(Yok)_

### 🟢 TAMAMLANAN (deploy bekliyor)
<!-- Cozum bitti ama deploy edilmedi -->

_(Yok)_

### ✅ DEPLOY EDILDI
<!-- commit + push + deploy sonrasi buraya tasi ve tick at -->

- [x] #17 + #18 | WA sohbet silme + 24h serbest mesaj cevaplama | 2026-02-13
- [x] #16 | Bildirim harf ikonlari (W,+,~,x,>) kaldirildi | 2026-02-13
- [x] #15 | Logout+bell altin renk, desktop metin buton, mobil ikon | 2026-02-13
- [x] #14 | WhatsApp admin mesajlari kirmizi (#be0200) | 2026-02-13
- [x] #13 | Randevu kartlari mobilde dikey layout (butonlar alt) | 2026-02-13
- [x] #12 | Bildirim kartlari yazi stili tutarliligi (WA flow → diger kartlarla ayni) | 2026-02-13
- [x] #11 | Takvim filtresi onlytoday → takvim gizle + bugun otomatik sec | 2026-02-13
- [x] #2 | WhatsApp URL buton + mesaj icerigi + kisi adi fix | 2026-02-13
- [x] #3 | intl-tel-input koyu tema → light theme | 2026-02-13
- [x] #4 | WhatsApp degiskenler {{1}} {{2}} cozumleme | 2026-02-13
- [x] #5 | Mobilde calisan secimi tiklanmiyor (onclick + touch-action) | 2026-02-13
- [x] #6 | Profil basliklari mobilde PROFIL_LABELS_MOBILE | 2026-02-13
- [x] #7 | Vardiya tablosu mobil responsive | 2026-02-13
- [x] #8 | Bildirim cani (notification-bell.ts) | 2026-02-13
- [x] #9 | Header ikonlari sag ust (SVG logout + bell gri) | 2026-02-13
- [x] #10 | Mobil kart layout 5 alan (flow/staff/randevu/profil) | 2026-02-13

---

## 🤖 ORKESTRA SISTEMI

**ORKESTRATOR (Ben)** sorunu analiz eder, uygun agent'lari PARALEL Task tool ile calistirir.

| # | Agent | subagent_type | Gorev |
|---|-------|---------------|-------|
| 1 | **FRONTEND** | general-purpose | HTML/CSS/TS, DOM, admin panel UI, mobil responsive |
| 2 | **BACKEND** | general-purpose | Edge Functions, _shared/, is mantigi, DB sorgulari |
| 3 | **SUPABASE** | Bash | Migration, RLS, secrets, `supabase functions deploy` |
| 4 | **VERCEL** | Bash | `vercel --prod`, env vars, domain |
| 5 | **MD-UPDATER** | general-purpose (haiku) | CLAUDE.md + MEMORY.md guncelle, arka planda |
| 6 | **KONTROL** | general-purpose | Deploy dogrula, site canli mi kontrol et |

### Gorev Akisi:
```
KULLANICI MESAJI
  → [MD-UPDATER] 🔴 BEKLEYEN'e ekle (arka plan)
  → [ORKESTRATOR] Analiz: hangi agent(lar)?
  → [FRONTEND] + [BACKEND] paralel (bagimsizsa)
  → [SUPABASE] deploy (gerekirse)
  → [VERCEL] vercel --prod (frontend degistiyse)
  → git commit + push (ORKESTRATOR)
  → [MD-UPDATER] ✅ DEPLOY EDILDI'ye tasi + tick
```

### Paralel Kurallar:
- Frontend + Backend BAGIMSIZ → AYNI ANDA
- Supabase migration → Backend'den ONCE
- Deploy → Kod degisiklikleri BITTIKTEN SONRA
- MD-UPDATER → Her zaman arka planda

---

## Kritik Kurallar

1. **innerHTML YASAK** — Security hook bloklar. DOM API kullan
2. **JWT**: TUM edge functions `--no-verify-jwt` ile deploy
3. **Turkce UI** — Tum kullanici stringler Turkce
4. **`.env.development` gitignored** — commit etme
5. **`configurable: true`** — Object.defineProperty (Vite HMR)
6. **Adapter pattern**: api-service.ts 89+ GAS → 13 Edge Function
7. **Otomatik deploy**: commit → push → supabase deploy → vercel --prod → md guncelle (SORMADAN)
8. **CLAUDE.md guncelle**: Her oturumda. Compact/clear sonrasi bilgi kaybolmasin
9. **Orkestra modu**: Paralel agent'lar kullan, sirayla bekleme
10. **Sorun → Gorev**: Sorun gelince HEMEN 🔴 BEKLEYEN'e ekle, cozulunce ✅'ye tasi

---

## Proje Bilgileri

### Teknoloji Stack
- **Frontend:** Vite + TypeScript
- **Backend:** Supabase Edge Functions (Deno)
- **Database:** Supabase PostgreSQL (Frankfurt)
- **Hosting:** Vercel
- **Auth:** Supabase Auth + requireAdmin()
- **Email:** Resend API (`istinye@kulahcioglu.com`)
- **WhatsApp:** WhatsApp Business API
- **Calendar:** Google Calendar API
- **Bot koruma:** Cloudflare Turnstile

### Hosting
- **Production URL**: https://randevu.kulahcioglu.com
- **Vercel URL**: https://admiring-hypatia.vercel.app
- **Branch**: `admiring-hypatia`
- **Working dir**: `~/.claude-worktrees/randevu-sistemi-main/admiring-hypatia`

### Deploy Komutlari
```bash
# Edge Function (MUTLAKA --no-verify-jwt!)
supabase functions deploy <func> --no-verify-jwt

# Migration
supabase db push

# Frontend
vercel --prod
```

### Dosya Yapisi
```
supabase/functions/          # Backend Edge Functions
  _shared/                   # cors, resend-sender, google-calendar, supabase-client,
                             # whatsapp-sender, variables, security, validation, types
  appointments/              # Randevu CRUD + slot + notification trigger
  notifications/             # Email/WhatsApp/ICS + zamanlanmis hatirlatma
  mail/                      # Mail template/flow/info card CRUD
  auth/ config/ staff/ settings/ links/ slack/
  whatsapp/ webhook-whatsapp/ calendar-sync/

admin/                       # Admin panel TS modulleri
  notification-bell.ts       # Bildirim cani
  unified-flow-manager.ts    # Bildirim akis yonetimi
  staff-manager.ts           # Personel yonetimi
  appointment-manager.ts     # Randevu yonetimi
  whatsapp-manager.ts        # WhatsApp template/flow
  whatsapp-chat.ts           # WhatsApp chat UI
  mail-manager.ts            # Mail template/flow/card
  profile-settings-manager.ts# Profil ayarlari tablosu
  shift-manager.ts           # Vardiya yonetimi
  data-store.ts              # Merkezi veri deposu

admin-panel.ts               # Admin panel koordinator
admin-auth.ts                # Supabase Auth (login/logout)
api-service.ts               # Frontend → Edge Function adapter
config-loader.ts             # Config yukleme + cache
admin.css                    # Admin panel stilleri
```

### Supabase Secrets
```
RESEND_API_KEY, TURNSTILE_SECRET_KEY,
GOOGLE_CALENDAR_ID, GOOGLE_SERVICE_ACCOUNT_KEY,
WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID,
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL
```

### Onemli Tablolar
| Tablo | Aciklama |
|-------|----------|
| appointments | Randevular (google_event_id, type, profile, staff_id) |
| staff | Personel (is_admin, email, phone, active, role) |
| notification_flows | Bildirim akislari (trigger, schedule_hour, profiles) |
| mail_templates | Email sablonlari (recipient: customer/staff/admin) |
| whatsapp_templates | WhatsApp sablonlari (target_type) |
| mail_info_cards | Email bilgi kartlari |
| message_log | Tum gonderim loglari |

---

## Bildirim Sistemi

### Trigger'lar
`appointment_create` | `appointment_cancel` | `appointment_update` | `appointment_assign` | `HATIRLATMA`

### Recipient'lar
`customer` | `staff` | `admin` (is_admin=true) | `greeter` (role='greeter')

### Template Degiskenleri
`{{musteri}}` `{{musteri_tel}}` `{{musteri_mail}}` `{{randevu_tarihi}}` `{{randevu_saati}}` `{{randevu_ek_bilgi}}` `{{personel}}` `{{personel_id}}` `{{personel_tel}}` `{{personel_mail}}` `{{randevu_turu}}` `{{randevu_profili}}` `{{profil_sahibi}}`

### Profil Kodlari
g=Genel, w=Walk-in, b=Magaza, m=Yonetim, s=Bireysel, v=Ozel Musteri

### Randevu Turleri
delivery, shipping, meeting, service, management

---

## Turnstile (Bot Korumasi)
- remoteip GONDERME (Edge Function IP ≠ client IP)
- FormData format + graceful fallback (token>100 && invalid-input-response → kabul)
- Client-side widget koruma sagliyor, server-side defense-in-depth
- Site key: `0x4AAAAAACawPXu9P-2JBh46`

---

## 📝 KARAR LOGU

| Tarih | Karar | Neden |
|-------|-------|-------|
| 2026-02-11 | GitHub Pages → Vercel | Base path sorunlari, daha iyi CI/CD |
| 2026-02-12 | Turnstile graceful fallback | Edge Function → Cloudflare uyumsuzlugu |
| 2026-02-13 | Supabase Realtime → Polling | Free tier 403 hatasi, polling 30sn fallback |
| 2026-02-13 | Bell + logout SVG ikon | Mobil sag ust kose minimal tasarim |

---

## 💡 COMPACT STRATEJISI

1. Her is bitisinde → CLAUDE.md guncelle
2. Her 3-4 gorevde → `/compact` calistir
3. Context %50'ye ulasinca → CLAUDE.md guncelle + `/compact`
4. `/compact` calismazsa → `/clear` yap (CLAUDE.md sayesinde bilgi kaybolmaz)

**Altin kural:** Once CLAUDE.md'yi guncelle, sonra compact/clear yap.

---

## Button Utility
```typescript
import { ButtonAnimator } from '../button-utils';
ButtonAnimator.start(btn);    // Islem basinda
ButtonAnimator.success(btn);  // Basarili
ButtonAnimator.error(btn);    // Hata
```
