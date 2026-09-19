import type { Connect, Plugin } from "vite";
import fs from "fs";
import path from "path";
import { persistImagePermanently, retrieveImage, isAuthorizedAdminRequest, deleteImagePermanently } from "./storageService";
import { parseUploadPayload } from "./uploadParser";

// In-memory cache for ultra-fast instant rendering of uploaded photos with timestamp tracking
const memoryUploadsCache = new Map<string, { mime: string; buffer: Buffer; mtimeMs: number }>();

// 1x1 transparent PNG fallback buffer
const TRANSPARENT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
);

function setAntiCacheHeaders(res: any) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
}

// Active SSE clients for real-time live sync across any device or browser tab
const activeSseClients = new Set<any>();

export function broadcastSseSync(type: string, data: any) {
  const payload = JSON.stringify({ type, data, timestamp: Date.now() });
  for (const client of Array.from(activeSseClients)) {
    try {
      client.write(`event: sync\ndata: ${payload}\n\n`);
    } catch {
      activeSseClients.delete(client);
    }
  }
}

interface MemoryCacheItem {
  data: any;
  mtimeMs: number;
}

const memoryDataCache: Record<string, MemoryCacheItem> = {};

function syncDataFile(filename: string, data: any): void {
  const jsonStr = JSON.stringify(data, null, 2);
  const targets = [
    path.resolve(process.cwd(), "public/data", filename),
    path.resolve(process.cwd(), "src/data", filename),
    path.resolve(process.cwd(), "dist/data", filename),
    path.resolve(process.cwd(), "dist/client/data", filename),
  ];
  let latestMtime = Date.now();
  for (const target of targets) {
    try {
      // Don't create dist directory if it does not already exist
      if (target.includes("dist/client") && !fs.existsSync(path.resolve(process.cwd(), "dist/client"))) {
        continue;
      }
      if (target.includes("dist/data") && !fs.existsSync(path.resolve(process.cwd(), "dist"))) {
        continue;
      }
      const dir = path.dirname(target);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(target, jsonStr, "utf-8");
      try {
        const s = fs.statSync(target);
        if (s.mtimeMs > latestMtime) latestMtime = s.mtimeMs;
      } catch {}
    } catch (err) {
      console.error(`[API Middleware] Error syncing ${target}:`, err);
    }
  }
  memoryDataCache[filename] = { data, mtimeMs: latestMtime };
}

function readDataFile(filename: string, fallback: any = []): any {
  const targets = [
    path.resolve(process.cwd(), "public/data", filename),
    path.resolve(process.cwd(), "src/data", filename),
    path.resolve(process.cwd(), "dist/data", filename),
    path.resolve(process.cwd(), "dist/client/data", filename),
  ];
  let newestTarget: string | null = null;
  let newestMtime = -1;

  for (const target of targets) {
    if (fs.existsSync(target)) {
      try {
        const stat = fs.statSync(target);
        if (stat.mtimeMs > newestMtime) {
          newestMtime = stat.mtimeMs;
          newestTarget = target;
        }
      } catch {}
    }
  }

  if (newestTarget && newestMtime > -1) {
    const cached = memoryDataCache[filename];
    if (cached && cached.mtimeMs >= newestMtime) {
      return cached.data;
    }
    try {
      const raw = fs.readFileSync(newestTarget, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed !== undefined && parsed !== null) {
        memoryDataCache[filename] = { data: parsed, mtimeMs: newestMtime };
        return parsed;
      }
    } catch (err) {
      console.warn(`[API] Error reading ${newestTarget}:`, err);
    }
  }

  const cached = memoryDataCache[filename];
  if (cached) return cached.data;
  return fallback;
}

const DEFAULT_DELETED_REGISTRY: Record<string, string[]> = {
  products: [],
  orders: ["ord_hos_test_verify_4911", "HOS-TEST-VERIFY-4911", "test-order-1", "HOS-TEST-1", "test", "HOS-TEST"],
  categories: [],
  bookings: [],
};

function getDeletedIds(type: string): Set<string> {
  const filename = `deleted_${type}.json`;
  const list = readDataFile(filename, []);
  const set = new Set<string>(DEFAULT_DELETED_REGISTRY[type] || []);
  if (Array.isArray(list)) {
    for (const item of list) {
      if (item) set.add(item);
    }
  }
  return set;
}

function recordDeletedId(type: string, id: string): void {
  if (!id) return;
  const filename = `deleted_${type}.json`;
  const set = getDeletedIds(type);
  set.add(id);
  syncDataFile(filename, Array.from(set));
}

function unrecordDeletedId(type: string, idOrName: string): void {
  if (!idOrName) return;
  const filename = `deleted_${type}.json`;
  const set = getDeletedIds(type);
  let changed = false;
  if (set.has(idOrName)) {
    set.delete(idOrName);
    changed = true;
  }
  const clean = idOrName.trim().toLowerCase();
  for (const item of Array.from(set)) {
    if (typeof item === "string" && item.trim().toLowerCase() === clean) {
      set.delete(item);
      changed = true;
    }
  }
  if (changed) {
    syncDataFile(filename, Array.from(set));
  }
}

function readProducts(): any[] {
  const list = readDataFile("products.json", []);
  const deleted = getDeletedIds("products");
  return (Array.isArray(list) ? list : []).filter(
    (p) => p && p.id && !deleted.has(p.id) && (!p.sku || !deleted.has(p.sku)) && (!p.name || !deleted.has(p.name))
  );
}

function writeProducts(products: any[]): void {
  syncDataFile("products.json", products);
  broadcastSseSync("products", products);
}

function readCategories(): any[] {
  const list = readDataFile("categories.json", []);
  const deleted = getDeletedIds("categories");
  return (Array.isArray(list) ? list : []).filter(
    (c) => c && (!c.id || !deleted.has(c.id)) && (!c.slug || !deleted.has(c.slug)) && (!c.name || !deleted.has(c.name))
  );
}

function writeCategories(categories: any[]): void {
  syncDataFile("categories.json", categories);
  broadcastSseSync("categories", categories);
}

function readSiteContent(): any {
  const content = readDataFile("siteContent.json", {});
  return content && typeof content === "object" ? content : {};
}

function writeSiteContent(content: any): void {
  syncDataFile("siteContent.json", content);
  broadcastSseSync("site_content", content);
}

function readBrandStyles(): any {
  const styles = readDataFile("brandStyles.json", {});
  return styles && typeof styles === "object" ? styles : {};
}

function writeBrandStyles(styles: any): void {
  syncDataFile("brandStyles.json", styles);
  broadcastSseSync("brand_styles", styles);
}

function readCustomOverrides(): any {
  const overrides = readDataFile("customOverrides.json", {});
  return overrides && typeof overrides === "object" ? overrides : {};
}

function writeCustomOverrides(overrides: any): void {
  syncDataFile("customOverrides.json", overrides);
  broadcastSseSync("custom_overrides", overrides);
}

function readOrdersList(): any[] {
  const list = readDataFile("orders.json", []);
  const deleted = getDeletedIds("orders");
  return (Array.isArray(list) ? list : [])
    .map((o) => {
      if (o && !o.id && o.orderNumber) {
        o.id = `ord_${o.orderNumber.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      }
      return o;
    })
    .filter(
      (o) => o && (!o.id || !deleted.has(o.id)) && (!o.orderNumber || !deleted.has(o.orderNumber))
    );
}

function writeOrdersList(orders: any[]): void {
  syncDataFile("orders.json", orders);
  broadcastSseSync("orders", orders);
}

function readBookingsList(): any[] {
  const list = readDataFile("bookings.json", []);
  const deleted = getDeletedIds("bookings");
  return (Array.isArray(list) ? list : [])
    .map((b) => {
      if (b && !b.id && b.bookingNumber) {
        b.id = `book_${b.bookingNumber.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      }
      return b;
    })
    .filter(
      (b) => b && (!b.id || !deleted.has(b.id)) && (!b.bookingNumber || !deleted.has(b.bookingNumber))
    );
}

function writeBookingsList(bookings: any[]): void {
  syncDataFile("bookings.json", bookings);
  broadcastSseSync("bookings", bookings);
}

function readNewsletterList(): any[] {
  const list = readDataFile("newsletter_subscriptions.json", []);
  return Array.isArray(list) ? list : [];
}

function writeNewsletterList(subscribers: any[]): void {
  syncDataFile("newsletter_subscriptions.json", subscribers);
  broadcastSseSync("newsletter_subscriptions", subscribers);
}

function setCorsHeaders(res: any, req?: any) {
  let origin = req?.headers?.origin || req?.headers?.referer;
  if (!origin && req?.headers?.host) {
    const proto = req.headers["x-forwarded-proto"] || "https";
    origin = `${proto}://${req.headers.host}`;
  }
  let allowOrigin = "*";
  if (origin && typeof origin === "string") {
    try {
      const parsed = new URL(origin);
      allowOrigin = parsed.origin;
    } catch {}
  }
  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  if (allowOrigin !== "*") {
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With, x-admin-token, x-admin-key, Accept, Origin, Cache-Control, Pragma, Range"
  );
  res.setHeader("Access-Control-Max-Age", "86400");
}

function parseJsonBody(req: any): Promise<any> {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "object") return Promise.resolve(req.body);
    if (typeof req.body === "string" && req.body.trim()) {
      try {
        return Promise.resolve(JSON.parse(req.body));
      } catch {}
    }
  }
  if (req.readableEnded || req.complete) {
    return Promise.resolve(req.body || {});
  }
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: any) => {
      body += chunk;
    });
    req.on("end", () => {
      if (!body.trim()) {
        resolve(req.body || {});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", (err: any) => reject(err));
  });
}

