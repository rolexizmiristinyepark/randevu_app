// Staff Edge Function
// GAS kaynak: Staff.js (StaffService), Main.js (shift/link actions)
// Actions: Personel CRUD + Auth user yonetimi + Link + Shift

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { createSupabaseClient, createServiceClient, requireAdmin } from '../_shared/supabase-client.ts';
import { addAuditLog } from '../_shared/security.ts';
import type { EdgeFunctionBody } from '../_shared/types.ts';

// Profil kodlari (link olusturma icin)
const PROFILE_LABELS: Record<string, string> = {
  g: 'Genel', w: 'Walk-in', b: 'Mağaza',
  s: 'Bireysel', m: 'Yönetim', v: 'Özel Müşteri',
};

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body: EdgeFunctionBody = await req.json();
    const { action } = body;

    switch (action) {
      // Public
      case 'getStaff':
        return await handleGetStaff();

      // Admin
      case 'createStaff':
        return await handleCreateStaff(req, body);
      case 'updateStaffV3':
        return await handleUpdateStaffV3(req, body);
      case 'addStaff':
        return await handleAddStaff(req, body);
      case 'updateStaff':
        return await handleUpdateStaff(req, body);
      case 'toggleStaff':
        return await handleToggleStaff(req, body);
      case 'removeStaff':
        return await handleRemoveStaff(req, body);
      case 'getAllLinks':
        return await handleGetAllLinks(req);
      case 'regenerateLink':
        return await handleRegenerateLink(req, body);
      case 'saveShifts':
        return await handleSaveShifts(req, body);
      case 'getMonthShifts':
        return await handleGetMonthShifts(body);

      default:
        return errorResponse(`Bilinmeyen staff action: ${action}`);
    }
  } catch (err) {
    console.error('Staff error:', err);
    return errorResponse('Sunucuda bir hata oluştu', 500);
  }
});

/**
 * Personel listesi (public)
 * GAS: StaffService.getStaff
 */
async function handleGetStaff(): Promise<Response> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('staff')
    .select('id, gas_id, name, email, phone, role, is_admin, is_vip, active, permissions')
    .order('name');

  if (error) {
    console.error('getStaff error:', error);
    return jsonResponse({ success: true, data: [] });
  }

  return jsonResponse({ success: true, data: data || [] });
}

/**
 * Personel olusturma (v3 - session bazli admin)
 * GAS: StaffService.create + Supabase Auth user olusturma
 */
async function handleCreateStaff(req: Request, body: EdgeFunctionBody): Promise<Response> {
  const adminCheck = await requireAdmin(req);
  if (adminCheck) return adminCheck;

  const name = String(body.name || '').trim();
  const email = String(body.email || '').toLowerCase().trim();
  const phone = String(body.phone || '').trim();
  const role = String(body.role || 'sales');
  const isAdmin = body.isAdmin === true || body.isAdmin === 'true';

  if (!name) return errorResponse('İsim zorunludur');
  if (!email) return errorResponse('E-posta adresi zorunludur');

  const supabase = createServiceClient();

  // Email benzersizlik kontrolu
  const { data: existing } = await supabase
    .from('staff')
    .select('id')
    .eq('email', email)
    .single();

  if (existing) return errorResponse('Bu e-posta adresi zaten kullanılıyor');

  // Rastgele sifre uret
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let plainPassword = '';
  for (let i = 0; i < 8; i++) {
    plainPassword += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  // Supabase Auth user olustur
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: plainPassword,
    email_confirm: true,
  });

  if (authError || !authUser.user) {
    console.error('Auth user create error:', authError);
    return errorResponse('Kullanıcı oluşturulamadı: ' + (authError?.message || ''));
  }

  // gas_id olustur (8 karakter alfanumerik, GAS formatı ile uyumlu)
  const hexChars = '0123456789abcdefghkmnopqrstuvwxyz';
  let gasId = '';
  for (let i = 0; i < 8; i++) {
    gasId += hexChars.charAt(Math.floor(Math.random() * hexChars.length));
  }

  // Staff tablosuna ekle (trigger otomatik claim senkronize eder)
  const { data: staff, error: staffError } = await supabase
    .from('staff')
    .insert({
      auth_user_id: authUser.user.id,
      gas_id: gasId,
      name,
      email,
      phone,
      role,
      is_admin: isAdmin,
      active: true,
      permissions: {},
    })
    .select('id, gas_id')
    .single();

  if (staffError) {
    // Rollback: Auth user sil
    await supabase.auth.admin.deleteUser(authUser.user.id);
    return errorResponse('Personel kaydı oluşturulamadı: ' + staffError.message);
  }

  await addAuditLog('STAFF_CREATED', {
    staffId: staff?.id,
    name,
    email: email.substring(0, 3) + '***',
    role,
  });

  return jsonResponse({
    success: true,
    id: staff?.id,
    plainPassword, // Admin'e gosterilecek
  });
}

