# 📊 GOOGLE SHEETS VERİTABANI KURULUM REHBERİ

**Amaç:** `PropertiesService` limitlerini aşmak için Google Sheets'i veritabanı olarak kullanmak  
**Tablo Adı:** `Randevu_Sistemi_DB`

---

## 🚀 ADIM 1: YENİ GOOGLE SHEETS OLUŞTUR

1. **Google Sheets'e git:** https://sheets.google.com
2. **Boş e-tablo oluştur:** Sol üstte `+` (Boş) tıkla
3. **İsim ver:** Sol üstteki "Adsız e-tablo" yazısına tıkla → `Randevu_Sistemi_DB` yaz

---

## 🔑 ADIM 2: SPREADSHEET ID'Yİ KAYDET

URL şu formatta olacak:
```
https://docs.google.com/spreadsheets/d/1A2B3C4D5E6F7G8H9I0J/edit#gid=0
                                       ↑___________________↑
                                       BU KISIM SPREADSHEET ID
```

**Örnek:**
- URL: `https://docs.google.com/spreadsheets/d/1xYz2AbCdEfGhIjKlMnOpQrStUvWxYz/edit`
- ID: `1xYz2AbCdEfGhIjKlMnOpQrStUvWxYz`

📝 **KAYDET:** `SPREADSHEET_ID = ____________________________`

---

## 📑 ADIM 3: SEKME (SHEET) OLUŞTUR

Altta "Sayfa1" yazan sekmeyi göreceksin. Toplamda **4 sekme** oluşturacağız:

### Sekme Oluşturma:
1. Alt kısımda `+` işaretine tıkla (yeni sayfa ekle)
2. Sekme adına çift tıkla → yeniden adlandır
3. Bu işlemi 4 kez yap

**Sekme İsimleri (TAM OLARAK bu isimler):**
```
Staff | Shifts | Settings | Logs
```

⚠️ **DİKKAT:** İsimler büyük/küçük harf duyarlı! `Staff` yaz, `staff` değil.

---

## 📋 ADIM 4: HER SEKME İÇİN SÜTUN BAŞLIKLARI

### 📌 SEKME 1: Staff (Personel)

