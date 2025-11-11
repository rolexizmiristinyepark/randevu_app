/**
 * CUSTOMER APP - Main Application Logic (TypeScript)
 * Appointment booking system for Rolex İzmir İstinyepark
 */

// Import shared utilities
import { StringUtils } from './string-utils';
import { StateManager } from './state-manager';
import { apiCall } from './api-service';
import { initMonitoring, logError, measureAsync } from './monitoring';
import { DateUtils } from './date-utils';
import {
  createElement,
  showAlertSafe,
  createSuccessPageSafe
} from './security-helpers.js';

// Import types
import type {
  Config,
  Staff,
  AppointmentType,
  ShiftType,
  AppointmentData,
  LastAppointmentData,
  TimeSlot,
  DayStatus,
  DailySlotsResponse,
  GoogleCalendarEvent,
  CacheObject,
  MonthCacheData,
  AppState,
  ApiCallOptions,
  BackendConfig,
  Settings,
  DayAvailability,
  AlertType
} from './types';

// ==================== CONFIG ====================

const CONFIG: Config = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwmowzsBLrAOjn-HVtw_LSLf-Gn0jrWdaQMrxaJeulqnhJCQduyyeSvctsWPAXxSAuo/exec',
  BASE_URL: 'https://rolexizmiristinyepark.github.io/randevu_app/',
  DEBUG: false,
  SHIFTS: {
    'morning': { start: 11, end: 16, label: 'Sabah (11:00-16:00)' },
    'evening': { start: 16, end: 21, label: 'Akşam (16:00-21:00)' },
    'full': { start: 11, end: 21, label: 'Full (11:00-21:00)' }
  },
  APPOINTMENT_HOURS: {
    earliest: 11,
    latest: 21,
    interval: 60
  },
  MAX_DAILY_DELIVERY_APPOINTMENTS: 3,  // Günde maksimum 3 teslim randevusu
  APPOINTMENT_TYPES: [
    { value: 'delivery', name: 'Saat Teslim Alma' },
    { value: 'service', name: 'Servis & Bakım' },
    { value: 'consultation', name: 'Ürün Danışmanlığı' },
    { value: 'general', name: 'Genel Görüşme' }
  ]
};

// Export CONFIG to window
if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
}

// ==================== UTILITY FUNCTIONS ====================

const log = {
  error: (...args: any[]): void => CONFIG.DEBUG && console.error(...args),
  warn: (...args: any[]): void => CONFIG.DEBUG && console.warn(...args),
  info: (...args: any[]): void => CONFIG.DEBUG && console.info(...args),
  log: (...args: any[]): void => CONFIG.DEBUG && console.log(...args)
};

const ModalUtils = {
  open(modalId: string): void {
    document.getElementById(modalId)?.classList.add('active');
  },
  close(modalId: string): void {
    document.getElementById(modalId)?.classList.remove('active');
  },
  toggle(modalId: string): void {
    document.getElementById(modalId)?.classList.toggle('active');
  }
};

// ==================== STATE MANAGEMENT ====================

const appState = new StateManager<AppState>({
  currentMonth: new Date(),
  selectedDate: null,
  selectedStaff: null,
  selectedTime: null,
  selectedShiftType: null,
  selectedAppointmentType: null,
  staffMembers: [],
  dayShifts: {},
  allAppointments: {},
  googleCalendarEvents: {},
  specificStaffId: null,
  lastAppointmentData: null
});

// Backward compatibility variables
const currentMonth: Date = appState.get('currentMonth') as Date;
let selectedDate: string | null = appState.get('selectedDate') as string | null;
let selectedStaff: number | string | null = appState.get('selectedStaff') as number | string | null;
let selectedTime: string | null = appState.get('selectedTime') as string | null;
let selectedShiftType: ShiftType | null = appState.get('selectedShiftType') as ShiftType | null;
let selectedAppointmentType: AppointmentType | null = appState.get('selectedAppointmentType') as AppointmentType | null;
let staffMembers: Staff[] = appState.get('staffMembers') as Staff[];
let dayShifts: Record<string, Record<number | string, ShiftType>> = appState.get('dayShifts') as Record<string, Record<number | string, ShiftType>>;
let allAppointments: Record<string, any[]> = appState.get('allAppointments') as Record<string, any[]>;
let googleCalendarEvents: Record<string, GoogleCalendarEvent[]> = appState.get('googleCalendarEvents') as Record<string, GoogleCalendarEvent[]>;
let specificStaffId: string | null = appState.get('specificStaffId') as string | null;
let lastAppointmentData: LastAppointmentData | null = appState.get('lastAppointmentData') as LastAppointmentData | null;

