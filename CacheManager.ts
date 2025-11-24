/**
 * CacheManager.ts
 *
 * SessionStorage-based caching with auto-expiration and quota handling.
 * Replaces sessionStorageCache utilities from app.ts
 */

// ==================== TYPES ====================

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  expiresAt: number;
}

// ==================== CONSTANTS ====================

const CACHE_PREFIX = 'randevu_cache_';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

// ==================== CACHE MANAGER ====================

class CacheManager {
  private prefix: string;
  private defaultDuration: number;

  constructor(prefix = CACHE_PREFIX, defaultDuration = CACHE_DURATION) {
    this.prefix = prefix;
    this.defaultDuration = defaultDuration;
  }

  /**
   * Get item from cache
   * Returns null if not found or expired
   */
  get<T>(key: string): T | null {
    try {
      const fullKey = this.prefix + key;
      const cached = sessionStorage.getItem(fullKey);

      if (!cached) {
        return null;
      }

      const entry: CacheEntry<T> = JSON.parse(cached);
      const now = Date.now();

      // Check if expired
      if (now > entry.expiresAt) {
        this.delete(key);
        return null;
      }

      return entry.value;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set item in cache with optional TTL
   */
  set<T>(key: string, value: T, ttl?: number): boolean {
    try {
      const fullKey = this.prefix + key;
      const now = Date.now();
      const duration = ttl || this.defaultDuration;

      const entry: CacheEntry<T> = {
        value,
        timestamp: now,
        expiresAt: now + duration,
      };

      sessionStorage.setItem(fullKey, JSON.stringify(entry));
      return true;
    } catch (error) {
      // Handle quota exceeded error
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn('SessionStorage quota exceeded, clearing cache...');
        this.clear();

        // Retry once after clearing
        try {
          const fullKey = this.prefix + key;
          const now = Date.now();
          const duration = ttl || this.defaultDuration;

          const entry: CacheEntry<T> = {
            value,
            timestamp: now,
            expiresAt: now + duration,
          };

          sessionStorage.setItem(fullKey, JSON.stringify(entry));
          return true;
        } catch (retryError) {
          console.error('Cache set retry failed:', retryError);
          return false;
        }
      }

      console.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Delete item from cache
   */
  delete(key: string): void {
    try {
      const fullKey = this.prefix + key;
      sessionStorage.removeItem(fullKey);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  /**
   * Clear all cache items with this prefix
   */
  clear(): void {
    try {
      const keysToRemove: string[] = [];

      // Find all keys with our prefix
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith(this.prefix)) {
          keysToRemove.push(key);
        }
      }

      // Remove them
      keysToRemove.forEach(key => sessionStorage.removeItem(key));
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  /**
   * Clear expired entries
   */
  clearExpired(): void {
    try {
      const now = Date.now();
      const keysToRemove: string[] = [];

      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (!key || !key.startsWith(this.prefix)) continue;

        try {
          const cached = sessionStorage.getItem(key);
          if (!cached) continue;

          const entry: CacheEntry<any> = JSON.parse(cached);
          if (now > entry.expiresAt) {
            keysToRemove.push(key);
          }
        } catch (parseError) {
          // Invalid entry, remove it
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => sessionStorage.removeItem(key));
    } catch (error) {
      console.error('Cache clearExpired error:', error);
    }
  }

  /**
   * Get all cache keys (without prefix)
   */
  keys(): string[] {
    try {
      const keys: string[] = [];

      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith(this.prefix)) {
          keys.push(key.substring(this.prefix.length));
        }
      }

      return keys;
    } catch (error) {
      console.error('Cache keys error:', error);
      return [];
    }
  }

  /**
   * Get cache size (approximate, in bytes)
   */
  getSize(): number {
    try {
      let size = 0;

      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (!key || !key.startsWith(this.prefix)) continue;

        const value = sessionStorage.getItem(key);
        if (value) {
          size += key.length + value.length;
        }
      }

      return size;
    } catch (error) {
      console.error('Cache getSize error:', error);
      return 0;
    }
  }
}

// ==================== SINGLETON EXPORT ====================

export const cache = new CacheManager();

// Alias for backward compatibility (monthCache in app.ts)
export const monthCache = cache;

// Export for window/global access
if (typeof window !== 'undefined') {
  (window as any).cacheManager = cache;
  (window as any).monthCache = cache; // Backward compat
}

// Clear expired entries on page load
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    cache.clearExpired();
  });
}
