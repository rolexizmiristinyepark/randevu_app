-- =====================================================================
-- 014_security_and_performance_fixes.sql
-- Supabase Security Advisor + Performance Advisor uyarilari duzeltme
-- =====================================================================

-- =====================================================================
-- SECURITY FIX 1: Function Search Path Mutable
-- Tum fonksiyonlara SET search_path = public ekle
-- Schema injection riski onlenir
-- =====================================================================

-- 1. update_updated_at_column (001_initial_schema.sql)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 2. is_admin (002_rls_policies.sql)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean,
    FALSE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- 3. current_staff_id (002_rls_policies.sql)
CREATE OR REPLACE FUNCTION public.current_staff_id()
RETURNS BIGINT AS $$
BEGIN
  RETURN COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'staff_id')::bigint,
    0
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- 4. sync_staff_claims (005_auth_triggers.sql)
CREATE OR REPLACE FUNCTION public.sync_staff_claims()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.auth_user_id IS NOT NULL THEN
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) ||
      jsonb_build_object(
        'role', NEW.role,
        'is_admin', NEW.is_admin,
        'staff_id', NEW.id,
        'staff_name', NEW.name,
        'active', NEW.active
      )
    WHERE id = NEW.auth_user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. clear_staff_claims (005_auth_triggers.sql)
CREATE OR REPLACE FUNCTION public.clear_staff_claims()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.auth_user_id IS NOT NULL THEN
    UPDATE auth.users
    SET raw_app_meta_data = raw_app_meta_data - 'staff_id' - 'staff_name' - 'is_admin'
    WHERE id = OLD.auth_user_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. check_and_create_appointment (004_database_functions.sql)
CREATE OR REPLACE FUNCTION public.check_and_create_appointment(
  p_customer_name     TEXT,
  p_customer_phone    TEXT,
  p_customer_email    TEXT DEFAULT '',
  p_customer_note     TEXT DEFAULT '',
  p_date              DATE DEFAULT CURRENT_DATE,
  p_start_time        TIME DEFAULT '11:00',
  p_duration          INTEGER DEFAULT 60,
  p_staff_id          BIGINT DEFAULT NULL,
  p_shift_type        TEXT DEFAULT 'full',
  p_appointment_type  TEXT DEFAULT 'meeting',
  p_profile           TEXT DEFAULT 'g',
  p_is_vip_link       BOOLEAN DEFAULT FALSE,
  p_assign_by_admin   BOOLEAN DEFAULT FALSE,
  p_kvkk_consent      BOOLEAN DEFAULT FALSE,
  p_max_slot_appointment INTEGER DEFAULT 1,
  p_max_daily_delivery   INTEGER DEFAULT 3
)
RETURNS JSONB AS $$
DECLARE
  v_end_time        TIME;
  v_new_start_min   INTEGER;
  v_new_end_min     INTEGER;
  v_overlap_count   INTEGER;
  v_delivery_count  INTEGER;
  v_new_id          UUID;
  v_lock_key        BIGINT;
