export function timeoutPromise<T>(p: Promise<T>, ms = 3000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Execution timed out")), ms);
    p.then((v) => { clearTimeout(t); resolve(v); })
     .catch((e) => { clearTimeout(t); reject(e); });
  });
}

export function safeStringify(out: any) {
  try { return typeof out === "string" ? out : JSON.stringify(out); }
  catch { return String(out); }
}

