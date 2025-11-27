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
 * PropertiesService tabanlı storage (legacy)
 * @namespace PropertiesStorageService
 */
const PropertiesStorageService = {
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

// --- Backup Service ---
// ⭐ Otomatik ve manuel yedekleme işlemleri
const BACKUP_KEY_PREFIX = 'BACKUP_';
const MAX_BACKUPS = 7; // Son 7 yedekleme saklanır

/**
 * Backup service for data protection
 * @namespace BackupService
 */
const BackupService = {
  /**
   * Manuel veya otomatik yedekleme oluştur
   * @param {string} trigger - 'manual' veya 'auto'
   * @returns {{success: boolean, backupId?: string, error?: string}} Yedekleme sonucu
   */
  createBackup: function(trigger = 'manual') {
    try {
      const props = PropertiesService.getScriptProperties();
      const data = StorageService.getData();

      const backupId = new Date().toISOString().replace(/[:.]/g, '-');
      const backupKey = BACKUP_KEY_PREFIX + backupId;

      const backupData = {
        id: backupId,
        trigger: trigger,
        timestamp: new Date().toISOString(),
        data: data
      };

      props.setProperty(backupKey, JSON.stringify(backupData));

      // Eski yedeklemeleri temizle
      this._cleanupOldBackups();

      log.info('Backup created:', backupId, trigger);
      return { success: true, backupId: backupId };

    } catch (error) {
      log.error('createBackup error:', error);
      return { success: false, error: error.toString() };
    }
  },

  /**
   * Yedeklemeleri listele
   * @returns {{success: boolean, backups?: Array, error?: string}} Yedekleme listesi
   */
  listBackups: function() {
    try {
      const props = PropertiesService.getScriptProperties();
      const allProps = props.getProperties();

      const backups = [];
      for (const key in allProps) {
        if (key.startsWith(BACKUP_KEY_PREFIX)) {
          try {
            const backup = JSON.parse(allProps[key]);
            backups.push({
              id: backup.id,
              trigger: backup.trigger,
              timestamp: backup.timestamp
            });
          } catch (e) {
            // Geçersiz backup, atla
          }
        }
      }

      // Tarihe göre sırala (en yeni önce)
      backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      return { success: true, backups: backups };

    } catch (error) {
      log.error('listBackups error:', error);
      return { success: false, error: error.toString() };
    }
  },

  /**
   * Yedekten geri yükle
   * @param {string} backupId - Yedekleme ID'si
   * @returns {{success: boolean, message?: string, error?: string}} Geri yükleme sonucu
   */
  restoreBackup: function(backupId) {
    try {
      const props = PropertiesService.getScriptProperties();
      const backupKey = BACKUP_KEY_PREFIX + backupId;
      const backupStr = props.getProperty(backupKey);

      if (!backupStr) {
        return { success: false, error: 'Yedekleme bulunamadı: ' + backupId };
      }

      const backup = JSON.parse(backupStr);

      // Mevcut veriyi yedekle (geri alma için)
      this.createBackup('pre-restore');

      // Yedekten geri yükle
      StorageService.saveData(backup.data);

      // Cache'i invalidate et
      VersionService.incrementDataVersion();

      log.info('Backup restored:', backupId);
      return { success: true, message: 'Yedekleme başarıyla geri yüklendi: ' + backupId };

    } catch (error) {
      log.error('restoreBackup error:', error);
      return { success: false, error: error.toString() };
    }
  },

  /**
   * Eski yedeklemeleri temizle (MAX_BACKUPS aşılırsa)
   * @private
   */
  _cleanupOldBackups: function() {
    try {
      const result = this.listBackups();
      if (!result.success || !result.backups) return;

      const backups = result.backups;
      if (backups.length <= MAX_BACKUPS) return;

      // En eski yedeklemeleri sil
      const props = PropertiesService.getScriptProperties();
      const toDelete = backups.slice(MAX_BACKUPS);

      toDelete.forEach(backup => {
        const backupKey = BACKUP_KEY_PREFIX + backup.id;
        props.deleteProperty(backupKey);
        log.info('Old backup deleted:', backup.id);
      });

    } catch (error) {
      log.error('_cleanupOldBackups error:', error);
    }
  }
};

/**
 * Trigger: Günlük otomatik yedekleme
 * Google Apps Script Time-driven trigger olarak ayarlanmalı
 * Kurulum: Edit > Triggers > Add Trigger > dailyBackup > Time-driven > Day timer
 */
function dailyBackup() {
  BackupService.createBackup('auto');
}

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

// ==================== UNIFIED STORAGE SERVICE ====================
/**
 * Feature flag kontrolü
 * USE_SHEETS_STORAGE = 'true' ise Google Sheets kullanılır
 */
const STORAGE_FEATURE_FLAG = {
  isSheetStorageEnabled: function() {
    try {
      const props = PropertiesService.getScriptProperties();
      return props.getProperty('USE_SHEETS_STORAGE') === 'true';
    } catch (e) {
      return false;
    }
  },

  enableSheetStorage: function() {
    const props = PropertiesService.getScriptProperties();
    props.setProperty('USE_SHEETS_STORAGE', 'true');
    return { success: true, message: 'Sheet storage aktifleştirildi' };
  },

  disableSheetStorage: function() {
    const props = PropertiesService.getScriptProperties();
    props.setProperty('USE_SHEETS_STORAGE', 'false');
    return { success: true, message: 'Sheet storage devre dışı bırakıldı' };
  }
};

/**
 * Unified Storage Service - Feature flag'e göre backend seçer
 * @namespace StorageService
 */
const StorageService = {
  /**
   * Aktif backend'i seç
   * @returns {Object} PropertiesStorageService veya SheetStorageService
   * @private
   */
  _getBackend: function() {
    if (STORAGE_FEATURE_FLAG.isSheetStorageEnabled() && typeof SheetStorageService !== 'undefined') {
      return SheetStorageService;
    }
    return PropertiesStorageService;
  },

  /**
   * Veriyi getir
   * @returns {Object} { staff, shifts, settings }
   */
  getData: function() {
    return this._getBackend().getData();
  },

  /**
   * Veriyi kaydet
   * @param {Object} data - { staff, shifts, settings }
   */
  saveData: function(data) {
    return this._getBackend().saveData(data);
  },

  /**
   * Veriyi sıfırla
   * @returns {{success: boolean, message: string}}
   */
  resetData: function() {
    return this._getBackend().resetData();
  },

  /**
   * Hangi backend aktif
   * @returns {string} 'sheets' veya 'properties'
   */
  getActiveBackend: function() {
    if (STORAGE_FEATURE_FLAG.isSheetStorageEnabled() && typeof SheetStorageService !== 'undefined') {
      return 'sheets';
    }
    return 'properties';
  }
};
