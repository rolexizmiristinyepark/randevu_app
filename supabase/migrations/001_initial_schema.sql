-- =====================================================================
-- 001_initial_schema.sql
-- Randevu Sistemi - GAS'tan Supabase'e Migrasyon
-- 15 tablo: 13 GAS tablosu + 2 yeni (rate_limits, profile_settings)
-- =====================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- 1. staff - Personel tablosu
-- GAS kaynak: Sheets:staff + Staff.js COLUMNS
-- =====================================================================
CREATE TABLE public.staff (
  id          BIGSERIAL PRIMARY KEY,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  phone       TEXT DEFAULT '',
  email       TEXT NOT NULL UNIQUE,
  password_hash TEXT DEFAULT '',
  role        TEXT NOT NULL DEFAULT 'sales'
              CHECK (role IN ('sales', 'management', 'reception', 'service')),
  is_admin    BOOLEAN NOT NULL DEFAULT FALSE,
  is_vip      BOOLEAN NOT NULL DEFAULT FALSE,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  permissions JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_staff_auth_user_id ON public.staff(auth_user_id);
CREATE INDEX idx_staff_email ON public.staff(email);
CREATE INDEX idx_staff_role ON public.staff(role);
CREATE INDEX idx_staff_active ON public.staff(active);

-- =====================================================================
-- 2. shifts - Vardiya tablosu
-- GAS kaynak: Sheets:shifts
-- =====================================================================
CREATE TABLE public.shifts (
  id          BIGSERIAL PRIMARY KEY,
  date        DATE NOT NULL,
  staff_id    BIGINT NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  shift_type  TEXT NOT NULL CHECK (shift_type IN ('morning', 'evening', 'full')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(date, staff_id)
);

CREATE INDEX idx_shifts_date ON public.shifts(date);
CREATE INDEX idx_shifts_staff_id ON public.shifts(staff_id);
CREATE INDEX idx_shifts_date_range ON public.shifts(date, staff_id, shift_type);

-- =====================================================================
-- 3. appointments - Randevu tablosu
-- GAS kaynak: Calendar extendedProperties
-- =====================================================================
CREATE TABLE public.appointments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_event_id   TEXT,
  staff_id          BIGINT REFERENCES public.staff(id) ON DELETE SET NULL,
  customer_name     TEXT NOT NULL,
  customer_phone    TEXT NOT NULL,
  customer_email    TEXT DEFAULT '',
  customer_note     TEXT DEFAULT '',
  date              DATE NOT NULL,
  start_time        TIME NOT NULL,
  end_time          TIME NOT NULL,
  duration          INTEGER NOT NULL DEFAULT 60,
  shift_type        TEXT DEFAULT 'full',
  appointment_type  TEXT NOT NULL DEFAULT 'meeting'
                    CHECK (appointment_type IN ('delivery', 'shipping', 'meeting', 'service', 'management')),
  profile           TEXT NOT NULL DEFAULT 'g'
                    CHECK (profile IN ('g', 'w', 'b', 's', 'm', 'v')),
  is_vip_link       BOOLEAN NOT NULL DEFAULT FALSE,
  assign_by_admin   BOOLEAN NOT NULL DEFAULT FALSE,
  status            TEXT NOT NULL DEFAULT 'confirmed'
                    CHECK (status IN ('confirmed', 'cancelled', 'completed', 'no_show')),
  kvkk_consent      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at      TIMESTAMPTZ
);

CREATE INDEX idx_appointments_date ON public.appointments(date);
CREATE INDEX idx_appointments_staff_id ON public.appointments(staff_id);
CREATE INDEX idx_appointments_status ON public.appointments(status);
CREATE INDEX idx_appointments_date_status ON public.appointments(date, status);
CREATE INDEX idx_appointments_date_type ON public.appointments(date, appointment_type);
CREATE INDEX idx_appointments_customer_phone ON public.appointments(customer_phone);
CREATE INDEX idx_appointments_google_event_id ON public.appointments(google_event_id);
CREATE INDEX idx_appointments_profile ON public.appointments(profile);

-- =====================================================================
-- 4. settings - Anahtar/deger ayarlar tablosu
-- GAS kaynak: Sheets:settings
-- =====================================================================
CREATE TABLE public.settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 5. audit_log - Denetim logu (append-only)
-- GAS kaynak: Sheets:audit_log
-- =====================================================================
CREATE TABLE public.audit_log (
  id          BIGSERIAL PRIMARY KEY,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action      TEXT NOT NULL,
  data        JSONB DEFAULT '{}',
  user_id     TEXT DEFAULT 'system',
  ip_address  INET
);

CREATE INDEX idx_audit_log_timestamp ON public.audit_log(timestamp);
CREATE INDEX idx_audit_log_action ON public.audit_log(action);

-- =====================================================================
-- 6. message_log - WhatsApp mesaj logu
-- GAS kaynak: Sheets:message_log (21 sutun)
-- =====================================================================
CREATE TABLE public.message_log (
  id              TEXT PRIMARY KEY DEFAULT 'msg_' || extract(epoch from now())::bigint || '_' || substr(md5(random()::text), 1, 9),
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  direction       TEXT NOT NULL DEFAULT 'outgoing' CHECK (direction IN ('incoming', 'outgoing')),
  appointment_id  UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  phone           TEXT DEFAULT '',
  recipient_name  TEXT DEFAULT '',
  template_name   TEXT DEFAULT '',
  template_id     TEXT DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'sent'
                  CHECK (status IN ('sent', 'delivered', 'read', 'failed', 'pending')),
  message_id      TEXT DEFAULT '',
  error_message   TEXT DEFAULT '',
  staff_id        BIGINT REFERENCES public.staff(id) ON DELETE SET NULL,
  staff_name      TEXT DEFAULT '',
  staff_phone     TEXT DEFAULT '',
  flow_id         TEXT DEFAULT '',
  triggered_by    TEXT DEFAULT 'manual',
  profile         TEXT DEFAULT '',
  message_content TEXT DEFAULT '',
  target_type     TEXT DEFAULT '' CHECK (target_type IN ('', 'customer', 'staff')),
  customer_name   TEXT DEFAULT '',
  customer_phone  TEXT DEFAULT ''
);

CREATE INDEX idx_message_log_timestamp ON public.message_log(timestamp);
CREATE INDEX idx_message_log_appointment_id ON public.message_log(appointment_id);
CREATE INDEX idx_message_log_phone ON public.message_log(phone);
CREATE INDEX idx_message_log_status ON public.message_log(status);
CREATE INDEX idx_message_log_direction ON public.message_log(direction);
CREATE INDEX idx_message_log_message_id ON public.message_log(message_id);

-- =====================================================================
-- 7. notification_flows - Bildirim akislari
-- GAS kaynak: Sheets:notification_flows
-- =====================================================================
CREATE TABLE public.notification_flows (
  id                    TEXT PRIMARY KEY DEFAULT 'flow_' || substr(md5(random()::text), 1, 8),
  name                  TEXT NOT NULL,
  description           TEXT DEFAULT '',
  trigger               TEXT NOT NULL,
  profiles              JSONB DEFAULT '[]',
  whatsapp_template_ids JSONB DEFAULT '[]',
  mail_template_ids     JSONB DEFAULT '[]',
  active                BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_flows_trigger ON public.notification_flows(trigger);
CREATE INDEX idx_notification_flows_active ON public.notification_flows(active);

-- =====================================================================
-- 8. whatsapp_templates - WhatsApp sablon tablosu
-- GAS kaynak: Sheets:whatsapp_templates
-- =====================================================================
CREATE TABLE public.whatsapp_templates (
  id                TEXT PRIMARY KEY DEFAULT 'wa_' || substr(md5(random()::text), 1, 8),
  name              TEXT NOT NULL,
  meta_template_name TEXT DEFAULT '',
  description       TEXT DEFAULT '',
  content           TEXT DEFAULT '',
  variable_count    INTEGER DEFAULT 0,
  variables         JSONB DEFAULT '{}',
  target_type       TEXT DEFAULT 'customer' CHECK (target_type IN ('customer', 'staff')),
  language          TEXT DEFAULT 'tr',
  has_button        BOOLEAN NOT NULL DEFAULT FALSE,
  button_variable   TEXT DEFAULT '',
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_whatsapp_templates_active ON public.whatsapp_templates(active);
CREATE INDEX idx_whatsapp_templates_target_type ON public.whatsapp_templates(target_type);

-- =====================================================================
-- 9. mail_templates - E-posta sablon tablosu
-- GAS kaynak: Sheets:mail_templates
-- =====================================================================
CREATE TABLE public.mail_templates (
  id            TEXT PRIMARY KEY DEFAULT 'mt_' || substr(md5(random()::text), 1, 8),
  name          TEXT NOT NULL,
  subject       TEXT NOT NULL DEFAULT '',
  body          TEXT NOT NULL DEFAULT '',
  recipient     TEXT DEFAULT 'customer',
  info_card_id  TEXT DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 10. mail_info_cards - E-posta bilgi kartlari
-- GAS kaynak: Sheets:mail_info_cards
-- =====================================================================
CREATE TABLE public.mail_info_cards (
  id          TEXT PRIMARY KEY DEFAULT 'mic_' || substr(md5(random()::text), 1, 8),
  name        TEXT NOT NULL,
  fields      JSONB DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 11. daily_tasks - Zamanlanmis gorevler
-- GAS kaynak: Sheets:daily_tasks
-- =====================================================================
CREATE TABLE public.daily_tasks (
  id          TEXT PRIMARY KEY DEFAULT 'dt_' || substr(md5(random()::text), 1, 8),
  name        TEXT NOT NULL,
  schedule    TEXT NOT NULL DEFAULT '',
  action      TEXT NOT NULL DEFAULT '',
  params      JSONB DEFAULT '{}',
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  last_run    TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_daily_tasks_active ON public.daily_tasks(active);

-- =====================================================================
-- 12. profile_settings - Profil ayarlari
-- GAS kaynak: Config.js PROFIL_AYARLARI
-- =====================================================================
CREATE TABLE public.profile_settings (
  profile_code       TEXT PRIMARY KEY CHECK (profile_code IN ('g', 'w', 'b', 's', 'm', 'v')),
  profile_name       TEXT NOT NULL,
  id_kontrolu        BOOLEAN NOT NULL DEFAULT FALSE,
  expected_role      TEXT DEFAULT '',
  same_day_booking   BOOLEAN NOT NULL DEFAULT FALSE,
  max_slot_appointment INTEGER NOT NULL DEFAULT 1,
  slot_grid          INTEGER NOT NULL DEFAULT 60,
  max_daily_per_staff  INTEGER NOT NULL DEFAULT 0,
  max_daily_delivery INTEGER NOT NULL DEFAULT 0,
  duration           INTEGER NOT NULL DEFAULT 60,
  assign_by_admin    BOOLEAN NOT NULL DEFAULT FALSE,
  allowed_types      JSONB NOT NULL DEFAULT '["delivery","meeting"]',
  staff_filter       TEXT NOT NULL DEFAULT 'role:sales',
  show_calendar      BOOLEAN NOT NULL DEFAULT TRUE,
  takvim_filtresi    TEXT NOT NULL DEFAULT 'withtoday',
  default_type       TEXT NOT NULL DEFAULT '',
  show_type_selection BOOLEAN NOT NULL DEFAULT TRUE,
  vardiya_kontrolu   BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 13. rate_limits - Hiz sinirlandirma (GAS CacheService yerine)
-- =====================================================================
CREATE TABLE public.rate_limits (
  identifier    TEXT PRIMARY KEY,
  count         INTEGER NOT NULL DEFAULT 1,
  first_request TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_until  TIMESTAMPTZ
);

CREATE INDEX idx_rate_limits_locked_until ON public.rate_limits(locked_until);
CREATE INDEX idx_rate_limits_first_request ON public.rate_limits(first_request);

-- =====================================================================
-- updated_at trigger fonksiyonu
-- Tum updated_at iceren tablolarda otomatik guncelleme
-- =====================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- updated_at trigger'lari
CREATE TRIGGER set_staff_updated_at
  BEFORE UPDATE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_notification_flows_updated_at
  BEFORE UPDATE ON public.notification_flows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_whatsapp_templates_updated_at
  BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_mail_templates_updated_at
  BEFORE UPDATE ON public.mail_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_mail_info_cards_updated_at
  BEFORE UPDATE ON public.mail_info_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_profile_settings_updated_at
  BEFORE UPDATE ON public.profile_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
