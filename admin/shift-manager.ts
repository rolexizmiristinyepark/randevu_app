/**
 * SHIFT MANAGER - Vardiya Yönetimi Modülü
 * Sorumluluklar: Haftalık vardiya oluşturma, düzenleme, kaydetme
 */

import { apiCall } from '../api-service';
import { DateUtils } from '../date-utils';
import { ErrorUtils } from '../error-utils';
import { ButtonUtils } from '../button-utils';
import type { DataStore } from './data-store';

// Module-scoped variables
let dataStore: DataStore;
let currentWeek: string | null = null;

// Global references (accessed via window)
declare global {
    interface Window {
        UI: any;
        createElement: (tag: string, attributes?: any, textContent?: string) => HTMLElement;
    }
}

const { UI, createElement } = window;

/**
 * Initialize Shift Manager module
 */
export async function initShiftManager(store: DataStore): Promise<void> {
    dataStore = store;
    init();
    setupEventListeners();
}

/**
 * Setup event listeners for shift management
 */
function setupEventListeners(): void {
    // Next week button
    const nextWeekBtn = document.getElementById('nextWeekBtn');
    nextWeekBtn?.addEventListener('click', () => nextWeek());

    // Save shifts button
    const saveBtn = document.getElementById('saveShiftsBtn');
    saveBtn?.addEventListener('click', () => save());

    // Week selector change
    const weekDate = document.getElementById('weekDate');
    weekDate?.addEventListener('change', () => load());

    // Window resize for responsive shift labels
    window.addEventListener('resize', () => updateShiftLabels());
}

/**
 * Initialize - set current week
 */
function init(): void {
    // Set this week (Monday start)
    const today = new Date();
    const year = today.getFullYear();
    const firstDayOfYear = new Date(year, 0, 1);
    const pastDaysOfYear = (today.getTime() - firstDayOfYear.getTime()) / 86400000;
    const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);

    const weekInput = document.getElementById('weekDate') as HTMLInputElement;
    if (weekInput) {
        weekInput.value = `${year}-W${String(weekNumber).padStart(2, '0')}`;
    }

    load();
}

/**
 * Load week shifts
 */
async function load(): Promise<void> {
    const weekInput = document.getElementById('weekDate') as HTMLInputElement;
    const weekValue = weekInput?.value;

    if (!weekValue) {
        UI.showAlert('❌ Hafta seçin!', 'error');
        return;
    }

    // Calculate date range from week value
    const [year, week] = weekValue.split('-W');
    const firstDayOfYear = new Date(parseInt(year || '0'), 0, 1);
    const daysOffset = (parseInt(week || '0') - 1) * 7;
    const weekStart = new Date(firstDayOfYear.getTime());
    weekStart.setDate(firstDayOfYear.getDate() + daysOffset);

    // Find Monday
    const dayOfWeek = weekStart.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    weekStart.setDate(weekStart.getDate() + diff);

    // Format date with DateUtils
    currentWeek = DateUtils.toLocalDate(weekStart);

    // Load month data
    const monthStr = currentWeek.slice(0, 7); // YYYY-MM part

    try {
        const response = await apiCall('getMonthShifts', { month: monthStr });
        if (response.success) {
            dataStore.shifts = (response.data as any) || {};
        }
    } catch (error) {
        console.error('Vardiyalar yüklenemedi:', error);
    }

    render();
    renderSaved();
}

/**
 * Go to next week
 */
function nextWeek(): void {
    const weekInput = document.getElementById('weekDate') as HTMLInputElement;
    const weekValue = weekInput?.value;

    if (!weekValue) return;

    const [year, week] = weekValue.split('-W');
    const nextWeekNum = parseInt(week || '0') + 1;

    if (nextWeekNum > 52) {
        weekInput.value = `${parseInt(year || '0') + 1}-W01`;
    } else {
        weekInput.value = `${year}-W${String(nextWeekNum).padStart(2, '0')}`;
    }

    load();
}

/**
 * Save shifts
 */
