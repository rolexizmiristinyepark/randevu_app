/**
 * GÜVENLİ DOM YARDIMCI FONKSİYONLARI
 * XSS saldırılarına karşı güvenli DOM manipülasyonu
 */

import { DateUtils } from './date-utils';
import rolexLogoUrl from './assets/rolex-logo.svg';

// ==================== INPUT SANITIZATION PIPELINE ====================

interface SanitizeOptions {
    maxLength?: number;
    allowedPattern?: RegExp;
    stripHtml?: boolean;
    trimWhitespace?: boolean;
}

/**
 * Kapsamlı input sanitization
 * XSS, SQL injection ve diğer saldırılara karşı koruma
 */
function sanitizeInput(input: string, options: SanitizeOptions = {}): string {
    if (!input || typeof input !== 'string') return '';

    let sanitized = input;

    // 1. Null bytes temizle
    sanitized = sanitized.replace(/\0/g, '');

    // 2. HTML entities escape (varsayılan)
    if (options.stripHtml !== false) {
        sanitized = sanitized
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    }

    // 3. SQL injection patterns (Google Sheets için de geçerli)
    const sqlPatterns = [
        /(\b)(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)(\b)/gi,
        /(--)|(\/\*)|(\*\/)/g,  // SQL comments
        /(\bOR\b|\bAND\b)\s*\d+\s*=\s*\d+/gi  // OR 1=1 patterns
    ];
    sqlPatterns.forEach(pattern => {
        sanitized = sanitized.replace(pattern, '');
    });

    // 4. Script injection
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/on\w+\s*=/gi, '');  // onclick=, onerror=, etc.
    sanitized = sanitized.replace(/data:/gi, '');  // data: URIs
    sanitized = sanitized.replace(/vbscript:/gi, '');

    // 5. Control characters temizle (tab ve newline hariç)
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // 6. Maximum uzunluk
    if (options.maxLength && options.maxLength > 0) {
        sanitized = sanitized.substring(0, options.maxLength);
    }

    // 7. İzin verilen pattern kontrolü (whitelist)
    if (options.allowedPattern) {
        const matches = sanitized.match(options.allowedPattern);
        sanitized = matches ? matches.join('') : '';
    }

    // 8. Whitespace trim (varsayılan)
    if (options.trimWhitespace !== false) {
        sanitized = sanitized.trim();
    }

    return sanitized;
}

/**
 * Telefon numarası sanitization
 */
function sanitizePhone(phone: string): string {
    if (!phone) return '';
    // Sadece rakam, +, boşluk ve tire izin ver
    return phone.replace(/[^\d\s\-+()]/g, '').substring(0, 20);
}

/**
 * E-posta sanitization
 */
function sanitizeEmail(email: string): string {
    if (!email) return '';
    // Basit email karakterleri
    const sanitized = email.replace(/[^\w.@+-]/g, '').substring(0, 100);
    // Email format kontrolü
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(sanitized) ? sanitized : '';
}

/**
 * İsim sanitization (Türkçe karakterler dahil)
 */
