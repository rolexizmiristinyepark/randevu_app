/**
 * WHATSAPP CHAT UI - Mesajlaşma arayüzü (Site tasarımına uygun)
 * v3.10.20: Template content entegrasyonu - mesaj içeriği template'ten oluşturulur
 */

import { apiCall } from '../api-service';
import { escapeHtml } from '../security-helpers';

interface WhatsAppMessage {
    id: string;
    phone: string | number;        // Alıcı telefonu (recipient phone)
    recipientName?: string;        // Alıcı adı (customer veya staff)
    templateName?: string;
    templateId?: string;
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

interface WhatsAppTemplate {
    id: string;
    name: string;
    content?: string;
    variableCount?: number;
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
let selectedCustomer: string | null = null; // Normalized phone number (key)
let searchTerm = '';
let templatesCache: Map<string, WhatsAppTemplate> = new Map(); // name -> template

/**
 * Initialize WhatsApp chat UI
 */
export async function initWhatsAppChat(): Promise<void> {
    await loadTemplates();
    await loadAllMessages();
    setupEventListeners();
}

/**
 * Load WhatsApp templates for content formatting
 */
async function loadTemplates(): Promise<void> {
    try {
        const response = await apiCall<WhatsAppTemplate[]>('getWhatsAppTemplates');
        if (response.success && response.data) {
            templatesCache.clear();
            response.data.forEach(t => {
                templatesCache.set(t.name, t);
            });
            console.log('[WhatsApp Chat] Loaded', templatesCache.size, 'templates');
        }
    } catch (error) {
        console.error('Error loading templates:', error);
    }
}

/**
 * Format message content using template content + parameters
 * Eski format: "param1 | param2 | param3" -> Template content ile birleştir
 * Yeni format: Zaten formatlanmış -> Olduğu gibi göster
 */
function formatMessageContent(msg: WhatsAppMessage): string {
    const content = msg.messageContent || '';

    // Gelen mesajlar için olduğu gibi göster
    if (msg.direction === 'incoming') {
        return content || '[Mesaj içeriği yok]';
    }

    // Template adı yoksa olduğu gibi göster
    if (!msg.templateName) {
        return content || '[Mesaj içeriği yok]';
    }

    // Template'i bul
    const template = templatesCache.get(msg.templateName);

    // Template bulunamadı veya content'i yoksa olduğu gibi göster
    if (!template || !template.content) {
        return content || `[Şablon: ${msg.templateName}]`;
    }

    // Content zaten template formatında mı kontrol et (| ile ayrılmamış)
    // Eğer içerikte birden fazla " | " yoksa, zaten formatlanmış demektir
    const pipeCount = (content.match(/ \| /g) || []).length;
    if (pipeCount < 2) {
        // Muhtemelen yeni format veya zaten formatlanmış
        return content || template.content;
    }

    // Eski format: parametreleri ayır ve template'e yerleştir
    const params = content.split(' | ');
    let formattedContent = template.content;

    params.forEach((param, index) => {
        const placeholder = `{{${index + 1}}}`;
        formattedContent = formattedContent.replace(placeholder, param);
    });

    return formattedContent;
}

/**
 * Load all messages and group by contact
 */
async function loadAllMessages(): Promise<void> {
    // Center loading spinner göster
    const container = document.getElementById('waContactsList');
    if (container) {
        container.innerHTML = '<div class="wa-loading-center"><div class="loading-spinner"></div></div>';
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
 * Get recipient name directly from backend field
 * Backend sets this based on targetType when logging
 */
function getRecipientName(msg: WhatsAppMessage): string {
    return msg.recipientName || '';
}

/**
 * Get recipient phone directly from backend field
 * phone field = actual recipient phone number
 */
function getRecipientPhone(msg: WhatsAppMessage): string {
    return String(msg.phone || '');
}

/**
 * Group messages by phone number
 * Backend sets recipientName and phone correctly when logging
 *
 * İsim önceliği:
 * 1. Outgoing mesajdaki recipientName (sistemdeki gerçek müşteri/personel adı)
 * 2. Incoming mesajdaki recipientName (WhatsApp profil adı - fallback)
 */
function groupByContact(): void {
    const contactMap = new Map<string, Contact>();
    // Outgoing mesajlardan isimleri topla (öncelikli)
    const outgoingNames = new Map<string, string>();

    // İlk pass: Outgoing mesajlardan isimleri topla
    allMessages.forEach(msg => {
        if (msg.direction === 'outgoing') {
            const recipientName = getRecipientName(msg);
            const recipientPhone = getRecipientPhone(msg);
            const normalizedPhone = normalizePhone(recipientPhone);
            if (normalizedPhone && recipientName && !outgoingNames.has(normalizedPhone)) {
                outgoingNames.set(normalizedPhone, recipientName);
            }
        }
    });

    // İkinci pass: Tüm mesajları grupla
    allMessages.forEach(msg => {
        const recipientName = getRecipientName(msg);
        const recipientPhone = getRecipientPhone(msg);
        const normalizedPhone = normalizePhone(recipientPhone);

        // Telefon yoksa bu mesajı atla
        if (!normalizedPhone) return;

        if (!contactMap.has(normalizedPhone)) {
            // Outgoing mesajdaki ismi öncelikle kullan, yoksa incoming'den al
            const displayName = outgoingNames.get(normalizedPhone) || recipientName || formatPhoneDisplay(recipientPhone);

            contactMap.set(normalizedPhone, {
                phone: normalizedPhone,
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
        // Key olarak telefon numarasını kullan (aynı numara farklı isimlerle gelirse birleşsin)
        const customerKey = contact.phone || 'unknown';
        const item = document.createElement('div');
        item.className = `wa-contact-item${selectedCustomer === customerKey ? ' active' : ''}`;
        item.dataset.customer = customerKey;

        // Avatar - WhatsApp default person icon
        const avatar = document.createElement('div');
        avatar.className = 'wa-contact-avatar';
        avatar.innerHTML = '<svg viewBox="0 0 212 212"><path fill="#DFE5E7" d="M106.251.5C164.653.5 212 47.846 212 106.25S164.653 212 106.25 212C47.846 212 .5 164.654.5 106.25S47.846.5 106.251.5z"/><path fill="#FFF" d="M173.561 171.615a62.767 62.767 0 0 0-2.065-2.955 67.7 67.7 0 0 0-2.608-3.299 70.112 70.112 0 0 0-6.64-6.982 72.651 72.651 0 0 0-3.798-3.305 73.699 73.699 0 0 0-8.099-5.77c-1.168-.732-2.365-1.427-3.586-2.086l-.016.016C138.2 153.9 122.887 160 106.25 160c-16.637 0-31.95-6.1-43.675-16.197a67.348 67.348 0 0 0-3.586 2.086 73.699 73.699 0 0 0-8.099 5.77 72.607 72.607 0 0 0-3.798 3.305 70.112 70.112 0 0 0-6.64 6.982 67.7 67.7 0 0 0-2.609 3.299 62.767 62.767 0 0 0-2.064 2.955 71.036 71.036 0 0 0 12.344 11.91C62.189 191.735 83.035 199.5 106.25 199.5c23.215 0 44.061-7.765 58.127-19.385a71.036 71.036 0 0 0 9.184-8.5zM106.25 53c-23.912 0-43.25 19.338-43.25 43.25S82.338 139.5 106.25 139.5s43.25-19.338 43.25-43.25S130.162 53 106.25 53z"/></svg>';

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

    // Show chat panel
    const chatPanel = document.getElementById('waChatPanel');
    const contactsPanel = document.querySelector('.wa-contacts-panel');
    if (chatPanel) {
        chatPanel.classList.remove('hidden');
        chatPanel.classList.add('active');
    }
    // Mobile: hide contacts panel
    if (contactsPanel && window.innerWidth <= 900) {
        contactsPanel.classList.add('hidden');
    }

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
 * Go back to contacts list (mobile)
 */
function goBackToContacts(): void {
    selectedCustomer = null;

    const chatPanel = document.getElementById('waChatPanel');
    const contactsPanel = document.querySelector('.wa-contacts-panel');

    if (chatPanel) {
        chatPanel.classList.add('hidden');
        chatPanel.classList.remove('active');
    }
    if (contactsPanel) {
        contactsPanel.classList.remove('hidden');
    }

    // Remove active state from contacts
    document.querySelectorAll('.wa-contact-item').forEach(item => {
        item.classList.remove('active');
    });
}

/**
 * Render messages for selected customer using DOM methods
 * customerKey = normalized phone number
 */
function renderMessages(customerKey: string): void {
    const container = document.getElementById('waMessagesArea');
    if (!container) return;

    // Filter messages by phone number
    const customerMessages = allMessages.filter(msg => {
        const recipientPhone = getRecipientPhone(msg);
        const normalizedPhone = normalizePhone(recipientPhone);
        return normalizedPhone === customerKey || (customerKey === 'unknown' && !normalizedPhone);
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

        // Template content + parameters ile formatlanmış mesaj içeriği
        const content = document.createElement('div');
        content.className = 'wa-message-content';
        content.textContent = formatMessageContent(msg);

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
            } else {
                // Başarılı gönderimler (sent, delivered, read) yeşil tik
                status.classList.add('success');
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

    // Back button for mobile
    const backBtn = document.getElementById('waBackBtn');
    if (backBtn) {
        backBtn.addEventListener('click', goBackToContacts);
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
    const formatted = formatMessageContent(msg);
    return formatted.substring(0, 50) + (formatted.length > 50 ? '...' : '');
}

function getMessageContent(msg: WhatsAppMessage): string {
    return formatMessageContent(msg);
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
