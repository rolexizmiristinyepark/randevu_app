/**
 * Calendar.gs
 *
 * Google Calendar Integration and Time Management Services
 *
 * This module handles all Google Calendar operations, slot management,
 * and date/time utilities for the appointment system.
 *
 * Services:
 * - CalendarService: Google Calendar API wrapper
 * - SlotService: Time slot availability management
 * - DateUtils: Date and time formatting utilities
 *
 * Dependencies:
 * - Config.gs (CONFIG, SHIFT_SLOT_FILTERS)
 * - Security.gs (log)
 */

/**
 * Time slot management service
 * @namespace SlotService
 */
const SlotService = {
  /**
   * Get available hours for a shift type
   * @param {string} shiftType - Shift type ('morning', 'evening', 'full')
   * @returns {number[]} Array of hours
   */
  getSlotsByShift: function(shiftType) {
    return SHIFT_SLOT_FILTERS[shiftType] || SHIFT_SLOT_FILTERS.full;
  },

  /**
   * Generate daily slot objects for a specific date
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {string} shiftType - Shift type (optional, default: 'full')
   * @returns {Object[]} Slot objects [{start, end, hour, time}]
   */
  getDailySlots: function(date, shiftType = 'full') {
    const hours = this.getSlotsByShift(shiftType);

    return hours.map(hour => {
      const startDate = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`);
      const endDate = new Date(startDate);
      endDate.setHours(endDate.getHours() + 1);

      return {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        hour: hour,
        time: `${String(hour).padStart(2, '0')}:00`
      };
    });
  },

  /**
   * Check if a time slot is free (CORE RULE: Max 1 appointment per hour)
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {number} hour - Hour (11-20)
   * @returns {boolean} True if slot is free, false if occupied
   */
  isSlotFree: function(date, hour) {
    try {
      const calendar = CalendarService.getCalendar();
      const slotStart = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`);
      const slotEnd = new Date(slotStart);
      slotEnd.setHours(slotEnd.getHours() + 1);

      const events = calendar.getEvents(slotStart, slotEnd);

      // KURAL: 0 randevu olmalı (tür fark etmez)
      return events.length === 0;
    } catch (error) {
      log.error('isSlotFree error:', error);
      return false; // Hata durumunda safe side: dolu kabul et
    }
  }
};

/**
 * Date and time utility functions
 * @namespace DateUtils
 */
