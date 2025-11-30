/**
 * Notifications.gs
 *
 * Email Notification and Calendar File Generation Service
 *
 * This module handles email template generation for customers and staff,
 * and generates ICS calendar files for appointments.
 *
 * Services:
 * - NotificationService: Email template generation
 *
 * Functions:
 * - generateCustomerICS: Generate ICS calendar file for customers
 *
 * Dependencies:
 * - Config.gs (CONFIG)
 * - Calendar.gs (DateUtils)
 */

// --- Notification Service ---
/**
 * Email notification and calendar file generation service
 * Handles customer and staff email templates, ICS calendar files
 * @namespace NotificationService
 */
const NotificationService = {
  /**
   * Get customer email HTML template
   * @param {Object} data - {customerName, formattedDate, time, serviceName, staffName, staffPhone, staffEmail, customerNote, appointmentType}
   * @returns {string} HTML email template
   */
  getCustomerEmailTemplate: function(data) {
    // Generic template builder kullan - DİNAMİK İÇERİK İÇİN appointmentType eklendi
    return this.generateEmailTemplate('customer', {
      name: data.customerName,
      DATE: data.formattedDate,
      TIME: data.time,
      SUBJECT: data.serviceName,
      CONTACT_PERSON: data.staffName,
      STORE: CONFIG.COMPANY_NAME,
      NOTES: data.customerNote || '',
      staffPhone: data.staffPhone,
      staffEmail: data.staffEmail,
      appointmentType: data.appointmentType  // YENİ: Dinamik içerik için
    });
  },

  /**
   * Get staff email HTML template
   * @param {Object} data - {staffName, customerName, customerPhone, customerEmail, formattedDate, time, serviceName, customerNote}
   * @returns {string} HTML email template
   */
  getStaffEmailTemplate: function(data) {
    // Generic template builder kullan
    return this.generateEmailTemplate('staff', {
      name: data.staffName,
      CUSTOMER: data.customerName,
      CONTACT: data.customerPhone,
      EMAIL: data.customerEmail,
      DATE: data.formattedDate,
      TIME: data.time,
      SUBJECT: data.serviceName,
      CONTACT_PERSON: data.staffName,
      NOTES: data.customerNote || ''
    });
  },

  /**
   * Generate email HTML template (customer or staff)
   * @param {string} type - 'customer' or 'staff'
   * @param {Object} data - Template data
   * @returns {string} HTML email template
   */
  generateEmailTemplate: function(type, data) {
    const config = CONFIG.EMAIL_TEMPLATES[type.toUpperCase()];
    if (!config) throw new Error(`Geçersiz email template tipi: ${type}`);

    const { GREETING, SECTION_TITLE, LABELS, CLOSING } = config;

    // Tablo satırları - config'deki label'lara göre dinamik
    // XSS koruması: Tüm değerler HTML escape edilir
    const tableRows = Object.entries(LABELS).map(([key, label]) => {
      const rawValue = data[key] || CONFIG.EMAIL_TEMPLATES.COMMON.NOT_SPECIFIED;
      const value = Utils.escapeHtml(rawValue);
      return `
      <tr>
        <td style="padding: 8px 12px 8px 0; font-weight: 400; width: 35%; vertical-align: top; color: #555;">${label}</td>
        <td style="padding: 8px 0; vertical-align: top; word-wrap: break-word; color: #333;">${value}</td>
      </tr>
    `;
    }).join('');

    // Customer email için yeni yapı
    if (type === 'customer') {
      // Randevu türüne göre dinamik içerik seç
      let typeSpecificInfo = '';
      const { appointmentType } = data;
      if (appointmentType === CONFIG.APPOINTMENT_TYPES.DELIVERY && CONFIG.EMAIL_TEMPLATES.DELIVERY) {
        typeSpecificInfo = CONFIG.EMAIL_TEMPLATES.DELIVERY.INFO;
      } else if (appointmentType === CONFIG.APPOINTMENT_TYPES.SERVICE && CONFIG.EMAIL_TEMPLATES.SERVICE) {
        typeSpecificInfo = CONFIG.EMAIL_TEMPLATES.SERVICE.INFO;
      } else if (CONFIG.EMAIL_TEMPLATES.MEETING) {
        typeSpecificInfo = CONFIG.EMAIL_TEMPLATES.MEETING.INFO;
      }

      // XSS koruması: Kullanıcı girdileri escape edilir
      const safeName = Utils.escapeHtml(data.name);
      const safeStaffPhone = Utils.escapeHtml(data.staffPhone);
      const safeStaffEmail = Utils.escapeHtml(data.staffEmail);

      return `
      <div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="margin: 30px 0; padding: 20px; background: #f9f9f9; border-left: 3px solid #C9A55A;">
          <h3 style="margin-top: 0; color: #1A1A2E; font-weight: 400; letter-spacing: 1px; font-size: 16px;">${SECTION_TITLE}</h3>
          <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
            ${tableRows}
          </table>
        </div>

        <p style="line-height: 1.8; font-weight: 400;">${GREETING} ${safeName},</p>

        <p style="line-height: 1.8; font-weight: 400;">${config.CONFIRMATION}</p>

        <p style="line-height: 1.8; font-weight: 400;">${typeSpecificInfo}</p>

        <p style="line-height: 1.8; font-weight: 400;">${config.CHANGE_CONTACT_INFO}</p>

        <p style="margin-top: 20px; line-height: 1.8; font-weight: 400;">
          <span style="font-weight: 400;">Tel:</span> ${safeStaffPhone}<br>
          <span style="font-weight: 400;">E-posta:</span> ${safeStaffEmail}
        </p>

        <p style="margin-top: 30px; font-weight: 400;">
          ${CLOSING},<br>
          <span style="font-weight: 400;">${CONFIG.COMPANY_NAME}</span>
        </p>
      </div>
    `;
    }
    // Staff email için eski yapı korundu
    else {
      const mainText = config.NOTIFICATION;
      const additionalContent = `<p style="font-weight: 400;">${config.PREPARATION}</p>`;

      // XSS koruması: Kullanıcı girdileri escape edilir
      const safeName = Utils.escapeHtml(data.name);

      return `
      <div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <p style="font-weight: 400;">${GREETING} ${safeName},</p>
        <p style="font-weight: 400;">${mainText}</p>

        <div style="margin: 30px 0; padding: 20px; background: #f9f9f9; border-left: 3px solid #C9A55A;">
          <h3 style="margin-top: 0; color: #1A1A2E; font-weight: 400; letter-spacing: 1px; font-size: 16px;">${SECTION_TITLE}</h3>
          <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
            ${tableRows}
          </table>
        </div>

        ${additionalContent}

        <p style="margin-top: 30px; font-weight: 400;">
          ${CLOSING},<br>
          <span style="font-weight: 400;">${CONFIG.COMPANY_NAME}</span>
        </p>
      </div>
    `;
    }
  }
};

