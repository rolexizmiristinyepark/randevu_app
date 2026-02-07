# Proje Kurallari - Randevu Sistemi

## Otomatik Workflow (Her Degisiklik Sonrasi)

### 1. Commit
Her degisiklik sonrasi otomatik commit yap.

### 2. Backend Degisikligi Kontrolu
- **Edge Functions** (`supabase/functions/`): Lokal test icin `supabase functions serve`
- **Migrations** (`supabase/migrations/`): `supabase db reset` ile lokal test
- **Production deploy**: `supabase db push` (migrations) + `supabase functions deploy` (edge functions)

### 3. Ozet
| Degisiklik | Aksiyon |
|------------|---------|
| Frontend (`*.ts`, `*.css`, `*.html`) | Commit |
| Edge Functions (`supabase/functions/`) | Commit + `supabase functions deploy <name>` |
| Migrations (`supabase/migrations/`) | Commit + `supabase db push` |

## Proje Yapisi

- **Frontend:** Vite + TypeScript
- **Backend:** Supabase Edge Functions (Deno/TypeScript)
- **Database:** Supabase PostgreSQL (Frankfurt, eu-central-1)
- **Auth:** Supabase Auth (JWT + app_metadata claims)
- **Deploy:** GitHub Actions -> GitHub Pages (frontend), Supabase CLI (backend)

## Onemli Dosyalar

- `.env.development` - VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
- `supabase/config.toml` - Supabase lokal konfigurasyonu
- `supabase/functions/` - Edge Functions (backend)
- `supabase/migrations/` - Veritabani semalari
- `api-service.ts` - Frontend API katmani (adapter pattern)
- `admin-auth.ts` - Supabase Auth entegrasyonu
- `config-loader.ts` - Config yukleme ve cache

## Button Utility

Tum butonlarda islem sirasinda `ButtonAnimator` kullan:
```typescript
import { ButtonAnimator } from '../button-utils';

ButtonAnimator.start(btn);    // Islem basinda
ButtonAnimator.success(btn);  // Basarili
ButtonAnimator.error(btn);    // Hata
```

## Dev Server

```bash
supabase start   # Lokal Supabase (PostgreSQL + Auth + Edge Functions)
npm run dev      # Frontend dev server (port 3000)
```
