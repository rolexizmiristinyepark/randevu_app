# ANALIZ_2.md - Kapsamlı Kod Denetim ve Mimari Analiz Raporu

**Proje:** Rolex İzmir İstinyepark Randevu Sistemi
**Tarih:** 30 Kasım 2025
**Denetçi:** Kıdemli Yazılım Mimarı
**Kapsam:** Güvenlik, Performans, Clean Code, KVKK, Mimari Bütünlük

---

## 1. GÜVENLİK VE KRİPTOGRAFİ

### Sorun: Zayıf Kriptografi ile API Key Üretimi
**Sorun:** `scripts/Auth.js` dosyasında `generateApiKey` fonksiyonu, API anahtarı üretmek için kriptografik olarak güvenli olmayan `Math.random()` fonksiyonunu kullanmaktadır.
**Nedeni:** `Math.random()` tahmin edilebilir bir PRNG (Pseudo-Random Number Generator) algoritması kullanır ve brute-force saldırılarına karşı zayıftır.
**Alternatif Öneri/Teknoloji:**
* Google Apps Script `Utilities.getUuid()` (Artı: Benzersizlik garantisi, standart | Eksi: Yeterli entropi sağlamayabilir)
* **Önerilen:** Web Crypto API standartlarına uygun özel bir karakter seti ile `Math.floor(Math.random())` yerine daha güvenli bir yaklaşım veya GAS ortamında mevcutsa `Utilities.computeDigest` ile tuzlama (salting) yapılması. Ancak GAS kısıtları nedeniyle en pratik güvenli yöntem `Utilities.getUuid()` ile `Utilities.base64Encode` kombinasyonudur.
**Çözümü:**
```javascript
// scripts/Auth.js
generateApiKey: function() {
    // UUID ve Zaman damgasını birleştirip hashleyerek daha güvenli bir key oluştur
    const seed = Utilities.getUuid() + Date.now().toString();
    const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, seed);
    return 'RLX_' + Utilities.base64EncodeWebSafe(hash).substring(0, 32);
}
Etkisi: Yüksek - Yetkisiz erişim riski. Etkilenen Dosyalar: scripts/Auth.js (Satır: 12-17)

Sorun: Production Hata Mesajlarında Bilgi Sızıntısı
Sorun: scripts/Main.js dosyasındaki doPost fonksiyonunda, catch bloğu içerisinde mainError.toString() değeri doğrudan istemciye dönülmektedir. Nedeni: Geliştirme aşamasında hata ayıklamayı kolaylaştırmak için eklenen detaylı hata mesajları production ortamında bırakılmış. Alternatif Öneri/Teknoloji:

Sadece genel hata mesajı gösterilmesi (Artı: Güvenli | Eksi: Debug zorlaşır)

Önerilen: Hata detayını sunucu tarafında (Logger/Stackdriver) saklayıp, istemciye sadece genel bir mesaj ve izleme için bir errorId dönülmesi. Çözümü:

JavaScript

// scripts/Main.js - doPost catch bloğu
} catch (mainError) {
    const errorId = Utilities.getUuid();
    log.error(`[${errorId}] doPost error:`, mainError); // Detayı logla
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: CONFIG.ERROR_MESSAGES.SERVER_ERROR, // Genel mesaj
        errorId: errorId // Referans ID
      }))
      .setMimeType(ContentService.MimeType.JSON);
}
Etkisi: Yüksek - Sistem iç yapısı, dosya yolları veya stack trace bilgilerinin saldırganlara sızması. Etkilenen Dosyalar: scripts/Main.js (Satır: 320)

2. MİMARİ VE PERFORMANS
Sorun: Ölçeklenemeyen Veri Güncelleme Mantığı (O(n) Okuma/Yazma)
Sorun: scripts/SheetStorageService.gs dosyasında updateById ve deleteById fonksiyonları, işlem yapmak için tüm veriyi (getDataRange().getValues()) belleğe çekmekte ve satır satır gezmektedir. Nedeni: Google Sheets'in bir veritabanı gibi kullanılması ve indeksleme mekanizmasının olmaması. Alternatif Öneri/Teknoloji:

Google Apps Script TextFinder kullanımı (Artı: Daha hızlı arama | Eksi: Karmaşık sorgularda yetersiz)

Önerilen: Satır sayısı arttıkça (50-250 randevu/ay senaryosunda bile 1 yılda 3000 satır eder), işlem süresi lineer artacaktır. Kritik okuma/yazma işlemleri için CacheService'in "Write-Through" veya "Write-Behind" stratejisiyle kullanılması, ancak asıl çözüm Sheet operasyonlarını TextFinder ile optimize etmektir. Çözümü:

JavaScript

// scripts/SheetStorageService.gs - Örnek updateById optimizasyonu
updateById: function(sheetName, idColumn, idValue, newData) {
    const sheet = this.getOrCreateSheet(sheetName);
    // Tüm datayı çekmek yerine TextFinder ile hedefi bul
    const finder = sheet.createTextFinder(String(idValue)).matchEntireCell(true);
    const result = finder.findNext();
    
    if (result) {
        const row = result.getRow();
        // Sadece ilgili satırı güncelle...
        // (Header eşleştirmesi için mecburen header okunmalı ama tüm data değil)
        return true;
    }
    return false;
}
Etkisi: Orta - Veri miktarı arttıkça sistemin yavaşlaması ve zaman aşımı (timeout) hataları. Etkilenen Dosyalar: scripts/SheetStorageService.gs (Satır: 242, 246)

Sorun: Client-Side Kodda Hardcoded Fallback Konfigürasyonları
Sorun: config-loader.ts dosyasında FALLBACK_CONFIG sabiti altında production URL'leri ve anahtarları (Turnstile key vb.) açıkça kod içine gömülmüştür. Nedeni: Çevresel değişkenlerin (Environment Variables) yüklenememesi durumunda sistemin çalışmaya devam etmesini sağlama amacı. Alternatif Öneri/Teknoloji:

Build-time injection zorunluluğu (Artı: Güvenli | Eksi: Build hatası riski)

Önerilen: Fallback değerlerinin boş veya dummy değerler olması, uygulamanın konfigürasyon eksikliğinde güvenli bir hata durumuna geçmesi (Fail-Safe). Canlı production URL'lerinin kod reposunda bulunması risklidir. Çözümü: FALLBACK_CONFIG içerisindeki hassas URL ve anahtarları kaldırın veya placeholder değerlerle değiştirin. Build sürecinde .env dosyalarının zorunlu tutulmasını sağlayın. Etkisi: Orta - Yanlışlıkla dev ortamından prod ortamına veri gönderilmesi veya source code ifşasında prod endpointlerinin açığa çıkması. Etkilenen Dosyalar: config-loader.ts (Satır: 45-51)

3. KVKK VE VERİ GİZLİLİĞİ
Sorun: Google Calendar Tag'lerinde PII Saklanması
Sorun: scripts/Appointments.js dosyasında müşteri telefonu (customerPhone) ve e-postası (customerEmail) Google Calendar etkinliğine "Tag" olarak eklenmektedir. Nedeni: Randevu detaylarına backend tarafında kolay erişim sağlama isteği. Alternatif Öneri/Teknoloji:

Önerilen: Calendar Tag'lerinde sadece referans ID (örn. UUID) saklanmalı, PII (Kişisel Tanımlanabilir Bilgi) ise güvenli veritabanında (Google Sheets veya PropertiesService) bu ID ile eşleştirilerek tutulmalıdır. Google Calendar paylaşılan bir kaynak olabilir ve tagler API üzerinden erişilebilir. Çözümü:

JavaScript

// scripts/Appointments.js
// PII verilerini Calendar'a yazma
// calEvent.setTag('customerPhone', sanitizedCustomerPhone); // KALDIR
// calEvent.setTag('customerEmail', sanitizedCustomerEmail); // KALDIR

// Yerine referans ID kullan ve veriyi StorageService'e yaz
const appointmentId = Utilities.getUuid();
calEvent.setTag('appointmentId', appointmentId);
// StorageService.saveAppointmentDetails(appointmentId, { phone, email, ... });
Etkisi: Yüksek - KVKK ihlali. Takvim erişimi olan personelin (veya yetkisiz API erişiminin) tüm müşteri iletişim bilgilerini toplu olarak çekebilmesi. Etkilenen Dosyalar: scripts/Appointments.js (Satır: 667-668)

Sorun: Audit Log Büyüme ve Saklama Politikası Eksikliği
Sorun: scripts/SheetStorageService.gs dosyasında AUDIT_LOG sayfasına sürekli ekleme (appendRow) yapılmakta ancak eski logları temizleyen veya arşivleyen bir mekanizma bulunmamaktadır. Nedeni: Loglama özelliği eklenmiş ancak yaşam döngüsü yönetimi unutulmuş. Alternatif Öneri/Teknoloji:

Önerilen: DataRetentionService gibi bir servis üzerinden belirli bir satır sayısı (örn. 5000) veya tarih (örn. 1 yıl) aşıldığında eski logların otomatik olarak silinmesi veya arşivlenmesi. Çözümü: SheetStorageService.gs içine bir rotateAuditLogs fonksiyonu ekleyin ve bunu zaman tetikleyicisine bağlayın. Etkisi: Düşük - Spreadsheet'in 5 milyon hücre limitine ulaşması ve sistemin durması (uzun vadede). Etkilenen Dosyalar: scripts/SheetStorageService.gs

4. KOD KALİTESİ VE TEMİZ KOD (CLEAN CODE)
Sorun: TypeScript Tip Güvenliğinin İhlali (any kullanımı)
Sorun: admin-panel.ts, app.ts ve diğer TypeScript dosyalarında (window as any) ve any tipi yaygın olarak kullanılmıştır. Nedeni: Global değişkenlere (CONFIG, UI vb.) hızlı erişim sağlama ve TypeScript derleyici hatalarını bastırma eğilimi. Alternatif Öneri/Teknoloji:

Global type definition dosyası (env.d.ts veya globals.d.ts) kullanımı.

Önerilen: types.ts dosyasındaki Window interface genişletmesinin tüm dosyalarda etkin bir şekilde kullanılması ve any kullanımının eslint kuralları ile kısıtlanması. Çözümü:

TypeScript

// types.ts dosyasına eklemeler yapılmış ancak kullanım yaygınlaştırılmalı
// Örn: (window as any).CONFIG yerine window.CONFIG (types.ts'de tanımlı olduğu sürece)
Etkisi: Düşük - Kodun bakımını zorlaştırır, runtime hatalarına davetiye çıkarır ve IDE'nin otomatik tamamlama özelliklerini devre dışı bırakır. Etkilenen Dosyalar: app.ts, admin-panel.ts, config-loader.ts

ÖZET RAPOR
Proje genel hatlarıyla modüler ve modern bir yapıya (Vite, TypeScript, ES Modules) geçiş sürecindedir. Ancak bu geçiş sırasında bazı kritik güvenlik ve performans noktaları gözden kaçmıştır. Özellikle API Key üretimindeki zayıflık ve Hata mesajlarındaki bilgi sızıntısı acil müdahale gerektirir. Google Sheets'in veritabanı olarak kullanımı, düşük hacimli işlemler için kabul edilebilir olsa da, updateById gibi operasyonların verimsizliği, veri hacmi arttıkça darboğaz oluşturacaktır. KVKK açısından Calendar Tag'lerinde açık PII saklanması en büyük uyumluluk riskidir.

Tavsiye Edilen Öncelik Sıralaması:

Auth.js kriptografi güncellemesi.

Main.js hata yönetimi sanitizasyonu.

Appointments.js Calendar PII temizliği.

config-loader.ts production secret temizliği.
