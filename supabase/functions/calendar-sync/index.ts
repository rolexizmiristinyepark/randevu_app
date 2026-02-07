// Calendar Sync Edge Function
// GAS kaynak: Calendar.js (CalendarService)
// Google Calendar senkronizasyonu (opsiyonel)
// Randevular artik PostgreSQL'de, Calendar okuma/yazma opsiyonel

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { createServiceClient, requireAdmin } from '../_shared/supabase-client.ts';
import type { EdgeFunctionBody } from '../_shared/types.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body: EdgeFunctionBody = await req.json();
    const { action } = body;

    switch (action) {
      case 'syncToCalendar':
        return await handleSyncToCalendar(req, body);
      case 'getCalendarEvents':
        return await handleGetCalendarEvents(req, body);
      case 'getCalendarStatus':
        return await handleGetCalendarStatus();
      default:
        return errorResponse(`Bilinmeyen calendar-sync action: ${action}`);
    }
  } catch (err) {
    console.error('Calendar sync error:', err);
    return errorResponse('Sunucuda bir hata oluştu', 500);
  }
});

/**
 * Google Calendar durumunu kontrol et
 */
async function handleGetCalendarStatus(): Promise<Response> {
  const serviceAccountKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
  const calendarId = Deno.env.get('GOOGLE_CALENDAR_ID');

  return jsonResponse({
    success: true,
    configured: !!serviceAccountKey && !!calendarId,
    calendarId: calendarId ? calendarId.substring(0, 10) + '...' : null,
  });
}

/**
 * Randevuyu Google Calendar'a senkronize et (admin)
 */
async function handleSyncToCalendar(req: Request, body: EdgeFunctionBody): Promise<Response> {
  const adminCheck = await requireAdmin(req);
  if (adminCheck) return adminCheck;

  const serviceAccountKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
  const calendarId = Deno.env.get('GOOGLE_CALENDAR_ID');

  if (!serviceAccountKey || !calendarId) {
    return errorResponse('Google Calendar yapılandırılmamış');
  }

  const appointmentId = String(body.appointmentId || '');
  if (!appointmentId) return errorResponse('Randevu ID zorunludur');

  const supabase = createServiceClient();
  const { data: appointment } = await supabase
    .from('appointments')
    .select('*, staff:staff_id(name, phone, email)')
    .eq('id', appointmentId)
    .single();

  if (!appointment) return errorResponse('Randevu bulunamadı');

  try {
    // Google OAuth2 token al (Service Account JWT)
    const accessToken = await getGoogleAccessToken(serviceAccountKey);

    // Calendar event olustur
    const eventBody = {
      summary: `${appointment.customer_name} - ${appointment.staff?.name || 'Atanacak'}`,
      start: {
        dateTime: `${appointment.date}T${appointment.start_time}`,
        timeZone: 'Europe/Istanbul',
      },
      end: {
        dateTime: `${appointment.date}T${appointment.end_time}`,
        timeZone: 'Europe/Istanbul',
      },
      description: [
        `Müşteri: ${appointment.customer_name}`,
        `Telefon: ${appointment.customer_phone}`,
        `E-posta: ${appointment.customer_email || '-'}`,
        `Not: ${appointment.customer_note || '-'}`,
      ].join('\n'),
      extendedProperties: {
        private: {
          supabaseId: appointmentId,
          staffId: String(appointment.staff_id || ''),
          appointmentType: appointment.appointment_type,
          profile: appointment.profile,
        },
      },
    };

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventBody),
      }
    );

    const result = await response.json();

    if (response.ok) {
      // google_event_id'yi kaydet
      await supabase
        .from('appointments')
        .update({ google_event_id: result.id })
        .eq('id', appointmentId);

      return jsonResponse({
        success: true,
        googleEventId: result.id,
        message: 'Calendar event oluşturuldu',
      });
    }

    return errorResponse('Calendar event oluşturulamadı: ' + JSON.stringify(result.error));
  } catch (err) {
    return errorResponse('Calendar sync hatası: ' + String(err));
  }
}

/**
 * Google Calendar event'lerini oku (admin)
 */
async function handleGetCalendarEvents(req: Request, body: EdgeFunctionBody): Promise<Response> {
  const adminCheck = await requireAdmin(req);
  if (adminCheck) return adminCheck;

  const serviceAccountKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
  const calendarId = Deno.env.get('GOOGLE_CALENDAR_ID');

  if (!serviceAccountKey || !calendarId) {
    return errorResponse('Google Calendar yapılandırılmamış');
  }

  const startDate = String(body.startDate || '');
  const endDate = String(body.endDate || '');

  if (!startDate || !endDate) {
    return errorResponse('startDate ve endDate zorunludur');
  }

  try {
    const accessToken = await getGoogleAccessToken(serviceAccountKey);

    const params = new URLSearchParams({
      timeMin: `${startDate}T00:00:00+03:00`,
      timeMax: `${endDate}T23:59:59+03:00`,
      singleEvents: 'true',
      orderBy: 'startTime',
    });

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      }
    );

    const result = await response.json();

    if (response.ok) {
      return jsonResponse({
        success: true,
        items: result.items || [],
      });
    }

    return errorResponse('Calendar events alınamadı');
  } catch (err) {
    return errorResponse('Calendar okuma hatası: ' + String(err));
  }
}

/**
 * Google Service Account JWT ile access token al
 */
async function getGoogleAccessToken(serviceAccountKeyJson: string): Promise<string> {
  const key = JSON.parse(serviceAccountKeyJson);

  // JWT header
  const header = { alg: 'RS256', typ: 'JWT' };

  // JWT claim
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/calendar',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  // Base64URL encode
  const encode = (obj: unknown) => {
    const json = JSON.stringify(obj);
    const bytes = new TextEncoder().encode(json);
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };

  const headerB64 = encode(header);
  const claimB64 = encode(claim);
  const signInput = `${headerB64}.${claimB64}`;

  // RSA sign with private key
  const pemKey = key.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '');

  const binaryKey = Uint8Array.from(atob(pemKey), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signInput)
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const jwt = `${signInput}.${sigB64}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const tokenResult = await tokenResponse.json();
  return tokenResult.access_token;
}
