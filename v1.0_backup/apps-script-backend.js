// ==================== GOOGLE APPS SCRIPT BACKEND ====================
// Bu dosyayı Google Apps Script'e yapıştırın ve deploy edin
// Deploy → New Deployment → Web App → Execute as: Me, Who has access: Anyone

const CONFIG = {
  // Calendar & Storage
  CALENDAR_ID: 'primary', // veya 'sizin@gmail.com'
  TIMEZONE: 'Europe/Istanbul',
  PROPERTIES_KEY: 'RANDEVU_DATA',

  // Company Info
  COMPANY_NAME: 'Rolex İzmir İstinyepark',
  ADMIN_EMAIL: 'istinyeparkrolex35@gmail.com',

  // Appointment Types
  APPOINTMENT_TYPES: {
    DELIVERY: 'delivery',
    MEETING: 'meeting'
  },

  // Appointment Type Labels
  APPOINTMENT_TYPE_LABELS: {
    delivery: 'Teslim',
    meeting: 'Görüşme'
  },

  // Service Names
  SERVICE_NAMES: {
    delivery: 'Saat Teslimi',
    meeting: 'Görüşme'
  },

  // Email Subjects
  EMAIL_SUBJECTS: {
    CUSTOMER_CONFIRMATION: 'Randevunuz Onaylandı - Rolex İzmir İstinyepark',
    STAFF_NOTIFICATION: 'Yeni Randevu'
  }
};

// Validation Constants
const VALIDATION = {
  STRING_MAX_LENGTH: 100,
  PHONE_MAX_LENGTH: 20,
  NOTE_MAX_LENGTH: 500,
  INTERVAL_MIN: 15,
  INTERVAL_MAX: 240,
  MAX_DAILY_MIN: 1,
  MAX_DAILY_MAX: 20
};

// ==================== UTILITY FUNCTIONS ====================
// Validation ve Sanitization
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  // Basit email regex - RFC 5322 compliant değil ama pratik
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

function sanitizeString(str, maxLength) {
  if (!str || typeof str !== 'string') return '';
  // Trim ve max length uygula
  return str.trim().substring(0, maxLength);
}

function sanitizePhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  // Sadece rakam, +, -, boşluk ve parantez karakterlerine izin ver
  return phone.replace(/[^0-9+\-\s()]/g, '').trim().substring(0, VALIDATION.PHONE_MAX_LENGTH);
}

// Takvim nesnesini döndür - merkezi hata yönetimi ile
function getCalendar() {
  const calendar = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
  if (!calendar) {
    console.error('Takvim bulunamadı. CALENDAR_ID kontrol edin:', CONFIG.CALENDAR_ID);
    throw new Error('Takvim yapılandırması bulunamadı.');
  }
  return calendar;
}

// Tarih aralığı hesaplama - kod tekrarını önler
function getDateRange(dateStr) {
  const startDate = new Date(dateStr + 'T00:00:00');
  const endDate = new Date(dateStr + 'T23:59:59');
  return { startDate, endDate };
}

// Personel doğrulama ve temizleme - DRY prensibi
function validateAndSanitizeStaff(name, phone, email) {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return { error: 'İsim zorunludur' };
  }
  if (email && !isValidEmail(email)) {
    return { error: 'Geçersiz e-posta adresi' };
  }
  return {
    name: sanitizeString(name, VALIDATION.STRING_MAX_LENGTH),
    phone: sanitizePhone(phone),
    email: email ? sanitizeString(email, VALIDATION.STRING_MAX_LENGTH) : ''
  };
}

// Event'i appointment objesine çevir (getAppointments, getWeekAppointments, getMonthAppointments için)
function mapEventToAppointment(event) {
  return {
    id: event.getId(),
    summary: event.getTitle(),
    start: { dateTime: event.getStartTime().toISOString() },
    end: { dateTime: event.getEndTime().toISOString() },
    extendedProperties: {
      private: event.getTag('staffId') ? {
        staffId: event.getTag('staffId'),
        customerPhone: event.getTag('customerPhone'),
        shiftType: event.getTag('shiftType'),
        appointmentType: event.getTag('appointmentType')
      } : {}
    }
  };
}

