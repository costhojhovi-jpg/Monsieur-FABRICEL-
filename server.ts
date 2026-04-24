import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Global logger
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // API routes FIRST
  const apiRouter = express.Router();

  apiRouter.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  apiRouter.all("*", (req, res) => {
    console.log(`[${new Date().toISOString()}] API: 404 - ${req.method} ${req.path}`);
    res.status(404).json({ error: `Route API non trouvée: ${req.method} ${req.path}` });
  });

  app.use("/api", apiRouter);

  // Serve static files from public directory explicitly
  const publicPath = path.join(__dirname, "public");
  app.get("/manifest.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.sendFile(path.join(publicPath, "manifest.json"));
  });
  app.get("/sw.js", (req, res) => {
    res.sendFile(path.join(publicPath, "sw.js"));
  });

  app.use(express.static(publicPath));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
