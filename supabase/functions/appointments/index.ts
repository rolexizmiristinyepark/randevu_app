// Appointments Edge Function
// GAS kaynak: Appointments.js (AppointmentService, AvailabilityService), Calendar.js (SlotService)
// Actions: CRUD + slot yonetimi + availability

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { createSupabaseClient, createServiceClient, requireAdmin } from '../_shared/supabase-client.ts';
import { verifyTurnstile, checkRateLimit, getClientIp, addAuditLog } from '../_shared/security.ts';
import { validateAppointmentInput } from '../_shared/validation.ts';
import { sendWhatsAppMessage, buildTemplateComponents, logMessage, buildEventDataFromAppointment } from '../_shared/whatsapp-sender.ts';
import { replaceMessageVariables, formatPhoneWithCountryCode } from '../_shared/variables.ts';
import { syncAppointmentToCalendar, updateCalendarEvent, deleteCalendarEvent } from '../_shared/google-calendar.ts';
import { sendGmail } from '../_shared/resend-sender.ts';
import type { EdgeFunctionBody } from '../_shared/types.ts';

// Profil shortcode donusumu (GAS: PROFILE_TO_CODE)
const PROFILE_TO_CODE: Record<string, string> = {
  genel: 'g', general: 'g', g: 'g',
  gunluk: 'w', 'walk-in': 'w', walkin: 'w', w: 'w',
  boutique: 'b', butik: 'b', b: 'b',
  yonetim: 'm', management: 'm', m: 'm',
  personel: 's', individual: 's', staff: 's', s: 's',
  vip: 'v', v: 'v',
};

function toProfileCode(profile: string): string {
  if (!profile) return 'g';
  return PROFILE_TO_CODE[String(profile).toLowerCase()] || profile;
}

// Slot universe: 11-20 arasi saatler (GAS: SLOT_UNIVERSE)
const SLOT_UNIVERSE = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

// Shift slot filtreleri (GAS: SHIFT_SLOT_FILTERS)
// Sabahçı: 10-19 çalışma, 11-18 slot | Akşamcı: 13-22 çalışma, 13-20 slot
const SHIFT_SLOT_FILTERS: Record<string, number[]> = {
  morning: [11, 12, 13, 14, 15, 16, 17, 18],
  evening: [13, 14, 15, 16, 17, 18, 19, 20],
  full: SLOT_UNIVERSE,
};

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body: EdgeFunctionBody = await req.json();
    const { action } = body;

    switch (action) {
      // Public actions
      case 'createAppointment':
        return await handleCreateAppointment(req, body);
      case 'getAppointments':
        return await handleGetAppointments(body);
      case 'getWeekAppointments':
        return await handleGetWeekAppointments(body);
      case 'getMonthAppointments':
        return await handleGetMonthAppointments(body);
      case 'getDayStatus':
        return await handleGetDayStatus(body);
      case 'getDailySlots':
        return await handleGetDailySlots(body);
      case 'getSlotAvailability':
        return await handleGetSlotAvailability(body);
      case 'checkTimeSlotAvailability':
        return await handleCheckTimeSlotAvailability(body);
      case 'getManagementSlotAvailability':
        return await handleGetManagementSlotAvailability(body);
      case 'getAvailableStaffForSlot':
        return await handleGetAvailableStaffForSlot(body);

      // Admin actions
      case 'deleteAppointment':
        return await handleDeleteAppointment(req, body);
      case 'updateAppointment':
        return await handleUpdateAppointment(req, body);
      case 'assignStaffToAppointment':
        return await handleAssignStaff(req, body);
      case 'createManualAppointment':
        return await handleCreateManualAppointment(req, body);

      default:
        return errorResponse(`Bilinmeyen appointments action: ${action}`);
    }
  } catch (err) {
    console.error('Appointments error:', err);
    return errorResponse('Sunucuda bir hata oluştu', 500);
  }
});

// ==================== PUBLIC ACTIONS ====================

/**
 * Randevu olusturma (public, Turnstile korumalı)
 * GAS: createAppointment + LockServiceWrapper.withLock
 * PostgreSQL: check_and_create_appointment() advisory lock ile
 */