// Export to window
if (typeof window !== 'undefined') {
  window.lastAppointmentData = null;
}

// ==================== CACHE MANAGEMENT ====================

const CACHE_DURATION = 1800000; // 30 minutes
const CACHE_PREFIX = 'rolex_cache_';

interface SessionStorageCache {
  get<T = any>(key: string): T | undefined;
  set<T = any>(key: string, value: T): void;
  has(key: string): boolean;
  delete(key: string): void;
  clear(): void;
}

const sessionStorageCache: SessionStorageCache = {
  get<T = any>(key: string): T | undefined {
    try {
      const item = sessionStorage.getItem(CACHE_PREFIX + key);
      if (!item) return undefined;

      const cached: CacheObject<T> = JSON.parse(item);

      if (cached.timestamp && (Date.now() - cached.timestamp > CACHE_DURATION)) {
        log.info(`Cache expired for key: ${key}`);
        this.delete(key);
        return undefined;
      }

      return cached.value;
    } catch (e) {
      log.warn('SessionStorage read error:', e);
      return undefined;
    }
  },

  set<T = any>(key: string, value: T): void {
    try {
      const cacheObject: CacheObject<T> = {
        value,
        timestamp: Date.now()
      };
      sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(cacheObject));
    } catch (e) {
      log.warn('SessionStorage write error:', e);
      this.clear();
    }
  },

  has(key: string): boolean {
    const item = this.get(key);
    return item !== undefined;
  },

  delete(key: string): void {
    sessionStorage.removeItem(CACHE_PREFIX + key);
  },

  clear(): void {
    Object.keys(sessionStorage).forEach(key => {
      if (key.startsWith(CACHE_PREFIX)) {
        sessionStorage.removeItem(key);
      }
    });
  }
};

const monthCache = sessionStorageCache;

// ==================== CONFIG LOADING ====================

async function loadConfig(): Promise<BackendConfig | null> {
  try {
    const cached = sessionStorageCache.get<BackendConfig>('backend_config');
    if (cached) {
      log.info('Config loaded from cache');
      return cached;
    }

    log.info('Loading config from backend...');
    const result = await apiCall<{ data: BackendConfig }>('getConfig', {});

    if (result.success && result.data) {
      sessionStorageCache.set('backend_config', result.data);
      log.info('Config loaded from backend successfully');
      return result.data;
    } else {
      throw new Error(result.error || 'Config loading failed');
    }
  } catch (error) {
    log.warn('Config loading failed, using fallback:', error);
    return null;
  }
}

function mergeConfig(backendConfig: BackendConfig | null): void {
  if (!backendConfig) return;

  try {
    if (backendConfig.shifts) {
      CONFIG.SHIFTS = {
        'morning': {
          start: parseInt(backendConfig.shifts.morning.start.split(':')[0]),
          end: parseInt(backendConfig.shifts.morning.end.split(':')[0]),
          label: `Sabah (${backendConfig.shifts.morning.start}-${backendConfig.shifts.morning.end})`
        },
        'evening': {
          start: parseInt(backendConfig.shifts.evening.start.split(':')[0]),
          end: parseInt(backendConfig.shifts.evening.end.split(':')[0]),
          label: `Akşam (${backendConfig.shifts.evening.start}-${backendConfig.shifts.evening.end})`
        },
        'full': {
          start: parseInt(backendConfig.shifts.full.start.split(':')[0]),
          end: parseInt(backendConfig.shifts.full.end.split(':')[0]),
          label: `Full (${backendConfig.shifts.full.start}-${backendConfig.shifts.full.end})`
        }
      };
    }

    if (backendConfig.appointmentHours) {
      CONFIG.APPOINTMENT_HOURS = {
        earliest: backendConfig.appointmentHours.earliest,
        latest: backendConfig.appointmentHours.latest,
        interval: backendConfig.appointmentHours.interval
      };
    }

    if (backendConfig.maxDailyDeliveryAppointments !== undefined) {
      CONFIG.MAX_DAILY_DELIVERY_APPOINTMENTS = backendConfig.maxDailyDeliveryAppointments;
    }

    log.info('Config merged successfully:', CONFIG);
  } catch (error) {
    log.error('Config merge error:', error);
  }
}

// ==================== DOM CONTENT LOADED ====================

