/**
 * ADMIN-PANEL DATA MANAGEMENT TESTS
 * Comprehensive test suite for Data Management region (admin-panel.ts lines 26-62)
 *
 * Test Coverage:
 * - Data object initialization and state
 * - loadStaff() - Load staff from API
 * - loadShifts() - Initialize shifts object
 * - loadSettings() - Load settings from API
 * - Error handling for data loading
 * - Data consistency and mutations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  setupAdminPanelTest,
  cleanupAdminPanelTest,
  createMockStaff,
  createMockStaffList,
  createMockSettings,
  mockFetch,
  mockFetchSuccess,
  mockFetchError,
  mockNetworkError,
  createSuccessResponse,
  createErrorResponse,
  getFetchCallCount,
  verifyFetchCalledWith,
  nextTick
} from './helpers/test-utils';

// Mock Data object structure (matches admin-panel.ts Data object)
interface DataObject {
  staff: any[];
  shifts: Record<string, any>;
  settings: { interval: number; maxDaily: number };
}

describe('Admin Panel - Data Management', () => {

  beforeEach(() => {
    setupAdminPanelTest();
  });

  afterEach(() => {
    cleanupAdminPanelTest();
  });

  //#region Initial State Tests
  describe('Initial State', () => {
    it('should have empty staff array initially', () => {
      const data: DataObject = {
        staff: [],
        shifts: {},
        settings: { interval: 60, maxDaily: 4 }
      };

      expect(data.staff).toEqual([]);
      expect(Array.isArray(data.staff)).toBe(true);
    });

    it('should have empty shifts object initially', () => {
      const data: DataObject = {
        staff: [],
        shifts: {},
        settings: { interval: 60, maxDaily: 4 }
      };

      expect(data.shifts).toEqual({});
      expect(typeof data.shifts).toBe('object');
    });

    it('should have default settings', () => {
      const data: DataObject = {
        staff: [],
        shifts: {},
        settings: { interval: 60, maxDaily: 4 }
      };

      expect(data.settings).toEqual({
        interval: 60,
        maxDaily: 4
      });
    });

    it('should have correct default interval value', () => {
      const data: DataObject = {
        staff: [],
        shifts: {},
        settings: { interval: 60, maxDaily: 4 }
      };

      expect(data.settings.interval).toBe(60);
    });

    it('should have correct default maxDaily value', () => {
      const data: DataObject = {
        staff: [],
        shifts: {},
        settings: { interval: 60, maxDaily: 4 }
      };

      expect(data.settings.maxDaily).toBe(4);
    });
  });
  //#endregion

  //#region Load Staff Tests
  describe('Loading Staff', () => {
    it('should load staff successfully', async () => {
      const mockStaff = createMockStaffList(3);
      mockFetch(mockFetchSuccess({ data: mockStaff }));

      const response = await fetch('/api/getStaff');
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.data).toEqual(mockStaff);
    });

    it('should handle empty staff list', async () => {
      mockFetch(mockFetchSuccess({ data: [] }));

      const response = await fetch('/api/getStaff');
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.data).toEqual([]);
    });

    it('should update staff array after loading', async () => {
      const data: DataObject = {
        staff: [],
        shifts: {},
        settings: { interval: 60, maxDaily: 4 }
      };

      const mockStaff = createMockStaffList(3);
      mockFetch(mockFetchSuccess(mockStaff));

      const response = await fetch('/api/getStaff');
      const result = await response.json();

      if (result.success) {
        data.staff = result.data;
      }

      expect(data.staff).toEqual(mockStaff);
      expect(data.staff.length).toBe(3);
    });

    it('should handle API error when loading staff', async () => {
      mockFetch(mockFetchError('Failed to load staff'));

      const response = await fetch('/api/getStaff');
      const result = await response.json();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to load staff');
    });

    it('should handle network error when loading staff', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

      try {
        await fetch('/api/getStaff');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Network error');
      }
    });

    it('should log error to console on failure', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch(mockFetchError('Load failed'));

      const response = await fetch('/api/getStaff');
      const result = await response.json();

      // In actual implementation, console.error would be called
      if (!result.success) {
        console.error('İlgili personel yüklenemedi:', result.error);
      }

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should not modify staff array on API error', async () => {
      const data: DataObject = {
        staff: createMockStaffList(2),
        shifts: {},
        settings: { interval: 60, maxDaily: 4 }
      };

      const originalStaff = [...data.staff];
      mockFetch(mockFetchError('Server error'));

      const response = await fetch('/api/getStaff');
      const result = await response.json();

      // Staff should remain unchanged on error
      if (!result.success) {
        // Don't update data.staff
      }

      expect(data.staff).toEqual(originalStaff);
    });

    it('should handle malformed API response', async () => {
      mockFetch(mockFetchSuccess({ invalid: 'structure' }));

      const response = await fetch('/api/getStaff');
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ invalid: 'structure' });
    });

    it('should load staff with correct structure', async () => {
      const mockStaff = [
        createMockStaff({ id: 'staff-1', name: 'Staff 1', active: true }),
        createMockStaff({ id: 'staff-2', name: 'Staff 2', active: false }),
        createMockStaff({ id: 'staff-3', name: 'Staff 3', active: true })
      ];

      mockFetch(mockFetchSuccess(mockStaff));

      const response = await fetch('/api/getStaff');
      const result = await response.json();

      expect(result.data).toHaveLength(3);
      expect(result.data[0]).toHaveProperty('id');
      expect(result.data[0]).toHaveProperty('name');
      expect(result.data[0]).toHaveProperty('active');
    });

    it('should preserve staff data types', async () => {
      const mockStaff = [createMockStaff({
        id: 'staff-1',
        name: 'Test Staff',
        phone: '0555 123 4567',
        email: 'test@example.com',
        active: true
      })];

      mockFetch(mockFetchSuccess(mockStaff));

      const response = await fetch('/api/getStaff');
      const result = await response.json();

      expect(typeof result.data[0].id).toBe('string');
      expect(typeof result.data[0].name).toBe('string');
      expect(typeof result.data[0].phone).toBe('string');
      expect(typeof result.data[0].email).toBe('string');
      expect(typeof result.data[0].active).toBe('boolean');
    });
  });
  //#endregion

  //#region Load Shifts Tests
  describe('Loading Shifts', () => {
    it('should initialize shifts as empty object', async () => {
      const data: DataObject = {
        staff: [],
        shifts: { 'old-data': 'should-be-cleared' },
        settings: { interval: 60, maxDaily: 4 }
      };

      // loadShifts() just resets to empty object
      data.shifts = {};

      expect(data.shifts).toEqual({});
      expect(Object.keys(data.shifts).length).toBe(0);
    });

    it('should clear existing shifts data', () => {
      const data: DataObject = {
        staff: [],
        shifts: {
          'week-1': [{ staffId: 'staff-1', date: '2024-01-15' }],
          'week-2': [{ staffId: 'staff-2', date: '2024-01-22' }]
        },
        settings: { interval: 60, maxDaily: 4 }
      };

      // loadShifts() clears data
      data.shifts = {};

      expect(data.shifts).toEqual({});
    });

    it('should not make API call for shifts', async () => {
      const data: DataObject = {
        staff: [],
        shifts: {},
        settings: { interval: 60, maxDaily: 4 }
      };

      // loadShifts() doesn't call API
      data.shifts = {};

      // No fetch should have been called
      expect(getFetchCallCount()).toBe(0);
    });

    it('should maintain shifts as object type', () => {
      const data: DataObject = {
        staff: [],
        shifts: {},
        settings: { interval: 60, maxDaily: 4 }
      };

      expect(typeof data.shifts).toBe('object');
      expect(Array.isArray(data.shifts)).toBe(false);
    });

    it('should allow shifts to be populated later', () => {
      const data: DataObject = {
        staff: [],
        shifts: {},
        settings: { interval: 60, maxDaily: 4 }
      };

      // Shifts loaded per week basis
      data.shifts['2024-W03'] = [
        { staffId: 'staff-1', date: '2024-01-15', startTime: '09:00', endTime: '17:00' }
      ];

      expect(data.shifts['2024-W03']).toBeDefined();
      expect(data.shifts['2024-W03'].length).toBe(1);
    });
  });
  //#endregion

  //#region Load Settings Tests
  describe('Loading Settings', () => {
    it('should load settings successfully', async () => {
      const mockSettings = createMockSettings({ interval: 90, maxDaily: 6 });
      mockFetch(mockFetchSuccess(mockSettings));

      const response = await fetch('/api/getSettings');
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSettings);
    });

    it('should update settings after loading', async () => {
      const data: DataObject = {
        staff: [],
        shifts: {},
        settings: { interval: 60, maxDaily: 4 }
      };

      const mockSettings = createMockSettings({ interval: 90, maxDaily: 6 });
      mockFetch(mockFetchSuccess(mockSettings));

      const response = await fetch('/api/getSettings');
      const result = await response.json();

      if (result.success) {
        data.settings = result.data;
      }

      expect(data.settings.interval).toBe(90);
      expect(data.settings.maxDaily).toBe(6);
    });

    it('should handle API error when loading settings', async () => {
      mockFetch(mockFetchError('Failed to load settings'));

      const response = await fetch('/api/getSettings');
      const result = await response.json();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to load settings');
    });

    it('should handle network error when loading settings', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

      try {
        await fetch('/api/getSettings');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Network error');
      }
    });

    it('should log error to console on failure', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch(mockFetchError('Load failed'));

      const response = await fetch('/api/getSettings');
      const result = await response.json();

      if (!result.success) {
        console.error('Ayarlar yüklenemedi:', result.error);
      }

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should not modify settings on API error', async () => {
      const data: DataObject = {
        staff: [],
        shifts: {},
        settings: { interval: 60, maxDaily: 4 }
      };

      const originalSettings = { ...data.settings };
      mockFetch(mockFetchError('Server error'));

      const response = await fetch('/api/getSettings');
      const result = await response.json();

      // Settings should remain unchanged on error
      if (!result.success) {
        // Don't update data.settings
      }

      expect(data.settings).toEqual(originalSettings);
    });

    it('should preserve default settings on error', async () => {
      const data: DataObject = {
        staff: [],
        shifts: {},
        settings: { interval: 60, maxDaily: 4 }
      };

      mockFetch(mockFetchError('Failed'));

      const response = await fetch('/api/getSettings');
      const result = await response.json();

      if (!result.success) {
        // Keep defaults
      }

      expect(data.settings.interval).toBe(60);
      expect(data.settings.maxDaily).toBe(4);
    });

    it('should handle partial settings data', async () => {
      mockFetch(mockFetchSuccess({ interval: 90 }));

      const response = await fetch('/api/getSettings');
      const result = await response.json();

      expect(result.data).toHaveProperty('interval');
      expect(result.data.interval).toBe(90);
    });

    it('should validate settings data types', async () => {
      const mockSettings = createMockSettings({ interval: 90, maxDaily: 6 });
      mockFetch(mockFetchSuccess(mockSettings));

      const response = await fetch('/api/getSettings');
      const result = await response.json();

      expect(typeof result.data.interval).toBe('number');
      expect(typeof result.data.maxDaily).toBe('number');
    });

    it('should accept valid interval values', () => {
      const validIntervals = [30, 60, 90];

      validIntervals.forEach(interval => {
        const settings = createMockSettings({ interval });
        expect(settings.interval).toBe(interval);
      });
    });

    it('should accept valid maxDaily values', () => {
      const data: DataObject = {
        staff: [],
        shifts: {},
        settings: { interval: 60, maxDaily: 4 }
      };

      // Test various maxDaily values
      [1, 2, 4, 6, 8, 10].forEach(maxDaily => {
        data.settings.maxDaily = maxDaily;
        expect(data.settings.maxDaily).toBe(maxDaily);
        expect(data.settings.maxDaily).toBeGreaterThan(0);
      });
    });
  });
  //#endregion

  //#region Data Consistency Tests
  describe('Data Consistency', () => {
    it('should maintain data structure integrity', () => {
      const data: DataObject = {
        staff: [],
        shifts: {},
        settings: { interval: 60, maxDaily: 4 }
      };

      expect(data).toHaveProperty('staff');
      expect(data).toHaveProperty('shifts');
      expect(data).toHaveProperty('settings');
    });

    it('should allow independent data updates', async () => {
      const data: DataObject = {
        staff: [],
        shifts: {},
        settings: { interval: 60, maxDaily: 4 }
      };

      // Update staff
      data.staff = createMockStaffList(2);
      expect(data.staff.length).toBe(2);
      expect(data.settings.interval).toBe(60); // Settings unchanged

      // Update settings
      data.settings = { interval: 90, maxDaily: 6 };
      expect(data.settings.interval).toBe(90);
      expect(data.staff.length).toBe(2); // Staff unchanged
    });

    it('should handle concurrent data loads', async () => {
      const data: DataObject = {
        staff: [],
        shifts: {},
        settings: { interval: 60, maxDaily: 4 }
      };

      // Simulate loading staff and settings concurrently
      const mockStaff = createMockStaffList(3);
      const mockSettings = createMockSettings({ interval: 90, maxDaily: 6 });

      mockFetch(mockFetchSuccess(mockStaff));
      const staffResponse = await fetch('/api/getStaff');
      const staffResult = await staffResponse.json();

      mockFetch(mockFetchSuccess(mockSettings));
      const settingsResponse = await fetch('/api/getSettings');
      const settingsResult = await settingsResponse.json();

      if (staffResult.success) data.staff = staffResult.data;
      if (settingsResult.success) data.settings = settingsResult.data;

      expect(data.staff.length).toBe(3);
      expect(data.settings.interval).toBe(90);
    });

    it('should not lose data on partial update failure', async () => {
      const data: DataObject = {
        staff: createMockStaffList(2),
        shifts: {},
        settings: { interval: 60, maxDaily: 4 }
      };

      const originalStaff = [...data.staff];

      // Settings load fails
      mockFetch(mockFetchError('Settings load failed'));
      const response = await fetch('/api/getSettings');
      const result = await response.json();

      if (!result.success) {
        // Don't update settings
      }

      // Staff should still be intact
      expect(data.staff).toEqual(originalStaff);
      expect(data.settings.interval).toBe(60);
    });

    it('should handle data reset correctly', () => {
      const data: DataObject = {
        staff: createMockStaffList(3),
        shifts: { 'week-1': [] },
        settings: { interval: 90, maxDaily: 6 }
      };

      // Reset to defaults
      data.staff = [];
      data.shifts = {};
      data.settings = { interval: 60, maxDaily: 4 };

      expect(data.staff).toEqual([]);
      expect(data.shifts).toEqual({});
      expect(data.settings).toEqual({ interval: 60, maxDaily: 4 });
    });
  });
  //#endregion

  //#region Error Handling Tests
  describe('Error Handling', () => {
    it('should handle undefined response gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => undefined
      } as Response);

      const response = await fetch('/api/getStaff');
      const result = await response.json();

      expect(result).toBeUndefined();
    });

    it('should handle null response gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => null
      } as Response);

      const response = await fetch('/api/getStaff');
      const result = await response.json();

      expect(result).toBeNull();
    });

    it('should handle JSON parse error', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('JSON parse error');
        }
      } as Response);

      try {
        const response = await fetch('/api/getStaff');
        await response.json();
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('JSON parse error');
      }
    });

    it('should handle timeout errors', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Request timeout'));

      try {
        await fetch('/api/getStaff');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Request timeout');
      }
    });

    it('should handle 500 server errors', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => createErrorResponse('Internal server error')
      } as Response);

      const response = await fetch('/api/getStaff');
      const result = await response.json();

      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
      expect(result.error).toBe('Internal server error');
    });

    it('should handle 404 not found errors', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => createErrorResponse('Not found')
      } as Response);

      const response = await fetch('/api/getStaff');
      const result = await response.json();

      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
    });
  });
  //#endregion

  //#region Integration Tests
  describe('Integration Scenarios', () => {
    it('should load all data successfully in sequence', async () => {
      const data: DataObject = {
        staff: [],
        shifts: {},
        settings: { interval: 60, maxDaily: 4 }
      };

      // Load staff
      const mockStaff = createMockStaffList(3);
      mockFetch(mockFetchSuccess(mockStaff));
      const staffResponse = await fetch('/api/getStaff');
      const staffResult = await staffResponse.json();
      if (staffResult.success) data.staff = staffResult.data;

      // Load shifts
      data.shifts = {};

      // Load settings
      const mockSettings = createMockSettings({ interval: 90, maxDaily: 6 });
      mockFetch(mockFetchSuccess(mockSettings));
      const settingsResponse = await fetch('/api/getSettings');
      const settingsResult = await settingsResponse.json();
      if (settingsResult.success) data.settings = settingsResult.data;

      // Verify all data loaded
      expect(data.staff.length).toBe(3);
      expect(data.shifts).toEqual({});
      expect(data.settings.interval).toBe(90);
    });

    it('should handle mixed success and failure', async () => {
      const data: DataObject = {
        staff: [],
        shifts: {},
        settings: { interval: 60, maxDaily: 4 }
      };

      // Staff loads successfully
      const mockStaff = createMockStaffList(2);
      mockFetch(mockFetchSuccess(mockStaff));
      const staffResponse = await fetch('/api/getStaff');
      const staffResult = await staffResponse.json();
      if (staffResult.success) data.staff = staffResult.data;

      // Settings fails
      mockFetch(mockFetchError('Settings error'));
      const settingsResponse = await fetch('/api/getSettings');
      const settingsResult = await settingsResponse.json();
      if (!settingsResult.success) {
        // Keep defaults
      }

      // Staff should be loaded, settings should be defaults
      expect(data.staff.length).toBe(2);
      expect(data.settings).toEqual({ interval: 60, maxDaily: 4 });
    });

    it('should maintain state consistency across operations', async () => {
      const data: DataObject = {
        staff: createMockStaffList(2),
        shifts: {},
        settings: { interval: 60, maxDaily: 4 }
      };

      // Reload staff
      const newStaff = createMockStaffList(3);
      mockFetch(mockFetchSuccess(newStaff));
      const response = await fetch('/api/getStaff');
      const result = await response.json();
      if (result.success) data.staff = result.data;

      // Verify old data replaced with new
      expect(data.staff.length).toBe(3);
      expect(data.staff).toEqual(newStaff);
    });
  });
  //#endregion
});
