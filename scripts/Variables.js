/**
 * Variables.js
 *
 * Merkezi Mesaj Değişkenleri
 *
 * Bu modül WhatsApp ve Mail mesajlarında kullanılan değişkenleri
 * tek bir yerden tanımlar. Hem WhatsApp hem Mail aynı değişkenleri kullanır.
 *
 * Format: {{degisken_adi}} - küçük harf, alt çizgi ile
 */

// ==================== MESSAGE VARIABLES ====================

/**
 * Tüm mesaj kanalları için merkezi değişken tanımları
 *
 * Her değişken için:
 * - key: Template'de kullanılan placeholder ({{key}})
 * - label: Admin panel'de gösterilen açıklama
 * - getValue: Randevu verisinden değeri döndüren fonksiyon
 *
 * v3.9.61: CRITICAL FIX - "const" yerine "var" kullanılmalı!
 * Google Apps Script V8'de "const" dosya-scoped, "var" global-scoped.
 * Bu değişken Mail.js ve WhatsApp.js'den erişildiği için global olmalı.
 */
var MESSAGE_VARIABLES = {
  musteri: {
    label: 'customer: Ahmet Yılmaz',
    getValue: function(data) {
      // Ad ve soyad birleşik olarak geliyorsa direkt döndür
      if (data.customerName && data.customerName.includes(' ')) {
        return data.customerName;
      }
      // Ad ve soyad ayrı geliyorsa birleştir
      var name = data.customerName || data.name || '';
      var surname = data.customerSurname || data.surname || '';
      if (name && surname) {
        return name + ' ' + surname;
      }
      return name || surname || '';
    }
  },

  musteri_tel: {
    label: 'customer phone: +905323112522',
    getValue: function(data) {
      return formatPhoneWithCountryCode(data.customerPhone || data.phone);
    }
  },

  musteri_mail: {
    label: 'customer email: ahmet@email.com',
    getValue: function(data) {
      return data.customerEmail || data.email || '';
    }
  },

  randevu_tarihi: {
    label: 'appointment date: 25 December 2025, Friday',
    getValue: function(data) {
      var dateStr = data.date || data.appointmentDate;
      if (!dateStr) return '';

      var turkishMonths = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
                           'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
      var days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

      // "14 Aralık 2025" formatını parse et
      var parts = String(dateStr).split(' ');
      if (parts.length >= 3) {
        var day = parseInt(parts[0]);
        var monthName = parts[1];
        var year = parseInt(parts[2]);
        var monthIndex = turkishMonths.indexOf(monthName);

        if (!isNaN(day) && monthIndex >= 0 && !isNaN(year)) {
          var d = new Date(year, monthIndex, day);
          var dayName = days[d.getDay()];
          return day + ' ' + monthName + ' ' + year + ', ' + dayName;
        }
      }

      // "2025-12-14" ISO formatı
      if (dateStr.includes('-') && dateStr.length === 10) {
        var d = new Date(dateStr + 'T00:00:00');
        if (!isNaN(d.getTime())) {
          return d.getDate() + ' ' + turkishMonths[d.getMonth()] + ' ' + d.getFullYear() + ', ' + days[d.getDay()];
        }
      }

      return dateStr;
    }
  },

  randevu_saati: {
    label: 'appointment time: 14:00',
    getValue: function(data) {
      return data.time || data.appointmentTime || data.startTime || '';
    }
  },

  randevu_ek_bilgi: {
    label: 'appointment note: customer note goes here',
    getValue: function(data) {
      return data.customerNote || data.extraInfo || data.description || data.notes || data.note || '';
    }
  },

  personel: {
    label: 'staff: Mehmet Kaya',
    getValue: function(data) {
      return data.staffName || data.assignedStaff || data.linkedStaffName || '';
    }
  },

  personel_id: {
    label: 'staff id: 123',
    getValue: function(data) {
      return data.staffId || data.linkedStaffId || data.assignedStaffId || '';
    }
  },

  personel_tel: {
    label: 'staff phone: +905551234567',
    getValue: function(data) {
      return formatPhoneWithCountryCode(data.staffPhone);
    }
  },

  personel_mail: {
    label: 'staff email: mehmet@rolex.com',
    getValue: function(data) {
      return data.staffEmail || '';
    }
  },

  randevu_turu: {
    label: 'appointment type: meeting',
    getValue: function(data) {
      var type = data.appointmentType || data.type || '';
      var typeLabels = {
        'meeting': 'Görüşme',
        'gorisme': 'Görüşme',
        'delivery': 'Teslim',
        'teslim': 'Teslim',
        'technical': 'Teknik Servis',
        'teknik': 'Teknik Servis',
        'teknik_servis': 'Teknik Servis',
        'service': 'Teknik Servis',
        'test': 'Test Randevusu'
      };
      return typeLabels[type.toLowerCase()] || type;
    }
  },

  randevu_profili: {
    label: 'appointment profile: general',
    getValue: function(data) {
      var profile = data.profile || data.linkType || '';
      var profileLabels = {
        'w': 'Walk-in',
        'walkin': 'Walk-in',
        'g': 'Genel',
        'genel': 'Genel',
        's': 'Bireysel',
        'staff': 'Bireysel',
        'personel': 'Bireysel',
        'b': 'Mağaza',
        'boutique': 'Mağaza',
        'm': 'Yönetim',
        'management': 'Yönetim',
        'vip': 'Özel Müşteri',
        'v': 'Özel Müşteri'
      };
      return profileLabels[profile.toLowerCase()] || profile;
    }
  },

  profil_sahibi: {
    label: 'profile owner: Serdar Benli',
    getValue: function(data) {
      return data.linkedStaffName || data.staffName || data.profileOwner || '';
    }
  }
};