// Email template'leri - kod organizasyonu için ayrı fonksiyonlar
function getCustomerEmailTemplate(data) {
  const { customerName, formattedDate, time, serviceName, staffName, customerNote, staffPhone, staffEmail } = data;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <p>Sayın ${customerName},</p>
      <p>Randevunuz başarı ile onaylanmıştır.</p>
      <p>Sizi mağazamızda ağırlamayı sabırsızlıkla bekliyoruz. Randevunuza zamanında gelmenizi rica ederiz.</p>

      <div style="margin: 30px 0; padding: 20px; background: #f9f9f9; border-left: 3px solid #C9A55A;">
        <h3 style="margin-top: 0; color: #1A1A2E; font-weight: normal; letter-spacing: 1px;">RANDEVU BİLGİLERİ</h3>
        <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
          <tr>
            <td style="padding: 8px 12px 8px 0; font-weight: bold; width: 35%; vertical-align: top;">Tarih</td>
            <td style="padding: 8px 0; vertical-align: top; word-wrap: break-word;">${formattedDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px 8px 0; font-weight: bold; width: 35%; vertical-align: top;">Saat</td>
            <td style="padding: 8px 0; vertical-align: top; word-wrap: break-word;">${time}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px 8px 0; font-weight: bold; width: 35%; vertical-align: top;">Konu</td>
            <td style="padding: 8px 0; vertical-align: top; word-wrap: break-word;">${serviceName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px 8px 0; font-weight: bold; width: 35%; vertical-align: top;">İlgili</td>
            <td style="padding: 8px 0; vertical-align: top; word-wrap: break-word;">${staffName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px 8px 0; font-weight: bold; width: 35%; vertical-align: top;">Mağaza</td>
            <td style="padding: 8px 0; vertical-align: top; word-wrap: break-word;">${CONFIG.COMPANY_NAME}</td>
          </tr>
          ${customerNote ? `<tr><td style="padding: 8px 12px 8px 0; font-weight: bold; width: 35%; vertical-align: top;">Ek Bilgi</td><td style="padding: 8px 0; vertical-align: top; word-wrap: break-word;">${customerNote}</td></tr>` : ''}
        </table>
      </div>

      <p style="line-height: 1.8;">Teslimat esnasında kimlik belgenizi yanınızda bulundurmanızı hatırlatmak isteriz. Ayrıca, saatinizin bakım ve kullanım koşulları hakkında kapsamlı bilgilendirme yapılacağından, teslimat için yaklaşık 30 dakikalık bir süre ayırmanızı öneririz.</p>

      <p style="line-height: 1.8;">Randevunuzda herhangi bir değişiklik yapmanız gerektiği takdirde, lütfen en geç 24 saat öncesinden ilgili danışman ile irtibata geçiniz.</p>

      <p style="line-height: 1.8;">En kısa sürede sizinle buluşmayı sabırsızlıkla bekliyoruz. Herhangi bir sorunuz olması durumunda bizimle iletişime geçmekten çekinmeyin.</p>

      <p style="margin-top: 30px; line-height: 1.8;">
        <strong>Tel:</strong> ${staffPhone}<br>
        <strong>E-posta:</strong> ${staffEmail}
      </p>

      <p style="margin-top: 30px;">
        Saygılarımızla,<br>
        <strong>${CONFIG.COMPANY_NAME}</strong>
      </p>
    </div>
  `;
}

function generateCustomerICS(data) {
  const { staffName, staffPhone, staffEmail, date, time, duration, appointmentType, customerNote, formattedDate } = data;

  // ICS tarih formatı
  const formatICSDate = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}T${hours}${minutes}${seconds}`;
  };

  // Başlangıç ve bitiş zamanları
  const startDateTime = new Date(date + 'T' + time + ':00');
  const endDateTime = new Date(startDateTime.getTime() + (duration * 60 * 1000));

  // Müşteri takvimi için özel isimler
  const customerAppointmentTypeNames = {
    'delivery': 'Saat Takdimi',
    'consultation': 'Genel Görüşme'
  };

  // Müşteri takvimi için randevu türü adı
  const appointmentTypeName = customerAppointmentTypeNames[appointmentType] ||
    CONFIG.SERVICE_NAMES[appointmentType] || appointmentType;

  // Event başlığı: İzmir İstinyepark Rolex - İlgili (Görüşme Türü)
  const summary = `İzmir İstinyepark Rolex - ${staffName} (${appointmentTypeName})`;

  // Description - Yeni sıralama: İlgili, İletişim, E-posta, Tarih, Saat, Konu, Ek Bilgi
  let description = 'RANDEVU BİLGİLERİ\\n\\n';
  description += `İlgili: ${staffName}\\n`;
  description += `İletişim: ${staffPhone || 'Belirtilmedi'}\\n`;
  description += `E-posta: ${staffEmail || 'Belirtilmedi'}\\n`;
  description += `Tarih: ${formattedDate}\\n`;
  description += `Saat: ${time}\\n`;
  description += `Konu: ${appointmentTypeName}\\n`;
  if (customerNote) {
    description += `Ek Bilgi: ${customerNote}\\n`;
  }
  description += `\\nRandevunuza zamanında gelmenizi rica ederiz.\\nLütfen kimlik belgenizi yanınızda bulundurun.`;

  // Alarm - Randevu günü sabah 10:00 Türkiye saati
  // Türkiye UTC+3 olduğu için 10:00 local = 07:00 UTC
  const appointmentDate = new Date(date);
  const alarmYear = appointmentDate.getFullYear();
  const alarmMonth = String(appointmentDate.getMonth() + 1).padStart(2, '0');
  const alarmDay = String(appointmentDate.getDate()).padStart(2, '0');
  const alarmTrigger = `VALUE=DATE-TIME:${alarmYear}${alarmMonth}${alarmDay}T070000Z`;

  // ICS içeriği - VTIMEZONE tanımı ile
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Rolex İzmir İstinyepark//Randevu Sistemi//TR',
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
    `DTSTAMP:${formatICSDate(new Date())}Z`,
    `DTSTART;TZID=Europe/Istanbul:${formatICSDate(startDateTime)}`,
    `DTEND;TZID=Europe/Istanbul:${formatICSDate(endDateTime)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    'LOCATION:Rolex İzmir İstinyepark',
    'STATUS:CONFIRMED',
    'ORGANIZER;CN=Rolex İzmir İstinyepark:mailto:istinyeparkrolex35@gmail.com',
    'BEGIN:VALARM',
    `TRIGGER;${alarmTrigger}`,
    'ACTION:DISPLAY',
    'DESCRIPTION:Randevunuza zamanında gelmenizi rica ederiz. Lütfen kimlik belgenizi yanınızda bulundurun.',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  return icsContent;
}

function getStaffEmailTemplate(data) {
  const { staffName, customerName, customerPhone, customerEmail, formattedDate, time, serviceName, customerNote } = data;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <p>Sayın ${staffName},</p>
      <p>Aşağıda detayları belirtilen randevu tarafınıza atanmıştır.</p>

      <div style="margin: 30px 0; padding: 20px; background: #f9f9f9; border-left: 3px solid #C9A55A;">
        <h3 style="margin-top: 0; color: #1A1A2E; font-weight: normal; letter-spacing: 1px;">RANDEVU BİLGİLERİ</h3>
        <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
          <tr>
            <td style="padding: 8px 12px 8px 0; font-weight: bold; width: 35%; vertical-align: top;">Müşteri</td>
            <td style="padding: 8px 0; vertical-align: top; word-wrap: break-word;">${customerName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px 8px 0; font-weight: bold; width: 35%; vertical-align: top;">İletişim</td>
            <td style="padding: 8px 0; vertical-align: top; word-wrap: break-word;">${customerPhone}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px 8px 0; font-weight: bold; width: 35%; vertical-align: top;">E-posta</td>
            <td style="padding: 8px 0; vertical-align: top; word-wrap: break-word;">${customerEmail || 'Belirtilmedi'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px 8px 0; font-weight: bold; width: 35%; vertical-align: top;">Tarih</td>
            <td style="padding: 8px 0; vertical-align: top; word-wrap: break-word;">${formattedDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px 8px 0; font-weight: bold; width: 35%; vertical-align: top;">Saat</td>
            <td style="padding: 8px 0; vertical-align: top; word-wrap: break-word;">${time}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px 8px 0; font-weight: bold; width: 35%; vertical-align: top;">Konu</td>
            <td style="padding: 8px 0; vertical-align: top; word-wrap: break-word;">${serviceName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px 8px 0; font-weight: bold; width: 35%; vertical-align: top;">İlgili</td>
            <td style="padding: 8px 0; vertical-align: top; word-wrap: break-word;">${staffName}</td>
          </tr>
          ${customerNote ? `<tr><td style="padding: 8px 12px 8px 0; font-weight: bold; width: 35%; vertical-align: top;">Ek Bilgi</td><td style="padding: 8px 0; vertical-align: top; word-wrap: break-word;">${customerNote}</td></tr>` : ''}
        </table>
      </div>

      <p>Randevuya ilişkin gerekli hazırlıkların tamamlanması rica olunur.</p>

      <p style="margin-top: 30px;">
        Saygılarımızla,<br>
        <strong>${CONFIG.COMPANY_NAME}</strong>
      </p>
    </div>
  `;
}

// ==================== CACHE (Request-scoped) ====================
// Apps Script'te her HTTP isteği yeni execution context oluşturur
// Bu cache'ler sadece AYNI istek içindeki çoklu çağrılar için

// Data cache
let dataCache = null;

function clearDataCache() {
  dataCache = null;
}

// Calendar cache - tarih/aralığa göre cache
let calendarCache = {};

function clearCalendarCache() {
  calendarCache = {};
}

// ==================== MAIN HANDLER ====================
// Action handler map - daha okunabilir ve yönetilebilir
const ACTION_HANDLERS = {
  // Test
  'test': () => ({ status: 'ok', message: 'Apps Script çalışıyor!' }),

  // Staff management
  'getStaff': () => getStaff(),
  'addStaff': (e) => addStaff(e.parameter.name, e.parameter.phone, e.parameter.email),
  'toggleStaff': (e) => toggleStaff(e.parameter.id),
  'removeStaff': (e) => removeStaff(e.parameter.id),
  'updateStaff': (e) => updateStaff(e.parameter.id, e.parameter.name, e.parameter.phone, e.parameter.email),

  // Shifts management
  'getShifts': (e) => getShifts(e.parameter.date),
  'getMonthShifts': (e) => getMonthShifts(e.parameter.month),
  'saveShifts': (e) => saveShifts(JSON.parse(e.parameter.shifts)),

  // Settings management
  'getSettings': () => getSettings(),
  'saveSettings': (e) => saveSettings(e.parameter),

  // Appointments
  'getAppointments': (e) => getAppointments(e.parameter.date, {
    countOnly: e.parameter.countOnly === 'true',
    appointmentType: e.parameter.appointmentType || null
  }),
  'getWeekAppointments': (e) => getWeekAppointments(e.parameter.startDate, e.parameter.endDate),
  'deleteAppointment': (e) => deleteAppointment(e.parameter.eventId),
  'getMonthAppointments': (e) => getMonthAppointments(e.parameter.month),
  'getGoogleCalendarEvents': (e) => getGoogleCalendarEvents(e.parameter.startDate, e.parameter.endDate, e.parameter.staffId),
  'createAppointment': (e) => createAppointment(e.parameter),

  // Data management
  'resetData': () => resetData()
};

function doGet(e) {
  try {
    const action = e.parameter.action;
    const callback = e.parameter.callback || 'callback';

    let response = {};

    try {
      // Handler'ı bul
      const handler = ACTION_HANDLERS[action];

      if (!handler) {
        response = { success: false, error: 'Bilinmeyen aksiyon: ' + action };
      } else {
        response = handler(e);
      }
    } catch (error) {
      // Detaylı hata bilgisini sadece sunucu tarafında logla (güvenlik)
      console.error('API Hatası:', {
        message: error.message,
        stack: error.stack,
        action: action,
        parameters: e.parameter
      });
      // Kullanıcıya sadece genel hata mesajı gönder
      response = { success: false, error: 'Sunucuda bir hata oluştu. Lütfen tekrar deneyin.' };
    }

    // JSONP response
    return ContentService
      .createTextOutput(callback + '(' + JSON.stringify(response) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);

  } catch (mainError) {
    // En dıştaki catch - callback bile hatalıysa
    console.error('Ana hata:', mainError);
    return ContentService
      .createTextOutput('callback({"success":false,"error":"' + mainError.toString().replace(/"/g, '\\"') + '"})')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
}

// ==================== DATA STORAGE ====================
function getData() {
  // Cache kontrolü - aynı istek içinde tekrar okumayı önle
  if (dataCache) {
    return dataCache;
  }

  const props = PropertiesService.getScriptProperties();
  const data = props.getProperty(CONFIG.PROPERTIES_KEY);

  if (!data) {
    // Varsayılan veri
    const defaultData = {
      staff: [
        { id: 1, name: 'Serdar Benli', active: true },
        { id: 2, name: 'Ece Argun', active: true },
        { id: 3, name: 'Gökhan Tokol', active: true },
        { id: 4, name: 'Sırma', active: true },
        { id: 5, name: 'Gamze', active: true },
        { id: 6, name: 'Okan', active: true }
      ],
      shifts: {}, // { 'YYYY-MM-DD': { staffId: 'morning|evening|full' } }
      settings: {
        interval: 60,
        maxDaily: 4
      }
    };
    saveData(defaultData);
    return defaultData;
  }

  dataCache = JSON.parse(data);
  return dataCache;
}

function saveData(data) {
  // Cache'i güncelle
  dataCache = data;

  const props = PropertiesService.getScriptProperties();
  props.setProperty(CONFIG.PROPERTIES_KEY, JSON.stringify(data));
}

// Tüm veriyi sıfırla ve yeni default data yükle
function resetData() {
  try {
    const props = PropertiesService.getScriptProperties();
    props.deleteProperty(CONFIG.PROPERTIES_KEY);
    dataCache = null;

    // Yeni default data yüklenir
    getData();

    return { success: true, message: 'Veriler sıfırlandı ve yeni staff listesi yüklendi' };
  } catch (error) {
    console.error('Reset data error:', error);
    return { success: false, error: error.toString() };
  }
}

// ==================== API FUNCTIONS ====================

// ==================== STAFF MANAGEMENT ====================

// Çalışanları getir
function getStaff() {
  const data = getData();
  return { success: true, data: data.staff || [] };
}

// Çalışan ekle
function addStaff(name, phone, email) {
  try {
    // Validation ve sanitization - DRY prensibi
    const validationResult = validateAndSanitizeStaff(name, phone, email);
    if (validationResult.error) {
      return { success: false, error: validationResult.error };
    }

    const data = getData();
    const newId = data.staff.length > 0 ? Math.max(...data.staff.map(s => s.id)) + 1 : 1;
    data.staff.push({
      id: newId,
      name: validationResult.name,
      phone: validationResult.phone,
      email: validationResult.email,
      active: true
    });
    saveData(data);
    return { success: true, data: data.staff };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Çalışan aktif/pasif yap
function toggleStaff(staffId) {
  try {
    const data = getData();
    const staff = data.staff.find(s => s.id === parseInt(staffId));
    if (staff) {
      staff.active = !staff.active;
      saveData(data);
      return { success: true, data: data.staff };
    }
    return { success: false, error: 'Çalışan bulunamadı' };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Çalışan sil
function removeStaff(staffId) {
  try {
    const data = getData();
    data.staff = data.staff.filter(s => s.id !== parseInt(staffId));

    // Vardiyalardan da sil
    Object.keys(data.shifts).forEach(date => {
      if (data.shifts[date][staffId]) {
        delete data.shifts[date][staffId];
      }
    });

    saveData(data);
    return { success: true, data: data.staff };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Çalışan güncelle
function updateStaff(staffId, name, phone, email) {
  try {
    // Validation ve sanitization - DRY prensibi
    const validationResult = validateAndSanitizeStaff(name, phone, email);
    if (validationResult.error) {
      return { success: false, error: validationResult.error };
    }

    const data = getData();
    const staff = data.staff.find(s => s.id === parseInt(staffId));
    if (staff) {
      staff.name = validationResult.name;
      staff.phone = validationResult.phone;
      staff.email = validationResult.email;
      saveData(data);
      return { success: true, data: data.staff };
    }
    return { success: false, error: 'Çalışan bulunamadı' };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// ==================== SETTINGS MANAGEMENT ====================

// Ayarları getir
function getSettings() {
  const data = getData();
  return {
    success: true,
    data: data.settings || { interval: 60, maxDaily: 4 }
  };
}

// Ayarları kaydet
function saveSettings(params) {
  try {
    // Validation
    const interval = parseInt(params.interval);
    const maxDaily = parseInt(params.maxDaily);

    if (isNaN(interval) || interval < VALIDATION.INTERVAL_MIN || interval > VALIDATION.INTERVAL_MAX) {
      return { success: false, error: `Randevu süresi ${VALIDATION.INTERVAL_MIN}-${VALIDATION.INTERVAL_MAX} dakika arasında olmalıdır` };
    }

    if (isNaN(maxDaily) || maxDaily < VALIDATION.MAX_DAILY_MIN || maxDaily > VALIDATION.MAX_DAILY_MAX) {
      return { success: false, error: `Günlük maksimum randevu sayısı ${VALIDATION.MAX_DAILY_MIN}-${VALIDATION.MAX_DAILY_MAX} arasında olmalıdır` };
    }

    const data = getData();
    data.settings = {
      interval: interval,
      maxDaily: maxDaily
    };
    saveData(data);
    return { success: true, data: data.settings };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// ==================== SHIFTS MANAGEMENT ====================

// Vardiyaları kaydet
function saveShifts(shiftsData) {
  try {
    const data = getData();
    // shiftsData format: { 'YYYY-MM-DD': { staffId: 'morning|evening|full' } }
    Object.keys(shiftsData).forEach(date => {
      if (!data.shifts[date]) {
        data.shifts[date] = {};
      }
      data.shifts[date] = shiftsData[date];
    });
    saveData(data);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Belirli bir gün için vardiyaları getir
function getShifts(date) {
  const data = getData();
  const shifts = data.shifts || {};
  return { success: true, data: shifts[date] || {} };
}

// Bir ay için tüm vardiyaları getir
function getMonthShifts(month) {
  const data = getData();
  const shifts = data.shifts || {};
  const monthShifts = {};

  // YYYY-MM formatında gelen ay parametresi
  Object.keys(shifts).forEach(date => {
    if (date.startsWith(month)) {
      monthShifts[date] = shifts[date];
    }
  });

  return { success: true, data: monthShifts };
}

// Belirli bir gün için randevuları getir
// options.countOnly: true → Sadece sayı döndür
// options.appointmentType: 'delivery'|'meeting' → Sadece bu tipteki randevuları say/döndür
function getAppointments(date, options = {}) {
  const { countOnly = false, appointmentType = null } = options;

  // Cache kontrolü - countOnly ve appointmentType'a göre farklı cache key
  const cacheKey = `appointments_${date}_${countOnly}_${appointmentType || 'all'}`;
  if (calendarCache[cacheKey]) {
    return calendarCache[cacheKey];
  }

  try {
    const calendar = getCalendar();
    const { startDate, endDate } = getDateRange(date);
    let events = calendar.getEvents(startDate, endDate);

    // appointmentType filtresi varsa uygula
    if (appointmentType) {
      events = events.filter(event => {
        const eventType = event.getTag('appointmentType');
        return eventType === appointmentType;
      });
    }

    // Sadece count istendiyse, map'leme yapmadan döndür (performans optimizasyonu)
    if (countOnly) {
      const result = { success: true, count: events.length };
      calendarCache[cacheKey] = result;
      return result;
    }

    // Tüm veri istendiyse map'le
    const appointments = events.map(event => mapEventToAppointment(event));

    const result = { success: true, items: appointments };

    // Cache'e kaydet
    calendarCache[cacheKey] = result;

    return result;
  } catch (error) {
    console.error('getAppointments hatası:', error);
    return countOnly
      ? { success: true, count: 0 }
      : { success: true, items: [] };
  }
}

// Haftalık randevuları getir
function getWeekAppointments(startDateStr, endDateStr) {
  // Cache kontrolü
  const cacheKey = 'week_' + startDateStr + '_' + endDateStr;
  if (calendarCache[cacheKey]) {
    return calendarCache[cacheKey];
  }

  try {
    const calendar = getCalendar();
    const startDate = new Date(startDateStr + 'T00:00:00');
    const endDate = new Date(endDateStr + 'T23:59:59');
    const events = calendar.getEvents(startDate, endDate);

    const appointments = events.map(event => mapEventToAppointment(event));

    const result = { success: true, items: appointments };

    // Cache'e kaydet
    calendarCache[cacheKey] = result;

    return result;
  } catch (error) {
    console.error('getWeekAppointments hatası:', error);
    return { success: true, items: [] };
  }
}

// Randevu sil
function deleteAppointment(eventId) {
  try {
    const calendar = getCalendar();
    const event = calendar.getEventById(eventId);
    if (!event) {
      return { success: false, error: 'Randevu bulunamadı' };
    }

    event.deleteEvent();
    console.info('Randevu silindi:', eventId);
    return { success: true, message: 'Randevu silindi' };
  } catch (error) {
    console.error('deleteAppointment hatası:', error);
    return { success: false, error: error.toString() };
  }
}

// Bir ay için tüm randevuları getir
function getMonthAppointments(month) {
  // Cache kontrolü
  const cacheKey = 'month_' + month;
  if (calendarCache[cacheKey]) {
    return calendarCache[cacheKey];
  }

  try {
    const calendar = getCalendar();

    // YYYY-MM formatından tarihleri oluştur
    const [year, monthNum] = month.split('-');
    const startDate = new Date(year, parseInt(monthNum) - 1, 1);
    const endDate = new Date(year, parseInt(monthNum), 0, 23, 59, 59);
    const events = calendar.getEvents(startDate, endDate);

    // Tarihe göre grupla
    const appointmentsByDate = {};

    events.forEach(event => {
      const eventDate = Utilities.formatDate(
        event.getStartTime(),
        CONFIG.TIMEZONE,
        'yyyy-MM-dd'
      );

      if (!appointmentsByDate[eventDate]) {
        appointmentsByDate[eventDate] = [];
      }

      appointmentsByDate[eventDate].push(mapEventToAppointment(event));
    });

    const result = { success: true, data: appointmentsByDate };

    // Cache'e kaydet
    calendarCache[cacheKey] = result;

    return result;
  } catch (error) {
    console.error('getMonthAppointments hatası:', error);
    return { success: true, data: {} }; // Hata olsa bile boş sonuç dön
  }
}

// Google Calendar'dan mevcut etkinlikleri getir
function getGoogleCalendarEvents(startDateStr, endDateStr, staffId) {
  // Cache kontrolü - staffId de cache key'ine dahil (filtreleme yapıyor)
  const cacheKey = 'events_' + startDateStr + '_' + endDateStr + '_' + staffId;
  if (calendarCache[cacheKey]) {
    return calendarCache[cacheKey];
  }

  try {
    const calendar = getCalendar();
    const startDate = new Date(startDateStr + 'T00:00:00');
    const endDate = new Date(endDateStr + 'T23:59:59');
    const events = calendar.getEvents(startDate, endDate);

    // Tarihe göre grupla
    const eventsByDate = {};

    events.forEach(event => {
      const eventDate = Utilities.formatDate(
        event.getStartTime(),
        CONFIG.TIMEZONE,
        'yyyy-MM-dd'
      );

      // staffId filtresi varsa uygula
      const eventStaffId = event.getTag('staffId');
      if (staffId !== 'all' && eventStaffId && eventStaffId !== staffId) {
        return; // Bu staff'a ait değil, atla
      }

      if (!eventsByDate[eventDate]) {
        eventsByDate[eventDate] = [];
      }

      // Start ve end time'ları Türkiye timezone'ında formatla
      const startTimeFormatted = Utilities.formatDate(
        event.getStartTime(),
        CONFIG.TIMEZONE,
        'yyyy-MM-dd\'T\'HH:mm:ss'
      );
      const endTimeFormatted = Utilities.formatDate(
        event.getEndTime(),
        CONFIG.TIMEZONE,
        'yyyy-MM-dd\'T\'HH:mm:ss'
      );
      // Sadece saat bilgisi (HH:mm formatında)
      const startTimeOnly = Utilities.formatDate(
        event.getStartTime(),
        CONFIG.TIMEZONE,
        'HH:mm'
      );

      eventsByDate[eventDate].push({
        id: event.getId(),
        summary: event.getTitle(),
        start: {
          dateTime: startTimeFormatted,
          time: startTimeOnly  // Ek alan: sadece saat
        },
        end: { dateTime: endTimeFormatted },
        extendedProperties: {
          private: {
            staffId: eventStaffId || '',
            appointmentType: event.getTag('appointmentType') || '',
            customerPhone: event.getTag('customerPhone') || ''
          }
        }
      });
    });

    const result = { success: true, data: eventsByDate };

    // Cache'e kaydet
    calendarCache[cacheKey] = result;

    return result;
  } catch (error) {
    console.error('getGoogleCalendarEvents hatası:', error);
    return { success: true, data: {} }; // Hata olsa bile boş sonuç dön
  }
}

// Randevu oluştur
function createAppointment(params) {
  try {
    const {
      date,
      time,
      staffId,
      staffName,
      customerName,
      customerPhone,
      customerEmail,
      customerNote,
      shiftType,
      appointmentType,
      duration
    } = params;

    // ===== VALIDATION =====
    // Date validation (YYYY-MM-DD format)
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { success: false, error: 'Geçersiz tarih formatı (YYYY-MM-DD bekleniyor)' };
    }

    // Time validation (HH:MM format)
    if (!time || !/^\d{2}:\d{2}$/.test(time)) {
      return { success: false, error: 'Geçersiz saat formatı (HH:MM bekleniyor)' };
    }

    // Customer name validation
    if (!customerName || typeof customerName !== 'string' || customerName.trim().length === 0) {
      return { success: false, error: 'Müşteri adı zorunludur' };
    }

    // Customer phone validation
    if (!customerPhone || typeof customerPhone !== 'string' || customerPhone.trim().length === 0) {
      return { success: false, error: 'Müşteri telefonu zorunludur' };
    }

    // Email validation (optional but if provided must be valid)
    if (customerEmail && !isValidEmail(customerEmail)) {
      return { success: false, error: 'Geçersiz e-posta adresi' };
    }

    // Appointment type validation
    const validTypes = Object.values(CONFIG.APPOINTMENT_TYPES);
    if (!appointmentType || !validTypes.includes(appointmentType)) {
      return { success: false, error: `Geçersiz randevu tipi (${validTypes.join(' veya ')} olmalı)` };
    }

    // Duration validation
    const durationNum = parseInt(duration);
    if (isNaN(durationNum) || durationNum < VALIDATION.INTERVAL_MIN || durationNum > VALIDATION.INTERVAL_MAX) {
      return { success: false, error: `Randevu süresi ${VALIDATION.INTERVAL_MIN}-${VALIDATION.INTERVAL_MAX} dakika arasında olmalıdır` };
    }

    // Staff ID validation
    if (!staffId) {
      return { success: false, error: 'Çalışan seçilmelidir' };
    }

    // Sanitize inputs
    const sanitizedCustomerName = sanitizeString(customerName, VALIDATION.STRING_MAX_LENGTH);
    const sanitizedCustomerPhone = sanitizePhone(customerPhone);
    const sanitizedCustomerEmail = customerEmail ? sanitizeString(customerEmail, VALIDATION.STRING_MAX_LENGTH) : '';
    const sanitizedCustomerNote = customerNote ? sanitizeString(customerNote, VALIDATION.NOTE_MAX_LENGTH) : '';
    const sanitizedStaffName = staffName ? sanitizeString(staffName, VALIDATION.STRING_MAX_LENGTH) : '';

    // getData() - tek seferlik çağrı (DRY prensibi)
    const data = getData();

    // Randevu tipi kontrolü - Teslim randevusu için max kontrolü
    if (appointmentType === CONFIG.APPOINTMENT_TYPES.DELIVERY) {
      const maxDelivery = data.settings?.maxDaily || 4;

      // Partial response: Sadece delivery randevularının sayısını al (performans optimizasyonu)
      const countResult = getAppointments(date, {
        countOnly: true,
        appointmentType: CONFIG.APPOINTMENT_TYPES.DELIVERY
      });

      if (countResult.success && countResult.count >= maxDelivery) {
        return {
          success: false,
          error: `Bu gün için maksimum ${maxDelivery} teslim randevusu oluşturulabilir`
        };
      }
    }

    const calendar = getCalendar();

    // Başlangıç ve bitiş zamanlarını oluştur
    const startDateTime = new Date(date + 'T' + time + ':00');
    const endDateTime = new Date(startDateTime.getTime() + (durationNum * 60 * 1000));

    // Event başlığı - sanitized değerleri kullan
    const appointmentTypeLabel = CONFIG.APPOINTMENT_TYPE_LABELS[appointmentType] || appointmentType;
    const title = `${sanitizedCustomerName} - ${sanitizedStaffName} (${appointmentTypeLabel})`;

    // Event açıklaması - sanitized değerleri kullan
    const description = `
Randevu Detayları:
─────────────────
Müşteri: ${sanitizedCustomerName}
Telefon: ${sanitizedCustomerPhone}
E-posta: ${sanitizedCustomerEmail || 'Belirtilmedi'}
İlgili: ${sanitizedStaffName}
Konu: ${appointmentTypeLabel}

${sanitizedCustomerNote ? 'Not: ' + sanitizedCustomerNote : ''}

Bu randevu otomatik olarak oluşturulmuştur.
    `.trim();

    // Event oluştur
    const event = calendar.createEvent(title, startDateTime, endDateTime, {
      description: description,
      location: ''
    });

    // Ek bilgileri tag olarak ekle (extendedProperties yerine) - sanitized değerleri kullan
    event.setTag('staffId', String(staffId));
    event.setTag('customerPhone', sanitizedCustomerPhone);
    event.setTag('customerEmail', sanitizedCustomerEmail);
    event.setTag('shiftType', shiftType);
    event.setTag('appointmentType', appointmentType);

    // Tarih formatla (7 Ekim 2025, Salı)
    const formatDate = (dateStr) => {
      const d = new Date(dateStr);
      const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
      const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
                      'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
      return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${days[d.getDay()]}`;
    };

    const formattedDate = formatDate(date);
    const serviceName = CONFIG.SERVICE_NAMES[appointmentType] || appointmentType;

    // Staff bilgisini çek (data zaten yukarıda çekildi)
    const staff = data.staff.find(s => s.id === parseInt(staffId));
    const staffPhone = staff?.phone ?? '';
    const staffEmail = staff?.email ?? '';

    // E-posta bildirimi - Müşteriye (sanitized değerleri kullan)
    if (sanitizedCustomerEmail) {
      try {
        // ICS dosyası oluştur
        const icsContent = generateCustomerICS({
          staffName: sanitizedStaffName,
          staffPhone,
          staffEmail,
          date,
          time,
          duration: durationNum,
          appointmentType,
          customerNote: sanitizedCustomerNote,
          formattedDate
        });

        // ICS dosyasını blob olarak oluştur
        const icsBlob = Utilities.newBlob(icsContent, 'text/calendar', 'randevu.ics');

        MailApp.sendEmail({
          to: sanitizedCustomerEmail,
          subject: CONFIG.EMAIL_SUBJECTS.CUSTOMER_CONFIRMATION,
          name: CONFIG.COMPANY_NAME,
          replyTo: staffEmail || CONFIG.ADMIN_EMAIL,
          htmlBody: getCustomerEmailTemplate({
            customerName: sanitizedCustomerName,
            formattedDate,
            time,
            serviceName,
            staffName: sanitizedStaffName,
            customerNote: sanitizedCustomerNote,
            staffPhone,
            staffEmail
          }),
          attachments: [icsBlob]
        });
      } catch (emailError) {
        console.error('Müşteri e-postası gönderilemedi:', emailError);
      }
    }

    // E-posta bildirimi - Çalışana ve Admin (sanitized değerleri kullan)
    try {
      const staffEmailBody = getStaffEmailTemplate({
        staffName: sanitizedStaffName,
        customerName: sanitizedCustomerName,
        customerPhone: sanitizedCustomerPhone,
        customerEmail: sanitizedCustomerEmail,
        formattedDate,
        time,
        serviceName,
        customerNote: sanitizedCustomerNote
      });

      // Çalışana gönder
      if (staff && staff.email) {
        MailApp.sendEmail({
          to: staff.email,
          subject: `${CONFIG.EMAIL_SUBJECTS.STAFF_NOTIFICATION} - ${sanitizedCustomerName}`,
          name: CONFIG.COMPANY_NAME,
          htmlBody: staffEmailBody
        });
      }

      // Admin'e gönder
      MailApp.sendEmail({
        to: CONFIG.ADMIN_EMAIL,
        subject: `${CONFIG.EMAIL_SUBJECTS.STAFF_NOTIFICATION} - ${sanitizedCustomerName}`,
        name: CONFIG.COMPANY_NAME,
        htmlBody: staffEmailBody
      });

    } catch (staffEmailError) {
      console.error('Çalışan/Admin e-postası gönderilemedi:', staffEmailError);
    }

    return {
      success: true,
      eventId: event.getId(),
      message: 'Randevu başarıyla oluşturuldu'
    };

  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

