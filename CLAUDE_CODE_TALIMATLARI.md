# 🤖 CLAUDE CODE TALİMATLARI - ANALIZ_FINAL_2.md UYGULAMA KILAVUZU

**Proje:** Rolex İzmir İstinyepark Randevu Sistemi  
**Hedef:** ANALIZ_FINAL_2.md raporundaki düzeltmelerin güvenli uygulanması  
**Kritik Uyarı Seviyesi:** 🔴 YÜKSEK - Production sistemi

---

## ⚠️ GENEL UYARILAR VE KRİTİK KURALLAR

### 🛑 ASLA YAPMA LİSTESİ

1. **ASLA production secret'ları silme veya değiştirme** - Secret rotation manuel yapılacak
2. **ASLA `.env.production` içeriğini terminale yazdırma** - Secret sızıntısı
3. **ASLA `git push --force` komutunu onaysız çalıştırma** - Geri dönüşü zor
4. **ASLA backend'i test etmeden deploy etme** - Sistem çökebilir
5. **ASLA birden fazla kritik değişikliği aynı anda yapma** - Hata izleme zorlaşır
6. **ASLA mevcut çalışan kodu silmeden önce backup almadan ilerleme**
7. **ASLA Google Apps Script'i doğrudan düzenleme** - Önce lokal test

### ✅ HER ZAMAN YAP LİSTESİ

1. **Her değişiklikten ÖNCE backup al**
2. **Her değişiklikten SONRA test et**
3. **Küçük, atomik commitler yap**
4. **Her adımı kullanıcıya bildir ve onay al**
5. **Hata durumunda DUR ve kullanıcıya sor**
6. **Değişiklikleri açıkla, ne yaptığını anlat**

---

## 📋 UYGULAMA ÖNCESİ CHECKLIST

Claude Code, başlamadan önce şunları kontrol et:

```bash
# 1. Proje dizininde olduğunu doğrula
pwd
# Beklenen: /Users/serdarbenli/Desktop/new project/randevu-sistemi-main

# 2. Git durumunu kontrol et
git status
# Temiz olmalı, uncommitted değişiklik olmamalı

# 3. Mevcut branch'i kontrol et
git branch --show-current
# main veya master olmalı

# 4. Node modules var mı?
ls node_modules
# Yoksa: npm install

# 5. Build çalışıyor mu?
npm run build
# Hatasız tamamlanmalı
```

---

## 🔐 FAZ 1: KRİTİK GÜVENLİK (DİKKATLİ İLERLE)

### Adım 1.1: Git History Temizliği (⚠️ EN RİSKLİ ADIM)

**DİKKAT:** Bu adım geri dönüşü zor bir işlem. Kullanıcıdan açık onay al.

```
🚨 KULLANICIYA SOR:
"Git history temizliği yapılacak. Bu işlem:
- Tüm .env.* dosyalarını git geçmişinden silecek
- Force push gerektirecek
- Diğer geliştiricilerin yeniden clone yapmasını gerektirecek

Devam etmek için 'EVET' yazın."
```

**İşlem Adımları:**
```bash
# 1. Önce full backup
cp -r . ../randevu-sistemi-backup-$(date +%Y%m%d_%H%M%S)

# 2. Hassas dosyaların varlığını kontrol et
git log --all --full-history -- ".env.local" ".env.production" ".clasp.json"

# 3. SADECE kullanıcı onayladıysa BFG ile temizle
# BFG kurulu değilse: brew install bfg
```

**❌ YAPMA:** `git filter-branch` veya `bfg` komutlarını otomatik çalıştırma. Kullanıcıya komutları göster, onay al.

---

### Adım 1.2: Turnstile Secret Key Taşıma

**Dosya:** `apps-script-backend.js`  
**Satır:** ~380

**ÖNCE:**
```javascript
// Mevcut kodu bul ve göster
TURNSTILE_SECRET_KEY: '0x4AAAAAACCXZ9dfNEJxoB2t4Rkx7qvSO6Y',
```

**SONRA:**
```javascript
// Boş string yap, Script Properties'den yüklenecek
TURNSTILE_SECRET_KEY: '',
```

**Ek Değişiklik - loadExternalConfigs() fonksiyonunda:**
```javascript
// Bu kodu ekle veya güncelle
const turnstileSecret = scriptProperties.getProperty('TURNSTILE_SECRET_KEY');
if (!turnstileSecret || turnstileSecret.trim() === '') {
    throw new Error('KRİTİK: TURNSTILE_SECRET_KEY Script Properties\'de tanımlı değil!');
}
CONFIG.TURNSTILE_SECRET_KEY = turnstileSecret;
```

