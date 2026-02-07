// Slack Edge Function
// GAS kaynak: Slack.js (SlackService)
// Actions: updateSlackSettings, getSlackSettings, sendDailySlackReminders

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { createServiceClient, requireAdmin } from '../_shared/supabase-client.ts';
import { addAuditLog } from '../_shared/security.ts';
import { formatTurkishDate } from '../_shared/variables.ts';
import type { EdgeFunctionBody } from '../_shared/types.ts';

// Randevu turu emoji ve etiketleri
const TYPE_EMOJI: Record<string, string> = {
  delivery: '📦', service: '🔧', meeting: '💼', management: '👔', shipping: '📦',
};

const TYPE_LABELS: Record<string, string> = {
  delivery: 'Teslim', service: 'Teknik Servis', meeting: 'Görüşme',
  management: 'Yönetim', shipping: 'Gönderi',
};

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body: EdgeFunctionBody = await req.json();
    const { action } = body;

    switch (action) {
      case 'updateSlackSettings':
        return await handleUpdateSettings(req, body);
      case 'getSlackSettings':
        return await handleGetSettings(req);
      case 'sendDailySlackReminders':
        return await handleSendReminders(req, body);
      default:
        return errorResponse(`Bilinmeyen slack action: ${action}`);
    }
  } catch (err) {
    console.error('Slack error:', err);
    return errorResponse('Sunucuda bir hata oluştu', 500);
  }
});

/**
 * Slack webhook URL ayarla (admin)
 * GAS: SlackService.updateSlackSettings
 */
async function handleUpdateSettings(req: Request, body: EdgeFunctionBody): Promise<Response> {
  const adminCheck = await requireAdmin(req);
  if (adminCheck) return adminCheck;

  const webhookUrl = String(body.webhookUrl || '');
  if (!webhookUrl || !webhookUrl.startsWith('https://hooks.slack.com/')) {
    return errorResponse('Geçerli bir Slack Webhook URL gerekli');
  }

  const supabase = createServiceClient();
  await supabase.from('settings').upsert(
    { key: 'slack_webhook_url', value: webhookUrl },
    { onConflict: 'key' }
  );

  await addAuditLog('SLACK_SETTINGS_UPDATED', { configured: true });

  return jsonResponse({ success: true, message: 'Slack ayarları güncellendi' });
}

/**
 * Slack ayarlari durumu (admin)
 * GAS: SlackService.getSlackSettings
 */
async function handleGetSettings(req: Request): Promise<Response> {
  const adminCheck = await requireAdmin(req);
  if (adminCheck) return adminCheck;

  const supabase = createServiceClient();
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'slack_webhook_url')
    .single();

  return jsonResponse({
    success: true,
    configured: !!data?.value,
  });
}

/**
 * Gunluk Slack hatirlatma gonderi
 * GAS: SlackService.sendDailySlackReminders
 */
async function handleSendReminders(req: Request, body: EdgeFunctionBody): Promise<Response> {
  const adminCheck = await requireAdmin(req);
  if (adminCheck) return adminCheck;

  const supabase = createServiceClient();

  // Webhook URL'sini al
  const { data: setting } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'slack_webhook_url')
    .single();

  const webhookUrl = setting?.value as string;
  if (!webhookUrl) {
    return errorResponse('Slack webhook URL yapılandırılmamış');
  }

  // Bugunun tarihini hesapla
  const today = body.date
    ? String(body.date)
    : new Date().toISOString().split('T')[0];
  const formattedDate = formatTurkishDate(today);

  // Bugunku randevulari al
  const { data: appointments } = await supabase
    .from('appointments')
    .select('*, staff:staff_id(name)')
    .eq('date', today)
    .neq('status', 'cancelled')
    .order('start_time');

  const appts = appointments || [];

  // Slack Block Kit mesaji olustur
  const blocks = buildSlackBlocks(appts, formattedDate);

  // Slack'e gonder
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks }),
    });

    if (response.ok) {
      return jsonResponse({
        success: true,
        appointmentCount: appts.length,
        date: today,
      });
    }

    const errorText = await response.text();
    return errorResponse(`Slack webhook hatası: ${response.status} - ${errorText}`);
  } catch (err) {
    return errorResponse('Slack gönderim hatası: ' + String(err));
  }
}

/**
 * Slack Block Kit mesaj formatlama
 * GAS: SlackService.formatSlackMessage
 */
// deno-lint-ignore no-explicit-any
function buildSlackBlocks(appointments: any[], dateFormatted: string): unknown[] {
  const blocks: unknown[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '📅 BUGÜNÜN RANDEVULARI', emoji: true },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*${dateFormatted}*\n_Rolex İzmir İstinyepark_` },
    },
    { type: 'divider' },
  ];

  if (appointments.length === 0) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: '📭 _Bugün için randevu bulunmuyor._' },
    });
    return blocks;
  }

  // Randevulari saate gore sirala ve listele
  for (const appt of appointments) {
    const emoji = TYPE_EMOJI[appt.appointment_type] || '📌';
    const typeName = TYPE_LABELS[appt.appointment_type] || appt.appointment_type;
    const staffName = appt.staff?.name || 'Atanacak';
    const time = appt.start_time ? appt.start_time.substring(0, 5) : '';

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${emoji} *${time}* - ${appt.customer_name}\n_${typeName}_ | İlgili: ${staffName}`,
      },
    });
  }

  blocks.push(
    { type: 'divider' },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `Toplam: *${appointments.length} randevu* | _Otomatik bildirim_` },
      ],
    }
  );

  return blocks;
}
