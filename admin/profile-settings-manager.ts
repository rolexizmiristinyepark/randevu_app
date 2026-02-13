/**
 * PROFILE SETTINGS MANAGER - Profil Ayarları Yönetimi
 * v3.4: Dinamik profil ayarları düzenleme (simplified - defaultType/showTypeSelection removed)
 * v3.5: XSS koruması - DOM API ile güvenli render (innerHTML yok)
 */

import { apiCall } from '../api-service';
import { ButtonAnimator } from '../button-utils';

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

// Profil isimleri (key: DB profile_code)
const PROFIL_LABELS: Record<string, string> = {
    g: 'GENEL',
    w: 'GÜNLÜK',
    b: 'MAĞAZA',
    m: 'YÖNETİM',
    s: 'BİREYSEL',
    v: 'ÖZEL MÜŞTERİ'
};

// Mobil kısa etiketler (768px altı)
const PROFIL_LABELS_MOBILE: Record<string, string> = {
    g: 'GEN',
    w: 'GÜN',
    b: 'MAĞ',
    m: 'YÖN',
    s: 'BİR',
    v: 'ÖZEL'
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
        const response = await apiCall('getAllProfilAyarlari') as { success: boolean; data: Record<string, any> };

        if (response.success && response.data) {
            // Backend profilKodu/profilAdi döner, frontend code alanı bekler
            const mapped: ProfilAyarlari = {};
            for (const [key, p] of Object.entries(response.data)) {
                mapped[key] = {
                    code: p.profilKodu || key,
                    idKontrolu: p.idKontrolu ?? false,
                    expectedRole: p.expectedRole,
                    sameDayBooking: p.sameDayBooking ?? false,
                    maxSlotAppointment: p.maxSlotAppointment ?? 1,
                    slotGrid: p.slotGrid ?? 60,
                    maxDailyPerStaff: p.maxDailyPerStaff ?? 4,
                    maxDailyDelivery: p.maxDailyDelivery ?? 0,
                    duration: p.duration ?? 60,
                    assignByAdmin: p.assignByAdmin ?? false,
                    allowedTypes: p.allowedTypes ?? [],
                    staffFilter: p.staffFilter ?? 'role',
                    takvimFiltresi: p.takvimFiltresi ?? 'withtoday',
                    vardiyaKontrolu: p.vardiyaKontrolu ?? true,
                };
            }
            profilAyarlari = mapped;
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
 * DOM API ile tablo hücresi oluşturma yardımcısı
 */
function createCell(tag: 'td' | 'th', text: string, style: string): HTMLElement {
    const cell = document.createElement(tag);
    cell.style.cssText = style;
    cell.textContent = text;
    return cell;
}

/**
 * Render profile settings table
 * DOM API kullanılıyor (innerHTML yerine) - XSS koruması
 */
function renderTable(): void {
    const container = document.getElementById('profilAyarlariTable');
    if (!container) return;

    // Mevcut icerik temizle
    while (container.firstChild) container.removeChild(container.firstChild);

    const profilOrder = ['g', 'w', 'b', 'm', 's', 'v'];
    const profiles = profilOrder.map(k => profilAyarlari[k]).filter(Boolean);
    if (profiles.length === 0) return;

    const table = document.createElement('table');
    table.className = 'settings-table';

    const thStyle = 'padding: 8px 6px; text-align: center; border-bottom: 1px solid #e0e0e0; font-weight: 400; font-size: 10px; letter-spacing: 0.8px; cursor: pointer;';
    const thRowStyle = 'padding: 8px 6px; text-align: left; border-bottom: 1px solid #f0f0f0; font-weight: 500; color: #555; font-size: 11px; white-space: nowrap;';
    const tdStyle = 'padding: 8px 6px; text-align: center; border-bottom: 1px solid #f0f0f0; font-size: 12px;';

    // Thead: boş köşe + profil adları (tıklanabilir)
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.appendChild(createCell('th', '', thStyle)); // boş köşe

    const isMobile = window.innerWidth <= 768;
    const labels = isMobile ? PROFIL_LABELS_MOBILE : PROFIL_LABELS;

    let colIdx = 0;
    for (const key of profilOrder) {
        const p = profilAyarlari[key];
        if (!p) continue;
        const th = createCell('th', labels[key] || key, thStyle);
        th.dataset.col = String(colIdx);
        th.addEventListener('click', () => openEditModal(key));
        headerRow.appendChild(th);
        colIdx++;
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Tbody: her satır bir ayar
    const tbody = document.createElement('tbody');

    // Stafffilter label helper
    const staffLabel = (p: ProfilAyari): string =>
        p.staffFilter === 'self' ? 'Self' :
        p.staffFilter === 'user' ? 'User' :
        p.staffFilter === 'role:sales' ? 'Sales' :
        p.staffFilter === 'role:management' ? 'Mgmt' :
        p.staffFilter === 'role' ? 'Role' :
        p.staffFilter === 'linked' ? 'Linked' :
        p.staffFilter === 'all' ? 'All' :
        p.staffFilter === 'none' ? 'Admin' : p.staffFilter;

    // Ayar satırları tanımı
    const rows: { label: string; getValue: (p: ProfilAyari) => string }[] = [
        { label: 'Url', getValue: p => CODE_LABELS[p.code] || '#' + p.code },
        { label: 'Id', getValue: p => p.idKontrolu ? '✓' : '-' },
        { label: 'Shift', getValue: p => p.vardiyaKontrolu !== false ? '✓' : '-' },
        { label: 'Slot Max', getValue: p => String(p.maxSlotAppointment) },
        { label: 'Daily D Max', getValue: p => p.maxDailyDelivery ? String(p.maxDailyDelivery) : '∞' },
        { label: 'Daily S Max', getValue: p => p.maxDailyPerStaff ? String(p.maxDailyPerStaff) : '∞' },
        { label: 'Slot Grid', getValue: p => p.slotGrid + 'dk' },
        { label: 'Slot Time', getValue: p => p.duration + 'dk' },
        { label: 'Staff', getValue: p => staffLabel(p) },
    ];

    for (const row of rows) {
        const tr = document.createElement('tr');
        tr.appendChild(createCell('td', row.label, thRowStyle));

        let ci = 0;
        for (const key of profilOrder) {
            const p = profilAyarlari[key];
            if (!p) continue;
            const td = createCell('td', row.getValue(p), tdStyle);
            td.dataset.col = String(ci);
            tr.appendChild(td);
            ci++;
        }
        tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    container.appendChild(table);

    // Sütun hover: event delegation
    let activeCol: string | null = null;
    table.addEventListener('mouseover', (e: Event) => {
        const target = e.target as HTMLElement;
        const col = target.dataset.col;
        if (col === undefined || col === activeCol) return;
        // Önceki highlight temizle
        if (activeCol !== null) {
            table.querySelectorAll('[data-col="' + activeCol + '"]').forEach(el => el.classList.remove('col-highlight'));
        }
        activeCol = col;
        table.querySelectorAll('[data-col="' + col + '"]').forEach(el => el.classList.add('col-highlight'));
    });
    table.addEventListener('mouseleave', () => {
        if (activeCol !== null) {
            table.querySelectorAll('[data-col="' + activeCol + '"]').forEach(el => el.classList.remove('col-highlight'));
            activeCol = null;
        }
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
    if (titleEl) titleEl.textContent = `Edit ${PROFIL_LABELS[key] || key} Profile`;

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
 * Setup event listeners
 */
function setupEventListeners(): void {
    // Save button
    document.getElementById('saveProfilBtn')?.addEventListener('click', saveProfilAyari);

    // Cancel button
    document.getElementById('cancelProfilBtn')?.addEventListener('click', closeEditModal);

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