/**
 * Personel guncelleme (v3)
 * GAS: StaffService.update
 */
async function handleUpdateStaffV3(req: Request, body: EdgeFunctionBody): Promise<Response> {
  const adminCheck = await requireAdmin(req);
  if (adminCheck) return adminCheck;

  const id = Number(body.id);
  if (!id) return errorResponse('Personel ID zorunludur');

  const supabase = createServiceClient();

  // Mevcut kaydi al
  const { data: existing, error: findError } = await supabase
    .from('staff')
    .select('*')
    .eq('id', id)
    .single();

  if (findError || !existing) return errorResponse('Personel bulunamadı');

  // Guncelleme verisi olustur
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = String(body.name).trim();
  if (body.email !== undefined) updates.email = String(body.email).toLowerCase().trim();
  if (body.phone !== undefined) updates.phone = String(body.phone).trim();
  if (body.role !== undefined) updates.role = String(body.role);
  if (body.isAdmin !== undefined) updates.is_admin = body.isAdmin === true || body.isAdmin === 'true';
  if (body.active !== undefined) updates.active = body.active === true || body.active === 'true';

  // Email degistiyse benzersizlik kontrolu
  if (updates.email && updates.email !== existing.email) {
    const { data: emailCheck } = await supabase
      .from('staff')
      .select('id')
      .eq('email', updates.email)
      .neq('id', id)
      .single();
    if (emailCheck) return errorResponse('Bu e-posta adresi zaten kullanılıyor');

    // Auth user email guncelle
    if (existing.auth_user_id) {
      await supabase.auth.admin.updateUserById(existing.auth_user_id, {
        email: updates.email as string,
      });
    }
  }

  const { error } = await supabase
    .from('staff')
    .update(updates)
    .eq('id', id);

  if (error) return errorResponse('Güncelleme başarısız: ' + error.message);

  await addAuditLog('STAFF_UPDATED', { staffId: id, updates: Object.keys(updates) });

  return jsonResponse({ success: true, message: 'Personel güncellendi' });
}

/**
 * Legacy personel ekleme
 * GAS: StaffService.addStaff
 */
async function handleAddStaff(req: Request, body: EdgeFunctionBody): Promise<Response> {
  // addStaff = createStaff'in legacy hali
  return handleCreateStaff(req, body);
}

/**
 * Legacy personel guncelleme
 */
async function handleUpdateStaff(req: Request, body: EdgeFunctionBody): Promise<Response> {
  return handleUpdateStaffV3(req, body);
}

/**
 * Personel aktif/pasif toggle
 * GAS: StaffService.toggleStaff
 */
async function handleToggleStaff(req: Request, body: EdgeFunctionBody): Promise<Response> {
  const adminCheck = await requireAdmin(req);
  if (adminCheck) return adminCheck;

  const id = Number(body.id);
  if (!id) return errorResponse('Personel ID zorunludur');

  const supabase = createServiceClient();
  const { data: staff } = await supabase
    .from('staff')
    .select('id, active')
    .eq('id', id)
    .single();

  if (!staff) return errorResponse('Personel bulunamadı');

  const { error } = await supabase
    .from('staff')
    .update({ active: !staff.active })
    .eq('id', id);

  if (error) return errorResponse('Toggle başarısız: ' + error.message);

  return jsonResponse({ success: true, message: `Personel ${!staff.active ? 'aktif' : 'pasif'} yapıldı` });
}

/**
 * Personel silme
 * GAS: StaffService.removeStaff
 */
async function handleRemoveStaff(req: Request, body: EdgeFunctionBody): Promise<Response> {
  const adminCheck = await requireAdmin(req);
  if (adminCheck) return adminCheck;

  const id = Number(body.id);
  if (!id) return errorResponse('Personel ID zorunludur');

  const supabase = createServiceClient();

  // Auth user'i da sil
  const { data: staff } = await supabase
    .from('staff')
    .select('auth_user_id')
    .eq('id', id)
    .single();

  if (staff?.auth_user_id) {
    await supabase.auth.admin.deleteUser(staff.auth_user_id);
  }

  const { error } = await supabase
    .from('staff')
    .delete()
    .eq('id', id);

  if (error) return errorResponse('Silme başarısız: ' + error.message);

  await addAuditLog('STAFF_REMOVED', { staffId: id });

  return jsonResponse({ success: true, message: 'Personel silindi' });
}

/**
 * Tum profil linklerini getir
 * GAS: LinkAggregator.getAllLinks
 */
