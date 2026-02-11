/**
 * Turnstile initialization script
 *
 * This file initializes Cloudflare Turnstile widget.
 * Must be loaded BEFORE the Turnstile API script.
 */

declare global {
    interface Window {
        onloadTurnstileCallback: () => void;
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

/**
 * Turnstile callback - invoked when API script loads
 */
window.turnstileWidgetId = null;

window.onloadTurnstileCallback = function(): void {
    const widget = document.getElementById('turnstileWidget');
    const siteKey = (window.TURNSTILE_SITE_KEY || '').trim();

    console.log('Turnstile loading with key:', siteKey.substring(0, 10) + '...');

    if (widget && window.turnstile) {
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
    }
};

export {};
