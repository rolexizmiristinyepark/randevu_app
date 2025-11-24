/**
 * Storage.gs
 *
 * Data Storage and Version Management Services
 *
 * This module handles all data persistence operations using PropertiesService
 * and CacheService for optimized performance. It also manages data versioning
 * for cache invalidation on the frontend.
 *
 * Services:
 * - StorageService: Core data storage with caching layer
 * - VersionService: Data version management for cache invalidation
 *
 * Dependencies:
 * - Security.gs (log)
 * - Config.gs (CONFIG)
 */

// Cache configuration
const CACHE_DURATION = 900; // 15 dakika (saniye cinsinden)
const DATA_CACHE_KEY = 'app_data';

/**
 * CacheService wrapper for DRY principle
 * @namespace CacheServiceWrapper
 */
const CacheServiceWrapper = {
  /**
   * Get script-level cache instance
   * @returns {Cache} Google Apps Script CacheService.Cache instance
   */
  getCache: function() {
    return CacheService.getScriptCache();
  }
};

// --- Data Storage ---
/**
 * Data storage service using PropertiesService + CacheService
 * @namespace StorageService
 */
const StorageService = {
  /**
   * Veriyi getir (Cache + PropertiesService)
   * @returns {Object} Data object
   */
  getData: function() {
  const cache = CacheServiceWrapper.getCache();

  // 1. Cache'den veriyi kontrol et
  const cachedData = cache.get(DATA_CACHE_KEY);
  if (cachedData) {
    try {
      return JSON.parse(cachedData);
    } catch (e) {
      log.warn('Cache parse hatası:', e);
      // Cache bozuksa devam et, PropertiesService'den oku
    }
  }

  // 2. Cache'de yok, PropertiesService'den oku
  const props = PropertiesService.getScriptProperties();
  const data = props.getProperty(CONFIG.PROPERTIES_KEY);

  if (!data) {
    // 3. Varsayılan veri
    const defaultData = {
      staff: [
        { id: 1, name: 'Serdar Benli', active: true },
        { id: 2, name: 'Ece Argun', active: true },
        { id: 3, name: 'Gökhan Tokol', active: true },
        { id: 4, name: 'Sırma', active: true },
        { id: 5, name: 'Gamze', active: true },
        { id: 6, name: 'Okan', active: true }
      ],
      shifts: {}, // { 'YYYY-MM-DD': { staffId: 'morning|evening|full' } }
      settings: {
        interval: 60,
        maxDaily: 3
      }
    };
    this.saveData(defaultData);
    return defaultData;
  }

  // 4. Parse et ve cache'e kaydet
  const parsedData = JSON.parse(data);
  try {
    cache.put(DATA_CACHE_KEY, data, CACHE_DURATION);
  } catch (e) {
    log.warn('Cache yazma hatası (veri çok büyük olabilir):', e);
    // Cache yazılamazsa da devam et, sadece performans etkilenir
  }

  return parsedData;
  },

  /**
   * Veriyi kaydet (PropertiesService + Cache invalidation)
   * @param {Object} data - Kaydedilecek data
   */
  saveData: function(data) {
    const props = PropertiesService.getScriptProperties();
    const jsonData = JSON.stringify(data);

    // 1. PropertiesService'e kaydet
    props.setProperty(CONFIG.PROPERTIES_KEY, jsonData);

    // 2. Cache'i temizle (veri değiştiği için)
    const cache = CacheServiceWrapper.getCache();
    cache.remove(DATA_CACHE_KEY);

    // 3. Yeni veriyi cache'e yaz (sonraki okumalar için)
    try {
      cache.put(DATA_CACHE_KEY, jsonData, CACHE_DURATION);
    } catch (e) {
      log.warn('Cache yazma hatası:', e);
      // Cache yazılamazsa da devam et
    }
  },

  /**
   * Tüm veriyi sıfırla ve yeni default data yükle
   * @returns {{success: boolean, message?: string, error?: string}} Reset sonucu
   */
  resetData: function() {
    try {
      const props = PropertiesService.getScriptProperties();
      props.deleteProperty(CONFIG.PROPERTIES_KEY);

      // Cache'i temizle
      const cache = CacheServiceWrapper.getCache();
      cache.remove(DATA_CACHE_KEY);

      // Yeni default data yüklenir
      this.getData();

      return { success: true, message: CONFIG.SUCCESS_MESSAGES.DATA_RESET };
    } catch (error) {
      log.error('Reset data error:', error);
      return { success: false, error: error.toString() };
    }
  }
};

// --- Data Version Management ---
// ⭐ Cache invalidation için version tracking
// Frontend cache'i invalidate etmek için kullanılır

const DATA_VERSION_KEY = 'DATA_VERSION';

/**
 * Data version management service for cache invalidation
 * @namespace VersionService
 */
const VersionService = {
  /**
   * Get current data version (for frontend cache invalidation)
   * @returns {{success: boolean, data?: string, error?: string}} Current version
   */
  getDataVersion: function() {
    try {
      const props = PropertiesService.getScriptProperties();
      const version = props.getProperty(DATA_VERSION_KEY) || Date.now().toString();

      // İlk kez çağrılıyorsa, version initialize et
      if (!props.getProperty(DATA_VERSION_KEY)) {
        props.setProperty(DATA_VERSION_KEY, version);
      }

      return { success: true, data: version };
    } catch (error) {
      log.error('getDataVersion error:', error);
      return { success: false, error: error.toString() };
    }
  },

  /**
   * Increment data version (triggers cache invalidation)
   * Called after appointments create/delete/update
   * @returns {{success: boolean, version?: string, error?: string}} New version
   */
  incrementDataVersion: function() {
    try {
      const props = PropertiesService.getScriptProperties();
      const newVersion = Date.now().toString();
      props.setProperty(DATA_VERSION_KEY, newVersion);

      log.info('Data version incremented:', newVersion);
      return { success: true, version: newVersion };
    } catch (error) {
      log.error('incrementDataVersion error:', error);
      // Version increment başarısız olsa bile devam et (critical değil)
      return { success: false, error: error.toString() };
    }
  }
};
