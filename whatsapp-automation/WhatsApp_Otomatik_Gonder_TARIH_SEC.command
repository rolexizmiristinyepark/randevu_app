#!/bin/bash
# WhatsApp Otomatik Mesaj Gönderici - TARİH SEÇ
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

# Tarih girdisi al
echo -e "${YELLOW}Tarih formatı: YYYY-MM-DD (örn: 2025-10-24)${NC}"
echo -n "Tarih girin (boş bırakırsanız bugün kullanılır): "
read INPUT_DATE

# Tarih kontrolü
if [ -z "$INPUT_DATE" ]; then
    INPUT_DATE=$(date +%Y-%m-%d)
    echo -e "${GREEN}📅 Bugünün tarihi kullanılıyor: ${INPUT_DATE}${NC}"
else
    echo -e "${GREEN}📅 Seçilen tarih: ${INPUT_DATE}${NC}"
fi
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
python3 whatsapp_selenium.py "$INPUT_DATE"

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
