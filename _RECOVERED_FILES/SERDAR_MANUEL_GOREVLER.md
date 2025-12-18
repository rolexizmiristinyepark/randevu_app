# 📋 SERDAİR İÇİN MANUEL GÖREVLER - ADIM ADIM CHECKLIST

**Proje:** Rolex İzmir İstinyepark Randevu Sistemi  
**Tarih:** Kasım 2025  
**Durum:** Claude Code ile paralel çalışma

---

## 🎯 GENEL BAKIŞ

```
┌─────────────────────────────────────────────────────────────────┐
│  HAZIRLIK (Sen)  →  KOD DEĞİŞİKLİKLERİ (Claude Code)  →        │
│  YAPILANDIRMA (Sen)  →  TEST (Sen)  →  DEPLOY (Sen)            │
└─────────────────────────────────────────────────────────────────┘
```

---

# 🔵 BÖLÜM 1: HAZIRLIK (Claude Code Başlamadan ÖNCE)

## ✅ Adım 1.1: Proje Backup'ı Al

```bash
# Terminali aç ve şu komutları çalıştır:
cd "/Users/serdarbenli/Desktop/new project"
cp -r randevu-sistemi-main randevu-sistemi-backup-$(date +%Y%m%d_%H%M%S)

# Backup'ın oluştuğunu doğrula:
ls -la | grep backup
```

**✓ Tamamlandı mı?** [ ]

---

## ✅ Adım 1.2: Mevcut Secret'ları Yedekle (Güvenli Bir Yere)

Aşağıdaki bilgileri **güvenli bir yere** (not defteri, şifreli dosya vb.) kaydet:

### A) `.env.production` içeriği:
```bash
cat "/Users/serdarbenli/Desktop/new project/randevu-sistemi-main/.env.production"
```

Kaydet:
- [ ] `VITE_APPS_SCRIPT_URL` = ____________________
- [ ] `VITE_TURNSTILE_SITE_KEY` = ____________________
- [ ] Diğer değerler = ____________________

### B) `.env.local` içeriği:
```bash
cat "/Users/serdarbenli/Desktop/new project/randevu-sistemi-main/.env.local"
```

### C) Mevcut Google Apps Script Properties:
1. https://script.google.com adresine git
2. Projeyi aç
3. ⚙️ Project Settings → Script Properties
4. Tüm mevcut property'leri not al

**✓ Tamamlandı mı?** [ ]

---

## ✅ Adım 1.3: Gerekli Hesaplara Erişim Kontrolü

Aşağıdaki hesaplara giriş yapabildiğini doğrula:

- [ ] **Cloudflare Dashboard** (Turnstile için)
  - URL: https://dash.cloudflare.com
  - Turnstile bölümüne erişebiliyor musun?

- [ ] **Google Apps Script**
  - URL: https://script.google.com
  - Projeyi düzenleyebiliyor musun?

- [ ] **GitHub Repository**
  - Push yetkisi var mı?
  - Force push yetkisi var mı? (Settings → Branch protection kontrol et)

- [ ] **Google Cloud Console** (opsiyonel)
  - URL: https://console.cloud.google.com
  - Calendar API aktif mi?

**✓ Tamamlandı mı?** [ ]

---

## ✅ Adım 1.4: Yeni Secret'ları Oluştur (Henüz UYGULAMA)

### A) Cloudflare Turnstile - YENİ Key Oluştur

1. https://dash.cloudflare.com → Turnstile bölümüne git
2. **"Add Site"** veya mevcut site ayarlarına git
3. **Yeni Secret Key** oluştur (eski key'i henüz silme!)
4. Kaydet:

```
YENİ TURNSTILE SITE KEY (Public):  ____________________
YENİ TURNSTILE SECRET KEY:         ____________________
```

**⚠️ DİKKAT:** Eski key'i henüz iptal ETME! Yeni sistem çalışana kadar eski key aktif kalsın.

**✓ Tamamlandı mı?** [ ]

### B) Google Sheets Veritabanı Oluştur (FAZ 2 için)

1. https://sheets.google.com → Yeni E-Tablo oluştur
2. İsim: `Randevu_Sistemi_DB`
3. Sekmeler oluştur:
   - `Staff`
   - `Shifts`
   - `Settings`
   - `Logs`
4. Spreadsheet ID'yi kaydet (URL'den al):
   - `https://docs.google.com/spreadsheets/d/[BU_KISIM_ID]/edit`

