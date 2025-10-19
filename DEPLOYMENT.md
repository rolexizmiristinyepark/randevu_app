# 🚀 Deployment Rehberi

## Otomatik Deployment (GitHub Actions)

Bu proje **otomatik deployment** kullanır. Her `main` branch'e push yaptığınızda:

1. ✅ **GitHub Actions** tetiklenir
2. ✅ **Vite build** otomatik çalışır (`npm run build`)
3. ✅ **dist/** klasörü oluşturulur
4. ✅ **gh-pages** branch'ine otomatik deploy edilir
5. ✅ **GitHub Pages** güncellenir (1-2 dakika içinde)

### 🎯 Yapmanız Gereken TEK ŞEY:

```bash
# Değişiklik yap
# Commit et
git add .
git commit -m "feat: yeni özellik"

# Push yap - GERİSİ OTOMATİK!
git push
```

**O kadar!** 1-2 dakika içinde değişiklikler canlıya çıkar.

---

## 📍 Deployment Durumunu Kontrol Etme

### GitHub Actions Dashboard:
```
https://github.com/rolexizmiristinyepark/randevu_app/actions
```

- 🟡 **Sarı nokta:** Deployment devam ediyor
- ✅ **Yeşil tik:** Deployment başarılı
- ❌ **Kırmızı X:** Deployment başarısız (loglara bakın)

### Canlı Site:
```
https://rolexizmiristinyepark.github.io/randevu_app/
```

---

## 🛠️ Manuel Deployment (Gerekirse)

Eğer GitHub Actions çalışmıyorsa veya manuel deploy etmek isterseniz:

### Yöntem 1: Script ile (Önerilen)
```bash
./deploy-github-pages.sh
```

### Yöntem 2: Adım Adım
```bash
# 1. Build yap
npm run build

# 2. dist/ klasörüne git
cd dist

# 3. Git init
git init
git add -A
git commit -m "Deploy to GitHub Pages"

# 4. gh-pages branch'ine push
git branch -M gh-pages
git remote add origin https://github.com/rolexizmiristinyepark/randevu_app.git
git push -f origin gh-pages

cd ..
```

---

## ⚙️ GitHub Pages Ayarları

GitHub repo'da şu ayarların yapıldığından emin olun:

1. **Settings** → **Pages**
2. **Source:** `Deploy from a branch`
3. **Branch:** `gh-pages` / `root`
4. **Save**

---

## 🔍 Sorun Giderme

### "Deployment başarısız" hatası

1. GitHub Actions loglarına bakın
2. `npm run build` lokal olarak çalışıyor mu test edin
3. `package-lock.json` commit edilmiş mi kontrol edin

### "Site güncellenmiyor" sorunu

1. **Hard refresh yapın:** `Cmd + Shift + R`
2. **Incognito modda** açın
3. **1-2 dakika bekleyin** (GitHub Pages cache)
4. **Browser cache temizleyin**

### "Build hatası" sorunu

```bash
# Dependencies'leri yeniden yükle
rm -rf node_modules package-lock.json
npm install

# Build tekrar dene
npm run build
```

---

## 📦 Proje Yapısı

```
randevu-sistemi-main/
├── .github/
│   └── workflows/
│       └── deploy.yml          # 🤖 Otomatik deployment
├── dist/                       # 🚫 .gitignore'da (build çıktısı)
│   ├── admin.html             # Build edilmiş admin sayfası
│   ├── index.html             # Build edilmiş ana sayfa
│   └── assets/                # Minified JS/CSS
├── admin.html                 # ✏️ Kaynak dosya (bunu düzenle)
├── index.html                 # ✏️ Kaynak dosya
├── vite.config.js            # Vite build ayarları
├── package.json              # Dependencies
└── deploy-github-pages.sh    # Manuel deployment script (yedek)
```

### ⚠️ ÖNEMLİ:

- ✏️ **Düzenleyeceğiniz dosya:** `admin.html` (root)
- 🚫 **Düzenlemeyeceğiniz dosya:** `dist/admin.html` (otomatik oluşur)
- 🤖 **Her push:** Otomatik build + deploy
- 📁 **dist/ klasörü:** `.gitignore`'da (commit edilmez)

---

## 🎉 Özet

1. **Kod değişikliği yap** → `admin.html` veya `index.html` düzenle
2. **Commit + Push** → `git add . && git commit -m "..." && git push`
3. **Bekle** → 1-2 dakika
4. **Yenile** → `Cmd + Shift + R`
5. **Hazır!** 🚀

**Artık manuel `npm run build` veya `./deploy-github-pages.sh` çalıştırmanıza gerek yok!**
