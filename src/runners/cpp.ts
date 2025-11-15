import { timeoutPromise, safeStringify } from "../utils/helpers.js";
import { writeFile, readFile, unlink, mkdir, rmdir } from "fs/promises";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { tmpdir } from "os";

const execAsync = promisify(exec);

// Check if C++ compiler is available (try g++ first, then clang++)
async function checkCppCompiler(): Promise<{ available: boolean; compiler: string }> {
  try {
    await execAsync("g++ --version", { timeout: 5000 });
    return { available: true, compiler: "g++" };
  } catch {
    try {
      await execAsync("clang++ --version", { timeout: 5000 });
      return { available: true, compiler: "clang++" };
    } catch {
      return { available: false, compiler: "" };
    }
  }
}

export async function runCpp(sourceCode: string, timeoutMs = 10000) {
  try {
    const p = (async () => {
      // Check for C++ compiler
      const compilerCheck = await checkCppCompiler();
      
      if (!compilerCheck.available) {
        return { 
          error: "C++ compiler (g++ or clang++) not found. " +
                 "Please install a C++ compiler: " +
                 "Windows: Install MinGW-w64 or Visual Studio Build Tools, " +
                 "Linux: sudo apt install g++ or sudo yum install gcc-c++, " +
                 "Mac: xcode-select --install or install Xcode"
        };
      }
      
      const compiler = compilerCheck.compiler;
      
      // Create temporary directory
      const tempDir = join(tmpdir(), `cpp-exec-${Date.now()}-${Math.random().toString(36).substring(7)}`);
      await mkdir(tempDir, { recursive: true });
      
      const sourceFile = join(tempDir, "main.cpp");
      const binaryFile = join(tempDir, "main");
      const binaryFileExe = join(tempDir, "main.exe"); // Windows executable
      
      try {
        // Write source code to file
        await writeFile(sourceFile, sourceCode, "utf-8");
        
        // Compile C++ code
        const compileCommand = `${compiler} "${sourceFile}" -o "${binaryFile}" -std=c++17`;
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
          return { error: `C++ compilation failed: ${fullError.trim()}` };
        }
        
        // Check if binary was created (try both .exe and no extension for Windows)
        let executableFile = binaryFile;
        try {
          await readFile(binaryFile);
        } catch {
          try {
            await readFile(binaryFileExe);
            executableFile = binaryFileExe;
          } catch {
            return { 
              error: `Compilation completed but binary was not created. ` +
                     `Expected: ${binaryFile} or ${binaryFileExe}`
            };
          }
        }
        
        // Execute C++ program
        const runCommand = `"${executableFile}"`;
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
          return { error: `C++ execution failed: ${fullError.trim()}` };
        }
      } finally {
        // Clean up temporary files
        try {
          await unlink(sourceFile).catch(() => {});
          await unlink(binaryFile).catch(() => {});
          await unlink(binaryFileExe).catch(() => {});
          // Try to remove directory
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

