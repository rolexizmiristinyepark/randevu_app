-- Fix target_type CHECK constraints
-- Recipients: admin, customer, staff, today_customers, today_staffs, tomorrow_customers, tomorrow_staffs
-- Onceki constraint sadece 'customer' ve 'staff' kabul ediyordu

-- whatsapp_templates
ALTER TABLE public.whatsapp_templates
  DROP CONSTRAINT IF EXISTS whatsapp_templates_target_type_check;

ALTER TABLE public.whatsapp_templates
  ADD CONSTRAINT whatsapp_templates_target_type_check
  CHECK (target_type IN ('customer', 'staff', 'admin', 'today_customers', 'today_staffs', 'tomorrow_customers', 'tomorrow_staffs'));

-- notification_flows (ayni constraint varsa)
ALTER TABLE public.notification_flows
  DROP CONSTRAINT IF EXISTS notification_flows_target_type_check;
