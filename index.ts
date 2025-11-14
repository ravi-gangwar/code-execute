import { createApp } from "./src/server.js";

const app = createApp();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.listen(PORT, () => console.log(`WASM-multi-runner listening on ${PORT}`));