async function save(): Promise<void> {
    if (!currentWeek) {
        UI.showAlert('❌ Önce hafta yükleyin!', 'error');
        return;
    }

    const shiftsData: Record<string, Record<number, string>> = {};
    const selects = document.querySelectorAll('.shift-select') as NodeListOf<HTMLSelectElement>;

    selects.forEach(select => {
        const staffId = parseInt(select.dataset.staff || '0');
        const date = select.dataset.date || '';
        const value = select.value;

        if (!shiftsData[date]) shiftsData[date] = {};

        if (value) {
            shiftsData[date][staffId] = value;
        }
    });

    const btn = document.getElementById('saveShiftsBtn') as HTMLButtonElement;
    ButtonUtils.setLoading(btn, 'Kaydediliyor');

    try {
        const response = await apiCall('saveShifts', {
            shifts: JSON.stringify(shiftsData)
        });

        if (response.success) {
            // Merge with local data
            Object.assign(dataStore.shifts, shiftsData);
            renderSaved();
            UI.showAlert('✅ Vardiyalar kaydedildi!', 'success');
        } else {
            ErrorUtils.handleApiError(response as any, 'saveShifts', UI.showAlert.bind(UI));
        }
    } catch (error) {
        ErrorUtils.handleException(error, 'Kaydetme', UI.showAlert.bind(UI));
    } finally {
        ButtonUtils.reset(btn);
    }
}

/**
 * Render shift table
 */
function render(): void {
    const container = document.getElementById('shiftTable');
    if (!container || !currentWeek) return;

    // Clear
    container.textContent = '';

    // Parse week start date
    const parts = currentWeek.split('-').map(Number);
    const year = parts[0] || 0;
    const month = parts[1] || 0;
    const day = parts[2] || 0;
    const weekStart = new Date(year, month - 1, day);
    const days = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

    // Create table with createElement
    const table = createElement('table', { className: 'shift-table' });

    // Table head
    const thead = createElement('thead');
    const headerRow = createElement('tr');

    // First header cell - "İlgili"
    const staffHeader = createElement('th', {}, 'İlgili');
    headerRow.appendChild(staffHeader);

    // Day headers
    for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        const dateStr = d.getDate() + ' ' + (d.getMonth() + 1);

        const dayHeader = createElement('th');
        dayHeader.appendChild(document.createTextNode(days[i] || ''));
        dayHeader.appendChild(createElement('br'));
        const small = createElement('small', {}, String(dateStr));
        dayHeader.appendChild(small);
        headerRow.appendChild(dayHeader);
    }

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Table body
    const tbody = createElement('tbody');

    dataStore.staff.filter(s => s.active).forEach(staff => {
        const staffRow = createElement('tr');

        // Staff name cell
        const nameCell = createElement('td', {
            style: { textAlign: 'left', fontWeight: '400' }
        }, staff.name);
        staffRow.appendChild(nameCell);

        // Day cells with select dropdowns
        for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + i);
            // Format date with DateUtils
            const dateKey = DateUtils.toLocalDate(d);
            const current = dataStore.shifts[dateKey]?.[staff.id] || '';

            const dayCell = createElement('td');
            const select = createElement('select', {
                className: 'shift-select',
                'data-staff': staff.id,
                'data-date': dateKey,
                'data-shift': current  // For coloring
            }) as HTMLSelectElement;

            // Options - full words
            const opt1 = createElement('option', { value: '' }) as HTMLOptionElement;
            opt1.textContent = 'Off';

            const opt2 = createElement('option', { value: 'morning' }) as HTMLOptionElement;
            opt2.textContent = 'Sabah';

            const opt3 = createElement('option', { value: 'evening' }) as HTMLOptionElement;
            opt3.textContent = 'Akşam';

            const opt4 = createElement('option', { value: 'full' }) as HTMLOptionElement;
            opt4.textContent = 'Full';

            // Set selected option
            if (current === 'morning') opt2.selected = true;
            if (current === 'evening') opt3.selected = true;
            if (current === 'full') opt4.selected = true;
            if (current === '') opt1.selected = true;

            select.appendChild(opt1);
            select.appendChild(opt2);
            select.appendChild(opt3);
            select.appendChild(opt4);

            dayCell.appendChild(select);
            staffRow.appendChild(dayCell);
        }

        tbody.appendChild(staffRow);
    });

    table.appendChild(tbody);
    container.appendChild(table);

    // Responsive: apply abbreviations for small screens
    updateShiftLabels();
}

/**
 * Update shift labels based on screen width
 */
