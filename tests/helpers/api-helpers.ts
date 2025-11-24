/**
 * API HELPER UTILITIES FOR ADMIN-PANEL TESTS
 * Mock API responses and utilities for testing admin panel API interactions
 */

import { vi } from 'vitest';

// ==================== TYPES ====================

export interface Staff {
  id: string;
  name: string;
  phone: string;
  email: string;
  active: boolean;
}

export interface Settings {
  interval: number;
  maxDaily: number;
}

export interface Shift {
  staffId: string;
  date: string;
  startTime: string;
  endTime: string;
}

export interface Appointment {
  id: string;
  date: string;
  time: string;
  type: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  staffId?: string;
  staffName?: string;
  note?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// ==================== MOCK DATA GENERATORS ====================

/**
 * Generate mock staff member
 */
export function createMockStaff(overrides?: Partial<Staff>): Staff {
  return {
    id: `staff-${Math.random().toString(36).substring(7)}`,
    name: 'Test Staff',
    phone: '0555 123 4567',
    email: 'test@example.com',
    active: true,
    ...overrides
  };
}

/**
 * Generate multiple mock staff members
 */
export function createMockStaffList(count: number = 3): Staff[] {
  return Array.from({ length: count }, (_, i) => createMockStaff({
    id: `staff-${i + 1}`,
    name: `Staff ${i + 1}`,
    phone: `0555 ${100 + i} 4567`,
    email: `staff${i + 1}@example.com`
  }));
}

/**
 * Generate mock settings
 */
export function createMockSettings(overrides?: Partial<Settings>): Settings {
  return {
    interval: 60,
    maxDaily: 4,
    ...overrides
  };
}

/**
 * Generate mock shift
 */
export function createMockShift(overrides?: Partial<Shift>): Shift {
  return {
    staffId: 'staff-1',
    date: '2024-01-15',
    startTime: '09:00',
    endTime: '17:00',
    ...overrides
  };
}

/**
 * Generate mock appointment
 */
export function createMockAppointment(overrides?: Partial<Appointment>): Appointment {
  return {
    id: `apt-${Math.random().toString(36).substring(7)}`,
    date: '2024-01-15',
    time: '14:00',
    type: 'delivery',
    customerName: 'Test Customer',
    customerPhone: '0555 999 8877',
    customerEmail: 'customer@example.com',
    ...overrides
  };
}

/**
 * Generate multiple mock appointments
 */
export function createMockAppointmentList(count: number = 5): Appointment[] {
  return Array.from({ length: count }, (_, i) => createMockAppointment({
    id: `apt-${i + 1}`,
    time: `${10 + i}:00`,
    customerName: `Customer ${i + 1}`
  }));
}

// ==================== API RESPONSE HELPERS ====================

/**
 * Create successful API response
 */
export function createSuccessResponse<T>(data: T, message?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    message: message || 'İşlem başarılı'
  };
}

/**
 * Create error API response
 */
export function createErrorResponse(error: string): ApiResponse {
  return {
    success: false,
    error
  };
}

// ==================== FETCH MOCKING ====================

/**
 * Mock successful fetch response
 */
export function mockFetchSuccess<T>(data: T, delay: number = 0): Promise<Response> {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({
        ok: true,
        status: 200,
        json: async () => createSuccessResponse(data),
        text: async () => JSON.stringify(createSuccessResponse(data)),
        headers: new Headers(),
        redirected: false,
        statusText: 'OK',
        type: 'basic' as ResponseType,
        url: 'http://localhost:3000/api',
        clone: function() { return this; },
        body: null,
        bodyUsed: false,
        arrayBuffer: async () => new ArrayBuffer(0),
        blob: async () => new Blob([JSON.stringify(createSuccessResponse(data))]),
        formData: async () => new FormData()
      } as Response);
    }, delay);
  });
}

/**
 * Mock failed fetch response
 */
export function mockFetchError(error: string, delay: number = 0): Promise<Response> {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({
        ok: false,
        status: 500,
        json: async () => createErrorResponse(error),
        text: async () => JSON.stringify(createErrorResponse(error)),
        headers: new Headers(),
        redirected: false,
        statusText: 'Internal Server Error',
        type: 'basic' as ResponseType,
        url: 'http://localhost:3000/api',
        clone: function() { return this; },
        body: null,
        bodyUsed: false,
        arrayBuffer: async () => new ArrayBuffer(0),
        blob: async () => new Blob([JSON.stringify(createErrorResponse(error))]),
        formData: async () => new FormData()
      } as Response);
    }, delay);
  });
}

/**
 * Mock network error (no response)
 */
export function mockNetworkError(delay: number = 0): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error('Network error'));
    }, delay);
  });
}

// ==================== API ACTION MOCKS ====================

/**
 * Mock API responses for staff operations
 */
