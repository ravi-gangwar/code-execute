import { timeoutPromise, safeStringify } from "../utils/helpers.js";

let PhpNode: any = null;
let phpInstance: any = null;

async function ensurePHP() {
  if (phpInstance) return phpInstance;
  try {
    const mod = await import("php-wasm/PhpNode.mjs");
    PhpNode = mod.PhpNode ?? mod.default;
    if (!PhpNode) {
      throw new Error("PhpNode class not found in php-wasm/PhpNode.mjs");
    }
    
    // Create a new PHP instance
    phpInstance = new PhpNode();
    
    // Wait for PHP to be ready
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("PHP initialization timeout"));
      }, 10000);
      
      phpInstance.addEventListener('ready', () => {
        clearTimeout(timeout);
        resolve();
      });
      
      phpInstance.addEventListener('error', (e: any) => {
        clearTimeout(timeout);
        reject(new Error(e.detail || "PHP initialization error"));
      });
    });
    
    return phpInstance;
  } catch (err) {
    throw new Error("php-wasm is not available or API changed: " + String(err));
  }
}

export async function runPHP(userCode: string, timeoutMs = 4000) {
  try {
    const p = (async () => {
      const php = await ensurePHP();
      
      // Capture output
      let stdout = "";
      let stderr = "";
      
      const outputHandler = (e: any) => {
        stdout += e.detail || "";
      };
      
      const errorHandler = (e: any) => {
        stderr += e.detail || "";
      };
      
      php.addEventListener('output', outputHandler);
      php.addEventListener('error', errorHandler);
      
      try {
        // Clear previous output
        stdout = "";
        stderr = "";
        
        // Wrap code in PHP tags if not already wrapped
        let phpCode = userCode.trim();
        if (!phpCode.startsWith('<?php') && !phpCode.startsWith('<?=') && !phpCode.startsWith('<?')) {
          phpCode = '<?php ' + phpCode;
        }
        
        // Run the PHP code
        await php.run(phpCode);
        
        // Wait a bit for async output to be captured
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Build output
        let output = "";
        if (stderr) {
          output += "ERROR: " + stderr + "\n";
        }
        if (stdout) {
          output += stdout;
        }
        if (!output.trim()) {
          output = "Code executed successfully";
        }
        
        // If output is the same as input, something went wrong
        if (output.trim() === userCode.trim() || output.trim() === phpCode.trim()) {
          return { error: "PHP code was not executed. Output matches input." };
        }
        
        return { output: output.trim() };
      } finally {
        php.removeEventListener('output', outputHandler);
        php.removeEventListener('error', errorHandler);
      }
    })();
    
    return await timeoutPromise(p, timeoutMs);
  } catch (err: any) {
    return { error: err?.message ?? String(err) };
  }
}

