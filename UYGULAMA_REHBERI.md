# RANDEVU SİSTEMİ - DETAYLI UYGULAMA REHBERİ

**Tarih:** 2 Aralık 2025
**Referans:** GUNCELLEME_PLANI.md v3.2
**Durum:** Uygulama Aşaması

---

## İÇİNDEKİLER

1. [FAZ 1: Temel Altyapı](#faz-1-temel-altyapı)
2. [FAZ 2: Profil Sistemi](#faz-2-profil-sistemi)
3. [FAZ 3: Admin Panel Sekmeleri](#faz-3-admin-panel-sekmeleri)
4. [FAZ 4: WhatsApp Sekmesi](#faz-4-whatsapp-sekmesi)
5. [FAZ 5: Yetki Sistemi](#faz-5-yetki-sistemi)

---

# FAZ 1: TEMEL ALTYAPI

## 1.1 Personel Tablosu Güncellemesi

### Google Sheets Yapısı (Staff Sheet)

Mevcut sütunları güncelle:

| Sütun | Eski | Yeni | Açıklama |
|-------|------|------|----------|
| A | id (number) | id (string) | Güvenli 8 karakter ID |
| B | name | name | Değişmedi |
| C | - | email | YENİ: Login için |
| D | - | phone | YENİ: İletişim |
| E | - | password | YENİ: SHA-256 hash |
| F | - | role | YENİ: sales/management |
| G | active | isAdmin | YENİ: Admin yetkisi |
| H | - | active | Aktif/Pasif |

### Backend Kodu: Staff.js

```javascript
// scripts/Staff.js

var Staff = {
  SHEET_NAME: 'Staff',

  // Sütun indeksleri (0-based)
  COLUMNS: {
    ID: 0,
    NAME: 1,
    EMAIL: 2,
    PHONE: 3,
    PASSWORD: 4,
    ROLE: 5,
    IS_ADMIN: 6,
    ACTIVE: 7
  },

  /**
   * Güvenli ID üretimi
   * Format: İsim baş harf + 6 random rakam + Soyisim baş harf (shuffled)
   */
  generateSecureId: function(name) {
    var parts = name.trim().split(' ');
    var first = parts[0].charAt(0).toLowerCase();
    var last = parts.length > 1
      ? parts[parts.length - 1].charAt(0).toLowerCase()
      : first;

    // 6 random rakam
    var digits = Math.floor(100000 + Math.random() * 900000).toString();

    // 8 karakterlik array: 2 harf + 6 rakam
    var chars = [first, last].concat(digits.split(''));

    // Fisher-Yates shuffle
    for (var i = chars.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = chars[i];
      chars[i] = chars[j];
      chars[j] = temp;
    }

    return chars.join('');
  },

  /**
   * Şifre hash'leme (SHA-256)
   */
  hashPassword: function(plainPassword) {
    var hash = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      plainPassword,
      Utilities.Charset.UTF_8
    );
    return hash.map(function(b) {
      return ('0' + (b & 0xFF).toString(16)).slice(-2);
    }).join('');
  },

  /**
   * Rastgele şifre üretimi (8 karakter)
   */
  generatePassword: function() {
    // Karıştırılabilecek karakterler çıkarıldı (0,O,1,l,I)
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    var password = '';
    for (var i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  },

  /**
   * Tüm personeli getir
   */
  getAll: function() {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.SHEET_NAME);
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var staff = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (row[this.COLUMNS.ID]) {
        staff.push({
          id: row[this.COLUMNS.ID],
          name: row[this.COLUMNS.NAME],
          email: row[this.COLUMNS.EMAIL],
          phone: row[this.COLUMNS.PHONE],
          role: row[this.COLUMNS.ROLE],
          isAdmin: row[this.COLUMNS.IS_ADMIN] === true || row[this.COLUMNS.IS_ADMIN] === 'TRUE',
          active: row[this.COLUMNS.ACTIVE] === true || row[this.COLUMNS.ACTIVE] === 'TRUE'
        });
      }
    }

    return staff;
  },

  /**
   * ID ile personel getir
   */
  getById: function(id) {
    var allStaff = this.getAll();
    for (var i = 0; i < allStaff.length; i++) {
      if (allStaff[i].id === id) {
        return allStaff[i];
      }
    }
    return null;
  },

  /**
   * Email ile personel getir
   */
  getByEmail: function(email) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.SHEET_NAME);
    var data = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (data[i][this.COLUMNS.EMAIL] === email) {
        return {
          id: data[i][this.COLUMNS.ID],
          name: data[i][this.COLUMNS.NAME],
          email: data[i][this.COLUMNS.EMAIL],
          phone: data[i][this.COLUMNS.PHONE],
          password: data[i][this.COLUMNS.PASSWORD],
          role: data[i][this.COLUMNS.ROLE],
          isAdmin: data[i][this.COLUMNS.IS_ADMIN] === true,
          active: data[i][this.COLUMNS.ACTIVE] === true,
          rowIndex: i + 1
        };
      }
    }
    return null;
  },

  /**
   * Role göre personel listesi
   */
  getByRole: function(role) {
    var allStaff = this.getAll();
    return allStaff.filter(function(s) {
      return s.role === role && s.active;
    });
  },

  /**
   * Yeni personel ekle
   */
  create: function(data) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.SHEET_NAME);

    // ID üret
    var id = this.generateSecureId(data.name);

    // Şifre üret ve hash'le
    var plainPassword = this.generatePassword();
    var hashedPassword = this.hashPassword(plainPassword);

    // Satır ekle
    sheet.appendRow([
      id,
      data.name,
      data.email,
      data.phone || '',
      hashedPassword,
      data.role || 'sales',
      data.isAdmin || false,
      true // active
    ]);

    return {
      success: true,
      id: id,
      plainPassword: plainPassword // Email ile gönderilecek
    };
  },

  /**
   * Personel güncelle
   */
  update: function(id, data) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.SHEET_NAME);
    var dataRange = sheet.getDataRange().getValues();

    for (var i = 1; i < dataRange.length; i++) {
      if (dataRange[i][this.COLUMNS.ID] === id) {
        var rowIndex = i + 1;

        if (data.name) sheet.getRange(rowIndex, this.COLUMNS.NAME + 1).setValue(data.name);
        if (data.email) sheet.getRange(rowIndex, this.COLUMNS.EMAIL + 1).setValue(data.email);
        if (data.phone) sheet.getRange(rowIndex, this.COLUMNS.PHONE + 1).setValue(data.phone);
        if (data.role) sheet.getRange(rowIndex, this.COLUMNS.ROLE + 1).setValue(data.role);
        if (typeof data.isAdmin !== 'undefined') sheet.getRange(rowIndex, this.COLUMNS.IS_ADMIN + 1).setValue(data.isAdmin);
        if (typeof data.active !== 'undefined') sheet.getRange(rowIndex, this.COLUMNS.ACTIVE + 1).setValue(data.active);

        return { success: true };
      }
    }

    return { success: false, error: 'Personel bulunamadı' };
  },

  /**
   * Şifre sıfırla
   */
  resetPassword: function(email) {
    var staff = this.getByEmail(email);
    if (!staff) {
      return { success: false, error: 'Email bulunamadı' };
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.SHEET_NAME);

    // Yeni şifre üret
    var plainPassword = this.generatePassword();
    var hashedPassword = this.hashPassword(plainPassword);

    // Güncelle
    sheet.getRange(staff.rowIndex, this.COLUMNS.PASSWORD + 1).setValue(hashedPassword);

    return {
      success: true,
      name: staff.name,
      email: staff.email,
      plainPassword: plainPassword
    };
  }
};
```

---

## 1.2 Auth Sistemi (Email + Password)

### Backend Kodu: Auth.js

```javascript
// scripts/Auth.js

var Auth = {
  SESSION_DURATION: 10 * 60 * 1000, // 10 dakika (ms)

  /**
   * Login işlemi
   */
  login: function(email, password) {
    // Email ile personeli bul
    var staff = Staff.getByEmail(email);

    if (!staff) {
      return { success: false, error: 'Geçersiz email veya şifre' };
    }

    if (!staff.active) {
      return { success: false, error: 'Hesabınız pasif durumda' };
    }

    // Şifre kontrolü
    var hashedInput = Staff.hashPassword(password);
    if (hashedInput !== staff.password) {
      return { success: false, error: 'Geçersiz email veya şifre' };
    }

    // Session token üret
    var sessionToken = Utilities.getUuid();
    var expiresAt = new Date().getTime() + this.SESSION_DURATION;

    // Session'ı kaydet (PropertiesService)
    var sessions = this.getSessions();
    sessions[sessionToken] = {
      staffId: staff.id,
      email: staff.email,
      name: staff.name,
      role: staff.role,
      isAdmin: staff.isAdmin,
      expiresAt: expiresAt
    };
    this.saveSessions(sessions);

    return {
      success: true,
      token: sessionToken,
      staff: {
        id: staff.id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        isAdmin: staff.isAdmin
      },
      expiresAt: expiresAt
    };
  },

  /**
   * Session doğrula
   */
  validateSession: function(token) {
    if (!token) {
      return { valid: false, error: 'Token gerekli' };
    }

    var sessions = this.getSessions();
    var session = sessions[token];

    if (!session) {
      return { valid: false, error: 'Geçersiz session' };
    }

    // Süre kontrolü
    if (new Date().getTime() > session.expiresAt) {
      delete sessions[token];
      this.saveSessions(sessions);
      return { valid: false, error: 'Session süresi doldu' };
    }

    // Session'ı yenile
    session.expiresAt = new Date().getTime() + this.SESSION_DURATION;
    sessions[token] = session;
    this.saveSessions(sessions);

    return {
      valid: true,
      staff: {
        id: session.staffId,
        name: session.name,
        email: session.email,
        role: session.role,
        isAdmin: session.isAdmin
      },
      expiresAt: session.expiresAt
    };
  },

  /**
   * Logout
   */
  logout: function(token) {
    var sessions = this.getSessions();
    if (sessions[token]) {
      delete sessions[token];
      this.saveSessions(sessions);
    }
    return { success: true };
  },

  /**
   * Şifre sıfırlama
   */
  resetPassword: function(email) {
    var result = Staff.resetPassword(email);

    if (!result.success) {
      return result;
    }

    // Email gönder
    try {
      var emailBody = 'Merhaba ' + result.name + ',\n\n' +
        'Randevu sistemi yeni şifreniz:\n\n' +
        'Email: ' + result.email + '\n' +
        'Şifre: ' + result.plainPassword + '\n\n' +
        'Giriş: https://rolexizmiristinyepark.github.io/randevu_app/admin.html\n\n' +
        'Güvenliğiniz için şifrenizi kimseyle paylaşmayın.\n\n' +
        'Rolex İzmir İstinyepark';

      MailApp.sendEmail({
        to: result.email,
        subject: 'Randevu Sistemi - Yeni Şifreniz',
        body: emailBody
      });

      return { success: true, message: 'Yeni şifre email adresinize gönderildi' };
    } catch (e) {
      return { success: false, error: 'Email gönderilemedi: ' + e.message };
    }
  },

  // Helper fonksiyonlar
  getSessions: function() {
    var props = PropertiesService.getScriptProperties();
    var sessionsJson = props.getProperty('sessions') || '{}';
    return JSON.parse(sessionsJson);
  },

  saveSessions: function(sessions) {
    var props = PropertiesService.getScriptProperties();
    props.setProperty('sessions', JSON.stringify(sessions));
  },

  // Eski session'ları temizle (günde 1 çalıştır)
  cleanupSessions: function() {
    var sessions = this.getSessions();
    var now = new Date().getTime();
    var cleaned = 0;

    for (var token in sessions) {
      if (sessions[token].expiresAt < now) {
        delete sessions[token];
        cleaned++;
      }
    }

    this.saveSessions(sessions);
    return { cleaned: cleaned };
  }
};
```

### Frontend Kodu: auth.js

```javascript
// js/auth.js

const AuthManager = {
  SESSION_KEY: 'admin_session',

  /**
   * Login
   */
  async login(email, password) {
    try {
      const response = await apiCall('login', { email, password });

      if (response.success) {
        // Session'ı localStorage'a kaydet
        localStorage.setItem(this.SESSION_KEY, JSON.stringify({
          token: response.token,
          staff: response.staff,
          expiresAt: response.expiresAt
        }));

        return { success: true, staff: response.staff };
      } else {
        return { success: false, error: response.error };
      }
    } catch (e) {
      return { success: false, error: 'Bağlantı hatası' };
    }
  },

  /**
   * Session kontrolü
   */
  async checkSession() {
    const sessionData = localStorage.getItem(this.SESSION_KEY);
    if (!sessionData) {
      return null;
    }

    const session = JSON.parse(sessionData);

    // Lokal süre kontrolü
    if (Date.now() > session.expiresAt) {
      this.logout();
      return null;
    }

    // Backend'den doğrula
    try {
      const response = await apiCall('validateSession', { token: session.token });

      if (response.valid) {
        // Süreyi güncelle
        session.expiresAt = response.expiresAt;
        localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
        return session.staff;
      } else {
        this.logout();
        return null;
      }
    } catch (e) {
      // Offline durumda lokal session'a güven
      return session.staff;
    }
  },

  /**
   * Logout
   */
  async logout() {
    const sessionData = localStorage.getItem(this.SESSION_KEY);
    if (sessionData) {
      const session = JSON.parse(sessionData);
      try {
        await apiCall('logout', { token: session.token });
      } catch (e) {
        // Ignore
      }
    }

    localStorage.removeItem(this.SESSION_KEY);
    window.location.href = 'admin.html';
  },

  /**
   * Şifre sıfırlama
   */
  async resetPassword(email) {
    try {
      const response = await apiCall('resetPassword', { email });
      return response;
    } catch (e) {
      return { success: false, error: 'Bağlantı hatası' };
    }
  },

  /**
   * Mevcut kullanıcıyı getir
   */
  getCurrentUser() {
    const sessionData = localStorage.getItem(this.SESSION_KEY);
    if (!sessionData) return null;

    const session = JSON.parse(sessionData);
    return session.staff;
  },

  /**
   * Admin mi?
   */
  isAdmin() {
    const user = this.getCurrentUser();
    return user && user.isAdmin;
  }
};

// Sayfa yüklendiğinde session kontrolü
document.addEventListener('DOMContentLoaded', async function() {
  // Login sayfasında değilsek
  if (!window.location.pathname.includes('login')) {
    const staff = await AuthManager.checkSession();
    if (!staff) {
      window.location.href = 'admin.html';
    }
  }
});
```

### Login Sayfası HTML: admin.html (güncelleme)

```html
<!-- Login Form -->
<div id="loginContainer" class="login-container">
  <div class="login-box">
    <img src="images/rolex-logo.png" alt="Rolex" class="login-logo">
    <h2>Randevu Sistemi</h2>

    <form id="loginForm">
      <div class="form-group">
        <label>Email</label>
        <input type="email" id="loginEmail" required placeholder="email@rolex.com">
      </div>

      <div class="form-group">
        <label>Şifre</label>
        <input type="password" id="loginPassword" required placeholder="********">
      </div>

      <button type="submit" class="btn-primary">Giriş Yap</button>

      <div id="loginError" class="error-message" style="display: none;"></div>
    </form>

    <div class="forgot-password">
      <a href="#" id="forgotPasswordLink">Şifremi Unuttum</a>
    </div>
  </div>
</div>

<!-- Şifre Sıfırlama Modal -->
<div id="resetPasswordModal" class="modal" style="display: none;">
  <div class="modal-content">
    <h3>Şifre Sıfırlama</h3>
    <p>Email adresinizi girin, yeni şifreniz gönderilecek.</p>

    <form id="resetPasswordForm">
      <div class="form-group">
        <input type="email" id="resetEmail" required placeholder="email@rolex.com">
      </div>

      <div class="modal-buttons">
        <button type="button" class="btn-secondary" onclick="closeResetModal()">İptal</button>
        <button type="submit" class="btn-primary">Gönder</button>
      </div>

      <div id="resetMessage" class="message" style="display: none;"></div>
    </form>
  </div>
</div>

<script>
// Login form
document.getElementById('loginForm').addEventListener('submit', async function(e) {
  e.preventDefault();

  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const errorDiv = document.getElementById('loginError');

  errorDiv.style.display = 'none';

  const result = await AuthManager.login(email, password);

  if (result.success) {
    // Admin paneline yönlendir
    showAdminPanel(result.staff);
  } else {
    errorDiv.textContent = result.error;
    errorDiv.style.display = 'block';
  }
});

// Şifremi unuttum
document.getElementById('forgotPasswordLink').addEventListener('click', function(e) {
  e.preventDefault();
  document.getElementById('resetPasswordModal').style.display = 'flex';
});

function closeResetModal() {
  document.getElementById('resetPasswordModal').style.display = 'none';
  document.getElementById('resetEmail').value = '';
  document.getElementById('resetMessage').style.display = 'none';
}

document.getElementById('resetPasswordForm').addEventListener('submit', async function(e) {
  e.preventDefault();

  const email = document.getElementById('resetEmail').value;
  const messageDiv = document.getElementById('resetMessage');

  const result = await AuthManager.resetPassword(email);

  messageDiv.textContent = result.success ? result.message : result.error;
  messageDiv.className = 'message ' + (result.success ? 'success' : 'error');
  messageDiv.style.display = 'block';

  if (result.success) {
    setTimeout(closeResetModal, 3000);
  }
});
</script>
```

---

## 1.3 Links Tablosu (Yeni)

### Google Sheets Yapısı (Links Sheet)

| Sütun | Alan | Açıklama |
|-------|------|----------|
| A | id | Güvenli 8 karakter ID |
| B | type | 'general' veya 'walkin' |
| C | createdAt | Oluşturma tarihi |
| D | active | Aktif/Pasif |

### Backend Kodu: Links.js

```javascript
// scripts/Links.js

var Links = {
  SHEET_NAME: 'Links',

  COLUMNS: {
    ID: 0,
    TYPE: 1,
    CREATED_AT: 2,
    ACTIVE: 3
  },

  /**
   * ID üretimi
   */
  generateId: function(prefix) {
    var chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    var id = prefix;
    for (var i = 0; i < 6; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  },

  /**
   * Tüm linkleri getir
   */
  getAll: function() {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.SHEET_NAME);
    if (!sheet) {
      this.createSheet();
      sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.SHEET_NAME);
    }

    var data = sheet.getDataRange().getValues();
    var links = [];

    for (var i = 1; i < data.length; i++) {
      if (data[i][this.COLUMNS.ID]) {
        links.push({
          id: data[i][this.COLUMNS.ID],
          type: data[i][this.COLUMNS.TYPE],
          createdAt: data[i][this.COLUMNS.CREATED_AT],
          active: data[i][this.COLUMNS.ACTIVE]
        });
      }
    }

    return links;
  },

  /**
   * Tip ile link getir
   */
  getByType: function(type) {
    var links = this.getAll();
    for (var i = 0; i < links.length; i++) {
      if (links[i].type === type && links[i].active) {
        return links[i];
      }
    }
    return null;
  },

  /**
   * ID ile link getir
   */
  getById: function(id) {
    var links = this.getAll();
    for (var i = 0; i < links.length; i++) {
      if (links[i].id === id) {
        return links[i];
      }
    }
    return null;
  },

  /**
   * Link oluştur veya getir
   */
  getOrCreate: function(type) {
    var existing = this.getByType(type);
    if (existing) {
      return existing;
    }

    // Yeni link oluştur
    var prefix = type === 'general' ? 'gn' : 'wk';
    var id = this.generateId(prefix);

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.SHEET_NAME);
    sheet.appendRow([id, type, new Date(), true]);

    return {
      id: id,
      type: type,
      createdAt: new Date(),
      active: true
    };
  },

  /**
   * Sheet oluştur
   */
  createSheet: function() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.insertSheet(this.SHEET_NAME);
    sheet.appendRow(['id', 'type', 'createdAt', 'active']);

    // Varsayılan linkleri oluştur
    this.getOrCreate('general');
    this.getOrCreate('walkin');
  }
};
```

---

## 1.4 ID Çözümleme (resolveId)

### Backend Kodu: Main.js'e ekle

```javascript
// scripts/Main.js

/**
 * ID'yi çözümle - hangi tipe ait olduğunu bul
 */
function resolveId(id) {
  // 1. Links tablosunda ara
  var link = Links.getById(id);
  if (link) {
    return {
      success: true,
      type: link.type, // 'general' veya 'walkin'
      data: link
    };
  }

  // 2. Staff tablosunda ara
  var staff = Staff.getById(id);
  if (staff) {
    // Management = VIP link
    if (staff.role === 'management') {
      return {
        success: true,
        type: 'vip',
        data: staff
      };
    }
    // Sales = Personel link
    return {
      success: true,
      type: 'staff',
      data: staff
    };
  }

  // Bulunamadı
  return {
    success: false,
    type: 'unknown',
    error: 'ID bulunamadı'
  };
}

/**
 * Tüm linkleri getir (Linkler sekmesi için)
 */
function getAllLinks() {
  var result = {
    general: null,
    walkin: null,
    vip: [],
    staff: []
  };

  // Genel ve Günlük linkleri
  result.general = Links.getOrCreate('general');
  result.walkin = Links.getOrCreate('walkin');

  // Personeller
  var allStaff = Staff.getAll().filter(function(s) { return s.active; });

  allStaff.forEach(function(s) {
    if (s.role === 'management') {
      result.vip.push({
        id: s.id,
        name: s.name
      });
    } else {
      result.staff.push({
        id: s.id,
        name: s.name
      });
    }
  });

  return result;
}
```

---

# FAZ 2: PROFİL SİSTEMİ

## 2.1 Profil Ayarları

### Backend Kodu: ProfileSettings.js

```javascript
// scripts/ProfileSettings.js

var ProfileSettings = {
  SHEET_NAME: 'ProfileSettings',

  /**
   * Varsayılan profil ayarları
   */
  DEFAULTS: {
    genel: {
      sameDayBooking: false,
      maxSlotAppointment: 1,
      slotGrid: 60,
      maxDailyPerStaff: 0,
      maxDailyDelivery: 3,
      duration: 60,
      assignByAdmin: false,
      allowedTypes: ['delivery', 'consultation', 'shipping', 'service'],
      staffFilter: 'role:sales'
    },
    personel: {
      sameDayBooking: false,
      maxSlotAppointment: 1,
      slotGrid: 60,
      maxDailyPerStaff: 0,
      maxDailyDelivery: 3,
      duration: 60,
      assignByAdmin: false,
      allowedTypes: ['delivery', 'consultation', 'shipping', 'service'],
      staffFilter: 'self'
    },
    vip: {
      sameDayBooking: true,
      maxSlotAppointment: 2,
      slotGrid: 30,
      maxDailyPerStaff: 0,
      maxDailyDelivery: 0,
      duration: 30,
      assignByAdmin: true,
      allowedTypes: ['delivery', 'consultation', 'service'],
      staffFilter: 'role:sales'
    },
    manuel: {
      sameDayBooking: true,
      maxSlotAppointment: 2,
      slotGrid: 30,
      maxDailyPerStaff: 0,
      maxDailyDelivery: 0,
      duration: 60,
      assignByAdmin: false,
      allowedTypes: ['delivery', 'consultation', 'shipping', 'service'],
      staffFilter: 'role:sales'
    },
    yonetim: {
      sameDayBooking: true,
      maxSlotAppointment: 2,
      slotGrid: 60,
      maxDailyPerStaff: 0,
      maxDailyDelivery: 0,
      duration: 60,
      assignByAdmin: true,
      allowedTypes: ['delivery', 'consultation', 'shipping', 'service'],
      staffFilter: 'role:management'
    },
    gunluk: {
      sameDayBooking: true,
      maxSlotAppointment: 2,
      slotGrid: 30,
      maxDailyPerStaff: 0,
      maxDailyDelivery: 0,
      duration: 30,
      assignByAdmin: true,
      allowedTypes: ['consultation', 'service'],
      staffFilter: 'role:sales'
    }
  },

  /**
   * Ayarları getir
   */
  getAll: function() {
    var props = PropertiesService.getScriptProperties();
    var settingsJson = props.getProperty('profileSettings');

    if (settingsJson) {
      return JSON.parse(settingsJson);
    }

    // Varsayılanları kaydet ve döndür
    props.setProperty('profileSettings', JSON.stringify(this.DEFAULTS));
    return this.DEFAULTS;
  },

  /**
   * Tek profil ayarını getir
   */
  get: function(profileName) {
    var all = this.getAll();
    return all[profileName] || this.DEFAULTS[profileName];
  },

  /**
   * Ayarları güncelle
   */
  update: function(profileName, settings) {
    var all = this.getAll();
    all[profileName] = Object.assign({}, all[profileName], settings);

    var props = PropertiesService.getScriptProperties();
    props.setProperty('profileSettings', JSON.stringify(all));

    return { success: true };
  },

  /**
   * Tüm ayarları güncelle
   */
  updateAll: function(allSettings) {
    var props = PropertiesService.getScriptProperties();
    props.setProperty('profileSettings', JSON.stringify(allSettings));
    return { success: true };
  }
};
```

## 2.2 Profil Bazlı Validation

### Backend Kodu: Validation.js

```javascript
// scripts/Validation.js

var Validation = {

  /**
   * Randevu validasyonu
   */
  validateAppointment: function(data, profile) {
    var settings = ProfileSettings.get(profile);
    var errors = [];

    // 1. Aynı gün kontrolü
    if (!settings.sameDayBooking) {
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      var appointmentDate = new Date(data.date);
      appointmentDate.setHours(0, 0, 0, 0);

      if (appointmentDate.getTime() === today.getTime()) {
        errors.push('Bu profil için aynı gün randevu alınamaz');
      }
    }

    // 2. Randevu türü kontrolü
    if (!settings.allowedTypes.includes(data.type)) {
      errors.push('Bu randevu türü bu profil için uygun değil');
    }

    // 3. Slot müsaitlik kontrolü
    var slotCheck = this.checkSlotAvailability(data.date, data.time, data.duration || settings.duration, settings);
    if (!slotCheck.available) {
      errors.push(slotCheck.error);
    }

    // 4. Günlük teslim limiti kontrolü
    if (settings.maxDailyDelivery > 0 && (data.type === 'delivery' || data.type === 'shipping')) {
      var deliveryCount = this.getDailyDeliveryCount(data.date);
      if (deliveryCount >= settings.maxDailyDelivery) {
        errors.push('Günlük teslim limiti doldu (' + settings.maxDailyDelivery + ')');
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  },

  /**
   * Slot müsaitlik kontrolü
   */
  checkSlotAvailability: function(date, time, duration, settings) {
    var maxSlot = settings.maxSlotAppointment;

    // 0 = sınırsız
    if (maxSlot === 0) {
      return { available: true };
    }

    // Bu randevunun kaplayacağı slotları hesapla
    var slots = this.getAffectedSlots(time, duration);

    for (var i = 0; i < slots.length; i++) {
      var count = this.getSlotOccupancy(date, slots[i]);
      if (count >= maxSlot) {
        return {
          available: false,
          error: 'Seçilen saat dolu (' + slots[i] + ')'
        };
      }
    }

    return { available: true };
  },

  /**
   * Etkilenen slotları hesapla
   */
  getAffectedSlots: function(startTime, duration) {
    var slots = [];
    var timeParts = startTime.split(':');
    var startMinutes = parseInt(timeParts[0]) * 60 + parseInt(timeParts[1]);
    var slotCount = Math.ceil(duration / 30);

    for (var i = 0; i < slotCount; i++) {
      var slotMinutes = startMinutes + (i * 30);
      var hours = Math.floor(slotMinutes / 60);
      var minutes = slotMinutes % 60;
      slots.push(
        ('0' + hours).slice(-2) + ':' + ('0' + minutes).slice(-2)
      );
    }

    return slots;
  },

  /**
   * Slot doluluk sayısı
   */
  getSlotOccupancy: function(date, time) {
    var appointments = Appointments.getByDate(date);
    var count = 0;

    appointments.forEach(function(apt) {
      var aptSlots = Validation.getAffectedSlots(apt.time, apt.duration || 60);
      if (aptSlots.includes(time)) {
        count++;
      }
    });

    return count;
  },

  /**
   * Günlük teslim sayısı
   */
  getDailyDeliveryCount: function(date) {
    var appointments = Appointments.getByDate(date);
    return appointments.filter(function(apt) {
      return apt.type === 'delivery' || apt.type === 'shipping';
    }).length;
  }
};
```

---

# FAZ 3: ADMIN PANEL SEKMELERİ

## 3.1 Sekme Yapısı

### HTML: admin.html

```html
<!-- Admin Panel Container -->
<div id="adminPanel" style="display: none;">

  <!-- Header -->
  <header class="admin-header">
    <div class="logo">
      <img src="images/rolex-logo.png" alt="Rolex">
      <span>Admin Panel</span>
    </div>
    <div class="user-info">
      <span id="userName"></span>
      <button onclick="AuthManager.logout()" class="btn-logout">Çıkış</button>
    </div>
  </header>

  <!-- Tabs -->
  <nav class="admin-tabs" id="adminTabs">
    <button class="tab-btn active" data-tab="linkler">Linkler</button>
    <button class="tab-btn" data-tab="randevular">Randevular</button>
    <button class="tab-btn" data-tab="randevuOlustur">Randevu Oluştur</button>
    <button class="tab-btn" data-tab="vardiyalar">Vardiyalar</button>
    <button class="tab-btn" data-tab="personelYonetimi">Personel Yönetimi</button>
    <button class="tab-btn" data-tab="whatsapp">WhatsApp</button>
    <button class="tab-btn" data-tab="ayarlar">Ayarlar</button>
    <button class="tab-btn" data-tab="uygulamalar">Uygulamalar</button>
  </nav>

  <!-- Tab Contents -->
  <main class="admin-content">
    <div id="tab-linkler" class="tab-content active"></div>
    <div id="tab-randevular" class="tab-content"></div>
    <div id="tab-randevuOlustur" class="tab-content"></div>
    <div id="tab-vardiyalar" class="tab-content"></div>
    <div id="tab-personelYonetimi" class="tab-content"></div>
    <div id="tab-whatsapp" class="tab-content"></div>
    <div id="tab-ayarlar" class="tab-content"></div>
    <div id="tab-uygulamalar" class="tab-content"></div>
  </main>

</div>
```

### JavaScript: admin-tabs.js

```javascript
// js/admin-tabs.js

const AdminTabs = {
  currentTab: 'linkler',

  /**
   * Sekmeleri başlat
   */
  init: function(staff) {
    // Yetkilere göre sekmeleri filtrele
    this.filterTabs(staff);

    // Tab click handlers
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchTab(btn.dataset.tab);
      });
    });

    // İlk sekmeyi yükle
    this.loadTabContent('linkler');
  },

  /**
   * Yetkilere göre sekmeleri filtrele
   */
  filterTabs: function(staff) {
    if (staff.isAdmin) {
      // Admin her şeyi görür
      return;
    }

    // Varsayılan yetkiler
    const permissions = {
      linkler: true,
      randevular: true,
      randevuOlustur: true,
      vardiyalar: false,
      personelYonetimi: false,
      whatsapp: false,
      ayarlar: false,
      uygulamalar: false
    };

    // Sekmeleri gizle
    document.querySelectorAll('.tab-btn').forEach(btn => {
      const tab = btn.dataset.tab;
      if (!permissions[tab]) {
        btn.style.display = 'none';
      }
    });
  },

  /**
   * Sekme değiştir
   */
  switchTab: function(tabName) {
    // Aktif sekmeyi güncelle
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === 'tab-' + tabName);
    });

    this.currentTab = tabName;
    this.loadTabContent(tabName);
  },

  /**
   * Sekme içeriğini yükle
   */
  loadTabContent: function(tabName) {
    switch(tabName) {
      case 'linkler':
        LinksTab.load();
        break;
      case 'randevular':
        AppointmentsTab.load();
        break;
      case 'randevuOlustur':
        CreateAppointmentTab.load();
        break;
      case 'vardiyalar':
        ShiftsTab.load();
        break;
      case 'personelYonetimi':
        StaffTab.load();
        break;
      case 'whatsapp':
        WhatsAppTab.load();
        break;
      case 'ayarlar':
        SettingsTab.load();
        break;
      case 'uygulamalar':
        AppsTab.load();
        break;
    }
  }
};
```

## 3.2 Linkler Sekmesi

### JavaScript: tabs/links-tab.js

```javascript
// js/tabs/links-tab.js

const LinksTab = {

  async load() {
    const container = document.getElementById('tab-linkler');
    container.innerHTML = '<div class="loading">Yükleniyor...</div>';

    try {
      const links = await apiCall('getAllLinks');
      this.render(container, links);
    } catch (e) {
      container.innerHTML = '<div class="error">Yüklenemedi: ' + e.message + '</div>';
    }
  },

  render(container, links) {
    const baseUrl = 'https://rolexizmiristinyepark.github.io/randevu_app/';

    let html = `
      <div class="links-container">
        <h2>Randevu Linkleri</h2>

        <!-- Genel Link -->
        <div class="link-section">
          <h3>Genel Link</h3>
          <div class="link-item">
            <span class="link-url">${baseUrl}?id=${links.general.id}</span>
            <div class="link-buttons">
              <button class="btn-copy" onclick="LinksTab.copyLink('${links.general.id}')">Kopyala</button>
              <button class="btn-open" onclick="LinksTab.openLink('${links.general.id}')">Aç</button>
            </div>
          </div>
        </div>

        <!-- Günlük Link -->
        <div class="link-section">
          <h3>Günlük Müşteri Link</h3>
          <div class="link-item">
            <span class="link-url">${baseUrl}?id=${links.walkin.id}</span>
            <div class="link-buttons">
              <button class="btn-copy" onclick="LinksTab.copyLink('${links.walkin.id}')">Kopyala</button>
              <button class="btn-open" onclick="LinksTab.openLink('${links.walkin.id}')">Aç</button>
            </div>
          </div>
        </div>

        <!-- VIP Linkleri -->
        <div class="link-section">
          <h3>VIP Linkleri (Management)</h3>
          <div class="link-list">
            ${links.vip.map(v => `
              <div class="link-item">
                <span class="link-name">${v.name}</span>
                <span class="link-url">${baseUrl}?id=${v.id}</span>
                <div class="link-buttons">
                  <button class="btn-copy" onclick="LinksTab.copyLink('${v.id}')">Kopyala</button>
                  <button class="btn-open" onclick="LinksTab.openLink('${v.id}')">Aç</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Personel Linkleri -->
        <div class="link-section">
          <h3>Personel Linkleri (Sales)</h3>
          <div class="link-list">
            ${links.staff.map(s => `
              <div class="link-item">
                <span class="link-name">${s.name}</span>
                <span class="link-url">${baseUrl}?id=${s.id}</span>
                <div class="link-buttons">
                  <button class="btn-copy" onclick="LinksTab.copyLink('${s.id}')">Kopyala</button>
                  <button class="btn-open" onclick="LinksTab.openLink('${s.id}')">Aç</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
  },

  copyLink(id) {
    const url = 'https://rolexizmiristinyepark.github.io/randevu_app/?id=' + id;
    navigator.clipboard.writeText(url).then(() => {
      showToast('Link kopyalandı!', 'success');
    });
  },

  openLink(id) {
    const url = 'https://rolexizmiristinyepark.github.io/randevu_app/?id=' + id;
    window.open(url, '_blank');
  }
};
```

## 3.3 Uygulamalar Sekmesi

### JavaScript: tabs/apps-tab.js

```javascript
// js/tabs/apps-tab.js

const AppsTab = {

  load() {
    const container = document.getElementById('tab-uygulamalar');

    const apps = [
      { id: 'teslimTutanak', name: 'Teslim Tutanak', icon: '📄' },
      { id: 'teslimForm', name: 'Teslim Form', icon: '📝' },
      { id: 'teknikServis', name: 'Teknik Servis', icon: '🔧' },
      { id: 'onOdeme', name: 'Ön Ödeme', icon: '💳' }
    ];

    let html = `
      <div class="apps-container">
        <h2>Uygulamalar</h2>
        <div class="apps-grid">
          ${apps.map(app => `
            <button class="app-card" onclick="AppsTab.handleClick('${app.name}')">
              <span class="app-icon">${app.icon}</span>
              <span class="app-name">${app.name}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;

    container.innerHTML = html;
  },

  handleClick(appName) {
    showToast(appName + ' - Coming Soon', 'info');
  }
};
```

---

# FAZ 4: WHATSAPP SEKMESİ

## 4.1 Template Yönetimi

### Backend Kodu: WhatsAppTemplates.js

```javascript
// scripts/WhatsAppTemplates.js

var WhatsAppTemplates = {

  /**
   * Tüm template'leri getir
   */
  getAll: function() {
    var props = PropertiesService.getScriptProperties();
    var templatesJson = props.getProperty('whatsappTemplates');

    if (templatesJson) {
      return JSON.parse(templatesJson);
    }

    return [];
  },

  /**
   * Template ekle
   */
  add: function(template) {
    var templates = this.getAll();

    template.id = 'tpl_' + Date.now();
    templates.push(template);

    this.saveAll(templates);
    return { success: true, id: template.id };
  },

  /**
   * Template güncelle
   */
  update: function(id, data) {
    var templates = this.getAll();

    for (var i = 0; i < templates.length; i++) {
      if (templates[i].id === id) {
        templates[i] = Object.assign({}, templates[i], data);
        this.saveAll(templates);
        return { success: true };
      }
    }

    return { success: false, error: 'Template bulunamadı' };
  },

  /**
   * Template sil
   */
  delete: function(id) {
    var templates = this.getAll();
    templates = templates.filter(function(t) { return t.id !== id; });
    this.saveAll(templates);
    return { success: true };
  },

  /**
   * Kaydet
   */
  saveAll: function(templates) {
    var props = PropertiesService.getScriptProperties();
    props.setProperty('whatsappTemplates', JSON.stringify(templates));
  },

  /**
   * Değişken seçenekleri
   */
  getVariableOptions: function() {
    return [
      { code: 'customerName', label: 'Müşteri Adı' },
      { code: 'customerPhone', label: 'Müşteri Telefon' },
      { code: 'appointmentDateTime', label: 'Randevu Tarih/Saat' },
      { code: 'appointmentDate', label: 'Randevu Tarihi' },
      { code: 'appointmentTime', label: 'Randevu Saati' },
      { code: 'staffName', label: 'Personel Adı' },
      { code: 'staffPhone', label: 'Personel Telefon' },
      { code: 'appointmentType', label: 'Randevu Türü' },
      { code: 'companyName', label: 'Şirket Adı' },
      { code: 'companyLocation', label: 'Şirket Lokasyon' }
    ];
  }
};
```

---

# FAZ 5: YETKİ SİSTEMİ

## 5.1 Personel Yetkileri

### Backend Kodu: Permissions.js

```javascript
// scripts/Permissions.js

var Permissions = {

  /**
   * Varsayılan yetkiler (isAdmin: false için)
   */
  DEFAULTS: {
    linkler: true,
    randevular: true,
    randevuOlustur: true,
    vardiyalar: false,
    personelYonetimi: false,
    whatsapp: false,
    ayarlar: false,
    uygulamalar: false
  },

  /**
   * Yetkileri getir
   */
  get: function() {
    var props = PropertiesService.getScriptProperties();
    var permsJson = props.getProperty('staffPermissions');

    if (permsJson) {
      return JSON.parse(permsJson);
    }

    return this.DEFAULTS;
  },

  /**
   * Yetkileri güncelle
   */
  update: function(permissions) {
    var props = PropertiesService.getScriptProperties();
    props.setProperty('staffPermissions', JSON.stringify(permissions));
    return { success: true };
  },

  /**
   * Kullanıcının belirli bir yetkisi var mı?
   */
  check: function(staffId, permission) {
    var staff = Staff.getById(staffId);

    if (!staff) {
      return false;
    }

    // Admin her şeyi yapabilir
    if (staff.isAdmin) {
      return true;
    }

    var perms = this.get();
    return perms[permission] === true;
  }
};
```

---

## DEPLOYMENT ADIMLARI

### 1. Dosyaları Güncelle

```bash
# Yeni dosyalar ekle
scripts/
  ├── Staff.js (güncelle)
  ├── Auth.js (yeni)
  ├── Links.js (yeni)
  ├── ProfileSettings.js (yeni)
  ├── Validation.js (yeni)
  ├── WhatsAppTemplates.js (yeni)
  └── Permissions.js (yeni)

js/
  ├── auth.js (yeni)
  ├── admin-tabs.js (yeni)
  └── tabs/
      ├── links-tab.js (yeni)
      ├── apps-tab.js (yeni)
      └── ... (diğer sekmeler)
```

### 2. Google Sheets Güncellemeleri

```
1. Staff sheet'e yeni sütunlar ekle
2. Links sheet oluştur
3. Mevcut verileri migrate et
```

### 3. CLASP ile Deploy

```bash
clasp push
clasp deploy --description "v3.0 - Auth + Profiller"
```

### 4. Frontend Deploy

```bash
git add .
git commit -m "feat: v3.0 - Yeni auth sistemi ve profil yapısı"
git push origin main
```

---

**Son Güncelleme:** 2 Aralık 2025
