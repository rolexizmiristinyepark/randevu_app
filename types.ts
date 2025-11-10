/**
 * Global Type Definitions
 * Shared types for the appointment booking system
 */

// ==================== CONFIG TYPES ====================

export interface Shift {
  start: number;
  end: number;
  label: string;
}

export interface AppointmentHours {
  earliest: number;
  latest: number;
  interval: number;
}

export interface AppointmentTypeConfig {
  value: string;
  name: string;
}

export interface Config {
  APPS_SCRIPT_URL: string;
  BASE_URL: string;
  DEBUG: boolean;
  SHIFTS: {
    morning: Shift;
    evening: Shift;
    full: Shift;
  };
  APPOINTMENT_HOURS: AppointmentHours;
  MAX_DAILY_DELIVERY_APPOINTMENTS: number;
  APPOINTMENT_TYPES: AppointmentTypeConfig[];
}

// ==================== STAFF TYPES ====================

export interface Staff {
  id: number | string;
  name: string;
  phone: string;
  email?: string;
  active: boolean;
}

// ==================== APPOINTMENT TYPES ====================

export type AppointmentType = 'delivery' | 'service' | 'consultation' | 'general' | 'management' | 'meeting';
export type ShiftType = 'morning' | 'evening' | 'full';

export interface AppointmentData {
  date: string;
  time: string;
  staffId: number | string;
  staffName: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerNote: string;
  shiftType: ShiftType;
  appointmentType: AppointmentType;
  duration: number;
  turnstileToken?: string;
}

export interface LastAppointmentData {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerNote: string;
  staffName: string;
  staffPhone: string;
  staffEmail: string;
  date: string;
  time: string;
  appointmentType: AppointmentType;
  duration: number;
}

// ==================== CALENDAR TYPES ====================

export interface TimeSlot {
  start: string;
  end: string;
  hour: number;
  time: string;
}

export interface DayStatus {
  isDeliveryMaxed: boolean;
  availableHours: number[];
  unavailableHours: number[];
  deliveryCount?: number;
}

export interface DailySlotsResponse {
  slots: TimeSlot[];
}

export interface GoogleCalendarEvent {
  summary?: string;
  start?: {
    dateTime?: string;
    time?: string;
  };
  extendedProperties?: {
    private?: {
      appointmentType?: string;
    };
  };
}

// ==================== CACHE TYPES ====================

export interface CacheObject<T = any> {
  value: T;
  timestamp: number;
}

export interface MonthCacheData {
  dayShifts: Record<string, Record<number | string, ShiftType>>;
  allAppointments: Record<string, any[]>;
  googleCalendarEvents: Record<string, GoogleCalendarEvent[]>;
}

// ==================== STATE TYPES ====================

export interface AppState {
  currentMonth: Date;
  selectedDate: string | null;
  selectedStaff: number | string | null;
  selectedTime: string | null;
  selectedShiftType: ShiftType | null;
  selectedAppointmentType: AppointmentType | null;
  staffMembers: Staff[];
  dayShifts: Record<string, Record<number | string, ShiftType>>;
  allAppointments: Record<string, any[]>;
  googleCalendarEvents: Record<string, GoogleCalendarEvent[]>;
  specificStaffId: string | null;
  lastAppointmentData: LastAppointmentData | null;
}

// ==================== API TYPES ====================

export interface ApiCallOptions {
  successMessage?: string;
  errorPrefix?: string;
  onSuccess?: (response: any) => void;
  onError?: (error: any) => void;
  showLoading?: boolean;
}

export interface BackendConfig {
  shifts?: {
    morning: { start: string; end: string };
    evening: { start: string; end: string };
    full: { start: string; end: string };
  };
  appointmentHours?: AppointmentHours;
  maxDailyDeliveryAppointments?: number;
}

export interface Settings {
  interval?: number;
  maxDaily?: number;
}

// ==================== UTILITY TYPES ====================

export interface DayAvailability {
  available: boolean;
  reason?: string;
}

export interface CreateElementOptions {
  className?: string;
  id?: string;
  style?: Partial<CSSStyleDeclaration>;
  [key: string]: any;
}

export type AlertType = 'success' | 'error' | 'warning' | 'info';

// ==================== WINDOW TYPES (Global) ====================

declare global {
  interface Window {
    CONFIG: Config;
    lastAppointmentData: LastAppointmentData | null;
    managementContactPerson?: string;
    CalendarIntegration?: any;
    turnstile?: {
      getResponse: () => string | undefined;
    };
    Sentry?: any;
  }
}

export {};