**🔍 DOĞRULAMA:**
- Dosyada hardcoded secret kalmadığını `grep` ile kontrol et
- `grep -r "0x4AAAA" .` → Sonuç boş olmalı

---

### Adım 1.3: Admin Auth Şifreleme Aktifleştirme

**Dosya:** `src/admin-auth.ts`  
**Satır:** ~57-80

**KALDIRILACAK KOD:**
```typescript
// Bu bloğu bul ve SİL:
// DEBUG: Şifreleme geçici olarak devre dışı
if (storedKey.startsWith('RLX_')) {
    return storedKey;
}
```

**DİKKAT:** Sadece debug bypass kodunu kaldır, şifreleme fonksiyonlarına dokunma.

**🔍 DOĞRULAMA:**
```bash
# Debug yorumu kalmadığını kontrol et
grep -n "DEBUG" src/admin-auth.ts
# Şifreleme fonksiyonları hala var mı?
grep -n "encrypt\|decrypt" src/admin-auth.ts
```

---

### Adım 1.4-1.6: API Key POST'a Taşıma

**⚠️ ÇOK ADIMLI DEĞİŞİKLİK - DİKKATLİ İLERLE**

Bu değişiklik 2 dosyayı etkiler ve senkronize olmalı:
1. `src/api-service.ts` (Frontend)
2. `apps-script-backend.js` (Backend)

**SIRALAMA ÖNEMLİ:**
1. Önce backend'i güncelle (doPost desteği ekle)
2. Sonra frontend'i güncelle (POST kullanımına geç)
3. Her ikisini birlikte test et

**Frontend Değişikliği (api-service.ts):**

```typescript
// PROTECTED_ACTIONS listesi ekle (dosyanın üstüne)
const PROTECTED_ACTIONS: string[] = [
    'getAppointments', 'updateAppointment', 'deleteAppointment',
    'getSettings', 'saveSettings', 'getStaff', 'saveStaff',
    'getShifts', 'saveShifts', 'createManualAppointment'
];

// _makeRequest fonksiyonunu güncelle
// Mevcut GET mantığını koru ama PROTECTED_ACTIONS için POST kullan
```

**Backend Değişikliği (apps-script-backend.js):**

```javascript
// doPost fonksiyonunu güncelle - JSON body'den oku
function doPost(e) {
    try {
        const requestBody = e.postData && e.postData.contents
            ? JSON.parse(e.postData.contents)
            : {};
        // ... devamı ANALIZ_FINAL_2.md'de
    }
}

// doGet'e admin action bloklama ekle
if (ADMIN_ACTIONS.includes(action)) {
    return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Admin işlemleri için POST kullanın'
    })).setMimeType(ContentService.MimeType.JSON);
}
```

**🔍 DOĞRULAMA:**
```bash
# Build hatasız tamamlanmalı
npm run build

# TypeScript hataları olmamalı
npx tsc --noEmit
```

---

## 📦 FAZ 2: VERİ KATMANI (GOOGLE SHEETS)

**⚠️ MAJOR REFAKTÖR - AYRI BRANCH'TE YAP**

```bash
# Yeni branch oluştur
git checkout -b feature/sheets-storage

# Bu branch'te çalış, main'e merge etmeden önce tam test et
```

**Adımlar:**
1. Google Sheets ID'yi Script Properties'e ekle (MANUEL - kullanıcı yapacak)
2. SheetStorageService yaz
3. Migration script hazırla
4. Test et
5. Merge

**DİKKAT:** Bu değişiklik production veriyi etkiler. Mutlaka:
- Mevcut PropertiesService verisinin backup'ını al
- Migration'ı önce test ortamında dene
- Rollback planı hazırla

---

## 🔒 FAZ 3: KVKK UYUMLULUK

### KVKK Checkbox Ekleme

**Dosya:** `index.html`  
**Konum:** Form içinde, submit butonundan önce

```html
<!-- Bu bloğu ekle -->
<div class="form-group kvkk-consent">
    <label class="checkbox-container">
        <input type="checkbox" id="kvkkConsent" required>
        <span class="checkmark"></span>
        <span class="consent-text">
            Kişisel verilerimin, 
            <a href="/kvkk-aydinlatma.html" target="_blank" rel="noopener">
                KVKK Aydınlatma Metni
            </a> 
            kapsamında işlenmesini kabul ediyorum.
        </span>
    </label>
</div>
```

