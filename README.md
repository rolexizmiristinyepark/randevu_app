# Rolex İzmir İstinyepark - Randevu Sistemi

Rolex yetkili satıcısı için online randevu yönetim sistemi.

## 📁 Project Structure

```
randevu-sistemi-main/
├── scripts/                    # Google Apps Script Backend
│   ├── apps-script-backend.js  # Production backend (deploy to Apps Script)
│   └── measurement-script.js   # Data measurement tool (manual use)
│
├── Core Application
│   ├── index.html              # Customer frontend (HTML)
│   ├── app.ts                  # Customer frontend (TypeScript)
│   ├── admin.html              # Admin panel (HTML)
│   ├── admin-panel.ts          # Admin panel (TypeScript)
│   └── admin-auth.ts           # Authentication logic
│
├── Styles
│   ├── base.css                # Shared CSS variables & reset
│   ├── style.css               # Customer frontend styles
│   └── admin.css               # Admin panel styles
│
├── Utilities
│   ├── api-service.ts          # API communication with backend
│   ├── button-utils.ts         # Button state management (DRY)
│   ├── calendar-config.ts      # Calendar configuration
│   ├── calendar-integration.ts # Calendar integration logic
│   ├── config-loader.ts        # Dynamic config loading
│   ├── date-utils.ts           # Date manipulation utilities
│   ├── error-utils.ts          # Error handling (DRY)
│   ├── monitoring.ts           # Sentry + Web Vitals monitoring
│   ├── security-helpers.ts     # XSS protection, sanitization
│   ├── string-utils.ts         # String utilities (DRY)
│   ├── time-utils.ts           # Time formatting (DRY)
│   └── validation-utils.ts     # Form validation (DRY)
│
├── Configuration
│   ├── vite.config.js          # Vite bundler configuration
│   ├── vitest.config.ts        # Vitest test runner config
│   ├── eslint.config.js        # ESLint linter configuration
│   └── types.ts                # TypeScript type definitions
│
├── Assets
│   └── assets/                 # Images, logos, icons
│
└── Tests
    └── tests/                  # Unit & integration tests (Vitest)
        ├── api-service.test.ts
        ├── date-utils.test.ts
        ├── error-utils.test.ts
        ├── validation-utils.test.ts
        └── ... (12 test files, 320 tests)
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install
```

### Development

```bash
# Start development server (Vite)
npm run dev

# Development server will start at http://localhost:5173
```

### Build for Production

```bash
# Build optimized production bundle
npm run build

# Preview production build locally
npm run preview
```

### Testing

```bash
# Run all tests (Vitest)
npm test

# Run tests with UI
npm test:ui

# Run tests once (CI mode)
npm test:run

# Generate coverage report
npm test:coverage
```

### Linting

```bash
# Run ESLint
npx eslint .
```

## 📊 Tools & Scripts

### scripts/measurement-script.js

Backend performans ve veri analizi aracı.

**Purpose:** Calendar data measurement, size analysis, and future projections.

**Usage:**
1. Open Google Apps Script Editor
2. Copy contents of `scripts/measurement-script.js`
3. Paste into Apps Script editor
4. Update `calendarId` variable (line 7)
5. Run `measureCurrentData()` function
6. Review log output (View > Logs)

**Measurements:**
- Appointment statistics (last 2 months)
- Data size analysis (per appointment)
- Future projections (6 months, 1 year, 2 years, 5 years)
- Calendar limits check (3,000 event soft limit)
- PropertiesService usage

### scripts/apps-script-backend.js

**Purpose:** Production backend API for the appointment system.

**Deployment:**
1. Open Google Apps Script (script.google.com)
2. Create new project: "Rolex Randevu Backend"
3. Copy contents of `scripts/apps-script-backend.js`
4. Paste into Code.gs
5. Update CONFIG variables (Calendar ID, etc.)
6. Deploy as Web App:
   - Execute as: Me
   - Who has access: Anyone
7. Copy deployment URL
8. Update frontend `config-loader.ts` with URL