// ==================== TRIGGER DEFINITIONS ====================

/**
 * Merkezi trigger tanımları - Mail ve WhatsApp için ortak
 * v3.9.72: Global trigger listesi
 */
// Event-based triggers (for real-time notifications)
var MESSAGE_TRIGGERS = {
  'APPOINTMENT_CREATE': 'create',
  'APPOINTMENT_CANCEL': 'cancel',
  'APPOINTMENT_UPDATE': 'update',
  'STAFF_ASSIGNED': 'assign'
};

// Time-based trigger (for scheduled notifications - runs at 10:00 AM TR)
var TIME_BASED_TRIGGER = 'reminder';

/**
 * Admin panel için trigger listesini döndür
 * @returns {Object} { success: true, data: { key: label, ... } }
 */
function getTriggers() {
  return { success: true, data: MESSAGE_TRIGGERS };
}

// ==================== RECIPIENT DEFINITIONS ====================

/**
 * Merkezi alıcı (recipient) tanımları - Mail ve WhatsApp için ortak
 * v3.9.73: Global recipient listesi
 *
 * Kategoriler:
 * - Bireysel: Randevuyla ilişkili kişiler
 * - Rol bazlı: Belirli role sahip personeller
 * - Dinamik: Koşula bağlı gruplar
 */
var MESSAGE_RECIPIENTS = {
  // Individual recipients
  'admin': 'all admins',
  'customer': 'customer',
  'staff': 'assigned staff',

  // Dynamic recipients - Today
  'today_customers': "today's customers",
  'today_staffs': "today's staff",

  // Dynamic recipients - Tomorrow
  'tomorrow_customers': "tomorrow's customers",
  'tomorrow_staffs': "tomorrow's staff"
};

/**
 * Admin panel için recipient listesini döndür
 * @returns {Object} { success: true, data: { key: label, ... } }
 */
