# RANDEVU SİSTEMİ GÜNCELLEME PLANI v4.0

**Tarih:** 20 Aralık 2025
**Branch:** admiring-hypatia
**Durum:** Aktif Geliştirme

---

## 1. URL YAPISI VE PROFİLLER

### 1.1 Profil Listesi (6 Adet)

| # | Profil | URL Formatı | Açıklama |
|---|--------|-------------|----------|
| 1 | **Genel** | `/profil_id` | Genel randevu linki |
| 2 | **Özel Müşteri** | `/profil_id/staff_id` | VIP müşteri linki |
| 3 | **Personel** | `/profil_id/staff_id` | Personel bazlı link |
| 4 | **Günlük Müşteri** | `/profil_id/` | Walk-in müşteriler |
| 5 | **Mağaza** | `/profil_id/` | Mağaza içi randevu |
| 6 | **Yönetim** | `/profil_id/staff_id` | Yönetim randevuları |

**Base URL:** `https://rolexizmiristinyepark.github.io/randevu_app/`

### 1.2 Randevu Türleri (4 Adet)

| Tür | Kod | Açıklama |
|-----|-----|----------|
| Görüşme | `consultation` | Müşteri görüşmesi |
| Saat Takdim | `delivery` | Saat teslimi |
| Teknik Servis | `service` | Servis randevusu |
| Gönderi | `shipping` | Kargo teslim |

---

## 2. PROFİL AYARLARI

Her profil için 6 ayar:

### 2.1 Ayar Tanımları

| # | Ayar | Açıklama | Seçenekler |
|---|------|----------|------------|
| 1 | `maxDailyDelivery` | Mağaza başı günlük max teslim+gönderi | ∞, 1, 2, 3, 4, 5 |
| 2 | `maxStaffDelivery` | Personel başı max teslim+gönderi | ∞, 1, 2, 3, 4, 5 |
| 3 | `staffFilter` | Personel filtresi | `id`, `role:sales`, `role:management`, `assignByAdmin` |
| 4 | `calendarFilter` | Takvim filtresi | `onlyToday`, `withToday`, `withoutToday` |
| 5 | `allowedTypes` | Randevu türü filtresi | Çoklu seçim + `all` |
| 6 | `generateId` | ID ata butonu | Tıklanınca ID üretir |

### 2.2 Ayar Davranışları

**Ayar 1 - Mağaza Günlük Max:**
- Günlük teslim + gönderi randevusu toplamı bu sayıyı aşamaz
- Limit dolunca o gün bloke olur (teslim/gönderi için)
- ∞ = Limitsiz

**Ayar 2 - Personel Max:**
- Personel başı teslim + gönderi toplamı bu sayıyı aşamaz
- Limit dolunca o personel o gün bloke olur

**Ayar 3 - Personel Filtresi:**
- `id` → Sadece URL'deki personel, otomatik atanır, seçim gösterilmez
- `role:sales` → Sales rolündekiler listelenir
- `role:management` → Management rolündekiler listelenir
- `assignByAdmin` → İlgili atanmadı olarak kalır, admin sonra atar

**Ayar 4 - Takvim Filtresi:**
- `onlyToday` → Bugün otomatik seçili, takvim gösterilmez
- `withToday` → Bugün dahil takvim gösterilir
- `withoutToday` → Yarından itibaren takvim gösterilir

**Ayar 5 - Randevu Türleri:**
- Tek tür seçili → Otomatik seçilir, seçim gösterilmez
- Birden fazla → Müşteri seçer
- `all` → Tüm türler seçili

---

## 3. PERSONEL ALANLARI

```typescript
interface Staff {
  id: string;           // Güvenli ID (8 karakter)
  name: string;         // Ad Soyad
  email: string;        // E-posta
  phone: string;        // Telefon
  isAdmin: boolean;     // Admin yetkisi
  role: 'sales' | 'management' | 'greeter';  // Rol
  active: boolean;      // Aktif/Pasif
  password?: string;    // Hash'lenmiş şifre (sadece backend)
}
```

---

## 4. RANDEVU AKIŞI

```
1. Randevu Türü Seç (allowedTypes'a göre)
   ↓
2. Takvimden Gün Seç (calendarFilter'a göre)
   ↓
3. Personel Seç (staffFilter'a göre)
   ↓
4. Slot Seç
   ↓
5. Form Doldur
   ↓
6. Submit
```

---

## 5. ADMIN PANEL SEKME YAPISI

### 5.1 Ana Sekmeler (4 Adet)

```
┌──────────┬──────────┬──────────┬──────────┐
│ Randevu  │ Bildirim │   Team   │   Apps   │
└──────────┴──────────┴──────────┴──────────┘
```

### 5.2 Alt Sekmeler

**1. Randevu Sekmesi:**
- Randevu Linkleri
- Randevu Oluştur
- Randevular
- Randevu Ayarları

**2. Bildirim Sekmesi:**
- WhatsApp
- Mail
- Message (Coming Soon)

**3. Team Sekmesi:**
- Çalışanlar
- Vardiyalar

**4. Apps Sekmesi:**
- Teslim Onay Formu (Coming Soon)
- Teslim Tutanak (Coming Soon)
- Teknik Servis Formu (Coming Soon)
- Katalog (Coming Soon)

---

## 6. RANDEVU LİNKLERİ BÖLÜMÜ

3 Alt Bölüm:

### 6.1 Personel Linkleri
- Her personel için link
- Kopyala + Aç butonları

