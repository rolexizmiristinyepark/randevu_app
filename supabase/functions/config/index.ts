// Config Edge Function
// GAS kaynak: Config.js (ConfigService, ProfilAyarlariService), Main.js (healthCheck, test)
// Actions: getConfig, profil ayarlari CRUD, dataVersion, healthCheck

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { createServiceClient, requireAdmin } from '../_shared/supabase-client.ts';
import type { EdgeFunctionBody } from '../_shared/types.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body: EdgeFunctionBody = await req.json();
    const { action } = body;

    switch (action) {
      case 'test':
        return jsonResponse({ status: 'ok', message: 'Supabase Edge Functions çalışıyor!' });

      case 'healthCheck':
        return await handleHealthCheck();

      case 'getConfig':
        return await handleGetConfig();

      case 'getProfilAyarlari':
        return await handleGetProfilAyarlari(body);

      case 'getAllProfilAyarlari':
        return await handleGetAllProfilAyarlari();

      case 'updateProfilAyarlari':
        return await handleUpdateProfilAyarlari(req, body);

      case 'resetProfilAyarlari':
        return await handleResetProfilAyarlari(req);

      case 'getDataVersion':
        return await handleGetDataVersion();

      case 'getDebugLogs':
        return jsonResponse({ success: true, data: [] }); // Edge Functions'da server log yok

      default:
        return errorResponse(`Bilinmeyen config action: ${action}`);
    }
  } catch (err) {
    console.error('Config error:', err);
    return errorResponse('Sunucuda bir hata oluştu', 500);
  }
});

/**
 * Health check
 * GAS: healthCheck action
 */
async function handleHealthCheck(): Promise<Response> {
  const startTime = Date.now();
  const checks = { database: false, auth: false };

  try {
    const supabase = createServiceClient();

    // Database baglantisi
    const { error: dbError } = await supabase.from('settings').select('key').limit(1);
    checks.database = !dbError;

    // Auth servisi
    const { error: authError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
    checks.auth = !authError;
  } catch (err) {
    console.error('Health check error:', err);
  }

  const allHealthy = checks.database && checks.auth;
  const responseTime = Date.now() - startTime;

  return jsonResponse({
    success: true,
    status: allHealthy ? 'healthy' : 'degraded',
    checks,
    responseTime: responseTime + 'ms',
    timestamp: new Date().toISOString(),
    platform: 'supabase',
  });
}

/**
 * Genel konfigurasyonu getir
 * GAS: ConfigService.getConfig
 * Frontend'in ilk yuklemede ihtiyac duydugu tum ayarlar
 */
async function handleGetConfig(): Promise<Response> {
  const supabase = createServiceClient();

  // Settings tablosundan al
  const { data: settings } = await supabase
    .from('settings')
    .select('key, value');

  // Profil ayarlari
  const { data: profiles } = await supabase
    .from('profile_settings')
    .select('*');

  // Aktif personel
  const { data: staff } = await supabase
    .from('staff')
    .select('id, name, email, phone, role, is_admin, is_vip, active')
    .eq('active', true)
    .order('name');

  // Settings'i key-value map'e cevir
  const settingsMap: Record<string, unknown> = {};
  for (const s of settings || []) {
    settingsMap[s.key] = s.value;
  }

  // Profil ayarlarini map'e cevir
  const profilAyarlari: Record<string, unknown> = {};
  for (const p of profiles || []) {
    profilAyarlari[p.profile_code] = {
      profilKodu: p.profile_code,
      profilAdi: p.profile_name,
      idKontrolu: p.id_kontrolu,
      expectedRole: p.expected_role,
      sameDayBooking: p.same_day_booking,
      maxSlotAppointment: p.max_slot_appointment,
      slotGrid: p.slot_grid,
      maxDailyPerStaff: p.max_daily_per_staff,
      maxDailyDelivery: p.max_daily_delivery,
      duration: p.duration,
      assignByAdmin: p.assign_by_admin,
      allowedTypes: p.allowed_types,
      staffFilter: p.staff_filter,
      showCalendar: p.show_calendar,
      takvimFiltresi: p.takvim_filtresi,
      defaultType: p.default_type,
      showTypeSelection: p.show_type_selection,
      vardiyaKontrolu: p.vardiya_kontrolu,
    };
  }

  // Config objesi olustur (GAS ConfigService.getConfig formatinda)
  const config = {
    interval: settingsMap.interval ?? 60,
    maxDaily: settingsMap.maxDaily ?? 4,
    staffList: staff || [],
    profilAyarlari,
    companyName: 'Rolex İzmir İstinyepark',
    companyLocation: 'Rolex İzmir İstinyepark',
    slotUniverse: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    shiftHours: {
      morning: { start: '11:00', end: '18:00' },
      evening: { start: '14:00', end: '21:00' },
      full: { start: '11:00', end: '21:00' },
    },
    appointmentTypes: {
      delivery: 'Teslim',
      shipping: 'Gönderi',
      meeting: 'Görüşme',
      service: 'Teknik Servis',
      management: 'Yönetim',
    },
    timezone: 'Europe/Istanbul',
  };

  return jsonResponse({ success: true, data: config });
}

/**
 * Tek profil ayari getir
 * GAS: ProfilAyarlariService.get
 */
async function handleGetProfilAyarlari(body: EdgeFunctionBody): Promise<Response> {
  const profil = String(body.profil || 'g');
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('profile_settings')
    .select('*')
    .eq('profile_code', profil)
    .single();

  if (error || !data) {
    return jsonResponse({ success: true, data: null, profil });
  }

  return jsonResponse({
    success: true,
    data: mapProfileToFrontend(data),
    profil,
  });
}

/**
 * Tum profil ayarlari
 * GAS: ProfilAyarlariService.getAll
 */
async function handleGetAllProfilAyarlari(): Promise<Response> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('profile_settings')
    .select('*')
    .order('profile_code');

  if (error) {
    console.error('getAllProfilAyarlari error:', error);
    return jsonResponse({ success: true, data: {} });
  }

  const result: Record<string, unknown> = {};
  for (const p of data || []) {
    result[p.profile_code] = mapProfileToFrontend(p);
  }

  return jsonResponse({ success: true, data: result });
}

