/**
 * WHATSAPP CHAT UI - Mesajlaşma arayüzü (Site tasarımına uygun)
 * v3.10.18: Kişi listesi + Mesaj görünümü
 */

import { apiCall } from '../api-service';
import { escapeHtml } from '../security-helpers';

interface WhatsAppMessage {
    id: string;
    phone: string | number;        // Alıcı telefonu (recipient phone)
    recipientName?: string;        // Alıcı adı (customer veya staff)
    templateName?: string;
    messageContent?: string;
    status: 'sent' | 'delivered' | 'read' | 'failed';
    direction: 'incoming' | 'outgoing';
    timestamp?: string;
    sentAt?: string;
    errorMessage?: string;
    // v3.10.20: Backend alanları - parse yok
    targetType?: 'customer' | 'staff' | '';
    customerName?: string;
    customerPhone?: string;
    staffName?: string;
    staffPhone?: string;
}

interface Contact {
    phone: string;
    name: string;
    customerPhone: string; // Müşteri telefonu (mesaj içeriğinden çıkarılır)
    lastMessage: string;
    lastMessageTime: string;
    unreadCount: number;
    lastDirection: 'incoming' | 'outgoing';
}

// State
let allMessages: WhatsAppMessage[] = [];
let contacts: Contact[] = [];
let selectedCustomer: string | null = null; // Müşteri adı (lowercase key)
let searchTerm = '';

/**
 * Initialize WhatsApp chat UI
 */
export async function initWhatsAppChat(): Promise<void> {
    await loadAllMessages();
    setupEventListeners();
}

/**
 * Load all messages and group by contact
 */
async function loadAllMessages(): Promise<void> {
    // Global spinner göster
    const container = document.getElementById('waContactsList');
    if (container) {
        container.innerHTML = '<div class="loading-spinner"></div>';
    }

    try {
        // Load both sent and received messages
        const [sentResponse, receivedResponse] = await Promise.all([
            apiCall('getWhatsAppMessages', { type: 'sent', limit: '500' }),
            apiCall('getWhatsAppMessages', { type: 'received', limit: '500' })
        ]) as [{ success: boolean; data: WhatsAppMessage[] }, { success: boolean; data: WhatsAppMessage[] }];

        allMessages = [];

        if (sentResponse.success && sentResponse.data) {
            sentResponse.data.forEach(msg => {
                msg.direction = 'outgoing';
                allMessages.push(msg);
            });
        }

        if (receivedResponse.success && receivedResponse.data) {
            receivedResponse.data.forEach(msg => {
                msg.direction = 'incoming';
                allMessages.push(msg);
            });
        }

        // Sort by timestamp (newest first for contact list)
        allMessages.sort((a, b) => {
            const timeA = new Date(a.timestamp || a.sentAt || 0).getTime();
            const timeB = new Date(b.timestamp || b.sentAt || 0).getTime();
            return timeB - timeA;
        });

        // Group by customer name (from message content)
        groupByContact();
        renderContacts();

    } catch (error) {
        console.error('Error loading messages:', error);
        if (container) {
            container.textContent = '';
            const errorDiv = document.createElement('div');
            errorDiv.className = 'wa-loading';
            errorDiv.textContent = 'Mesajlar yüklenemedi';
            container.appendChild(errorDiv);
        }
    }
}

/**
 * Get recipient name from message (no parsing - direct from backend)
 * v3.10.20: Sadece backend alanlarını kullan, mesaj içeriğinden parse etme
 */
function getRecipientName(msg: WhatsAppMessage): string {
    return msg.recipientName || '';
}

/**
 * Get recipient phone from message (no parsing - direct from backend)
 * v3.10.20: Sadece backend alanlarını kullan, mesaj içeriğinden parse etme
 */
function getRecipientPhone(msg: WhatsAppMessage): string {
    return String(msg.phone || '');
}

/**
 * Group messages by recipient name
 * v3.10.20: Sadece backend alanlarını kullan - recipientName ve phone
 */
