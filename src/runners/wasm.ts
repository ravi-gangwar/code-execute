import { timeoutPromise } from "../utils/helpers.js";

// Helper to detect if input looks like source code
function looksLikeSourceCode(input: string): { isSource: boolean; language?: string } {
  const trimmed = input.trim();
  
  // Check for Go source code
  if (trimmed.includes("package ") || trimmed.includes("import ") || trimmed.includes("func main()")) {
    return { isSource: true, language: "Go" };
  }
  
  // Check for C/C++ source code
  if (trimmed.includes("#include") || trimmed.match(/^\s*(int|void|char|float|double)\s+main\s*\(/)) {
    return { isSource: true, language: "C/C++" };
  }
  
  // Check for Rust source code
  if (trimmed.includes("fn main()") || (trimmed.includes("use ") && trimmed.includes("::"))) {
    return { isSource: true, language: "Rust" };
  }
  
  // Check for Java source code
  if (trimmed.includes("public class") || trimmed.includes("public static void main")) {
    return { isSource: true, language: "Java" };
  }
  
  return { isSource: false };
}

// Internal function to run WASM without source code detection
async function runWasmBinaryInternal(base64: string, timeoutMs: number) {
  const binary = Buffer.from(base64, "base64");
  
  // Check if it's a valid WASM binary (starts with WASM magic number)
  if (binary.length < 4 || binary[0] !== 0 || binary[1] !== 0x61 || binary[2] !== 0x73 || binary[3] !== 0x6D) {
    return { 
      error: "Invalid WebAssembly binary. The input must be a base64-encoded .wasm file. " +
             "WASM binaries start with the magic bytes '\\0asm'."
    };
  }
  
  // Memory for WASM (64KB pages, max 2GB)
  const memory = new WebAssembly.Memory({ initial: 256, maximum: 32768 });
  
  // Go WASM runtime requires specific imports from gojs namespace
  const importObject: any = {
    gojs: {
      // Go runtime functions
      runtime: {
        scheduleTimeoutEvent: (id: number, delay: number) => {
          // Simple timeout implementation
          setTimeout(() => {
            // Timeout event would be handled here
          }, delay);
          return id;
        },
        clearTimeoutEvent: (id: number) => {
          // Clear timeout implementation
          return id;
        },
        getRandomData: (r: Uint8Array) => {
          // Fill with random data
          crypto.getRandomValues(r);
        }
      },
      // Go syscall/js functions
      syscall: {
        js: {
          valueCall: (ref: any, method: string, args: any[]) => {
            // Placeholder for JS value calls
            return 0;
          },
          valueGet: (ref: any, prop: string) => {
            // Placeholder for JS value gets
            return 0;
          },
          valueSet: (ref: any, prop: string, val: any) => {
            // Placeholder for JS value sets
            return 0;
          },
          valueIndex: (ref: any, i: number) => {
            // Placeholder for JS value indexing
            return 0;
          },
          valueSetIndex: (ref: any, i: number, val: any) => {
            // Placeholder for JS value set index
            return 0;
          },
          valueInvoke: (ref: any, args: any[]) => {
            // Placeholder for JS value invoke
            return 0;
          },
          valueNew: (ref: any, args: any[]) => {
            // Placeholder for JS value new
            return 0;
          },
          valueLength: (ref: any) => {
            // Placeholder for JS value length
            return 0;
          },
          valuePrepareString: (ref: any) => {
            // Placeholder for JS value prepare string
            return 0;
          },
          valueLoadString: (ref: any, b: Uint8Array) => {
            // Placeholder for JS value load string
            return 0;
          },
          valueInstanceOf: (ref: any, constructor: any) => {
            // Placeholder for JS value instance of
            return false;
          }
        }
      }
    },
    env: {
      abort: () => { throw new Error("wasm abort"); },
      console_log: (ptr: number, len: number) => { /* not implemented */ }
    }
  };
  
  // Add memory to imports
  importObject.gojs.mem = memory;

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
}

export async function runWasmBinary(base64: string, timeoutMs = 3000) {
  try {
    // Check if input looks like source code
    const sourceCheck = looksLikeSourceCode(base64);
    if (sourceCheck.isSource) {
      return { 
        error: `${sourceCheck.language} source code is not supported directly. ` +
               `Please compile your code to WebAssembly (.wasm) first, then provide the binary as a base64-encoded string. ` +
               (sourceCheck.language === "Go"
                 ? `For Go, use TinyGo: tinygo build -target wasm -o output.wasm yourfile.go`
                 : sourceCheck.language === "C/C++"
                 ? `For C/C++, use Emscripten: emcc yourfile.c -o output.wasm`
                 : sourceCheck.language === "Rust"
                 ? `For Rust, use: rustc --target wasm32-unknown-unknown yourfile.rs`
                 : `For ${sourceCheck.language}, you'll need to use the appropriate compiler.`)
      };
    }
    
    return await runWasmBinaryInternal(base64, timeoutMs);
    
  } catch (err: any) {
    // If error mentions WASM magic bytes, provide helpful message
    if (err?.message?.includes("module doesn't start with")) {
      return { 
        error: "Invalid WebAssembly binary format. The input must be a base64-encoded .wasm file. " +
               "Please compile your code to WebAssembly first, then encode the binary file as base64."
      };
    }
    return { error: err?.message ?? String(err) };
  }
}

