-- =====================================================================
-- 009_seed_production_data.sql
-- GAS'tan Supabase'e Üretim Verileri Aktarımı
-- Kaynak: GAS API + Vardiya Ekran Görüntüleri (Şubat 2026)
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. STAFF - Varol Uçan ekleme (diğer 10 personel zaten production DB'de)
-- Production DB mevcut ID'ler: 2=Serdar, 3=Ece, 4=Gökhan, 5=Sırma,
-- 6=Gamze, 7=Okan, 8=Haluk, 9=Onur, 10=Murat, 11=Veysi
-- =====================================================================
INSERT INTO public.staff (id, name, phone, email, role, is_admin, is_vip, active) VALUES
  (12, 'Varol Uçan', '905382348657', 'varol.ucan@kulahcioglu.com', 'sales', FALSE, FALSE, TRUE)
ON CONFLICT (id) DO NOTHING;

-- Sequence'i son ID'den sonrasına ayarla
SELECT setval('staff_id_seq', (SELECT MAX(id) FROM public.staff));

-- =====================================================================
-- 2. SHIFTS - Vardiya verisi (Şubat 2026, GAS vardiya API'den)
-- Mapping: GAS sıra → Production staff_id
-- 1=Serdar(2), 2=Ece(3), 3=Gökhan(4), 4=Sırma(5),
-- 5=Gamze(6), 6=Okan(7), 7=Varol(12)
-- =====================================================================
INSERT INTO public.shifts (date, staff_id, shift_type) VALUES
  -- 2026-02-01 (Pazar)
  ('2026-02-01', 2, 'morning'),
  ('2026-02-01', 3, 'evening'),
  ('2026-02-01', 4, 'evening'),
  ('2026-02-01', 5, 'morning'),
  ('2026-02-01', 6, 'full'),

  -- 2026-02-02 (Pazartesi)
  ('2026-02-02', 2, 'evening'),
  ('2026-02-02', 4, 'full'),
  ('2026-02-02', 6, 'morning'),
  ('2026-02-02', 7, 'morning'),
  ('2026-02-02', 12, 'evening'),

  -- 2026-02-03 (Salı)
  ('2026-02-03', 2, 'full'),
  ('2026-02-03', 3, 'morning'),
  ('2026-02-03', 4, 'evening'),
  ('2026-02-03', 5, 'evening'),
  ('2026-02-03', 7, 'morning'),

  -- 2026-02-04 (Çarşamba)
  ('2026-02-04', 2, 'morning'),
  ('2026-02-04', 3, 'evening'),
  ('2026-02-04', 6, 'evening'),
  ('2026-02-04', 12, 'morning'),

  -- 2026-02-05 (Perşembe)
  ('2026-02-05', 2, 'evening'),
  ('2026-02-05', 3, 'morning'),
  ('2026-02-05', 4, 'evening'),
  ('2026-02-05', 6, 'morning'),
  ('2026-02-05', 7, 'evening'),
  ('2026-02-05', 12, 'morning'),

  -- 2026-02-06 (Cuma)
  ('2026-02-06', 2, 'morning'),
  ('2026-02-06', 4, 'evening'),
  ('2026-02-06', 5, 'evening'),
  ('2026-02-06', 6, 'full'),
  ('2026-02-06', 7, 'morning'),
  ('2026-02-06', 12, 'evening'),

  -- 2026-02-07 (Cumartesi)
  ('2026-02-07', 3, 'evening'),
  ('2026-02-07', 4, 'morning'),
  ('2026-02-07', 5, 'evening'),
  ('2026-02-07', 12, 'full'),

  -- 2026-02-08 (Pazar)
  ('2026-02-08', 3, 'full'),
  ('2026-02-08', 5, 'morning'),
  ('2026-02-08', 6, 'evening'),
  ('2026-02-08', 7, 'full'),

  -- 2026-02-09 (Pazartesi)
  ('2026-02-09', 2, 'evening'),
  ('2026-02-09', 3, 'morning'),
  ('2026-02-09', 4, 'full'),
  ('2026-02-09', 6, 'evening'),
  ('2026-02-09', 12, 'morning'),

  -- 2026-02-10 (Salı)
  ('2026-02-10', 2, 'full'),
  ('2026-02-10', 4, 'morning'),
  ('2026-02-10', 5, 'evening'),
  ('2026-02-10', 6, 'morning'),
  ('2026-02-10', 7, 'evening'),

  -- 2026-02-11 (Çarşamba)
  ('2026-02-11', 2, 'evening'),
  ('2026-02-11', 3, 'morning'),
  ('2026-02-11', 5, 'full'),
  ('2026-02-11', 7, 'morning'),
  ('2026-02-11', 12, 'evening'),

  -- 2026-02-12 (Perşembe)
  ('2026-02-12', 3, 'morning'),
  ('2026-02-12', 4, 'evening'),
  ('2026-02-12', 5, 'morning'),
  ('2026-02-12', 6, 'evening'),
  ('2026-02-12', 12, 'full'),

  -- 2026-02-13 (Cuma)
  ('2026-02-13', 2, 'evening'),
  ('2026-02-13', 4, 'morning'),
  ('2026-02-13', 5, 'evening'),
  ('2026-02-13', 6, 'full'),
  ('2026-02-13', 7, 'morning'),

  -- 2026-02-14 (Cumartesi)
  ('2026-02-14', 3, 'morning'),
  ('2026-02-14', 4, 'evening'),
  ('2026-02-14', 6, 'morning'),
  ('2026-02-14', 7, 'full'),
  ('2026-02-14', 12, 'evening'),

  -- 2026-02-15 (Pazar)
  ('2026-02-15', 2, 'evening'),
  ('2026-02-15', 3, 'full'),
  ('2026-02-15', 5, 'evening'),
  ('2026-02-15', 7, 'morning'),
  ('2026-02-15', 12, 'morning')

ON CONFLICT (date, staff_id) DO NOTHING;

-- =====================================================================
-- 3. WHATSAPP TEMPLATES - WhatsApp şablonları (GAS API'den)
-- =====================================================================
INSERT INTO public.whatsapp_templates (id, name, meta_template_name, description, content, variable_count, variables, target_type, language, has_button, button_variable, active) VALUES
  ('tmpl_1765622674683',
   'customer_notify',
   'customer_notification',
   'Müşteri Randevu Onay Bilgilendirme',
   E'Randevu Bilgilendirme\n\nSayın {{1}},\n\n{{2}} günü saat {{3}} için {{4}} randevunuz onaylanmıştır. Marka Temsilcimiz {{5}}, sizi mağazamızda ağırlamaktan memnuniyet duyacaktır.\n\nSaygılarımızla',
   5,
   '{"1":"musteri","2":"randevu_tarihi","3":"randevu_saati","4":"randevu_turu","5":"personel"}',
   'customer', 'tr', FALSE, '', TRUE),

  ('tmpl_1765721066751',
   'staff_notification',
   'staff_notification',
   'Personel Randevu Bilgilendirme',
   E'Randevu Bilgilendirme\n\nMÜŞTERİ  : {{1}}\nTEL      : {{2}}\nTARİH    : {{3}}\nSAAT     : {{4}}\nKONU     : {{5}}\nEK BİLGİ : {{6}}\n\nYukarıda detayları belirtilen randevu tarafınıza atanmıştır. Randevu detaylarının kontrol edilmesi ve randevuya ilişkin gerekli evrakların ve hazırlıkların tamamlanması rica olunur.\n\nSaygılarımızla',
   6,
   '{"1":"musteri","2":"musteri_tel","3":"randevu_tarihi","4":"randevu_saati","5":"randevu_turu","6":"randevu_ek_bilgi"}',
   'staff', 'tr', FALSE, '', TRUE),

  ('tmpl_1768907940487',
   'admin_notify',
   'admin_notification',
   'Randevu personel atama',
   E'Randevu Personel Atama\n\nMÜŞTERİ  : {{1}}\nTEL      : {{2}}\nTARİH    : {{3}}\nSAAT     : {{4}}\nKONU     : {{5}}\nEK BİLGİ : {{6}}\n\nSayın Yetkili,\n\nYukarıda bilgileri yer alan yeni bir randevu talebi alınmıştır. Randevunun onaylanabilmesi için ilgili tarih ve saatte uygun olan marka temsilcisinin atanması gerekmektedir.\nPersonel atamasını tamamladığınızda sistem otomatik olarak müşteriye randevu onay bildirimini iletecektir. Atama işlemini en kısa sürede gerçekleştirmenizi rica ederiz.\n\nSaygılarımızla\nRolex İstinyepark İzmir',
   6,
   '{"1":"musteri","2":"musteri_tel","3":"randevu_tarihi","4":"randevu_saati","5":"randevu_turu","6":"randevu_ek_bilgi"}',
   'staff', 'tr', FALSE, '', TRUE),

  ('tmpl_1768908092223',
   'update_customer_notify',
   'update_appointment',
   'Randevu güncelleme',
   E'Randevu Güncelleme\n\nSayın {{1}},\n\n{{2}} günü saat {{3}} için talebinize istinaden {{4}} randevunuz güncellenmiştir. Marka Temsilcimiz {{5}}, sizi mağazamızda ağırlamaktan memnuniyet duyacaktır.\n\nSaygılarımızla\nRolex İstinyePark İzmir',
   5,
   '{"1":"musteri","2":"randevu_tarihi","3":"randevu_saati","4":"randevu_turu","5":"personel"}',
   'customer', 'tr', FALSE, '', TRUE),

  ('tmpl_1768908238498',
   'cancel_customer_notify',
   'cancel_appointment',
   'Randevu iptal',
   E'Randevu İptali\n\nSayın {{1}},\n\n{{2}} günü saat {{3}} için planlanmış olan {{4}} randevunuz talebinize istinaden iptal edilmiştir.\nUygun olduğunuz bir tarih için aşağıdaki link üzerinden yeni bir randevu oluşturabilirsiniz.\n\nSaygılarımızla\nRolex İstinyePark İzmir',
   4,
   '{"1":"musteri","2":"randevu_tarihi","3":"randevu_saati","4":"randevu_turu"}',
   'customer', 'tr', TRUE, 'personel_id', TRUE),

  ('tmpl_1768909628984',
   'alert_customer_notify',
   'appointment_alert',
   'Randevu Hatırlatma',
   E'Randevu Hatırlatma\n\nSayın {{1}},\n\nYarın {{2}} günü saat {{3}} için {{4}} ile {{5}} randevunuzu hatırlatmak isteriz. Görüşmek üzere.\n\nSaygılarımızla',
   5,
   '{"1":"musteri","2":"randevu_tarihi","3":"randevu_saati","4":"personel","5":"randevu_turu"}',
   'customer', 'tr', FALSE, '', TRUE)

ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- 4. MAIL INFO CARDS - Mail bilgi kartları (GAS API'den)
-- =====================================================================
INSERT INTO public.mail_info_cards (id, name, fields) VALUES
  ('f7315bf9-758b-4731-aa33-86fb77d2f5d5',
   'staff_info',
   '[{"variable":"randevu_tarihi","label":"Tarih","order":0},{"variable":"randevu_saati","label":"Saat","order":1},{"variable":"randevu_profili","label":"Profil","order":2},{"variable":"randevu_turu","label":"Konu","order":3},{"variable":"randevu_ek_bilgi","label":"Ek Bilgi","order":4},{"variable":"musteri","label":"Müşteri","order":5},{"variable":"musteri_tel","label":"Telefon","order":6},{"variable":"musteri_mail","label":"E-posta","order":7}]'),

  ('5caa0473-feb1-4e09-9f08-ba75fca32415',
   'customer_info',
   '[{"variable":"randevu_tarihi","label":"Tarih","order":0},{"variable":"randevu_saati","label":"Saat","order":1},{"variable":"randevu_turu","label":"Konu","order":2},{"variable":"randevu_ek_bilgi","label":"Ek Bilgi","order":3},{"variable":"personel","label":"İlgili","order":4},{"variable":"personel_tel","label":"İlgili Tel","order":5},{"variable":"personel_mail","label":"İlgili E-posta","order":6}]'),

  ('7faf2fab-057e-4879-be3e-d9dfa7a0de83',
   'admin_info',
   '[{"variable":"musteri","label":"Müşteri","order":0},{"variable":"randevu_tarihi","label":"Tarih","order":1},{"variable":"randevu_saati","label":"Saat","order":2},{"variable":"randevu_profili","label":"Profil","order":3},{"variable":"randevu_turu","label":"Konu","order":4},{"variable":"randevu_ek_bilgi","label":"Ek Bilgi","order":5}]'),

  ('964847da-b139-41f2-ad2b-be1307b8b8e7',
   'update_customer_info',
   '[{"variable":"randevu_tarihi","label":"Tarih","order":0},{"variable":"randevu_saati","label":"Saat","order":1},{"variable":"randevu_turu","label":"Konu","order":2},{"variable":"personel","label":"İlgili","order":3},{"variable":"personel_tel","label":"İlgili Telefon","order":4},{"variable":"personel_mail","label":"İlgili E-posta","order":5},{"variable":"randevu_ek_bilgi","label":"Randevu Notu","order":6}]')

ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- 5. MAIL TEMPLATES - Mail şablonları (GAS API'den)
-- =====================================================================
INSERT INTO public.mail_templates (id, name, subject, body, recipient, info_card_id) VALUES
  ('3e932b85-04b8-4fe3-b655-7534db84baf9',
   'customer_notify',
   'Randevunuz Onaylandı - Rolex İzmir İstinyepark',
   E'Sayın {{musteri}},\n\nYukarıda detayları bulunan randevunuz onaylanmıştır.\nRolex temsilcimiz sizi mağazamızda ağırlamaktan memnuniyet duyacaktır.\nGörüşmek üzere.\n\nSaygılarımızla.\nRolex İstinyepark İzmir',
   'customer',
   '5caa0473-feb1-4e09-9f08-ba75fca32415'),

  ('e7725583-c190-410c-bf44-1146d986be35',
   'staff_notify',
   'Yeni Randevu - {{musteri}}',
   E'Sayın {{personel}},\n\nYukarıda detayları belirtilen randevu tarafınıza atanmıştır.\nRandevu detaylarının kontrol edilmesi, randevuya ilişkin gerekli evrakların ve hazırlıkların tamamlanması rica olunur.\n\nSaygılarımızla\nRolex İstinyepark İzmir',
   'staff',
   'f7315bf9-758b-4731-aa33-86fb77d2f5d5'),

  ('dd0f3a3d-ecfb-4bf8-82b0-b0b2e09f1589',
   'admin_notify',
   'Yeni Randevu Talebi - Randevu Personel Atama',
   E'Sayın Yetkili,\n\nYukarıda bilgileri bulunan yeni bir randevu talebi alınmıştır.\nRandevunun onaylanabilmesi için ilgili tarih ve saatte uygun olan Rolex temsilcisinin atanması gerekmektedir.\nPersonel atamasını tamamladığınızda sistem otomatik olarak müşteriye randevu onayı iletilecektir. Atama işlemini en kısa sürede gerçekleştirmenizi rica ederiz.\n\nSaygılarımızla\nRolex İstinyepark İzmir',
   'staff',
   '7faf2fab-057e-4879-be3e-d9dfa7a0de83'),

  ('b1747571-e84e-44fe-b307-b2bd22d44c6f',
   'update_customer_notify',
   'Randevu Güncelleme',
   E'Sayın {{musteri}},\n\nTalebinize istinaden randevunuz güncellenmiştir. Rolex Temsilcimiz sizi mağazamızda ağırlamaktan memnuniyet duyacaktır.\n\nSaygılarımızla\nRolex İstinyePark İzmir',
   'customer',
   '964847da-b139-41f2-ad2b-be1307b8b8e7'),

  ('8f7f05a0-15db-4dce-b928-bd59ecf14427',
   'cancel_customer_notify',
   'Randevu İptali',
   E'Sayın {{musteri}},\n\n{{randevu_tarihi}} günü saat {{randevu_saati}} için planlanmış olan {{randevu_turu}} randevunuz talebinize istinaden iptal edilmiştir.\nUygun olduğunuz bir tarih için yeni bir randevu oluşturabilirsiniz.\n\nSaygılarımızla\nRolex İstinyePark İzmir',
   'customer',
   ''),

  ('ec4584b3-6806-442c-a1df-a7ce2e5f588f',
   'alert_customer_notify',
   'Randevu Hatırlatma',
   E'Randevu Hatırlatma\n\nSayın {{musteri}},\n\nYarın {{randevu_tarihi}} günü saat {{randevu_saati}} için {{personel}} ile {{randevu_turu}} randevunuzu hatırlatmak isteriz. Görüşmek üzere.\n\nSaygılarımızla\nRolex İstinyepark İzmir',
   'customer',
   '5caa0473-feb1-4e09-9f08-ba75fca32415')

ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- 6. NOTIFICATION FLOWS - Bildirim akışları (GAS API'den)
-- =====================================================================
INSERT INTO public.notification_flows (id, name, description, trigger, profiles, whatsapp_template_ids, mail_template_ids, active) VALUES
  ('d4a830d3-facf-4189-a7a0-5cd0fc860691',
   'confirm_v1',
   'Randevu onaylandığında personel ve müşteriye gönderilen bilgilendirme mesajı ve maili',
   'appointment_create',
   '["b","s"]',
   '["tmpl_1765622674683","tmpl_1765721066751"]',
   '["3e932b85-04b8-4fe3-b655-7534db84baf9","e7725583-c190-410c-bf44-1146d986be35"]',
   TRUE),

  ('bb7c9f90-098c-4b62-b84c-80a63a54822d',
   'admin',
   'Adminlere ilgili atması için bilgilendirme mesajı',
   'appointment_create',
   '["g","w","v"]',
   '["tmpl_1768907940487"]',
   '["dd0f3a3d-ecfb-4bf8-82b0-b0b2e09f1589"]',
   TRUE),

  ('1d30bfad-93d5-4d8b-ba8a-de95fbab7cb4',
   'confirm_v2',
   'Admin personel atadıktan sonra personel ve müşteriye gönderilen bilgilendirme mesajı ve maili',
   'appointment_assign',
   '["g","w","v"]',
   '["tmpl_1765622674683","tmpl_1765721066751"]',
   '["3e932b85-04b8-4fe3-b655-7534db84baf9","e7725583-c190-410c-bf44-1146d986be35"]',
   TRUE),

  ('2040323a-ed38-4cd1-9d2f-5862638786ac',
   'update',
   'Randevu Güncelleme',
   'appointment_update',
   '["g","w","b","m","s","v"]',
   '["tmpl_1768908092223"]',
   '["b1747571-e84e-44fe-b307-b2bd22d44c6f"]',
   TRUE),

  ('07560da2-3c1f-4f11-b8e9-0c18975cafbb',
   'cancel',
   'Randevu İptali',
   'appointment_cancel',
   '["g","w","b","m","s","v"]',
   '["tmpl_1768908238498"]',
   '["8f7f05a0-15db-4dce-b928-bd59ecf14427"]',
   TRUE),

  ('fa6829d1-158a-4d1a-813e-b5d85f235e60',
   'alert',
   'Randevu Hatırlatma',
   'reminder',
   '["g","w","b","s","v"]',
   '["tmpl_1768909628984"]',
   '["ec4584b3-6806-442c-a1df-a7ce2e5f588f"]',
   TRUE)

ON CONFLICT (id) DO NOTHING;

COMMIT;
