import { timeoutPromise, safeStringify } from "../utils/helpers.js";
import { writeFile, readFile, unlink, mkdir, rmdir } from "fs/promises";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { tmpdir } from "os";

const execAsync = promisify(exec);

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
        
        // Compile Java code
        const compileCommand = `javac "${sourceFile}"`;
        const execOptions: any = {
          timeout: timeoutMs - 3000, // Reserve 3 seconds for execution
          cwd: tempDir,
          maxBuffer: 1024 * 1024 * 10, // 10MB buffer
          env: { ...process.env }
        };
        
        try {
          const { stdout, stderr } = await execAsync(compileCommand, execOptions);
          
          // Check for compilation errors
          if (stderr && stderr.trim()) {
            const errorMsg = stderr.trim();
            // Warnings are OK, but errors are not
            if (!errorMsg.toLowerCase().includes("warning") && 
                !errorMsg.toLowerCase().includes("note:")) {
              return { error: `Compilation error: ${errorMsg}` };
            }
          }
        } catch (compileError: any) {
          const errorOutput = compileError.stderr || compileError.stdout || '';
          const errorMsg = compileError.message || String(compileError);
          const fullError = errorOutput ? `${errorMsg}\n${errorOutput}` : errorMsg;
          return { error: `Java compilation failed: ${fullError.trim()}` };
        }
        
        // Check if class file was created
        try {
          await readFile(classFile);
        } catch {
          return { 
            error: `Compilation completed but class file was not created. ` +
                   `Expected class: ${className}.class`
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
          const errorOutput = runError.stderr || runError.stdout || '';
          const errorMsg = runError.message || String(runError);
          const fullError = errorOutput ? `${errorMsg}\n${errorOutput}` : errorMsg;
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

