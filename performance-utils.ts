/**
 * performance-utils.ts
 *
 * Performance optimization utilities
 * - Debouncing: Delays execution until after user stops action
 * - Throttling: Limits execution frequency
 * - Memoization: Caches function results
 */

// ==================== DEBOUNCE ====================

/**
 * Debounce function - delays execution until after wait period of inactivity
 * Use for: search inputs, resize handlers, API calls from rapid user actions
 *
 * @param func - Function to debounce
 * @param wait - Wait time in milliseconds (default 300ms)
 * @returns Debounced function
 *
 * @example
 * const debouncedSearch = debounce((query: string) => apiCall('search', {query}), 300);
 * input.addEventListener('input', (e) => debouncedSearch(e.target.value));
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number = 300
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return function debounced(...args: Parameters<T>): void {
        // Clear previous timeout
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
        }

        // Set new timeout
        timeoutId = setTimeout(() => {
            func(...args);
            timeoutId = null;
        }, wait);
    };
}

// ==================== THROTTLE ====================

/**
 * Throttle function - ensures function is called at most once per interval
 * Use for: scroll handlers, resize handlers, mouse move tracking
 *
 * @param func - Function to throttle
 * @param limit - Minimum time between calls in milliseconds (default 100ms)
 * @returns Throttled function
 *
 * @example
 * const throttledScroll = throttle(() => updateScrollPosition(), 100);
 * window.addEventListener('scroll', throttledScroll);
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number = 100
): (...args: Parameters<T>) => void {
    let inThrottle: boolean = false;
    // @ts-ignore - Result stored but not returned (throttle pattern)
    let _lastResult: ReturnType<T>;

    return function throttled(...args: Parameters<T>): void {
        if (!inThrottle) {
            _lastResult = func(...args);
            inThrottle = true;

            setTimeout(() => {
                inThrottle = false;
            }, limit);
        }
    };
}

// ==================== MEMOIZATION ====================

/**
 * Memoize function - caches function results based on arguments
 * Use for: expensive calculations, repeated API calls with same params
 *
 * @param func - Function to memoize
 * @param keyGenerator - Optional custom key generator (default: JSON.stringify)
 * @returns Memoized function with cache
 *
 * @example
 * const memoizedCheck = memoize((date: string) => checkDayAvailability(date));
 * const result1 = memoizedCheck('2025-01-15'); // Calls function
 * const result2 = memoizedCheck('2025-01-15'); // Returns cached result
 */
export function memoize<T extends (...args: any[]) => any>(
    func: T,
    keyGenerator?: (...args: Parameters<T>) => string
): T & { cache: Map<string, ReturnType<T>>; clearCache: () => void } {
    const cache = new Map<string, ReturnType<T>>();

    const memoized = function(...args: Parameters<T>): ReturnType<T> {
        // Generate cache key
        const key = keyGenerator
            ? keyGenerator(...args)
            : JSON.stringify(args);

        // Return cached result if exists
        if (cache.has(key)) {
            return cache.get(key)!;
        }

        // Calculate and cache result
        const result = func(...args);
        cache.set(key, result);
        return result;
    } as T & { cache: Map<string, ReturnType<T>>; clearCache: () => void };

    // Expose cache for debugging and manual clearing
    memoized.cache = cache;
    memoized.clearCache = () => cache.clear();

    return memoized;
}

/**
 * Memoize with TTL - caches results with expiration time
 * Use for: API responses, data that changes over time
 *
 * @param func - Function to memoize
 * @param ttl - Time to live in milliseconds (default 5 minutes)
 * @param keyGenerator - Optional custom key generator
 * @returns Memoized function with TTL
 *
 * @example
 * const memoizedAPI = memoizeWithTTL(
 *   (endpoint: string) => apiCall(endpoint),
 *   5 * 60 * 1000 // 5 minutes
 * );
 */
