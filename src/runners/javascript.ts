import { VM } from "vm2";
import { safeStringify } from "../utils/helpers.js";

export async function runJS(code: string, timeoutMs = 2000) {
  try {
    const vm = new VM({
      timeout: timeoutMs,
      sandbox: {
        __result: undefined
      },
      eval: false,
      wasm: false
    });

    // Execute code and store result in sandbox variable
    const wrapped = `__result = ${code};`;
    vm.run(wrapped);
    const result = vm.run('__result');
    return { output: safeStringify(result) };
  } catch (err: any) {
    return { error: err?.message ?? String(err) };
  }
}