async function handleCreateAppointment(req: Request, body: EdgeFunctionBody): Promise<Response> {
  // Turnstile dogrulama (remoteIp GÖNDERME — Edge Function IP ≠ client IP)
  const turnstileToken = String(body.turnstileToken || body.cfTurnstileResponse || '');
  console.log('Turnstile token length:', turnstileToken.length);
  const turnstile = await verifyTurnstile(turnstileToken);
  if (!turnstile.success) {
    console.error('Turnstile FAILED:', turnstile.error, 'token_len:', turnstileToken.length);
    return errorResponse('Bot doğrulaması başarısız: ' + (turnstile.error || '') + ' [token_len=' + turnstileToken.length + ']', 403);
  }

  // Rate limit
  const ip = getClientIp(req);
  const rateLimit = await checkRateLimit(`create_appointment_${ip}`, 10, 600);
  if (!rateLimit.allowed) {
    return errorResponse('Çok fazla istek. Lütfen biraz bekleyip tekrar deneyin.', 429);
  }

  // Input dogrulama
  const validation = validateAppointmentInput(body as Record<string, unknown>);
  if (!validation.valid || !validation.sanitized) {
    return errorResponse(validation.error || 'Geçersiz girdi');
  }

  const s = validation.sanitized;
  const supabase = createServiceClient();

  // Profile ayarlarini al
  const profile = toProfileCode(String(s.profile));
  const { data: profileSettings } = await supabase
    .from('profile_settings')
    .select('*')
    .eq('profile_code', profile)
    .single();

  const maxSlotAppointment = profileSettings?.max_slot_appointment ?? 1;
  const maxDailyDelivery = profileSettings?.max_daily_delivery ?? 3;
  const duration = Number(s.duration) || profileSettings?.duration || 60;

  // check_and_create_appointment DB fonksiyonu cagir (advisory lock ile)
  const { data, error } = await supabase.rpc('check_and_create_appointment', {
    p_customer_name: s.customerName,
    p_customer_phone: s.customerPhone,
    p_customer_email: s.customerEmail || '',
    p_customer_note: s.customerNote || '',
    p_date: s.date,
    p_start_time: s.time,
    p_duration: duration,
    p_shift_type: s.shiftType || 'full',
    p_appointment_type: s.appointmentType,
    p_profile: profile,
    p_staff_id: s.staffId || null,
    p_is_vip_link: s.isVipLink || false,
    p_assign_by_admin: s.assignByAdmin || false,
    p_kvkk_consent: s.kvkkConsent || false,
    p_max_slot_appointment: maxSlotAppointment,
    p_max_daily_delivery: maxDailyDelivery,
  });

  if (error) {
    console.error('check_and_create_appointment error:', error);
    // DB fonksiyonu hata mesajlarini RAISE ile dondurur
    const errorMsg = error.message || 'Randevu oluşturulamadı';
    await addAuditLog('APPOINTMENT_CREATE_FAILED', {
      error: errorMsg,
      customerPhone: String(s.customerPhone).substring(0, 4) + '***',
      date: s.date,
      time: s.time,
    }, 'system', ip);
    return errorResponse(errorMsg);
  }

  const result = data as { success?: boolean; id?: string; error?: string };
  if (!result?.success || !result?.id) {
    return errorResponse(result?.error || 'Randevu oluşturulamadı');
  }
  const appointmentId = result.id;

  await addAuditLog('APPOINTMENT_CREATED', {
    appointmentId,
    date: s.date,
    time: s.time,
    profile,
    appointmentType: s.appointmentType,
  }, 'system', ip);

  // Notification flow tetikle (WhatsApp + Email) ve Calendar sync
  // Paralel çalıştır ama response'tan ÖNCE tamamlanmasını bekle
  // (Gmail SMTP yavaş — fire-and-forget'te runtime kapanınca mail gitmiyordu)
  const [notifSettled, calendarSettled] = await Promise.allSettled([
    triggerAppointmentNotification(supabase, appointmentId, profile),
    syncAppointmentToCalendar(appointmentId).catch(err => {
      console.error('Calendar sync hatası:', err);
    }),
  ]);

  const notifDebug = notifSettled.status === 'fulfilled'
    ? notifSettled.value
    : { error: String((notifSettled as PromiseRejectedResult).reason) };

  return jsonResponse({
    success: true,
    appointmentId,
    message: 'Randevu başarıyla oluşturuldu',
    _debug: { notification: notifDebug },
  });
}

/**
 * Belirli tarihteki randevulari getir
 * GAS: AppointmentService.getAppointments
 */
async function handleGetAppointments(body: EdgeFunctionBody): Promise<Response> {
  const date = String(body.date || '');
  if (!date) return errorResponse('Tarih parametresi zorunludur');

  const supabase = createServiceClient();
  const countOnly = body.countOnly === true || body.countOnly === 'true';

  let query = supabase
    .from('appointments')
    .select(countOnly ? 'id' : '*')
    .eq('date', date)
    .neq('status', 'cancelled');

  if (body.appointmentType) {
    query = query.eq('appointment_type', body.appointmentType);
  }

  const { data, error } = await query;
  if (error) {
    console.error('getAppointments error:', error);
    return jsonResponse(countOnly ? { success: true, count: 0 } : { success: true, items: [] });
  }

  if (countOnly) {
    return jsonResponse({ success: true, count: data?.length || 0 });
  }

  return jsonResponse({ success: true, items: data || [] });
}

/**
 * Haftalik randevular
 * GAS: AppointmentService.getWeekAppointments
 */
async function handleGetWeekAppointments(body: EdgeFunctionBody): Promise<Response> {
  const startDate = String(body.startDate || '');
  const endDate = String(body.endDate || '');
  if (!startDate || !endDate) return errorResponse('startDate ve endDate zorunludur');

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate)
    .neq('status', 'cancelled')
    .order('date')
    .order('start_time');

  if (error) {
    console.error('getWeekAppointments error:', error);
    return jsonResponse({ success: true, items: [] });
  }

  return jsonResponse({ success: true, items: data || [] });
}

/**
 * Aylik randevular (tarihe gore gruplanmis)
 * GAS: AppointmentService.getMonthAppointments
 */
async function handleGetMonthAppointments(body: EdgeFunctionBody): Promise<Response> {
  const month = String(body.month || ''); // YYYY-MM
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return errorResponse('Geçersiz ay formatı (YYYY-MM bekleniyor)');
  }

  const [year, monthNum] = month.split('-');
  const startDate = `${year}-${monthNum}-01`;
  // Ayin son gununu bul
  const lastDay = new Date(Number(year), Number(monthNum), 0).getDate();
  const endDate = `${year}-${monthNum}-${String(lastDay).padStart(2, '0')}`;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate)
    .neq('status', 'cancelled')
    .order('date')
    .order('start_time');

  if (error) {
    console.error('getMonthAppointments error:', error);
    return jsonResponse({ success: true, data: {} });
  }

  // Tarihe gore grupla
  const grouped: Record<string, unknown[]> = {};
  for (const appt of data || []) {
    const d = appt.date;
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(appt);
  }

  return jsonResponse({ success: true, data: grouped });
}

