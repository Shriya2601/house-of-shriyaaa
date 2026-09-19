/**
 * Cloudflare D1 Database Helper for House of Shriya
 * Connects directly to Cloudflare D1 bindings or D1 REST API.
 * ZERO Firebase usage!
 */

export interface D1DatabaseLike {
  prepare(query: string): {
    bind(...values: any[]): {
      run(): Promise<any>;
      all(): Promise<{ results: any[]; success?: boolean; error?: any }>;
      first(): Promise<any>;
    };
    run(): Promise<any>;
    all(): Promise<{ results: any[]; success?: boolean; error?: any }>;
    first(): Promise<any>;
  };
  batch?(statements: any[]): Promise<any[]>;
}

export function getD1Binding(env: any): D1DatabaseLike | null {
  if (!env) return null;
  const db =
    env.DB ||
    env.D1 ||
    env.DATABASE ||
    env.__D1_BETA__DB ||
    env.STORE_DB ||
    env.HOUSE_OF_SHRIYA_DB ||
    env.PROD_DB ||
    env.CLOUDFLARE_D1;
  if (db && typeof db.prepare === "function") {
    return db;
  }
  return null;
}

/**
 * Executes a SQL query on Cloudflare D1 via native binding or REST API fallback
 */
export async function executeD1Query(
  env: any,
  sql: string,
  params: any[] = []
): Promise<{ results: any[]; success: boolean; error?: string }> {
  const db = getD1Binding(env);

  if (db) {
    try {
      const stmt = db.prepare(sql);
      const bound = params.length > 0 ? stmt.bind(...params) : stmt;
      const res = await bound.all();
      return { results: res?.results || [], success: true };
    } catch (err: any) {
      console.error("[D1 Error]:", err);
      return { results: [], success: false, error: err?.message || String(err) };
    }
  }

  // Cloudflare D1 REST API fallback if API token and database ID are set in environment
  const accountId = env?.CLOUDFLARE_ACCOUNT_ID || env?.R2_ACCOUNT_ID;
  const databaseId = env?.CLOUDFLARE_D1_DATABASE_ID || env?.D1_DATABASE_ID;
  const apiToken = env?.CLOUDFLARE_API_TOKEN || env?.CLOUDFLARE_D1_API_TOKEN;

  if (accountId && databaseId && apiToken) {
    try {
      const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sql, params }),
      });
      const data = (await res.json()) as any;
      if (data?.success && Array.isArray(data?.result) && data.result[0]?.results) {
        return { results: data.result[0].results, success: true };
      }
      return { results: [], success: false, error: data?.errors?.[0]?.message || "D1 REST query error" };
    } catch (apiErr: any) {
      return { results: [], success: false, error: apiErr?.message || String(apiErr) };
    }
  }

  return { results: [], success: false, error: "No D1 database binding or REST credentials configured" };
}

/**
 * Ensures all standard Cloudflare D1 tables exist
 */
let tablesInitialized = false;

export async function ensureD1Tables(env: any): Promise<void> {
  if (tablesInitialized) return;
  const db = getD1Binding(env);
  if (!db) return;

  const queries = [
    `CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      title TEXT,
      price REAL NOT NULL,
      original_price REAL,
      category TEXT,
      subcategory TEXT,
      image TEXT,
      hover_image TEXT,
      images TEXT,
      colors TEXT,
      sizes TEXT,
      stock INTEGER DEFAULT 10,
      in_stock INTEGER DEFAULT 1,
      is_bestseller INTEGER DEFAULT 0,
      is_new INTEGER DEFAULT 0,
      featured INTEGER DEFAULT 0,
      description TEXT,
      variants TEXT,
      sku TEXT,
      created_at TEXT,
      updated_at TEXT,
      data_json TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS site_content (
      id TEXT PRIMARY KEY,
      content_json TEXT NOT NULL,
      updated_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      count INTEGER DEFAULT 0,
      image TEXT,
      data_json TEXT,
      updated_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number TEXT,
      customer_email TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      total_amount REAL,
      status TEXT DEFAULT 'pending',
      payment_status TEXT DEFAULT 'Pending',
      payment_method TEXT DEFAULT 'UPI',
      utr_number TEXT,
      data_json TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      booking_number TEXT,
      email TEXT,
      phone TEXT,
      patron_name TEXT,
      service TEXT,
      date TEXT,
      slot TEXT,
      status TEXT DEFAULT 'confirmed',
      data_json TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS deleted_ids (
      entity TEXT NOT NULL,
      item_id TEXT NOT NULL,
      deleted_at TEXT NOT NULL,
      PRIMARY KEY (entity, item_id)
    )`,
    `CREATE TABLE IF NOT EXISTS stored_images (
      key TEXT PRIMARY KEY,
      data_url TEXT,
      mime_type TEXT,
      filename TEXT,
      size INTEGER,
      slot TEXT,
      product_id TEXT,
      r2_url TEXT,
      created_at TEXT,
      updated_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS brand_styles (
      id TEXT PRIMARY KEY,
      data_json TEXT NOT NULL,
      updated_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS custom_overrides (
      id TEXT PRIMARY KEY,
      data_json TEXT NOT NULL,
      updated_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS customers (
      uid TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      full_name TEXT,
      phone TEXT,
      password_hash TEXT,
      data_json TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT
    )`,
  ];

  for (const q of queries) {
    try {
      await db.prepare(q).run();
    } catch (e) {
      console.warn("[D1 Init Warning]:", e);
    }
  }

  tablesInitialized = true;
}
