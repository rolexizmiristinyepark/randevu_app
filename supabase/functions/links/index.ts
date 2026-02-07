// Links Edge Function
// GAS kaynak: Main.js (UrlResolver, LegacyResolver)
// Actions: resolveUrl, resolveId

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { createServiceClient } from '../_shared/supabase-client.ts';
import type { EdgeFunctionBody } from '../_shared/types.ts';

// Profil tanimlari
const PROFILES: Record<string, { name: string; type: string }> = {
  g: { name: 'Genel', type: 'public' },
  w: { name: 'Walk-in', type: 'public' },
  b: { name: 'Mağaza', type: 'public' },
  s: { name: 'Bireysel', type: 'staff' },
  m: { name: 'Yönetim', type: 'management' },
  v: { name: 'Özel Müşteri', type: 'vip' },
};

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body: EdgeFunctionBody = await req.json();
    const { action } = body;

    switch (action) {
      case 'resolveUrl':
        return await handleResolveUrl(body);
      case 'resolveId':
        return await handleResolveId(body);
      default:
        return errorResponse(`Bilinmeyen links action: ${action}`);
    }
  } catch (err) {
    console.error('Links error:', err);
    return errorResponse('Sunucuda bir hata oluştu', 500);
  }
});

/**
 * URL hash cozumleme
 * GAS: UrlResolver.resolve
 * Hash formati: #g, #w, #b, #m, #s/{staffId}, #v/{staffId}
 */
async function handleResolveUrl(body: EdgeFunctionBody): Promise<Response> {
  const hash = String(body.hash || '').replace('#', '').trim();
  if (!hash) return errorResponse('Hash parametresi zorunludur');

  // Hash'i parse et
  const parts = hash.split('/');
  const profileCode = parts[0].toLowerCase();
  const staffId = parts.length > 1 ? Number(parts[1]) : null;

  // Profil dogrulama
  const profile = PROFILES[profileCode];
  if (!profile) {
    return errorResponse('Geçersiz profil kodu: ' + profileCode);
  }

  const supabase = createServiceClient();
  const result: Record<string, unknown> = {
    success: true,
    profil: profileCode,
    profilAdi: profile.name,
    type: profile.type,
  };

  // Staff gerektiren profiller (s, v)
  if (['s', 'v'].includes(profileCode) && staffId) {
    const { data: staff } = await supabase
      .from('staff')
      .select('id, name, email, phone, role, is_admin, is_vip, active')
      .eq('id', staffId)
      .eq('active', true)
      .single();

    if (!staff) {
      return errorResponse('Personel bulunamadı veya aktif değil');
    }

    // VIP link icin is_vip kontrolu
    if (profileCode === 'v' && !staff.is_vip) {
      return errorResponse('Bu personelin VIP linki bulunmuyor');
    }

    result.staff = {
      id: staff.id,
      name: staff.name,
      role: staff.role,
    };
    result.linkedStaffId = staff.id;
    result.linkedStaffName = staff.name;
  }

  // Profil ayarlarini al
  const { data: profileSettings } = await supabase
    .from('profile_settings')
    .select('*')
    .eq('profile_code', profileCode)
    .single();

  if (profileSettings) {
    result.profilAyarlari = {
      profilKodu: profileSettings.profile_code,
      profilAdi: profileSettings.profile_name,
      idKontrolu: profileSettings.id_kontrolu,
      expectedRole: profileSettings.expected_role,
      sameDayBooking: profileSettings.same_day_booking,
      maxSlotAppointment: profileSettings.max_slot_appointment,
      slotGrid: profileSettings.slot_grid,
      maxDailyPerStaff: profileSettings.max_daily_per_staff,
      maxDailyDelivery: profileSettings.max_daily_delivery,
      duration: profileSettings.duration,
      assignByAdmin: profileSettings.assign_by_admin,
      allowedTypes: profileSettings.allowed_types,
      staffFilter: profileSettings.staff_filter,
      showCalendar: profileSettings.show_calendar,
      takvimFiltresi: profileSettings.takvim_filtresi,
      defaultType: profileSettings.default_type,
      showTypeSelection: profileSettings.show_type_selection,
      vardiyaKontrolu: profileSettings.vardiya_kontrolu,
    };
  }

  return jsonResponse(result);
}

/**
 * Legacy ID cozumleme
 * GAS: LegacyResolver.resolve
 */
async function handleResolveId(body: EdgeFunctionBody): Promise<Response> {
  const id = String(body.id || '');
  if (!id) return errorResponse('ID parametresi zorunludur');

  const supabase = createServiceClient();

  // ID'nin bir staff ID'si olup olmadigini kontrol et
  const { data: staff } = await supabase
    .from('staff')
    .select('id, name, active')
    .eq('id', Number(id) || 0)
    .single();

  if (staff && staff.active) {
    return jsonResponse({
      success: true,
      type: 'staff',
      profil: 's',
      linkedStaffId: staff.id,
      linkedStaffName: staff.name,
    });
  }

  // Bulunamadiysa genel profil olarak dondur
  return jsonResponse({
    success: true,
    type: 'public',
    profil: 'g',
    message: 'ID çözümlenemedi, genel profil kullanılıyor',
  });
}
