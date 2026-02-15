-- VIP (v) profilini admin appointment_create flow'undan cikar
-- VIP'te staff URL'den atanmis (id_kontrolu=true), admin atama bildirimi gereksiz
UPDATE notification_flows
SET profiles = '["g", "w"]'::jsonb
WHERE name = 'admin' AND trigger = 'appointment_create';

-- Ayrica confirm_v2 (appointment_assign) flow'unda da VIP gereksiz
-- VIP staff zaten atanmis, assign sonrasi onay zaten confirm_v1'den gidiyor
UPDATE notification_flows
SET profiles = '["g", "w"]'::jsonb
WHERE name = 'confirm_v2' AND trigger = 'appointment_assign';