document.addEventListener('DOMContentLoaded', async (): Promise<void> => {
  initMonitoring();

  const backendConfig = await measureAsync('loadConfig', () => loadConfig());
  mergeConfig(backendConfig);

  // Event listeners for calendar modal
  document.getElementById('calendarAppleBtn')?.addEventListener('click', handleCalendarAction);
  document.getElementById('calendarGoogleBtn')?.addEventListener('click', handleCalendarAction);
  document.getElementById('calendarOutlookBtn')?.addEventListener('click', handleCalendarAction);
  document.getElementById('calendarICSBtn')?.addEventListener('click', handleCalendarAction);
  document.getElementById('calendarModalCloseBtn')?.addEventListener('click', () => ModalUtils.close('calendarModal'));

  document.getElementById('guideCloseBtn')?.addEventListener('click', () => ModalUtils.close('guideModal'));

  // Guard: Customer page only
  if (!document.getElementById('appointmentTypesContainer')) {
    return;
  }

  // URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  specificStaffId = urlParams.get('staff');

  // UI setup for staff=0
  if (specificStaffId === '0') {
    const header = document.getElementById('staffHeader');
    if (header) {
      header.textContent = 'Randevu Sistemi';
      header.style.visibility = 'visible';
    }

    document.getElementById('typeManagement')!.style.display = 'block';
    const typesContainer = document.getElementById('appointmentTypesContainer')!;
    typesContainer.style.gridTemplateColumns = 'repeat(2, 1fr)';
  } else if (!specificStaffId) {
    const typesContainer = document.getElementById('appointmentTypesContainer')!;
    typesContainer.style.justifyContent = 'center';
  }

  // Show loading
  const typesContainer = document.getElementById('appointmentTypesContainer')!;
  const loadingDiv = document.createElement('div');
  loadingDiv.id = 'typesLoading';
  loadingDiv.style.cssText = 'text-align: center; padding: 40px; color: #757575; font-size: 14px;';
  loadingDiv.innerHTML = '<div class="spinner" style="margin: 0 auto 15px;"></div>Yükleniyor...';
  typesContainer.style.display = 'none';
  typesContainer.parentElement!.insertBefore(loadingDiv, typesContainer);

  await loadSettings();

  await loadStaffMembers();

  if (specificStaffId && specificStaffId !== '0') {
    const staff = staffMembers.find(s => String(s.id) === specificStaffId);
    if (staff) {
      const header = document.getElementById('staffHeader');
      if (header) {
        header.textContent = staff.name;
        header.style.visibility = 'visible';
      }
      selectedStaff = parseInt(specificStaffId);
    }
  }

  loadingDiv?.remove();
  typesContainer.style.display = 'grid';

  // Event listeners for appointment types
  document.getElementById('typeDelivery')?.addEventListener('click', () => selectAppointmentType('delivery'));
  document.getElementById('typeService')?.addEventListener('click', () => selectAppointmentType('service'));
  document.getElementById('typeMeeting')?.addEventListener('click', () => selectAppointmentType('meeting'));
  document.getElementById('typeManagement')?.addEventListener('click', () => selectAppointmentType('management'));

  // Calendar navigation
  document.getElementById('prevMonthBtn')?.addEventListener('click', () => changeMonth(-1));
  document.getElementById('nextMonthBtn')?.addEventListener('click', () => changeMonth(1));
});

// ==================== APPOINTMENT TYPE SELECTION ====================

function selectAppointmentType(type: AppointmentType): void {
  selectedAppointmentType = type;

  const prev = document.querySelector('.type-card.selected');
  if (prev) prev.classList.remove('selected');
  document.querySelector(`.type-card[data-type="${type}"]`)?.classList.add('selected');

  document.getElementById('calendarSection')!.style.display = 'block';
  renderCalendar();
  loadMonthData();
}

// ==================== CALENDAR ====================

async function changeMonth(direction: number): Promise<void> {
  currentMonth.setMonth(currentMonth.getMonth() + direction);

  const monthStr = currentMonth.toISOString().slice(0, 7);
  const cacheKey = `${monthStr}_${specificStaffId || 'all'}`;

  if (monthCache.has(cacheKey)) {
    const cached = monthCache.get<{ timestamp: number; data: MonthCacheData }>(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      dayShifts = cached.data.dayShifts || {};
      allAppointments = cached.data.allAppointments || {};
      googleCalendarEvents = cached.data.googleCalendarEvents || {};
      renderCalendar();
      return;
    }
  }

  renderCalendar();
  await loadMonthData();
}

