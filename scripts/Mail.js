/**
 * Mail.js
 *
 * Mail Template ve Info Card Yönetimi
 * v3.10.0: Unified notification system
 *
 * Bu modül mail şablonlarını ve bilgi kartlarını yönetir.
 * Akışlar artık notification_flows'dan yönetilir (WhatsApp + Mail birleşik)
 *
 * Storage: SheetStorageService kullanır
 * - notification_flows sheet'i (tek ana akış - WhatsApp + Mail)
 * - mail_templates sheet'i (id, name, subject, body, recipient, infoCardId)
 * - mail_info_cards sheet'i (id, name, fields)
 */

// ==================== CONSTANTS (v3.10.0 - lowercase) ====================

const NOTIFICATION_FLOWS_SHEET = 'notification_flows';
const MAIL_TEMPLATE_SHEET = 'mail_templates';
const MAIL_INFO_CARDS_SHEET = 'mail_info_cards';

// Değişkenler Variables.js'den gelir (MESSAGE_VARIABLES)
// v3.9.64: DEFAULT_INFO_CARD kaldırıldı - tüm info card tanımları MAIL_INFO_CARDS sheet'inden gelir
// Mail şablonlarında {{musteri}}, {{randevu_tarihi}} vb. kullanılır

// Trigger türleri: Variables.js'deki MESSAGE_TRIGGERS kullanılıyor (global)

// Hedef türleri
const MAIL_TARGETS = {
  'customer': 'Müşteri',
  'staff': 'Personel'
};

// ==================== TEMPLATE MANAGEMENT ====================

/**
 * Tüm mail şablonlarını getir
 */
