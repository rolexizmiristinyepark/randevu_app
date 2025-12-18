# RANDEVU SİSTEMİ KAPSAMLI GÜNCELLEME PLANI

**Tarih:** 1 Aralık 2025
**Versiyon:** 3.1 (Güncellenmiş)
**Durum:** Planlama Aşaması

---

## 📋 İÇİNDEKİLER

1. [Genel Bakış](#1-genel-bakış)
2. [Randevu Profilleri](#2-randevu-profilleri)
3. [Randevu Türleri ve Süreleri](#3-randevu-türleri-ve-süreleri)
4. [Profil Ayarları Sistemi](#4-profil-ayarları-sistemi)
5. [Slot ve Çakışma Mantığı](#5-slot-ve-çakışma-mantığı)
6. [Personel Yönetimi Güncellemeleri](#6-personel-yönetimi-güncellemeleri)
7. [Yeni Auth Sistemi](#7-yeni-auth-sistemi)
8. [Admin Panel Sekmeleri](#8-admin-panel-sekmeleri)
9. [Yetki Sistemi](#9-yetki-sistemi)
10. [Teknik Uygulama Detayları](#10-teknik-uygulama-detayları)
11. [Fazlar ve Öncelikler](#11-fazlar-ve-öncelikler)

---

## 1. GENEL BAKIŞ

### 1.1 Amaç
Randevu sistemini merkezi ayar yönetimi ile basitleştirmek, farklı randevu profillerini tek bir yapıdan yönetmek ve güvenliği artırmak.

### 1.2 Temel Prensipler
- **Config-Driven:** Tüm kurallar admin ayarlarından gelir
- **Tek Akış:** URL → Profil → Ayarlar → Validation
- **Deploy Gereksiz:** Kural değişikliği = Admin'de ayar değiştir

---

## 2. RANDEVU PROFİLLERİ

### 2.1 Profil Listesi (6 Adet)

| Profil | URL | Başlık (Takvimde) | İlgili Alanı |
|--------|-----|-------------------|--------------|
| **Genel** | `?id=xxx` | "GENERAL" | Seçilen personel |
| **Personel** | `?id=xxx` | Personel adı | O personel |
| **VIP** | `?id=xxx` | "VIP-[Kişi Adı]" | Atanan personel |
| **Manuel** | Admin sekmesi | "MANUEL" | Seçilen personel |
| **Yönetim** | Admin sekmesi | "YONETIM" | Atanan personel |
| **Günlük** | `?id=xxx` | "WALK-IN" | Atanan personel |

**Önemli:** Tüm linkler `?id=xxxxxxxx` formatında. Profil, ID'nin ait olduğu kayıt tipinden belirlenir.

### 2.2 Link Tipleri ve ID Kaynakları

| Link Tipi | ID Kaynağı | Açıklama |
|-----------|------------|----------|
| **Genel** | Links tablosu (type: 'general') | Tek genel link |
| **Personel** | Staff tablosu | Her personelin kendi ID'si |
| **VIP** | Staff tablosu (role: 'management') | Yönetim rolündeki personeller |
| **Günlük** | Links tablosu (type: 'walkin') | Tek günlük link |

**VIP Linkleri:** `role: 'management'` olan personellerin ID'leri VIP linki olarak kullanılır.

### 2.3 URL → Profil Belirleme (Frontend)

```javascript
async function getProfilFromURL() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id) return 'genel'; // Varsayılan

  // Backend'den ID tipini sorgula
  const response = await apiCall('resolveId', { id });

  // Response: { type: 'general' | 'staff' | 'vip' | 'walkin', data: {...} }
  switch (response.type) {
    case 'general': return 'genel';
    case 'staff': return 'personel';
    case 'vip': return 'vip';
    case 'walkin': return 'gunluk';
    default: return 'genel';
  }
}
```

### 2.4 Backend ID Çözümleme

```javascript
function resolveId(id) {
  // 1. Links tablosunda ara
  const link = getLinks().find(l => l.id === id);
  if (link) {
    return { type: link.type, data: link }; // 'general' veya 'walkin'
  }

  // 2. Staff tablosunda ara
  const staff = getStaff().find(s => s.id === id);
  if (staff) {
    // Yönetim rolü = VIP link
    if (staff.role === 'management') {
      return { type: 'vip', data: staff };
    }
    // Satış rolü = Personel link
    return { type: 'staff', data: staff };
  }

  return { type: 'unknown', error: 'ID bulunamadı' };
}
```

### 2.4 Randevu Başlık Formatı (Takvimde)

| Profil | Başlık Formatı |
|--------|----------------|
| Genel | `Müşteri Adı - GENERAL (Tür)` |
| Personel | `Müşteri Adı - Personel Adı (Tür)` |
| VIP | `Müşteri Adı - VIP-HK (Tür)` |
| Manuel | `Müşteri Adı - MANUEL (Tür)` |
| Yönetim | `Müşteri Adı - YONETIM (Tür)` |
| Günlük | `Müşteri Adı - WALK-IN (Tür)` |

---

## 3. RANDEVU TÜRLERİ VE SÜRELERİ

### 3.1 Randevu Türleri (4 Adet)

| Tür | Kod | Sabit Süre |
|-----|-----|------------|
| Teslim | `delivery` | 60dk (her zaman) |
| Gönderi | `shipping` | 60dk (her zaman) |
| Görüşme | `consultation` | Profil ayarına göre |
| Teknik Servis | `service` | Profil ayarına göre |

### 3.2 Süre Belirleme Mantığı

```javascript
function getDuration(profil, tur) {
  // Teslim ve Gönderi her zaman 60dk
  if (tur === 'delivery' || tur === 'shipping') {
    return 60;
  }
  // Diğerleri profil ayarından
  return PROFIL_AYARLARI[profil].duration;
}
```

---

## 4. PROFİL AYARLARI SİSTEMİ

### 4.1 Admin Ayarlar Tablosu

| Profil | Aynı Gün | Slot Max | Slot Grid | Personel Max | Teslim Max | Süre | Admin Atar | Randevu Türleri |
|--------|----------|----------|-----------|--------------|------------|------|------------|-----------------|
| **Genel** | ❌ | 1 | 60dk | ∞ | 3 | 60dk | ❌ | ☑️ Teslim ☑️ Görüşme ☑️ Gönderi ☑️ Teknik |
| **Personel** | ❌ | 1 | 60dk | ∞ | 3 | 60dk | ❌ | ☑️ Teslim ☑️ Görüşme ☑️ Gönderi ☑️ Teknik |
| **VIP** | ✅ | 2 | 30dk | ∞ | ∞ | 30dk | ✅ | ☑️ Teslim ☑️ Görüşme ☐ Gönderi ☑️ Teknik |
| **Manuel** | ✅ | 2 | 30dk | ∞ | ∞ | 60dk | ❌ | ☑️ Teslim ☑️ Görüşme ☑️ Gönderi ☑️ Teknik |
| **Yönetim** | ✅ | 2 | 60dk | ∞ | ∞ | 60dk | ✅ | ☑️ Teslim ☑️ Görüşme ☑️ Gönderi ☑️ Teknik |
| **Günlük** | ✅ | 2 | 30dk | ∞ | ∞ | 30dk | ✅ | ☐ Teslim ☑️ Görüşme ☐ Gönderi ☑️ Teknik |

### 4.2 Ayar Açıklamaları

| Ayar | Değerler | Açıklama |
|------|----------|----------|
| `sameDayBooking` | true/false | Aynı gün randevu alınabilir mi |
| `maxSlotAppointment` | 0/1/2 | Slot başı max randevu (0=∞) |
| `slotGrid` | 1/2 | 1=60dk grid, 2=30dk grid |
| `maxDailyPerStaff` | 0/1/2/3 | Personel başı günlük max (0=∞) |
| `maxDailyDelivery` | 0-5 | Günlük teslim+gönderi max (0=∞) |
| `duration` | 1/2 | 1=30dk, 2=60dk |
| `assignByAdmin` | true/false | İlgili admin tarafından mı atanır |
| `allowedTypes` | array | Seçilebilir randevu türleri |
| `staffFilter` | string | Personel filtresi (aşağıya bak) |

### 4.3 Personel Filtresi (Yeni)

Her profil için hangi personellerin gösterileceği:

| Profil | staffFilter | Açıklama |
|--------|-------------|----------|
| Genel | `role:sales` | Sadece Sales Executive rolündekiler |
| Personel | `self` | Sadece o personel (URL'deki) |
| VIP | `role:sales` | Sadece Sales Executive rolündekiler |
| Manuel | `role:sales` | Sadece Sales Executive rolündekiler |
| Yönetim | `role:management` | Sadece Management rolündekiler |
| Günlük | `role:sales` | Sadece Sales Executive rolündekiler |

**Rol Değerleri (İngilizce):**
- `sales` → Sales Executive (Satış Temsilcisi)
- `management` → Management (Yönetim)

### 4.4 Backend Veri Yapısı

```javascript
const PROFIL_AYARLARI = {
  genel: {
    sameDayBooking: false,
    maxSlotAppointment: 1,
    slotGrid: 60,
    maxDailyPerStaff: 0,
    maxDailyDelivery: 3,
    duration: 60,
    assignByAdmin: false,
    allowedTypes: ['delivery', 'consultation', 'shipping', 'service'],
    staffFilter: 'role:sales'
  },
  personel: {
    sameDayBooking: false,
    maxSlotAppointment: 1,
    slotGrid: 60,
    maxDailyPerStaff: 0,
    maxDailyDelivery: 3,
    duration: 60,
    assignByAdmin: false,
    allowedTypes: ['delivery', 'consultation', 'shipping', 'service'],
    staffFilter: 'self'
  },
  vip: {
    sameDayBooking: true,
    maxSlotAppointment: 2,
    slotGrid: 30,
    maxDailyPerStaff: 0,
    maxDailyDelivery: 0,
    duration: 30,
    assignByAdmin: true,
    allowedTypes: ['delivery', 'consultation', 'service'],
    staffFilter: 'role:sales'
  },
  manuel: {
    sameDayBooking: true,
    maxSlotAppointment: 2,
    slotGrid: 30,
    maxDailyPerStaff: 0,
    maxDailyDelivery: 0,
    duration: 60,
    assignByAdmin: false,
    allowedTypes: ['delivery', 'consultation', 'shipping', 'service'],
    staffFilter: 'role:sales'
  },
  yonetim: {
    sameDayBooking: true,
    maxSlotAppointment: 2,
    slotGrid: 60,
    maxDailyPerStaff: 0,
    maxDailyDelivery: 0,
    duration: 60,
    assignByAdmin: true,
    allowedTypes: ['delivery', 'consultation', 'shipping', 'service'],
    staffFilter: 'role:management'
  },
  gunluk: {
    sameDayBooking: true,
    maxSlotAppointment: 2,
    slotGrid: 30,
    maxDailyPerStaff: 0,
    maxDailyDelivery: 0,
    duration: 30,
    assignByAdmin: true,
    allowedTypes: ['consultation', 'service'],
    staffFilter: 'role:sales'
  }
};
```

---

## 5. SLOT VE ÇAKIŞMA MANTIĞI

### 5.1 Temel Kurallar

| Kural | Açıklama |
|-------|----------|
| Slot Max = 2 | Bir slotta maksimum 2 randevu olabilir |
| 60dk randevu | 2 ardışık 30dk slot kaplar |
| 30dk randevu | 1 slot kaplar |
| Çakışma kontrolü | Randevunun kaplayacağı TÜM slotlar kontrol edilir |

### 5.2 Örnek Senaryo

```
Mevcut: 14:00 - Personel Teslim (60dk)

VIP Teslim almak istiyor:
├─ 14:00 → 1 randevu var → ✅ Alabilir (max 2)
├─ 14:30 → 14:00'daki uzanıyor → 2/2 olur (bloke)
└─ 15:00 → Boş → ✅ Müsait

Sonuç: VIP 14:00'a alırsa:
├─ 14:00 = 2/2 ❌ BLOKE
├─ 14:30 = 2/2 ❌ BLOKE (her ikisi uzanıyor)
└─ 15:00 = 0/2 ✅ MÜSAİT
```

### 5.3 Slot Kontrolü Kodu

```javascript
function isSlotAvailable(date, time, duration, profil) {
  const ayarlar = PROFIL_AYARLARI[profil];
  const slotMax = ayarlar.maxSlotAppointment;

  // 0 = sınırsız
  if (slotMax === 0) return true;

  // Bu randevunun kaplayacağı tüm 30dk slotları kontrol et
  const slots = getAffectedSlots(time, duration); // ['14:00', '14:30'] for 60dk

  for (const slot of slots) {
    const count = getSlotOccupancy(date, slot);
    if (count >= slotMax) {
      return false;
    }
  }

  return true;
}

function getAffectedSlots(startTime, duration) {
  const slots = [];
  const start = parseTimeToMinutes(startTime);
  const slotCount = duration / 30;

  for (let i = 0; i < slotCount; i++) {
    slots.push(minutesToTime(start + (i * 30)));
  }

  return slots;
}
```

---

## 6. PERSONEL YÖNETİMİ GÜNCELLEMELERİ

### 6.1 Yeni Personel Alanları

| Alan | Tip | Açıklama |
|------|-----|----------|
| `id` | string | Güvenli ID (8 karakter) |
| `name` | string | Ad Soyad |
| `email` | string | E-posta (login için, sistemde tanımlı) |
| `phone` | string | Telefon |
| `password` | string | Hash'lenmiş şifre |
| `role` | enum | `sales` / `management` |
| `isAdmin` | boolean | Admin yetkisi |
| `active` | boolean | Aktif/Pasif |

**Rol Değerleri:**
- `sales` → Sales Executive (Satış Temsilcisi)
- `management` → Management (Yönetim) - VIP linkleri bu rolden gelir

**Not:** `isVipHandler` kaldırıldı. `isAdmin` yeterli.

### 6.2 Güvenli Personel ID Formatı

```
Format: İsim baş harf + 6 random rakam + Soyisim baş harf
Çıktı: Rastgele sıralanmış (8 karakter)
Örnek: s3b5a981, 3s5b9a81, 35sb9a81
```

**Üretim Kodu:**

```javascript
function generateStaffId(name) {
  const parts = name.trim().split(' ');
  const first = parts[0].charAt(0).toLowerCase();
  const last = parts.length > 1
    ? parts[parts.length - 1].charAt(0).toLowerCase()
    : first;

  // 6 random rakam
  const digits = Math.floor(100000 + Math.random() * 900000).toString();

  // 8 karakterlik array: 2 harf + 6 rakam
  const chars = [first, last, ...digits.split('')];

  // Fisher-Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}
```

### 6.3 Eski vs Yeni ID Karşılaştırması

| Eski | Yeni |
|------|------|
| `?staff=1` | `?staff=s3b5a981` |
| Tahmin edilebilir ❌ | Tahmin edilemez ✅ |
| Sırayla denenebilir ❌ | Brute-force zor ✅ |

---

## 7. YENİ AUTH SİSTEMİ

### 7.1 Eski Sistem (Kaldırılacak)

```
API Key → ❌ Kaldırıldı
```

### 7.2 Yeni Sistem

```
Email + Şifre → Session (10dk)
```

### 7.3 Şifre Üretimi

```javascript
function generatePassword() {
  // 8 karakter: harf + rakam karışık
  // Karıştırılabilecek karakterler çıkarıldı (0,O,1,l,I)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
```

### 7.4 Şifre Hash'leme

```javascript
function hashPassword(plainPassword) {
  const hash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    plainPassword
  );
  return hash.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

function validatePassword(email, plainPassword) {
  const staff = getStaffByEmail(email);
  if (!staff) return false;

  const hashedInput = hashPassword(plainPassword);
  return staff.password === hashedInput;
}
```

### 7.5 Session Yönetimi

```javascript
const SESSION = {
  duration: 10 * 60 * 1000, // 10 dakika (ms)
  key: 'admin_session'
};

function login(email, password) {
  const staff = validateCredentials(email, password);
  if (!staff) return { error: 'Geçersiz email veya şifre' };

  const session = {
    staffId: staff.id,
    email: staff.email,
    isAdmin: staff.isAdmin,
    permissions: staff.isAdmin ? 'all' : getPermissions(),
    expires: Date.now() + SESSION.duration
  };

  localStorage.setItem(SESSION.key, JSON.stringify(session));
  return { success: true, staff };
}

function checkSession() {
  const session = JSON.parse(localStorage.getItem(SESSION.key));

  if (!session || Date.now() > session.expires) {
    logout();
    return null;
  }

  // Her aktivitede session'ı yenile
  session.expires = Date.now() + SESSION.duration;
  localStorage.setItem(SESSION.key, JSON.stringify(session));

  return session;
}

function logout() {
  localStorage.removeItem(SESSION.key);
  window.location.href = '/admin.html';
}
```

### 7.6 Şifre E-posta Gönderimi

**Önemli:** E-posta, sistemde tanımlı personel e-posta adresine gönderilir.

```
Konu: Randevu Sistemi Giriş Bilgileriniz

Merhaba {name},

Randevu sistemi giriş bilgileriniz:

Email: {email}
Şifre: {password}

Giriş: https://rolexizmiristinyepark.github.io/randevu_app/admin.html

Güvenliğiniz için şifrenizi kimseyle paylaşmayın.

Rolex İzmir İstinyepark
```

### 7.7 Şifre Sıfırlama (Login Sayfasında)

Şifre sıfırlama butonu login sayfasında olacak (personel yönetiminde değil):

1. Kullanıcı "Şifremi Unuttum" tıklar
2. E-posta adresini girer
3. Sistem e-postayı kontrol eder
4. Yeni şifre üretir ve hash'ler
5. Yeni şifreyi kaydeder
6. Yeni şifreyi sistemde kayıtlı e-postaya gönderir

---

## 8. ADMIN PANEL SEKMELERİ

### 8.1 Sekme Listesi (8 Adet)

```
┌─────────┬────────────┬─────────────────┬────────────┬───────────────────┬──────────┬──────────┬─────────────┐
│ Linkler │ Randevular │ Randevu Oluştur │ Vardiyalar │ Personel Yönetimi │ WhatsApp │ Ayarlar  │ Uygulamalar │
└─────────┴────────────┴─────────────────┴────────────┴───────────────────┴──────────┴──────────┴─────────────┘
```

---

### 8.2 Sekme 1: Linkler

**İçerik:** Tüm randevu linkleri tek yerde (her linkin yanında Kopyala + Aç butonları)

**Not:** Tüm linkler `?id=xxxxxxxx` formatında. Link tipi ID'nin kaynağından belirlenir.

```
┌─────────────────────────────────────────────────────────────────┐
│  Randevu Linkleri                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📎 Genel Link                                                  │
│  https://.../?id=gen7x2k9                                       │
│                                           [Kopyala]  [Aç]      │
│                                                                 │
│  📎 Günlük Müşteri Link                                        │
│  https://.../?id=wlk3m5n8                                       │
│                                           [Kopyala]  [Aç]      │
│                                                                 │
│  📎 VIP Linkleri (role: management)                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ HK     ?id=hk7a3b2c                  [Kopyala]  [Aç]     │  │
│  │ OK     ?id=ok9d4e5f                  [Kopyala]  [Aç]     │  │
│  │ HMK    ?id=hm2g6h8i                  [Kopyala]  [Aç]     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  📎 Personel Linkleri (role: sales)                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Serdar Benli    ?id=s3b5a981         [Kopyala]  [Aç]     │  │
│  │ Ece Argun       ?id=ea7c4d2e         [Kopyala]  [Aç]     │  │
│  │ Gökhan Tokol    ?id=gt9f3a1c         [Kopyala]  [Aç]     │  │
│  │ Sırma           ?id=sr4h7j2k         [Kopyala]  [Aç]     │  │
│  │ Gamze           ?id=gm8p3q5r         [Kopyala]  [Aç]     │  │
│  │ Okan            ?id=ok2t6u9v         [Kopyala]  [Aç]     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Link Kaynakları:**
- Genel Link: `Links` tablosu (type: 'general')
- Günlük Link: `Links` tablosu (type: 'walkin')
- VIP Linkleri: `Staff` tablosu (role: 'management')
- Personel Linkleri: `Staff` tablosu (role: 'sales')

---

### 8.3 Sekme 2: Randevular

**İçerik:** Mevcut hali aynen devam

- Tüm randevular listesi (herkes tüm randevuları görebilir)
- Filtreleme (tarih, personel, tür)
- Düzenleme (sadece isAdmin:true veya kendi randevusu)
- İptal etme (sadece isAdmin:true veya kendi randevusu)
- İlgili atama (sadece isAdmin:true)

**Yetki Kuralı:**
- isAdmin:true → Tüm randevuları düzenleyebilir/iptal edebilir
- isAdmin:false → Tüm randevuları görebilir, sadece kendi randevularını düzenleyebilir/iptal edebilir

---

### 8.4 Sekme 3: Randevu Oluştur

**İçerik:** Manuel ve Yönetim seçimi → Profil akışı

```
┌─────────────────────────────────────────────────────────────────┐
│  Randevu Oluştur                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Randevu Profili Seçin:                                       │
│                                                                 │
│   ┌─────────────────┐  ┌─────────────────┐                     │
│   │                 │  │                 │                     │
│   │     MANUEL      │  │    YÖNETİM      │                     │
│   │                 │  │                 │                     │
│   │  (Günlük işler) │  │ (Yönetici)      │                     │
│   └─────────────────┘  └─────────────────┘                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Seçim sonrası akış (tüm kurallar profil ayarlarından gelir):
1. Randevu türü seç (allowedTypes'dan filtrelenir)
2. Tarih seç (sameDayBooking'e göre bugün aktif/pasif)
3. Personel seç (staffFilter'a göre filtrelenir: role:satis veya role:yonetim)
4. Slot seç (slotGrid'e göre 30dk veya 60dk aralıklar)
5. Form doldur
6. Submit
```

**Personel Filtresi Detayı:**
- Manuel profili → `staffFilter: 'role:sales'` → Sadece Sales Executive rolündeki personeller listelenir
- Yönetim profili → `staffFilter: 'role:management'` → Sadece Management rolündeki personeller listelenir

---

### 8.5 Sekme 4: Vardiyalar

**İçerik:** Mevcut hali aynen devam

**Yetki Kuralı:**
- isAdmin:true → Tüm vardiyaları görür, düzenler, ekler, siler
- isAdmin:false → Tüm vardiyaları görür, ama düzenleme/ekleme/silme yapamaz

---

### 8.6 Sekme 5: Personel Yönetimi

**İçerik:** Mevcut hali + yeni alanlar

```
┌─────────────────────────────────────────────────────────────────┐
│  Personel Yönetimi                              [+ Yeni Ekle]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ID: s3b5a981                                             │   │
│  │ Ad: Serdar Benli                                         │   │
│  │ Email: serdar@rolex.com                                  │   │
│  │ Telefon: 05xx xxx xx xx                                  │   │
│  │ Rol: Yönetim                                             │   │
│  │ Admin: ✅  Aktif: ✅                                     │   │
│  │                                                          │   │
│  │ [Düzenle] [Pasif Yap]                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ID: ea7c4d2e                                             │   │
│  │ Ad: Ece Argun                                            │   │
│  │ Email: ece@rolex.com                                     │   │
│  │ Telefon: 05xx xxx xx xx                                  │   │
│  │ Rol: Satış                                               │   │
│  │ Admin: ❌  Aktif: ✅                                     │   │
│  │                                                          │   │
│  │ [Düzenle] [Pasif Yap]                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Not:** Şifre sıfırlama butonu burada yok. Login sayfasında "Şifremi Unuttum" ile yapılacak.

---

### 8.7 Sekme 6: WhatsApp

**İçerik:** Dinamik template yönetimi

```
┌─────────────────────────────────────────────────────────────────┐
│  WhatsApp Templates                            [+ Yeni Template]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 📋 randevu_hatirlatma_v1              [Düzenle] [Sil]   │   │
│  │    Açıklama: Randevu hatırlatma                         │   │
│  │    Değişkenler: 4                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 📋 randevu_onay                       [Düzenle] [Sil]   │   │
│  │    Açıklama: Randevu onayı                              │   │
│  │    Değişkenler: 3                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Yeni Template Ekleme:**

```
┌─────────────────────────────────────────────────────────────────┐
│  Yeni Template                                            [X]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Template Adı*:    [                              ]             │
│  (Meta'da onaylı template adı)                                  │
│                                                                 │
│  Açıklama:         [                              ]             │
│                                                                 │
│  Değişken Sayısı:  [ 1 ▼]  →  [+ Ekle] [- Çıkar]               │
│                                                                 │
│  Değişken Eşleştirme:                                          │
│  {{1}} = [ Müşteri Adı          ▼]                             │
│  {{2}} = [ Randevu Tarih/Saat   ▼]                             │
│  {{3}} = [ Personel Adı         ▼]                             │
│                                                                 │
│                                    [İptal]  [Kaydet]            │
└─────────────────────────────────────────────────────────────────┘
```

**Değişken Seçenekleri:**

| Seçenek | Kod |
|---------|-----|
| Müşteri Adı | `customerName` |
| Müşteri Telefon | `customerPhone` |
| Randevu Tarih/Saat | `appointmentDateTime` |
| Randevu Tarihi | `appointmentDate` |
| Randevu Saati | `appointmentTime` |
| Personel Adı | `staffName` |
| Personel Telefon | `staffPhone` |
| Randevu Türü | `appointmentType` |
| Şirket Adı | `companyName` |
| Şirket Lokasyon | `companyLocation` |

**Backend Yapısı:**

```javascript
// Template bilgileri veritabanında saklanır (kod değişikliği gereksiz)
const WHATSAPP_TEMPLATES = [
  {
    id: 'tpl_001',
    name: 'randevu_hatirlatma_v1',
    description: 'Randevu hatırlatma',
    variableCount: 4,
    variables: {
      '1': 'customerName',
      '2': 'appointmentDateTime',
      '3': 'staffName',
      '4': 'appointmentType'
    }
  }
];

// Dinamik mesaj gönderimi
function sendWhatsAppMessage(templateId, appointment) {
  const template = getTemplateById(templateId);

  const params = [];
  for (let i = 1; i <= template.variableCount; i++) {
    const field = template.variables[i.toString()];
    params.push({ type: 'text', text: appointment[field] });
  }

  return callMetaAPI({
    template: {
      name: template.name,
      language: { code: 'tr' },
      components: [{ type: 'body', parameters: params }]
    }
  });
}
```

---

### 8.8 Sekme 7: Ayarlar

**İçerik:** Tüm ayarlar tek yerde

```
┌─────────────────────────────────────────────────────────────────┐
│  Ayarlar                                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ▼ Profil Ayarları                                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ [Tablo: 6 Profil × 9 Ayar]                              │   │
│  │ Her satır bir profil, her sütun bir ayar               │   │
│  │ staffFilter sütunu eklendi (role:sales, role:management)│   │
│  │ Son sütun: Randevu türleri (çoklu seçim)               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ▼ Personel Yetkileri (isAdmin: false)                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ☑️ Linkler                                               │   │
│  │ ☑️ Randevular                                            │   │
│  │ ☑️ Randevu Oluştur                                       │   │
│  │ ☐ Vardiyalar                                             │   │
│  │ ☐ Personel Yönetimi                                      │   │
│  │ ☐ WhatsApp                                               │   │
│  │ ☐ Ayarlar                                                │   │
│  │ ☐ Uygulamalar                                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ▼ Genel Ayarlar                                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Şirket Adı: [Rolex İzmir İstinyepark        ]           │   │
│  │ Şirket Lokasyon: [İstinyepark AVM           ]           │   │
│  │ Timezone: [Europe/Istanbul                   ]           │   │
│  │ ...                                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ▼ WhatsApp API Ayarları                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Phone Number ID: [**********]                           │   │
│  │ Access Token: [**********]                              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 8.9 Sekme 8: Uygulamalar

**İçerik:** Gelecek özellikler için butonlar (tıklanınca Coming Soon mesajı)

```
┌─────────────────────────────────────────────────────────────────┐
│  Uygulamalar                                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────┐  ┌─────────────────┐                     │
│   │                 │  │                 │                     │
│   │  Teslim Tutanak │  │   Teslim Form   │                     │
│   │                 │  │                 │                     │
│   └─────────────────┘  └─────────────────┘                     │
│                                                                 │
│   ┌─────────────────┐  ┌─────────────────┐                     │
│   │                 │  │                 │                     │
│   │ Teknik Servis   │  │    Ön Ödeme     │                     │
│   │                 │  │                 │                     │
│   └─────────────────┘  └─────────────────┘                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Davranış:** Butonlara tıklandığında popup/toast ile "Coming Soon" mesajı gösterilir.

```javascript
function handleAppClick(appName) {
  showToast(`${appName} - Coming Soon`, 'info');
}
```

---

## 9. YETKİ SİSTEMİ

### 9.1 Basit Mantık

| isAdmin | Görünen Sekmeler |
|---------|------------------|
| TRUE | Hepsi (8 sekme) |
| FALSE | Ayarlarda TRUE işaretli olanlar |

### 9.2 Varsayılan Yetkiler (isAdmin: false)

```javascript
const DEFAULT_PERMISSIONS = {
  linkler: true,
  randevular: true,
  randevuOlustur: true,
  vardiyalar: false,
  personelYonetimi: false,
  whatsapp: false,
  ayarlar: false,
  uygulamalar: false
};
```

### 9.3 Frontend Sekme Filtreleme

```javascript
function renderTabs(staff) {
  const allTabs = ['linkler', 'randevular', 'randevuOlustur', 'vardiyalar', 'personelYonetimi', 'whatsapp', 'ayarlar', 'uygulamalar'];

  // Admin her şeyi görür
  if (staff.isAdmin) {
    return allTabs;
  }

  // Değilse ayarlara göre filtrele
  const permissions = getPermissions(); // Admin ayarlarından
  return allTabs.filter(tab => permissions[tab] === true);
}
```

---

## 10. TEKNİK UYGULAMA DETAYLARI

### 10.1 Veri Yapısı Değişiklikleri

**Staff (Personel):**
```javascript
// Eski
{ id: 1, name: 'Serdar Benli', active: true }

// Yeni
{
  id: 's3b5a981',
  name: 'Serdar Benli',
  email: 'serdar@rolex.com',
  phone: '05xx xxx xx xx',
  password: 'hashed_password',
  role: 'management',  // 'sales' veya 'management'
  isAdmin: true,
  active: true
}
```

**Settings (Ayarlar):**
```javascript
{
  profilAyarlari: { /* 6 profil config */ },
  staffPermissions: { /* isAdmin:false yetkileri */ },
  whatsappTemplates: [ /* template listesi */ ],
  general: { /* genel ayarlar */ }
}
```

### 10.2 API Endpoint'leri

| Endpoint | Açıklama |
|----------|----------|
| `login` | Email + şifre ile giriş |
| `logout` | Oturumu sonlandır |
| `getProfilAyarlari` | Profil ayarlarını getir |
| `saveProfilAyarlari` | Profil ayarlarını kaydet |
| `getStaffPermissions` | Personel yetkilerini getir |
| `saveStaffPermissions` | Personel yetkilerini kaydet |
| `getWhatsAppTemplates` | Template listesi |
| `saveWhatsAppTemplate` | Template ekle/güncelle |
| `deleteWhatsAppTemplate` | Template sil |
| `resetStaffPassword` | Şifre sıfırla ve maile gönder |

### 10.3 Migration Gereksinimleri

1. **Personel ID Migration:** Mevcut ID'ler → Güvenli ID'ler
2. **Auth Migration:** API Key → Email/Password
3. **Ayarlar Migration:** Mevcut ayarlar → Yeni yapı

---

## 11. FAZLAR VE ÖNCELİKLER

### FAZ 1: Temel Altyapı (Öncelik: Yüksek)

- [ ] Personel tablosuna yeni alanlar ekle
- [ ] Güvenli personel ID üretimi
- [ ] Email + Password auth sistemi
- [ ] Session yönetimi (10dk)
- [ ] API Key sistemini kaldır

### FAZ 2: Profil Sistemi (Öncelik: Yüksek)

- [ ] PROFIL_AYARLARI veri yapısı
- [ ] URL → Profil belirleme
- [ ] Profil bazlı validation
- [ ] Slot çakışma kontrolü (30dk/60dk)

### FAZ 3: Admin Panel Sekmeleri (Öncelik: Orta)

- [ ] Yeni sekme yapısı (8 sekme)
- [ ] Linkler sekmesi (Kopyala + Aç butonları)
- [ ] Randevu Oluştur sekmesi (Manuel/Yönetim)
- [ ] Ayarlar sekmesi (Profil ayarları tablosu)
- [ ] Personel Yönetimi güncellemeleri
- [ ] Uygulamalar sekmesi (Coming Soon)

### FAZ 4: WhatsApp Sekmesi (Öncelik: Orta)

- [ ] Template CRUD işlemleri
- [ ] Dinamik değişken eşleştirme
- [ ] Template veritabanı yapısı

### FAZ 5: Yetki Sistemi (Öncelik: Düşük)

- [ ] isAdmin:false yetki ayarları
- [ ] Sekme bazlı filtreleme
- [ ] Frontend yetki kontrolü

---

## 📝 NOTLAR

1. **Deploy Gereksiz:** Profil ayarları, WhatsApp template'leri veritabanında saklanır
2. **Geriye Uyumluluk:** Migration scriptleri yazılacak
3. **Güvenlik:** SHA-256 hash, güvenli ID, 10dk session
4. **Basitlik:** Tek akış, config-driven, merkezi yönetim

---

**Son Güncelleme:** 1 Aralık 2025