/**
 * Profil ayarlari guncelle (admin)
 * GAS: ProfilAyarlariService.update
 */
async function handleUpdateProfilAyarlari(req: Request, body: EdgeFunctionBody): Promise<Response> {
  const adminCheck = await requireAdmin(req);
  if (adminCheck) return adminCheck;

  const profil = String(body.profil || '');
  if (!profil) return errorResponse('Profil parametresi gerekli');

  const updates = (typeof body.updates === 'string' ? JSON.parse(body.updates as string) : body.updates) || {};

  const supabase = createServiceClient();

  // DB sutun adlarina cevir
  const dbUpdates: Record<string, unknown> = {};
  if (updates.sameDayBooking !== undefined) dbUpdates.same_day_booking = updates.sameDayBooking;
  if (updates.maxSlotAppointment !== undefined) dbUpdates.max_slot_appointment = Number(updates.maxSlotAppointment);
  if (updates.slotGrid !== undefined) dbUpdates.slot_grid = Number(updates.slotGrid);
  if (updates.maxDailyPerStaff !== undefined) dbUpdates.max_daily_per_staff = Number(updates.maxDailyPerStaff);
  if (updates.maxDailyDelivery !== undefined) dbUpdates.max_daily_delivery = Number(updates.maxDailyDelivery);
  if (updates.duration !== undefined) dbUpdates.duration = Number(updates.duration);
  if (updates.assignByAdmin !== undefined) dbUpdates.assign_by_admin = updates.assignByAdmin;
  if (updates.allowedTypes !== undefined) dbUpdates.allowed_types = updates.allowedTypes;
  if (updates.staffFilter !== undefined) dbUpdates.staff_filter = updates.staffFilter;
  if (updates.showCalendar !== undefined) dbUpdates.show_calendar = updates.showCalendar;
  if (updates.takvimFiltresi !== undefined) dbUpdates.takvim_filtresi = updates.takvimFiltresi;
  if (updates.defaultType !== undefined) dbUpdates.default_type = updates.defaultType;
  if (updates.showTypeSelection !== undefined) dbUpdates.show_type_selection = updates.showTypeSelection;
  if (updates.vardiyaKontrolu !== undefined) dbUpdates.vardiya_kontrolu = updates.vardiyaKontrolu;
  if (updates.idKontrolu !== undefined) dbUpdates.id_kontrolu = updates.idKontrolu;

  if (Object.keys(dbUpdates).length === 0) {
    return errorResponse('Güncellenecek alan bulunamadı');
  }

  const { error } = await supabase
    .from('profile_settings')
    .update(dbUpdates)
    .eq('profile_code', profil);

  if (error) return errorResponse('Güncelleme başarısız: ' + error.message);

  return jsonResponse({ success: true, message: 'Profil ayarları güncellendi' });
}

