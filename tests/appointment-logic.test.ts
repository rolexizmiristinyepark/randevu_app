import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock app.ts logic - testing business rules
describe('Appointment Slot Availability Logic', () => {
  let CONFIG: any;
  let selectedAppointmentType: string | null;
  let specificStaffId: string | null;
  let dayShifts: Record<string, Record<number, string>>;
  let googleCalendarEvents: Record<string, any[]>;

  beforeEach(() => {
    // Reset state
    CONFIG = {
      MAX_DAILY_DELIVERY_APPOINTMENTS: 3
    };
    selectedAppointmentType = null;
    specificStaffId = null;
    dayShifts = {};
    googleCalendarEvents = {};
  });

  // ==================== MANAGEMENT APPOINTMENT LOGIC ====================

  describe('Management Appointments (VIP)', () => {
    beforeEach(() => {
      selectedAppointmentType = 'management';
    });

    it('should allow all days for management appointments', () => {
      // Management appointments bypass staff and shift checks
      const result = checkDayAvailability('2025-02-15');

      expect(result.available).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should allow management appointments even without staff shifts', () => {
      // No shifts defined
      dayShifts = {};

      const result = checkDayAvailability('2025-02-15');

      expect(result.available).toBe(true);
    });

    it('should allow management appointments when all staff are off', () => {
      // All staff off
      dayShifts = {
        '2025-02-15': {} // No staff working
      };

      const result = checkDayAvailability('2025-02-15');

      expect(result.available).toBe(true);
    });
  });

  // ==================== DELIVERY/SHIPPING LIMIT LOGIC ====================

  describe('Delivery & Shipping Slot Limits', () => {
    beforeEach(() => {
      selectedAppointmentType = 'delivery';
      specificStaffId = null;

      // Setup: Staff working on the date
      dayShifts = {
        '2025-02-15': {
          1: 'morning',
          2: 'full'
        }
      };
    });

    it('should allow delivery when under limit (0 appointments)', () => {
      googleCalendarEvents = {
        '2025-02-15': []
      };

      const result = checkDayAvailability('2025-02-15');

      expect(result.available).toBe(true);
    });

    it('should allow delivery when under limit (2 appointments, limit 3)', () => {
      googleCalendarEvents = {
        '2025-02-15': [
          {
            extendedProperties: {
              private: { appointmentType: 'delivery' }
            },
            start: { time: '10:00' }
          },
          {
            extendedProperties: {
              private: { appointmentType: 'shipping' }
            },
            start: { time: '14:00' }
          }
        ]
      };

      const result = checkDayAvailability('2025-02-15');

      expect(result.available).toBe(true);
    });

    it('should block delivery when at limit (3 appointments)', () => {
      googleCalendarEvents = {
        '2025-02-15': [
          {
            extendedProperties: {
              private: { appointmentType: 'delivery' }
            },
            start: { time: '10:00' }
          },
          {
            extendedProperties: {
              private: { appointmentType: 'shipping' }
            },
            start: { time: '12:00' }
          },
          {
            extendedProperties: {
              private: { appointmentType: 'delivery' }
            },
            start: { time: '15:00' }
          }
        ]
      };

      const result = checkDayAvailability('2025-02-15');

      expect(result.available).toBe(false);
      expect(result.reason).toContain('Saat takdim/gönderi randevuları dolu');
      expect(result.reason).toContain('3/3');
    });

    it('should count both delivery and shipping together', () => {
      googleCalendarEvents = {
        '2025-02-15': [
          {
            extendedProperties: {
              private: { appointmentType: 'delivery' }
            },
            start: { time: '10:00' }
          },
          {
            extendedProperties: {
              private: { appointmentType: 'delivery' }
            },
            start: { time: '11:00' }
          },
          {
            extendedProperties: {
              private: { appointmentType: 'shipping' }
            },
            start: { time: '13:00' }
          }
        ]
      };

      const result = checkDayAvailability('2025-02-15');

      expect(result.available).toBe(false);
      expect(result.reason).toContain('3/3');
    });

    it('should NOT count service/meeting appointments in delivery limit', () => {
      googleCalendarEvents = {
        '2025-02-15': [
          {
            extendedProperties: {
              private: { appointmentType: 'service' }
            },
            start: { time: '10:00' }
          },
          {
            extendedProperties: {
              private: { appointmentType: 'meeting' }
            },
            start: { time: '11:00' }
          },
          {
            extendedProperties: {
              private: { appointmentType: 'delivery' }
            },
            start: { time: '13:00' }
          }
        ]
      };

      const result = checkDayAvailability('2025-02-15');

      // Only 1 delivery appointment, under limit
      expect(result.available).toBe(true);
    });

    it('should apply limit to shipping appointments too', () => {
      selectedAppointmentType = 'shipping';

      googleCalendarEvents = {
        '2025-02-15': [
          {
            extendedProperties: {
              private: { appointmentType: 'shipping' }
            },
            start: { time: '10:00' }
          },
          {
            extendedProperties: {
              private: { appointmentType: 'delivery' }
            },
            start: { time: '13:00' }
          },
          {
            extendedProperties: {
              private: { appointmentType: 'shipping' }
            },
            start: { time: '15:00' }
          }
        ]
      };

      const result = checkDayAvailability('2025-02-15');

      expect(result.available).toBe(false);
      expect(result.reason).toContain('3/3');
    });

    it('should NOT apply limit to service appointments', () => {
      selectedAppointmentType = 'service';

      // 3 delivery/shipping appointments exist (at limit)
      googleCalendarEvents = {
        '2025-02-15': [
          {
            extendedProperties: {
              private: { appointmentType: 'delivery' }
            },
            start: { time: '10:00' }
          },
          {
            extendedProperties: {
              private: { appointmentType: 'shipping' }
            },
            start: { time: '13:00' }
          },
          {
            extendedProperties: {
              private: { appointmentType: 'delivery' }
            },
            start: { time: '15:00' }
          }
        ]
      };

      // Service appointment should still be available
      const result = checkDayAvailability('2025-02-15');

      expect(result.available).toBe(true);
    });
  });

  // ==================== STAFF SHIFT LOGIC ====================

  describe('Staff Availability', () => {
    beforeEach(() => {
      selectedAppointmentType = 'service';
      googleCalendarEvents = {}; // No appointments
    });

    it('should allow day when specific staff is working', () => {
      specificStaffId = '1';
      dayShifts = {
        '2025-02-15': {
          1: 'morning', // Staff 1 working
          2: 'full'
        }
      };

      const result = checkDayAvailability('2025-02-15');

      expect(result.available).toBe(true);
    });

    it('should block day when specific staff is NOT working', () => {
      specificStaffId = '1';
      dayShifts = {
        '2025-02-15': {
          2: 'full', // Only staff 2 working
          3: 'evening'
        }
      };

      const result = checkDayAvailability('2025-02-15');

      expect(result.available).toBe(false);
      expect(result.reason).toBe('İlgili çalışan bu gün müsait değil');
    });

    it('should block day when specific staff has no shift entry', () => {
      specificStaffId = '5';
      dayShifts = {
        '2025-02-15': {
          1: 'full',
          2: 'morning'
        }
      };

      const result = checkDayAvailability('2025-02-15');

      expect(result.available).toBe(false);
      expect(result.reason).toBe('İlgili çalışan bu gün müsait değil');
    });

    it('should allow day when ANY staff is working (general link)', () => {
      specificStaffId = null; // General link
      dayShifts = {
        '2025-02-15': {
          1: 'morning',
          2: 'full'
        }
      };

      const result = checkDayAvailability('2025-02-15');

      expect(result.available).toBe(true);
    });

    it('should block day when NO staff is working (general link)', () => {
      specificStaffId = null;
      dayShifts = {
        '2025-02-15': {} // No staff working
      };

      const result = checkDayAvailability('2025-02-15');

      expect(result.available).toBe(false);
      expect(result.reason).toBe('Çalışan yok');
    });

    it('should allow day for staff=0 when ANY staff is working', () => {
      specificStaffId = '0'; // Manual appointment link
      dayShifts = {
        '2025-02-15': {
          1: 'evening'
        }
      };

      const result = checkDayAvailability('2025-02-15');

      expect(result.available).toBe(true);
    });

    it('should block day for staff=0 when NO staff is working', () => {
      specificStaffId = '0';
      dayShifts = {
        '2025-02-15': {}
      };

      const result = checkDayAvailability('2025-02-15');

      expect(result.available).toBe(false);
      expect(result.reason).toBe('Çalışan yok');
    });
  });

  // ==================== PAST TIME FILTERING ====================

  describe('Past Time Filtering for Delivery Appointments', () => {
    beforeEach(() => {
      selectedAppointmentType = 'delivery';
      specificStaffId = null;

      dayShifts = {
        '2025-02-15': {
          1: 'full'
        }
      };

      // Mock current time: 2025-02-15 13:30
      vi.setSystemTime(new Date('2025-02-15T13:30:00'));
    });

    it('should NOT count past appointments for today', () => {
      const todayStr = '2025-02-15';

      googleCalendarEvents = {
        [todayStr]: [
          {
            extendedProperties: {
              private: { appointmentType: 'delivery' }
            },
            start: {
              dateTime: '2025-02-15T10:00:00Z',
              time: '10:00'
            }
          },
          {
            extendedProperties: {
              private: { appointmentType: 'delivery' }
            },
            start: {
              dateTime: '2025-02-15T12:00:00Z',
              time: '12:00'
            }
          },
          {
            extendedProperties: {
              private: { appointmentType: 'delivery' }
            },
            start: {
              dateTime: '2025-02-15T15:00:00Z',
              time: '15:00'
            }
          }
        ]
      };

      const result = checkDayAvailability(todayStr);

      // Only future appointment (15:00) should count: 1/3, still available
      expect(result.available).toBe(true);
    });

    it('should count all appointments for future dates', () => {
      const futureDate = '2025-02-20';

      googleCalendarEvents = {
        [futureDate]: [
          {
            extendedProperties: {
              private: { appointmentType: 'delivery' }
            },
            start: { time: '10:00' }
          },
          {
            extendedProperties: {
              private: { appointmentType: 'shipping' }
            },
            start: { time: '12:00' }
          },
          {
            extendedProperties: {
              private: { appointmentType: 'delivery' }
            },
            start: { time: '15:00' }
          }
        ]
      };

      // Temporarily change date for this check
      dayShifts[futureDate] = { 1: 'full' };

      const result = checkDayAvailability(futureDate);

      // All 3 appointments should count (future date)
      expect(result.available).toBe(false);
      expect(result.reason).toContain('3/3');
    });
  });

  // ==================== HELPER FUNCTION (implementation based on app.ts:596-654) ====================

  function checkDayAvailability(dateStr: string) {
    // Management appointments: always available
    if (selectedAppointmentType === 'management') {
      return { available: true };
    }

    // Staff shift check
    if (specificStaffId && specificStaffId !== '0') {
      // Specific staff link: check if that staff is working
      const staffHasShift = dayShifts[dateStr] && dayShifts[dateStr][parseInt(specificStaffId)];
      if (!staffHasShift) {
        return { available: false, reason: 'İlgili çalışan bu gün müsait değil' };
      }
    } else {
      // General link or staff=0: check if ANY staff is working
      const hasShifts = dayShifts[dateStr] && Object.keys(dayShifts[dateStr]).length > 0;
      if (!hasShifts) {
        return { available: false, reason: 'Çalışan yok' };
      }
    }

    // Google Calendar delivery/shipping limit check
    const calendarEvents = googleCalendarEvents[dateStr] || [];
    const now = new Date();
    const todayStr = toLocalDate(now);

    const deliveryCount = calendarEvents.filter(event => {
      const appointmentType = event.extendedProperties?.private?.appointmentType;
      if (appointmentType !== 'delivery' && appointmentType !== 'shipping') {
        return false;
      }

      // If today, skip past appointments
      if (dateStr === todayStr && event.start) {
        const eventTime = event.start.time || (() => {
          const t = new Date(event.start.dateTime);
          return String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
        })();
        const currentTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
        if (eventTime < currentTime) {
          return false;
        }
      }

      return true;
    }).length;

    // Delivery/shipping limit check
    if (selectedAppointmentType === 'delivery' || selectedAppointmentType === 'shipping') {
      if (deliveryCount >= CONFIG.MAX_DAILY_DELIVERY_APPOINTMENTS) {
        return {
          available: false,
          reason: `Saat takdim/gönderi randevuları dolu (${deliveryCount}/${CONFIG.MAX_DAILY_DELIVERY_APPOINTMENTS})`
        };
      }
    }

    return { available: true };
  }

  function toLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
});
