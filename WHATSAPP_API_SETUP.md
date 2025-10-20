# 📱 WhatsApp Business Cloud API Kurulum Rehberi

## 🎯 Genel Bakış

Bu rehber, **Meta WhatsApp Business Cloud API** kullanarak randevu hatırlatmalarını **otomatik** olarak göndermenizi sağlar.

### ✅ Avantajlar
- **ÜCRETSIZ:** İlk 1000 mesaj/ay ücretsiz
- **TAM OTOMATİK:** Admin panelde butona bas, mesajlar direkt gönderilir
- **HİÇBİR MANUEL İŞLEM:** Selenium, terminal, QR kod vs. yok!
- **PROFESYONEL:** Resmi Meta API
- **GÜVENİLİR:** %99.9 uptime

### ⏱️ Kurulum Süresi
- **İlk seferde:** 30-45 dakika
- **Tekrar kullanımda:** Anında

---

## 📋 Gereksinimler

1. **Facebook Business Hesabı** (ücretsiz)
2. **Meta Developer Hesabı** (ücretsiz)
3. **WhatsApp Business Telefon Numarası** (yeni numara gerekebilir)
4. **Kredi Kartı** (doğrulama için - ücret yok)

---

## 🚀 Adım Adım Kurulum

### 1. Meta Business Hesabı Oluştur

1. https://business.facebook.com/ adresine git
2. **"Hesap Oluştur"** tıkla
3. **İş bilgilerini gir:**
   - İş adı: Rolex İzmir İstinyepark
   - İsim: [Adınız]
   - E-posta: [E-postanız]

4. **Doğrulama:**
   - E-posta doğrula
   - Telefon numaranı doğrula

---

### 2. Meta Developer Hesabı Oluştur

1. https://developers.facebook.com/ adresine git
2. **"Başla"** (Get Started) tıkla
3. **Facebook hesabınla giriş yap**
4. **Developer kaydı tamamla:**
   - Geliştirici olarak kayıt ol
   - Şartları kabul et

---

### 3. WhatsApp Business API Uygulaması Oluştur

1. https://developers.facebook.com/apps/ adresine git
2. **"Uygulama Oluştur"** (Create App) tıkla
3. **Uygulama türü seç:**
   - **"Business"** seç
   - İleri tıkla

4. **Uygulama bilgilerini gir:**
   - Uygulama adı: **Rolex Randevu Sistemi**
   - App contact email: [E-postanız]
   - Business Account: [Oluşturduğunuz business hesabı]

5. **Uygulamayı oluştur**

---

### 4. WhatsApp Ürünü Ekle

1. **Dashboard'da "WhatsApp" bulun**
2. **"Kurulum"** (Set up) tıkla
3. **Business Portfolio seçin** (yoksa oluştur)

---

### 5. WhatsApp Business Hesabı Oluştur

1. **"WhatsApp Business Hesabı Oluştur"** tıkla
2. **Bilgileri gir:**
   - Hesap adı: Rolex İzmir İstinyepark
   - Kategori: Perakende (Retail)
   - Zaman dilimi: Europe/Istanbul

3. **Hesap oluştur**

---

### 6. Telefon Numarası Ekle

**ÖNEMLİ:** WhatsApp Business API'de **yeni bir telefon numarası** kullanmanız önerilir.

1. **"Telefon Numarası Ekle"** tıkla
2. **İki seçenek:**

   **Seçenek A: Test Numarası (Önerilen - İlk Testler İçin)**
   - Meta size ücretsiz test numarası verir
   - 5 kişiye test mesajı gönderebilirsiniz
   - Hızlı başlangıç için ideal

   **Seçenek B: Kendi Numaranız**
   - Yeni bir SIM kart alın (Turkcell/Vodafone/Türk Telekom)
   - Bu numara **sadece WhatsApp Business API** için kullanılmalı
   - **Dikkat:** Bu numara artık normal WhatsApp'ta kullanılamaz!

3. **Numarayı doğrula:**
   - SMS veya telefon araması ile doğrulama kodu gelir
   - Kodu gir

4. **Display Name belirle:**
   - **Rolex İzmir İstinyepark**
   - Bu isim müşterilerinize görünecek

---

### 7. Access Token Al (PERMANENT)

**ÖNEMLİ:** Geçici token değil, **kalıcı (permanent) token** almanız gerekiyor!

#### 7.1. Geçici Token Al (İlk Adım)

1. **WhatsApp > API Setup** sayfasında
2. **"Temporary Access Token"** kopyala
3. **Bu 24 saat geçerli** - test için kullan

#### 7.2. Permanent Token Oluştur (Önemli!)

1. **Meta Business Manager'a git:**
   - https://business.facebook.com/settings/system-users

2. **"System Users"** (Sistem Kullanıcıları) sekmesi
   - **"Ekle"** (Add) tıkla
   - İsim: **Randevu Sistemi API**
   - Rol: **Admin**

3. **"Generate New Token"** (Yeni Token Oluştur)
   - App seç: **Rolex Randevu Sistemi**
   - İzinler seç:
     - ✅ `whatsapp_business_messaging`
     - ✅ `whatsapp_business_management`
   - Token süresi: **Never Expire** (Asla sona ermez)

4. **Token'ı kopyala ve GÜVENLİ BİR YERE KAYDET!**
   - Bu token bir daha gösterilmeyecek
   - Kaybederseniz yenisini oluşturmanız gerekir

