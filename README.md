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

## 📱 WhatsApp Otomasyonu

WhatsApp otomatik mesaj gönderimi için:

📖 **Detaylı kullanım:** [whatsapp-automation/README.md](./whatsapp-automation/README.md)

### Hızlı Kullanım:

**Admin Panelden:**
1. WhatsApp Hatırlatma sekmesi
2. Tarih seç
3. **🤖 Otomatik Gönder** butonuna tıkla
4. Terminal aç → Cmd+V → Enter
5. Tüm mesajlar otomatik gönderilir!

**Çift Tıklama (.command dosyası):**
```bash
# whatsapp-automation klasöründe:
WhatsApp_Otomatik_Gonder_BUGUN.command
```

## 🌐 Canlı Site

**Müşteri Sayfası:** https://rolexizmiristinyepark.github.io/randevu_app/

**Admin Paneli:** https://rolexizmiristinyepark.github.io/randevu_app/admin.html

## 📁 Proje Yapısı

```
randevu-sistemi-main/
├── .github/workflows/      # GitHub Actions (otomatik deployment)
├── whatsapp-automation/    # WhatsApp mesaj otomasyonu
├── admin.html             # Yönetim paneli
├── index.html             # Müşteri randevu sayfası
├── app.js                 # Müşteri sayfası logic
├── admin-auth.js          # Admin authentication
├── api-service.js         # Backend API çağrıları
├── apps-script-backend.js # Google Apps Script backend
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
- **Deployment:** GitHub Pages
- **CI/CD:** GitHub Actions
- **WhatsApp:** Selenium + WhatsApp Web

## 📝 Lisans

Rolex İzmir İstinyepark için özel geliştirilmiştir.

## 🆘 Destek

Sorun yaşarsanız:
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment sorunları
- [whatsapp-automation/README.md](./whatsapp-automation/README.md) - WhatsApp otomasyonu
