/**
 * Staff.gs
 *
 * Staff and Shift Management Services
 *
 * This module handles staff member CRUD operations and shift scheduling.
 * Includes validation, sanitization, and race condition protection.
 *
 * Services:
 * - StaffService: Staff member management
 * - ShiftService: Shift scheduling and retrieval
 * - Utils: Validation and sanitization utilities
 *
 * Dependencies:
 * - Config.gs (CONFIG, VALIDATION)
 * - Storage.gs (StorageService)
 * - Security.gs (LockServiceWrapper, log)
 */

// --- Utility Functions ---
/**
 * Utility functions for validation, sanitization, and formatting
 * @namespace Utils
 */
const Utils = {
  /**
   * E-posta adresini validate eder
   * @param {string} email - E-posta adresi
   * @returns {boolean} Geçerli mi?
   */
  isValidEmail: function(email) {
    if (!email || typeof email !== 'string') return false;
    // Basit email regex - RFC 5322 compliant değil ama pratik
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  },

  /**
   * String'i sanitize eder (trim + max length)
   * @param {string} str - String
   * @param {number} maxLength - Maximum uzunluk
   * @returns {string} Sanitized string
   */
  sanitizeString: function(str, maxLength) {
    if (!str || typeof str !== 'string') return '';
    return str.trim().substring(0, maxLength);
  },

  /**
   * Telefon numarasını sanitize eder
   * @param {string} phone - Telefon numarası
   * @returns {string} Sanitized telefon
   */
  sanitizePhone: function(phone) {
    if (!phone || typeof phone !== 'string') return '';
    // Sadece rakam, +, -, boşluk ve parantez karakterlerine izin ver
    return phone.replace(/[^0-9+\-\s()]/g, '').trim().substring(0, VALIDATION.PHONE_MAX_LENGTH);
  },

  /**
   * İsmi Title Case formatına çevirir (Her Kelimenin İlk Harfi Büyük)
   * Örnek: "SERDAR BENLİ" → "Serdar Benli"
   * @param {string} name - Formatlanacak isim
   * @returns {string} Title Case formatında isim
   */
  toTitleCase: function(name) {
    if (!name || typeof name !== 'string') return '';

    return name
      .trim()
      .toLowerCase()
      .split(' ')
      .map(word => {
        if (word.length === 0) return word;
        return word.charAt(0).toLocaleUpperCase('tr-TR') + word.slice(1);
      })
      .join(' ');
  },

  /**
   * Personel doğrulama ve temizleme - DRY prensibi
   * @param {string} name - İsim
   * @param {string} phone - Telefon
   * @param {string} email - E-posta
   * @returns {{name?: string, phone?: string, email?: string, error?: string}} Validation sonucu
   */
  validateAndSanitizeStaff: function(name, phone, email) {
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return { error: CONFIG.ERROR_MESSAGES.NAME_REQUIRED };
    }

    if (!phone || typeof phone !== 'string' || phone.trim().length === 0) {
      return { error: CONFIG.ERROR_MESSAGES.PHONE_REQUIRED };
    }

    if (email && !this.isValidEmail(email)) {
      return { error: CONFIG.ERROR_MESSAGES.INVALID_EMAIL };
    }

    return {
      name: this.toTitleCase(name),
      phone: this.sanitizePhone(phone),
      email: email ? email.trim().toLowerCase() : ''
    };
  }
};

// --- Staff Management ---
/**
 * Staff management service
 * @namespace StaffService
 */
