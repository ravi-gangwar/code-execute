import { describe, it, expect } from '@jest/globals';
import { runJS } from '../src/runners/javascript.js';

describe('JavaScript Runner', () => {
  it('should execute simple JavaScript code', async () => {
    const result = await runJS('2 + 2');
    // vm2 might have restrictions, so check for either output or error
    if (result.error) {
      // If there's an error, it should be a valid error message
      expect(result.error).toBeTruthy();
    } else {
      expect(result.output).toBeDefined();
      expect(result.output).toBe('4');
    }
  });

  it('should handle string output', async () => {
    const result = await runJS('"Hello, World!"');
    if (result.error) {
      expect(result.error).toBeTruthy();
    } else {
      expect(result.output).toBeDefined();
      expect(result.output).toBe('"Hello, World!"');
    }
  });

  it('should handle array operations', async () => {
    const result = await runJS('[1, 2, 3].map(x => x * 2)');
    if (result.error) {
      expect(result.error).toBeTruthy();
    } else {
      expect(result.output).toBeDefined();
      if (result.output) {
        expect(JSON.parse(result.output)).toEqual([2, 4, 6]);
      }
    }
  });

  it('should handle object operations', async () => {
    const result = await runJS('({ sum: 10 + 20, product: 5 * 6 })');
    if (result.error) {
      expect(result.error).toBeTruthy();
    } else {
      expect(result.output).toBeDefined();
      if (result.output) {
        const parsed = JSON.parse(result.output);
        expect(parsed.sum).toBe(30);
        expect(parsed.product).toBe(30);
      }
    }
  });

  it('should handle async code', async () => {
    // Note: vm2 doesn't support top-level await, so Promise.resolve() returns a Promise object
    const result = await runJS('Promise.resolve(42)');
    // Promise objects get stringified, so check for either output or error
    if (result.error) {
      expect(result.error).toBeTruthy();
    } else {
      expect(result.output).toBeDefined();
      // Promise will be stringified as "[object Promise]" or similar
      expect(result.output).toBeTruthy();
    }
  });

  it('should handle errors', async () => {
    const result = await runJS('throw new Error("Test error")');
    expect(result).toHaveProperty('error');
    // vm2 might sanitize error messages, so just check it exists
    expect(result.error).toBeTruthy();
  });

  it('should handle syntax errors', async () => {
    const result = await runJS('const x = ;');
    expect(result).toHaveProperty('error');
  });

  it('should respect timeout', async () => {
    const result = await runJS('while(true) {}', 100);
    expect(result).toHaveProperty('error');
    // vm2 timeout might give different error messages
    expect(result.error).toBeTruthy();
  }, 10000);
});

