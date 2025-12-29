/**
 * PROFILE SETTINGS MANAGER - Profil Ayarları Yönetimi
 * v3.4: Dinamik profil ayarları düzenleme (simplified - defaultType/showTypeSelection removed)
 * v3.5: XSS koruması - escapeHtml ile güvenli HTML oluşturma
 */

import { apiCall } from '../api-service';
import { ButtonAnimator } from '../button-utils';
import { escapeHtml } from '../security-helpers';

// Profil ayarları interface
interface ProfilAyari {
    code: string;
    idKontrolu: boolean;         // v3.9: URL'den personel ID alınsın mı?
    expectedRole?: string;
    sameDayBooking: boolean;
    maxSlotAppointment: number;
    slotGrid: number;
    maxDailyPerStaff: number;    // Personel başına günlük teslim/gönderi limiti
    maxDailyDelivery: number;    // Global günlük teslim/gönderi limiti
    duration: number;
    assignByAdmin: boolean;
    allowedTypes: string[];
    staffFilter: string;
    takvimFiltresi: 'onlytoday' | 'withtoday' | 'withouttoday';
    vardiyaKontrolu: boolean;    // v3.8: true=vardiyaya göre, false=tüm günler müsait
}

type ProfilAyarlari = Record<string, ProfilAyari>;

// Profil isimleri
const PROFIL_LABELS: Record<string, string> = {
    genel: 'Genel',
    gunluk: 'Günlük',
    boutique: 'Butik',
    yonetim: 'Yönetim',
    personel: 'Bireysel',
    vip: 'Özel Müşteri'
};

// Kod mapping
const CODE_LABELS: Record<string, string> = {
    g: '#g',
    w: '#w',
    b: '#b',
    m: '#m',
    s: '#s/{id}',
    v: '#v/{id}'
};

// Module state
let profilAyarlari: ProfilAyarlari = {};
let currentEditKey: string | null = null;

// Global references
declare const window: Window & {
    UI: { showAlert: (msg: string, type: string) => void };
};

const getUI = () => window.UI;

/**
 * Initialize profile settings manager
 */
export async function initProfileSettingsManager(): Promise<void> {
    await loadProfilAyarlari();
    setupEventListeners();
}

/**
 * Load profile settings from backend
 */
async function loadProfilAyarlari(): Promise<void> {
    try {
        const response = await apiCall('getAllProfilAyarlari') as { success: boolean; data: ProfilAyarlari };

        if (response.success && response.data) {
            profilAyarlari = response.data;
            renderTable();
        }
    } catch (error) {
        console.error('Profil ayarları yüklenemedi:', error);
        const container = document.getElementById('profilAyarlariTable');
        if (container) {
            // 🔒 GÜVENLİK: DOM API kullanılıyor
            while (container.firstChild) container.removeChild(container.firstChild);
            const errorP = document.createElement('p');
            errorP.style.cssText = 'color: #c00; text-align: center; padding: 20px;';
            errorP.textContent = 'Profil ayarları yüklenemedi.';
            container.appendChild(errorP);
        }
    }
}

/**
 * Render profile settings table
 */
function renderTable(): void {
    const container = document.getElementById('profilAyarlariTable');
    if (!container) return;

    const profilOrder = ['genel', 'gunluk', 'boutique', 'yonetim', 'personel', 'vip'];

    let html = `
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
                <tr style="background: #f5f5f5;">
                    <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Profil</th>
                    <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">Kod</th>
                    <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">ID Kontrol</th>
                    <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">Vardiya</th>
                    <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">Slot Max</th>
                    <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">Günlük T/G</th>
                    <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">P.Başı T/G</th>
                    <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">Grid</th>
                    <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">Süre</th>
                    <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Personel Filtresi</th>
                    <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">İşlem</th>
                </tr>
            </thead>
            <tbody>
    `;

    for (const key of profilOrder) {
        const p = profilAyarlari[key];
        if (!p) continue;

        // ⚠️ XSS KORUMASI: Tüm değerler escapeHtml ile sanitize edilir
        const staffLabel = p.staffFilter === 'self' ? 'Self (URL ID)' :
                          p.staffFilter === 'user' ? 'Giriş Yapan Kullanıcı' :
                          p.staffFilter === 'role:sales' ? 'Satış' :
                          p.staffFilter === 'role:management' ? 'Yönetim' :
                          p.staffFilter === 'none' ? 'Admin Atar' : escapeHtml(p.staffFilter);

        const safeKey = escapeHtml(key);
        const safeCode = escapeHtml(CODE_LABELS[p.code] || '#' + p.code);
        const safeSlotGrid = escapeHtml(String(p.slotGrid));
        const safeDuration = escapeHtml(String(p.duration));
        const safeMaxSlot = escapeHtml(String(p.maxSlotAppointment));
        const safeMaxDaily = p.maxDailyDelivery ? escapeHtml(String(p.maxDailyDelivery)) : '∞';
        const safeMaxPerStaff = p.maxDailyPerStaff ? escapeHtml(String(p.maxDailyPerStaff)) : '∞';

        html += `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: 500;">${escapeHtml(PROFIL_LABELS[key] || key)}</td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;"><code>${safeCode}</code></td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">${p.idKontrolu ? '✓' : '-'}</td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">${p.vardiyaKontrolu !== false ? '✓' : '-'}</td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">${safeMaxSlot}</td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">${safeMaxDaily}</td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">${safeMaxPerStaff}</td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">${safeSlotGrid}dk</td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">${safeDuration}dk</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">${staffLabel}</td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">
                    <button class="btn btn-small" data-action="edit" data-profil="${safeKey}">Düzenle</button>
                </td>
            </tr>
        `;
    }

    html += '</tbody></table>';
    container.innerHTML = html;

    // Add click listeners for edit buttons
    container.querySelectorAll('[data-action="edit"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const key = (e.target as HTMLElement).getAttribute('data-profil');
            if (key) openEditModal(key);
        });
    });
}

