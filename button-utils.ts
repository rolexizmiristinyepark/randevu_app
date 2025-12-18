/**
 * SHARED BUTTON UTILITIES
 * DRY Principle: Tek kaynak - app.ts ve admin-panel.ts için ortak
 *
 * v3.4: Spinner + Success/Error tick animasyonu eklendi
 * Dribbble-style: Küçülme → Spinner → Tick/X animasyonu
 */

/**
 * Button loading state yönetimi için yardımcı fonksiyonlar
 * Kullanım: Loading state gösterme/gizleme, text değiştirme
 */
export const ButtonUtils = {
    /**
     * Butonu loading state'e al
     * @param button - Button element veya element ID
     * @param loadingText - Opsiyonel loading text (örn: "Kaydediliyor...")
     *
     * @example
     * ButtonUtils.setLoading('submitBtn', 'Gönderiliyor...');
     * ButtonUtils.setLoading(document.getElementById('saveBtn'));
     */
    setLoading(button: HTMLElement | string, loadingText: string | null = null): void {
        const btn = typeof button === 'string'
            ? document.getElementById(button)
            : button;

        if (!btn) {
            console.warn(`[ButtonUtils.setLoading] Button bulunamadı:`, button);
            return;
        }

        // Store original content (ilk kez set ediliyorsa)
        if (!btn.dataset.originalText) {
            btn.dataset.originalText = btn.textContent || '';
        }
        if (!btn.dataset.originalWidth) {
            btn.dataset.originalWidth = btn.offsetWidth + 'px';
        }

        // Set loading state
        btn.classList.add('loading');
        (btn as HTMLButtonElement).disabled = true;

        // Update text if provided
        if (loadingText) {
            btn.textContent = loadingText;
        }
    },

    /**
     * Butonu loading state'den çıkar, normal haline döndür
     * @param button - Button element veya element ID
     * @param newText - Opsiyonel yeni text (originalText'i override eder)
     *
     * @example
     * ButtonUtils.reset('submitBtn');
     * ButtonUtils.reset('saveBtn', 'Tekrar Kaydet');
     */
    reset(button: HTMLElement | string, newText: string | null = null): void {
        const btn = typeof button === 'string'
            ? document.getElementById(button)
            : button;

        if (!btn) {
            console.warn(`[ButtonUtils.reset] Button bulunamadı:`, button);
            return;
        }

        // Reset loading state
        btn.classList.remove('loading', 'btn-success', 'btn-error');
        (btn as HTMLButtonElement).disabled = false;

        // Restore or update text
        if (newText) {
            btn.textContent = newText;
            // Update stored original text
            btn.dataset.originalText = newText;
        } else if (btn.dataset.originalText) {
            btn.textContent = btn.dataset.originalText;
        }
    }
};

/**
 * ButtonAnimator - Dribbble-style button animation
 *
 * Animasyon akışı:
 * 1. Butona tıklanınca küçülür + spinner döner
 * 2. İşlem bitince tick (✓) veya X animasyonu
 * 3. Kısa süre sonra normal haline döner
 *
 * @example
 * const btn = document.getElementById('saveBtn');
 * ButtonAnimator.start(btn);
 * await saveData();
 * ButtonAnimator.success(btn); // veya ButtonAnimator.error(btn);
 */
export const ButtonAnimator = {
    /**
     * Animasyonu başlat - spinner göster
     */
    start(button: HTMLElement | string): void {
        const btn = this._getButton(button);
        if (!btn) return;

        // Store original state
        if (!btn.dataset.originalHtml) {
            btn.dataset.originalHtml = btn.innerHTML;
            btn.dataset.originalWidth = btn.offsetWidth + 'px';
            btn.dataset.originalMinWidth = btn.style.minWidth || '';
        }

        // Lock width to prevent jumping
        btn.style.minWidth = btn.dataset.originalWidth;

        // Set loading state with spinner
        btn.classList.add('btn-animating', 'btn-loading');
        (btn as HTMLButtonElement).disabled = true;
        btn.innerHTML = '<span class="btn-spinner"></span>';
    },

    /**
     * Başarılı - tick animasyonu göster
     */
    success(button: HTMLElement | string, autoReset: boolean = true): void {
        const btn = this._getButton(button);
        if (!btn) return;

        // Switch to success state
        btn.classList.remove('btn-loading');
        btn.classList.add('btn-success');
        btn.innerHTML = '<span class="btn-tick"></span>';

        // Auto reset after delay
        if (autoReset) {
            setTimeout(() => this.reset(btn), 1500);
        }
    },

    /**
     * Hata - X animasyonu göster
     */
    error(button: HTMLElement | string, autoReset: boolean = true): void {
        const btn = this._getButton(button);
        if (!btn) return;

        // Switch to error state
        btn.classList.remove('btn-loading');
        btn.classList.add('btn-error');
        btn.innerHTML = '<span class="btn-cross"></span>';

        // Auto reset after delay
        if (autoReset) {
            setTimeout(() => this.reset(btn), 1500);
        }
    },

    /**
     * Normal haline döndür
     */
    reset(button: HTMLElement | string): void {
        const btn = this._getButton(button);
        if (!btn) return;

        // Remove all animation classes
        btn.classList.remove('btn-animating', 'btn-loading', 'btn-success', 'btn-error');
        (btn as HTMLButtonElement).disabled = false;

        // Restore original content
        if (btn.dataset.originalHtml) {
            btn.innerHTML = btn.dataset.originalHtml;
        }

        // Restore min-width
        btn.style.minWidth = btn.dataset.originalMinWidth || '';

        // Clean up data attributes
        delete btn.dataset.originalHtml;
        delete btn.dataset.originalWidth;
        delete btn.dataset.originalMinWidth;
    },

    /**
     * Helper: Get button element
     */
    _getButton(button: HTMLElement | string): HTMLElement | null {
        const btn = typeof button === 'string'
            ? document.getElementById(button)
            : button;

        if (!btn) {
            console.warn(`[ButtonAnimator] Button bulunamadı:`, button);
            return null;
        }

        return btn;
    }
};

