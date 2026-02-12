/**
 * NOTIFICATION BELL - Admin panel bildirim çan ikonu
 * Supabase Realtime ile appointments ve message_log değişikliklerini dinler
 * Logout butonunun solunda altın rengi nokta ile gösterilir
 */

interface NotificationItem {
    id: string;
    type: 'appointment_create' | 'appointment_update' | 'appointment_cancel' | 'appointment_assign' | 'whatsapp_incoming';
    title: string;
    detail: string;
    timestamp: string;
    read: boolean;
    // Navigasyon bilgisi
    mainTab: string;
    subTab: string;
    innerTab?: string;
}

// State
let notifications: NotificationItem[] = [];
let hasUnread = false;
let dropdownVisible = false;
const MAX_NOTIFICATIONS = 50;

// UI referansı — switchMainTab, switchSubTab, switchInnerTab
let uiRef: {
    switchMainTab: (tab: string) => void;
    switchSubTab: (mainTab: string, subTab: string) => void;
    switchInnerTab?: (subTab: string, innerTab: string) => void;
} | null = null;

/**
 * Bildirim bell sistemini başlat
 */
export function initNotificationBell(ui: typeof uiRef): void {
    uiRef = ui;
    createBellIcon();
    loadFromStorage();
    updateDot();
}

/**
 * Yeni bildirim ekle (Realtime callback'lerden çağrılır)
 */
export function addNotification(item: Omit<NotificationItem, 'id' | 'read'>): void {
    const notification: NotificationItem = {
        ...item,
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        read: false,
    };

    notifications.unshift(notification);
    if (notifications.length > MAX_NOTIFICATIONS) {
        notifications = notifications.slice(0, MAX_NOTIFICATIONS);
    }

    hasUnread = true;
    updateDot();
    saveToStorage();

    // Dropdown açıksa yeniden render et
    if (dropdownVisible) {
        renderDropdown();
    }
}

/**
 * Header'a çan ikonu ekle (logout butonunun soluna)
 */
function createBellIcon(): void {
    const header = document.querySelector('.header');
    if (!header) return;

    // Wrapper: bell + dropdown
    const wrapper = document.createElement('div');
    wrapper.id = 'notificationBellWrapper';
    wrapper.style.cssText = 'position: absolute; right: 120px; top: 50%; transform: translateY(-50%); z-index: 100;';

    // Bell button
    const btn = document.createElement('button');
    btn.id = 'notificationBellBtn';
    btn.style.cssText = `
        background: transparent; border: none; cursor: pointer; padding: 8px;
        position: relative; display: flex; align-items: center; justify-content: center;
    `;
    btn.title = 'Bildirimler';

    // SVG bell icon
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', '22');
    svg.setAttribute('height', '22');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', '#757575');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');

    const path1 = document.createElementNS(svgNS, 'path');
    path1.setAttribute('d', 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9');
    const path2 = document.createElementNS(svgNS, 'path');
    path2.setAttribute('d', 'M13.73 21a2 2 0 0 1-3.46 0');

    svg.appendChild(path1);
    svg.appendChild(path2);
    btn.appendChild(svg);

    // Gold dot
    const dot = document.createElement('span');
    dot.id = 'notificationDot';
    dot.style.cssText = `
        position: absolute; top: 6px; right: 6px; width: 8px; height: 8px;
        background: #C9A55A; border-radius: 50%; display: none;
    `;
    btn.appendChild(dot);

    // Click handler
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDropdown();
    });

    wrapper.appendChild(btn);

    // Dropdown container
    const dropdown = document.createElement('div');
    dropdown.id = 'notificationDropdown';
    dropdown.style.cssText = `
        display: none; position: absolute; top: calc(100% + 8px); right: 0;
        width: 360px; max-height: 420px; overflow-y: auto;
        background: white; border: 1px solid #E8E8E8; border-radius: 4px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.12); z-index: 200;
    `;
    wrapper.appendChild(dropdown);

    header.appendChild(wrapper);

    // Dışarı tıklayınca kapat
    document.addEventListener('click', (e) => {
        if (dropdownVisible && !wrapper.contains(e.target as Node)) {
            closeDropdown();
        }
    });
}

/**
 * Dropdown aç/kapat
 */
function toggleDropdown(): void {
    if (dropdownVisible) {
        closeDropdown();
    } else {
        openDropdown();
    }
}

