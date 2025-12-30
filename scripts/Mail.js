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

// Değişkenler Variables.js'den gelir (MESSAGE_VARIABLES)
// Mail şablonlarında {{musteri}}, {{randevu_tarihi}} vb. kullanılır

// Trigger türleri
const MAIL_TRIGGERS = {
  'RANDEVU_OLUŞTUR': 'Randevu Oluşturuldu',
  'RANDEVU_İPTAL': 'Randevu İptal Edildi',
  'RANDEVU_GÜNCELLE': 'Randevu Güncellendi',
  'HATIRLATMA': 'Hatırlatma',
  'PERSONEL_ATAMA': 'Personel Atandı'
};

// ==================== FLOW MANAGEMENT ====================

/**
 * Tüm mail flow'larını getir
 */
function getMailFlows() {
  try {
    const flows = SheetStorageService.getAll(MAIL_FLOW_SHEET);
    return {
      success: true,
      data: flows.map(flow => ({
        id: flow.id,
        name: flow.name,
        description: flow.description || '',
        profiles: parseJsonSafe(flow.profiles, []),
        triggers: parseJsonSafe(flow.triggers, []),
        templateId: flow.templateId || '',
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
    if (params.active !== undefined) updates.active = params.active;

    updates.updatedAt = new Date().toISOString();

    SheetStorageService.update(MAIL_FLOW_SHEET, params.id, updates);

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
    const templates = SheetStorageService.getAll(MAIL_TEMPLATE_SHEET);
    return {
      success: true,
      data: templates.map(template => ({
        id: template.id,
        name: template.name,
        subject: template.subject || '',
        body: template.body || ''
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

// ==================== MAIL SENDING ====================

/**
 * Trigger'a göre mail gönder
 * Bu fonksiyon Appointments.js'den çağrılır
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
      // triggers artık bir dizi - trigger bu dizide mi kontrol et
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
      const body = replaceMessageVariables(template.body, appointmentData);

      // Mail gönder
      const email = appointmentData.email || appointmentData.customerEmail;
      if (!email) {
        log.warn('[Mail] Müşteri email adresi yok, mail gönderilemedi');
        continue;
      }

      try {
        MailApp.sendEmail({
          to: email,
          subject: subject,
          htmlBody: body,
          name: CONFIG.STORE_NAME || 'Rolex Boutique'
        });

        log.info('[Mail] Mail gönderildi:', email, subject);
        results.push({ flow: flow.id, email: email, success: true });
      } catch (mailError) {
        log.error('[Mail] Mail gönderim hatası:', mailError);
        results.push({ flow: flow.id, email: email, success: false, error: mailError.toString() });
      }
    }

    return { success: true, results: results };
  } catch (error) {
    log.error('sendMailByTrigger error:', error);
    return { success: false, error: error.toString() };
  }
}

// Değişken değiştirme: Variables.js'deki replaceMessageVariables() kullanılır

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
