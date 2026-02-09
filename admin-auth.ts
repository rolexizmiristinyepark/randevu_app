// ==================== ADMIN AUTHENTICATION ====================
// Supabase Auth ile admin giris sistemi
// GAS session-based auth -> Supabase JWT auth gecisi

import { getSupabase } from './api-service';

// Session duration (24 hours) - inaktivite timeout
const SESSION_DURATION = 24 * 60 * 60 * 1000;

// Staff bilgisi interface
interface StaffInfo {
    id: string;
    name: string;
    email: string;
    role: 'sales' | 'management' | 'reception' | 'service';
    isAdmin: boolean;
}

/**
 * Login modalini DOM API ile olusturur (XSS-safe, innerHTML yok)
 */
function createLoginModalDOM(): HTMLElement {
    const modal = document.createElement('div');
    modal.id = 'authModal';
    modal.className = 'admin-auth-modal';

    const content = document.createElement('div');
    content.className = 'admin-auth-modal-content';

    const title = document.createElement('h2');
    title.className = 'admin-auth-title';
    title.textContent = 'Admin Girisi';

    const subtitle = document.createElement('p');
    subtitle.className = 'admin-auth-subtitle';
    subtitle.textContent = 'E-posta ve sifrenizle giris yapin';

    const errorDiv = document.createElement('div');
    errorDiv.id = 'authError';
    errorDiv.className = 'admin-auth-error';

    const form = document.createElement('form');
    form.id = 'loginForm';
    form.autocomplete = 'on';

    // Email input group
    const emailGroup = document.createElement('div');
    emailGroup.className = 'admin-auth-input-group';
    const emailLabel = document.createElement('label');
    emailLabel.htmlFor = 'emailInput';
    emailLabel.className = 'admin-auth-label';
    emailLabel.textContent = 'E-posta';
    const emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.id = 'emailInput';
    emailInput.placeholder = 'ornek@email.com';
    emailInput.className = 'admin-auth-input';
    emailInput.autocomplete = 'email';
    emailInput.required = true;
    emailGroup.appendChild(emailLabel);
    emailGroup.appendChild(emailInput);

    // Password input group
    const passGroup = document.createElement('div');
    passGroup.className = 'admin-auth-input-group';
    const passLabel = document.createElement('label');
    passLabel.htmlFor = 'passwordInput';
    passLabel.className = 'admin-auth-label';
    passLabel.textContent = 'Sifre';
    const passInput = document.createElement('input');
    passInput.type = 'password';
    passInput.id = 'passwordInput';
    passInput.placeholder = '--------';
    passInput.className = 'admin-auth-input';
    passInput.autocomplete = 'current-password';
    passInput.required = true;
    passGroup.appendChild(passLabel);
    passGroup.appendChild(passInput);

    // Submit button
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.id = 'adminLoginBtn';
    submitBtn.className = 'admin-auth-btn';
    submitBtn.textContent = 'Giris Yap';

    form.appendChild(emailGroup);
    form.appendChild(passGroup);
    form.appendChild(submitBtn);

    // Forgot password divider
    const divider = document.createElement('div');
    divider.className = 'admin-auth-divider';
    const forgotBtn = document.createElement('button');
    forgotBtn.id = 'forgotPasswordBtn';
    forgotBtn.className = 'admin-auth-btn-secondary';
    forgotBtn.textContent = 'Sifremi Unuttum';
    divider.appendChild(forgotBtn);

    content.appendChild(title);
    content.appendChild(subtitle);
    content.appendChild(errorDiv);
    content.appendChild(form);
    content.appendChild(divider);
    modal.appendChild(content);

    return modal;
}

/**
 * Sifre sifirlama formunu DOM API ile olusturur (XSS-safe)
 */
