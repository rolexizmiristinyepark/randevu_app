/**
 * PROFILE SETTINGS MANAGER - Profil Ayarları Yönetimi
 * v3.4: Dinamik profil ayarları düzenleme (simplified - defaultType/showTypeSelection removed)
 */

import { apiCall } from '../api-service';

// Profil ayarları interface
interface ProfilAyari {
    code: string;
    idKontrol: boolean;
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
    takvimFiltresi: 'bugun' | 'hepsi';
}

type ProfilAyarlari = Record<string, ProfilAyari>;

// Profil isimleri
const PROFIL_LABELS: Record<string, string> = {
    genel: 'Genel',
    gunluk: 'Günlük',
    boutique: 'Butik',
    yonetim: 'Yönetim',
    personel: 'Personel',
    vip: 'VIP'
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
            container.innerHTML = '<p style="color: #c00; text-align: center; padding: 20px;">Profil ayarları yüklenemedi.</p>';
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
                    <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">Aynı Gün</th>
                    <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">Slot Max</th>
                    <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">Günlük T/G</th>
                    <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">P.Başı T/G</th>
                    <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">Grid</th>
                    <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">Süre</th>
                    <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">Admin Atar</th>
                    <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Personel</th>
                    <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">İşlem</th>
                </tr>
            </thead>
            <tbody>
    `;

    for (const key of profilOrder) {
        const p = profilAyarlari[key];
        if (!p) continue;

        const staffLabel = p.staffFilter === 'self' ? 'Self' :
                          p.staffFilter === 'role:sales' ? 'Sales' :
                          p.staffFilter === 'role:management' ? 'Management' : p.staffFilter;

        html += `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: 500;">${PROFIL_LABELS[key] || key}</td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;"><code>${CODE_LABELS[p.code] || '#' + p.code}</code></td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">${p.idKontrol ? '✓' : '-'}</td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">${p.sameDayBooking ? '✓' : '-'}</td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">${p.maxSlotAppointment}</td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">${p.maxDailyDelivery || '∞'}</td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">${p.maxDailyPerStaff || '∞'}</td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">${p.slotGrid}dk</td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">${p.duration}dk</td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">${p.assignByAdmin ? '✓' : '-'}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">${staffLabel}</td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">
                    <button class="btn btn-small" data-action="edit" data-profil="${key}">Düzenle</button>
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
    (document.getElementById('editProfilSameDayBooking') as HTMLInputElement).checked = p.sameDayBooking;
    (document.getElementById('editProfilMaxSlot') as HTMLSelectElement).value = String(p.maxSlotAppointment);
    (document.getElementById('editProfilSlotGrid') as HTMLSelectElement).value = String(p.slotGrid);
    (document.getElementById('editProfilDuration') as HTMLSelectElement).value = String(p.duration);
    (document.getElementById('editProfilMaxDailyDelivery') as HTMLSelectElement).value = String(p.maxDailyDelivery || 0);
    (document.getElementById('editProfilMaxDailyPerStaff') as HTMLSelectElement).value = String(p.maxDailyPerStaff || 0);
    (document.getElementById('editProfilAssignByAdmin') as HTMLInputElement).checked = p.assignByAdmin;
    (document.getElementById('editProfilStaffFilter') as HTMLSelectElement).value = p.staffFilter;
    (document.getElementById('editProfilTakvimFiltresi') as HTMLSelectElement).value = p.takvimFiltresi || 'bugun';

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
    const originalText = saveBtn.textContent;
    saveBtn.textContent = '⏳';
    saveBtn.disabled = true;

    // Get allowed types from checkboxes
    const allowedTypes: string[] = [];
    const typeCheckboxes = document.querySelectorAll('.profil-type-checkbox:checked') as NodeListOf<HTMLInputElement>;
    typeCheckboxes.forEach(checkbox => allowedTypes.push(checkbox.value));

    const updates = {
        sameDayBooking: (document.getElementById('editProfilSameDayBooking') as HTMLInputElement).checked,
        maxSlotAppointment: parseInt((document.getElementById('editProfilMaxSlot') as HTMLSelectElement).value),
        slotGrid: parseInt((document.getElementById('editProfilSlotGrid') as HTMLSelectElement).value),
        duration: parseInt((document.getElementById('editProfilDuration') as HTMLSelectElement).value),
        maxDailyDelivery: parseInt((document.getElementById('editProfilMaxDailyDelivery') as HTMLSelectElement).value),
        maxDailyPerStaff: parseInt((document.getElementById('editProfilMaxDailyPerStaff') as HTMLSelectElement).value),
        assignByAdmin: (document.getElementById('editProfilAssignByAdmin') as HTMLInputElement).checked,
        staffFilter: (document.getElementById('editProfilStaffFilter') as HTMLSelectElement).value,
        takvimFiltresi: (document.getElementById('editProfilTakvimFiltresi') as HTMLSelectElement).value,
        allowedTypes: allowedTypes
    };

    try {
        const response = await apiCall('updateProfilAyarlari', {
            profil: currentEditKey,
            updates: JSON.stringify(updates)
        }) as { success: boolean; error?: string };

        if (response.success) {
            getUI().showAlert('Profil ayarları güncellendi!', 'success');
            closeEditModal();
            await loadProfilAyarlari();
        } else {
            getUI().showAlert(`${response.error || 'Güncelleme başarısız'}`, 'error');
        }
    } catch (error) {
        console.error('Profil güncelleme hatası:', error);
        getUI().showAlert('Bağlantı hatası', 'error');
    } finally {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
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
    const originalText = resetBtn.textContent;
    resetBtn.textContent = '⏳';
    resetBtn.disabled = true;

    try {
        const response = await apiCall('resetProfilAyarlari') as { success: boolean; error?: string };

        if (response.success) {
            getUI().showAlert('Profil ayarları sıfırlandı!', 'success');
            await loadProfilAyarlari();
        } else {
            getUI().showAlert(`${response.error || 'Sıfırlama başarısız'}`, 'error');
        }
    } catch (error) {
        console.error('Profil sıfırlama hatası:', error);
        getUI().showAlert('Bağlantı hatası', 'error');
    } finally {
        resetBtn.textContent = originalText;
        resetBtn.disabled = false;
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


