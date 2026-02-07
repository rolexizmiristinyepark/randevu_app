// Settings Edge Function
// GAS kaynak: Settings.js (SettingsService)
// Actions: getSettings, saveSettings, resetData, backup

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { createServiceClient, requireAdmin } from '../_shared/supabase-client.ts';
import { addAuditLog } from '../_shared/security.ts';
import type { EdgeFunctionBody } from '../_shared/types.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body: EdgeFunctionBody = await req.json();
    const { action } = body;

    switch (action) {
      case 'getSettings':
        return await handleGetSettings();
      case 'saveSettings':
        return await handleSaveSettings(req, body);
      case 'resetData':
        return await handleResetData(req);
      case 'createBackup':
        return await handleCreateBackup(req);
      case 'listBackups':
        return await handleListBackups(req);
      case 'restoreBackup':
        return await handleRestoreBackup(req, body);
      default:
        return errorResponse(`Bilinmeyen settings action: ${action}`);
    }
  } catch (err) {
    console.error('Settings error:', err);
    return errorResponse('Sunucuda bir hata oluştu', 500);
  }
});

/**
 * Ayarlari getir (public)
 * GAS: SettingsService.getSettings
 */
async function handleGetSettings(): Promise<Response> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('settings')
    .select('key, value');

  if (error) {
    console.error('getSettings error:', error);
    return jsonResponse({ success: true, data: {} });
  }

  // Key-value map olustur
  const settings: Record<string, unknown> = {};
  for (const s of data || []) {
    settings[s.key] = s.value;
  }

  return jsonResponse({ success: true, data: settings });
}

/**
 * Ayarlari kaydet (admin)
 * GAS: SettingsService.saveSettings
 */
async function handleSaveSettings(req: Request, body: EdgeFunctionBody): Promise<Response> {
  const adminCheck = await requireAdmin(req);
  if (adminCheck) return adminCheck;

  const supabase = createServiceClient();

  // Body'deki action disindaki tum key'leri kaydet
  const settingsToSave: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (key === 'action') continue;
    settingsToSave[key] = value;
  }

  // Upsert ile kaydet
  const upserts = Object.entries(settingsToSave).map(([key, value]) => ({
    key,
    value,
  }));

  if (upserts.length > 0) {
    const { error } = await supabase
      .from('settings')
      .upsert(upserts, { onConflict: 'key' });

    if (error) {
      return errorResponse('Ayarlar kaydedilemedi: ' + error.message);
    }
  }

  // Data version artir (cache invalidation)
  await supabase.rpc('increment_setting', { p_key: 'dataVersion' }).catch(() => {
    // increment_setting yoksa manual arttir
    supabase
      .from('settings')
      .upsert({ key: 'dataVersion', value: Date.now() }, { onConflict: 'key' });
  });

  await addAuditLog('SETTINGS_UPDATED', { keys: Object.keys(settingsToSave) });

  return jsonResponse({ success: true, message: 'Ayarlar kaydedildi' });
}

/**
 * Verileri sifirla (admin - dikkatli kullan)
 * GAS: StorageService.resetData
 */
async function handleResetData(req: Request): Promise<Response> {
  const adminCheck = await requireAdmin(req);
  if (adminCheck) return adminCheck;

  // Supabase'de resetData tehlikeli - sadece audit log kaydi birak
  await addAuditLog('RESET_DATA_REQUESTED', { warning: 'Bu islem Supabase panel uzerinden yapilmalidir' });

  return jsonResponse({
    success: true,
    message: 'Veri sıfırlama Supabase Dashboard üzerinden yapılmalıdır.',
  });
}

/**
 * Backup olustur (admin)
 * GAS: BackupService.createBackup
 */
async function handleCreateBackup(req: Request): Promise<Response> {
  const adminCheck = await requireAdmin(req);
  if (adminCheck) return adminCheck;

  // Supabase otomatik backup yapar, manuel backup gereksiz
  return jsonResponse({
    success: true,
    message: 'Supabase otomatik yedekleme kullanılıyor. Dashboard > Database > Backups',
    backupId: `auto_${new Date().toISOString()}`,
  });
}

/**
 * Backup listele (admin)
 */
async function handleListBackups(req: Request): Promise<Response> {
  const adminCheck = await requireAdmin(req);
  if (adminCheck) return adminCheck;

  return jsonResponse({
    success: true,
    data: [],
    message: 'Supabase Dashboard > Database > Backups bölümünden yedekler görüntülenebilir.',
  });
}

/**
 * Backup geri yukle (admin)
 */
async function handleRestoreBackup(req: Request, body: EdgeFunctionBody): Promise<Response> {
  const adminCheck = await requireAdmin(req);
  if (adminCheck) return adminCheck;

  return jsonResponse({
    success: false,
    message: 'Yedek geri yükleme Supabase Dashboard üzerinden yapılmalıdır.',
  });
}