/**
 * Open edit modal for a profile
 */
function openEditModal(key: string): void {
    const p = profilAyarlari[key];
    if (!p) return;

    currentEditKey = key;

    // Set modal title
    const titleEl = document.getElementById('editProfilTitle');
    if (titleEl) titleEl.textContent = `${PROFIL_LABELS[key] || key} Profili Düzenle`;

    // Set form values
    (document.getElementById('editProfilKey') as HTMLInputElement).value = key;
    (document.getElementById('editProfilMaxSlot') as HTMLSelectElement).value = String(p.maxSlotAppointment);
    (document.getElementById('editProfilSlotGrid') as HTMLSelectElement).value = String(p.slotGrid);
    (document.getElementById('editProfilDuration') as HTMLSelectElement).value = String(p.duration);
    (document.getElementById('editProfilMaxDailyDelivery') as HTMLSelectElement).value = String(p.maxDailyDelivery || 0);
    (document.getElementById('editProfilMaxDailyPerStaff') as HTMLSelectElement).value = String(p.maxDailyPerStaff || 0);
    (document.getElementById('editProfilStaffFilter') as HTMLSelectElement).value = p.staffFilter;
    (document.getElementById('editProfilTakvimFiltresi') as HTMLSelectElement).value = p.takvimFiltresi || 'withtoday';
    (document.getElementById('editProfilVardiyaKontrolu') as HTMLInputElement).checked = p.vardiyaKontrolu !== false; // default true
    (document.getElementById('editProfilIdKontrolu') as HTMLInputElement).checked = p.idKontrolu === true; // v3.9: ID kontrolü

    // Set allowed types checkboxes
    const typeCheckboxes = document.querySelectorAll('.profil-type-checkbox') as NodeListOf<HTMLInputElement>;
    typeCheckboxes.forEach(checkbox => {
        checkbox.checked = p.allowedTypes?.includes(checkbox.value) || false;
    });

    // Update "Hepsi" checkbox based on all types selected
    const allCheckbox = document.getElementById('profil-type-all') as HTMLInputElement;
    if (allCheckbox) {
        const allChecked = Array.from(typeCheckboxes).every(cb => cb.checked);
        allCheckbox.checked = allChecked;
    }

    // Show modal
    document.getElementById('editProfilModal')?.classList.add('active');
}

/**
 * Close edit modal
 */
function closeEditModal(): void {
    currentEditKey = null;
    document.getElementById('editProfilModal')?.classList.remove('active');
}

/**
 * Save profile settings
 */
