# 📱 WhatsApp Otomatik Mesaj Gönderici

Rolex İzmir İstinyepark randevu sistemi için otomatik WhatsApp hatırlatma aracı.

## ✨ Özellikler

- ✅ **Tek Tıklama:** Çift tıkla, gerisini script halleder
- ✅ **WhatsApp Desktop:** Native app desteği
- ✅ **Backend Entegrasyonu:** Admin panelden veri çeker
- ✅ **Otomatik Bekleme:** Spam koruması (12 saniye/mesaj)
- ✅ **Türkçe Karakter:** Tam destek
- ✅ **Hata Yönetimi:** WhatsApp açık değilse uyarır
- ✅ **macOS Bildirimleri:** İşlem durumu bildirimi

## 🚀 Kurulum

### 1. Gereksinimler

```bash
# Python 3 kurulu mu kontrol et
python3 --version

# Eğer kurulu değilse Homebrew ile kur
brew install python3
```

### 2. Paketleri Yükle

```bash
cd whatsapp-automation

# Virtual environment oluştur (önerilen)
python3 -m venv venv
source venv/bin/activate

# Gerekli paketleri yükle
pip3 install -r requirements.txt
```

### 3. WhatsApp Desktop Kur

```bash
# Homebrew ile kur
brew install --cask whatsapp

# Veya App Store'dan indir
# WhatsApp'ı aç ve QR kod ile giriş yap
```

## 📦 .app Paketi Oluşturma

```bash
# Virtual environment aktif olmalı
source venv/bin/activate

# .app paketi oluştur
python3 setup.py py2app

# Sonuç: dist/WhatsApp Hatırlatıcı.app
```

### .app'i Uygulamalar Klasörüne Taşı

```bash
cp -r "dist/WhatsApp Hatırlatıcı.app" /Applications/
```

## 🎯 Kullanım

### Yöntem 1: Direkt Script

```bash
python3 whatsapp_sender.py
```

### Yöntem 2: .app Paketi

1. **Uygulamalar** klasöründe **WhatsApp Hatırlatıcı** ikonuna çift tıkla
2. Tarih gir (boş bırakırsan bugün)
3. Enter'a bas
4. WhatsApp Desktop otomatik açılır
5. Mesajlar otomatik gönderilir

## ⚙️ Yapılandırma

`whatsapp_sender.py` içinde ayarlanabilir:

```python
# Her mesaj arası bekleme süresi (saniye)
WAIT_TIME_BETWEEN_MESSAGES = 12

# Arama sonrası bekleme (saniye)
WAIT_TIME_AFTER_SEARCH = 3

# Chat açıldıktan sonra bekleme (saniye)
WAIT_TIME_AFTER_OPEN_CHAT = 2
```

## ⚠️ Önemli Notlar

### WhatsApp Kuralları

- 🚫 **Spam yapma:** Her mesaj arası en az 10-12 saniye bekle
- 🚫 **Toplu mesaj limiti:** Günde maksimum 100-150 mesaj
- 🚫 **Aynı mesajı tekrarlama:** WhatsApp algılayabilir
- ✅ **Kişiselleştir:** Her mesajda müşteri adı kullan

### Kullanım Sırasında

- ✅ WhatsApp Desktop açık ve giriş yapılmış olmalı
- ✅ Mac'i uyku moduna alma
- ✅ Fare/klavyeye dokunma (script kontrolü ele alır)
- ✅ Ekranı değiştirme
- ⚠️ İlk çalıştırmada "Erişilebilirlik İzni" isteyebilir

### Performans

| Müşteri Sayısı | Tahmini Süre |
|----------------|--------------|
| 5 müşteri | ~1 dakika |
| 10 müşteri | ~2 dakika |
| 20 müşteri | ~4 dakika |
| 50 müşteri | ~10 dakika |

## 🔧 Sorun Giderme

### "PyAutoGUI yüklü değil" hatası

```bash
pip3 install pyautogui
```

### "WhatsApp Desktop açılamadı" hatası

```bash
# WhatsApp Desktop kurulu mu kontrol et
ls /Applications | grep -i whatsapp

# Kurulu değilse kur
brew install --cask whatsapp
```

### Erişilebilirlik İzni

1. **Sistem Tercihleri** → **Güvenlik ve Gizlilik**
2. **Erişilebilirlik** sekmesi
3. **Terminal** veya **Python** uygulamasına izin ver
4. Kilit açık olmalı (sol alt köşe)

### Mesajlar gönderilmiyor

- WhatsApp Desktop açık mı?
- İnternet bağlantısı var mı?
- WhatsApp Web oturumu açık mı?
- Telefon numaraları doğru mu? (+90 ile başlamalı)

### Türkçe karakterler hatalı

Script zaten clipboard kullanıyor, sorun olmamalı. Olursa:

```bash
# Türkçe karakter desteğini kontrol et
python3 -c "print('ışğüçöİŞĞÜÇÖ')"
```

## 📊 API Entegrasyonu

Script backend'den şu API'yi çağırır:

```
GET https://script.google.com/.../exec?action=getTodayWhatsAppReminders&date=2025-10-20
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "customerName": "Ahmet Yılmaz",
      "startTime": "14:00",
      "link": "https://wa.me/905XXXXXXXXX?text=..."
    }
  ]
}
```

## 🔐 Güvenlik

- ✅ API key kullanımı (backend'de zaten var)
- ✅ Telefon numaraları lokal olarak işlenir
- ✅ Mesajlar direkt WhatsApp Desktop'tan gider
- ✅ Hiçbir veri saklanmaz

## 📝 Lisans

Rolex İzmir İstinyepark için özel geliştirilmiştir.

## 🆘 Destek

Sorun yaşarsanız:

1. Terminal'de hata mesajını kopyalayın
2. Screenshot alın
3. Geliştiriciyle iletişime geçin

## 🚀 Gelecek Özellikler

- [ ] GUI arayüz (PyQt6)
- [ ] Zamanlanmış gönderim
- [ ] Gönderim raporu (log)
- [ ] WhatsApp Business API entegrasyonu
- [ ] Çoklu dil desteği
