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

        // Store original state (textContent for security)
        if (!btn.dataset.originalText) {
            btn.dataset.originalText = btn.textContent || '';
            btn.dataset.originalWidth = btn.offsetWidth + 'px';
            btn.dataset.originalMinWidth = btn.style.minWidth || '';
        }

        // Lock width to prevent jumping
        btn.style.minWidth = btn.dataset.originalWidth;

        // Set loading state with spinner
        btn.classList.add('btn-animating', 'btn-loading');
        (btn as HTMLButtonElement).disabled = true;

        // Clear and add spinner using DOM API
        while (btn.firstChild) btn.removeChild(btn.firstChild);
        const spinner = document.createElement('span');
        spinner.className = 'btn-spinner';
        btn.appendChild(spinner);
    },

    /**
     * Başarılı - SVG animated checkmark göster
     */
    success(button: HTMLElement | string, autoReset: boolean = true): void {
        const btn = this._getButton(button);
        if (!btn) return;

        // Switch to success state
        btn.classList.remove('btn-loading');
        btn.classList.add('btn-success');

        // Clear button content
        while (btn.firstChild) btn.removeChild(btn.firstChild);

        // Create SVG checkmark using DOM API
        const tickSpan = document.createElement('span');
        tickSpan.className = 'btn-tick';

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');

        const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        polyline.setAttribute('points', '4,12 9,17 20,6');

        svg.appendChild(polyline);
        tickSpan.appendChild(svg);
        btn.appendChild(tickSpan);

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

        // Clear button content and add cross using DOM API
        while (btn.firstChild) btn.removeChild(btn.firstChild);
        const crossSpan = document.createElement('span');
        crossSpan.className = 'btn-cross';
        btn.appendChild(crossSpan);

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

        // Restore original content (using textContent for security)
        if (btn.dataset.originalText) {
            btn.textContent = btn.dataset.originalText;
        }

        // Restore min-width
        btn.style.minWidth = btn.dataset.originalMinWidth || '';

        // Clean up data attributes
        delete btn.dataset.originalText;
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
 * Tasarım: https://codepen.io/fxm90/pen/wJLjgB benzeri
 * Renkler: Site teması (#1A1A2E, #C9A55A, #FAFAFA)
 */
export function injectButtonAnimationStyles(): void {
    if (document.getElementById('btn-animation-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'btn-animation-styles';
    styles.textContent = `
        /* ==================== BUTTON ANIMATION ==================== */

        .btn-animating {
            position: relative;
            pointer-events: none;
        }

        /* Loading state - Buton görünmez, sadece spinner */
        .btn-animating.btn-loading {
            background: transparent !important;
            border-color: transparent !important;
            box-shadow: none !important;
        }

        /* Spinner - Altın rengi dönen border */
        .btn-spinner {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid rgba(201, 165, 90, 0.3);
            border-top-color: #C9A55A;
            border-radius: 50%;
            animation: btn-spin 0.8s linear infinite;
        }

        @keyframes btn-spin {
            to { transform: rotate(360deg); }
        }

        /* Success state - Buton görünür, içinde beyaz tick */
        .btn-animating.btn-success {
            /* Buton stili korunur */
        }

        /* Checkmark - SVG animated tick (beyaz) */
        .btn-tick {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 20px;
            height: 20px;
        }

        .btn-tick svg {
            width: 100%;
            height: 100%;
            fill: none;
            stroke: #fff;
            stroke-width: 3;
            stroke-linecap: round;
            stroke-linejoin: round;
        }

        .btn-secondary .btn-tick svg {
            stroke: #1A1A2E;
        }

        .btn-tick svg polyline {
            stroke-dasharray: 30;
            stroke-dashoffset: 30;
            animation: checkmark-draw 0.4s ease-out forwards;
        }

        @keyframes checkmark-draw {
            to { stroke-dashoffset: 0; }
        }

        /* Error state - Buton görünür, içinde X */
        .btn-animating.btn-error {
            /* Buton stili korunur */
        }

        /* X işareti (beyaz) */
        .btn-cross {
            display: inline-block;
            width: 16px;
            height: 16px;
            position: relative;
        }

        .btn-cross::before,
        .btn-cross::after {
            content: '';
            position: absolute;
            background: #fff;
            border-radius: 2px;
            width: 2px;
            height: 0;
            left: 50%;
            top: 50%;
            transform-origin: center;
        }

        .btn-secondary .btn-cross::before,
        .btn-secondary .btn-cross::after {
            background: #C62828;
        }

        .btn-cross::before {
            transform: translate(-50%, -50%) rotate(45deg);
            animation: cross-draw 0.2s ease-out forwards;
        }

        .btn-cross::after {
            transform: translate(-50%, -50%) rotate(-45deg);
            animation: cross-draw 0.2s ease-out 0.1s forwards;
        }

        @keyframes cross-draw {
            to { height: 12px; }
        }

        /* Small buttons */
        .btn-small .btn-spinner {
            width: 16px;
            height: 16px;
            border-width: 2px;
        }

        .btn-small .btn-tick {
            width: 16px;
            height: 16px;
        }

        .btn-small .btn-tick svg {
            stroke-width: 2.5;
        }

        .btn-small .btn-cross {
            width: 12px;
            height: 12px;
        }

        .btn-small .btn-cross::before,
        .btn-small .btn-cross::after {
            animation-name: cross-draw-small;
        }

        @keyframes cross-draw-small {
            to { height: 10px; }
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