function getRecipients() {
  return { success: true, data: MESSAGE_RECIPIENTS };
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Telefon numarasını +90XXXXXXXXXX formatında döndür (boşluksuz)
 * @param {string} phone - Telefon numarası
 * @returns {string} Formatlanmış telefon (+905323112522)
 */
function formatPhoneWithCountryCode(phone) {
  if (!phone) return '';

  // Sadece rakamları al
  var digits = String(phone).replace(/\D/g, '');

  // Boşsa döndür
  if (!digits) return '';

  // Türkiye numarası kontrolü
  if (digits.startsWith('90') && digits.length >= 12) {
    // 905XXXXXXXXX formatında, olduğu gibi döndür
    return '+' + digits;
  } else if (digits.startsWith('0') && digits.length === 11) {
    // 05XXXXXXXXX -> +905XXXXXXXXX
    return '+90' + digits.substring(1);
  } else if (digits.length === 10 && digits.startsWith('5')) {
    // 5XXXXXXXXX -> +905XXXXXXXXX
    return '+90' + digits;
  }

  // Diğer formatlar: + ile döndür
  if (phone.startsWith('+')) {
    return phone.replace(/\s/g, ''); // Boşlukları kaldır
  }

  return '+' + digits;
}

/**
 * Mesaj içindeki değişkenleri gerçek değerlerle değiştir
 * @param {string} text - Değişken içeren metin
 * @param {Object} data - Randevu verisi
 * @returns {string} Değişkenleri değiştirilmiş metin
 */
function replaceMessageVariables(text, data) {
  if (!text) return '';

  var result = text;

  // Tüm tanımlı değişkenleri değiştir
  for (var key in MESSAGE_VARIABLES) {
    var pattern = new RegExp('\\{\\{' + key + '\\}\\}', 'gi');
    var value = MESSAGE_VARIABLES[key].getValue(data);
    result = result.replace(pattern, value || '');
  }

  return result;
}

/**
 * Admin panel için değişken listesini döndür
 * @returns {Object} { success: true, data: { key: label, ... } }
 */
function getMessageVariables() {
  var options = {};
  for (var key in MESSAGE_VARIABLES) {
    options[key] = MESSAGE_VARIABLES[key].label;
  }
  return { success: true, data: options };
}

/**
 * Belirli bir değişkenin değerini al
 * @param {string} key - Değişken key'i
 * @param {Object} data - Randevu verisi
 * @returns {string} Değişken değeri
 *
 * v3.9.61: const→var fix + direct fallback for critical fields
 */
function getVariableValue(key, data) {
  if (!data) return '';

  // v3.9.61: FALLBACK - MESSAGE_VARIABLES erişilemezse direkt data'dan al
  // Bu, Google Apps Script'te const scope sorununun kalıcı çözümü
  var DIRECT_FALLBACK = {
    'randevu_tarihi': function() {
      var dateStr = data.date || data.appointmentDate || data.formattedDate || '';
      if (!dateStr) return '';
      // Zaten formatlı ise döndür
      if (dateStr.includes('Ocak') || dateStr.includes('Şubat') || dateStr.includes('Mart') ||
          dateStr.includes('Nisan') || dateStr.includes('Mayıs') || dateStr.includes('Haziran') ||
          dateStr.includes('Temmuz') || dateStr.includes('Ağustos') || dateStr.includes('Eylül') ||
          dateStr.includes('Ekim') || dateStr.includes('Kasım') || dateStr.includes('Aralık')) {
        return dateStr;
      }
      // ISO formatı parse et
      if (dateStr.includes('-') && dateStr.length >= 10) {
        var turkishMonths = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
                             'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
        var days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
        var d = new Date(dateStr.substring(0, 10) + 'T12:00:00');
        if (!isNaN(d.getTime())) {
          return d.getDate() + ' ' + turkishMonths[d.getMonth()] + ' ' + d.getFullYear() + ', ' + days[d.getDay()];
        }
      }
      return dateStr;
    },
    'randevu_saati': function() {
      return data.time || data.appointmentTime || data.startTime || '';
    },
    'randevu_profili': function() {
      var profile = data.profile || data.profileName || data.linkType || '';
      var profileLabels = {
        'w': 'Walk-in', 'walkin': 'Walk-in',
        'g': 'Genel', 'genel': 'Genel',
        's': 'Bireysel', 'staff': 'Bireysel', 'personel': 'Bireysel',
        'b': 'Mağaza', 'boutique': 'Mağaza', 'butik': 'Mağaza',
        'm': 'Yönetim', 'management': 'Yönetim', 'yonetim': 'Yönetim',
        'vip': 'Özel Müşteri', 'v': 'Özel Müşteri'
      };
      return profileLabels[String(profile).toLowerCase()] || profile || '';
    },
    'musteri': function() {
      if (data.customerName && String(data.customerName).includes(' ')) {
        return data.customerName;
      }
      var name = data.customerName || data.name || '';
      var surname = data.customerSurname || data.surname || '';
      if (name && surname) return name + ' ' + surname;
      return name || surname || '';
    },
    'personel': function() {
      return data.staffName || data.assignedStaff || data.linkedStaffName || '';
    },
    'randevu_turu': function() {
      var type = data.appointmentType || data.type || '';
      var typeLabels = {
        'meeting': 'Görüşme', 'gorisme': 'Görüşme',
        'delivery': 'Teslim', 'teslim': 'Teslim',
        'technical': 'Teknik Servis', 'teknik': 'Teknik Servis',
        'service': 'Teknik Servis', 'test': 'Test Randevusu'
      };
      return typeLabels[String(type).toLowerCase()] || type || '';
    }
  };

  // Önce MESSAGE_VARIABLES'dan dene (v3.9.61: artık var ile tanımlı)
  try {
    if (MESSAGE_VARIABLES && MESSAGE_VARIABLES[key] && MESSAGE_VARIABLES[key].getValue) {
      var value = MESSAGE_VARIABLES[key].getValue(data);
      if (value) return value;
    }
  } catch (e) {
    // MESSAGE_VARIABLES erişilemedi, fallback kullan
  }

  // Fallback: Direkt data'dan al
  if (DIRECT_FALLBACK[key]) {
    try {
      return DIRECT_FALLBACK[key]() || '';
    } catch (e) {
      return '';
    }
  }

  return '';
}
