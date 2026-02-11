/**
 * Turnstile initialization script
 *
 * Cloudflare Turnstile widget'ını programatik olarak render eder.
 * onload callback KULLANILMIYOR çünkü type="module" deferred yüklenir
 * ve Turnstile API'sı module'den önce hazır olabiliyor → callback bulunamıyor.
 * Bunun yerine: config yüklendikten sonra turnstile API'yı poll edip render ediyoruz.
 */

declare global {
    interface Window {
        turnstile: {
            render: (element: HTMLElement, options: TurnstileOptions) => string;
            reset: (widgetId?: string | HTMLElement) => void;
            getResponse: (widgetId?: string | HTMLElement) => string;
        };
        turnstileVerified: boolean;
        turnstileWidgetId: string | null;
        TURNSTILE_SITE_KEY: string;
    }
}

interface TurnstileOptions {
    sitekey: string;
    callback: (token: string) => void;
    theme?: 'light' | 'dark' | 'auto';
    size?: 'normal' | 'compact';
}

window.turnstileWidgetId = null;

/**
 * Turnstile widget'ını render et.
 * Hem window.turnstile (API) hem window.TURNSTILE_SITE_KEY (config) hazır olmalı.
 */
function renderTurnstile(): boolean {
    const widget = document.getElementById('turnstileWidget');
    const siteKey = (window.TURNSTILE_SITE_KEY || '').trim();

    if (!widget || !window.turnstile || !siteKey) {
        return false;
    }

    // Zaten render edilmişse tekrar yapma
    if (window.turnstileWidgetId != null) {
        return true;
    }

    console.log('Turnstile rendering with key:', siteKey.substring(0, 10) + '...');

    window.turnstileWidgetId = window.turnstile.render(widget, {
        sitekey: siteKey,
        callback: function(token: string): void {
            console.log('Turnstile verified, token length:', token.length);
            window.turnstileVerified = true;

            // Show submit button when verified
            const submitBtn = document.getElementById('submitBtn');
            const detailsSection = document.getElementById('detailsSection');
            if (submitBtn && detailsSection && detailsSection.style.display !== 'none') {
                submitBtn.style.display = 'block';
            }
        },
        theme: 'light',
        size: 'normal'
    });
    console.log('Turnstile widget rendered, id:', window.turnstileWidgetId);
    return true;
}

/**
 * Turnstile API ve config hazır olana kadar bekle, sonra render et.
 * Max 15 saniye bekler (150 * 100ms).
 */
function waitAndRender(): void {
    let attempts = 0;
    const maxAttempts = 150;

    const interval = setInterval(() => {
        attempts++;
        if (renderTurnstile() || attempts >= maxAttempts) {
            clearInterval(interval);
            if (attempts >= maxAttempts) {
                console.warn('Turnstile: API veya config yüklenemedi, widget render edilemedi');
            }
        }
    }, 100);
}

// Sayfa yüklendiğinde başlat
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waitAndRender);
    } else {
        waitAndRender();
    }
}

export {};