function createResetPasswordDOM(container: Element): void {
    // Mevcut icerigi temizle
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    const title = document.createElement('h2');
    title.className = 'admin-auth-title';
    title.textContent = 'Sifre Sifirlama';

    const subtitle = document.createElement('p');
    subtitle.className = 'admin-auth-subtitle';
    subtitle.textContent = 'E-posta adresinize sifirlama linki gonderilecek';

    const errorDiv = document.createElement('div');
    errorDiv.id = 'authError';
    errorDiv.className = 'admin-auth-error';

    const successDiv = document.createElement('div');
    successDiv.id = 'authSuccess';
    successDiv.className = 'admin-auth-success';

    const form = document.createElement('form');
    form.id = 'resetForm';
    form.autocomplete = 'on';

    const emailGroup = document.createElement('div');
    emailGroup.className = 'admin-auth-input-group';
    const emailLabel = document.createElement('label');
    emailLabel.htmlFor = 'resetEmailInput';
    emailLabel.className = 'admin-auth-label';
    emailLabel.textContent = 'E-posta';
    const emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.id = 'resetEmailInput';
    emailInput.placeholder = 'ornek@email.com';
    emailInput.className = 'admin-auth-input';
    emailInput.autocomplete = 'email';
    emailInput.required = true;
    emailGroup.appendChild(emailLabel);
    emailGroup.appendChild(emailInput);

    const resetBtn = document.createElement('button');
    resetBtn.type = 'submit';
    resetBtn.id = 'resetPasswordBtn';
    resetBtn.className = 'admin-auth-btn';
    resetBtn.textContent = 'Sifre Gonder';

    form.appendChild(emailGroup);
    form.appendChild(resetBtn);

    const divider = document.createElement('div');
    divider.className = 'admin-auth-divider';
    const backBtn = document.createElement('button');
    backBtn.id = 'backToLoginBtn';
    backBtn.className = 'admin-auth-btn-secondary';
    backBtn.textContent = 'Giris Sayfasina Don';
    divider.appendChild(backBtn);

    container.appendChild(title);
    container.appendChild(subtitle);
    container.appendChild(errorDiv);
    container.appendChild(successDiv);
    container.appendChild(form);
    container.appendChild(divider);
}

