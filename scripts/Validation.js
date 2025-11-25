/**
 * Validation.gs
 *
 * Business Rules Validation Service
 *
 * This module validates appointment reservations against all business rules
 * including slot availability, delivery limits, and shift assignments.
 *
 * Services:
 * - ValidationService: Core validation logic for appointments
 *
 * Dependencies:
 * - Config.gs (CONFIG, SLOT_UNIVERSE)
 * - Calendar.gs (SlotService)
 * - Appointments.gs (AvailabilityService)
 * - Security.gs (log)
 */

// --- Validation Service ---
/**
 * Business rules validation service
 * Validates appointment reservations against all business rules
 * @namespace ValidationService
 */
const ValidationService = {
  /**
   * Validate appointment reservation against all business rules
   * CORE validation with race condition protection
   * @param {Object} payload - {date, hour, appointmentType, staffId, isVipLink}
   * @returns {{valid: boolean, error?: string, isDayMaxed?: boolean, suggestAlternatives?: boolean}}
   */
  validateReservation: function(payload) {
    const { date, hour, appointmentType, staffId, isVipLink } = payload;

    try {
      // YÖNETİM RANDEVUSU EXCEPTION: Yönetim randevuları için tüm kontrolleri bypass et
      if (appointmentType === CONFIG.APPOINTMENT_TYPES.MANAGEMENT || appointmentType === 'management') {
        return { valid: true };
      }

      // VIP LINK EXCEPTION: VIP linkler için slot kontrolünü bypass et (max 2 randevu)
      // Google Apps Script e.parameter'dan gelen değerler string olabilir ("true"/"false")
      const isVip = isVipLink === true || isVipLink === 'true';
      if (isVip) {
        return { valid: true };
      }

      // KURAL 1: Slot evreninde mi? (11-20 arası tam saat)
      if (!SLOT_UNIVERSE.includes(parseInt(hour))) {
        return {
          valid: false,
          error: `Geçersiz saat. Sadece ${SLOT_UNIVERSE[0]}:00-${SLOT_UNIVERSE[SLOT_UNIVERSE.length - 1]}:00 arası randevu alınabilir.`
        };
      }

      // KURAL 2: Slot boş mu? (saat başına 1 randevu)
      if (!SlotService.isSlotFree(date, hour)) {
        return {
          valid: false,
          error: 'Bu saat dolu. Lütfen başka bir saat seçin.',
          suggestAlternatives: true
        };
      }

      // KURAL 3: Teslim/Gönderi ise - Global limit kontrolü (max 3/gün, ikisi toplamda)
      const isDeliveryOrShipping = (
        appointmentType === CONFIG.APPOINTMENT_TYPES.DELIVERY || appointmentType === 'delivery' ||
        appointmentType === CONFIG.APPOINTMENT_TYPES.SHIPPING || appointmentType === 'shipping'
      );

      if (isDeliveryOrShipping) {
        const deliveryCount = AvailabilityService.getDeliveryCount(date);

        if (deliveryCount >= 3) {
          return {
            valid: false,
            error: 'Bu gün için teslim/gönderi randevu limiti doldu (max 3). Lütfen başka bir gün seçin.',
            isDayMaxed: true
          };
        }

        // KURAL 4: Teslim/Gönderi ise - Personel limiti kontrolü (max 2/gün/personel)
        if (staffId) {
          const staffDeliveryCount = AvailabilityService.getDeliveryCountByStaff(date, staffId);

          if (staffDeliveryCount >= 2) {
            return {
              valid: false,
              error: 'Bu personel için günlük teslim/gönderi randevu limiti doldu (max 2). Lütfen başka bir personel veya gün seçin.'
            };
          }
        }
      }

      // Tüm kontroller geçildi
      return { valid: true };

    } catch (error) {
      log.error('validateReservation error:', error);
      return {
        valid: false,
        error: CONFIG.ERROR_MESSAGES.SERVER_ERROR
      };
    }
  }
};
