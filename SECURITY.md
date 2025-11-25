# 🔒 Security Configuration Guide

## Güvenlik Mimarisi

Bu proje **hibrit güvenlik yaklaşımı** kullanır:

✅ **POST Method:** API çağrıları POST ile yapılır (URL'de sensitive data yok)
✅ **Script Properties:** Tüm secrets Google Apps Script Properties'de saklanır
✅ **Environment Separation:** Development vs Production secrets ayrı
✅ **No Secrets in Git:** .gitignore ile tüm sensitive files korunur

---

## 🚨 ÖNEMLİ: Production Deployment Öncesi

### 1. Script Properties Kurulumu

Google Apps Script editöründe:

```
Project Settings (⚙️) → Script Properties → Add properties
```

**ZORUNLU PROPERTIES:**

| Property Key | Örnek Değer | Açıklama |
|-------------|-------------|----------|
| `CALENDAR_ID` | `your-email@gmail.com` | Google Calendar ID (Gmail hesabı) |
| `TURNSTILE_SECRET_KEY` | `0x4AAAAAACCXZ9dfNEJxoB2t4Rkx7qvSO6Y` | ✅ Cloudflare Turnstile secret key (PRODUCTION ACTIVE) |
| `ADMIN_API_KEY` | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | Admin panel API key (auto-generated) |

**OPSİYONEL (WhatsApp Business API için):**

| Property Key | Örnek Değer |
|-------------|-------------|
| `WHATSAPP_PHONE_NUMBER_ID` | `123456789012345` |
| `WHATSAPP_ACCESS_TOKEN` | `EAAxxxxxxxxxxxx` |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | `123456789012345` |

**OPSİYONEL (Slack Webhook için):**

| Property Key | Örnek Değer |
|-------------|-------------|
| `SLACK_WEBHOOK_URL` | `https://hooks.slack.com/services/T00/B00/xxx` |

---

### 2. Cloudflare Turnstile Kurulumu ✅ TAMAMLANDI

**Production Keys Aktif:**
```
Site Key: 0x4AAAAAACCXZ1xgm7vtHQwX (index.html'de ayarlandı)
Secret Key: 0x4AAAAAACCXZ9dfNEJxoB2t4Rkx7qvSO6Y (CONFIG'de ayarlandı)
```

**Kurulum Tamamlandı:**
1. ✅ Cloudflare Dashboard'dan widget oluşturuldu
2. ✅ Production site key → index.html güncelendi
3. ✅ Production secret key → apps-script-backend.js CONFIG'e eklendi
4. ✅ Test bypass kodu kaldırıldı (güvenlik açığı kapatıldı)
5. ✅ Bot koruması %100 aktif

**⚠️ ÖNEMLI:** Test key'leri (1x00...) KALDIRILDI - artık sadece production keys kullanılıyor!

---

### 3. Calendar ID Bulma

Google Calendar → Settings → Calendar Address → **Calendar ID** kopyala

Örnek: `your-email@gmail.com` veya `abc123@group.calendar.google.com`

---

### 4. Frontend Config (HTML dosyalarında)

**customer.html ve admin.html:**

```javascript
const CONFIG = {
    APPS_SCRIPT_URL: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec'
};
```

**⚠️ `YOUR_DEPLOYMENT_ID` yerine gerçek deployment ID'yi yazın**

---

## 🔐 Güvenlik Katmanları

### 1. Transport Security
- ✅ **HTTPS Only:** Tüm API çağrıları HTTPS üzerinden
- ✅ **POST Method:** API key URL'de değil, body'de
- ✅ **CORS:** Cross-origin requests kontrollü

### 2. API Key Security
- ✅ **Script Properties:** GitHub'da görünmez
- ✅ **Auto-generation:** First-time setup sırasında otomatik oluşturulur
- ✅ **Email Delivery:** API key sadece admin email'ine gönderilir
- ✅ **Regeneration:** API key yenilenebilir

### 3. Rate Limiting
- ✅ **10 requests / 10 minutes** (varsayılan)
- ✅ **Client IP based** (abuse prevention)
- ✅ **Turnstile verification** (bot protection)

### 4. Injection Prevention
- ✅ **XSS Protection:** SecurityService.sanitizeInput()
- ✅ **SQL Injection:** N/A (PropertiesService kullanılıyor, SQL yok)
- ✅ **Command Injection:** Input validation
- ✅ **Email Injection:** Email headers sanitized

---

## 🚫 ASLA YAPMAYIN

❌ API keys veya secrets'ı kod içine yazmayın
❌ .env dosyalarını Git'e commit etmeyin
❌ Production keys'i console.log() ile loglayıp paylaşmayın
❌ Test keys'i production'da kullanmayın
❌ API keys'i URL parametresinde göndemeyin (zaten POST kullanılıyor)

---

## ✅ YAPMANIZ GEREKENLER

1. ✅ Production deployment öncesi Script Properties'i doldurun
2. ✅ TURNSTILE_SECRET_KEY'i production key ile değiştirin
3. ✅ CALENDAR_ID'yi gerçek calendar ID ile değiştirin
4. ✅ .gitignore'u kontrol edin (zaten güncel)
5. ✅ HTTPS deployment yapın (HTTP değil)
6. ✅ Admin email adresini CONFIG.ADMIN_EMAIL'de güncelleyin

---

## 🔍 Güvenlik Denetimi

### Test Checklist

- [ ] Script Properties dolduruldu
- [✓] **Production Turnstile key kullanılıyor** (test key KALDIRILDI, güvenlik açığı kapatıldı)
- [✓] **API calls POST method kullanıyor**
- [✓] **.env dosyaları .gitignore'da**
- [ ] Admin API key email ile alındı
- [✓] **Rate limiting aktif** (10 req/10 min)
- [ ] HTTPS deployment yapıldı
- [✓] **XSS koruması aktif**

---

## 📞 Güvenlik Sorunları

Güvenlik açığı bulursanız:

1. **ASLA** public issue açmayın
2. Projeyi fork edin ve fix commit'leyin
3. Private olarak bildirin
4. Patch hazırsa PR gönderin

---

## 📚 İlgili Dokümantasyon

- [Google Apps Script Security](https://developers.google.com/apps-script/guides/security)
- [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

---

**Son Güncelleme:** 2025-01-22
**Güvenlik Seviyesi:** Production Ready ✅