/**
 * Gun durumu (saat bazli musaitlik)
 * GAS: AvailabilityService.getDayStatus + SlotService.getSlotStatusBatch
 * PostgreSQL: get_day_status() fonksiyonu
 */
async function handleGetDayStatus(body: EdgeFunctionBody): Promise<Response> {
  const date = String(body.date || '');
  if (!date) return errorResponse('Tarih parametresi zorunludur');

  const supabase = createServiceClient();
  const profile = toProfileCode(String(body.profil || body.profile || 'g'));

  // Profil ayarlarindan maxSlotAppointment al
  let maxSlotAppointment = Number(body.maxSlotAppointment) || 1;
  if (body.profil || body.profile) {
    const { data: ps } = await supabase
      .from('profile_settings')
      .select('max_slot_appointment, max_daily_delivery')
      .eq('profile_code', profile)
      .single();
    if (ps) {
      maxSlotAppointment = ps.max_slot_appointment || 1;
    }
  }

  // v3.9.20: Staff bazlı filtreleme desteği
  // staffId verilirse sadece o personelin randevularını say
  const staffId = body.staffId ? Number(body.staffId) : null;

  // Tek sorgu ile tüm confirmed randevuları al (optional staff filter)
  let appointmentQuery = supabase
    .from('appointments')
    .select('start_time, appointment_type')
    .eq('date', date)
    .eq('status', 'confirmed');

  if (staffId) {
    appointmentQuery = appointmentQuery.eq('staff_id', staffId);
  }

  const { data: appointments, error } = await appointmentQuery;

  if (error) {
    console.error('getDayStatus error:', error);
    return errorResponse('Sunucuda bir hata oluştu');
  }

  // Saat bazlı sayım
  const countByHour: Record<number, number> = {};
  let deliveryCount = 0;

  for (const apt of (appointments || [])) {
    // start_time: "HH:MM:SS" veya "HH:MM" formatı
    const timeParts = String(apt.start_time).split(':');
    const hour = Number(timeParts[0]);
    if (!isNaN(hour)) {
      countByHour[hour] = (countByHour[hour] || 0) + 1;
    }
    // Delivery/shipping sayımı (staff filter olmadan global count gerekli)
    if (['delivery', 'shipping'].includes(apt.appointment_type)) {
      deliveryCount++;
    }
  }

  // Staff filtre aktifse delivery count'u global olarak tekrar hesapla
  if (staffId) {
    const { count: globalDelivery } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('date', date)
      .neq('status', 'cancelled')
      .in('appointment_type', ['delivery', 'shipping']);
    deliveryCount = globalDelivery || 0;
  }

  // Müsait/dolu saatleri belirle (11-20 arası)
  const availableHours: number[] = [];
  const unavailableHours: number[] = [];

  for (let hour = 11; hour <= 20; hour++) {
    const count = countByHour[hour] || 0;
    if (maxSlotAppointment === 0 || count < maxSlotAppointment) {
      availableHours.push(hour);
    } else {
      unavailableHours.push(hour);
    }
  }

  const appointmentType = String(body.appointmentType || '');
  const isDeliveryType = ['delivery', 'shipping'].includes(appointmentType);
  const maxDelivery = 3; // Default, profil ayarindan alinabilir

  return jsonResponse({
    success: true,
    isDeliveryMaxed: isDeliveryType ? (deliveryCount || 0) >= maxDelivery : false,
    availableHours,
    unavailableHours,
    deliveryCount: deliveryCount || 0,
    maxSlotAppointment,
  });
}

/**
 * Gunluk slotlar
 * GAS: SlotService.getDailySlots
 */
async function handleGetDailySlots(body: EdgeFunctionBody): Promise<Response> {
  const date = String(body.date || '');
  const shiftType = String(body.shiftType || 'full');
  let slotGrid = Number(body.slotGrid) || 60;

  // linkType varsa profil ayarlarindan slotGrid al
  if (body.linkType) {
    const supabase = createServiceClient();
    const profile = toProfileCode(String(body.linkType));
    const { data: ps } = await supabase
      .from('profile_settings')
      .select('slot_grid')
      .eq('profile_code', profile)
      .single();
    if (ps) slotGrid = ps.slot_grid || 60;
  }

  const hours = SHIFT_SLOT_FILTERS[shiftType] || SHIFT_SLOT_FILTERS.full;
  const interval = slotGrid === 30 ? 30 : 60;
  const slots: Array<{ start: string; end: string; hour: number; time: string }> = [];

  for (const hour of hours) {
    const startStr = `${date}T${String(hour).padStart(2, '0')}:00:00`;
    const startDate = new Date(startStr);
    const endDate = new Date(startDate.getTime() + interval * 60000);

    slots.push({
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      hour,
      time: `${String(hour).padStart(2, '0')}:00`,
    });

    // Yarim saat slotlari
    if (interval === 30 && hour <= 20) {
      const halfStartStr = `${date}T${String(hour).padStart(2, '0')}:30:00`;
      const halfStart = new Date(halfStartStr);
      const halfEnd = new Date(halfStart.getTime() + interval * 60000);

      if (halfEnd.getHours() <= 21 && (halfEnd.getHours() < 21 || halfEnd.getMinutes() === 0)) {
        slots.push({
          start: halfStart.toISOString(),
          end: halfEnd.toISOString(),
          hour,
          time: `${String(hour).padStart(2, '0')}:30`,
        });
      }
    }
  }

  return jsonResponse({ success: true, slots });
}

