/**
 * Mail.js
 *
 * Mail Flow ve Template Yönetimi
 *
 * Bu modül mail gönderim akışlarını ve şablonlarını yönetir.
 * - Flow CRUD işlemleri
 * - Template CRUD işlemleri
 * - Flow'a göre mail gönderimi
 *
 * Storage: SheetStorageService kullanır
 * - MAIL_FLOWS sheet'i (id, name, description, profiles, triggers, templateId, active)
 * - MAIL_TEMPLATES sheet'i (id, name, subject, body)
 */

// ==================== CONSTANTS ====================

const MAIL_FLOW_SHEET = 'MAIL_FLOWS';
const MAIL_TEMPLATE_SHEET = 'MAIL_TEMPLATES';
const MAIL_INFO_CARDS_SHEET = 'MAIL_INFO_CARDS';

// Değişkenler Variables.js'den gelir (MESSAGE_VARIABLES)
// Mail şablonlarında {{musteri}}, {{randevu_tarihi}} vb. kullanılır

// Trigger türleri
const MAIL_TRIGGERS = {
  'RANDEVU_OLUŞTUR': 'Randevu Oluşturuldu',
  'RANDEVU_İPTAL': 'Randevu İptal Edildi',
  'RANDEVU_GÜNCELLE': 'Randevu Güncellendi',
  'HATIRLATMA': 'Hatırlatma',
  'ILGILI_ATANDI': 'İlgili Atandı'
};

// Hedef türleri
const MAIL_TARGETS = {
  'customer': 'Müşteri',
  'staff': 'Personel'
};

// ==================== FLOW MANAGEMENT ====================

/**
 * Tüm mail flow'larını getir
 */