BEGIN
  v_end_time := p_start_time + (p_duration || ' minutes')::INTERVAL;
  v_new_start_min := EXTRACT(HOUR FROM p_start_time) * 60 + EXTRACT(MINUTE FROM p_start_time);
  v_new_end_min := v_new_start_min + p_duration;
  v_lock_key := EXTRACT(EPOCH FROM p_date::TIMESTAMP)::BIGINT;

  PERFORM pg_advisory_xact_lock(v_lock_key);

  IF p_appointment_type != 'management' AND p_max_slot_appointment > 0 THEN
    SELECT COUNT(*) INTO v_overlap_count
    FROM public.appointments
    WHERE date = p_date
      AND status = 'confirmed'
      AND (
        (EXTRACT(HOUR FROM start_time) * 60 + EXTRACT(MINUTE FROM start_time)) < v_new_end_min
        AND
        (EXTRACT(HOUR FROM end_time) * 60 + EXTRACT(MINUTE FROM end_time)) > v_new_start_min
      );

    IF v_overlap_count >= p_max_slot_appointment THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('Bu saat dolu (%s/%s). Lütfen başka bir saat seçin.', v_overlap_count, p_max_slot_appointment)
      );
    END IF;
  END IF;

  IF p_appointment_type IN ('delivery', 'shipping') AND p_max_daily_delivery > 0 THEN
    SELECT COUNT(*) INTO v_delivery_count
    FROM public.appointments
    WHERE date = p_date
      AND status = 'confirmed'
      AND appointment_type IN ('delivery', 'shipping');

    IF v_delivery_count >= p_max_daily_delivery THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('Bu gün için maksimum %s teslim randevusu oluşturulabilir', p_max_daily_delivery)
      );
    END IF;
  END IF;

  INSERT INTO public.appointments (
    staff_id, customer_name, customer_phone, customer_email, customer_note,
    date, start_time, end_time, duration, shift_type,
    appointment_type, profile, is_vip_link, assign_by_admin,
    status, kvkk_consent
  ) VALUES (
    p_staff_id, p_customer_name, p_customer_phone, p_customer_email, p_customer_note,
    p_date, p_start_time, v_end_time, p_duration, p_shift_type,
    p_appointment_type, p_profile, p_is_vip_link, p_assign_by_admin,
    'confirmed', p_kvkk_consent
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_new_id,
    'message', 'Randevu başarıyla oluşturuldu'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 7. get_day_status (004_database_functions.sql)
CREATE OR REPLACE FUNCTION public.get_day_status(
  p_date               DATE,
  p_appointment_type   TEXT DEFAULT NULL,
  p_max_slot_appointment INTEGER DEFAULT 1
)
RETURNS JSONB AS $$
DECLARE
  v_hour              INTEGER;
  v_count             INTEGER;
  v_result            JSONB := '{}';
  v_available         JSONB := '[]';
  v_occupied          JSONB := '[]';
  v_count_by_hour     JSONB := '{}';
BEGIN
  FOR v_hour IN 11..20 LOOP
    SELECT COUNT(*) INTO v_count
    FROM public.appointments
    WHERE date = p_date
      AND status = 'confirmed'
      AND EXTRACT(HOUR FROM start_time) = v_hour;

    v_count_by_hour := v_count_by_hour || jsonb_build_object(v_hour::text, v_count);

    IF p_max_slot_appointment = 0 OR v_count < p_max_slot_appointment THEN
      v_available := v_available || to_jsonb(v_hour);
    ELSE
      v_occupied := v_occupied || to_jsonb(v_hour);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'available', v_available,
    'occupied', v_occupied,
    'countByHour', v_count_by_hour
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- 8. check_rate_limit (004_database_functions.sql)
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier   TEXT,
  p_max_requests INTEGER DEFAULT 10,
  p_window_seconds INTEGER DEFAULT 600
)
RETURNS JSONB AS $$
DECLARE
  v_record     RECORD;
  v_now        TIMESTAMPTZ := NOW();
  v_window_start TIMESTAMPTZ;
BEGIN
  v_window_start := v_now - (p_window_seconds || ' seconds')::INTERVAL;

  SELECT * INTO v_record
  FROM public.rate_limits
  WHERE identifier = p_identifier
  FOR UPDATE;

  IF v_record IS NOT NULL AND v_record.locked_until IS NOT NULL AND v_record.locked_until > v_now THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'locked_until', v_record.locked_until
    );
  END IF;

  IF v_record IS NULL OR v_record.first_request < v_window_start THEN
    INSERT INTO public.rate_limits (identifier, count, first_request, locked_until)
    VALUES (p_identifier, 1, v_now, NULL)
    ON CONFLICT (identifier) DO UPDATE SET
      count = 1,
      first_request = v_now,
      locked_until = NULL;

    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', p_max_requests - 1
    );
  END IF;

  IF v_record.count >= p_max_requests THEN
    UPDATE public.rate_limits
    SET locked_until = v_now + (p_window_seconds || ' seconds')::INTERVAL
    WHERE identifier = p_identifier;

    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'locked_until', v_now + (p_window_seconds || ' seconds')::INTERVAL
    );
  END IF;

  UPDATE public.rate_limits
  SET count = count + 1
  WHERE identifier = p_identifier;

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', p_max_requests - v_record.count - 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 9. anonymize_old_messages (004_database_functions.sql)
CREATE OR REPLACE FUNCTION public.anonymize_old_messages()
RETURNS JSONB AS $$
DECLARE
  v_cutoff      TIMESTAMPTZ;
  v_count       INTEGER;
