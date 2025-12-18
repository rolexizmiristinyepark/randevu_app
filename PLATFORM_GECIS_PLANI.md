# PLATFORM GEÇİŞ PLANI - RANDEVU SİSTEMİ

**Tarih:** 2 Aralık 2025
**Versiyon:** 1.0
**Durum:** Araştırma ve Planlama

---

## 1. MEVCUT DURUM ANALİZİ

### 1.1 Mevcut Teknoloji Stack
- **Frontend:** GitHub Pages (statik)
- **Backend:** Google Apps Script
- **Database:** Google Sheets
- **WhatsApp:** Meta Cloud API
- **Email:** MailApp (Apps Script)

### 1.2 Mevcut Sorunlar

| Sorun | Detay |
|-------|-------|
| **Yavaşlık** | Cold start: 2-4 saniye, Her istek: 400-1500ms |
| **Realtime YOK** | Sayfa yenilemeden güncelleme yok |
| **Push Notification YOK** | Tarayıcı/mobil bildirim yok |
| **Offline YOK** | İnternet kesilince sistem çalışmıyor |
| **Çakışma Riski** | Aynı anda 2 kişi aynı slotu alabilir |
| **Concurrent Limit** | ~50 eşzamanlı kullanıcı |

---

## 2. ALTERNATİF PLATFORM KARŞILAŞTIRMASI

### 2.1 Performans Karşılaştırması

| Platform | Cold Start | Warm Request | Hız Artışı |
|----------|------------|--------------|------------|
| **Apps Script** | 2-4 sn | 400-1500ms | Referans |
| **Cloudflare Workers** | <1ms | 10-50ms | 40-60x |
| **Vercel Edge** | 10-50ms | 5-30ms | 30-50x |
| **Supabase** | 50-200ms | 20-100ms | 10-20x |
| **Firebase** | 200-500ms | 50-150ms | 6-7x |

### 2.2 Özellik Karşılaştırması

| Özellik | Apps Script | Firebase | Supabase | Cloudflare |
|---------|-------------|----------|----------|------------|
| Hız | ⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Realtime | ❌ | ✅ | ✅ | ⚠️ |
| Push Notification | ❌ | ✅ | ⚠️ | ❌ |
| Offline | ❌ | ✅ | ⚠️ | ⚠️ |
| WhatsApp API | ✅ | ✅ | ✅ | ✅ |
| Özel Mail | ⚠️ | ✅ | ✅ | ✅ |
| Özel Domain | ✅ | ✅ | ✅ | ✅ |
| Geçiş Kolaylığı | N/A | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| Free Tier | ✅ | ✅ | ⚠️ (pause) | ✅ |

### 2.3 Maliyet Karşılaştırması

| Platform | Free Tier | Aylık Maliyet |
|----------|-----------|---------------|
| Apps Script | Sınırsız | $0 |
| Firebase | 50K read/gün | $0 |
| Supabase | 500MB DB | $0-25 |
| Cloudflare | 100K istek/gün | $0 |

---

## 3. ÖNERİLEN PLATFORM: FIREBASE

### 3.1 Neden Firebase?

