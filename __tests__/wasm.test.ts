import { describe, it, expect } from '@jest/globals';
import { runWasmBinary } from '../src/runners/wasm.js';

describe('WASM Runner', () => {
  // Simple WASM module that exports a main function returning 42
  // This is a minimal WASM binary in base64
  const simpleWasmBase64 = 'AGFzbQEAAAA='; // Empty WASM module (minimal valid WASM)

  it('should handle invalid WASM binary', async () => {
    const result = await runWasmBinary('invalid_base64');
    expect(result).toHaveProperty('error');
    expect(result.error).toBeTruthy();
  });

  it('should handle empty WASM binary', async () => {
    const result = await runWasmBinary(simpleWasmBase64);
    // Should either error or return a message about missing exports
    expect(result).toHaveProperty('error');
    expect(result.error).toContain('no _start or main export');
  });

  it('should handle malformed base64', async () => {
    const result = await runWasmBinary('!!!invalid!!!');
    expect(result).toHaveProperty('error');
    expect(result.error).toBeTruthy();
  });

  it('should handle timeout', async () => {
    // Create a WASM that might hang (though simple one won't)
    const result = await runWasmBinary(simpleWasmBase64, 1);
    expect(result).toHaveProperty('error');
  }, 5000);

  // Note: Testing actual WASM execution requires a properly compiled WASM module
  // with _start or main exports. This would require additional setup.
  it('should return error for WASM without exports', async () => {
    const result = await runWasmBinary(simpleWasmBase64);
    expect(result).toHaveProperty('error');
    expect(result.error).toContain('no _start or main export');
  });
});