function renderCalendar(): void {
  const grid = document.getElementById('calendarGrid')!;
  const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const dayNames = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

  document.getElementById('currentMonth')!.textContent =
    monthNames[currentMonth.getMonth()] + ' ' + currentMonth.getFullYear();

  grid.innerHTML = '';

  const fragment = document.createDocumentFragment();

  dayNames.forEach(day => {
    const header = document.createElement('div');
    header.className = 'day-header';
    header.textContent = day;
    fragment.appendChild(header);
  });

  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  let dayOfWeek = firstDay.getDay();
  dayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  for (let i = 0; i < dayOfWeek; i++) {
    const day = document.createElement('div');
    day.className = 'calendar-day other-month';
    fragment.appendChild(day);
  }

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let day = 1; day <= daysInMonth; day++) {
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day';
    dayEl.textContent = String(day);

    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    date.setHours(0, 0, 0, 0);
    const dateStr = DateUtils.toLocalDate(date);

    dayEl.setAttribute('data-date', dateStr);

    // Geçmiş günler - yönetim randevusu için bugüne izin ver
    const allowToday = selectedAppointmentType === 'management';
    if (date < today || (date.getTime() === today.getTime() && !allowToday)) {
      dayEl.classList.add('past');
    } else {
      const availability = checkDayAvailability(dateStr);
      if (availability.available) {
        dayEl.classList.add('available');
        dayEl.onclick = () => selectDay(dateStr);
      } else {
        dayEl.classList.add('unavailable');
        dayEl.title = availability.reason || 'Müsait değil';
      }
    }

    fragment.appendChild(dayEl);
  }

  grid.appendChild(fragment);
}

function checkDayAvailability(dateStr: string): DayAvailability {
  if (selectedAppointmentType === 'management') {
    return { available: true };
  }

  if (specificStaffId && specificStaffId !== '0') {
    const staffHasShift = dayShifts[dateStr] && dayShifts[dateStr][specificStaffId];
    if (!staffHasShift) {
      return { available: false, reason: 'İlgili çalışan bu gün müsait değil' };
    }
  } else {
    const hasShifts = dayShifts[dateStr] && Object.keys(dayShifts[dateStr]).length > 0;
    if (!hasShifts) {
      return { available: false, reason: 'Çalışan yok' };
    }
  }

  const calendarEvents = googleCalendarEvents[dateStr] || [];
  const now = new Date();
  const todayStr = DateUtils.toLocalDate(now);

  const deliveryCount = calendarEvents.filter(event => {
    if (event.extendedProperties?.private?.appointmentType !== 'delivery') {
      return false;
    }

    if (dateStr === todayStr && event.start) {
      const eventTime = event.start.time || (() => {
        const t = new Date(event.start.dateTime!);
        return String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
      })();
      const currentTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
      if (eventTime < currentTime) {
        return false;
      }
    }

    return true;
  }).length;

  if (selectedAppointmentType === 'delivery') {
    if (deliveryCount >= CONFIG.MAX_DAILY_DELIVERY_APPOINTMENTS) {
      return { available: false, reason: `Teslim randevuları dolu (${deliveryCount}/${CONFIG.MAX_DAILY_DELIVERY_APPOINTMENTS})` };
    }
  }

  return { available: true };
}

function selectDay(dateStr: string): void {
  selectedDate = dateStr;

  const prev = document.querySelector('.calendar-day.selected');
  if (prev) prev.classList.remove('selected');

  const newDay = document.querySelector(`.calendar-day[data-date="${dateStr}"]`);
  if (newDay) newDay.classList.add('selected');

  if (specificStaffId === '0' && selectedAppointmentType === 'management') {
    selectedStaff = 0;
    selectedShiftType = 'full';
    displayAvailableTimeSlots();
    document.getElementById('timeSection')!.style.display = 'block';
    document.getElementById('staffSection')!.style.display = 'none';
    document.getElementById('detailsSection')!.style.display = 'none';
    document.getElementById('submitBtn')!.style.display = 'none';
  } else if (specificStaffId === '0' && selectedAppointmentType !== 'management') {
    displayAvailableStaff();
    document.getElementById('staffSection')!.style.display = 'block';
    document.getElementById('timeSection')!.style.display = 'none';
    document.getElementById('detailsSection')!.style.display = 'none';
    document.getElementById('submitBtn')!.style.display = 'none';
  } else if (!specificStaffId) {
    displayAvailableStaff();
    document.getElementById('staffSection')!.style.display = 'block';
    document.getElementById('timeSection')!.style.display = 'none';
    document.getElementById('detailsSection')!.style.display = 'none';
    document.getElementById('submitBtn')!.style.display = 'none';
  } else {
    selectedStaff = parseInt(specificStaffId!);
    const shiftType = dayShifts[dateStr]?.[parseInt(specificStaffId!)];
    if (shiftType) {
      selectedShiftType = shiftType;
      displayAvailableTimeSlots();
      document.getElementById('timeSection')!.style.display = 'block';
      document.getElementById('detailsSection')!.style.display = 'none';
      document.getElementById('submitBtn')!.style.display = 'none';
    }
  }
}

