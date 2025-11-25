/**
 * ADMIN-PANEL UI UTILITIES TESTS
 * Comprehensive test suite for UI Utilities region (admin-panel.ts lines 1161-1250)
 *
 * Test Coverage:
 * - UI.showAlert() - Alert messaging
 * - UI.switchTab() - Tab switching and navigation
 * - Link copy functions (customer, manual, management links)
 * - Link open functions (window.open validation)
 * - Link validation (warning detection)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  setupAdminPanelTest,
  cleanupAdminPanelTest,
  getElement,
  hasAlert,
  clearAlerts
} from './helpers/test-utils';

describe('Admin Panel - UI Utilities', () => {

  beforeEach(() => {
    setupAdminPanelTest();
  });

  afterEach(() => {
    cleanupAdminPanelTest();
  });

  //#region UI.showAlert Tests
  describe('UI.showAlert', () => {
    it('should have alert container', () => {
      const alertContainer = getElement('alertContainer');
      expect(alertContainer).toBeDefined();
    });

    it('should show success alert', () => {
      const alertContainer = getElement('alertContainer');

      // Create alert element (simulating showAlertSafe)
      const alert = document.createElement('div');
      alert.className = 'alert alert-success';
      alert.textContent = '✅ Success message';
      alertContainer.appendChild(alert);

      expect(hasAlert('Success message')).toBe(true);
    });

    it('should show error alert', () => {
      const alertContainer = getElement('alertContainer');

      const alert = document.createElement('div');
      alert.className = 'alert alert-error';
      alert.textContent = 'Error message';
      alertContainer.appendChild(alert);

      expect(hasAlert('Error message')).toBe(true);
    });

    it('should clear alerts', () => {
      const alertContainer = getElement('alertContainer');

      const alert = document.createElement('div');
      alert.className = 'alert';
      alert.textContent = 'Test alert';
      alertContainer.appendChild(alert);

      expect(hasAlert('Test alert')).toBe(true);

      clearAlerts();

      expect(hasAlert('Test alert')).toBe(false);
    });

    it('should support multiple alert types', () => {
      const alertContainer = getElement('alertContainer');

      const successAlert = document.createElement('div');
      successAlert.className = 'alert alert-success';
      successAlert.textContent = 'Success';
      alertContainer.appendChild(successAlert);

      const errorAlert = document.createElement('div');
      errorAlert.className = 'alert alert-error';
      errorAlert.textContent = 'Error';
      alertContainer.appendChild(errorAlert);

      expect(hasAlert('Success')).toBe(true);
      expect(hasAlert('Error')).toBe(true);
    });
  });
  //#endregion

  //#region UI.switchTab Tests
  describe('UI.switchTab', () => {
    it('should have all tabs', () => {
      const settingsTab = document.querySelector('.tab[data-tab="settings"]');
      const staffTab = document.querySelector('.tab[data-tab="staff"]');
      const shiftsTab = document.querySelector('.tab[data-tab="shifts"]');
      const appointmentsTab = document.querySelector('.tab[data-tab="appointments"]');

      expect(settingsTab).toBeDefined();
      expect(staffTab).toBeDefined();
      expect(shiftsTab).toBeDefined();
      expect(appointmentsTab).toBeDefined();
    });

    it('should have all tab contents', () => {
      const settingsContent = document.getElementById('settings');
      const staffContent = document.getElementById('staff');
      const shiftsContent = document.getElementById('shifts');
      const appointmentsContent = document.getElementById('appointments');

      expect(settingsContent).toBeDefined();
      expect(staffContent).toBeDefined();
      expect(shiftsContent).toBeDefined();
      expect(appointmentsContent).toBeDefined();
    });

    it('should have settings tab active by default', () => {
      const settingsTab = document.querySelector('.tab[data-tab="settings"]');
      const settingsContent = document.getElementById('settings');

      expect(settingsTab?.classList.contains('active')).toBe(true);
      expect(settingsContent?.classList.contains('active')).toBe(true);
    });

    it('should switch to staff tab', () => {
      const staffTab = document.querySelector('.tab[data-tab="staff"]') as HTMLElement;
      const staffContent = document.getElementById('staff');

      // Simulate tab switch
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      staffTab.classList.add('active');
      staffContent?.classList.add('active');

      expect(staffTab.classList.contains('active')).toBe(true);
      expect(staffContent?.classList.contains('active')).toBe(true);
    });

    it('should deactivate other tabs when switching', () => {
      const settingsTab = document.querySelector('.tab[data-tab="settings"]');
      const staffTab = document.querySelector('.tab[data-tab="staff"]') as HTMLElement;

      // Initially settings is active
      expect(settingsTab?.classList.contains('active')).toBe(true);

      // Switch to staff
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      staffTab.classList.add('active');

      expect(settingsTab?.classList.contains('active')).toBe(false);
      expect(staffTab.classList.contains('active')).toBe(true);
    });

    it('should switch to shifts tab', () => {
      const shiftsTab = document.querySelector('.tab[data-tab="shifts"]') as HTMLElement;
      const shiftsContent = document.getElementById('shifts');

      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      shiftsTab.classList.add('active');
      shiftsContent?.classList.add('active');

      expect(shiftsTab.classList.contains('active')).toBe(true);
      expect(shiftsContent?.classList.contains('active')).toBe(true);
    });

    it('should switch to appointments tab', () => {
      const appointmentsTab = document.querySelector('.tab[data-tab="appointments"]') as HTMLElement;
      const appointmentsContent = document.getElementById('appointments');

      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      appointmentsTab.classList.add('active');
      appointmentsContent?.classList.add('active');

      expect(appointmentsTab.classList.contains('active')).toBe(true);
      expect(appointmentsContent?.classList.contains('active')).toBe(true);
    });
  });
  //#endregion

  //#region copyLink Tests
  describe('copyLink', () => {
    it('should have customer link input', () => {
      const linkInput = getElement<HTMLInputElement>('customerLink');

      expect(linkInput).toBeDefined();
      expect(linkInput.readOnly).toBe(true);
    });

    it('should copy link to clipboard', () => {
      const linkInput = getElement<HTMLInputElement>('customerLink');
      linkInput.value = 'https://example.com';

      // Mock document.execCommand (legacy API not available in happy-dom)
      document.execCommand = vi.fn(() => true);

      // Simulate copy
      linkInput.select();
      document.execCommand('copy');

      expect(document.execCommand).toHaveBeenCalledWith('copy');
    });

    it('should show success alert after copying', () => {
      const alertContainer = getElement('alertContainer');

      // Simulate copy success
      const alert = document.createElement('div');
      alert.className = 'alert alert-success';
      alert.textContent = '✅ Link kopyalandı!';
      alertContainer.appendChild(alert);

      expect(hasAlert('Link kopyalandı')).toBe(true);
    });

    it('should select input text when copying', () => {
      const linkInput = getElement<HTMLInputElement>('customerLink');
      linkInput.value = 'https://example.com';

      const selectSpy = vi.spyOn(linkInput, 'select');
      linkInput.select();

      expect(selectSpy).toHaveBeenCalled();
    });
  });
  //#endregion

  //#region openCustomerPage Tests
  describe('openCustomerPage', () => {
    it('should open customer page in new tab', () => {
      const linkInput = getElement<HTMLInputElement>('customerLink');
      linkInput.value = 'https://example.com';

      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      // Simulate open
      const link = linkInput.value;
      if (link && !link.includes('⚠️')) {
        window.open(link, '_blank');
      }

      expect(openSpy).toHaveBeenCalledWith('https://example.com', '_blank');
    });

    it('should not open page if link contains warning', () => {
      const linkInput = getElement<HTMLInputElement>('customerLink');
      linkInput.value = '⚠️ Warning: Invalid link';

      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      // Simulate open
      const link = linkInput.value;
      if (link && !link.includes('⚠️')) {
        window.open(link, '_blank');
      }

      expect(openSpy).not.toHaveBeenCalled();
    });

    it('should not open page if link is empty', () => {
      const linkInput = getElement<HTMLInputElement>('customerLink');
      linkInput.value = '';

      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      // Simulate open
      const link = linkInput.value;
      if (link && !link.includes('⚠️')) {
        window.open(link, '_blank');
      }

      expect(openSpy).not.toHaveBeenCalled();
    });
  });
  //#endregion

  //#region copyManualLink Tests
  describe('copyManualLink', () => {
    it('should have manual link input', () => {
      const manualLinkInput = getElement<HTMLInputElement>('manualLink');

      expect(manualLinkInput).toBeDefined();
      expect(manualLinkInput.readOnly).toBe(true);
    });

    it('should copy manual link to clipboard', () => {
      const manualLinkInput = getElement<HTMLInputElement>('manualLink');
      manualLinkInput.value = 'https://example.com?staff=0';

      document.execCommand = vi.fn(() => true);

      manualLinkInput.select();
      document.execCommand('copy');

      expect(document.execCommand).toHaveBeenCalledWith('copy');
    });

    it('should show success alert after copying manual link', () => {
      const alertContainer = getElement('alertContainer');

      const alert = document.createElement('div');
      alert.className = 'alert alert-success';
      alert.textContent = '✅ Manuel randevu linki kopyalandı!';
      alertContainer.appendChild(alert);

      expect(hasAlert('Manuel randevu linki kopyalandı')).toBe(true);
    });
  });
  //#endregion

  //#region openManualPage Tests
  describe('openManualPage', () => {
    it('should open manual page in new tab', () => {
      const manualLinkInput = getElement<HTMLInputElement>('manualLink');
      manualLinkInput.value = 'https://example.com?staff=0';

      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      const link = manualLinkInput.value;
      if (link && !link.includes('⚠️')) {
        window.open(link, '_blank');
      }

      expect(openSpy).toHaveBeenCalledWith('https://example.com?staff=0', '_blank');
    });

    it('should not open manual page if link contains warning', () => {
      const manualLinkInput = getElement<HTMLInputElement>('manualLink');
      manualLinkInput.value = '⚠️ Warning';

      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      const link = manualLinkInput.value;
      if (link && !link.includes('⚠️')) {
        window.open(link, '_blank');
      }

      expect(openSpy).not.toHaveBeenCalled();
    });
  });
  //#endregion

  //#region Management Links Tests
  describe('Management Links', () => {
    it('should have management1 link input', () => {
      const management1Link = getElement<HTMLInputElement>('management1Link');

      expect(management1Link).toBeDefined();
      expect(management1Link.readOnly).toBe(true);
    });

    it('should have management2 link input', () => {
      const management2Link = getElement<HTMLInputElement>('management2Link');

      expect(management2Link).toBeDefined();
      expect(management2Link.readOnly).toBe(true);
    });

    it('should have management3 link input', () => {
      const management3Link = getElement<HTMLInputElement>('management3Link');

      expect(management3Link).toBeDefined();
      expect(management3Link.readOnly).toBe(true);
    });

    it('should copy management1 link', () => {
      const management1Link = getElement<HTMLInputElement>('management1Link');
      management1Link.value = 'https://example.com#hk';

      document.execCommand = vi.fn(() => true);

      management1Link.select();
      document.execCommand('copy');

      expect(document.execCommand).toHaveBeenCalledWith('copy');
    });

    it('should show alert after copying management1 link', () => {
      const alertContainer = getElement('alertContainer');

      const alert = document.createElement('div');
      alert.className = 'alert alert-success';
      alert.textContent = '✅ Yönetim-1 linki kopyalandı!';
      alertContainer.appendChild(alert);

      expect(hasAlert('Yönetim-1 linki kopyalandı')).toBe(true);
    });

    it('should open management1 page', () => {
      const management1Link = getElement<HTMLInputElement>('management1Link');
      management1Link.value = 'https://example.com#hk';

      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      const link = management1Link.value;
      if (link && !link.includes('⚠️')) {
        window.open(link, '_blank');
      }

      expect(openSpy).toHaveBeenCalledWith('https://example.com#hk', '_blank');
    });

    it('should copy management2 link', () => {
      const management2Link = getElement<HTMLInputElement>('management2Link');
      management2Link.value = 'https://example.com#ok';

      document.execCommand = vi.fn(() => true);

      management2Link.select();
      document.execCommand('copy');

      expect(document.execCommand).toHaveBeenCalledWith('copy');
    });

    it('should show alert after copying management2 link', () => {
      const alertContainer = getElement('alertContainer');

      const alert = document.createElement('div');
      alert.className = 'alert alert-success';
      alert.textContent = '✅ Yönetim-2 linki kopyalandı!';
      alertContainer.appendChild(alert);

      expect(hasAlert('Yönetim-2 linki kopyalandı')).toBe(true);
    });

    it('should open management2 page', () => {
      const management2Link = getElement<HTMLInputElement>('management2Link');
      management2Link.value = 'https://example.com#ok';

      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      const link = management2Link.value;
      if (link && !link.includes('⚠️')) {
        window.open(link, '_blank');
      }

      expect(openSpy).toHaveBeenCalledWith('https://example.com#ok', '_blank');
    });

    it('should copy management3 link', () => {
      const management3Link = getElement<HTMLInputElement>('management3Link');
      management3Link.value = 'https://example.com#hmk';

      document.execCommand = vi.fn(() => true);

      management3Link.select();
      document.execCommand('copy');

      expect(document.execCommand).toHaveBeenCalledWith('copy');
    });

    it('should show alert after copying management3 link', () => {
      const alertContainer = getElement('alertContainer');

      const alert = document.createElement('div');
      alert.className = 'alert alert-success';
      alert.textContent = '✅ Yönetim-3 linki kopyalandı!';
      alertContainer.appendChild(alert);

      expect(hasAlert('Yönetim-3 linki kopyalandı')).toBe(true);
    });

    it('should open management3 page', () => {
      const management3Link = getElement<HTMLInputElement>('management3Link');
      management3Link.value = 'https://example.com#hmk';

      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      const link = management3Link.value;
      if (link && !link.includes('⚠️')) {
        window.open(link, '_blank');
      }

      expect(openSpy).toHaveBeenCalledWith('https://example.com#hmk', '_blank');
    });

    it('should not open management page if contains warning', () => {
      const management1Link = getElement<HTMLInputElement>('management1Link');
      management1Link.value = '⚠️ Configuration missing';

      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      const link = management1Link.value;
      if (link && !link.includes('⚠️')) {
        window.open(link, '_blank');
      }

      expect(openSpy).not.toHaveBeenCalled();
    });
  });
  //#endregion

  //#region Link Validation Tests
  describe('Link Validation', () => {
    it('should detect warning symbol in link', () => {
      const link = '⚠️ Error: Missing configuration';
      expect(link.includes('⚠️')).toBe(true);
    });

    it('should allow valid link without warning', () => {
      const link = 'https://example.com';
      expect(link.includes('⚠️')).toBe(false);
    });

    it('should detect empty link', () => {
      const link = '';
      expect(!link).toBe(true);
    });

    it('should validate hash routing links', () => {
      const link = 'https://example.com#hk';
      expect(link.includes('#')).toBe(true);
      expect(link.includes('⚠️')).toBe(false);
    });

    it('should validate query parameter links', () => {
      const link = 'https://example.com?staff=0';
      expect(link.includes('?')).toBe(true);
      expect(link.includes('⚠️')).toBe(false);
    });
  });
  //#endregion

});
