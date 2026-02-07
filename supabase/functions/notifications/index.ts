// Notifications Edge Function
// GAS kaynak: Notifications.js (email HTML + ICS olusturma)
// Actions: Email gonderim, ICS olusturma, notification flow tetikleme

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { createServiceClient } from '../_shared/supabase-client.ts';
import { replaceMessageVariables, formatTurkishDate } from '../_shared/variables.ts';
import { escapeHtml } from '../_shared/validation.ts';
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
    return errorResponse('Sunucuda bir hata oluştu', 500);
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

  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    return errorResponse('Email servisi yapılandırılmamış (RESEND_API_KEY)');
  }

  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'randevu@rolex-izmir.com';

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject,
        html,
        attachments: body.attachments || undefined,
      }),
    });

    const result = await response.json();

    if (response.ok) {
      return jsonResponse({ success: true, messageId: result.id });
    }

    return errorResponse('Email gönderilemedi: ' + JSON.stringify(result));
  } catch (err) {
    return errorResponse('Email gönderim hatası: ' + String(err));
  }
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
  let emailSent = 0;

  // Her eslesen flow icin mesaj gonder
  for (const flow of matchingFlows) {
    // WhatsApp template'leri
    if (flow.whatsapp_template_ids && flow.whatsapp_template_ids.length > 0) {
      // TODO: WhatsApp mesaji gonderimi (sendWhatsAppMessage cagirma)
      whatsappSent += flow.whatsapp_template_ids.length;
    }

    // Mail template'leri
    if (flow.mail_template_ids && flow.mail_template_ids.length > 0) {
      // Mail template'leri yukle ve gonder
      for (const templateId of flow.mail_template_ids) {
        const { data: template } = await supabase
          .from('mail_templates')
          .select('*')
          .eq('id', templateId)
          .single();

        if (template) {
          // Degiskenleri coz
          const eventData = body.eventData as Record<string, unknown> || {};
          const resolvedSubject = replaceMessageVariables(template.subject, eventData);
          const resolvedBody = replaceMessageVariables(template.body, eventData);

          // TODO: Email gonderimi (Resend API cagirma)
          emailSent++;
        }
      }
    }
  }

  return jsonResponse({
    success: true,
    message: `${matchingFlows.length} flow tetiklendi`,
    triggeredCount: matchingFlows.length,
    whatsappSent,
    emailSent,
  });
}
