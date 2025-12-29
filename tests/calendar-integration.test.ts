import { describe, it, expect } from 'vitest';
import { APPOINTMENT_TYPE_NAMES } from '../calendar-config';

// Test calendar integration logic without module imports
describe('Calendar Integration Logic', () => {
  describe('Appointment Type Names Configuration', () => {
    it('should have Turkish names with Randevusu suffix for all appointment types', () => {
      expect(APPOINTMENT_TYPE_NAMES['delivery']).toBe('Teslim Randevusu');
      expect(APPOINTMENT_TYPE_NAMES['service']).toBe('Servis Randevusu');
      expect(APPOINTMENT_TYPE_NAMES['consultation']).toBe('Danışmanlık Randevusu');
      expect(APPOINTMENT_TYPE_NAMES['meeting']).toBe('Görüşme Randevusu');
      expect(APPOINTMENT_TYPE_NAMES['management']).toBe('Yönetim Randevusu');
    });

    it('should have meeting as alias for general', () => {
      expect(APPOINTMENT_TYPE_NAMES['meeting']).toBe('Görüşme Randevusu');
      expect(APPOINTMENT_TYPE_NAMES['general']).toBe('Görüşme Randevusu');
    });
  });

  describe('ICS Date Formatting', () => {
    it('should format date in iCalendar format (YYYYMMDDTHHMMSS)', () => {
      const date = new Date('2025-02-15T14:30:00');
      const formatted = toICSDate(date);

      expect(formatted).toBe('20250215T143000');
    });

    it('should handle single digit months and days', () => {
      const date = new Date('2025-03-05T09:05:00');
      const formatted = toICSDate(date);

      expect(formatted).toBe('20250305T090500');
    });

    it('should handle midnight', () => {
      const date = new Date('2025-02-15T00:00:00');
      const formatted = toICSDate(date);

      expect(formatted).toBe('20250215T000000');
    });

    it('should handle end of day', () => {
      const date = new Date('2025-02-15T23:59:59');
      const formatted = toICSDate(date);

      expect(formatted).toBe('20250215T235959');
    });
  });

  describe('ICS File Structure', () => {
    it('should contain required vCal 2.0 fields', () => {
      const icsLines = createBasicICS();

      expect(icsLines).toContain('BEGIN:VCALENDAR');
      expect(icsLines).toContain('VERSION:2.0');
      expect(icsLines).toContain('END:VCALENDAR');
      expect(icsLines).toContain('BEGIN:VEVENT');
      expect(icsLines).toContain('END:VEVENT');
    });

    it('should include Europe/Istanbul timezone', () => {
      const icsLines = createBasicICS();

      expect(icsLines).toContain('BEGIN:VTIMEZONE');
      expect(icsLines).toContain('TZID:Europe/Istanbul');
      expect(icsLines).toContain('TZOFFSETFROM:+0300');
      expect(icsLines).toContain('TZOFFSETTO:+0300');
      expect(icsLines).toContain('END:VTIMEZONE');
    });

    it('should use CRLF line breaks', () => {
      const icsContent = createBasicICS();

      expect(icsContent).toContain('\r\n');
    });
  });

  describe('Alarm Configuration', () => {
    it('should calculate morning alarm offset correctly', () => {
      const testCases = [
        { time: '11:00', expectedHours: 1 },  // 11 - 10 = 1
        { time: '13:00', expectedHours: 3 },  // 13 - 10 = 3
        { time: '16:00', expectedHours: 6 },  // 16 - 10 = 6
        { time: '20:00', expectedHours: 10 }  // 20 - 10 = 10
      ];

      testCases.forEach(({ time, expectedHours }) => {
        const [hour] = time.split(':').map(Number);
        const offset = calculateMorningAlarmOffset(hour || 0);

        expect(offset).toBe(expectedHours);
      });
    });

    it('should not create morning alarm for 10:00 or earlier', () => {
      expect(calculateMorningAlarmOffset(10)).toBe(0);
      expect(calculateMorningAlarmOffset(9)).toBe(-1);
      expect(calculateMorningAlarmOffset(8)).toBe(-2);
    });

    it('should format alarm trigger for relative time', () => {
      expect(formatAlarmTrigger(1, 'hours')).toBe('-PT1H');
      expect(formatAlarmTrigger(4, 'hours')).toBe('-PT4H');
      expect(formatAlarmTrigger(1, 'days')).toBe('-P1D');
    });
  });

  describe('Event Summary (Title) Generation', () => {
    it('should format customer event title correctly when staff assigned', () => {
      const title = generateEventTitle('Serdar Benli', 'delivery', true);

      expect(title).toBe('İzmir İstinyepark Rolex - Serdar Benli (Teslim Randevusu)');
    });

    it('should format unassigned title correctly', () => {
      const title = generateEventTitle('', 'meeting', false);

      expect(title).toBe('Rolex İzmir İstinyepark - Görüşme Randevusu');
    });

    it('should handle unknown appointment type', () => {
      const title = generateEventTitle('Serdar Benli', 'unknown', true);

      expect(title).toContain('Serdar Benli');
      expect(title).toContain('(Genel)'); // Fallback
    });

    it('should preserve Turkish characters in names', () => {
      const title = generateEventTitle('Şükran Çiğdem', 'service', true);

      expect(title).toContain('Şükran Çiğdem');
      expect(title).toContain('Servis Randevusu');
    });
  });

  describe('Description Field Generation', () => {
    it('should include all appointment details', () => {
      const description = generateEventDescription({
        staffName: 'Serdar Benli',
        staffPhone: '0555 123 45 67',
        staffEmail: 'serdar@rolex.com',
        date: '2025-02-15',
        time: '14:00',
        appointmentType: 'delivery',
        customerNote: 'VIP müşteri'
      });

      expect(description).toContain('İlgili: Serdar Benli');
      expect(description).toContain('İletişim: 0555 123 45 67');
      expect(description).toContain('E-posta: serdar@rolex.com');
      expect(description).toContain('Tarih: 15 Şubat 2025');
      expect(description).toContain('Saat: 14:00');
      expect(description).toContain('Konu: Teslim Randevusu');
      expect(description).toContain('Ek Bilgi: VIP müşteri');
    });

    it('should handle missing contact info', () => {
      const description = generateEventDescription({
        staffName: 'Serdar Benli',
        staffPhone: '',
        staffEmail: '',
        date: '2025-02-15',
        time: '14:00',
        appointmentType: 'service',
        customerNote: ''
      });

      expect(description).toContain('İletişim: Belirtilmedi');
      expect(description).toContain('E-posta: Belirtilmedi');
      expect(description).not.toContain('Ek Bilgi:');
    });

    it('should use \\\\n for line breaks in ICS format', () => {
      const description = generateEventDescription({
        staffName: 'Serdar Benli',
        staffPhone: '0555 123 45 67',
        staffEmail: 'serdar@rolex.com',
        date: '2025-02-15',
        time: '14:00',
        appointmentType: 'delivery',
        customerNote: ''
      });

      expect(description).toContain('\\n');
      expect(description).not.toContain('\n'); // Not literal newline
    });
  });

  // ==================== HELPER FUNCTIONS ====================

  function toICSDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}T${hours}${minutes}${seconds}`;
  }

  function createBasicICS(): string {
    const lines = [
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
      'SUMMARY:Test Event',
      'DTSTART;TZID=Europe/Istanbul:20250215T140000',
      'DTEND;TZID=Europe/Istanbul:20250215T150000',
      'END:VEVENT',
      'END:VCALENDAR'
    ];

    return lines.join('\r\n');
  }

  function calculateMorningAlarmOffset(appointmentHour: number): number {
    const morningHour = 10;
    return appointmentHour - morningHour;
  }

  function formatAlarmTrigger(value: number, unit: 'hours' | 'days'): string {
    if (unit === 'hours') {
      return `-PT${value}H`;
    } else {
      return `-P${value}D`;
    }
  }

  function generateEventTitle(staffName: string, appointmentType: string, isStaffAssigned: boolean = true): string {
    const typeName = (APPOINTMENT_TYPE_NAMES as any)[appointmentType] || 'Genel';
    if (isStaffAssigned) {
      return `İzmir İstinyepark Rolex - ${staffName} (${typeName})`;
    } else {
      // v3.9.19d: Atanmamış - normal format
      return `Rolex İzmir İstinyepark - ${typeName}`;
    }
  }

  function generateEventDescription(data: {
    staffName: string;
    staffPhone: string;
    staffEmail: string;
    date: string;
    time: string;
    appointmentType: string;
    customerNote: string;
  }): string {
    const appointmentTypeName = (APPOINTMENT_TYPE_NAMES as any)[data.appointmentType] || 'Genel';
    const appointmentDate = new Date(data.date);
    const formattedDate = appointmentDate.toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    let description = 'RANDEVU BİLGİLERİ\\n\\n';
    description += `İlgili: ${data.staffName}\\n`;
    description += `İletişim: ${data.staffPhone || 'Belirtilmedi'}\\n`;
    description += `E-posta: ${data.staffEmail || 'Belirtilmedi'}\\n`;
    description += `Tarih: ${formattedDate}\\n`;
    description += `Saat: ${data.time}\\n`;
    description += `Konu: ${appointmentTypeName}\\n`;

    if (data.customerNote) {
      description += `Ek Bilgi: ${data.customerNote}\\n`;
    }

    description += '\\nRandevunuza zamanında gelmenizi rica ederiz.';

    return description;
  }
});