/**
 * CSS'i sayfaya inject et (bir kez)
 */
export function injectButtonAnimationStyles(): void {
    if (document.getElementById('btn-animation-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'btn-animation-styles';
    styles.textContent = `
        /* Button Animation Base */
        .btn-animating {
            position: relative;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            overflow: hidden;
        }

        .btn-animating.btn-loading {
            transform: scale(0.95);
            opacity: 0.9;
        }

        /* Spinner */
        .btn-spinner {
            display: inline-block;
            width: 18px;
            height: 18px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-top-color: #fff;
            border-radius: 50%;
            animation: btn-spin 0.8s linear infinite;
        }

        .btn-secondary .btn-spinner {
            border-color: rgba(26, 26, 46, 0.2);
            border-top-color: #1A1A2E;
        }

        @keyframes btn-spin {
            to { transform: rotate(360deg); }
        }

        /* Success Tick - buton kendi rengini koruyor */
        .btn-success {
            transform: scale(1);
        }

        .btn-tick {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 18px;
            height: 18px;
            font-size: 18px;
            line-height: 1;
            color: #fff;
            animation: tick-appear 0.25s ease-out forwards;
        }

        .btn-tick::before {
            content: '✓';
        }

        /* Secondary butonlar için koyu tick */
        .btn-secondary .btn-tick {
            color: #1A1A2E;
        }

        @keyframes tick-appear {
            from {
                opacity: 0;
                transform: scale(0.5);
            }
            to {
                opacity: 1;
                transform: scale(1);
            }
        }

        /* Error Cross - buton kendi rengini koruyor */
        .btn-error {
            transform: scale(1);
        }

        .btn-cross {
            display: inline-block;
            width: 18px;
            height: 18px;
            position: relative;
        }

        .btn-cross::before,
        .btn-cross::after {
            content: '';
            position: absolute;
            background: #fff;
            border-radius: 1px;
            width: 2px;
            height: 12px;
            left: 50%;
            top: 50%;
        }

        /* Secondary butonlar için koyu cross */
        .btn-secondary .btn-cross::before,
        .btn-secondary .btn-cross::after {
            background: #1A1A2E;
        }

        .btn-cross::before {
            transform: translate(-50%, -50%) rotate(45deg);
            animation: cross-appear 0.15s ease-out forwards;
        }

        .btn-cross::after {
            transform: translate(-50%, -50%) rotate(-45deg);
            animation: cross-appear 0.15s ease-out 0.05s forwards;
        }

        @keyframes cross-appear {
            from {
                height: 0;
                opacity: 0;
            }
            to {
                height: 12px;
                opacity: 1;
            }
        }

        /* Small buttons adjustment */
        .btn-small .btn-spinner,
        .btn-small .btn-tick,
        .btn-small .btn-cross {
            width: 14px;
            height: 14px;
        }

        .btn-small .btn-spinner {
            border-width: 2px;
        }

        .btn-small .btn-tick {
            font-size: 14px;
        }

        .btn-small .btn-cross::before,
        .btn-small .btn-cross::after {
            height: 10px;
            width: 1.5px;
        }

        /* Large buttons */
        .btn-large .btn-spinner {
            width: 24px;
            height: 24px;
            border-width: 3px;
        }

        .btn-large .btn-tick,
        .btn-large .btn-cross {
            width: 24px;
            height: 24px;
        }

        .btn-large .btn-tick {
            font-size: 24px;
        }

        /* Subtle scale back to normal */
        .btn-success,
        .btn-error {
            animation: btn-complete 0.3s ease-out;
        }

        @keyframes btn-complete {
            from { transform: scale(0.95); }
            to { transform: scale(1); }
        }
    `;

    document.head.appendChild(styles);
}

// Auto-inject styles when module loads
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectButtonAnimationStyles);
    } else {
        injectButtonAnimationStyles();
    }
}
