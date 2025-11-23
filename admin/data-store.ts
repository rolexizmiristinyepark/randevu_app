/**
 * DATA STORE - Merkezi Veri Yönetimi
 * Tüm admin modüllerinin paylaştığı veri deposu
 * Dependency Injection pattern ile modüllere inject edilir
 */

import { apiCall } from '../api-service';
import { logError } from '../monitoring';

export interface StaffMember {
    id: number;
    name: string;
    phone: string;
    email: string;
    active: boolean;
}

export interface Settings {
    interval: number;
    maxDaily: number;
}

export interface DataStore {
    staff: StaffMember[];
    shifts: Record<string, any>;
    settings: Settings;
    loadStaff: () => Promise<void>;
    loadShifts: () => Promise<void>;
    loadSettings: () => Promise<void>;
}

/**
 * Initialize and return the centralized data store
 */
export function initDataStore(): DataStore {
    const store: DataStore = {
        staff: [],
        shifts: {},
        settings: { interval: 60, maxDaily: 4 },

        async loadStaff() {
            try {
                const response = await apiCall('getStaff');
                if (response.success) {
                    this.staff = response.data as StaffMember[];
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
        }
    };

    return store;
}
