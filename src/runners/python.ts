import { timeoutPromise } from "../utils/helpers.js";
import { dirname } from "path";
import { createRequire } from "module";

let pyodide: any = null;

async function ensurePyodide() {
  if (pyodide) return pyodide;
  const mod = await import("pyodide");
  if (mod && typeof mod.loadPyodide === "function") {
    // Get the local pyodide package directory
    const require = createRequire(import.meta.url);
    const pyodidePackagePath = require.resolve("pyodide/package.json");
    const pyodideDir = dirname(pyodidePackagePath);
    
    pyodide = await mod.loadPyodide({
      indexURL: pyodideDir
    });
    return pyodide;
  }
  throw new Error("pyodide package not available / API changed");
}

export async function runPython(userCode: string, timeoutMs = 5000) {
  try {
    const p = (async () => {
      const pyd = await ensurePyodide();

      const wrapped = `
import sys, io, traceback
__py_out_buf = io.StringIO()
_old_stdout = sys.stdout
_old_stderr = sys.stderr
sys.stdout = __py_out_buf
sys.stderr = __py_out_buf
try:
${userCode.split("\n").map(l => "    " + l).join("\n")}
except Exception:
    traceback.print_exc()
finally:
    sys.stdout = _old_stdout
    sys.stderr = _old_stderr
__py_out__ = __py_out_buf.getvalue()
del __py_out_buf
`;
      await pyd.runPythonAsync(wrapped);
      const out = pyd.globals.get("__py_out__");
      try { pyd.runPython("del __py_out__"); } catch(_) {}
      return { output: typeof out === "string" ? out : String(out) };
    })();
    return await timeoutPromise(p, timeoutMs);
  } catch (err: any) {
    return { error: err?.message ?? String(err) };
  }
}