function groupByContact(): void {
    const contactMap = new Map<string, Contact>();

    allMessages.forEach(msg => {
        // Alıcı adını al (sadece backend'den)
        const recipientName = getRecipientName(msg);
        const recipientPhone = getRecipientPhone(msg);

        // recipientName yoksa telefon numarasını kullan, o da yoksa "Bilinmeyen"
        const displayName = recipientName || (recipientPhone ? formatPhoneDisplay(recipientPhone) : 'Bilinmeyen');

        // Key olarak alıcı adını kullan (lowercase for consistency)
        const key = displayName.toLowerCase();

        if (!contactMap.has(key)) {
            contactMap.set(key, {
                phone: normalizePhone(recipientPhone),
                name: displayName,
                customerPhone: recipientPhone,
                lastMessage: '',
                lastMessageTime: msg.timestamp || msg.sentAt || '',
                unreadCount: 0,
                lastDirection: msg.direction
            });
        }
    });

    contacts = Array.from(contactMap.values());

    // Sort by last message time (newest first)
    contacts.sort((a, b) => {
        const timeA = new Date(a.lastMessageTime || 0).getTime();
        const timeB = new Date(b.lastMessageTime || 0).getTime();
        return timeB - timeA;
    });
}

/**
 * Render contact list using DOM methods
 */
function renderContacts(): void {
    const container = document.getElementById('waContactsList');
    if (!container) return;

    // Arama: isim veya telefon numarasına göre (kısmi eşleşme)
    const searchNormalized = searchTerm.replace(/\D/g, ''); // Sadece rakamlar
    const filteredContacts = searchTerm
        ? contacts.filter(c => {
            // İsme göre ara
            if (c.name.toLowerCase().includes(searchTerm.toLowerCase())) return true;
            // Telefona göre ara (053, 532, 5077749007 gibi)
            if (searchNormalized && c.customerPhone.includes(searchNormalized)) return true;
            return false;
        })
        : contacts;

    container.textContent = '';

    if (filteredContacts.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'wa-loading';
        emptyDiv.textContent = searchTerm ? 'Sonuç bulunamadı' : 'Henüz mesaj yok';
        container.appendChild(emptyDiv);
        return;
    }

    filteredContacts.forEach(contact => {
        const customerKey = contact.name.toLowerCase();
        const item = document.createElement('div');
        item.className = `wa-contact-item${selectedCustomer === customerKey ? ' active' : ''}`;
        item.dataset.customer = customerKey;

        // Avatar
        const avatar = document.createElement('div');
        avatar.className = 'wa-contact-avatar';
        avatar.textContent = getInitial(contact.name);

        // Info container - sadece isim ve telefon
        const info = document.createElement('div');
        info.className = 'wa-contact-info';

        const nameDiv = document.createElement('div');
        nameDiv.className = 'wa-contact-name';
        nameDiv.textContent = contact.name;
        info.appendChild(nameDiv);

        // Müşteri telefon numarası
        if (contact.customerPhone) {
            const phoneDiv = document.createElement('div');
            phoneDiv.className = 'wa-contact-phone';
            phoneDiv.textContent = formatPhoneDisplay(contact.customerPhone);
            info.appendChild(phoneDiv);
        }

        // Meta
        const meta = document.createElement('div');
        meta.className = 'wa-contact-meta';

        const time = document.createElement('div');
        time.className = 'wa-contact-time';
        time.textContent = formatRelativeTime(contact.lastMessageTime);

        meta.appendChild(time);

        item.appendChild(avatar);
        item.appendChild(info);
        item.appendChild(meta);

        item.addEventListener('click', () => selectContact(customerKey, contact.name));
        container.appendChild(item);
    });
}

/**
 * Select a contact and show their messages
 */
function selectContact(customerKey: string, customerName: string): void {
    selectedCustomer = customerKey;

    // Update active state in contact list
    document.querySelectorAll('.wa-contact-item').forEach(item => {
        item.classList.toggle('active', (item as HTMLElement).dataset.customer === customerKey);
    });

    // Update header
    const headerName = document.querySelector('.wa-chat-name');
    const headerStatus = document.querySelector('.wa-chat-status');

    if (headerName) {
        headerName.textContent = customerName;
    }
    if (headerStatus) {
        headerStatus.textContent = 'Müşteri';
    }

    // Render messages for this customer
    renderMessages(customerKey);
}

