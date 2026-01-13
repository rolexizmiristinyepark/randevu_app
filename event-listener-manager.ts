/**
 * EventListenerManager.ts
 *
 * Centralized event listener management to prevent memory leaks.
 * Tracks all registered listeners and provides cleanup functionality.
 */

type EventHandler = EventListenerOrEventListenerObject;

interface RegisteredListener {
    target: EventTarget;
    type: string;
    handler: EventHandler;
    options?: boolean | AddEventListenerOptions;
}

/**
 * Manages event listeners with automatic tracking and cleanup.
 * Use this to prevent memory leaks from orphaned event listeners.
 *
 * @example
 * ```ts
 * const manager = new EventListenerManager();
 *
 * // Add listeners (automatically tracked)
 * manager.add(button, 'click', handleClick);
 * manager.add(window, 'resize', handleResize);
 *
 * // Clean up all listeners when done
 * manager.cleanup();
 * ```
 */
export class EventListenerManager {
    private listeners: RegisteredListener[] = [];
    private isCleanedUp = false;

    /**
     * Add an event listener and track it for later cleanup.
     * @param target - The event target (element, window, document, etc.)
     * @param type - Event type (e.g., 'click', 'resize')
     * @param handler - Event handler function
     * @param options - Optional event listener options
     */
    add(
        target: EventTarget,
        type: string,
        handler: EventHandler,
        options?: boolean | AddEventListenerOptions
    ): void {
        if (this.isCleanedUp) {
            console.warn('[EventListenerManager] Cannot add listener after cleanup');
            return;
        }

        target.addEventListener(type, handler, options);
        this.listeners.push({ target, type, handler, options });
    }

    /**
     * Remove a specific event listener.
     * @param target - The event target
     * @param type - Event type
     * @param handler - The exact handler function used when adding
     */
    remove(target: EventTarget, type: string, handler: EventHandler): void {
        const index = this.listeners.findIndex(
            l => l.target === target && l.type === type && l.handler === handler
        );

        if (index !== -1) {
            const listener = this.listeners[index];
            listener.target.removeEventListener(listener.type, listener.handler, listener.options);
            this.listeners.splice(index, 1);
        }
    }

    /**
     * Remove all tracked event listeners.
     * Call this when component is unmounted or page is changing.
     */
    cleanup(): void {
        if (this.isCleanedUp) {
            return;
        }

        for (const listener of this.listeners) {
            try {
                listener.target.removeEventListener(
                    listener.type,
                    listener.handler,
                    listener.options
                );
            } catch (e) {
                // Target might already be removed from DOM
            }
        }

        this.listeners = [];
        this.isCleanedUp = true;
    }

    /**
     * Get the count of currently tracked listeners.
     */
    get count(): number {
        return this.listeners.length;
    }

    /**
     * Check if the manager has been cleaned up.
     */
    get cleaned(): boolean {
        return this.isCleanedUp;
    }
}

/**
 * Global event listener manager for app-wide cleanup.
 * Use this for listeners that should persist across component lifecycles
 * but need cleanup on page unload.
 */
class GlobalEventListenerManager extends EventListenerManager {
    private static instance: GlobalEventListenerManager | null = null;

    private constructor() {
        super();
        // Auto-cleanup on page unload
        if (typeof window !== 'undefined') {
            window.addEventListener('beforeunload', () => this.cleanup());
        }
    }

    static getInstance(): GlobalEventListenerManager {
        if (!GlobalEventListenerManager.instance) {
            GlobalEventListenerManager.instance = new GlobalEventListenerManager();
        }
        return GlobalEventListenerManager.instance;
    }

    // Prevent accidental resets
    cleanup(): void {
        // Only cleanup if explicitly called, not on instance destruction
        super.cleanup();
        GlobalEventListenerManager.instance = null;
    }
}

// Singleton export
export const globalEventManager = typeof window !== 'undefined'
    ? GlobalEventListenerManager.getInstance()
    : null;

// Export class for component-level managers
export default EventListenerManager;

// Window export for global access
if (typeof window !== 'undefined') {
    (window as any).EventListenerManager = EventListenerManager;
    (window as any).globalEventManager = globalEventManager;
}