function updateShiftLabels(): void {
    const isSmallScreen = window.innerWidth <= 1024;
    const selects = document.querySelectorAll('.shift-table select') as NodeListOf<HTMLSelectElement>;

    selects.forEach(select => {
        Array.from(select.options).forEach(option => {
            const value = option.value;
            if (isSmallScreen) {
                // Small screen abbreviations
                if (value === '') option.textContent = 'Off';
                if (value === 'morning') option.textContent = 'S';
                if (value === 'evening') option.textContent = 'A';
                if (value === 'full') option.textContent = 'F';
            } else {
                // Normal screen full words
                if (value === '') option.textContent = 'Off';
                if (value === 'morning') option.textContent = 'Sabah';
                if (value === 'evening') option.textContent = 'Akşam';
                if (value === 'full') option.textContent = 'Full';
            }
        });
    });
}

/**
 * Render saved shifts (last 10 weeks)
 */
function renderSaved(): void {
    const container = document.getElementById('savedShifts');
    if (!container) return;

    const dates = Object.keys(dataStore.shifts).sort().reverse().slice(0, 10);

    // Clear
    container.textContent = '';

    if (dates.length === 0) {
        const emptyMsg = createElement('p', {
            style: { textAlign: 'center', color: '#999', padding: '20px' }
        }, 'Kayıtlı plan yok');
        container.appendChild(emptyMsg);
        return;
    }

    const weeks: Record<string, string[]> = {};
    dates.forEach(dateStr => {
        // Create Date in local timezone
        const parts = dateStr.split('-').map(Number);
        const year = parts[0] || 0;
        const month = parts[1] || 0;
        const day = parts[2] || 0;
        const d = new Date(year, month - 1, day);
        const dayOfWeek = d.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(d);
        monday.setDate(d.getDate() + diff);

        // Format date with DateUtils
        const weekKey = DateUtils.toLocalDate(monday);

        if (!weeks[weekKey]) weeks[weekKey] = [];
        weeks[weekKey].push(dateStr);
    });

    // Use DocumentFragment for performance
    const fragment = document.createDocumentFragment();

    Object.keys(weeks).sort().reverse().forEach(weekStart => {
        const parts = weekStart.split('-').map(Number);
        const year = parts[0] || 0;
        const month = parts[1] || 0;
        const day = parts[2] || 0;
        const weekStartDate = new Date(year, month - 1, day);
        const weekEnd = new Date(weekStartDate);
        weekEnd.setDate(weekStartDate.getDate() + 6);

        // Week container
        const weekDiv = createElement('div', {
            style: {
                background: 'white',
                padding: '18px',
                borderRadius: '2px',
                marginBottom: '12px',
                border: '1px solid #E8E8E8'
            }
        });

        // Container for title and button
        const headerDiv = createElement('div', {
            style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
        });

        // Week title - clickable
        const titleDiv = createElement('div', {
            style: {
                fontWeight: '400',
                fontSize: '13px',
                color: '#1A1A2E',
                letterSpacing: '0.5px',
                cursor: 'pointer',
                flex: '1'
            }
        }, `${weekStartDate.toLocaleDateString('tr-TR')} - ${weekEnd.toLocaleDateString('tr-TR')}`);

        titleDiv.addEventListener('click', () => {
            loadWeek(weekStart);
            // Scroll up
            document.getElementById('shiftTable')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });

        // Edit button
        const editBtn = createElement('button', {
            className: 'btn btn-small btn-secondary'
        }, 'Düzenle');
        editBtn.addEventListener('click', () => {
            loadWeek(weekStart);
            // Scroll up
            document.getElementById('shiftTable')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });

        headerDiv.appendChild(titleDiv);
        headerDiv.appendChild(editBtn);
        weekDiv.appendChild(headerDiv);
        fragment.appendChild(weekDiv);
    });

    container.appendChild(fragment);
}

/**
 * Load specific week
 */
function loadWeek(weekStart: string): void {
    // Convert date string (YYYY-MM-DD) to week format (YYYY-Www)
    const parts = weekStart.split('-').map(Number);
    const year = parts[0] || 0;
    const month = parts[1] || 0;
    const day = parts[2] || 0;
    const date = new Date(year, month - 1, day);

    // Calculate ISO week number
    const firstDayOfYear = new Date(year, 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);

    const weekInput = document.getElementById('weekDate') as HTMLInputElement;
    if (weekInput) {
        weekInput.value = `${year}-W${String(weekNumber).padStart(2, '0')}`;
    }

    load();
    UI.switchTab('shifts');
}

// Export functions for potential future use
export { render as renderShiftTable, load as loadWeekShifts };
