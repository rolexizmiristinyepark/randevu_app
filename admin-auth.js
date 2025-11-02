// ==================== ADMIN AUTHENTICATION ====================
// API Key yönetimi ve yetkilendirme sistemi
// ✅ GÜVENLİK: Inline stil ve event handler'lar kaldırıldı

import { ApiService } from './api-service.js';

const AdminAuth = {
    API_KEY_STORAGE: 'admin_api_key',
    SESSION_DURATION: 24 * 60 * 60 * 1000, // 24 saat

    // Stil tanımlarını inject et (sayfa başına bir kez)
    _injectStyles() {
        if (document.getElementById('adminAuthStyles')) return; // Zaten enjekte edilmiş

        const styles = document.createElement('style');
        styles.id = 'adminAuthStyles';
        styles.textContent = `
            /* Admin Auth Modal Styles */
            .admin-auth-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            }

            .admin-auth-modal-content {
                background: white;
                border-radius: 15px;
                padding: 40px;
                max-width: 450px;
                width: 90%;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            }

            .admin-auth-title {
                margin: 0 0 10px 0;
                color: #333;
                font-size: 24px;
                text-align: center;
            }

            .admin-auth-subtitle {
                color: #666;
                text-align: center;
                margin-bottom: 30px;
                font-size: 14px;
            }

            .admin-auth-error {
                display: none;
                background: #f8d7da;
                color: #721c24;
                padding: 12px;
                border-radius: 8px;
                margin-bottom: 20px;
                font-size: 14px;
            }

            .admin-auth-error.show {
                display: block;
            }

            .admin-auth-input-group {
                margin-bottom: 20px;
            }

            .admin-auth-label {
                display: block;
                margin-bottom: 8px;
                color: #555;
                font-size: 14px;
                font-weight: 500;
            }

            .admin-auth-input {
                width: 100%;
                padding: 12px;
                border: 1px solid #E8E8E8;
                border-radius: 2px;
                font-size: 14px;
                font-family: 'Montserrat', monospace, sans-serif;
                box-sizing: border-box;
                transition: all 0.3s;
            }

            .admin-auth-input:focus {
                outline: none;
                border-color: #C9A55A;
                box-shadow: 0 0 0 2px rgba(201, 165, 90, 0.1);
            }

            .admin-auth-btn {
                width: 100%;
                padding: 14px;
                background: #1A1A2E;
                color: #FAFAFA;
                border: 1px solid #1A1A2E;
                border-radius: 2px;
                font-size: 12px;
                font-weight: 500;
                letter-spacing: 1.5px;
                text-transform: uppercase;
                cursor: pointer;
                transition: all 0.3s;
                font-family: 'Montserrat', sans-serif;
            }

            .admin-auth-btn:hover:not(:disabled) {
                background: #C9A55A;
                border-color: #C9A55A;
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(201, 165, 90, 0.2);
            }

            .admin-auth-btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }

            .admin-auth-divider {
                margin-top: 25px;
                padding-top: 25px;
                border-top: 1px solid #E8E8E8;
                text-align: center;
            }

            .admin-auth-help-text {
                color: #757575;
                font-size: 11px;
                letter-spacing: 0.5px;
                margin-bottom: 15px;
            }

            .admin-auth-btn-secondary {
                padding: 10px 20px;
                background: white;
                color: #1A1A2E;
                border: 1px solid #E8E8E8;
                border-radius: 2px;
                font-size: 11px;
                font-weight: 500;
                letter-spacing: 1px;
                text-transform: uppercase;
                cursor: pointer;
                transition: all 0.3s;
                font-family: 'Montserrat', sans-serif;
            }

            .admin-auth-btn-secondary:hover:not(:disabled) {
                background: #FAFAFA;
                border-color: #C9A55A;
            }

            .admin-auth-btn-secondary:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }

            .admin-logout-btn {
                position: absolute;
                right: 25px;
                top: 50%;
                transform: translateY(-50%);
                padding: 8px 18px;
                background: transparent;
                color: #757575;
                border: 1px solid #E8E8E8;
                border-radius: 2px;
                font-size: 10px;
                font-weight: 500;
                letter-spacing: 1px;
                text-transform: uppercase;
                cursor: pointer;
                transition: all 0.3s;
                font-family: 'Montserrat', sans-serif;
            }

            .admin-logout-btn:hover {
                background: #1A1A2E;
                color: #FAFAFA;
                border-color: #1A1A2E;
            }
        `;
        document.head.appendChild(styles);
    },

    // API key kontrolü
    isAuthenticated() {
        const savedKey = localStorage.getItem(this.API_KEY_STORAGE);
        const savedTime = localStorage.getItem(this.API_KEY_STORAGE + '_time');

        if (!savedKey || !savedTime) return false;

        // Session timeout kontrolü
        const elapsed = Date.now() - parseInt(savedTime);
        if (elapsed > this.SESSION_DURATION) {
            this.logout();
            return false;
        }

        return savedKey;
    },

    // API key kaydet
    saveApiKey(apiKey) {
        localStorage.setItem(this.API_KEY_STORAGE, apiKey);
        localStorage.setItem(this.API_KEY_STORAGE + '_time', Date.now().toString());
    },

    // Çıkış yap
    logout() {
        localStorage.removeItem(this.API_KEY_STORAGE);
        localStorage.removeItem(this.API_KEY_STORAGE + '_time');
        location.reload();
    },

    // Login modal göster
    showLoginModal() {
        // Stilleri inject et
        this._injectStyles();

        // Modal HTML oluştur (temiz, inline stil yok)
        const modalHtml = `
            <div id="authModal" class="admin-auth-modal">
                <div class="admin-auth-modal-content">
                    <h2 class="admin-auth-title">🔐 Admin Girişi</h2>
                    <p class="admin-auth-subtitle">Admin paneline erişmek için API key'inizi girin</p>

                    <div id="authError" class="admin-auth-error"></div>

                    <div class="admin-auth-input-group">
                        <label for="apiKeyInput" class="admin-auth-label">API Key</label>
                        <input type="password" id="apiKeyInput" placeholder="RLX_..." class="admin-auth-input" autocomplete="off">
                    </div>

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
    async login() {
        const apiKey = document.getElementById('apiKeyInput')?.value.trim();
        const errorDiv = document.getElementById('authError');
        const button = document.getElementById('adminLoginBtn');

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
            } else if (response.requiresAuth) {
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
                errorDiv.textContent = '❌ Bağlantı hatası: ' + error.message;
                errorDiv.classList.add('show');
            }
            button.textContent = originalText;
            button.disabled = false;
        }
    },

    // API key iste
    async requestApiKey() {
        const button = document.getElementById('adminRequestKeyBtn');
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
    addLogoutButton() {
        const header = document.querySelector('.header');
        if (!header) return;

        // Stilleri inject et
        this._injectStyles();

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
    }
};

// Export for ES6 modules
export { AdminAuth };

// Also expose globally for backward compatibility
if (typeof window !== 'undefined') {
    window.AdminAuth = AdminAuth;
}
