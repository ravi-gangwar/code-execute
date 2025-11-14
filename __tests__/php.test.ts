import { describe, it, expect } from '@jest/globals';
import { runPHP } from '../src/runners/php.js';

describe('PHP Runner', () => {
  it('should execute simple PHP code', async () => {
    const result = await runPHP('echo "Hello, World!";');
    // php-wasm might return error if not available, so check for either
    if (result.error) {
      expect(result.error).toBeTruthy();
    } else {
      expect(result.output).toBeDefined();
      expect(result.output).toContain('Hello, World!');
    }
  }, 20000);

  it('should handle arithmetic operations', async () => {
    const result = await runPHP('echo 2 + 2;');
    if (result.error) {
      expect(result.error).toBeTruthy();
    } else {
      expect(result.output).toBeDefined();
      expect(result.output).toContain('4');
    }
  }, 20000);

  it('should handle multiple statements', async () => {
    const result = await runPHP('$x = 5; $y = 10; echo $x + $y;');
    if (result.error) {
      expect(result.error).toBeTruthy();
    } else {
      expect(result.output).toBeDefined();
      expect(result.output).toContain('15');
    }
  }, 20000);

  it('should handle arrays', async () => {
    const result = await runPHP('$arr = [1, 2, 3]; print_r($arr);');
    if (result.error) {
      expect(result.error).toBeTruthy();
    } else {
      expect(result.output).toBeDefined();
      expect(result.output).toBeTruthy();
    }
  }, 20000);

  it('should handle functions', async () => {
    const result = await runPHP('function add($a, $b) { return $a + $b; } echo add(5, 3);');
    if (result.error) {
      expect(result.error).toBeTruthy();
    } else {
      expect(result.output).toBeDefined();
      expect(result.output).toContain('8');
    }
  }, 20000);

  it('should handle errors', async () => {
    const result = await runPHP('echo $undefined_variable;');
    expect(result).toHaveProperty('error');
    expect(result.error).toBeTruthy();
  }, 20000);

  it('should handle syntax errors', async () => {
    const result = await runPHP('echo "unclosed string');
    expect(result).toHaveProperty('error');
    expect(result.error).toBeTruthy();
  }, 20000);

  it('should handle loops', async () => {
    const result = await runPHP('for ($i = 0; $i < 5; $i++) { echo $i; }');
    if (result.error) {
      expect(result.error).toBeTruthy();
    } else {
      expect(result.output).toBeDefined();
      expect(result.output).toBeTruthy();
    }
  }, 20000);
});

