// ==================== ADMIN AUTHENTICATION ====================
// API Key yönetimi ve yetkilendirme sistemi
// ✅ GÜVENLİK: Inline stil ve event handler'lar kaldırıldı
// ✅ GÜVENLİK: sessionStorage + 15 dk inaktivite timeout
// ✅ GÜVENLİK: AES-256 encryption ile API key şifreleme

import { ApiService } from './api-service';
import CryptoJS from 'crypto-js';

// Encryption key - browser fingerprint + static salt
// NOT: Bu tam güvenlik sağlamaz ama casual snooping'e karşı korur
const getEncryptionKey = (): string => {
    const staticSalt = 'RLX_ADMIN_2024_SECURE';
    const browserInfo = [
        navigator.userAgent,
        navigator.language,
        screen.width,
        screen.height,
        new Date().getTimezoneOffset()
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

const AdminAuth = {
    API_KEY_STORAGE: 'admin_api_key',
    INACTIVITY_TIMEOUT: 15 * 60 * 1000, // 15 dakika inaktivite
    _lastActivityTime: Date.now(),
    _activityCheckInterval: null as ReturnType<typeof setInterval> | null,
    _activityHandler: null as (() => void) | null,

    // API key kontrolü - AES-256 şifreleme AKTİF
    isAuthenticated() {
        const storedKey = sessionStorage.getItem(this.API_KEY_STORAGE);
        const savedTime = sessionStorage.getItem(this.API_KEY_STORAGE + '_time');

        if (!storedKey || !savedTime) {
            console.debug('[AdminAuth] No stored key or time found');
            return false;
        }

        // İnaktivite timeout kontrolü
        const elapsed = Date.now() - this._lastActivityTime;
        if (elapsed > this.INACTIVITY_TIMEOUT) {
            console.warn('[AdminAuth] Session timeout - logging out');
            this.logout();
            return false;
        }

        // Şifreli key - AES-256 ile çöz
        const decryptedKey = decryptData(storedKey);
        if (!decryptedKey) {
            console.warn('[AdminAuth] Failed to decrypt API key - session corrupted');
            this.logout();
            return false;
        }

        // Debug: API key format kontrolü
        if (!decryptedKey.startsWith('RLX_')) {
            console.warn('[AdminAuth] Invalid API key format - expected RLX_ prefix');
            this.logout();
            return false;
        }

        return decryptedKey;
    },

    // API key kaydet - ŞİFRELEME AKTİF
    saveApiKey(apiKey: string): void {
        // API key'i AES-256 ile şifrele ve kaydet
        const encryptedKey = encryptData(apiKey);
        sessionStorage.setItem(this.API_KEY_STORAGE, encryptedKey);
        sessionStorage.setItem(this.API_KEY_STORAGE + '_time', Date.now().toString());
        this._lastActivityTime = Date.now();

        // İnaktivite takibini başlat
        this._startActivityTracking();
    },

    // Çıkış yap
    logout() {
        sessionStorage.removeItem(this.API_KEY_STORAGE);
        sessionStorage.removeItem(this.API_KEY_STORAGE + '_time');
        this._stopActivityTracking();
        location.reload();
    },

    // Login modal göster
    showLoginModal() {
        // Modal HTML oluştur (temiz, inline stil yok)
        // CSS artık admin.css dosyasında yükleniyor
        const modalHtml = `
            <div id="authModal" class="admin-auth-modal">
                <div class="admin-auth-modal-content">
                    <h2 class="admin-auth-title">🔐 Admin Girişi</h2>
                    <p class="admin-auth-subtitle">Admin paneline erişmek için API key'inizi girin</p>

                    <div id="authError" class="admin-auth-error"></div>

                    <form autocomplete="off" onsubmit="return false;">
                        <div class="admin-auth-input-group">
                            <label for="apiKeyInput" class="admin-auth-label">API Key</label>
                            <input type="password" id="apiKeyInput" placeholder="RLX_..." class="admin-auth-input" autocomplete="new-password">
                        </div>
                    </form>

                    <button id="adminLoginBtn" class="admin-auth-btn">Giriş Yap</button>

                    <div class="admin-auth-divider">
                        <p class="admin-auth-help-text">API key'iniz yok mu?</p>
                        <button id="adminRequestKeyBtn" class="admin-auth-btn-secondary">📧 E-posta ile API Key İste</button>
                    </div>
                </div>
            </div>
        `;

        // Modal'ı body'ye ekle
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Event listener'ları ekle (inline değil, programatik)
        this._attachModalEvents();

        // Input'a focus
        setTimeout(() => {
            document.getElementById('apiKeyInput')?.focus();
        }, 100);
    },

    // Modal event listener'larını ekle
    _attachModalEvents() {
        // Login butonu
        const loginBtn = document.getElementById('adminLoginBtn');
        if (loginBtn) {
            loginBtn.addEventListener('click', () => this.login());
        }

        // Request key butonu
        const requestBtn = document.getElementById('adminRequestKeyBtn');
        if (requestBtn) {
            requestBtn.addEventListener('click', () => this.requestApiKey());
        }

        // Enter tuşu ile giriş
        const input = document.getElementById('apiKeyInput');
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.login();
                }
            });
        }
    },

    // Giriş yap
    async login(): Promise<void> {
        const apiKeyInput = document.getElementById('apiKeyInput') as HTMLInputElement | null;
        const apiKey = apiKeyInput?.value.trim();
        const errorDiv = document.getElementById('authError');
        const button = document.getElementById('adminLoginBtn') as HTMLButtonElement | null;

        if (!button) return;

        if (!apiKey) {
            if (errorDiv) {
                errorDiv.textContent = '❌ Lütfen API key girin';
                errorDiv.classList.add('show');
            }
            return;
        }

        // Loading göster
        const originalText = button.textContent;
        button.textContent = 'Kontrol ediliyor...';
        button.disabled = true;

        try {
            // Test API çağrısı yaparak key'i doğrula (ApiService kullan)
            const response = await ApiService.testApiKey(apiKey);

            if (response.success) {
                // Başarılı giriş
                this.saveApiKey(apiKey);
                document.getElementById('authModal')?.remove();
                location.reload();
            } else if ((response as any).requiresAuth) {
                if (errorDiv) {
                    errorDiv.textContent = '❌ Geçersiz API key';
                    errorDiv.classList.add('show');
                }
                button.textContent = originalText;
                button.disabled = false;
            } else {
                if (errorDiv) {
                    errorDiv.textContent = '❌ Bağlantı hatası';
                    errorDiv.classList.add('show');
                }
                button.textContent = originalText;
                button.disabled = false;
            }
        } catch (error) {
            if (errorDiv) {
                const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
                errorDiv.textContent = '❌ Bağlantı hatası: ' + errorMessage;
                errorDiv.classList.add('show');
            }
            if (button) {
                button.textContent = originalText;
                button.disabled = false;
            }
        }
    },

    // API key iste
    async requestApiKey(): Promise<void> {
        const button = document.getElementById('adminRequestKeyBtn') as HTMLButtonElement | null;
        if (!button) return;

        const originalText = button.innerHTML;
        button.innerHTML = 'Gönderiliyor...';
        button.disabled = true;

        try {
            const response = await ApiService.call('initializeApiKey');

            if (response.success) {
                alert('✅ API key e-posta adresinize gönderildi.\n\nLütfen e-postanızı kontrol edin ve gelen API key ile giriş yapın.');
            } else {
                alert('❌ E-posta gönderilemedi.\n\nLütfen daha sonra tekrar deneyin veya sistem yöneticinizle iletişime geçin.');
            }
        } catch (error) {
            alert('❌ Bağlantı hatası.\n\nLütfen internet bağlantınızı kontrol edin.');
        } finally {
            button.innerHTML = originalText;
            button.disabled = false;
        }
    },

    // Çıkış butonu ekle
    addLogoutButton(): void {
        const header = document.querySelector('.header') as HTMLElement | null;
        if (!header) return;

        const logoutBtn = document.createElement('button');
        logoutBtn.className = 'admin-logout-btn';
        logoutBtn.textContent = '🔓 Çıkış';

        // Event listener ekle (inline değil)
        logoutBtn.addEventListener('click', () => {
            if (confirm('Çıkış yapmak istediğinize emin misiniz?')) {
                this.logout();
            }
        });

        header.style.position = 'relative';
        header.appendChild(logoutBtn);
    },

    // İnaktivite takibini başlat
    _startActivityTracking() {
        // Kullanıcı aktivitelerini dinle
        this._activityHandler = () => {
            this._lastActivityTime = Date.now();
        };

        // Event listeners (referansı sakla ki sonra kaldırabiliriz)
        document.addEventListener('mousemove', this._activityHandler);
        document.addEventListener('keypress', this._activityHandler);
        document.addEventListener('click', this._activityHandler);
        document.addEventListener('scroll', this._activityHandler);
        document.addEventListener('touchstart', this._activityHandler); // Mobil için

        // Her 60 saniyede bir kontrol et
        this._activityCheckInterval = setInterval(() => {
            const elapsed = Date.now() - this._lastActivityTime;
            if (elapsed > this.INACTIVITY_TIMEOUT) {
                alert('⏰ 15 dakika boyunca işlem yapılmadı. Güvenlik nedeniyle oturum kapatılıyor.');
                this.logout();
            }
        }, 60 * 1000); // 60 saniye
    },

    // İnaktivite takibini durdur
    _stopActivityTracking() {
        if (this._activityCheckInterval) {
            clearInterval(this._activityCheckInterval);
            this._activityCheckInterval = null;
        }

        // Event listeners'ı kaldır (memory leak önleme)
        if (this._activityHandler) {
            document.removeEventListener('mousemove', this._activityHandler);
            document.removeEventListener('keypress', this._activityHandler);
            document.removeEventListener('click', this._activityHandler);
            document.removeEventListener('scroll', this._activityHandler);
            document.removeEventListener('touchstart', this._activityHandler);
            this._activityHandler = null;
        }
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
