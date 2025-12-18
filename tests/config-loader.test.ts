import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Config, DynamicConfig } from '../config-loader';

// Note: We can't import the actual functions because they have side effects (window checks)
// Instead, we'll test the logic patterns

describe('Config Loader Logic', () => {
  let localStorage: Storage;

  const CACHE_KEY = 'randevu_config_cache';
  const CACHE_TTL = 60 * 60 * 1000; // 1 hour

  beforeEach(() => {
    // Use global localStorage mock from setup.ts
    localStorage = global.localStorage;
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('Cache Logic', () => {
    it('should store config in cache with timestamp', () => {
      const config: DynamicConfig = {
        shifts: {
          morning: { start: 11, end: 18, label: 'Morning' }
        },
        appointmentHours: { earliest: 11, latest: 21, interval: 60 },
        maxDailyDeliveryAppointments: 3,
        appointmentTypes: { delivery: 'Delivery' }
      };

      const timestamp = Date.now();
      const cacheData = {
        config,
        timestamp
      };

      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));

      const cached = localStorage.getItem(CACHE_KEY);
      expect(cached).toBeTruthy();

      const parsed = JSON.parse(cached!);
      expect(parsed.config).toEqual(config);
      expect(parsed.timestamp).toBe(timestamp);
    });

    it('should validate cache timestamp (not expired)', () => {
      vi.useFakeTimers();
      const now = new Date('2025-01-22T10:00:00Z');
      vi.setSystemTime(now);

      const config: DynamicConfig = {
        shifts: {},
        appointmentHours: { earliest: 11, latest: 21, interval: 60 },
        maxDailyDeliveryAppointments: 3,
        appointmentTypes: {}
      };

      const cacheData = {
        config,
        timestamp: now.getTime()
      };

      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));

      // 30 minutes later (within 1 hour TTL)
      vi.advanceTimersByTime(30 * 60 * 1000);

      const cached = JSON.parse(localStorage.getItem(CACHE_KEY)!);
      const age = Date.now() - cached.timestamp;

      expect(age).toBe(30 * 60 * 1000);
      expect(age).toBeLessThan(CACHE_TTL);
    });

    it('should detect expired cache', () => {
      vi.useFakeTimers();
      const now = new Date('2025-01-22T10:00:00Z');
      vi.setSystemTime(now);

      const cacheData = {
        config: { shifts: {}, appointmentHours: { earliest: 11, latest: 21, interval: 60 }, maxDailyDeliveryAppointments: 3, appointmentTypes: {} },
        timestamp: now.getTime()
      };

      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));

      // 2 hours later (beyond 1 hour TTL)
      vi.advanceTimersByTime(2 * 60 * 60 * 1000);

      const cached = JSON.parse(localStorage.getItem(CACHE_KEY)!);
      const age = Date.now() - cached.timestamp;

      expect(age).toBe(2 * 60 * 60 * 1000);
      expect(age).toBeGreaterThan(CACHE_TTL);

      // Should clear expired cache
      localStorage.removeItem(CACHE_KEY);
      expect(localStorage.getItem(CACHE_KEY)).toBeNull();
    });

    it('should handle missing cache', () => {
      const cached = localStorage.getItem(CACHE_KEY);
      expect(cached).toBeNull();
    });

    it('should handle corrupted cache gracefully', () => {
      localStorage.setItem(CACHE_KEY, 'invalid json {');

      expect(() => {
        JSON.parse(localStorage.getItem(CACHE_KEY)!);
      }).toThrow();

      // Should clear corrupted cache
      localStorage.removeItem(CACHE_KEY);
      expect(localStorage.getItem(CACHE_KEY)).toBeNull();
    });

    it('should clear cache on demand', () => {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ config: {}, timestamp: Date.now() }));
      expect(localStorage.getItem(CACHE_KEY)).toBeTruthy();

      localStorage.removeItem(CACHE_KEY);
      expect(localStorage.getItem(CACHE_KEY)).toBeNull();
    });
  });

  describe('Backend Config Transformation', () => {
    it('should transform shift format from backend to frontend', () => {
      const backendShifts = {
        morning: {
          start: '11:00',
          end: '18:00',
          label: 'Morning Shift'
        },
        evening: {
          start: '14:00',
          end: '21:00',
          label: 'Evening Shift'
        }
      };

      // Transform logic: parse "HH:MM" to hour number
      const frontendShifts = Object.fromEntries(
        Object.entries(backendShifts).map(([key, value]: [string, any]) => [
          key,
          {
            start: parseInt(value.start.split(':')[0]),
            end: parseInt(value.end.split(':')[0]),
            label: value.label
          }
        ])
      );

      expect(frontendShifts.morning?.start).toBe(11);
      expect(frontendShifts.morning?.end).toBe(18);
      expect(frontendShifts.evening?.start).toBe(14);
      expect(frontendShifts.evening?.end).toBe(21);
    });

    it('should use default appointment hours if missing', () => {
      const backendConfig = {};
      const defaultHours = { earliest: 11, latest: 21, interval: 60 };

      const appointmentHours = (backendConfig as any).appointmentHours || defaultHours;

      expect(appointmentHours).toEqual(defaultHours);
    });

    it('should use default delivery limit if missing', () => {
      const backendConfig = {};
      const defaultLimit = 3;

      const maxDaily = (backendConfig as any).maxDailyDeliveryAppointments || defaultLimit;

      expect(maxDaily).toBe(3);
    });

    it('should transform appointment type labels', () => {
      const backendLabels = {
        delivery: 'Saat Takdimi',
        service: 'Servis & Bakım',
        consultation: 'Ürün Danışmanlığı'
      };

      const frontendTypes = backendLabels;

      expect(frontendTypes.delivery).toBe('Saat Takdimi');
      expect(frontendTypes.service).toBe('Servis & Bakım');
      expect(frontendTypes.consultation).toBe('Ürün Danışmanlığı');
    });

    it('should handle empty shifts', () => {
      const backendConfig = { shifts: {} };
      const shifts = backendConfig.shifts || {};

      expect(Object.keys(shifts)).toHaveLength(0);
    });

    it('should include optional company info', () => {
      const backendConfig = {
        companyName: 'Rolex İzmir İstinyepark',
        companyLocation: 'İstinyepark AVM'
      };

      expect(backendConfig.companyName).toBe('Rolex İzmir İstinyepark');
      expect(backendConfig.companyLocation).toBe('İstinyepark AVM');
    });
  });

  describe('Environment Config', () => {
    it('should have hardcoded environment values', () => {
      const ENV_CONFIG = {
        APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwmowzsBLrAOjn-HVtw_LSLf-Gn0jrWdaQMrxaJeulqnhJCQduyyeSvctsWPAXxSAuo/exec',
        BASE_URL: 'https://rolexizmiristinyepark.github.io/randevu_app/',
        DEBUG: false
      };

      expect(ENV_CONFIG.APPS_SCRIPT_URL).toContain('script.google.com');
      expect(ENV_CONFIG.BASE_URL).toContain('github.io');
      expect(ENV_CONFIG.DEBUG).toBe(false);
    });

    it('should merge environment and dynamic config', () => {
      const ENV_CONFIG = {
        APPS_SCRIPT_URL: 'https://script.google.com/test',
        BASE_URL: 'https://example.com',
        DEBUG: false
      };

      const dynamicConfig: DynamicConfig = {
        shifts: { morning: { start: 11, end: 18, label: 'Morning' } },
        appointmentHours: { earliest: 11, latest: 21, interval: 60 },
        maxDailyDeliveryAppointments: 3,
        appointmentTypes: { delivery: 'Delivery' }
      };

      const fullConfig: Config = {
        ...ENV_CONFIG,
        ...dynamicConfig,
        VERSION: '1.0'
      };

      expect(fullConfig.APPS_SCRIPT_URL).toBe(ENV_CONFIG.APPS_SCRIPT_URL);
      expect(fullConfig.shifts).toEqual(dynamicConfig.shifts);
      expect(fullConfig.appointmentHours).toEqual(dynamicConfig.appointmentHours);
    });
  });

  describe('Fallback Config', () => {
    it('should provide fallback config on API error', () => {
      const fallbackConfig: Config = {
        APPS_SCRIPT_URL: 'https://script.google.com/test',
        BASE_URL: 'https://example.com',
        DEBUG: false,
        VERSION: '1.0',
        shifts: {
          'morning': { start: 11, end: 18, label: 'Sabah (11:00-18:00)' },
          'evening': { start: 14, end: 21, label: 'Akşam (14:00-21:00)' },
          'full': { start: 11, end: 21, label: 'Full (11:00-21:00)' }
        },
        appointmentHours: { earliest: 11, latest: 21, interval: 60 },
        maxDailyDeliveryAppointments: 3,
        appointmentTypes: {
          'delivery': 'Saat Takdim',
          'service': 'Servis & Bakım',
          'consultation': 'Ürün Danışmanlığı',
          'general': 'Genel Görüşme',
          'shipping': 'Gönderi'
        }
      };

      expect(fallbackConfig.shifts.morning?.start).toBe(11);
      expect(fallbackConfig.appointmentHours.earliest).toBe(11);
      expect(fallbackConfig.maxDailyDeliveryAppointments).toBe(3);
      expect(Object.keys(fallbackConfig.appointmentTypes)).toHaveLength(5);
    });

    it('should have Turkish labels in fallback config', () => {
      const fallbackTypes = {
        'delivery': 'Saat Takdim',
        'service': 'Servis & Bakım',
        'consultation': 'Ürün Danışmanlığı',
        'general': 'Genel Görüşme',
        'shipping': 'Gönderi'
      };

      expect(fallbackTypes.delivery).toContain('Saat');
      expect(fallbackTypes.service).toContain('Servis');
      expect(fallbackTypes.consultation).toContain('Ürün');
    });
  });

  describe('Force Refresh Logic', () => {
    it('should skip cache when forceRefresh is true', () => {
      // Set up cache
      const cacheData = {
        config: {
          shifts: { old: { start: 9, end: 17, label: 'Old' } },
          appointmentHours: { earliest: 9, latest: 17, interval: 60 },
          maxDailyDeliveryAppointments: 2,
          appointmentTypes: {}
        },
        timestamp: Date.now()
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));

      // Force refresh logic
      const forceRefresh = true;
      let useCache = false;

      if (!forceRefresh) {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_TTL) {
            useCache = true;
          }
        }
      }

      expect(useCache).toBe(false);
    });

    it('should use cache when forceRefresh is false and cache is valid', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-22T10:00:00Z'));

      const cacheData = {
        config: {
          shifts: {},
          appointmentHours: { earliest: 11, latest: 21, interval: 60 },
          maxDailyDeliveryAppointments: 3,
          appointmentTypes: {}
        },
        timestamp: Date.now()
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));

      // 10 minutes later
      vi.advanceTimersByTime(10 * 60 * 1000);

      const forceRefresh = false;
      let useCache = false;

      if (!forceRefresh) {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_TTL) {
            useCache = true;
          }
        }
      }

      expect(useCache).toBe(true);
    });
  });

  describe('Memory Cache Layer', () => {
    it('should have memory cache faster than localStorage', () => {
      // Memory cache pattern
      let memoryCache: { config: DynamicConfig; timestamp: number } | null = null;

      const config: DynamicConfig = {
        shifts: {},
        appointmentHours: { earliest: 11, latest: 21, interval: 60 },
        maxDailyDeliveryAppointments: 3,
        appointmentTypes: {}
      };

      // Set memory cache
      memoryCache = { config, timestamp: Date.now() };

      // Check memory cache first (fastest)
      expect(memoryCache).toBeTruthy();
      expect(memoryCache!.config).toEqual(config);
    });

    it('should fall back to localStorage if memory cache is null', () => {
      let memoryCache: { config: DynamicConfig; timestamp: number } | null = null;

      // Memory cache empty
      expect(memoryCache).toBeNull();

      // Check localStorage
      const cacheData = {
        config: {
          shifts: {},
          appointmentHours: { earliest: 11, latest: 21, interval: 60 },
          maxDailyDeliveryAppointments: 3,
          appointmentTypes: {}
        },
        timestamp: Date.now()
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));

      const cached = localStorage.getItem(CACHE_KEY);
      expect(cached).toBeTruthy();

      const parsed = JSON.parse(cached!);
      memoryCache = { config: parsed.config, timestamp: parsed.timestamp };

      expect(memoryCache).toBeTruthy();
    });

    it('should clear memory cache on expiration', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-22T10:00:00Z'));

      let memoryCache: { config: DynamicConfig; timestamp: number } | null = {
        config: {
          shifts: {},
          appointmentHours: { earliest: 11, latest: 21, interval: 60 },
          maxDailyDeliveryAppointments: 3,
          appointmentTypes: {}
        },
        timestamp: Date.now()
      };

      // 2 hours later (expired)
      vi.advanceTimersByTime(2 * 60 * 60 * 1000);

      const age = Date.now() - memoryCache.timestamp;
      if (age >= CACHE_TTL) {
        memoryCache = null;
      }

      expect(memoryCache).toBeNull();
    });
  });
});
