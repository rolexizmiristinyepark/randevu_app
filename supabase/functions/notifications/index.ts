// Notifications Edge Function
// GAS kaynak: Notifications.js (email HTML + ICS olusturma)
// Actions: Email gonderim, ICS olusturma, notification flow tetikleme

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { createServiceClient } from '../_shared/supabase-client.ts';
import { replaceMessageVariables, formatTurkishDate, formatPhoneWithCountryCode } from '../_shared/variables.ts';
import { sendWhatsAppMessage, buildTemplateComponents, logMessage, buildEventDataFromAppointment } from '../_shared/whatsapp-sender.ts';
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
      case 'triggerScheduledReminders':
        return await handleScheduledReminders();
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
            .eq('is_admin', true)
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

        // Admin: staff tablosundan tum admin emailleri al
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

            console.log(`[EMAIL] Admin gonderiliyor: to=${admin.email} (${admin.name})`);
            const emailResult = await sendGmail({
              to: admin.email,
              subject: resolvedSubject,
              html: resolvedBody,
            });

            if (emailResult.success) {
              emailSent++;
              console.log(`[EMAIL] Admin basarili: ${admin.email}`);
            } else {
              console.error(`[EMAIL] Admin HATA: ${admin.email} error=${emailResult.error}`);
              emailFailed++;
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

        // Resend ile gonder
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

// ==================== SCHEDULED REMINDERS ====================

/**
 * Zamanlanmis hatirlatma bildirimleri
 * pg_cron her saat basinda cagirir
 * HATIRLATMA trigger'li flow'larin schedule_hour ve schedule_day'ine bakar
 *
 * Recipient turleri:
 * - customer: Her randevu icin musteriye kendi hatirlatmasi
 * - staff: Her randevu icin atanmis personele hatirlatma
 * - admin: Tum randevularin ozeti admin'lere
 * - greeter: Tum randevularin ozeti greeter role'lu personellere
 */
async function handleScheduledReminders(): Promise<Response> {
  const supabase = createServiceClient();

  // Istanbul saatini al
  const now = new Date();
  const istanbulHour = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul', hour: 'numeric', hour12: false
  }).format(now);
  const currentHour = String(parseInt(istanbulHour));

  console.log(`[REMINDER] Saat kontrol: Istanbul ${currentHour}:00`);

  // Bu saate ayarli aktif HATIRLATMA flow'larini bul
  const { data: flows } = await supabase
    .from('notification_flows')
    .select('*')
    .eq('active', true)
    .eq('trigger', 'HATIRLATMA')
    .eq('schedule_hour', currentHour);

  if (!flows || flows.length === 0) {
    return jsonResponse({ success: true, message: `Saat ${currentHour} icin hatirlatma flow yok`, sent: 0 });
  }

  // Bugunku ve yarinki tarihleri hesapla (Istanbul timezone)
  const istanbulDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(now);
  const tomorrow = new Date(now.getTime() + 86400000);
  const tomorrowDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(tomorrow);

  let totalSent = 0;
  let totalFailed = 0;

  for (const flow of flows) {
    // schedule_day'e gore randevulari cek (today veya tomorrow)
    const scheduleDay = flow.schedule_day || 'today';
    const targetDate = scheduleDay === 'tomorrow' ? tomorrowDate : istanbulDate;

    const { data: appointments } = await supabase
      .from('appointments')
      .select('*, staff:staff_id(id, name, phone, email, role)')
      .eq('date', targetDate)
      .neq('status', 'cancelled')
      .order('start_time');

    const appts = appointments || [];
    console.log(`[REMINDER] Flow ${flow.name}: schedule_day=${scheduleDay}, tarih=${targetDate}, randevu sayisi=${appts.length}`);

    if (appts.length === 0) continue;

    // ==================== WHATSAPP ====================
    for (const templateId of (flow.whatsapp_template_ids || [])) {
      const { data: template } = await supabase
        .from('whatsapp_templates')
        .select('*')
        .eq('id', templateId)
        .single();
      if (!template) continue;

      const targetType = template.target_type || 'customer';
      const results = await sendReminderWhatsApp(supabase, template, targetType, appts, flow, scheduleDay);
      totalSent += results.sent;
      totalFailed += results.failed;
    }

    // ==================== EMAIL ====================
    for (const templateId of (flow.mail_template_ids || [])) {
      const { data: template } = await supabase
        .from('mail_templates')
        .select('*')
        .eq('id', templateId)
        .single();
      if (!template) continue;

      const recipient = template.recipient || 'customer';
      const results = await sendReminderEmail(supabase, template, recipient, appts, flow, targetDate, currentHour);
      totalSent += results.sent;
      totalFailed += results.failed;
    }
  }

  console.log(`[REMINDER] Saat ${currentHour}: ${totalSent} gonderildi, ${totalFailed} basarisiz`);
  return jsonResponse({ success: true, hour: currentHour, sent: totalSent, failed: totalFailed });
}

/**
 * Hatirlatma WhatsApp mesajlari gonder
 * customer/staff: randevu basina bir mesaj
 * admin/greeter: randevu basina bir mesaj (her randevunun bilgisi ayri ayri)
 */
