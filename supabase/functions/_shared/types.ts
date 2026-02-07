// Paylasilan TypeScript tipleri (Edge Functions icin)

export type StaffRole = 'sales' | 'management' | 'reception' | 'service';
export type AppointmentType = 'delivery' | 'shipping' | 'meeting' | 'service' | 'management';
export type ShiftType = 'morning' | 'evening' | 'full';
export type ProfileCode = 'g' | 'w' | 'b' | 's' | 'm' | 'v';
export type AppointmentStatus = 'confirmed' | 'cancelled' | 'completed' | 'no_show';

export interface Staff {
  id: number;
  gas_id?: string;
  auth_user_id?: string;
  name: string;
  phone: string;
  email: string;
  password_hash?: string;
  role: StaffRole;
  is_admin: boolean;
  is_vip: boolean;
  active: boolean;
  permissions: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  google_event_id?: string;
  staff_id?: number;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  customer_note: string;
  date: string;
  start_time: string;
  end_time: string;
  duration: number;
  shift_type: ShiftType;
  appointment_type: AppointmentType;
  profile: ProfileCode;
  is_vip_link: boolean;
  assign_by_admin: boolean;
  status: AppointmentStatus;
  kvkk_consent: boolean;
  created_at: string;
  updated_at: string;
  cancelled_at?: string;
}

export interface Shift {
  id: number;
  date: string;
  staff_id: number;
  shift_type: ShiftType;
  created_at: string;
}

export interface Setting {
  key: string;
  value: unknown;
  updated_at: string;
}

export interface ProfileSettings {
  profile_code: ProfileCode;
  profile_name: string;
  id_kontrolu: boolean;
  expected_role: string;
  same_day_booking: boolean;
  max_slot_appointment: number;
  slot_grid: number;
  max_daily_per_staff: number;
  max_daily_delivery: number;
  duration: number;
  assign_by_admin: boolean;
  allowed_types: string[];
  staff_filter: string;
  show_calendar: boolean;
  takvim_filtresi: string;
  default_type: string;
  show_type_selection: boolean;
  vardiya_kontrolu: boolean;
  updated_at: string;
}

export interface NotificationFlow {
  id: string;
  name: string;
  description: string;
  trigger: string;
  profiles: string[];
  whatsapp_template_ids: string[];
  mail_template_ids: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  meta_template_name: string;
  description: string;
  content: string;
  variable_count: number;
  variables: Record<string, unknown>;
  target_type: 'customer' | 'staff';
  language: string;
  has_button: boolean;
  button_variable: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  recipient: string;
  info_card_id: string;
  created_at: string;
  updated_at: string;
}

export interface MailInfoCard {
  id: string;
  name: string;
  fields: unknown[];
  created_at: string;
  updated_at: string;
}

export interface MessageLog {
  id: string;
  timestamp: string;
  direction: 'incoming' | 'outgoing';
  appointment_id?: string;
  phone: string;
  recipient_name: string;
  template_name: string;
  template_id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed' | 'pending';
  message_id: string;
  error_message: string;
  staff_id?: number;
  staff_name: string;
  staff_phone: string;
  flow_id: string;
  triggered_by: string;
  profile: string;
  message_content: string;
  target_type: '' | 'customer' | 'staff';
  customer_name: string;
  customer_phone: string;
}

export interface DailyTask {
  id: string;
  name: string;
  schedule: string;
  action: string;
  params: Record<string, unknown>;
  active: boolean;
  last_run?: string;
  created_at: string;
}

/**
 * Edge Function request body
 * action parametresi ile route edilir
 */
export interface EdgeFunctionBody {
  action: string;
  [key: string]: unknown;
}
