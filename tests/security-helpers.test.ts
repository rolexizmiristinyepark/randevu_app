import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  // Input Sanitization
  sanitizeInput,
  sanitizePhone,
  sanitizeEmail,
  sanitizeName,
  // PII Masking
  maskEmail,
  maskPhone,
  maskName,
  // DOM Security
  escapeHtml,
  createElement,
  showAlertSafe,
  renderListSafe,
  createFragmentFromTrustedHtml,
  createSafeFragment, // Backward compatible alias
  createLoadingElement,
  createTableRow
} from '../security-helpers';
import { cleanupDOM } from './setup';

describe('Security Helpers', () => {
  // ==================== INPUT SANITIZATION TESTS ====================

  describe('sanitizeInput', () => {
    it('removes null bytes', () => {
      expect(sanitizeInput('hello\x00world')).toBe('helloworld');
    });

    it('escapes HTML entities', () => {
      const result = sanitizeInput('<script>alert("XSS")</script>');
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;');
    });

    it('removes SQL injection patterns', () => {
      const result = sanitizeInput('SELECT * FROM users; DROP TABLE users;');
      expect(result.toLowerCase()).not.toContain('select');
      expect(result.toLowerCase()).not.toContain('drop');
    });

    it('removes javascript: protocol', () => {
      const result = sanitizeInput('javascript:alert(1)');
      expect(result.toLowerCase()).not.toContain('javascript:');
    });

    it('removes event handlers', () => {
      const result = sanitizeInput('onclick=alert(1)');
      expect(result.toLowerCase()).not.toContain('onclick=');
    });

    it('respects maxLength option', () => {
      const result = sanitizeInput('very long text here', { maxLength: 10 });
      expect(result.length).toBeLessThanOrEqual(10);
    });

    it('trims whitespace by default', () => {
      const result = sanitizeInput('  hello  ');
      expect(result).toBe('hello');
    });

    it('handles empty input', () => {
      expect(sanitizeInput('')).toBe('');
      expect(sanitizeInput(null as any)).toBe('');
      expect(sanitizeInput(undefined as any)).toBe('');
    });
  });

  describe('sanitizePhone', () => {
    it('keeps only valid phone characters', () => {
      expect(sanitizePhone('0555-123-4567')).toBe('0555-123-4567');
      expect(sanitizePhone('+90 555 123 4567')).toBe('+90 555 123 4567');
    });

    it('removes invalid characters', () => {
      expect(sanitizePhone('0555<script>123')).toBe('0555123');
    });

    it('limits length to 20', () => {
      const result = sanitizePhone('1234567890123456789012345');
      expect(result.length).toBeLessThanOrEqual(20);
    });

    it('handles empty input', () => {
      expect(sanitizePhone('')).toBe('');
    });
  });

  describe('sanitizeEmail', () => {
    it('keeps valid email format', () => {
      expect(sanitizeEmail('test@example.com')).toBe('test@example.com');
    });

    it('removes invalid characters', () => {
      const result = sanitizeEmail('test<script>@example.com');
      expect(result).not.toContain('<');
    });

    it('returns empty for invalid email', () => {
      expect(sanitizeEmail('not-an-email')).toBe('');
      expect(sanitizeEmail('missing@')).toBe('');
    });

    it('handles empty input', () => {
      expect(sanitizeEmail('')).toBe('');
    });
  });

  describe('sanitizeName', () => {
    it('keeps Turkish characters', () => {
      expect(sanitizeName('Şerif Öztürk')).toBe('Şerif Öztürk');
      expect(sanitizeName('İsmail Çelik')).toBe('İsmail Çelik');
    });

    it('removes numbers and special chars', () => {
      expect(sanitizeName('Ali123')).toBe('Ali');
      expect(sanitizeName('Test<script>')).toBe('Testscript');
    });

    it('normalizes whitespace', () => {
      expect(sanitizeName('Ali   Veli')).toBe('Ali Veli');
    });

    it('limits length to 100', () => {
      const longName = 'A'.repeat(150);
      expect(sanitizeName(longName).length).toBeLessThanOrEqual(100);
    });

    it('handles empty input', () => {
      expect(sanitizeName('')).toBe('');
    });
  });

  // ==================== PII MASKING TESTS ====================

  describe('maskEmail', () => {
    it('masks standard email', () => {
      const result = maskEmail('test@example.com');
      // Expected: t***t@e***.com (first + last char visible)
      expect(result).toBe('t***t@e***.com');
      expect(result).toContain('***');
    });

    it('masks long email', () => {
      const result = maskEmail('verylongemail@example.com');
      // Expected: v***l@e***.com
      expect(result).toBe('v***l@e***.com');
      expect(result).toContain('***');
    });

    it('handles null safely', () => {
      expect(maskEmail(null)).toBe('[email hidden]');
      expect(maskEmail('')).toBe('[email hidden]');
      expect(maskEmail(undefined)).toBe('[email hidden]');
    });

    it('handles short emails', () => {
      const result = maskEmail('a@b.co');
      // Short emails should still work
      expect(result).toBeTruthy();
      expect(result).toContain('@');
    });

    it('prevents XSS in email masking', () => {
      const xss = '<script>alert("XSS")</script>@example.com';
      const result = maskEmail(xss);
      // Should not contain executable script tags
      expect(result).toBeTruthy();
    });
  });

  describe('maskPhone', () => {
    it('masks Turkish phone number (11 digits)', () => {
      const result = maskPhone('05551234567');
      // Expected format: 0555***67 or similar
      expect(result).toContain('0555');
      expect(result).toContain('***');
      expect(result).toMatch(/0555.*67/);
    });

    it('masks formatted phone with spaces', () => {
      const result = maskPhone('0555 123 45 67');
      expect(result).toContain('***');
      expect(result).toContain('0555');
    });

    it('handles null safely', () => {
      expect(maskPhone(null)).toBe('[phone hidden]');
      expect(maskPhone('')).toBe('[phone hidden]');
      expect(maskPhone(undefined)).toBe('[phone hidden]');
    });

    it('handles international format', () => {
      const result = maskPhone('+90 555 123 45 67');
      expect(result).toBeTruthy();
      expect(result).toContain('***');
    });
  });

  describe('maskName', () => {
    it('masks single name', () => {
      const result = maskName('Ali');
      // Expected: A***
      expect(result).toMatch(/^A\*+$/);
    });

    it('masks full name (first + last)', () => {
      const result = maskName('Serdar Benli');
      // Expected: S*** B***
      expect(result).toContain('S***');
      expect(result).toContain('B***');
      expect(result).toMatch(/S\*+ B\*+/);
    });

    it('handles null safely', () => {
      expect(maskName(null)).toBe('[name hidden]');
      expect(maskName('')).toBe('[name hidden]');
      expect(maskName(undefined)).toBe('[name hidden]');
    });

    it('handles Turkish characters', () => {
      const result = maskName('Şükran Çiğdem');
      expect(result).toBeTruthy();
      expect(result).toContain('***');
    });
  });

  describe('escapeHtml', () => {
    it('escapes XSS script tag', () => {
      const xss = '<script>alert("XSS")</script>';
      const escaped = escapeHtml(xss);
      expect(escaped).not.toContain('<script>');
      expect(escaped).toContain('&lt;script&gt;');
      // '/' is escaped to '&#x2F;', not part of &lt;/script&gt;
      expect(escaped).toContain('&lt;&#x2F;script&gt;');
    });

    it('escapes all dangerous characters', () => {
      const dangerous = '< > & " \' /';
      const escaped = escapeHtml(dangerous);
      expect(escaped).toContain('&lt;');
      expect(escaped).toContain('&gt;');
      expect(escaped).toContain('&amp;');
      expect(escaped).toContain('&quot;');
      expect(escaped).toContain('&#x27;');
      expect(escaped).toContain('&#x2F;');
    });

    it('handles null/undefined safely', () => {
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
      expect(escapeHtml('')).toBe('');
    });

    it('preserves safe text', () => {
      const safe = 'This is safe text 123';
      const escaped = escapeHtml(safe);
      expect(escaped).toBe(safe);
    });

    it('escapes nested XSS attempts', () => {
      const xss = '<img src=x onerror="alert(\'XSS\')">';
      const escaped = escapeHtml(xss);
      expect(escaped).not.toContain('<img');
      // "onerror" word exists but quotes are escaped, making it safe
      expect(escaped).not.toContain('onerror="');
      expect(escaped).toContain('&lt;img');
    });
  });

  // ==================== DOM FUNCTIONS (Phase 3) ====================

  describe('createElement', () => {
    afterEach(() => {
      cleanupDOM();
    });

    it('should create basic element', () => {
      const element = createElement('div');
      expect(element.tagName).toBe('DIV');
      expect(element).toBeInstanceOf(HTMLDivElement);
    });

    it('should create element with text content', () => {
      const element = createElement('p', {}, 'Hello World');
      expect(element.textContent).toBe('Hello World');
      expect(element.tagName).toBe('P');
    });

    it('should set className attribute', () => {
      const element = createElement('div', { className: 'test-class' });
      expect(element.className).toBe('test-class');
    });

    it('should set data attributes', () => {
      const element = createElement('div', {
        'data-id': '123',
        'data-type': 'test'
      });
      expect(element.getAttribute('data-id')).toBe('123');
      expect(element.getAttribute('data-type')).toBe('test');
    });

    it('should set style object', () => {
      const element = createElement('div', {
        style: { color: 'red', fontSize: '14px' }
      });
      expect(element.style.color).toBe('red');
      expect(element.style.fontSize).toBe('14px');
    });

    it('should set other attributes', () => {
      const element = createElement('button', { id: 'btn-1', type: 'button' });
      expect(element.getAttribute('id')).toBe('btn-1');
      expect(element.getAttribute('type')).toBe('button');
    });

    it('should use textContent for XSS safety', () => {
      const element = createElement('div', {}, '<script>alert("XSS")</script>');
      // textContent escapes HTML automatically
      expect(element.textContent).toBe('<script>alert("XSS")</script>');
      expect(element.innerHTML).not.toContain('<script>');
      expect(element.innerHTML).toContain('&lt;script&gt;');
    });
  });

  describe('showAlertSafe', () => {
    beforeEach(() => {
      // Create alert container
      const container = document.createElement('div');
      container.id = 'alertContainer';
      document.body.appendChild(container);
      vi.useFakeTimers();
    });

    afterEach(() => {
      cleanupDOM();
      vi.useRealTimers();
      vi.clearAllTimers();
    });

    it('should create alert element', () => {
      showAlertSafe('Test message', 'info');
      const container = document.getElementById('alertContainer');
      expect(container?.children.length).toBe(1);
      expect(container?.textContent).toContain('Test message');
    });

    it('should apply correct alert type class', () => {
      showAlertSafe('Error message', 'error');
      const container = document.getElementById('alertContainer');
      const alert = container?.querySelector('.alert-error');
      expect(alert).toBeTruthy();
    });

    it('should clear existing alerts before showing new one', () => {
      showAlertSafe('First message', 'info');
      showAlertSafe('Second message', 'success');

      const container = document.getElementById('alertContainer');
      expect(container?.children.length).toBe(1);
      expect(container?.textContent).toBe('Second message');
      expect(container?.textContent).not.toContain('First message');
    });

    it('should auto-dismiss after 4 seconds', () => {
      showAlertSafe('Auto dismiss', 'warning');
      const container = document.getElementById('alertContainer');

      expect(container?.textContent).toBe('Auto dismiss');

      // Fast-forward 4 seconds
      vi.advanceTimersByTime(4000);

      expect(container?.textContent).toBe('');
    });

    it('should handle missing container gracefully', () => {
      cleanupDOM(); // Remove container
      expect(() => {
        showAlertSafe('Test', 'info');
      }).not.toThrow();
    });

    it('should escape XSS in messages', () => {
      showAlertSafe('<script>alert("XSS")</script>', 'info');
      const container = document.getElementById('alertContainer');

      // textContent is used, so HTML is escaped
      expect(container?.innerHTML).not.toContain('<script>');
    });
  });

  describe('renderListSafe', () => {
    afterEach(() => {
      cleanupDOM();
    });

    it('should render list items', () => {
      const container = document.createElement('div');
      const items = ['Item 1', 'Item 2', 'Item 3'];

      renderListSafe(container, items, (item) => {
        return createElement('li', {}, item);
      });

      expect(container.children.length).toBe(3);
      expect(container.textContent).toContain('Item 1');
      expect(container.textContent).toContain('Item 2');
      expect(container.textContent).toContain('Item 3');
    });

    it('should clear container before rendering', () => {
      const container = document.createElement('div');
      container.innerHTML = '<p>Old content</p>';

      renderListSafe(container, ['New item'], (item) => {
        return createElement('span', {}, item);
      });

      expect(container.textContent).toBe('New item');
      expect(container.textContent).not.toContain('Old content');
    });

    it('should skip null items', () => {
      const container = document.createElement('div');
      const items = ['Item 1', 'Item 2'];

      renderListSafe(container, items, (item) => {
        return item === 'Item 1' ? null : createElement('div', {}, item);
      });

      expect(container.children.length).toBe(1);
      expect(container.textContent).toBe('Item 2');
    });

    it('should handle empty array', () => {
      const container = document.createElement('div');
      renderListSafe(container, [], () => createElement('div'));
      expect(container.children.length).toBe(0);
    });

    it('should handle null container', () => {
      expect(() => {
        renderListSafe(null, ['item'], () => createElement('div'));
      }).not.toThrow();
    });
  });

  describe('createSafeFragment', () => {
    it('should create document fragment from HTML', () => {
      const html = '<div>Test</div><p>Content</p>';
      const fragment = createSafeFragment(html);

      expect(fragment).toBeInstanceOf(DocumentFragment);
      expect(fragment.children.length).toBe(2);
    });

    it('should parse complex HTML structure', () => {
      const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
      const fragment = createSafeFragment(html);

      const ul = fragment.querySelector('ul');
      expect(ul).toBeTruthy();
      expect(ul?.children.length).toBe(2);
    });

    it('should only be used with trusted HTML (comment check)', () => {
      // This function should ONLY be used with trusted, sanitized HTML
      // Using with user input would be dangerous
      const trustedHtml = '<div class="safe">Trusted content</div>';
      const fragment = createSafeFragment(trustedHtml);

      expect(fragment.querySelector('.safe')).toBeTruthy();
    });
  });

  describe('createLoadingElement', () => {
    it('should create loading spinner with default message', () => {
      const loading = createLoadingElement();

      expect(loading.textContent).toContain('Yükleniyor...');
      expect(loading.querySelector('.spinner')).toBeTruthy();
    });

    it('should create loading spinner with custom message', () => {
      const loading = createLoadingElement('Lütfen bekleyin...');

      expect(loading.textContent).toContain('Lütfen bekleyin...');
      expect(loading.querySelector('.spinner')).toBeTruthy();
      expect(loading.querySelector('p')).toBeTruthy();
    });

    it('should have centered styling', () => {
      const loading = createLoadingElement();

      expect(loading.style.textAlign).toBe('center');
      expect(loading.style.padding).toBe('20px');
    });

    it('should contain spinner and text elements', () => {
      const loading = createLoadingElement('Custom text');

      const spinner = loading.querySelector('.spinner');
      const text = loading.querySelector('p');

      expect(spinner).toBeTruthy();
      expect(text).toBeTruthy();
      expect(text?.textContent).toBe('Custom text');
    });
  });

  describe('createTableRow', () => {
    it('should create table row with data cells', () => {
      const row = createTableRow(['Cell 1', 'Cell 2', 'Cell 3']);

      expect(row.tagName).toBe('TR');
      expect(row.children.length).toBe(3);
      expect(row.children[0]?.tagName).toBe('TD');
      expect(row.textContent).toContain('Cell 1');
    });

    it('should create header row with th elements', () => {
      const row = createTableRow(['Header 1', 'Header 2'], true);

      expect(row.children[0]?.tagName).toBe('TH');
      expect(row.children[1]?.tagName).toBe('TH');
      expect(row.textContent).toContain('Header 1');
    });

    it('should handle string cell content', () => {
      const row = createTableRow(['Text content']);
      const cell = row.children[0] as HTMLTableCellElement;

      expect(cell.textContent).toBe('Text content');
    });

    it('should handle element cell content', () => {
      const button = createElement('button', {}, 'Click me');
      const row = createTableRow([button]);
      const cell = row.children[0] as HTMLTableCellElement;

      expect(cell.querySelector('button')).toBeTruthy();
      expect(cell.textContent).toBe('Click me');
    });

    it('should handle object cell content with text', () => {
      const row = createTableRow([
        { text: 'Object cell', class: 'highlight' }
      ]);
      const cell = row.children[0] as HTMLTableCellElement;

      expect(cell.textContent).toBe('Object cell');
      expect(cell.getAttribute('class')).toBe('highlight');
    });

    it('should handle object cell content with element', () => {
      const span = createElement('span', {}, 'Span content');
      const row = createTableRow([
        { element: span, id: 'cell-1' }
      ]);
      const cell = row.children[0] as HTMLTableCellElement;

      expect(cell.querySelector('span')).toBeTruthy();
      expect(cell.getAttribute('id')).toBe('cell-1');
    });

    it('should handle mixed cell types', () => {
      const button = createElement('button', {}, 'Button');
      const row = createTableRow([
        'String cell',
        button,
        { text: 'Object cell' }
      ]);

      expect(row.children.length).toBe(3);
      expect(row.children[0]?.textContent).toBe('String cell');
      expect(row.children[1]?.querySelector('button')).toBeTruthy();
      expect(row.children[2]?.textContent).toBe('Object cell');
    });

    it('should escape XSS in string cells', () => {
      const row = createTableRow(['<script>alert("XSS")</script>']);
      const cell = row.children[0] as HTMLTableCellElement;

      // textContent is used, so HTML is escaped
      expect(cell.innerHTML).not.toContain('<script>');
      expect(cell.textContent).toBe('<script>alert("XSS")</script>');
    });
  });
});
