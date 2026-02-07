-- =====================================================================
-- 004_database_functions.sql
-- Is mantigi fonksiyonlari
-- GAS kaynak: Appointments.js (createAppointment + LockServiceWrapper),
--             Calendar.js (SlotService.getSlotStatusBatch),
--             Security.js (checkRateLimit), SheetStorageService (KVKK)
-- =====================================================================

-- =====================================================================
-- check_and_create_appointment()
-- Advisory lock ile race condition koruması
-- GAS: LockServiceWrapper.withLock() + Calendar slot check + create
--
-- Slot cakisma kurallari:
--   maxSlotAppointment = 0 -> sinirsiz
--   maxSlotAppointment = 1 -> saat basi 1 randevu (varsayilan)
--   maxSlotAppointment = 2 -> saat basi 2 randevu
--   management randevulari cakisma kontrolu bypass eder
--
-- Delivery limiti:
--   maxDailyDelivery = 0 -> sinirsiz
--   maxDailyDelivery > 0 -> gunluk delivery + shipping limiti
-- =====================================================================
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
  -- Bitiş saatini hesapla
  v_end_time := p_start_time + (p_duration || ' minutes')::INTERVAL;

  -- Epoch-minute hesapla (cakisma kontrolu icin)
  v_new_start_min := EXTRACT(HOUR FROM p_start_time) * 60 + EXTRACT(MINUTE FROM p_start_time);
  v_new_end_min := v_new_start_min + p_duration;

  -- Advisory lock key: tarih bazli (ayni gune ayni anda 2 randevu engellenir)
  v_lock_key := EXTRACT(EPOCH FROM p_date::TIMESTAMP)::BIGINT;

  -- Advisory lock al (transaction bazli, otomatik release)
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- 1. SLOT CAKISMA KONTROLU
  IF p_appointment_type != 'management' AND p_max_slot_appointment > 0 THEN
    SELECT COUNT(*) INTO v_overlap_count
    FROM public.appointments
    WHERE date = p_date
      AND status = 'confirmed'
      AND (
        -- [start, end) overlap kontrolu
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

  -- 2. DELIVERY LIMIT KONTROLU
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

  -- 3. RANDEVU OLUSTUR
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================
-- get_day_status()
-- GAS: SlotService.getSlotStatusBatch
-- Saat bazli musaitlik (11-20), count, available/unavailable
-- =====================================================================
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
  -- 11-20 saat araligini tara
  FOR v_hour IN 11..20 LOOP
    SELECT COUNT(*) INTO v_count
    FROM public.appointments
    WHERE date = p_date
      AND status = 'confirmed'
      AND EXTRACT(HOUR FROM start_time) = v_hour;

    -- countByHour
    v_count_by_hour := v_count_by_hour || jsonb_build_object(v_hour::text, v_count);

    -- available / occupied (maxSlotAppointment = 0 -> hepsi available)
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
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================================
-- check_rate_limit()
-- GAS: SecurityService.checkRateLimit + CacheService
-- DB bazli rate limiting (GAS CacheService yerine)
-- =====================================================================
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

  -- Mevcut kaydi al
  SELECT * INTO v_record
  FROM public.rate_limits
  WHERE identifier = p_identifier
  FOR UPDATE;

  -- Lockout aktif mi?
  IF v_record IS NOT NULL AND v_record.locked_until IS NOT NULL AND v_record.locked_until > v_now THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'locked_until', v_record.locked_until
    );
  END IF;

  -- Pencere disindaysa sifirla
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

  -- Limit asildiysa kilitle
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

  -- Sayaci artir
  UPDATE public.rate_limits
  SET count = count + 1
  WHERE identifier = p_identifier;

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', p_max_requests - v_record.count - 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================
-- anonymize_old_messages()
-- GAS: SheetStorageService.cleanupOldMessageLogs
-- KVKK 30 gun anonimlestime
-- =====================================================================
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================
-- delete_old_message_content()
-- GAS: cleanupOldMessageContent
-- KVKK 7 gun icerik silme
-- =====================================================================
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