/**
 * Generate ICS calendar file for customer appointments
 * Creates iCalendar format with timezone, alarms, and appointment details
 * @param {Object} data - {staffName, staffPhone, staffEmail, date, time, duration, appointmentType, customerNote, formattedDate}
 * @returns {string} ICS file content
 */
function generateCustomerICS(data) {
  const { staffName, staffPhone, staffEmail, date, time, duration, appointmentType, customerNote, formattedDate } = data;

  // Başlangıç ve bitiş zamanları
  const startDateTime = new Date(date + 'T' + time + ':00');
  const endDateTime = new Date(startDateTime.getTime() + (duration * 60 * 1000));

  // Müşteri takvimi için randevu türü adı
  const appointmentTypeName = CONFIG.ICS_TEMPLATES.CUSTOMER_TYPES[appointmentType] ||
    CONFIG.SERVICE_NAMES[appointmentType] || appointmentType;

  // Event başlığı: İzmir İstinyepark Rolex - İlgili (Görüşme Türü)
  const summary = `İzmir İstinyepark Rolex - ${staffName} (${appointmentTypeName})`;

  // Description - DİNAMİK YAPI: Randevu türüne göre farklı hatırlatmalar
  let description = `${CONFIG.ICS_TEMPLATES.SECTION_TITLE}\\n\\n`;
  description += `${CONFIG.ICS_TEMPLATES.LABELS.CONTACT_PERSON}: ${staffName}\\n`;
  description += `${CONFIG.ICS_TEMPLATES.LABELS.CONTACT}: ${staffPhone || CONFIG.EMAIL_TEMPLATES.COMMON.NOT_SPECIFIED}\\n`;
  description += `${CONFIG.ICS_TEMPLATES.LABELS.EMAIL}: ${staffEmail || CONFIG.EMAIL_TEMPLATES.COMMON.NOT_SPECIFIED}\\n`;
  description += `${CONFIG.ICS_TEMPLATES.LABELS.DATE}: ${formattedDate}\\n`;
  description += `${CONFIG.ICS_TEMPLATES.LABELS.TIME}: ${time}\\n`;
  description += `${CONFIG.ICS_TEMPLATES.LABELS.SUBJECT}: ${appointmentTypeName}\\n`;
  if (customerNote) {
    description += `${CONFIG.ICS_TEMPLATES.LABELS.NOTES}: ${customerNote}\\n`;
  }
  description += `\\n${CONFIG.ICS_TEMPLATES.REMINDERS.ON_TIME}`;
  // Randevu türüne göre özel hatırlatmalar
  if (appointmentType === CONFIG.APPOINTMENT_TYPES.DELIVERY) {
    description += `\\n${CONFIG.ICS_TEMPLATES.REMINDERS.BRING_ID}`;
  } else if (appointmentType === CONFIG.APPOINTMENT_TYPES.SERVICE) {
    description += `\\n${CONFIG.ICS_TEMPLATES.REMINDERS.BRING_WATCH}`;
  }

  // ÇOKLU ALARM SİSTEMİ - 3 Farklı Alarm
  // Alarm 1: 1 gün önce
  // Alarm 2: Randevu günü sabah 10:00 Türkiye saati (UTC+3 → 07:00 UTC)
  // Alarm 3: 1 saat önce
  const appointmentDate = new Date(date);
  const alarmYear = appointmentDate.getFullYear();
  const alarmMonth = String(appointmentDate.getMonth() + 1).padStart(2, '0');
  const alarmDay = String(appointmentDate.getDate()).padStart(2, '0');
  const alarm10AM_UTC = `VALUE=DATE-TIME:${alarmYear}${alarmMonth}${alarmDay}T070000Z`;

  // ICS içeriği - VTIMEZONE tanımı ile + 3 ALARM
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${CONFIG.ICS_TEMPLATES.PRODID}`,
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
    `DTSTAMP:${DateUtils.toICSDate(new Date())}Z`,
    `DTSTART;TZID=Europe/Istanbul:${DateUtils.toICSDate(startDateTime)}`,
    `DTEND;TZID=Europe/Istanbul:${DateUtils.toICSDate(endDateTime)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${CONFIG.COMPANY_LOCATION}`,
    `STATUS:${CONFIG.ICS_TEMPLATES.CONFIRMED}`,
    `ORGANIZER;CN=${CONFIG.ICS_TEMPLATES.ORGANIZER_NAME}:mailto:${CONFIG.COMPANY_EMAIL}`,
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
