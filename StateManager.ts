/**
 * StateManager.ts
 *
 * Centralized state management with type-safe getters/setters and pub/sub pattern.
 * Replaces global variables scattered throughout app.ts
 */

// ==================== TYPES ====================

export interface Staff {
  id: string;
  name: string;
  active: boolean;
  phone?: string;
  email?: string;
  role?: string; // 'sales' | 'management' | etc.
}

export interface Shift {
  [staffId: string]: string; // 'morning' | 'evening' | 'full'
}

export interface Appointment {
  id: string;
  date: string;
  time: string;
  staffId: string;
  type: string;
  customerName: string;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  start: { dateTime: string };
  end: { dateTime: string };
}

export interface AppointmentData {
  date: string;
  time: string;
  staffName: string;
  customerNote?: string;
  appointmentType: string;
}

// ==================== STATE INTERFACE ====================

// Profile types (v3.2)
export type ProfilType = 'genel' | 'personel' | 'vip' | 'gunluk' | 'manuel' | 'yonetim';

export interface ProfileData {
  id: string;
  name?: string;
  role?: string;
  type?: string;
}

// v3.5: Profil ayarları interface (simplified - only bugun/hepsi for calendar)
export interface ProfilAyarlari {
  sameDayBooking: boolean;
  maxSlotAppointment: number;
  slotGrid: number;
  maxDailyPerStaff: number;
  maxDailyDelivery: number;
  duration: number;
  assignByAdmin: boolean;
  allowedTypes: string[];
  staffFilter: string;
  showCalendar: boolean;
  takvimFiltresi: 'bugun' | 'hepsi';
}

export interface AppState {
  // Calendar state
  currentMonth: Date;
  selectedDate: string | null;

  // Selection state
  selectedStaff: number | string | null;
  selectedTime: string | null;
  selectedShiftType: string | null;
  selectedAppointmentType: string | null;

  // Data cache
  staffMembers: Staff[];
  dayShifts: Record<string, Shift>;
  allAppointments: Record<string, Appointment[]>;
  googleCalendarEvents: Record<string, CalendarEvent[]>;

  // URL state (legacy - keeping for backward compatibility)
  specificStaffId: string | null;
  managementLevel: number | null; // 1, 2, 3 for HK, OK, HMK
  isManagementLink: boolean;

  // v3.2 Profile state
  currentProfile: ProfilType;
  profileId: string | null;
  profileData: ProfileData | null;
  profileError: string | null;
  linkedStaffId: string | null;
  linkedStaffName: string | null;
  linkedStaffRole: string | null;
  profilAyarlari: ProfilAyarlari | null;

  // Last action
  lastAppointmentData: AppointmentData | null;

  // Management
  managementContactPerson: string | null;
}

type StateKey = keyof AppState;
type StateListener<K extends StateKey> = (value: AppState[K], oldValue: AppState[K]) => void;

// ==================== STATE MANAGER ====================

class StateManager {
  private state: AppState;
  private listeners: Map<StateKey, Set<StateListener<any>>> = new Map();

  constructor() {
    // Initialize with default values
    this.state = {
      currentMonth: new Date(),
      selectedDate: null,
      selectedStaff: null,
      selectedTime: null,
      selectedShiftType: null,
      selectedAppointmentType: null,
      staffMembers: [],
      dayShifts: {},
      allAppointments: {},
      googleCalendarEvents: {},
      specificStaffId: null,
      managementLevel: null,
      isManagementLink: false,
      // v3.2 Profile state
      currentProfile: 'genel',
      profileId: null,
      profileData: null,
      profileError: null,
      linkedStaffId: null,
      linkedStaffName: null,
      linkedStaffRole: null,
      profilAyarlari: null,
      lastAppointmentData: null,
      managementContactPerson: null,
    };
  }

  /**
   * Get state value by key
   */
  get<K extends StateKey>(key: K): AppState[K] {
    return this.state[key];
  }

  /**
   * Set state value by key and notify listeners
   */
  set<K extends StateKey>(key: K, value: AppState[K]): void {
    const oldValue = this.state[key];

    // Only update if value changed
    if (oldValue === value) return;

    this.state[key] = value;

    // Notify listeners
    this.notify(key, value, oldValue);
  }

  /**
   * Update multiple state values at once
   */
  update(updates: Partial<AppState>): void {
    Object.entries(updates).forEach(([key, value]) => {
      this.set(key as StateKey, value as any);
    });
  }

  /**
   * Subscribe to state changes
   */
  subscribe<K extends StateKey>(
    key: K,
    listener: StateListener<K>
  ): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }

    this.listeners.get(key)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.get(key)?.delete(listener);
    };
  }

  /**
   * Notify all listeners for a specific key
   */
  private notify<K extends StateKey>(
    key: K,
    value: AppState[K],
    oldValue: AppState[K]
  ): void {
    const keyListeners = this.listeners.get(key);
    if (keyListeners) {
      keyListeners.forEach(listener => {
        try {
          listener(value, oldValue);
        } catch (error) {
          console.error(`Error in state listener for "${key}":`, error);
        }
      });
    }
  }

  /**
   * Reset specific state keys
   */
  reset(keys: StateKey[]): void {
    const defaults: Partial<AppState> = {
      selectedDate: null,
      selectedStaff: null,
      selectedTime: null,
      selectedShiftType: null,
      selectedAppointmentType: null,
      lastAppointmentData: null,
    };

    keys.forEach(key => {
      if (key in defaults) {
        this.set(key, defaults[key] as any);
      }
    });
  }

  /**
   * Reset all selection state
   */
  resetSelection(): void {
    this.reset([
      'selectedDate',
      'selectedStaff',
      'selectedTime',
      'selectedShiftType',
      'selectedAppointmentType',
    ]);
  }

  /**
   * Get entire state (for debugging)
   */
  getState(): Readonly<AppState> {
    return { ...this.state };
  }
}

// ==================== SINGLETON EXPORT ====================

export const state = new StateManager();

// Export for window/global access (backward compatibility)
if (typeof window !== 'undefined') {
  (window as any).appState = state;
}