/**
 * Slot availability (per-slot, count ile)
 * GAS: AvailabilityService.getSlotAvailability
 */
async function handleGetSlotAvailability(body: EdgeFunctionBody): Promise<Response> {
  const date = String(body.date || '');
  if (!date) return errorResponse('Tarih parametresi zorunludur');

  const slotGrid = Number(body.slotGrid) || 60;
  const slotLimit = Number(body.slotLimit) || 1;
  const appointmentDuration = Number(body.appointmentDuration) || 60;

  const supabase = createServiceClient();

  // Gundeki tum randevulari al
  const { data: appointments } = await supabase
    .from('appointments')
    .select('start_time, end_time')
    .eq('date', date)
    .neq('status', 'cancelled');

  const slots: Array<{ time: string; hour: number; available: boolean; count: number }> = [];

  for (let hour = 11; hour <= 20; hour++) {
    // Tam saat slotu
    const slotStartMin = hour * 60;
    const slotEndMin = slotStartMin + appointmentDuration;

    const count = countOverlapping(appointments || [], slotStartMin, slotEndMin);

    slots.push({
      time: `${hour}:00`,
      hour,
      available: slotLimit === 0 || count < slotLimit,
      count,
    });

    // Yarim saat slotu
    if (slotGrid === 30) {
      const halfStartMin = hour * 60 + 30;
      const halfEndMin = halfStartMin + appointmentDuration;

      if (halfEndMin <= 21 * 60) {
        const halfCount = countOverlapping(appointments || [], halfStartMin, halfEndMin);
        slots.push({
          time: `${hour}:30`,
          hour,
          available: slotLimit === 0 || halfCount < slotLimit,
          count: halfCount,
        });
      }
    }
  }

  return jsonResponse({ success: true, data: { slots } });
}

/**
 * Zaman dilimi musaitlik kontrolu
 * GAS: AvailabilityService.checkTimeSlotAvailability
 */
async function handleCheckTimeSlotAvailability(body: EdgeFunctionBody): Promise<Response> {
  const date = String(body.date || '');
  const staffId = body.staffId ? Number(body.staffId) : null;
  const shiftType = String(body.shiftType || 'full');
  const appointmentType = String(body.appointmentType || 'meeting');
  const interval = Number(body.interval) || 60;

  if (!date) return errorResponse('Tarih parametresi zorunludur');

  const supabase = createServiceClient();
  const hours = SHIFT_SLOT_FILTERS[shiftType] || SHIFT_SLOT_FILTERS.full;

  // Gundeki tum randevulari al
  const { data: appointments } = await supabase
    .from('appointments')
    .select('start_time, end_time, staff_id, appointment_type')
    .eq('date', date)
    .neq('status', 'cancelled');

  const slots: Array<{
    time: string;
    hour: number;
    available: boolean;
    reason?: string;
  }> = [];

  for (const hour of hours) {
    const slotStartMin = hour * 60;
    const slotEndMin = slotStartMin + interval;

    let available = true;
    let reason = '';

    // Slot cakisma kontrolu
    const overlapCount = countOverlapping(appointments || [], slotStartMin, slotEndMin);
    if (overlapCount > 0) {
      available = false;
      reason = 'Slot dolu';
    }

    // Personel cakisma kontrolu
    if (available && staffId) {
      const staffOverlap = (appointments || []).some((appt) => {
        if (appt.staff_id !== staffId) return false;
        const apptStartMin = timeToMinutes(appt.start_time);
        const apptEndMin = timeToMinutes(appt.end_time);
        return slotStartMin < apptEndMin && apptStartMin < slotEndMin;
      });
      if (staffOverlap) {
        available = false;
        reason = 'Personelin bu saatte randevusu var';
      }
    }

    slots.push({ time: `${String(hour).padStart(2, '0')}:00`, hour, available, ...(reason ? { reason } : {}) });
  }

  return jsonResponse({ success: true, data: { slots } });
}

/**
 * Yonetim linki slot musaitligi
 * GAS: AvailabilityService.getManagementSlots
 */
async function handleGetManagementSlotAvailability(body: EdgeFunctionBody): Promise<Response> {
  const date = String(body.date || '');
  if (!date) return errorResponse('Tarih parametresi zorunludur');

  const profile = toProfileCode(String(body.profil || body.profile || 'm'));
  const supabase = createServiceClient();

  // Profil ayarlari
  const { data: ps } = await supabase
    .from('profile_settings')
    .select('max_slot_appointment, slot_grid, duration')
    .eq('profile_code', profile)
    .single();

  const maxSlot = ps?.max_slot_appointment ?? 0; // 0 = sinirsiz
  const slotGrid = ps?.slot_grid ?? 60;
  const duration = ps?.duration ?? 60;

  // Gundeki randevular
  const { data: appointments } = await supabase
    .from('appointments')
    .select('start_time, end_time')
    .eq('date', date)
    .neq('status', 'cancelled');

  const slots: Array<{ time: string; hour: number; available: boolean; count: number }> = [];

  for (let hour = 11; hour <= 20; hour++) {
    const slotStartMin = hour * 60;
    const slotEndMin = slotStartMin + duration;
    const count = countOverlapping(appointments || [], slotStartMin, slotEndMin);

    slots.push({
      time: `${String(hour).padStart(2, '0')}:00`,
      hour,
      available: maxSlot === 0 || count < maxSlot,
      count,
    });

    if (slotGrid === 30) {
      const halfStartMin = hour * 60 + 30;
      const halfEndMin = halfStartMin + duration;
      if (halfEndMin <= 21 * 60) {
        const halfCount = countOverlapping(appointments || [], halfStartMin, halfEndMin);
        slots.push({
          time: `${String(hour).padStart(2, '0')}:30`,
          hour,
          available: maxSlot === 0 || halfCount < maxSlot,
          count: halfCount,
        });
      }
    }
  }

  return jsonResponse({ success: true, data: { slots } });
}

