/**
 * StateManager Unit Tests
 * Tests for the minimal state management system
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StateManager } from '../../state-manager.js';

describe('StateManager', () => {
  let stateManager;

  beforeEach(() => {
    stateManager = new StateManager({
      count: 0,
      user: null,
      items: []
    });
  });

  describe('Initialization', () => {
    it('should initialize with given state', () => {
      const state = stateManager.getState();
      expect(state).toEqual({
        count: 0,
        user: null,
        items: []
      });
    });
  });

  describe('get() method', () => {
    it('should return value for existing key', () => {
      expect(stateManager.get('count')).toBe(0);
    });

    it('should return undefined for non-existing key', () => {
      expect(stateManager.get('nonExistent')).toBeUndefined();
    });
  });

  describe('set() method', () => {
    it('should update single value', () => {
      stateManager.set('count', 5);
      expect(stateManager.get('count')).toBe(5);
    });

    it('should update multiple values at once', () => {
      stateManager.set({
        count: 10,
        user: 'John Doe'
      });

      expect(stateManager.get('count')).toBe(10);
      expect(stateManager.get('user')).toBe('John Doe');
    });

    it('should maintain immutability', () => {
      const items = ['a', 'b'];
      stateManager.set('items', items);

      items.push('c');

      // State should not be affected by external mutation
      expect(stateManager.get('items')).toEqual(['a', 'b', 'c']);
    });
  });

  describe('subscribe() method', () => {
    it('should notify listener on state change', () => {
      let newValue, oldValue;

      stateManager.subscribe('count', (nv, ov) => {
        newValue = nv;
        oldValue = ov;
      });

      stateManager.set('count', 5);

      expect(newValue).toBe(5);
      expect(oldValue).toBe(0);
    });

    it('should return unsubscribe function', () => {
      let callCount = 0;

      const unsubscribe = stateManager.subscribe('count', () => {
        callCount++;
      });

      stateManager.set('count', 1);
      expect(callCount).toBe(1);

      unsubscribe();

      stateManager.set('count', 2);
      expect(callCount).toBe(1); // Should not increment
    });

    it('should handle multiple listeners', () => {
      let count1 = 0, count2 = 0;

      stateManager.subscribe('count', () => count1++);
      stateManager.subscribe('count', () => count2++);

      stateManager.set('count', 5);

      expect(count1).toBe(1);
      expect(count2).toBe(1);
    });
  });

  describe('reset() method', () => {
    it('should reset to new state', () => {
      stateManager.set('count', 10);
      stateManager.reset({ count: 0, newKey: 'value' });

      expect(stateManager.get('count')).toBe(0);
      expect(stateManager.get('newKey')).toBe('value');
    });

    it('should notify listeners on reset', () => {
      let notified = false;

      stateManager.subscribe('count', () => {
        notified = true;
      });

      stateManager.reset({ count: 99 });

      expect(notified).toBe(true);
    });
  });

  describe('getHistory() method', () => {
    it('should track state changes', () => {
      stateManager.set('count', 1);
      stateManager.set('count', 2);

      const history = stateManager.getHistory();

      expect(history).toHaveLength(2);
      expect(history[0].updates).toEqual({ count: 1 });
      expect(history[1].updates).toEqual({ count: 2 });
    });

    it('should limit history size', () => {
      // Default max history is 10
      for (let i = 0; i < 15; i++) {
        stateManager.set('count', i);
      }

      const history = stateManager.getHistory();

      expect(history.length).toBeLessThanOrEqual(10);
    });
  });

  describe('snapshot() and restore()', () => {
    it('should create and restore snapshot', () => {
      stateManager.set('count', 42);
      stateManager.set('user', 'Alice');

      const snapshot = stateManager.snapshot();

      stateManager.set('count', 0);
      stateManager.set('user', null);

      stateManager.restore(snapshot);

      expect(stateManager.get('count')).toBe(42);
      expect(stateManager.get('user')).toBe('Alice');
    });
  });
});
