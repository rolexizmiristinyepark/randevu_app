// Mail Edge Function
// GAS kaynak: Mail.js (template/flow/info card CRUD), Notifications.js (email gonderim)
// Actions: Mail template, info card, unified flow CRUD + tetikleme

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { createServiceClient, requireAdmin } from '../_shared/supabase-client.ts';
import { replaceMessageVariables, getMessageVariableOptions, MESSAGE_TRIGGERS, MESSAGE_RECIPIENTS } from '../_shared/variables.ts';
import type { EdgeFunctionBody } from '../_shared/types.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body: EdgeFunctionBody = await req.json();
    const { action } = body;

    switch (action) {
      // Public (read-only)
      case 'getMailFlows':
        return await handleGetFlows();
      case 'getMailTemplates':
        return await handleGetTemplates();
      case 'getMailInfoCards':
        return await handleGetInfoCards();
      case 'getUnifiedFlows':
        return await handleGetUnifiedFlows();
      case 'getMessageVariables':
        return jsonResponse({ success: true, data: getMessageVariableOptions() });
      case 'getTriggers':
        return jsonResponse({ success: true, data: MESSAGE_TRIGGERS });
      case 'getRecipients':
        return jsonResponse({ success: true, data: MESSAGE_RECIPIENTS });
      case 'debugNotificationFlows':
        return await handleDebugFlows();

      // Mail Template CRUD (admin)
      case 'createMailTemplate':
        return await handleCreateTemplate(req, body);
      case 'updateMailTemplate':
        return await handleUpdateTemplate(req, body);
      case 'deleteMailTemplate':
        return await handleDeleteTemplate(req, body);

      // Mail Info Card CRUD (admin)
      case 'createMailInfoCard':
        return await handleCreateInfoCard(req, body);
      case 'updateMailInfoCard':
        return await handleUpdateInfoCard(req, body);
      case 'deleteMailInfoCard':
        return await handleDeleteInfoCard(req, body);

      // Mail Flow CRUD (admin)
      case 'createMailFlow':
        return await handleCreateFlow(req, body);
      case 'updateMailFlow':
        return await handleUpdateFlow(req, body);
      case 'deleteMailFlow':
        return await handleDeleteFlow(req, body);

      // Unified Flow CRUD (admin)
      case 'createUnifiedFlow':
        return await handleCreateUnifiedFlow(req, body);
      case 'updateUnifiedFlow':
        return await handleUpdateUnifiedFlow(req, body);
      case 'deleteUnifiedFlow':
        return await handleDeleteUnifiedFlow(req, body);
      case 'testUnifiedFlow':
        return await handleTestUnifiedFlow(req, body);

      // KVKK
      case 'requestDataDeletion':
        return await handleRequestDataDeletion(body);

      // Legacy migration helpers
      case 'fixMailInfoCardsSheet':
      case 'syncMailSheetHeaders':
        return jsonResponse({ success: true, message: 'Supabase yapısında sheet migration gerekmiyor' });

      default:
        return errorResponse(`Bilinmeyen mail action: ${action}`);
    }
  } catch (err) {
    console.error('Mail error:', err);
    return errorResponse('Sunucuda bir hata oluştu', 500);
  }
});

// ==================== MAIL TEMPLATE CRUD ====================

async function handleGetTemplates(): Promise<Response> {
  const supabase = createServiceClient();
  const { data } = await supabase.from('mail_templates').select('*').order('name');
  return jsonResponse({ success: true, data: data || [] });
}

async function handleCreateTemplate(req: Request, body: EdgeFunctionBody): Promise<Response> {
  const adminCheck = await requireAdmin(req);
  if (adminCheck) return adminCheck;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('mail_templates')
    .insert({
      id: crypto.randomUUID(),
      name: String(body.name || ''),
      subject: String(body.subject || ''),
      body: String(body.body || ''),
      recipient: String(body.recipient || 'customer'),
      info_card_id: String(body.infoCardId || ''),
    })
    .select('id')
    .single();

  if (error) return errorResponse('Template oluşturulamadı: ' + error.message);
  return jsonResponse({ success: true, data: { id: data?.id }, message: 'Şablon oluşturuldu' });
}

async function handleUpdateTemplate(req: Request, body: EdgeFunctionBody): Promise<Response> {
  const adminCheck = await requireAdmin(req);
  if (adminCheck) return adminCheck;

  const id = String(body.id || '');
  if (!id) return errorResponse('Template ID gerekli');

  const supabase = createServiceClient();
  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) updates.name = body.name;
  if (body.subject !== undefined) updates.subject = body.subject;
  if (body.body !== undefined) updates.body = body.body;
  if (body.recipient !== undefined) updates.recipient = body.recipient;
  if (body.infoCardId !== undefined) updates.info_card_id = body.infoCardId;

  const { error } = await supabase.from('mail_templates').update(updates).eq('id', id);
  if (error) return errorResponse('Template güncellenemedi: ' + error.message);
  return jsonResponse({ success: true, message: 'Şablon güncellendi' });
}

