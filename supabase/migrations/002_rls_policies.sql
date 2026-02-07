-- =====================================================================
-- 002_rls_policies.sql
-- Row Level Security politikalari
-- =====================================================================

-- Helper: Mevcut kullanicinin admin olup olmadigini kontrol et
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean,
    FALSE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper: Mevcut kullanicinin staff_id'sini al
CREATE OR REPLACE FUNCTION public.current_staff_id()
RETURNS BIGINT AS $$
BEGIN
  RETURN COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'staff_id')::bigint,
    0
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================================
-- 1. staff - Herkes okuyabilir (aktif olanlar), admin yazabilir
-- =====================================================================
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_select_all" ON public.staff
  FOR SELECT USING (true);

CREATE POLICY "staff_insert_admin" ON public.staff
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "staff_update_admin" ON public.staff
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "staff_delete_admin" ON public.staff
  FOR DELETE USING (public.is_admin());

-- =====================================================================
-- 2. shifts - Herkes okuyabilir, admin yazabilir
-- =====================================================================
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shifts_select_all" ON public.shifts
  FOR SELECT USING (true);

CREATE POLICY "shifts_insert_admin" ON public.shifts
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "shifts_update_admin" ON public.shifts
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "shifts_delete_admin" ON public.shifts
  FOR DELETE USING (public.is_admin());

-- =====================================================================
-- 3. appointments - Herkes okuyabilir/olusturabilir (Turnstile korur),
--    admin guncelleyebilir/silebilir
-- =====================================================================
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appointments_select_all" ON public.appointments
  FOR SELECT USING (true);

CREATE POLICY "appointments_insert_all" ON public.appointments
  FOR INSERT WITH CHECK (true);

CREATE POLICY "appointments_update_admin" ON public.appointments
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "appointments_delete_admin" ON public.appointments
  FOR DELETE USING (public.is_admin());

-- =====================================================================
-- 4. settings - Herkes okuyabilir, admin yazabilir
-- =====================================================================
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings_select_all" ON public.settings
  FOR SELECT USING (true);

CREATE POLICY "settings_insert_admin" ON public.settings
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "settings_update_admin" ON public.settings
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "settings_delete_admin" ON public.settings
  FOR DELETE USING (public.is_admin());

-- =====================================================================
-- 5. audit_log - Admin okuyabilir, service_role yazabilir (append-only)
-- =====================================================================
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_select_admin" ON public.audit_log
  FOR SELECT USING (public.is_admin());

-- Edge Functions service_role ile INSERT yapar, RLS bypass eder

-- =====================================================================
-- 6. message_log - Admin okuyabilir, service_role yazabilir
-- =====================================================================
ALTER TABLE public.message_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "message_log_select_admin_or_public" ON public.message_log
  FOR SELECT USING (true);

-- Edge Functions service_role ile INSERT/UPDATE yapar

-- =====================================================================
-- 7. notification_flows - Herkes okuyabilir, admin yazabilir
-- =====================================================================
ALTER TABLE public.notification_flows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_flows_select_all" ON public.notification_flows
  FOR SELECT USING (true);

CREATE POLICY "notification_flows_insert_admin" ON public.notification_flows
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "notification_flows_update_admin" ON public.notification_flows
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "notification_flows_delete_admin" ON public.notification_flows
  FOR DELETE USING (public.is_admin());

-- =====================================================================
-- 8. whatsapp_templates - Herkes okuyabilir, admin yazabilir
-- =====================================================================
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_templates_select_all" ON public.whatsapp_templates
  FOR SELECT USING (true);

CREATE POLICY "whatsapp_templates_insert_admin" ON public.whatsapp_templates
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "whatsapp_templates_update_admin" ON public.whatsapp_templates
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "whatsapp_templates_delete_admin" ON public.whatsapp_templates
  FOR DELETE USING (public.is_admin());

-- =====================================================================
-- 9. mail_templates - Herkes okuyabilir, admin yazabilir
-- =====================================================================
ALTER TABLE public.mail_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mail_templates_select_all" ON public.mail_templates
  FOR SELECT USING (true);

CREATE POLICY "mail_templates_insert_admin" ON public.mail_templates
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "mail_templates_update_admin" ON public.mail_templates
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "mail_templates_delete_admin" ON public.mail_templates
  FOR DELETE USING (public.is_admin());

-- =====================================================================
-- 10. mail_info_cards - Herkes okuyabilir, admin yazabilir
-- =====================================================================
ALTER TABLE public.mail_info_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mail_info_cards_select_all" ON public.mail_info_cards
  FOR SELECT USING (true);

CREATE POLICY "mail_info_cards_insert_admin" ON public.mail_info_cards
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "mail_info_cards_update_admin" ON public.mail_info_cards
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "mail_info_cards_delete_admin" ON public.mail_info_cards
  FOR DELETE USING (public.is_admin());

-- =====================================================================
-- 11. daily_tasks - Sadece admin
-- =====================================================================
ALTER TABLE public.daily_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_tasks_select_admin" ON public.daily_tasks
  FOR SELECT USING (public.is_admin());

CREATE POLICY "daily_tasks_insert_admin" ON public.daily_tasks
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "daily_tasks_update_admin" ON public.daily_tasks
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "daily_tasks_delete_admin" ON public.daily_tasks
  FOR DELETE USING (public.is_admin());

-- =====================================================================
-- 12. profile_settings - Herkes okuyabilir, admin yazabilir
-- =====================================================================
ALTER TABLE public.profile_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profile_settings_select_all" ON public.profile_settings
  FOR SELECT USING (true);

CREATE POLICY "profile_settings_insert_admin" ON public.profile_settings
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "profile_settings_update_admin" ON public.profile_settings
  FOR UPDATE USING (public.is_admin());

-- =====================================================================
-- 13. rate_limits - Sadece service_role (Edge Functions)
-- RLS etkin ama policy yok -> anon/authenticated erisemez
-- Edge Functions service_role ile bypass eder
-- =====================================================================
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
