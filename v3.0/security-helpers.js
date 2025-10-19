/**
 * GÜVENLİ DOM YARDIMCI FONKSİYONLARI
 * XSS saldırılarına karşı güvenli DOM manipülasyonu
 */

// HTML karakterlerini güvenli hale getir
function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;'
    };
    return String(unsafe).replace(/[&<>"'\/]/g, char => map[char]);
}

// Güvenli element oluşturma
function createElement(tag, attributes = {}, textContent = '') {
    const element = document.createElement(tag);

    // Güvenli attribute ataması
    for (const [key, value] of Object.entries(attributes)) {
        if (key === 'className') {
            element.className = value;
        } else if (key.startsWith('data-')) {
            element.setAttribute(key, value);
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
function showAlertSafe(message, type = 'info', containerId = 'alertContainer') {
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
function renderListSafe(container, items, itemRenderer) {
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
function createSafeFragment(trustedHtml) {
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
function createTableRow(cells, isHeader = false) {
    const row = createElement('tr');
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
                cell.setAttribute(key, value);
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
function createSuccessPageSafe(dateStr, timeStr, staffName, customerNote) {
    // Tarihi formatla (12 Ekim 2025, Salı) - DateUtils kullan
    const date = new Date(dateStr);
    const formattedDate = DateUtils.toTurkishDate(date);

    const container = document.createElement('div');

    // Header
    const header = createElement('div', { className: 'header' });

    // SVG Logo - Direkt img oluştur
    const logo = createElement('img', {
        src: 'assets/rolex-logo.svg',
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

// Export for ES6 modules
export {
    escapeHtml,
    createElement,
    showAlertSafe,
    renderListSafe,
    createSafeFragment,
    createLoadingElement,
    createTableRow,
    createSuccessPageSafe
};

// Also expose globally for backward compatibility
if (typeof window !== 'undefined') {
    window.escapeHtml = escapeHtml;
    window.createElement = createElement;
    window.showAlertSafe = showAlertSafe;
    window.renderListSafe = renderListSafe;
    window.createSafeFragment = createSafeFragment;
    window.createLoadingElement = createLoadingElement;
    window.createTableRow = createTableRow;
    window.createSuccessPageSafe = createSuccessPageSafe;
}