```
GOOGLE SHEETS ID: ____________________
```

**✓ Tamamlandı mı?** [ ]

---

# 🟡 BÖLÜM 2: CLAUDE CODE ÇALIŞIRKEN (Paralel)

Claude Code kod değişikliklerini yaparken sen şunları hazırla:

## ✅ Adım 2.1: KVKK Aydınlatma Metni Hazırla

Hukuk danışmanınızla veya şablondan bir KVKK aydınlatma metni hazırla.

İçermesi gerekenler:
- [ ] Veri sorumlusu bilgileri (Rolex İzmir İstinyepark)
- [ ] Toplanan kişisel veriler (ad, telefon, email)
- [ ] Verilerin işlenme amaçları
- [ ] Verilerin saklanma süresi
- [ ] Kişisel veri hakları
- [ ] İletişim bilgileri

Dosya: `kvkk-aydinlatma.html` olarak kaydedilecek

**✓ Tamamlandı mı?** [ ]

---

## ✅ Adım 2.2: Test Senaryolarını Hazırla

Claude Code bitirince test edeceğin senaryolar:

### Müşteri Tarafı (index.html):
- [ ] Sayfa açılıyor mu?
- [ ] Takvim görünüyor mu?
- [ ] Personel seçimi çalışıyor mu?
- [ ] Saat seçimi çalışıyor mu?
- [ ] KVKK checkbox'ı görünüyor mu?
- [ ] KVKK onayı olmadan form submit oluyor mu? (OLMAMALI)
- [ ] KVKK onayı ile form submit oluyor mu?
- [ ] Turnstile (robot doğrulama) çalışıyor mu?
- [ ] Randevu oluşturuluyor mu?
- [ ] Başarı sayfası görünüyor mu?

### Admin Tarafı (admin.html):
- [ ] Giriş sayfası açılıyor mu?
- [ ] API key ile giriş yapılabiliyor mu?
- [ ] Randevu listesi yükleniyor mu?
- [ ] Personel listesi yükleniyor mu?
- [ ] Vardiya ekleme çalışıyor mu?
- [ ] 15 dakika inaktivite sonrası çıkış yapılıyor mu?

**✓ Tamamlandı mı?** [ ]

---

# 🟢 BÖLÜM 3: YAPILANDIRMA (Claude Code Bittikten SONRA)

## ✅ Adım 3.1: Google Apps Script Properties Güncelle

1. https://script.google.com → Projeyi aç
2. ⚙️ **Project Settings** → **Script Properties**
3. Şu property'leri ekle/güncelle:

| Property Adı | Değer |
|--------------|-------|
| `TURNSTILE_SECRET_KEY` | [Yeni secret key] |
| `SPREADSHEET_ID` | [Google Sheets ID] |
| `WHATSAPP_ACCESS_TOKEN` | [Varsa] |
| `WHATSAPP_PHONE_NUMBER_ID` | [Varsa] |
| `SLACK_WEBHOOK_URL` | [Varsa] |

**✓ Tamamlandı mı?** [ ]

---

## ✅ Adım 3.2: Google Apps Script Backend'i Güncelle

1. https://script.google.com → Projeyi aç
2. Claude Code'un güncellediği `apps-script-backend.js` içeriğini kopyala
3. Apps Script editöre yapıştır
4. **Kaydet** (Ctrl+S)

**⚠️ HENÜZ DEPLOY ETME!**

**✓ Tamamlandı mı?** [ ]

---

## ✅ Adım 3.3: Frontend Environment Güncelle

`.env.production` dosyasını güncelle:

```env
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/[DEPLOYMENT_ID]/exec
VITE_BASE_URL=https://rolexizmiristinyepark.github.io/randevu_app/
VITE_TURNSTILE_SITE_KEY=[YENİ_SITE_KEY]
VITE_DEBUG=false
VITE_ENABLE_ANALYTICS=true
```

**✓ Tamamlandı mı?** [ ]

---

# 🔴 BÖLÜM 4: TEST (Deploy Öncesi)

## ✅ Adım 4.1: Local Test

```bash
cd "/Users/serdarbenli/Desktop/new project/randevu-sistemi-main"

# Build
npm run build

# Local server başlat
npm run preview
# veya
npx vite preview
```

