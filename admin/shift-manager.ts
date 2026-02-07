/**
 * SHIFT MANAGER - Vardiya Yönetimi Modülü
 * Sorumluluklar: Haftalık vardiya oluşturma, düzenleme, kaydetme
 */

import { apiCall } from '../api-service';
import { DateUtils } from '../date-utils';
import { ErrorUtils } from '../error-utils';
import { ButtonAnimator } from '../button-utils';
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

// Lazy accessors to avoid module load order issues
const getUI = () => window.UI;
const getCreateElement = () => window.createElement;

// Turkish month names
const TURKISH_MONTHS = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

/**
 * Get Monday date from week string (YYYY-Www)
 */
function getMondayFromWeek(weekStr: string): Date {
    const [year, week] = weekStr.split('-W').map(Number);
    const date = new Date(year, 0, 1);
    const dayOfWeek = date.getDay();
    const diff = (dayOfWeek <= 4 ? 1 - dayOfWeek : 8 - dayOfWeek);
    date.setDate(date.getDate() + diff + (week - 1) * 7);
    return date;
}

/**
 * Format week as "08 - 14 Aralık 2025"
 */
function formatWeekDisplay(weekStr: string): string {
    if (!weekStr) return 'Hafta Seç';

    const monday = getMondayFromWeek(weekStr);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);

    const monDay = String(monday.getDate()).padStart(2, '0');
    const sunDay = String(sunday.getDate()).padStart(2, '0');
    const monMonth = TURKISH_MONTHS[monday.getMonth()];
    const sunMonth = TURKISH_MONTHS[sunday.getMonth()];
    const year = sunday.getFullYear();

    // Same month
    if (monday.getMonth() === sunday.getMonth()) {
        return `${monDay} - ${sunDay} ${sunMonth} ${year}`;
    }
    // Different months
    return `${monDay} ${monMonth} - ${sunDay} ${sunMonth} ${year}`;
}

/**
 * Update the week display text
 */
function updateWeekDisplay(): void {
    const weekInput = document.getElementById('weekDate') as HTMLInputElement;
    const displayText = document.getElementById('weekDisplayText');

    if (displayText && weekInput) {
        displayText.textContent = formatWeekDisplay(weekInput.value);
    }
}

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
    // Previous week button
    const prevWeekBtn = document.getElementById('prevWeekBtn');
    prevWeekBtn?.addEventListener('click', () => prevWeek());

    // Next week button
    const nextWeekBtn = document.getElementById('nextWeekBtn');
    nextWeekBtn?.addEventListener('click', () => nextWeek());

    // Save shifts button
    const saveBtn = document.getElementById('saveShiftsBtn');
    saveBtn?.addEventListener('click', () => save());

    // Week selector change
    const weekDate = document.getElementById('weekDate') as HTMLInputElement;
    weekDate?.addEventListener('change', () => {
        updateWeekDisplay();
        load();
    });

    // Click anywhere on week display to open picker
    const weekWrapper = document.querySelector('.week-display-wrapper');
    weekWrapper?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (weekDate && typeof weekDate.showPicker === 'function') {
            weekDate.showPicker();
        } else if (weekDate) {
            weekDate.focus();
        }
    });

    // Window resize for responsive shift labels
    window.addEventListener('resize', () => updateShiftLabels());
}

/**
 * Get ISO 8601 week number
 * Week 1 is the week containing the first Thursday of the year
 */
function getISOWeek(date: Date): { year: number; week: number } {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    // Set to nearest Thursday: current date + 4 - current day number (Sunday = 7)
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    // Get first day of ISO week year
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    // Calculate week number
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return { year: d.getUTCFullYear(), week: weekNo };
}

/**
 * Initialize - set current week
 */
function init(): void {
    // Set this week using ISO 8601 week number
    const today = new Date();
    const { year, week } = getISOWeek(today);

    const weekInput = document.getElementById('weekDate') as HTMLInputElement;
    if (weekInput) {
        weekInput.value = `${year}-W${String(week).padStart(2, '0')}`;
    }

    updateWeekDisplay();
    load();
}

/**
 * Load week shifts
 */