/**
 * Belirli slot icin musait personel
 * GAS: AvailabilityService.getAvailableStaffForSlot
 */
async function handleGetAvailableStaffForSlot(body: EdgeFunctionBody): Promise<Response> {
  const date = String(body.date || '');
  const time = String(body.time || '');
  if (!date || !time) return errorResponse('Tarih ve saat zorunludur');

  const supabase = createServiceClient();

  // Aktif personelleri al
  const { data: allStaff } = await supabase
    .from('staff')
    .select('id, name, role')
    .eq('active', true);

  // O gundeki vardiyalari al
  const { data: shifts } = await supabase
    .from('shifts')
    .select('staff_id, shift_type')
    .eq('date', date);

  // O gundeki randevulari al
  const { data: appointments } = await supabase
    .from('appointments')
    .select('staff_id, start_time, end_time')
    .eq('date', date)
    .neq('status', 'cancelled');

  const hour = parseInt(time.split(':')[0]);
  const minute = parseInt(time.split(':')[1] || '0');
  const slotStartMin = hour * 60 + minute;
  const slotEndMin = slotStartMin + 60; // Default 60dk

  const availableStaff = (allStaff || []).filter((staff) => {
    // Vardiya kontrolu
    const shift = (shifts || []).find((s) => s.staff_id === staff.id);
    if (shift) {
      const shiftHours = SHIFT_SLOT_FILTERS[shift.shift_type] || SHIFT_SLOT_FILTERS.full;
      if (!shiftHours.includes(hour)) return false;
    }

    // Randevu cakisma kontrolu
    const hasConflict = (appointments || []).some((appt) => {
      if (appt.staff_id !== staff.id) return false;
      const apptStartMin = timeToMinutes(appt.start_time);
      const apptEndMin = timeToMinutes(appt.end_time);
      return slotStartMin < apptEndMin && apptStartMin < slotEndMin;
    });

    return !hasConflict;
  });

  return jsonResponse({
    success: true,
    data: availableStaff.map((s) => ({ id: s.id, name: s.name, role: s.role })),
  });
}

// ==================== ADMIN ACTIONS ====================

/**
 * Randevu silme (admin)
 * GAS: AppointmentService.deleteAppointment
 */
async function handleDeleteAppointment(req: Request, body: EdgeFunctionBody): Promise<Response> {
  const adminCheck = await requireAdmin(req);
  if (adminCheck) return adminCheck;

  const appointmentId = String(body.eventId || body.appointmentId || body.id || '');
  if (!appointmentId) return errorResponse('Randevu ID zorunludur');

  const supabase = createServiceClient();

  // Randevuyu bul
  const { data: appointment, error: findError } = await supabase
    .from('appointments')
    .select('*')
    .eq('id', appointmentId)
    .single();

  if (findError || !appointment) {
    return errorResponse('Randevu bulunamadı');
  }

  // Randevuyu iptal et (soft delete)
  const { error } = await supabase
    .from('appointments')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', appointmentId);

  if (error) {
    return errorResponse('Randevu silinemedi: ' + error.message);
  }

  // Google Calendar'dan sil + iptal bildirimlerini tetikle
  await Promise.allSettled([
    deleteCalendarEvent(appointmentId).catch(err => console.error('Calendar delete hatası:', err)),
    triggerAppointmentNotification(supabase, appointmentId, appointment.profile || 'g', 'appointment_cancel'),
  ]);

  await addAuditLog('APPOINTMENT_DELETED', {
    appointmentId,
    customerName: appointment.customer_name,
    date: appointment.date,
  });

  return jsonResponse({ success: true, message: 'Randevu silindi' });
}

/**
 * Randevu guncelleme (admin)
 * GAS: AppointmentService.updateAppointment
 */