async function loadMonthData(): Promise<void> {
  const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  const monthStr = currentMonth.toISOString().slice(0, 7);

  const cacheKey = `${monthStr}_${specificStaffId || 'all'}`;
  if (monthCache.has(cacheKey)) {
    const cached = monthCache.get<{ timestamp: number; data: MonthCacheData }>(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      dayShifts = cached.data.dayShifts || {};
      allAppointments = cached.data.allAppointments || {};
      googleCalendarEvents = cached.data.googleCalendarEvents || {};
      renderCalendar();
      return;
    }
  }

  showLoading();

  try {
    const [shiftsResult, appointmentsResult, calendarResult] = await Promise.all([
      apiCall<{ data: Record<string, Record<number | string, ShiftType>> }>('getMonthShifts', { month: monthStr }),
      apiCall<{ data: Record<string, any[]> }>('getMonthAppointments', { month: monthStr }),
      apiCall<{ data: Record<string, GoogleCalendarEvent[]> }>('getGoogleCalendarEvents', {
        startDate: DateUtils.toLocalDate(startDate),
        endDate: DateUtils.toLocalDate(endDate),
        staffId: specificStaffId || 'all'
      })
    ]);

    if (shiftsResult.success) {
      dayShifts = shiftsResult.data || {};
    }

    if (appointmentsResult.success) {
      allAppointments = appointmentsResult.data || {};
    }

    if (calendarResult.success) {
      googleCalendarEvents = calendarResult.data || {};
    }

    monthCache.set(cacheKey, {
      timestamp: Date.now(),
      data: {
        dayShifts: { ...dayShifts },
        allAppointments: { ...allAppointments },
        googleCalendarEvents: { ...googleCalendarEvents }
      }
    });

    renderCalendar();
    hideAlert();
  } catch (error) {
    log.error('Load month data error:', error);
    logError(error as Error, { context: 'loadMonthData' });
    showLoadingError();
  }
}

// ==================== API WRAPPERS ====================

async function safeApiCall<T = any>(
  action: string,
  params: Record<string, any> = {},
  options: ApiCallOptions = {}
): Promise<{ success: boolean; data?: T; error?: string }> {
  const {
    successMessage,
    errorPrefix = 'Hata',
    onSuccess,
    onError,
    showLoading: shouldShowLoading = false
  } = options;

  if (shouldShowLoading) showLoading();

  try {
    const response = await apiCall<{ data: T }>(action, params);

    if (response.success) {
      if (successMessage) showAlert(successMessage, 'success');
      if (onSuccess) onSuccess(response);
      return response as { success: boolean; data?: T };
    } else {
      const msg = `❌ ${errorPrefix}: ${response.error}`;
      showAlert(msg, 'error');
      if (onError) onError(response);
      return response as { success: boolean; error?: string };
    }
  } catch (error) {
    const msg = `❌ ${errorPrefix}: ${(error as Error).message}`;
    showAlert(msg, 'error');
    if (onError) onError(error);
    throw error;
  } finally {
    if (shouldShowLoading) hideAlert();
  }
}

async function loadStaffMembers(): Promise<void> {
  try {
    const response = await apiCall<{ data: Staff[] }>('getStaff');
    if (response.success) {
      staffMembers = response.data || [];
    } else {
      log.error('Staff loading error:', response.error);
    }
  } catch (error) {
    log.error('API error:', error);
  }
}

async function loadSettings(): Promise<void> {
  try {
    const response = await apiCall<{ data: Settings }>('getSettings');
    if (response.success) {
      CONFIG.APPOINTMENT_HOURS.interval = response.data?.interval || 60;
      CONFIG.MAX_DAILY_DELIVERY_APPOINTMENTS = response.data?.maxDaily || 3;
    }
  } catch (error) {
    log.error('Settings loading error:', error);
  }
}

// ==================== STAFF SELECTION ====================

function displayAvailableStaff(): void {
  const staffList = document.getElementById('staffList')!;
  staffList.innerHTML = '';

  if (staffMembers.length === 0) {
    const emptyDiv = createElement('div', {
      style: { gridColumn: '1/-1', textAlign: 'center', padding: '40px' }
    });
    const spinner = createElement('div', {
      className: 'spinner',
      style: { margin: '0 auto 20px' }
    });
    const reloadBtn = createElement('button', {
      className: 'btn',
      style: { padding: '12px 30px' }
    }, 'Yenile');
    reloadBtn.addEventListener('click', () => location.reload());

    emptyDiv.appendChild(spinner);
    emptyDiv.appendChild(reloadBtn);
    staffList.appendChild(emptyDiv);
    return;
  }

  const dayShiftsForDate = dayShifts[selectedDate!] || {};

  staffMembers.forEach(staff => {
    if (!staff.active) return;

    const shiftType = dayShiftsForDate[staff.id];
    const isWorking = !!shiftType;

    const card = document.createElement('div');
    card.className = 'staff-card' + (!isWorking ? ' unavailable' : '');

    const nameDiv = createElement('div', { className: 'staff-name' }, staff.name);
    card.appendChild(nameDiv);

    if (isWorking) {
      card.addEventListener('click', (e) => selectStaff(staff.id, shiftType, e));
    } else {
      card.style.opacity = '0.5';
      card.style.cursor = 'not-allowed';
    }

    staffList.appendChild(card);
  });
}