**İlk satıra (A1'den başlayarak) şu başlıkları yaz:**

| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| **id** | **name** | **title** | **email** | **phone** | **color** | **active** | **createdAt** |

**Açıklamalar:**
- `id` → Benzersiz personel ID (örn: "staff_001")
- `name` → Personel adı soyadı (örn: "Ahmet Yılmaz")
- `title` → Unvan (örn: "Satış Danışmanı")
- `email` → E-posta adresi
- `phone` → Telefon numarası
- `color` → Takvimde gösterilecek renk (örn: "#006039")
- `active` → Aktif mi? (TRUE/FALSE)
- `createdAt` → Oluşturulma tarihi (ISO format)

**Örnek Veri (2. satıra):**
| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| staff_001 | Ahmet Yılmaz | Satış Danışmanı | ahmet@rolex.com | 05551234567 | #006039 | TRUE | 2024-01-15T10:00:00Z |

---

### 📌 SEKME 2: Shifts (Vardiyalar)

**İlk satıra şu başlıkları yaz:**

| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| **id** | **staffId** | **date** | **shiftType** | **startHour** | **endHour** | **createdAt** |

**Açıklamalar:**
- `id` → Benzersiz vardiya ID (örn: "shift_20241126_001")
- `staffId` → Hangi personele ait (Staff tablosundaki id)
- `date` → Vardiya tarihi (YYYY-MM-DD formatında, örn: "2024-11-26")
- `shiftType` → Vardiya tipi: `morning`, `evening`, veya `full`
- `startHour` → Başlangıç saati (sayı, örn: 11)
- `endHour` → Bitiş saati (sayı, örn: 18)
- `createdAt` → Oluşturulma tarihi

**Örnek Veri (2. satıra):**
| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| shift_20241126_001 | staff_001 | 2024-11-26 | morning | 11 | 18 | 2024-11-25T09:00:00Z |

**Vardiya Tipleri:**
- `morning` → 11:00 - 18:00
- `evening` → 14:00 - 21:00
- `full` → 11:00 - 21:00

---

### 📌 SEKME 3: Settings (Ayarlar)

**İlk satıra şu başlıkları yaz:**

| A | B | C |
|---|---|---|
| **key** | **value** | **updatedAt** |

**Açıklamalar:**
- `key` → Ayar adı
- `value` → Ayar değeri (JSON string olabilir)
- `updatedAt` → Son güncelleme tarihi

**Önceden Eklenecek Ayarlar (2. satırdan itibaren):**

| key | value | updatedAt |
|-----|-------|-----------|
| maxDailyDelivery | 3 | 2024-11-26T00:00:00Z |
| slotDurationMinutes | 60 | 2024-11-26T00:00:00Z |
| workingHoursStart | 11 | 2024-11-26T00:00:00Z |
| workingHoursEnd | 21 | 2024-11-26T00:00:00Z |
| allowedAppointmentTypes | ["delivery","shipping","service","meeting","management"] | 2024-11-26T00:00:00Z |
| defaultStaffColor | #006039 | 2024-11-26T00:00:00Z |
| systemVersion | 2.0.0 | 2024-11-26T00:00:00Z |

---

### 📌 SEKME 4: Logs (Sistem Logları)

**İlk satıra şu başlıkları yaz:**

| A | B | C | D |
|---|---|---|---|
| **timestamp** | **level** | **message** | **data** |

**Açıklamalar:**
- `timestamp` → Log zamanı (ISO format)
- `level` → Log seviyesi: `INFO`, `WARN`, `ERROR`
- `message` → Log mesajı
- `data` → Ek veri (JSON string, opsiyonel)

**Örnek Veri:**
| timestamp | level | message | data |
|-----------|-------|---------|------|
| 2024-11-26T10:30:00Z | INFO | Sistem başlatıldı | {} |
| 2024-11-26T10:31:00Z | INFO | Randevu oluşturuldu | {"appointmentId":"apt_001"} |

---

## 🎨 ADIM 5: FORMATLAMA (Opsiyonel ama Önerilen)

### A) Başlık Satırını Vurgula
1. Her sekmede 1. satırı seç (satır numarasına tıkla)
2. **Kalın** yap (Ctrl+B)
3. **Arka plan rengi** ver (koyu yeşil: #006039, yazı beyaz)

### B) Sütun Genişliklerini Ayarla
1. Sütun başlığı harflerinin arasına gel (A|B arası)
2. Çift tıkla → Otomatik genişlik

### C) Başlık Satırını Dondur
1. **Görünüm** menüsü → **Dondur** → **1 satır**
2. Bu sayede aşağı kaydırınca başlıklar görünür kalır

---

## 🔒 ADIM 6: PAYLAŞIM AYARLARI

### A) Apps Script'in Erişebilmesi İçin:

1. Sağ üstte **Paylaş** butonuna tıkla
2. "Genel erişim" bölümünde:
   - **"Kısıtlı"** seçili olmalı (varsayılan)
   - Apps Script aynı Google hesabıyla çalıştığı için ekstra paylaşım GEREKMEZ

### B) Eğer Farklı Hesap Kullanılıyorsa:
1. Apps Script'in çalıştığı Google hesabının e-postasını ekle
2. **Düzenleyici** yetkisi ver

---

## ✅ ADIM 7: DOĞRULAMA CHECKLIST

Aşağıdakileri kontrol et:

- [ ] Spreadsheet adı: `Randevu_Sistemi_DB`
- [ ] Spreadsheet ID'yi not aldım
- [ ] 4 sekme var: `Staff`, `Shifts`, `Settings`, `Logs`
- [ ] Her sekmede başlık satırı (1. satır) dolu
- [ ] `Settings` sekmesinde varsayılan ayarlar girildi
- [ ] Başlık satırları donduruldu

---

## 📸 GÖRSEL REHBER

### Sheets Genel Görünüm:
```
┌─────────────────────────────────────────────────────────────────┐
│  📊 Randevu_Sistemi_DB                              ⭐ 📤 Paylaş │
├─────────────────────────────────────────────────────────────────┤
│  A         │ B        │ C       │ D      │ E     │ F     │ ... │
├────────────┼──────────┼─────────┼────────┼───────┼───────┼─────┤
│1│ id       │ name     │ title   │ email  │ phone │ color │ ... │  ← BAŞLIK
├────────────┼──────────┼─────────┼────────┼───────┼───────┼─────┤
│2│ staff_001│ Ahmet Y. │ Satış D.│ a@r.com│ 0555..│#006039│ ... │  ← VERİ
├────────────┼──────────┼─────────┼────────┼───────┼───────┼─────┤
│3│          │          │         │        │       │       │     │
└────────────┴──────────┴─────────┴────────┴───────┴───────┴─────┘
     ↓           ↓           ↓          ↓
   Staff     Shifts     Settings     Logs        ← SEKMELER
```

---

## 🔗 ADIM 8: SCRIPT PROPERTIES'E EKLE

Google Sheets'i oluşturduktan sonra:

1. https://script.google.com → Projeyi aç
2. ⚙️ **Project Settings** → **Script Properties**
3. **Add script property** tıkla
4. Ekle:
   - **Property:** `SPREADSHEET_ID`
   - **Value:** `[Senin Spreadsheet ID'n]`
5. **Save** tıkla

---

## 📋 HAZIR ŞABLON (Kopyala-Yapıştır)

Aşağıdaki başlıkları doğrudan Google Sheets'e yapıştırabilirsin:

### Staff Sekmesi (A1'e yapıştır):
```
id	name	title	email	phone	color	active	createdAt
```

### Shifts Sekmesi (A1'e yapıştır):
```
id	staffId	date	shiftType	startHour	endHour	createdAt
```

### Settings Sekmesi (A1'e yapıştır):
```
key	value	updatedAt
maxDailyDelivery	3	2024-11-26T00:00:00Z
slotDurationMinutes	60	2024-11-26T00:00:00Z
workingHoursStart	11	2024-11-26T00:00:00Z
workingHoursEnd	21	2024-11-26T00:00:00Z
defaultStaffColor	#006039	2024-11-26T00:00:00Z
```

### Logs Sekmesi (A1'e yapıştır):
```
timestamp	level	message	data
```

⚠️ **NOT:** Yukarıdakiler TAB ile ayrılmış. Kopyalayıp yapıştırınca otomatik sütunlara dağılacak.

---

## ❓ SIKÇA SORULAN SORULAR

**S: Mevcut veriler ne olacak?**
C: Migration script ile mevcut PropertiesService verileri bu tablolara aktarılacak. Claude Code bunu yapacak.

**S: Sheets'e manuel veri girmeli miyim?**
C: Hayır, sadece başlıkları ve Settings varsayılanlarını gir. Gerisi sistem tarafından yönetilecek.

**S: Birisi yanlışlıkla veri silerse?**
C: Google Sheets'in versiyon geçmişi var. Dosya → Sürüm geçmişi → Önceki sürümlere bak

**S: Sheets çok büyürse ne olur?**
C: Google Sheets 10 milyon hücreye kadar destekliyor. Randevu sistemi için fazlasıyla yeterli.

---

**Sheets hazır olduğunda bana haber ver! ✅**