async function handleUpdateAppointment(req: Request, body: EdgeFunctionBody): Promise<Response> {
  const adminCheck = await requireAdmin(req);
  if (adminCheck) return adminCheck;

  const appointmentId = String(body.eventId || body.appointmentId || body.id || '');
  const newDate = String(body.newDate || '');
  const newTime = String(body.newTime || '');
  if (!appointmentId || !newDate || !newTime) {
    return errorResponse('Randevu ID, yeni tarih ve yeni saat zorunludur');
  }

  const supabase = createServiceClient();

  // Mevcut randevuyu bul
  const { data: appointment, error: findError } = await supabase
    .from('appointments')
    .select('*')
    .eq('id', appointmentId)
    .single();

  if (findError || !appointment) {
    return errorResponse('Randevu bulunamadı');
  }

  // Yonetim randevusu -> validation bypass
  if (appointment.appointment_type !== 'management') {
    // Slot cakisma kontrolu (kendisi haric)
    const { data: overlapping } = await supabase
      .from('appointments')
      .select('id')
      .eq('date', newDate)
      .neq('status', 'cancelled')
      .neq('id', appointmentId)
      .lte('start_time', `${newTime}:00`)
      .gt('end_time', `${newTime}:00`);

    if (overlapping && overlapping.length > 0) {
      return errorResponse('Bu saat dolu. Lütfen başka bir saat seçin.');
    }

    // Teslim randevusu gunluk limit kontrolu
    if (['delivery', 'shipping'].includes(appointment.appointment_type)) {
      const { count } = await supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('date', newDate)
        .neq('status', 'cancelled')
        .neq('id', appointmentId)
        .in('appointment_type', ['delivery', 'shipping']);

      const profile = toProfileCode(appointment.profile || 'g');
      const { data: ps } = await supabase
        .from('profile_settings')
        .select('max_daily_delivery')
        .eq('profile_code', profile)
        .single();

      const maxDelivery = ps?.max_daily_delivery ?? 3;
      if (maxDelivery > 0 && (count || 0) >= maxDelivery) {
        return errorResponse(`Bu gün için teslim randevuları dolu (maksimum ${maxDelivery}).`);
      }
    }
  }

  // Bitis saatini hesapla
  const [h, m] = newTime.split(':').map(Number);
  const startMinutes = h * 60 + m;
  const endMinutes = startMinutes + appointment.duration;
  const endH = Math.floor(endMinutes / 60);
  const endM = endMinutes % 60;
  const newEndTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

  const { error } = await supabase
    .from('appointments')
    .update({
      date: newDate,
      start_time: `${newTime}:00`,
      end_time: `${newEndTime}:00`,
    })
    .eq('id', appointmentId);

  if (error) {
    return errorResponse('Randevu güncellenemedi: ' + error.message);
  }

  // Google Calendar güncelle + bildirim tetikle
  await Promise.allSettled([
    updateCalendarEvent(appointmentId).catch(err => console.error('Calendar update hatası:', err)),
    triggerAppointmentNotification(supabase, appointmentId, appointment.profile || 'g', 'appointment_update'),
  ]);

  return jsonResponse({ success: true, message: 'Randevu başarıyla güncellendi' });
}

/**
 * Personel atama (admin)
 * GAS: AppointmentService.assignStaff
 */
async function handleAssignStaff(req: Request, body: EdgeFunctionBody): Promise<Response> {
  const adminCheck = await requireAdmin(req);
  if (adminCheck) return adminCheck;

  const appointmentId = String(body.eventId || body.appointmentId || '');
  const staffId = Number(body.staffId);
  if (!appointmentId || !staffId) {
    return errorResponse('Randevu ID ve personel ID zorunludur');
  }

  const supabase = createServiceClient();

  // Personeli bul
  const { data: staff } = await supabase
    .from('staff')
    .select('id, name, phone, email')
    .eq('id', staffId)
    .eq('active', true)
    .single();

  if (!staff) return errorResponse('Personel bulunamadı');

  // Randevuyu guncelle
  const { error } = await supabase
    .from('appointments')
    .update({ staff_id: staffId })
    .eq('id', appointmentId);

  if (error) {
    return errorResponse('Personel atanamadı: ' + error.message);
  }

  // Google Calendar güncelle + atama bildirimi tetikle
  const { data: updatedAppt } = await supabase.from('appointments').select('profile').eq('id', appointmentId).single();
  await Promise.allSettled([
    updateCalendarEvent(appointmentId).catch(err => console.error('Calendar update hatası (staff assign):', err)),
    triggerAppointmentNotification(supabase, appointmentId, updatedAppt?.profile || 'g', 'appointment_assign'),
  ]);

  await addAuditLog('STAFF_ASSIGNED', {
    appointmentId,
    staffId,
    staffName: staff.name,
  });

  return jsonResponse({
    success: true,
    message: `${staff.name} başarıyla atandı`,
    staffName: staff.name,
  });
}

/**
 * Manuel randevu olusturma (admin)
 * GAS: AppointmentService.createManual
 */
async function handleCreateManualAppointment(req: Request, body: EdgeFunctionBody): Promise<Response> {
  const adminCheck = await requireAdmin(req);
  if (adminCheck) return adminCheck;

  const date = String(body.date || '');
  const time = String(body.time || '');
  const staffId = Number(body.staffId);
  const customerName = String(body.customerName || '');

  if (!date || !time || !customerName || !staffId) {
    return errorResponse('Tarih, saat, müşteri adı ve personel zorunludur.');
  }

  const supabase = createServiceClient();

  const appointmentType = String(body.appointmentType || 'meeting');
  const duration = Number(body.duration) || 60;
  const profile = toProfileCode(String(body.profil || body.profile || 'g'));

  // Bitis saatini hesapla
  const [h, m] = time.split(':').map(Number);
  const endMinutes = h * 60 + m + duration;
  const endH = Math.floor(endMinutes / 60);
  const endM = endMinutes % 60;
  const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

  const { data, error } = await supabase
    .from('appointments')
    .insert({
      staff_id: staffId,
      customer_name: customerName,
      customer_phone: String(body.customerPhone || ''),
      customer_email: String(body.customerEmail || ''),
      customer_note: String(body.customerNote || ''),
      date,
      start_time: `${time}:00`,
      end_time: `${endTime}:00`,
      duration,
      shift_type: String(body.shiftType || 'full'),
      appointment_type: appointmentType,
      profile,
      is_vip_link: false,
      assign_by_admin: true,
      status: 'confirmed',
      kvkk_consent: true,
    })
    .select('id')
    .single();

  if (error) {
    return errorResponse('Manuel randevu oluşturulamadı: ' + error.message);
  }

  const appointmentId = data?.id;

  // Google Calendar'a ekle
  if (appointmentId) {
    await syncAppointmentToCalendar(appointmentId).catch(err => {
      console.error('Calendar sync hatası (manual):', err);
    });
  }

  return jsonResponse({
    success: true,
    appointmentId,
    message: 'Manuel randevu oluşturuldu.',
  });
}