function sanitizeName(name: string): string {
    if (!name) return '';
    // Sadece harf, boşluk ve tire izin ver (Türkçe dahil)
    return name
        .replace(/[^a-zA-ZğüşöçıİĞÜŞÖÇ\s\-']/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 100);
}

// ==================== DOM GÜVENLİK FONKSİYONLARI ====================

// HTML karakterlerini güvenli hale getir
function escapeHtml(unsafe: any): string {
    if (unsafe === null || unsafe === undefined) return '';
    const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;'
    };
    return String(unsafe).replace(/[&<>"'\/]/g, char => map[char] || char);
}

// Güvenli element oluşturma
function createElement(tag: string, attributes: any = {}, textContent: string = ''): HTMLElement {
    const element = document.createElement(tag);

    // Güvenli attribute ataması
    for (const [key, value] of Object.entries(attributes)) {
        if (key === 'className') {
            element.className = value as string;
        } else if (key.startsWith('data-')) {
            element.setAttribute(key, String(value));
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(element.style, value);
        } else {
            element.setAttribute(key, String(value));
        }
    }

    // Güvenli text içerik
    if (textContent) {
        element.textContent = textContent;
    }

    return element;
}

// Güvenli alert gösterimi
function showAlertSafe(message: string, type: string = 'info', containerId: string = 'alertContainer'): void {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Önce temizle
    container.textContent = '';

    // Güvenli alert elementi oluştur
    const alertDiv = createElement('div', {
        className: `alert alert-${type}`
    }, message);

    container.appendChild(alertDiv);

    // 4 saniye sonra temizle
    setTimeout(() => {
        container.textContent = '';
    }, 4000);
}

// Güvenli liste render
function renderListSafe(container: HTMLElement | null, items: any[], itemRenderer: (item: any) => HTMLElement | null): void {
    if (!container) return;

    // Container'ı temizle
    container.textContent = '';

    // Her item için güvenli element oluştur
    items.forEach(item => {
        const element = itemRenderer(item);
        if (element) {
            container.appendChild(element);
        }
    });
}

// Güvenli HTML fragment oluşturma (sadece güvenilir içerik için)
function createSafeFragment(trustedHtml: string): DocumentFragment {
    const template = document.createElement('template');
    template.innerHTML = trustedHtml;
    return template.content;
}

// Loading spinner oluştur
function createLoadingElement(message = 'Yükleniyor...') {
    const container = createElement('div', {
        style: { textAlign: 'center', padding: '20px' }
    });

    const spinner = createElement('div', { className: 'spinner' });
    const text = createElement('p', {}, message);

    container.appendChild(spinner);
    container.appendChild(text);

    return container;
}

// Güvenli tablo satırı oluştur
function createTableRow(cells: any[], isHeader: boolean = false): HTMLTableRowElement {
    const row = createElement('tr') as HTMLTableRowElement;
    const cellTag = isHeader ? 'th' : 'td';

    cells.forEach(cellContent => {
        const cell = createElement(cellTag);

        if (typeof cellContent === 'string') {
            cell.textContent = cellContent;
        } else if (cellContent instanceof Element) {
            cell.appendChild(cellContent);
        } else if (cellContent && typeof cellContent === 'object') {
            // Obje ise attributes ve content içerebilir
            const { text, html, element, ...attrs } = cellContent;

            Object.entries(attrs).forEach(([key, value]) => {
                cell.setAttribute(key, String(value));
            });

            if (text) {
                cell.textContent = text;
            } else if (element) {
                cell.appendChild(element);
            }
        }

        row.appendChild(cell);
    });

    return row;
}

// Güvenli başarı sayfası oluştur
function createSuccessPageSafe(dateStr: string, timeStr: string, staffName: string, customerNote: string): HTMLDivElement {
    // Tarihi formatla (12 Ekim 2025, Salı) - DateUtils kullan
    const date = new Date(dateStr);
    const formattedDate = DateUtils.toTurkishDate(date);

    const container = document.createElement('div');

    // Header
    const header = createElement('div', { className: 'header' });

    // SVG Logo - Vite import ile doğru path
    const logo = createElement('img', {
        src: rolexLogoUrl,
        className: 'rolex-logo',
        alt: 'Rolex Logo'
    });
    header.appendChild(logo);

    const title = createElement('h2', {
        style: {
            margin: '20px 0 2px',
            fontSize: '14px',
            fontWeight: 'normal',
            letterSpacing: '1px',
            textAlign: 'center',
            color: '#757575',
            fontFamily: "'Montserrat', sans-serif"
        }
    }, 'Rolex İzmir İstinyepark');
    header.appendChild(title);

    // Staff info - XSS korumalı
    const staffInfo = createElement('p', {
        style: {
            margin: '5px 0 0',
            fontSize: '12px',
            color: '#666',
            textAlign: 'center',
            fontFamily: "'Montserrat', sans-serif",
            textTransform: 'capitalize'
        }
    }, staffName); // textContent kullanıldığı için güvenli
    header.appendChild(staffInfo);

    // Success container
    const successContainer = createElement('div', { className: 'success-container' });

    const successIcon = createElement('div', { className: 'success-icon' }, '✓');
    const successTitle = createElement('div', { className: 'success-title' }, 'Randevunuz Oluşturuldu');
    const successText = createElement('p', { className: 'success-text' },
        'Sizi mağazamızda ağırlamayı sabırsızlıkla bekliyoruz.');

    successContainer.appendChild(successIcon);
    successContainer.appendChild(successTitle);
    successContainer.appendChild(successText);

    // Appointment details - XSS korumalı
    const details = createElement('div', { className: 'appointment-details' });

    const detailsHeader = createElement('div', { className: 'details-header' }, 'Randevu Bilgileriniz');
    details.appendChild(detailsHeader);

    const dateItem = createElement('div', { className: 'detail-item' }, formattedDate);
    const timeItem = createElement('div', { className: 'detail-item' }, `Saat ${timeStr}`);
    const staffItem = createElement('div', { className: 'detail-item' }, `İlgili: ${staffName}`);

    details.appendChild(dateItem);
    details.appendChild(timeItem);
    details.appendChild(staffItem);

    // Customer note eğer varsa - XSS korumalı
    if (customerNote) {
        const noteItem = createElement('div', { className: 'detail-item' }, `Not: ${customerNote}`);
        details.appendChild(noteItem);
    }

    const locationItem = createElement('div', { className: 'detail-location' }, 'Rolex İzmir İstinyepark');
    details.appendChild(locationItem);

    successContainer.appendChild(details);

    // Takvime ekle butonu
    const calendarBtn = createElement('button', {
        className: 'btn-secondary',
        id: 'addToCalendarBtn'
    }, 'Takvime Ekle');

    successContainer.appendChild(calendarBtn);

    // Container'ı birleştir
    container.appendChild(header);
    container.appendChild(successContainer);

    return container;
}

// ==================== PII MASKELEME (KVKK/GDPR UYUMU) ====================

/**
 * E-posta adresini maskeler
 * KVKK/GDPR uyumu için log ve debug çıktılarında kullanılır
 *
 * @param {string} email - E-posta adresi
 * @returns {string} Maskelenmiş e-posta
 *
 * @example
 * maskEmail('serdar.benli@example.com') → 's***r@e***.com'
 * maskEmail('a@b.co') → 'a@b.co' (çok kısa ise maskelenmez)
 * maskEmail(null) → '[email hidden]'
 */
function maskEmail(email: any): string {
    if (!email || typeof email !== 'string') return '[email hidden]';

    const [local, domain] = email.split('@');
    if (!local || !domain) return '[invalid email]';

    // Çok kısa local part'lar için maskeleme yapma
    if (local.length <= 2) {
        return email;
    }

    // Local part: ilk ve son harf, ortası ***
    const maskedLocal = local[0] + '***' + local[local.length - 1];

    // Domain: ilk harf, ortası ***, extension
    const [domainName, ...ext] = domain.split('.');
    if (!domainName || domainName.length <= 2) {
        return `${maskedLocal}@${domain}`;
    }

    const maskedDomain = domainName[0] + '***.' + ext.join('.');

    return `${maskedLocal}@${maskedDomain}`;
}

/**
 * Telefon numarasını maskeler
 * KVKK/GDPR uyumu için log ve debug çıktılarında kullanılır
 *
 * @param {string} phone - Telefon numarası
 * @returns {string} Maskelenmiş telefon
 *
 * @example
 * maskPhone('0555 123 45 67') → '0555 *** ** 67'
 * maskPhone('05551234567') → '0555***67'
 * maskPhone(null) → '[phone hidden]'
 */
function maskPhone(phone: any): string {
    if (!phone || typeof phone !== 'string') return '[phone hidden]';

    // Sadece rakamları al
    const digits = phone.replace(/\D/g, '');

    if (digits.length < 6) {
        // Çok kısa ise tamamını maskele
        return '***';
    }

    // İlk 4 ve son 2 rakamı göster, ortası ***
    const start = digits.substring(0, 4);
    const end = digits.substring(digits.length - 2);

    // Orijinal formatlama varsa koru
    if (phone.includes(' ')) {
        return `${start} *** ** ${end}`;
    } else {
        return `${start}***${end}`;
    }
}

/**
 * Ad soyad maskeler (opsiyonel - aşırı güvenlik için)
 *
 * @param {string} name - Ad soyad
 * @returns {string} Maskelenmiş ad
 *
 * @example
 * maskName('Serdar Benli') → 'S*** B***'
 * maskName('Ali') → 'A***'
 */
function maskName(name: any): string {
    if (!name || typeof name !== 'string') return '[name hidden]';

    return name.split(' ')
        .map(word => word.length > 0 ? word[0] + '***' : '')
        .join(' ');
}

// Export for ES6 modules
export {
    // Input Sanitization
    sanitizeInput,
    sanitizePhone,
    sanitizeEmail,
    sanitizeName,
    // DOM Security
    escapeHtml,
    createElement,
    showAlertSafe,
    renderListSafe,
    createSafeFragment,
    createLoadingElement,
    createTableRow,
    createSuccessPageSafe,
    // PII Masking
    maskEmail,
    maskPhone,
    maskName
};

// Type exports
export type { SanitizeOptions };

// Also expose globally for backward compatibility
if (typeof window !== 'undefined') {
    // Input Sanitization
    (window as any).sanitizeInput = sanitizeInput;
    (window as any).sanitizePhone = sanitizePhone;
    (window as any).sanitizeEmail = sanitizeEmail;
    (window as any).sanitizeName = sanitizeName;
    // DOM Security
    (window as any).escapeHtml = escapeHtml;
    (window as any).createElement = createElement;
    (window as any).showAlertSafe = showAlertSafe;
    (window as any).renderListSafe = renderListSafe;
    (window as any).createSafeFragment = createSafeFragment;
    (window as any).createLoadingElement = createLoadingElement;
    (window as any).createTableRow = createTableRow;
    (window as any).createSuccessPageSafe = createSuccessPageSafe;
    // PII Masking
    (window as any).maskEmail = maskEmail;
    (window as any).maskPhone = maskPhone;
    (window as any).maskName = maskName;
}