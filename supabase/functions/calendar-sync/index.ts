// Calendar Sync Edge Function
// GAS kaynak: Calendar.js (CalendarService)
// Google Calendar senkronizasyonu (opsiyonel)
// Randevular artik PostgreSQL'de, Calendar okuma/yazma opsiyonel

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { createServiceClient, requireAdmin } from '../_shared/supabase-client.ts';
import { getGoogleAccessToken } from '../_shared/google-calendar.ts';
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
      case 'importFromCalendar':
        return await handleImportFromCalendar(body);
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
  // Admin değilse boş veri dön (müşteri sayfası için 400 yerine)
  const adminCheck = await requireAdmin(req);
  if (adminCheck) return jsonResponse({ success: true, data: {} });

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
 * Google Calendar'dan event'leri okuyup appointments tablosuna aktar
 * Tek seferlik migration fonksiyonu
 */
async function handleImportFromCalendar(body: EdgeFunctionBody): Promise<Response> {
  const serviceAccountKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
  const calendarId = Deno.env.get('GOOGLE_CALENDAR_ID');

  if (!serviceAccountKey || !calendarId) {
    return errorResponse('Google Calendar yapılandırılmamış');
  }

  const startDate = String(body.startDate || '');
  const endDate = String(body.endDate || '');
  const dryRun = body.dryRun === true; // true ise sadece önizleme, DB'ye yazmaz

  if (!startDate || !endDate) {
    return errorResponse('startDate ve endDate zorunludur (YYYY-MM-DD)');
  }

  try {
    const accessToken = await getGoogleAccessToken(serviceAccountKey);

    // Tüm event'leri çek (sayfalama ile)
    let allEvents: any[] = [];
    let pageToken: string | null = null;

    do {
      const params = new URLSearchParams({
        timeMin: `${startDate}T00:00:00+03:00`,
        timeMax: `${endDate}T23:59:59+03:00`,
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '250',
      });
      if (pageToken) params.set('pageToken', pageToken);

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );

      const result = await response.json();
      if (!response.ok) {
        return errorResponse('Calendar events alınamadı: ' + JSON.stringify(result.error));
      }

      allEvents = allEvents.concat(result.items || []);
      pageToken = result.nextPageToken || null;
    } while (pageToken);

    // Event'leri parse et
    const parsed: any[] = [];
    const skipped: any[] = [];

    for (const event of allEvents) {
      // Tüm gün event'leri atla
      if (event.start?.date && !event.start?.dateTime) {
        skipped.push({ summary: event.summary, reason: 'all-day event' });
        continue;
      }

      // İptal edilmiş event'leri atla
      if (event.status === 'cancelled') {
        skipped.push({ summary: event.summary, reason: 'cancelled' });
        continue;
      }

      const summary = event.summary || '';
      if (!summary.trim()) {
        skipped.push({ summary: '(boş)', reason: 'empty summary' });
        continue;
      }

      // Start/End time parse
      const startDt = new Date(event.start.dateTime);
      const endDt = new Date(event.end.dateTime);

      // Tarih ve saat (TR timezone)
      const date = startDt.toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' }); // YYYY-MM-DD
      const startTime = startDt.toLocaleTimeString('sv-SE', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const endTime = endDt.toLocaleTimeString('sv-SE', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', second: '2-digit' });

      // Süre dakika cinsinden
      const durationMs = endDt.getTime() - startDt.getTime();
      const duration = Math.round(durationMs / 60000);

      // Event summary formatı: "Müşteri Adı - Personel Adı (Tür)"
      // Veya sadece "Müşteri Adı"
      const description = event.description || '';
      let customerName = summary.trim();
      let customerPhone = '';
      let customerEmail = '';
      let customerNote = '';

      // Tür tespiti: "(Teslim)", "(Gönderi)", "(VIP)" gibi
      let appointmentType = 'meeting';
      const typeMatch = summary.match(/\((Teslim|Gönderi|VIP|Randevu|Meeting)\)/i);
      if (typeMatch) {
        const t = typeMatch[1].toLowerCase();
        if (t === 'teslim') appointmentType = 'delivery';
        else if (t === 'gönderi') appointmentType = 'shipping';
        else if (t === 'vip') appointmentType = 'management';
        // Müşteri adından tür kısmını çıkar
        customerName = summary.replace(/\s*\([^)]+\)\s*$/, '').trim();
      }

      // "Müşteri - Personel" formatını ayır (sadece müşteri adını al)
      const dashParts = customerName.split(' - ');
      if (dashParts.length >= 2) {
        customerName = dashParts[0].trim();
      }

      // Description parse: "Telefon: ...", "E-posta: ...", "Not: ..."
      const phoneMatch = description.match(/(?:Telefon|Tel|Phone)[:\s]+([^\n]+)/i);
      if (phoneMatch) customerPhone = phoneMatch[1].trim();

      const emailMatch = description.match(/(?:E-?posta|Email|Mail)[:\s]+([^\n]+)/i);
      if (emailMatch) customerEmail = emailMatch[1].trim();

      const noteMatch = description.match(/(?:Not|Note)[:\s]+([^\n]+)/i);
      if (noteMatch) customerNote = noteMatch[1].trim();

      parsed.push({
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        customer_note: customerNote,
        date,
        start_time: startTime,
        end_time: endTime,
        duration,
        status: 'confirmed',
        appointment_type: appointmentType,
        profile: 'g',
        google_event_id: event.id,
        kvkk_consent: true,
      });
    }

    // Dry run ise sadece önizleme döndür
    if (dryRun) {
      return jsonResponse({
        success: true,
        dryRun: true,
        totalEvents: allEvents.length,
        parsedCount: parsed.length,
        skippedCount: skipped.length,
        skipped,
        preview: parsed.slice(0, 10),
      });
    }

    // DB'ye yaz — mevcut google_event_id'leri kontrol et (duplicate engelle)
    const supabase = createServiceClient();

    // Mevcut google_event_id'leri çek
    const existingIds = new Set<string>();
    const { data: existing } = await supabase
      .from('appointments')
      .select('google_event_id')
      .not('google_event_id', 'is', null);

    if (existing) {
      for (const row of existing) {
        if (row.google_event_id) existingIds.add(row.google_event_id);
      }
    }

    // Yeni olanları filtrele
    const toInsert = parsed.filter(p => !existingIds.has(p.google_event_id));

    if (toInsert.length === 0) {
      return jsonResponse({
        success: true,
        message: 'Tüm event\'ler zaten aktarılmış',
        totalEvents: allEvents.length,
        alreadyImported: parsed.length - toInsert.length,
      });
    }

    // Batch insert (100'lük gruplar halinde)
    let inserted = 0;
    let errors: string[] = [];

    for (let i = 0; i < toInsert.length; i += 100) {
      const batch = toInsert.slice(i, i + 100);
      const { error } = await supabase.from('appointments').insert(batch);
      if (error) {
        errors.push(`Batch ${i}-${i + batch.length}: ${error.message}`);
      } else {
        inserted += batch.length;
      }
    }

    return jsonResponse({
      success: true,
      totalEvents: allEvents.length,
      imported: inserted,
      skipped: skipped.length,
      duplicatesSkipped: parsed.length - toInsert.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    return errorResponse('Import hatası: ' + String(err));
  }
}
