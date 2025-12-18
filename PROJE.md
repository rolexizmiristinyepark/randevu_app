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

## 🚀 BÜYÜK GÜNCELLEME BAŞLIYOR

Bu projede kapsamlı bir güncelleme yapılacaktır. Yukarıdaki kurallara **kesinlikle** uyulacaktır.

**Tarih:** $(date +%Y-%m-%d)
**Branch:** admiring-hypatia

---

*Bu dosya proje güvenliği için oluşturulmuştur.*