function selectStaff(staffId: number | string, shiftType: ShiftType, event: MouseEvent): void {
  selectedStaff = typeof staffId === 'string' ? parseInt(staffId) : staffId;
  selectedShiftType = shiftType;

  const staff = staffMembers.find(s => s.id === selectedStaff);
  if (staff) {
    const header = document.getElementById('staffHeader');
    if (header) {
      header.textContent = staff.name;
      header.style.visibility = 'visible';
    }
  }

  const prev = document.querySelector('.staff-card.selected');
  if (prev) prev.classList.remove('selected');
  if (event && event.currentTarget) {
    (event.currentTarget as HTMLElement).classList.add('selected');
  }

  displayAvailableTimeSlots();
  document.getElementById('timeSection')!.style.display = 'block';
  document.getElementById('detailsSection')!.style.display = 'none';
  document.getElementById('submitBtn')!.style.display = 'none';
}

// ==================== TIME SLOT SELECTION ====================

async function displayAvailableTimeSlots(): Promise<void> {
  const container = document.getElementById('timeSlots')!;
  container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 20px;"><div class="spinner"></div></div>';

  if (!selectedDate || !selectedShiftType || !selectedAppointmentType) {
    container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 20px; color: #dc3545;">Lütfen önce tarih, vardiya ve randevu türü seçin.</div>';
    return;
  }

  try {
    const [dayStatusResult, slotsResult] = await Promise.all([
      apiCall<{ data: DayStatus }>('getDayStatus', {
        date: selectedDate,
        appointmentType: selectedAppointmentType
      }),
      apiCall<{ data: DailySlotsResponse }>('getDailySlots', {
        date: selectedDate,
        shiftType: selectedShiftType
      })
    ]);

    if (!dayStatusResult.success || !slotsResult.success) {
      container.textContent = '';
      const errorDiv = document.createElement('div');
      errorDiv.style.cssText = 'grid-column: 1/-1; text-align: center; padding: 20px; color: #dc3545;';
      errorDiv.textContent = 'Müsait saatler yüklenemedi';
      container.appendChild(errorDiv);
      return;
    }

    const { isDeliveryMaxed, availableHours, unavailableHours, deliveryCount } = dayStatusResult.data!;
    const { slots } = slotsResult.data!;

    container.innerHTML = '';

    // NOT: Teslim limiti kontrolü takvimde yapılıyor (gün disabled)
    // Bu fonksiyona ulaşılmamalı çünkü gün zaten seçilemiyor

    if (availableHours.length === 0) {
      const infoDiv = document.createElement('div');
      infoDiv.style.cssText = 'grid-column: 1/-1; text-align: center; padding: 20px; color: #dc3545;';
      infoDiv.textContent = 'Bu gün için müsait saat bulunmamaktadır.';
      container.appendChild(infoDiv);
      return;
    }

    slots.forEach(slot => {
      const btn = document.createElement('div');
      const isAvailable = availableHours.includes(slot.hour);

      if (isAvailable) {
        btn.className = 'slot-btn';
        btn.textContent = slot.time;
        btn.addEventListener('click', () => selectTimeSlot(slot.time, btn));
      } else {
        btn.className = 'slot-btn slot--disabled';
        btn.textContent = slot.time;
        btn.title = 'Bu saat dolu';
        btn.setAttribute('aria-disabled', 'true');
      }

      container.appendChild(btn);
    });

  } catch (error) {
    log.error('displayAvailableTimeSlots error:', error);
    logError(error as Error, { context: 'displayAvailableTimeSlots', date: selectedDate, shiftType: selectedShiftType });
    container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 20px; color: #dc3545;">Saatler yüklenirken bir hata oluştu. Lütfen sayfayı yenileyin.</div>';
  }
}

