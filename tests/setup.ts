/**
 * VITEST TEST SETUP
 * Global mocks and utilities for DOM-dependent tests
 */

import { vi, beforeEach, afterEach } from 'vitest';

// ==================== GLOBAL MOCKS ====================

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] || null
  };
})();

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] || null
  };
})();

// Setup global window object extensions
beforeEach(() => {
  // Reset storage before each test
  localStorageMock.clear();
  sessionStorageMock.clear();

  // Assign to global
  global.localStorage = localStorageMock as Storage;
  global.sessionStorage = sessionStorageMock as Storage;

  // Mock window.location
  Object.defineProperty(window, 'location', {
    writable: true,
    value: {
      hostname: 'localhost',
      href: 'http://localhost:3000',
      origin: 'http://localhost:3000',
      protocol: 'http:',
      host: 'localhost:3000',
      pathname: '/',
      search: '',
      hash: '',
      reload: vi.fn(),
      replace: vi.fn(),
      assign: vi.fn()
    }
  });

  // Mock window.alert, confirm, prompt
  global.alert = vi.fn();
  global.confirm = vi.fn(() => true);
  global.prompt = vi.fn();

  // Mock console methods (suppress logs in tests)
  global.console = {
    ...console,
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  };

  // Mock performance API
  if (!global.performance) {
    global.performance = {
      now: vi.fn(() => Date.now())
    } as any;
  }
});

afterEach(() => {
  vi.clearAllMocks();
  vi.clearAllTimers();
  vi.useRealTimers();
});

// ==================== TEST UTILITIES ====================

/**
 * Create a mock DOM element with common methods
 */
export function createMockElement(tagName: string = 'div'): HTMLElement {
  const element = document.createElement(tagName);

  // Enhance with commonly mocked methods
  element.scrollIntoView = vi.fn();

  return element;
}

/**
 * Create a mock container with getElementById support
 */
export function createMockContainer(id: string = 'test-container'): HTMLElement {
  const container = createMockElement('div');
  container.id = id;
  document.body.appendChild(container);
  return container;
}

/**
 * Clean up DOM after test
 */
export function cleanupDOM(): void {
  document.body.innerHTML = '';
}

/**
 * Wait for next tick (useful for async DOM updates)
 */
export function nextTick(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Mock fetch API response
 */
export function mockFetchResponse(data: any, ok: boolean = true, status: number = 200) {
  return {
    ok,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
    blob: async () => new Blob([JSON.stringify(data)]),
    arrayBuffer: async () => new ArrayBuffer(0),
    formData: async () => new FormData(),
    headers: new Headers(),
    redirected: false,
    statusText: ok ? 'OK' : 'Error',
    type: 'basic' as ResponseType,
    url: 'http://localhost:3000/test',
    clone: function() { return this; },
    body: null,
    bodyUsed: false
  } as Response;
}

/**
 * Create a Blob URL (for calendar downloads, etc.)
 */
export function mockBlobURL(content: string): string {
  // Simple mock - return a data URL
  return `data:text/plain;base64,${btoa(content)}`;
}

// Mock URL.createObjectURL and revokeObjectURL
if (!global.URL.createObjectURL) {
  global.URL.createObjectURL = vi.fn((_blob: Blob) => {
    return `blob:http://localhost:3000/${Math.random().toString(36).substring(7)}`;
  });
}

if (!global.URL.revokeObjectURL) {
  global.URL.revokeObjectURL = vi.fn();
}

// Export mocks for direct access in tests
export { localStorageMock, sessionStorageMock };
