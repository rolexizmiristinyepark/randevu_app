# Proje Kuralları - Randevu Sistemi

## Otomatik Workflow (Her Değişiklik Sonrası)

### 1. Commit
Her değişiklik sonrası otomatik commit yap.

### 2. Backend Değişikliği Kontrolü
`scripts/` klasöründe değişiklik varsa:
```bash
cd scripts && clasp push && clasp deploy
```

### 3. URL Güncelleme (Deploy Sonrası)
Eğer deploy yeni URL ürettiyse:
1. `.env.development` dosyasındaki `VITE_APPS_SCRIPT_URL` güncelle
2. Yeni URL'yi panoya kopyala: `echo "URL" | pbcopy`
3. Kullanıcıya yeni URL'yi bildir

### 4. Özet
| Değişiklik | Aksiyon |
|------------|---------|
| Frontend (`*.ts`, `*.css`, `*.html`) | Commit |
| Backend (`scripts/*.js`) | Commit → clasp push → clasp deploy → URL güncelle |

## Proje Yapısı

- **Frontend:** Vite + TypeScript
- **Backend:** Google Apps Script (`scripts/`)
- **Deploy:** clasp

## Önemli Dosyalar

- `.env.development` - VITE_APPS_SCRIPT_URL buradan okunuyor
- `.clasp.json` - clasp konfigürasyonu (rootDir: scripts)
- `scripts/` - Backend kodları (Apps Script)

## Button Utility

Tüm butonlarda işlem sırasında `ButtonAnimator` kullan:
```typescript
import { ButtonAnimator } from '../button-utils';

ButtonAnimator.start(btn);    // İşlem başında
ButtonAnimator.success(btn);  // Başarılı
ButtonAnimator.error(btn);    // Hata
```

## Dev Server

```bash
npm run dev  # Port 3000'de başlar
```
