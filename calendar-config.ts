// ==================== CALENDAR & ICS CONFIGURATION ====================
// Single source of truth for appointment type names and ICS templates
// Used by both frontend (calendar-integration.ts) and backend (apps-script-backend.js)
// ⚠️ Backend must manually sync these constants (Apps Script can't import TS)

export const CALENDAR_CONFIG = {
    // Appointment type display names (customer-facing)
    // v3.9.19d: "TYPE Randevusu" formatı
    APPOINTMENT_TYPE_NAMES: {
        'delivery': 'Teslim Randevusu',
        'service': 'Servis Randevusu',
        'consultation': 'Danışmanlık Randevusu',
        'general': 'Görüşme Randevusu',
        'meeting': 'Görüşme Randevusu',      // Alias for 'general'
        'management': 'Yönetim Randevusu',
        'shipping': 'Gönderi Randevusu'
    },

    // ICS file metadata
    ICS_METADATA: {
        PRODID: '-//Rolex İzmir İstinyepark//Randevu Sistemi//TR',
        ORGANIZER_NAME: 'Rolex İzmir İstinyepark',
        SECTION_TITLE: 'RANDEVU BİLGİLERİ'
    },

    // ICS description field labels
    ICS_LABELS: {
        CONTACT_PERSON: 'İlgili',
        CONTACT: 'İletişim',
        EMAIL: 'E-posta',
        DATE: 'Tarih',
        TIME: 'Saat',
        SUBJECT: 'Konu',
        NOTES: 'Ek Bilgi'
    },

    // Dynamic reminders based on appointment type
    ICS_REMINDERS: {
        ON_TIME: 'Randevunuza zamanında gelmenizi rica ederiz.',
        BRING_ID: '', // Kaldırıldı - v3.9.19
        BRING_WATCH: 'Lütfen saatinizi ve ilgili belgeleri yanınızda getirin.'
    }
};

// Convenience export for appointment type names
export const APPOINTMENT_TYPE_NAMES = CALENDAR_CONFIG.APPOINTMENT_TYPE_NAMES;
