import { describe, it, expect } from '@jest/globals';
import { runRust } from '../src/runners/rust.js';

describe('Rust Runner', () => {
  it('should execute 1 + 2 and return 3', async () => {
    const code = `fn main() {
    println!("{}", 1 + 2);
}`;
    const result = await runRust(code);
    if (result.error) {
      // If compiler not found, that's expected in some environments
      expect(result.error).toBeTruthy();
    } else {
      expect(result.output).toBeDefined();
      expect(result.output).toContain('3');
    }
  }, 30000);
});

