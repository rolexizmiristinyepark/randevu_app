-- =====================================================================
-- 003_seed_data.sql
-- Profil ayarlari (6 profil) ve varsayilan settings
-- GAS kaynak: Config.js PROFIL_AYARLARI
-- =====================================================================

-- 6 profil ayari
INSERT INTO public.profile_settings (
  profile_code, profile_name, id_kontrolu, expected_role,
  same_day_booking, max_slot_appointment, slot_grid,
  max_daily_per_staff, max_daily_delivery, duration,
  assign_by_admin, allowed_types, staff_filter,
  show_calendar, takvim_filtresi, default_type,
  show_type_selection, vardiya_kontrolu
) VALUES
  -- #g - Genel link
  ('g', 'genel', FALSE, '',
   FALSE, 1, 60,
   0, 3, 60,
   FALSE, '["delivery","meeting","shipping","service"]', 'role:sales',
   TRUE, 'withtoday', '',
   TRUE, TRUE),

  -- #w - Walk-in / Gunluk
  ('w', 'gunluk', FALSE, '',
   TRUE, 2, 30,
   0, 0, 30,
   TRUE, '["meeting"]', 'none',
   FALSE, 'onlytoday', '',
   FALSE, TRUE),

  -- #b - Boutique / Magaza
  ('b', 'boutique', FALSE, '',
   TRUE, 2, 30,
   0, 0, 60,
   FALSE, '["delivery","meeting","shipping","service"]', 'role:sales',
   TRUE, 'withtoday', '',
   TRUE, TRUE),

  -- #s - Personel linki
  ('s', 'personel', TRUE, 'sales',
   FALSE, 1, 60,
   0, 3, 60,
   FALSE, '["delivery","meeting","shipping","service"]', 'self',
   TRUE, 'withtoday', '',
   TRUE, TRUE),

  -- #m - Yonetim
  ('m', 'yonetim', FALSE, '',
   TRUE, 2, 60,
   0, 0, 60,
   TRUE, '["delivery","meeting","shipping","service"]', 'role:management',
   TRUE, 'withtoday', '',
   TRUE, TRUE),

  -- #v - VIP linki
  ('v', 'vip', TRUE, 'management',
   TRUE, 2, 30,
   0, 0, 30,
   TRUE, '["delivery","meeting","service"]', 'role:sales',
   TRUE, 'withtoday', '',
   TRUE, TRUE)

ON CONFLICT (profile_code) DO NOTHING;

-- Varsayilan settings
INSERT INTO public.settings (key, value) VALUES
  ('interval', '60'),
  ('maxDaily', '4')
ON CONFLICT (key) DO NOTHING;