const StaffService = {
  /**
   * Get all staff members
   * @returns {{success: boolean, data: Array}} Staff list
   */
  getStaff: function() {
    const data = StorageService.getData();
    return { success: true, data: data.staff || [] };
  },

  /**
   * Add new staff member (with validation, sanitization, and race condition protection)
   * @param {string} name - Staff name
   * @param {string} phone - Phone number
   * @param {string} email - Email address
   * @returns {{success: boolean, data?: Array, error?: string}} Result with updated staff list
   */
  addStaff: function(name, phone, email) {
    try {
      // Validation ve sanitization - DRY prensibi
      const validationResult = Utils.validateAndSanitizeStaff(name, phone, email);
      if (validationResult.error) {
        return { success: false, error: validationResult.error };
      }

      // Lock ile getData → modify → saveData atomik yap
      return LockServiceWrapper.withLock(() => {
        const data = StorageService.getData();
        const newId = data.staff.length > 0 ? Math.max(...data.staff.map(s => s.id)) + 1 : 1;
        data.staff.push({
          id: newId,
          name: validationResult.name,
          phone: validationResult.phone,
          email: validationResult.email,
          active: true
        });
        StorageService.saveData(data);
        return { success: true, data: data.staff };
      });
    } catch (error) {
      return { success: false, error: error.toString() };
    }
  },

  /**
   * Toggle staff active/inactive status
   * @param {number|string} staffId - Staff ID
   * @returns {{success: boolean, data?: Array, error?: string}} Result with updated staff list
   */
  toggleStaff: function(staffId) {
    try {
      // Lock ile getData → modify → saveData atomik yap
      return LockServiceWrapper.withLock(() => {
        const data = StorageService.getData();
        const staff = data.staff.find(s => s.id === parseInt(staffId));
        if (staff) {
          staff.active = !staff.active;
          StorageService.saveData(data);
          return { success: true, data: data.staff };
        }
        return { success: false, error: CONFIG.ERROR_MESSAGES.STAFF_NOT_FOUND };
      });
    } catch (error) {
      return { success: false, error: error.toString() };
    }
  },

  /**
   * Remove staff member and clear from all shifts
   * @param {number|string} staffId - Staff ID
   * @returns {{success: boolean, data?: Array, error?: string}} Result with updated staff list
   */
  removeStaff: function(staffId) {
    try {
      // Lock ile getData → modify → saveData atomik yap
      return LockServiceWrapper.withLock(() => {
        const data = StorageService.getData();
        data.staff = data.staff.filter(s => s.id !== parseInt(staffId));

        // Vardiyalardan da sil
        Object.keys(data.shifts).forEach(date => {
          if (data.shifts[date][staffId]) {
            delete data.shifts[date][staffId];
          }
        });

        StorageService.saveData(data);
        return { success: true, data: data.staff };
      });
    } catch (error) {
      return { success: false, error: error.toString() };
    }
  },

  /**
   * Update staff member details (with validation and sanitization)
   * @param {number|string} staffId - Staff ID
   * @param {string} name - New name
   * @param {string} phone - New phone
   * @param {string} email - New email
   * @returns {{success: boolean, data?: Array, error?: string}} Result with updated staff list
   */
  updateStaff: function(staffId, name, phone, email) {
    try {
      // Validation ve sanitization - DRY prensibi
      const validationResult = Utils.validateAndSanitizeStaff(name, phone, email);
      if (validationResult.error) {
        return { success: false, error: validationResult.error };
      }

      // Lock ile getData → modify → saveData atomik yap
      return LockServiceWrapper.withLock(() => {
        const data = StorageService.getData();
        const staff = data.staff.find(s => s.id === parseInt(staffId));
        if (staff) {
          staff.name = validationResult.name;
          staff.phone = validationResult.phone;
          staff.email = validationResult.email;
          StorageService.saveData(data);
          return { success: true, data: data.staff };
        }
        return { success: false, error: CONFIG.ERROR_MESSAGES.STAFF_NOT_FOUND };
      });
    } catch (error) {
      return { success: false, error: error.toString() };
    }
  }
};

// --- Shifts Management ---
/**
 * Staff shift scheduling service (morning/evening/full shifts)
 * @namespace ShiftService
 */
const ShiftService = {
  /**
   * Save shifts for one or more dates (with race condition protection)
   * @param {Object.<string, Object.<string, string>>} shiftsData - Format: { 'YYYY-MM-DD': { staffId: 'morning|evening|full' } }
   * @returns {{success: boolean, error?: string}} Save result
   */
  saveShifts: function(shiftsData) {
    try {
      // Lock ile getData → modify → saveData atomik yap
      return LockServiceWrapper.withLock(() => {
        const data = StorageService.getData();
        // shiftsData format: { 'YYYY-MM-DD': { staffId: 'morning|evening|full' } }
        Object.keys(shiftsData).forEach(date => {
          if (!data.shifts[date]) {
            data.shifts[date] = {};
          }
          data.shifts[date] = shiftsData[date];
        });
        StorageService.saveData(data);
        return { success: true };
      });
    } catch (error) {
      return { success: false, error: error.toString() };
    }
  },

  /**
   * Get shifts for a specific date
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {{success: boolean, data: Object.<string, string>}} Shifts for date
   */
  getShifts: function(date) {
    const data = StorageService.getData();
    const shifts = data.shifts || {};
    return { success: true, data: shifts[date] || {} };
  },

  /**
   * Get all shifts for a specific month
   * @param {string} month - Month in YYYY-MM format
   * @returns {{success: boolean, data: Object.<string, Object>}} All shifts for month
   */
  getMonthShifts: function(month) {
    const data = StorageService.getData();
    const shifts = data.shifts || {};
    const monthShifts = {};

    // YYYY-MM formatında gelen ay parametresi
    Object.keys(shifts).forEach(date => {
      if (date.startsWith(month)) {
        monthShifts[date] = shifts[date];
      }
    });

    return { success: true, data: monthShifts };
  }
};
