// ==================== ADMIN AUTHENTICATION v3.2 ====================
// Email + Password auth sistemi (API Key sistemini değiştiriyor)
// Session-based auth with 10 minute sliding expiration

import { ApiService } from './api-service';
import CryptoJS from 'crypto-js';

// Session storage keys
const SESSION_KEYS = {
    TOKEN: 'admin_session_token',
    STAFF: 'admin_session_staff',
    EXPIRES: 'admin_session_expires',
    SESSION_ID: 'admin_session_id'
};

// Session duration (10 minutes)
const SESSION_DURATION = 10 * 60 * 1000;

// Encryption key - browser fingerprint + static salt
const getEncryptionKey = (): string => {
    const staticSalt = 'RLX_ADMIN_2024_SECURE_V3';

    let sessionId = sessionStorage.getItem(SESSION_KEYS.SESSION_ID);
    if (!sessionId) {
        sessionId = crypto.randomUUID();
        sessionStorage.setItem(SESSION_KEYS.SESSION_ID, sessionId);
    }

    const browserInfo = [
        navigator.userAgent,
        navigator.language,
        screen.width,
        screen.height,
        new Date().getTimezoneOffset(),
        sessionId
    ].join('|');

    return CryptoJS.SHA256(staticSalt + browserInfo).toString().substring(0, 32);
};

// Encrypt helper
const encryptData = (data: string): string => {
    const key = getEncryptionKey();
    return CryptoJS.AES.encrypt(data, key).toString();
};

// Decrypt helper
const decryptData = (encryptedData: string): string | null => {
    try {
        const key = getEncryptionKey();
        const bytes = CryptoJS.AES.decrypt(encryptedData, key);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        return decrypted || null;
    } catch {
        return null;
    }
};

// Staff bilgisi interface
interface StaffInfo {
    id: string;
    name: string;
    email: string;
    role: 'sales' | 'management';
    isAdmin: boolean;
}