async function handleGetAllLinks(req: Request): Promise<Response> {
  const adminCheck = await requireAdmin(req);
  if (adminCheck) return adminCheck;

  const supabase = createServiceClient();
  const { data: allStaff } = await supabase
    .from('staff')
    .select('id, gas_id, name, active, is_vip')
    .eq('active', true)
    .order('name');

  const baseUrl = Deno.env.get('PUBLIC_BASE_URL') || '';
  const links: Record<string, unknown[]> = {};

  // Genel profil linkleri
  for (const [code, label] of Object.entries(PROFILE_LABELS)) {
    if (['g', 'w', 'b'].includes(code)) {
      // Staff gerektirmeyen linkler
      links[code] = [{
        code,
        label,
        url: `${baseUrl}#${code}`,
        type: 'public',
      }];
    } else if (code === 's') {
      // Personel bazli linkler (gas_id ile URL)
      links[code] = (allStaff || []).map((s) => ({
        code: `${code}/${s.gas_id || s.id}`,
        label: `${label} - ${s.name}`,
        url: `${baseUrl}#${code}/${s.gas_id || s.id}`,
        staffId: s.gas_id || String(s.id),
        staffName: s.name,
        type: 'staff',
      }));
    } else if (code === 'v') {
      // VIP linkler (gas_id ile URL)
      links[code] = (allStaff || []).filter((s) => s.is_vip).map((s) => ({
        code: `${code}/${s.gas_id || s.id}`,
        label: `${label} - ${s.name}`,
        url: `${baseUrl}#${code}/${s.gas_id || s.id}`,
        staffId: s.gas_id || String(s.id),
        staffName: s.name,
        type: 'vip',
      }));
    } else if (code === 'm') {
      // Yonetim linki
      links[code] = [{
        code,
        label,
        url: `${baseUrl}#${code}`,
        type: 'management',
      }];
    }
  }

  return jsonResponse({ success: true, data: links });
}

/**
 * Link yeniden olustur (placeholder - Supabase'de URL-based)
 */
async function handleRegenerateLink(req: Request, body: EdgeFunctionBody): Promise<Response> {
  const adminCheck = await requireAdmin(req);
  if (adminCheck) return adminCheck;

  // Supabase'de link regeneration gereksiz (hash-based URL'ler)
  return jsonResponse({
    success: true,
    message: 'Supabase yapısında link regeneration gerekmiyor',
  });
}

/**
 * Vardiya kaydetme
 * GAS: ShiftService.saveShifts
 */
async function handleSaveShifts(req: Request, body: EdgeFunctionBody): Promise<Response> {
  const adminCheck = await requireAdmin(req);
  if (adminCheck) return adminCheck;

  const shifts = body.shifts;
  if (!shifts || !Array.isArray(shifts)) {
    return errorResponse('Vardiya verisi zorunludur (array)');
  }

  const supabase = createServiceClient();

  // Mevcut vardiyalari sil ve yenilerini ekle (batch upsert)
  // Her shift: { date, staffId, shiftType }
  const records = shifts.map((s: Record<string, unknown>) => ({
    date: String(s.date),
    staff_id: Number(s.staffId),
    shift_type: String(s.shiftType || 'full'),
  }));

  // Once ilgili tarihlerdeki vardiyalari sil
  const dates = [...new Set(records.map((r) => r.date))];
  for (const date of dates) {
    await supabase.from('shifts').delete().eq('date', date);
  }

  // Yeni vardiyalari ekle
  if (records.length > 0) {
    const { error } = await supabase.from('shifts').insert(records);
    if (error) {
      console.error('saveShifts error:', error);
      return errorResponse('Vardiyalar kaydedilemedi: ' + error.message);
    }
  }

  return jsonResponse({ success: true, message: 'Vardiyalar kaydedildi' });
}

/**
 * Aylık vardiya verilerini getir
 * GAS: ShiftService.getMonthShifts
 * Format: { "2024-02-07": { "1": "morning", "2": "full" }, ... }
 */
async function handleGetMonthShifts(body: EdgeFunctionBody): Promise<Response> {
  const month = String(body.month || ''); // YYYY-MM
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return errorResponse('month parametresi gerekli (YYYY-MM)');
  }

  const supabase = createServiceClient();
  const startDate = `${month}-01`;
  // Ay sonu: bir sonraki ayın 1'i
  const [year, mon] = month.split('-').map(Number);
  const endDate = new Date(year, mon, 0).toISOString().split('T')[0]; // Son gün

  const { data, error } = await supabase
    .from('shifts')
    .select('date, staff_id, shift_type')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date');

  if (error) {
    console.error('getMonthShifts error:', error);
    return errorResponse('Vardiyalar yüklenemedi: ' + error.message);
  }

  // Group by date -> staffId -> shiftType
  const result: Record<string, Record<string, string>> = {};
  for (const row of (data || [])) {
    const dateStr = String(row.date);
    if (!result[dateStr]) result[dateStr] = {};
    result[dateStr][String(row.staff_id)] = String(row.shift_type);
  }

  return jsonResponse({ success: true, data: result });
}
