/**
 * MINIMAL STATE MANAGER
 *
 * Hafif state yönetimi + observer pattern
 * Global state kirliliğini önler
 * Debug ve test edilebilirliği artırır
 */

/** Listener callback type */
type StateListener<T> = (newValue: T, oldValue: T | undefined) => void;

/** History entry type */
interface HistoryEntry<S extends Record<string, unknown>> {
    timestamp: number;
    updates: Partial<S>;
    oldValues: Partial<S>;
}

/** Snapshot type */
interface StateSnapshot<S extends Record<string, unknown>> {
    state: S;
    history: HistoryEntry<S>[];
    timestamp: number;
}

/**
 * Type-safe State Manager with observer pattern
 * @template S - State object type
 */
class StateManager<S extends Record<string, unknown>> {
    private _state: S;
    private _listeners: Map<keyof S, Set<StateListener<unknown>>>;
    private _history: HistoryEntry<S>[];
    private _maxHistory: number;
    private _debugMode: boolean;

    constructor(initialState: S = {} as S) {
        this._state = { ...initialState };
        this._listeners = new Map();
        this._history = [];
        this._maxHistory = 10;
        this._debugMode = false;
    }

    /**
     * State'in tamamını döndürür (read-only)
     */
    getState(): Readonly<S> {
        return { ...this._state };
    }

    /**
     * Belirli bir key'in değerini döndürür
     */
    get<K extends keyof S>(key: K): S[K] {
        return this._state[key];
    }

    /**
     * State güncelleme (immutable)
     * @param keyOrUpdates - Key adı veya updates objesi
     * @param value - Değer (eğer keyOrUpdates string ise)
     */
    set<K extends keyof S>(key: K, value: S[K]): void;
    set(updates: Partial<S>): void;
    set<K extends keyof S>(keyOrUpdates: K | Partial<S>, value?: S[K]): void {
        let updates: Partial<S>;

        if (typeof keyOrUpdates === 'string' || typeof keyOrUpdates === 'number' || typeof keyOrUpdates === 'symbol') {
            updates = { [keyOrUpdates]: value } as Partial<S>;
        } else {
            updates = keyOrUpdates as Partial<S>;
        }

        const oldState = { ...this._state };

        // State'i güncelle
        Object.entries(updates).forEach(([key, val]) => {
            this._state[key as keyof S] = val as S[keyof S];
        });

        // History'e ekle (debug için)
        const oldValues: Partial<S> = {};
        for (const key of Object.keys(updates) as (keyof S)[]) {
            oldValues[key] = oldState[key];
        }

        this._history.push({
            timestamp: Date.now(),
            updates,
            oldValues
        });

        // Max history sınırı
        if (this._history.length > this._maxHistory) {
            this._history.shift();
        }

        // Listeners'ı bilgilendir
        for (const key of Object.keys(updates) as (keyof S)[]) {
            this._notify(key, this._state[key], oldState[key]);
        }
    }

    /**
     * State değişikliklerini dinle
     * @param key - Dinlenecek state key'i
     * @param callback - (newValue, oldValue) => void
     * @returns Unsubscribe fonksiyonu
     */
    subscribe<K extends keyof S>(
        key: K,
        callback: StateListener<S[K]>
    ): () => void {
        if (!this._listeners.has(key)) {
            this._listeners.set(key, new Set());
        }

        this._listeners.get(key)!.add(callback as StateListener<unknown>);

        // Unsubscribe fonksiyonu döndür
        return () => {
            const listeners = this._listeners.get(key);
            if (listeners) {
                listeners.delete(callback as StateListener<unknown>);
            }
        };
    }

    /**
     * Listener'ları bilgilendir
     */
    private _notify<K extends keyof S>(
        key: K,
        newValue: S[K],
        oldValue: S[K] | undefined
    ): void {
        const listeners = this._listeners.get(key);
        if (listeners && listeners.size > 0) {
            listeners.forEach((callback) => {
                try {
                    (callback as StateListener<S[K]>)(newValue, oldValue);
                } catch (error) {
                    console.error(`State listener error for key "${String(key)}":`, error);
                }
            });
        }
    }

    /**
     * State'i tamamen sıfırla
     */
    reset(newState: S = {} as S): void {
        const oldState = { ...this._state };
        this._state = { ...newState };
        this._history = [];

        // Tüm değişiklikleri bildir
        const allKeys = new Set([
            ...Object.keys(oldState),
            ...Object.keys(newState)
        ]) as Set<keyof S>;

        allKeys.forEach((key) => {
            this._notify(key, this._state[key], oldState[key]);
        });
    }

    /**
     * State geçmişini döndür (debug için)
     */
    getHistory(): readonly HistoryEntry<S>[] {
        return [...this._history];
    }

    /**
     * State değişikliklerini logla (debug mode)
     */
    enableDebugMode(): void {
        if (this._debugMode) return; // Already enabled

        this._debugMode = true;

        // Tüm state değişikliklerini logla
        const allKeys = Object.keys(this._state) as (keyof S)[];
        allKeys.forEach((key) => {
            this.subscribe(key, (newVal, oldVal) => {
                console.log(`[StateManager] ${String(key)}:`, {
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
    snapshot(): StateSnapshot<S> {
        return {
            state: { ...this._state },
            history: [...this._history],
            timestamp: Date.now()
        };
    }

    /**
     * Snapshot'tan restore et
     */
    restore(snapshot: StateSnapshot<S>): void {
        if (!snapshot || !snapshot.state) {
            throw new Error('Invalid snapshot');
        }

        this._state = { ...snapshot.state };
        this._history = snapshot.history ? [...snapshot.history] : [];
    }
}

// Export types
export type { StateListener, HistoryEntry, StateSnapshot };

// Export class
export { StateManager };

// Global instance oluştur (backward compatibility)
if (typeof window !== 'undefined') {
    (window as unknown as { StateManager: typeof StateManager }).StateManager = StateManager;
}
