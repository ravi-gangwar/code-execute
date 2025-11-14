import { timeoutPromise, safeStringify } from "../utils/helpers.js";

let createPHP: any = null;
let phpInstance: any = null;

async function ensurePHP() {
  if (phpInstance) return phpInstance;
  try {
    const mod = await import("php-wasm");
    createPHP = mod.createPHP ?? mod.default ?? mod;
    phpInstance = await createPHP();
    return phpInstance;
  } catch (err) {
    throw new Error("php-wasm is not available or API changed: " + String(err));
  }
}

export async function runPHP(userCode: string, timeoutMs = 4000) {
  try {
    const p = (async () => {
      const php = await ensurePHP();
      if (typeof php.execute === "function") {
        const out = await php.execute(userCode);
        return { output: safeStringify(out) };
      } else if (typeof php.run === "function") {
        const out = await php.run(userCode);
        return { output: safeStringify(out) };
      } else {
        throw new Error("Unknown php-wasm API: expected .execute or .run");
      }
    })();
    return await timeoutPromise(p, timeoutMs);
  } catch (err: any) {
    return { error: err?.message ?? String(err) };
  }
}

