# 🚀 Yeni Mac'te Kurulum Rehberi

## 📋 Ön Gereksinimler

### Python 3 Kontrolü
```bash
python3 --version
```

Eğer yüklü değilse:
```bash
# Homebrew ile Python yükle
brew install python3
```

### Chrome Tarayıcı
Chrome yüklü mü kontrol et. Yoksa:
- https://www.google.com/chrome/ adresinden indir

---

## ⚡ Hızlı Kurulum (3 Adım)

### 1️⃣ Terminal'i Aç
Spotlight → "Terminal" yazın → Enter

### 2️⃣ Klasöre Gidin
```bash
cd /path/to/whatsapp-automation
# Örnek: cd ~/Desktop/whatsapp-automation
```

### 3️⃣ Kurulum Script'ini Çalıştırın
```bash
chmod +x setup.sh
./setup.sh
```

✅ Kurulum tamamlandı!

---

## 🎯 Kullanım

### Selenium ile Tam Otomatik

#### Test (24.10.2025)
```bash
cd /path/to/whatsapp-automation
source venv/bin/activate
python3 whatsapp_selenium.py 2025-10-24
```

#### Bugün
```bash
cd /path/to/whatsapp-automation
source venv/bin/activate
python3 whatsapp_selenium.py
```

---

## 🔧 Applications Klasörüne Kısayol Ekle (Opsiyonel)

### 1️⃣ Test Butonu Oluştur
```bash
cat > /Applications/WhatsApp\ TEST.command << 'EOF'
#!/bin/bash
cd /path/to/whatsapp-automation
source venv/bin/activate
python3 whatsapp_selenium.py 2025-10-24
EOF

chmod +x /Applications/WhatsApp\ TEST.command
```

**NOT:** `/path/to/whatsapp-automation` kısmını gerçek yol ile değiştirin!

### 2️⃣ Bugün Butonu Oluştur
```bash
cat > /Applications/WhatsApp\ Bugün.command << 'EOF'
#!/bin/bash
cd /path/to/whatsapp-automation
source venv/bin/activate
python3 whatsapp_selenium.py
EOF

chmod +x /Applications/WhatsApp\ Bugün.command
```

---

## 📱 İlk Çalıştırma

1. **Çift tıklayın** veya Terminal'den çalıştırın
2. Chrome açılacak
3. **WhatsApp Web QR kodu** gösterecek
4. **Telefonunuzdan QR kodu okutun**
   - WhatsApp aç → Bağlı cihazlar → Cihaz bağla
5. ✅ Giriş yaptınız! Script otomatik çalışacak

**Sonraki kullanımlarda QR kod gerekmez!**

---

## ⚠️ Sorun Giderme

### "python3: command not found"
```bash
brew install python3
```

### "chrome not found"
Chrome'u yükleyin: https://www.google.com/chrome/

### "Permission denied"
```bash
chmod +x setup.sh
chmod +x /Applications/*.command
```

### Virtual environment hatası
```bash
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip3 install -r requirements.txt
```

---

## 🎉 Hepsi Bu!

Artık yeni Mac'te de çalışıyor!

**İlk Kullanım:** QR kod okut (1 kez)
**Sonraki Kullanımlar:** Çift tıkla, bekle, bitti! ✅
