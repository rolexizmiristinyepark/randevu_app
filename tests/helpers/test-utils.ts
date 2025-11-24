/**
 * GENERAL TEST UTILITIES FOR ADMIN-PANEL TESTS
 * High-level test utilities combining DOM and API helpers
 */

import { vi } from 'vitest';
import * as domHelpers from './dom-helpers';
import * as apiHelpers from './api-helpers';

// Re-export all helpers for convenience
export * from './dom-helpers';
export * from './api-helpers';
export * from './shift-helpers';

// ==================== TEST SETUP & TEARDOWN ====================

/**
 * Setup complete test environment for admin-panel
 * - DOM structure
 * - API mocks
 * - Global fetch mock
 */
export function setupAdminPanelTest(): void {
  // Setup DOM
  domHelpers.setupAdminPanelDOM();

  // Setup fetch mock
  apiHelpers.setupFetchMock();

  // Clear any alerts
  domHelpers.clearAlerts();

  // Hide loading
  domHelpers.hideLoading();
}

/**
 * Cleanup test environment
 */
export function cleanupAdminPanelTest(): void {
  // Cleanup DOM
  domHelpers.cleanupAdminPanelDOM();

  // Reset fetch mock
  apiHelpers.resetFetchMock();

  // Clear all mocks
  vi.clearAllMocks();
}

// ==================== STAFF TEST HELPERS ====================

/**
 * Fill staff form fields
 */
export function fillStaffForm(staff: Partial<apiHelpers.Staff>): void {
  if (staff.name) domHelpers.setInputValue('newStaffName', staff.name);
  if (staff.phone) domHelpers.setInputValue('newStaffPhone', staff.phone);
  if (staff.email) domHelpers.setInputValue('newStaffEmail', staff.email);
}

/**
 * Fill edit staff modal fields
 */
export function fillEditStaffForm(staff: Partial<apiHelpers.Staff>): void {
  if (staff.name) domHelpers.setInputValue('editStaffName', staff.name);
  if (staff.phone) domHelpers.setInputValue('editStaffPhone', staff.phone);
  if (staff.email) domHelpers.setInputValue('editStaffEmail', staff.email);
}

/**
 * Add a staff member (fill form + click add button)
 */
export async function addStaff(staff: Partial<apiHelpers.Staff>): Promise<void> {
  fillStaffForm(staff);
  domHelpers.clickButton('addStaffBtn');
  await domHelpers.nextTick();
}

/**
 * Edit a staff member (click edit + fill modal + save)
 */
export async function editStaff(
  currentName: string,
  updatedStaff: Partial<apiHelpers.Staff>
): Promise<void> {
  domHelpers.clickStaffEdit(currentName);
  await domHelpers.nextTick();

  fillEditStaffForm(updatedStaff);
  domHelpers.clickButton('saveEditStaffBtn');
  await domHelpers.nextTick();
}

/**
 * Delete a staff member (click delete + confirm)
 */
export async function deleteStaff(staffName: string, confirm: boolean = true): Promise<void> {
  // Mock window.confirm
  global.confirm = vi.fn(() => confirm);

  domHelpers.clickStaffDelete(staffName);
  await domHelpers.nextTick();
}

/**
 * Toggle staff active state
 */
export async function toggleStaff(staffName: string): Promise<void> {
  domHelpers.clickStaffToggle(staffName);
  await domHelpers.nextTick();
}

// ==================== SETTINGS TEST HELPERS ====================

/**
 * Fill settings form
 */
export function fillSettingsForm(settings: Partial<apiHelpers.Settings>): void {
  if (settings.interval !== undefined) {
    domHelpers.setInputValue('interval', settings.interval.toString());
  }
  if (settings.maxDaily !== undefined) {
    domHelpers.setInputValue('maxDaily', settings.maxDaily.toString());
  }
}

/**
 * Save settings (fill form + click save button)
 */
