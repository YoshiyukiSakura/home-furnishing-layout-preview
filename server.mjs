import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === "production";
const port = Number(process.env.PORT ?? 5188);
const host = process.env.HOST ?? "0.0.0.0";
const storageDir = path.join(__dirname, "server-data");
const storageFile = path.join(storageDir, "layout-state.json");
const distDir = path.join(__dirname, "dist");
const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

async function readRequestBody(request) {
  let body = "";

  for await (const chunk of request) {
    body += chunk;

    if (body.length > 1_000_000) {
      throw new Error("Request body too large");
    }
  }

  return body;
}

async function readLayoutState() {
  try {
    const raw = await readFile(storageFile, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function writeLayoutState(state) {
  await mkdir(storageDir, { recursive: true });
  await writeFile(storageFile, JSON.stringify(state, null, 2), "utf8");
}

function isLayoutState(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof value.version === "number" &&
    typeof value.room === "object" &&
    Array.isArray(value.items)
  );
}

async function handleApi(request, response) {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (url.pathname !== "/api/layout-state") {
    return false;
  }

  if (request.method === "GET") {
    sendJson(response, 200, { state: await readLayoutState() });
    return true;
  }

  if (request.method === "PUT") {
    try {
      const body = await readRequestBody(request);
      const payload = JSON.parse(body);
      const state = payload?.state;

      if (!isLayoutState(state)) {
        sendJson(response, 400, { error: "Invalid layout state" });
        return true;
      }

      await writeLayoutState({
        ...state,
        savedAt: new Date().toISOString(),
      });
      sendJson(response, 200, { ok: true });
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : "Invalid request" });
    }

    return true;
  }

  sendJson(response, 405, { error: "Method not allowed" });
  return true;
}

const vite = isProduction
  ? null
  : await import("vite").then(({ createServer: createViteServer }) =>
      createViteServer({
        appType: "spa",
        root: __dirname,
        server: {
          middlewareMode: true,
        },
      }),
    );

const server = createServer(async (request, response) => {
  try {
    if (await handleApi(request, response)) {
      return;
    }

    if (isProduction) {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
      const requestedPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
      const filePath = path.resolve(distDir, `.${requestedPath}`);
      const resolvedPath = filePath.startsWith(`${distDir}${path.sep}`) ? filePath : path.join(distDir, "index.html");

      try {
        const file = await readFile(resolvedPath);
        response.writeHead(200, {
          "Content-Type": mimeTypes.get(path.extname(resolvedPath)) ?? "application/octet-stream",
        });
        response.end(file);
      } catch {
        const index = await readFile(path.join(distDir, "index.html"));
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        response.end(index);
      }

      return;
    }

    vite?.middlewares(request, response, (error) => {
      if (error) {
        vite.ssrFixStacktrace(error);
        response.statusCode = 500;
        response.end(error.stack);
      }
    });
  } catch (error) {
    sendJson(response, 500, { error: error instanceof Error ? error.message : "Server error" });
  }
});

server.listen(port, host, () => {
  console.log(`Layout planner server listening on http://localhost:${port}/`);
});