export const mockStaffAPI = {
  /**
   * Mock get staff list
   */
  getStaff: (staffList: Staff[] = createMockStaffList()) => {
    return mockFetchSuccess({ staff: staffList });
  },

  /**
   * Mock add staff
   */
  addStaff: (staff: Staff = createMockStaff()) => {
    return mockFetchSuccess({ staff }, 100);
  },

  /**
   * Mock update staff
   */
  updateStaff: (staff: Staff) => {
    return mockFetchSuccess({ staff }, 100);
  },

  /**
   * Mock delete staff
   */
  deleteStaff: (staffId: string) => {
    return mockFetchSuccess({ staffId }, 100);
  },

  /**
   * Mock toggle staff active state
   */
  toggleStaff: (staffId: string, active: boolean) => {
    return mockFetchSuccess({ staffId, active }, 100);
  },

  /**
   * Mock error response
   */
  error: (message: string) => {
    return mockFetchError(message, 50);
  }
};

/**
 * Mock API responses for settings operations
 */
export const mockSettingsAPI = {
  /**
   * Mock get settings
   */
  getSettings: (settings: Settings = createMockSettings()) => {
    return mockFetchSuccess(settings);
  },

  /**
   * Mock save settings
   */
  saveSettings: (settings: Settings) => {
    return mockFetchSuccess(settings, 100);
  },

  /**
   * Mock error response
   */
  error: (message: string) => {
    return mockFetchError(message, 50);
  }
};

/**
 * Mock API responses for shift operations
 */
export const mockShiftAPI = {
  /**
   * Mock get shifts
   */
  getShifts: (shifts: Shift[] = []) => {
    return mockFetchSuccess({ shifts });
  },

  /**
   * Mock save shifts
   */
  saveShifts: (shifts: Shift[]) => {
    return mockFetchSuccess({ shifts }, 100);
  },

  /**
   * Mock error response
   */
  error: (message: string) => {
    return mockFetchError(message, 50);
  }
};

/**
 * Mock API responses for appointment operations
 */
export const mockAppointmentAPI = {
  /**
   * Mock get appointments
   */
  getAppointments: (appointments: Appointment[] = createMockAppointmentList()) => {
    return mockFetchSuccess({ appointments });
  },

  /**
   * Mock update appointment
   */
  updateAppointment: (appointment: Appointment) => {
    return mockFetchSuccess({ appointment }, 100);
  },

  /**
   * Mock delete appointment
   */
  deleteAppointment: (appointmentId: string) => {
    return mockFetchSuccess({ appointmentId }, 100);
  },

  /**
   * Mock assign staff to appointment
   */
  assignStaff: (appointmentId: string, staffId: string) => {
    return mockFetchSuccess({ appointmentId, staffId }, 100);
  },

  /**
   * Mock error response
   */
  error: (message: string) => {
    return mockFetchError(message, 50);
  }
};

// ==================== GLOBAL FETCH MOCK ====================

/**
 * Setup global fetch mock for all API calls
 */
export function setupFetchMock(): void {
  global.fetch = vi.fn();
}

/**
 * Mock fetch to return specific response
 */
export function mockFetch(response: Promise<Response>): void {
  (global.fetch as any).mockResolvedValueOnce(response);
}

/**
 * Mock fetch to throw error
 */
export function mockFetchThrow(error: Error): void {
  (global.fetch as any).mockRejectedValueOnce(error);
}

/**
 * Get fetch call arguments
 */
export function getFetchCalls(): any[] {
  return (global.fetch as any).mock.calls;
}

/**
 * Get last fetch call arguments
 */
export function getLastFetchCall(): any[] {
  const calls = getFetchCalls();
  return calls[calls.length - 1] || [];
}

/**
 * Clear fetch mock calls
 */
export function clearFetchMock(): void {
  (global.fetch as any).mockClear();
}

/**
 * Reset fetch mock
 */
export function resetFetchMock(): void {
  (global.fetch as any).mockReset();
}

// ==================== API CALL VERIFICATION ====================

/**
 * Verify fetch was called with specific URL
 */
export function verifyFetchCalledWith(url: string, options?: RequestInit): boolean {
  const calls = getFetchCalls();
  return calls.some(call => {
    const [callUrl, callOptions] = call;
    if (!callUrl.includes(url)) return false;
    if (!options) return true;

    // Check method
    if (options.method && callOptions?.method !== options.method) return false;

    // Check body
    if (options.body && callOptions?.body !== options.body) return false;

    return true;
  });
}

/**
 * Get fetch call count
 */
export function getFetchCallCount(): number {
  return getFetchCalls().length;
}

/**
 * Verify fetch was called exactly N times
 */
export function verifyFetchCalledTimes(times: number): boolean {
  return getFetchCallCount() === times;
}