const AdminAuth = {
    INACTIVITY_TIMEOUT: SESSION_DURATION,
    _lastActivityTime: Date.now(),
    _activityCheckInterval: null as ReturnType<typeof setInterval> | null,
    _activityHandler: null as (() => void) | null,

    // Session kontrolü
    isAuthenticated(): StaffInfo | false {
        const encryptedToken = sessionStorage.getItem(SESSION_KEYS.TOKEN);
        const encryptedStaff = sessionStorage.getItem(SESSION_KEYS.STAFF);
        const expiresAt = sessionStorage.getItem(SESSION_KEYS.EXPIRES);

        if (!encryptedToken || !encryptedStaff || !expiresAt) {
            return false;
        }

        // Session süresi dolmuş mu?
        if (Date.now() > parseInt(expiresAt)) {
            console.warn('[AdminAuth] Session expired');
            this.logout();
            return false;
        }

        // Token ve staff bilgisini çöz
        const token = decryptData(encryptedToken);
        const staffJson = decryptData(encryptedStaff);

        if (!token || !staffJson) {
            console.warn('[AdminAuth] Failed to decrypt session data');
            this.logout();
            return false;
        }

        try {
            const staff = JSON.parse(staffJson) as StaffInfo;

            // Session'ı yenile (sliding expiration)
            this._refreshSession();

            return staff;
        } catch {
            console.warn('[AdminAuth] Failed to parse staff data');
            this.logout();
            return false;
        }
    },

    // Session'ı yenile
    _refreshSession(): void {
        const newExpiry = Date.now() + SESSION_DURATION;
        sessionStorage.setItem(SESSION_KEYS.EXPIRES, newExpiry.toString());
        this._lastActivityTime = Date.now();
    },

    // Session token'ı al (API istekleri için)
    getSessionToken(): string | null {
        const encryptedToken = sessionStorage.getItem(SESSION_KEYS.TOKEN);
        const expiresAt = sessionStorage.getItem(SESSION_KEYS.EXPIRES);

        if (!encryptedToken || !expiresAt) {
            return null;
        }

        // Session süresi dolmuş mu?
        if (Date.now() > parseInt(expiresAt)) {
            return null;
        }

        const token = decryptData(encryptedToken);
        return token || null;
    },

    // Session kaydet
    saveSession(token: string, staff: StaffInfo, expiresAt: number): void {
        const encryptedToken = encryptData(token);
        const encryptedStaff = encryptData(JSON.stringify(staff));

        sessionStorage.setItem(SESSION_KEYS.TOKEN, encryptedToken);
        sessionStorage.setItem(SESSION_KEYS.STAFF, encryptedStaff);
        sessionStorage.setItem(SESSION_KEYS.EXPIRES, expiresAt.toString());

        this._lastActivityTime = Date.now();
        this._startActivityTracking();
    },

    // Çıkış yap
    logout(): void {
        sessionStorage.removeItem(SESSION_KEYS.TOKEN);
        sessionStorage.removeItem(SESSION_KEYS.STAFF);
        sessionStorage.removeItem(SESSION_KEYS.EXPIRES);
        this._stopActivityTracking();
        location.reload();
    },

    // Session'ı temizle (sayfa yenilemeden)
    clearSession(): void {
        sessionStorage.removeItem(SESSION_KEYS.TOKEN);
        sessionStorage.removeItem(SESSION_KEYS.STAFF);
        sessionStorage.removeItem(SESSION_KEYS.EXPIRES);
        this._stopActivityTracking();
    },

    // Login modal göster
    showLoginModal(): void {
        const modalHtml = `
            <div id="authModal" class="admin-auth-modal">
                <div class="admin-auth-modal-content">
                    <h2 class="admin-auth-title">🔐 Admin Girişi</h2>
                    <p class="admin-auth-subtitle">E-posta ve şifrenizle giriş yapın</p>

                    <div id="authError" class="admin-auth-error"></div>

                    <form id="loginForm" autocomplete="on">
                        <div class="admin-auth-input-group">
                            <label for="emailInput" class="admin-auth-label">E-posta</label>
                            <input type="email" id="emailInput" placeholder="ornek@email.com" class="admin-auth-input" autocomplete="email" required>
                        </div>

                        <div class="admin-auth-input-group">
                            <label for="passwordInput" class="admin-auth-label">Şifre</label>
                            <input type="password" id="passwordInput" placeholder="••••••••" class="admin-auth-input" autocomplete="current-password" required>
                        </div>

                        <button type="submit" id="adminLoginBtn" class="admin-auth-btn">Giriş Yap</button>
                    </form>

                    <div class="admin-auth-divider">
                        <button id="forgotPasswordBtn" class="admin-auth-btn-secondary">🔑 Şifremi Unuttum</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        this._attachModalEvents();

        setTimeout(() => {
            document.getElementById('emailInput')?.focus();
        }, 100);
    },

    // Modal event listener'larını ekle
    _attachModalEvents(): void {
        const form = document.getElementById('loginForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.login();
            });
        }

        const forgotBtn = document.getElementById('forgotPasswordBtn');
        if (forgotBtn) {
            forgotBtn.addEventListener('click', () => this.showForgotPasswordModal());
        }
    },

    // Giriş yap
    async login(): Promise<void> {
        const emailInput = document.getElementById('emailInput') as HTMLInputElement | null;
        const passwordInput = document.getElementById('passwordInput') as HTMLInputElement | null;
        const errorDiv = document.getElementById('authError');
        const button = document.getElementById('adminLoginBtn') as HTMLButtonElement | null;

        if (!button || !emailInput || !passwordInput) return;

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            if (errorDiv) {
                errorDiv.textContent = '❌ Lütfen e-posta ve şifre girin';
                errorDiv.classList.add('show');
            }
            return;
        }

        const originalText = button.textContent;
        button.textContent = 'Giriş yapılıyor...';
        button.disabled = true;

        try {
            const response = await ApiService.call('login', { email, password });

            if (response.success) {
                // Başarılı giriş
                this.saveSession(
                    response.token,
                    response.staff as StaffInfo,
                    response.expiresAt as number
                );
                document.getElementById('authModal')?.remove();
                location.reload();
            } else {
                if (errorDiv) {
                    errorDiv.textContent = `❌ ${response.error || 'Giriş başarısız'}`;
                    errorDiv.classList.add('show');
                }
                button.textContent = originalText;
                button.disabled = false;
            }
        } catch (error) {
            if (errorDiv) {
                errorDiv.textContent = '❌ Bağlantı hatası';
                errorDiv.classList.add('show');
            }
            button.textContent = originalText;
            button.disabled = false;
        }
    },

    // Şifremi unuttum modal
    showForgotPasswordModal(): void {
        // Mevcut modal'ı güncelle
        const modalContent = document.querySelector('.admin-auth-modal-content');
        if (!modalContent) return;

        modalContent.innerHTML = `
            <h2 class="admin-auth-title">🔑 Şifre Sıfırlama</h2>
            <p class="admin-auth-subtitle">E-posta adresinize yeni şifre gönderilecek</p>

            <div id="authError" class="admin-auth-error"></div>
            <div id="authSuccess" class="admin-auth-success"></div>

            <form id="resetForm" autocomplete="on">
                <div class="admin-auth-input-group">
                    <label for="resetEmailInput" class="admin-auth-label">E-posta</label>
                    <input type="email" id="resetEmailInput" placeholder="ornek@email.com" class="admin-auth-input" autocomplete="email" required>
                </div>

                <button type="submit" id="resetPasswordBtn" class="admin-auth-btn">Şifre Gönder</button>
            </form>

            <div class="admin-auth-divider">
                <button id="backToLoginBtn" class="admin-auth-btn-secondary">← Giriş Sayfasına Dön</button>
            </div>
        `;

        // Event listeners
        const form = document.getElementById('resetForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.resetPassword();
            });
        }

        const backBtn = document.getElementById('backToLoginBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                document.getElementById('authModal')?.remove();
                this.showLoginModal();
            });
        }

        setTimeout(() => {
            document.getElementById('resetEmailInput')?.focus();
        }, 100);
    },

    // Şifre sıfırla
    async resetPassword(): Promise<void> {
        const emailInput = document.getElementById('resetEmailInput') as HTMLInputElement | null;
        const errorDiv = document.getElementById('authError');
        const successDiv = document.getElementById('authSuccess');
        const button = document.getElementById('resetPasswordBtn') as HTMLButtonElement | null;

        if (!button || !emailInput) return;

        const email = emailInput.value.trim();

        if (!email) {
            if (errorDiv) {
                errorDiv.textContent = '❌ Lütfen e-posta adresinizi girin';
                errorDiv.classList.add('show');
            }
            return;
        }

        const originalText = button.textContent;
        button.textContent = 'Gönderiliyor...';
        button.disabled = true;

        try {
            const response = await ApiService.call('resetPassword', { email });

            if (response.success) {
                if (successDiv) {
                    successDiv.textContent = '✅ Yeni şifreniz e-posta adresinize gönderildi';
                    successDiv.classList.add('show');
                }
                if (errorDiv) {
                    errorDiv.classList.remove('show');
                }
                button.textContent = 'Gönderildi';
            } else {
                if (errorDiv) {
                    errorDiv.textContent = `❌ ${response.error || 'Şifre sıfırlanamadı'}`;
                    errorDiv.classList.add('show');
                }
                button.textContent = originalText;
                button.disabled = false;
            }
        } catch (error) {
            if (errorDiv) {
                errorDiv.textContent = '❌ Bağlantı hatası';
                errorDiv.classList.add('show');
            }
            button.textContent = originalText;
            button.disabled = false;
        }
    },

    // Çıkış butonu ekle
    addLogoutButton(): void {
        const header = document.querySelector('.header') as HTMLElement | null;
        if (!header) return;

        const staff = this.isAuthenticated();
        if (!staff) return;

        // Kullanıcı adını "Admin Paneli" yanına ekle
        const userNameSpan = document.getElementById('adminUserName');
        if (userNameSpan) {
            userNameSpan.textContent = ` - ${staff.name}`;
        }

        // Sadece çıkış butonu
        const logoutBtn = document.createElement('button');
        logoutBtn.className = 'admin-logout-btn';
        logoutBtn.textContent = '🔓 Çıkış';
        logoutBtn.addEventListener('click', () => {
            if (confirm('Çıkış yapmak istediğinize emin misiniz?')) {
                this.logout();
            }
        });

        header.style.position = 'relative';
        header.appendChild(logoutBtn);
    },

    // Mevcut kullanıcı bilgisi
    getCurrentUser(): StaffInfo | null {
        const result = this.isAuthenticated();
        return result || null;
    },

    // Admin yetkisi kontrolü
    isAdmin(): boolean {
        const staff = this.isAuthenticated();
        return staff ? staff.isAdmin : false;
    },

    // İnaktivite takibini başlat
    _startActivityTracking(): void {
        this._activityHandler = () => {
            this._lastActivityTime = Date.now();
            this._refreshSession();
        };

        document.addEventListener('mousemove', this._activityHandler);
        document.addEventListener('keypress', this._activityHandler);
        document.addEventListener('click', this._activityHandler);
        document.addEventListener('scroll', this._activityHandler);
        document.addEventListener('touchstart', this._activityHandler);

        // Her 60 saniyede bir kontrol et
        this._activityCheckInterval = setInterval(() => {
            const elapsed = Date.now() - this._lastActivityTime;
            if (elapsed > this.INACTIVITY_TIMEOUT) {
                alert('⏰ 10 dakika boyunca işlem yapılmadı. Güvenlik nedeniyle oturum kapatılıyor.');
                this.logout();
            }
        }, 60 * 1000);
    },

    // İnaktivite takibini durdur
    _stopActivityTracking(): void {
        if (this._activityCheckInterval) {
            clearInterval(this._activityCheckInterval);
            this._activityCheckInterval = null;
        }

        if (this._activityHandler) {
            document.removeEventListener('mousemove', this._activityHandler);
            document.removeEventListener('keypress', this._activityHandler);
            document.removeEventListener('click', this._activityHandler);
            document.removeEventListener('scroll', this._activityHandler);
            document.removeEventListener('touchstart', this._activityHandler);
            this._activityHandler = null;
        }
    },

    // ==================== LEGACY SUPPORT ====================
    // Eski API key sisteminden geçiş için

    // API key kontrolü (backward compatibility)
    get API_KEY_STORAGE() {
        return 'admin_api_key';
    },

    // Eski API key varsa temizle
    clearLegacyAuth(): void {
        sessionStorage.removeItem('admin_api_key');
        sessionStorage.removeItem('admin_api_key_time');
    }
};

// Export for ES6 modules
export { AdminAuth };

// Extend Window interface for TypeScript
declare global {
    interface Window {
        AdminAuth: typeof AdminAuth;
    }
}

// Also expose globally for backward compatibility
if (typeof window !== 'undefined') {
    window.AdminAuth = AdminAuth;
}
