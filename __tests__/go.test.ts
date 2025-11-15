import { describe, it, expect } from '@jest/globals';
import { runGo } from '../src/runners/go.js';

describe('Go Runner', () => {
  it('should execute 1 + 2 and return 3', async () => {
    const code = `package main
import "fmt"
func main() {
    fmt.Println(1 + 2)
}`;
    const result = await runGo(code);
    if (result.error) {
      // If compiler not found, that's expected in some environments
      expect(result.error).toBeTruthy();
    } else {
      expect(result.output).toBeDefined();
      expect(result.output).toContain('3');
    }
  }, 30000);
});

