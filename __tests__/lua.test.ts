import { describe, it, expect } from '@jest/globals';
import { runLua } from '../src/runners/lua.js';

describe('Lua Runner', () => {
  it('should execute 1 + 2 and return 3', async () => {
    const result = await runLua('print(1 + 2)');
    expect(result).toHaveProperty('output');
    expect(result.output).toContain('3');
  }, 15000);
});

