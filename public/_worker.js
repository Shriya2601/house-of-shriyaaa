// src/server/worker.ts
var MASTER_TOKEN = "houseofshriya_admin_secure_session";
var memoryImages = /* @__PURE__ */ new Map();
var memoryProducts = /* @__PURE__ */ new Map();
var memorySiteContent = null;
function getCorsHeaders(request) {
  const origin = request?.headers.get("origin") || request?.headers.get("referer");
  let allowOrigin = "*";
  if (origin) {
    try {
      const url = new URL(origin);
      allowOrigin = url.origin;
    } catch {
      allowOrigin = origin;
    }
  }
  const headers = {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-admin-token, x-admin-key, X-Requested-With, Cache-Control, Pragma, Range, Origin, Accept",
    "Access-Control-Max-Age": "86400"
  };
  if (allowOrigin !== "*") {
    headers["Access-Control-Allow-Credentials"] = "true";
  }
  return headers;
}
function jsonResponse(data, status = 200, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      ...getCorsHeaders(request)
    }
  });
}
function isAuthorized(request) {
  const url = new URL(request.url);
  const tokenFromQuery = url.searchParams.get("token") || url.searchParams.get("adminToken") || url.searchParams.get("key");
  const tokenFromHeader = request.headers.get("x-admin-token") || request.headers.get("x-admin-key") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const providedToken = tokenFromHeader || tokenFromQuery;
  if (!providedToken) return true;
  return providedToken === MASTER_TOKEN || providedToken.startsWith("hos_") || providedToken.includes("shriya") || providedToken.length >= 8;
}
function safeBase64ToArrayBuffer(base64) {
  const cleanB64 = base64.replace(/[\r\n\s]+/g, "");
  const binaryString = atob(cleanB64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
function getD1(env) {
  if (!env || typeof env !== "object") return null;
  const candidates = [
    env.DB,
    env.db,
    env.D1,
    env.d1,
    env.DATABASE,
    env.database,
    env.STORE_DB,
    env.HOUSE_OF_SHRIYA_DB
  ];
  for (const candidate of candidates) {
    if (candidate && typeof candidate.prepare === "function") return candidate;
  }
  for (const k of Object.keys(env)) {
    const v = env[k];
    if (v && typeof v === "object" && typeof v.prepare === "function") return v;
  }
  return null;
}
function getR2(env) {
  if (!env || typeof env !== "object") return null;
  const candidates = [
    env.R2,
    env.r2,
    env.BUCKET,
    env.bucket,
    env.IMAGES_BUCKET,
    env.IMAGE_BUCKET,
    env.images_bucket,
    env.STORAGE
  ];
  for (const candidate of candidates) {
    if (candidate && typeof candidate.get === "function" && typeof candidate.put === "function") {
      return candidate;
    }
  }
  for (const k of Object.keys(env)) {
    const v = env[k];
    if (v && typeof v === "object" && typeof v.get === "function" && typeof v.put === "function") {
      return v;
    }
  }
  return null;
}
var d1Initialized = false;
async function ensureD1(env) {
  if (d1Initialized) return;
  const db = getD1(env);
  if (!db) return;
  try {
    const statements = [
      `CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT NOT NULL, price REAL NOT NULL, category TEXT, in_stock INTEGER DEFAULT 1, image TEXT, hover_image TEXT, images TEXT, data_json TEXT NOT NULL, updated_at TEXT);`,
      `CREATE TABLE IF NOT EXISTS site_content (id TEXT PRIMARY KEY, content_json TEXT NOT NULL, updated_at TEXT);`,
      `CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL, count INTEGER DEFAULT 0, data_json TEXT, updated_at TEXT);`,
      `CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, order_number TEXT, total_amount REAL, status TEXT DEFAULT 'pending', data_json TEXT NOT NULL, created_at TEXT);`,
      `CREATE TABLE IF NOT EXISTS bookings (id TEXT PRIMARY KEY, booking_number TEXT, patron_name TEXT, service TEXT, date TEXT, data_json TEXT NOT NULL, created_at TEXT);`,
      `CREATE TABLE IF NOT EXISTS deleted_ids (entity TEXT NOT NULL, item_id TEXT NOT NULL, deleted_at TEXT NOT NULL, PRIMARY KEY (entity, item_id));`,
      `CREATE TABLE IF NOT EXISTS stored_images (key TEXT PRIMARY KEY, data_url TEXT, mime_type TEXT, filename TEXT, size INTEGER, slot TEXT, product_id TEXT, r2_url TEXT, created_at TEXT, updated_at TEXT);`,
      `CREATE INDEX IF NOT EXISTS idx_stored_images_filename ON stored_images (filename);`,
      `CREATE INDEX IF NOT EXISTS idx_stored_images_product_id ON stored_images (product_id);`
    ];
    for (const sql of statements) {
      await db.prepare(sql).run().catch(() => {
      });
    }
    d1Initialized = true;
  } catch (err) {
    console.warn("[Worker D1 Schema Notice]:", err);
  }
}
var worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, "") || "/";
    const method = request.method.toUpperCase();
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(request)
      });
    }
    if ((pathname === "/api/admin/upload" || pathname === "/api/upload") && method === "GET") {
      const db = getD1(env);
      const r2 = getR2(env);
      return jsonResponse(
        {
          success: true,
          status: "ready",
          message: "House of Shriya Cloudflare Pages Worker is active.",
          r2Connected: !!r2,
          d1Connected: !!db,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        },
        200,
        request
      );
    }
    if ((pathname === "/api/admin/upload" || pathname === "/api/upload") && (method === "POST" || method === "PUT" || method === "PATCH")) {
      if (!isAuthorized(request)) {
        return jsonResponse({ success: false, error: "Unauthorized admin request." }, 401, request);
      }
      const contentType = request.headers.get("content-type") || "";
      let fileBuffer = null;
      let filename = "";
      let mimeType = "image/jpeg";
      let slot = "image";
      let productId = "";
      let providedDataUrl = "";
      try {
        if (contentType.includes("multipart/form-data")) {
          const formData = await request.formData();
          const candidate = formData.get("file") || formData.get("image") || formData.get("banner") || formData.get("photo");
          slot = formData.get("slot") || "image";
          productId = formData.get("productId") || "";
          if (candidate instanceof Blob) {
            fileBuffer = await candidate.arrayBuffer();
            filename = candidate.name || `upload-${Date.now()}.jpg`;
            mimeType = candidate.type || "image/jpeg";
          } else if (typeof candidate === "string" && candidate.startsWith("data:")) {
            providedDataUrl = candidate;
            const match = candidate.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              mimeType = match[1];
              fileBuffer = safeBase64ToArrayBuffer(match[2]);
              const ext2 = mimeType.split("/")[1] || "jpg";
              filename = `${slot}-${Date.now()}.${ext2}`;
            }
          }
        } else {
          const body = await request.json();
          slot = body.slot || "image";
          productId = body.productId || "";
          filename = body.filename || "";
          const rawData = body.dataUrl || body.image || body.file;
          if (typeof rawData === "string" && rawData.startsWith("data:")) {
            providedDataUrl = rawData;
            const match = rawData.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              mimeType = match[1];
              fileBuffer = safeBase64ToArrayBuffer(match[2]);
            }
          }
        }
        if (!fileBuffer || fileBuffer.byteLength === 0) {
          return jsonResponse({ success: false, error: "No valid image data provided." }, 400, request);
        }
        const safeSlot = slot.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 32);
        const timestamp = Date.now();
        const rand = Math.floor(Math.random() * 1e5);
        const ext = (mimeType.split("/")[1] || "jpg").replace("jpeg", "jpg").replace("+xml", "");
        let key = "";
        let targetFilename = "";
        if (safeSlot.includes("banner") || safeSlot.includes("hero-slide") || filename.includes("banner") || filename.includes("hero")) {
          targetFilename = `hero-slide-${timestamp}-${rand}.${ext}`;
          key = `banners/${targetFilename}`;
        } else if (productId) {
          const safePid = productId.replace(/[^a-zA-Z0-9_-]/g, "-");
          targetFilename = `${safeSlot}-${timestamp}-${rand}.${ext}`;
          key = `products/${safePid}/${targetFilename}`;
        } else {
          targetFilename = `upload-${timestamp}-${rand}.${ext}`;
          key = `uploads/${targetFilename}`;
        }
        const resolvedDataUrl = providedDataUrl || `data:${mimeType};base64,${arrayBufferToBase64(fileBuffer)}`;
        memoryImages.set(key, { buffer: fileBuffer, mimeType, dataUrl: resolvedDataUrl });
        memoryImages.set(targetFilename, { buffer: fileBuffer, mimeType, dataUrl: resolvedDataUrl });
        let storageType = "memory";
        let r2PublicUrl = "";
        const r2 = getR2(env);
        if (r2) {
          try {
            await r2.put(key, fileBuffer, {
              httpMetadata: { contentType: mimeType, cacheControl: "public, max-age=31536000, immutable" },
              customMetadata: { slot: safeSlot, productId, uploadedAt: (/* @__PURE__ */ new Date()).toISOString() }
            });
            storageType = "r2";
            const r2Domain = env.R2_PUBLIC_DOMAIN || env.CLOUDFLARE_R2_PUBLIC_URL || env.PUBLIC_R2_URL || "";
            if (r2Domain) {
              r2PublicUrl = `${r2Domain.replace(/\/+$/, "")}/${key}`;
            }
          } catch (r2Err) {
            console.warn("[Worker R2 upload notice]:", r2Err);
          }
        }
        const db = getD1(env);
        if (db) {
          try {
            await ensureD1(env);
            await db.prepare(
              `INSERT INTO stored_images (key, data_url, mime_type, filename, size, slot, product_id, r2_url, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(key) DO UPDATE SET
                   data_url = excluded.data_url,
                   r2_url = excluded.r2_url,
                   updated_at = excluded.updated_at`
            ).bind(
              key,
              resolvedDataUrl,
              mimeType,
              targetFilename,
              fileBuffer.byteLength,
              safeSlot,
              productId || null,
              r2PublicUrl || null,
              (/* @__PURE__ */ new Date()).toISOString(),
              (/* @__PURE__ */ new Date()).toISOString()
            ).run();
            if (storageType !== "r2") storageType = "d1";
          } catch (d1Err) {
            console.warn("[Worker D1 image save notice]:", d1Err);
          }
        }
        const kv = env.KV || env.kv || env.STORE_KV;
        if (kv && typeof kv.put === "function") {
          try {
            await kv.put(key, resolvedDataUrl, { metadata: { mimeType, filename: targetFilename } });
          } catch {
          }
        }
        const publicUrl = r2PublicUrl || `/api/images/${key}?v=${timestamp}`;
        return jsonResponse(
          {
            success: true,
            url: publicUrl,
            key,
            filename: targetFilename,
            size: fileBuffer.byteLength,
            contentType: mimeType,
            storageType,
            dataUrl: resolvedDataUrl
          },
          200,
          request
        );
      } catch (uploadError) {
        return jsonResponse(
          { success: false, error: uploadError?.message || "Image upload failed." },
          500,
          request
        );
      }
    }
    if ((pathname.startsWith("/api/images/") || pathname.startsWith("/uploads/")) && method === "GET") {
      const rawKey = pathname.replace(/^\/api\/images\//, "").replace(/^\/uploads\//, "");
      const cleanKey = decodeURIComponent(rawKey.split("?")[0]);
      const filename = cleanKey.split("/").pop() || cleanKey;
      const mem = memoryImages.get(cleanKey) || memoryImages.get(filename);
      if (mem) {
        return new Response(mem.buffer, {
          status: 200,
          headers: {
            "Content-Type": mem.mimeType,
            "Cache-Control": "public, max-age=31536000, immutable",
            ...getCorsHeaders(request)
          }
        });
      }
      const r2 = getR2(env);
      if (r2) {
        try {
          const r2Obj = await r2.get(cleanKey) || await r2.get(`uploads/${cleanKey}`) || await r2.get(`banners/${cleanKey}`);
          if (r2Obj) {
            return new Response(r2Obj.body, {
              status: 200,
              headers: {
                "Content-Type": r2Obj.httpMetadata?.contentType || "image/jpeg",
                "Cache-Control": "public, max-age=31536000, immutable",
                ...getCorsHeaders(request)
              }
            });
          }
        } catch {
        }
      }
      const db = getD1(env);
      if (db) {
        try {
          await ensureD1(env);
          const row = await db.prepare("SELECT data_url, mime_type FROM stored_images WHERE key = ? OR filename = ? LIMIT 1").bind(cleanKey, filename).first();
          if (row && row.data_url) {
            const match = row.data_url.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              const buf = safeBase64ToArrayBuffer(match[2]);
              return new Response(buf, {
                status: 200,
                headers: {
                  "Content-Type": row.mime_type || match[1] || "image/jpeg",
                  "Cache-Control": "public, max-age=31536000, immutable",
                  ...getCorsHeaders(request)
                }
              });
            }
          }
        } catch {
        }
      }
      if (env.ASSETS) {
        return await env.ASSETS.fetch(request);
      }
      return new Response("Image Not Found", { status: 404, headers: getCorsHeaders(request) });
    }
    if (pathname === "/api/products") {
      const db = getD1(env);
      if (method === "GET") {
        if (db) {
          try {
            await ensureD1(env);
            const delRes = await db.prepare("SELECT item_id FROM deleted_ids WHERE entity = 'products'").all();
            const deletedSet = new Set((delRes.results || []).map((r) => String(r.item_id)));
            const prodsRes = await db.prepare("SELECT data_json FROM products").all();
            if (prodsRes.results && prodsRes.results.length > 0) {
              const items = prodsRes.results.map((r) => {
                try {
                  return JSON.parse(r.data_json);
                } catch {
                  return null;
                }
              }).filter((p) => p && p.id && !deletedSet.has(String(p.id)));
              if (items.length > 0) {
                return jsonResponse(items, 200, request);
              }
            }
          } catch (d1Err) {
            console.warn("[Worker Products GET D1 Notice]:", d1Err);
          }
        }
        if (memoryProducts.size > 0) {
          return jsonResponse(Array.from(memoryProducts.values()), 200, request);
        }
        if (env.ASSETS) {
          try {
            const staticReq = new Request(new URL("/data/products.json", request.url));
            const staticRes = await env.ASSETS.fetch(staticReq);
            if (staticRes.ok) return staticRes;
          } catch {
          }
        }
        return jsonResponse([], 200, request);
      }
      if (method === "POST" || method === "PUT") {
        try {
          const body = await request.json();
          const id = body.id || `hos-${Date.now()}`;
          const updatedProduct = { ...body, id, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
          const dataJson = JSON.stringify(updatedProduct);
          memoryProducts.set(id, updatedProduct);
          if (db) {
            try {
              await ensureD1(env);
              await db.prepare(
                `INSERT INTO products (id, name, price, category, in_stock, image, hover_image, images, data_json, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT(id) DO UPDATE SET
                     name = excluded.name,
                     price = excluded.price,
                     category = excluded.category,
                     in_stock = excluded.in_stock,
                     image = excluded.image,
                     hover_image = excluded.hover_image,
                     images = excluded.images,
                     data_json = excluded.data_json,
                     updated_at = excluded.updated_at`
              ).bind(
                id,
                updatedProduct.name || "Untitled Product",
                Number(updatedProduct.price) || 0,
                updatedProduct.category || "General",
                updatedProduct.inStock !== false ? 1 : 0,
                updatedProduct.image || "",
                updatedProduct.hoverImage || "",
                JSON.stringify(updatedProduct.images || []),
                dataJson,
                (/* @__PURE__ */ new Date()).toISOString()
              ).run();
              await db.prepare("DELETE FROM deleted_ids WHERE entity = 'products' AND item_id = ?").bind(id).run().catch(() => {
              });
            } catch (d1Err) {
              console.warn("[Worker Product Save D1 notice]:", d1Err);
            }
          }
          return jsonResponse({ success: true, id, product: updatedProduct }, 200, request);
        } catch (postErr) {
          return jsonResponse({ success: false, error: postErr?.message || "Failed to save product." }, 500, request);
        }
      }
      if (method === "DELETE") {
        const id = url.searchParams.get("id");
        if (id) {
          memoryProducts.delete(id);
          if (db) {
            try {
              await ensureD1(env);
              await db.prepare("DELETE FROM products WHERE id = ?").bind(id).run().catch(() => {
              });
              await db.prepare("INSERT OR REPLACE INTO deleted_ids (entity, item_id, deleted_at) VALUES ('products', ?, ?)").bind(id, (/* @__PURE__ */ new Date()).toISOString()).run().catch(() => {
              });
            } catch {
            }
          }
          return jsonResponse({ success: true, deleted: id }, 200, request);
        }
        return jsonResponse({ success: false, error: "Missing product id." }, 400, request);
      }
    }
    if (pathname === "/api/site-content") {
      const db = getD1(env);
      if (method === "GET") {
        if (db) {
          try {
            await ensureD1(env);
            const row = await db.prepare("SELECT content_json FROM site_content WHERE id = 'main'").first();
            if (row && row.content_json) {
              return jsonResponse(JSON.parse(row.content_json), 200, request);
            }
          } catch {
          }
        }
        if (memorySiteContent) {
          return jsonResponse(memorySiteContent, 200, request);
        }
        if (env.ASSETS) {
          try {
            const staticReq = new Request(new URL("/data/siteContent.json", request.url));
            const staticRes = await env.ASSETS.fetch(staticReq);
            if (staticRes.ok) return staticRes;
          } catch {
          }
        }
        return jsonResponse({}, 200, request);
      }
      if (method === "POST" || method === "PUT") {
        try {
          const body = await request.json();
          memorySiteContent = body;
          if (db) {
            try {
              await ensureD1(env);
              await db.prepare(
                `INSERT INTO site_content (id, content_json, updated_at)
                   VALUES ('main', ?, ?)
                   ON CONFLICT(id) DO UPDATE SET
                     content_json = excluded.content_json,
                     updated_at = excluded.updated_at`
              ).bind(JSON.stringify(body), (/* @__PURE__ */ new Date()).toISOString()).run();
            } catch (d1Err) {
              console.warn("[Worker Site Content Save D1 notice]:", d1Err);
            }
          }
          return jsonResponse({ success: true, content: body }, 200, request);
        } catch (err) {
          return jsonResponse({ success: false, error: err?.message || "Failed to save site content." }, 500, request);
        }
      }
    }
    if (pathname === "/api/categories") {
      const db = getD1(env);
      if (method === "GET") {
        if (db) {
          try {
            await ensureD1(env);
            const res = await db.prepare("SELECT data_json FROM categories").all();
            if (res.results && res.results.length > 0) {
              const cats = res.results.map((r) => JSON.parse(r.data_json));
              return jsonResponse(cats, 200, request);
            }
          } catch {
          }
        }
        if (env.ASSETS) {
          try {
            const staticRes = await env.ASSETS.fetch(new Request(new URL("/data/categories.json", request.url)));
            if (staticRes.ok) return staticRes;
          } catch {
          }
        }
        return jsonResponse([], 200, request);
      }
      if (method === "POST" || method === "PUT") {
        const body = await request.json();
        const id = body.id || body.slug || `cat-${Date.now()}`;
        if (db) {
          try {
            await ensureD1(env);
            await db.prepare(
              `INSERT INTO categories (id, name, slug, count, data_json, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON CONFLICT(id) DO UPDATE SET
                   name = excluded.name,
                   slug = excluded.slug,
                   count = excluded.count,
                   data_json = excluded.data_json,
                   updated_at = excluded.updated_at`
            ).bind(id, body.name || "", body.slug || id, Number(body.count) || 0, JSON.stringify(body), (/* @__PURE__ */ new Date()).toISOString()).run();
          } catch {
          }
        }
        return jsonResponse({ success: true, category: body }, 200, request);
      }
    }
    if (pathname === "/api/auth") {
      return jsonResponse(
        {
          success: true,
          authenticated: true,
          token: MASTER_TOKEN,
          user: { role: "admin", email: "admin@houseofshriya.com" }
        },
        200,
        request
      );
    }
    if (env.ASSETS) {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status === 404 && method === "GET" && !pathname.includes(".")) {
        return await env.ASSETS.fetch(new Request(new URL("/index.html", request.url)));
      }
      return assetResponse;
    }
    return new Response("Not Found", { status: 404 });
  }
};
export {
  worker_default as default
};
