/**
 * UIManager.ts
 *
 * Core UI utility functions for showing/hiding sections, managing alerts,
 * modals, and loading states. Replaces scattered UI functions from app.ts
 */

import { createElement } from './security-helpers';
import rolexLogoUrl from './assets/rolex-logo.svg';

// ==================== TYPES ====================

export type AlertType = 'success' | 'error' | 'warning' | 'info';

export interface ModalUtils {
  open: (modalId: string) => void;
  close: (modalId: string) => void;
  toggle: (modalId: string) => void;
}

// ==================== CONSTANTS ====================

const SCROLL_OFFSET = 80; // Pixels from top when scrolling to section

// ==================== SECTION MANAGEMENT ====================

/**
 * Show a section with smooth reveal animation
 * @param sectionId - ID of the section element (without #)
 * @param scroll - Whether to scroll to the section
 */
export function revealSection(sectionId: string, scroll = true): void {
  const section = document.getElementById(sectionId);
  if (!section) {
    console.warn(`Section not found: ${sectionId}`);
    return;
  }

  // Remove 'hidden' class if present
  section.classList.remove('hidden');

  // Add visible class with animation
  requestAnimationFrame(() => {
    section.style.display = 'block';

    // Trigger reflow
    void section.offsetHeight;

    section.classList.add('visible');

    // Scroll into view if requested
    if (scroll) {
      setTimeout(() => {
        const rect = section.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const targetPosition = rect.top + scrollTop - SCROLL_OFFSET;

        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }, 100);
    }
  });
}

/**
 * Hide a section with animation
 * @param sectionId - ID of the section element (without #)
 */
export function hideSection(sectionId: string): void {
  const section = document.getElementById(sectionId);
  if (!section) return;

  section.classList.remove('visible');
  section.classList.add('hidden');

  // Hide after animation completes
  setTimeout(() => {
    section.style.display = 'none';
  }, 300);
}

// ==================== MODAL MANAGEMENT ====================

export const ModalUtils: ModalUtils = {
  /**
   * Open a modal
   */
  open(modalId: string): void {
    const modal = document.getElementById(modalId);
    if (!modal) {
      console.warn(`Modal not found: ${modalId}`);
      return;
    }

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Prevent background scroll
  },

  /**
   * Close a modal
   */
  close(modalId: string): void {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.style.display = 'none';
    document.body.style.overflow = ''; // Restore scroll
  },

  /**
   * Toggle a modal
   */
  toggle(modalId: string): void {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    if (modal.style.display === 'flex') {
      this.close(modalId);
    } else {
      this.open(modalId);
    }
  }
};

// ==================== ALERT MANAGEMENT ====================

/**
 * Show an alert message
 * @param message - Alert message text
 * @param type - Alert type (success, error, warning, info)
 */
export function showAlert(message: string, type: AlertType = 'info'): void {
  const container = document.getElementById('alertContainer');
  if (!container) return;

  // Clear existing alerts
  container.innerHTML = '';

  // Create alert element
  const alert = createElement('div', { className: `alert alert-${type}` });
  alert.textContent = message;

  container.appendChild(alert);

  // Auto-hide after 5 seconds
  setTimeout(() => {
    hideAlert();
  }, 5000);
}

/**
 * Hide the current alert
 */
export function hideAlert(): void {
  const container = document.getElementById('alertContainer');
  if (!container) return;

  container.innerHTML = '';
}

// ==================== LOADING STATES ====================

/**
 * Show loading spinner in container
 * ⚠️ WARNING: This clears the entire page - use showCalendarLoading for calendar only
 */
export function showLoading(): void {
  const container = document.querySelector('.container') as HTMLElement;
  if (!container) return;

  // Clear container content
  container.innerHTML = '';

  // Create loading content
  const loadingDiv = createElement('div', {
    style: 'text-align: center; padding: 60px 20px;'
  });

  const spinner = createElement('div', {
    className: 'spinner',
    style: 'margin: 0 auto 20px;'
  });

  const text = createElement('p', {
    style: "color: #757575; font-size: 14px; font-family: 'Montserrat', sans-serif;"
  });
  text.textContent = 'Yükleniyor...';

  loadingDiv.appendChild(spinner);
  loadingDiv.appendChild(text);
  container.appendChild(loadingDiv);
}

/**
 * Show loading overlay on calendar (preserves calendar content, shows overlay spinner)
 * ⚡ UX FIX: Semi-transparent overlay instead of replacing content
 */
export function showCalendarLoading(): void {
  const calendarContainer = document.querySelector('.calendar-container') as HTMLElement;
  if (!calendarContainer) return;

  // Remove existing overlay if any
  hideCalendarLoading();

  // Create overlay
  const overlay = createElement('div', {
    id: 'calendarLoadingOverlay',
    style: `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.85);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 10;
      border-radius: 8px;
    `
  });

  const spinner = createElement('div', {
    className: 'spinner',
    style: 'margin-bottom: 12px;'
  });

  const text = createElement('p', {
    style: "color: #757575; font-size: 13px; font-family: 'Montserrat', sans-serif; margin: 0;"
  });
  text.textContent = 'Takvim yükleniyor...';

  overlay.appendChild(spinner);
  overlay.appendChild(text);

  // Ensure container has relative positioning for overlay
  calendarContainer.style.position = 'relative';
  calendarContainer.appendChild(overlay);
}