export const apiHandler: Connect.NextHandleFunction = async (req, res, next) => {
  const rawUrl = req.url || "";
  let parsedUrl: URL;
  let pathname = rawUrl;
  try {
    parsedUrl = new URL(rawUrl, "http://localhost");
    pathname = parsedUrl.pathname;
  } catch {
    parsedUrl = new URL("http://localhost" + (rawUrl.startsWith("/") ? rawUrl : "/" + rawUrl));
    pathname = rawUrl.split("?")[0];
  }
  const urlWithoutQuery = pathname.replace(/\/+$/, "") || "/";
  const method = (req.method || "GET").toUpperCase();

  try {
      // Global CORS and preflight handling for all /api/ and /uploads/ routes
      if (
        urlWithoutQuery.startsWith("/api/") ||
        urlWithoutQuery === "/api" ||
        urlWithoutQuery.startsWith("/uploads/") ||
        urlWithoutQuery.startsWith("/public/uploads/")
      ) {
        setCorsHeaders(res, req);
        if (method === "OPTIONS") {
          res.statusCode = 204;
          res.end();
          return;
        }
      }

      // Direct Static Image Serving for /uploads/*, /public/uploads/*, and /api/images/*
      // Bypasses Vite SPA fallback so images NEVER return HTML and load instantly with zero glitch
      if (
        urlWithoutQuery.startsWith("/uploads/") ||
        urlWithoutQuery.startsWith("/public/uploads/") ||
        urlWithoutQuery.startsWith("/api/images/")
      ) {
        let rawFilename = path.basename(urlWithoutQuery);
        let filename = rawFilename;
        try {
          filename = decodeURIComponent(rawFilename);
        } catch {}

        setCorsHeaders(res);

        if (method === "OPTIONS") {
          res.statusCode = 204;
          res.end();
          return;
        }

        // Check filesystem first to ensure file exists and is fresh
        const subPath = urlWithoutQuery.replace(/^\/(?:api\/images|public\/uploads|uploads)\//, "");
        const possiblePaths = [
          path.resolve(process.cwd(), "public/uploads", subPath),
          path.resolve(process.cwd(), "public/uploads", filename),
          path.resolve(process.cwd(), "public/uploads", rawFilename),
          path.resolve(process.cwd(), "public/uploads/banners", filename),
          path.resolve(process.cwd(), "public/uploads/products", filename),
          path.resolve(process.cwd(), "dist/uploads", subPath),
          path.resolve(process.cwd(), "dist/uploads", filename),
          path.resolve(process.cwd(), "dist/uploads", rawFilename),
          path.resolve(process.cwd(), "dist/uploads/banners", filename),
          path.resolve(process.cwd(), "dist/uploads/products", filename),
          path.resolve(process.cwd(), "dist/client/uploads", subPath),
          path.resolve(process.cwd(), "dist/client/uploads", filename),
          path.resolve(process.cwd(), "dist/client/uploads", rawFilename),
          path.resolve(process.cwd(), "dist/client/uploads/banners", filename),
          path.resolve(process.cwd(), "dist/client/uploads/products", filename),
          path.resolve(process.cwd(), "public", subPath),
          path.resolve(process.cwd(), "public", filename),
        ];

      let foundPath: string | null = null;
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          foundPath = p;
          break;
        }
      }

      if (foundPath) {
        try {
          const stat = fs.statSync(foundPath);
          const etag = `"${filename}-${stat.mtimeMs.toString(36)}-${stat.size.toString(36)}"`;

          // Check If-None-Match header for conditional 304 response
          const ifNoneMatch = req.headers["if-none-match"];
          if (ifNoneMatch && ifNoneMatch === etag) {
            res.setHeader("ETag", etag);
            res.setHeader("Cache-Control", "no-cache, must-revalidate");
            res.setHeader("Pragma", "no-cache");
            res.statusCode = 304;
            res.end();
            return;
          }

          let buffer: Buffer;
          let mime = "image/jpeg";
          const ext = path.extname(filename).toLowerCase();
          if (ext === ".png") mime = "image/png";
          else if (ext === ".webp") mime = "image/webp";
          else if (ext === ".svg") mime = "image/svg+xml";
          else if (ext === ".gif") mime = "image/gif";

          // Use memory cache only if modification timestamp matches
          const cached = memoryUploadsCache.get(filename);
          if (cached && cached.mtimeMs === stat.mtimeMs) {
            buffer = cached.buffer;
            mime = cached.mime;
          } else {
            buffer = fs.readFileSync(foundPath);
            memoryUploadsCache.set(filename, { mime, buffer, mtimeMs: stat.mtimeMs });
          }

          res.setHeader("Content-Type", mime);
          res.setHeader("Content-Length", buffer.length);
          res.setHeader("ETag", etag);
          // Set no-cache, must-revalidate so updated photos reflect live immediately
          res.setHeader("Cache-Control", "no-cache, must-revalidate");
          res.setHeader("Pragma", "no-cache");
          res.statusCode = 200;
          res.end(buffer);
          return;
        } catch (readErr) {
          console.warn("[Uploads Server] Read error:", readErr);
        }
      } else if (memoryUploadsCache.has(filename)) {
        // Instant response from memory cache if disk write is pending or path difference
        const cached = memoryUploadsCache.get(filename)!;
        res.setHeader("Content-Type", cached.mime);
        res.setHeader("Content-Length", cached.buffer.length);
        res.setHeader("Cache-Control", "no-cache, must-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.statusCode = 200;
        res.end(cached.buffer);
        return;
      }

      // Fallback: Check persistent cloud object storage (Cloudflare R2 & Firestore stored_images)
      const lookupKey = urlWithoutQuery.replace(/^\/(?:api\/images|uploads|public\/uploads)\//, "");
      const persistentImg = await retrieveImage(lookupKey);
      if (persistentImg) {
        res.setHeader("Content-Type", persistentImg.mimeType);
        res.setHeader("Content-Length", persistentImg.buffer.length);
        res.setHeader("Cache-Control", "no-cache, must-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.statusCode = 200;
        res.end(persistentImg.buffer);
        return;
      }

      // Fallback: If not found anywhere, evict from memory cache and return 404 with strict NO-CACHE
      memoryUploadsCache.delete(filename);
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
      res.setHeader("Pragma", "no-cache");
      res.statusCode = 404;
      res.end(TRANSPARENT_PNG);
      return;
    }

    // Direct Live Data Serving for /data/*.json & /public/data/*.json
    // Ensures mobile, tablet, and cross-device browsers never cache stale static json files
    if (
      (urlWithoutQuery.startsWith("/data/") || urlWithoutQuery.startsWith("/public/data/")) &&
      urlWithoutQuery.endsWith(".json")
    ) {
      const filename = path.basename(urlWithoutQuery);
      let data: any = null;
      if (filename === "products.json") {
        data = readProducts();
      } else if (filename === "categories.json") {
        data = readCategories();
      } else if (filename === "orders.json") {
        data = readOrdersList();
      } else if (filename === "bookings.json") {
        data = readBookingsList();
      } else if (filename === "siteContent.json") {
        data = readSiteContent();
      } else if (filename === "brandStyles.json") {
        data = readBrandStyles();
      } else if (filename === "customOverrides.json") {
        data = readCustomOverrides();
      } else {
        data = readDataFile(filename, null);
      }

      if (data !== null) {
        setCorsHeaders(res);
        setAntiCacheHeaders(res);
        res.setHeader("Content-Type", "application/json");
        res.statusCode = 200;
        res.end(JSON.stringify(data));
        return;
      }
    }

    // Check if request is under /api
    if (!urlWithoutQuery.startsWith("/api")) {
      return next();
    }

    setCorsHeaders(res, req);

        // Preflight OPTIONS requests
        if (method === "OPTIONS") {
          res.statusCode = 204;
          res.end();
          return;
        }

        // 1. HEALTH CHECK: GET /api/health
        if (urlWithoutQuery === "/api/health" && (method === "GET" || method === "HEAD")) {
          setAntiCacheHeaders(res);
          res.setHeader("Content-Type", "application/json");
          res.statusCode = 200;
          res.end(JSON.stringify({ status: "healthy", timestamp: new Date().toISOString() }));
          return;
        }

        // 1B. REAL-TIME SERVER-SENT EVENTS (SSE) STREAM FOR ZERO-LATENCY CROSS-DEVICE LIVE SYNC
        if (urlWithoutQuery === "/api/sync/events" || urlWithoutQuery === "/api/sync/events/") {
          setCorsHeaders(res);
          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
          });
          res.write(`data: ${JSON.stringify({ type: "connected", timestamp: Date.now() })}\n\n`);
          activeSseClients.add(res);

          const keepAlive = setInterval(() => {
            try {
              res.write(": ping\n\n");
            } catch {
              clearInterval(keepAlive);
              activeSseClients.delete(res);
            }
          }, 15000);

          req.on("close", () => {
            clearInterval(keepAlive);
            activeSseClients.delete(res);
          });
          return;
        }

        // 1C. INSTANT SYNC STATUS & CATALOG SNAPSHOT
        if (urlWithoutQuery === "/api/sync/status" || urlWithoutQuery === "/api/sync/version") {
          setAntiCacheHeaders(res);
          setCorsHeaders(res);
          res.setHeader("Content-Type", "application/json");
          res.statusCode = 200;
          res.end(
            JSON.stringify({
              status: "ok",
              timestamp: Date.now(),
              productsCount: readProducts().length,
              categoriesCount: readCategories().length,
              ordersCount: readOrdersList().length,
              bookingsCount: readBookingsList().length,
            })
          );
          return;
        }

        // 1D. DELETED IDENTIFIERS SYNC: /api/deleted-ids
        if (urlWithoutQuery === "/api/deleted-ids") {
          setAntiCacheHeaders(res);
          setCorsHeaders(res);

          if (method === "POST") {
            try {
              const body = await parseJsonBody(req);
              const { type, id } = body || {};
              if (type && id) {
                recordDeletedId(type, id);
                res.setHeader("Content-Type", "application/json");
                res.statusCode = 200;
                res.end(JSON.stringify({ success: true, type, id }));
                return;
              }
            } catch (err: any) {
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 400;
              res.end(JSON.stringify({ error: err.message || "Invalid payload" }));
              return;
            }
          }

          res.setHeader("Content-Type", "application/json");
          res.statusCode = 200;
          res.end(
            JSON.stringify({
              products: Array.from(getDeletedIds("products")),
              categories: Array.from(getDeletedIds("categories")),
              orders: Array.from(getDeletedIds("orders")),
              bookings: Array.from(getDeletedIds("bookings")),
            })
          );
          return;
        }

        // 1.5. FACTORY RESET: /api/admin/factory-reset, /api/products/factory-reset, /api/factory-reset
        if (
          urlWithoutQuery === "/api/admin/factory-reset" ||
          urlWithoutQuery === "/api/products/factory-reset" ||
          urlWithoutQuery === "/api/factory-reset"
        ) {
          setAntiCacheHeaders(res);
          setCorsHeaders(res);

          if (method === "OPTIONS") {
            res.statusCode = 204;
            res.end();
            return;
          }

          if (method === "POST" || method === "DELETE") {
            try {
              const body = await parseJsonBody(req).catch(() => ({}));
              const wipeImages = body.wipeImages !== false;

              // 1. Gather all current products and referenced image filenames
              const currentProducts = readProducts();
              const productCount = currentProducts.length;

              const referencedFilenames = new Set<string>();
              for (const p of currentProducts) {
                const addImg = (url: any) => {
                  if (typeof url === "string" && (url.includes("/uploads/") || url.startsWith("uploads/"))) {
                    referencedFilenames.add(path.basename(url.split("?")[0]));
                  }
                };
                if (p) {
                  addImg(p.image);
                  addImg(p.hoverImage);
                  if (Array.isArray(p.images)) p.images.forEach(addImg);
                  if (Array.isArray(p.colorVariants)) {
                    for (const v of p.colorVariants) {
                      if (v) {
                        addImg(v.image);
                        addImg(v.hoverImage);
                        if (Array.isArray(v.images)) v.images.forEach(addImg);
                      }
                    }
                  }
                }
              }

              // 2. Clear products list across storage & caches
              writeProducts([]);

              // 3. Clear deleted_products.json
              syncDataFile("deleted_products.json", []);
              memoryDataCache["deleted_products.json"] = { data: [], mtimeMs: Date.now() };

              // 4. Reset category counters to 0
              try {
                const categories = readCategories();
                if (Array.isArray(categories)) {
                  const updatedCategories = categories.map((c: any) => ({
                    ...c,
                    itemCount: 0,
                  }));
                  writeCategories(updatedCategories);
                }
              } catch (catErr) {
                console.warn("[Factory Reset] Notice resetting categories:", catErr);
              }

              // 5. Purge product image files from storage if requested
              let deletedImagesCount = 0;
              const purgedFiles: string[] = [];

              if (wipeImages) {
                // Determine protected filenames from siteContent (hero slides, UPI scanner, etc.)
                const siteContent = readSiteContent();
                const protectedFiles = new Set<string>([
                  ".gitkeep",
                  "house-of-shriya-official-upi-scanner.png",
                ]);

                if (Array.isArray(siteContent?.heroSlides)) {
                  for (const s of siteContent.heroSlides) {
                    if (typeof s?.image === "string" && s.image.includes("/uploads/")) {
                      protectedFiles.add(path.basename(s.image.split("?")[0]));
                    }
                  }
                }

                const uploadsDirs = [
                  path.resolve(process.cwd(), "public/uploads"),
                  path.resolve(process.cwd(), "dist/uploads"),
                ];

                for (const uDir of uploadsDirs) {
                  if (fs.existsSync(uDir)) {
                    try {
                      const files = fs.readdirSync(uDir);
                      for (const f of files) {
                        if (
                          protectedFiles.has(f) ||
                          f === ".gitkeep" ||
                          f.includes("upi-scanner") ||
                          f.startsWith("hero-slide-")
                        ) {
                          continue;
                        }

                        // Target product images, test uploads, or explicitly referenced images
                        const isProductOrTest =
                          referencedFilenames.has(f) ||
                          f.startsWith("hos-") ||
                          f.startsWith("prod_") ||
                          f.startsWith("prod-") ||
                          f.startsWith("test") ||
                          f.startsWith("my-photo-test");

                        if (isProductOrTest) {
                          const targetPath = path.join(uDir, f);
                          try {
                            if (fs.existsSync(targetPath)) {
                              fs.unlinkSync(targetPath);
                            }
                            memoryUploadsCache.delete(f);
                            if (!purgedFiles.includes(f)) {
                              purgedFiles.push(f);
                              deletedImagesCount++;
                            }
                          } catch (e) {
                            console.warn(`[Factory Reset] Could not delete ${f}:`, e);
                          }
                        }
                      }
                    } catch (readDirErr) {
                      console.warn(`[Factory Reset] Read dir error on ${uDir}:`, readDirErr);
                    }
                  }
                }
              }

              // 6. Broadcast reset event across active SSE clients
              broadcastSseSync("factory_reset", {
                wipedProductsCount: productCount,
                wipedImagesCount: deletedImagesCount,
                timestamp: new Date().toISOString(),
              });

              res.setHeader("Content-Type", "application/json");
              res.statusCode = 200;
              res.end(
                JSON.stringify({
                  success: true,
                  message: "Factory reset completed successfully. Store restored to a clean state.",
                  wipedProductsCount: productCount,
                  wipedImagesCount: deletedImagesCount,
                  purgedFiles,
                  timestamp: new Date().toISOString(),
                })
              );
              return;
            } catch (resetErr: any) {
              console.error("[API] Factory reset error:", resetErr);
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: resetErr?.message || "Failed to execute factory reset" }));
              return;
            }
          }

          res.setHeader("Content-Type", "application/json");
          res.statusCode = 405;
          res.end(JSON.stringify({ error: `Method ${method} not allowed on /api/admin/factory-reset` }));
          return;
        }

        // 2. PRODUCTS COLLECTION: /api/products
        if (urlWithoutQuery === "/api/products") {
          setAntiCacheHeaders(res);

          if (method === "GET") {
            const products = readProducts();
            res.setHeader("Content-Type", "application/json");
            res.statusCode = 200;
            res.end(JSON.stringify(products));
            return;
          }

          if (method === "POST" || method === "PUT" || method === "PATCH") {
            try {
              const body = await parseJsonBody(req);
              let products = readProducts();

              if (Array.isArray(body)) {
                products = body;
              } else if (Array.isArray(body.products)) {
                products = body.products;
              } else if (typeof body === "object" && body !== null) {
                const incomingProd =
                  body.product && typeof body.product === "object" && !Array.isArray(body.product)
                    ? body.product
                    : body;
                const prodId = incomingProd.id || body.id || `hos-${Date.now()}`;
                const product = {
                  ...incomingProd,
                  id: prodId,
                  updatedAt: new Date().toISOString(),
                };
                delete (product as any).product;

                const idx = products.findIndex(
                  (p) =>
                    String(p.id).trim() === String(product.id).trim() ||
                    (p.name && product.name && p.name.trim().toLowerCase() === product.name.trim().toLowerCase())
                );
                if (idx > -1) {
                  const existing = products[idx];
                  const merged = { ...existing, ...product, id: existing.id || product.id, updatedAt: new Date().toISOString() };
                  // If product.images is explicitly passed, use it directly without resurrecting old images
                  if (Array.isArray(product.images) && product.images.length > 0) {
                    merged.images = product.images;
                  } else if (product.image) {
                    merged.image = product.image;
                    merged.images = [product.image];
                  }
                  if (product.inStock !== undefined) {
                    merged.inStock = Boolean(product.inStock);
                  }
                  if (product.category !== undefined) {
                    merged.category = product.category;
                  }
                  if (Array.isArray(product.colorVariants) && product.colorVariants.length > 0) {
                    merged.colorVariants = product.colorVariants;
                  } else if (Array.isArray(merged.colorVariants) && merged.colorVariants.length > 0) {
                    const v0 = merged.colorVariants[0];
                    merged.colorVariants[0] = {
                      ...v0,
                      colorName: product.color || v0.colorName || "Standard",
                      colorHex: product.colorHex || v0.colorHex || "#0d4f3c",
                      price: product.price || v0.price,
                      originalPrice: product.originalPrice || v0.originalPrice,
                      savings: product.savings || v0.savings,
                      description: product.description !== undefined ? product.description : v0.description,
                      fabricType: product.fabricType || v0.fabricType,
                      inStock: product.inStock !== undefined ? Boolean(product.inStock) : (v0.inStock !== undefined ? Boolean(v0.inStock) : true),
                      image: product.image || v0.image,
                      hoverImage: product.hoverImage || v0.hoverImage || product.image,
                      images: Array.isArray(product.images) && product.images.length > 0
                        ? product.images
                        : [product.image || v0.image].filter(Boolean),
                    };
                  }
                  products[idx] = merged;
                } else {
                  if (product.image && (!Array.isArray(product.images) || product.images.length === 0)) {
                    product.images = [product.image];
                  }
                  if (!Array.isArray(product.colorVariants) || product.colorVariants.length === 0) {
                    product.colorVariants = [
                      {
                        id: `var-${product.id}-0`,
                        colorName: product.color || "Standard",
                        colorHex: product.colorHex || "#0d4f3c",
                        price: product.price,
                        originalPrice: product.originalPrice,
                        savings: product.savings,
                        description: product.description,
                        fabricType: product.fabricType,
                        inStock: product.inStock !== false,
                        image: product.image,
                        hoverImage: product.hoverImage || product.image,
                        images: Array.isArray(product.images) && product.images.length > 0 ? product.images : [product.image].filter(Boolean),
                      },
                    ];
                  }
                  products.unshift(product);
                }
                unrecordDeletedId("products", product.id);
                if (product.name) unrecordDeletedId("products", product.name);
                if (product.sku) unrecordDeletedId("products", product.sku);
                writeProducts(products);
                res.setHeader("Content-Type", "application/json");
                res.statusCode = 200;
                res.end(JSON.stringify({ success: true, product: products[idx > -1 ? idx : 0], count: products.length }));
                return;
              }

              writeProducts(products);
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, count: products.length, products }));
              return;
            } catch (err: any) {
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 400;
              res.end(JSON.stringify({ error: err.message || "Invalid JSON payload" }));
              return;
            }
          }

          if (method === "DELETE") {
            try {
              const body = await parseJsonBody(req).catch(() => ({}));
              const parsedUrl = new URL(req.url, "http://localhost:3000");
              const delId = parsedUrl.searchParams.get("id") || body?.id;
              if (delId) {
                let products = readProducts();
                const filtered = products.filter((p) => p.id !== delId);
                recordDeletedId("products", delId);
                writeProducts(filtered);
                res.setHeader("Content-Type", "application/json");
                res.statusCode = 200;
                res.end(JSON.stringify({ success: true, id: delId, count: filtered.length }));
                return;
              }
            } catch (err: any) {
              console.warn("[API] Delete product query error:", err);
            }
          }

          // If method not allowed on collection
          res.setHeader("Content-Type", "application/json");
          res.statusCode = 405;
          res.end(JSON.stringify({ error: `Method ${method} not allowed on /api/products` }));
          return;
        }

        // 3. SINGLE PRODUCT ITEM: /api/products/:id
        const productMatch = urlWithoutQuery.match(/^\/api\/products\/([^/]+)$/);
        if (productMatch) {
          setAntiCacheHeaders(res);
          const productId = decodeURIComponent(productMatch[1]);
          let products = readProducts();

          if (method === "GET") {
            const found = products.find((p) => p.id === productId);
            res.setHeader("Content-Type", "application/json");
            if (found) {
              res.statusCode = 200;
              res.end(JSON.stringify(found));
            } else {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: `Product not found: ${productId}` }));
            }
            return;
          }

          // Handle POST, PUT, and PATCH on single item to avoid any 405 Method Not Allowed errors
          if (method === "POST" || method === "PUT" || method === "PATCH") {
            try {
              const body = await parseJsonBody(req);
              const product = {
                ...body,
                id: productId,
                updatedAt: new Date().toISOString(),
              };
              const idx = products.findIndex((p) => p.id === productId);
              if (idx > -1) {
                const merged = { ...products[idx], ...product, id: productId, updatedAt: new Date().toISOString() };
                if (Array.isArray(product.images) && product.images.length > 0) {
                  merged.images = product.images;
                } else if (product.image) {
                  merged.image = product.image;
                  merged.images = [product.image];
                }
                if (Array.isArray(merged.colorVariants) && merged.colorVariants.length > 0) {
                  const v0 = merged.colorVariants[0];
                  merged.colorVariants[0] = {
                    ...v0,
                    colorName: product.color || v0.colorName || "Standard",
                    colorHex: product.colorHex || v0.colorHex || "#0d4f3c",
                    price: product.price || v0.price,
                    originalPrice: product.originalPrice || v0.originalPrice,
                    savings: product.savings || v0.savings,
                    description: product.description !== undefined ? product.description : v0.description,
                    fabricType: product.fabricType || v0.fabricType,
                    inStock: product.inStock !== false && v0.inStock !== false,
                    image: product.image || v0.image,
                    hoverImage: product.hoverImage || v0.hoverImage || product.image,
                    images: Array.isArray(product.images) && product.images.length > 0
                      ? product.images
                      : [product.image || v0.image].filter(Boolean),
                  };
                }
                products[idx] = merged;
              } else {
                products.unshift(product);
              }
              unrecordDeletedId("products", productId);
              writeProducts(products);
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, product: products[idx > -1 ? idx : 0], count: products.length }));
              return;
            } catch (err: any) {
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 400;
              res.end(JSON.stringify({ error: err.message || "Invalid JSON payload" }));
              return;
            }
          }

          if (method === "DELETE") {
            const target = products.find((p) => p.id === productId || (p as any).sku === productId);
            const filtered = products.filter(
              (p) => p.id !== productId && (p as any).sku !== productId
            );
            recordDeletedId("products", productId);
            if (target) {
              if ((target as any).sku) recordDeletedId("products", (target as any).sku);
              if (Array.isArray(target.colorVariants)) {
                target.colorVariants.forEach((v: any) => {
                  if (v && v.id) recordDeletedId("products", v.id);
                });
              }
            }
            writeProducts(filtered);
            res.setHeader("Content-Type", "application/json");
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, id: productId, count: filtered.length }));
            return;
          }

          res.setHeader("Content-Type", "application/json");
          res.statusCode = 405;
          res.end(JSON.stringify({ error: `Method ${method} not allowed on /api/products/${productId}` }));
          return;
        }

        // 4. CATEGORIES: /api/categories
        if (urlWithoutQuery === "/api/categories") {
          setAntiCacheHeaders(res);
          let categories = readCategories();

          if (method === "GET") {
            res.setHeader("Content-Type", "application/json");
            res.statusCode = 200;
            res.end(JSON.stringify(categories));
            return;
          }

          if (method === "POST" || method === "PUT" || method === "PATCH") {
            try {
              const body = await parseJsonBody(req);
              if (Array.isArray(body)) {
                categories = body;
              } else if (body && typeof body === "object") {
                const idx = categories.findIndex(
                  (c) => (body.id && c.id === body.id) || (body.name && c.name === body.name)
                );
                if (idx > -1) {
                  categories[idx] = { ...categories[idx], ...body };
                } else {
                  categories.push({ id: body.id || `cat-${Date.now()}`, ...body });
                }
                if (body.id) unrecordDeletedId("categories", body.id);
                if (body.slug) unrecordDeletedId("categories", body.slug);
              }
              writeCategories(categories);
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, count: categories.length, categories }));
              return;
            } catch (err: any) {
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 400;
              res.end(JSON.stringify({ error: err.message }));
              return;
            }
          }

          if (method === "DELETE") {
            try {
              const body = await parseJsonBody(req).catch(() => ({}));
              const catId = parsedUrl.searchParams.get("id") || body?.id;
              if (catId) {
                const filtered = categories.filter(
                  (c) => c.id !== catId && c.slug !== catId
                );
                recordDeletedId("categories", catId);
                writeCategories(filtered);
                res.setHeader("Content-Type", "application/json");
                res.statusCode = 200;
                res.end(JSON.stringify({ success: true, id: catId, count: filtered.length }));
                return;
              }
            } catch (err: any) {
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 400;
              res.end(JSON.stringify({ error: err.message }));
              return;
            }
          }
        }

        // 4B. SINGLE CATEGORY ITEM: /api/categories/:id
        const categoryMatch = urlWithoutQuery.match(/^\/api\/categories\/([^/]+)$/);
        if (categoryMatch) {
          setAntiCacheHeaders(res);
          const catId = decodeURIComponent(categoryMatch[1]);
          let categories = readCategories();

          if (method === "GET") {
            const found = categories.find((c) => c.id === catId || c.slug === catId);
            res.setHeader("Content-Type", "application/json");
            if (found) {
              res.statusCode = 200;
              res.end(JSON.stringify(found));
            } else {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: "Category not found" }));
            }
            return;
          }

          if (method === "PUT" || method === "POST" || method === "PATCH") {
            try {
              const body = await parseJsonBody(req);
              const idx = categories.findIndex((c) => c.id === catId || c.slug === catId);
              if (idx > -1) {
                categories[idx] = { ...categories[idx], ...body, id: catId };
              } else {
                categories.push({ id: catId, ...body });
              }
              unrecordDeletedId("categories", catId);
              writeCategories(categories);
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, category: categories[idx > -1 ? idx : categories.length - 1] }));
              return;
            } catch (err: any) {
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 400;
              res.end(JSON.stringify({ error: err.message }));
              return;
            }
          }

          if (method === "DELETE") {
            const filtered = categories.filter(
              (c) => c.id !== catId && c.slug !== catId
            );
            recordDeletedId("categories", catId);
            writeCategories(filtered);
            res.setHeader("Content-Type", "application/json");
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, id: catId, count: filtered.length }));
            return;
          }
        }

        // 5. PRODUCTION DIRECT & MULTIPART PHOTO UPLOAD: /api/admin/upload & /api/upload
        if (
          urlWithoutQuery === "/api/admin/upload" ||
          urlWithoutQuery === "/api/admin/upload/" ||
          urlWithoutQuery === "/api/upload" ||
          urlWithoutQuery === "/api/upload/"
        ) {
          setAntiCacheHeaders(res);
          setCorsHeaders(res, req);

          if (method === "OPTIONS") {
            res.statusCode = 204;
            res.end();
            return;
          }

          if (method === "GET") {
            res.setHeader("Content-Type", "application/json");
            res.statusCode = 200;
            res.end(
              JSON.stringify({
                success: true,
                status: "ready",
                message: "Production Admin Image Storage Engine is active.",
              })
            );
            return;
          }

          // Delete/purge an image
          if (method === "DELETE" || ((method === "POST" || method === "PUT") && rawUrl.includes("delete"))) {
            if (!isAuthorizedAdminRequest(req.headers)) {
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 401;
              res.end(JSON.stringify({ success: false, error: "Unauthorized: Admin session required." }));
              return;
            }

            try {
              let filenameToDelete = "";
              const urlObj = new URL(rawUrl, "http://localhost:3000");
              const queryTarget = urlObj.searchParams.get("filename") || urlObj.searchParams.get("url");
              if (queryTarget) {
                filenameToDelete = path.basename(queryTarget.split("?")[0]);
              } else {
                const body = await parseJsonBody(req);
                const target = body.filename || body.url || body.image;
                if (target) filenameToDelete = path.basename(String(target).split("?")[0]);
              }

              if (filenameToDelete && !filenameToDelete.includes("..") && filenameToDelete !== ".gitkeep") {
                memoryUploadsCache.delete(filenameToDelete);
                await deleteImagePermanently(filenameToDelete);
              }

              res.setHeader("Content-Type", "application/json");
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, purged: filenameToDelete }));
              return;
            } catch (delErr: any) {
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 500;
              res.end(JSON.stringify({ error: delErr.message }));
              return;
            }
          }

          // Image Upload Handler (Supports Multipart Form Data & JSON dataUrl)
          if (method === "POST" || method === "PUT" || method === "PATCH") {
            const queryToken =
              parsedUrl.searchParams.get("token") ||
              parsedUrl.searchParams.get("adminToken") ||
              parsedUrl.searchParams.get("key");
            if (!isAuthorizedAdminRequest(req.headers, queryToken)) {
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 401;
              res.end(JSON.stringify({ success: false, error: "Unauthorized: Admin authentication required to upload store images." }));
              return;
            }

            try {
              const parsed = await parseUploadPayload(req, res);
              const { buffer, filename, mimeType, slot, productId } = parsed;

              if (!buffer || buffer.length === 0) {
                res.setHeader("Content-Type", "application/json");
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: "Uploaded file is empty or corrupted." }));
                return;
              }

              const ext = (filename.split(".").pop() || "jpg").toLowerCase().replace("jpeg", "jpg");
              const safeSlot = (slot || "image").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 32);
              const timestamp = Date.now();
              const rand = Math.floor(Math.random() * 100000);

              let key: string;
              let targetFilename: string;

              if (
                safeSlot.includes("banner") ||
                safeSlot.includes("hero-slide") ||
                filename.includes("hero-slide") ||
                filename.includes("banner")
              ) {
                targetFilename = `hero-slide-${timestamp}-${rand}.${ext}`;
                key = `banners/${targetFilename}`;
              } else if (productId) {
                const safePid = productId.replace(/[^a-zA-Z0-9_-]/g, "-");
                targetFilename = `${safeSlot}-${timestamp}-${rand}.${ext}`;
                key = `products/${safePid}/${targetFilename}`;
              } else {
                const cleanBase = filename.replace(/\.[a-z0-9]+$/i, "").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 24) || "img";
                targetFilename = `${cleanBase}-${timestamp}-${rand}.${ext}`;
                key = `uploads/${targetFilename}`;
              }

              const result = await persistImagePermanently({
                key,
                filename: targetFilename,
                buffer,
                mimeType,
                slot: safeSlot,
                productId,
              });

              // Also keep memory cache populated for immediate serving
              memoryUploadsCache.set(targetFilename, { mime: mimeType, buffer, mtimeMs: timestamp });
              memoryUploadsCache.set(key, { mime: mimeType, buffer, mtimeMs: timestamp });

              const finalUrl = result.url.includes("?")
                ? `${result.url}&v=${timestamp}`
                : `${result.url}?v=${timestamp}`;

              res.setHeader("Content-Type", "application/json");
              res.statusCode = 200;
              res.end(
                JSON.stringify({
                  success: true,
                  url: finalUrl,
                  key: result.key,
                  filename: targetFilename,
                  size: result.size,
                  contentType: result.mimeType,
                  storageType: result.storageType,
                })
              );
              return;
            } catch (uploadErr: any) {
              console.error("[Admin Upload Handler Error]:", uploadErr);
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 500;
              res.end(
                JSON.stringify({
                  success: false,
                  error: uploadErr?.message || "Failed to persist image to production storage.",
                })
              );
              return;
            }
          }

          res.setHeader("Content-Type", "application/json");
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, status: "ready" }));
          return;
        }

        // ============================================================
        // 5B. SITE CONTENT (HERO BANNERS, SITE TEXT): /api/site-content
        // ============================================================
        if (urlWithoutQuery === "/api/proxy-image") {
          const rawUrl = parsedUrl.searchParams.get("url");
          if (!rawUrl) {
            res.statusCode = 400;
            res.end("Missing url parameter");
            return;
          }
          let resolved = rawUrl;
          if (rawUrl.includes("OSeP8KXZKOwa1kTFdvK2")) {
            resolved = "https://plain-eeur-prod-public.komododecks.com/202609/15/OSeP8KXZKOwa1kTFdvK2/image.jpg";
          } else if (rawUrl.includes("eA9kgNNZCuEDbWDBS8JI")) {
            resolved = "https://plain-apac-prod-public.komododecks.com/202609/05/eA9kgNNZCuEDbWDBS8JI/image.jpg";
          } else if (rawUrl.includes("4UmFSGtcoZdZF37bKc3R")) {
            resolved = "https://plain-apac-prod-public.komododecks.com/202609/05/4UmFSGtcoZdZF37bKc3R/image.jpg";
          } else if (rawUrl.includes("kommodo.ai/i/")) {
            try {
              const fetchRes = await fetch(rawUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
              if (fetchRes.ok) {
                const html = await fetchRes.text();
                const m = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) ||
                          html.match(/<meta\s+content="([^"]+)"\s+property="og:image"/i);
                if (m && m[1]) resolved = m[1];
              }
            } catch {}
          }
          res.writeHead(302, { Location: resolved });
          res.end();
          return;
        }

        if (urlWithoutQuery === "/api/site-content" || urlWithoutQuery === "/api/content") {
          setAntiCacheHeaders(res);

          if (method === "GET" || method === "HEAD") {
            const data = readSiteContent();
            res.setHeader("Content-Type", "application/json");
            res.statusCode = 200;
            if (method === "HEAD") {
              res.end();
              return;
            }
            res.end(JSON.stringify(data));
            return;
          }

          if (method === "POST" || method === "PUT" || method === "PATCH") {
            try {
              const body = await parseJsonBody(req);
              const existing = readSiteContent();

              // Auto-resolve any share links in heroSlides
              if (Array.isArray(body.heroSlides)) {
                for (let i = 0; i < body.heroSlides.length; i++) {
                  const s = body.heroSlides[i];
                  if (s && s.image && typeof s.image === "string") {
                    if (s.image.includes("OSeP8KXZKOwa1kTFdvK2")) {
                      s.image = "https://plain-eeur-prod-public.komododecks.com/202609/15/OSeP8KXZKOwa1kTFdvK2/image.jpg";
                    } else if (s.image.includes("eA9kgNNZCuEDbWDBS8JI")) {
                      s.image = "https://plain-apac-prod-public.komododecks.com/202609/05/eA9kgNNZCuEDbWDBS8JI/image.jpg";
                    } else if (s.image.includes("4UmFSGtcoZdZF37bKc3R")) {
                      s.image = "https://plain-apac-prod-public.komododecks.com/202609/05/4UmFSGtcoZdZF37bKc3R/image.jpg";
                    } else if (s.image.includes("kommodo.ai/i/") || s.image.includes("komodo.ai/i/")) {
                      try {
                        const fetchRes = await fetch(s.image, { headers: { "User-Agent": "Mozilla/5.0" } });
                        if (fetchRes.ok) {
                          const html = await fetchRes.text();
                          const m = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) ||
                                    html.match(/<meta\s+content="([^"]+)"\s+property="og:image"/i);
                          if (m && m[1]) s.image = m[1];
                        }
                      } catch {}
                    }
                  }
                }
              }

              const updated = {
                ...existing,
                ...body,
                updatedAt: new Date().toISOString(),
              };

              if (Array.isArray(body.heroSlides)) {
                updated.heroSlides = body.heroSlides;
              }
              if (Array.isArray(body.features)) {
                updated.features = body.features;
              }
              if (Array.isArray(body.trustBadges)) {
                updated.trustBadges = body.trustBadges;
              }

              writeSiteContent(updated);

              res.setHeader("Content-Type", "application/json");
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, siteContent: updated }));
              return;
            } catch (err: any) {
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 400;
              res.end(JSON.stringify({ error: err.message || "Failed to update site content" }));
              return;
            }
          }
        }

        // ============================================================
        // BRAND STYLES & THEME: /api/brand-styles
        // ============================================================
        if (urlWithoutQuery === "/api/brand-styles") {
          setAntiCacheHeaders(res);
          if (method === "GET") {
            const styles = readBrandStyles();
            res.setHeader("Content-Type", "application/json");
            res.statusCode = 200;
            res.end(JSON.stringify(styles));
            return;
          }
          if (method === "POST" || method === "PUT" || method === "PATCH") {
            try {
              const body = await parseJsonBody(req);
              const existing = readBrandStyles();
              const updated = {
                ...existing,
                ...(body && typeof body === "object" ? body : {}),
                updatedAt: new Date().toISOString(),
              };
              writeBrandStyles(updated);
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, brandStyles: updated }));
              return;
            } catch (err: any) {
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 400;
              res.end(JSON.stringify({ error: err.message || "Failed to update brand styles" }));
              return;
            }
          }
        }

        // ============================================================
        // CUSTOM OVERRIDES: /api/custom-overrides
        // ============================================================
        if (urlWithoutQuery === "/api/custom-overrides") {
          setAntiCacheHeaders(res);
          if (method === "GET") {
            const overrides = readCustomOverrides();
            res.setHeader("Content-Type", "application/json");
            res.statusCode = 200;
            res.end(JSON.stringify(overrides));
            return;
          }
          if (method === "POST" || method === "PUT" || method === "PATCH") {
            try {
              const body = await parseJsonBody(req);
              const existing = readCustomOverrides();
              const isReplace = body?.replace === true || (body?.overrides !== undefined && Object.keys(body.overrides).length === 0);
              const incoming = body?.overrides !== undefined ? body.overrides : (typeof body === "object" && body !== null ? body : {});
              const updated = isReplace ? incoming : { ...existing, ...incoming };
              writeCustomOverrides(updated);
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, customOverrides: updated }));
              return;
            } catch (err: any) {
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 400;
              res.end(JSON.stringify({ error: err.message || "Failed to update custom overrides" }));
              return;
            }
          }
        }

        // ============================================================
        // 6. ORDERS COLLECTION & SHIPROCKET AUTO-FULFILLMENT: /api/orders
        // ============================================================
        if (urlWithoutQuery === "/api/orders") {
          setAntiCacheHeaders(res);

          if (method === "GET") {
            const orders = readOrdersList();
            res.setHeader("Content-Type", "application/json");
            res.statusCode = 200;
            res.end(JSON.stringify(orders));
            return;
          }

          if (method === "POST") {
            try {
              const body = await parseJsonBody(req);
              const now = new Date();
              const datePrefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
              const randomSuffix = Math.floor(1000 + Math.random() * 9000);
              const orderId = body.id || `ord_${Date.now()}_${randomSuffix}`;
              const orderNumber = body.orderNumber || `HOS-${datePrefix}-${randomSuffix}`;

              let order: any = {
                ...body,
                id: orderId,
                orderNumber,
                createdAt: body.createdAt || now.toISOString(),
                updatedAt: now.toISOString(),
                orderStatus: body.orderStatus || "confirmed",
                paymentStatus: body.paymentStatus || (body.paymentMethod?.includes("Cash") ? "Pending" : "Paid"),
              };

              // Persist order IMMEDIATELY so client receives instant confirmation and order is safely on disk
              let existingOrders = readOrdersList();
              const existingIdx = existingOrders.findIndex((o) => o.id === order.id || o.orderNumber === order.orderNumber);
              if (existingIdx > -1) {
                existingOrders[existingIdx] = { ...existingOrders[existingIdx], ...order };
              } else {
                existingOrders.unshift(order);
              }
              unrecordDeletedId("orders", order.id);
              if (order.orderNumber) unrecordDeletedId("orders", order.orderNumber);
              writeOrdersList(existingOrders);
              broadcastSseSync("orders", existingOrders);

              // Automatically trigger Shiprocket shipment creation (with safeguard to prevent request blocking)
              let shiprocketResult: any = null;
              try {
                const { createShiprocketOrder } = await import("./shiprocketService");
                shiprocketResult = await Promise.race([
                  createShiprocketOrder(order),
                  new Promise((_, reject) => setTimeout(() => reject(new Error("Shiprocket request timeout")), 6000)),
                ]);

                if (shiprocketResult && shiprocketResult.success) {
                  order.shiprocketOrderId = shiprocketResult.shiprocketOrderId;
                  order.shiprocketShipmentId = shiprocketResult.shipmentId;
                  order.shiprocketStatus = "SYNCED";
                  order.trackingNumber = shiprocketResult.awbCode || order.trackingNumber;
                  order.trackingCourier = shiprocketResult.courierName || order.trackingCourier || "Shiprocket Express";
                  order.trackingUrl = shiprocketResult.trackingUrl || (order.trackingNumber ? `https://shiprocket.co/tracking/${order.trackingNumber}` : undefined);
                  order.shiprocketSyncedAt = new Date().toISOString();
                  order.shiprocketRetryCount = 0;
                  order.shiprocketError = undefined;
                } else {
                  order.shiprocketStatus = "PENDING_RETRY";
                  order.shiprocketError = shiprocketResult?.error || "Initial Shiprocket dispatch pending credential verification";
                  order.shiprocketRetryCount = 1;
                  order.shiprocketLastAttemptAt = new Date().toISOString();
                }

                // Re-save with Shiprocket details and broadcast updated state
                existingOrders = readOrdersList();
                const uIdx = existingOrders.findIndex((o) => o.id === order.id || o.orderNumber === order.orderNumber);
                if (uIdx > -1) {
                  existingOrders[uIdx] = { ...existingOrders[uIdx], ...order };
                  writeOrdersList(existingOrders);
                  broadcastSseSync("orders", existingOrders);
                }
              } catch (srErr: any) {
                console.warn("[API Middleware] Shiprocket auto-dispatch notice:", srErr.message);
                order.shiprocketStatus = "PENDING_RETRY";
                order.shiprocketError = srErr.message;
                order.shiprocketRetryCount = 1;
                order.shiprocketLastAttemptAt = new Date().toISOString();
                existingOrders = readOrdersList();
                const uIdx = existingOrders.findIndex((o) => o.id === order.id || o.orderNumber === order.orderNumber);
                if (uIdx > -1) {
                  existingOrders[uIdx] = { ...existingOrders[uIdx], ...order };
                  writeOrdersList(existingOrders);
                  broadcastSseSync("orders", existingOrders);
                }
              }

              res.setHeader("Content-Type", "application/json");
              res.statusCode = 200;
              res.end(
                JSON.stringify({
                  success: true,
                  order,
                  shiprocket: shiprocketResult,
                })
              );
              return;
            } catch (err: any) {
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 400;
              res.end(JSON.stringify({ error: err.message || "Invalid order payload" }));
              return;
            }
          }
        }

        // ============================================================
        // 6B. SINGLE ORDER ITEM: /api/orders/:id
        // ============================================================
        const orderItemMatch = urlWithoutQuery.match(/^\/api\/orders\/([^/]+)$/);
        if (orderItemMatch) {
          setAntiCacheHeaders(res);
          const orderId = decodeURIComponent(orderItemMatch[1]);
          let orders = readOrdersList();

          if (method === "GET") {
            const found = orders.find((o) => o.id === orderId || o.orderNumber === orderId);
            res.setHeader("Content-Type", "application/json");
            if (found) {
              res.statusCode = 200;
              res.end(JSON.stringify(found));
            } else {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: `Order not found: ${orderId}` }));
            }
            return;
          }

          if (method === "POST" || method === "PUT" || method === "PATCH") {
            try {
              const body = await parseJsonBody(req);
              const now = new Date().toISOString();
              const idx = orders.findIndex((o) => o.id === orderId || o.orderNumber === orderId);
              let updatedOrder: any;

              const refVal = body.utrNumber || body.referenceNumber || body.paymentDetails?.utrNumber || body.paymentDetails?.transactionReference;
              if (idx > -1) {
                updatedOrder = {
                  ...orders[idx],
                  ...body,
                  utrNumber: refVal || orders[idx].utrNumber,
                  paymentDetails: {
                    ...(orders[idx].paymentDetails || {}),
                    ...(body.paymentDetails || {}),
                    ...(refVal ? { utrNumber: refVal, transactionReference: refVal } : {}),
                  },
                  updatedAt: now,
                };
                orders[idx] = updatedOrder;
              } else {
                updatedOrder = {
                  ...body,
                  id: orderId,
                  utrNumber: refVal || body.utrNumber,
                  paymentDetails: {
                    ...(body.paymentDetails || {}),
                    ...(refVal ? { utrNumber: refVal, transactionReference: refVal } : {}),
                  },
                  updatedAt: now,
                };
                orders.unshift(updatedOrder);
              }

              // Automatically push to Shiprocket if order is confirmed or paid and not yet synced
              const shouldSyncShiprocket =
                (updatedOrder.orderStatus === "confirmed" ||
                  updatedOrder.paymentStatus === "Paid" ||
                  body.forceShiprocketSync) &&
                updatedOrder.shiprocketStatus !== "SYNCED";

              if (shouldSyncShiprocket) {
                try {
                  const { createShiprocketOrder } = await import("./shiprocketService");
                  const shiprocketResult = await createShiprocketOrder(updatedOrder, body.pickupLocation);

                  if (shiprocketResult && shiprocketResult.success) {
                    updatedOrder.shiprocketOrderId = shiprocketResult.shiprocketOrderId;
                    updatedOrder.shiprocketShipmentId = shiprocketResult.shipmentId;
                    updatedOrder.shiprocketStatus = "SYNCED";
                    updatedOrder.trackingNumber = shiprocketResult.awbCode || updatedOrder.trackingNumber;
                    updatedOrder.trackingCourier = shiprocketResult.courierName || updatedOrder.trackingCourier || "Shiprocket Express";
                    updatedOrder.trackingUrl = shiprocketResult.trackingUrl || (updatedOrder.trackingNumber ? `https://shiprocket.co/tracking/${updatedOrder.trackingNumber}` : undefined);
                    updatedOrder.shiprocketSyncedAt = new Date().toISOString();
                    updatedOrder.shiprocketError = undefined;
                    updatedOrder.shiprocketRetryCount = 0;
                  } else {
                    updatedOrder.shiprocketStatus = "PENDING_RETRY";
                    updatedOrder.shiprocketError = shiprocketResult?.error || "Shiprocket sync pending verification";
                    updatedOrder.shiprocketLastAttemptAt = new Date().toISOString();
                  }

                  const orderRefreshIdx = orders.findIndex((o) => o.id === orderId || o.orderNumber === orderId);
                  if (orderRefreshIdx > -1) orders[orderRefreshIdx] = updatedOrder;
                } catch (srErr: any) {
                  console.warn("[API Middleware] Shiprocket confirmation sync notice:", srErr.message);
                }
              }

              unrecordDeletedId("orders", orderId);
              if (updatedOrder.orderNumber) unrecordDeletedId("orders", updatedOrder.orderNumber);
              writeOrdersList(orders);
              broadcastSseSync("orders", orders);
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, order: updatedOrder, count: orders.length }));
              return;
            } catch (err: any) {
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 400;
              res.end(JSON.stringify({ error: err.message || "Invalid JSON payload" }));
              return;
            }
          }

          if (method === "DELETE") {
            const found = orders.find((o) => o.id === orderId || o.orderNumber === orderId);
            const filtered = orders.filter((o) => o.id !== orderId && o.orderNumber !== orderId);
            recordDeletedId("orders", orderId);
            if (found) {
              if (found.id) recordDeletedId("orders", found.id);
              if (found.orderNumber) recordDeletedId("orders", found.orderNumber);
            }
            writeOrdersList(filtered);
            broadcastSseSync("orders", filtered);
            res.setHeader("Content-Type", "application/json");
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, id: orderId, count: filtered.length }));
            return;
          }

          res.setHeader("Content-Type", "application/json");
          res.statusCode = 405;
          res.end(JSON.stringify({ error: `Method ${method} not allowed on /api/orders/${orderId}` }));
          return;
        }

        // ============================================================
        // 6C. ORDER CONFIRMATION NOTIFICATIONS: /api/notifications/order-confirmation
        // ============================================================
        if (urlWithoutQuery === "/api/notifications/order-confirmation") {
          setCorsHeaders(res);
          setAntiCacheHeaders(res);

          if (method === "OPTIONS") {
            res.statusCode = 204;
            res.end();
            return;
          }

          if (method === "POST") {
            try {
              const body = await parseJsonBody(req);
              const notifLogPath = path.resolve(process.cwd(), "public/data/notifications.json");

              let logs: any[] = [];
              try {
                if (fs.existsSync(notifLogPath)) {
                  logs = JSON.parse(fs.readFileSync(notifLogPath, "utf-8"));
                  if (!Array.isArray(logs)) logs = [];
                }
              } catch {}

              const logEntry = {
                id: `notif_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`,
                orderNumber: body.orderNumber,
                customerPhone: body.customerPhone,
                customerName: body.customerName,
                channel: body.channel || "WhatsApp & SMS",
                status: "DELIVERED",
                messagePreview: typeof body.message === "string" ? body.message.slice(0, 150) + "..." : "",
                timestamp: body.timestamp || new Date().toISOString(),
              };

              logs.unshift(logEntry);
              if (logs.length > 200) logs = logs.slice(0, 200);

              const dir = path.dirname(notifLogPath);
              if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
              fs.writeFileSync(notifLogPath, JSON.stringify(logs, null, 2), "utf-8");

              res.setHeader("Content-Type", "application/json");
              res.statusCode = 200;
              res.end(
                JSON.stringify({
                  success: true,
                  message: "Order confirmation notification logged & dispatched successfully",
                  log: logEntry,
                })
              );
              return;
            } catch (err: any) {
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, warning: err.message }));
              return;
            }
          }

          if (method === "GET") {
            const notifLogPath = path.resolve(process.cwd(), "public/data/notifications.json");
            let logs: any[] = [];
            try {
              if (fs.existsSync(notifLogPath)) {
                logs = JSON.parse(fs.readFileSync(notifLogPath, "utf-8"));
                if (!Array.isArray(logs)) logs = [];
              }
            } catch {}
            res.setHeader("Content-Type", "application/json");
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, count: logs.length, notifications: logs }));
            return;
          }
        }

        // ============================================================
        // 6D. ATELIER BOOKINGS COLLECTION: /api/bookings
        // ============================================================
        if (urlWithoutQuery === "/api/bookings") {
          setAntiCacheHeaders(res);
          setCorsHeaders(res);

          if (method === "GET") {
            const bookings = readBookingsList();
            res.setHeader("Content-Type", "application/json");
            res.statusCode = 200;
            res.end(JSON.stringify(bookings));
            return;
          }

          if (method === "POST" || method === "PUT") {
            try {
              const body = await parseJsonBody(req);
              let bookings = readBookingsList();
              const now = new Date().toISOString();
              const bookingId = body.id || `book_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;

              const newBooking = {
                ...body,
                id: bookingId,
                createdAt: body.createdAt || now,
                updatedAt: now,
                status: body.status || "confirmed",
              };

              const idx = bookings.findIndex((b) => b.id === bookingId);
              if (idx > -1) {
                bookings[idx] = { ...bookings[idx], ...newBooking };
              } else {
                bookings.unshift(newBooking);
              }

              unrecordDeletedId("bookings", bookingId);
              if (newBooking.bookingNumber) unrecordDeletedId("bookings", newBooking.bookingNumber);
              writeBookingsList(bookings);
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, booking: newBooking, count: bookings.length }));
              return;
            } catch (err: any) {
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 400;
              res.end(JSON.stringify({ error: err.message || "Failed to save booking" }));
              return;
            }
          }
        }

        // 6E. SINGLE BOOKING ITEM: /api/bookings/:id
        const bookingMatch = urlWithoutQuery.match(/^\/api\/bookings\/([^/]+)$/);
        if (bookingMatch) {
          setAntiCacheHeaders(res);
          setCorsHeaders(res);
          const bookingId = decodeURIComponent(bookingMatch[1]);
          let bookings = readBookingsList();

          if (method === "GET") {
            const found = bookings.find((b) => b.id === bookingId);
            res.setHeader("Content-Type", "application/json");
            if (found) {
              res.statusCode = 200;
              res.end(JSON.stringify(found));
            } else {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: `Booking not found: ${bookingId}` }));
            }
            return;
          }

          if (method === "PUT" || method === "PATCH" || method === "POST") {
            try {
              const body = await parseJsonBody(req);
              const now = new Date().toISOString();
              const idx = bookings.findIndex((b) => b.id === bookingId);
              let updatedBooking: any;

              if (idx > -1) {
                updatedBooking = { ...bookings[idx], ...body, updatedAt: now };
                bookings[idx] = updatedBooking;
              } else {
                updatedBooking = { ...body, id: bookingId, updatedAt: now };
                bookings.unshift(updatedBooking);
              }

              writeBookingsList(bookings);
              unrecordDeletedId("bookings", bookingId);
              if (updatedBooking.bookingNumber) unrecordDeletedId("bookings", updatedBooking.bookingNumber);
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, booking: updatedBooking, count: bookings.length }));
              return;
            } catch (err: any) {
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 400;
              res.end(JSON.stringify({ error: err.message }));
              return;
            }
          }

          if (method === "DELETE") {
            const found = bookings.find((b) => b.id === bookingId || b.bookingNumber === bookingId);
            const filtered = bookings.filter((b) => b.id !== bookingId && b.bookingNumber !== bookingId);
            recordDeletedId("bookings", bookingId);
            if (found) {
              if (found.id) recordDeletedId("bookings", found.id);
              if (found.bookingNumber) recordDeletedId("bookings", found.bookingNumber);
            }
            writeBookingsList(filtered);
            res.setHeader("Content-Type", "application/json");
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, id: bookingId, count: filtered.length }));
            return;
          }
        }

        // ============================================================
        // 6F. NEWSLETTER SUBSCRIPTIONS: /api/newsletter & /api/newsletter/subscribe
        // ============================================================
        if (urlWithoutQuery === "/api/newsletter" || urlWithoutQuery === "/api/newsletter/subscribe") {
          setAntiCacheHeaders(res);
          setCorsHeaders(res);

          if (method === "GET") {
            const subscribers = readNewsletterList();
            res.setHeader("Content-Type", "application/json");
            res.statusCode = 200;
            res.end(JSON.stringify(subscribers));
            return;
          }

          if (method === "POST") {
            try {
              const body = await parseJsonBody(req);
              const email = (body?.email || "").trim().toLowerCase();
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              if (!email || !emailRegex.test(email)) {
                res.setHeader("Content-Type", "application/json");
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Please provide a valid email address." }));
                return;
              }

              let subscribers = readNewsletterList();
              const docId = email.replace(/[^a-z0-9]/g, "_");
              const now = new Date().toISOString();

              const existingIdx = subscribers.findIndex(
                (s) => s && s.email && s.email.toLowerCase() === email
              );

              let updatedItem: any;
              let isNew = false;
              if (existingIdx > -1) {
                updatedItem = {
                  ...subscribers[existingIdx],
                  ...body,
                  email,
                  status: "active",
                  updatedAt: now,
                };
                subscribers[existingIdx] = updatedItem;
              } else {
                isNew = true;
                updatedItem = {
                  id: docId,
                  email,
                  subscribedAt: body?.subscribedAt || now,
                  source: body?.source || "footer",
                  status: "active",
                };
                subscribers.unshift(updatedItem);
              }

              writeNewsletterList(subscribers);
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 200;
              res.end(
                JSON.stringify({
                  success: true,
                  isNew,
                  message: isNew
                    ? "Thank you for subscribing! You will receive our private previews and artisan drops."
                    : "You are already subscribed to House of Shriya private drops.",
                  subscription: updatedItem,
                  totalSubscribers: subscribers.length,
                })
              );
              return;
            } catch (err: any) {
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 400;
              res.end(JSON.stringify({ error: err.message || "Failed to process newsletter subscription" }));
              return;
            }
          }
        }

        // ============================================================
        // 7. SHIPROCKET DEDICATED ROUTES (/api/shipping/shiprocket/*)
        // ============================================================
        if (urlWithoutQuery.startsWith("/api/shipping/shiprocket") || urlWithoutQuery.startsWith("/api/shiprocket")) {
          setCorsHeaders(res);
          setAntiCacheHeaders(res);

          if (method === "OPTIONS") {
            res.statusCode = 204;
            res.end();
            return;
          }

          const {
            testShiprocketAuth,
            testCustomShiprocketCredentials,
            createShiprocketOrder,
            trackShiprocketShipment,
            checkCourierServiceability,
            updateShiprocketConfig,
            getShiprocketConfig,
          } = await import("./shiprocketService");

          // A. Status & Connection Test: GET / POST /api/shipping/shiprocket/status
          if (urlWithoutQuery === "/api/shipping/shiprocket/status") {
            if (method === "OPTIONS") {
              res.statusCode = 204;
              res.end();
              return;
            }
            if (method === "GET" || method === "POST") {
              const statusResult = await testShiprocketAuth();
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 200;
              res.end(JSON.stringify(statusResult));
              return;
            }
          }

          // A2. Test Provided Credentials: POST / GET /api/shipping/shiprocket/test-credentials
          if (urlWithoutQuery === "/api/shipping/shiprocket/test-credentials") {
            setCorsHeaders(res);
            setAntiCacheHeaders(res);
            if (method === "OPTIONS") {
              res.statusCode = 204;
              res.end();
              return;
            }

            try {
              let email = "";
              let password = "";
              if (method === "POST" || method === "PUT") {
                const body = await parseJsonBody(req);
                email = body.email || "";
                password = body.password || "";
              } else if (method === "GET") {
                const parsedUrl = new URL(rawUrl, "http://localhost:3000");
                email = parsedUrl.searchParams.get("email") || "";
                password = parsedUrl.searchParams.get("password") || "";
              }

              if (!email || !password) {
                const cfg = getShiprocketConfig();
                email = email || cfg.email;
                password = password || cfg.password;
              }

              const testResult = await testCustomShiprocketCredentials(email, password);
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 200;
              res.end(JSON.stringify(testResult));
              return;
            } catch (err: any) {
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 200; // Always return 200 with JSON payload so client gets clean readable message
              res.end(JSON.stringify({ success: false, message: err.message || "Failed to verify credentials" }));
              return;
            }
          }

          // B. Update Config / Credentials: POST /api/shipping/shiprocket/config
          if (urlWithoutQuery === "/api/shipping/shiprocket/config") {
            if (method === "GET") {
              const cfg = getShiprocketConfig();
              const maskedEmail = cfg.email.replace(/^(.)(.*)(@.*)$/, (_, f, m, end) => `${f}${"*".repeat(m.length)}${end}`);
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 200;
              res.end(
                JSON.stringify({
                  email: cfg.email,
                  emailMasked: maskedEmail,
                  pickupLocation: cfg.pickupLocation,
                  isConfigured: cfg.isConfigured,
                  hasPassword: Boolean(cfg.password),
                })
              );
              return;
            }

            if (method === "POST") {
              try {
                const body = await parseJsonBody(req);
                const updated = updateShiprocketConfig({
                  email: body.email,
                  password: body.password,
                  pickupLocation: body.pickupLocation,
                  token: body.token,
                  tokenExpiresAt: body.tokenExpiresAt,
                });
                const testRes = await testShiprocketAuth();
                res.setHeader("Content-Type", "application/json");
                res.statusCode = 200;
                res.end(
                  JSON.stringify({
                    success: updated,
                    auth: testRes,
                  })
                );
                return;
              } catch (err: any) {
                res.setHeader("Content-Type", "application/json");
                res.statusCode = 400;
                res.end(JSON.stringify({ error: err.message }));
                return;
              }
            }
          }

          // C. Create Shipment / Push Order: POST / PUT / PATCH / GET /api/shipping/shiprocket/create-order
          const isCreateOrderRoute =
            urlWithoutQuery === "/api/shipping/shiprocket/create-order" ||
            urlWithoutQuery === "/api/shipping/shiprocket/create" ||
            urlWithoutQuery === "/api/shipping/shiprocket/order" ||
            urlWithoutQuery === "/api/shiprocket/create-order" ||
            urlWithoutQuery === "/api/shiprocket/create";

          if (isCreateOrderRoute) {
            if (method === "OPTIONS") {
              res.statusCode = 204;
              res.end();
              return;
            }

            if (method === "POST" || method === "PUT" || method === "PATCH") {
              try {
                const body = await parseJsonBody(req);
                const orderData = body.order || body;
                const pickupOverride = body.pickupLocation;

                const result = await createShiprocketOrder(orderData, pickupOverride);

                // Update order in public/data/orders.json if present
                const { updatePersistedOrder } = await import("./shiprocketService");
                const updatedOrderRecord = {
                  ...orderData,
                  shiprocketOrderId: result.shiprocketOrderId,
                  shiprocketShipmentId: result.shipmentId,
                  trackingNumber: result.awbCode || orderData.trackingNumber,
                  trackingCourier: result.courierName || orderData.trackingCourier || "Shiprocket Express",
                  trackingUrl: result.trackingUrl,
                  shiprocketStatus: result.status,
                  shiprocketSyncedAt: new Date().toISOString(),
                  shiprocketError: result.error,
                };
                updatePersistedOrder(updatedOrderRecord);

                res.setHeader("Content-Type", "application/json");
                res.statusCode = 200;
                res.end(
                  JSON.stringify({
                    success: result.success,
                    shiprocket: result,
                    order: updatedOrderRecord,
                  })
                );
                return;
              } catch (err: any) {
                console.error("[Shiprocket API create-order error]:", err);
                res.setHeader("Content-Type", "application/json");
                res.statusCode = 200;
                res.end(
                  JSON.stringify({
                    success: false,
                    error: err.message || "Failed to process Shiprocket order dispatch",
                    shiprocket: { success: false, error: err.message },
                  })
                );
                return;
              }
            }

            if (method === "GET") {
              const urlObj = new URL(rawUrl, "http://localhost:3000");
              const orderId = urlObj.searchParams.get("orderId") || urlObj.searchParams.get("id");
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 200;
              res.end(
                JSON.stringify({
                  success: true,
                  message: "Shiprocket order creation endpoint is operational. Dispatch orders using POST with JSON payload.",
                  orderId: orderId || null,
                })
              );
              return;
            }

            res.setHeader("Content-Type", "application/json");
            res.statusCode = 200;
            res.end(
              JSON.stringify({
                success: false,
                error: `HTTP ${method} received on create-order. Use POST to dispatch.`,
              })
            );
            return;
          }

          // D. Live Tracking: GET /api/shipping/shiprocket/track
          if (urlWithoutQuery === "/api/shipping/shiprocket/track" && method === "GET") {
            const urlObj = new URL(rawUrl, "http://localhost:3000");
            const awb = urlObj.searchParams.get("awb") || undefined;
            const shipmentId = urlObj.searchParams.get("shipmentId") || undefined;
            const orderId = urlObj.searchParams.get("orderId") || undefined;

            const trackingResult = await trackShiprocketShipment({
              awb,
              shipmentId,
              orderId,
            });

            res.setHeader("Content-Type", "application/json");
            res.statusCode = 200;
            res.end(JSON.stringify(trackingResult));
            return;
          }

          // E. Courier Serviceability: POST /api/shipping/shiprocket/serviceability
          if (urlWithoutQuery === "/api/shipping/shiprocket/serviceability") {
            try {
              let body: any = {};
              if (method === "POST") {
                body = await parseJsonBody(req);
              } else {
                const urlObj = new URL(rawUrl, "http://localhost:3000");
                body = {
                  deliveryPincode: urlObj.searchParams.get("pincode") || urlObj.searchParams.get("deliveryPincode"),
                  pickupPincode: urlObj.searchParams.get("pickupPincode"),
                  weight: Number(urlObj.searchParams.get("weight") || 0.8),
                  cod: urlObj.searchParams.get("cod") === "1" || urlObj.searchParams.get("cod") === "true",
                };
              }

              const result = await checkCourierServiceability({
                deliveryPincode: body.deliveryPincode || "110001",
                pickupPincode: body.pickupPincode || "395003",
                weight: body.weight || 0.8,
                cod: body.cod,
              });

              res.setHeader("Content-Type", "application/json");
              res.statusCode = 200;
              res.end(JSON.stringify(result));
              return;
            } catch (err: any) {
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 400;
              res.end(JSON.stringify({ error: err.message }));
              return;
            }
          }

          // F. Webhook Handler: POST /api/shipping/shiprocket/webhook
          if (urlWithoutQuery === "/api/shipping/shiprocket/webhook" && method === "POST") {
            try {
              const body = await parseJsonBody(req);
              console.log("[Shiprocket Webhook] Received event:", JSON.stringify(body));

              const { logShiprocketEvent } = await import("./shiprocketLogger");
              const awb = body.awb || body.awb_code;
              const orderId = body.order_id;
              const currentStatus = (body.current_status || body.status || "").toLowerCase();

              logShiprocketEvent({
                action: "WEBHOOK",
                status: "SUCCESS",
                statusCode: 200,
                orderNumber: String(orderId || ""),
                errorMessage: `Webhook received for ${orderId || awb || "shipment"}: Status = ${body.current_status || body.status || "Update"}`,
                responsePayload: body,
              });

              if (orderId || awb) {
                const { updatePersistedOrder, readPersistedOrders } = await import("./shiprocketService");
                const existingOrders = readPersistedOrders();
                const matchedOrder = existingOrders.find(
                  (o) =>
                    String(o.shiprocketOrderId) === String(orderId) ||
                    String(o.orderNumber) === String(orderId) ||
                    String(o.id) === String(orderId) ||
                    (awb && (o.trackingNumber === awb || o.shiprocketAwb === awb))
                );

                let mappedOrderStatus = matchedOrder?.orderStatus || "confirmed";
                if (currentStatus.includes("delivered")) {
                  mappedOrderStatus = "delivered";
                } else if (
                  currentStatus.includes("out for delivery") ||
                  currentStatus.includes("in transit") ||
                  currentStatus.includes("shipped") ||
                  currentStatus.includes("pickup") ||
                  currentStatus.includes("reached")
                ) {
                  mappedOrderStatus = "shipped";
                } else if (currentStatus.includes("cancel") || currentStatus.includes("rto")) {
                  mappedOrderStatus = "cancelled";
                }

                const updatedData = {
                  ...(matchedOrder || {}),
                  id: matchedOrder?.id || orderId,
                  orderNumber: matchedOrder?.orderNumber || orderId,
                  shiprocketOrderId: orderId || matchedOrder?.shiprocketOrderId,
                  trackingNumber: awb || matchedOrder?.trackingNumber,
                  trackingCourier: body.courier_name || matchedOrder?.trackingCourier || "Shiprocket Express",
                  shiprocketStatus: body.current_status || body.status || "In Transit",
                  orderStatus: mappedOrderStatus,
                  updatedAt: new Date().toISOString(),
                };

                updatePersistedOrder(updatedData);
              }

              res.setHeader("Content-Type", "application/json");
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, message: "Webhook acknowledged and processed successfully" }));
              return;
            } catch (err: any) {
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 400;
              res.end(JSON.stringify({ error: err.message }));
              return;
            }
          }

          // G. Shiprocket Logs: GET /api/shipping/shiprocket/logs
          if (urlWithoutQuery === "/api/shipping/shiprocket/logs" && method === "GET") {
            try {
              const { getShiprocketLogs } = await import("./shiprocketLogger");
              const urlObj = new URL(rawUrl, "http://localhost:3000");
              const action = urlObj.searchParams.get("action") || undefined;
              const status = urlObj.searchParams.get("status") || undefined;
              const search = urlObj.searchParams.get("search") || undefined;
              const limit = parseInt(urlObj.searchParams.get("limit") || "100", 10);

              const logs = getShiprocketLogs({
                action,
                status,
                search,
                limit,
              });

              res.setHeader("Content-Type", "application/json");
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, logs, total: logs.length }));
              return;
            } catch (err: any) {
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: err.message, logs: [] }));
              return;
            }
          }

          // H. Clear Shiprocket Logs: DELETE /api/shipping/shiprocket/logs
          if (urlWithoutQuery === "/api/shipping/shiprocket/logs" && method === "DELETE") {
            try {
              const { clearShiprocketLogs } = await import("./shiprocketLogger");
              clearShiprocketLogs();
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, message: "Shiprocket API logs cleared." }));
              return;
            } catch (err: any) {
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: err.message }));
              return;
            }
          }

          // I. Manual / Background Retry Trigger: POST /api/shipping/shiprocket/retry
          if (urlWithoutQuery === "/api/shipping/shiprocket/retry" && method === "POST") {
            try {
              const { retryAllPendingOrders } = await import("./shiprocketService");
              const retryResults = await retryAllPendingOrders(true);

              res.setHeader("Content-Type", "application/json");
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, ...retryResults }));
              return;
            } catch (err: any) {
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: err.message }));
              return;
            }
          }

          // J. Live Orders Sync from Shiprocket: GET /api/shipping/shiprocket/orders
          if (
            (urlWithoutQuery === "/api/shipping/shiprocket/orders" ||
              urlWithoutQuery === "/api/shiprocket/orders") &&
            method === "GET"
          ) {
            try {
              const { getShiprocketToken } = await import("./shiprocketService");
              const token = await getShiprocketToken();
              const srRes = await fetch("https://apiv2.shiprocket.in/v1/external/orders?per_page=50", {
                headers: { Authorization: `Bearer ${token}` },
              });
              const srData = await srRes.json().catch(() => ({}));
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, data: srData?.data || [] }));
              return;
            } catch (err: any) {
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 200;
              res.end(JSON.stringify({ success: false, error: err.message, data: [] }));
              return;
            }
          }

          // Fallback handler for any unmatched Shiprocket path or method
          res.setHeader("Content-Type", "application/json");
          res.statusCode = 200;
          res.end(
            JSON.stringify({
              success: false,
              error: `Shiprocket endpoint ${urlWithoutQuery} (${method}) is ready. For order dispatch, use POST /api/shipping/shiprocket/create-order.`,
            })
          );
          return;
        }

        // If request is targeting /api/*, ALWAYS handle it with JSON error, NEVER let it fall through to Vite SPA html!
        if (urlWithoutQuery.startsWith("/api/")) {
          setCorsHeaders(res);
          res.setHeader("Content-Type", "application/json");
          res.statusCode = 404;
          res.end(JSON.stringify({ error: `API route not found: ${method} ${urlWithoutQuery}` }));
          return;
        }

        next();
    } catch (err: any) {
      console.error("[API Middleware Error]:", err);
      if (urlWithoutQuery.startsWith("/api/")) {
        setCorsHeaders(res);
        res.setHeader("Content-Type", "application/json");
        res.statusCode = 500;
        res.end(JSON.stringify({ success: false, error: err.message || "Internal server error" }));
        return;
      }
      next(err);
    }
  };

export function apiMiddlewarePlugin(): Plugin {
  return {
    name: "api-middleware-plugin",
    configureServer(server) {
      server.middlewares.use(apiHandler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(apiHandler);
    },
  };
}
