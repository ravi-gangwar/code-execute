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
    await ensureFengari();
    const L = lauxlib.luaL_newstate();
    lualib.luaL_openlibs(L);
    const loadStatus = lauxlib.luaL_loadstring(L, fengari.to_luastring(userCode));
    if (loadStatus !== 0) {
      const err = fengari.to_jsstring(lua.lua_tostring(L, -1));
      return { error: err };
    }
    const callStatus = lua.lua_pcall(L, 0, lua.LUA_MULTRET, 0);
    if (callStatus !== 0) {
      const err = fengari.to_jsstring(lua.lua_tostring(L, -1));
      return { error: err };
    }
    return { output: "<lua executed — print capture not implemented>" };
  } catch (err: any) {
    return { error: err?.message ?? String(err) };
  }
}