/**
 * Hide calendar loading overlay
 */
export function hideCalendarLoading(): void {
  const overlay = document.getElementById('calendarLoadingOverlay');
  if (overlay) {
    overlay.remove();
  }
}

/**
 * Show loading error page with retry option
 */
export function showLoadingError(): void {
  const container = document.querySelector('.container') as HTMLElement;
  if (!container) return;

  // Clear container
  container.innerHTML = '';

  // Create error page
  const errorDiv = createElement('div', {
    className: 'error-page',
    style: 'text-align: center; padding: 60px 20px;'
  });

  // Logo
  const logoImg = createElement('img', {
    src: rolexLogoUrl,
    alt: 'Rolex Logo',
    className: 'rolex-logo',
    style: 'width: 120px; margin: 0 auto 30px; display: block; opacity: 0.7;'
  }) as HTMLImageElement;

  // Error icon
  const errorIcon = createElement('div', {
    style: 'font-size: 64px; margin-bottom: 20px;'
  });
  errorIcon.textContent = '⚠️';

  // Error message
  const errorTitle = createElement('h2', {
    style: "font-family: 'Playfair Display', serif; font-size: 24px; color: #1A1A2E; margin-bottom: 15px;"
  });
  errorTitle.textContent = 'Bir Hata Oluştu';

  const errorMessage = createElement('p', {
    style: "font-family: 'Montserrat', sans-serif; font-size: 16px; color: #757575; margin-bottom: 30px; max-width: 400px; margin-left: auto; margin-right: auto; line-height: 1.6;"
  });
  errorMessage.textContent = 'Sayfa yüklenirken bir sorun oluştu. Lütfen internet bağlantınızı kontrol edin ve tekrar deneyin.';

  // Retry button
  const retryBtn = createElement('button', {
    className: 'btn',
    style: 'margin: 10px auto; display: block;'
  }) as HTMLButtonElement;
  retryBtn.textContent = '🔄 Tekrar Dene';
  retryBtn.onclick = () => window.location.reload();

  // Support info
  const supportInfo = createElement('p', {
    style: "font-family: 'Montserrat', sans-serif; font-size: 14px; color: #999; margin-top: 40px;"
  });
  supportInfo.innerHTML = 'Sorun devam ederse lütfen bizimle iletişime geçin:<br><strong>istinyeparkrolex35@gmail.com</strong>';

  // Assemble error page
  errorDiv.appendChild(logoImg);
  errorDiv.appendChild(errorIcon);
  errorDiv.appendChild(errorTitle);
  errorDiv.appendChild(errorMessage);
  errorDiv.appendChild(retryBtn);
  errorDiv.appendChild(supportInfo);

  container.appendChild(errorDiv);
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Smooth scroll to element
 */
export function scrollToElement(elementId: string, offset = SCROLL_OFFSET): void {
  const element = document.getElementById(elementId);
  if (!element) return;

  const rect = element.getBoundingClientRect();
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const targetPosition = rect.top + scrollTop - offset;

  window.scrollTo({
    top: targetPosition,
    behavior: 'smooth'
  });
}

/**
 * Check if element is visible in viewport
 */
export function isInViewport(elementId: string): boolean {
  const element = document.getElementById(elementId);
  if (!element) return false;

  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/**
 * Add shake animation to element (for validation errors)
 */
export function shakeElement(elementId: string): void {
  const element = document.getElementById(elementId);
  if (!element) return;

  element.classList.add('shake');
  setTimeout(() => {
    element.classList.remove('shake');
  }, 500);
}

/**
 * Disable/enable a button with loading state
 */
export function setButtonLoading(button: HTMLButtonElement, loading: boolean, originalText?: string): void {
  if (loading) {
    button.disabled = true;
    button.dataset.originalText = originalText || button.textContent || '';
    button.innerHTML = '<span class="spinner" style="width: 16px; height: 16px; border-width: 2px;"></span> Yükleniyor...';
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText || originalText || 'Gönder';
    delete button.dataset.originalText;
  }
}

// ==================== EXPORTS ====================

// Export all functions as named exports
export { createElement };

// Also export as UIManager object for convenience
export const UIManager = {
  revealSection,
  hideSection,
  showAlert,
  hideAlert,
  showLoading,
  showCalendarLoading,
  hideCalendarLoading,
  showLoadingError,
  scrollToElement,
  isInViewport,
  shakeElement,
  setButtonLoading,
  Modal: ModalUtils,
};

// Export for window/global access
if (typeof window !== 'undefined') {
  (window as any).UIManager = UIManager;
}
