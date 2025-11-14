import { describe, it, expect } from '@jest/globals';
import { runPython } from '../src/runners/python.js';

describe('Python Runner', () => {
  it('should execute simple Python code', async () => {
    const result = await runPython('print("Hello, World!")');
    expect(result).toHaveProperty('output');
    expect(result.output).toContain('Hello, World!');
  }, 30000);

  it('should handle arithmetic operations', async () => {
    const result = await runPython('print(2 + 2)');
    expect(result).toHaveProperty('output');
    expect(result.output.trim()).toBe('4');
  }, 30000);

  it('should handle multiple print statements', async () => {
    const result = await runPython('print(1)\nprint(2)\nprint(3)');
    expect(result).toHaveProperty('output');
    const lines = result.output.trim().split('\n');
    expect(lines).toContain('1');
    expect(lines).toContain('2');
    expect(lines).toContain('3');
  }, 30000);

  it('should handle list operations', async () => {
    const result = await runPython('numbers = [1, 2, 3, 4, 5]\nprint([x**2 for x in numbers])');
    expect(result).toHaveProperty('output');
    expect(result.output).toContain('[1, 4, 9, 16, 25]');
  }, 30000);

  it('should handle function definitions', async () => {
    const result = await runPython('def add(a, b):\n    return a + b\nprint(add(5, 3))');
    expect(result).toHaveProperty('output');
    expect(result.output.trim()).toBe('8');
  }, 30000);

  it('should handle errors', async () => {
    const result = await runPython('print(1 / 0)');
    // Python prints traceback to stderr which we capture, so it might be in output
    expect(result).toHaveProperty('output');
    // The output should contain the error traceback
    expect(result.output).toBeTruthy();
  }, 30000);

  it('should handle syntax errors', async () => {
    const result = await runPython('print("unclosed string');
    expect(result).toHaveProperty('error');
    expect(result.error).toBeTruthy();
  }, 30000);

  it('should handle loops', async () => {
    const result = await runPython('for i in range(5):\n    print(i)');
    expect(result).toHaveProperty('output');
    const output = result.output.trim();
    expect(output).toContain('0');
    expect(output).toContain('4');
  }, 30000);
});

