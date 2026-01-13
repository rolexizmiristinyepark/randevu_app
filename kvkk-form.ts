/**
 * KVKK Veri Silme Talebi Formu
 *
 * KVKK (Kişisel Verilerin Korunması Kanunu) uyarınca
 * kullanıcıların verilerinin silinmesini talep etmelerini sağlar.
 */

import { apiCall } from './api-service';
import { ValidationUtils } from './validation-utils';
import { maskEmail, maskPhone } from './security-helpers';
import { SecureLogger } from './SecureLogger';

interface DeletionRequestResult {
    success: boolean;
    message: string;
    requestId?: string;
}

/**
 * Initialize KVKK deletion request form
 */
export function initKvkkForm(): void {
    const form = document.getElementById('kvkkDeletionForm') as HTMLFormElement;
    if (!form) return;

    form.addEventListener('submit', handleDeletionRequest);
}

/**
 * Handle deletion request form submission
 */
async function handleDeletionRequest(event: Event): Promise<void> {
    event.preventDefault();

    const form = event.target as HTMLFormElement;
    const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
    const resultDiv = document.getElementById('kvkkFormResult');

    // Get form values
    const identifierType = (form.querySelector('input[name="identifierType"]:checked') as HTMLInputElement)?.value;
    const identifier = (form.querySelector('#kvkkIdentifier') as HTMLInputElement)?.value.trim();
    const reason = (form.querySelector('#kvkkReason') as HTMLTextAreaElement)?.value.trim();

    // Clear previous results
    if (resultDiv) {
        resultDiv.textContent = '';
        resultDiv.className = 'form-result';
    }

    // Validate input
    if (!identifier) {
        showResult(resultDiv, 'Lütfen e-posta adresinizi veya telefon numaranızı girin.', 'error');
        return;
    }

    // Validate based on type
    if (identifierType === 'email') {
        const result = ValidationUtils.validateEmail(identifier);
        if (!result.valid) {
            showResult(resultDiv, result.message || 'Geçerli bir e-posta adresi girin.', 'error');
            return;
        }
    } else {
        const result = ValidationUtils.validatePhone(identifier);
        if (!result.valid) {
            showResult(resultDiv, result.message || 'Geçerli bir telefon numarası girin (örn: 5XXXXXXXXX).', 'error');
            return;
        }
    }

    // Disable submit button
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Gönderiliyor...';
    }

    try {
        // Log request (with masked PII)
        const maskedId = identifierType === 'email' ? maskEmail(identifier) : maskPhone(identifier);
        SecureLogger.info('KVKK deletion request submitted', { type: identifierType, identifier: maskedId });

        // Submit request to backend
        const response = await apiCall('requestDataDeletion', {
            identifierType,
            identifier,
            reason: reason || 'Veri silme talebi'
        }) as DeletionRequestResult;

        if (response.success) {
            showResult(resultDiv,
                `Veri silme talebiniz alındı. Talebiniz 30 gün içinde işleme alınacaktır.${response.requestId ? ` (Referans: ${response.requestId})` : ''}`,
                'success'
            );
            form.reset();
        } else {
            showResult(resultDiv,
                response.message || 'Talep gönderilemedi. Lütfen daha sonra tekrar deneyin.',
                'error'
            );
        }
    } catch (error) {
        SecureLogger.error('KVKK deletion request failed', { error: String(error) });
        showResult(resultDiv,
            'Bir hata oluştu. Lütfen daha sonra tekrar deneyin veya doğrudan bizimle iletişime geçin.',
            'error'
        );
    } finally {
        // Re-enable submit button
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Talep Gönder';
        }
    }
}

/**
 * Show result message
 */
function showResult(element: HTMLElement | null, message: string, type: 'success' | 'error'): void {
    if (!element) return;

    element.textContent = message;
    element.className = `form-result form-result-${type}`;
}

// Auto-initialize when DOM is ready
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initKvkkForm);
    } else {
        initKvkkForm();
    }
}

// Export for use in other modules
export default { initKvkkForm };
