# 🚀 Backend Kurulum Rehberi - Google Apps Script

Bu rehber, Rolex randevu sisteminin backend'ini Google Apps Script üzerinde nasıl kuracağınızı adım adım açıklar.

## 📋 İçindekiler

1. [Google Apps Script Nedir?](#google-apps-script-nedir)
2. [Hızlı Başlangıç](#hızlı-başlangıç)
3. [Detaylı Kurulum Adımları](#detaylı-kurulum-adımları)
4. [Konfigürasyon](#konfigürasyon)
5. [Test](#test)
6. [Güvenlik](#güvenlik)
7. [WhatsApp Entegrasyonu](#whatsapp-entegrasyonu)
8. [Slack Entegrasyonu](#slack-entegrasyonu)
9. [Sorun Giderme](#sorun-giderme)

---

## 📚 Google Apps Script Nedir?

Google Apps Script, Google'ın sunduğu **ücretsiz** bir serverless platform'dur. Bu projede:
- ✅ **Ücretsiz** (aylık limitler dahilinde)
- ✅ Google Calendar entegrasyonu
- ✅ Gmail entegrasyonu
- ✅ Otomatik HTTPS
- ✅ Bakım gerektirmez

---

## ⚡ Hızlı Başlangıç

### Adım 1: Google Apps Script Projesi Oluştur

1. **https://script.google.com** adresine git
2. **"Yeni proje"** butonuna tıkla
3. Proje adını **"Rolex Randevu Sistemi"** olarak değiştir

### Adım 2: Backend Kodunu Yapıştır

1. Bu repo'daki **`apps-script-backend.js`** dosyasını aç
2. **TÜM KODU KOPYALA** (Ctrl+A, Ctrl+C)
3. Google Apps Script editöründeki varsayılan kodu SİL
4. Kopyaladığın kodu YAPIŞTIR (Ctrl+V)
5. **Kaydet** (Ctrl+S veya 💾 ikonu)

### Adım 3: Deploy Et

1. Üst menüden **"Deploy → New deployment"**
2. **"Select type"** → **"Web app"** seç
3. Ayarlar:
   ```
   Description: v1.0 - İlk sürüm
   Execute as: Me (serdarbenli@gmail.com)
   Who has access: Anyone
   ```
4. **"Deploy"** butonuna tıkla
5. **İzin ver** (Authorize) → Google hesabını seç
6. **"Web app URL"** kopyala (örnek: `https://script.google.com/macros/s/AKfycbw.../exec`)

### Adım 4: Frontend'i Güncelle

Kopyaladığın Web App URL'i frontend koduna ekle:

**app.js** ve **app.ts** dosyalarında:
```javascript
const CONFIG = {
  APPS_SCRIPT_URL: 'BURAYA_KOPYALADIĞIN_URL_YAZ',
  // ...
};
```

**admin-panel.js** dosyasında da aynı URL'i güncelle.

---

## 🔧 Detaylı Kurulum Adımları

### 1️⃣ Google Takvim Entegrasyonu

Backend varsayılan olarak **primary** (birincil) takviminizi kullanır.

**Farklı bir takvim kullanmak isterseniz:**

1. Google Calendar'a git: https://calendar.google.com
2. Sol menüden kullanmak istediğin takvimi seç
3. **Ayarlar ve paylaşım** → **Takvim entegrasyonu**
4. **Takvim Kimliği**'ni kopyala (örn: `abc123@group.calendar.google.com`)
5. Backend kodunda değiştir:

```javascript
const CONFIG = {
  CALENDAR_ID: 'abc123@group.calendar.google.com', // Kendi takvim ID'niz
  // ...
};
```

### 2️⃣ Admin API Key Oluştur

Admin paneline güvenli erişim için API key:

1. Apps Script editöründe **üst menü → Run → Run function → generateApiKey**
2. **Logs** (Alt menü → View → Logs) bölümünden API key'i kopyala
3. Bu key'i **admin sayfasında ilk girişte kullan**

**Manuel API key oluşturma:**
```javascript
// Apps Script konsolunda çalıştır:
function generateApiKey() {
  const apiKey = 'ROLEX_ADMIN_' + Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('ADMIN_API_KEY', apiKey);
  console.log('✅ Yeni API Key:', apiKey);
  return apiKey;
}
```

### 3️⃣ Cloudflare Turnstile (Bot Koruması)

**Test modunda çalışır, production için:**

1. https://dash.cloudflare.com/sign-up adresinden hesap oluştur
2. **Turnstile** bölümüne git
3. **Add site** → Domain adını gir
4. **Secret key**'i kopyala
5. Backend'de güncelle:

```javascript
const CONFIG = {
  TURNSTILE_SECRET_KEY: 'BURAYA_SECRET_KEY_YAZ',
  // ...
};
```

6. Frontend'de **index.html** dosyasında **site key**'i güncelle:

```html
<div class="cf-turnstile"
     data-sitekey="BURAYA_SITE_KEY_YAZ"
     ...>
</div>
```

---

## ⚙️ Konfigürasyon

### Şirket Bilgileri

Backend kodunda (`apps-script-backend.js`):

```javascript
const CONFIG = {
  // Şirket bilgileri
  COMPANY_NAME: 'Rolex İzmir İstinyepark',
  COMPANY_LOCATION: 'Rolex İzmir İstinyepark',
  COMPANY_EMAIL: 'istinyeparkrolex35@gmail.com',
  ADMIN_EMAIL: 'istinyeparkrolex35@gmail.com',

  // Takvim
  CALENDAR_ID: 'primary',
  TIMEZONE: 'Europe/Istanbul',

  // Rate limiting
  RATE_LIMIT_MAX_REQUESTS: 10,      // 10 istek
  RATE_LIMIT_WINDOW_SECONDS: 600,   // 10 dakika
};
```

### Personel Listesi

İlk çalıştırmada otomatik olarak şu personel eklenir:

```javascript
staff: [
  { id: 1, name: 'Serdar Benli', active: true },
  { id: 2, name: 'Ece Argun', active: true },
  { id: 3, name: 'Gökhan Tokol', active: true },
  { id: 4, name: 'Sırma', active: true },
  { id: 5, name: 'Gamze', active: true },
  { id: 6, name: 'Okan', active: true }
]
```

**Admin panelden ekleyebilir/düzenleyebilirsiniz.**

---

## 🧪 Test

### Backend Test

1. **Apps Script editöründe:**
   - **Run → Run function → testConnection**
   - **Logs** sekmesinde sonuçları gör

2. **Manuel test:**
   ```
   Web App URL + ?action=getStaff
   Örnek: https://script.google.com/macros/s/AKfycbw.../exec?action=getStaff
   ```

   Beklenen sonuç:
   ```json
   {
     "success": true,
     "data": [
       { "id": 1, "name": "Serdar Benli", "active": true },
       ...
     ]
   }
   ```

### Frontend Test

1. **Local development:**
   ```bash
   npm run dev
   ```

2. **Tarayıcıda aç:** http://localhost:3000

3. **Test senaryoları:**
   - ✅ Randevu tipi seç
   - ✅ Takvimde tarih seç
   - ✅ Personel seç
   - ✅ Saat seç
   - ✅ Form doldur
   - ✅ Randevu oluştur
   - ✅ Admin panel giriş yap

---

## 🔒 Güvenlik

### 1. Rate Limiting

Backend otomatik olarak rate limiting uygular:
- **10 istek / 10 dakika** per IP
- Aşılırsa: `429 Too Many Requests`

### 2. KVKV/GDPR Uyumu

- Tüm kişisel veriler maskelenerek loglanır
- Email: `a***z@g***.com`
- Telefon: `0555 *** ** 67`

### 3. Admin API Key

- Admin işlemler için API key zorunlu
- Her deployment'ta yeni key oluşturulabilir

### 4. HTTPS

- Google Apps Script otomatik HTTPS sağlar

---

## 📱 WhatsApp Entegrasyonu (Opsiyonel)

WhatsApp Business Cloud API ile randevu hatırlatmaları:

### Kurulum

1. **Meta Business Suite:** https://business.facebook.com
2. **WhatsApp → API Ayarları**
3. **Şunları kopyala:**
   - Phone Number ID
   - Access Token (Permanent)
   - Business Account ID

4. **Backend'de güncelle:**

```javascript
const CONFIG = {
  WHATSAPP_PHONE_NUMBER_ID: '123456789012345',
  WHATSAPP_ACCESS_TOKEN: 'EAAxxxxxxxxxxxxx',
  WHATSAPP_BUSINESS_ACCOUNT_ID: '123456789012345',
};
```

5. **Mesaj şablonu oluştur** (Meta Business Suite → WhatsApp → Message Templates)

### Test

Admin panelde **WhatsApp Ayarları** sekmesinden test et.

**Not:** İlk 1000 mesaj/ay **ücretsiz**!

---

## 💬 Slack Entegrasyonu (Opsiyonel)

Yeni randevu bildirimleri için:

### Kurulum

1. **Slack workspace:** https://slack.com
2. **Apps → Incoming Webhooks** aktif et
3. **Webhook URL** kopyala
4. **Admin panelde** Slack ayarlarına yapıştır

### Test

Admin panelde **Slack Ayarları** → **Test Webhook**

---

## 🐛 Sorun Giderme

### Problem: "Script execution time exceeded"

**Çözüm:** Apps Script 6 dakika limiti var. Büyük veri için:
```javascript
const CONFIG = {
  BATCH_SIZE: 50, // Küçült
};
```

### Problem: "Authorization required"

**Çözüm:**
1. **Deploy → Manage deployments**
2. **Edit** → **Who has access: Anyone**
3. **Deploy** tekrar

### Problem: "Calendar API quota exceeded"

**Çözüm:** Google Calendar API günlük limiti:
- **Ücretsiz:** 1,000,000 istek/gün
- **Yeterli değilse:** Google Cloud Console'dan quota artır

### Problem: CORS hatası

**Çözüm:** Apps Script otomatik CORS ekler. Eğer hata varsa:
1. **Deploy → New deployment** (yeni versiyon)
2. Frontend'de URL'i güncelle

### Problem: Frontend'de "Network Error"

**Kontrol listesi:**
1. ✅ Backend deploy edildi mi?
2. ✅ URL doğru mu?
3. ✅ `Who has access: Anyone` mi?
4. ✅ Browser console'da detaylı hata var mı?

---

## 📊 API Endpoints

Backend şu endpoint'leri sağlar:

### Public Endpoints (API key gerekmez)

```
GET ?action=getStaff
GET ?action=getConfig
GET ?action=getDayShifts&date=YYYY-MM-DD
GET ?action=getDailySlots&date=YYYY-MM-DD&shiftType=morning/evening/full
GET ?action=getDayStatus&date=YYYY-MM-DD&appointmentType=delivery/service/meeting
GET ?action=getMonthData&year=2025&month=1
GET ?action=createAppointment&date=...&time=...&staffId=...&customerName=...&...
```

### Admin Endpoints (API key gerekli)

```
GET ?action=getSettings&apiKey=xxx
GET ?action=updateSettings&apiKey=xxx&interval=60&maxDaily=4
GET ?action=getAllStaff&apiKey=xxx
GET ?action=addStaff&apiKey=xxx&name=...&phone=...
GET ?action=getAppointments&apiKey=xxx&startDate=...&endDate=...
GET ?action=deleteAppointment&apiKey=xxx&appointmentId=...
```

---

## 📞 Destek

Sorun yaşıyorsanız:

1. **Apps Script Logs:** View → Logs
2. **Browser Console:** F12 → Console
3. **GitHub Issues:** Bu repo'da issue aç

---

## ✅ Kurulum Kontrol Listesi

- [ ] Google Apps Script projesi oluşturuldu
- [ ] Backend kodu yapıştırıldı
- [ ] Deploy edildi (Web App)
- [ ] Frontend'de URL güncellendi
- [ ] Test edildi (getStaff endpoint)
- [ ] Admin API key oluşturuldu
- [ ] Calendar ID ayarlandı
- [ ] Turnstile konfigüre edildi (opsiyonel)
- [ ] WhatsApp ayarlandı (opsiyonel)
- [ ] Slack ayarlandı (opsiyonel)
- [ ] Production'a deploy edildi

---

## 🎯 Sonuç

Tebrikler! Backend'iniz artık hazır. Frontend'i deploy edin ve sisteminiz canlıya geçsin! 🚀