export async function saveSettings(settings: Partial<apiHelpers.Settings>): Promise<void> {
  fillSettingsForm(settings);
  domHelpers.clickButton('saveSettingsBtn');
  await domHelpers.nextTick();
}

// ==================== APPOINTMENT TEST HELPERS ====================

/**
 * Fill appointment filter form
 */
export function fillAppointmentFilter(week: string): void {
  domHelpers.setInputValue('filterWeek', week);
}

/**
 * Fill edit appointment modal
 */
export function fillEditAppointmentForm(appointment: Partial<apiHelpers.Appointment>): void {
  if (appointment.date) domHelpers.setInputValue('editAppointmentDate', appointment.date);
  if (appointment.time) domHelpers.setInputValue('editAppointmentTime', appointment.time);
}

/**
 * Delete an appointment (click delete + confirm)
 */
export async function deleteAppointment(appointmentId: string, confirm: boolean = true): Promise<void> {
  // Mock window.confirm
  global.confirm = vi.fn(() => confirm);

  const deleteBtn = document.querySelector(`[data-appointment-id="${appointmentId}"] .delete-btn`) as HTMLButtonElement;
  if (!deleteBtn) throw new Error(`Delete button not found for appointment "${appointmentId}"`);

  deleteBtn.click();
  await domHelpers.nextTick();
}

// ==================== SHIFT TEST HELPERS ====================

/**
 * Fill shift week selector
 */
export function fillShiftWeek(week: string): void {
  domHelpers.setInputValue('weekDate', week);
}

/**
 * Click next week button
 */
export async function clickNextWeek(): Promise<void> {
  domHelpers.clickButton('nextWeekBtn');
  await domHelpers.nextTick();
}

/**
 * Save shifts
 */
export async function saveShifts(): Promise<void> {
  domHelpers.clickButton('saveShiftsBtn');
  await domHelpers.nextTick();
}

// ==================== TAB NAVIGATION HELPERS ====================

/**
 * Switch to a specific tab
 */
export async function switchTab(tabName: 'settings' | 'staff' | 'shifts' | 'appointments'): Promise<void> {
  const tab = document.querySelector(`.tab[data-tab="${tabName}"]`) as HTMLElement;
  if (!tab) throw new Error(`Tab "${tabName}" not found`);

  tab.click();
  await domHelpers.nextTick();
}

/**
 * Check if tab is active
 */
export function isTabActive(tabName: 'settings' | 'staff' | 'shifts' | 'appointments'): boolean {
  const tab = document.querySelector(`.tab[data-tab="${tabName}"]`);
  return tab?.classList.contains('active') || false;
}

/**
 * Check if tab content is visible
 */
export function isTabContentVisible(tabName: 'settings' | 'staff' | 'shifts' | 'appointments'): boolean {
  const content = document.getElementById(tabName);
  return content?.classList.contains('active') || false;
}

// ==================== ASSERTION HELPERS ====================

/**
 * Assert that alert is shown with specific message
 */
export function expectAlert(message: string): void {
  const hasAlertMessage = domHelpers.hasAlert(message);
  if (!hasAlertMessage) {
    const alerts = domHelpers.getAlerts();
    throw new Error(`Expected alert "${message}" but found: ${JSON.stringify(alerts)}`);
  }
}

/**
 * Assert that no alerts are shown
 */
export function expectNoAlerts(): void {
  const alerts = domHelpers.getAlerts();
  if (alerts.length > 0) {
    throw new Error(`Expected no alerts but found: ${JSON.stringify(alerts)}`);
  }
}

/**
 * Assert that loading is shown
 */
export function expectLoading(): void {
  if (!domHelpers.isLoading()) {
    throw new Error('Expected loading overlay to be visible');
  }
}

/**
 * Assert that loading is hidden
 */
export function expectNotLoading(): void {
  if (domHelpers.isLoading()) {
    throw new Error('Expected loading overlay to be hidden');
  }
}

/**
 * Assert that modal is open
 */
