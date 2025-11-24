/**
 * SHIFT HELPER UTILITIES FOR TESTS
 * Helper functions for testing shift management functionality
 */

import { vi } from 'vitest';

// ==================== TYPES ====================

export interface ShiftData {
  [date: string]: {
    [staffId: string]: 'morning' | 'evening' | 'full' | '';
  };
}

export interface WeekData {
  year: number;
  week: number;
  weekString: string; // YYYY-Www format
  startDate: Date;
  endDate: Date;
}

// ==================== WEEK CALCULATION HELPERS ====================

/**
 * Get current week number (ISO 8601)
 */
export function getCurrentWeek(): WeekData {
  const today = new Date();
  const year = today.getFullYear();
  const firstDayOfYear = new Date(year, 0, 1);
  const pastDaysOfYear = (today.getTime() - firstDayOfYear.getTime()) / 86400000;
  const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);

  const weekStart = getWeekStartDate(year, weekNumber);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  return {
    year,
    week: weekNumber,
    weekString: `${year}-W${String(weekNumber).padStart(2, '0')}`,
    startDate: weekStart,
    endDate: weekEnd
  };
}

/**
 * Get week start date (Monday) for given year and week number
 */
export function getWeekStartDate(year: number, week: number): Date {
  const firstDayOfYear = new Date(year, 0, 1);
  const daysOffset = (week - 1) * 7;
  const weekStart = new Date(firstDayOfYear.getTime());
  weekStart.setDate(firstDayOfYear.getDate() + daysOffset);

  // Find Monday
  const dayOfWeek = weekStart.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  weekStart.setDate(weekStart.getDate() + diff);

  return weekStart;
}

/**
 * Parse week string (YYYY-Www) to WeekData
 */
export function parseWeekString(weekString: string): WeekData {
  const [yearStr, weekStr] = weekString.split('-W');
  const year = parseInt(yearStr);
  const week = parseInt(weekStr);

  const weekStart = getWeekStartDate(year, week);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  return {
    year,
    week,
    weekString,
    startDate: weekStart,
    endDate: weekEnd
  };
}

/**
 * Get next week string
 */
export function getNextWeek(weekString: string): string {
  const [yearStr, weekStr] = weekString.split('-W');
  const year = parseInt(yearStr);
  const week = parseInt(weekStr);

  if (week >= 52) {
    return `${year + 1}-W01`;
  } else {
    return `${year}-W${String(week + 1).padStart(2, '0')}`;
  }
}

/**
 * Get previous week string
 */
export function getPreviousWeek(weekString: string): string {
  const [yearStr, weekStr] = weekString.split('-W');
  const year = parseInt(yearStr);
  const week = parseInt(weekStr);

  if (week <= 1) {
    return `${year - 1}-W52`;
  } else {
    return `${year}-W${String(week - 1).padStart(2, '0')}`;
  }
}

/**
 * Format date to YYYY-MM-DD (local date string)
 */
export function toLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get all dates in a week (Monday to Sunday)
 */
export function getWeekDates(weekStart: Date): string[] {
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    dates.push(toLocalDate(date));
  }
  return dates;
}

// ==================== SHIFT DATA HELPERS ====================

/**
 * Create mock shift data for a week
 */
export function createMockWeekShifts(weekStart: Date, staffIds: string[]): ShiftData {
  const shifts: ShiftData = {};
  const dates = getWeekDates(weekStart);
  const shiftTypes: Array<'morning' | 'evening' | 'full' | ''> = ['morning', 'evening', 'full', ''];

  dates.forEach((date, dayIndex) => {
    shifts[date] = {};
    staffIds.forEach((staffId, staffIndex) => {
      // Distribute shifts among staff
      const shiftType = shiftTypes[(dayIndex + staffIndex) % shiftTypes.length];
      if (shiftType) {
        shifts[date][staffId] = shiftType;
      }
    });
  });

  return shifts;
}

/**
 * Create empty shift data for a week
 */
export function createEmptyWeekShifts(weekStart: Date): ShiftData {
  const shifts: ShiftData = {};
  const dates = getWeekDates(weekStart);

  dates.forEach(date => {
    shifts[date] = {};
  });

  return shifts;
}

/**
 * Create mock shift data for a single day
 */
export function createDayShift(date: string, staffId: string, shift: 'morning' | 'evening' | 'full'): ShiftData {
  return {
    [date]: {
      [staffId]: shift
    }
  };
}

/**
 * Merge shift data
 */