const AdminAuth = {
    INACTIVITY_TIMEOUT: SESSION_DURATION,
    _lastActivityTime: Date.now(),
    _activityCheckInterval: null as ReturnType<typeof setInterval> | null,
    _activityHandler: null as (() => void) | null,
    _cachedStaff: null as StaffInfo | null,

    // Session kontrolu - sync, cache'den doner
    isAuthenticated(): StaffInfo | false {
        if (this._cachedStaff) {
            return this._cachedStaff;
        }
        return false;
    },

    // Async session kontrol - sayfa yuklenmesinde cagrilir
    async initializeAuth(): Promise<StaffInfo | false> {
        try {
            const supabase = getSupabase();
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                this._cachedStaff = null;
                return false;
            }

            const claims = session.user.app_metadata;
            if (!claims?.staff_id) {
                this._cachedStaff = null;
                return false;
            }

            const staff: StaffInfo = {
                id: String(claims.staff_id),
                name: claims.staff_name || session.user.email || '',
                email: session.user.email || '',
                role: claims.role || 'sales',
                isAdmin: !!claims.is_admin,
            };

            this._cachedStaff = staff;
            this._lastActivityTime = Date.now();
            this._startActivityTracking();

            return staff;
        } catch {
            this._cachedStaff = null;
            return false;
        }
    },

    // Session token
    getSessionToken(): string | null {
        return this._cachedStaff ? 'supabase-session-active' : null;
    },

    // Session kaydet
    saveSession(_token: string, staff: StaffInfo, _expiresAt: number): void {
        this._cachedStaff = staff;
        this._lastActivityTime = Date.now();
        this._startActivityTracking();
    },

    // Cikis yap
    async logout(): Promise<void> {
        try {
            const supabase = getSupabase();
            await supabase.auth.signOut();
        } catch {
            // Sessiz hata
        }
        this._cachedStaff = null;
        this._stopActivityTracking();
        location.reload();
    },

    // Session'i temizle (sayfa yenilemeden)
    async clearSession(): Promise<void> {
        try {
            const supabase = getSupabase();
            await supabase.auth.signOut();
        } catch {
            // Sessiz hata
        }
        this._cachedStaff = null;
        this._stopActivityTracking();
    },

    // Login modal goster (DOM API - XSS-safe)
    showLoginModal(): void {
        const modal = createLoginModalDOM();
        document.body.appendChild(modal);
        this._attachModalEvents();

        setTimeout(() => {
            document.getElementById('emailInput')?.focus();
        }, 100);
    },

    // Modal event listener'larini ekle
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

    // Giris yap - Supabase Auth
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
                errorDiv.textContent = 'Lutfen e-posta ve sifre girin';
                errorDiv.classList.add('show');
            }
            return;
        }

        const originalText = button.textContent;
        button.textContent = 'Giris yapiliyor...';
        button.disabled = true;

        try {
            const supabase = getSupabase();
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                if (errorDiv) {
                    errorDiv.textContent = error.message === 'Invalid login credentials'
                        ? 'Gecersiz e-posta veya sifre'
                        : error.message;
                    errorDiv.classList.add('show');
                }
                button.textContent = originalText;
                button.disabled = false;
                return;
            }

            if (data.session) {
                const claims = data.session.user.app_metadata;
                const staff: StaffInfo = {
                    id: String(claims?.staff_id || ''),
                    name: claims?.staff_name || data.session.user.email || '',
                    email: data.session.user.email || '',
                    role: claims?.role || 'sales',
                    isAdmin: !!claims?.is_admin,
                };

                this._cachedStaff = staff;
                this._lastActivityTime = Date.now();
                this._startActivityTracking();

                document.getElementById('authModal')?.remove();
                location.reload();
            }
        } catch {
            if (errorDiv) {
                errorDiv.textContent = 'Baglanti hatasi';
                errorDiv.classList.add('show');
            }
            button.textContent = originalText;
            button.disabled = false;
        }
    },

    // Sifremi unuttum modal (DOM API - XSS-safe)
    showForgotPasswordModal(): void {
        const modalContent = document.querySelector('.admin-auth-modal-content');
        if (!modalContent) return;

        createResetPasswordDOM(modalContent);

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

    // Sifre sifirla - Supabase Auth
    async resetPassword(): Promise<void> {
        const emailInput = document.getElementById('resetEmailInput') as HTMLInputElement | null;
        const errorDiv = document.getElementById('authError');
        const successDiv = document.getElementById('authSuccess');
        const button = document.getElementById('resetPasswordBtn') as HTMLButtonElement | null;

        if (!button || !emailInput) return;

        const email = emailInput.value.trim();

        if (!email) {
            if (errorDiv) {
                errorDiv.textContent = 'Lutfen e-posta adresinizi girin';
                errorDiv.classList.add('show');
            }
            return;
        }

        const originalText = button.textContent;
        button.textContent = 'Gonderiliyor...';
        button.disabled = true;

        try {
            const supabase = getSupabase();
            // admin.html sayfasına yönlendir (varsayılan index.html'e gider)
            const redirectUrl = window.location.origin + window.location.pathname;
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: redirectUrl,
            });

            if (error) {
                if (errorDiv) {
                    errorDiv.textContent = error.message;
                    errorDiv.classList.add('show');
                }
                button.textContent = originalText;
                button.disabled = false;
                return;
            }

            if (successDiv) {
                successDiv.textContent = 'Sifirlama linki e-posta adresinize gonderildi';
                successDiv.classList.add('show');
            }
            if (errorDiv) {
                errorDiv.classList.remove('show');
            }
            button.textContent = 'Gonderildi';
        } catch {
            if (errorDiv) {
                errorDiv.textContent = 'Baglanti hatasi';
                errorDiv.classList.add('show');
            }
            button.textContent = originalText;
            button.disabled = false;
        }
    },

    // Cikis butonu ekle
    addLogoutButton(): void {
        const header = document.querySelector('.header') as HTMLElement | null;
        if (!header) return;

        const staff = this.isAuthenticated();
        if (!staff) return;

        const userNameSpan = document.getElementById('adminUserName');
        if (userNameSpan) {
            userNameSpan.textContent = ` - ${staff.name}`;
        }

        const logoutBtn = document.createElement('button');
        logoutBtn.className = 'admin-logout-btn';
        logoutBtn.textContent = 'Logout';
        logoutBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to logout?')) {
                this.logout();
            }
        });

        header.style.position = 'relative';
        header.appendChild(logoutBtn);
    },

    getCurrentUser(): StaffInfo | null {
        return this._cachedStaff;
    },

    isAdmin(): boolean {
        return this._cachedStaff?.isAdmin || false;
    },

    _startActivityTracking(): void {
        let lastRefresh = Date.now();
        this._activityHandler = () => {
            this._lastActivityTime = Date.now();
            const now = Date.now();
            if (now - lastRefresh > 30_000) {
                lastRefresh = now;
            }
        };

        document.addEventListener('mousemove', this._activityHandler, { passive: true });
        document.addEventListener('keypress', this._activityHandler, { passive: true });
        document.addEventListener('click', this._activityHandler, { passive: true });
        document.addEventListener('scroll', this._activityHandler, { passive: true });
        document.addEventListener('touchstart', this._activityHandler, { passive: true });

        this._activityCheckInterval = setInterval(() => {
            const elapsed = Date.now() - this._lastActivityTime;
            if (elapsed > this.INACTIVITY_TIMEOUT) {
                const hours = Math.floor(SESSION_DURATION / (60 * 60 * 1000));
                alert(`${hours} saat boyunca islem yapilmadi. Guvenlik nedeniyle oturum kapatiliyor.`);
                this.logout();
            }
        }, 60 * 1000);
    },

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
    get API_KEY_STORAGE() {
        return 'admin_api_key';
    },

    clearLegacyAuth(): void {
        sessionStorage.removeItem('admin_api_key');
        sessionStorage.removeItem('admin_api_key_time');
    }
};

