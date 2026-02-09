// Shared Google Calendar modülü
// Google Service Account JWT auth + Calendar event CRUD

import { createServiceClient } from './supabase-client.ts';

/**
 * Google Service Account JWT ile access token al
 */
export async function getGoogleAccessToken(serviceAccountKeyJson: string): Promise<string> {
  const key = JSON.parse(serviceAccountKeyJson);

  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/calendar',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

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

/**
 * Randevuyu Google Calendar'a sync et
 * Opsiyonel: GOOGLE_SERVICE_ACCOUNT_KEY ve GOOGLE_CALENDAR_ID yoksa sessizce atlar
 */
export async function syncAppointmentToCalendar(appointmentId: string): Promise<void> {
  const serviceAccountKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
  const calendarId = Deno.env.get('GOOGLE_CALENDAR_ID');

  if (!serviceAccountKey || !calendarId) return;

  const supabase = createServiceClient();
  const { data: appointment } = await supabase
    .from('appointments')
    .select('*, staff:staff_id(name, phone, email)')
    .eq('id', appointmentId)
    .single();

  if (!appointment) return;

  const accessToken = await getGoogleAccessToken(serviceAccountKey);

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
    await supabase
      .from('appointments')
      .update({ google_event_id: result.id })
      .eq('id', appointmentId);

    console.log(`Calendar event created: ${result.id} for appointment ${appointmentId}`);
  } else {
    console.error('Calendar event oluşturulamadı:', result.error);
  }
}