1. **En Kolay Geçiş:** Google ekosistemi (Apps Script'ten tanıdık)
2. **Firestore:** NoSQL, Sheets'e benzer yapı
3. **Realtime:** Anlık senkronizasyon
4. **Push Notification:** Firebase Cloud Messaging
5. **PWA Desteği:** Mobil uygulama gibi
6. **Free Tier:** Randevu sistemi için fazlasıyla yeterli
7. **Pause Problemi YOK:** Supabase'den farklı olarak

### 3.2 Firebase Free Tier Limitleri

| Özellik | Limit | Yeterli mi? |
|---------|-------|-------------|
| Firestore Okuma | 50,000/gün | ✅ Fazlasıyla |
| Firestore Yazma | 20,000/gün | ✅ |
| Cloud Functions | 2M çağrı/ay | ✅ |
| Hosting | 10 GB/ay | ✅ |
| Storage | 5 GB | ✅ |

### 3.3 Yeni Mimari

```
MEVCUT:
Frontend (GH Pages) → Apps Script → Google Sheets
                           ↓
                    WhatsApp API / MailApp

YENİ:
Frontend (Firebase Hosting) → Cloud Functions → Firestore
    randevu.rolexizmir.com         ↓
                            WhatsApp API
                            Resend (özel mail)
                            Netgsm (SMS)
```

---

## 4. YENİ ÖZELLİKLER

### 4.1 Realtime Sync (Anlık Senkronizasyon)

```
Müşteri A randevu aldığında:
  → Müşteri B'nin ekranında slot anında kapanır
  → Admin panelinde randevu anında görünür
  → Sayfa yenilemesine gerek YOK
```

### 4.2 Push Notifications

```
Müşteriye:
  • Randevu onayı (anlık)
  • Randevu hatırlatma (1 gün önce, 2 saat önce)
  • İptal bildirimi

Personele:
  • Yeni randevu uyarısı
  • İptal bildirimi
  • Günlük özet
```

### 4.3 PWA (Progressive Web App)

```
  • Ana ekrana ikon olarak eklenir
  • Splash screen (açılış ekranı)
  • Tam ekran çalışma
  • Offline cache
  • App Store'a gerek yok
```

### 4.4 Offline Mode

```
İnternet kesildiğinde:
  • Bugünün randevuları görüntülenebilir
  • Yeni işlemler queue'ya alınır
  • Bağlantı gelince otomatik sync
```

### 4.5 Analytics Dashboard

```
  • Günlük/haftalık/aylık randevu sayıları
  • İptal oranları
  • Personel performansı
  • Yoğun saatler
  • Randevu türü dağılımı
```

---

## 5. SMS DOĞRULAMA SİSTEMİ

### 5.1 Genel Bakış

Müşteriler telefon numaraları ile SMS doğrulama yaparak kendi randevularını görebilir, düzenleyebilir ve iptal edebilir.

### 5.2 SMS Sağlayıcı: Netgsm

| Paket | Fiyat | Birim Fiyat |
|-------|-------|-------------|
| 1.000 SMS | ~284 TL | 0.284 TL/SMS |
| 5.000 SMS | ~1.200 TL | 0.24 TL/SMS |
| 10.000 SMS | ~2.100 TL | 0.21 TL/SMS |
| 50.000 SMS | ~9.000 TL | 0.18 TL/SMS |

**Neden Netgsm?**
- TL ile ödeme
- İYS entegrasyonu hazır
- Türkçe destek
- Başlıklı SMS (ROLEX)
- 1 yıl geçerlilik

**Twilio Neden Değil?**
- Dolar bazlı (kur riski)
- 1 Ocak 2025'ten itibaren Türkiye'de link içeren SMS yasak (yurt dışından)

### 5.3 Tahmini Maliyet

```
Günlük: 20 randevu × 2 SMS (onay + hatırlatma) = 40 SMS
Aylık: ~1.200 SMS
Yıllık: ~15.000 SMS

Maliyet: ~3.000 TL/yıl → ~250 TL/ay
```

### 5.4 Doğrulama Akışı

```
┌─────────────────────────────────────────────────────┐
│  MÜŞTERİ PORTAL                                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  1. Telefon numarasını gir                         │
│     [0 5XX XXX XX XX]                              │
│     [SMS Kodu Gönder]                              │
│                                                     │
│  2. 6 haneli kodu gir (5dk geçerli)                │
│     [4] [8] [2] [9] [1] [5]                        │
│     [Doğrula]                                       │
│                                                     │
│  3. Randevularım                                    │
│     ┌─────────────────────────────────────────┐    │
│     │ 📅 5 Aralık 2025 - 14:00                │    │
│     │ 📋 Teslim - Submariner                  │    │
│     │ 👤 Ece Argun                             │    │
│     │ [Değiştir] [İptal Et]                   │    │
│     └─────────────────────────────────────────┘    │
│                                                     │
│     [+ Yeni Randevu Al]                            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 5.5 Güvenlik Önlemleri

| Önlem | Değer |
|-------|-------|
| Rate Limit (numara) | Max 3 SMS / 15 dakika |
| Rate Limit (IP) | Max 10 deneme / saat |
| Kod Geçerliliği | 5 dakika |
| Yanlış Deneme | 3 hata = 30dk bloke |
| Session Süresi | 1 saat |

---

## 6. WHATSAPP RANDEVU BOTU

### 6.1 Meta Politikası (Ekim 2025)

**YASAKLANAN (15 Ocak 2026'dan itibaren):**
- ChatGPT tarzı genel amaçlı AI chatbotlar
- "Her konuda sohbet" botları
- Perplexity, Copilot gibi asistanlar

**İZİN VERİLEN:**
- Randevu alma/iptal botları ✅
- Sipariş takip botları ✅
- Müşteri destek botları ✅
- Yapılandırılmış iş akışları ✅

**SONUÇ: RANDEVU BOTU YAPABİLİRSİNİZ!**

### 6.2 Bot Özellikleri

| Özellik | Açıklama |
|---------|----------|
| Randevu alma | Doğal dil ile veya menü ile |
| Randevu sorgulama | Telefon veya kod ile |
| Randevu değiştirme | Tarih/saat değişikliği |
| Randevu iptali | Tek mesajla iptal |
| Çalışma saatleri | Bilgi verme |
| Konum | Google Maps linki |
| Canlı destek | Personele yönlendirme |

### 6.3 AI Kullanımı

**YASAL mı?** EVET - İş sürecine entegre AI izinli.

**Kullanım Alanları:**

1. **Doğal Dil Anlama (NLU)**
```
Müşteri: "yarın öğleden sonra müsait misiniz"
AI analiz:
  → intent: check_availability
  → date: tomorrow
  → time_range: afternoon (12:00-18:00)
```

2. **Intent Detection**
```
"randevu almak istiyorum"      → book_appointment
"saatimi değiştirebilir miyim" → reschedule
"iptal etmek istiyorum"        → cancel
"ne zaman gelebilirim"         → check_availability
```

3. **Entity Extraction**
```
"5 Aralık saat 14'te teslim için randevu istiyorum"
  → date: 2025-12-05
  → time: 14:00
  → type: delivery
```

### 6.4 System Prompt (AI Kısıtlama)

```
Sen Rolex İzmir İstinyepark mağazasının randevu asistanısın.

SADECE şu konularda yardımcı olabilirsin:
1. Randevu alma
2. Randevu sorgulama
3. Randevu değiştirme
4. Randevu iptali
5. Çalışma saatleri bilgisi
6. Mağaza lokasyonu

YAPAMAZSIN:
- Saat fiyatları hakkında bilgi verme
- Stok durumu hakkında bilgi verme
- Genel sohbet
- Randevu dışı konular

Her zaman Türkçe yanıt ver.
Profesyonel ve nazik ol.
```

### 6.5 Örnek Konuşma

```
Müşteri: Merhaba

Bot: Merhaba! Rolex İzmir İstinyepark'a hoş geldiniz. 🕐

     Size nasıl yardımcı olabilirim?

     1️⃣ Randevu Al
     2️⃣ Randevumu Sorgula
     3️⃣ Randevumu İptal Et
     4️⃣ Çalışma Saatleri
     5️⃣ Konum / Yol Tarifi
     0️⃣ Canlı Destek
```

```
Müşteri: yarın saat 2'de teslim almaya gelebilir miyim?

Bot: Yarın (3 Aralık) saat 14:00 müsait görünüyor! ✅

     Bilgilerinizi alayım:
     Ad Soyad:

Müşteri: Ahmet Yılmaz

Bot: Teslim alacağınız ürün (model):

Müşteri: Submariner

Bot: ✅ Randevunuz oluşturuldu!

     📅 3 Aralık 2025 Salı
     🕐 14:00
     📋 Teslim - Submariner
     📍 Rolex İzmir İstinyepark

     Randevu kodunuz: #RLX2024-1234

     Sizi bekliyoruz! 🎉
```

### 6.6 AI Maliyet

| Model | Input | Output | Aylık Tahmini |
|-------|-------|--------|---------------|
| GPT-4o-mini | $0.15/1M token | $0.60/1M token | ~5-10 TL |
| Claude Haiku | $0.25/1M token | $1.25/1M token | ~10-15 TL |

**Not:** Günde 50 konuşma, ortalama 10 mesaj varsayımı.

---

## 7. E-POSTA SİSTEMİ (RESEND)

### 7.1 Neden Resend?

- Modern API
- React Email desteği
- Kolay entegrasyon
- Türkçe karakterler sorunsuz

### 7.2 Free Tier

- 3,000 email/ay
- 1 domain
- Randevu sistemi için yeterli

### 7.3 Özel Domain Kullanımı

```
Gönderen: info@rolexizmir.com
Konu: Randevu Onayı

Merhaba Ahmet Bey,

Randevunuz oluşturuldu:
📅 3 Aralık 2025 Salı
🕐 14:00
📋 Teslim - Submariner

Rolex İzmir İstinyepark
```

### 7.4 DNS Ayarları

```
SPF:   TXT  v=spf1 include:resend.com ~all
DKIM:  TXT  (Resend'den alınacak)
DMARC: TXT  v=DMARC1; p=none
```

---

## 8. TOPLAM MALİYET

| Servis | Aylık | Yıllık |
|--------|-------|--------|
| Firebase | $0 | $0 |
| Netgsm SMS | ~250 TL | ~3.000 TL |
| AI (GPT-4o-mini) | ~10 TL | ~120 TL |
| Resend Email | $0 | $0 |
| WhatsApp API | ~$0* | ~$0* |
| **TOPLAM** | **~260 TL** | **~3.120 TL** |

*WhatsApp: Conversation-based, düşük hacimde ücretsiz

---

## 9. GEÇİŞ PLANI

### FAZ 1: Hazırlık (1 Hafta)
- [ ] Firebase projesi oluştur
- [ ] Firestore veri yapısını tasarla
- [ ] Netgsm hesabı aç
- [ ] Resend hesabı aç ve domain doğrula

### FAZ 2: Backend Geçişi (2 Hafta)
- [ ] Cloud Functions ile API endpoints
- [ ] Firestore'a veri migration
- [ ] WhatsApp webhook'ları taşı
- [ ] Email sistemini Resend'e geçir
- [ ] SMS entegrasyonu (Netgsm)

### FAZ 3: Frontend Güncellemeleri (1 Hafta)
- [ ] Firebase Hosting'e deploy
- [ ] Realtime listeners ekle
- [ ] PWA manifest ve service worker
- [ ] Push notification entegrasyonu

### FAZ 4: WhatsApp Bot (1 Hafta)
- [ ] Bot akışı tasarla
- [ ] AI entegrasyonu (intent detection)
- [ ] Test ve iyileştirme

### FAZ 5: Müşteri Portal (1 Hafta)
- [ ] SMS doğrulama akışı
- [ ] Randevu yönetim sayfası
- [ ] Güvenlik önlemleri

### FAZ 6: Go Live
- [ ] Custom domain bağla
- [ ] Son testler
- [ ] Canlıya al
- [ ] Eski sistemi kapat

---

## 10. KAZANIMLAR

### Anlık
| Özellik | Fayda |
|---------|-------|
| 6-7x Hız | Profesyonel izlenim |
| Realtime | Çakışma sorunu çözümü |
| Push Notification | İptal oranı düşer |

### Orta Vadeli
| Özellik | Fayda |
|---------|-------|
| WhatsApp Bot | 7/24 randevu alma |
| SMS Portal | Müşteri self-servis |
| Analytics | Veri odaklı kararlar |

### Uzun Vadeli
| Özellik | Fayda |
|---------|-------|
| PWA | Mobil uygulama deneyimi |
| Offline | Kesintisiz hizmet |
| Ölçeklenebilirlik | Yeni şube hazırlığı |

---

## 📝 KAYNAKLAR

- [Netgsm Fiyatları](https://www.netgsm.com.tr/fiyatlar/toplu-sms)
- [Firebase Pricing](https://firebase.google.com/pricing)
- [Resend Pricing](https://resend.com/pricing)
- [WhatsApp Bot Policy](https://techcrunch.com/2025/10/18/whatssapp-changes-its-terms-to-bar-general-purpose-chatbots-from-its-platform/)
- [Meta WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)

---

**Son Güncelleme:** 2 Aralık 2025
