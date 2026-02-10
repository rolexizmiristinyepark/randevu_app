// Notifications Edge Function
// GAS kaynak: Notifications.js (email HTML + ICS olusturma)
// Actions: Email gonderim, ICS olusturma, notification flow tetikleme

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { createServiceClient } from '../_shared/supabase-client.ts';
import { replaceMessageVariables, formatTurkishDate, formatPhoneWithCountryCode } from '../_shared/variables.ts';
import { sendWhatsAppMessage, buildTemplateComponents, logMessage } from '../_shared/whatsapp-sender.ts';
import { escapeHtml } from '../_shared/validation.ts';
import { sendGmail } from '../_shared/resend-sender.ts';
import type { EdgeFunctionBody } from '../_shared/types.ts';

// Randevu turu etiketleri
const APPOINTMENT_TYPE_LABELS: Record<string, string> = {
  delivery: 'Teslim', shipping: 'Gönderi', meeting: 'Görüşme',
  service: 'Teknik Servis', management: 'Yönetim',
};

const ICS_TYPE_NAMES: Record<string, string> = {
  delivery: 'Teslim Randevusu', service: 'Servis Randevusu',
  meeting: 'Görüşme Randevusu', management: 'Yönetim Randevusu',
  shipping: 'Gönderi Randevusu',
};

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body: EdgeFunctionBody = await req.json();
    const { action } = body;

    switch (action) {
      case 'sendEmail':
        return await handleSendEmail(body);
      case 'generateICS':
        return await handleGenerateICS(body);
      case 'triggerNotificationFlow':
        return await handleTriggerFlow(body);
      default:
        return errorResponse(`Bilinmeyen notifications action: ${action}`);
    }
  } catch (err) {
    console.error('Notifications error:', err);
    return errorResponse('Sunucuda bir hata oluştu: ' + String(err), 500);
  }
});

/**
 * Email gonderimi (Resend API ile)
 * GAS: MailApp.sendEmail
 */
async function handleSendEmail(body: EdgeFunctionBody): Promise<Response> {
  const to = String(body.to || '');
  const subject = String(body.subject || '');
  const html = String(body.html || body.body || '');

  if (!to || !subject) {
    return errorResponse('Alıcı ve konu zorunludur');
  }

  const result = await sendGmail({ to, subject, html });

  if (result.success) {
    return jsonResponse({ success: true, messageId: result.messageId });
  }

  return errorResponse('Email gönderilemedi: ' + (result.error || 'Bilinmeyen hata'));
}

/**
 * ICS takvim dosyasi olusturma
 * GAS: generateCustomerICS
 */