const DateUtils = {
  /**
   * Tarih ve saat string'ini epoch-minute'a çevirir (dakika cinsinden Unix timestamp)
   * Standart: 1970-01-01T00:00 UTC'den itibaren geçen dakika sayısı
   *
   * @param {string} date - YYYY-MM-DD formatında tarih
   * @param {string} time - HH:MM formatında saat
   * @returns {number} Epoch minute (dakika cinsinden timestamp)
   *
   * @example
   * DateUtils.dateTimeToEpochMinute('2025-01-15', '14:30') → 29073150
   */
  dateTimeToEpochMinute: function(date, time) {
    const dateTime = new Date(date + 'T' + time + ':00');
    return Math.floor(dateTime.getTime() / 60000); // milliseconds → minutes
  },

  /**
   * Date objesini epoch-minute'a çevirir
   *
   * @param {Date} dateObj - JavaScript Date objesi
   * @returns {number} Epoch minute
   */
  dateToEpochMinute: function(dateObj) {
    return Math.floor(dateObj.getTime() / 60000);
  },

  /**
   * İki zaman aralığının çakışıp çakışmadığını kontrol eder
   * Standart: [start, end) interval (start dahil, end hariç)
   *
   * Çakışma mantığı:
   * - [10:00, 11:00) ve [10:30, 11:30) → ÇAKIŞIR (10:30-11:00 ortak)
   * - [10:00, 11:00) ve [11:00, 12:00) → ÇAKIŞMAZ (end hariç)
   * - [10:00, 11:00) ve [09:00, 10:30) → ÇAKIŞIR (10:00-10:30 ortak)
   *
   * @param {number} start1 - 1. aralık başlangıcı (epoch minute)
   * @param {number} end1 - 1. aralık bitişi (epoch minute, hariç)
   * @param {number} start2 - 2. aralık başlangıcı (epoch minute)
   * @param {number} end2 - 2. aralık bitişi (epoch minute, hariç)
   * @returns {boolean} Çakışma var mı?
   *
   * @example
   * // Test cases:
   * DateUtils.checkTimeOverlap(600, 660, 630, 690) → true   // [10:00-11:00) ve [10:30-11:30) ÇAKIŞIR
   * DateUtils.checkTimeOverlap(600, 660, 660, 720) → false  // [10:00-11:00) ve [11:00-12:00) ÇAKIŞMAZ
   */
  checkTimeOverlap: function(start1, end1, start2, end2) {
    // İki aralık çakışır eğer:
    // start1 < end2 VE start2 < end1
    // (end hariç olduğu için = yok)
    return start1 < end2 && start2 < end1;
  },

  /**
   * Tarih string'inden başlangıç ve bitiş Date objelerini oluşturur
   * @param {string} dateStr - YYYY-MM-DD formatında tarih
   * @returns {{startDate: Date, endDate: Date}} Gün başı ve gün sonu
   */
  getDateRange: function(dateStr) {
    const startDate = new Date(dateStr + 'T00:00:00');
    const endDate = new Date(dateStr + 'T23:59:59');
    return { startDate, endDate };
  },

  /**
   * Tarih ve saati Türkçe formatta string'e çevirir
   * @param {string} dateStr - YYYY-MM-DD formatında tarih
   * @param {string} timeStr - HH:MM formatında saat
   * @returns {string} Formatlanmış tarih-saat (örn: "15 Ocak 2025, 14:30")
   */
  formatAppointmentDateTime: function(dateStr, timeStr) {
    const months = {
      '01': 'Ocak', '02': 'Şubat', '03': 'Mart', '04': 'Nisan',
      '05': 'Mayıs', '06': 'Haziran', '07': 'Temmuz', '08': 'Ağustos',
      '09': 'Eylül', '10': 'Ekim', '11': 'Kasım', '12': 'Aralık'
    };

    const [year, month, day] = dateStr.split('-');
    const monthName = months[month] || month;

    return `${parseInt(day)} ${monthName} ${year}, ${timeStr}`;
  },

  /**
   * YYYY-MM-DD formatında tarih döndürür (local timezone)
   * @param {Date} date - Formatlanacak tarih
   * @returns {string} YYYY-MM-DD formatında tarih
   */
  toLocalDate: function(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * ICS takvim formatında tarih döndürür (YYYYMMDDTHHmmss)
   * @param {Date} date - Formatlanacak tarih
   * @returns {string} ICS formatında tarih
   */
  toICSDate: function(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}T${hours}${minutes}${seconds}`;
  },

  /**
   * Türkçe okunabilir formatta tarih döndürür
   * Örnek: "12 Ekim 2025, Salı"
   * @param {string} dateStr - YYYY-MM-DD formatında tarih string
   * @returns {string} Türkçe formatında tarih
   */
  toTurkishDate: function(dateStr) {
    const d = new Date(dateStr);
    return `${d.getDate()} ${CONFIG.LOCALIZATION.MONTHS[d.getMonth()]} ${d.getFullYear()}, ${CONFIG.LOCALIZATION.DAYS[d.getDay()]}`;
  }
};

/**
 * Google Calendar service wrapper
 * @namespace CalendarService
 */
const CalendarService = {
  /**
   * Get Google Calendar instance with error handling
   * @returns {GoogleAppsScript.Calendar.Calendar} Calendar instance
   * @throws {Error} If calendar not found
   */
  getCalendar: function() {
    const calendar = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
    if (!calendar) {
      log.error('Takvim bulunamadı. CALENDAR_ID kontrol edin:', CONFIG.CALENDAR_ID);
      throw new Error(CONFIG.ERROR_MESSAGES.CALENDAR_NOT_FOUND);
    }
    return calendar;
  },

  /**
   * Get Google Calendar events for a date range (grouped by date)
   * @param {string} startDateStr - Start date (YYYY-MM-DD)
   * @param {string} endDateStr - End date (YYYY-MM-DD)
   * @param {string} staffId - Staff ID filter ('all' for all staff)
   * @returns {{success: boolean, data: Object}} Events grouped by date
   */
  getGoogleEvents: function(startDateStr, endDateStr, staffId) {
    try {
      const calendar = this.getCalendar();
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
        const eventAppointmentType = event.getTag('appointmentType');

        // ÖNEMLİ: TESLİM randevuları için staffId filtresini ATLAMA
        // Çünkü aynı saatte başka personelde teslim olup olmadığını kontrol etmemiz gerekiyor
        const isDelivery = eventAppointmentType === CONFIG.APPOINTMENT_TYPES.DELIVERY;

        if (!isDelivery && staffId !== 'all' && eventStaffId && eventStaffId !== staffId) {
          return; // Bu staff'a ait değil VE teslim değil, atla
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

      return { success: true, data: eventsByDate };

    } catch (error) {
      log.error('getGoogleEvents hatası:', error);
      return { success: true, data: {} };
    }
  }
};