// deno-lint-ignore no-explicit-any
async function sendReminderWhatsApp(
  supabase: any,
  template: Record<string, unknown>,
  targetType: string,
  appointments: Record<string, unknown>[],
  flow: Record<string, unknown>,
  scheduleDay: string
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  // admin ve greeter icin: hedef personelleri bul, her randevu icin mesaj gonder
  if (targetType === 'admin' || targetType === 'greeter') {
    const staffList = await getStaffByRecipientType(supabase, targetType);

    for (const staffMember of staffList) {
      if (!staffMember.phone) continue;

      for (const appt of appointments) {
        const apptStaff = appt.staff as Record<string, unknown> | null;
        const eventData = buildEventDataFromAppointment(appt, apptStaff);
        const components = buildTemplateComponents(template, eventData);
        const result = await sendWhatsAppMessage(
          staffMember.phone,
          String(template.meta_template_name || template.name),
          String(template.language || 'tr'),
          components
        );

        const resolvedContent = replaceMessageVariables(String(template.content || ''), eventData as Record<string, string>);
        await logMessage({
          appointment_id: String(appt.id || ''),
          phone: formatPhoneWithCountryCode(staffMember.phone),
          recipient_name: staffMember.name,
          template_name: String(template.meta_template_name || template.name),
          template_id: String(template.id || ''),
          status: result.success ? 'sent' : 'failed',
          message_id: result.messageId || '',
          error_message: result.error || '',
          flow_id: String(flow.id || ''),
          triggered_by: `scheduled_reminder_${scheduleDay}`,
          profile: String(appt.profile || ''),
          message_content: resolvedContent,
          target_type: targetType,
          customer_name: String(eventData.customerName || ''),
          customer_phone: formatPhoneWithCountryCode(String(eventData.customerPhone || '')),
        });

        if (result.success) sent++;
        else failed++;
      }
    }
    return { sent, failed };
  }

  // customer ve staff icin: randevu basina bir mesaj
  for (const appt of appointments) {
    const apptStaff = appt.staff as Record<string, unknown> | null;
    const eventData = buildEventDataFromAppointment(appt, apptStaff);

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
      String(template.meta_template_name || template.name),
      String(template.language || 'tr'),
      components
    );

    const resolvedContent = replaceMessageVariables(String(template.content || ''), eventData as Record<string, string>);
    await logMessage({
      appointment_id: String(appt.id || ''),
      phone: formatPhoneWithCountryCode(phone),
      recipient_name: recipientName,
      template_name: String(template.meta_template_name || template.name),
      template_id: String(template.id || ''),
      status: result.success ? 'sent' : 'failed',
      message_id: result.messageId || '',
      error_message: result.error || '',
      flow_id: String(flow.id || ''),
      triggered_by: `scheduled_reminder_${scheduleDay}`,
      profile: String(appt.profile || ''),
      message_content: resolvedContent,
      target_type: targetType,
      customer_name: String(eventData.customerName || ''),
      customer_phone: formatPhoneWithCountryCode(String(eventData.customerPhone || '')),
    });

    if (result.success) sent++;
    else failed++;
  }

  return { sent, failed };
}

/**
 * Hatirlatma email mesajlari gonder
 * customer/staff: randevu basina bir email
 * admin/greeter: tum randevularin ozet emaili
 */
// deno-lint-ignore no-explicit-any
async function sendReminderEmail(
  supabase: any,
  template: Record<string, unknown>,
  recipient: string,
  appointments: Record<string, unknown>[],
  flow: Record<string, unknown>,
  targetDate: string,
  currentHour: string
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  // admin ve greeter icin: ozet email gonder
  if (recipient === 'admin' || recipient === 'greeter') {
    const staffList = await getStaffByRecipientType(supabase, recipient);

    for (const staffMember of staffList) {
      if (!staffMember.email) continue;

      const summaryData = {
        customerName: `${appointments.length} randevu`,
        date: targetDate,
        time: `${currentHour}:00`,
      } as Record<string, string>;

      const resolvedSubject = replaceMessageVariables(String(template.subject || ''), summaryData);
      const resolvedBody = replaceMessageVariables(String(template.body || ''), summaryData);

      console.log(`[EMAIL] ${recipient} gonderiliyor: to=${staffMember.email} (${staffMember.name})`);
      const emailResult = await sendGmail({ to: staffMember.email, subject: resolvedSubject, html: resolvedBody });
      if (emailResult.success) sent++;
      else failed++;
    }
    return { sent, failed };
  }

  // customer ve staff icin: randevu basina bir email
  for (const appt of appointments) {
    const apptStaff = appt.staff as Record<string, unknown> | null;
    const eventData = buildEventDataFromAppointment(appt, apptStaff);

    const toEmail = recipient === 'staff'
      ? String(eventData.staffEmail || '')
      : String(eventData.customerEmail || '');

    if (!toEmail) continue;

    const resolvedSubject = replaceMessageVariables(String(template.subject || ''), eventData as Record<string, string>);
    const resolvedBody = replaceMessageVariables(String(template.body || ''), eventData as Record<string, string>);

    const emailResult = await sendGmail({ to: toEmail, subject: resolvedSubject, html: resolvedBody });
    if (emailResult.success) sent++;
    else failed++;
  }

  return { sent, failed };
}

/**
 * Recipient tipine gore staff listesini dondur
 * admin: is_admin=true olan aktif personeller
 * greeter: role='greeter' olan aktif personeller
 */
// deno-lint-ignore no-explicit-any
async function getStaffByRecipientType(supabase: any, recipientType: string): Promise<Array<{ name: string; phone: string; email: string }>> {
  if (recipientType === 'greeter') {
    const { data } = await supabase
      .from('staff')
      .select('name, phone, email')
      .eq('role', 'greeter')
      .eq('active', true);
    return data || [];
  }

  // admin (default)
  const { data } = await supabase
    .from('staff')
    .select('name, phone, email')
    .eq('is_admin', true)
    .eq('active', true);
  return data || [];
}