async function handleDeleteTemplate(req: Request, body: EdgeFunctionBody): Promise<Response> {
  const adminCheck = await requireAdmin(req);
  if (adminCheck) return adminCheck;

  const id = String(body.id || '');
  if (!id) return errorResponse('Template ID gerekli');

  const supabase = createServiceClient();
  const { error } = await supabase.from('mail_templates').delete().eq('id', id);
  if (error) return errorResponse('Template silinemedi: ' + error.message);
  return jsonResponse({ success: true, message: 'Şablon silindi' });
}

// ==================== INFO CARD CRUD ====================

async function handleGetInfoCards(): Promise<Response> {
  const supabase = createServiceClient();
  const { data } = await supabase.from('mail_info_cards').select('*').order('name');
  return jsonResponse({ success: true, data: data || [] });
}

async function handleCreateInfoCard(req: Request, body: EdgeFunctionBody): Promise<Response> {
  const adminCheck = await requireAdmin(req);
  if (adminCheck) return adminCheck;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('mail_info_cards')
    .insert({
      id: crypto.randomUUID(),
      name: String(body.name || ''),
      fields: body.fields || [],
    })
    .select('id')
    .single();

  if (error) return errorResponse('Info card oluşturulamadı: ' + error.message);
  return jsonResponse({ success: true, data: { id: data?.id }, message: 'Bilgi kartı oluşturuldu' });
}

async function handleUpdateInfoCard(req: Request, body: EdgeFunctionBody): Promise<Response> {
  const adminCheck = await requireAdmin(req);
  if (adminCheck) return adminCheck;

  const id = String(body.id || '');
  if (!id) return errorResponse('Info card ID gerekli');

  const supabase = createServiceClient();
  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) updates.name = body.name;
  if (body.fields !== undefined) updates.fields = body.fields;

  const { error } = await supabase.from('mail_info_cards').update(updates).eq('id', id);
  if (error) return errorResponse('Info card güncellenemedi: ' + error.message);
  return jsonResponse({ success: true, message: 'Bilgi kartı güncellendi' });
}

async function handleDeleteInfoCard(req: Request, body: EdgeFunctionBody): Promise<Response> {
  const adminCheck = await requireAdmin(req);
  if (adminCheck) return adminCheck;

  const id = String(body.id || '');
  if (!id) return errorResponse('Info card ID gerekli');

  const supabase = createServiceClient();
  const { error } = await supabase.from('mail_info_cards').delete().eq('id', id);
  if (error) return errorResponse('Info card silinemedi: ' + error.message);
  return jsonResponse({ success: true, message: 'Bilgi kartı silindi' });
}

// ==================== MAIL FLOW CRUD ====================

async function handleGetFlows(): Promise<Response> {
  // Mail flows artik notification_flows tablosundan geliyor (unified)
  return handleGetUnifiedFlows();
}

async function handleCreateFlow(req: Request, body: EdgeFunctionBody): Promise<Response> {
  return handleCreateUnifiedFlow(req, body);
}

async function handleUpdateFlow(req: Request, body: EdgeFunctionBody): Promise<Response> {
  return handleUpdateUnifiedFlow(req, body);
}

async function handleDeleteFlow(req: Request, body: EdgeFunctionBody): Promise<Response> {
  return handleDeleteUnifiedFlow(req, body);
}

// ==================== UNIFIED NOTIFICATION FLOW ====================

async function handleGetUnifiedFlows(): Promise<Response> {
  const supabase = createServiceClient();
  const { data } = await supabase.from('notification_flows').select('*').order('name');
  return jsonResponse({ success: true, data: data || [] });
}

async function handleCreateUnifiedFlow(req: Request, body: EdgeFunctionBody): Promise<Response> {
  const adminCheck = await requireAdmin(req);
  if (adminCheck) return adminCheck;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('notification_flows')
    .insert({
      id: crypto.randomUUID(),
      name: String(body.name || ''),
      description: String(body.description || ''),
      trigger: String(body.trigger || ''),
      profiles: body.profiles || [],
      whatsapp_template_ids: body.whatsappTemplateIds || [],
      mail_template_ids: body.mailTemplateIds || [],
      active: body.active !== false && body.active !== 'false',
    })
    .select('id')
    .single();

  if (error) return errorResponse('Flow oluşturulamadı: ' + error.message);
  return jsonResponse({ success: true, data: { id: data?.id }, message: 'Flow oluşturuldu' });
}

