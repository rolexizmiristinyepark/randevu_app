#!/bin/bash
# WhatsApp Hatırlatıcı - Hızlı Kurulum Scripti
# macOS için

set -e

echo "======================================"
echo "WhatsApp Hatırlatıcı - Kurulum"
echo "======================================"
echo ""

# Python 3 kontrolü
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 bulunamadı!"
    echo "Homebrew ile kurmak için:"
    echo "  brew install python3"
    exit 1
fi

echo "✅ Python 3 bulundu: $(python3 --version)"
echo ""

# WhatsApp Desktop kontrolü
if [ ! -d "/Applications/WhatsApp.app" ]; then
    echo "⚠️  WhatsApp Desktop bulunamadı!"
    echo "Homebrew ile kurmak için:"
    echo "  brew install --cask whatsapp"
    echo ""
    read -p "Şimdi kurmak istiyor musunuz? (E/H): " install_wa
    if [[ "$install_wa" =~ ^[Ee]$ ]]; then
        brew install --cask whatsapp
    else
        echo "❌ WhatsApp Desktop gereklidir!"
        exit 1
    fi
fi

echo "✅ WhatsApp Desktop bulundu"
echo ""

# Virtual environment oluştur
echo "📦 Virtual environment oluşturuluyor..."
python3 -m venv venv
source venv/bin/activate

# Paketleri yükle
echo "📦 Paketler yükleniyor..."
pip3 install --upgrade pip
pip3 install -r requirements.txt

echo ""
echo "======================================"
echo "✅ Kurulum Tamamlandı!"
echo "======================================"
echo ""
echo "Kullanım:"
echo "  1. Script olarak çalıştır:"
echo "     source venv/bin/activate"
echo "     python3 whatsapp_sender.py"
echo ""
echo "  2. .app paketi oluştur:"
echo "     source venv/bin/activate"
echo "     python3 setup.py py2app"
echo "     cp -r 'dist/WhatsApp Hatırlatıcı.app' /Applications/"
echo ""
