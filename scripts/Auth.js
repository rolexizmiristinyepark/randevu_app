// ==================== AUTHENTICATION SERVICE ====================
// API Key authentication service

/**
 * API Key authentication service
 * @namespace AuthService
 */
const AuthService = {
  /**
   * Generate a new random API key with 'RLX_' prefix
   * Uses cryptographically secure UUID instead of Math.random()
   * @returns {string} Generated API key (format: RLX_[32 hex chars])
   */
  generateApiKey: function() {
    // Utilities.getUuid() kriptografik olarak güvenli UUID v4 üretir
    // Math.random() tahmin edilebilir, UUID güvenli
    return 'RLX_' + Utilities.getUuid().replace(/-/g, '');
  },

  /**
   * Save API key to PropertiesService
   * @param {string} key - API key to save
   * @returns {string} Saved key
   */
  saveApiKey: function(key) {
    const props = PropertiesService.getScriptProperties();
    props.setProperty(CONFIG.API_KEY_PROPERTY, key);
    return key;
  },

  /**
   * Get stored API key (creates new one if doesn't exist)
   * @returns {string} Current API key
   */
  getApiKey: function() {
    const props = PropertiesService.getScriptProperties();
    let key = props.getProperty(CONFIG.API_KEY_PROPERTY);

    // Eğer key yoksa yeni oluştur
    if (!key) {
      key = this.generateApiKey();
      this.saveApiKey(key);
    }

    return key;
  },

  /**
   * Validate provided API key against stored key
   * @param {string} providedKey - API key to validate
   * @returns {boolean} True if valid
   */
  validateApiKey: function(providedKey) {
    if (!providedKey) return false;

    const storedKey = this.getApiKey();
    return providedKey === storedKey;
  },

  /**
   * Regenerate API key (requires old key for verification)
   * Sends email notification to admin
   * @param {string} oldKey - Current API key for verification
   * @returns {{success: boolean, apiKey?: string, error?: string}} Regeneration result
   */
  regenerateApiKey: function(oldKey) {
    if (!this.validateApiKey(oldKey)) {
      return { success: false, error: CONFIG.ERROR_MESSAGES.INVALID_API_KEY };
    }

    const newKey = this.generateApiKey();
    this.saveApiKey(newKey);

    // ✅ YENİ: Audit log
    log.info('🔒 AUDIT: API key regenerated', {
      timestamp: new Date().toISOString(),
      action: 'API_KEY_REGENERATE'
    });

    // Admin'e e-posta gönder
    try {
      MailApp.sendEmail({
        to: CONFIG.ADMIN_EMAIL,
        subject: CONFIG.EMAIL_SUBJECTS.API_KEY_RENEWED,
        name: CONFIG.COMPANY_NAME,
        htmlBody: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h3>API Key Yenilendi</h3>
            <p>Randevu sistemi admin paneli API key'iniz yenilenmiştir.</p>
            <div style="background: #f5f5f5; padding: 15px; margin: 20px 0; font-family: monospace;">
              ${newKey}
            </div>
            <p><strong>Önemli:</strong> Bu key'i güvenli bir yerde saklayın ve kimseyle paylaşmayın.</p>
            <p>Tarih: ${new Date().toLocaleString('tr-TR')}</p>
          </div>
        `
      });
    } catch (e) {
      log.error('API key yenileme e-postası gönderilemedi:', e);
    }

    return { success: true, apiKey: newKey };
  },

  /**
   * Initialize API key and send to admin email
   * Used for initial setup or manual key retrieval
   * @returns {{success: boolean, apiKey: string, message?: string, warning?: string}} Initialization result
   */
  initializeApiKey: function() {
    const existingKey = this.getApiKey();

    // Admin'e e-posta gönder
    try {
      MailApp.sendEmail({
        to: CONFIG.ADMIN_EMAIL,
        subject: CONFIG.EMAIL_SUBJECTS.API_KEY_INITIAL,
        name: CONFIG.COMPANY_NAME,
        htmlBody: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h3>Randevu Sistemi API Key</h3>
            <p>Admin paneline erişim için API key'iniz:</p>
            <div style="background: #f5f5f5; padding: 15px; margin: 20px 0; font-family: monospace; word-break: break-all;">
              ${existingKey}
            </div>
            <p><strong>Önemli:</strong> Bu key'i güvenli bir yerde saklayın ve kimseyle paylaşmayın.</p>
            <p>Admin paneline giriş yaparken bu key'i kullanın.</p>
          </div>
        `
      });
      return { success: true, message: CONFIG.SUCCESS_MESSAGES.API_KEY_SENT, apiKey: existingKey };
    } catch (e) {
      log.error('API key e-postası gönderilemedi:', e);
      // E-posta gönderilmese bile API key'i döndür
      return { success: true, apiKey: existingKey, warning: 'API key oluşturuldu ancak e-posta gönderilemedi' };
    }
  }
};

// ==================== STANDALONE FUNCTIONS ====================
// These can be run directly from the Apps Script editor

/**
 * Send API Key to admin email
 * Run this function manually to grant MailApp permissions
 * @function
 */
function sendApiKeyToAdmin() {
  const result = AuthService.initializeApiKey();
  Logger.log('API Key: ' + result.apiKey);
  Logger.log('Result: ' + JSON.stringify(result));
  return result;
}

/**
 * Get current API Key (logs to console)
 * @function
 */
function showCurrentApiKey() {
  const key = AuthService.getApiKey();
  Logger.log('Current API Key: ' + key);
  return key;
}
