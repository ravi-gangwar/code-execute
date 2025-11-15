import { describe, it, expect } from '@jest/globals';
import { runPython } from '../src/runners/python.js';

describe('Python Runner', () => {
  it('should execute 1 + 2 and return 3', async () => {
    const result = await runPython('print(1 + 2)');
    expect(result).toHaveProperty('output');
    expect(result.output).toContain('3');
  }, 30000);
});