export function memoizeWithTTL<T extends (...args: any[]) => any>(
    func: T,
    ttl: number = 5 * 60 * 1000, // Default 5 minutes
    keyGenerator?: (...args: Parameters<T>) => string
): T & { cache: Map<string, { value: ReturnType<T>; expiry: number }>; clearCache: () => void } {
    const cache = new Map<string, { value: ReturnType<T>; expiry: number }>();

    const memoized = function(...args: Parameters<T>): ReturnType<T> {
        // Generate cache key
        const key = keyGenerator
            ? keyGenerator(...args)
            : JSON.stringify(args);

        // Check if cached and not expired
        const cached = cache.get(key);
        if (cached && Date.now() < cached.expiry) {
            return cached.value;
        }

        // Calculate and cache result with expiry
        const result = func(...args);
        cache.set(key, {
            value: result,
            expiry: Date.now() + ttl
        });

        return result;
    } as T & { cache: Map<string, { value: ReturnType<T>; expiry: number }>; clearCache: () => void };

    // Expose cache for debugging
    memoized.cache = cache;
    memoized.clearCache = () => cache.clear();

    return memoized;
}

// ==================== REQUEST DEDUPLICATION ====================

/**
 * Deduplicate async requests - prevents duplicate simultaneous requests
 * Use for: API calls that might be triggered multiple times
 *
 * @param func - Async function to deduplicate
 * @param keyGenerator - Optional custom key generator
 * @returns Deduplicated async function
 *
 * @example
 * const deduped = deduplicateRequests(
 *   async (endpoint: string) => fetch(endpoint).then(r => r.json())
 * );
 *
 * // Both calls will share the same promise
 * const promise1 = deduped('/api/data');
 * const promise2 = deduped('/api/data');
 * // Only 1 actual fetch is made
 */
export function deduplicateRequests<T extends (...args: any[]) => Promise<any>>(
    func: T,
    keyGenerator?: (...args: Parameters<T>) => string
): T & { pendingRequests: Map<string, Promise<any>>; clearPending: () => void } {
    const pendingRequests = new Map<string, Promise<any>>();

    const deduplicated = async function(...args: Parameters<T>): Promise<ReturnType<T>> {
        // Generate request key
        const key = keyGenerator
            ? keyGenerator(...args)
            : JSON.stringify(args);

        // Return existing promise if request is pending
        if (pendingRequests.has(key)) {
            return pendingRequests.get(key)!;
        }

        // Create new promise
        const promise = func(...args)
            .finally(() => {
                // Remove from pending after completion
                pendingRequests.delete(key);
            });

        pendingRequests.set(key, promise);
        return promise;
    } as T & { pendingRequests: Map<string, Promise<any>>; clearPending: () => void };

    // Expose pending requests for debugging
    deduplicated.pendingRequests = pendingRequests;
    deduplicated.clearPending = () => pendingRequests.clear();

    return deduplicated;
}

// ==================== BATCH OPERATIONS ====================

/**
 * Batch function calls - collects calls and executes them in a single batch
 * Use for: DOM updates, API requests that can be batched
 *
 * @param batchFn - Function that processes a batch of arguments
 * @param delay - Delay before processing batch (default 0 = next tick)
 * @returns Batched function
 *
 * @example
 * const batchedUpdate = batch(
 *   (ids: number[]) => apiCall('updateMultiple', { ids }),
 *   100
 * );
 *
 * batchedUpdate(1); // Queued
 * batchedUpdate(2); // Queued
 * batchedUpdate(3); // Queued
 * // After 100ms: single call with [1, 2, 3]
 */
export function batch<T>(
    batchFn: (items: T[]) => void,
    delay: number = 0
): (item: T) => void {
    let items: T[] = [];
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return function batched(item: T): void {
        items.push(item);

        if (timeoutId !== null) {
            clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
            batchFn(items);
            items = [];
            timeoutId = null;
        }, delay);
    };
}

// ==================== EXPORTS ====================

export const PerformanceUtils = {
    debounce,
    throttle,
    memoize,
    memoizeWithTTL,
    deduplicateRequests,
    batch,
};

// Export to window for backward compatibility
if (typeof window !== 'undefined') {
    (window as any).PerformanceUtils = PerformanceUtils;
}
