# 📅 Rolex İzmir İstinyepark Randevu Sistemi

Modern, güvenli ve kullanıcı dostu randevu yönetim sistemi.

## ✨ Özellikler

- 📅 **Canlı Takvim:** Gerçek zamanlı müsaitlik kontrolü
- 🔐 **Güvenli Yönetim:** Admin paneli ile tam kontrol
- 📧 **Email Bildirimleri:** Otomatik randevu onayları
- 📱 **WhatsApp Entegrasyonu:** Tek tıkla otomatik hatırlatma
- 🎨 **Responsive Tasarım:** Mobil uyumlu arayüz
- ⚡ **Hızlı:** Vite ile optimize edilmiş

## 🚀 Hızlı Başlangıç

### Geliştirme

```bash
# Dependencies yükle
npm install

# Dev server başlat
npm run dev
```

### Production Build

```bash
npm run build
```

## 🤖 Otomatik Deployment

Bu proje **GitHub Actions** ile otomatik deploy edilir.

**Yapmanız gereken tek şey:**
```bash
git add .
git commit -m "feat: yeni özellik"
git push
```

**Geri kalan her şey otomatik!** 1-2 dakika içinde değişiklikler canlıya çıkar.

📖 **Detaylı bilgi:** [DEPLOYMENT.md](./DEPLOYMENT.md)

## 📱 WhatsApp Business API

WhatsApp otomatik mesaj gönderimi için **Meta Business Cloud API** kullanılmaktadır.

📖 **Kurulum ve Kullanım:** [WHATSAPP_API_SETUP.md](./WHATSAPP_API_SETUP.md)

### Hızlı Kullanım:

**Admin Panelden (Tek Tıkla):**
1. **WhatsApp Business API Ayarları** bölümünden Phone Number ID ve Access Token'ı yapılandır
2. **WhatsApp Hatırlatma** sekmesine git
3. Tarih seç
4. **📤 GÖNDER** butonuna tıkla
5. Tüm mesajlar otomatik gönderilir!

**Avantajlar:**
- ✅ Tamamen otomatik (manuel işlem yok)
- ✅ İlk 1000 mesaj/ay ücretsiz
- ✅ Profesyonel Meta API
- ✅ %99.9 uptime garantisi

## 🌐 Canlı Site

**Müşteri Sayfası:** https://rolexizmiristinyepark.github.io/randevu_app/

**Admin Paneli:** https://rolexizmiristinyepark.github.io/randevu_app/admin.html

## 📁 Proje Yapısı

```
randevu-sistemi-main/
├── .github/workflows/      # GitHub Actions (otomatik deployment)
├── admin.html             # Yönetim paneli
├── index.html             # Müşteri randevu sayfası
├── app.js                 # Müşteri sayfası logic
├── admin-auth.js          # Admin authentication
├── api-service.js         # Backend API çağrıları
├── apps-script-backend.js # Google Apps Script backend
├── WHATSAPP_API_SETUP.md  # Meta Business API kurulum rehberi
├── vite.config.js         # Build ayarları
└── package.json           # Dependencies
```

## 🔧 Teknolojiler

- **Frontend:** Vanilla JavaScript, HTML5, CSS3
- **Build Tool:** Vite
- **Backend:** Google Apps Script
- **Database:** Google Sheets
- **Calendar:** Google Calendar API
- **Email:** Gmail API
- **WhatsApp:** Meta Business Cloud API
- **Deployment:** GitHub Pages
- **CI/CD:** GitHub Actions

## 📝 Lisans

Rolex İzmir İstinyepark için özel geliştirilmiştir.

## 🔧 Backend Refactoring

Backend (Google Apps Script) modülerleştirmesi için detaylı plan:
- [BACKEND_REFACTOR_PLAN.md](./BACKEND_REFACTOR_PLAN.md) - Modül yapısı, clasp deployment rehberi

**Mevcut**: 3385 satır tek dosya → **Hedef**: 15 modüler dosya

## 🆘 Destek

Sorun yaşarsanız:
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment sorunları
- [WHATSAPP_API_SETUP.md](./WHATSAPP_API_SETUP.md) - WhatsApp Business API kurulumu
- [BACKEND_REFACTOR_PLAN.md](./BACKEND_REFACTOR_PLAN.md) - Backend modülerleştirme
