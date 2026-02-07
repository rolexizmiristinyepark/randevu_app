#!/bin/bash
# GAS'tan Supabase'e staff migration
# Tum personeli auth + staff tablosuna ekler

SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1dmp6eXh6c3pkaXJ1ZWhycnVwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDQ2OTU3NSwiZXhwIjoyMDg2MDQ1NTc1fQ.6mP7ond-6HP04V058aYy5qb80irSd6djooazFYmH5xY"
BASE_URL="https://zuvjzyxzszdiruehrrup.supabase.co"

# Renk kodlari
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Eski test admin'i sil (staff id=1, auth_user_id=43244df8...)
echo "Eski test admin siliniyor..."
curl -s -X DELETE "$BASE_URL/rest/v1/staff?id=eq.1" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "apikey: $SERVICE_KEY" > /dev/null 2>&1

curl -s -X DELETE "$BASE_URL/auth/v1/admin/users/43244df8-638d-4508-b7b7-d54cff73a7b8" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "apikey: $SERVICE_KEY" > /dev/null 2>&1

echo "---"

# Staff listesi: name|email|phone|role|isAdmin
STAFF_LIST=(
  "Serdar Benli|serdar.benli@kulahcioglu.com|905382348625|sales|true"
  "Ece Argun|ece.argun@kulahcioglu.com|905382348729|sales|false"
  "Gökhan Tokol|gokhan.tokol@kulahcioglu.com|905382348626|sales|false"
  "Sırma Karaarslan|sirma.karaarslan@kulahcioglu.com|905382348641|sales|false"
  "Gamze Tekin|gamze.tekin@kulahcioglu.com|905382348653|sales|false"
  "Okan Üstündağ|okan.ustundag@kulahcioglu.com|905363485110|sales|false"
  "Haluk Külahçıoğlu|haluk@kulahcioglu.com|905323451559|management|false"
  "Onur Külahçıoğlu|onur@kulahcioglu.com|905303937106|management|false"
  "Murat Külahçıoğlu|murat@kulahcioglu.com|905394908480|management|false"
  "Veysi Yıldırım|istinye@kulahcioglu.com|905550624247|greeter|false"
)

DEFAULT_PASSWORD="Rolex2026"

for entry in "${STAFF_LIST[@]}"; do
  IFS='|' read -r name email phone role is_admin <<< "$entry"

  echo -n "[$name] Auth user oluşturuluyor... "

  # 1. Auth user olustur
  AUTH_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/v1/admin/users" \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -H "apikey: $SERVICE_KEY" \
    -H "Content-Type: application/json" \
    --data-raw "{\"email\":\"$email\",\"password\":\"$DEFAULT_PASSWORD\",\"email_confirm\":true,\"user_metadata\":{\"name\":\"$name\"}}")

  # Auth user ID'yi cikart
  AUTH_USER_ID=$(echo "$AUTH_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)

  if [ -z "$AUTH_USER_ID" ] || [ "$AUTH_USER_ID" = "" ]; then
    echo -e "${RED}HATA${NC} - Auth olusturulamadi"
    echo "  Response: $AUTH_RESPONSE"
    continue
  fi

  echo -n "OK -> Staff kaydı... "

  # 2. Staff kaydı olustur
  STAFF_RESPONSE=$(curl -s -X POST "$BASE_URL/rest/v1/staff" \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -H "apikey: $SERVICE_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    --data-raw "{\"auth_user_id\":\"$AUTH_USER_ID\",\"name\":\"$name\",\"email\":\"$email\",\"phone\":\"$phone\",\"role\":\"$role\",\"is_admin\":$is_admin,\"is_vip\":false,\"active\":true,\"permissions\":{}}")

  STAFF_ID=$(echo "$STAFF_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0].get('id','') if isinstance(d,list) else d.get('id',''))" 2>/dev/null)

  if [ -z "$STAFF_ID" ] || [ "$STAFF_ID" = "" ]; then
    echo -e "${RED}HATA${NC}"
    echo "  Response: $STAFF_RESPONSE"
  else
    echo -e "${GREEN}OK${NC} (staff_id=$STAFF_ID, auth=$AUTH_USER_ID)"
  fi
done

echo ""
echo "=== MIGRATION TAMAMLANDI ==="
echo "Tum personel icin varsayılan sifre: $DEFAULT_PASSWORD"
echo "Admin girisi: serdar.benli@kulahcioglu.com / $DEFAULT_PASSWORD"