export function expectModalOpen(modalId: string): void {
  if (!domHelpers.isModalOpen(modalId)) {
    throw new Error(`Expected modal "${modalId}" to be open`);
  }
}

/**
 * Assert that modal is closed
 */
export function expectModalClosed(modalId: string): void {
  if (domHelpers.isModalOpen(modalId)) {
    throw new Error(`Expected modal "${modalId}" to be closed`);
  }
}

/**
 * Assert fetch was called with specific URL
 */
export function expectFetchCalled(url: string, options?: RequestInit): void {
  if (!apiHelpers.verifyFetchCalledWith(url, options)) {
    const calls = apiHelpers.getFetchCalls();
    throw new Error(`Expected fetch to be called with "${url}" but got: ${JSON.stringify(calls)}`);
  }
}

/**
 * Assert fetch call count
 */
export function expectFetchCallCount(count: number): void {
  const actualCount = apiHelpers.getFetchCallCount();
  if (actualCount !== count) {
    throw new Error(`Expected ${count} fetch calls but got ${actualCount}`);
  }
}

// ==================== WAIT HELPERS ====================

/**
 * Wait for API call to complete
 */
export async function waitForApiCall(timeout: number = 3000): Promise<void> {
  await domHelpers.waitFor(
    () => !domHelpers.isLoading(),
    timeout,
    50
  );
}

/**
 * Wait for staff list to update
 */
export async function waitForStaffUpdate(expectedCount: number, timeout: number = 3000): Promise<void> {
  await domHelpers.waitFor(
    () => domHelpers.getStaffCount() === expectedCount,
    timeout,
    50
  );
}

/**
 * Wait for alert to appear
 */
export async function waitForAlert(message: string, timeout: number = 3000): Promise<void> {
  await domHelpers.waitFor(
    () => domHelpers.hasAlert(message),
    timeout,
    50
  );
}

// ==================== SCENARIO HELPERS ====================

/**
 * Setup staff list scenario
 * Mocks API to return a list of staff and loads the page
 */
export async function setupStaffListScenario(staff: apiHelpers.Staff[] = apiHelpers.createMockStaffList()): Promise<void> {
  apiHelpers.mockFetch(apiHelpers.mockStaffAPI.getStaff(staff));
  await domHelpers.nextTick();
}

/**
 * Setup empty staff list scenario
 */
export async function setupEmptyStaffScenario(): Promise<void> {
  apiHelpers.mockFetch(apiHelpers.mockStaffAPI.getStaff([]));
  await domHelpers.nextTick();
}

/**
 * Setup error scenario
 */
export async function setupErrorScenario(errorMessage: string = 'Test error'): Promise<void> {
  apiHelpers.mockFetch(apiHelpers.mockStaffAPI.error(errorMessage));
  await domHelpers.nextTick();
}

// ==================== DATA VALIDATION HELPERS ====================

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone format (Turkish)
 */
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^0[0-9]{3}\s?[0-9]{3}\s?[0-9]{2}\s?[0-9]{2}$/;
  return phoneRegex.test(phone);
}

/**
 * Validate required field
 */
export function isRequired(value: string): boolean {
  return value.trim().length > 0;
}

// ==================== DEBUG HELPERS ====================

/**
 * Print current DOM state (for debugging tests)
 */
export function debugDOM(): void {
  console.log('=== DOM STATE ===');
  console.log('Staff Count:', domHelpers.getStaffCount());
  console.log('Staff Items:', domHelpers.getStaffItems().length);
  console.log('Alerts:', domHelpers.getAlerts());
  console.log('Loading:', domHelpers.isLoading());
  console.log('================');
}

/**
 * Print current fetch calls (for debugging tests)
 */
export function debugFetch(): void {
  console.log('=== FETCH CALLS ===');
  console.log('Call Count:', apiHelpers.getFetchCallCount());
  console.log('Calls:', apiHelpers.getFetchCalls());
  console.log('===================');
}
