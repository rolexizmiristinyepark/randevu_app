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
   * v3.5: Tüm kurallar profil ayarlarından alınır
   * @param {Object} payload - {date, hour, appointmentType, staffId, profil, isVipLink, linkType}
   * @returns {{valid: boolean, error?: string, isDayMaxed?: boolean, suggestAlternatives?: boolean}}
   */
  validateReservation: function(payload) {
    // v3.9: profil parametresi eklendi (yeni sistem), linkType legacy uyumluluk için
    const { date, hour, appointmentType, staffId, profil, isVipLink, linkType } = payload;

    try {
      // v3.9: Önce profil'den al, yoksa linkType'tan (legacy uyumluluk)
      const profilAyarlari = profil
        ? ProfilAyarlariService.get(profil)
        : getProfilAyarlariByLinkType(linkType);

      log.info('RAW profilAyarlari:', JSON.stringify(profilAyarlari));

      const maxSlotAppointment = profilAyarlari?.maxSlotAppointment || 1;
      const maxDailyDelivery = profilAyarlari?.maxDailyDelivery || 3;

      log.info('Validation with profile settings:', {
        profil: profil || linkType,
        maxSlotAppointment,
        maxDailyDelivery,
        profilKey: profilAyarlari?.code
      });

      // YÖNETİM RANDEVUSU EXCEPTION: Yönetim randevuları için tüm kontrolleri bypass et
      if (appointmentType === CONFIG.APPOINTMENT_TYPES.MANAGEMENT || appointmentType === 'management') {
        return { valid: true };
      }

      // KURAL 1: Slot evreninde mi? (11-20 arası tam saat)
      if (!SLOT_UNIVERSE.includes(parseInt(hour))) {
        return {
          valid: false,
          error: `Geçersiz saat. Sadece ${SLOT_UNIVERSE[0]}:00-${SLOT_UNIVERSE[SLOT_UNIVERSE.length - 1]}:00 arası randevu alınabilir.`
        };
      }

      // KURAL 2: Slot doluluk kontrolü - profil ayarına göre (maxSlotAppointment)
      // maxSlotAppointment = 0 → sınırsız
      // maxSlotAppointment = 1 → saat başına 1 randevu
      // maxSlotAppointment = 2 → saat başına 2 randevu
      if (maxSlotAppointment > 0) {
        const slotCount = SlotService.getSlotAppointmentCount(date, hour);
        log.info('Slot check:', { date, hour, slotCount, maxSlotAppointment, willBlock: slotCount >= maxSlotAppointment });
        if (slotCount >= maxSlotAppointment) {
          return {
            valid: false,
            error: `Bu saat dolu (${slotCount}/${maxSlotAppointment}). Lütfen başka bir saat seçin.`,
            suggestAlternatives: true
          };
        }
      }

      // KURAL 3: Teslim/Gönderi günlük limit kontrolü - profil ayarına göre (maxDailyDelivery)
      // maxDailyDelivery = 0 → sınırsız
      // maxDailyDelivery > 0 → günlük limit (global)
      const isDeliveryOrShipping = (
        appointmentType === CONFIG.APPOINTMENT_TYPES.DELIVERY || appointmentType === 'delivery' ||
        appointmentType === CONFIG.APPOINTMENT_TYPES.SHIPPING || appointmentType === 'shipping'
      );

      if (isDeliveryOrShipping && maxDailyDelivery > 0) {
        const deliveryCount = AvailabilityService.getDeliveryCount(date);

        if (deliveryCount >= maxDailyDelivery) {
          return {
            valid: false,
            error: `Bu gün için teslim/gönderi randevu limiti doldu (max ${maxDailyDelivery}). Lütfen başka bir gün seçin.`,
            isDayMaxed: true
          };
        }
      }

      // KURAL 4: Personel bazlı günlük teslim/gönderi limiti - profil ayarına göre (maxDailyPerStaff)
      // maxDailyPerStaff = 0 → sınırsız
      // maxDailyPerStaff > 0 → personel başına günlük limit
      const maxDailyPerStaff = profilAyarlari?.maxDailyPerStaff || 0;

      if (isDeliveryOrShipping && maxDailyPerStaff > 0 && staffId) {
        const staffDeliveryCount = AvailabilityService.getDeliveryCountByStaff(date, staffId);

        if (staffDeliveryCount >= maxDailyPerStaff) {
          return {
            valid: false,
            error: `Bu personelin günlük teslim/gönderi limiti doldu (max ${maxDailyPerStaff}). Lütfen başka bir gün veya personel seçin.`,
            isDayMaxed: true
          };
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