/**
 * Render messages for selected customer using DOM methods
 */
function renderMessages(customerKey: string): void {
    const container = document.getElementById('waMessagesArea');
    if (!container) return;

    // Filter messages for this recipient
    const customerMessages = allMessages.filter(msg => {
        const recipientName = getRecipientName(msg);
        const recipientPhone = getRecipientPhone(msg);
        const displayName = recipientName || (recipientPhone ? formatPhoneDisplay(recipientPhone) : 'Bilinmeyen');
        return displayName.toLowerCase() === customerKey;
    });

    // Sort by timestamp (oldest first for conversation view)
    customerMessages.sort((a, b) => {
        const timeA = new Date(a.timestamp || a.sentAt || 0).getTime();
        const timeB = new Date(b.timestamp || b.sentAt || 0).getTime();
        return timeA - timeB;
    });

    container.textContent = '';

    if (customerMessages.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'wa-empty-state';

        const text = document.createElement('p');
        text.textContent = 'Bu kişiyle henüz mesaj yok';

        emptyState.appendChild(text);
        container.appendChild(emptyState);
        return;
    }

    let lastDate = '';

    customerMessages.forEach(msg => {
        const msgDate = formatDateOnly(msg.timestamp || msg.sentAt || '');

        // Add date divider if date changed
        if (msgDate && msgDate !== lastDate) {
            lastDate = msgDate;
            const divider = document.createElement('div');
            divider.className = 'wa-date-divider';
            const dividerSpan = document.createElement('span');
            dividerSpan.textContent = msgDate;
            divider.appendChild(dividerSpan);
            container.appendChild(divider);
        }

        const messageEl = document.createElement('div');
        messageEl.className = `wa-message ${msg.direction}`;

        const bubble = document.createElement('div');
        bubble.className = 'wa-message-bubble';

        // Tam mesaj içeriğini göster
        const content = document.createElement('div');
        content.className = 'wa-message-content';
        content.textContent = msg.messageContent || msg.templateName || '[Mesaj içeriği yok]';

        const footer = document.createElement('div');
        footer.className = 'wa-message-footer';

        const timeSpan = document.createElement('span');
        timeSpan.className = 'wa-message-time';
        timeSpan.textContent = formatTimeOnly(msg.timestamp || msg.sentAt || '');

        footer.appendChild(timeSpan);

        if (msg.direction === 'outgoing') {
            const status = document.createElement('span');
            status.className = 'wa-message-status';
            if (msg.status === 'failed') {
                status.classList.add('failed');
                status.textContent = '✗';
            } else if (msg.status === 'read' || msg.status === 'delivered') {
                status.textContent = '✓✓';
            } else {
                status.style.color = '#667781';
                status.textContent = '✓';
            }
            footer.appendChild(status);
        }

        bubble.appendChild(content);
        bubble.appendChild(footer);
        messageEl.appendChild(bubble);

        // Mesaja tıklayınca detayları göster
        bubble.addEventListener('click', () => showMessageDetails(msg));

        container.appendChild(messageEl);
    });

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

/**
 * Setup event listeners
 */
function setupEventListeners(): void {
    const searchInput = document.getElementById('waContactSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchTerm = (e.target as HTMLInputElement).value;
            renderContacts();
        });
    }
}

/**
 * Show message details in a modal
 */