// ==================== HELPER FUNCTIONS ====================

/**
 * TIME formatini (HH:MM:SS veya HH:MM) dakikaya cevir
 */
function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  return parseInt(parts[0]) * 60 + parseInt(parts[1] || '0');
}

/**
 * Belirli bir zaman araliginda cakisan randevu sayisini hesapla
 */
function countOverlapping(
  appointments: Array<{ start_time: string; end_time: string }>,
  slotStartMin: number,
  slotEndMin: number
): number {
  return appointments.filter((appt) => {
    const apptStartMin = timeToMinutes(appt.start_time);
    const apptEndMin = timeToMinutes(appt.end_time);
    // Cakisma: !(slotEnd <= apptStart || slotStart >= apptEnd)
    return slotStartMin < apptEndMin && apptStartMin < slotEndMin;
  }).length;
}

// ==================== NOTIFICATION TRIGGER ====================

/**
 * Randevu islemlerinde notification flow tetikle
 * notification_flows tablosundaki eslesen trigger'a gore flow'lari calistirir
 */
interface NotificationResult {
  whatsappSent: number;
  whatsappFailed: number;
  emailSent: number;
  emailFailed: number;
  errors: string[];
}

async function triggerAppointmentNotification(
  supabase: ReturnType<typeof createServiceClient>,
  appointmentId: string,
  profile: string,
  trigger: string = 'appointment_create'
): Promise<NotificationResult> {
  const notifResult: NotificationResult = { whatsappSent: 0, whatsappFailed: 0, emailSent: 0, emailFailed: 0, errors: [] };
  // Randevu detaylarını staff bilgisiyle çek
  const { data: appointment } = await supabase
    .from('appointments')
    .select('*, staff:staff_id(id, name, phone, email)')
    .eq('id', appointmentId)
    .single();

  if (!appointment) return notifResult;

  const staff = appointment.staff as Record<string, unknown> | null;
  const eventData = buildEventDataFromAppointment(appointment, staff);
  eventData.appointmentId = appointmentId;

  // Eşleşen aktif flow'ları bul
  const { data: flows } = await supabase
    .from('notification_flows')
    .select('*')
    .eq('active', true)
    .eq('trigger', trigger);

  if (!flows || flows.length === 0) return notifResult;

  // Profil eşleştir
  const matchingFlows = flows.filter((f: any) => {
    const profiles = f.profiles || [];
    return profiles.length === 0 || profiles.includes(profile) || profiles.includes('all');
  });

  for (const flow of matchingFlows) {
    // WhatsApp gönder
    if (flow.whatsapp_template_ids && flow.whatsapp_template_ids.length > 0) {
      for (const templateId of flow.whatsapp_template_ids) {
        const { data: template } = await supabase
          .from('whatsapp_templates')
          .select('*')
          .eq('id', templateId)
          .single();

        if (!template) continue;

        const targetType = template.target_type || 'customer';

        // Admin target: tüm admin personellere gönder
        if (targetType === 'admin' || (targetType === 'staff' && !eventData.staffPhone)) {
          // Staff atanmamış — admin'lere gönder
          const { data: admins } = await supabase
            .from('staff')
            .select('phone, name')
            .eq('is_admin', true)
            .eq('active', true);

          if (admins && admins.length > 0) {
            for (const admin of admins) {
              if (!admin.phone) continue;
              const components = buildTemplateComponents(template, eventData);
              const result = await sendWhatsAppMessage(
                admin.phone,
                template.meta_template_name || template.name,
                template.language || 'tr',
                components
              );
              const resolvedContent = replaceMessageVariables(template.content || '', eventData as Record<string, string>);
              await logMessage({
                appointment_id: appointmentId,
                phone: formatPhoneWithCountryCode(admin.phone),
                recipient_name: admin.name,
                template_name: template.meta_template_name || template.name,
                template_id: template.id,
                status: result.success ? 'sent' : 'failed',
                message_id: result.messageId || '',
                error_message: result.error || '',
                flow_id: flow.id,
                triggered_by: 'appointment_create',
                profile,
                message_content: resolvedContent,
                target_type: 'admin',
                customer_name: String(eventData.customerName || ''),
                customer_phone: formatPhoneWithCountryCode(String(eventData.customerPhone || '')),
              });
              console.log(`Admin notification ${result.success ? 'sent' : 'failed'}: ${admin.name}`);
            }
          }
          continue;
        }

        const phone = targetType === 'staff'
          ? String(eventData.staffPhone || '')
          : String(eventData.customerPhone || '');
        const recipientName = targetType === 'staff'
          ? String(eventData.staffName || '')
          : String(eventData.customerName || '');

        if (!phone) continue;

        const components = buildTemplateComponents(template, eventData);
        const result = await sendWhatsAppMessage(
          phone,
          template.meta_template_name || template.name,
          template.language || 'tr',
          components
        );

        const resolvedContent = replaceMessageVariables(template.content || '', eventData as Record<string, string>);
        await logMessage({
          appointment_id: appointmentId,
          phone: formatPhoneWithCountryCode(phone),
          recipient_name: recipientName,
          template_name: template.meta_template_name || template.name,
          template_id: template.id,
          status: result.success ? 'sent' : 'failed',
          message_id: result.messageId || '',
          error_message: result.error || '',
          staff_id: staff?.id ? Number(staff.id) : undefined,
          staff_name: String(eventData.staffName || ''),
          flow_id: flow.id,
          triggered_by: 'appointment_create',
          profile,
          message_content: resolvedContent,
          target_type: targetType,
          customer_name: String(eventData.customerName || ''),
          customer_phone: formatPhoneWithCountryCode(String(eventData.customerPhone || '')),
        });

        console.log(`Notification ${result.success ? 'sent' : 'failed'}: ${phone} (${template.name})`);
      }
    }

    // ==================== EMAIL ====================
    console.log(`[EMAIL] Flow "${flow.name}" mail_template_ids:`, flow.mail_template_ids);
    if (flow.mail_template_ids && flow.mail_template_ids.length > 0) {
      for (const templateId of flow.mail_template_ids) {
        const { data: template } = await supabase
          .from('mail_templates')
          .select('*')
          .eq('id', templateId)
          .single();

        if (!template) continue;

        const recipient = template.recipient || 'customer';

        // Admin: staff tablosundan tum admin emailleri al ve her birine gonder
        if (recipient === 'admin') {
          const { data: admins } = await supabase
            .from('staff')
            .select('email, name')
            .eq('is_admin', true)
            .eq('active', true);

          if (!admins || admins.length === 0) {
            console.log('[EMAIL] Admin email gonderilecek ama aktif admin bulunamadi');
            continue;
          }

          for (const admin of admins) {
            if (!admin.email) continue;

            const resolvedSubject = replaceMessageVariables(template.subject, eventData as Record<string, string>);
            let resolvedBody = replaceMessageVariables(template.body, eventData as Record<string, string>);

            if (template.info_card_id) {
              resolvedBody += await buildInfoCardHtml(supabase, template.info_card_id, eventData);
            }

            console.log(`[EMAIL] Admin gonderiliyor: to=${admin.email} (${admin.name}), template=${template.name}`);
            const emailResult = await sendGmail({
              to: admin.email,
              subject: resolvedSubject,
              html: resolvedBody,
            });

            if (emailResult.success) {
              notifResult.emailSent++;
              console.log(`[EMAIL] Admin basarili: ${admin.email} msgId=${emailResult.messageId}`);
            } else {
              notifResult.emailFailed++;
              notifResult.errors.push(`Email failed: ${admin.email} - ${emailResult.error}`);
              console.error(`[EMAIL] Admin HATA: ${admin.email} error=${emailResult.error}`);
            }
          }
          continue;
        }

        // Customer veya Staff
        let toEmail = '';
        if (recipient === 'staff') {
          toEmail = String(eventData.staffEmail || '');
        } else {
          toEmail = String(eventData.customerEmail || '');
        }

        if (!toEmail) continue;

        const resolvedSubject = replaceMessageVariables(template.subject, eventData as Record<string, string>);
        let resolvedBody = replaceMessageVariables(template.body, eventData as Record<string, string>);

        if (template.info_card_id) {
          resolvedBody += await buildInfoCardHtml(supabase, template.info_card_id, eventData);
        }

        console.log(`[EMAIL] Gönderiliyor: to=${toEmail}, template=${template.name}, recipient=${recipient}`);
        const emailResult = await sendGmail({
          to: toEmail,
          subject: resolvedSubject,
          html: resolvedBody,
        });

        if (emailResult.success) {
          notifResult.emailSent++;
          console.log(`[EMAIL] Başarılı: ${toEmail} (${template.name}) msgId=${emailResult.messageId}`);
        } else {
          notifResult.emailFailed++;
          notifResult.errors.push(`Email failed: ${toEmail} - ${emailResult.error}`);
          console.error(`[EMAIL] HATA: ${toEmail} (${template.name}) error=${emailResult.error}`);
        }
      }
    }
  }

  console.log(`[NOTIFICATION] Sonuç: wa=${notifResult.whatsappSent}/${notifResult.whatsappFailed}, email=${notifResult.emailSent}/${notifResult.emailFailed}`);
  return notifResult;
}

async function buildInfoCardHtml(
  supabase: ReturnType<typeof createServiceClient>,
  infoCardId: string,
  eventData: Record<string, unknown>
): Promise<string> {
  const { data: infoCard } = await supabase
    .from('mail_info_cards')
    .select('*')
    .eq('id', infoCardId)
    .single();

  if (!infoCard || !infoCard.fields) return '';

  const fields = infoCard.fields as Array<{ label: string; variable: string }>;
  let html = '<table style="border-left: 3px solid #006039; padding-left: 15px; margin: 20px 0;">';
  html += '<tr><td colspan="2" style="font-size: 16px; font-weight: 400; letter-spacing: 1px; color: #1a1a1a; padding-bottom: 15px;">RANDEVU BİLGİLERİ</td></tr>';
  for (const field of fields) {
    const value = replaceMessageVariables(`{{${field.variable}}}`, eventData as Record<string, string>);
    html += `<tr><td style="color: #666666; font-size: 14px; padding: 8px 15px 8px 0; width: 120px;">${field.label}</td><td style="color: #1a1a1a; font-size: 14px; padding: 8px 0;">${value}</td></tr>`;
  }
  html += '</table>';
  return html;
}
