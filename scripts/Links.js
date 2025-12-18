/**
 * Links.js - v3.3
 *
 * URL Yapısı:
 * - #w, #g, #b, #m → idKontrol: false (direkt profil)
 * - #s/{id}, #v/{id} → idKontrol: true (personel kontrolü)
 *
 * Dependencies: Config.js (PROFIL_AYARLARI, PROFILE_CODE_MAP), Staff.js
 */

// ==================== URL RESOLVER ====================
const UrlResolver = {
  /**
   * Hash parse et
   */
  parseHash: function(hash) {
    if (!hash || hash.length < 2) return { code: null, staffId: null };

    var clean = hash.substring(1); // # kaldır
    var code = clean.charAt(0).toLowerCase();
    var staffId = (clean.length > 2 && clean.charAt(1) === '/') ? clean.substring(2) : null;

    return { code: code, staffId: staffId };
  },

  /**
   * URL çözümle
   */
  resolve: function(hash) {
    var parsed = this.parseHash(hash);
    if (!parsed.code) return { success: false, error: 'Hash bulunamadı' };

    // Profil adını bul
    var profilAdi = PROFILE_CODE_MAP[parsed.code];
    if (!profilAdi) return { success: false, error: 'Geçersiz kod: ' + parsed.code };

    // Profil ayarlarını al
    var ayar = PROFIL_AYARLARI[profilAdi];
    if (!ayar) return { success: false, error: 'Profil bulunamadı: ' + profilAdi };

    var result = {
      success: true,
      code: parsed.code,
      profil: profilAdi,
      ayarlar: ayar
    };

    // idKontrol: true ise personel kontrolü yap
    if (ayar.idKontrol) {
      if (!parsed.staffId) {
        return { success: false, error: 'Personel ID gerekli' };
      }

      var staff = StaffService.getById(parsed.staffId);
      if (!staff || !staff.active) {
        return { success: false, error: 'Personel bulunamadı' };
      }

      // Rol kontrolü
      if (ayar.expectedRole && staff.role !== ayar.expectedRole) {
        return { success: false, error: 'Personel rolü uyuşmuyor' };
      }

      result.staff = {
        id: staff.id,
        name: staff.name,
        role: staff.role,
        email: staff.email
      };
    }

    return result;
  },

  /**
   * URL oluştur
   */
  buildUrl: function(code, staffId) {
    var profilAdi = PROFILE_CODE_MAP[code];
    if (!profilAdi) return null;

    var ayar = PROFIL_AYARLARI[profilAdi];
    if (ayar.idKontrol && staffId) {
      return '#' + code + '/' + staffId;
    }
    return '#' + code;
  }
};

// ==================== LINK AGGREGATOR ====================
const LinkAggregator = {
  /**
   * Tüm linkleri getir
   */
  getAllLinks: function() {
    var result = {
      profiles: {},
      staff: { list: [] },
      vip: { list: [] }
    };

    // Profilleri ekle
    for (var code in PROFILE_CODE_MAP) {
      var profilAdi = PROFILE_CODE_MAP[code];
      var ayar = PROFIL_AYARLARI[profilAdi];

      if (!ayar.idKontrol) {
        result.profiles[code] = {
          code: code,
          profil: profilAdi,
          url: '#' + code
        };
      }
    }

    // Personelleri listele
    var allStaff = StaffService.getAll().filter(function(s) { return s.active; });

    allStaff.forEach(function(s) {
      var info = {
        id: s.id,
        name: s.name,
        url: s.role === 'management' ? '#v/' + s.id : '#s/' + s.id
      };

      if (s.role === 'management') {
        result.vip.list.push(info);
      } else {
        result.staff.list.push(info);
      }
    });

    return result;
  }
};

// ==================== LEGACY SUPPORT ====================
const LegacyResolver = {
  resolve: function(id) {
    if (!id) return { success: false, error: 'ID gerekli' };

    var staff = StaffService.getById(id);
    if (staff && staff.active) {
      return {
        success: true,
        profil: staff.role === 'management' ? 'vip' : 'personel',
        staff: { id: staff.id, name: staff.name, role: staff.role }
      };
    }

    return { success: false, error: 'ID bulunamadı' };
  }
};

// ==================== STANDALONE FUNCTIONS ====================
function resolveUrl(hash) { return UrlResolver.resolve(hash); }
function resolveId(id) { return LegacyResolver.resolve(id); }
function getAllLinks() { return LinkAggregator.getAllLinks(); }
function buildProfileUrl(code, staffId) { return UrlResolver.buildUrl(code, staffId); }