---

### 8. Phone Number ID Al

1. **WhatsApp > API Setup** sayfasında
2. **"Phone Number ID"** bölümünü bul
3. **Numarayı kopyala** (örn: `123456789012345`)

---

### 9. Ödeme Yöntemi Ekle

**ÖNEMLİ:** İlk 1000 mesaj ücretsiz ama kredi kartı doğrulaması gerekiyor!

1. **Business Settings > Payments** git
2. **"Add Payment Method"** tıkla
3. **Kredi kartı bilgilerini gir**
4. **Kaydet**

**Not:** Meta ücret çekmeyecek, sadece doğrulama için.

---

### 10. Message Template Oluştur (Opsiyonel)

**DİKKAT:** Basit text mesajlar için template gerekmez!

Eğer template kullanmak isterseniz:

1. **WhatsApp > Message Templates**
2. **"Create Template"** tıkla
3. **Template bilgilerini gir**
4. **Meta onayını bekle** (1-2 gün)

**Bizim Sistemde:** Template kullanmıyoruz, direkt text mesaj gönderiyoruz.

---

## 🔧 Backend Yapılandırması

### Apps Script'e Token Ekle

1. **Google Apps Script**'i aç:
   - https://script.google.com

2. **apps-script-backend.js** dosyanızı aç

3. **Admin Panel'i aç:**
   - https://rolexizmiristinyepark.github.io/randevu_app/admin.html

4. **"WhatsApp Business API Ayarları"** bölümüne git

5. **Bilgileri gir:**
   - **Phone Number ID:** [Adım 8'den kopyaladığınız]
   - **Access Token:** [Adım 7.2'den kopyaladığınız permanent token]

6. **"💾 Ayarları Kaydet"** tıkla

7. **Durum kontrolü:**
   - ✅ Yeşil: "WhatsApp API Yapılandırıldı" görmelisiniz

---

## 🎯 Kullanım

### İlk Test Mesajı

1. **Admin Panel > WhatsApp Mesaj Gönder**

2. **Tarih seç** (bugün)

3. **"📤 GÖNDER"** butonuna tıkla

4. **Bekle:**
   - Loading göreceksiniz
   - 5-10 saniye içinde mesajlar gönderilir

5. **Sonuç:**
   - ✅ Kaç mesaj gönderildi
   - ❌ Varsa hatalar
   - 📋 Detaylı liste

---

## 🔍 Sorun Giderme

### "WhatsApp API Yapılandırılmamış" Hatası

**Çözüm:**
1. Phone Number ID ve Access Token'ı tekrar kontrol edin
2. Permanent token kullandığınızdan emin olun (temporary değil!)
3. Token izinlerini kontrol edin (`whatsapp_business_messaging`)

---

### "Invalid Phone Number" Hatası

**Çözüm:**
1. Telefon numarası doğru mu? (+90XXXXXXXXXX)
2. Test numarası kullanıyorsanız, alıcıyı "Test Numaraları" listesine eklediniz mi?

---

### "Access Token Expired" Hatası

**Çözüm:**
1. Permanent token kullandığınızdan emin olun
2. Yeni permanent token oluşturun (Adım 7.2)
3. Admin panelde token'ı güncelleyin

---

### "Message Template Not Approved" Hatası

**Çözüm:**
1. Biz template kullanmıyoruz, bu hata almamalısınız
2. Eğer alıyorsanız, backend'de template kodu varsa silin

---

### "Rate Limit Exceeded" Hatası

**Çözüm:**
1. Çok fazla mesaj gönderdiniz
2. Meta limiti: 80 mesaj/saniye, 1000 mesaj/ay (free tier)
3. 1 saat bekleyin ve tekrar deneyin

---

## 📊 Limitler ve Fiyatlandırma

### Free Tier (Ücretsiz)
- **1000 mesaj/ay:** Ücretsiz
- **80 mesaj/saniye:** Rate limit
- **Test numarası:** 5 kişiye mesaj

### Ücretli Tier (Konuşma Bazlı)
- **1001-10,000 mesaj:** ~$0.005/mesaj
- **10,001+:** Daha ucuz

### Bizim Kullanım
- Günde ~10-20 randevu
- Ayda ~300-600 mesaj
- **Tamamen ÜCRETSİZ!**

---

## 🎉 Tamamdır!

Artık WhatsApp mesajlarını **tek tıkla** gönderebilirsiniz!

### Özet
1. ✅ Meta Business hesabı oluşturuldu
2. ✅ WhatsApp Business API kuruldu
3. ✅ Permanent token alındı
4. ✅ Admin panelde ayarlar yapıldı
5. ✅ İlk test mesajı gönderildi

### Sonraki Kullanım
1. Admin panel aç
2. Tarih seç
3. "📤 GÖNDER" butonuna tıkla
4. **O kadar!** ☕

---

## 📞 Destek

Sorun yaşarsanız:
- Meta Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
- Meta Support: https://developers.facebook.com/support/
- Bu dosyayı tekrar gözden geçirin

---

## 🔐 Güvenlik Notları

- ⚠️ **Access Token'ı ASLA paylaşmayın!**
- ⚠️ **GitHub'a COMMIT ETMEYİN!**
- ⚠️ **Sadece Apps Script Properties'de saklayın**
- ✅ Admin panel token'ı göstermez (güvenli)
- ✅ Token Script Properties'de encrypt edilmiş

**Güvenli!** 🔒
