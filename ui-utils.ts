/**
 * UI UTILITIES - Ortak UI fonksiyonları
 * Tüm sayfalarda tutarlı tasarım için kullanılır
 */

//#region Button State Management
/**
 * Set button to loading state (spinning)
 */
export function setButtonLoading(button: HTMLButtonElement | null): void {
    if (!button) return;

    button.classList.remove('btn-success-state', 'btn-error-state');
    button.classList.add('btn-loading');
    button.disabled = true;

    // Store original text for restoration
    button.dataset.originalText = button.textContent || '';
}

/**
 * Set button to success state (checkmark)
 */
export function setButtonSuccess(button: HTMLButtonElement | null, duration: number = 1500): void {
    if (!button) return;

    button.classList.remove('btn-loading', 'btn-error-state');
    button.classList.add('btn-success-state');

    // Restore to normal after duration
    setTimeout(() => {
        resetButton(button);
    }, duration);
}

/**
 * Set button to error state
 */
export function setButtonError(button: HTMLButtonElement | null, duration: number = 2000): void {
    if (!button) return;

    button.classList.remove('btn-loading', 'btn-success-state');
    button.classList.add('btn-error-state');

    // Restore to normal after duration
    setTimeout(() => {
        resetButton(button);
    }, duration);
}

/**
 * Reset button to normal state
 */
export function resetButton(button: HTMLButtonElement | null): void {
    if (!button) return;

    button.classList.remove('btn-loading', 'btn-success-state', 'btn-error-state');
    button.disabled = false;

    // Restore original text if stored
    if (button.dataset.originalText) {
        button.textContent = button.dataset.originalText;
        delete button.dataset.originalText;
    }
}

/**
 * Wrap async action with button loading states
 * Shows spinner while processing, checkmark on success, error on failure
 */
export async function withButtonState<T>(
    button: HTMLButtonElement | null,
    action: () => Promise<T>
): Promise<T> {
    if (!button) {
        return action();
    }

    setButtonLoading(button);

    try {
        const result = await action();
        setButtonSuccess(button);
        return result;
    } catch (error) {
        setButtonError(button);
        throw error;
    }
}
//#endregion

//#region Form Utilities
/**
 * Disable all form elements within a container
 */
export function disableForm(container: HTMLElement | null): void {
    if (!container) return;

    container.querySelectorAll('input, select, textarea, button').forEach(el => {
        (el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement).disabled = true;
    });
}

/**
 * Enable all form elements within a container
 */
export function enableForm(container: HTMLElement | null): void {
    if (!container) return;

    container.querySelectorAll('input, select, textarea, button').forEach(el => {
        (el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement).disabled = false;
    });
}

/**
 * Get form data as object
 */
export function getFormData(form: HTMLFormElement): Record<string, string> {
    const formData = new FormData(form);
    const data: Record<string, string> = {};

    formData.forEach((value, key) => {
        data[key] = value.toString();
    });

    return data;
}
//#endregion

//#region Loading Utilities
/**
 * Show loading overlay
 */
export function showLoading(containerId: string = 'loadingOverlay'): void {
    const overlay = document.getElementById(containerId);
    if (overlay) {
        overlay.style.display = 'flex';
    }
}

/**
 * Hide loading overlay
 */
export function hideLoading(containerId: string = 'loadingOverlay'): void {
    const overlay = document.getElementById(containerId);
    if (overlay) {
        overlay.style.display = 'none';
    }
}

/**
 * Show inline loading in a container
 */
export function showInlineLoading(container: HTMLElement | null, message: string = 'Yükleniyor...'): void {
    if (!container) return;

    // Clear container
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    // Create loading element
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'inline-loading';
    loadingDiv.style.cssText = 'display:flex;align-items:center;gap:10px;padding:20px;color:#757575;';

    const spinner = document.createElement('div');
    spinner.className = 'inline-spinner';
    spinner.style.cssText = 'width:20px;height:20px;border:2px solid #E8E8E8;border-top-color:#1A1A2E;border-radius:50%;animation:btnSpin 0.8s linear infinite;';

    const text = document.createElement('span');
    text.textContent = message;

    loadingDiv.appendChild(spinner);
    loadingDiv.appendChild(text);
    container.appendChild(loadingDiv);
}
//#endregion

//#region Modal Utilities
/**
 * Open modal by ID
 */
export function openModal(modalId: string): void {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

/**
 * Close modal by ID
 */
export function closeModal(modalId: string): void {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

/**
 * Setup modal close handlers (overlay click, cancel button)
 */
export function setupModalCloseHandlers(modalId: string, cancelBtnId?: string): void {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    // Close on overlay click
    const overlay = modal.querySelector('.modal-overlay');
    overlay?.addEventListener('click', () => closeModal(modalId));

    // Close on cancel button click
    if (cancelBtnId) {
        const cancelBtn = document.getElementById(cancelBtnId);
        cancelBtn?.addEventListener('click', () => closeModal(modalId));
    }
}

/**
 * Setup close handlers for all modals (overlay click to close)
 * Call this once on app initialization
 */
export function setupAllModalCloseHandlers(): void {
    document.querySelectorAll('.modal').forEach(modal => {
        const overlay = modal.querySelector('.modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', () => {
                modal.classList.remove('active');
            });
        }
    });
}
//#endregion

//#region Confirmation Dialog
/**
 * Show confirmation dialog
 */
export function confirm(message: string, title: string = 'Onay'): Promise<boolean> {
    return new Promise((resolve) => {
        // Simple browser confirm for now
        // Can be replaced with custom modal later
        const result = window.confirm(message);
        resolve(result);
    });
}
//#endregion

//#region Auto-setup
/**
 * Auto-setup all buttons with data-action attribute
 */
export function setupActionButtons(): void {
    document.querySelectorAll('[data-action]').forEach(button => {
        if (!(button instanceof HTMLButtonElement)) return;

        button.addEventListener('click', async function(this: HTMLButtonElement) {
            const action = this.dataset.action;
            const handler = (window as any)[`handle${action}`];

            if (typeof handler === 'function') {
                await withButtonState(this, handler);
            }
        });
    });
}
//#endregion