function getMailFlows() {
  try {
    const rawFlows = SheetStorageService.getAll(MAIL_FLOW_SHEET) || [];

    // Debug: Ham veriyi logla
    log.info('getMailFlows - Raw data count:', rawFlows.length);

    // Geçersiz kayıtları filtrele (String() ile tip güvenliği)
    const validFlows = rawFlows.filter(flow => {
      const id = String(flow.id || '').trim();
      return id.length > 10;
    });

    log.info('getMailFlows - Valid flows count:', validFlows.length);

    return {
      success: true,
      data: validFlows.map(flow => ({
        id: String(flow.id),
        name: String(flow.name || ''),
        description: String(flow.description || ''),
        profiles: parseJsonSafe(flow.profiles, []),
        triggers: parseJsonSafe(flow.triggers, []),
        templateId: String(flow.templateId || ''),
        infoCardId: String(flow.infoCardId || ''),
        target: String(flow.target || 'customer'),
        active: flow.active === true || flow.active === 'true'
      }))
    };
  } catch (error) {
    log.error('getMailFlows error:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Yeni mail flow oluştur
 */
function createMailFlow(params) {
  try {
    const id = Utilities.getUuid();
    const flow = {
      id: id,
      name: params.name,
      description: params.description || '',
      profiles: JSON.stringify(params.profiles || []),
      triggers: JSON.stringify(params.triggers || []),
      templateId: params.templateId || '',
      infoCardId: params.infoCardId || '', // Bilgi kartı ID'si
      target: params.target || 'customer', // customer veya staff
      active: true,
      createdAt: new Date().toISOString()
    };

    SheetStorageService.add(MAIL_FLOW_SHEET, flow);

    return {
      success: true,
      data: { id: id },
      message: 'Flow oluşturuldu'
    };
  } catch (error) {
    log.error('createMailFlow error:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Mail flow güncelle
 * ✅ v3.9.47: Detaylı logging eklendi
 */
function updateMailFlow(params) {
  try {
    if (!params.id) {
      return { success: false, error: 'Flow ID gerekli' };
    }

    const updates = {};

    if (params.name !== undefined) updates.name = params.name;
    if (params.description !== undefined) updates.description = params.description;
    if (params.profiles !== undefined) updates.profiles = JSON.stringify(params.profiles);
    if (params.triggers !== undefined) updates.triggers = JSON.stringify(params.triggers);
    if (params.templateId !== undefined) updates.templateId = params.templateId;
    if (params.infoCardId !== undefined) updates.infoCardId = params.infoCardId;
    if (params.target !== undefined) updates.target = params.target;
    if (params.active !== undefined) updates.active = params.active;

    updates.updatedAt = new Date().toISOString();

    // ✅ v3.9.47: Detaylı logging
    log.info('updateMailFlow - Güncelleniyor:', {
      id: params.id,
      updates: updates,
      infoCardId: params.infoCardId
    });

    const result = SheetStorageService.update(MAIL_FLOW_SHEET, params.id, updates);

    log.info('updateMailFlow - SheetStorageService.update sonucu:', result);

    return {
      success: true,
      message: 'Flow güncellendi'
    };
  } catch (error) {
    log.error('updateMailFlow error:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Mail flow sil
 */
function deleteMailFlow(params) {
  try {
    if (!params.id) {
      return { success: false, error: 'Flow ID gerekli' };
    }

    SheetStorageService.delete(MAIL_FLOW_SHEET, params.id);

    return {
      success: true,
      message: 'Flow silindi'
    };
  } catch (error) {
    log.error('deleteMailFlow error:', error);
    return { success: false, error: error.toString() };
  }
}

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
        body: String(template.body || '')
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

    return {
      success: true,
      data: validCards.map(card => ({
        id: String(card.id),
        name: String(card.name || ''),
        fields: parseJsonSafe(card.fields, [])
      }))
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
 * @param {Object} data - Randevu verileri (replacedVariables)
 * @param {string} infoCardId - Bilgi kartı ID'si (opsiyonel)
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

  // Eğer infoCardId varsa, bilgi kartı şablonunu kullan
  if (infoCardId) {
    try {
      const cards = SheetStorageService.getAll(MAIL_INFO_CARDS_SHEET);
      const card = cards.find(c => c.id === infoCardId);

      if (card) {
        const fields = parseJsonSafe(card.fields, []);

        // Sıralı field'lara göre satır oluştur
        const sortedFields = [...fields].sort((a, b) => (a.order || 0) - (b.order || 0));

        let rowsHtml = '';
        for (const field of sortedFields) {
          // Variable değerini getir (replacedVariables'dan)
          const varKey = field.variable || '';
          let value = '';

          // Variables.js'deki değişken haritasından değeri al
          if (varKey === 'randevu_tarih') {
            value = data.formattedDate || data.appointmentDate || '';
          } else if (varKey === 'randevu_saat') {
            value = data.time || data.appointmentTime || '';
          } else if (varKey === 'randevu_turu') {
            const appointmentType = data.appointmentType || '';
            value = CONFIG.SERVICE_NAMES?.[appointmentType] || appointmentType || '';
          } else if (varKey === 'personel') {
            value = data.staffName || data.linkedStaffName || '';
          } else if (varKey === 'personel_tel') {
            value = data.staffPhone ? '+' + data.staffPhone : '';
          } else if (varKey === 'personel_mail') {
            value = data.staffEmail || '';
          } else if (varKey === 'magaza') {
            value = CONFIG.COMPANY_NAME || 'Rolex İzmir İstinyepark';
          } else if (varKey === 'randevu_ek_bilgi') {
            value = data.customerNote || data.notes || '';
          } else if (varKey === 'musteri') {
            value = data.customerName || data.name || '';
          } else if (varKey === 'musteri_tel') {
            value = data.customerPhone || data.phone || '';
          } else if (varKey === 'musteri_mail') {
            value = data.customerEmail || data.email || '';
          } else if (varKey === 'randevu_profili') {
            value = data.profileName || '';
          }

          // Boş değer ise satırı gösterme
          if (!value) continue;

          rowsHtml += `
            <tr>
              <td style="padding: 10px 0; color: #666666; width: 130px; vertical-align: top; font-size: 15px;">${escapeHtml(field.label || varKey)}</td>
              <td style="padding: 10px 0; color: #1a1a1a; font-size: 15px;">${escapeHtml(value)}</td>
            </tr>
          `;
        }

        return `
          <div style="border-left: 4px solid #C9A55A; padding: 25px 30px; font-family: 'Montserrat', 'Segoe UI', Tahoma, sans-serif; background-color: #f9f9f9;">
            <h2 style="margin: 0 0 25px 0; font-size: 18px; font-weight: 400; letter-spacing: 0.5px; color: #1a1a1a;">RANDEVU BİLGİLERİ</h2>
            <table style="width: 100%; border-collapse: collapse;">
              ${rowsHtml}
            </table>
          </div>
        `;
      }
    } catch (err) {
      log.warn('[Mail] Info card yüklenirken hata:', err);
    }
  }

  // Varsayılan (default) info box - eski davranış
  const formattedDate = data.formattedDate || data.appointmentDate || '';
  const time = data.time || data.appointmentTime || '';
  const appointmentType = data.appointmentType || '';
  const serviceName = CONFIG.SERVICE_NAMES?.[appointmentType] || appointmentType || 'Görüşme';
  const staffName = data.staffName || data.linkedStaffName || 'Atanmadı';
  const storeName = CONFIG.COMPANY_NAME || 'Rolex İzmir İstinyepark';
  const customerNote = data.customerNote || data.notes || '';

  return `
    <div style="border-left: 4px solid #C9A55A; padding: 25px 30px; font-family: 'Montserrat', 'Segoe UI', Tahoma, sans-serif; background-color: #f9f9f9;">
      <h2 style="margin: 0 0 25px 0; font-size: 18px; font-weight: 400; letter-spacing: 0.5px; color: #1a1a1a;">RANDEVU BİLGİLERİ</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 10px 0; color: #666666; width: 130px; vertical-align: top; font-size: 15px;">Tarih</td>
          <td style="padding: 10px 0; color: #1a1a1a; font-size: 15px;">${escapeHtml(formattedDate)}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; color: #666666; vertical-align: top; font-size: 15px;">Saat</td>
          <td style="padding: 10px 0; color: #1a1a1a; font-size: 15px;">${escapeHtml(time)}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; color: #666666; vertical-align: top; font-size: 15px;">Konu</td>
          <td style="padding: 10px 0; color: #1a1a1a; font-size: 15px;">${escapeHtml(serviceName)}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; color: #666666; vertical-align: top; font-size: 15px;">İlgili</td>
          <td style="padding: 10px 0; color: #1a1a1a; font-size: 15px;">${escapeHtml(staffName)}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; color: #666666; vertical-align: top; font-size: 15px;">Mağaza</td>
          <td style="padding: 10px 0; color: #1a1a1a; font-size: 15px;">${escapeHtml(storeName)}</td>
        </tr>
        ${customerNote ? `
        <tr>
          <td style="padding: 10px 0; color: #666666; vertical-align: top; font-size: 15px;">Ek Bilgi</td>
          <td style="padding: 10px 0; color: #1a1a1a; font-size: 15px;">${escapeHtml(customerNote)}</td>
        </tr>
        ` : ''}
      </table>
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
    // Aktif ve bu trigger + profile için tanımlı flow'ları bul
    const allFlows = SheetStorageService.getAll(MAIL_FLOW_SHEET);
    const matchingFlows = allFlows.filter(flow => {
      if (!flow.active && flow.active !== 'true') return false;
      const triggers = parseJsonSafe(flow.triggers, []);
      if (!triggers.includes(trigger)) return false;
      const profiles = parseJsonSafe(flow.profiles, []);
      return profiles.includes(profileCode);
    });

    if (matchingFlows.length === 0) {
      log.info('[Mail] Bu trigger ve profil için flow bulunamadı:', trigger, profileCode);
      return { success: true, message: 'No matching flows' };
    }

    // Her eşleşen flow için mail gönder
    const results = [];
    for (const flow of matchingFlows) {
      if (!flow.templateId) {
        log.warn('[Mail] Flow template ID yok:', flow.id);
        continue;
      }

      // Template'i al
      const templates = SheetStorageService.getAll(MAIL_TEMPLATE_SHEET);
      const template = templates.find(t => t.id === flow.templateId);

      if (!template) {
        log.warn('[Mail] Template bulunamadı:', flow.templateId);
        continue;
      }

      // Variable'ları değiştir (Variables.js'den)
      const subject = replaceMessageVariables(template.subject, appointmentData);
      const templateBody = replaceMessageVariables(template.body || '', appointmentData);

      // Hedef email adresini belirle
      const target = flow.target || 'customer';
      let email = null;
      let recipientType = '';

      if (target === 'staff') {
        email = appointmentData.staffEmail || appointmentData.linkedStaffEmail;
        recipientType = 'Personel';
      } else {
        email = appointmentData.email || appointmentData.customerEmail;
        recipientType = 'Müşteri';
      }

      if (!email) {
        log.warn('[Mail] ' + recipientType + ' email adresi yok, mail gönderilemedi');
        continue;
      }

      // ===== EMAIL BODY OLUŞTUR =====
      // 1. Randevu Bilgileri kutusu (flow'a bağlı bilgi kartı veya varsayılan)
      const infoCardId = flow.infoCardId || '';
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
        <div style="font-family: 'Montserrat', 'Segoe UI', Tahoma, sans-serif; padding: 20px 0; line-height: 1.8; color: #333; font-size: 15px;">
          <p style="margin: 0 0 15px 0;">${formattedBody}</p>
        </div>
      ` : '';

      // Tam HTML body (Footer template içinde olmalı, otomatik ekleme yok)
      const fullHtmlBody = `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: 'Montserrat', 'Segoe UI', Tahoma, sans-serif;">
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

      // ===== MAİL GÖNDER =====
      try {
        const mailOptions = {
          to: email,
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

        log.info('[Mail] Mail gönderildi (' + recipientType + '):', email, subject);
        results.push({ flow: flow.id, email: email, target: target, success: true });
      } catch (mailError) {
        log.error('[Mail] Mail gönderim hatası:', mailError);
        results.push({ flow: flow.id, email: email, target: target, success: false, error: mailError.toString() });
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
    const results = {
      MAIL_FLOWS: SheetStorageService.syncSheetHeaders(MAIL_FLOW_SHEET),
      MAIL_TEMPLATES: SheetStorageService.syncSheetHeaders(MAIL_TEMPLATE_SHEET),
      MAIL_INFO_CARDS: SheetStorageService.syncSheetHeaders(MAIL_INFO_CARDS_SHEET)
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