async function saveProfilAyari(): Promise<void> {
    if (!currentEditKey) return;

    const saveBtn = document.getElementById('saveProfilBtn') as HTMLButtonElement;
    ButtonAnimator.start(saveBtn);

    // Get allowed types from checkboxes
    const allowedTypes: string[] = [];
    const typeCheckboxes = document.querySelectorAll('.profil-type-checkbox:checked') as NodeListOf<HTMLInputElement>;
    typeCheckboxes.forEach(checkbox => allowedTypes.push(checkbox.value));

    const staffFilter = (document.getElementById('editProfilStaffFilter') as HTMLSelectElement).value;
    const takvimFiltresi = (document.getElementById('editProfilTakvimFiltresi') as HTMLSelectElement).value;
    const vardiyaKontrolu = (document.getElementById('editProfilVardiyaKontrolu') as HTMLInputElement).checked;
    const idKontrolu = (document.getElementById('editProfilIdKontrolu') as HTMLInputElement).checked;  // v3.9

    const updates = {
        // sameDayBooking takvimFiltresi'nden türetiliyor: onlytoday/withtoday = true, withouttoday = false
        sameDayBooking: takvimFiltresi !== 'withouttoday',
        maxSlotAppointment: parseInt((document.getElementById('editProfilMaxSlot') as HTMLSelectElement).value),
        slotGrid: parseInt((document.getElementById('editProfilSlotGrid') as HTMLSelectElement).value),
        duration: parseInt((document.getElementById('editProfilDuration') as HTMLSelectElement).value),
        maxDailyDelivery: parseInt((document.getElementById('editProfilMaxDailyDelivery') as HTMLSelectElement).value),
        maxDailyPerStaff: parseInt((document.getElementById('editProfilMaxDailyPerStaff') as HTMLSelectElement).value),
        assignByAdmin: staffFilter === 'none',  // Admin atar = Personel filtresi "none" ise
        staffFilter: staffFilter,
        takvimFiltresi: takvimFiltresi,
        vardiyaKontrolu: vardiyaKontrolu,  // v3.8: Vardiya kontrolü
        idKontrolu: idKontrolu,            // v3.9: ID kontrolü
        allowedTypes: allowedTypes
    };

    try {
        const response = await apiCall('updateProfilAyarlari', {
            profil: currentEditKey,
            updates: JSON.stringify(updates)
        }) as { success: boolean; error?: string };

        if (response.success) {
            ButtonAnimator.success(saveBtn);
            getUI().showAlert('Profil ayarları güncellendi!', 'success');
            setTimeout(() => {
                closeEditModal();
                loadProfilAyarlari();
            }, 1000);
        } else {
            ButtonAnimator.error(saveBtn);
            // errorId varsa debug için göster
            const errorMsg = response.error || 'Güncelleme başarısız';
            const errorId = (response as any).errorId;
            getUI().showAlert(`${errorMsg}${errorId ? ` (${errorId})` : ''}`, 'error');
        }
    } catch (error) {
        console.error('Profil güncelleme hatası:', error);
        ButtonAnimator.error(saveBtn);
        getUI().showAlert('Bağlantı hatası', 'error');
    }
}

/**
 * Reset all profile settings to defaults
 */
async function resetProfilAyarlari(): Promise<void> {
    if (!confirm('Tüm profil ayarlarını varsayılana sıfırlamak istediğinize emin misiniz?')) {
        return;
    }

    const resetBtn = document.getElementById('resetProfilBtn') as HTMLButtonElement;
    ButtonAnimator.start(resetBtn);

    try {
        const response = await apiCall('resetProfilAyarlari') as { success: boolean; error?: string };

        if (response.success) {
            ButtonAnimator.success(resetBtn);
            getUI().showAlert('Profil ayarları sıfırlandı!', 'success');
            setTimeout(() => loadProfilAyarlari(), 1000);
        } else {
            ButtonAnimator.error(resetBtn);
            getUI().showAlert(`${response.error || 'Sıfırlama başarısız'}`, 'error');
        }
    } catch (error) {
        console.error('Profil sıfırlama hatası:', error);
        ButtonAnimator.error(resetBtn);
        getUI().showAlert('Bağlantı hatası', 'error');
    }
}

/**
 * Setup event listeners
 */
function setupEventListeners(): void {
    // Save button
    document.getElementById('saveProfilBtn')?.addEventListener('click', saveProfilAyari);

    // Cancel button
    document.getElementById('cancelProfilBtn')?.addEventListener('click', closeEditModal);

    // Reset button
    document.getElementById('resetProfilBtn')?.addEventListener('click', resetProfilAyarlari);

    // Modal overlay click
    document.getElementById('editProfilModal')?.querySelector('.modal-overlay')?.addEventListener('click', closeEditModal);

    // "Hepsi" checkbox - tüm randevu türlerini seç/kaldır
    document.getElementById('profil-type-all')?.addEventListener('change', (e) => {
        const isChecked = (e.target as HTMLInputElement).checked;
        const typeCheckboxes = document.querySelectorAll('.profil-type-checkbox') as NodeListOf<HTMLInputElement>;
        typeCheckboxes.forEach(checkbox => {
            checkbox.checked = isChecked;
        });
    });

    // Tekil checkbox değiştiğinde "Hepsi" durumunu güncelle
    document.querySelectorAll('.profil-type-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const typeCheckboxes = document.querySelectorAll('.profil-type-checkbox') as NodeListOf<HTMLInputElement>;
            const allCheckbox = document.getElementById('profil-type-all') as HTMLInputElement;
            const allChecked = Array.from(typeCheckboxes).every(cb => cb.checked);
            if (allCheckbox) allCheckbox.checked = allChecked;
        });
    });
}


