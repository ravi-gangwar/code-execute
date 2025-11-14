import { describe, it, expect } from '@jest/globals';
import { runLua } from '../src/runners/lua.js';

describe('Lua Runner', () => {
  it('should execute simple Lua code', async () => {
    const result = await runLua('local x = 2 + 2');
    expect(result).toHaveProperty('output');
    expect(result.output).toBe('<lua executed — print capture not implemented>');
  }, 15000);

  it('should handle variable assignments', async () => {
    const result = await runLua('local name = "test"');
    expect(result).toHaveProperty('output');
    expect(result.error).toBeUndefined();
  }, 15000);

  it('should handle arithmetic', async () => {
    const result = await runLua('local result = 10 * 5');
    expect(result).toHaveProperty('output');
    expect(result.error).toBeUndefined();
  }, 15000);

  it('should handle table operations', async () => {
    const result = await runLua('local t = {1, 2, 3}');
    expect(result).toHaveProperty('output');
    expect(result.error).toBeUndefined();
  }, 15000);

  it('should handle errors', async () => {
    const result = await runLua('error("test error")');
    expect(result).toHaveProperty('error');
    expect(result.error).toBeTruthy();
  }, 15000);

  it('should handle syntax errors', async () => {
    const result = await runLua('local x = ');
    expect(result).toHaveProperty('error');
    expect(result.error).toBeTruthy();
  }, 15000);

  it('should handle function definitions', async () => {
    const result = await runLua('function add(a, b) return a + b end');
    expect(result).toHaveProperty('output');
    expect(result.error).toBeUndefined();
  }, 15000);

  it('should handle loops', async () => {
    const result = await runLua('for i = 1, 5 do end');
    expect(result).toHaveProperty('output');
    expect(result.error).toBeUndefined();
  }, 15000);
});

