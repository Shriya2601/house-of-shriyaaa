/**
 * Cloudflare Pages Function: /api/products
 * Product persistence: Cloudflare D1 authoritative
 */

import { ensureD1Tables, executeD1Query, getD1Binding } from "../lib/d1";

interface Env {
  [key: string]: any;
}

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-admin-token, x-admin-key",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-admin-token, x-admin-key",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function onRequestGet(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  try {
    await ensureD1Tables(env);

    // Filter out deleted product IDs
    const delRes = await executeD1Query(
      env,
      "SELECT item_id FROM deleted_ids WHERE entity = 'products'"
    );
    const deletedIds = new Set((delRes.results || []).map((r: any) => String(r.item_id)));

    let query = "SELECT data_json FROM products";
    const params: any[] = [];

    if (id) {
      query += " WHERE id = ? LIMIT 1";
      params.push(id);
    } else {
      query += " ORDER BY created_at DESC";
    }

    const { results } = await executeD1Query(env, query, params);
    const products: any[] = [];

    for (const row of results) {
      try {
        const p = JSON.parse(row.data_json);
        if (p && p.id && !deletedIds.has(String(p.id))) {
          products.push(p);
        }
      } catch {}
    }

    if (id) {
      if (products.length > 0) {
        return jsonResponse(products[0]);
      }
      return jsonResponse({ success: false, error: "Product not found" }, 404);
    }

    return jsonResponse(products);
  } catch (err: any) {
    console.error("[D1 Products GET Error]:", err);
    return jsonResponse([], 200);
  }
}

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;

  try {
    await ensureD1Tables(env);

    let body: any;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ success: false, error: "Invalid JSON body" }, 400);
    }

    const items = Array.isArray(body) ? body : [body];
    const saved: any[] = [];
    const now = new Date().toISOString();

    for (const item of items) {
      if (!item) continue;
      const id = String(item.id || `hos-${Date.now()}-${Math.floor(Math.random() * 1000)}`);
      const name = String(item.name || item.title || "Product");
      const title = String(item.title || name);
      const price = Number(item.price) || 0;
      const original_price = Number(item.original_price || item.originalPrice) || null;
      const category = String(item.category || "");
      const subcategory = String(item.subcategory || "");
      const image = String(item.image || "");
      const hover_image = String(item.hover_image || item.hoverImage || "");
      const images = JSON.stringify(item.images || []);
      const colors = JSON.stringify(item.colors || []);
      const sizes = JSON.stringify(item.sizes || []);
      const stock = Number(item.stock ?? 10);
      const in_stock = item.in_stock !== false ? 1 : 0;
      const is_bestseller = item.is_bestseller ? 1 : 0;
      const is_new = item.is_new ? 1 : 0;
      const featured = item.featured ? 1 : 0;
      const description = String(item.description || "");
      const variants = JSON.stringify(item.variants || []);
      const sku = String(item.sku || id);
      const created_at = String(item.created_at || item.createdAt || now);
      const updated_at = now;

      const fullProd = {
        ...item,
        id,
        name,
        title,
        price,
        original_price,
        category,
        subcategory,
        image,
        hover_image,
        stock,
        in_stock: in_stock === 1,
        is_bestseller: is_bestseller === 1,
        is_new: is_new === 1,
        featured: featured === 1,
        description,
        sku,
        createdAt: created_at,
        updatedAt: updated_at,
      };

      const dataJson = JSON.stringify(fullProd);
      const db = getD1Binding(env);

      if (db) {
        await db
          .prepare(
            `INSERT INTO products (
              id, name, title, price, original_price, category, subcategory,
              image, hover_image, images, colors, sizes, stock, in_stock,
              is_bestseller, is_new, featured, description, variants, sku,
              created_at, updated_at, data_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              title = excluded.title,
              price = excluded.price,
              original_price = excluded.original_price,
              category = excluded.category,
              subcategory = excluded.subcategory,
              image = excluded.image,
              hover_image = excluded.hover_image,
              images = excluded.images,
              colors = excluded.colors,
              sizes = excluded.sizes,
              stock = excluded.stock,
              in_stock = excluded.in_stock,
              is_bestseller = excluded.is_bestseller,
              is_new = excluded.is_new,
              featured = excluded.featured,
              description = excluded.description,
              variants = excluded.variants,
              sku = excluded.sku,
              updated_at = excluded.updated_at,
              data_json = excluded.data_json`
          )
          .bind(
            id, name, title, price, original_price, category, subcategory,
            image, hover_image, images, colors, sizes, stock, in_stock,
            is_bestseller, is_new, featured, description, variants, sku,
            created_at, updated_at, dataJson
          )
          .run();

        await db
          .prepare("DELETE FROM deleted_ids WHERE entity = 'products' AND item_id = ?")
          .bind(id)
          .run()
          .catch(() => {});
      } else {
        await executeD1Query(
          env,
          `INSERT OR REPLACE INTO products (
            id, name, title, price, original_price, category, subcategory,
            image, hover_image, images, colors, sizes, stock, in_stock,
            is_bestseller, is_new, featured, description, variants, sku,
            created_at, updated_at, data_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id, name, title, price, original_price, category, subcategory,
            image, hover_image, images, colors, sizes, stock, in_stock,
            is_bestseller, is_new, featured, description, variants, sku,
            created_at, updated_at, dataJson,
          ]
        );
      }

      saved.push(fullProd);
    }

    return jsonResponse({
      success: true,
      product: saved[0],
      products: saved,
    });
  } catch (err: any) {
    console.error("[D1 Products POST Error]:", err);
    return jsonResponse({ success: false, error: err?.message || String(err) }, 500);
  }
}

export async function onRequestPut(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  return onRequestPost(context);
}

export async function onRequestDelete(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return jsonResponse({ success: false, error: "Missing product id" }, 400);
  }

  try {
    await ensureD1Tables(env);
    const now = new Date().toISOString();
    const db = getD1Binding(env);

    if (db) {
      await db.prepare("DELETE FROM products WHERE id = ?").bind(id).run();
      await db
        .prepare("INSERT OR REPLACE INTO deleted_ids (entity, item_id, deleted_at) VALUES ('products', ?, ?)")
        .bind(id, now)
        .run();
    } else {
      await executeD1Query(env, "DELETE FROM products WHERE id = ?", [id]);
      await executeD1Query(
        env,
        "INSERT OR REPLACE INTO deleted_ids (entity, item_id, deleted_at) VALUES ('products', ?, ?)",
        [id, now]
      );
    }

    return jsonResponse({ success: true, deletedId: id });
  } catch (err: any) {
    console.error("[D1 Products DELETE Error]:", err);
    return jsonResponse({ success: false, error: err?.message || String(err) }, 500);
  }
}