/**
 * Profil ayarlarini varsayilana sifirla (admin)
 * GAS: ProfilAyarlariService.reset
 */
async function handleResetProfilAyarlari(req: Request): Promise<Response> {
  const adminCheck = await requireAdmin(req);
  if (adminCheck) return adminCheck;

  // Seed data'daki varsayilan degerleri geri yukle
  // Bu islem icin 003_seed_data.sql'deki INSERT'leri tekrar calistirmak gerekir
  // Simdilik her profili varsayilana dondurelim
  const defaults: Record<string, Record<string, unknown>> = {
    g: { same_day_booking: false, max_slot_appointment: 1, slot_grid: 60, max_daily_per_staff: 4, max_daily_delivery: 3, duration: 60, assign_by_admin: false, staff_filter: 'role', show_calendar: true, default_type: 'meeting', show_type_selection: true, vardiya_kontrolu: true },
    w: { same_day_booking: true, max_slot_appointment: 2, slot_grid: 30, max_daily_per_staff: 6, max_daily_delivery: 0, duration: 30, assign_by_admin: true, staff_filter: 'none', show_calendar: false, default_type: 'meeting', show_type_selection: false, vardiya_kontrolu: false },
    b: { same_day_booking: false, max_slot_appointment: 1, slot_grid: 60, max_daily_per_staff: 4, max_daily_delivery: 3, duration: 60, assign_by_admin: false, staff_filter: 'role', show_calendar: true, default_type: 'meeting', show_type_selection: true, vardiya_kontrolu: true },
    s: { same_day_booking: false, max_slot_appointment: 1, slot_grid: 60, max_daily_per_staff: 4, max_daily_delivery: 3, duration: 60, assign_by_admin: false, staff_filter: 'linked', show_calendar: true, default_type: 'meeting', show_type_selection: true, vardiya_kontrolu: true },
    m: { same_day_booking: true, max_slot_appointment: 0, slot_grid: 30, max_daily_per_staff: 10, max_daily_delivery: 0, duration: 30, assign_by_admin: true, staff_filter: 'all', show_calendar: true, default_type: 'management', show_type_selection: true, vardiya_kontrolu: false },
    v: { same_day_booking: false, max_slot_appointment: 1, slot_grid: 60, max_daily_per_staff: 4, max_daily_delivery: 3, duration: 60, assign_by_admin: false, staff_filter: 'linked', show_calendar: true, default_type: 'meeting', show_type_selection: true, vardiya_kontrolu: true },
  };

  const supabase = createServiceClient();
  for (const [code, values] of Object.entries(defaults)) {
    await supabase.from('profile_settings').update(values).eq('profile_code', code);
  }

  return jsonResponse({ success: true, message: 'Profil ayarları varsayılana sıfırlandı' });
}

/**
 * Data version (cache invalidation icin)
 * GAS: VersionService.getDataVersion
 */
async function handleGetDataVersion(): Promise<Response> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'dataVersion')
    .single();

  return jsonResponse({
    success: true,
    data: String(data?.value ?? '0'),
  });
}

// ==================== HELPER ====================

// deno-lint-ignore no-explicit-any
function mapProfileToFrontend(p: any): Record<string, unknown> {
  return {
    profilKodu: p.profile_code,
    profilAdi: p.profile_name,
    idKontrolu: p.id_kontrolu,
    expectedRole: p.expected_role,
    sameDayBooking: p.same_day_booking,
    maxSlotAppointment: p.max_slot_appointment,
    slotGrid: p.slot_grid,
    maxDailyPerStaff: p.max_daily_per_staff,
    maxDailyDelivery: p.max_daily_delivery,
    duration: p.duration,
    assignByAdmin: p.assign_by_admin,
    allowedTypes: p.allowed_types,
    staffFilter: p.staff_filter,
    showCalendar: p.show_calendar,
    takvimFiltresi: p.takvim_filtresi,
    defaultType: p.default_type,
    showTypeSelection: p.show_type_selection,
    vardiyaKontrolu: p.vardiya_kontrolu,
  };
}
