// Shared Google Calendar modülü
// Google Service Account JWT auth + Calendar event CRUD

import { createServiceClient } from './supabase-client.ts';

/**
 * Timestamp'i Türkçe tarih+saat formatına çevir
 */
function formatTimestamp(ts: string | null | undefined): string {
  if (!ts) return '-';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
}

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

  // Takvim başlığı: Müşteri - İlgili (Profil) / Tür
  const PROFILE_LABELS: Record<string, string> = {
    g: 'Genel', w: 'Walk-in', b: 'Mağaza', m: 'Yönetim', s: 'Bireysel', v: 'Özel Müşteri'
  };
  const TYPE_LABELS: Record<string, string> = {
    meeting: 'Görüşme', delivery: 'Teslim', shipping: 'Gönderi', service: 'Teknik Servis', management: 'Yönetim'
  };
  const staffLabel = appointment.staff?.name || 'Atanmadı';
  const profileLabel = PROFILE_LABELS[appointment.profile] || appointment.profile || 'Genel';
  const typeLabel = TYPE_LABELS[appointment.appointment_type] || appointment.appointment_type || '';
  const summary = `${appointment.customer_name} - ${staffLabel} (${profileLabel}) / ${typeLabel}`;

  const eventBody = {
    summary,
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
      `Oluşturulma: ${formatTimestamp(appointment.created_at)}`,
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

/**
 * Randevu guncellenince Google Calendar event'ini guncelle
 * google_event_id varsa PATCH ile gunceller, yoksa yeni olusturur
 */
export async function updateCalendarEvent(appointmentId: string): Promise<void> {
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

  // google_event_id yoksa yeni olustur
  if (!appointment.google_event_id) {
    await syncAppointmentToCalendar(appointmentId);
    return;
  }

  const accessToken = await getGoogleAccessToken(serviceAccountKey);

  const PROFILE_LABELS: Record<string, string> = {
    g: 'Genel', w: 'Walk-in', b: 'Mağaza', m: 'Yönetim', s: 'Bireysel', v: 'Özel Müşteri'
  };
  const TYPE_LABELS: Record<string, string> = {
    meeting: 'Görüşme', delivery: 'Teslim', shipping: 'Gönderi', service: 'Teknik Servis', management: 'Yönetim'
  };
  const staffLabel = appointment.staff?.name || 'Atanmadı';
  const profileLabel = PROFILE_LABELS[appointment.profile] || appointment.profile || 'Genel';
  const typeLabel = TYPE_LABELS[appointment.appointment_type] || appointment.appointment_type || '';
  const summary = `${appointment.customer_name} - ${staffLabel} (${profileLabel}) / ${typeLabel}`;

  const eventBody = {
    summary,
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
      `Oluşturulma: ${formatTimestamp(appointment.created_at)}`,
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
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(appointment.google_event_id)}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventBody),
    }
  );

  if (response.ok) {
    console.log(`Calendar event updated: ${appointment.google_event_id} for appointment ${appointmentId}`);
  } else {
    const err = await response.text();
    console.error(`Calendar event güncellenemedi (${response.status}): ${err}`);
  }
}

/**
 * Randevuyu Google Calendar'dan sil
 * google_event_id varsa siler, yoksa sessizce atlar
 */
export async function deleteCalendarEvent(appointmentId: string): Promise<void> {
  const serviceAccountKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
  const calendarId = Deno.env.get('GOOGLE_CALENDAR_ID');

  if (!serviceAccountKey || !calendarId) return;

  const supabase = createServiceClient();
  const { data: appointment } = await supabase
    .from('appointments')
    .select('google_event_id')
    .eq('id', appointmentId)
    .single();

  if (!appointment?.google_event_id) {
    console.log(`Calendar delete atlandı: appointment ${appointmentId} google_event_id yok`);
    return;
  }

  const accessToken = await getGoogleAccessToken(serviceAccountKey);

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(appointment.google_event_id)}`,
    {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    }
  );

  if (response.ok || response.status === 204) {
    console.log(`Calendar event deleted: ${appointment.google_event_id} for appointment ${appointmentId}`);
  } else {
    const err = await response.text();
    console.error(`Calendar event silinemedi (${response.status}): ${err}`);
  }
}