function openDropdown(): void {
    dropdownVisible = true;
    const dropdown = document.getElementById('notificationDropdown');
    if (dropdown) {
        dropdown.style.display = 'block';
        renderDropdown();
    }
    // Tüm bildirimleri okundu yap
    markAllRead();
}

function closeDropdown(): void {
    dropdownVisible = false;
    const dropdown = document.getElementById('notificationDropdown');
    if (dropdown) dropdown.style.display = 'none';
}

/**
 * Dropdown içeriğini render et
 */
function renderDropdown(): void {
    const dropdown = document.getElementById('notificationDropdown');
    if (!dropdown) return;

    // Temizle
    while (dropdown.firstChild) dropdown.removeChild(dropdown.firstChild);

    // Başlık
    const header = document.createElement('div');
    header.style.cssText = `
        padding: 14px 16px; border-bottom: 1px solid #E8E8E8;
        font-size: 12px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;
        color: #1A1A2E; display: flex; justify-content: space-between; align-items: center;
    `;
    const titleSpan = document.createElement('span');
    titleSpan.textContent = 'Bildirimler';
    header.appendChild(titleSpan);

    if (notifications.length > 0) {
        const clearBtn = document.createElement('button');
        clearBtn.textContent = 'Temizle';
        clearBtn.style.cssText = `
            background: none; border: none; color: #757575; cursor: pointer;
            font-size: 10px; letter-spacing: 0.5px; text-transform: uppercase;
        `;
        clearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            clearAll();
        });
        header.appendChild(clearBtn);
    }
    dropdown.appendChild(header);

    // Boş durum
    if (notifications.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'padding: 40px 16px; text-align: center; color: #999; font-size: 13px;';
        empty.textContent = 'Henüz bildirim yok';
        dropdown.appendChild(empty);
        return;
    }

    // Bildirim listesi
    notifications.forEach(n => {
        const item = document.createElement('div');
        item.style.cssText = `
            padding: 12px 16px; border-bottom: 1px solid #F5F5F5; cursor: pointer;
            transition: background 0.15s;
        `;
        item.addEventListener('mouseenter', () => { item.style.background = '#FAFAFA'; });
        item.addEventListener('mouseleave', () => { item.style.background = 'transparent'; });

        // İkon + İçerik satırı
        const row = document.createElement('div');
        row.style.cssText = 'display: flex; align-items: flex-start; gap: 10px;';

        // Tip ikonu
        const icon = document.createElement('span');
        icon.style.cssText = 'font-size: 16px; flex-shrink: 0; margin-top: 1px;';
        icon.textContent = getNotificationIcon(n.type);

        // Metin
        const textDiv = document.createElement('div');
        textDiv.style.cssText = 'flex: 1; min-width: 0;';

        const title = document.createElement('div');
        title.style.cssText = 'font-size: 13px; font-weight: 500; color: #1A1A2E; margin-bottom: 2px;';
        title.textContent = n.title;

        const detail = document.createElement('div');
        detail.style.cssText = 'font-size: 12px; color: #757575; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
        detail.textContent = n.detail;

        const time = document.createElement('div');
        time.style.cssText = 'font-size: 10px; color: #999; margin-top: 4px;';
        time.textContent = formatNotificationTime(n.timestamp);

        textDiv.appendChild(title);
        textDiv.appendChild(detail);
        textDiv.appendChild(time);

        row.appendChild(icon);
        row.appendChild(textDiv);
        item.appendChild(row);

        // Tıklayınca ilgili sayfaya git
        item.addEventListener('click', () => {
            navigateToNotification(n);
            closeDropdown();
        });

        dropdown.appendChild(item);
    });
}

/**
 * Bildirim tipine göre ikon
 */
function getNotificationIcon(type: NotificationItem['type']): string {
    switch (type) {
        case 'appointment_create': return '+';
        case 'appointment_update': return '~';
        case 'appointment_cancel': return 'x';
        case 'appointment_assign': return '>';
        case 'whatsapp_incoming': return 'W';
    }
}

/**
 * Bildirime tıklandığında ilgili sayfaya yönlendir
 */
function navigateToNotification(n: NotificationItem): void {
    if (!uiRef) return;

    uiRef.switchMainTab(n.mainTab);

    // Küçük gecikme ile sub/inner tab geçişi yap (DOM güncellemesi için)
    setTimeout(() => {
        uiRef!.switchSubTab(n.mainTab, n.subTab);
        if (n.innerTab && uiRef!.switchInnerTab) {
            setTimeout(() => {
                uiRef!.switchInnerTab!(n.subTab, n.innerTab!);
            }, 50);
        }
    }, 50);
}