BEGIN
  v_cutoff := NOW() - INTERVAL '30 days';

  UPDATE public.message_log
  SET
    phone = '[Anonimleştirildi]',
    recipient_name = LEFT(recipient_name, 1) || '***',
    staff_name = LEFT(staff_name, 1) || '***',
    customer_name = LEFT(customer_name, 1) || '***',
    customer_phone = '[Anonimleştirildi]',
    staff_phone = '[Anonimleştirildi]'
  WHERE timestamp < v_cutoff
    AND phone IS DISTINCT FROM '[Anonimleştirildi]'
    AND phone != '';

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'anonymized_count', v_count,
    'cutoff_date', v_cutoff
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 10. delete_old_message_content (004_database_functions.sql)
CREATE OR REPLACE FUNCTION public.delete_old_message_content()
RETURNS JSONB AS $$
DECLARE
  v_cutoff      TIMESTAMPTZ;
  v_count       INTEGER;
BEGIN
  v_cutoff := NOW() - INTERVAL '7 days';

  UPDATE public.message_log
  SET message_content = ''
  WHERE timestamp < v_cutoff
    AND message_content IS DISTINCT FROM ''
    AND message_content IS NOT NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'cleaned_count', v_count,
    'cutoff_date', v_cutoff
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- =====================================================================
-- SECURITY FIX 2: RLS Enabled No Policy - rate_limits
-- rate_limits tablosuna explicit policy ekle
-- service_role zaten RLS bypass eder, bu policy sadece linter icin
-- =====================================================================

CREATE POLICY "rate_limits_deny_all" ON public.rate_limits
  FOR ALL USING (false);


-- =====================================================================
-- SECURITY FIX 3: target_type constraint guncelleme
-- Yeni recipient tipleri: admin, greeter
-- =====================================================================

-- whatsapp_templates: eski today_*/tomorrow_* kaldirildi, greeter eklendi
ALTER TABLE public.whatsapp_templates
  DROP CONSTRAINT IF EXISTS whatsapp_templates_target_type_check;

ALTER TABLE public.whatsapp_templates
  ADD CONSTRAINT whatsapp_templates_target_type_check
  CHECK (target_type IN ('customer', 'staff', 'admin', 'greeter'));

-- message_log: admin ve greeter eklendi
ALTER TABLE public.message_log
  DROP CONSTRAINT IF EXISTS message_log_target_type_check;

ALTER TABLE public.message_log
  ADD CONSTRAINT message_log_target_type_check
  CHECK (target_type IN ('', 'customer', 'staff', 'admin', 'greeter'));


-- =====================================================================
-- PERFORMANCE FIX 1: Eksik FK index - message_log.staff_id
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_message_log_staff_id ON public.message_log(staff_id);


-- =====================================================================
-- PERFORMANCE FIX 2: Kullanilmayan index'leri kaldir
-- Supabase Performance Advisor'da "Unused Index" olarak isaretlenen
-- dusuk selektiviteli (boolean/enum) veya redundant index'ler
-- =====================================================================

-- staff: email zaten UNIQUE constraint ile indexlenmis (duplicate)
DROP INDEX IF EXISTS idx_staff_email;
-- staff: boolean/dusuk kardinalite - sorgu planlamada kullanilmiyor
DROP INDEX IF EXISTS idx_staff_active;
DROP INDEX IF EXISTS idx_staff_role;

-- appointments: dusuk kardinalite, sorgu genellikle date+status ile
DROP INDEX IF EXISTS idx_appointments_profile;
-- appointments: nadir sorgulanan, date_status daha kullanisli
DROP INDEX IF EXISTS idx_appointments_date_type;

-- audit_log: action icin nadir sorgulama
DROP INDEX IF EXISTS idx_audit_log_action;

-- message_log: dusuk kardinalite veya nadir sorgulanan
DROP INDEX IF EXISTS idx_message_log_direction;
DROP INDEX IF EXISTS idx_message_log_status;
DROP INDEX IF EXISTS idx_message_log_message_id;
DROP INDEX IF EXISTS idx_message_log_phone;

-- notification_flows: boolean dusuk kardinalite
DROP INDEX IF EXISTS idx_notification_flows_active;

-- whatsapp_templates: boolean/dusuk kardinalite
DROP INDEX IF EXISTS idx_whatsapp_templates_active;
DROP INDEX IF EXISTS idx_whatsapp_templates_target_type;

-- daily_tasks: boolean
DROP INDEX IF EXISTS idx_daily_tasks_active;

-- rate_limits: cron temizlik disinda kullanilmiyor
-- first_request zaten cron query'de WHERE sartinda kullaniliyor ama
-- tablo kucuk oldugu icin seq scan daha hizli
DROP INDEX IF EXISTS idx_rate_limits_first_request;
DROP INDEX IF EXISTS idx_rate_limits_locked_until;
