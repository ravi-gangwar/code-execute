import { timeoutPromise, safeStringify } from "../utils/helpers.js";
import { writeFile, readFile, unlink, mkdir, rmdir } from "fs/promises";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { tmpdir } from "os";

const execAsync = promisify(exec);

// Custom exec wrapper that properly captures stderr and stdout
function execWithOutput(command: string, options: any): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    exec(command, options, (error, stdout, stderr) => {
      if (error) {
        // Even if there's an error, we still want to capture stdout and stderr
        reject({
          ...error,
          stdout: stdout || '',
          stderr: stderr || '',
          code: error.code || null
        });
      } else {
        resolve({ stdout: stdout || '', stderr: stderr || '', code: 0 });
      }
    });
  });
}

// Check if Java compiler is available
async function checkJavaCompiler(): Promise<boolean> {
  try {
    await execAsync("javac -version", { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

// Check if Java runtime is available
async function checkJavaRuntime(): Promise<boolean> {
  try {
    await execAsync("java -version", { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export async function runJava(sourceCode: string, timeoutMs = 8000) {
  try {
    const p = (async () => {
      // Check for Java compiler and runtime
      const hasJavac = await checkJavaCompiler();
      const hasJava = await checkJavaRuntime();
      
      if (!hasJavac || !hasJava) {
        return { 
          error: "Java compiler (javac) or runtime (java) not found. " +
                 "Please install Java JDK: https://www.oracle.com/java/technologies/downloads/ " +
                 "or OpenJDK: https://openjdk.org/"
        };
      }
      
      // Create temporary directory
      const tempDir = join(tmpdir(), `java-exec-${Date.now()}-${Math.random().toString(36).substring(7)}`);
      await mkdir(tempDir, { recursive: true });
      
      // Extract class name from source code (look for "public class X")
      const classMatch = sourceCode.match(/public\s+class\s+(\w+)/);
      const className = classMatch ? classMatch[1] : "Main";
      
      const sourceFile = join(tempDir, `${className}.java`);
      const classFile = join(tempDir, `${className}.class`);
      
      try {
        // Write source code to file
        await writeFile(sourceFile, sourceCode, "utf-8");
        
        // Compile Java code - use a Promise wrapper to properly capture output
        const compileCommand = `javac "${sourceFile}"`;
        const execOptions: any = {
          timeout: timeoutMs - 3000, // Reserve 3 seconds for execution
          cwd: tempDir,
          maxBuffer: 1024 * 1024 * 10, // 10MB buffer
          env: { ...process.env }
        };
        
        let compilationOutput = '';
        let compilationError = '';
        let compilationSucceeded = false;
        
        try {
          const result = await execWithOutput(compileCommand, execOptions);
          compilationOutput = result.stdout.trim();
          compilationError = result.stderr.trim();
          compilationSucceeded = result.code === 0;
          
          // Check for compilation errors in stderr
          if (compilationError && compilationError.trim()) {
            const errorMsg = compilationError.trim();
            // Warnings are OK, but errors are not
            if (!errorMsg.toLowerCase().includes("warning") && 
                !errorMsg.toLowerCase().includes("note:") &&
                !errorMsg.toLowerCase().includes("deprecated")) {
              return { error: `Compilation error: ${errorMsg}` };
            }
          }
        } catch (compileErr: any) {
          // Capture stdout and stderr from the error
          compilationOutput = (compileErr.stdout || '').toString().trim();
          compilationError = (compileErr.stderr || '').toString().trim();
          compilationSucceeded = false;
          
          // If we have error output, use it
          if (!compilationError && compilationOutput) {
            // Sometimes errors go to stdout
            compilationError = compilationOutput;
          }
        }
        
        // Check if class file was created (definitive check)
        let classFileExists = false;
        try {
          await readFile(classFile);
          classFileExists = true;
        } catch {
          classFileExists = false;
        }
        
        // If compilation failed and no class file, return error
        if (!classFileExists) {
          const errorDetails = compilationError || compilationOutput || 'No error message available';
          return { 
            error: `Java compilation failed: ${errorDetails}`
          };
        }
        
        // Execute Java program
        const runCommand = `java -cp "${tempDir}" ${className}`;
        const runOptions: any = {
          timeout: 3000, // 3 seconds for execution
          cwd: tempDir,
          maxBuffer: 1024 * 1024 * 10, // 10MB buffer
          env: { ...process.env }
        };
        
        try {
          const { stdout, stderr } = await execAsync(runCommand, runOptions);
          
          // Build output
          let output = "";
          if (stderr && stderr.trim()) {
            output += stderr.trim() + "\n";
          }
          if (stdout && stdout.trim()) {
            output += stdout.trim();
          }
          
          if (!output.trim()) {
            output = "Code executed successfully (no output)";
          }
          
          return { output: output.trim() };
        } catch (runError: any) {
          // Capture both stderr and stdout for execution errors
          const stderrOutput = runError.stderr || '';
          const stdoutOutput = runError.stdout || '';
          const errorMsg = runError.message || String(runError);
          
          // Combine all error information
          let fullError = errorMsg;
          if (stderrOutput && stderrOutput.trim()) {
            fullError += '\n' + stderrOutput.trim();
          }
          if (stdoutOutput && stdoutOutput.trim() && !stderrOutput) {
            fullError += '\n' + stdoutOutput.trim();
          }
          
          return { error: `Java execution failed: ${fullError.trim()}` };
        }
      } finally {
        // Clean up temporary files
        try {
          await unlink(sourceFile).catch(() => {});
          await unlink(classFile).catch(() => {});
          // Try to remove directory (might fail if not empty, that's OK)
          await rmdir(tempDir).catch(() => {});
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

