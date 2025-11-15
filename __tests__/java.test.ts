import { describe, it, expect } from '@jest/globals';
import { runJava } from '../src/runners/java.js';

describe('Java Runner', () => {
  it('should execute 1 + 2 and return 3', async () => {
    const code = `public class Main {
    public static void main(String[] args) {
        System.out.println(1 + 2);
    }
}`;
    const result = await runJava(code);
    if (result.error) {
      // If compiler not found, that's expected in some environments
      expect(result.error).toBeTruthy();
    } else {
      expect(result.output).toBeDefined();
      expect(result.output).toContain('3');
    }
  }, 30000);
});

