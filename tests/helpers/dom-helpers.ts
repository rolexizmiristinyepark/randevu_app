/**
 * DOM HELPER UTILITIES FOR ADMIN-PANEL TESTS
 * Advanced DOM mocking and utilities for testing admin panel UI interactions
 */

import { vi } from 'vitest';

// ==================== DOM SETUP ====================

/**
 * Setup admin panel DOM structure
 * Creates the necessary HTML elements that admin-panel.ts expects
 */
export function setupAdminPanelDOM(): void {
  document.body.innerHTML = `
    <!-- Alert Container -->
    <div id="alertContainer"></div>

    <!-- Loading Overlay -->
    <div id="loadingOverlay" style="display: flex;"></div>

    <!-- Tabs -->
    <div class="tabs" style="display: none;">
      <div class="tab active" data-tab="settings">Ayarlar</div>
      <div class="tab" data-tab="staff">İlgili Personel</div>
      <div class="tab" data-tab="shifts">Vardiyalar</div>
      <div class="tab" data-tab="appointments">Randevular</div>
    </div>

    <!-- Settings Tab -->
    <div id="settings" class="tab-content active">
      <input type="number" id="interval" value="60">
      <input type="number" id="maxDaily" value="4">
      <button id="saveSettingsBtn">Kaydet</button>
      <input type="text" id="customerLink" readonly>
      <input type="text" id="manualLink" readonly>
      <input type="text" id="management1Link" readonly>
      <input type="text" id="management2Link" readonly>
      <input type="text" id="management3Link" readonly>
      <div id="staffLinks"></div>
    </div>

    <!-- Staff Tab -->
    <div id="staff" class="tab-content">
      <input type="text" id="newStaffName">
      <input type="tel" id="newStaffPhone">
      <input type="email" id="newStaffEmail">
      <button id="addStaffBtn">Ekle</button>
      <span id="staffCount">0</span>
      <div id="staffList"></div>
    </div>

    <!-- Shifts Tab -->
    <div id="shifts" class="tab-content">
      <input type="week" id="weekDate">
      <button id="nextWeekBtn">Sonraki</button>
      <div id="shiftTable"></div>
      <button id="saveShiftsBtn">Kaydet</button>
      <div id="savedShifts"></div>
    </div>

    <!-- Appointments Tab -->
    <div id="appointments" class="tab-content">
      <div id="whatsappApiStatus"></div>
      <input type="text" id="whatsappPhoneNumberId">
      <input type="password" id="whatsappAccessToken">
      <button id="saveWhatsAppSettingsBtn">Ayarları Kaydet</button>

      <div id="slackStatus"></div>
      <input type="text" id="slackWebhookUrl">
      <button id="saveSlackSettingsBtn">Ayarları Kaydet</button>

      <input type="week" id="filterWeek">
      <div id="appointmentsList"></div>
    </div>

    <!-- Edit Staff Modal -->
    <div id="editStaffModal" class="modal">
      <div class="modal-content">
        <input type="text" id="editStaffName">
        <input type="tel" id="editStaffPhone">
        <input type="email" id="editStaffEmail">
        <button id="cancelEditStaffBtn">İptal</button>
        <button id="saveEditStaffBtn">Kaydet</button>
      </div>
    </div>

    <!-- Edit Appointment Modal -->
    <div id="editAppointmentModal" class="modal">
      <div class="modal-content">
        <input type="date" id="editAppointmentDate">
        <select id="editAppointmentTime">
          <option value="">-- Seçin --</option>
          <option value="11:00">11:00</option>
          <option value="12:00">12:00</option>
          <option value="13:00">13:00</option>
          <option value="14:00">14:00</option>
          <option value="15:00">15:00</option>
          <option value="16:00">16:00</option>
          <option value="17:00">17:00</option>
          <option value="18:00">18:00</option>
          <option value="19:00">19:00</option>
        </select>
        <button id="cancelEditAppointmentBtn">İptal</button>
        <button id="saveEditAppointmentBtn">Kaydet</button>
      </div>
    </div>

    <!-- Assign Staff Modal -->
    <div id="assignStaffModal" class="modal">
      <div class="modal-content">
        <div id="assignStaffInfo"></div>
        <select id="assignStaffSelect"></select>
        <button id="cancelAssignStaffBtn">İptal</button>
        <button id="saveAssignStaffBtn">Ata</button>
      </div>
    </div>
  `;
}

/**
 * Cleanup admin panel DOM
 */
export function cleanupAdminPanelDOM(): void {
  document.body.innerHTML = '';
}

// ==================== DOM QUERY HELPERS ====================

/**
 * Get element by ID with type safety
 */
export function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id) as T;
  if (!element) {
    throw new Error(`Element with id "${id}" not found`);
  }
  return element;
}

/**
 * Get input element value
 */
export function getInputValue(id: string): string {
  return getElement<HTMLInputElement>(id).value;
}

/**
 * Set input element value
 */
