// Auth Edge Function
// GAS kaynak: Auth.js (SessionAuthService, BruteForceProtection)
// Actions: login, logout, resetPassword, changePassword, validateSession

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { createSupabaseClient, createServiceClient } from '../_shared/supabase-client.ts';
import { checkRateLimit, getClientIp, addAuditLog } from '../_shared/security.ts';
import type { EdgeFunctionBody } from '../_shared/types.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body: EdgeFunctionBody = await req.json();
    const { action } = body;

    switch (action) {
      case 'login':
        return await handleLogin(req, body);
      case 'logout':
        return await handleLogout(req);
      case 'resetPassword':
        return await handleResetPassword(body);
      case 'changePassword':
        return await handleChangePassword(req, body);
      case 'validateSession':
        return await handleValidateSession(req);
      case 'regenerateApiKey':
        // Legacy - Supabase'de API key yok, no-op
        return jsonResponse({ success: true, message: 'Supabase Auth kullanılıyor, API key gerekmiyor' });
      default:
        return errorResponse(`Bilinmeyen auth action: ${action}`);
    }
  } catch (err) {
    console.error('Auth error:', err);
    return errorResponse('Sunucuda bir hata oluştu', 500);
  }
});

/**
 * Login - Email + sifre ile giris
 * GAS: SessionAuthService.login + BruteForceProtection
 */
async function handleLogin(req: Request, body: EdgeFunctionBody): Promise<Response> {
  const email = String(body.email || '').toLowerCase().trim();
  const password = String(body.password || '');

  if (!email || !password) {
    return errorResponse('E-posta ve şifre zorunludur');
  }

  // Rate limit kontrolu (brute force korumasi)
  const ip = getClientIp(req);
  const rateLimit = await checkRateLimit(`login_${email}`, 5, 300);
  if (!rateLimit.allowed) {
    return errorResponse('Çok fazla başarısız deneme. 5 dakika sonra tekrar deneyin.', 429);
  }

  const supabase = createServiceClient();

  // Supabase Auth ile giris
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    await addAuditLog('LOGIN_FAILED', { email, ip }, 'system', ip);
    return errorResponse('E-posta veya şifre hatalı');
  }

  // Staff bilgilerini al
  const { data: staff } = await supabase
    .from('staff')
    .select('id, name, email, role, is_admin, active, permissions')
    .eq('auth_user_id', data.user.id)
    .single();

  if (!staff || !staff.active) {
    return errorResponse('Hesabınız aktif değil');
  }

  await addAuditLog('LOGIN_SUCCESS', { staffId: staff.id, email }, String(staff.id), ip);

  return jsonResponse({
    success: true,
    token: data.session?.access_token,
    refreshToken: data.session?.refresh_token,
    user: {
      id: staff.id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
      isAdmin: staff.is_admin,
      permissions: staff.permissions || {},
    },
  });
}

/**
 * Logout
 * GAS: SessionAuthService.logout
 */
async function handleLogout(req: Request): Promise<Response> {
  const supabase = createSupabaseClient(req);

  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Logout error:', error);
  }

  return jsonResponse({ success: true, message: 'Çıkış yapıldı' });
}

/**
 * Sifre sifirlama emaili gonder
 * GAS: SessionAuthService.resetPassword
 */
async function handleResetPassword(body: EdgeFunctionBody): Promise<Response> {
  const email = String(body.email || '').toLowerCase().trim();
  if (!email) {
    return errorResponse('E-posta adresi zorunludur');
  }

  const supabase = createServiceClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) {
    console.error('Reset password error:', error);
  }

  // Guvenlik: Her durumda basarili mesaji dondur (email enumeration engelleme)
  return jsonResponse({
    success: true,
    message: 'Şifre sıfırlama bağlantısı e-posta adresinize gönderildi',
  });
}

/**
 * Sifre degistirme (authenticated)
 * GAS: SessionAuthService.changePassword
 */
async function handleChangePassword(req: Request, body: EdgeFunctionBody): Promise<Response> {
  const newPassword = String(body.newPassword || '');
  if (!newPassword || newPassword.length < 6) {
    return errorResponse('Yeni şifre en az 6 karakter olmalıdır');
  }

  const supabase = createSupabaseClient(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return errorResponse('Oturum geçersiz', 401);
  }

  const serviceClient = createServiceClient();
  const { error } = await serviceClient.auth.admin.updateUserById(user.id, {
    password: newPassword,
  });

  if (error) {
    return errorResponse('Şifre değiştirilemedi: ' + error.message);
  }

  await addAuditLog('PASSWORD_CHANGED', { userId: user.id }, user.id);

  return jsonResponse({ success: true, message: 'Şifre başarıyla değiştirildi' });
}

/**
 * Session dogrulama
 * GAS: SessionAuthService.validateSession
 */
async function handleValidateSession(req: Request): Promise<Response> {
  const supabase = createSupabaseClient(req);
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return jsonResponse({ success: false, valid: false });
  }

  const serviceClient = createServiceClient();
  const { data: staff } = await serviceClient
    .from('staff')
    .select('id, name, email, role, is_admin, active, permissions')
    .eq('auth_user_id', user.id)
    .single();

  if (!staff || !staff.active) {
    return jsonResponse({ success: false, valid: false });
  }

  return jsonResponse({
    success: true,
    valid: true,
    user: {
      id: staff.id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
      isAdmin: staff.is_admin,
      permissions: staff.permissions || {},
    },
  });
}
