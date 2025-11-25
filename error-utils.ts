/**
 * ERROR HANDLING YARDIMCI FONKSİYONLARI
 * DRY Principle: Tek kaynak olarak hata yönetimi
 *
 * Bu modül önce:
 * - admin-panel.ts: 19+ tekrarlanan error handling pattern'ini çözer
 * - Standardize edilmiş hata mesajları
 * - Logging integration
 */

// Lazy initialization to avoid side effects during tests
let logError: ((error: any, context?: any) => void) | null = null;

function getLogError(): (error: any, context?: any) => void {
    if (logError === null) {
        try {
            // Try to use window.logError if available
            if (typeof globalThis !== 'undefined' && (globalThis as any).window?.logError) {
                logError = (globalThis as any).window.logError;
            } else {
                // Fallback to console.error (test environment or server-side)
                logError = (error: any, context?: any) => {
                    console.error('[App Error]', error, context || {});
                };
            }
        } catch {
            // Final fallback
            logError = (error: any, context?: any) => {
                console.error('[App Error]', error, context || {});
            };
        }
    }
    return logError!;
}

interface ApiErrorResponse {
    error?: string;
    [key: string]: unknown;
}

interface IErrorUtils {
    /**
     * API hata yanıtını standart formatta handle eder
     * @param response - API'den gelen hata response'u
     * @param action - Yapılan işlem (logging için)
     * @param showAlert - UI.showAlert fonksiyonu (opsiyonel, test için inject)
     * @example
     * ErrorUtils.handleApiError(
     *   { error: "Staff not found" },
     *   "saveSettings"
     * );
     * // UI'da gösterir: "❌ Hata: Staff not found"
     * // Log'a kaydeder: action=saveSettings
     */
    handleApiError(
        response: ApiErrorResponse,
        action: string,
        showAlert?: (message: string, type: string) => void
    ): void;

    /**
     * Exception'ı standart formatta handle eder
     * @param error - Yakalanan hata
     * @param action - Yapılan işlem
     * @param showAlert - UI.showAlert fonksiyonu (opsiyonel, test için inject)
     * @example
     * try {
     *   await doSomething();
     * } catch (error) {
     *   ErrorUtils.handleException(error, "Ekleme");
     *   // UI'da gösterir: "❌ Ekleme hatası: Network error"
     * }
     */
    handleException(
        error: Error | unknown,
        action: string,
        showAlert?: (message: string, type: string) => void
    ): void;

    /**
     * Async işlem sırasında oluşan hataları otomatik handle eder (wrapper)
     * @param asyncFn - Async fonksiyon
     * @param action - Yapılan işlem
     * @param showAlert - UI.showAlert fonksiyonu
     * @returns Async fonksiyonun sonucu veya undefined (hata durumunda)
     * @example
     * const result = await ErrorUtils.withErrorHandling(
     *   async () => await ApiService.call('getStaff'),
     *   "Staff yükleme"
     * );
     * // Hata varsa otomatik handle edilir, sonuç döner veya undefined
     */
    withErrorHandling<T>(
        asyncFn: () => Promise<T>,
        action: string,
        showAlert?: (message: string, type: string) => void
    ): Promise<T | undefined>;
}

const ErrorUtils: IErrorUtils = {
    handleApiError(
        response: ApiErrorResponse,
        action: string,
        showAlert?: (message: string, type: string) => void
    ): void {
        const message = `❌ Hata: ${response.error || 'Bilinmeyen hata'}`;

        // UI'da göster (eğer showAlert inject edilmişse, yoksa window.UI kullan)
        if (showAlert) {
            showAlert(message, 'error');
        } else if (typeof window !== 'undefined' && (window as any).UI?.showAlert) {
            (window as any).UI.showAlert(message, 'error');
        }

        // Log'a kaydet
        getLogError()(new Error(message), {
            action,
            response,
            type: 'api_error'
        });
    },

    handleException(
        error: Error | unknown,
        action: string,
        showAlert?: (message: string, type: string) => void
    ): void {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        const message = `❌ ${action} hatası: ${errorObj.message}`;

        // UI'da göster
        if (showAlert) {
            showAlert(message, 'error');
        } else if (typeof window !== 'undefined' && (window as any).UI?.showAlert) {
            (window as any).UI.showAlert(message, 'error');
        }

        // Log'a kaydet
        getLogError()(errorObj, {
            action,
            type: 'exception'
        });
    },

    async withErrorHandling<T>(
        asyncFn: () => Promise<T>,
        action: string,
        showAlert?: (message: string, type: string) => void
    ): Promise<T | undefined> {
        try {
            const result = await asyncFn();

            // API error response kontrolü (result { error: "..." } şeklinde olabilir)
            if (result && typeof result === 'object' && 'error' in result) {
                this.handleApiError(result as ApiErrorResponse, action, showAlert);
                return undefined;
            }

            return result;
        } catch (error) {
            this.handleException(error, action, showAlert);
            return undefined;
        }
    }
};

// Export for ES6 modules
export { ErrorUtils, type IErrorUtils, type ApiErrorResponse };

// Also expose globally for backward compatibility
if (typeof globalThis !== 'undefined' && (globalThis as any).window) {
    ((globalThis as any).window as unknown as { ErrorUtils: IErrorUtils }).ErrorUtils = ErrorUtils;
}
