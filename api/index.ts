// Committed entry so Vercel detects a Serverless Function.
// Bundled runtime is written to dist/vercel-handler.js during `build:vercel`.
// @ts-expect-error generated at build time
import app from "../dist/vercel-handler.js";

export default app;
