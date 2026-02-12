// Shared WhatsApp mesaj gonderim modulu
// Meta Cloud API ile mesaj gonder + message_log tablosuna kaydet

import { createServiceClient } from './supabase-client.ts';
import { formatPhoneWithCountryCode, replaceMessageVariables } from './variables.ts';

/** WhatsApp mesaj gonderim sonucu */
interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/** message_log tablosuna kayit icin veri */
interface MessageLogEntry {
  direction?: string;
  appointment_id?: string;
  phone: string;
  recipient_name?: string;
  template_name?: string;
  template_id?: string;
  status: string;
  message_id?: string;
  error_message?: string;
  staff_id?: number;
  staff_name?: string;
  staff_phone?: string;
  flow_id?: string;
  triggered_by?: string;
  profile?: string;
  message_content?: string;
  target_type?: string;
  customer_name?: string;
  customer_phone?: string;
}

/**
 * Meta Cloud API ile WhatsApp mesaji gonder
 */
export async function sendWhatsAppMessage(
  phone: string,
  templateName: string,
  languageCode: string,
  components: unknown[]
): Promise<SendResult> {
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');

  if (!phoneNumberId || !accessToken) {
    return { success: false, error: 'WhatsApp API ayarları eksik (WHATSAPP_PHONE_NUMBER_ID veya WHATSAPP_ACCESS_TOKEN)' };
  }

  const formattedPhone = formatPhoneWithCountryCode(phone).replace('+', '');

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: formattedPhone,
          type: 'template',
          template: {
            name: templateName,
            language: { code: languageCode },
            components,
          },
        }),
      }
    );

    const result = await response.json();

    if (result.messages && result.messages[0]) {
      return { success: true, messageId: result.messages[0].id };
    }

    return { success: false, error: JSON.stringify(result.error || result) };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Template degiskenlerini Meta Cloud API component formatina cevir
 * Template.variables: { "1": "musteri", "2": "randevu_tarihi", ... }
 * eventData: { customerName: "Ahmet", date: "2025-01-15", ... }
 */
export function buildTemplateComponents(
  template: { variables?: Record<string, string>; variable_count?: number; has_button?: boolean; button_variable?: string },
  eventData: Record<string, unknown>
): unknown[] {
  const components: unknown[] = [];
  const variableCount = template.variable_count || 0;

  if (variableCount > 0 && template.variables) {
    const parameters: unknown[] = [];
    for (let i = 1; i <= variableCount; i++) {
      const varKey = template.variables[String(i)];
      if (varKey) {
        // {{varKey}} seklinde resolve et
        const resolved = replaceMessageVariables(`{{${varKey}}}`, eventData as Record<string, string>);
        parameters.push({ type: 'text', text: resolved || '-' });
      }
    }
    if (parameters.length > 0) {
      components.push({ type: 'body', parameters });
    }
  }

  // Button variable (ornegin randevu detay linki)
  // Meta API, template'te URL butonu varsa mutlaka button component ister
  if (template.has_button) {
    let buttonText = '-';
    if (template.button_variable) {
      const resolved = replaceMessageVariables(`{{${template.button_variable}}}`, eventData as Record<string, string>);
      if (resolved) buttonText = resolved;
    }
    components.push({
      type: 'button',
      sub_type: 'url',
      index: 0,
      parameters: [{ type: 'text', text: buttonText }],
    });
  }

  return components;
}

/**
 * message_log tablosuna mesaj kaydi ekle
 */
export async function logMessage(entry: MessageLogEntry): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase.from('message_log').insert({
      direction: entry.direction || 'outgoing',
      appointment_id: entry.appointment_id || null,
      phone: entry.phone,
      recipient_name: entry.recipient_name || '',
      template_name: entry.template_name || '',
      template_id: entry.template_id || '',
      status: entry.status,
      message_id: entry.message_id || '',
      error_message: entry.error_message || '',
      staff_id: entry.staff_id || null,
      staff_name: entry.staff_name || '',
      staff_phone: entry.staff_phone || '',
      flow_id: entry.flow_id || '',
      triggered_by: entry.triggered_by || 'manual',
      profile: entry.profile || '',
      message_content: entry.message_content || '',
      target_type: entry.target_type || '',
      customer_name: entry.customer_name || '',
      customer_phone: entry.customer_phone || '',
    });
  } catch (err) {
    console.error('message_log kaydi yazilamadi:', err);
  }
}

/**
 * Randevu verisinden eventData olustur (degisken cozumleme icin)
 */
export function buildEventDataFromAppointment(
  appointment: Record<string, unknown>,
  staff?: Record<string, unknown> | null
): Record<string, unknown> {
  return {
    customerName: appointment.customer_name || '',
    customerPhone: appointment.customer_phone || '',
    customerEmail: appointment.customer_email || '',
    customerNote: appointment.customer_note || '',
    date: appointment.date || '',
    time: appointment.start_time ? String(appointment.start_time).substring(0, 5) : '',
    appointmentType: appointment.appointment_type || '',
    profile: appointment.profile || '',
    staffName: staff?.name || '',
    staffPhone: staff?.phone || '',
    staffEmail: staff?.email || '',
    staffId: appointment.staff_id || '',
    linkedStaffName: staff?.name || '',
    linkedStaffId: appointment.staff_id || '',
  };
}
