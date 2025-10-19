#!/bin/bash
# WhatsApp Otomatik Mesaj Gönderici - BUGÜN
# Çift tıklayarak çalıştırın

# Terminal renkli çıktı
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Script'in bulunduğu dizine git
cd "$(dirname "$0")"

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}WhatsApp Otomatik Gönderici${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# Bugünün tarihini al (YYYY-MM-DD formatında)
TODAY=$(date +%Y-%m-%d)
echo -e "${GREEN}📅 Tarih: ${TODAY}${NC}"
echo ""

# Python3 kontrolü
if ! command -v python3 &> /dev/null; then
    echo -e "${YELLOW}❌ Python3 bulunamadı!${NC}"
    echo "Kurulum: brew install python3"
    read -p "Devam etmek için Enter'a basın..."
    exit 1
fi

# Selenium kontrolü
python3 -c "import selenium" 2>/dev/null
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Selenium yüklü değil, yükleniyor...${NC}"
    pip3 install selenium webdriver-manager
    echo ""
fi

# Script'i çalıştır
echo -e "${GREEN}🚀 Başlatılıyor...${NC}"
echo ""
python3 whatsapp_selenium.py "$TODAY"

# Hata kontrolü
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ İşlem tamamlandı!${NC}"
else
    echo ""
    echo -e "${YELLOW}❌ Bir hata oluştu!${NC}"
fi

echo ""
read -p "Kapatmak için Enter'a basın..."
