# 🔧 WhatsApp Template Hatası Çözümü

## ❌ HATA:
```
(#132018) There's an issue with the parameters in your template
```

Bu hata, Meta Business'ta oluşturduğunuz WhatsApp template'inin backend kodundaki parametrelerle eşleşmediği anlamına gelir.

---

## ✅ ÇÖZÜM: Template Oluşturma

### Adım 1: Meta Business Manager'a Git

1. **https://business.facebook.com** adresine git
2. **WhatsApp Manager** → **Message Templates**
3. **Create Template** butonuna tıkla

### Adım 2: Template Bilgileri

```
Template Name: randevu_hatirlatma_v1
Category: UTILITY
Language: Turkish (TR)
```

### Adım 3: Template İçeriği

**Header (Opsiyonel):**
```
Randevu Hatırlatması
```

**Body (Zorunlu):**
```
Merhaba {{1}},

{{2}} tarihinde {{3}} ile {{4}} randevunuz bulunmaktadır.

Lütfen randevunuzu unutmayınız. Herhangi bir değişiklik için lütfen bizimle iletişime geçiniz.

Rolex İzmir İstinyepark
```

**Parametreler:**
1. `{{1}}` = Müşteri Adı (örn: "Ahmet Yılmaz")
2. `{{2}}` = Tarih ve Saat (örn: "11 Kasım 2025 Salı 14:00")
3. `{{3}}` = Personel Adı (örn: "Serdar Benli")
4. `{{4}}` = Randevu Tipi (örn: "teslim" veya "görüşme")

**Footer (Opsiyonel):**
```
İstinyepark AVM, İzmir
```

**Buttons (Opsiyonel):**
```
Type: Call phone number
Button text: İlgili Personeli Ara
Phone number: {{1}} (Dynamic)
```

### Adım 4: Submit

1. **Submit** butonuna tıkla
2. Meta onayı bekle (genelde 1-24 saat)
3. Onaylandıktan sonra kullanabilirsiniz

---

## 🔍 MEVCUT TEMPLATE KONTROLÜ

Eğer zaten bir template oluşturduysanız ama hata alıyorsanız:

### 1. Template Adı Kontrolü

Backend'de kullanılan template adı:
```javascript
template: {
  name: 'randevu_hatirlatma_v1',  // Bu isim Meta'da da aynı olmalı
  language: {
    code: 'tr'
  }
}
```

**Meta Business'ta:**
- WhatsApp Manager → Message Templates
- Template adının **tam olarak** `randevu_hatirlatma_v1` olduğundan emin olun
- Büyük/küçük harf duyarlıdır!

### 2. Parametre Sayısı Kontrolü

Backend **4 body parametresi + 1 button parametresi** gönderiyor:

```javascript
Body parametreleri:
{{1}} = customerName      (örn: "Ahmet Yılmaz")
{{2}} = appointmentDateTime (örn: "11 Kasım 2025 Salı 14:00")
{{3}} = staffName         (örn: "Serdar Benli")
{{4}} = appointmentType   (örn: "teslim")

Button parametresi:
{{1}} = staffPhone        (örn: "905326933997")
```

**Meta'daki template'inizde de TAM OLARAK bu sırada ve sayıda parametre olmalı!**

### 3. Dil Kodu Kontrolü

- Backend: `tr` (Turkish)
- Meta template: Language = **Turkish (TR)**

---

## 🚨 HIZLI ÇÖZÜM

Eğer template parametrelerini düzenlemek istemiyorsanız, en kolay çözüm:

### Seçenek 1: Mevcut Template'i Sil ve Yeniden Oluştur

1. Meta Business → Message Templates
2. `randevu_hatirlatma_v1` template'ini sil
3. Yukarıdaki adımları takip ederek yeniden oluştur
4. Meta onayını bekle

### Seçenek 2: Backend Kodunu Template'e Uyarla

Eğer farklı bir template kullanıyorsanız, backend kodunu güncelleyin:

**apps-script-backend.js** dosyasında (satır ~2602):