function selectTimeSlot(timeStr: string, element: HTMLElement): void {
  selectedTime = timeStr;

  const prev = document.querySelector('.slot-btn.selected');
  if (prev) prev.classList.remove('selected');
  element.classList.add('selected');

  if (selectedAppointmentType === 'management') {
    displayManagementOptions();
    document.getElementById('staffSection')!.style.display = 'block';
    document.getElementById('detailsSection')!.style.display = 'none';
    document.getElementById('turnstileContainer')!.style.display = 'none';
    document.getElementById('submitBtn')!.style.display = 'none';
  } else {
    document.getElementById('detailsSection')!.style.display = 'block';
    document.getElementById('turnstileContainer')!.style.display = 'block';
    document.getElementById('submitBtn')!.style.display = 'block';
  }
}

// ==================== MANAGEMENT OPTIONS ====================

function displayManagementOptions(): void {
  const staffList = document.getElementById('staffList')!;
  staffList.innerHTML = '';

  const managementOptions = [
    { id: 'HK', name: 'HK' },
    { id: 'OK', name: 'OK' }
  ];

  managementOptions.forEach(option => {
    const card = document.createElement('div');
    card.className = 'staff-card';
    const nameDiv = createElement('div', { className: 'staff-name' }, option.name);
    card.appendChild(nameDiv);
    card.addEventListener('click', (e) => selectManagementOption(option, e));
    staffList.appendChild(card);
  });
}

function selectManagementOption(option: { id: string; name: string }, event: MouseEvent): void {
  selectedStaff = 0;
  window.managementContactPerson = option.name;

  const header = document.getElementById('staffHeader');
  if (header) {
    header.textContent = `Yönetim - ${option.name}`;
    header.style.visibility = 'visible';
  }

  const prev = document.querySelector('.staff-card.selected');
  if (prev) prev.classList.remove('selected');
  if (event && event.currentTarget) {
    (event.currentTarget as HTMLElement).classList.add('selected');
  }

  document.getElementById('staffSection')!.style.display = 'none';
  document.getElementById('detailsSection')!.style.display = 'block';
  document.getElementById('turnstileContainer')!.style.display = 'block';
  document.getElementById('submitBtn')!.style.display = 'block';
}

// ==================== FORM SUBMISSION ====================

document.getElementById('submitBtn')?.addEventListener('click', async (): Promise<void> => {
  const name = StringUtils.toTitleCase((document.getElementById('customerName') as HTMLInputElement).value.trim());
  const phone = (document.getElementById('customerPhone') as HTMLInputElement).value.trim();
  const email = (document.getElementById('customerEmail') as HTMLInputElement).value.trim();
  const note = (document.getElementById('customerNote') as HTMLTextAreaElement).value.trim();

  const turnstileToken = window.turnstile?.getResponse();
  if (!turnstileToken) {
    showAlert('Lütfen robot kontrolünü tamamlayın.', 'error');
    return;
  }

  if (!selectedAppointmentType) {
    showAlert('Lutfen randevu tipi secin.', 'error');
    return;
  }

  if (!selectedDate || selectedStaff == null || !selectedTime) {
    showAlert('Lutfen tarih, calisan ve saat secin.', 'error');
    return;
  }

  if (!name || !phone) {
    showAlert('Lutfen ad ve telefon bilgilerinizi girin.', 'error');
    return;
  }

  if (!email) {
    showAlert('Lutfen e-posta adresinizi girin.', 'error');
    return;
  }

  const btn = document.getElementById('submitBtn') as HTMLButtonElement;
  btn.disabled = true;
  btn.innerHTML = '<span class="btn-spinner"></span> Randevu oluşturuluyor...';

  let staffName: string;
  let staff: Staff | undefined = undefined;

  if (selectedStaff === 0) {
    staffName = window.managementContactPerson || 'Yönetim';
  } else {
    staff = staffMembers.find(s => s.id == selectedStaff);
    if (!staff) {
      showAlert('Çalışan bilgisi bulunamadı. Lütfen sayfayı yenileyin.', 'error');
      btn.disabled = false;
      btn.textContent = 'Randevuyu Onayla';
      return;
    }
    staffName = staff.name;
  }

  try {
    const result = await apiCall<{ success: boolean; error?: string }>('createAppointment', {
      date: selectedDate,
      time: selectedTime,
      staffId: selectedStaff,
      staffName: staffName,
      customerName: name,
      customerPhone: phone,
      customerEmail: email,
      customerNote: note,
      shiftType: selectedShiftType,
      appointmentType: selectedAppointmentType,
      duration: CONFIG.APPOINTMENT_HOURS.interval,
      turnstileToken: turnstileToken
    });

    if (result.success) {
      lastAppointmentData = {
        customerName: name,
        customerPhone: phone,
        customerEmail: email,
        customerNote: note,
        staffName: staffName,
        staffPhone: staff?.phone || '',
        staffEmail: staff?.email || '',
        date: selectedDate,
        time: selectedTime,
        appointmentType: selectedAppointmentType,
        duration: CONFIG.APPOINTMENT_HOURS.interval
      };

      window.lastAppointmentData = lastAppointmentData;

      showSuccessPage(selectedDate, selectedTime, staffName, note);
    } else {
      showAlert('Randevu olusturulamadi: ' + (result.error || 'Bilinmeyen hata'), 'error');
      btn.disabled = false;
      btn.textContent = 'Randevuyu Onayla';
    }
  } catch (error) {
    logError(error as Error, { context: 'confirmAppointment', selectedStaff, selectedDate, selectedTime });
    showAlert('Randevu oluşturulamadı. Lütfen tekrar deneyiniz.', 'error');
    btn.disabled = false;
    btn.textContent = 'Randevuyu Onayla';
  }
});