**Dosya:** `src/components/AppointmentFormComponent.ts`  
**Konum:** handleFormSubmit fonksiyonu başı

```typescript
// Submit başında kontrol ekle
const kvkkConsent = document.getElementById('kvkkConsent') as HTMLInputElement;
if (!kvkkConsent?.checked) {
    showAlert('Lütfen KVKK aydınlatma metnini okuyup onay veriniz.', 'error');
    return;
}
```

---

## 🧪 TEST PROTOKOLÜ

Her değişiklikten sonra şu testleri çalıştır:

```bash
# 1. TypeScript derleme
npx tsc --noEmit

# 2. Build
npm run build

# 3. Unit testler
npm run test

# 4. Lint
npm run lint
```

**Manuel Test Checklist (Kullanıcıya bildir):**
- [ ] Randevu formu açılıyor mu?
- [ ] Takvim çalışıyor mu?
- [ ] Admin panel giriş yapılabiliyor mu?
- [ ] Randevu oluşturulabiliyor mu?

---

## 🔄 ROLLBACK PROSEDÜRÜ

Bir şeyler ters giderse:

```bash
# Son çalışan duruma dön
git checkout .
git clean -fd

# Veya backup'tan geri yükle
cp -r ../randevu-sistemi-backup-YYYYMMDD_HHMMSS/* .
```

---

## 📝 COMMIT MESAJI FORMATI

```
[FAZ-X.Y] Kısa açıklama

- Detay 1
- Detay 2

Refs: ANALIZ_FINAL_2.md
```

**Örnek:**
```
[FAZ-1.2] Turnstile secret key Script Properties'e taşındı

- Hardcoded secret kaldırıldı
- loadExternalConfigs() güncellendi
- Validation eklendi

Refs: ANALIZ_FINAL_2.md K-02
```

---

## 🚦 İLERLEME RAPORU ŞABLONU

Her fazın sonunda kullanıcıya şu formatla rapor ver:

```
✅ FAZ 1 TAMAMLANDI

Yapılan değişiklikler:
- [x] 1.1 Git history temizliği hazırlandı (kullanıcı onayı bekliyor)
- [x] 1.2 Turnstile secret taşındı
- [x] 1.3 Admin auth şifreleme aktif
- [x] 1.4 API Key POST'a taşındı
- [x] 1.5 doPost handler güncellendi
- [x] 1.6 doGet admin bloklama eklendi

Test sonuçları:
- Build: ✅ Başarılı
- TypeScript: ✅ Hata yok
- Unit Tests: ✅ X/Y geçti

Sonraki adım: FAZ 2 - Veri Katmanı
Devam etmek için onay verir misiniz?
```

---

## ⏸️ DURAKLAMA NOKTALARI

Şu durumlarda DUR ve kullanıcıya sor:

1. **Herhangi bir hata oluştuğunda**
2. **Production dosyalarını değiştirmeden önce**
3. **Git push yapmadan önce**
4. **Backend deployment öncesinde**
5. **Her fazın sonunda**
6. **Emin olmadığın bir durumda**

---

## 🎯 ÖNCELİK SIRASI (KESİNLİKLE BU SIRADA İLERLE)

```
FAZ 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → (1.1 en son, kullanıcı onayıyla)
    ↓
FAZ 2 (Ayrı branch)
    ↓
FAZ 3
    ↓
FAZ 4
    ↓
FAZ 5
    ↓
FAZ 6
```

**Not:** FAZ 1.1 (Git history temizliği) en riskli adım olduğu için diğer değişiklikler tamamlandıktan ve test edildikten SONRA yapılmalı.

---

## 💡 CLAUDE CODE İÇİN İPUÇLARI

1. **Büyük dosyaları okurken** `head` ve `tail` parametrelerini kullan
2. **Değişiklik yapmadan önce** mevcut kodu göster
3. **Her değişikliği** küçük parçalar halinde yap
4. **Kullanıcının ne yaptığını anlamasını** sağla
5. **Belirsiz durumlarda** soru sor, varsayımda bulunma
6. **Hata mesajlarını** açıkça paylaş

---

**Bu talimatları takip et ve güvenli bir şekilde ilerle. Şüphen varsa DUR ve SOR.**

**Başarılar! 🚀**