Tarayıcıda `http://localhost:4173` aç ve test et.

**✓ Build başarılı mı?** [ ]
**✓ Local test başarılı mı?** [ ]

---

## ✅ Adım 4.2: Apps Script Test Deploy

1. Apps Script editörde
2. **Deploy** → **Test deployments**
3. Test URL'ini al
4. Frontend'de bu URL ile test et (geçici olarak .env'de değiştir)

**✓ Test deployment çalışıyor mu?** [ ]

---

# 🚀 BÖLÜM 5: PRODUCTION DEPLOY

## ✅ Adım 5.1: Apps Script Production Deploy

1. Apps Script editörde
2. **Deploy** → **New deployment**
3. Açıklama: "v2.1.0 - Güvenlik güncellemeleri"
4. **Deploy** tıkla
5. Yeni Deployment ID'yi kaydet:

```
YENİ DEPLOYMENT ID: ____________________
YENİ DEPLOYMENT URL: ____________________
```

**✓ Tamamlandı mı?** [ ]

---

## ✅ Adım 5.2: Frontend Production Deploy

```bash
cd "/Users/serdarbenli/Desktop/new project/randevu-sistemi-main"

# Production build
npm run build

# GitHub Pages'e deploy
npm run deploy
# veya
npx gh-pages -d dist
```

**✓ Deploy başarılı mı?** [ ]

---

## ✅ Adım 5.3: Production Test

https://rolexizmiristinyepark.github.io/randevu_app/ adresinde test et:

- [ ] Müşteri formu çalışıyor
- [ ] Admin paneli çalışıyor
- [ ] Randevu oluşturulabiliyor
- [ ] KVKK onayı zorunlu

**✓ Production test başarılı mı?** [ ]

---

# 🧹 BÖLÜM 6: TEMİZLİK (Her Şey Çalıştıktan SONRA)

## ✅ Adım 6.1: Eski Turnstile Key'i İptal Et

1. https://dash.cloudflare.com → Turnstile
2. Eski key'i bul
3. **Revoke** / **Delete**

**⚠️ SADECE yeni sistem sorunsuz çalışıyorsa yap!**

**✓ Tamamlandı mı?** [ ]

---

## ✅ Adım 6.2: Git History Temizliği (EN SON)

Claude Code hazırladığı komutları çalıştır:

```bash
# BFG Repo-Cleaner ile temizlik
# SADECE tüm testler başarılı olduktan sonra!
```

**⚠️ Bu işlem geri dönüşü zor! Emin misin?**

**✓ Tamamlandı mı?** [ ]

---

## ✅ Adım 6.3: Eski Apps Script Deployment'ları Kaldır

1. Apps Script → Deploy → Manage deployments
2. Eski deployment'ları **Archive** et
3. Sadece en güncel version aktif kalsın

**✓ Tamamlandı mı?** [ ]

---

## ✅ Adım 6.4: Backup'ları Temizle (Opsiyonel)

Her şey stabil çalışıyorsa, 1 hafta sonra eski backup'ları silebilirsin.

**✓ Tamamlandı mı?** [ ]

---

# 📊 İLERLEME TAKİBİ

| Bölüm | Durum | Tarih |
|-------|-------|-------|
| 1. Hazırlık | ⬜ Bekliyor | |
| 2. Claude Code Paralel | ⬜ Bekliyor | |
| 3. Yapılandırma | ⬜ Bekliyor | |
| 4. Test | ⬜ Bekliyor | |
| 5. Deploy | ⬜ Bekliyor | |
| 6. Temizlik | ⬜ Bekliyor | |

---

# 🆘 SORUN OLURSA

## Rollback Prosedürü:

```bash
# 1. Frontend'i eski haline getir
cd "/Users/serdarbenli/Desktop/new project"
rm -rf randevu-sistemi-main
cp -r randevu-sistemi-backup-YYYYMMDD_HHMMSS randevu-sistemi-main

# 2. Apps Script'i eski deployment'a çevir
# Deploy → Manage deployments → Eski version'ı aktif et

# 3. Turnstile'da eski key'i tekrar aktif et (iptal etmediysen)
```

## İletişim:
- Teknik sorun → Claude'a sor
- İş kararı → Yöneticine danış
- Hukuki soru → Hukuk danışmanına sor

---

**Hazır olduğunda Claude Code'u başlat! 🚀**