// ==================== UI UTILITIES ====================

function showAlert(message: string, type: AlertType): void {
  showAlertSafe(message, type, 'alertContainer');
}

function hideAlert(): void {
  const container = document.getElementById('alertContainer');
  if (container) container.textContent = '';
}

function showLoading(): void {
  const container = document.getElementById('alertContainer');
  if (!container) return;
  container.textContent = '';
  const loadingDiv = createElement('div', { className: 'loading' });
  const spinnerDiv = createElement('div', { className: 'spinner' });
  loadingDiv.appendChild(spinnerDiv);
  container.appendChild(loadingDiv);
}

function showLoadingError(): void {
  const container = document.querySelector('.container') as HTMLElement;
  container.textContent = '';

  const header = createElement('div', { className: 'header' });

  const logo = createElement('img', {
    src: 'assets/rolex-logo.svg',
    className: 'rolex-logo',
    alt: 'Rolex Logo'
  });
  header.appendChild(logo);

  const title = createElement('h2', {
    style: {
      margin: '20px 0 2px',
      fontSize: '14px',
      fontWeight: 'normal',
      letterSpacing: '1px',
      textAlign: 'center',
      color: '#757575',
      fontFamily: "'Montserrat', sans-serif"
    }
  }, 'Rolex İzmir İstinyepark');
  header.appendChild(title);

  const errorContainer = createElement('div', { className: 'loading-error-container' });
  const spinner = createElement('div', { className: 'spinner' });
  const reloadBtn = createElement('button', {
    className: 'btn',
    id: 'reloadBtn',
    style: {
      marginTop: '40px',
      padding: '12px 30px'
    }
  }, 'Yeniden Dene');

  errorContainer.appendChild(spinner);
  errorContainer.appendChild(reloadBtn);

  container.appendChild(header);
  container.appendChild(errorContainer);

  setTimeout(() => {
    const btn = document.getElementById('reloadBtn');
    if (btn) {
      btn.addEventListener('click', () => location.reload());
    }
  }, 0);
}

function showSuccessPage(dateStr: string, timeStr: string, staffName: string, customerNote: string): void {
  const container = document.querySelector('.container') as HTMLElement;
  container.textContent = '';

  const safeContent = createSuccessPageSafe(dateStr, timeStr, staffName, customerNote);
  container.appendChild(safeContent);

  setTimeout(() => {
    const calendarBtn = document.getElementById('addToCalendarBtn');
    if (calendarBtn) {
      calendarBtn.addEventListener('click', addToCalendar);
    } else {
      log.error('Add to calendar button not found!');
    }
  }, 100);
}

// ==================== CALENDAR INTEGRATION ====================

async function handleCalendarAction(event: MouseEvent): Promise<void> {
  const buttonId = (event.target as HTMLElement).id;

  try {
    if (!window.CalendarIntegration) {
      log.info('Lazy loading calendar-integration.js...');
      const module = await import('./calendar-integration.js');
      window.CalendarIntegration = module;
      log.info('Calendar integration loaded successfully');
    }

    switch (buttonId) {
      case 'calendarAppleBtn':
        window.CalendarIntegration.addToCalendarApple();
        break;
      case 'calendarGoogleBtn':
        window.CalendarIntegration.addToCalendarGoogle();
        break;
      case 'calendarOutlookBtn':
        window.CalendarIntegration.addToCalendarOutlook();
        break;
      case 'calendarICSBtn':
        window.CalendarIntegration.downloadICSUniversal();
        break;
    }
  } catch (error) {
    log.error('Calendar integration loading error:', error);
    logError(error as Error, { context: 'handleCalendarAction', buttonId });
    alert('Takvim entegrasyonu yüklenirken bir hata oluştu. Lütfen tekrar deneyin.');
  }
}

function addToCalendar(): void {
  ModalUtils.open('calendarModal');
}
