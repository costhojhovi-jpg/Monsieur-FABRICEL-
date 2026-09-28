import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "./src/services/systemPrompt";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '50mb' }));

  // CORS pour le frontend Firebase
  app.use((req, res, next) => {
    const allowedOrigins = [
      "https://gen-lang-client-0336696876.web.app",
      "https://gen-lang-client-0336696876.firebaseapp.com"
    ];
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
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

  apiRouter.get("/download-source", (req, res) => {
    const filePath = path.resolve(process.cwd(), "public/code-source-application.zip");
    if (fs.existsSync(filePath)) {
      res.setHeader("Content-Disposition", 'attachment; filename="code-source-application.zip"');
      res.setHeader("Content-Type", "application/zip");
      return res.sendFile(filePath);
    }
    return res.status(404).send("Archive de code introuvable.");
  });

  // Helper to run streaming with retry and fallback across verified active models
  async function streamWithRetry(ai: GoogleGenAI, contents: any[], res: express.Response) {
    const modelsToTry = [
      "gemini-3.8-flash",
      "gemini-flash-latest",
      "gemini-3.1-flash-lite",
      "gemini-2.5-flash"
    ];
    let lastError: any = null;
    let chunkCount = 0;

    for (const model of modelsToTry) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          console.log(`[Chat Stream] Trying model ${model} (attempt ${attempt})...`);
          
          // Use Promise.race with 45-second timeout on stream initiation
          const streamPromise = ai.models.generateContentStream({
            model,
            contents,
            config: {
              systemInstruction: SYSTEM_INSTRUCTION,
              temperature: 0.3,
            }
          });

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout: Le modèle ${model} n'a pas répondu dans le délai imparti.`)), 45000)
          );

          const responseStream = await Promise.race([streamPromise, timeoutPromise]) as any;

          for await (const chunk of responseStream) {
            if (chunk.text) {
              chunkCount++;
              res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
            }
          }

          // If stream finished successfully
          res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          res.end();
          return;
        } catch (err: any) {
          lastError = err;
          const errStr = String(err?.message || err);
          console.warn(`[Chat Stream] Model ${model} failed on attempt ${attempt}:`, errStr);

          // If we already sent chunks to the user, we cannot switch to another model midway
          if (chunkCount > 0) {
            console.warn(`[Chat Stream] Chunks were already sent (${chunkCount}), closing stream gracefully.`);
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            res.end();
            return;
          }

          const isTransient = errStr.includes("503") || 
            errStr.includes("UNAVAILABLE") || 
            errStr.includes("high demand") || 
            errStr.includes("429") || 
            errStr.includes("Resource exhausted") ||
            errStr.includes("Timeout");

          if (isTransient) {
            await new Promise((r) => setTimeout(r, attempt * 600));
          } else {
            // Unrecoverable on this model, immediately switch to next model
            break;
          }
        }
      }
    }

    throw lastError || new Error("Impossible de joindre les serveurs d'IA après plusieurs tentatives.");
  }

  // Helper to run content generation with retry and fallback
  async function generateWithRetry(ai: GoogleGenAI, contents: any[]) {
    const modelsToTry = [
      "gemini-3.8-flash",
      "gemini-flash-latest",
      "gemini-3.1-flash-lite",
      "gemini-2.5-flash"
    ];
    let lastError: any = null;

    for (const model of modelsToTry) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const genPromise = ai.models.generateContent({
            model,
            contents,
            config: {
              systemInstruction: SYSTEM_INSTRUCTION,
              temperature: 0.3,
            }
          });

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout: Le modèle ${model} n'a pas répondu.`)), 45000)
          );

          const response = await Promise.race([genPromise, timeoutPromise]) as any;
          return response.text || "";
        } catch (err: any) {
          lastError = err;
          const errStr = String(err?.message || err);
          console.warn(`[Chat Gen] Model ${model} attempt ${attempt} failed:`, errStr);

          const isTransient = errStr.includes("503") || 
            errStr.includes("UNAVAILABLE") || 
            errStr.includes("high demand") || 
            errStr.includes("429") ||
            errStr.includes("Timeout");

          if (isTransient) {
            await new Promise((r) => setTimeout(r, attempt * 600));
          } else {
            break;
          }
        }
      }
    }

    throw lastError || new Error("Erreur de génération.");
  }

  // Chat Streaming Endpoint (Server-Sent Events) - Supports POST and GET
  apiRouter.all("/chat/stream", async (req, res) => {
    let history = req.body?.history;
    if (!history && req.query.history) {
      try {
        history = typeof req.query.history === 'string' ? JSON.parse(req.query.history) : req.query.history;
      } catch (e) {
        history = [];
      }
    }
    if (!history && req.query.prompt) {
      history = [{ role: "user", text: String(req.query.prompt) }];
    }
    history = history || [];

    // Health or probe check without history
    if (req.method === "GET" && history.length === 0 && !req.headers.accept?.includes("text/event-stream")) {
      return res.status(200).json({
        status: "ok",
        service: "Monsieur FABRICEL chat streaming API",
        ready: true
      });
    }

    const customApiKey = (req.body?.customApiKey || (req.query.customApiKey as string) || "").trim() || undefined;
    let apiKey = (customApiKey && customApiKey.trim()) || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ error: "Clé API non configurée. Veuillez renseigner votre clé API dans les paramètres." });
    }

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const formattedContents = (history || []).map((m: any) => ({
      role: m.role === "model" ? "model" : "user",
      parts: [
        { text: m.text || "" },
        ...(m.attachments || []).map((a: any) => ({
          inlineData: { mimeType: a.mimeType, data: a.data }
        }))
      ]
    }));

    try {
      let ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      try {
        await streamWithRetry(ai, formattedContents, res);
      } catch (streamErr: any) {
        const streamErrStr = String(streamErr?.message || streamErr);
        // If the error was due to custom API key invalid, and we have a server fallback key, try server key!
        if (customApiKey && process.env.GEMINI_API_KEY && (
          streamErrStr.includes("API key not valid") || 
          streamErrStr.includes("API_KEY_INVALID") || 
          streamErrStr.includes("PERMISSION_DENIED")
        )) {
          console.warn("[API /chat/stream] Custom API key was invalid. Falling back to server default API key...");
          ai = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY,
            httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
          });
          await streamWithRetry(ai, formattedContents, res);
        } else {
          throw streamErr;
        }
      }
    } catch (error: any) {
      console.error("[API /chat/stream Error]:", error);
      const errorMsg = error?.message || "Erreur lors de la génération de la réponse.";
      if (!res.headersSent) {
        res.status(500).json({ error: errorMsg });
      } else {
        res.write(`data: ${JSON.stringify({ error: errorMsg })}\n\n`);
        res.end();
      }
    }
  });

  // Non-streaming Chat Endpoint - Supports POST and GET
  apiRouter.all("/chat", async (req, res) => {
    let history = req.body?.history;
    if (!history && req.query.history) {
      try {
        history = typeof req.query.history === 'string' ? JSON.parse(req.query.history) : req.query.history;
      } catch (e) {
        history = [];
      }
    }
    if (!history && req.query.prompt) {
      history = [{ role: "user", text: String(req.query.prompt) }];
    }
    history = history || [];

    if (req.method === "GET" && history.length === 0) {
      return res.status(200).json({
        status: "ok",
        service: "Monsieur FABRICEL chat API",
        ready: true
      });
    }

    const customApiKey = (req.body?.customApiKey || (req.query.customApiKey as string) || "").trim() || undefined;
    let apiKey = (customApiKey && customApiKey.trim()) || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ error: "Clé API non configurée." });
    }

    const formattedContents = (history || []).map((m: any) => ({
      role: m.role === "model" ? "model" : "user",
      parts: [
        { text: m.text || "" },
        ...(m.attachments || []).map((a: any) => ({
          inlineData: { mimeType: a.mimeType, data: a.data }
        }))
      ]
    }));

    try {
      let ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      let text = "";
      try {
        text = await generateWithRetry(ai, formattedContents);
      } catch (genErr: any) {
        const genErrStr = String(genErr?.message || genErr);
        if (customApiKey && process.env.GEMINI_API_KEY && (
          genErrStr.includes("API key not valid") || 
          genErrStr.includes("API_KEY_INVALID") || 
          genErrStr.includes("PERMISSION_DENIED")
        )) {
          console.warn("[API /chat] Custom API key invalid. Falling back to server default API key...");
          ai = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY,
            httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
          });
          text = await generateWithRetry(ai, formattedContents);
        } else {
          throw genErr;
        }
      }

      res.json({ text });
    } catch (error: any) {
      console.error("[API /chat Error]:", error);
      res.status(500).json({ error: error?.message || "Erreur lors du traitement de la requête." });
    }
  });

  apiRouter.all("*", (req, res) => {
    console.log(`[${new Date().toISOString()}] API: 404 - ${req.method} ${req.path}`);
    res.status(404).json({ error: `Route API non trouvée: ${req.method} ${req.path}` });
  });

  app.use("/api", apiRouter);
  // Direct root-level aliases for chat endpoints without blocking the SPA frontend
  app.all("/chat/stream", (req, res, next) => apiRouter(req, res, next));
  app.all("/chat", (req, res, next) => apiRouter(req, res, next));
  app.get("/health", (req, res, next) => apiRouter(req, res, next));

  // Serve static files from public directory explicitly with environment awareness and fallbacks
  const publicPath = path.join(process.cwd(), "public");
  const distPath = path.join(process.cwd(), "dist");

  app.get("/manifest.json", (req, res) => {
    const devPath = path.join(publicPath, "manifest.json");
    const prodPath = path.join(distPath, "manifest.json");
    
    console.log(`[manifest.json request] devPath: ${devPath} (exists: ${fs.existsSync(devPath)}), prodPath: ${prodPath} (exists: ${fs.existsSync(prodPath)})`);

    try {
      if (fs.existsSync(prodPath)) {
        const content = fs.readFileSync(prodPath, "utf8");
        res.setHeader("Content-Type", "application/json");
        return res.status(200).send(content);
      } else if (fs.existsSync(devPath)) {
        const content = fs.readFileSync(devPath, "utf8");
        res.setHeader("Content-Type", "application/json");
        return res.status(200).send(content);
      } else {
        console.error("manifest.json not found on either path!");
        return res.status(404).setHeader("Content-Type", "application/json").json({ error: "manifest.json not found" });
      }
    } catch (err) {
      console.error("Error reading manifest.json file:", err);
      return res.status(500).setHeader("Content-Type", "application/json").json({ error: "Error reading manifest.json" });
    }
  });

  app.get("/sw.js", (req, res) => {
    const devPath = path.join(publicPath, "sw.js");
    const prodPath = path.join(distPath, "sw.js");

    console.log(`[sw.js request] devPath: ${devPath} (exists: ${fs.existsSync(devPath)}), prodPath: ${prodPath} (exists: ${fs.existsSync(prodPath)})`);

    try {
      if (fs.existsSync(prodPath)) {
        const content = fs.readFileSync(prodPath, "utf8");
        res.setHeader("Content-Type", "application/javascript");
        return res.status(200).send(content);
      } else if (fs.existsSync(devPath)) {
        const content = fs.readFileSync(devPath, "utf8");
        res.setHeader("Content-Type", "application/javascript");
        return res.status(200).send(content);
      } else {
        console.error("sw.js not found on either path!");
        return res.status(404).setHeader("Content-Type", "text/plain").send("sw.js not found");
      }
    } catch (err) {
      console.error("Error reading sw.js file:", err);
      return res.status(500).setHeader("Content-Type", "text/plain").send("Error reading sw.js");
    }
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

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  server.on("error", (err: any) => {
    console.error("Server listen error:", err);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});