/**
 * Altın rengi noktayı güncelle
 */
function updateDot(): void {
    const dot = document.getElementById('notificationDot');
    if (dot) {
        dot.style.display = hasUnread ? 'block' : 'none';
    }
}

/**
 * Tüm bildirimleri okundu olarak işaretle
 */
function markAllRead(): void {
    if (!hasUnread) return;
    hasUnread = false;
    notifications.forEach(n => n.read = true);
    updateDot();
    saveToStorage();
}

/**
 * Tüm bildirimleri temizle
 */
function clearAll(): void {
    notifications = [];
    hasUnread = false;
    updateDot();
    saveToStorage();
    renderDropdown();
}

/**
 * localStorage'a kaydet
 */
function saveToStorage(): void {
    try {
        localStorage.setItem('admin_notifications', JSON.stringify(notifications));
        localStorage.setItem('admin_notifications_unread', hasUnread ? '1' : '0');
    } catch { /* storage full */ }
}

/**
 * localStorage'dan yükle
 */
function loadFromStorage(): void {
    try {
        const stored = localStorage.getItem('admin_notifications');
        if (stored) {
            notifications = JSON.parse(stored);
        }
        hasUnread = localStorage.getItem('admin_notifications_unread') === '1';
    } catch {
        notifications = [];
        hasUnread = false;
    }
}

/**
 * Zaman formatlama (göreli)
 */
function formatNotificationTime(timestamp: string): string {
    const now = new Date();
    const t = new Date(timestamp);
    const diffMs = now.getTime() - t.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return 'Şimdi';
    if (diffMin < 60) return `${diffMin} dk önce`;

    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} saat önce`;

    const diffDay = Math.floor(diffHour / 24);
    if (diffDay === 1) return 'Dün';
    if (diffDay < 7) return `${diffDay} gün önce`;

    return t.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

// ==================== REALTIME PAYLOAD HELPERS ====================

/**
 * Appointment Realtime payload'dan bildirim oluştur
 */
export function handleAppointmentChange(eventType: string, payload: Record<string, unknown>): void {
    const newRecord = (payload.new || {}) as Record<string, string>;
    const oldRecord = (payload.old || {}) as Record<string, string>;

    const customerName = newRecord.customer_name || oldRecord.customer_name || '';
    const date = newRecord.date || oldRecord.date || '';
    const time = newRecord.start_time ? String(newRecord.start_time).substring(0, 5) : '';

    let type: NotificationItem['type'];
    let title: string;

    switch (eventType) {
        case 'INSERT':
            type = 'appointment_create';
            title = 'Yeni Randevu';
            break;
        case 'UPDATE': {
            // staff_id değiştiyse personel atama
            const oldStaff = oldRecord.staff_id;
            const newStaff = newRecord.staff_id;
            if (newStaff && newStaff !== oldStaff) {
                type = 'appointment_assign';
                title = 'Personel Atandı';
            } else {
                type = 'appointment_update';
                title = 'Randevu Güncellendi';
            }
            break;
        }
        case 'DELETE':
            type = 'appointment_cancel';
            title = 'Randevu İptal';
            break;
        default:
            return;
    }

    const detail = customerName
        ? `${customerName} — ${formatTurkishDate(date)} ${time}`
        : `${formatTurkishDate(date)} ${time}`;

    addNotification({
        type,
        title,
        detail,
        timestamp: new Date().toISOString(),
        mainTab: 'randevu',
        subTab: 'appointments',
    });
}

/**
 * WhatsApp incoming mesaj payload'dan bildirim oluştur
 */
export function handleIncomingMessage(payload: Record<string, unknown>): void {
    const newRecord = (payload.new || {}) as Record<string, string>;
    if (newRecord.direction !== 'incoming') return;

    const phone = newRecord.phone || newRecord.customer_phone || '';
    const name = newRecord.recipient_name || phone;

    addNotification({
        type: 'whatsapp_incoming',
        title: 'Yeni WhatsApp Mesajı',
        detail: name,
        timestamp: new Date().toISOString(),
        mainTab: 'bildirim',
        subTab: 'whatsapp',
        innerTab: 'whatsappMessages',
    });
}

/**
 * Tarih formatlama (kısa Türkçe)
 */
function formatTurkishDate(dateStr: string): string {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
    } catch {
        return dateStr;
    }
}