async function load(): Promise<void> {
    const weekInput = document.getElementById('weekDate') as HTMLInputElement;
    const weekValue = weekInput?.value;

    if (!weekValue) {
        getUI().showAlert('Hafta seçin!', 'error');
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
 * Get number of ISO weeks in a year
 */
function getWeeksInYear(year: number): number {
    // A year has 53 weeks if Jan 1 is Thursday or if it's a leap year and Jan 1 is Wednesday
    const jan1 = new Date(year, 0, 1);
    const dec31 = new Date(year, 11, 31);
    const jan1Day = jan1.getDay();
    const dec31Day = dec31.getDay();
    // Year has 53 weeks if Thursday is in week 1 or week 53
    return (jan1Day === 4 || dec31Day === 4) ? 53 : 52;
}

/**
 * Go to previous week
 */
function prevWeek(): void {
    const weekInput = document.getElementById('weekDate') as HTMLInputElement;
    const weekValue = weekInput?.value;

    if (!weekValue) return;

    const [yearStr, weekStr] = weekValue.split('-W');
    const year = parseInt(yearStr || '0');
    const prevWeekNum = parseInt(weekStr || '0') - 1;

    if (prevWeekNum < 1) {
        const prevYear = year - 1;
        const weeksInPrevYear = getWeeksInYear(prevYear);
        weekInput.value = `${prevYear}-W${String(weeksInPrevYear).padStart(2, '0')}`;
    } else {
        weekInput.value = `${year}-W${String(prevWeekNum).padStart(2, '0')}`;
    }

    updateWeekDisplay();
    load();
}

/**
 * Go to next week
 */
function nextWeek(): void {
    const weekInput = document.getElementById('weekDate') as HTMLInputElement;
    const weekValue = weekInput?.value;

    if (!weekValue) return;

    const [yearStr, weekStr] = weekValue.split('-W');
    const year = parseInt(yearStr || '0');
    const nextWeekNum = parseInt(weekStr || '0') + 1;
    const weeksInYear = getWeeksInYear(year);

    if (nextWeekNum > weeksInYear) {
        weekInput.value = `${year + 1}-W01`;
    } else {
        weekInput.value = `${year}-W${String(nextWeekNum).padStart(2, '0')}`;
    }

    updateWeekDisplay();
    load();
}

/**
 * Save shifts
 */
async function save(): Promise<void> {
    if (!currentWeek) {
        getUI().showAlert('Önce hafta yükleyin!', 'error');
        return;
    }

    // Backend expects: shifts = [{ date, staffId, shiftType }, ...]
    const shiftsArray: Array<{ date: string; staffId: string; shiftType: string }> = [];
    // Also keep nested format for local dataStore merge
    const shiftsNested: Record<string, Record<string, string>> = {};
    const selects = document.querySelectorAll('.shift-select') as NodeListOf<HTMLSelectElement>;

    selects.forEach(select => {
        const staffId = select.dataset.staff || '';
        const date = select.dataset.date || '';
        const value = select.value;

        if (!staffId || !date) return;

        if (!shiftsNested[date]) shiftsNested[date] = {};

        if (value) {
            shiftsNested[date][staffId] = value;
            shiftsArray.push({ date, staffId, shiftType: value });
        }
    });

    const btn = document.getElementById('saveShiftsBtn') as HTMLButtonElement;
    ButtonAnimator.start(btn);

    try {
        const response = await apiCall('saveShifts', {
            shifts: shiftsArray
        });

        if (response.success) {
            // Merge with local data
            Object.assign(dataStore.shifts, shiftsNested);
            ButtonAnimator.success(btn);
            renderSaved();
            getUI().showAlert('Vardiyalar kaydedildi!', 'success');
        } else {
            ButtonAnimator.error(btn);
            ErrorUtils.handleApiError(response as any, 'saveShifts', getUI().showAlert.bind(getUI()));
        }
    } catch (error) {
        ButtonAnimator.error(btn);
        ErrorUtils.handleException(error, 'Kaydetme', getUI().showAlert.bind(getUI()));
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
    const table = getCreateElement()('table', { className: 'shift-table' });

    // Table head
    const thead = getCreateElement()('thead');
    const headerRow = getCreateElement()('tr');

    // First header cell - "İlgili"
    const staffHeader = getCreateElement()('th', {}, 'İlgili');
    headerRow.appendChild(staffHeader);

    // Day headers
    for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        const dateStr = d.getDate() + ' ' + (d.getMonth() + 1);

        const dayHeader = getCreateElement()('th');
        dayHeader.appendChild(document.createTextNode(days[i] || ''));
        dayHeader.appendChild(getCreateElement()('br'));
        const small = getCreateElement()('small', {}, String(dateStr));
        dayHeader.appendChild(small);
        headerRow.appendChild(dayHeader);
    }

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Table body
    const tbody = getCreateElement()('tbody');

    dataStore.staff.filter(s => s.active).forEach(staff => {
        const staffRow = getCreateElement()('tr');

        // Staff name cell
        const nameCell = getCreateElement()('td', {
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

            const dayCell = getCreateElement()('td');
            const select = getCreateElement()('select', {
                className: 'shift-select',
                'data-staff': staff.id,
                'data-date': dateKey,
                'data-shift': current  // For coloring
            }) as HTMLSelectElement;

            // Options - full words
            const opt1 = getCreateElement()('option', { value: '' }) as HTMLOptionElement;
            opt1.textContent = 'Off';

            const opt2 = getCreateElement()('option', { value: 'morning' }) as HTMLOptionElement;
            opt2.textContent = 'Sabah';

            const opt3 = getCreateElement()('option', { value: 'evening' }) as HTMLOptionElement;
            opt3.textContent = 'Akşam';

            const opt4 = getCreateElement()('option', { value: 'full' }) as HTMLOptionElement;
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

            // Update data-shift attribute on change for CSS coloring
            select.addEventListener('change', function(this: HTMLSelectElement) {
                this.setAttribute('data-shift', this.value);
            });

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
        const emptyMsg = getCreateElement()('p', {
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
        const weekDiv = getCreateElement()('div', {
            style: {
                background: 'white',
                padding: '18px',
                borderRadius: '2px',
                marginBottom: '12px',
                border: '1px solid #E8E8E8'
            }
        });

        // Container for title and button
        const headerDiv = getCreateElement()('div', {
            style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
        });

        // Week title - clickable
        const titleDiv = getCreateElement()('div', {
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
        const editBtn = getCreateElement()('button', {
            className: 'btn btn-small btn-secondary'
        }, 'Edit');
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