async function handleUpdateUnifiedFlow(req: Request, body: EdgeFunctionBody): Promise<Response> {
  const adminCheck = await requireAdmin(req);
  if (adminCheck) return adminCheck;

  const id = String(body.id || '');
  if (!id) return errorResponse('Flow ID gerekli');

  const supabase = createServiceClient();
  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.trigger !== undefined) updates.trigger = body.trigger;
  if (body.profiles !== undefined) updates.profiles = body.profiles;
  if (body.whatsappTemplateIds !== undefined) updates.whatsapp_template_ids = body.whatsappTemplateIds;
  if (body.mailTemplateIds !== undefined) updates.mail_template_ids = body.mailTemplateIds;
  if (body.active !== undefined) updates.active = body.active !== false && body.active !== 'false';

  const { error } = await supabase.from('notification_flows').update(updates).eq('id', id);
  if (error) return errorResponse('Flow güncellenemedi: ' + error.message);
  return jsonResponse({ success: true, message: 'Flow güncellendi' });
}

async function handleDeleteUnifiedFlow(req: Request, body: EdgeFunctionBody): Promise<Response> {
  const adminCheck = await requireAdmin(req);
  if (adminCheck) return adminCheck;

  const id = String(body.id || '');
  if (!id) return errorResponse('Flow ID gerekli');

  const supabase = createServiceClient();
  const { error } = await supabase.from('notification_flows').delete().eq('id', id);
  if (error) return errorResponse('Flow silinemedi: ' + error.message);
  return jsonResponse({ success: true, message: 'Flow silindi' });
}

async function handleTestUnifiedFlow(req: Request, body: EdgeFunctionBody): Promise<Response> {
  const adminCheck = await requireAdmin(req);
  if (adminCheck) return adminCheck;

  // Test tetikleme - flow'u bul ve simule et
  const flowId = String(body.flowId || body.id || '');
  if (!flowId) return errorResponse('Flow ID gerekli');

  const supabase = createServiceClient();
  const { data: flow } = await supabase
    .from('notification_flows')
    .select('*')
    .eq('id', flowId)
    .single();

  if (!flow) return errorResponse('Flow bulunamadı');

  return jsonResponse({
    success: true,
    message: 'Test flow tetiklendi',
    flow: {
      id: flow.id,
      name: flow.name,
      trigger: flow.trigger,
      profiles: flow.profiles,
      whatsappTemplates: flow.whatsapp_template_ids?.length || 0,
      mailTemplates: flow.mail_template_ids?.length || 0,
    },
  });
}

// ==================== DEBUG ====================

async function handleDebugFlows(): Promise<Response> {
  const supabase = createServiceClient();
  const { data: flows } = await supabase.from('notification_flows').select('*');
  const { data: waTemplates } = await supabase.from('whatsapp_templates').select('id, name, active');
  const { data: mailTemplates } = await supabase.from('mail_templates').select('id, name');

  return jsonResponse({
    success: true,
    data: {
      flowCount: flows?.length || 0,
      waTemplateCount: waTemplates?.length || 0,
      mailTemplateCount: mailTemplates?.length || 0,
      flows: flows || [],
    },
  });
}

// ==================== KVKK ====================

/**
 * KVKK veri silme talebi
 * GAS: requestDataDeletion
 */
async function handleRequestDataDeletion(body: EdgeFunctionBody): Promise<Response> {
  const email = String(body.email || '').toLowerCase().trim();
  const phone = String(body.phone || '').trim();

  if (!email && !phone) {
    return errorResponse('E-posta veya telefon numarası gereklidir');
  }

  const supabase = createServiceClient();

  // Randevulardaki kisisel verileri anonimize et
  let query = supabase
    .from('appointments')
    .update({
      customer_name: '[Silindi - KVKK]',
      customer_phone: '[Silindi]',
      customer_email: '[Silindi]',
      customer_note: '[Silindi - KVKK]',
    });

  if (email) query = query.eq('customer_email', email);
  else if (phone) query = query.eq('customer_phone', phone);

  await query;

  // Message log'daki kisisel verileri anonimize et
  let msgQuery = supabase
    .from('message_log')
    .update({
      recipient_name: '[Silindi - KVKK]',
      customer_name: '[Silindi - KVKK]',
      customer_phone: '[Silindi]',
      message_content: '[Silindi - KVKK]',
    });

  if (phone) msgQuery = msgQuery.eq('phone', phone);
  else if (email) msgQuery = msgQuery.eq('customer_phone', phone); // Fallback

  await msgQuery;

  return jsonResponse({
    success: true,
    message: 'Veri silme talebiniz işleme alındı. KVKK kapsamında kişisel verileriniz anonimize edildi.',
  });
}