function showMessageDetails(msg: WhatsAppMessage): void {
    // Remove existing modal if any
    const existingModal = document.getElementById('waMessageModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Create modal
    const modal = document.createElement('div');
    modal.id = 'waMessageModal';
    modal.className = 'wa-message-modal';

    const modalContent = document.createElement('div');
    modalContent.className = 'wa-message-modal-content';

    // Header
    const header = document.createElement('div');
    header.className = 'wa-message-modal-header';

    const title = document.createElement('h3');
    title.textContent = 'Mesaj Detayları';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'wa-message-modal-close';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => closeMessageModal());

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Body
    const body = document.createElement('div');
    body.className = 'wa-message-modal-body';

    // Status row
    const statusRow = createDetailRow('Durum',
        msg.status === 'failed' ? 'Başarısız' :
        msg.status === 'delivered' ? 'İletildi' :
        msg.status === 'read' ? 'Okundu' : 'Gönderildi',
        msg.status === 'failed' ? 'error' : 'success'
    );
    body.appendChild(statusRow);

    // Error message if failed
    if (msg.status === 'failed' && msg.errorMessage) {
        const errorRow = createDetailRow('Hata Sebebi', msg.errorMessage, 'error');
        body.appendChild(errorRow);
    }

    // Recipient
    if (msg.recipientName) {
        const recipientRow = createDetailRow('Alıcı', msg.recipientName);
        body.appendChild(recipientRow);
    }

    // Phone (staff phone)
    if (msg.phone) {
        const phoneRow = createDetailRow('Gönderim Numarası', formatPhoneDisplay(String(msg.phone)));
        body.appendChild(phoneRow);
    }

    // Template name
    if (msg.templateName) {
        const templateRow = createDetailRow('Şablon', msg.templateName);
        body.appendChild(templateRow);
    }

    // Timestamp
    const timestamp = msg.timestamp || msg.sentAt;
    if (timestamp) {
        const date = new Date(timestamp);
        const dateStr = date.toLocaleDateString('tr-TR', {
            day: 'numeric', month: 'long', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        const timeRow = createDetailRow('Tarih/Saat', dateStr);
        body.appendChild(timeRow);
    }

    modalContent.appendChild(header);
    modalContent.appendChild(body);
    modal.appendChild(modalContent);

    // Close on overlay click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeMessageModal();
        }
    });

    document.body.appendChild(modal);

    // Show modal with animation
    requestAnimationFrame(() => {
        modal.classList.add('active');
    });
}

/**
 * Create a detail row for the modal
 */
function createDetailRow(label: string, value: string, className?: string): HTMLElement {
    const row = document.createElement('div');
    row.className = 'wa-detail-row';

    const labelEl = document.createElement('div');
    labelEl.className = 'wa-detail-label';
    labelEl.textContent = label;

    const valueEl = document.createElement('div');
    valueEl.className = 'wa-detail-value' + (className ? ' ' + className : '');
    valueEl.textContent = value;

    row.appendChild(labelEl);
    row.appendChild(valueEl);
    return row;
}

/**
 * Close the message details modal
 */
function closeMessageModal(): void {
    const modal = document.getElementById('waMessageModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 200);
    }
}

// ==================== HELPER FUNCTIONS ====================

function normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
}

function formatPhoneDisplay(phone: string): string {
    const clean = normalizePhone(phone);
    if (clean.length === 12 && clean.startsWith('90')) {
        // Turkish format: 905XX XXX XXXX
        return `+90 ${clean.slice(2, 5)} ${clean.slice(5, 8)} ${clean.slice(8)}`;
    }
    return '+' + clean;
}

function getInitial(name: string): string {
    if (!name) return '?';
    // If starts with +, it's a phone number
    if (name.startsWith('+')) return '👤';
    return name.charAt(0).toUpperCase();
}

function getMessagePreview(msg: WhatsAppMessage): string {
    if (msg.messageContent) {
        return msg.messageContent.substring(0, 50) + (msg.messageContent.length > 50 ? '...' : '');
    }
    if (msg.templateName) {
        return `📄 ${msg.templateName}`;
    }
    return 'Mesaj';
}

function getMessageContent(msg: WhatsAppMessage): string {
    if (msg.messageContent) {
        return msg.messageContent;
    }
    if (msg.templateName) {
        return `[Şablon: ${msg.templateName}]`;
    }
    return '[Mesaj içeriği yok]';
}

function formatRelativeTime(timestamp: string): string {
    if (!timestamp) return '';

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
        return 'Dün';
    } else if (diffDays < 7) {
        return date.toLocaleDateString('tr-TR', { weekday: 'short' });
    } else {
        return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
    }
}

function formatDateOnly(timestamp: string): string {
    if (!timestamp) return '';

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return 'Bugün';
    } else if (diffDays === 1) {
        return 'Dün';
    } else {
        return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    }
}

function formatTimeOnly(timestamp: string): string {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

// Export for use in admin-panel
export { loadAllMessages as loadWhatsAppChat };
