/**
 * SuccessPageComponent.ts
 *
 * Success page display and calendar integration
 * Extracted from app.ts (lines 418-486)
 */

import { ModalUtils } from './UIManager';
import { createSuccessPageSafe } from './security-helpers';
import { logError } from './monitoring';

// Debug logger
const log = {
    error: (...args: any[]) => (window as any).CONFIG?.DEBUG && console.error(...args),
    warn: (...args: any[]) => (window as any).CONFIG?.DEBUG && console.warn(...args),
    info: (...args: any[]) => (window as any).CONFIG?.DEBUG && console.info(...args),
    log: (...args: any[]) => (window as any).CONFIG?.DEBUG && console.log(...args)
};

// ==================== SUCCESS PAGE ====================

/**
 * Display success page after appointment creation
 */
export function showSuccessPage(dateStr: string, timeStr: string, staffName: string, customerNote: string): void {
    const container = document.querySelector('.container') as HTMLElement;
    if (!container) return;

    container.textContent = ''; // Clear first

    // Create content with safe DOM manipulation
    const safeContent = createSuccessPageSafe(dateStr, timeStr, staffName, customerNote);
    container.appendChild(safeContent);

    // Add event listener AFTER HTML is added
    setTimeout(() => {
        const calendarBtn = document.getElementById('addToCalendarBtn');
        if (calendarBtn) {
            calendarBtn.addEventListener('click', addToCalendar);
        } else {
            log.error('Add to Calendar button not found!');
        }
    }, 100);
}

// ==================== CALENDAR INTEGRATION (Lazy Loading) ====================

/**
 * Handle calendar button clicks
 * Lazy loading with dynamic import (bundle size optimization)
 * Module loaded on first click, cached for subsequent clicks
 * @param event - Click event
 */
export async function handleCalendarAction(event: Event): Promise<void> {
    const buttonId = (event.target as HTMLElement).id;

    try {
        // Lazy load calendar integration (first click only)
        if (!(window as any).CalendarIntegration) {
            log.info('Lazy loading calendar-integration...');
            const module = await import('./calendar-integration');
            (window as any).CalendarIntegration = module;
            log.info('Calendar integration loaded successfully');
        }

        // Call correct function based on button ID
        // Note: Each function handles its own error management
        switch (buttonId) {
            case 'calendarAppleBtn':
                (window as any).CalendarIntegration.addToCalendarApple();
                break;
            case 'calendarGoogleBtn':
                (window as any).CalendarIntegration.addToCalendarGoogle();
                break;
            case 'calendarOutlookBtn':
                (window as any).CalendarIntegration.addToCalendarOutlook();
                break;
            case 'calendarICSBtn':
                (window as any).CalendarIntegration.downloadICSUniversal();
                break;
        }
    } catch (error) {
        log.error('Calendar integration loading error:', error);
        logError(error, { context: 'handleCalendarAction', buttonId: (event.target as HTMLElement).id });
        alert('Takvim entegrasyonu yüklenirken bir hata oluştu. Lütfen tekrar deneyin.');
    }
}

/**
 * Open add to calendar modal
 */
export function addToCalendar(): void {
    ModalUtils.open('calendarModal');
}

// ==================== TURNSTILE CALLBACK ====================

/**
 * Cloudflare Turnstile callback - Called when bot protection succeeds
 * Defined in HTML as data-callback="onTurnstileSuccess"
 */
export function onTurnstileSuccess(_token: string): void {
    console.log('Turnstile successful, token received');
    // Show submit button
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
        submitBtn.style.display = 'block';
    }
}

// ==================== EXPORT ====================

export const SuccessPage = {
    showSuccessPage,
    handleCalendarAction,
    addToCalendar,
    onTurnstileSuccess,
};

// Export to window for HTML onclick handlers and callback
if (typeof window !== 'undefined') {
    (window as any).showSuccessPage = showSuccessPage;
    (window as any).handleCalendarAction = handleCalendarAction;
    (window as any).addToCalendar = addToCalendar;
    (window as any).onTurnstileSuccess = onTurnstileSuccess;
    (window as any).SuccessPage = SuccessPage;
}
