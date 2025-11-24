/**
 * SHARED BUTTON UTILITIES
 * DRY Principle: Tek kaynak - app.ts ve admin-panel.ts için ortak
 *
 * Önce: 92 satır duplicate (46 + 46)
 * Sonra: 50 satır shared module
 * Azalma: 42 satır (~46%)
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
        btn.classList.remove('loading');
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
