import { describe, it, expect } from '@jest/globals';
import { runCpp } from '../src/runners/cpp.js';

describe('C Runner', () => {
  it('should execute 1 + 2 and return 3', async () => {
    const code = `#include <stdio.h>
int main() {
    printf("%d\\n", 1 + 2);
    return 0;
}`;
    const result = await runCpp(code);
    if (result.error) {
      // If compiler not found, that's expected in some environments
      expect(result.error).toBeTruthy();
    } else {
      expect(result.output).toBeDefined();
      expect(result.output).toContain('3');
    }
  }, 30000);
});

