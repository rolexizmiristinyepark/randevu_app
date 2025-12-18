# Proje Güncelleme Rehberi

## ⚠️ KRİTİK KURALLAR - MUTLAKA UYULMALI

### 1. Her Değişiklik Commit Edilecek
- **Her küçük değişiklik** ayrı bir commit olarak kaydedilecek
- Commit mesajları açıklayıcı ve Türkçe olacak
- Örnek: `git commit -m "Admin paneline yeni buton eklendi"`

### 2. Git ile Geri Alma Garantisi
- Her adım geri alınabilir olmalı
- Commit'ler atomik (tek bir işlemi kapsayan) olmalı
- Büyük değişiklikler küçük parçalara bölünecek

### 3. Proje Kayıp Riski SIFIR
- ❌ Asla `git push --force` kullanılmayacak
- ❌ Asla `git reset --hard` düşünmeden kullanılmayacak
- ✅ Her önemli adımda branch oluşturulabilir
- ✅ Gerekirse backup branch açılacak

---

## 🔄 Güncelleme Süreci

### Adım Adım Çalışma Prensibi:
1. Değişiklik yap
2. Test et
3. `git add .`
4. `git commit -m "Açıklayıcı mesaj"`
5. Bir sonraki değişikliğe geç

### Geri Alma Komutları:
```bash
# Son commit'i geri al (değişiklikler korunur)
git reset --soft HEAD~1

# Belirli bir dosyayı eski haline getir
git checkout -- dosya_adi

# Tüm commit geçmişini gör
git log --oneline

# Belirli bir commit'e dön
git checkout <commit-hash>
```

---

## 🔧 KURTARILAN VERİLER (2025-12-18)

`git fsck --lost-found` ile kayıp veriler tespit edildi ve kurtarıldı.

### Kurtarma Branch'leri:
| Branch | Commit Hash | Açıklama |
|--------|-------------|----------|
| `recovered-stash-1` | c612ae55 | Stash - Temizlik öncesi yedek |
| `recovered-stash-2` | 36bf5400 | Stash - WIP değişiklikler |
| `recovered-deploy-1` | c5e78266 | Deploy commit |
| `recovered-deploy-2` | c4181186 | Deploy commit |

### Kurtarılan Dosyalar (`_RECOVERED_FILES/`):

#### Ana Dosyalar:
| Dosya | Boyut | Açıklama |
|-------|-------|----------|
| `apps-script-backend.js` | 169KB (4842 satır) | Google Apps Script backend |
| `apps-script-backend-parent.js` | 164KB (4710 satır) | Önceki versiyon |
| `admin-panel.old.ts` | 71KB (1614 satır) | Eski admin panel |
| `admin-panel-stash.ts` | 12KB (353 satır) | Stash'teki versiyon |
| `settings-manager-stash.ts` | 2.8KB (89 satır) | Stash'teki settings |

#### Dokümantasyon:
| Dosya | Satır | Açıklama |
|-------|-------|----------|
| `ANALIZ_FINAL_2.md` | 1404 | Detaylı analiz dökümanı |
| `CLAUDE_CODE_TALIMATLARI.md` | 411 | Claude Code talimatları |
| `GOOGLE_SHEETS_KURULUM.md` | 285 | Google Sheets kurulum rehberi |
| `SERDAR_MANUEL_GOREVLER.md` | 394 | Manuel görev listesi |

#### Scripts Klasörü (`_RECOVERED_FILES/scripts/`):
| Dosya | Boyut | Açıklama |
|-------|-------|----------|
| `Appointments.js` | 41KB | Randevu yönetimi |
| `WhatsApp.js` | 18KB | WhatsApp entegrasyonu |
| `SheetStorageService.gs` | 21KB | Sheet storage servisi |
| `MigrationSetup.gs` | 15KB | Migration ayarları |
| `Main.js` | 12KB | Ana script |
| `Storage.js` | 12KB | Depolama işlemleri |
| `Calendar.js` | 10KB | Takvim işlemleri |
| `Notifications.js` | 10KB | Bildirim sistemi |
| `Config.js` | 10KB | Yapılandırma |
| `Slack.js` | 9.4KB | Slack entegrasyonu |
| `Staff.js` | 9.6KB | Personel yönetimi |
| `Settings.js` | 8KB | Ayarlar |
| `Security.js` | 7.8KB | Güvenlik |
| `Auth.js` | 5KB | Kimlik doğrulama |
| `Validation.js` | 3.2KB | Doğrulama |
| `appsscript.json` | 537B | Manifest |

### ⚠️ ÖNEMLİ NOTLAR:
- Bu dosyalar **kayıp veriler olarak kurtarıldı**
- `_RECOVERED_FILES/` klasörü referans amaçlıdır
- Gerekirse bu dosyalardan veri alınabilir
- **Silmeden önce mutlaka kontrol edilmeli**

---

## 🚀 BÜYÜK GÜNCELLEME BAŞLIYOR

Bu projede kapsamlı bir güncelleme yapılacaktır. Yukarıdaki kurallara **kesinlikle** uyulacaktır.

**Tarih:** 2025-12-18
**Branch:** admiring-hypatia

---

*Bu dosya proje güvenliği için oluşturulmuştur.*
