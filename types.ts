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

export type StaffRole = 'sales' | 'management' | 'reception' | 'service';

export interface Staff {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role?: StaffRole;
  isAdmin?: boolean;
  isVip?: boolean;
  active: boolean;
}

// ==================== APPOINTMENT TYPES ====================

export type AppointmentType = 'delivery' | 'service' | 'consultation' | 'general' | 'management' | 'meeting' | 'shipping';
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
    // Application Configuration
    CONFIG: {
      APPS_SCRIPT_URL: string;
      BASE_URL: string;
      DEBUG: boolean;
      VERSION: string;
      shifts: Record<string, { start: number; end: number; label: string }>;
      appointmentHours: { earliest: number; latest: number; interval: number };
      maxDailyDeliveryAppointments: number;
      appointmentTypes: Record<string, string>;
      companyName?: string;
      companyLocation?: string;
    };

    // Authentication
    AdminAuth?: {
      showLoginModal: () => void;
      getSessionToken: () => string | null;
      isAuthenticated: () => boolean;
      logout: () => void;
    };

    // UI Utilities
    UI?: {
      showAlert: (message: string, type: string) => void;
      showLoading?: (show: boolean) => void;
      updateUI?: () => void;
      switchTab?: (tabName: string) => void;
    };

    // API Service
    ApiService?: {
      call: (action: string, params?: Record<string, unknown>) => Promise<unknown>;
    };
    apiCall?: (action: string, params?: Record<string, unknown>) => Promise<unknown>;
    apiCallWithKey?: (action: string, params?: Record<string, unknown>, apiKey?: string) => Promise<unknown>;

    // Time Selector
    selectTimeSlot?: (time: string) => void;
    displayAvailableTimeSlots?: (slots: TimeSlot[]) => void;
    TimeSelector?: unknown;

    // Security Helpers (exposed globally for backward compatibility)
    sanitizeInput?: (input: string, options?: Record<string, unknown>) => string;
    sanitizePhone?: (phone: string) => string;
    sanitizeEmail?: (email: string) => string;
    sanitizeName?: (name: string) => string;
    escapeHtml?: (str: string) => string;
    createElement?: (tag: string, options?: Record<string, unknown>, text?: string) => HTMLElement;
    showAlertSafe?: (message: string, type: string) => void;
    createFragmentFromTrustedHtml?: (html: string) => DocumentFragment;
    createSafeFragment?: (html: string) => DocumentFragment;
    maskEmail?: (email: string) => string;
    maskPhone?: (phone: string) => string;
    maskName?: (name: string) => string;

    // Logging
    SecureLogger?: unknown;

    // State & Data
    lastAppointmentData: LastAppointmentData | null;
    managementContactPerson?: string;
    turnstileVerified?: boolean;

    // External Libraries
    CalendarIntegration?: {
      addToGoogleCalendar?: (data: Record<string, unknown>) => void;
      addToAppleCalendar?: (data: Record<string, unknown>) => void;
    };
    turnstile?: {
      getResponse: () => string | undefined;
      reset: () => void;
    };
    Sentry?: {
      captureException: (error: Error | unknown) => void;
      captureMessage: (message: string) => void;
    };
  }
}

export {};