async function handleGenerateICS(body: EdgeFunctionBody): Promise<Response> {
  const staffName = String(body.staffName || '');
  const staffPhone = String(body.staffPhone || '');
  const staffEmail = String(body.staffEmail || '');
  const date = String(body.date || '');
  const time = String(body.time || '');
  const duration = Number(body.duration) || 60;
  const appointmentType = String(body.appointmentType || 'meeting');
  const customerNote = String(body.customerNote || '');

  if (!date || !time) return errorResponse('Tarih ve saat zorunludur');

  // Baslangic ve bitis zamanlari
  const startDateTime = new Date(`${date}T${time}:00`);
  const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 1000);

  const typeName = ICS_TYPE_NAMES[appointmentType] || appointmentType;
  const summary = `Rolex İzmir İstinyepark - ${staffName} / ${typeName}`;
  const formattedDate = formatTurkishDate(date);

  // ICS description
  let description = `RANDEVU BİLGİLERİ\\n\\n`;
  description += `İlgili: ${staffName}\\n`;
  description += `Tel: ${staffPhone ? '+' + staffPhone : 'Belirtilmedi'}\\n`;
  description += `E-posta: ${staffEmail || 'Belirtilmedi'}\\n`;
  description += `Tarih: ${formattedDate}\\n`;
  description += `Saat: ${time}\\n`;
  description += `Konu: ${typeName}\\n`;
  if (customerNote) description += `Ek Bilgi: ${customerNote}\\n`;

  // ICS format
  const formatICSDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const uid = `${crypto.randomUUID()}@rolex-izmir.com`;

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Rolex İzmir İstinyepark//Randevu Sistemi//TR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE',
    'TZID:Europe/Istanbul',
    'BEGIN:STANDARD',
    'DTSTART:19701025T040000',
    'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
    'TZOFFSETFROM:+0300',
    'TZOFFSETTO:+0300',
    'TZNAME:TRT',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatICSDate(new Date())}`,
    `DTSTART;TZID=Europe/Istanbul:${formatICSDate(startDateTime)}`,
    `DTEND;TZID=Europe/Istanbul:${formatICSDate(endDateTime)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:Rolex İzmir İstinyepark`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Randevunuza 1 saat kaldı',
    'END:VALARM',
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Randevunuza 15 dakika kaldı',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  return jsonResponse({ success: true, ics, filename: `randevu_${date}_${time.replace(':', '')}.ics` });
}

/**
 * Notification flow tetikleme
 * GAS: triggerFlowForEvent + sendMailByTrigger
 * Bir trigger (appointment_create, appointment_cancel, vb.) icin
 * eslesen flow'lari bul ve WhatsApp + Email gonder
 */
async function handleTriggerFlow(body: EdgeFunctionBody): Promise<Response> {
  const trigger = String(body.trigger || '');
  const profile = String(body.profile || 'g');
  const eventData = (body.eventData as Record<string, unknown>) || {};

  if (!trigger) return errorResponse('Trigger parametresi zorunludur');

  const supabase = createServiceClient();

  // Eslesen aktif flow'lari bul
  const { data: flows } = await supabase
    .from('notification_flows')
    .select('*')
    .eq('active', true)
    .eq('trigger', trigger);

  if (!flows || flows.length === 0) {
    return jsonResponse({ success: true, message: 'Eşleşen flow bulunamadı', triggeredCount: 0 });
  }

  // Profile eslestir
  const matchingFlows = flows.filter((f) => {
    const profiles = f.profiles || [];
    return profiles.length === 0 || profiles.includes(profile) || profiles.includes('all');
  });

  let whatsappSent = 0;
  let whatsappFailed = 0;
  let emailSent = 0;
  let emailFailed = 0;

  // Her eslesen flow icin mesaj gonder
  for (const flow of matchingFlows) {
    // ==================== WHATSAPP ====================
    if (flow.whatsapp_template_ids && flow.whatsapp_template_ids.length > 0) {
      for (const templateId of flow.whatsapp_template_ids) {
        const { data: template } = await supabase
          .from('whatsapp_templates')
          .select('*')
          .eq('id', templateId)
          .single();

        if (!template) continue;

        // Alici belirle: template.target_type = 'customer' | 'staff' | 'admin'
        const targetType = template.target_type || 'customer';

        // Admin: tum admin personellerine gonder
        if (targetType === 'admin') {
          const { data: adminStaffs } = await supabase
            .from('staff')
            .select('name, phone')
            .eq('role', 'admin')
            .eq('active', true);

          for (const admin of (adminStaffs || [])) {
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
              appointment_id: eventData.appointmentId ? String(eventData.appointmentId) : undefined,
              phone: formatPhoneWithCountryCode(admin.phone),
              recipient_name: admin.name,
              template_name: template.meta_template_name || template.name,
              template_id: template.id,
              status: result.success ? 'sent' : 'failed',
              message_id: result.messageId || '',
              error_message: result.error || '',
              staff_id: eventData.staffId ? Number(eventData.staffId) : undefined,
              staff_name: String(eventData.staffName || ''),
              flow_id: flow.id,
              triggered_by: trigger,
              profile: profile,
              message_content: resolvedContent,
              target_type: targetType,
              customer_name: String(eventData.customerName || ''),
              customer_phone: formatPhoneWithCountryCode(String(eventData.customerPhone || '')),
            });
            if (result.success) whatsappSent++;
            else whatsappFailed++;
          }
          continue;
        }

        let phone = '';
        let recipientName = '';

        if (targetType === 'staff') {
          phone = String(eventData.staffPhone || '');
          recipientName = String(eventData.staffName || '');
        } else {
          phone = String(eventData.customerPhone || '');
          recipientName = String(eventData.customerName || '');
        }

        if (!phone) continue;

        // Template components olustur
        const components = buildTemplateComponents(template, eventData);

        // Mesaj gonder
        const result = await sendWhatsAppMessage(
          phone,
          template.meta_template_name || template.name,
          template.language || 'tr',
          components
        );

        // Mesaj logla
        const resolvedContent = replaceMessageVariables(template.content || '', eventData as Record<string, string>);
        await logMessage({
          appointment_id: eventData.appointmentId ? String(eventData.appointmentId) : undefined,
          phone: formatPhoneWithCountryCode(phone),
          recipient_name: recipientName,
          template_name: template.meta_template_name || template.name,
          template_id: template.id,
          status: result.success ? 'sent' : 'failed',
          message_id: result.messageId || '',
          error_message: result.error || '',
          staff_id: eventData.staffId ? Number(eventData.staffId) : undefined,
          staff_name: String(eventData.staffName || ''),
          flow_id: flow.id,
          triggered_by: trigger,
          profile: profile,
          message_content: resolvedContent,
          target_type: targetType,
          customer_name: String(eventData.customerName || ''),
          customer_phone: formatPhoneWithCountryCode(String(eventData.customerPhone || '')),
        });

        if (result.success) whatsappSent++;
        else whatsappFailed++;
      }
    }

    // ==================== EMAIL ====================
    if (flow.mail_template_ids && flow.mail_template_ids.length > 0) {
      for (const templateId of flow.mail_template_ids) {
        const { data: template } = await supabase
          .from('mail_templates')
          .select('*')
          .eq('id', templateId)
          .single();

        if (!template) continue;

        // Alici belirle: template.recipient = 'customer' | 'staff' | 'admin'
        const recipient = template.recipient || 'customer';
        let toEmail = '';

        if (recipient === 'staff') {
          toEmail = String(eventData.staffEmail || '');
        } else if (recipient === 'admin') {
          toEmail = Deno.env.get('ADMIN_EMAIL') || Deno.env.get('GMAIL_USER') || '';
        } else {
          toEmail = String(eventData.customerEmail || '');
        }

        if (!toEmail) continue;

        // Degiskenleri coz
        const resolvedSubject = replaceMessageVariables(template.subject, eventData as Record<string, string>);
        let resolvedBody = replaceMessageVariables(template.body, eventData as Record<string, string>);

        // Info card varsa ekle
        if (template.info_card_id) {
          const { data: infoCard } = await supabase
            .from('mail_info_cards')
            .select('*')
            .eq('id', template.info_card_id)
            .single();

          if (infoCard && infoCard.fields) {
            const fields = infoCard.fields as Array<{ label: string; variable: string }>;
            let infoHtml = '<table style="border-left: 3px solid #006039; padding-left: 15px; margin: 20px 0;">';
            infoHtml += '<tr><td colspan="2" style="font-size: 16px; font-weight: 400; letter-spacing: 1px; color: #1a1a1a; padding-bottom: 15px;">RANDEVU BİLGİLERİ</td></tr>';
            for (const field of fields) {
              const value = replaceMessageVariables(`{{${field.variable}}}`, eventData as Record<string, string>);
              infoHtml += `<tr><td style="color: #666666; font-size: 14px; padding: 8px 15px 8px 0; width: 120px;">${escapeHtml(field.label)}</td><td style="color: #1a1a1a; font-size: 14px; padding: 8px 0;">${escapeHtml(value)}</td></tr>`;
            }
            infoHtml += '</table>';
            resolvedBody += infoHtml;
          }
        }

        // Gmail ile gonder
        const emailResult = await sendGmail({
          to: toEmail,
          subject: resolvedSubject,
          html: resolvedBody,
        });

        if (emailResult.success) {
          emailSent++;
        } else {
          console.error('Email gonderim hatasi:', emailResult.error);
          emailFailed++;
        }
      }
    }
  }

  return jsonResponse({
    success: true,
    message: `${matchingFlows.length} flow tetiklendi`,
    triggeredCount: matchingFlows.length,
    whatsappSent,
    whatsappFailed,
    emailSent,
    emailFailed,
  });
}
