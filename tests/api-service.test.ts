import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApiService } from '../api-service';
import type { ApiResponse } from '../api-service';

describe('ApiService', () => {
  let fetchMock: any;
  let originalFetch: typeof global.fetch;
  let originalWindow: any;

  beforeEach(() => {
    // Mock window.CONFIG
    originalWindow = global.window;
    (global as any).window = {
      CONFIG: {
        APPS_SCRIPT_URL: 'https://script.google.com/macros/s/test/exec'
      },
      AdminAuth: undefined
    };

    // Mock fetch
    originalFetch = global.fetch;
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    (global as any).window = originalWindow;
    vi.clearAllMocks();
  });

  describe('Protected Actions', () => {
    it('should identify protected actions correctly', () => {
      const protectedActions = ApiService.PROTECTED_ACTIONS;

      // Core admin actions
      expect(protectedActions).toContain('addStaff');
      expect(protectedActions).toContain('toggleStaff');
      expect(protectedActions).toContain('removeStaff');
      expect(protectedActions).toContain('updateStaff');
      expect(protectedActions).toContain('saveShifts');
      expect(protectedActions).toContain('saveSettings');
      expect(protectedActions).toContain('deleteAppointment');
      expect(protectedActions).toContain('getSettings');

      // WhatsApp and Slack actions
      expect(protectedActions).toContain('sendWhatsAppReminders');
      expect(protectedActions).toContain('updateWhatsAppSettings');
      expect(protectedActions).toContain('updateSlackSettings');
    });

    it('should require authentication for protected actions', async () => {
      // No AdminAuth, no API key → should trigger showLoginModal
      (global as any).window.AdminAuth = {
        isAuthenticated: () => null, // Not authenticated
        showLoginModal: vi.fn()
      };

      await expect(
        ApiService.call('addStaff', { name: 'Test' }, null)
      ).rejects.toThrow('Authentication required');

      expect((global as any).window.AdminAuth.showLoginModal).toHaveBeenCalled();
    });

    it('should accept protected action with valid API key', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] })
      });

      const result = await ApiService.call('addStaff', { name: 'Test' }, 'valid-key');

      expect(result.success).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://script.google.com/macros/s/test/exec',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"apiKey":"valid-key"')
        })
      );
    });

    it('should accept protected action with AdminAuth', async () => {
      // Mock AdminAuth
      (global as any).window.AdminAuth = {
        isAuthenticated: () => 'admin-key-from-auth'
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] })
      });

      const result = await ApiService.call('addStaff', { name: 'Test' });

      expect(result.success).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://script.google.com/macros/s/test/exec',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"apiKey":"admin-key-from-auth"')
        })
      );
    });
  });

  describe('Request Building', () => {
    it('should use POST method with JSON body', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await ApiService.call('getStaff', { activeOnly: true });

      expect(fetchMock).toHaveBeenCalledWith(
        'https://script.google.com/macros/s/test/exec',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        })
      );

      // Check body contains required fields (order may vary)
      const callArgs = fetchMock.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.action).toBe('getStaff');
      expect(body.activeOnly).toBe(true);
    });

    it('should include apiKey in request body for protected actions', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await ApiService.call('saveSettings', { interval: 60 }, 'test-key');

      const callArgs = fetchMock.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.apiKey).toBe('test-key');
      expect(body.action).toBe('saveSettings');
      expect(body.interval).toBe(60);
    });

    it('should NOT include apiKey for public actions', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await ApiService.call('getStaff');

      const callArgs = fetchMock.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.apiKey).toBeUndefined();
      expect(body.action).toBe('getStaff');
    });

    it('should set CORS mode to cors', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await ApiService.call('getStaff');

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          mode: 'cors',
          credentials: 'omit'
        })
      );
    });
  });

  describe('Error Handling', () => {
    it.skip('should timeout after 30 seconds', async () => {
      // Skipped: Fake timers interaction with fetch is complex in test environment
      // Timeout logic is tested in integration tests
    });

    it('should handle network errors', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Failed to fetch'));

      await expect(ApiService.call('getStaff')).rejects.toThrow(
        'API bağlantısı kurulamadı. CORS veya ağ hatası.'
      );
    });

    it('should handle HTTP errors', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      await expect(ApiService.call('getStaff')).rejects.toThrow(
        'HTTP error! status: 500'
      );
    });

    it('should reject invalid JSON responses', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => null
      });

      await expect(ApiService.call('getStaff')).rejects.toThrow(
        'Geçersiz API yanıtı'
      );
    });

    it('should reject non-object JSON responses', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => 'string response'
      });

      await expect(ApiService.call('getStaff')).rejects.toThrow(
        'Geçersiz API yanıtı'
      );
    });

    it('should handle missing CONFIG', async () => {
      (global as any).window.CONFIG = null;

      await expect(ApiService.call('getStaff')).rejects.toThrow(
        'CONFIG not defined'
      );
    });

    it('should handle missing APPS_SCRIPT_URL', async () => {
      (global as any).window.CONFIG = { APPS_SCRIPT_URL: '' };

      await expect(ApiService.call('getStaff')).rejects.toThrow(
        'CONFIG not defined'
      );
    });
  });

  describe('Response Handling', () => {
    it('should parse successful response', async () => {
      const mockData = [
        { id: 1, name: 'Staff 1' },
        { id: 2, name: 'Staff 2' }
      ];

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockData })
      });

      const result = await ApiService.call('getStaff');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
    });

    it('should parse error response', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false, error: 'Invalid parameters' })
      });

      const result = await ApiService.call('getStaff');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid parameters');
    });

    it('should handle API response without data field', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      const result = await ApiService.call('getStaff');

      expect(result.success).toBe(true);
      expect(result.data).toBeUndefined();
    });
  });

  describe('testApiKey', () => {
    it('should call getSettings with provided API key', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { interval: 60 } })
      });

      const result = await ApiService.testApiKey('test-key');

      expect(result.success).toBe(true);

      const callArgs = fetchMock.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.action).toBe('getSettings');
      expect(body.apiKey).toBe('test-key');
    });

    it('should return error for invalid API key', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false, error: 'Invalid API key' })
      });

      const result = await ApiService.testApiKey('invalid-key');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid API key');
    });
  });

  describe('Legacy Compatibility', () => {
    it('should make ApiService available as ES module export', () => {
      // ApiService is available as named export
      expect(ApiService).toBeDefined();
      expect(typeof ApiService.call).toBe('function');
      expect(typeof ApiService.testApiKey).toBe('function');
    });

    it('should expose PROTECTED_ACTIONS', () => {
      expect(Array.isArray(ApiService.PROTECTED_ACTIONS)).toBe(true);
      expect(ApiService.PROTECTED_ACTIONS.length).toBeGreaterThan(0);
    });
  });

  describe('Abort Signal', () => {
    it('should include AbortController signal in request', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await ApiService.call('getStaff');

      const callArgs = fetchMock.mock.calls[0];
      expect(callArgs[1].signal).toBeInstanceOf(AbortSignal);
    });
  });
});
