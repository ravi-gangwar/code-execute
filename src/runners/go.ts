import { timeoutPromise } from "../utils/helpers.js";
import { writeFile, readFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { tmpdir } from "os";
// Import the internal WASM runner (we'll export it from wasm.ts)
async function runWasmBinaryDirect(base64: string, timeoutMs: number) {
  const { timeoutPromise } = await import("../utils/helpers.js");
  const binary = Buffer.from(base64, "base64");
  
  // Memory for WASM (64KB pages, max 2GB)
  const memory = new WebAssembly.Memory({ initial: 256, maximum: 32768 });
  
  // Go WASM runtime requires specific imports from gojs namespace
  const importObject: any = {
    gojs: {
      mem: memory,
      // Go runtime functions
      runtime: {
        scheduleTimeoutEvent: (id: number, delay: number) => {
          setTimeout(() => {}, delay);
          return id;
        },
        clearTimeoutEvent: (id: number) => {
          return id;
        },
        getRandomData: (r: Uint8Array) => {
          crypto.getRandomValues(r);
        }
      },
      // Go syscall/js functions
      syscall: {
        js: {
          valueCall: () => 0,
          valueGet: () => 0,
          valueSet: () => 0,
          valueIndex: () => 0,
          valueSetIndex: () => 0,
          valueInvoke: () => 0,
          valueNew: () => 0,
          valueLength: () => 0,
          valuePrepareString: () => 0,
          valueLoadString: () => 0,
          valueInstanceOf: () => false
        }
      }
    },
    env: {
      abort: () => { throw new Error("wasm abort"); },
      console_log: (ptr: number, len: number) => { /* not implemented */ }
    }
  };

  try {
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
  } catch (wasmError: any) {
    // If it's a Go WASM runtime error, suggest TinyGo
    if (wasmError?.message?.includes("gojs") || wasmError?.message?.includes("runtime")) {
      return {
        error: `Go WASM runtime error: ${wasmError.message}. ` +
               `Regular Go's WASM output requires the full wasm_exec.js runtime which has complex dependencies. ` +
               `For better compatibility and smaller binaries, please install TinyGo: https://tinygo.org/getting-started/install/ ` +
               `TinyGo produces WASM that works without these runtime dependencies.`
      };
    }
    throw wasmError;
  }
}

const execAsync = promisify(exec);

// Check if TinyGo is available
async function checkTinyGo(): Promise<boolean> {
  try {
    await execAsync("tinygo version", { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

// Check if regular Go is available
async function checkGo(): Promise<boolean> {
  try {
    await execAsync("go version", { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export async function runGo(sourceCode: string, timeoutMs = 10000) {
  try {
    const p = (async () => {
      // Check for available Go compilers - prioritize TinyGo
      const hasTinyGo = await checkTinyGo();
      const hasGo = await checkGo();
      
      // TinyGo is strongly recommended for WASM
      if (!hasTinyGo && !hasGo) {
        return { 
          error: "No Go compiler found. TinyGo is required for WASM compilation. " +
                 "Please install TinyGo: https://tinygo.org/getting-started/install/ " +
                 "Windows: Download from https://github.com/tinygo-org/tinygo/releases or use: choco install tinygo"
        };
      }
      
      // Warn if using regular Go instead of TinyGo
      if (!hasTinyGo && hasGo) {
        // Still try with regular Go, but it has limitations
        console.warn("TinyGo not found. Using regular Go compiler. TinyGo is recommended for better WASM support.");
      }
      
      // Create temporary directory
      const tempDir = join(tmpdir(), `go-wasm-${Date.now()}-${Math.random().toString(36).substring(7)}`);
      await mkdir(tempDir, { recursive: true });
      
      const sourceFile = join(tempDir, "main.go");
      const wasmFile = join(tempDir, "main.wasm");
      
      try {
        // Write source code to file
        await writeFile(sourceFile, sourceCode, "utf-8");
        
        // Compile to WASM
        let compileCommand: string;
        const execOptions: any = {
          timeout: timeoutMs - 2000, // Reserve 2 seconds for execution
          cwd: tempDir,
          maxBuffer: 1024 * 1024 * 10, // 10MB buffer
          env: { ...process.env } // Start with current environment
        };
        
        if (hasTinyGo) {
          // Use TinyGo (better for WASM, smaller binaries, better stdlib support)
          compileCommand = `tinygo build -target wasm -o "${wasmFile}" "${sourceFile}"`;
        } else {
          // Regular Go WASM has limitations - recommend TinyGo
          compileCommand = `go build -o "${wasmFile}" "${sourceFile}"`;
          execOptions.env.GOOS = 'js';
          execOptions.env.GOARCH = 'wasm';
          
          // Return early with helpful message - regular Go WASM is too complex
          return {
            error: "Regular Go compiler found, but it's not suitable for WASM execution in this environment. " +
                   "Regular Go's WASM output requires wasm_exec.js runtime which has complex dependencies. " +
                   "Please install TinyGo instead - it's designed for WASM and works much better: " +
                   "https://tinygo.org/getting-started/install/ " +
                   "Windows: Download from https://github.com/tinygo-org/tinygo/releases or use: choco install tinygo"
          };
        }
        
        try {
          const { stdout, stderr } = await execAsync(compileCommand, execOptions);
          
          // Check if compilation produced any errors
          if (stderr && stderr.trim()) {
            const errorMsg = stderr.trim();
            // Some warnings are OK, but errors are not
            if (!errorMsg.toLowerCase().includes("warning") && !errorMsg.includes("note:")) {
              return { error: `Compilation error: ${errorMsg}` };
            }
          }
        } catch (compileError: any) {
          // execAsync throws an error if the command fails
          const errorOutput = compileError.stderr || compileError.stdout || '';
          const errorMsg = compileError.message || String(compileError);
          const fullError = errorOutput ? `${errorMsg}\n${errorOutput}` : errorMsg;
          
          return { 
            error: `Go compilation failed: ${fullError.trim()}. ` +
                   `Note: Regular Go's WASM support requires wasm_exec.js and has limitations. ` +
                   `For better WASM support with fmt.Println and other stdlib features, please install TinyGo: https://tinygo.org/getting-started/install/`
          };
        }
        
        // Check if WASM file was created
        try {
          await readFile(wasmFile);
        } catch {
          return { 
            error: `Compilation completed but WASM file was not created. ` +
                   `Regular Go's WASM compilation may require additional setup. ` +
                   `Consider using TinyGo instead: https://tinygo.org/getting-started/install/`
          };
        }
        
        // Read the compiled WASM binary
        const wasmBinary = await readFile(wasmFile);
        const base64Wasm = wasmBinary.toString("base64");
        
        // Execute the WASM binary
        const result = await runWasmBinaryDirect(base64Wasm, 2000);
        
        return result;
      } finally {
        // Clean up temporary files
        try {
          await unlink(sourceFile).catch(() => {});
          await unlink(wasmFile).catch(() => {});
          // Note: We don't remove the directory as it might have other files
          // The OS will clean up temp directories eventually
        } catch {
          // Ignore cleanup errors
        }
      }
    })();
    
    return await timeoutPromise(p, timeoutMs);
  } catch (err: any) {
    return { error: err?.message ?? String(err) };
  }
}

