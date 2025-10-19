# 🚀 Hızlı Başlangıç

## 1️⃣ Kurulum (İlk Kez)

Terminal aç ve şunu çalıştır:

```bash
cd "/Users/serdarbenli/Desktop/new project/randevu-sistemi-main/whatsapp-automation"
./setup.sh
```

Bu komut:
- ✅ Python 3 kontrolü yapar
- ✅ WhatsApp Desktop kontrolü yapar
- ✅ Gerekli paketleri yükler
- ✅ Virtual environment oluşturur

**Süre:** ~2 dakika

---

## 2️⃣ .app Paketi Oluştur (Çift Tıklama İçin)

```bash
cd "/Users/serdarbenli/Desktop/new project/randevu-sistemi-main/whatsapp-automation"
source venv/bin/activate
python3 setup.py py2app
```

Oluşan paketi Uygulamalar klasörüne taşı:

```bash
cp -r "dist/WhatsApp Hatırlatıcı.app" /Applications/
```

**Süre:** ~1 dakika

---

## 3️⃣ Kullan

### Yöntem A: Terminal'den

```bash
cd "/Users/serdarbenli/Desktop/new project/randevu-sistemi-main/whatsapp-automation"
source venv/bin/activate
python3 whatsapp_sender.py
```

### Yöntem B: Çift Tıklama (Önerilen)

1. **Finder** → **Uygulamalar**
2. **WhatsApp Hatırlatıcı** ikonuna çift tıkla
3. Tarih gir (veya Enter = bugün)
4. Bekle, script mesajları gönderecek

---

## ⚡ Hızlı Test

Backend bağlantısını test et:

```bash
cd "/Users/serdarbenli/Desktop/new project/randevu-sistemi-main/whatsapp-automation"
source venv/bin/activate
python3 -c "
import urllib.request, json
url = 'https://script.google.com/macros/s/AKfycbwmowzsBLrAOjn-HVtw_LSLf-Gn0jrWdaQMrxaJeulqnhJCQduyyeSvctsWPAXxSAuo/exec?action=getTodayWhatsAppReminders&date=2025-10-20'
response = urllib.request.urlopen(url)
data = json.loads(response.read())
print('✅ Backend bağlantısı başarılı!')
print(f'Randevu sayısı: {len(data.get(\"data\", []))}')
"
```

---

## 🔧 Sorun mu var?

### "WhatsApp Desktop açılamadı"

```bash
brew install --cask whatsapp
```

### "PyAutoGUI yüklü değil"

```bash
pip3 install pyautogui
```

### "Permission denied"

```bash
chmod +x setup.sh
```

### Erişilebilirlik İzni

**Sistem Tercihleri** → **Güvenlik ve Gizlilik** → **Erişilebilirlik** → **Terminal** veya **Python**'a izin ver

---

## 📞 İletişim

Sorun yaşarsanız Terminal'deki hata mesajının ekran görüntüsünü alın.
