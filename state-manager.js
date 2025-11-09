/**
 * MINIMAL STATE MANAGER
 *
 * Hafif state yönetimi + observer pattern
 * Global state kirliliğini önler
 * Debug ve test edilebilirliği artırır
 */

class StateManager {
    constructor(initialState = {}) {
        this._state = { ...initialState };
        this._listeners = new Map(); // key -> Set of callbacks
        this._history = []; // State geçmişi (debug için)
        this._maxHistory = 10;
    }

    /**
     * State'in tamamını döndürür (read-only)
     */
    getState() {
        return { ...this._state };
    }

    /**
     * Belirli bir key'in değerini döndürür
     */
    get(key) {
        return this._state[key];
    }

    /**
     * State güncelleme (immutable)
     * @param {string|object} keyOrUpdates - Key adı veya updates objesi
     * @param {*} value - Değer (eğer keyOrUpdates string ise)
     */
    set(keyOrUpdates, value) {
        const updates = typeof keyOrUpdates === 'string'
            ? { [keyOrUpdates]: value }
            : keyOrUpdates;

        const oldState = { ...this._state };

        // State'i güncelle
        Object.entries(updates).forEach(([key, val]) => {
            this._state[key] = val;
        });

        // History'e ekle (debug için)
        this._history.push({
            timestamp: Date.now(),
            updates,
            oldValues: Object.keys(updates).reduce((acc, key) => {
                acc[key] = oldState[key];
                return acc;
            }, {})
        });

        // Max history sınırı
        if (this._history.length > this._maxHistory) {
            this._history.shift();
        }

        // Listeners'ı bilgilendir
        Object.keys(updates).forEach(key => {
            this._notify(key, this._state[key], oldState[key]);
        });
    }

    /**
     * State değişikliklerini dinle
     * @param {string} key - Dinlenecek state key'i
     * @param {function} callback - (newValue, oldValue) => void
     * @returns {function} Unsubscribe fonksiyonu
     */
    subscribe(key, callback) {
        if (!this._listeners.has(key)) {
            this._listeners.set(key, new Set());
        }

        this._listeners.get(key).add(callback);

        // Unsubscribe fonksiyonu döndür
        return () => {
            const listeners = this._listeners.get(key);
            if (listeners) {
                listeners.delete(callback);
            }
        };
    }

    /**
     * Listener'ları bilgilendir
     */
    _notify(key, newValue, oldValue) {
        const listeners = this._listeners.get(key);
        if (listeners && listeners.size > 0) {
            listeners.forEach(callback => {
                try {
                    callback(newValue, oldValue);
                } catch (error) {
                    console.error(`State listener error for key "${key}":`, error);
                }
            });
        }
    }

    /**
     * State'i tamamen sıfırla
     */
    reset(newState = {}) {
        const oldState = { ...this._state };
        this._state = { ...newState };
        this._history = [];

        // Tüm değişiklikleri bildir
        const allKeys = new Set([
            ...Object.keys(oldState),
            ...Object.keys(newState)
        ]);

        allKeys.forEach(key => {
            this._notify(key, this._state[key], oldState[key]);
        });
    }

    /**
     * State geçmişini döndür (debug için)
     */
    getHistory() {
        return [...this._history];
    }

    /**
     * State değişikliklerini logla (debug mode)
     */
    enableDebugMode() {
        this._debugMode = true;

        // Tüm state değişikliklerini logla
        const allKeys = Object.keys(this._state);
        allKeys.forEach(key => {
            this.subscribe(key, (newVal, oldVal) => {
                console.log(`[StateManager] ${key}:`, {
                    old: oldVal,
                    new: newVal,
                    timestamp: new Date().toISOString()
                });
            });
        });
    }

    /**
     * State snapshot al (testing için)
     */
    snapshot() {
        return {
            state: { ...this._state },
            history: [...this._history],
            timestamp: Date.now()
        };
    }

    /**
     * Snapshot'tan restore et
     */
    restore(snapshot) {
        if (!snapshot || !snapshot.state) {
            throw new Error('Invalid snapshot');
        }

        this._state = { ...snapshot.state };
        this._history = snapshot.history ? [...snapshot.history] : [];
    }
}

// Export
export { StateManager };

// Global instance oluştur (backward compatibility)
if (typeof window !== 'undefined') {
    window.StateManager = StateManager;
}
