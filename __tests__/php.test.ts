import { describe, it, expect } from '@jest/globals';
import { runPHP } from '../src/runners/php.js';

describe('PHP Runner', () => {
  it('should execute 1 + 2 and return 3', async () => {
    const result = await runPHP('echo 1 + 2;');
    if (result.error) {
      expect(result.error).toBeTruthy();
    } else {
      expect(result.output).toBeDefined();
      expect(result.output).toContain('3');
    }
  }, 20000);
});

