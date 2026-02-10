// Supabase client factory
// Anon client (kullanici JWT ile) ve Service client (admin islemler)

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from './cors.ts';

/**
 * Kullanici bazli Supabase client (anon key + kullanici JWT)
 * RLS politikalari gecerlidir
 */
export function createSupabaseClient(req: Request): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const authHeader = req.headers.get('Authorization');

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
  });
}

/**
 * Service role Supabase client (RLS bypass)
 * Sadece guvenli Edge Function islemleri icin
 */
export function createServiceClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Request'ten JWT claims'leri cikart
 */
export function getJwtClaims(req: Request): { staffId?: number; isAdmin?: boolean; role?: string } | null {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  try {
    const token = authHeader.replace('Bearer ', '');
    const payload = JSON.parse(atob(token.split('.')[1]));
    const meta = payload.app_metadata || {};

    return {
      staffId: meta.staff_id,
      isAdmin: meta.is_admin === true,
      role: meta.role,
    };
  } catch {
    return null;
  }
}

/**
 * Admin yetkisi kontrol et
 * Yetki yoksa Response doner, varsa null
 */
export function requireAdmin(req: Request): Response | null {
  const claims = getJwtClaims(req);
  if (!claims?.isAdmin) {
    return new Response(
      JSON.stringify({ success: false, error: 'Yetkilendirme hatası. Admin yetkisi gerekli.' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  return null;
}
