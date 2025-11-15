import { timeoutPromise, safeStringify } from "../utils/helpers.js";

let quickjs: any = null;
let defaultRuntime: any = null;

async function ensureQuickJS() {
  if (quickjs && defaultRuntime) return { quickjs, runtime: defaultRuntime };
  
  const mod = await import("quickjs-emscripten");
  if (mod && typeof mod.getQuickJS === "function") {
    quickjs = await mod.getQuickJS();
    defaultRuntime = quickjs.newRuntime();
    
    // Set memory and timeout limits
    defaultRuntime.setMemoryLimit(1024 * 1024 * 10); // 10MB limit
    defaultRuntime.setMaxStackSize(1024 * 256); // 256KB stack
    
    return { quickjs, runtime: defaultRuntime };
  }
  throw new Error("quickjs-emscripten package not available / API changed");
}

export async function runJS(code: string, timeoutMs = 2000) {
  try {
    const p = (async () => {
      const { quickjs: qjs, runtime } = await ensureQuickJS();
      
      // Create a new context for each execution (isolated)
      const vm = runtime.newContext();
      
      try {
        // Capture console output
        const logs: string[] = [];
        
        // Set up console object
        const consoleHandle = vm.newObject();
        
        // Helper to create console functions
        // Args are QuickJSHandle objects, need to dump them to get values
        const createConsoleFn = (prefix: string) => {
          return vm.newFunction("fn", (...args: any[]) => {
            const parts = args.map((argHandle: any) => {
              try {
                return vm.dump(argHandle);
              } catch {
                return String(argHandle);
              }
            });
            logs.push(prefix + parts.join(" "));
            return vm.undefined;
          });
        };
        
        const logFn = createConsoleFn("");
        const errorFn = createConsoleFn("ERROR: ");
        const warnFn = createConsoleFn("WARN: ");
        const infoFn = createConsoleFn("INFO: ");
        
        vm.setProp(consoleHandle, "log", logFn);
        vm.setProp(consoleHandle, "error", errorFn);
        vm.setProp(consoleHandle, "warn", warnFn);
        vm.setProp(consoleHandle, "info", infoFn);
        vm.setProp(vm.global, "console", consoleHandle);
        
        // Execute the code
        const result = vm.evalCode(code);
        
        // Clean up function handles after execution
        logFn.dispose();
        errorFn.dispose();
        warnFn.dispose();
        infoFn.dispose();
        consoleHandle.dispose();
        
        if (result.error) {
          const errorMsg = vm.dump(result.error);
          result.error.dispose();
          return { error: errorMsg };
        }
        
        // Get the result value
        let output = "";
        if (logs.length > 0) {
          output += logs.join("\n") + "\n";
        }
        
        if (result.value) {
          const value = vm.dump(result.value);
          result.value.dispose();
          if (value !== undefined) {
            output += safeStringify(value);
          }
        }
        
        if (!output.trim()) {
          output = "Code executed successfully";
        }
        
        return { output };
      } finally {
        vm.dispose();
      }
    })();
    
    return await timeoutPromise(p, timeoutMs);
  } catch (err: any) {
    return { error: err?.message ?? String(err) };
  }
}
