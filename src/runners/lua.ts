import { timeoutPromise, safeStringify } from "../utils/helpers.js";

let fengari: any = null;
let lauxlib: any;
let lualib: any;
let lua: any;

async function ensureFengari() {
  if (fengari && lua && lauxlib && lualib) {
    return { fengari, lua, lauxlib, lualib };
  }
  
  const f = await import("fengari");
  const f_lauxlib = await import("fengari/src/lauxlib.js");
  const f_lualib = await import("fengari/src/lualib.js");
  
  fengari = f;
  lua = f.lua;
  lauxlib = f_lauxlib;
  lualib = f_lualib;
  
  return { fengari, lua, lauxlib, lualib };
}

export async function runLua(userCode: string, timeoutMs = 3000) {
  try {
    const p = (async () => {
      await ensureFengari();
      const L = lauxlib.luaL_newstate();
      lualib.luaL_openlibs(L);
      
      // Capture print output
      const output: string[] = [];
      
      // Override print function to capture output
      const printCode = `
local _print = print
_output = {}
print = function(...)
  local args = {...}
  local parts = {}
  for i = 1, #args do
    table.insert(parts, tostring(args[i]))
  end
  table.insert(_output, table.concat(parts, "\\t"))
  _print(...)
end
`;
      
      // Helper function to try loading code and pop error if it fails
      let lastError: string | null = null;
      const tryLoad = (code: string): number => {
        const status = lauxlib.luaL_loadstring(L, fengari.to_luastring(code));
        if (status !== 0) {
          // Save error message before popping
          lastError = fengari.to_jsstring(lua.lua_tostring(L, -1));
          // Pop the error from stack
          lua.lua_pop(L, 1);
        }
        return status;
      };
      
      // Try to load the code as-is first
      let wrappedCode = printCode + userCode;
      let loadStatus = tryLoad(wrappedCode);
      
      // If loading fails, try wrapping the last non-empty line if it's an expression
      if (loadStatus !== 0) {
        // Split into lines while preserving structure
        const allLines = userCode.split('\n');
        const nonEmptyLines = allLines.map((l, i) => ({ line: l.trim(), original: l, index: i }))
          .filter(({ line }) => line.length > 0);
        
        if (nonEmptyLines.length > 0) {
          const lastNonEmpty = nonEmptyLines[nonEmptyLines.length - 1]!;
          const lastLineTrimmed = lastNonEmpty.line;
          
          // Check if last line looks like an expression (not a statement)
          const statementKeywords = ['local', 'function', 'if', 'for', 'while', 'repeat', 'do', 'return', 'break', 'goto', 'end'];
          const isStatement = statementKeywords.some(keyword => lastLineTrimmed.startsWith(keyword));
          
          if (!isStatement) {
            // Reconstruct code with last line wrapped in print()
            const resultLines: string[] = [];
            
            for (let i = 0; i < allLines.length; i++) {
              if (i === lastNonEmpty.index) {
                // This is the last non-empty line, wrap it
                const indent = lastNonEmpty.original.match(/^(\s*)/)?.[1] || '';
                resultLines.push(indent + 'print(' + lastLineTrimmed + ')');
              } else {
                resultLines.push(allLines[i]!);
              }
            }
            
            wrappedCode = printCode + resultLines.join('\n');
            loadStatus = tryLoad(wrappedCode);
          }
        }
      }
      
      // If still fails and it's a single line expression, try wrapping the whole thing
      if (loadStatus !== 0) {
        const trimmed = userCode.trim();
        const statementKeywords = ['local', 'function', 'if', 'for', 'while', 'repeat', 'do', 'return', 'break', 'goto', 'end'];
        const isStatement = statementKeywords.some(keyword => trimmed.startsWith(keyword));
        
        if (!isStatement && !trimmed.includes('\n')) {
          wrappedCode = printCode + 'print(' + trimmed + ')';
          loadStatus = tryLoad(wrappedCode);
        }
      }
      
      // If still fails, return the last error
      if (loadStatus !== 0) {
        const err = lastError || "Unknown Lua error";
        lua.lua_close(L);
        return { error: err };
      }
      
      // Execute the code
      const callStatus = lua.lua_pcall(L, 0, lua.LUA_MULTRET, 0);
      if (callStatus !== 0) {
        const err = fengari.to_jsstring(lua.lua_tostring(L, -1));
        lua.lua_close(L);
        return { error: err };
      }
      
      // Get the return values
      const numReturns = lua.lua_gettop(L);
      const returnValues: any[] = [];
      
      for (let i = 1; i <= numReturns; i++) {
        const type = lua.lua_type(L, i);
        if (type === lua.LUA_TNIL) {
          returnValues.push(null);
        } else if (type === lua.LUA_TBOOLEAN) {
          returnValues.push(lua.lua_toboolean(L, i) !== 0);
        } else if (type === lua.LUA_TNUMBER) {
          returnValues.push(lua.lua_tonumber(L, i));
        } else if (type === lua.LUA_TSTRING) {
          returnValues.push(fengari.to_jsstring(lua.lua_tostring(L, i)));
        } else {
          returnValues.push(fengari.to_jsstring(lua.lua_tostring(L, i)));
        }
      }
      
      // Get captured print output from the _output table
      lua.lua_getglobal(L, fengari.to_luastring("_output"));
      if (!lua.lua_isnil(L, -1)) {
        const outputTable = lua.lua_gettop(L);
        // Iterate through the array part of the table (numeric indices)
        let i = 1;
        while (true) {
          lua.lua_rawgeti(L, outputTable, i);
          if (lua.lua_isnil(L, -1)) {
            lua.lua_pop(L, 1);
            break;
          }
          const value = fengari.to_jsstring(lua.lua_tostring(L, -1));
          output.push(value);
          lua.lua_pop(L, 1);
          i++;
        }
        lua.lua_pop(L, 1); // Pop the _output table
      }
      
      lua.lua_close(L);
      
      // Build output
      let result = "";
      if (output.length > 0) {
        result = output.join("\n");
      }
      
      // If there are return values and no print output, show return values
      if (returnValues.length > 0 && output.length === 0) {
        result = returnValues.map(v => safeStringify(v)).join("\t");
      }
      
      if (!result) {
        result = "Code executed successfully";
      }
      
      return { output: result };
    })();
    
    return await timeoutPromise(p, timeoutMs);
  } catch (err: any) {
    return { error: err?.message ?? String(err) };
  }
}