**Features:**
- Calendar integration (Google Calendar API)
- Staff management
- Shift scheduling
- Appointment CRUD operations
- WhatsApp notifications (optional)
- Slack notifications (optional)
- Security: Rate limiting, input validation, authentication

## 🏗️ Architecture

### Frontend Stack
- **Framework:** Vanilla TypeScript (no framework)
- **Bundler:** Vite
- **Styling:** CSS with CSS Variables
- **Testing:** Vitest
- **Linting:** ESLint
- **Security:** Cloudflare Turnstile (bot protection)

### Backend Stack
- **Runtime:** Google Apps Script
- **Calendar:** Google Calendar API
- **Storage:** PropertiesService (key-value store)
- **Notifications:** WhatsApp Business API, Slack Webhooks

### Design Patterns
- **DRY Utilities:** Extracted common logic into reusable modules
- **Error Handling:** Centralized with ErrorUtils
- **API Service:** Single source for backend communication
- **VSCode Regions:** Code organization in large files

## 🔒 Security

### Frontend Protection
- **XSS Prevention:** All user input sanitized via `escapeHtml()`
- **Content Security Policy:** Strict CSP headers in HTML
- **Bot Protection:** Cloudflare Turnstile integration
- **Input Validation:** Client-side validation with ValidationUtils

### Backend Protection
- **Rate Limiting:** Prevents abuse (10 requests/min per IP)
- **Input Validation:** All API inputs validated and sanitized
- **Authentication:** Admin panel requires authentication
- **Race Condition Protection:** LockService for critical operations
- **CORS:** Controlled cross-origin access

## 📈 Performance

### Bundle Sizes (Production)
- Customer frontend: 25.86 kB (gzipped: 6.39 kB)
- Admin panel: 40.73 kB (gzipped: 8.78 kB)
- CSS: 15.08 kB (gzipped: 3.09 kB)

### Build Time
- Average: ~380ms

### Test Coverage
- 12 test files
- 320 passing tests
- 8 skipped tests

## 🎨 Features

### Customer Frontend
- Monthly calendar view
- Available time slot selection
- Multiple appointment types (Delivery, Service, Meeting, Shipping)
- Staff selection
- Contact form with validation
- Calendar integration (Google, Apple, Outlook, ICS download)
- Bot protection (Cloudflare Turnstile)
- Responsive design

### Admin Panel
- Staff management (CRUD)
- Shift scheduling (weekly planning)
- Appointment management (view, edit, delete)
- Settings management (interval, daily limits)
- WhatsApp/Slack integration
- Special links for VIP customers
- Real-time calendar sync

## 📝 Development Notes

### Code Organization
- **Flat Structure:** 19 files in root (manageable for small project)
- **No src/ Directory:** Vite handles root-level TypeScript files
- **VSCode Regions:** Large files use regions for navigation
- **DRY Refactoring:** Completed in Phase 2 (utilities extracted)

### Recent Improvements
- ✅ CSS Variables design system (base.css)
- ✅ DRY utilities (button, error, validation, time, string)
- ✅ VSCode regions for admin-panel.ts navigation
- ✅ Race condition protection (LockService)
- ✅ Test coverage (320 tests)

### Known Limitations
- No backend tests (Google Apps Script - manual testing)
- No E2E tests (planned for future)
- No TypeScript for backend (Apps Script uses plain JS)

## 🤝 Contributing

This is a proprietary project for Rolex İzmir İstinyepark.

### Development Workflow
1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes
3. Run tests: `npm test`
4. Run build: `npm run build`
5. Commit: `git commit -m "feat: description"`
6. Push: `git push origin feature/your-feature`

### Commit Convention
- `feat:` New feature
- `fix:` Bug fix
- `refactor:` Code refactoring
- `docs:` Documentation
- `test:` Test updates
- `chore:` Maintenance

## 📄 License

Proprietary - Rolex İzmir İstinyepark

---

**Maintainer:** Developed with Claude Code
**Last Updated:** November 2024