```javascript
template: {
  name: 'SIZIN_TEMPLATE_ADINIZ',  // Meta'daki template adınız
  language: {
    code: 'tr'
  },
  components: [
    {
      type: 'body',
      parameters: [
        // Meta'daki parametrelere göre güncelleyin
        { type: 'text', text: customerName },
        { type: 'text', text: appointmentDateTime },
        // vb...
      ]
    }
  ]
}
```

---

## 📋 DOĞRU TEMPLATE ÖRNEĞİ

İşte backend koduyla %100 uyumlu Meta template örneği:

```
Template Name: randevu_hatirlatma_v1
Category: UTILITY
Language: Turkish (TR)

--- HEADER ---
Randevu Hatırlatması

--- BODY ---
Merhaba {{1}},

{{2}} tarihinde {{3}} ile {{4}} randevunuz bulunmaktadır.

Lütfen randevunuzu unutmayınız. Herhangi bir değişiklik için lütfen bizimle iletişime geçiniz.

Rolex İzmir İstinyepark

--- FOOTER ---
İstinyepark AVM, İzmir

--- BUTTONS ---
[Call Phone Number]
Text: İlgili Personeli Ara
Phone: {{1}} (Dynamic)
```

---

## 🧪 TEST

Template onaylandıktan sonra test edin:

1. Admin panele gir
2. **Randevular** sekmesi
3. Yarınki bir randevu oluştur
4. **WhatsApp Hatırlatıcıları Gönder** butonuna tıkla
5. Mesaj başarıyla gönderilmeli ✅

---

## 📞 WhatsApp Business API Kurulum (Özet)

Eğer hiç kurulum yapmadıysanız:

### 1. Meta Business Hesabı

1. https://business.facebook.com
2. Business hesabı oluştur
3. WhatsApp Business Platform ekle

### 2. Phone Number

1. WhatsApp Manager → Phone Numbers
2. Telefon numarası ekle ve doğrula
3. **Phone Number ID**'yi kopyala

### 3. Access Token

1. WhatsApp Manager → API Setup
2. **Temporary Access Token** → **Generate Permanent Token**
3. Token'ı kopyala

### 4. Backend Konfigürasyon

**apps-script-backend.js** dosyasında:

```javascript
const CONFIG = {
  WHATSAPP_PHONE_NUMBER_ID: '123456789012345',  // Phone Number ID
  WHATSAPP_ACCESS_TOKEN: 'EAAxxxxxxxxxxxxx',    // Permanent Token
  WHATSAPP_API_VERSION: 'v18.0',                // API version
};
```

### 5. Template Oluştur

Yukarıdaki adımları takip edin.

---

## ⚠️ ÖNEMLİ NOTLAR

1. **Template değişiklikleri Meta onayı gerektirir** (1-24 saat)
2. **Test modunda 1000 mesaj/ay ücretsiz**
3. **Production için Business Verification gerekli**
4. **Template adı değişirse backend kodu da güncellenmeli**
5. **Parametre sırası ve sayısı önemli!**

---

## 📊 HATA KODU REFERANSİ

| Hata Kodu | Açıklama | Çözüm |
|-----------|----------|-------|
| #132018 | Parameter hatası | Template parametrelerini kontrol et |
| #131026 | Template bulunamadı | Template adını kontrol et |
| #131042 | Template onaylanmamış | Meta onayını bekle |
| #131047 | Parametre eksik | Tüm parametreleri gönder |
| #100 | Invalid token | Access token'ı kontrol et |

---

## ✅ ÇÖZÜM KONTROL LİSTESİ

- [ ] Meta Business hesabı oluşturuldu
- [ ] WhatsApp Business Platform eklendi
- [ ] Telefon numarası doğrulandı
- [ ] Phone Number ID kopyalandı
- [ ] Permanent Access Token oluşturuldu
- [ ] Backend'de token ve phone ID güncellendi
- [ ] Template `randevu_hatirlatma_v1` oluşturuldu
- [ ] Template **4 body parametresi** içeriyor
- [ ] Template **1 button parametresi** içeriyor
- [ ] Template Meta tarafından onaylandı
- [ ] Test mesajı başarıyla gönderildi

---

## 🎯 SONUÇ

Template parametreleri doğru ayarlandığında WhatsApp hatırlatıcıları sorunsuz çalışacak!

Sorun devam ederse, Meta Business Support ile iletişime geçin: https://business.facebook.com/business/help
