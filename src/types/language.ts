export enum SupportedLanguage {
  JAVASCRIPT = "javascript",
  JS = "js",
  PYTHON = "python",
  PY = "py",
  LUA = "lua",
  PHP = "php",
  WASM = "wasm",
  C = "c",
  CPP = "cpp",
  RUST = "rust",
  GO = "go",
  ZIG = "zig",
  JAVA = "java",
}

export interface RunRequest {
  lang: string;
  code: string;
}

export interface RunResponse {
  id: string;
  lang: string;
  output?: string;
  error?: string;
}

