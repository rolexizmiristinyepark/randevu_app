        //#region Imports & Configuration (Lines 1-22)
        // Import monitoring utilities
        import { initMonitoring, logError } from './monitoring';
        import { initConfig, Config } from './config-loader';
        import { escapeHtml } from './security-helpers';
        import { TimeUtils } from './time-utils';
        import { ValidationUtils } from './validation-utils';
        import { ErrorUtils } from './error-utils';
        import { ButtonUtils } from './button-utils';

        // ==================== CONFIG - SINGLE SOURCE OF TRUTH ====================
        // ⭐ NEW: Config loaded dynamically from backend API
        // - Environment variables (APPS_SCRIPT_URL, BASE_URL): Hardcoded in config-loader
        // - Business config (shifts, hours, limits): Fetched from API
        // - Cache: localStorage with 1-hour TTL

        let CONFIG: Config;

        // Initialize config asynchronously
        (async () => {
            CONFIG = await initConfig();
            // CONFIG now available globally via window.CONFIG
        })();
        //#endregion

        //#region Data Management (Lines 26-59)
        // ==================== DATA ====================
        const Data = {
            staff: [],
            shifts: {},
            settings: { interval: 60, maxDaily: 4 },

            async loadStaff() {
                try {
                    const response = await ApiService.call('getStaff');
                    if (response.success) {
                        this.staff = response.data;
                    }
                } catch (error) {
                    console.error('İlgili personel yüklenemedi:', error);
                    logError(error, { context: 'loadStaff' });
                }
            },

            async loadShifts() {
                // Shifts are loaded per month/week basis, no need for initial load
                this.shifts = {};
            },

            async loadSettings() {
                try {
                    const response = await ApiService.call('getSettings');
                    if (response.success) {
                        this.settings = response.data;
                    }
                } catch (error) {
                    console.error('Ayarlar yüklenemedi:', error);
                    logError(error, { context: 'loadSettings' });
                }
            }
        };
        //#endregion

        //#region API Settings (Lines 64-98)
        // ==================== API ====================
        const API = {
            async save() {
                const btn = document.getElementById('saveSettingsBtn');
                ButtonUtils.setLoading(btn, 'Kaydediliyor');

                try {
                    const response = await ApiService.call('saveSettings', {
                        interval: document.getElementById('interval').value,
                        maxDaily: document.getElementById('maxDaily').value
                    });

                    if (response.success) {
                        Data.settings = response.data;
                        UI.showAlert('✅ Ayarlar kaydedildi!', 'success');
                    } else {
                        // DRY: ErrorUtils.handleApiError
                        ErrorUtils.handleApiError(response, 'saveSettings', UI.showAlert.bind(UI));
                    }
                } catch (error) {
                    // DRY: ErrorUtils.handleException
                    ErrorUtils.handleException(error, 'Kaydetme', UI.showAlert.bind(UI));
                } finally {
                    ButtonUtils.reset(btn);
                }
            },

            async load() {
                try {
                    await Data.loadSettings();
                    document.getElementById('interval').value = Data.settings.interval || 60;
                    document.getElementById('maxDaily').value = Data.settings.maxDaily || 4;
                } catch (error) {
                    console.error('Ayarlar yüklenemedi:', error);
                }
            }
        };
        //#endregion

        //#region Staff Management (Lines 104-399)
        // ==================== STAFF ====================
        const Staff = {
            currentEditId: null,

            async add() {
                const inputName = document.getElementById('newStaffName');
                const inputPhone = document.getElementById('newStaffPhone');
                const inputEmail = document.getElementById('newStaffEmail');
                const name = inputName.value.trim();
                const phone = inputPhone.value.trim();
                const email = inputEmail.value.trim();

                // DRY: ValidationUtils.validateStaffForm
                const validation = ValidationUtils.validateStaffForm(name, phone, email);
                if (!validation.valid) {
                    UI.showAlert(validation.message, 'error');
                    return;
                }

                try {
                    const response = await ApiService.call('addStaff', { name, phone, email });

                    if (response.success) {
                        Data.staff = response.data;
                        inputName.value = '';
                        inputPhone.value = '';
                        inputEmail.value = '';
                        this.render();
                        UI.showAlert('✅ ' + name + ' eklendi!', 'success');
                    } else {
                        // DRY: ErrorUtils.handleApiError
                        ErrorUtils.handleApiError(response, 'addStaff', UI.showAlert.bind(UI));
                    }
                } catch (error) {
                    // DRY: ErrorUtils.handleException
                    ErrorUtils.handleException(error, 'Ekleme', UI.showAlert.bind(UI));
                }
            },

            async toggle(id) {
                try {
                    const response = await ApiService.call('toggleStaff', { id });

                    if (response.success) {
                        Data.staff = response.data;
                        this.render();
                        UI.showAlert('✅ Durum değişti!', 'success');
                    } else {
                        // DRY: ErrorUtils.handleApiError
                        ErrorUtils.handleApiError(response, 'toggleStaff', UI.showAlert.bind(UI));
                    }
                } catch (error) {
                    // DRY: ErrorUtils.handleException
                    ErrorUtils.handleException(error, 'Güncelleme', UI.showAlert.bind(UI));
                }
            },

            async remove(id) {
                const staff = Data.staff.find(s => s.id === id);
                if (!staff) return;

                if (!confirm('"' + staff.name + '" silinsin mi?')) return;

                try {
                    const response = await ApiService.call('removeStaff', { id });

                    if (response.success) {
                        Data.staff = response.data;
                        this.render();
                        UI.showAlert('✅ ' + staff.name + ' silindi!', 'success');
                    } else {
                        // DRY: ErrorUtils.handleApiError
                        ErrorUtils.handleApiError(response, 'removeStaff', UI.showAlert.bind(UI));
                    }
                } catch (error) {
                    // DRY: ErrorUtils.handleException
                    ErrorUtils.handleException(error, 'Silme', UI.showAlert.bind(UI));
                }
            },

            render() {
                const list = document.getElementById('staffList');
                document.getElementById('staffCount').textContent = Data.staff.filter(s => s.active).length;

                // Temizle
                list.textContent = '';

                if (Data.staff.length === 0) {
                    const emptyMsg = createElement('p', {
                        style: { textAlign: 'center', color: '#999', padding: '20px' }
                    }, 'Henüz personel yok');
                    list.appendChild(emptyMsg);
                    return;
                }

                // ✅ GÜVENLİ DOM MANIPULATION - DocumentFragment ile performans artışı
                const fragment = document.createDocumentFragment();

                Data.staff.forEach(s => {
                    // Staff item container
                    const staffItem = createElement('div', { className: 'staff-item' });

                    // Staff info section
                    const staffInfo = createElement('div', { className: 'staff-info' });

                    const infoDiv = createElement('div');
                    const nameDiv = createElement('div', { className: 'staff-name' }, s.name);
                    const detailsDiv = createElement('div', {
                        style: { fontSize: '12px', color: '#666', marginTop: '4px' }
                    }, `${s.phone || 'Telefon yok'} • ${s.email || 'E-posta yok'}`);

                    infoDiv.appendChild(nameDiv);
                    infoDiv.appendChild(detailsDiv);

                    staffInfo.appendChild(infoDiv);

                    // Staff actions section
                    const staffActions = createElement('div', { className: 'staff-actions' });

                    // Status span - Düzenle butonunun solunda
                    const statusSpan = createElement('span', {
                        className: `staff-status ${s.active ? 'status-active' : 'status-inactive'}`
                    }, s.active ? 'Aktif' : 'Pasif');

                    // ✅ EVENT DELEGATION: data-action attribute'ları eklendi
                    // Edit button
                    const editBtn = createElement('button', {
                        className: 'btn btn-small btn-secondary',
                        'data-action': 'edit',      // Eylem türü
                        'data-staff-id': s.id       // İlgili personel ID
                    }, 'Düzenle');
                    // addEventListener kaldırıldı - Event Delegation kullanılacak

                    // Toggle button
                    const toggleBtn = createElement('button', {
                        className: `btn btn-small btn-secondary`,
                        'data-action': 'toggle',    // Eylem türü
                        'data-staff-id': s.id       // İlgili personel ID
                    }, s.active ? 'Pasif' : 'Aktif');
                    // addEventListener kaldırıldı - Event Delegation kullanılacak

                    // Remove button
                    const removeBtn = createElement('button', {
                        className: 'btn btn-small btn-secondary',
                        'data-action': 'remove',    // Eylem türü
                        'data-staff-id': s.id       // İlgili personel ID
                    }, 'Sil');
                    // addEventListener kaldırıldı - Event Delegation kullanılacak

                    staffActions.appendChild(statusSpan);
                    staffActions.appendChild(editBtn);
                    staffActions.appendChild(toggleBtn);
                    staffActions.appendChild(removeBtn);

                    staffItem.appendChild(staffInfo);
                    staffItem.appendChild(staffActions);
                    fragment.appendChild(staffItem);
                });

                list.appendChild(fragment);

                // Personel linklerini güncelle
                this.renderLinks();
            },

            renderLinks() {
                const container = document.getElementById('staffLinks');
                if (!container) return;

                // Temizle
                container.textContent = '';

                const activeStaff = Data.staff.filter(s => s.active);

                if (activeStaff.length === 0) {
                    const emptyMsg = createElement('p', {
                        style: { textAlign: 'center', color: '#999', padding: '20px' }
                    }, 'Henüz personel yok');
                    container.appendChild(emptyMsg);
                    return;
                }

                // ✅ Grid Layout ile düzenli görünüm
                const gridContainer = createElement('div', { className: 'link-grid' });

                activeStaff.forEach(s => {
                    const staffLink = `${CONFIG.BASE_URL}?staff=${s.id}`;

                    // Link card
                    const linkCard = createElement('div', { className: 'link-card' });

                    // Header
                    const header = createElement('div', { className: 'link-card-header' }, s.name);

                    // Body
                    const body = createElement('div', { className: 'link-card-body' });

                    // Link input
                    const linkInput = createElement('input', {
                        type: 'text',
                        value: staffLink,
                        readonly: true,
                        id: `staffLink_${s.id}`,
                        className: 'link-input'
                    });

                    // Actions
                    const actions = createElement('div', { className: 'link-actions' });

                    const copyBtn = createElement('button', {
                        className: 'btn btn-small btn-secondary'
                    }, 'Kopyala');
                    copyBtn.addEventListener('click', () => Staff.copyLink(s.id));

                    const openBtn = createElement('button', {
                        className: 'btn btn-small'
                    }, 'Aç');
                    openBtn.addEventListener('click', () => Staff.openLink(s.id));

                    actions.appendChild(copyBtn);
                    actions.appendChild(openBtn);

                    body.appendChild(linkInput);
                    body.appendChild(actions);

                    linkCard.appendChild(header);
                    linkCard.appendChild(body);
                    gridContainer.appendChild(linkCard);
                });

                container.appendChild(gridContainer);
            },

            copyLink(staffId) {
                const input = document.getElementById('staffLink_' + staffId);
                input.select();
                document.execCommand('copy');
                UI.showAlert('✅ Link kopyalandı!', 'success');
            },

            openLink(staffId) {
                const input = document.getElementById('staffLink_' + staffId);
                window.open(input.value, '_blank');
            },

            openEditModal(staffId) {
                const staff = Data.staff.find(s => s.id === staffId);
                if (!staff) return;

                this.currentEditId = staffId;
                document.getElementById('editStaffName').value = staff.name;
                document.getElementById('editStaffPhone').value = staff.phone || '';
                document.getElementById('editStaffEmail').value = staff.email || '';
                document.getElementById('editStaffModal').classList.add('active');
            },

            closeEditModal() {
                this.currentEditId = null;
                document.getElementById('editStaffModal').classList.remove('active');
            },

            async saveEdit() {
                const name = document.getElementById('editStaffName').value.trim();
                const phone = document.getElementById('editStaffPhone').value.trim();
                const email = document.getElementById('editStaffEmail').value.trim();

                // DRY: ValidationUtils.validateStaffForm
                const validation = ValidationUtils.validateStaffForm(name, phone, email);
                if (!validation.valid) {
                    UI.showAlert(validation.message, 'error');
                    return;
                }

                try {
                    const response = await ApiService.call('updateStaff', {
                        id: this.currentEditId,
                        name: name,
                        phone: phone,
                        email: email
                    });

                    if (response.success) {
                        Data.staff = response.data;
                        this.render();
                        this.closeEditModal();
                        UI.showAlert('✅ Personel güncellendi!', 'success');
                    } else {
                        // DRY: ErrorUtils.handleApiError
                        ErrorUtils.handleApiError(response, 'updateStaff', UI.showAlert.bind(UI));
                    }
                } catch (error) {
                    // DRY: ErrorUtils.handleException
                    ErrorUtils.handleException(error, 'Güncelleme', UI.showAlert.bind(UI));
                }
            }
        };
        //#endregion

        //#region Shift Management (Lines 401-752)
        // ==================== SHIFTS ====================
        const Shifts = {
            currentWeek: null,

            init() {
                // Bu haftayı ayarla (Pazartesi başlangıç)
                const today = new Date();
                const year = today.getFullYear();
                const firstDayOfYear = new Date(year, 0, 1);
                const pastDaysOfYear = (today - firstDayOfYear) / 86400000;
                const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
                document.getElementById('weekDate').value = `${year}-W${String(weekNumber).padStart(2, '0')}`;
                this.load();
            },

            async load() {
                const weekValue = document.getElementById('weekDate').value;
                if (!weekValue) {
                    UI.showAlert('❌ Hafta seçin!', 'error');
                    return;
                }

                // Hafta değerinden tarih aralığını hesapla
                const [year, week] = weekValue.split('-W');
                const firstDayOfYear = new Date(parseInt(year), 0, 1);
                const daysOffset = (parseInt(week) - 1) * 7;
                const weekStart = new Date(firstDayOfYear.getTime());
                weekStart.setDate(firstDayOfYear.getDate() + daysOffset);

                // Pazartesi'yi bul
                const dayOfWeek = weekStart.getDay();
                const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                weekStart.setDate(weekStart.getDate() + diff);

                // ✅ DateUtils ile tarih formatla
                this.currentWeek = DateUtils.toLocalDate(weekStart);

                // Ay verilerini yükle
                const monthStr = this.currentWeek.slice(0, 7); // YYYY-MM kısmı

                try {
                    const response = await ApiService.call('getMonthShifts', { month: monthStr });
                    if (response.success) {
                        Data.shifts = response.data || {};
                    }
                } catch (error) {
                    console.error('Vardiyalar yüklenemedi:', error);
                }

                this.render();
                this.renderSaved();
            },

            nextWeek() {
                const weekValue = document.getElementById('weekDate').value;
                if (!weekValue) return;

                const [year, week] = weekValue.split('-W');
                const nextWeek = parseInt(week) + 1;

                if (nextWeek > 52) {
                    document.getElementById('weekDate').value = `${parseInt(year) + 1}-W01`;
                } else {
                    document.getElementById('weekDate').value = `${year}-W${String(nextWeek).padStart(2, '0')}`;
                }

                this.load();
            },

            async save() {
                if (!this.currentWeek) {
                    UI.showAlert('❌ Önce hafta yükleyin!', 'error');
                    return;
                }

                const shiftsData = {};
                const selects = document.querySelectorAll('.shift-select');

                selects.forEach(select => {
                    const staffId = parseInt(select.dataset.staff);
                    const date = select.dataset.date;
                    const value = select.value;

                    if (!shiftsData[date]) shiftsData[date] = {};

                    if (value) {
                        shiftsData[date][staffId] = value;
                    }
                });

                const btn = document.getElementById('saveShiftsBtn');
                ButtonUtils.setLoading(btn, 'Kaydediliyor');

                try {
                    const response = await ApiService.call('saveShifts', {
                        shifts: JSON.stringify(shiftsData)
                    });

                    if (response.success) {
                        // Merge with local data
                        Object.assign(Data.shifts, shiftsData);
                        this.renderSaved();
                        UI.showAlert('✅ Vardiyalar kaydedildi!', 'success');
                    } else {
                        // DRY: ErrorUtils.handleApiError
                        ErrorUtils.handleApiError(response, 'saveShifts', UI.showAlert.bind(UI));
                    }
                } catch (error) {
                    // DRY: ErrorUtils.handleException
                    ErrorUtils.handleException(error, 'Kaydetme', UI.showAlert.bind(UI));
                } finally {
                    ButtonUtils.reset(btn);
                }
            },

            render() {
                const container = document.getElementById('shiftTable');
                // Temizle
                container.textContent = '';

                // String'den local timezone'da Date oluştur
                const [year, month, day] = this.currentWeek.split('-').map(Number);
                const weekStart = new Date(year, month - 1, day);
                const days = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

                // ✅ GÜVENLİ DOM MANIPULATION - createElement ile tablo oluştur
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
                    dayHeader.appendChild(document.createTextNode(days[i]));
                    dayHeader.appendChild(createElement('br'));
                    const small = createElement('small', {}, dateStr);
                    dayHeader.appendChild(small);
                    headerRow.appendChild(dayHeader);
                }

                thead.appendChild(headerRow);
                table.appendChild(thead);

                // Table body
                const tbody = createElement('tbody');

                Data.staff.filter(s => s.active).forEach(staff => {
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
                        // ✅ DateUtils ile tarih formatla
                        const dateKey = DateUtils.toLocalDate(d);
                        const current = Data.shifts[dateKey]?.[staff.id] || '';

                        const dayCell = createElement('td');
                        const select = createElement('select', {
                            className: 'shift-select',
                            'data-staff': staff.id,
                            'data-date': dateKey,
                            'data-shift': current  // Renk için
                        });

                        // Options - Tam kelime kullan
                        const opt1 = createElement('option', { value: '' });
                        opt1.textContent = 'Off';

                        const opt2 = createElement('option', { value: 'morning' });
                        opt2.textContent = 'Sabah';

                        const opt3 = createElement('option', { value: 'evening' });
                        opt3.textContent = 'Akşam';

                        const opt4 = createElement('option', { value: 'full' });
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

                // Responsive: Ekran küçükse kısaltmaları uygula
                this.updateShiftLabels();
            },

            // Ekran genişliğine göre vardiya etiketlerini güncelle
            updateShiftLabels() {
                const isSmallScreen = window.innerWidth <= 1024;
                const selects = document.querySelectorAll('.shift-table select');

                selects.forEach(select => {
                    Array.from(select.options).forEach(option => {
                        const value = option.value;
                        if (isSmallScreen) {
                            // Küçük ekranda kısaltmalar
                            if (value === '') option.textContent = 'Off';
                            if (value === 'morning') option.textContent = 'S';
                            if (value === 'evening') option.textContent = 'A';
                            if (value === 'full') option.textContent = 'F';
                        } else {
                            // Normal ekranda tam kelimeler
                            if (value === '') option.textContent = 'Off';
                            if (value === 'morning') option.textContent = 'Sabah';
                            if (value === 'evening') option.textContent = 'Akşam';
                            if (value === 'full') option.textContent = 'Full';
                        }
                    });
                });
            },

            renderSaved() {
                const container = document.getElementById('savedShifts');
                const dates = Object.keys(Data.shifts).sort().reverse().slice(0, 10);

                // Temizle
                container.textContent = '';

                if (dates.length === 0) {
                    const emptyMsg = createElement('p', {
                        style: { textAlign: 'center', color: '#999', padding: '20px' }
                    }, 'Kayıtlı plan yok');
                    container.appendChild(emptyMsg);
                    return;
                }

                const weeks = {};
                dates.forEach(dateStr => {
                    // Local timezone'da Date oluştur
                    const [year, month, day] = dateStr.split('-').map(Number);
                    const d = new Date(year, month - 1, day);
                    const dayOfWeek = d.getDay();
                    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                    const monday = new Date(d);
                    monday.setDate(d.getDate() + diff);

                    // ✅ DateUtils ile tarih formatla
                    const weekKey = DateUtils.toLocalDate(monday);

                    if (!weeks[weekKey]) weeks[weekKey] = [];
                    weeks[weekKey].push(dateStr);
                });

                // ✅ GÜVENLİ DOM MANIPULATION - DocumentFragment ile performans artışı
                const fragment = document.createDocumentFragment();

                Object.keys(weeks).sort().reverse().forEach(weekStart => {
                    const [year, month, day] = weekStart.split('-').map(Number);
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

                    // Week title - Tıklanabilir
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
                        Shifts.loadWeek(weekStart);
                        // Yukarı scroll yap
                        document.getElementById('shiftTable')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    });

                    // Edit button
                    const editBtn = createElement('button', {
                        className: 'btn btn-small btn-secondary'
                    }, 'Düzenle');
                    editBtn.addEventListener('click', () => {
                        Shifts.loadWeek(weekStart);
                        // Yukarı scroll yap
                        document.getElementById('shiftTable')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    });

                    headerDiv.appendChild(titleDiv);
                    headerDiv.appendChild(editBtn);
                    weekDiv.appendChild(headerDiv);
                    fragment.appendChild(weekDiv);
                });

                container.appendChild(fragment);
            },

            loadWeek(weekStart) {
                // Tarih string'inden (YYYY-MM-DD) week formatına (YYYY-Www) çevir
                const [year, month, day] = weekStart.split('-').map(Number);
                const date = new Date(year, month - 1, day);

                // ISO week number hesapla
                const firstDayOfYear = new Date(year, 0, 1);
                const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
                const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);

                document.getElementById('weekDate').value = `${year}-W${String(weekNumber).padStart(2, '0')}`;
                this.load();
                UI.switchTab('shifts');
            }
        };
        //#endregion

        //#region Appointment Management (Lines 757-1153)
        // ==================== APPOINTMENTS ====================
        const Appointments = {
            async load() {
                const filterWeek = document.getElementById('filterWeek').value;
                const container = document.getElementById('appointmentsList');

                // ✅ GÜVENLİ DOM MANIPULATION - innerHTML yerine createElement
                container.textContent = '';
                const loadingMsg = createElement('p', {
                    style: { textAlign: 'center', padding: '20px' }
                }, 'Yükleniyor...');
                container.appendChild(loadingMsg);

                // Hafta seçildiyse hafta aralığını hesapla
                let startDate, endDate;
                if (filterWeek) {
                    const [year, week] = filterWeek.split('-W');
                    const firstDayOfYear = new Date(year, 0, 1);
                    const daysOffset = (week - 1) * 7;
                    startDate = new Date(firstDayOfYear.setDate(firstDayOfYear.getDate() + daysOffset));
                    // Pazartesi'yi bul
                    const dayOfWeek = startDate.getDay();
                    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                    startDate.setDate(startDate.getDate() + diff);
                    endDate = new Date(startDate);
                    endDate.setDate(endDate.getDate() + 6);
                } else {
                    // Varsayılan: Bu hafta
                    const today = new Date();
                    const dayOfWeek = today.getDay();
                    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                    startDate = new Date(today);
                    startDate.setDate(startDate.getDate() + diff);
                    endDate = new Date(startDate);
                    endDate.setDate(endDate.getDate() + 6);
                }

                try {
                    // ✅ DateUtils ile tarih formatla
                    const result = await ApiService.call('getWeekAppointments', {
                        startDate: DateUtils.toLocalDate(startDate),
                        endDate: DateUtils.toLocalDate(endDate)
                    });

                    if (result.error) {
                        // ✅ GÜVENLİ DOM MANIPULATION - innerHTML yerine createElement
                        container.textContent = '';
                        const errorMsg = createElement('p', {
                            style: { textAlign: 'center', color: '#dc3545', padding: '20px' }
                        }, '❌ Hata: ' + result.error);
                        container.appendChild(errorMsg);
                    } else {
                        this.render(result.items || []);
                    }
                } catch (error) {
                    // ✅ GÜVENLİ DOM MANIPULATION - innerHTML yerine createElement
                    container.textContent = '';
                    const errorMsg = createElement('p', {
                        style: { textAlign: 'center', color: '#dc3545', padding: '20px' }
                    }, '❌ Yükleme hatası');
                    container.appendChild(errorMsg);
                }
            },

            async deleteAppointment(eventId) {
                if (!confirm('Bu randevuyu silmek istediğinizden emin misiniz?')) return;

                try {
                    const result = await ApiService.call('deleteAppointment', { eventId });
                    if (result.success) {
                        UI.showAlert('✅ Randevu silindi', 'success');
                        this.load();
                    } else {
                        UI.showAlert('❌ Silme hatası: ' + result.error, 'error');
                    }
                } catch (error) {
                    UI.showAlert('❌ Silme hatası', 'error');
                }
            },

            // Randevu düzenleme modal'ini aç
            openEditModal(appointment) {
                // Store current appointment data
                this.currentEditingAppointment = appointment;

                try {
                    // Parse date
                    const startDate = new Date(appointment.start.dateTime || appointment.start.date);

                    // Format date as YYYY-MM-DD for date input
                    const year = startDate.getFullYear();
                    const month = String(startDate.getMonth() + 1).padStart(2, '0');
                    const day = String(startDate.getDate()).padStart(2, '0');
                    const dateStr = `${year}-${month}-${day}`;

                    // Format time as HH:MM (DRY: TimeUtils.toTimeString)
                    const currentTime = TimeUtils.toTimeString(startDate);

                    // Set date and time values
                    document.getElementById('editAppointmentDate').value = dateStr;
                    document.getElementById('editAppointmentTime').value = currentTime;

                    // Enable save button if both date and time are set
                    document.getElementById('saveEditAppointmentBtn').disabled = false;

                    // Show modal
                    document.getElementById('editAppointmentModal').classList.add('active');
                } catch (error) {
                    console.error('Modal açma hatası:', error, appointment);
                    UI.showAlert('❌ Randevu tarihi okunamadı', 'error');
                }
            },

            // Modal'i kapat
            closeEditModal() {
                document.getElementById('editAppointmentModal').classList.remove('active');
                this.currentEditingAppointment = null;
            },

            // Randevu düzenlemeyi kaydet
            async saveEditedAppointment() {
                if (!this.currentEditingAppointment) return;

                const newDate = document.getElementById('editAppointmentDate').value;
                const newTime = document.getElementById('editAppointmentTime').value;

                if (!newDate || !newTime) {
                    UI.showAlert('❌ Lütfen tarih ve saat seçin', 'error');
                    return;
                }

                try {
                    const result = await ApiService.call('updateAppointment', {
                        eventId: this.currentEditingAppointment.id,
                        newDate: newDate,
                        newTime: newTime
                    });

                    if (result.success) {
                        UI.showAlert('✅ Randevu güncellendi', 'success');
                        this.closeEditModal();
                        this.load(); // Listeyi yenile
                    } else {
                        UI.showAlert('❌ Güncelleme hatası: ' + result.error, 'error');
                    }
                } catch (error) {
                    UI.showAlert('❌ Güncelleme hatası', 'error');
                }
            },

            // İlgili personel atama modal'ini aç
            openAssignStaffModal(appointment) {
                // Store current appointment data
                this.currentAssigningAppointment = appointment;

                // Fill appointment info
                const start = new Date(appointment.start.dateTime || appointment.start.date);
                const customerName = appointment.summary?.replace('Randevu: ', '') || 'İsimsiz';
                const dateStr = start.toLocaleDateString('tr-TR', {weekday: 'long', day: 'numeric', month: 'long'});
                const timeStr = start.toLocaleTimeString('tr-TR', {hour: '2-digit', minute: '2-digit'});

                const infoDiv = document.getElementById('assignStaffInfo');
                // 🔒 SECURITY: escapeHtml() ile XSS koruması
                infoDiv.innerHTML = `
                    <div style="font-size: 13px; line-height: 1.8; color: #757575;">
                        <div><span style="color: #1A1A2E; font-weight: 500;">Müşteri:</span> ${escapeHtml(customerName)}</div>
                        <div><span style="color: #1A1A2E; font-weight: 500;">Tarih:</span> ${escapeHtml(dateStr)}</div>
                        <div><span style="color: #1A1A2E; font-weight: 500;">Saat:</span> ${escapeHtml(timeStr)}</div>
                    </div>
                `;

                // Populate staff dropdown
                const select = document.getElementById('assignStaffSelect');
                select.innerHTML = '<option value="">-- Seçin --</option>';

                const activeStaff = Data.staff.filter(s => s.active);
                activeStaff.forEach(staff => {
                    const option = createElement('option', { value: staff.id }, staff.name);
                    select.appendChild(option);
                });

                // Show modal
                document.getElementById('assignStaffModal').classList.add('active');
            },

            // Modal'i kapat
            closeAssignStaffModal() {
                document.getElementById('assignStaffModal').classList.remove('active');
                this.currentAssigningAppointment = null;
            },

            // Personel atamasını kaydet
            async saveAssignedStaff() {
                if (!this.currentAssigningAppointment) return;

                const staffId = document.getElementById('assignStaffSelect').value;
                const btn = document.getElementById('saveAssignStaffBtn');

                if (!staffId) {
                    UI.showAlert('❌ Lütfen personel seçin', 'error');
                    return;
                }

                ButtonUtils.setLoading(btn, 'Atanıyor');

                try {
                    const result = await ApiService.call('assignStaffToAppointment', {
                        eventId: this.currentAssigningAppointment.id,
                        staffId: staffId
                    });

                    if (result.success) {
                        UI.showAlert('✅ ' + result.staffName + ' atandı', 'success');
                        this.closeAssignStaffModal();
                        this.load(); // Listeyi yenile
                    } else {
                        UI.showAlert('❌ Atama hatası: ' + result.error, 'error');
                    }
                } catch (error) {
                    UI.showAlert('❌ Atama hatası', 'error');
                } finally {
                    ButtonUtils.reset(btn);
                }
            },

            render(appointments) {
                const container = document.getElementById('appointmentsList');

                // Temizle
                container.textContent = '';

                if (appointments.length === 0) {
                    // ✅ GÜVENLİ DOM MANIPULATION - innerHTML yerine createElement
                    const emptyMsg = createElement('p', {
                        style: { textAlign: 'center', color: '#999', padding: '20px' }
                    }, 'Randevu bulunamadı');
                    container.appendChild(emptyMsg);
                    return;
                }

                // Günlere göre grupla
                const byDate = {};
                appointments.forEach(apt => {
                    const start = new Date(apt.start.dateTime || apt.start.date);
                    // ✅ DateUtils ile tarih formatla
                    const dateKey = DateUtils.toLocalDate(start);
                    if (!byDate[dateKey]) byDate[dateKey] = [];
                    byDate[dateKey].push(apt);
                });

                const shiftLabels = {
                    'morning': '🌅 Sabah',
                    'evening': '🌆 Akşam',
                    'full': '🌞 Full'
                };

                // ✅ GÜVENLİ DOM MANIPULATION - DocumentFragment ile performans artışı
                const fragment = document.createDocumentFragment();

                Object.keys(byDate).sort().forEach(dateKey => {
                    const date = new Date(dateKey + 'T12:00:00');

                    // Date header
                    const dateHeader = createElement('h3', {
                        style: { margin: '20px 0 12px 0', color: '#1A1A2E', fontSize: '14px', fontWeight: '400', letterSpacing: '1px', textTransform: 'uppercase' }
                    }, date.toLocaleDateString('tr-TR', {weekday:'long', day:'numeric', month:'long'}));
                    fragment.appendChild(dateHeader);

                    byDate[dateKey].forEach(apt => {
                        const start = new Date(apt.start.dateTime || apt.start.date);
                        const end = new Date(apt.end.dateTime || apt.end.date);
                        const staffId = apt.extendedProperties?.private?.staffId;
                        const staff = Data.staff.find(s => s.id === parseInt(staffId));
                        const phone = apt.extendedProperties?.private?.customerPhone || '-';
                        const customerName = apt.summary?.replace('Randevu: ', '') || 'İsimsiz';
                        const customerNote = apt.extendedProperties?.private?.customerNote || '';
                        const isVipLink = apt.extendedProperties?.private?.isVipLink === 'true';

                        // Appointment card container
                        const aptCard = createElement('div', {
                            style: {
                                background: 'white',
                                padding: '18px',
                                borderRadius: '2px',
                                border: '1px solid #E8E8E8',
                                marginBottom: '12px'
                            }
                        });

                        // Main flex container
                        const flexContainer = createElement('div', {
                            style: { display: 'flex', justifyContent: 'space-between', alignItems: 'start' }
                        });

                        // Left side - appointment details
                        const detailsDiv = createElement('div', {
                            style: { flex: '1' }
                        });

                        // Time range
                        const startTime = start.toLocaleTimeString('tr-TR', {hour:'2-digit',minute:'2-digit'});
                        const endTime = end.toLocaleTimeString('tr-TR', {hour:'2-digit',minute:'2-digit'});
                        const timeDiv = createElement('div', {
                            style: { fontWeight: '400', color: '#1A1A2E', fontSize: '15px', marginBottom: '10px', letterSpacing: '0.5px' }
                        }, `${startTime} - ${endTime}`);

                        // Details text
                        const infoDiv = createElement('div', {
                            style: { fontSize: '13px', lineHeight: '1.8', color: '#757575' }
                        });

                        const customerLabel = createElement('span', { style: { color: '#1A1A2E' } }, 'Müşteri: ');
                        infoDiv.appendChild(customerLabel);
                        infoDiv.appendChild(document.createTextNode(customerName));
                        infoDiv.appendChild(createElement('br'));

                        const phoneLabel = createElement('span', { style: { color: '#1A1A2E' } }, 'Telefon: ');
                        infoDiv.appendChild(phoneLabel);
                        infoDiv.appendChild(document.createTextNode(phone));
                        infoDiv.appendChild(createElement('br'));

                        const staffLabel = createElement('span', { style: { color: '#1A1A2E' } }, 'İlgili: ');
                        infoDiv.appendChild(staffLabel);
                        infoDiv.appendChild(document.createTextNode(staff?.name || '-'));

                        if (customerNote) {
                            infoDiv.appendChild(createElement('br'));
                            const noteLabel = createElement('span', { style: { color: '#1A1A2E' } }, 'Not: ');
                            infoDiv.appendChild(noteLabel);
                            infoDiv.appendChild(document.createTextNode(customerNote));
                        }

                        detailsDiv.appendChild(timeDiv);
                        detailsDiv.appendChild(infoDiv);

                        // Right side - action buttons
                        const buttonsDiv = createElement('div', {
                            style: { display: 'flex', flexDirection: 'column', gap: '8px' }
                        });

                        // Edit button
                        const editBtn = createElement('button', {
                            className: 'btn btn-small btn-secondary'
                        }, 'Düzenle');
                        editBtn.addEventListener('click', () => {
                            Appointments.openEditModal(apt);
                        });

                        // Cancel button
                        const cancelBtn = createElement('button', {
                            className: 'btn btn-small btn-secondary'
                        }, 'İptal Et');
                        cancelBtn.addEventListener('click', () => {
                            Appointments.deleteAppointment(apt.id);
                        });

                        buttonsDiv.appendChild(editBtn);
                        buttonsDiv.appendChild(cancelBtn);

                        // İlgili Ata button - sadece VIP linklerden gelen randevular için (#hk, #ok, #hmk)
                        // Manuel yönetim randevularında (staff=0) gösterme
                        const staffName = staff?.name || '-';
                        const hasNoStaff = !staffId || !staff || staffName === 'Atanmadı' || staffName === '-';

                        if (isVipLink && hasNoStaff) {
                            const assignBtn = createElement('button', {
                                className: 'btn btn-small',
                                style: { background: 'linear-gradient(135deg, #C9A55A 0%, #B8944A 100%)', borderColor: '#C9A55A', color: 'white' }
                            }, 'İlgili Ata');
                            assignBtn.addEventListener('click', () => {
                                Appointments.openAssignStaffModal(apt);
                            });
                            buttonsDiv.appendChild(assignBtn);
                        }

                        flexContainer.appendChild(detailsDiv);
                        flexContainer.appendChild(buttonsDiv);
                        aptCard.appendChild(flexContainer);
                        fragment.appendChild(aptCard);
                    });
                });

                container.appendChild(fragment);
            },

            sendWhatsApp(phone, customerName, dateTime) {
                // Telefon numarasını temizle (sadece rakamlar)
                const cleanPhone = phone.replace(/\D/g, '');
                // +90 ile başlamıyorsa ekle
                const fullPhone = cleanPhone.startsWith('90') ? cleanPhone : '90' + cleanPhone;

                const message = encodeURIComponent(
                    `Merhaba ${customerName},\n\n` +
                    `${dateTime} tarihli randevunuzu onaylıyoruz.\n\n` +
                    `Görüşmek üzere!`
                );

                window.open(`https://wa.me/${fullPhone}?text=${message}`, '_blank');
            }
        };
        //#endregion

        //#region UI Utilities & Helper Functions (Lines 1160-1244)
        // ==================== UI ====================
        const UI = {
            showAlert(message, type) {
                // GÜVENLİ ALERT - XSS korumalı
                showAlertSafe(message, type, 'alertContainer');
            },

            switchTab(tabName) {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

                document.querySelector('.tab[data-tab="' + tabName + '"]').classList.add('active');
                document.getElementById(tabName).classList.add('active');

                if (tabName === 'appointments') Appointments.load();
            }
        };

        function copyLink() {
            const link = document.getElementById('customerLink');
            link.select();
            document.execCommand('copy');
            UI.showAlert('✅ Link kopyalandı!', 'success');
        }

        function openCustomerPage() {
            const link = document.getElementById('customerLink').value;
            if (link && !link.includes('⚠️')) {
                window.open(link, '_blank');
            }
        }

        function copyManualLink() {
            const link = document.getElementById('manualLink');
            link.select();
            document.execCommand('copy');
            UI.showAlert('✅ Manuel randevu linki kopyalandı!', 'success');
        }

        function openManualPage() {
            const link = document.getElementById('manualLink').value;
            if (link && !link.includes('⚠️')) {
                window.open(link, '_blank');
            }
        }

        // ==================== YÖNETİM LİNKLERİ (HK, OK, HMK) ====================
        function copyManagement1Link() {
            const link = document.getElementById('management1Link');
            link.select();
            document.execCommand('copy');
            UI.showAlert('✅ Yönetim-1 linki kopyalandı!', 'success');
        }

        function openManagement1Page() {
            const link = document.getElementById('management1Link').value;
            if (link && !link.includes('⚠️')) {
                window.open(link, '_blank');
            }
        }

        function copyManagement2Link() {
            const link = document.getElementById('management2Link');
            link.select();
            document.execCommand('copy');
            UI.showAlert('✅ Yönetim-2 linki kopyalandı!', 'success');
        }

        function openManagement2Page() {
            const link = document.getElementById('management2Link').value;
            if (link && !link.includes('⚠️')) {
                window.open(link, '_blank');
            }
        }

        function copyManagement3Link() {
            const link = document.getElementById('management3Link');
            link.select();
            document.execCommand('copy');
            UI.showAlert('✅ Yönetim-3 linki kopyalandı!', 'success');
        }

        function openManagement3Page() {
            const link = document.getElementById('management3Link').value;
            if (link && !link.includes('⚠️')) {
                window.open(link, '_blank');
            }
        }
        //#endregion

        //#region Initialization & Event Listeners (Lines 1251-End)
        // ==================== INIT ====================
        // Wait for ES6 modules to load before checking authentication
        function initAdmin() {
            // Initialize monitoring (Sentry + Web Vitals) - only once
            if (!window.__monitoringInitialized) {
                initMonitoring();
                window.__monitoringInitialized = true;
            }

            // Check if AdminAuth module is loaded
            if (typeof window.AdminAuth === 'undefined') {
                // Module not loaded yet, wait a bit and try again
                setTimeout(initAdmin, 50);
                return;
            }

            // Authentication kontrolü
            if (!window.AdminAuth.isAuthenticated()) {
                window.AdminAuth.showLoginModal();
                return;
            }

            // Initialize the rest of the app
            startApp();
        }

        async function startApp() {

            // Çıkış butonu ekle
            AdminAuth.addLogoutButton();

            // İnaktivite takibini başlat (15 dk timeout)
            AdminAuth._startActivityTracking();

            // Load all data from server
            await Data.loadStaff();
            await Data.loadShifts();
            await API.load();

            Staff.render();
            Shifts.init();

            // Tab switching
            document.querySelectorAll('.tab').forEach(tab => {
                tab.addEventListener('click', function() {
                    UI.switchTab(this.dataset.tab);
                });
            });

            // Customer link setup
            const linkInput = document.getElementById('customerLink');
            linkInput.value = CONFIG.BASE_URL;

            // Manuel randevu link setup (staff=0 parametreli)
            const manualLinkInput = document.getElementById('manualLink');
            manualLinkInput.value = CONFIG.BASE_URL + '?staff=0';

            // Yönetim linkleri setup (VIP linkler - hash routing for GitHub Pages)
            const management1LinkInput = document.getElementById('management1Link');
            management1LinkInput.value = CONFIG.BASE_URL + '#hk';

            const management2LinkInput = document.getElementById('management2Link');
            management2LinkInput.value = CONFIG.BASE_URL + '#ok';

            const management3LinkInput = document.getElementById('management3Link');
            management3LinkInput.value = CONFIG.BASE_URL + '#hmk';

            // Hafta seçimi - bu hafta
            const today = new Date();
            const year = today.getFullYear();
            const firstDayOfYear = new Date(year, 0, 1);
            const pastDaysOfYear = (today - firstDayOfYear) / 86400000;
            const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
            document.getElementById('filterWeek').value = `${year}-W${String(weekNumber).padStart(2, '0')}`;

            // ==================== EVENT LISTENERS ====================
            // Settings buttons
            document.getElementById('saveSettingsBtn')?.addEventListener('click', () => API.save());
            document.getElementById('openCustomerBtn')?.addEventListener('click', openCustomerPage);
            document.getElementById('copyLinkBtn')?.addEventListener('click', copyLink);
            document.getElementById('openManualBtn')?.addEventListener('click', openManualPage);
            document.getElementById('copyManualLinkBtn')?.addEventListener('click', copyManualLink);

            // Yönetim link buttons
            document.getElementById('copyManagement1Btn')?.addEventListener('click', copyManagement1Link);
            document.getElementById('openManagement1Btn')?.addEventListener('click', openManagement1Page);
            document.getElementById('copyManagement2Btn')?.addEventListener('click', copyManagement2Link);
            document.getElementById('openManagement2Btn')?.addEventListener('click', openManagement2Page);
            document.getElementById('copyManagement3Btn')?.addEventListener('click', copyManagement3Link);
            document.getElementById('openManagement3Btn')?.addEventListener('click', openManagement3Page);

            // Staff buttons
            document.getElementById('addStaffBtn')?.addEventListener('click', () => Staff.add());
            document.getElementById('cancelEditStaffBtn')?.addEventListener('click', () => Staff.closeEditModal());
            document.getElementById('saveEditStaffBtn')?.addEventListener('click', () => Staff.saveEdit());

            // ✅ EVENT DELEGATION: Tek listener tüm staff butonları için
            document.getElementById('staffList')?.addEventListener('click', (e) => {
                // Tıklanan elementin bir buton olup olmadığını kontrol et
                const button = e.target.closest('[data-action]');

                // Eğer data-action içermeyen bir yer tıklandıysa, işlem yapma
                if (!button) return;

                // Butonun action türünü ve staff ID'sini al
                const action = button.dataset.action;
                const staffId = parseInt(button.dataset.staffId);

                // İlgili fonksiyonu çağır
                switch (action) {
                    case 'edit':
                        Staff.openEditModal(staffId);
                        break;
                    case 'toggle':
                        Staff.toggle(staffId);
                        break;
                    case 'remove':
                        Staff.remove(staffId);
                        break;
                }
            });

            // Shift buttons and inputs
            document.getElementById('weekDate')?.addEventListener('change', () => Shifts.load());
            document.getElementById('nextWeekBtn')?.addEventListener('click', () => Shifts.nextWeek());
            document.getElementById('saveShiftsBtn')?.addEventListener('click', () => Shifts.save());

            // Hafta inputlarına tıklandığında takvimi aç
            document.getElementById('weekDate')?.addEventListener('click', function() {
                try {
                    if (this.showPicker) {
                        this.showPicker();
                    }
                } catch (error) {
                    // showPicker desteklenmiyorsa, normal davranışa devam et
                    console.log('showPicker not supported');
                }
            });

            // Shift select change event - data-shift attribute'ünü güncelle (renk için)
            document.getElementById('shiftTable')?.addEventListener('change', (e) => {
                if (e.target.classList.contains('shift-select')) {
                    e.target.setAttribute('data-shift', e.target.value);
                }
            });

            // Appointment filter
            document.getElementById('filterWeek')?.addEventListener('change', () => Appointments.load());

            // Randevu hafta inputuna tıklandığında takvimi aç
            document.getElementById('filterWeek')?.addEventListener('click', function() {
                try {
                    if (this.showPicker) {
                        this.showPicker();
                    }
                } catch (error) {
                    // showPicker desteklenmiyorsa, normal davranışa devam et
                    console.log('showPicker not supported');
                }
            });

            // ==================== WHATSAPP BUSINESS API ====================

            // WhatsApp API durumunu yükle
            async function loadWhatsAppSettings() {
                try {
                    const response = await ApiService.call('getWhatsAppSettings', {});
                    if (response.success) {
                        const statusEl = document.getElementById('whatsappApiStatus');
                        if (response.configured) {
                            statusEl.innerHTML = `
                                <div style="padding: 12px; background: #F0F9F5; border: 1px solid #E8E8E8; border-radius: 2px;">
                                    <div style="font-size: 13px; color: #2E7D32; letter-spacing: 0.5px;">
                                        WhatsApp API Yapılandırıldı
                                    </div>
                                </div>
                            `;
                        } else {
                            statusEl.innerHTML = `
                                <div style="padding: 12px; background: #FFEBEE; border: 1px solid #E8E8E8; border-radius: 2px;">
                                    <div style="font-size: 13px; color: #C62828; letter-spacing: 0.5px;">
                                        WhatsApp API Yapılandırılmamış
                                    </div>
                                </div>
                            `;
                        }
                    }
                } catch (error) {
                    console.error('WhatsApp ayarları yüklenemedi:', error);
                }
            }

            // WhatsApp ayarlarını kaydet
            document.getElementById('saveWhatsAppSettingsBtn')?.addEventListener('click', async () => {
                const phoneNumberId = document.getElementById('whatsappPhoneNumberId').value.trim();
                const accessToken = document.getElementById('whatsappAccessToken').value.trim();

                if (!phoneNumberId || !accessToken) {
                    UI.showAlert('Lütfen tüm alanları doldurun', 'error');
                    return;
                }

                try {
                    const response = await ApiService.call('updateWhatsAppSettings', {
                        settings: JSON.stringify({
                            phoneNumberId: phoneNumberId,
                            accessToken: accessToken
                        })
                    });

                    if (response.success) {
                        UI.showAlert('WhatsApp ayarları kaydedildi', 'success');
                        document.getElementById('whatsappPhoneNumberId').value = '';
                        document.getElementById('whatsappAccessToken').value = '';
                        loadWhatsAppSettings();
                    } else {
                        UI.showAlert('Hata: ' + response.error, 'error');
                    }
                } catch (error) {
                    UI.showAlert('Kaydetme hatası: ' + error.message, 'error');
                }
            });

            // WhatsApp ayarlarını sayfa yüklendiğinde kontrol et
            if (document.getElementById('whatsappApiStatus')) {
                loadWhatsAppSettings();
            }

            // ==================== SLACK WEBHOOK ====================

            // Slack durumunu yükle
            async function loadSlackSettings() {
                try {
                    const response = await ApiService.call('getSlackSettings', {});
                    if (response.success) {
                        const statusEl = document.getElementById('slackStatus');
                        if (response.configured) {
                            statusEl.innerHTML = `
                                <div style="padding: 12px; background: #F0F9F5; border: 1px solid #E8E8E8; border-radius: 2px;">
                                    <div style="font-size: 13px; color: #2E7D32; letter-spacing: 0.5px;">
                                        Slack Webhook Yapılandırıldı
                                    </div>
                                </div>
                            `;
                        } else {
                            statusEl.innerHTML = `
                                <div style="padding: 12px; background: #FFEBEE; border: 1px solid #E8E8E8; border-radius: 2px;">
                                    <div style="font-size: 13px; color: #C62828; letter-spacing: 0.5px;">
                                        Slack Webhook Yapılandırılmamış
                                    </div>
                                </div>
                            `;
                        }
                    }
                } catch (error) {
                    console.error('Slack ayarları yüklenemedi:', error);
                }
            }

            // Slack ayarlarını kaydet
            document.getElementById('saveSlackSettingsBtn')?.addEventListener('click', async () => {
                const webhookUrl = document.getElementById('slackWebhookUrl').value.trim();

                if (!webhookUrl) {
                    UI.showAlert('Lütfen Slack Webhook URL girin', 'error');
                    return;
                }

                if (!webhookUrl.startsWith('https://hooks.slack.com/')) {
                    UI.showAlert('Geçerli bir Slack Webhook URL girin', 'error');
                    return;
                }

                try {
                    const response = await ApiService.call('updateSlackSettings', {
                        webhookUrl: webhookUrl
                    });

                    if (response.success) {
                        UI.showAlert('Slack ayarları kaydedildi', 'success');
                        document.getElementById('slackWebhookUrl').value = '';
                        loadSlackSettings();
                    } else {
                        UI.showAlert('Hata: ' + response.error, 'error');
                    }
                } catch (error) {
                    UI.showAlert('Kaydetme hatası: ' + error.message, 'error');
                }
            });

            // Slack ayarlarını sayfa yüklendiğinde kontrol et
            if (document.getElementById('slackStatus')) {
                loadSlackSettings();
            }

            // ==================== RANDEVU DÜZENLEME MODAL ====================

            // Tarih veya saat değiştiğinde kaydet butonunu kontrol et
            document.getElementById('editAppointmentDate')?.addEventListener('change', () => {
                const date = document.getElementById('editAppointmentDate').value;
                const time = document.getElementById('editAppointmentTime').value;
                document.getElementById('saveEditAppointmentBtn').disabled = !(date && time);
            });

            document.getElementById('editAppointmentTime')?.addEventListener('change', () => {
                const date = document.getElementById('editAppointmentDate').value;
                const time = document.getElementById('editAppointmentTime').value;
                document.getElementById('saveEditAppointmentBtn').disabled = !(date && time);
            });

            // İptal butonu - modal'i kapat
            document.getElementById('cancelEditAppointmentBtn')?.addEventListener('click', () => {
                Appointments.closeEditModal();
            });

            // Kaydet butonu - randevu güncelle
            document.getElementById('saveEditAppointmentBtn')?.addEventListener('click', () => {
                Appointments.saveEditedAppointment();
            });

            // Modal overlay tıklaması - modal'i kapat
            document.getElementById('editAppointmentModal')?.addEventListener('click', (e) => {
                if (e.target.id === 'editAppointmentModal') {
                    Appointments.closeEditModal();
                }
            });

            // ==================== İLGİLİ PERSONEL ATAMA MODAL ====================

            // İptal butonu - modal'i kapat
            document.getElementById('cancelAssignStaffBtn')?.addEventListener('click', () => {
                Appointments.closeAssignStaffModal();
            });

            // Ata butonu - personel atamasını kaydet
            document.getElementById('saveAssignStaffBtn')?.addEventListener('click', () => {
                Appointments.saveAssignedStaff();
            });

            // Modal overlay tıklaması - modal'i kapat
            document.getElementById('assignStaffModal')?.addEventListener('click', (e) => {
                if (e.target.id === 'assignStaffModal') {
                    Appointments.closeAssignStaffModal();
                }
            });

            // Hide loading overlay and show tabs after everything is loaded
            document.getElementById('loadingOverlay').style.display = 'none';
            document.querySelector('.tabs').style.display = 'flex';
            // Settings tab is already active by default (has .active class), CSS will show it
        }

        // Start initialization when DOM is ready
        document.addEventListener('DOMContentLoaded', initAdmin);

        // Responsive: Ekran boyutu değiştiğinde vardiya etiketlerini güncelle
        window.addEventListener('resize', () => {
            if (typeof ShiftManager !== 'undefined' && ShiftManager.updateShiftLabels) {
                ShiftManager.updateShiftLabels();
            }
        });
        //#endregion
