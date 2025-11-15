import { v4 as uuidv4 } from "uuid";
import { runJS } from "../runners/javascript.js";
import { runPython } from "../runners/python.js";
import { runLua } from "../runners/lua.js";
import { runPHP } from "../runners/php.js";
import { runWasmBinary } from "../runners/wasm.js";
import { runGo } from "../runners/go.js";
import type { Request, Response } from "express";
import { SupportedLanguage, type RunRequest, type RunResponse } from "../types/language.js";

export async function handleRun(req: Request, res: Response) {
  const id = uuidv4();
  const body = req.body as RunRequest || {};
  const langRaw = (body.lang || "").toString().trim().toLowerCase();
  const code = (body.code || "").toString();

  if (!langRaw || !code) {
    return res.status(400).json({ id, error: "Missing lang or code" });
  }

  console.log(`[${id}] run request lang=${langRaw}`);

  let result: { output?: string; error?: string } = { error: "unknown" };

  try {
    switch (langRaw) {
      case SupportedLanguage.JS:
      case SupportedLanguage.JAVASCRIPT:
        result = await runJS(code, 2000);
        break;
      case SupportedLanguage.PYTHON:
      case SupportedLanguage.PY:
        result = await runPython(code, 6000);
        break;
      case SupportedLanguage.LUA:
        result = await runLua(code, 3000);
        break;
      case SupportedLanguage.PHP:
        result = await runPHP(code, 4000);
        break;
      case SupportedLanguage.GO:
        // Check if it's source code or WASM binary
        const sourceCheck = code.trim();
        if (sourceCheck.includes("package ") || sourceCheck.includes("import ") || sourceCheck.includes("func main()")) {
          result = await runGo(code, 10000);
        } else {
          result = await runWasmBinary(code, 5000);
        }
        break;
      case SupportedLanguage.WASM:
      case SupportedLanguage.C:
      case SupportedLanguage.CPP:
      case SupportedLanguage.RUST:
      case SupportedLanguage.ZIG:
      case SupportedLanguage.JAVA:
        result = await runWasmBinary(code, 5000);
        break;
      default:
        result = { error: `Language ${langRaw} not supported` };
    }
  } catch (err: any) {
    result = { error: err?.message ?? String(err) };
  }

  if (result && result.output && typeof result.output === "string" && result.output.length > 20000) {
    result.output = result.output.slice(0, 20000) + "\n...[truncated]";
  }

  const response: RunResponse = { id, lang: langRaw, ...result };
  return res.json(response);
}