function getMailTemplates() {
  try {
    const rawTemplates = SheetStorageService.getAll(MAIL_TEMPLATE_SHEET) || [];

    // Debug: Ham veriyi logla
    log.info('getMailTemplates - Raw data count:', rawTemplates.length);

    // Geçersiz kayıtları filtrele (String() ile tip güvenliği)
    const validTemplates = rawTemplates.filter(t => {
      const id = String(t.id || '').trim();
      return id.length > 10;
    });

    log.info('getMailTemplates - Valid templates count:', validTemplates.length);

    return {
      success: true,
      data: validTemplates.map(template => ({
        id: String(template.id),
        name: String(template.name || ''),
        subject: String(template.subject || ''),
        body: String(template.body || ''),
        recipient: String(template.recipient || 'customer'), // v3.9.74: Recipient in template
        infoCardId: String(template.infoCardId || '') // v3.9.75: Info card in template
      }))
    };
  } catch (error) {
    log.error('getMailTemplates error:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Yeni mail şablonu oluştur
 */
function createMailTemplate(params) {
  try {
    const id = Utilities.getUuid();
    const template = {
      id: id,
      name: params.name,
      subject: params.subject || '',
      body: params.body || '',
      recipient: params.recipient || 'customer', // v3.9.74: Recipient in template
      infoCardId: params.infoCardId || '', // v3.9.75: Info card in template
      createdAt: new Date().toISOString()
    };

    SheetStorageService.add(MAIL_TEMPLATE_SHEET, template);

    return {
      success: true,
      data: { id: id },
      message: 'Şablon oluşturuldu'
    };
  } catch (error) {
    log.error('createMailTemplate error:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Mail şablonu güncelle
 */
function updateMailTemplate(params) {
  try {
    if (!params.id) {
      return { success: false, error: 'Template ID gerekli' };
    }

    const updates = {};

    if (params.name !== undefined) updates.name = params.name;
    if (params.subject !== undefined) updates.subject = params.subject;
    if (params.body !== undefined) updates.body = params.body;
    if (params.recipient !== undefined) updates.recipient = params.recipient; // v3.9.74
    if (params.infoCardId !== undefined) updates.infoCardId = params.infoCardId; // v3.9.75

    updates.updatedAt = new Date().toISOString();

    SheetStorageService.update(MAIL_TEMPLATE_SHEET, params.id, updates);

    return {
      success: true,
      message: 'Şablon güncellendi'
    };
  } catch (error) {
    log.error('updateMailTemplate error:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Mail şablonu sil
 */
function deleteMailTemplate(params) {
  try {
    if (!params.id) {
      return { success: false, error: 'Template ID gerekli' };
    }

    SheetStorageService.delete(MAIL_TEMPLATE_SHEET, params.id);

    return {
      success: true,
      message: 'Şablon silindi'
    };
  } catch (error) {
    log.error('deleteMailTemplate error:', error);
    return { success: false, error: error.toString() };
  }
}

// ==================== INFO CARD MANAGEMENT ====================

/**
 * Bilgi Kartı Yapısı:
 * {
 *   id: string,
 *   name: string,
 *   fields: [
 *     { variable: 'randevu_tarih', label: 'Tarih', order: 0 },
 *     { variable: 'randevu_saat', label: 'Saat', order: 1 },
 *     ...
 *   ]
 * }
 */

/**
 * Tüm bilgi kartlarını getir
 */
function getMailInfoCards() {
  try {
    const rawCards = SheetStorageService.getAll(MAIL_INFO_CARDS_SHEET) || [];

    // Debug: Ham veriyi logla
    log.info('getMailInfoCards - Raw data count:', rawCards.length);

    // Geçersiz kayıtları filtrele (String() ile tip güvenliği)
    const validCards = rawCards.filter(card => {
      const id = String(card.id || '').trim();
      return id.length > 10;
    });

    log.info('getMailInfoCards - Valid cards count:', validCards.length);

    // v3.9.65: Tüm info card'lar sheet'ten gelir - DEFAULT kaldırıldı
    const mappedCards = validCards.map(card => ({
      id: String(card.id),
      name: String(card.name || ''),
      fields: parseJsonSafe(card.fields, [])
    }));

    return {
      success: true,
      data: mappedCards
    };
  } catch (error) {
    log.error('getMailInfoCards error:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Yeni bilgi kartı oluştur
 */
function createMailInfoCard(params) {
  try {
    const id = Utilities.getUuid();
    const card = {
      id: id,
      name: params.name,
      fields: JSON.stringify(params.fields || []),
      createdAt: new Date().toISOString()
    };

    SheetStorageService.add(MAIL_INFO_CARDS_SHEET, card);

    return {
      success: true,
      data: { id: id },
      message: 'Bilgi kartı oluşturuldu'
    };
  } catch (error) {
    log.error('createMailInfoCard error:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Bilgi kartı güncelle
 */
function updateMailInfoCard(params) {
  try {
    if (!params.id) {
      return { success: false, error: 'InfoCard ID gerekli' };
    }

    const updates = {};

    if (params.name !== undefined) updates.name = params.name;
    if (params.fields !== undefined) updates.fields = JSON.stringify(params.fields);

    updates.updatedAt = new Date().toISOString();

    SheetStorageService.update(MAIL_INFO_CARDS_SHEET, params.id, updates);

    return {
      success: true,
      message: 'Bilgi kartı güncellendi'
    };
  } catch (error) {
    log.error('updateMailInfoCard error:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Bilgi kartı sil
 */
function deleteMailInfoCard(params) {
  try {
    if (!params.id) {
      return { success: false, error: 'InfoCard ID gerekli' };
    }

    SheetStorageService.delete(MAIL_INFO_CARDS_SHEET, params.id);

    return {
      success: true,
      message: 'Bilgi kartı silindi'
    };
  } catch (error) {
    log.error('deleteMailInfoCard error:', error);
    return { success: false, error: error.toString() };
  }
}

// ==================== MAIL SENDING ====================

/**
 * Bilgi kartı şablonuna göre info box oluştur
 * v3.9.64: GLOBAL SİSTEM - Tüm değerler Variables.js getVariableValue'dan gelir
 *          Info card tanımları MAIL_INFO_CARDS sheet'inden gelir (DEFAULT yok)
 *
 * @param {Object} data - Randevu verileri
 * @param {string} infoCardId - Bilgi kartı ID'si (ZORUNLU - sheet'ten)
 * @returns {string} HTML
 */
function generateAppointmentInfoBox(data, infoCardId) {
  const escapeHtml = (str) => {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  // v3.9.64: Debug logging
  log.info('[Mail] generateAppointmentInfoBox called with infoCardId:', infoCardId);
  log.info('[Mail] data keys:', Object.keys(data || {}).join(', '));
  log.info('[Mail] data.date:', data?.date, 'data.formattedDate:', data?.formattedDate);
  log.info('[Mail] data.time:', data?.time, 'data.profile:', data?.profile);

  // v3.9.69: Tamamen dinamik - Info Card ID ZORUNLU
  // Manuel fallback yok - tüm tanımlar sheet'ten gelir
  if (!infoCardId) {
    log.warn('[Mail] infoCardId tanımlı değil - info box oluşturulmadı');
    return '';
  }

  let rows = '';

  // Info Card'ı sheet'ten al
  try {
    const cards = SheetStorageService.getAll(MAIL_INFO_CARDS_SHEET);
    const card = cards.find(c => c.id === infoCardId);

    if (!card) {
      log.warn('[Mail] Info card bulunamadı:', infoCardId);
      return '';
    }

    const fields = parseJsonSafe(card.fields, []);
    const sortedFields = [...fields].sort((a, b) => (a.order || 0) - (b.order || 0));

    // Her field için: GLOBAL getVariableValue ile değer al
    for (const field of sortedFields) {
      let varKey = field.variable || '';
      // {{degisken}} formatını temizle
      varKey = varKey.replace(/\{\{?\s*/g, '').replace(/\s*\}?\}/g, '').trim();

      if (!varKey) continue;

      // ✅ GLOBAL SİSTEM: Variables.js'den getVariableValue ile değer al
      const value = getVariableValue(varKey, data);

      if (!value) continue;

      rows += `
        <tr>
          <td style="padding: 4px 0; color: #888888; width: 80px; vertical-align: top; font-size: 11px; font-weight: 300;">${escapeHtml(field.label || varKey)}</td>
          <td style="padding: 4px 0; color: #1a1a1a; font-size: 11px; font-weight: 400;">${escapeHtml(value)}</td>
        </tr>
      `;
    }
  } catch (err) {
    log.error('[Mail] generateAppointmentInfoBox error:', err);
    return '';
  }

  return `
    <div style="border-left: 3px solid #C9A55A; padding: 10px 15px; font-family: 'Montserrat', 'Segoe UI', Tahoma, sans-serif; background-color: #f9f9f9;">
      <h2 style="margin: 0 0 8px 0; font-size: 11px; font-weight: 500; letter-spacing: 1px; color: #1a1a1a;">RANDEVU BİLGİLERİ</h2>
      <table style="width: 100%; border-collapse: collapse;">${rows}</table>
    </div>
  `;
}

/**
 * ICS takvim dosyası oluştur
 * @param {Object} data - Randevu verileri
 * @returns {string} ICS içeriği
 */
function generateMailICS(data) {
  const date = data.date || data.appointmentDate?.split(',')[0]?.trim() || '';
  const time = data.time || data.appointmentTime || '10:00';
  const duration = data.duration || 60;
  const staffName = data.staffName || data.linkedStaffName || '';
  const staffPhone = data.staffPhone || '';
  const staffEmail = data.staffEmail || '';
  const appointmentType = data.appointmentType || '';
  const customerNote = data.customerNote || data.notes || '';
  const formattedDate = data.formattedDate || data.appointmentDate || '';

  // Tarih parse et (YYYY-MM-DD formatına çevir)
  let dateStr = date;
  if (!dateStr || dateStr.includes(',')) {
    // formattedDate'den parse et: "31 Aralık 2025, Çarşamba" gibi
    const dateMatch = formattedDate.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
    if (dateMatch) {
      const months = { 'Ocak': '01', 'Şubat': '02', 'Mart': '03', 'Nisan': '04', 'Mayıs': '05', 'Haziran': '06', 'Temmuz': '07', 'Ağustos': '08', 'Eylül': '09', 'Ekim': '10', 'Kasım': '11', 'Aralık': '12' };
      const day = dateMatch[1].padStart(2, '0');
      const month = months[dateMatch[2]] || '01';
      const year = dateMatch[3];
      dateStr = `${year}-${month}-${day}`;
    } else {
      // Bugünü kullan
      const now = new Date();
      dateStr = now.toISOString().split('T')[0];
    }
  }

  // Başlangıç ve bitiş zamanları
  const startDateTime = new Date(dateStr + 'T' + time + ':00');
  const endDateTime = new Date(startDateTime.getTime() + (duration * 60 * 1000));

  // Müşteri takvimi için randevu türü adı
  const appointmentTypeName = CONFIG.ICS_TEMPLATES?.CUSTOMER_TYPES?.[appointmentType] ||
    CONFIG.SERVICE_NAMES?.[appointmentType] || appointmentType || 'Görüşme';

  // Event başlığı
  const summary = `${CONFIG.COMPANY_NAME || 'Rolex İzmir İstinyepark'} - ${staffName || 'Randevu'} / ${appointmentTypeName}`;

  // Description
  let description = `RANDEVU BİLGİLERİ\\n\\n`;
  description += `İlgili: ${staffName}\\n`;
  description += `Telefon: ${staffPhone ? '+' + staffPhone : 'Belirtilmemiş'}\\n`;
  description += `E-posta: ${staffEmail || 'Belirtilmemiş'}\\n`;
  description += `Tarih: ${formattedDate}\\n`;
  description += `Saat: ${time}\\n`;
  description += `Konu: ${appointmentTypeName}\\n`;
  if (customerNote) {
    description += `Not: ${customerNote}\\n`;
  }
  description += `\\nLütfen randevunuza zamanında geliniz.`;

  // ICS tarih formatı - LOCAL time (UTC değil!)
  // TZID=Europe/Istanbul ile kullanıldığında local time olmalı
  const toICSDateLocal = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}T${hours}${minutes}${seconds}`;
  };

  // UTC için (DTSTAMP gibi)
  const toICSDateUTC = (d) => {
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };

  // Alarm zamanları
  const appointmentDate = new Date(dateStr);
  const alarmYear = appointmentDate.getFullYear();
  const alarmMonth = String(appointmentDate.getMonth() + 1).padStart(2, '0');
  const alarmDay = String(appointmentDate.getDate()).padStart(2, '0');
  const alarm10AM_UTC = `VALUE=DATE-TIME:${alarmYear}${alarmMonth}${alarmDay}T070000Z`;

  // ICS içeriği
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Rolex Boutique//Appointment System//TR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE',
    'TZID:Europe/Istanbul',
    'BEGIN:STANDARD',
    'DTSTART:19701025T040000',
    'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10',
    'TZOFFSETFROM:+0300',
    'TZOFFSETTO:+0300',
    'TZNAME:+03',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:rolex-${Date.now()}@istinyepark.com`,
    `DTSTAMP:${toICSDateUTC(new Date())}Z`,
    `DTSTART;TZID=Europe/Istanbul:${toICSDateLocal(startDateTime)}`,
    `DTEND;TZID=Europe/Istanbul:${toICSDateLocal(endDateTime)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${CONFIG.COMPANY_LOCATION || 'Rolex İzmir İstinyepark'}`,
    'STATUS:CONFIRMED',
    `ORGANIZER;CN=Rolex Boutique:mailto:${CONFIG.COMPANY_EMAIL || 'info@rolex.com'}`,
    // ALARM 1: 1 saat önce
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    `DESCRIPTION:Randevunuz 1 saat sonra: ${summary}`,
    'END:VALARM',
    // ALARM 2: 1 gün önce
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    `DESCRIPTION:Randevunuz yarın: ${summary}`,
    'END:VALARM',
    // ALARM 3: Randevu günü sabah 10:00
    'BEGIN:VALARM',
    `TRIGGER;${alarm10AM_UTC}`,
    'ACTION:DISPLAY',
    `DESCRIPTION:Bugün randevunuz var: ${summary}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  return icsContent;
}

/**
 * Schema.org Event microdata + JSON-LD oluştur
 * - Apple Mail/Siri: Microdata formatını algılar
 * - Gmail: JSON-LD formatını algılar (Events from Gmail)
 * v3.9.50: Siri + Gmail Event Detection
 *
 * @param {Object} data - Randevu verileri
 * @returns {string} HTML (microdata + JSON-LD script)
 */
function generateEventMicrodata(data) {
  try {
    // Tarih ve saat bilgilerini parse et
    const date = data.date || '';
    const time = data.time || data.appointmentTime || '10:00';
    const duration = data.duration || 60;
    const formattedDate = data.formattedDate || data.appointmentDate || '';

    // Tarih parse et (YYYY-MM-DD formatına çevir)
    let dateStr = date;
    if (!dateStr || dateStr.includes(',')) {
      // formattedDate'den parse et: "31 Aralık 2025, Çarşamba" gibi
      const dateMatch = formattedDate.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
      if (dateMatch) {
        const months = {
          'Ocak': '01', 'Şubat': '02', 'Mart': '03', 'Nisan': '04',
          'Mayıs': '05', 'Haziran': '06', 'Temmuz': '07', 'Ağustos': '08',
          'Eylül': '09', 'Ekim': '10', 'Kasım': '11', 'Aralık': '12'
        };
        const day = dateMatch[1].padStart(2, '0');
        const month = months[dateMatch[2]] || '01';
        const year = dateMatch[3];
        dateStr = `${year}-${month}-${day}`;
      } else {
        // Bugünü kullan
        const now = new Date();
        dateStr = now.toISOString().split('T')[0];
      }
    }

    // ISO 8601 tarih/saat formatı (Türkiye: +03:00)
    const startDateTime = `${dateStr}T${time}:00+03:00`;

    // Bitiş zamanı hesapla
    const [hours, minutes] = time.split(':').map(Number);
    const endMinutes = hours * 60 + minutes + duration;
    const endHours = Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;
    const endTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
    const endDateTime = `${dateStr}T${endTime}:00+03:00`;

    // Event bilgileri
    const staffName = data.staffName || data.linkedStaffName || '';
    const appointmentType = data.appointmentType || data.type || '';
    const appointmentTypeName = CONFIG.SERVICE_NAMES?.[appointmentType] || appointmentType || 'Görüşme';
    const storeName = CONFIG.COMPANY_NAME || 'Rolex İzmir İstinyepark';
    const location = CONFIG.COMPANY_LOCATION || 'İstinyepark AVM, İzmir';
    const companyEmail = CONFIG.COMPANY_EMAIL || 'info@rolex.com';

    // Event title
    const eventName = `${storeName} - ${staffName || 'Randevu'} / ${appointmentTypeName}`;
    const eventDescription = `Randevu: ${appointmentTypeName}${staffName ? ' - ' + staffName : ''}`;

    // JSON-LD for Gmail (Events from Gmail feature)
    const jsonLdData = {
      "@context": "http://schema.org",
      "@type": "Event",
      "name": eventName,
      "startDate": startDateTime,
      "endDate": endDateTime,
      "location": {
        "@type": "Place",
        "name": storeName,
        "address": {
          "@type": "PostalAddress",
          "streetAddress": location,
          "addressLocality": "İzmir",
          "addressCountry": "TR"
        }
      },
      "description": eventDescription,
      "organizer": {
        "@type": "Organization",
        "name": storeName,
        "url": "https://www.rolex.com",
        "email": companyEmail
      }
    };

    // JSON-LD script (Gmail detection)
    const jsonLdScript = `<script type="application/ld+json">${JSON.stringify(jsonLdData)}</script>`;

    // Microdata (Apple Mail/Siri detection) + JSON-LD
    return `
      ${jsonLdScript}
      <div itemscope itemtype="http://schema.org/Event" style="display:none;">
        <meta itemprop="name" content="${escapeHtmlAttr(eventName)}" />
        <meta itemprop="startDate" content="${startDateTime}" />
        <meta itemprop="endDate" content="${endDateTime}" />
        <div itemprop="location" itemscope itemtype="http://schema.org/Place">
          <meta itemprop="name" content="${escapeHtmlAttr(storeName)}" />
          <div itemprop="address" itemscope itemtype="http://schema.org/PostalAddress">
            <meta itemprop="streetAddress" content="${escapeHtmlAttr(location)}" />
            <meta itemprop="addressLocality" content="İzmir" />
            <meta itemprop="addressCountry" content="TR" />
          </div>
        </div>
        <meta itemprop="description" content="${escapeHtmlAttr(eventDescription)}" />
        <div itemprop="organizer" itemscope itemtype="http://schema.org/Organization">
          <meta itemprop="name" content="${escapeHtmlAttr(storeName)}" />
          <meta itemprop="url" content="https://www.rolex.com" />
        </div>
      </div>
    `;
  } catch (error) {
    log.warn('[Mail] Event microdata oluşturulamadı:', error);
    return '';
  }
}

/**
 * HTML attribute için escape (XSS koruması)
 */
function escapeHtmlAttr(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Trigger'a göre mail gönder
 * Bu fonksiyon Appointments.js'den çağrılır
 *
 * HER MAİLDE:
 * 1. Randevu Bilgileri kutusu (varsayılan)
 * 2. Template body (özelleştirilebilir)
 * 3. ICS takvim eki (müşteri mailleri için)
 *
 * @param {string} trigger - Trigger türü (RANDEVU_OLUŞTUR, RANDEVU_İPTAL, etc.)
 * @param {string} profileCode - Profil kodu (g, w, b, m, s, v)
 * @param {Object} appointmentData - Randevu bilgileri
 */
function sendMailByTrigger(trigger, profileCode, appointmentData) {
  try {
    // v3.9.49: Debug - appointmentData içeriğini logla
    log.info('[Mail] sendMailByTrigger called with trigger:', trigger, 'profile:', profileCode);
    log.info('[Mail] appointmentData keys:', Object.keys(appointmentData || {}).join(', '));
    log.info('[Mail] appointmentData.formattedDate:', appointmentData?.formattedDate);
    log.info('[Mail] appointmentData.appointmentDate:', appointmentData?.appointmentDate);
    log.info('[Mail] appointmentData.date:', appointmentData?.date);
    log.info('[Mail] appointmentData.time:', appointmentData?.time);
    log.info('[Mail] appointmentData.profileName:', appointmentData?.profileName);

    // v3.10.0: Aktif ve bu trigger + profile için tanımlı notification flow'ları bul
    const allFlows = SheetStorageService.getAll(NOTIFICATION_FLOWS_SHEET);
    const matchingFlows = allFlows.filter(flow => {
      if (!flow.active && flow.active !== 'true') return false;
      // v3.10.0: trigger artık tek değer (array değil)
      const flowTrigger = String(flow.trigger || '');
      if (flowTrigger !== trigger) return false;
      const profiles = parseJsonSafe(flow.profiles, []);
      return profiles.includes(profileCode);
    });

    if (matchingFlows.length === 0) {
      log.info('[Mail] Bu trigger ve profil için notification flow bulunamadı:', trigger, profileCode);
      return { success: true, message: 'No matching flows' };
    }

    // Her eşleşen flow için mail gönder
    const results = [];
    const allTemplates = SheetStorageService.getAll(MAIL_TEMPLATE_SHEET); // Önce tüm template'leri al

    for (const flow of matchingFlows) {
      // v3.10.0: mailTemplateIds kullan (unified flow structure)
      const templateIds = parseJsonSafe(flow.mailTemplateIds, []);

      if (templateIds.length === 0) {
        log.warn('[Mail] Flow template ID yok:', flow.id);
        continue;
      }

      // Her template için ayrı mail gönder (v3.9.74: multiple templates)
      for (const templateId of templateIds) {
        const template = allTemplates.find(t => t.id === templateId);

        if (!template) {
          log.warn('[Mail] Template bulunamadı:', templateId);
          continue;
        }

        // Variable'ları değiştir (Variables.js'den)
        const subject = replaceMessageVariables(template.subject, appointmentData);
        const templateBody = replaceMessageVariables(template.body || '', appointmentData);

        // v3.9.74: Hedef email adreslerini template'den al (recipient field)
        const target = template.recipient || 'customer';
        let recipients = []; // { email, type } dizisi

        if (target === 'admin') {
          // Tüm isAdmin=true personelleri al
          try {
            const allStaff = StaffService.getAll();
            const admins = allStaff.filter(s => s.active && s.isAdmin === true);
            log.info('[Mail] Admin hedefi - bulunan admin sayısı:', admins.length);

            for (const admin of admins) {
              if (admin.email) {
                recipients.push({ email: admin.email, type: 'Admin: ' + admin.name });
              }
            }

            if (recipients.length === 0) {
              log.warn('[Mail] Hiç admin bulunamadı veya adminlerin email adresi yok');
              continue;
            }
          } catch (adminError) {
            log.error('[Mail] Admin listesi alınırken hata:', adminError);
            continue;
          }
        } else if (target === 'staff') {
          const staffEmail = appointmentData.staffEmail || appointmentData.linkedStaffEmail;
          if (staffEmail) {
            recipients.push({ email: staffEmail, type: 'Personel' });
          }
        } else if (target === 'role_sales') {
          // Satış rolündeki personeller
          try {
            const allStaff = StaffService.getAll();
            const salesStaff = allStaff.filter(s => s.active && s.role === 'sales');
            for (const staff of salesStaff) {
              if (staff.email) {
                recipients.push({ email: staff.email, type: 'Satış: ' + staff.name });
              }
            }
          } catch (roleError) {
            log.error('[Mail] Satış rolü listesi alınırken hata:', roleError);
          }
        } else if (target === 'role_greeter') {
          // Karşılayıcı rolündeki personeller
          try {
            const allStaff = StaffService.getAll();
            const greeterStaff = allStaff.filter(s => s.active && s.role === 'greeter');
            for (const staff of greeterStaff) {
              if (staff.email) {
                recipients.push({ email: staff.email, type: 'Karşılayıcı: ' + staff.name });
              }
            }
          } catch (roleError) {
            log.error('[Mail] Karşılayıcı rolü listesi alınırken hata:', roleError);
          }
        } else {
          // customer (varsayılan)
          const customerEmail = appointmentData.email || appointmentData.customerEmail;
          if (customerEmail) {
            recipients.push({ email: customerEmail, type: 'Müşteri' });
          }
        }

        if (recipients.length === 0) {
          log.warn('[Mail] Hedef için email adresi bulunamadı, target:', target, 'template:', templateId);
          continue;
        }

        // ===== EMAIL BODY OLUŞTUR =====
        // 1. Randevu Bilgileri kutusu (v3.10.0: infoCardId sadece template'de)
        const infoCardId = template.infoCardId || '';
        log.info('[Mail] Template infoCardId:', template.infoCardId, ', templateId:', templateId);
        log.info('[Mail] appointmentData:', JSON.stringify({
          formattedDate: appointmentData.formattedDate,
          time: appointmentData.time,
          profileName: appointmentData.profileName,
          profile: appointmentData.profile
        }));
        const appointmentInfoBox = generateAppointmentInfoBox(appointmentData, infoCardId);

        // 2. Template body (özelleştirilebilir içerik)
        // Satır sonlarını <br> etiketine çevir (paragraf boşlukları korunsun)
        const formattedBody = templateBody
          ? templateBody
              .replace(/\r\n/g, '\n')           // Windows satır sonlarını normalize et
              .replace(/\n\n+/g, '</p><p>')     // Çift+ satır sonu = yeni paragraf
              .replace(/\n/g, '<br>')           // Tek satır sonu = <br>
          : '';
        const customContent = formattedBody ? `
          <div style="font-family: 'Montserrat', 'Segoe UI', Tahoma, sans-serif; padding: 15px 0; line-height: 1.6; color: #333; font-size: 12px;">
            <p style="margin: 0 0 12px 0;">${formattedBody}</p>
          </div>
        ` : '';

        // v3.9.49: Schema.org Event microdata - Siri/Apple Mail takvim algılaması için
        const eventMicrodata = generateEventMicrodata(appointmentData);

        // Tam HTML body (Footer template içinde olmalı, otomatik ekleme yok)
        const fullHtmlBody = `
          <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: 'Montserrat', 'Segoe UI', Tahoma, sans-serif;">
            ${eventMicrodata}
            ${appointmentInfoBox}
            ${customContent}
          </div>
        `;

        // ===== ICS EKİ (Sadece müşteri mailleri için) =====
        let attachments = [];
        if (target === 'customer' && trigger !== 'RANDEVU_İPTAL') {
          try {
            const icsContent = generateMailICS(appointmentData);
            const icsBlob = Utilities.newBlob(icsContent, 'text/calendar', 'randevu.ics');
            attachments.push(icsBlob);
          } catch (icsError) {
            log.warn('[Mail] ICS oluşturulamadı:', icsError);
          }
        }

        // ===== MAİL GÖNDER (v3.9.74: çoklu template + çoklu alıcı desteği) =====
        for (const recipient of recipients) {
          try {
            const mailOptions = {
              to: recipient.email,
              subject: subject,
              htmlBody: fullHtmlBody,
              name: CONFIG.COMPANY_NAME || 'Rolex Boutique'
            };

            if (attachments.length > 0) {
              mailOptions.attachments = attachments;
            }

            // ReplyTo ekle (personel emaili varsa)
            if (appointmentData.staffEmail) {
              mailOptions.replyTo = appointmentData.staffEmail;
            }

            MailApp.sendEmail(mailOptions);

            log.info('[Mail] Mail gönderildi (' + recipient.type + '):', recipient.email, subject);
            results.push({ flow: flow.id, templateId: templateId, email: recipient.email, target: target, recipientType: recipient.type, success: true });
          } catch (mailError) {
            log.error('[Mail] Mail gönderim hatası (' + recipient.type + '):', mailError);
            results.push({ flow: flow.id, templateId: templateId, email: recipient.email, target: target, recipientType: recipient.type, success: false, error: mailError.toString() });
          }
        }
      }
    }

    return { success: true, results: results };
  } catch (error) {
    log.error('sendMailByTrigger error:', error);
    return { success: false, error: error.toString() };
  }
}

// Değişken değiştirme: Variables.js'deki replaceMessageVariables() kullanılır

// ==================== HEADER SYNC (v3.9.47) ====================

/**
 * Mail sheet'lerinin header'larını senkronize et
 * v3.9.47: Eksik kolonları otomatik ekler (örn: infoCardId)
 * API endpoint: action=syncMailSheetHeaders
 */
function syncMailSheetHeaders() {
  try {
    // v3.10.0: MAIL_FLOWS kaldırıldı, notification_flows eklendi
    const results = {
      notification_flows: SheetStorageService.syncSheetHeaders(NOTIFICATION_FLOWS_SHEET),
      mail_templates: SheetStorageService.syncSheetHeaders(MAIL_TEMPLATE_SHEET),
      mail_info_cards: SheetStorageService.syncSheetHeaders(MAIL_INFO_CARDS_SHEET)
    };

    log.info('syncMailSheetHeaders tamamlandı:', results);

    return {
      success: true,
      results: results,
      message: 'Mail sheet header\'ları senkronize edildi'
    };
  } catch (error) {
    log.error('syncMailSheetHeaders error:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * MAIL_FLOWS sheet header'larını debug et
 * v3.9.47: Eksik kolonları tespit et
 * API endpoint: action=debugMailFlowsHeaders
 */
function debugMailFlowsHeadersApi() {
  return debugMailFlowsHeaders();
}

// ==================== MIGRATION ====================

/**
 * v3.9.60: Tüm info card'lara zorunlu değişkenleri ekle
 * API endpoint: action=migrateInfoCardFields
 *
 * Bu migration tüm info card'lara randevu_tarihi, randevu_saati, randevu_profili
 * ekler (eğer yoksa). Bu şekilde hangi card kullanılırsa kullanılsın,
 * tarih/saat/profil her zaman gösterilir.
 */
function migrateInfoCardFields() {
  try {
    const cards = SheetStorageService.getAll(MAIL_INFO_CARDS_SHEET) || [];
    const results = [];

    // Eklenecek zorunlu alanlar (en başa, sırasıyla)
    const requiredFields = [
      { variable: 'randevu_tarihi', label: 'Tarih', order: 0 },
      { variable: 'randevu_saati', label: 'Saat', order: 1 },
      { variable: 'randevu_profili', label: 'Profil', order: 2 }
    ];

    for (const card of cards) {
      let fields = parseJsonSafe(card.fields, []);
      let modified = false;

      // Mevcut field'ların variable'larını al
      const existingVars = fields.map(f => (f.variable || '').toLowerCase().replace(/\{\{?\s*/g, '').replace(/\s*\}?\}/g, '').trim());

      // Zorunlu alanları kontrol et ve ekle
      for (const required of requiredFields) {
        const varLower = required.variable.toLowerCase();
        const alreadyExists = existingVars.some(v =>
          v === varLower ||
          v.includes(varLower.replace('randevu_', ''))
        );

        if (!alreadyExists) {
          // Mevcut field'ların order'larını kaydır
          fields = fields.map(f => ({
            ...f,
            order: (f.order || 0) + 10
          }));

          // Yeni alanı ekle
          fields.unshift({
            variable: required.variable,
            label: required.label,
            order: required.order
          });

          modified = true;
          log.info('[Migration] Card ' + card.id + ' -> ' + required.variable + ' eklendi');
        }
      }

      // Değişiklik varsa güncelle
      if (modified) {
        // Sıralamayı düzelt
        fields.sort((a, b) => (a.order || 0) - (b.order || 0));
        fields = fields.map((f, idx) => ({ ...f, order: idx }));

        SheetStorageService.update(MAIL_INFO_CARDS_SHEET, card.id, {
          fields: JSON.stringify(fields),
          updatedAt: new Date().toISOString()
        });

        results.push({ cardId: card.id, cardName: card.name, status: 'updated', fieldsCount: fields.length });
      } else {
        results.push({ cardId: card.id, cardName: card.name, status: 'unchanged' });
      }
    }

    return {
      success: true,
      message: 'Migration tamamlandı',
      results: results,
      totalCards: cards.length,
      updatedCards: results.filter(r => r.status === 'updated').length
    };
  } catch (error) {
    log.error('migrateInfoCardFields error:', error);
    return { success: false, error: error.toString() };
  }
}

// ==================== NOTIFICATION FLOW MANAGEMENT (v3.10.0) ====================

/**
 * Tüm bildirim akışlarını getir
 * v3.10.0: getUnifiedFlows -> getNotificationFlows
 */
function getNotificationFlows() {
  try {
    var rawFlows = SheetStorageService.getAll(NOTIFICATION_FLOWS_SHEET) || [];

    var validFlows = rawFlows.filter(function(flow) {
      var id = String(flow.id || '').trim();
      return id.length > 10;
    });

    return {
      success: true,
      data: validFlows.map(function(flow) {
        return {
          id: String(flow.id),
          name: String(flow.name || ''),
          description: String(flow.description || ''),
          trigger: String(flow.trigger || ''),
          profiles: parseJsonSafe(flow.profiles, []),
          whatsappTemplateIds: parseJsonSafe(flow.whatsappTemplateIds, []),
          mailTemplateIds: parseJsonSafe(flow.mailTemplateIds, []),
          active: flow.active === true || flow.active === 'true'
        };
      })
    };
  } catch (error) {
    log.error('getNotificationFlows error:', error);
    return { success: false, error: error.toString() };
  }
}

// Backward compatibility alias
function getUnifiedFlows() {
  return getNotificationFlows();
}

/**
 * Yeni bildirim akışı oluştur
 * v3.10.0: createUnifiedFlow -> createNotificationFlow
 */
function createNotificationFlow(params) {
  try {
    var id = Utilities.getUuid();
    var flow = {
      id: id,
      name: params.name,
      description: params.description || '',
      trigger: params.trigger,
      profiles: JSON.stringify(params.profiles || []),
      whatsappTemplateIds: JSON.stringify(params.whatsappTemplateIds || []),
      mailTemplateIds: JSON.stringify(params.mailTemplateIds || []),
      active: true,
      createdAt: new Date().toISOString()
    };

    SheetStorageService.add(NOTIFICATION_FLOWS_SHEET, flow);

    return {
      success: true,
      data: { id: id },
      message: 'Akış oluşturuldu'
    };
  } catch (error) {
    log.error('createNotificationFlow error:', error);
    return { success: false, error: error.toString() };
  }
}

// Backward compatibility alias
function createUnifiedFlow(params) {
  return createNotificationFlow(params);
}

/**
 * Bildirim akışı güncelle
 * v3.10.0: updateUnifiedFlow -> updateNotificationFlow
 */
function updateNotificationFlow(params) {
  try {
    if (!params.id) {
      return { success: false, error: 'Flow ID gerekli' };
    }

    var updates = {};

    if (params.name !== undefined) updates.name = params.name;
    if (params.description !== undefined) updates.description = params.description;
    if (params.trigger !== undefined) updates.trigger = params.trigger;
    if (params.profiles !== undefined) updates.profiles = JSON.stringify(params.profiles);
    if (params.whatsappTemplateIds !== undefined) updates.whatsappTemplateIds = JSON.stringify(params.whatsappTemplateIds);
    if (params.mailTemplateIds !== undefined) updates.mailTemplateIds = JSON.stringify(params.mailTemplateIds);
    if (params.active !== undefined) updates.active = params.active;

    updates.updatedAt = new Date().toISOString();

    SheetStorageService.update(NOTIFICATION_FLOWS_SHEET, params.id, updates);

    return {
      success: true,
      message: 'Akış güncellendi'
    };
  } catch (error) {
    log.error('updateNotificationFlow error:', error);
    return { success: false, error: error.toString() };
  }
}

// Backward compatibility alias
function updateUnifiedFlow(params) {
  return updateNotificationFlow(params);
}

/**
 * Bildirim akışı sil
 * v3.10.0: deleteUnifiedFlow -> deleteNotificationFlow
 */
function deleteNotificationFlow(params) {
  try {
    if (!params.id) {
      return { success: false, error: 'Flow ID gerekli' };
    }

    SheetStorageService.delete(NOTIFICATION_FLOWS_SHEET, params.id);

    return {
      success: true,
      message: 'Akış silindi'
    };
  } catch (error) {
    log.error('deleteNotificationFlow error:', error);
    return { success: false, error: error.toString() };
  }
}

// Backward compatibility alias
function deleteUnifiedFlow(params) {
  return deleteNotificationFlow(params);
}

// ==================== HELPER FUNCTIONS ====================

/**
 * JSON string'i güvenli şekilde parse et
 */
function parseJsonSafe(jsonStr, defaultValue) {
  if (!jsonStr) return defaultValue;
  if (typeof jsonStr !== 'string') return jsonStr;
  try {
    return JSON.parse(jsonStr);
  } catch (error) {
    return defaultValue;
  }
}