// Auth state listener
if (typeof window !== 'undefined') {
    try {
        const supabase = getSupabase();
        supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT') {
                AdminAuth._cachedStaff = null;
                AdminAuth._stopActivityTracking();
            } else if (event === 'PASSWORD_RECOVERY') {
                // Şifre sıfırlama linki ile geldi - şifre değiştirme modalı göster
                showPasswordChangeModal();
            } else if (event === 'SIGNED_IN' && session) {
                const claims = session.user.app_metadata;
                AdminAuth._cachedStaff = {
                    id: String(claims?.staff_id || ''),
                    name: claims?.staff_name || session.user.email || '',
                    email: session.user.email || '',
                    role: claims?.role || 'sales',
                    isAdmin: !!claims?.is_admin,
                };
            }
        });
    } catch {
        // Supabase henuz yapilandirilmamis olabilir
    }
}

/**
 * Şifre değiştirme modalı (PASSWORD_RECOVERY event'i geldiğinde gösterilir)
 */
function showPasswordChangeModal(): void {
    // Mevcut login modalını gizle
    const authModal = document.getElementById('authModal');
    if (authModal) authModal.style.display = 'none';

    // Şifre değiştirme modalı oluştur (DOM API - XSS-safe)
    const overlay = document.createElement('div');
    overlay.id = 'passwordChangeModal';
    overlay.className = 'admin-auth-modal';
    overlay.style.display = 'flex';

    const content = document.createElement('div');
    content.className = 'admin-auth-modal-content';

    const title = document.createElement('h2');
    title.className = 'admin-auth-title';
    title.textContent = 'Yeni Sifre Belirle';

    const subtitle = document.createElement('p');
    subtitle.className = 'admin-auth-subtitle';
    subtitle.textContent = 'Yeni sifrenizi girin';

    const errorDiv = document.createElement('div');
    errorDiv.id = 'pwChangeError';
    errorDiv.className = 'admin-auth-error';

    const successDiv = document.createElement('div');
    successDiv.id = 'pwChangeSuccess';
    successDiv.className = 'admin-auth-success';

    const form = document.createElement('form');
    form.autocomplete = 'on';

    // Yeni şifre input
    const pwGroup = document.createElement('div');
    pwGroup.className = 'admin-auth-input-group';
    const pwLabel = document.createElement('label');
    pwLabel.htmlFor = 'newPasswordInput';
    pwLabel.className = 'admin-auth-label';
    pwLabel.textContent = 'Yeni Sifre';
    const pwInput = document.createElement('input');
    pwInput.type = 'password';
    pwInput.id = 'newPasswordInput';
    pwInput.placeholder = 'En az 6 karakter';
    pwInput.className = 'admin-auth-input';
    pwInput.autocomplete = 'new-password';
    pwInput.minLength = 6;
    pwInput.required = true;
    pwGroup.appendChild(pwLabel);
    pwGroup.appendChild(pwInput);

    // Şifre tekrar input
    const pw2Group = document.createElement('div');
    pw2Group.className = 'admin-auth-input-group';
    const pw2Label = document.createElement('label');
    pw2Label.htmlFor = 'confirmPasswordInput';
    pw2Label.className = 'admin-auth-label';
    pw2Label.textContent = 'Sifre Tekrar';
    const pw2Input = document.createElement('input');
    pw2Input.type = 'password';
    pw2Input.id = 'confirmPasswordInput';
    pw2Input.placeholder = 'Sifrenizi tekrar girin';
    pw2Input.className = 'admin-auth-input';
    pw2Input.autocomplete = 'new-password';
    pw2Input.minLength = 6;
    pw2Input.required = true;
    pw2Group.appendChild(pw2Label);
    pw2Group.appendChild(pw2Input);

    // Kaydet butonu
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'admin-auth-submit';
    submitBtn.textContent = 'SIFREYI DEGISTIR';

    form.appendChild(pwGroup);
    form.appendChild(pw2Group);
    form.appendChild(submitBtn);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorDiv.classList.remove('show');
        successDiv.classList.remove('show');

        const newPw = pwInput.value;
        const confirmPw = pw2Input.value;

        if (newPw.length < 6) {
            errorDiv.textContent = 'Sifre en az 6 karakter olmalidir';
            errorDiv.classList.add('show');
            return;
        }

        if (newPw !== confirmPw) {
            errorDiv.textContent = 'Sifreler eslesmedi';
            errorDiv.classList.add('show');
            return;
        }

        submitBtn.textContent = 'Kaydediliyor...';
        submitBtn.disabled = true;

        try {
            const supabase = getSupabase();
            const { error } = await supabase.auth.updateUser({ password: newPw });

            if (error) {
                errorDiv.textContent = error.message;
                errorDiv.classList.add('show');
                submitBtn.textContent = 'SIFREYI DEGISTIR';
                submitBtn.disabled = false;
                return;
            }

            successDiv.textContent = 'Sifreniz basariyla degistirildi! Yonlendiriliyorsunuz...';
            successDiv.classList.add('show');

            // 2 saniye sonra admin panele yönlendir
            setTimeout(() => {
                // URL'deki hash token'ları temizle
                window.location.hash = '';
                window.location.reload();
            }, 2000);
        } catch {
            errorDiv.textContent = 'Baglanti hatasi';
            errorDiv.classList.add('show');
            submitBtn.textContent = 'SIFREYI DEGISTIR';
            submitBtn.disabled = false;
        }
    });

    content.appendChild(title);
    content.appendChild(subtitle);
    content.appendChild(errorDiv);
    content.appendChild(successDiv);
    content.appendChild(form);
    overlay.appendChild(content);
    document.body.appendChild(overlay);
}

export { AdminAuth };

declare global {
    interface Window {
        AdminAuth: typeof AdminAuth;
    }
}

if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'AdminAuth', {
        value: AdminAuth,
        writable: false,
        configurable: true,
        enumerable: true
    });
}