export function mergeShiftData(...shiftDataArray: ShiftData[]): ShiftData {
  const merged: ShiftData = {};

  shiftDataArray.forEach(shiftData => {
    Object.keys(shiftData).forEach(date => {
      if (!merged[date]) {
        merged[date] = {};
      }
      Object.assign(merged[date], shiftData[date]);
    });
  });

  return merged;
}

// ==================== DOM HELPERS FOR SHIFTS ====================

/**
 * Get shift table element
 */
export function getShiftTable(): HTMLTableElement | null {
  const container = document.getElementById('shiftTable');
  return container?.querySelector('table') as HTMLTableElement | null;
}

/**
 * Get all shift select elements
 */
export function getShiftSelects(): HTMLSelectElement[] {
  return Array.from(document.querySelectorAll('.shift-select'));
}

/**
 * Get shift select for specific staff and date
 */
export function getShiftSelect(staffId: string, date: string): HTMLSelectElement | null {
  return document.querySelector(
    `.shift-select[data-staff="${staffId}"][data-date="${date}"]`
  ) as HTMLSelectElement | null;
}

/**
 * Set shift value for staff on date
 */
export function setShiftValue(staffId: string, date: string, value: 'morning' | 'evening' | 'full' | ''): void {
  const select = getShiftSelect(staffId, date);
  if (!select) throw new Error(`Shift select not found for staff ${staffId} on ${date}`);

  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Get shift value for staff on date
 */
export function getShiftValue(staffId: string, date: string): string {
  const select = getShiftSelect(staffId, date);
  if (!select) throw new Error(`Shift select not found for staff ${staffId} on ${date}`);

  return select.value;
}

/**
 * Get week input value
 */
export function getWeekInputValue(): string {
  const input = document.getElementById('weekDate') as HTMLInputElement;
  return input.value;
}

/**
 * Set week input value
 */
export function setWeekInputValue(weekString: string): void {
  const input = document.getElementById('weekDate') as HTMLInputElement;
  input.value = weekString;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Get saved shifts container
 */
export function getSavedShiftsContainer(): HTMLElement {
  return document.getElementById('savedShifts') as HTMLElement;
}

/**
 * Count saved shift weeks
 */
export function countSavedWeeks(): number {
  const container = getSavedShiftsContainer();
  return container.querySelectorAll('.week-div, div[style*="background: white"]').length;
}

/**
 * Check if shift table is rendered
 */
export function isShiftTableRendered(): boolean {
  return getShiftTable() !== null;
}

/**
 * Count rows in shift table
 */
export function getShiftTableRowCount(): number {
  const table = getShiftTable();
  if (!table) return 0;

  const tbody = table.querySelector('tbody');
  return tbody ? tbody.querySelectorAll('tr').length : 0;
}

/**
 * Get shift table headers (day names)
 */
export function getShiftTableHeaders(): string[] {
  const table = getShiftTable();
  if (!table) return [];

  const headers = table.querySelectorAll('thead th');
  return Array.from(headers).map(h => h.textContent?.trim() || '');
}

// ==================== VALIDATION HELPERS ====================

/**
 * Validate week string format (YYYY-Www)
 */
export function isValidWeekString(weekString: string): boolean {
  const weekRegex = /^\d{4}-W\d{2}$/;
  return weekRegex.test(weekString);
}

/**
 * Validate shift type
 */
export function isValidShiftType(shift: string): boolean {
  return ['', 'morning', 'evening', 'full'].includes(shift);
}

/**
 * Check if date is in week range
 */
export function isDateInWeek(date: string, weekStart: Date): boolean {
  const weekDates = getWeekDates(weekStart);
  return weekDates.includes(date);
}

// ==================== MOCK DATA GENERATORS ====================

/**
 * Generate mock shift response
 */
export function createMockShiftResponse(shifts: ShiftData): any {
  return {
    success: true,
    data: shifts
  };
}

/**
 * Generate mock month shifts
 */
export function createMockMonthShifts(year: number, month: number, staffIds: string[]): ShiftData {
  const shifts: ShiftData = {};
  const daysInMonth = new Date(year, month, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const date = toLocalDate(new Date(year, month - 1, day));
    shifts[date] = {};

    staffIds.forEach((staffId, index) => {
      const dayOfWeek = new Date(year, month - 1, day).getDay();

      // Weekend - off
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return;
      }

      // Distribute shifts
      if (index % 3 === 0) shifts[date][staffId] = 'morning';
      else if (index % 3 === 1) shifts[date][staffId] = 'evening';
      else shifts[date][staffId] = 'full';
    });
  }

  return shifts;
}