### 6.2 Özel Müşteri Linkleri
- VIP müşteri linkleri
- Kopyala + Aç butonları

### 6.3 Diğer Linkler
- Genel link
- Günlük müşteri linki
- Mağaza linki

---

## 7. RANDEVU OLUŞTUR BÖLÜMÜ

2 Alt Bölüm:

### 7.1 Yönetim Randevusu
- Yönetim profili ile randevu oluştur

### 7.2 Mağaza Randevusu
- Mağaza profili ile randevu oluştur

---

## 8. WHATSAPP SİSTEMİ

### 8.1 Flow Bölümü

**A) Zaman Bazlı Flow:**
1. Flow adı
2. Flow açıklaması
3. Randevu profili seç (çoklu)
4. Template seç
5. Gönderilecek randevular: `bugünün` | `yarının`
6. Gönderilecek kişiler (çoklu):
   - Müşteriler
   - Personeller
   - Roller
   - Admin

**B) Olay Bazlı Flow:**
1. Flow adı
2. Flow açıklaması
3. Trigger seç:
   - Randevu oluşturulduğunda
   - İlgili atandığında
   - Randevu iptal edildiğinde
   - Randevu düzenlendiğinde
   - Randevuya gelmediğinde
4. Randevu profili seç (çoklu)
5. Template seç (çoklu - birden fazla mesaj)
6. Gönderilecek kişiler (çoklu)

### 8.2 Template Bölümü

WhatsApp Business API uyumlu:

1. Şablon adı (Meta'daki template name)
2. Şablon açıklaması
3. Şablon dili
4. Değişken sayısı (±1 ile ayarlanabilir)
5. Değişkenler:
   - Müşteri Adı
   - Müşteri Telefon
   - Müşteri E-posta
   - Randevu Tarihi
   - Randevu Saati
   - Randevu Ek Bilgi
   - Personel Adı
   - Personel Telefon
   - Personel E-posta
   - Randevu Türü
   - Randevu Profili

### 8.3 Mesajlar Bölümü

- Gönderilen mesaj raporları
- Alınan mesajlar
- Mesaj detayları

---

## 9. MAIL SİSTEMİ

### 9.1 Flow Bölümü
- Flow adı
- Flow açıklaması
- Trigger seçimi (WhatsApp ile aynı)
- Randevu profili seçimi (çoklu)
- Template seçimi
- Gönderilecek seçimi (çoklu)

### 9.2 Template Bölümü
- Metin editörü
- Değişken ekleme (WhatsApp değişkenleri ile aynı)

---

## 10. TASARIM PRENSİPLERİ

Tüm sayfalar için tutarlı tasarım:

- **Butonlar:** Aynı stil, hover efektleri
- **Uyarılar:** Tutarlı alert tasarımı
- **Kenarlıklar:** Aynı border-radius, shadow
- **Animasyonlar:** Tutarlı geçiş efektleri
- **Yazı Fontları:** Montserrat
- **Logolar:** Rolex logo tutarlı kullanım
- **Renkler:**
  - Primary: #006039 (Rolex yeşil)
  - Secondary: #C9A55A (Altın)
  - Text: #2C2C2C
  - Background: #FAFAFA

---

## 11. UYGULAMA FAZLARI

### FAZ 1: Altyapı Temizliği ✅
- [x] Eski plan dosyalarını sil
- [x] Güvenlik analizi
- [x] Kod temizliği
- [ ] Unused kod kaldırma

### FAZ 2: Profil Sistemi
- [ ] URL routing yapısı (`/profil_id/staff_id`)
- [ ] Profil ayarları veri yapısı
- [ ] Backend profil çözümleme
- [ ] Frontend profil UI

### FAZ 3: Admin Panel Yeniden Yapılandırma
- [ ] 4 ana sekme yapısı
- [ ] Alt sekme navigasyonu
- [ ] Responsive tasarım
- [ ] Global stil birleştirme

### FAZ 4: Randevu Linkleri
- [ ] Link bölümleri (Personel, Özel Müşteri, Diğer)
- [ ] Link CRUD işlemleri
- [ ] Kopyala/Aç butonları

### FAZ 5: WhatsApp Sistemi
- [ ] Flow yönetimi (zaman/olay bazlı)
- [ ] Template yönetimi
- [ ] Mesaj raporları

### FAZ 6: Mail Sistemi
- [ ] Flow yönetimi
- [ ] Template editörü

### FAZ 7: Apps Sekmesi
- [ ] Coming Soon sayfaları
- [ ] Gelecek özellikler placeholder

---

## 12. GİT İŞ AKIŞI

Her değişiklik için:

1. Değişiklik yap
2. Test et
3. `git add .`
4. `git commit -m "Açıklayıcı Türkçe mesaj"`
5. Sonraki değişikliğe geç

**Kurallar:**
- ❌ `git push --force` YASAK
- ❌ `git reset --hard` dikkatli kullan
- ✅ Her commit atomik olmalı
- ✅ Geri alınabilir olmalı

---

## 13. GÜVENLİK KONTROL LİSTESİ

- [x] XSS koruması (sanitizeInput, escapeHtml)
- [x] Session auth (10 dk timeout)
- [x] Rate limiting
- [x] Cloudflare Turnstile
- [x] PII maskeleme
- [x] KVKK aydınlatma metni
- [ ] KVKK onay checkbox (form'a eklenecek)

---

**Son Güncelleme:** 20 Aralık 2025
