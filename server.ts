import express from "express";
import fs from "fs";
import path from "path";
import { apiHandler } from "./src/server/apiMiddleware";
import { hydrateStorage } from "./src/server/storageService";
import { createServer as createViteServer } from "vite";

async function startServer() {
  // Hydrate persistent images across container restarts and sync JSON records
  try {
    hydrateStorage();
  } catch (err) {
    console.warn("[Server] Storage hydration warning:", err);
  }

  const app = express();
  const PORT = 3000;

  // Support JSON and urlencoded bodies up to 25mb for high-res photo uploads
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ extended: true, limit: "25mb" }));

  // Mount API & Upload handlers FIRST
  app.use(apiHandler);

  // Statically serve uploads directory with no-cache revalidation so updated images appear immediately
  const publicUploadsPath = path.join(process.cwd(), "public/uploads");
  const distUploadsPath = path.join(process.cwd(), "dist/uploads");
  const distClientUploadsPath = path.join(process.cwd(), "dist/client/uploads");
  const uploadStaticOptions = {
    etag: true,
    lastModified: true,
    setHeaders: (res: express.Response) => {
      res.setHeader("Cache-Control", "no-cache, must-revalidate");
      res.setHeader("Access-Control-Allow-Origin", "*");
    },
  };
  app.use("/uploads", express.static(publicUploadsPath, uploadStaticOptions));
  app.use("/uploads", express.static(distUploadsPath, uploadStaticOptions));
  app.use("/uploads", express.static(distClientUploadsPath, uploadStaticOptions));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distClientPath = path.join(process.cwd(), "dist/client");
    const distPath = fs.existsSync(distClientPath) ? distClientPath : path.join(process.cwd(), "dist");
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith(".html") || filePath.endsWith(".json")) {
            res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
            res.setHeader("Pragma", "no-cache");
            res.setHeader("Expires", "0");
          }
        },
      })
    );
    // Express v5 syntax for catch-all route
    app.get("*all", (_req, res) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
