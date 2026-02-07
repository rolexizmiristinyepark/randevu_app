// WhatsApp Webhook Edge Function
// GAS kaynak: Main.js doGet (challenge), WhatsApp.js handleWhatsAppWebhook
// Deploy: --no-verify-jwt (Meta'nin JWT'si yok)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createServiceClient } from '../_shared/supabase-client.ts';

const VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN') || 'randevu-sistemi-verify';

serve(async (req: Request) => {
  const url = new URL(req.url);

  // ==================== GET: Webhook Verification ====================
  // Meta webhook dogrulama (subscribe olurken)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WhatsApp webhook verified');
      return new Response(challenge, { status: 200 });
    }

    return new Response('Forbidden', { status: 403 });
  }

  // ==================== POST: Incoming Events ====================
  if (req.method === 'POST') {
    try {
      const webhookData = await req.json();

      if (!webhookData.entry || !Array.isArray(webhookData.entry)) {
        return new Response('OK', { status: 200 });
      }

      const supabase = createServiceClient();

      for (const entry of webhookData.entry) {
        if (!entry.changes || !Array.isArray(entry.changes)) continue;

        for (const change of entry.changes) {
          if (change.field !== 'messages') continue;
          const value = change.value;
          if (!value) continue;

          // ---- Status Updates (sent, delivered, read, failed) ----
          if (value.statuses && Array.isArray(value.statuses)) {
            for (const status of value.statuses) {
              const messageId = status.id;
              const statusType = status.status;

              let errorMessage = '';
              if (status.errors && status.errors.length > 0) {
                errorMessage = status.errors.map((e: { message?: string; title?: string }) =>
                  e.message || e.title
                ).join('; ');
              }

              // message_log tablosundaki durumu guncelle
              const updates: Record<string, unknown> = { status: statusType };
              if (errorMessage) updates.error_message = errorMessage;

              await supabase
                .from('message_log')
                .update(updates)
                .eq('message_id', messageId);

              console.log(`Message status updated: ${messageId} -> ${statusType}`);
            }
          }

          // ---- Incoming Messages ----
          if (value.messages && Array.isArray(value.messages)) {
            for (const message of value.messages) {
              // Mesaj icerigini belirle
              let messageContent = '';
              switch (message.type) {
                case 'text':
                  messageContent = message.text?.body || '';
                  break;
                case 'image':
                  messageContent = '[Resim]' + (message.image?.caption ? ': ' + message.image.caption : '');
                  break;
                case 'video':
                  messageContent = '[Video]' + (message.video?.caption ? ': ' + message.video.caption : '');
                  break;
                case 'audio':
                  messageContent = '[Ses Mesajı]';
                  break;
                case 'document':
                  messageContent = '[Dosya]: ' + (message.document?.filename || 'dosya');
                  break;
                case 'location':
                  messageContent = `[Konum]: ${message.location?.latitude}, ${message.location?.longitude}`;
                  break;
                case 'contacts':
                  messageContent = '[Kişi Paylaşımı]';
                  break;
                case 'sticker':
                  messageContent = '[Çıkartma]';
                  break;
                default:
                  messageContent = `[${message.type || 'Bilinmeyen'}]`;
              }

              // Gonderen bilgisi
              let senderName = '';
              if (value.contacts && value.contacts.length > 0) {
                const contact = value.contacts.find(
                  (c: { wa_id?: string; profile?: { name?: string } }) => c.wa_id === message.from
                );
                if (contact?.profile?.name) {
                  senderName = contact.profile.name;
                }
              }

              // message_log'a kaydet
              await supabase.from('message_log').insert({
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                direction: 'incoming',
                phone: message.from || '',
                recipient_name: senderName,
                template_name: message.type || 'text',
                template_id: '',
                status: 'received',
                message_id: message.id || '',
                error_message: '',
                staff_id: null,
                staff_name: '',
                staff_phone: '',
                flow_id: '',
                triggered_by: 'webhook',
                profile: '',
                message_content: messageContent,
                target_type: '',
                customer_name: senderName,
                customer_phone: message.from || '',
              });

              console.log(`Incoming message logged: ${message.from} - ${message.type}`);
            }
          }
        }
      }

      return new Response('OK', { status: 200 });
    } catch (err) {
      console.error('Webhook processing error:', err);
      // Meta 200 bekler, hata durumunda bile 200 dondur (retry loop onleme)
      return new Response('OK', { status: 200 });
    }
  }

  // OPTIONS (CORS)
  if (req.method === 'OPTIONS') {
    return new Response('OK', {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  return new Response('Method Not Allowed', { status: 405 });
});
