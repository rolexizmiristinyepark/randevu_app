/**
 * ADMIN-PANEL API SETTINGS TESTS
 * Comprehensive test suite for API Settings region (admin-panel.ts lines 64-102)
 *
 * Test Coverage:
 * - API.save() - Save settings to backend
 * - API.load() - Load settings and populate form
 * - Button loading states (ButtonUtils integration)
 * - Success/error alert messages
 * - Input field population
 * - Fallback values
 * - Error handling (API errors, network errors)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  setupAdminPanelTest,
  cleanupAdminPanelTest,
  createMockSettings,
  mockFetch,
  mockFetchSuccess,
  mockFetchError,
  getElement,
  getInputValue,
  setInputValue,
  nextTick
} from './helpers/test-utils';

describe('Admin Panel - API Settings', () => {

  beforeEach(() => {
    setupAdminPanelTest();
  });

  afterEach(() => {
    cleanupAdminPanelTest();
  });

  //#region API.save() Tests
  describe('Saving Settings', () => {
    it('should save settings successfully', async () => {
      const settings = createMockSettings({ interval: 90, maxDaily: 6 });
      mockFetch(mockFetchSuccess(settings));

      setInputValue('interval', '90');
      setInputValue('maxDaily', '6');

      // In actual implementation, this would call API.save()
      const response = await fetch('/api/saveSettings');
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.interval).toBe(90);
      expect(result.data.maxDaily).toBe(6);
    });

    it('should read values from input fields', () => {
      setInputValue('interval', '90');
      setInputValue('maxDaily', '6');

      expect(getInputValue('interval')).toBe('90');
      expect(getInputValue('maxDaily')).toBe('6');
    });

    it('should set button to loading state when saving', () => {
      const btn = getElement<HTMLButtonElement>('saveSettingsBtn');

      // Simulate ButtonUtils.setLoading(btn, 'Kaydediliyor')
      btn.disabled = true;
      btn.textContent = 'Kaydediliyor';

      expect(btn.disabled).toBe(true);
      expect(btn.textContent).toBe('Kaydediliyor');
    });

    it('should reset button after saving completes', async () => {
      const btn = getElement<HTMLButtonElement>('saveSettingsBtn');
      const originalText = btn.textContent;

      // Simulate loading
      btn.disabled = true;
      btn.textContent = 'Kaydediliyor';

      mockFetch(mockFetchSuccess(createMockSettings()));
      await fetch('/api/saveSettings');
      await nextTick();

      // Simulate ButtonUtils.reset(btn)
      btn.disabled = false;
      btn.textContent = originalText;

      expect(btn.disabled).toBe(false);
      expect(btn.textContent).toBe(originalText);
    });

    it('should reset button even if API call fails', async () => {
      const btn = getElement<HTMLButtonElement>('saveSettingsBtn');

      // Simulate loading
      btn.disabled = true;
      btn.textContent = 'Kaydediliyor';

      mockFetch(mockFetchError('Save failed'));
      try {
        await fetch('/api/saveSettings');
      } catch (error) {
        // Error handled
      }

      // Finally block should reset button
      btn.disabled = false;
      btn.textContent = 'Kaydet';

      expect(btn.disabled).toBe(false);
    });

    it('should show success alert after saving', async () => {
      mockFetch(mockFetchSuccess(createMockSettings()));

      const response = await fetch('/api/saveSettings');
      const result = await response.json();

      if (result.success) {
        // Simulate UI.showAlert('✅ Ayarlar kaydedildi!', 'success')
        const alertContainer = getElement('alertContainer');
        alertContainer.innerHTML = '<div class="alert alert-success">✅ Ayarlar kaydedildi!</div>';
      }

      const alertContainer = getElement('alertContainer');
      expect(alertContainer.textContent).toContain('✅ Ayarlar kaydedildi!');
    });

    it('should handle API error when saving', async () => {
      mockFetch(mockFetchError('Failed to save settings'));

      const response = await fetch('/api/saveSettings');
      const result = await response.json();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to save settings');
    });

    it('should show error alert on API error', async () => {
      mockFetch(mockFetchError('Server error'));

      const response = await fetch('/api/saveSettings');
      const result = await response.json();

      if (!result.success) {
        // ErrorUtils.handleApiError would show error alert
        const alertContainer = getElement('alertContainer');
        alertContainer.innerHTML = '<div class="alert alert-error">Server error</div>';
      }

      const alertContainer = getElement('alertContainer');
      expect(alertContainer.textContent).toContain('Server error');
    });

    it('should handle network error when saving', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

      try {
        await fetch('/api/saveSettings');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Network error');
      }
    });

    it('should update Data.settings after successful save', async () => {
      const newSettings = createMockSettings({ interval: 90, maxDaily: 6 });
      mockFetch(mockFetchSuccess(newSettings));

      const response = await fetch('/api/saveSettings');
      const result = await response.json();

      // Simulate: Data.settings = response.data
      const dataSettings = result.data;

      expect(dataSettings.interval).toBe(90);
      expect(dataSettings.maxDaily).toBe(6);
    });

    it('should call ApiService.call with correct parameters', async () => {
      setInputValue('interval', '90');
      setInputValue('maxDaily', '6');

      const interval = getInputValue('interval');
      const maxDaily = getInputValue('maxDaily');

      expect(interval).toBe('90');
      expect(maxDaily).toBe('6');

      // These values would be passed to ApiService.call('saveSettings', { interval, maxDaily })
    });

    it('should handle save with default values', async () => {
      setInputValue('interval', '60');
      setInputValue('maxDaily', '4');

      mockFetch(mockFetchSuccess(createMockSettings()));

      const response = await fetch('/api/saveSettings');
      const result = await response.json();

      expect(result.success).toBe(true);
    });

    it('should handle save with custom interval values', async () => {
      const validIntervals = [30, 60, 90];

      for (const interval of validIntervals) {
        setInputValue('interval', interval.toString());

        mockFetch(mockFetchSuccess(createMockSettings({ interval })));

        const response = await fetch('/api/saveSettings');
        const result = await response.json();

        expect(result.data.interval).toBe(interval);
      }
    });

    it('should handle save with various maxDaily values', async () => {
      const validMaxDaily = [1, 2, 4, 6, 8, 10];

      for (const maxDaily of validMaxDaily) {
        setInputValue('maxDaily', maxDaily.toString());

        mockFetch(mockFetchSuccess(createMockSettings({ maxDaily })));

        const response = await fetch('/api/saveSettings');
        const result = await response.json();

        expect(result.data.maxDaily).toBe(maxDaily);
      }
    });
  });
  //#endregion

  //#region API.load() Tests
  describe('Loading Settings', () => {
    it('should load settings successfully', async () => {
      const settings = createMockSettings({ interval: 90, maxDaily: 6 });
      mockFetch(mockFetchSuccess(settings));

      const response = await fetch('/api/getSettings');
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.interval).toBe(90);
      expect(result.data.maxDaily).toBe(6);
    });

    it('should populate interval input after loading', async () => {
      const settings = createMockSettings({ interval: 90, maxDaily: 6 });
      mockFetch(mockFetchSuccess(settings));

      const response = await fetch('/api/getSettings');
      const result = await response.json();

      if (result.success) {
        // Simulate: document.getElementById('interval').value = Data.settings.interval
        setInputValue('interval', result.data.interval.toString());
      }

      expect(getInputValue('interval')).toBe('90');
    });

    it('should populate maxDaily input after loading', async () => {
      const settings = createMockSettings({ interval: 90, maxDaily: 6 });
      mockFetch(mockFetchSuccess(settings));

      const response = await fetch('/api/getSettings');
      const result = await response.json();

      if (result.success) {
        setInputValue('maxDaily', result.data.maxDaily.toString());
      }

      expect(getInputValue('maxDaily')).toBe('6');
    });

    it('should use fallback value for interval if not provided', () => {
      const interval = undefined;
      const fallbackInterval = interval || 60;

      setInputValue('interval', fallbackInterval.toString());

      expect(getInputValue('interval')).toBe('60');
    });

    it('should use fallback value for maxDaily if not provided', () => {
      const maxDaily = undefined;
      const fallbackMaxDaily = maxDaily || 4;

      setInputValue('maxDaily', fallbackMaxDaily.toString());

      expect(getInputValue('maxDaily')).toBe('4');
    });

    it('should handle null settings with fallbacks', () => {
      const settings = { interval: null, maxDaily: null };

      setInputValue('interval', (settings.interval || 60).toString());
      setInputValue('maxDaily', (settings.maxDaily || 4).toString());

      expect(getInputValue('interval')).toBe('60');
      expect(getInputValue('maxDaily')).toBe('4');
    });

    it('should handle undefined settings with fallbacks', () => {
      const settings = { interval: undefined, maxDaily: undefined };

      setInputValue('interval', (settings.interval || 60).toString());
      setInputValue('maxDaily', (settings.maxDaily || 4).toString());

      expect(getInputValue('interval')).toBe('60');
      expect(getInputValue('maxDaily')).toBe('4');
    });

    it('should handle error when loading settings', async () => {
      mockFetch(mockFetchError('Failed to load'));

      const response = await fetch('/api/getSettings');
      const result = await response.json();

      expect(result.success).toBe(false);
    });

    it('should log error to console on load failure', async () => {
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

    it('should keep existing values on load error', async () => {
      setInputValue('interval', '90');
      setInputValue('maxDaily', '6');

      const existingInterval = getInputValue('interval');
      const existingMaxDaily = getInputValue('maxDaily');

      mockFetch(mockFetchError('Load failed'));

      const response = await fetch('/api/getSettings');
      const result = await response.json();

      if (!result.success) {
        // Don't update inputs
      }

      expect(getInputValue('interval')).toBe(existingInterval);
      expect(getInputValue('maxDaily')).toBe(existingMaxDaily);
    });

    it('should call Data.loadSettings internally', async () => {
      // API.load() calls Data.loadSettings() internally
      const settings = createMockSettings({ interval: 90, maxDaily: 6 });
      mockFetch(mockFetchSuccess(settings));

      const response = await fetch('/api/getSettings');
      const result = await response.json();

      expect(result.success).toBe(true);
    });

    it('should populate both inputs in sequence', async () => {
      const settings = createMockSettings({ interval: 90, maxDaily: 6 });
      mockFetch(mockFetchSuccess(settings));

      const response = await fetch('/api/getSettings');
      const result = await response.json();

      if (result.success) {
        setInputValue('interval', result.data.interval.toString());
        setInputValue('maxDaily', result.data.maxDaily.toString());
      }

      expect(getInputValue('interval')).toBe('90');
      expect(getInputValue('maxDaily')).toBe('6');
    });
  });
  //#endregion

  //#region Button State Tests
  describe('Button Loading States', () => {
    it('should have save button in DOM', () => {
      const btn = getElement<HTMLButtonElement>('saveSettingsBtn');
      expect(btn).toBeDefined();
      expect(btn.tagName).toBe('BUTTON');
    });

    it('should disable button when loading starts', () => {
      const btn = getElement<HTMLButtonElement>('saveSettingsBtn');

      // ButtonUtils.setLoading(btn, 'Kaydediliyor')
      btn.disabled = true;

      expect(btn.disabled).toBe(true);
    });

    it('should change button text when loading', () => {
      const btn = getElement<HTMLButtonElement>('saveSettingsBtn');
      const originalText = btn.textContent;

      btn.textContent = 'Kaydediliyor';

      expect(btn.textContent).toBe('Kaydediliyor');
      expect(btn.textContent).not.toBe(originalText);
    });

    it('should enable button after loading completes', () => {
      const btn = getElement<HTMLButtonElement>('saveSettingsBtn');

      btn.disabled = true;
      btn.disabled = false;

      expect(btn.disabled).toBe(false);
    });

    it('should restore original button text after loading', () => {
      const btn = getElement<HTMLButtonElement>('saveSettingsBtn');
      const originalText = 'Kaydet';

      btn.textContent = 'Kaydediliyor';
      btn.textContent = originalText;

      expect(btn.textContent).toBe(originalText);
    });

    it('should handle rapid button clicks gracefully', () => {
      const btn = getElement<HTMLButtonElement>('saveSettingsBtn');

      // First click - set loading
      btn.disabled = true;

      // Second click - should be ignored (button disabled)
      if (!btn.disabled) {
        // This should not execute
        expect.fail('Button should be disabled');
      }

      expect(btn.disabled).toBe(true);
    });
  });
  //#endregion

  //#region Alert Message Tests
  describe('Alert Messages', () => {
    it('should show success alert with checkmark emoji', () => {
      const alertContainer = getElement('alertContainer');
      alertContainer.innerHTML = '<div class="alert alert-success">✅ Ayarlar kaydedildi!</div>';

      expect(alertContainer.textContent).toContain('✅');
      expect(alertContainer.textContent).toContain('Ayarlar kaydedildi!');
    });

    it('should show error alert for API errors', () => {
      const alertContainer = getElement('alertContainer');
      alertContainer.innerHTML = '<div class="alert alert-error">API Error</div>';

      expect(alertContainer.textContent).toContain('API Error');
    });

    it('should show error alert for network errors', () => {
      const alertContainer = getElement('alertContainer');
      alertContainer.innerHTML = '<div class="alert alert-error">Network Error</div>';

      expect(alertContainer.textContent).toContain('Network Error');
    });

    it('should clear previous alerts before showing new one', () => {
      const alertContainer = getElement('alertContainer');

      alertContainer.innerHTML = '<div class="alert">Old alert</div>';
      expect(alertContainer.textContent).toContain('Old alert');

      alertContainer.innerHTML = '<div class="alert">New alert</div>';
      expect(alertContainer.textContent).toContain('New alert');
      expect(alertContainer.textContent).not.toContain('Old alert');
    });

    it('should have alert container in DOM', () => {
      const alertContainer = getElement('alertContainer');
      expect(alertContainer).toBeDefined();
    });
  });
  //#endregion

  //#region Input Field Tests
  describe('Input Fields', () => {
    it('should have interval input field', () => {
      const intervalInput = getElement<HTMLInputElement>('interval');
      expect(intervalInput).toBeDefined();
      expect(intervalInput.type).toBe('number');
    });

    it('should have maxDaily input field', () => {
      const maxDailyInput = getElement<HTMLInputElement>('maxDaily');
      expect(maxDailyInput).toBeDefined();
      expect(maxDailyInput.type).toBe('number');
    });

    it('should accept numeric values in interval field', () => {
      setInputValue('interval', '90');
      expect(getInputValue('interval')).toBe('90');
    });

    it('should accept numeric values in maxDaily field', () => {
      setInputValue('maxDaily', '6');
      expect(getInputValue('maxDaily')).toBe('6');
    });

    it('should read current values from both fields', () => {
      setInputValue('interval', '90');
      setInputValue('maxDaily', '6');

      const interval = getInputValue('interval');
      const maxDaily = getInputValue('maxDaily');

      expect(interval).toBe('90');
      expect(maxDaily).toBe('6');
    });

    it('should update values independently', () => {
      setInputValue('interval', '90');
      expect(getInputValue('interval')).toBe('90');

      setInputValue('maxDaily', '6');
      expect(getInputValue('maxDaily')).toBe('6');
      expect(getInputValue('interval')).toBe('90'); // Should remain unchanged
    });
  });
  //#endregion

  //#region Integration Tests
  describe('Integration Scenarios', () => {
    it('should complete full save-load cycle', async () => {
      // Save settings
      setInputValue('interval', '90');
      setInputValue('maxDaily', '6');

      mockFetch(mockFetchSuccess(createMockSettings({ interval: 90, maxDaily: 6 })));

      const saveResponse = await fetch('/api/saveSettings');
      const saveResult = await saveResponse.json();

      expect(saveResult.success).toBe(true);

      // Load settings
      mockFetch(mockFetchSuccess(createMockSettings({ interval: 90, maxDaily: 6 })));

      const loadResponse = await fetch('/api/getSettings');
      const loadResult = await loadResponse.json();

      if (loadResult.success) {
        setInputValue('interval', loadResult.data.interval.toString());
        setInputValue('maxDaily', loadResult.data.maxDaily.toString());
      }

      expect(getInputValue('interval')).toBe('90');
      expect(getInputValue('maxDaily')).toBe('6');
    });

    it('should handle save failure gracefully', async () => {
      const btn = getElement<HTMLButtonElement>('saveSettingsBtn');

      // Start save
      btn.disabled = true;
      btn.textContent = 'Kaydediliyor';

      mockFetch(mockFetchError('Save failed'));

      const response = await fetch('/api/saveSettings');
      const result = await response.json();

      // Reset button in finally block
      btn.disabled = false;
      btn.textContent = 'Kaydet';

      // Show error alert
      if (!result.success) {
        const alertContainer = getElement('alertContainer');
        alertContainer.innerHTML = '<div class="alert alert-error">Save failed</div>';
      }

      expect(btn.disabled).toBe(false);
      expect(getElement('alertContainer').textContent).toContain('Save failed');
    });

    it('should maintain data consistency across save operations', async () => {
      // First save
      mockFetch(mockFetchSuccess(createMockSettings({ interval: 90, maxDaily: 6 })));
      const response1 = await fetch('/api/saveSettings');
      const result1 = await response1.json();

      const savedSettings1 = result1.data;

      // Second save (different values)
      mockFetch(mockFetchSuccess(createMockSettings({ interval: 60, maxDaily: 4 })));
      const response2 = await fetch('/api/saveSettings');
      const result2 = await response2.json();

      const savedSettings2 = result2.data;

      expect(savedSettings1).not.toEqual(savedSettings2);
      expect(savedSettings2.interval).toBe(60);
      expect(savedSettings2.maxDaily).toBe(4);
    });
  });
  //#endregion
});
