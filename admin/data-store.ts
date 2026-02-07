/**
 * DATA STORE - Merkezi Veri Yönetimi
 * Tüm admin modüllerinin paylaştığı veri deposu
 * Dependency Injection pattern ile modüllere inject edilir
 */

import { apiCall } from '../api-service';
import { logError } from '../monitoring';

export interface StaffMember {
    id: string;
    personel_id?: string;
    name: string;
    phone: string;
    email: string;
    role: string;
    isAdmin: boolean;
    active: boolean;
}

export interface Settings {
    interval: number;
    maxDaily: number;
}

export interface ProfilAyari {
    code: string;
    idKontrolu: boolean;
    expectedRole?: string;
    sameDayBooking: boolean;
    maxSlotAppointment: number;
    slotGrid: number;
    maxDailyPerStaff: number;
    maxDailyDelivery: number;
    duration: number;
    assignByAdmin: boolean;
    allowedTypes: string[];
    staffFilter: string;
    takvimFiltresi: 'onlytoday' | 'withtoday' | 'withouttoday';
    vardiyaKontrolu: boolean;
}

export type ProfilAyarlari = Record<string, ProfilAyari>;

export interface DataStore {
    staff: StaffMember[];
    shifts: Record<string, any>;
    settings: Settings;
    profilAyarlari: ProfilAyarlari;
    loadStaff: () => Promise<void>;
    loadShifts: () => Promise<void>;
    loadSettings: () => Promise<void>;
    loadProfilAyarlari: () => Promise<void>;
}

/**
 * Initialize and return the centralized data store
 */
export function initDataStore(): DataStore {
    const store: DataStore = {
        staff: [],
        shifts: {},
        settings: { interval: 60, maxDaily: 4 },
        profilAyarlari: {},

        async loadStaff() {
            try {
                const response = await apiCall('getStaff');
                if (response.success && Array.isArray(response.data)) {
                    this.staff = response.data.map((s: any) => ({
                        id: String(s.id),
                        personel_id: s.personel_id || undefined,
                        name: s.name,
                        phone: s.phone || '',
                        email: s.email || '',
                        role: s.role || 'sales',
                        isAdmin: s.is_admin === true || s.isAdmin === true,
                        active: s.active === true,
                    }));
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
                const response = await apiCall('getSettings');
                if (response.success) {
                    this.settings = response.data as Settings;
                }
            } catch (error) {
                console.error('Ayarlar yüklenemedi:', error);
                logError(error, { context: 'loadSettings' });
            }
        },

        async loadProfilAyarlari() {
            try {
                const response = await apiCall('getAllProfilAyarlari');
                if (response.success && response.data) {
                    // Backend profilKodu/profilAdi döner, frontend code alanı bekler
                    const raw = response.data as Record<string, any>;
                    const mapped: ProfilAyarlari = {};
                    for (const [key, p] of Object.entries(raw)) {
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
                    this.profilAyarlari = mapped;
                }
            } catch (error) {
                console.error('Profil ayarları yüklenemedi:', error);
                logError(error, { context: 'loadProfilAyarlari' });
            }
        }
    };

    return store;
}
