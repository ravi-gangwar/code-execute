import { timeoutPromise } from "../utils/helpers.js";

export async function runWasmBinary(base64: string, timeoutMs = 3000) {
  try {
    const binary = Buffer.from(base64, "base64");
    const importObject: any = {
      env: {
        abort: () => { throw new Error("wasm abort"); },
        console_log: (ptr: number, len: number) => { /* not implemented */ }
      }
    };

    const { instance } = await WebAssembly.instantiate(binary, importObject);
    const exports = instance.exports as any;
    if (exports._start) {
      const p = Promise.resolve().then(() => exports._start());
      await timeoutPromise(p, timeoutMs);
      return { output: "_start executed (no stdout capture)" };
    } else if (exports.main) {
      const p = Promise.resolve().then(() => exports.main());
      const ret = await timeoutPromise(p, timeoutMs);
      return { output: `main executed, return=${String(ret)}` };
    } else {
      return { error: "WASM has no _start or main export" };
    }
  } catch (err: any) {
    return { error: err?.message ?? String(err) };
  }
}

