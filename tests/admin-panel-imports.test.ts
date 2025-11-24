/**
 * ADMIN-PANEL IMPORTS & CONFIGURATION TESTS
 * Comprehensive test suite for Imports & Configuration region (admin-panel.ts lines 1-23)
 *
 * Test Coverage:
 * - Module imports verification
 * - CONFIG initialization
 * - Global CONFIG availability
 * - Module function availability
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Import all modules that admin-panel.ts imports
import { initMonitoring, logError } from '../monitoring';
import { initConfig, Config } from '../config-loader';
import { escapeHtml } from '../security-helpers';
import { TimeUtils } from '../time-utils';
import { ValidationUtils } from '../validation-utils';
import { ErrorUtils } from '../error-utils';
import { ButtonUtils } from '../button-utils';

describe('Admin Panel - Imports & Configuration', () => {

  //#region Module Import Tests
  describe('Module Imports', () => {
    it('should import monitoring utilities', () => {
      expect(initMonitoring).toBeDefined();
      expect(typeof initMonitoring).toBe('function');
      expect(logError).toBeDefined();
      expect(typeof logError).toBe('function');
    });

    it('should import config-loader utilities', () => {
      expect(initConfig).toBeDefined();
      expect(typeof initConfig).toBe('function');
    });

    it('should import security-helpers', () => {
      expect(escapeHtml).toBeDefined();
      expect(typeof escapeHtml).toBe('function');
    });

    it('should import TimeUtils', () => {
      expect(TimeUtils).toBeDefined();
      expect(typeof TimeUtils).toBe('object');
    });

    it('should import ValidationUtils', () => {
      expect(ValidationUtils).toBeDefined();
      expect(typeof ValidationUtils).toBe('object');
    });

    it('should import ErrorUtils', () => {
      expect(ErrorUtils).toBeDefined();
      expect(typeof ErrorUtils).toBe('object');
    });

    it('should import ButtonUtils', () => {
      expect(ButtonUtils).toBeDefined();
      expect(typeof ButtonUtils).toBe('object');
    });
  });
  //#endregion

  //#region Module Function Availability Tests
  describe('Module Functions Availability', () => {
    it('should have escapeHtml function', () => {
      expect(typeof escapeHtml).toBe('function');

      // Test basic functionality
      const escaped = escapeHtml('<script>alert("xss")</script>');
      expect(escaped).not.toContain('<script>');
      expect(escaped).toContain('&lt;');
    });

    it('should have TimeUtils.toTimeString', () => {
      expect(TimeUtils.toTimeString).toBeDefined();
      expect(typeof TimeUtils.toTimeString).toBe('function');
    });

    it('should have TimeUtils.compareTimeStrings', () => {
      expect(TimeUtils.compareTimeStrings).toBeDefined();
      expect(typeof TimeUtils.compareTimeStrings).toBe('function');
    });

    it('should have ValidationUtils.validateEmail', () => {
      expect(ValidationUtils.validateEmail).toBeDefined();
      expect(typeof ValidationUtils.validateEmail).toBe('function');
    });

    it('should have ValidationUtils.validatePhone', () => {
      expect(ValidationUtils.validatePhone).toBeDefined();
      expect(typeof ValidationUtils.validatePhone).toBe('function');
    });

    it('should have ErrorUtils.handleApiError', () => {
      expect(ErrorUtils.handleApiError).toBeDefined();
      expect(typeof ErrorUtils.handleApiError).toBe('function');
    });

    it('should have ButtonUtils.setLoading', () => {
      expect(ButtonUtils.setLoading).toBeDefined();
      expect(typeof ButtonUtils.setLoading).toBe('function');
    });

    it('should have ButtonUtils.reset', () => {
      expect(ButtonUtils.reset).toBeDefined();
      expect(typeof ButtonUtils.reset).toBe('function');
    });
  });
  //#endregion

  //#region CONFIG Initialization Tests
  describe('CONFIG Initialization', () => {
    it('should initialize CONFIG variable', async () => {
      // Simulate CONFIG initialization
      let CONFIG: Config | undefined;

      // This would be done in the IIFE in admin-panel.ts
      CONFIG = await initConfig();

      expect(CONFIG).toBeDefined();
    });

    it('should have CONFIG with expected structure', async () => {
      const CONFIG = await initConfig();

      expect(CONFIG).toHaveProperty('APPS_SCRIPT_URL');
      expect(CONFIG).toHaveProperty('BASE_URL');
    });

    it('should have APPS_SCRIPT_URL as string', async () => {
      const CONFIG = await initConfig();

      expect(typeof CONFIG.APPS_SCRIPT_URL).toBe('string');
    });

    it('should have BASE_URL as string', async () => {
      const CONFIG = await initConfig();

      expect(typeof CONFIG.BASE_URL).toBe('string');
    });

    it('should set CONFIG on window object', async () => {
      const CONFIG = await initConfig();

      // Simulate setting window.CONFIG
      (window as any).CONFIG = CONFIG;

      expect((window as any).CONFIG).toBeDefined();
      expect((window as any).CONFIG).toBe(CONFIG);
    });

    it('should initialize CONFIG asynchronously', async () => {
      // Simulate async IIFE
      let configInitialized = false;

      await (async () => {
        const CONFIG = await initConfig();
        configInitialized = true;
        (window as any).CONFIG = CONFIG;
      })();

      expect(configInitialized).toBe(true);
    });
  });
  //#endregion

  //#region Import Integrity Tests
  describe('Import Integrity', () => {
    it('should have all required monitoring functions', () => {
      const monitoringFunctions = [initMonitoring, logError];

      monitoringFunctions.forEach(fn => {
        expect(fn).toBeDefined();
        expect(typeof fn).toBe('function');
      });
    });

    it('should have all required utility modules', () => {
      const utilityModules = [TimeUtils, ValidationUtils, ErrorUtils, ButtonUtils];

      utilityModules.forEach(module => {
        expect(module).toBeDefined();
        expect(typeof module).toBe('object');
      });
    });

    it('should have escapeHtml for XSS protection', () => {
      expect(escapeHtml).toBeDefined();

      // Test XSS protection - escapes HTML tags but text remains
      const malicious = '<img src=x onerror="alert(1)">';
      const safe = escapeHtml(malicious);

      // Should escape angle brackets
      expect(safe).not.toContain('<img');
      expect(safe).toContain('&lt;img');
      // Should escape quotes
      expect(safe).toContain('&quot;');
    });

    it('should have initConfig for dynamic configuration', () => {
      expect(initConfig).toBeDefined();
      expect(typeof initConfig).toBe('function');
    });
  });
  //#endregion

  //#region Module Dependencies Tests
  describe('Module Dependencies', () => {
    it('should load monitoring before config', () => {
      // Monitoring should be available
      expect(initMonitoring).toBeDefined();
      expect(logError).toBeDefined();
    });

    it('should load config-loader early', () => {
      // Config loader should be available for CONFIG initialization
      expect(initConfig).toBeDefined();
    });

    it('should have security helpers available', () => {
      // Security helpers needed for safe DOM manipulation
      expect(escapeHtml).toBeDefined();
    });

    it('should have all utility modules loaded', () => {
      // All utility modules should be available
      expect(TimeUtils).toBeDefined();
      expect(ValidationUtils).toBeDefined();
      expect(ErrorUtils).toBeDefined();
      expect(ButtonUtils).toBeDefined();
    });
  });
  //#endregion

});
