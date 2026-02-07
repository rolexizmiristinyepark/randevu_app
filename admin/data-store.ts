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
                    this.profilAyarlari = response.data as ProfilAyarlari;
                }
            } catch (error) {
                console.error('Profil ayarları yüklenemedi:', error);
                logError(error, { context: 'loadProfilAyarlari' });
            }
        }
    };

    return store;
}