export function setInputValue(id: string, value: string): void {
  const input = getElement<HTMLInputElement>(id);
  input.value = value;
  // Trigger input event to simulate user typing
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Set select element value
 */
export function setSelectValue(id: string, value: string): void {
  const select = getElement<HTMLSelectElement>(id);
  select.value = value;
  // Trigger change event to simulate user selection
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Get select element value
 */
export function getSelectValue(id: string): string {
  return getElement<HTMLSelectElement>(id).value;
}

/**
 * Click a button element
 */
export function clickButton(id: string): void {
  const button = getElement<HTMLButtonElement>(id);
  button.click();
}

/**
 * Check if element is visible
 */
export function isVisible(id: string): boolean {
  const element = getElement(id);
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

/**
 * Check if element has class
 */
export function hasClass(id: string, className: string): boolean {
  return getElement(id).classList.contains(className);
}

// ==================== MODAL HELPERS ====================

/**
 * Check if modal is open
 */
export function isModalOpen(modalId: string): boolean {
  const modal = getElement(modalId);
  return modal.style.display === 'flex' || modal.style.display === 'block';
}

/**
 * Open modal programmatically
 */
export function openModal(modalId: string): void {
  const modal = getElement(modalId);
  modal.style.display = 'flex';
}

/**
 * Close modal programmatically
 */
export function closeModal(modalId: string): void {
  const modal = getElement(modalId);
  modal.style.display = 'none';
}

// ==================== ALERT HELPERS ====================

/**
 * Get alert messages from alert container
 */
export function getAlerts(): string[] {
  const container = getElement('alertContainer');
  const alerts = container.querySelectorAll('.alert');
  return Array.from(alerts).map(alert => alert.textContent?.trim() || '');
}

/**
 * Check if specific alert exists
 */
export function hasAlert(message: string): boolean {
  return getAlerts().some(alert => alert.includes(message));
}

/**
 * Clear all alerts
 */
export function clearAlerts(): void {
  const container = getElement('alertContainer');
  container.innerHTML = '';
}

// ==================== STAFF LIST HELPERS ====================

/**
 * Get staff items from staff list
 */
export function getStaffItems(): HTMLElement[] {
  const staffList = getElement('staffList');
  return Array.from(staffList.querySelectorAll('.staff-item')) as HTMLElement[];
}

/**
 * Get staff count from UI
 */
export function getStaffCount(): number {
  const countElement = getElement<HTMLSpanElement>('staffCount');
  return parseInt(countElement.textContent || '0', 10);
}

/**
 * Find staff item by name
 */
export function findStaffItem(name: string): HTMLElement | null {
  const items = getStaffItems();
  return items.find(item => {
    const nameElement = item.querySelector('.staff-name');
    return nameElement?.textContent?.includes(name);
  }) || null;
}

/**
 * Click edit button on staff item
 */
export function clickStaffEdit(staffName: string): void {
  const item = findStaffItem(staffName);
  if (!item) throw new Error(`Staff item "${staffName}" not found`);

  const editBtn = item.querySelector('.edit-staff-btn') as HTMLButtonElement;
  if (!editBtn) throw new Error(`Edit button not found for "${staffName}"`);

  editBtn.click();
}

/**
 * Click delete button on staff item
 */
export function clickStaffDelete(staffName: string): void {
  const item = findStaffItem(staffName);
  if (!item) throw new Error(`Staff item "${staffName}" not found`);

  const deleteBtn = item.querySelector('.delete-staff-btn') as HTMLButtonElement;
  if (!deleteBtn) throw new Error(`Delete button not found for "${staffName}"`);

  deleteBtn.click();
}

/**
 * Click toggle button on staff item
 */
export function clickStaffToggle(staffName: string): void {
  const item = findStaffItem(staffName);
  if (!item) throw new Error(`Staff item "${staffName}" not found`);

  const toggleBtn = item.querySelector('.toggle-staff-btn') as HTMLButtonElement;
  if (!toggleBtn) throw new Error(`Toggle button not found for "${staffName}"`);

  toggleBtn.click();
}

/**
 * Check if staff is active
 */
export function isStaffActive(staffName: string): boolean {
  const item = findStaffItem(staffName);
  if (!item) throw new Error(`Staff item "${staffName}" not found`);

  return !item.classList.contains('inactive');
}

// ==================== LOADING STATE HELPERS ====================

/**
 * Check if loading overlay is visible
 */
export function isLoading(): boolean {
  const overlay = getElement('loadingOverlay');
  const style = window.getComputedStyle(overlay);
  return style.display === 'flex' || style.display === 'block';
}

/**
 * Show loading overlay
 */
export function showLoading(): void {
  const overlay = getElement('loadingOverlay');
  overlay.style.display = 'flex';
}

/**
 * Hide loading overlay
 */
export function hideLoading(): void {
  const overlay = getElement('loadingOverlay');
  overlay.style.display = 'none';
}

// ==================== ASYNC HELPERS ====================

/**
 * Wait for element to appear in DOM
 */
export async function waitForElement(id: string, timeout: number = 3000): Promise<HTMLElement> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const element = document.getElementById(id);
    if (element) return element;
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  throw new Error(`Element "${id}" did not appear within ${timeout}ms`);
}

/**
 * Wait for condition to be true
 */
export async function waitFor(
  condition: () => boolean,
  timeout: number = 3000,
  checkInterval: number = 50
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (condition()) return;
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }

  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Wait for next tick (microtask)
 */
export function nextTick(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

// ==================== EVENT SIMULATION ====================

/**
 * Simulate click event
 */
export function simulateClick(element: HTMLElement): void {
  element.dispatchEvent(new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    view: window
  }));
}

/**
 * Simulate input event
 */
export function simulateInput(element: HTMLInputElement, value: string): void {
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Simulate form submit
 */
export function simulateSubmit(form: HTMLFormElement): void {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}
