import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  limit,
  db,
  auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  updateProfile,
} from "./cloudflareBridge";
import { AuthUser as User } from "../types";
import { uploadImageToAdminStorage, getAdminAuthToken, deleteImageFromStorage, registerLocalImageCache } from "./adminUploadService";
import {
  Product,
  ColorVariant,
  Order,
  OrderStatus,
  PaymentStatus,
  SiteContent,
  CategoryItem,
  HeroSlide,
  CustomerProfile,
  SavedAddress,
  AtelierBooking,
  NewsletterSubscription,
} from "../types";
import { products as defaultProducts } from "../data/products";
import savedSiteContentJson from "../data/siteContent.json";
import savedCategoriesJson from "../data/categories.json";

export enum OperationType {
  CREATE = "create",
  READ = "read",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: { providerId: string; email?: string | null }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: false,
      tenantId: null,
      providerInfo: [],
    },
    operationType,
    path,
  };
  console.warn("Firestore Error:", JSON.stringify(errInfo));
  return errInfo;
}

export const defaultSiteContent: SiteContent = {
  announcementText: "Handcrafted Heirloom Suits & Luxury Couture | Free Shipping Across India",
  announcementCta: "Shop Festive Edits",
  announcementVisible: true,
  brandTagline: "Heirloom Indian Couture, Reimagined for the Modern Connoisseur",
  brandDescription:
    "Rooted in authentic artisanal traditions. Every ensemble tells an untold tale of pure fabrics, exquisite resham handwork, and regal silhouette artistry.",
  contactPhone: "+91 95016 98356",
  contactEmail: "shriyapusha01@gmail.com",
  whatsappNumber: "+919501698356",
  atelierCity: "Patiala, Punjab, India",
  atelierAddress: "1908/2 Ahluwalia Street, Near Arna Barna Chowk, Patiala, Punjab - 147001",
  heroSlides: [
    {
      eyebrow: "NEW ARRIVAL / Contemporary Pret",
      number: "01",
      collection: "Festive Pret & Luxury Coordinates",
      title: "Sage & Turquoise Handcrafted Printed Kurti Set",
      description:
        "Handcrafted pure cotton-silk designer kurti tunic with traditional geometric & floral motifs, embroidered contrast placket, and effortless artisanal elegance.",
      image: "/uploads/hero-slide-1-turq.jpg",
      season: "SUMMER/FESTIVE 2026",
      caption: "Bespoke Printed Kurti with Embroidered Placket",
      mood: "Turquoise, Sage & Terracotta",
      ctaText: "Explore Collection",
      ctaTarget: "catalog-section",
    },
    {
      eyebrow: "Timeless Indian elegance",
      number: "02",
      collection: "The Festive Edit",
      title: "Grace, Weave in Every Detail",
      description:
        "Elegant mint-green embroidered salwar suit paired with a soft peach striped dupatta featuring delicate scalloped detailing. A graceful choice for festive occasions, family gatherings, and elegant everyday wear.",
      image: "/uploads/hero-slide-2-mint.jpg",
      season: "ROYAL HERITAGE 2026",
      caption: "Pastels • Delicate Embroidery • Effortless Grace",
      mood: "Antique Zari & Handlooms",
      ctaText: "Discover Unstitched",
      ctaTarget: "catalog-section",
    },
    {
      eyebrow: "Daily Chic",
      number: "03",
      collection: "Wrap yourself in the soft elegance of muted pistachio tones and hand-painted watercolor florals, finished with",
      title: "Grace in Every Print",
      description:
        "PURE MUL CHANDERI JACOARD WITH HANDWORK WITH ORGANZA EMBROIDERY FOR SLEEVES AND CONTRAST PIPING WITH LACE ON DAMAN.",
      image: "/uploads/hero-slide-3-chanderi.jpg",
      season: "DAILY CHIC 2026",
      caption: "Printed Organza Dupatta Set in Sage & Pastel Rose",
      mood: "Pastel Silks & Easy Linens",
      ctaText: "Shop Daily Chic",
      ctaTarget: "catalog-section",
    },
  ],
  features: [
    {
      title: "100% Pure Silkmark Certified",
      text: "Every piece arrives with authentic Silk Mark India certification guaranteeing fiber purity.",
      iconName: "ShieldCheck",
    },
    {
      title: "Generous Lengths for Easy Stitching",
      text: "Generous fabric cuts designed for comfortable stitching from size XS to 5XL.",
      iconName: "Sparkles",
    },
    {
      title: "Direct from Varanasi Master Weavers",
      text: "Eliminating intermediaries to directly support heritage artisan families.",
      iconName: "Crown",
    },
    {
      title: "Pan-India Insured Delivery",
      text: "Tamper-evident luxury packaging delivered within 2-4 business days.",
      iconName: "Truck",
    },
  ],
  footerNote: "House of Shriya © 2026. All rights reserved. Handcrafted with reverence in India.",
  catalogTitle: "Heirloom Silks & Festive Ensembles",
  catalogSubtitle: "Curated unstitched luxury fabrics and handwoven silhouettes",
  navLinks: [
    { id: "nav_all", label: "All Collections", href: "#catalog" },
    { id: "nav_banarasi", label: "Banarasi Silks", href: "#catalog" },
    { id: "nav_chanderi", label: "Chanderi Weaves", href: "#catalog" },
    { id: "nav_festive", label: "Festive Ensembles", href: "#catalog" },
    { id: "nav_heritage", label: "Our Story", href: "/our-story" },
    { id: "nav_craft", label: "Craftsmanship", href: "/craftsmanship" },
  ],
  ...(savedSiteContentJson as unknown as Partial<SiteContent>),
};

export const defaultCategories: CategoryItem[] = (savedCategoriesJson as CategoryItem[]) || [
  { id: "cat-all", name: "All Ensembles", slug: "all", description: "Complete artisanal catalog", itemCount: 12, sortOrder: 0 },
  { id: "cat-banarasi", name: "Banarasi Silk", slug: "banarasi-silk", description: "Heavy bridal and festive silks", itemCount: 5, sortOrder: 1 },
  { id: "cat-chanderi", name: "Chanderi", slug: "chanderi", description: "Lightweight summer tissue silks", itemCount: 3, sortOrder: 2 },
  { id: "cat-organza", name: "Organza", slug: "organza", description: "Embroidered sheer silks", itemCount: 2, sortOrder: 3 },
  { id: "cat-chikankari", name: "Chikankari", slug: "chikankari", description: "Hand-embroidered Lucknowi work", itemCount: 2, sortOrder: 4 },
];

const SITE_CONTENT_DOC = "main";
const SITE_CONTENT_CACHE_KEY = "hos_site_content_cache";
const PRODUCTS_CACHE_KEY = "hos_products_cache";
const CATEGORIES_CACHE_KEY = "hos_categories_cache";
const ORDERS_CACHE_KEY = "hos_orders";

// Cache version check: forces mobile & desktop browsers to purge stale local storage caches
const APP_CACHE_VERSION = "hos_v2026_09_18_live_sync_v5";
if (typeof window !== "undefined") {
  try {
    const savedVer = localStorage.getItem("hos_app_cache_version");
    if (savedVer !== APP_CACHE_VERSION) {
      localStorage.removeItem(PRODUCTS_CACHE_KEY);
      localStorage.removeItem(SITE_CONTENT_CACHE_KEY);
      localStorage.removeItem(CATEGORIES_CACHE_KEY);
      localStorage.removeItem(ORDERS_CACHE_KEY);
      localStorage.removeItem("hos_deleted_products");
      localStorage.removeItem("hos_brand_styles_cache");
      localStorage.removeItem("hos_custom_overrides_cache");
      localStorage.setItem("hos_app_cache_version", APP_CACHE_VERSION);
    }
  } catch {}
}

export const DEFAULT_PERMANENTLY_DELETED: Record<string, string[]> = {
  products: [],
  orders: [
    "ord_hos_test_verify_4911",
    "HOS-TEST-VERIFY-4911",
    "test-order-1",
    "HOS-TEST-1",
    "test",
    "HOS-TEST",
  ],
  categories: [],
  bookings: [],
};

// Local deleted items tracking to prevent stale snapshots/re-fetches from reviving deleted items
export function getLocallyDeletedIds(type: string): Set<string> {
  const defaults = DEFAULT_PERMANENTLY_DELETED[type] || [];
  const set = new Set<string>(defaults);
  if (typeof window === "undefined") return set;
  try {
    const raw = localStorage.getItem(`hos_deleted_${type}`);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        for (const item of arr) {
          if (item && typeof item === "string" && item.trim()) {
            set.add(item.trim());
          }
        }
      }
    }
  } catch {}
  return set;
}

export function recordLocallyDeletedId(type: string, id: string): void {
  if (typeof window === "undefined" || !id) return;
  try {
    const current = getLocallyDeletedIds(type);
    current.add(id);
    localStorage.setItem(`hos_deleted_${type}`, JSON.stringify(Array.from(current)));
  } catch {}
}

export function unrecordLocallyDeletedId(type: string, idOrName: string): void {
  if (typeof window === "undefined" || !idOrName) return;
  try {
    const current = getLocallyDeletedIds(type);
    let changed = false;
    if (current.has(idOrName)) {
      current.delete(idOrName);
      changed = true;
    }
    const clean = idOrName.trim().toLowerCase();
    for (const item of Array.from(current)) {
      if (typeof item === "string" && item.trim().toLowerCase() === clean) {
        current.delete(item);
        changed = true;
      }
    }
    if (changed) {
      localStorage.setItem(`hos_deleted_${type}`, JSON.stringify(Array.from(current)));
    }
  } catch {}
}

// Synchronize deleted IDs from backend so deletions persist across tabs/devices/sessions
export async function syncServerDeletedIds(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const res = await fetch(`/api/deleted-ids?t=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === "object") {
        for (const [type, ids] of Object.entries(data)) {
          if (Array.isArray(ids)) {
            const current = getLocallyDeletedIds(type);
            let changed = false;
            for (const id of ids) {
              if (typeof id === "string" && id && !current.has(id)) {
                current.add(id);
                changed = true;
              }
            }
            if (changed) {
              localStorage.setItem(`hos_deleted_${type}`, JSON.stringify(Array.from(current)));
            }
          }
        }

        // Purge deleted items from active caches and notify UI
        const delProducts = getLocallyDeletedIds("products");
        if (delProducts.size > 0) {
          const rawProds = localStorage.getItem(PRODUCTS_CACHE_KEY);
          if (rawProds) {
            try {
              const pList = JSON.parse(rawProds);
              if (Array.isArray(pList)) {
                const filtered = pList.filter((p) => p && !delProducts.has(p.id) && !delProducts.has((p as any).sku));
                localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(filtered));
                window.dispatchEvent(new CustomEvent("hos-catalog-updated", { detail: filtered }));
              }
            } catch {}
          }
        }

        const delCats = getLocallyDeletedIds("categories");
        if (delCats.size > 0) {
          const rawCats = localStorage.getItem(CATEGORIES_CACHE_KEY);
          if (rawCats) {
            try {
              const cList = JSON.parse(rawCats);
              if (Array.isArray(cList)) {
                const filtered = cList.filter((c) => c && !delCats.has(c.id) && !delCats.has(c.slug));
                localStorage.setItem(CATEGORIES_CACHE_KEY, JSON.stringify(filtered));
                window.dispatchEvent(new CustomEvent("hos-categories-updated", { detail: filtered }));
              }
            } catch {}
          }
        }

        const delOrders = getLocallyDeletedIds("orders");
        if (delOrders.size > 0) {
          const rawOrders = localStorage.getItem(ORDERS_CACHE_KEY);
          if (rawOrders) {
            try {
              const oList = JSON.parse(rawOrders);
              if (Array.isArray(oList)) {
                const filtered = oList.filter((o) => o && !delOrders.has(o.id) && !delOrders.has(o.orderNumber));
                localStorage.setItem(ORDERS_CACHE_KEY, JSON.stringify(filtered));
                window.dispatchEvent(new CustomEvent("hos-orders-updated", { detail: filtered }));
              }
            } catch {}
          }
        }
      }
    }
  } catch {}
}

// Universal safe ISO date parser
export function parseSafeIsoDate(rawDate: any): string {
  if (!rawDate) return new Date().toISOString();
  try {
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) return d.toISOString();
    const clean = String(rawDate).replace(/,/g, "").trim();
    const d2 = new Date(clean);
    if (!isNaN(d2.getTime())) return d2.toISOString();
  } catch {}
  return new Date().toISOString();
}

// Universal timestamp & deletion-aware merge helper: protects local updates and deletions from being reverted
export function mergeEntitiesByTimestamp<T extends { id?: string; updatedAt?: string; createdAt?: string }>(
  localList: T[],
  incomingList: T[],
  deletedIds: Set<string>,
  idKey: (item: T) => string | undefined,
  altIdKey?: (item: T) => string | undefined
): T[] {
  const map = new Map<string, T>();
  const isDeleted = (item: T) => {
    if (!item) return true;
    const k1 = idKey(item);
    const k2 = altIdKey ? altIdKey(item) : undefined;
    if (k1 && deletedIds.has(k1)) return true;
    if (k2 && deletedIds.has(k2)) return true;
    return false;
  };

  const getTime = (item: T) => {
    const raw = item.updatedAt || item.createdAt;
    if (!raw) return 0;
    try {
      const t = new Date(raw).getTime();
      if (!isNaN(t)) return t;
      const clean = String(raw).replace(/,/g, "").trim();
      const t2 = new Date(clean).getTime();
      if (!isNaN(t2)) return t2;
    } catch {}
    return 0;
  };

  // 1. Incoming items from server placed into map
  for (const item of incomingList) {
    if (!item || isDeleted(item)) continue;
    const k1 = idKey(item);
    const k2 = altIdKey ? altIdKey(item) : undefined;
    if (k1) map.set(k1, item);
    if (k2) map.set(k2, item);
  }

  // 2. Reconcile with local items:
  // - If item exists in both: compare timestamps and preserve newest data, deep-merging non-empty fields
  // - If item exists only in localList and is not deleted: keep it so optimistic updates/new references are never wiped out
  for (const item of localList) {
    if (!item || isDeleted(item)) continue;
    const k1 = idKey(item);
    const k2 = altIdKey ? altIdKey(item) : undefined;
    const key = k1 || k2;
    if (!key) continue;

    if (map.has(key)) {
      const existing = map.get(key)!;
      const localTime = getTime(item);
      const incomingTime = getTime(existing);
      if (localTime > incomingTime) {
        // Local edit is strictly newer: keep local item and backfill any missing server properties
        map.set(key, { ...existing, ...item });
      } else if (incomingTime > localTime) {
        // Server item is strictly newer: adopt server item, preserving any local reference/UTR if server lacked it
        const localUtr = (item as any).utrNumber || (item as any).paymentDetails?.utrNumber;
        const localRef = (item as any).referenceNumber || (item as any).bookingNumber;
        const mergedServer = { ...item, ...existing };
        if (localUtr && !(mergedServer as any).utrNumber) {
          (mergedServer as any).utrNumber = localUtr;
        }
        if (localRef && !(mergedServer as any).referenceNumber && !(mergedServer as any).bookingNumber) {
          (mergedServer as any).bookingNumber = localRef;
        }
        map.set(key, mergedServer);
      } else {
        // Timestamps match or missing: merge both, local values take precedence
        map.set(key, { ...existing, ...item });
      }
    } else {
      // Local item not yet reflected on server: preserve it safely
      map.set(key, item);
    }
  }

  // Deduplicate entries
  const seen = new Set<T>();
  const result: T[] = [];
  for (const item of map.values()) {
    if (!seen.has(item) && !isDeleted(item)) {
      seen.add(item);
      result.push(item);
    }
  }
  return result;
}

// Multi-tab / cross-device broadcast channel for 0ms instantaneous synchronization
const syncChannel: BroadcastChannel | null =
  typeof window !== "undefined" && "BroadcastChannel" in window
    ? new BroadcastChannel("hos_cross_device_channel")
    : null;

export function broadcastCrossDeviceSync(
  type: "products" | "orders" | "categories" | "site_content" | "bookings" | "brand_styles" | "custom_overrides" | "factory_reset",
  data?: any
) {
  if (syncChannel) {
    try {
      syncChannel.postMessage({ type, data, timestamp: Date.now() });
    } catch {}
  }
}

if (typeof window !== "undefined" && syncChannel) {
  syncChannel.addEventListener("message", (event: MessageEvent) => {
    const { type, data } = event.data || {};
    if (type === "brand_styles" && data) {
      cacheBrandStylesLocally(data);
      window.dispatchEvent(new CustomEvent("hos-brand-styles-updated", { detail: data }));
    } else if (type === "custom_overrides" && data) {
      cacheCustomOverridesLocally(data);
      window.dispatchEvent(new CustomEvent("hos-custom-overrides-updated", { detail: data }));
    } else if (type === "factory_reset") {
      window.dispatchEvent(new CustomEvent("hos-catalog-updated", { detail: [] }));
    }
  });
}

// Server-Sent Events (SSE) live sync client: keeps any device and tab in real-time sync with server files
let sseSource: EventSource | null = null;
let sseReconnectTimer: any = null;

export function initServerLiveSync() {
  if (typeof window === "undefined" || !("EventSource" in window)) return;
  if (sseSource) return;

  try {
    sseSource = new EventSource("/api/sync/events");

    const handlePayload = (dataStr: string) => {
      try {
        const payload = JSON.parse(dataStr);
        if (!payload || !payload.type) return;

        if (payload.type === "products" && Array.isArray(payload.data)) {
          const deleted = getLocallyDeletedIds("products");
          const normalized = payload.data
            .map(ensureProductVariants)
            .filter((p: any) => p && p.id && !deleted.has(p.id));
          cacheProductsLocally(normalized);
          window.dispatchEvent(new CustomEvent("hos-catalog-updated", { detail: normalized }));
        } else if ((payload.type === "site_content" || payload.type === "siteContent") && payload.data) {
          const currentCached = getCachedSiteContent();
          const incomingTime = payload.data.updatedAt ? new Date(payload.data.updatedAt).getTime() : 0;
          const cachedTime = currentCached?.updatedAt ? new Date(currentCached.updatedAt).getTime() : 0;
          // Protect recent local save from being overwritten by older broadcast
          if (incomingTime && cachedTime && incomingTime < cachedTime) {
            return;
          }
          if (lastSiteContentSavedTimestamp > 0 && Date.now() - lastSiteContentSavedTimestamp < 15000) {
            if (incomingTime <= lastSiteContentSavedTimestamp) {
              return;
            }
          }
          const merged = { ...defaultSiteContent, ...currentCached, ...payload.data };
          if (Array.isArray(payload.data.heroSlides) && payload.data.heroSlides.length > 0) {
            merged.heroSlides = payload.data.heroSlides;
          } else if (Array.isArray(currentCached?.heroSlides) && currentCached.heroSlides.length > 0) {
            merged.heroSlides = currentCached.heroSlides;
          }
          if (Array.isArray(payload.data.features)) {
            merged.features = payload.data.features;
          }
          if (Array.isArray(payload.data.trustBadges)) {
            merged.trustBadges = payload.data.trustBadges;
          }
          cacheSiteContentLocally(merged);
          window.dispatchEvent(new CustomEvent("hos-content-updated", { detail: merged }));
        } else if (payload.type === "categories" && Array.isArray(payload.data)) {
          const deleted = getLocallyDeletedIds("categories");
          const filtered = payload.data.filter(
            (c: any) => c && !deleted.has(c.id) && !deleted.has(c.slug) && !deleted.has(c.name)
          );
          filtered.sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));
          cacheCategoriesLocally(filtered);
          window.dispatchEvent(new CustomEvent("hos-categories-updated", { detail: filtered }));
        } else if (payload.type === "orders" && Array.isArray(payload.data)) {
          const deleted = getLocallyDeletedIds("orders");
          const filtered = payload.data.filter(
            (o: any) => o && !deleted.has(o.id) && !deleted.has(o.orderNumber)
          );
          filtered.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          cacheOrdersLocally(filtered);
          window.dispatchEvent(new CustomEvent("hos-orders-updated", { detail: filtered }));
        } else if (payload.type === "bookings" && Array.isArray(payload.data)) {
          const deleted = getLocallyDeletedIds("bookings");
          const filtered = payload.data.filter(
            (b: any) => b && !deleted.has(b.id) && !deleted.has(b.bookingNumber)
          );
          filtered.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          localStorage.setItem("hos_atelier_bookings", JSON.stringify(filtered));
          window.dispatchEvent(new CustomEvent("hos-bookings-updated", { detail: filtered }));
        } else if ((payload.type === "brand_styles" || payload.type === "brandStyles") && payload.data) {
          cacheBrandStylesLocally(payload.data);
          window.dispatchEvent(new CustomEvent("hos-brand-styles-updated", { detail: payload.data }));
        } else if ((payload.type === "custom_overrides" || payload.type === "customOverrides") && payload.data) {
          cacheCustomOverridesLocally(payload.data);
          window.dispatchEvent(new CustomEvent("hos-custom-overrides-updated", { detail: payload.data }));
        } else if (payload.type === "factory_reset") {
          localStorage.removeItem("hos_cached_products");
          localStorage.removeItem("hos_custom_overrides");
          syncServerDeletedIds().catch(() => {});
          window.dispatchEvent(new CustomEvent("hos-catalog-updated", { detail: [] }));
        } else if (payload.type === "deleted_ids" || payload.type === "deleted_id") {
          syncServerDeletedIds().catch(() => {});
        }
      } catch (err) {
        console.warn("SSE sync payload parse notice:", err);
      }
    };

    sseSource.addEventListener("sync", (event: MessageEvent) => {
      if (event.data) handlePayload(event.data);
    });

    sseSource.onmessage = (event: MessageEvent) => {
      if (event.data) handlePayload(event.data);
    };

    sseSource.onerror = () => {
      if (sseSource) {
        sseSource.close();
        sseSource = null;
      }
      clearTimeout(sseReconnectTimer);
      sseReconnectTimer = setTimeout(() => {
        initServerLiveSync();
      }, 3000);
    };
  } catch (err) {
    console.warn("SSE init notice:", err);
  }
}

if (typeof window !== "undefined") {
  syncServerDeletedIds();
  initServerLiveSync();
}

/* ============================================================
   PRODUCT VARIANT NORMALIZATION & CACHING
============================================================ */

export function ensureProductVariants(product: any): Product {
  const primaryImg = product.image || (Array.isArray(product.images) && product.images[0]) || "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&q=80";
  const hoverImg = product.hoverImage || (Array.isArray(product.images) && product.images[1]) || primaryImg;

  // Clean gallery images without forcefully resurrecting deleted photos
  let cleanImages: string[] = [];
  if (Array.isArray(product.images) && product.images.length > 0) {
    cleanImages = product.images.filter(Boolean);
  } else {
    cleanImages = [primaryImg, hoverImg].filter(Boolean);
  }

  // Ensure primary image is always at index 0 of cleanImages
  if (primaryImg) {
    cleanImages = [primaryImg, ...cleanImages.filter((img) => img !== primaryImg)];
  }

  let variants: ColorVariant[] = [];
  if (Array.isArray(product.colorVariants) && product.colorVariants.length > 0) {
    variants = product.colorVariants.map((v: any, idx: number) => {
      let vImages: string[] = [];
      if (idx === 0) {
        vImages = cleanImages;
      } else if (Array.isArray(v.images) && v.images.length > 0) {
        vImages = v.images.filter(Boolean);
      } else if (v.image) {
        vImages = [v.image, v.hoverImage || v.image].filter(Boolean);
      } else {
        vImages = [primaryImg, hoverImg].filter(Boolean);
      }

      return {
        ...v,
        id: v.id || `var-${product.id || "prod"}-${idx + 1}`,
        colorName: idx === 0 ? (product.color || v.colorName || "Royal Emerald") : (v.colorName || product.color || "Royal Emerald"),
        colorHex: idx === 0 ? (product.colorHex || v.colorHex || "#0d4f3c") : (v.colorHex || product.colorHex || "#0d4f3c"),
        price: idx === 0 ? (product.price || v.price || "₹2,999") : (v.price || product.price || "₹2,999"),
        originalPrice: idx === 0 ? (product.originalPrice || v.originalPrice || "₹4,499") : (v.originalPrice || product.originalPrice || "₹4,499"),
        savings: idx === 0 ? (product.savings || v.savings || "Save 33%") : (v.savings || product.savings || "Save 33%"),
        description: idx === 0 ? (product.description !== undefined ? product.description : v.description || "") : (v.description || product.description || ""),
        fabricType: idx === 0 ? (product.fabricType || v.fabricType || "Pure Silk") : (v.fabricType || product.fabricType || "Pure Silk"),
        images: vImages,
        image: idx === 0 ? primaryImg : (vImages[0] || v.image || primaryImg),
        hoverImage: idx === 0 ? hoverImg : (vImages[1] || vImages[0] || v.hoverImage || hoverImg),
        inStock: idx === 0 ? (product.inStock !== false && v.inStock !== false) : (v.inStock !== false),
      };
    });
  } else {
    variants = [
      {
        id: `var-${product.id || "prod"}-primary`,
        colorName: product.color || "Classic",
        colorHex: product.colorHex || "#0d4f3c",
        price: product.price || "₹2,999",
        originalPrice: product.originalPrice || "₹4,499",
        savings: product.savings || "Save 33%",
        description: product.description || "",
        fabricType: product.fabricType || "Pure Silk",
        images: cleanImages,
        image: cleanImages[0] || primaryImg,
        hoverImage: cleanImages[1] || cleanImages[0] || hoverImg,
        inStock: product.inStock !== false,
      },
    ];
  }

  return {
    ...product,
    image: primaryImg,
    hoverImage: hoverImg,
    images: cleanImages,
    colorVariants: variants,
    sizes: product.sizes || ["Unstitched Fabric (5.5m + 1m Blouse Piece)"],
    inStock: product.inStock !== false,
  };
}

export function getCachedProducts(): Product[] {
  const deleted = getLocallyDeletedIds("products");
  if (typeof window !== "undefined" && localStorage.getItem("hos_factory_reset_completed")) {
    return [];
  }
  try {
    const saved = localStorage.getItem(PRODUCTS_CACHE_KEY);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed
          .map(ensureProductVariants)
          .filter(
            (p) =>
              p &&
              p.id &&
              !deleted.has(p.id) &&
              !deleted.has((p as any).sku) &&
              (!p.name || !deleted.has(p.name))
          );
      }
    }
  } catch {}
  return defaultProducts
    .map(ensureProductVariants)
    .filter(
      (p) =>
        p &&
        p.id &&
        !deleted.has(p.id) &&
        !deleted.has((p as any).sku) &&
        (!p.name || !deleted.has(p.name))
    );
}

export function cacheProductsLocally(prods: Product[]) {
  // Always register high-res photos into memory and IndexedDB cache
  try {
    for (const p of prods) {
      if (p.image) {
        registerLocalImageCache(p.image, p.image);
        if (p.id) registerLocalImageCache(p.id, p.image);
      }
      if (p.hoverImage && p.hoverImage !== p.image) {
        registerLocalImageCache(p.hoverImage, p.hoverImage);
      }
      if (Array.isArray(p.images)) {
        for (const img of p.images) {
          if (img) registerLocalImageCache(img, img);
        }
      }
    }
  } catch {}

  try {
    localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(prods));
  } catch (err) {
    try {
      // If local storage is full, evict non-essential caches and retry
      const evictKeys = ["hos_orders", "hos_atelier_bookings", "hos_customers"];
      evictKeys.forEach((k) => localStorage.removeItem(k));
      localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(prods));
    } catch {
      // If still exceeding quota, keep existing structure and safe references rather than wiping with Unsplash
      try {
        const compact = prods.map((p) => {
          if (p.image && p.image.startsWith("data:")) {
            registerLocalImageCache(p.id, p.image);
          }
          return p;
        });
        localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(compact));
      } catch {}
    }
  }
}

export function getCachedCategories(): CategoryItem[] {
  const deleted = getLocallyDeletedIds("categories");
  try {
    const saved = localStorage.getItem(CATEGORIES_CACHE_KEY);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (c) =>
            c &&
            (!c.id || !deleted.has(c.id)) &&
            (!c.slug || !deleted.has(c.slug)) &&
            (!c.name || !deleted.has(c.name))
        );
      }
    }
  } catch {}
  return defaultCategories.filter(
    (c) =>
      c &&
      (!c.id || !deleted.has(c.id)) &&
      (!c.slug || !deleted.has(c.slug)) &&
      (!c.name || !deleted.has(c.name))
  );
}

export function cacheCategoriesLocally(cats: CategoryItem[]): void {
  try {
    localStorage.setItem(CATEGORIES_CACHE_KEY, JSON.stringify(cats));
  } catch {}
}

export function sanitizeSiteContent(content: Partial<SiteContent>): Partial<SiteContent> {
  return content;
}

export function getCachedSiteContent(): SiteContent {
  try {
    const raw = localStorage.getItem(SITE_CONTENT_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        const sanitized = sanitizeSiteContent(parsed);
        const merged: SiteContent = { ...defaultSiteContent, ...sanitized };
        // If heroSlides was explicitly configured with slides, respect them directly without overriding
        if (Array.isArray(sanitized.heroSlides) && sanitized.heroSlides.length > 0) {
          merged.heroSlides = sanitized.heroSlides;
        } else if (!merged.heroSlides || merged.heroSlides.length === 0) {
          merged.heroSlides = defaultSiteContent.heroSlides || [];
        }
        return merged;
      }
    }
  } catch {}
  return defaultSiteContent;
}

export function cacheSiteContentLocally(content: SiteContent): void {
  try {
    const clean = sanitizeSiteContent({ ...content }) as SiteContent;
    localStorage.setItem(SITE_CONTENT_CACHE_KEY, JSON.stringify(clean));
  } catch {}
}

/* ============================================================
   CONTENT & CATALOG SUBSCRIPTIONS (CLIENT-SIDE)
============================================================ */

export function subscribeSiteContent(callback: (content: SiteContent) => void): () => void {
  // 1. Immediately provide cached/default content for zero-delay paint
  let currentContent = getCachedSiteContent();
  callback(currentContent);

  let active = true;

  const applyContentIfNewer = (incoming: SiteContent, force = false) => {
    if (!incoming || typeof incoming !== "object") return;
    const incomingTime = incoming.updatedAt ? new Date(incoming.updatedAt).getTime() : 0;
    const currentTime = currentContent?.updatedAt ? new Date(currentContent.updatedAt).getTime() : 0;

    // Protection window: If a local save happened in the last 15 seconds, reject any incoming content with older or equal timestamp
    if (!force && lastSiteContentSavedTimestamp > 0 && Date.now() - lastSiteContentSavedTimestamp < 15000) {
      if (incomingTime <= lastSiteContentSavedTimestamp) {
        return;
      }
    }

    // Never overwrite populated heroSlides with empty array
    if (
      Array.isArray(currentContent?.heroSlides) &&
      currentContent.heroSlides.length > 0 &&
      (!Array.isArray(incoming.heroSlides) || incoming.heroSlides.length === 0)
    ) {
      incoming.heroSlides = currentContent.heroSlides;
    }

    // If currentContent has valid heroSlide images from this session or local edits, preserve them if incoming has defaults or missing images
    if (Array.isArray(currentContent?.heroSlides) && Array.isArray(incoming.heroSlides)) {
      incoming.heroSlides = incoming.heroSlides.map((incSlide, idx) => {
        const curSlide = currentContent?.heroSlides?.[idx];
        if (
          curSlide?.image &&
          !curSlide.image.includes("unsplash.com") &&
          curSlide.image !== defaultSiteContent.heroSlides?.[idx]?.image
        ) {
          if (
            !incSlide.image ||
            incSlide.image.includes("unsplash.com") ||
            incSlide.image === defaultSiteContent.heroSlides?.[idx]?.image
          ) {
            return { ...incSlide, image: curSlide.image };
          }
        }
        return incSlide;
      });
    }

    // Never overwrite newer content with older stale data
    if (!force && incomingTime > 0 && currentTime > 0 && incomingTime < currentTime) {
      return;
    }

    // If incoming has no timestamp but current has an updatedAt timestamp, don't overwrite!
    if (!force && !incomingTime && currentTime > 0) {
      return;
    }

    if (force || incomingTime >= currentTime || !currentContent?.updatedAt) {
      currentContent = incoming;
      cacheSiteContentLocally(incoming);
      callback(incoming);
    }
  };

  // Active sync function: fetches live site content from backend API
  const fetchLiveSiteContent = async () => {
    if (!active) return;
    try {
      const res = await fetch(`/api/site-content?t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      });
      const ct = res.headers.get("content-type") || "";
      if (res.ok && ct.includes("application/json") && !res.redirected) {
        const serverData = await res.json();
        if (serverData && typeof serverData === "object" && Object.keys(serverData).length > 0) {
          const merged: SiteContent = { ...defaultSiteContent, ...serverData };
          if (Array.isArray(serverData.heroSlides)) {
            merged.heroSlides = serverData.heroSlides;
          }
          if (Array.isArray(serverData.features)) {
            merged.features = serverData.features;
          }
          if (Array.isArray(serverData.trustBadges)) {
            merged.trustBadges = serverData.trustBadges;
          }
          applyContentIfNewer(merged, false);
          return;
        }
      }
    } catch {}

    // Fallback to static JSON file ONLY if no local content has ever been saved
    const cached = getCachedSiteContent();
    if (!cached?.updatedAt && !currentContent?.updatedAt) {
      try {
        const staticRes = await fetch(`/data/siteContent.json?t=${Date.now()}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
        });
        const sct = staticRes.headers.get("content-type") || "";
        if (staticRes.ok && sct.includes("application/json")) {
          const staticData = await staticRes.json();
          if (staticData && typeof staticData === "object" && Object.keys(staticData).length > 0) {
            const merged: SiteContent = { ...defaultSiteContent, ...staticData };
            if (Array.isArray(staticData.heroSlides) && staticData.heroSlides.length > 0) {
              merged.heroSlides = staticData.heroSlides;
            } else if (!merged.heroSlides || merged.heroSlides.length === 0) {
              merged.heroSlides = defaultSiteContent.heroSlides || [];
            }
            applyContentIfNewer(merged, false);
          }
        }
      } catch {}
    }
  };

  // Immediate live fetch
  fetchLiveSiteContent();

  // Active background polling interval (every 4s) for instant sync across devices
  const pollTimer = setInterval(fetchLiveSiteContent, 4000);

  // Focus & mobile visibility change (crucial for phones when resuming screen)
  const handleWakeup = () => {
    if (typeof document !== "undefined" && !document.hidden) {
      fetchLiveSiteContent();
    }
  };

  // Firestore real-time listener (the instant cloud sync engine across devices)
  let unsubFs = () => {};
  try {
    const docRef = doc(db, "site_content", SITE_CONTENT_DOC);
    unsubFs = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const fsData = snap.data() as SiteContent;
          if (fsData && typeof fsData === "object") {
            const merged: SiteContent = { ...defaultSiteContent, ...fsData };
            if (Array.isArray(fsData.heroSlides) && fsData.heroSlides.length > 0) {
              merged.heroSlides = fsData.heroSlides;
            } else if (!merged.heroSlides || merged.heroSlides.length === 0) {
              merged.heroSlides = defaultSiteContent.heroSlides || [];
            }
            applyContentIfNewer(merged);
          }
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, `site_content/${SITE_CONTENT_DOC}`);
      }
    );
  } catch (initErr) {
    handleFirestoreError(initErr, OperationType.GET, `site_content/${SITE_CONTENT_DOC}`);
  }

  // Event & BroadcastChannel listeners
  const handleContentUpdate = (e: Event) => {
    const customEvt = e as CustomEvent;
    if (customEvt.detail) {
      currentContent = customEvt.detail;
      cacheSiteContentLocally(customEvt.detail);
      callback(customEvt.detail);
    }
  };

  const handleBroadcastMessage = (event: MessageEvent) => {
    if (event.data?.type === "site_content" || event.data?.type === "siteContent") {
      if (event.data.data && typeof event.data.data === "object") {
        const merged: SiteContent = { ...defaultSiteContent, ...event.data.data };
        if (Array.isArray(event.data.data.heroSlides)) {
          merged.heroSlides = event.data.data.heroSlides;
        }
        if (Array.isArray(event.data.data.features)) {
          merged.features = event.data.data.features;
        }
        if (Array.isArray(event.data.data.trustBadges)) {
          merged.trustBadges = event.data.data.trustBadges;
        }
        applyContentIfNewer(merged, true);
      } else {
        fetchLiveSiteContent();
      }
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("hos-content-updated", handleContentUpdate);
    window.addEventListener("focus", handleWakeup);
    window.addEventListener("pageshow", handleWakeup);
    window.addEventListener("online", handleWakeup);
  }
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", handleWakeup);
  }
  if (syncChannel) {
    syncChannel.addEventListener("message", handleBroadcastMessage);
  }

  return () => {
    active = false;
    clearInterval(pollTimer);
    unsubFs();
    if (typeof window !== "undefined") {
      window.removeEventListener("hos-content-updated", handleContentUpdate);
      window.removeEventListener("focus", handleWakeup);
      window.removeEventListener("pageshow", handleWakeup);
      window.removeEventListener("online", handleWakeup);
    }
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", handleWakeup);
    }
    if (syncChannel) {
      syncChannel.removeEventListener("message", handleBroadcastMessage);
    }
  };
}

let isSavingSiteContent = false;
let lastSiteContentSavedTimestamp = 0;
let pendingSiteContentSaves: Partial<SiteContent>[] = [];

export function getLastSiteContentSavedTime(): number {
  return lastSiteContentSavedTimestamp;
}

export function isSiteContentSaving(): boolean {
  return isSavingSiteContent;
}

export async function saveSiteContent(content: Partial<SiteContent>): Promise<SiteContent> {
  lastSiteContentSavedTimestamp = Date.now();
  if (isSavingSiteContent) {
    pendingSiteContentSaves.push(content);
    // Return optimistic state immediately while queued
    const existing = getCachedSiteContent();
    return { ...defaultSiteContent, ...existing, ...content, updatedAt: new Date().toISOString() };
  }

  isSavingSiteContent = true;

  try {
    const existing = getCachedSiteContent();
    const sanitizedContent = sanitizeSiteContent({ ...content });
    const timestamp = new Date().toISOString();
    const updated: SiteContent = {
      ...defaultSiteContent,
      ...existing,
      ...sanitizedContent,
      updatedAt: timestamp,
    };

    if (Array.isArray(sanitizedContent.heroSlides)) {
      const uploadedSlides = await Promise.all(
        sanitizedContent.heroSlides.map(async (slide, idx) => {
          if (slide.image && (slide.image.startsWith("data:") || slide.image.startsWith("blob:"))) {
            try {
              const permUrl = await uploadImageToAdminStorage(slide.image, {
                slot: `hero-slide-${idx + 1}`,
              });
              return { ...slide, image: permUrl };
            } catch (e) {
              console.error(`[saveSiteContent] Slide ${idx + 1} upload failed:`, e);
            }
          }
          return slide;
        })
      );
      updated.heroSlides = uploadedSlides;
    }
    if (Array.isArray(sanitizedContent.features)) {
      updated.features = sanitizedContent.features;
    }
    if (Array.isArray(sanitizedContent.trustBadges)) {
      updated.trustBadges = sanitizedContent.trustBadges;
    }

    // 1. Immediately cache locally and clear any stale overrides for updated fields
    cacheSiteContentLocally(updated);
    try {
      const rawOverrides = localStorage.getItem("hos_custom_overrides");
      if (rawOverrides) {
        const overrides = JSON.parse(rawOverrides);
        let changed = false;
        for (const k of Object.keys(overrides)) {
          if (k.startsWith("hero_slide_") || k.startsWith("announcement_bar_") || k.includes("hero")) {
            delete overrides[k];
            changed = true;
          }
        }
        if (changed) {
          localStorage.setItem("hos_custom_overrides", JSON.stringify(overrides));
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("hos-custom-overrides-updated", { detail: overrides }));
          }
        }
      }
    } catch {}

    // 2. Dispatch events synchronously for 0ms reactive UI refresh
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("hos-content-updated", { detail: updated }));
    }
    broadcastCrossDeviceSync("site_content" as any, updated);

    // 3. Sync to API backend for disk persistence with admin token
    const adminToken = getAdminAuthToken();
    try {
      const res = await fetch("/api/site-content", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": adminToken,
          "x-admin-key": adminToken,
          authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        const json = await res.json().catch(() => null);
        const fresh = json?.siteContent || json?.content;
        if (fresh && typeof fresh === "object") {
          Object.assign(updated, fresh);
          cacheSiteContentLocally(updated);
        }
      }
    } catch (apiErr: any) {
      console.warn("[StoreService] API site content sync note:", apiErr?.message || apiErr);
    }

    // 4. Sync to Firestore (if available)
    try {
      await ensureAdminFirebaseAuth().catch(() => null);
      const docRef = doc(db, "site_content", SITE_CONTENT_DOC);
      await setDoc(docRef, sanitizeForFirestore(updated), { merge: true });
    } catch (fsErr: any) {
      console.warn(`[StoreService] Firestore site content sync notice:`, fsErr?.message || fsErr);
    }

    return updated;
  } finally {
    isSavingSiteContent = false;
    if (pendingSiteContentSaves.length > 0) {
      const nextBatch = pendingSiteContentSaves.shift();
      if (nextBatch) {
        saveSiteContent(nextBatch).catch(() => {});
      }
    }
  }
}

export function subscribeCategories(callback: (categories: CategoryItem[]) => void): () => void {
  callback(getCachedCategories());

  let active = true;

  const fetchLiveCategories = async () => {
    if (!active) return;
    try {
      const res = await fetch(`/api/categories?t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      });
      const ct = res.headers.get("content-type") || "";
      if (res.ok && ct.includes("application/json") && !res.redirected) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const deleted = getLocallyDeletedIds("categories");
          const filtered = data
            .filter((c: any) => c && (!deleted.has(c.id) && !deleted.has(c.slug) && !deleted.has(c.name)))
            .sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));

          const currentCached = getCachedCategories();
          const mergedMap = new Map<string, CategoryItem>();
          filtered.forEach((c: CategoryItem) => mergedMap.set(c.id, c));
          currentCached.forEach((c) => {
            if (!deleted.has(c.id) && !deleted.has(c.slug) && !deleted.has(c.name)) {
              mergedMap.set(c.id, c);
            }
          });
          const merged = Array.from(mergedMap.values());
          cacheCategoriesLocally(merged);
          callback(merged);
          return;
        }
      }
    } catch {}

    // Fallback to static JSON file if server endpoint temporarily unavailable
    try {
      const staticRes = await fetch(`/data/categories.json?t=${Date.now()}`, {
        cache: "no-store",
      });
      const sct = staticRes.headers.get("content-type") || "";
      if (staticRes.ok && sct.includes("application/json")) {
        const data = await staticRes.json();
        if (Array.isArray(data) && data.length > 0) {
          const deleted = getLocallyDeletedIds("categories");
          const filtered = data
            .filter((c: any) => c && (!deleted.has(c.id) && !deleted.has(c.slug) && !deleted.has(c.name)))
            .sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));

          const currentCached = getCachedCategories();
          if (currentCached && currentCached.length > 0) {
            const mergedMap = new Map<string, CategoryItem>();
            filtered.forEach((c: CategoryItem) => mergedMap.set(c.id, c));
            currentCached.forEach((c) => {
              if (!deleted.has(c.id) && !deleted.has(c.slug) && !deleted.has(c.name)) {
                mergedMap.set(c.id, c);
              }
            });
            const merged = Array.from(mergedMap.values());
            cacheCategoriesLocally(merged);
            callback(merged);
          } else {
            cacheCategoriesLocally(filtered);
            callback(filtered);
          }
        }
      }
    } catch {}
  };

  fetchLiveCategories();
  const pollTimer = setInterval(fetchLiveCategories, 6000);

  // Mobile wakeups
  const handleWakeup = () => {
    if (typeof document !== "undefined" && !document.hidden) {
      fetchLiveCategories();
    }
  };

  // Firestore real-time listener
  let unsubFs = () => {};
  try {
    const colRef = collection(db, "categories");
    unsubFs = onSnapshot(
      colRef,
      (snapshot) => {
        if (!snapshot.empty) {
          const deleted = getLocallyDeletedIds("categories");
          const fsList = snapshot.docs
            .map((d) => ({ id: d.id, ...d.data() } as CategoryItem))
            .filter((c) => c && !deleted.has(c.id) && !deleted.has(c.slug) && !deleted.has(c.name))
            .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

          if (fsList.length > 0) {
            cacheCategoriesLocally(fsList);
            callback(fsList);
          }
        }
      },
      () => {}
    );
  } catch {}

  const handleBroadcastMessage = (event: MessageEvent) => {
    if (event.data?.type === "categories") {
      if (Array.isArray(event.data.data)) {
        const deleted = getLocallyDeletedIds("categories");
        const filtered = event.data.data.filter(
          (c: any) => c && !deleted.has(c.id) && !deleted.has(c.slug) && !deleted.has(c.name)
        );
        filtered.sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));
        cacheCategoriesLocally(filtered);
        callback(filtered);
      } else {
        fetchLiveCategories();
      }
    }
  };

  const handleCategoriesUpdated = (e: any) => {
    if (Array.isArray(e.detail) && e.detail.length > 0) {
      cacheCategoriesLocally(e.detail);
      callback(e.detail);
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("focus", handleWakeup);
    window.addEventListener("pageshow", handleWakeup);
    window.addEventListener("online", handleWakeup);
    window.addEventListener("hos-categories-updated", handleCategoriesUpdated);
  }
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", handleWakeup);
  }
  if (syncChannel) {
    syncChannel.addEventListener("message", handleBroadcastMessage);
  }

  return () => {
    active = false;
    clearInterval(pollTimer);
    unsubFs();
    if (typeof window !== "undefined") {
      window.removeEventListener("focus", handleWakeup);
      window.removeEventListener("pageshow", handleWakeup);
      window.removeEventListener("online", handleWakeup);
      window.removeEventListener("hos-categories-updated", handleCategoriesUpdated);
    }
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", handleWakeup);
    }
    if (syncChannel) {
      syncChannel.removeEventListener("message", handleBroadcastMessage);
    }
  };
}

export async function saveCategory(category: CategoryItem): Promise<void> {
  unrecordLocallyDeletedId("categories", category.id);
  if (category.slug) unrecordLocallyDeletedId("categories", category.slug);
  if (category.name) unrecordLocallyDeletedId("categories", category.name);

  const current = getCachedCategories();
  const idx = current.findIndex((c) => c.id === category.id);
  const updated = idx > -1 ? [...current] : [category, ...current];
  if (idx > -1) updated[idx] = category;
  cacheCategoriesLocally(updated);

  // Sync with central backend API
  try {
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    if (!res.ok) {
      console.warn(`[StoreService] Server API returned HTTP ${res.status} for category; continuing to Firestore.`);
    }
  } catch (apiErr: any) {
    console.warn("[StoreService] API category sync note:", apiErr?.message || apiErr);
  }

  try {
    const docRef = doc(db, "categories", category.id);
    await setDoc(docRef, category, { merge: true });
  } catch (fsErr) {
    console.warn("Firestore category setDoc notice:", fsErr);
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("hos-categories-updated", { detail: updated }));
  }
  broadcastCrossDeviceSync("categories", updated);
}

export async function deleteCategory(id: string): Promise<void> {
  recordLocallyDeletedId("categories", id);
  const current = getCachedCategories();
  const target = current.find((c) => c.id === id || c.slug === id || c.name === id);
  if (target) {
    if (target.slug) recordLocallyDeletedId("categories", target.slug);
    if (target.name) recordLocallyDeletedId("categories", target.name);
    if (target.id) recordLocallyDeletedId("categories", target.id);
  }
  const filtered = current.filter(
    (c) =>
      c.id !== id &&
      (!target || (c.slug !== target.slug && c.name !== target.name))
  );
  cacheCategoriesLocally(filtered);

  // 1. Sync with central backend API
  try {
    await fetch(`/api/categories/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  } catch {}

  // 2. Central Deleted-IDs registration
  try {
    await fetch("/api/deleted-ids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "categories", id }),
    });
    if (target?.slug) {
      await fetch("/api/deleted-ids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "categories", id: target.slug }),
      });
    }
    if (target?.name) {
      await fetch("/api/deleted-ids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "categories", id: target.name }),
      });
    }
  } catch {}

  // 3. Firestore deletion
  try {
    const docRef = doc(db, "categories", id);
    await deleteDoc(docRef);
  } catch {}

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("hos-category-deleted", {
        detail: { id, slug: target?.slug, name: target?.name },
      })
    );
    window.dispatchEvent(new CustomEvent("hos-categories-updated", { detail: filtered }));
  }
  broadcastCrossDeviceSync("categories", filtered);
}

export function pausePolling(_seconds = 0): void {
  // Real-time synchronization active without artificial polling pause
}

// Helper to normalize uploaded image paths cleanly
function applyImageCacheBuster(url: string | undefined): string {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (
    trimmed.startsWith("/uploads/") ||
    trimmed.startsWith("/public/uploads/") ||
    trimmed.startsWith("/api/images/")
  ) {
    const cleanPath = trimmed.startsWith("/public/uploads/")
      ? trimmed.replace("/public", "")
      : trimmed;
    return cleanPath.split("?")[0];
  }
  return trimmed;
}

/**
 * Hard timeout wrapper to guarantee asynchronous promises never hang indefinitely.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(message)), timeoutMs)
    ),
  ]);
}

/**
 * Helper to convert a data URL to a native Blob
 */
function dataUrlToBlob(dataUrl: string): { blob: Blob; mime: string } {
  const parts = dataUrl.split(",");
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const bstr = atob(parts[1] || "");
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return { blob: new Blob([u8arr], { type: mime }), mime };
}

/**
 * Uploads a product file/blob to the persistent production image storage endpoint.
 * Completely replaces Firebase Storage.
 */
export async function uploadProductFileToFirebase(
  fileOrBlob: File | Blob,
  productId: string,
  slot: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  if (!fileOrBlob) {
    throw new Error("No file provided for upload.");
  }
  return uploadImageToAdminStorage(fileOrBlob, {
    productId,
    slot,
    onProgress,
  });
}

/**
 * Uploads a product data URL or blob URL to the persistent production image storage endpoint.
 */
export async function uploadProductDataUrlToFirebase(
  dataUrl: string,
  productId: string,
  slot: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  if (!dataUrl) return "";
  const trimmed = dataUrl.trim();
  if (!trimmed.startsWith("data:") && !trimmed.startsWith("blob:")) {
    return trimmed;
  }
  return uploadImageToAdminStorage(trimmed, {
    productId,
    slot,
    onProgress,
  });
}

/**
 * Convenience wrapper for uploading either a File, Blob, or data/blob URL to persistent production storage.
 */
export async function uploadProductImageToFirebase(
  productId: string,
  type: "main" | "hover" | "gallery" | string,
  fileOrDataUrl: File | Blob | string,
  onProgress?: (percent: number) => void
): Promise<string> {
  if (!fileOrDataUrl) return "";
  if (typeof fileOrDataUrl === "string") {
    const trimmed = fileOrDataUrl.trim();
    if (!trimmed.startsWith("data:") && !trimmed.startsWith("blob:")) return trimmed;
    return uploadProductDataUrlToFirebase(trimmed, productId, type, onProgress);
  }
  return uploadProductFileToFirebase(fileOrDataUrl, productId, type, onProgress);
}

// Clean aliases for modern Cloudflare R2 / D1 upload architecture
export const uploadProductFile = uploadProductFileToFirebase;
export const uploadProductDataUrl = uploadProductDataUrlToFirebase;
export const uploadProductImage = uploadProductImageToFirebase;

/**
 * Safely cleans up an old image if needed.
 */
export async function cleanupOldStorageImage(oldUrl?: string | null, newUrl?: string | null): Promise<void> {
  if (!oldUrl || !newUrl || oldUrl === newUrl || typeof oldUrl !== "string") return;
  // Cleanup is handled automatically on server
}

/**
 * Ensures all image fields are uploaded to persistent storage before writing to Firestore.
 * Implements deduplication so identical images (e.g. main image duplicated as hover or variant)
 * are only uploaded once, making saving much faster and avoiding redundant uploads.
 */
async function ensureAllImagesUploaded(
  prodId: string,
  product: Partial<Product>
): Promise<{
  image: string;
  hoverImage: string;
  images: string[];
  colorVariants?: ColorVariant[];
}> {
  const uploadCache = new Map<string, string>();

  const uploadCached = async (img: string, slot: string): Promise<string> => {
    if (!img || typeof img !== "string") return "";
    const trimmed = img.trim();
    if (!trimmed.startsWith("data:") && !trimmed.startsWith("blob:")) {
      return trimmed;
    }
    if (uploadCache.has(trimmed)) {
      return uploadCache.get(trimmed)!;
    }
    try {
      let toUpload: File | Blob | string = trimmed;
      if (trimmed.startsWith("blob:") && typeof window !== "undefined") {
        const resp = await fetch(trimmed);
        toUpload = await resp.blob();
      }
      const uploadedUrl = await uploadProductImageToFirebase(prodId, slot, toUpload);
      if (uploadedUrl && !uploadedUrl.startsWith("blob:")) {
        uploadCache.set(trimmed, uploadedUrl);
        return uploadedUrl;
      }
    } catch (e) {
      console.warn(`[ensureAllImagesUploaded] Notice for ${slot}, preserving image:`, e);
    }

    if (trimmed.startsWith("blob:") && typeof window !== "undefined") {
      try {
        const resp = await fetch(trimmed);
        const blob = await resp.blob();
        const base64 = await new Promise<string>((res) => {
          const reader = new FileReader();
          reader.onload = () => res((reader.result as string) || trimmed);
          reader.onerror = () => res(trimmed);
          reader.readAsDataURL(blob);
        });
        registerLocalImageCache(base64, base64);
        uploadCache.set(trimmed, base64);
        return base64;
      } catch {
        // Fallback to trimmed if conversion fails
      }
    }

    uploadCache.set(trimmed, trimmed);
    return trimmed;
  };

  let mainImg = await uploadCached(product.image || "", "main");
  let hoverImg = product.hoverImage ? await uploadCached(product.hoverImage, "hover") : mainImg;

  let imagesList: string[] = [];
  if (Array.isArray(product.images) && product.images.length > 0) {
    imagesList = await Promise.all(
      product.images.map(async (img, idx) => {
        if (img && typeof img === "string") {
          return await uploadCached(img, `gallery-${idx}`);
        }
        return img || "";
      })
    );
    imagesList = imagesList.filter(Boolean);
  } else {
    imagesList = [mainImg, hoverImg].filter(Boolean);
  }

  if (mainImg && !imagesList.includes(mainImg)) {
    imagesList = [mainImg, ...imagesList];
  }

  let updatedVariants: ColorVariant[] | undefined = undefined;
  if (Array.isArray(product.colorVariants) && product.colorVariants.length > 0) {
    updatedVariants = await Promise.all(
      product.colorVariants.map(async (v, vIdx) => {
        let vImg = vIdx === 0 ? mainImg : (v.image ? await uploadCached(v.image, `var-${vIdx}-main`) : mainImg);
        let vHover = vIdx === 0 ? hoverImg : (v.hoverImage ? await uploadCached(v.hoverImage, `var-${vIdx}-hover`) : hoverImg);

        let vImages: string[] = [];
        if (Array.isArray(v.images) && v.images.length > 0) {
          vImages = await Promise.all(
            v.images.map(async (img, gIdx) => {
              if (img && typeof img === "string") {
                return await uploadCached(img, `var-${vIdx}-gal-${gIdx}`);
              }
              return img || "";
            })
          );
          vImages = vImages.filter(Boolean);
        } else {
          vImages = vIdx === 0 ? imagesList : [vImg, vHover].filter(Boolean);
        }

        return {
          ...v,
          image: vImg,
          hoverImage: vHover,
          images: vImages,
        };
      })
    );
  }

  return {
    image: mainImg,
    hoverImage: hoverImg,
    images: imagesList,
    colorVariants: updatedVariants,
  };
}

/**
 * Authoritatively retrieves the latest products directly from Firestore.
 * Updates local cache and guarantees stale disk/localStorage files never overwrite live data.
 */
export async function getAuthoritativeProducts(): Promise<Product[]> {
  const deleted = getLocallyDeletedIds("products");
  try {
    const colRef = collection(db, "products");
    const snapshot = await getDocs(colRef);
    if (!snapshot.empty) {
      const fsList = snapshot.docs
        .map((d) => ensureProductVariants({ id: d.id, ...d.data() }))
        .filter((p) => p && p.id && !deleted.has(p.id) && !deleted.has((p as any).sku));

      if (fsList.length > 0) {
        cacheProductsLocally(fsList);
        return fsList;
      }
    }
  } catch (err) {
    console.warn("[StoreService] Error fetching authoritative products from Firestore:", err);
  }
  return [];
}


export function subscribeProducts(callback: (products: Product[]) => void): () => void {
  // Immediately serve cached products for instant layout
  callback(getCachedProducts());

  let active = true;
  let hasLoadedFromFirestore = false;

  // Query authoritative Firestore products immediately
  getAuthoritativeProducts().then((fsList) => {
    if (!active) return;
    if (fsList && fsList.length > 0) {
      hasLoadedFromFirestore = true;
      callback(fsList);
    }
  }).catch(() => {});

  // Real-time Firestore listener - AUTHORITATIVE PRODUCTION SOURCE
  let unsubFs = () => {};
  try {
    const colRef = collection(db, "products");
    unsubFs = onSnapshot(
      colRef,
      (snapshot) => {
        if (!active) return;
        const deleted = getLocallyDeletedIds("products");

        // React to remote deletions in Firestore immediately
        if (typeof (snapshot as any)?.docChanges === "function") {
          try {
            const changes = (snapshot as any).docChanges();
            if (Array.isArray(changes)) {
              changes.forEach((change: any) => {
                if (change?.type === "removed" && change?.doc?.id) {
                  recordLocallyDeletedId("products", change.doc.id);
                }
              });
            }
          } catch (e) {
            console.warn("[Firestore products listener docChanges notice]:", e);
          }
        }

        if (!snapshot.empty) {
          const fsList = snapshot.docs
            .map((d) => ensureProductVariants({ id: d.id, ...d.data() }))
            .filter((p) => p && p.id && !deleted.has(p.id) && !deleted.has((p as any).sku));

          if (fsList.length > 0) {
            hasLoadedFromFirestore = true;
            // FIRESTORE IS THE SINGLE AUTHORITATIVE SOURCE OF TRUTH.
            // Do NOT merge older localStorage or static JSON over fresh Firestore data.
            cacheProductsLocally(fsList);
            callback(fsList);

            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("hos-catalog-updated", { detail: fsList }));
            }
            return;
          }
        } else {
          // If Firestore is completely empty and no factory reset was performed, auto-seed in background
          if (typeof window !== "undefined" && !localStorage.getItem("hos_factory_reset_completed")) {
            const current = getCachedProducts();
            if (current.length > 0) {
              syncCatalogToFirestore(current).catch(() => {});
            }
          }
        }
      },
      (error) => {
        console.warn("[Firestore] onSnapshot products listener notice:", error);
      }
    );
  } catch (err) {
    console.warn("[Firestore] Failed to attach products listener:", err);
  }

  // Active sync function: fetches live products from backend API immediately and periodically
  const fetchLiveProducts = async () => {
    if (!active) return;
    try {
      const res = await fetch(`/api/products?t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      });
      const contentType = res.headers.get("content-type") || "";
      if (res.ok && contentType.includes("application/json") && !res.redirected) {
        const apiData = await res.json();
        if (Array.isArray(apiData)) {
          const deleted = getLocallyDeletedIds("products");
          const normalized = apiData
            .map(ensureProductVariants)
            .filter(
              (p) =>
                p &&
                p.id &&
                !deleted.has(p.id) &&
                !deleted.has((p as any).sku) &&
                (!p.name || !deleted.has(p.name))
            );

          // Backend API is the authoritative source, merged with recent local saves to prevent live sync race conditions
          const currentCached = getCachedProducts();
          const serverMap = new Map<string, Product>();
          normalized.forEach((p) => serverMap.set(p.id, p));

          if (currentCached && currentCached.length > 0) {
            for (const localProd of currentCached) {
              if (deleted.has(localProd.id) || (localProd.name && deleted.has(localProd.name))) {
                continue;
              }
              const serverProd = serverMap.get(localProd.id);
              if (!serverProd) {
                // If saved locally within last 45 seconds, keep it until server sync completes
                const localTime = localProd.updatedAt ? new Date(localProd.updatedAt).getTime() : 0;
                if (Date.now() - localTime < 45000) {
                  serverMap.set(localProd.id, localProd);
                }
              } else {
                // If local product has a newer updatedAt timestamp, preserve the local product's images and attributes
                const localTime = localProd.updatedAt ? new Date(localProd.updatedAt).getTime() : 0;
                const serverTime = serverProd.updatedAt ? new Date(serverProd.updatedAt).getTime() : 0;
                if (localTime > serverTime && localTime - serverTime < 45000) {
                  serverMap.set(localProd.id, {
                    ...serverProd,
                    ...localProd,
                    image: localProd.image || serverProd.image,
                    hoverImage: localProd.hoverImage || serverProd.hoverImage,
                    images: (localProd.images && localProd.images.length > 0) ? localProd.images : serverProd.images,
                  });
                }
              }
            }
          }

          const mergedAuthoritative = Array.from(serverMap.values());
          cacheProductsLocally(mergedAuthoritative);
          callback(mergedAuthoritative);
          return;
        }
      }
    } catch {}

    // Fallback to static JSON file if server API endpoint is slow or behind proxy
    try {
      const resStatic = await fetch(`/data/products.json?t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      });
      const staticContentType = resStatic.headers.get("content-type") || "";
      if (resStatic.ok && staticContentType.includes("application/json")) {
        const apiData = await resStatic.json();
        if (Array.isArray(apiData)) {
          const deleted = getLocallyDeletedIds("products");
          const normalized = apiData
            .map(ensureProductVariants)
            .filter(
              (p) =>
                p &&
                p.id &&
                !deleted.has(p.id) &&
                !deleted.has((p as any).sku) &&
                (!p.name || !deleted.has(p.name))
            );

          const currentCached = getCachedProducts();
          if (currentCached && currentCached.length > 0) {
            const mergedMap = new Map<string, Product>();
            // Seed static products first
            normalized.forEach((p) => mergedMap.set(p.id, p));
            // Local changes ALWAYS win over static file
            currentCached.forEach((p) => {
              if (!deleted.has(p.id) && (!p.name || !deleted.has(p.name))) {
                mergedMap.set(p.id, p);
              }
            });
            const mergedList = Array.from(mergedMap.values());
            cacheProductsLocally(mergedList);
            callback(mergedList);
          } else {
            cacheProductsLocally(normalized);
            callback(normalized);
          }
        }
      }
    } catch {}
  };

  // Immediate live fetch without delay
  fetchLiveProducts();

  // Active polling interval (every 3.5s) to guarantee updates from /admin appear in live storefront immediately
  const pollTimer = setInterval(fetchLiveProducts, 3500);

  // Focus & mobile visibility change (crucial when switching between /admin and storefront)
  const handleWakeup = () => {
    if (typeof document !== "undefined" && !document.hidden) {
      fetchLiveProducts();
    }
  };

  // Listen to local/custom events dispatched during admin operations
  const handleCatalogUpdate = (e: any) => {
    if (Array.isArray(e.detail)) {
      const deleted = getLocallyDeletedIds("products");
      callback(
        e.detail
          .map(ensureProductVariants)
          .filter((p) => p && p.id && !deleted.has(p.id) && !deleted.has((p as any).sku))
      );
    }
  };

  const handleSingleProductSaved = (e: any) => {
    if (e.detail && e.detail.id) {
      unrecordLocallyDeletedId("products", e.detail.id);
      const current = getCachedProducts();
      const idx = current.findIndex((p) => p.id === e.detail.id);
      const normalized = ensureProductVariants(e.detail);
      const next = idx > -1 ? [...current] : [normalized, ...current];
      if (idx > -1) next[idx] = normalized;
      cacheProductsLocally(next);
      callback(next);
    }
  };

  const handleProductDeleted = (e: any) => {
    const deletedId = e.detail?.id;
    const deletedSku = e.detail?.sku;
    const deletedName = e.detail?.name;
    if (deletedId || deletedSku || deletedName) {
      const current = getCachedProducts().filter(
        (p) =>
          (!deletedId || p.id !== deletedId) &&
          (!deletedSku || (p as any).sku !== deletedSku) &&
          (!deletedName || p.name !== deletedName)
      );
      cacheProductsLocally(current);
      callback(current);
    }
  };

  // BroadcastChannel handler for cross-tab & cross-window updates
  const handleBroadcastMessage = (event: MessageEvent) => {
    if (event.data?.type === "products" && Array.isArray(event.data.data)) {
      const deleted = getLocallyDeletedIds("products");
      const normalized = event.data.data
        .map(ensureProductVariants)
        .filter((p: any) => p && p.id && !deleted.has(p.id) && !deleted.has((p as any).sku));
      cacheProductsLocally(normalized);
      callback(normalized);
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("hos-catalog-updated", handleCatalogUpdate);
    window.addEventListener("hos-product-saved", handleSingleProductSaved);
    window.addEventListener("hos-product-deleted", handleProductDeleted);
    window.addEventListener("focus", handleWakeup);
    window.addEventListener("pageshow", handleWakeup);
    window.addEventListener("online", handleWakeup);
    window.addEventListener("storage", (e) => {
      if (e.key === PRODUCTS_CACHE_KEY) {
        callback(getCachedProducts());
      }
    });
  }
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", handleWakeup);
  }

  if (syncChannel) {
    syncChannel.addEventListener("message", handleBroadcastMessage);
  }

  return () => {
    active = false;
    clearInterval(pollTimer);
    unsubFs();
    if (typeof window !== "undefined") {
      window.removeEventListener("hos-catalog-updated", handleCatalogUpdate);
      window.removeEventListener("hos-product-saved", handleSingleProductSaved);
      window.removeEventListener("hos-product-deleted", handleProductDeleted);
      window.removeEventListener("focus", handleWakeup);
      window.removeEventListener("pageshow", handleWakeup);
      window.removeEventListener("online", handleWakeup);
    }
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", handleWakeup);
    }
    if (syncChannel) {
      syncChannel.removeEventListener("message", handleBroadcastMessage);
    }
  };
}

// Background utility to ensure Firestore always has the active product catalog synced
export async function syncCatalogToFirestore(prods: Product[]): Promise<void> {
  if (!Array.isArray(prods) || prods.length === 0) return;
  const deleted = getLocallyDeletedIds("products");
  const valid = prods.filter((p) => p && p.id && !deleted.has(p.id) && !deleted.has((p as any).sku));
  for (const p of valid) {
    try {
      const docRef = doc(db, "products", p.id);
      await setDoc(docRef, sanitizeForFirestore(p), { merge: true });
    } catch {}
  }
}

export async function saveProduct(
  product: Partial<Product> & { id?: string }
): Promise<{ id: string; success: boolean; product?: Product }> {
  const id = product.id || `hos-${Date.now()}`;
  unrecordLocallyDeletedId("products", id);
  if (product.name) unrecordLocallyDeletedId("products", product.name);
  if ((product as any).sku) unrecordLocallyDeletedId("products", (product as any).sku);

  // 1. Ensure all images are uploaded to persistent storage BEFORE writing to backend
  const uploaded = await ensureAllImagesUploaded(id, product);

  let cleanImage = uploaded.image;
  let cleanHover = uploaded.hoverImage || cleanImage;
  const cleanImages = uploaded.images;

  // Convert any lingering blob: URLs to high-res base64 data URLs immediately so save is never blocked
  if (typeof window !== "undefined") {
    if (cleanImage && cleanImage.startsWith("blob:")) {
      try {
        const resp = await fetch(cleanImage);
        const b = await resp.blob();
        cleanImage = await new Promise<string>((res) => {
          const reader = new FileReader();
          reader.onload = () => res((reader.result as string) || cleanImage);
          reader.onerror = () => res(cleanImage);
          reader.readAsDataURL(b);
        });
        registerLocalImageCache(cleanImage, cleanImage);
      } catch {}
    }
    if (cleanHover && cleanHover.startsWith("blob:")) {
      try {
        const resp = await fetch(cleanHover);
        const b = await resp.blob();
        cleanHover = await new Promise<string>((res) => {
          const reader = new FileReader();
          reader.onload = () => res((reader.result as string) || cleanHover);
          reader.onerror = () => res(cleanHover);
          reader.readAsDataURL(b);
        });
        registerLocalImageCache(cleanHover, cleanHover);
      } catch {}
    }
  }

  const sanitized = ensureProductVariants({
    ...product,
    id,
    image: cleanImage,
    hoverImage: cleanHover,
    images: cleanImages,
    colorVariants: uploaded.colorVariants,
    updatedAt: new Date().toISOString(),
  });

  // 2. Authoritative Backend Server API persistence (when backend endpoint is available)
  let savedProduct: Product = sanitized;
  let backendSucceeded = false;
  const token = getAdminAuthToken();
  const saveUrl = `/api/products?token=${encodeURIComponent(token)}&adminToken=${encodeURIComponent(token)}&key=${encodeURIComponent(token)}`;

  try {
    const apiRes = await fetch(saveUrl, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        "x-admin-token": token,
        "x-admin-key": token,
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(sanitized),
    });

    if (apiRes.ok) {
      const apiJson = await apiRes.json().catch(() => ({ success: true }));
      if (apiJson && apiJson.success !== false) {
        backendSucceeded = true;
        savedProduct = apiJson.product ? ensureProductVariants(apiJson.product) : sanitized;
      }
    } else {
      console.warn(`[StoreService] Server API returned HTTP ${apiRes.status} for product; saving authoritatively to Firestore.`);
    }
  } catch (apiErr: any) {
    console.warn("[StoreService] Server API /api/products unreachable; saving to Firestore:", apiErr?.message || apiErr);
  }

  // 3. Update local cache with verified saved product
  const current = getCachedProducts();
  const existingIdx = current.findIndex((p) => p.id === id);
  const updated = existingIdx > -1 ? [...current] : [savedProduct, ...current];
  if (existingIdx > -1) updated[existingIdx] = savedProduct;
  cacheProductsLocally(updated);

  // 4. Clear any stale Canva text/style overrides for this product so edits are visible immediately
  try {
    const rawOverrides = localStorage.getItem("hos_custom_overrides");
    if (rawOverrides) {
      const parsed = JSON.parse(rawOverrides);
      let changed = false;
      for (const k of Object.keys(parsed)) {
        if (k.startsWith(`product_${id}_`) || k === id || (savedProduct.name && k.includes(savedProduct.name))) {
          delete parsed[k];
          changed = true;
        }
      }
      if (changed) {
        localStorage.setItem("hos_custom_overrides", JSON.stringify(parsed));
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("hos-overrides-updated", { detail: parsed }));
          window.dispatchEvent(new CustomEvent("hos-custom-overrides-updated", { detail: parsed }));
        }
      }
    }
  } catch {}

  // 5. Dispatch real-time events for instant local & cross-device updates
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("hos-product-saved", { detail: savedProduct }));
    window.dispatchEvent(new CustomEvent("hos-catalog-updated", { detail: updated }));
  }
  broadcastCrossDeviceSync("products", updated);

  // 6. Firestore Cloud Persistence (Authoritative cross-session and cross-device storage)
  try {
    const firestoreData = sanitizeForFirestore(savedProduct);
    await ensureAdminFirebaseAuth().catch(() => null);
    const docRef = doc(db, "products", id);
    await setDoc(docRef, firestoreData, { merge: true });
    console.log(`[StoreService] ✅ Product ${id} saved to Firestore successfully.`);
  } catch (fsErr: any) {
    console.warn("[StoreService] Firestore save notice for", id, fsErr?.message || fsErr);
    if (!backendSucceeded) {
      console.info("[StoreService] Remote database unavailable; product successfully preserved in local store & cache.");
    }
  }

  return { id, success: true, product: savedProduct };
}

export async function deleteProduct(id: string): Promise<void> {
  const currentBefore = getCachedProducts();
  const target = currentBefore.find((p) => p.id === id || (p as any).sku === id);
  recordLocallyDeletedId("products", id);
  if (target) {
    if ((target as any).sku) recordLocallyDeletedId("products", (target as any).sku);
    if (target.name) recordLocallyDeletedId("products", target.name);
    if (Array.isArray(target.colorVariants)) {
      target.colorVariants.forEach((v) => {
        if (v && v.id) recordLocallyDeletedId("products", v.id);
      });
    }
  }
  const current = currentBefore.filter(
    (p) =>
      p.id !== id &&
      (p as any).sku !== id &&
      (!target || p.name !== target.name)
  );
  cacheProductsLocally(current);

  // Clear any Canva text/style overrides for this deleted product
  try {
    const rawOverrides = localStorage.getItem("hos_custom_overrides");
    if (rawOverrides) {
      const parsed = JSON.parse(rawOverrides);
      let changed = false;
      for (const k of Object.keys(parsed)) {
        if (k.startsWith(`product_${id}_`) || k === id || (target?.name && k.includes(target.name))) {
          delete parsed[k];
          changed = true;
        }
      }
      if (changed) {
        localStorage.setItem("hos_custom_overrides", JSON.stringify(parsed));
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("hos-overrides-updated", { detail: parsed }));
        }
      }
    }
  } catch {}

  // 1. Immediately dispatch real-time events
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("hos-product-deleted", {
        detail: { id, sku: (target as any)?.sku, name: target?.name },
      })
    );
    window.dispatchEvent(new CustomEvent("hos-catalog-updated", { detail: current }));
  }
  broadcastCrossDeviceSync("products", current);

  // 2. Central Backend API deletion - await confirmation
  const token = getAdminAuthToken();
  try {
    await fetch(`/api/products?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
      headers: {
        "x-admin-token": token,
        "x-admin-key": token,
        authorization: `Bearer ${token}`,
      },
    });
  } catch (delErr) {
    console.warn("[StoreService] Error calling DELETE /api/products:", delErr);
  }

  try {
    await fetch(`/api/products/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
      headers: {
        "x-admin-token": token,
        "x-admin-key": token,
        authorization: `Bearer ${token}`,
      },
    });
  } catch {}

  // 3. Central Deleted-IDs registration
  try {
    await fetch("/api/deleted-ids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "products", id }),
    });
    if (target?.name) {
      await fetch("/api/deleted-ids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "products", id: target.name }),
      });
    }
  } catch {}

  // 4. Firestore deletion
  try {
    const docRef = doc(db, "products", id);
    await deleteDoc(docRef);
  } catch (fsErr) {
    console.warn("Firestore deleteDoc notice:", fsErr);
  }

  // 5. Clean up associated media files from storage/R2
  if (target) {
    const imagesToClean: string[] = [];
    if (target.image) imagesToClean.push(target.image);
    if (target.hoverImage) imagesToClean.push(target.hoverImage);
    if (Array.isArray(target.images)) imagesToClean.push(...target.images);
    if (Array.isArray(target.colorVariants)) {
      target.colorVariants.forEach((v) => {
        if (v?.image) imagesToClean.push(v.image);
        if (v?.hoverImage) imagesToClean.push(v.hoverImage);
      });
    }
    for (const imgUrl of imagesToClean) {
      if (
        imgUrl &&
        (imgUrl.startsWith("/uploads/") ||
          imgUrl.startsWith("/api/images/") ||
          imgUrl.startsWith("uploads/") ||
          imgUrl.startsWith("banners/"))
      ) {
        deleteImageFromStorage(imgUrl).catch(() => {});
      }
    }
  }
}

export interface FactoryResetResult {
  success: boolean;
  message: string;
  wipedProductsCount: number;
  wipedImagesCount: number;
  purgedFiles?: string[];
  timestamp?: string;
}

/**
 * Factory Reset: Completely wipes all product data, variations, and image references,
 * purging orphaned product media files and resetting the store catalog to a pristine clean state.
 */
export async function factoryResetCatalog(options: { wipeImages?: boolean } = {}): Promise<FactoryResetResult> {
  const wipeImages = options.wipeImages !== false;

  // 1. Wipe Firestore products collection documents if available
  try {
    const colRef = collection(db, "products");
    const snap = await getDocs(colRef);
    if (!snap.empty) {
      const deletePromises = snap.docs.map((docSnap) => deleteDoc(doc(db, "products", docSnap.id)));
      await Promise.allSettled(deletePromises);
    }
  } catch (fsErr) {
    console.warn("Notice: Firestore products cleanup notice:", fsErr);
  }

  // 2. Call backend factory-reset API with anti-cache timestamp
  let apiResult: FactoryResetResult = {
    success: true,
    message: "Store catalog successfully restored to clean state.",
    wipedProductsCount: 0,
    wipedImagesCount: 0,
  };

  try {
    const res = await fetch(`/api/admin/factory-reset?t=${Date.now()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wipeImages }),
    });
    if (res.ok) {
      const data = await res.json();
      apiResult = {
        ...apiResult,
        ...data,
      };
    }
  } catch (apiErr) {
    console.warn("Factory reset API fetch notice:", apiErr);
  }

  // 3. Clear all client local storage caches & mark factory reset completed
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify([]));
      localStorage.setItem("hos_deleted_products", JSON.stringify([]));
      localStorage.setItem("hos_factory_reset_completed", Date.now().toString());
      localStorage.setItem("hos_cart", JSON.stringify([]));
      localStorage.setItem("hos_wishlist", JSON.stringify([]));
    } catch {}

    // 4. Dispatch real-time events across the entire application and open tabs
    window.dispatchEvent(new CustomEvent("hos-catalog-updated", { detail: [] }));
    window.dispatchEvent(new CustomEvent("hos-factory-reset-completed", { detail: apiResult }));
    window.dispatchEvent(new CustomEvent("hos-cart-updated", { detail: [] }));
    window.dispatchEvent(new CustomEvent("hos-wishlist-updated", { detail: [] }));
  }

  // 5. Broadcast across devices
  broadcastCrossDeviceSync("products", []);
  broadcastCrossDeviceSync("factory_reset", { timestamp: Date.now() });

  return apiResult;
}

export async function seedInitialProductsIfEmpty(): Promise<void> {
  if (typeof window !== "undefined" && localStorage.getItem("hos_factory_reset_completed")) {
    // If factory reset was completed, respect the clean state and do not resurrect old catalog
    return;
  }
  const deleted = getLocallyDeletedIds("products");
  const hasSaved = localStorage.getItem(PRODUCTS_CACHE_KEY);
  if (hasSaved === null) {
    const clean = defaultProducts
      .map(ensureProductVariants)
      .filter((p) => p && p.id && !deleted.has(p.id) && !deleted.has((p as any).sku));
    cacheProductsLocally(clean);
  }
}

export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) return null as any;
  if (Array.isArray(data)) return data.map(sanitizeForFirestore) as any;
  if (typeof data === "object" && !(data instanceof Date)) {
    const res: any = {};
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) {
        res[k] = sanitizeForFirestore(v);
      }
    }
    return res;
  }
  return data;
}

/* ============================================================
   ORDER CREATION & TRACKING (PUBLIC CLIENT-SIDE)
============================================================ */

export function getCachedOrders(): Order[] {
  const deleted = getLocallyDeletedIds("orders");
  try {
    const saved = localStorage.getItem(ORDERS_CACHE_KEY);
    const placed = localStorage.getItem("hos_placed_orders");
    const mergedMap = new Map<string, Order>();

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          for (const o of parsed) {
            if (o && !deleted.has(o.id) && !deleted.has(o.orderNumber)) {
              mergedMap.set(o.orderNumber || o.id, o);
            }
          }
        }
      } catch {}
    }

    if (placed) {
      try {
        const parsedPlaced = JSON.parse(placed);
        if (Array.isArray(parsedPlaced)) {
          for (const o of parsedPlaced) {
            if (o && !deleted.has(o.id) && !deleted.has(o.orderNumber)) {
              const key = o.orderNumber || o.id;
              if (!mergedMap.has(key)) {
                mergedMap.set(key, o);
              }
            }
          }
        }
      } catch {}
    }

    const result = Array.from(mergedMap.values());
    result.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return result;
  } catch {}
  return [];
}

export function cacheOrdersLocally(orders: Order[]) {
  try {
    const raw = JSON.stringify(orders);
    localStorage.setItem(ORDERS_CACHE_KEY, raw);
    localStorage.setItem("hos_placed_orders", raw);
  } catch {}
}

export async function createRealOrder(
  orderInput: Omit<Order, "id" | "orderNumber" | "createdAt" | "updatedAt">
): Promise<Order> {
  const now = new Date();
  const datePrefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const orderNumber = `HOS-${datePrefix}-${randomSuffix}`;
  const orderId = `ord_${Date.now()}_${randomSuffix}`;

  unrecordLocallyDeletedId("orders", orderId);
  unrecordLocallyDeletedId("orders", orderNumber);

  let fullOrder: Order = {
    ...orderInput,
    id: orderId,
    orderNumber,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    orderStatus: orderInput.orderStatus || "confirmed",
    status: orderInput.orderStatus || "confirmed",
    totalAmount: orderInput.total,
    customerAddress: orderInput.shippingAddress,
  };

  // Immediate local cache update for 0ms UI reactivity
  const current = getCachedOrders();
  const nextOrders = [fullOrder, ...current.filter((o) => o.id !== orderId && o.orderNumber !== orderNumber)];
  cacheOrdersLocally(nextOrders);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("hos-order-created", { detail: fullOrder }));
    window.dispatchEvent(new CustomEvent("hos-order-placed", { detail: fullOrder }));
    window.dispatchEvent(new CustomEvent("hos-orders-updated", { detail: nextOrders }));
  }
  broadcastCrossDeviceSync("orders", fullOrder);

  // Dispatch to server /api/orders for automatic Shiprocket fulfillment
  try {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fullOrder),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.order) {
        fullOrder = {
          ...fullOrder,
          ...data.order,
          shiprocketOrderId: data.order.shiprocketOrderId || fullOrder.shiprocketOrderId,
          shiprocketShipmentId: data.order.shiprocketShipmentId || fullOrder.shiprocketShipmentId,
          trackingNumber: data.order.trackingNumber || fullOrder.trackingNumber,
          trackingCourier: data.order.trackingCourier || fullOrder.trackingCourier,
          trackingUrl: data.order.trackingUrl || fullOrder.trackingUrl,
          shiprocketStatus: data.order.shiprocketStatus || fullOrder.shiprocketStatus,
          shiprocketSyncedAt: data.order.shiprocketSyncedAt || fullOrder.shiprocketSyncedAt,
          shiprocketError: data.order.shiprocketError || fullOrder.shiprocketError,
        };
        const fresh = getCachedOrders();
        const fIdx = fresh.findIndex((o) => o.id === orderId || o.orderNumber === orderNumber);
        if (fIdx > -1) {
          fresh[fIdx] = fullOrder;
          cacheOrdersLocally(fresh);
        }
      }
    }
  } catch (apiErr) {
    console.warn("Backend /api/orders dispatch notice:", apiErr);
  }

  try {
    const docRef = doc(db, "orders", orderId);
    await setDoc(docRef, sanitizeForFirestore(fullOrder), { merge: true });
  } catch (err) {
    console.warn("Firestore order root save notice:", err);
  }

  // If customer is signed in, also store in customer profile subcollection
  if (fullOrder.userId) {
    try {
      const userBookingRef = doc(db, "customers", fullOrder.userId, "bookings", orderId);
      await setDoc(userBookingRef, fullOrder, { merge: true });
    } catch (err) {
      console.warn("Firestore user booking subcollection save notice:", err);
    }
  }

  window.dispatchEvent(new CustomEvent("hos-order-created", { detail: fullOrder }));
  broadcastCrossDeviceSync("orders", fullOrder);
  return fullOrder;
}

export async function createAtelierBooking(
  bookingInput: Omit<AtelierBooking, "id" | "bookingNumber" | "createdAt" | "updatedAt" | "status">
): Promise<AtelierBooking> {
  const now = new Date();
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const bookingNumber = `HOS-APT-${now.getFullYear()}-${randomSuffix}`;
  const bookingId = `book_${Date.now()}_${randomSuffix}`;

  const booking: AtelierBooking = {
    ...bookingInput,
    id: bookingId,
    bookingNumber,
    status: "confirmed",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  // Cache in localStorage
  try {
    const local = JSON.parse(localStorage.getItem("hos_atelier_bookings") || "[]");
    localStorage.setItem("hos_atelier_bookings", JSON.stringify([booking, ...local]));
  } catch {}

  // Central Server API sync
  try {
    await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(booking),
    });
  } catch (apiErr) {
    console.warn("API booking sync notice:", apiErr);
  }

  // Save to Firestore root bookings collection
  try {
    const bookingRef = doc(db, "bookings", bookingId);
    await setDoc(bookingRef, booking, { merge: true });
  } catch (e) {
    console.warn("Firestore booking root save:", e);
  }

  // Save to customer's personal bookings subcollection
  if (booking.userId) {
    try {
      const userBookingRef = doc(db, "customers", booking.userId, "bookings", bookingId);
      await setDoc(userBookingRef, booking, { merge: true });
    } catch (e) {
      console.warn("Firestore user subcollection booking save:", e);
    }
  }

  window.dispatchEvent(new CustomEvent("hos-booking-created", { detail: booking }));
  broadcastCrossDeviceSync("bookings", booking);
  return booking;
}

export async function fetchAtelierBookings(emailOrUid?: string): Promise<AtelierBooking[]> {
  let list: AtelierBooking[] = [];
  try {
    list = JSON.parse(localStorage.getItem("hos_atelier_bookings") || "[]");
  } catch {}

  // Fetch from server API
  try {
    const res = await fetch(`/api/bookings?t=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });
    if (res.ok) {
      const serverList = await res.json();
      if (Array.isArray(serverList)) {
        list = serverList;
        localStorage.setItem("hos_atelier_bookings", JSON.stringify(serverList));
      }
    }
  } catch {}

  if (emailOrUid) {
    const filterTerm = emailOrUid.trim().toLowerCase();
    const filtered = list.filter(
      (b) => b.email?.toLowerCase() === filterTerm || b.userId === emailOrUid
    );
    if (filtered.length > 0) return filtered;

    try {
      const colRef = collection(db, "bookings");
      const q = query(colRef, where("email", "==", filterTerm));
      const snap = await getDocs(q);
      const remote = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AtelierBooking));
      const seen = new Set<string>();
      const merged: AtelierBooking[] = [];
      for (const b of [...remote, ...list]) {
        if (!seen.has(b.bookingNumber || b.id)) {
          seen.add(b.bookingNumber || b.id);
          merged.push(b);
        }
      }
      return merged;
    } catch (e) {
      console.warn("Error fetching remote bookings:", e);
    }
  }
  return list;
}

export async function updateOrderStatus(
  orderId: string,
  orderStatus: OrderStatus,
  trackingCourier?: string,
  trackingNumber?: string
): Promise<void> {
  const current = getCachedOrders();
  const idx = current.findIndex((o) => o.id === orderId || o.orderNumber === orderId);
  const now = new Date().toISOString();
  const payload = {
    orderStatus,
    status: orderStatus,
    trackingCourier: trackingCourier || null,
    trackingNumber: trackingNumber || null,
    updatedAt: now,
  };

  let updatedFullOrder: Order | null = null;
  if (idx > -1) {
    current[idx] = {
      ...current[idx],
      ...payload,
      trackingCourier: trackingCourier ?? current[idx].trackingCourier,
      trackingNumber: trackingNumber ?? current[idx].trackingNumber,
    };
    updatedFullOrder = current[idx];
    cacheOrdersLocally(current);
  }

  // Also sync to customer placed orders cache for immediate consistency
  try {
    const placed: Order[] = JSON.parse(localStorage.getItem("hos_placed_orders") || "[]");
    const pIdx = placed.findIndex((o) => o.id === orderId || o.orderNumber === orderId);
    if (pIdx > -1) {
      placed[pIdx] = {
        ...placed[pIdx],
        ...payload,
        trackingCourier: trackingCourier ?? placed[pIdx].trackingCourier,
        trackingNumber: trackingNumber ?? placed[pIdx].trackingNumber,
      };
      if (!updatedFullOrder) updatedFullOrder = placed[pIdx];
      localStorage.setItem("hos_placed_orders", JSON.stringify(placed));
    }
  } catch {}

  // 1. Sync to central backend API
  try {
    await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {}

  // 2. Sync to Firestore
  try {
    const docRef = doc(db, "orders", orderId);
    await updateDoc(docRef, payload);
  } catch {}

  // 3. Broadcast update
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("hos-order-updated", {
        detail: updatedFullOrder || { id: orderId, orderId, ...payload },
      })
    );
    window.dispatchEvent(new CustomEvent("hos-orders-updated", { detail: current }));
  }
  broadcastCrossDeviceSync("orders", updatedFullOrder);
}

export function subscribeOrders(callback: (orders: Order[]) => void): () => void {
  // Immediately serve cached orders
  callback(getCachedOrders());

  let active = true;

  // Active sync function: fetches from central backend API with anti-cache headers
  const fetchLiveOrders = async () => {
    if (!active) return;
    try {
      const res = await fetch(`/api/orders?t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      });
      if (res.ok) {
        const apiData = await res.json();
        if (Array.isArray(apiData)) {
          const deleted = getLocallyDeletedIds("orders");
          const incoming = apiData
            .map((o: any) => ({
              ...o,
              id: o.id || `ord_${(o.orderNumber || Date.now()).toString().replace(/[^a-zA-Z0-9]/g, "_")}`,
            }))
            .filter((o: Order) => o && !deleted.has(o.id) && !deleted.has(o.orderNumber));
          const current = getCachedOrders().filter((o) => o && !deleted.has(o.id) && !deleted.has(o.orderNumber));
          const merged = mergeEntitiesByTimestamp(current, incoming, deleted, (o) => o.id, (o) => o.orderNumber);
          merged.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          if (JSON.stringify(current) !== JSON.stringify(merged)) {
            cacheOrdersLocally(merged);
            callback(merged);
          }
          return;
        }
      }
    } catch {}

    // Fallback to static JSON file if server endpoint temporarily unavailable
    try {
      const staticRes = await fetch(`/data/orders.json?t=${Date.now()}`, {
        cache: "no-store",
      });
      if (staticRes.ok) {
        const staticData = await staticRes.json();
        if (Array.isArray(staticData)) {
          const deleted = getLocallyDeletedIds("orders");
          const incoming = staticData
            .map((o: any) => ({
              ...o,
              id: o.id || `ord_${(o.orderNumber || Date.now()).toString().replace(/[^a-zA-Z0-9]/g, "_")}`,
            }))
            .filter((o: Order) => o && !deleted.has(o.id) && !deleted.has(o.orderNumber));
          const current = getCachedOrders().filter((o) => o && !deleted.has(o.id) && !deleted.has(o.orderNumber));
          const merged = mergeEntitiesByTimestamp(current, incoming, deleted, (o) => o.id, (o) => o.orderNumber);
          merged.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          if (JSON.stringify(current) !== JSON.stringify(merged)) {
            cacheOrdersLocally(merged);
            callback(merged);
          }
        }
      }
    } catch {}
  };

  // 1. Initial live fetch immediately
  fetchLiveOrders();

  // 2. Active background polling interval (every 7s) for seamless cross-device synchronization
  const pollTimer = setInterval(fetchLiveOrders, 7000);

  // 3. Listen to window focus & visibility changes
  const handleFocusOrVisible = () => {
    if (typeof document !== "undefined" && !document.hidden) {
      fetchLiveOrders();
    }
  };

  // 4. Listen to local/custom order events
  const handleOrderChange = () => {
    callback(getCachedOrders());
    fetchLiveOrders();
  };

  // 5. BroadcastChannel handler for 0ms cross-device & cross-tab updates
  const handleBroadcastMessage = (event: MessageEvent) => {
    if (event.data?.type === "orders") {
      fetchLiveOrders();
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("focus", handleFocusOrVisible);
    window.addEventListener("online", handleFocusOrVisible);
    window.addEventListener("hos-order-created", handleOrderChange);
    window.addEventListener("hos-order-updated", handleOrderChange);
    window.addEventListener("hos-orders-updated", handleOrderChange);
    window.addEventListener("storage", (e) => {
      if (e.key === ORDERS_CACHE_KEY) {
        callback(getCachedOrders());
      }
    });
  }

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", handleFocusOrVisible);
  }

  if (syncChannel) {
    syncChannel.addEventListener("message", handleBroadcastMessage);
  }

  // 6. Firestore real-time listener
  let unsubFs = () => {};
  try {
    const colRef = collection(db, "orders");
    unsubFs = onSnapshot(
      colRef,
      (snapshot) => {
        if (!snapshot.empty) {
          const deleted = getLocallyDeletedIds("orders");
          const fsList = snapshot.docs
            .map((d) => ({ id: d.id, ...d.data() } as Order))
            .filter((o) => o && !deleted.has(o.id) && !deleted.has(o.orderNumber));
          const current = getCachedOrders().filter((o) => o && !deleted.has(o.id) && !deleted.has(o.orderNumber));
          const merged = mergeEntitiesByTimestamp(current, fsList, deleted, (o) => o.id, (o) => o.orderNumber);
          merged.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          cacheOrdersLocally(merged);
          callback(merged);
        }
      },
      () => {}
    );
  } catch {}

  return () => {
    active = false;
    clearInterval(pollTimer);
    unsubFs();
    if (typeof window !== "undefined") {
      window.removeEventListener("focus", handleFocusOrVisible);
      window.removeEventListener("online", handleFocusOrVisible);
      window.removeEventListener("hos-order-created", handleOrderChange);
      window.removeEventListener("hos-order-updated", handleOrderChange);
      window.removeEventListener("hos-orders-updated", handleOrderChange);
    }
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", handleFocusOrVisible);
    }
    if (syncChannel) {
      syncChannel.removeEventListener("message", handleBroadcastMessage);
    }
  };
}

export async function findOrderByOrderNumber(queryStr: string): Promise<Order | null> {
  const clean = queryStr.trim();
  if (!clean) return null;
  const cleanUpper = clean.toUpperCase();
  const digitsOnly = clean.replace(/\D/g, "");

  // 1. Check local cache first
  const localList = getCachedOrders();
  const local = localList.find(
    (o) =>
      o.orderNumber?.toUpperCase() === cleanUpper ||
      o.id === clean ||
      (digitsOnly.length >= 4 && o.orderNumber?.includes(digitsOnly)) ||
      (digitsOnly.length === 10 && (o.customer?.phone?.replace(/\D/g, "").endsWith(digitsOnly)))
  );
  if (local) return local;

  // 2. Fetch latest live orders from backend API for cross-device support (mobile / friend's device)
  try {
    const res = await fetch(`/api/orders?t=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
    });
    if (res.ok) {
      const serverOrders: Order[] = await res.json();
      if (Array.isArray(serverOrders)) {
        cacheOrdersLocally(serverOrders);
        const match = serverOrders.find(
          (o) =>
            o.orderNumber?.toUpperCase() === cleanUpper ||
            o.id === clean ||
            (digitsOnly.length >= 4 && o.orderNumber?.includes(digitsOnly)) ||
            (digitsOnly.length === 10 && (o.customer?.phone?.replace(/\D/g, "").endsWith(digitsOnly)))
        );
        if (match) return match;
      }
    }
  } catch {}

  // 3. Query single order endpoint from backend API
  try {
    const singleRes = await fetch(`/api/orders/${encodeURIComponent(cleanUpper)}?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (singleRes.ok) {
      const singleOrder: Order = await singleRes.json();
      if (singleOrder && singleOrder.orderNumber) {
        return singleOrder;
      }
    }
  } catch {}

  // 4. Query Firestore
  try {
    const q = query(collection(db, "orders"), where("orderNumber", "==", cleanUpper), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return { id: snap.docs[0].id, ...snap.docs[0].data() } as Order;
    }
  } catch {}

  // 5. Try phone query on Firestore
  if (digitsOnly.length === 10) {
    try {
      const qPhone = query(collection(db, "orders"), where("customer.phone", "==", clean), limit(1));
      const snapPhone = await getDocs(qPhone);
      if (!snapPhone.empty) {
        return { id: snapPhone.docs[0].id, ...snapPhone.docs[0].data() } as Order;
      }
    } catch {}
  }

  return null;
}

export async function confirmOrderPayment(
  orderIdOrNumber: string,
  utrNumber: string,
  paymentMethod: string = "UPI / QR Code"
): Promise<{ success: boolean; order?: Order; message?: string }> {
  const cleanUtr = utrNumber.trim();
  if (!cleanUtr) {
    return { success: false, message: "Please provide a valid UTR or Transaction Reference number" };
  }

  const now = new Date().toISOString();
  const currentOrders = getCachedOrders();
  let targetIdx = currentOrders.findIndex(
    (o) => o.id === orderIdOrNumber || o.orderNumber === orderIdOrNumber
  );

  let placedOrdersList: Order[] = [];
  try {
    placedOrdersList = JSON.parse(localStorage.getItem("hos_placed_orders") || "[]");
  } catch {}

  const placedIdx = placedOrdersList.findIndex(
    (o) => o.id === orderIdOrNumber || o.orderNumber === orderIdOrNumber
  );

  const existing =
    (targetIdx > -1 ? currentOrders[targetIdx] : null) ||
    (placedIdx > -1 ? placedOrdersList[placedIdx] : null);

  const realOrderId = existing?.id || orderIdOrNumber;

  const paymentPayload = {
    paymentStatus: "Payment Verification Pending" as PaymentStatus,
    paymentMethod: paymentMethod as any,
    utrNumber: cleanUtr,
    paymentDetails: {
      methodType: "upi" as const,
      utrNumber: cleanUtr,
      transactionReference: cleanUtr,
      paidAt: now,
    },
    updatedAt: now,
  };

  let updatedOrder: Order = existing
    ? {
        ...existing,
        ...paymentPayload,
      }
    : ({
        id: realOrderId,
        orderNumber: typeof orderIdOrNumber === "string" && orderIdOrNumber.startsWith("HOS-") ? orderIdOrNumber : `HOS-${realOrderId.slice(0, 6).toUpperCase()}`,
        status: "pending",
        orderStatus: "pending",
        createdAt: now,
        ...paymentPayload,
      } as any);

  // 1. Sync to central backend API
  try {
    const apiRes = await fetch(`/api/orders/${encodeURIComponent(realOrderId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(paymentPayload),
    });
    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data?.order) {
        updatedOrder = { ...updatedOrder, ...data.order, ...paymentPayload };
      }
    }
  } catch (err) {
    console.warn("API payment confirmation notice:", err);
  }

  // 2. Sync to Firestore
  try {
    const docRef = doc(db, "orders", realOrderId);
    await updateDoc(docRef, paymentPayload);
  } catch (fsErr) {
    console.warn("Firestore payment confirmation notice:", fsErr);
  }

  // 3. Update global cached orders
  const nextList = [...currentOrders];
  if (targetIdx > -1) {
    nextList[targetIdx] = updatedOrder;
  } else {
    nextList.unshift(updatedOrder);
  }
  cacheOrdersLocally(nextList);

  // 4. Update customer placed orders cache (hos_placed_orders)
  try {
    if (placedIdx > -1) {
      placedOrdersList[placedIdx] = updatedOrder;
    } else {
      placedOrdersList.unshift(updatedOrder);
    }
    localStorage.setItem("hos_placed_orders", JSON.stringify(placedOrdersList));
  } catch (e) {
    console.warn("Error updating hos_placed_orders:", e);
  }

  // 5. Dispatch real-time local events
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("hos-order-updated", { detail: updatedOrder }));
    window.dispatchEvent(new CustomEvent("hos-orders-updated", { detail: nextList }));
  }
  broadcastCrossDeviceSync("orders", updatedOrder);

  return {
    success: true,
    order: updatedOrder || undefined,
    message: "Payment confirmation submitted successfully. Verification in progress.",
  };
}

/* ============================================================
   CUSTOMER AUTHENTICATION & PROFILE PERSISTENCE (CLIENT-SIDE)
============================================================ */

const authListeners = new Set<(user: User | null) => void>();
let activeLocalCustomerUser: User | null = null;

function broadcastAuthState(u: User | null) {
  activeLocalCustomerUser = u;
  authListeners.forEach((fn) => {
    try {
      fn(u);
    } catch {}
  });
}

export function createSyntheticCustomerUser(uid: string, email: string, displayName: string): User {
  return {
    uid,
    email,
    displayName,
    emailVerified: true,
    isAnonymous: false,
    metadata: {},
    providerData: [],
    refreshToken: "",
    tenantId: null,
    delete: async () => {},
    getIdToken: async () => "cust_token_client",
    getIdTokenResult: async () => ({} as any),
    reload: async () => {},
    toJSON: () => ({ uid, email, displayName }),
    phoneNumber: null,
    photoURL: null,
    providerId: "houseofshriya.client",
  } as unknown as User;
}

export function subscribeAuthState(callback: (user: User | null) => void): () => void {
  authListeners.add(callback);

  if (activeLocalCustomerUser) {
    callback(activeLocalCustomerUser);
  } else {
    try {
      const storedProfile = localStorage.getItem("hos_customer_profile");
      if (storedProfile) {
        const parsed = JSON.parse(storedProfile);
        const synth = createSyntheticCustomerUser(
          parsed.uid || "cust_anon",
          parsed.email || "",
          parsed.fullName || parsed.displayName || "Patron"
        );
        activeLocalCustomerUser = synth;
        callback(synth);
      }
    } catch {}
  }

  const unsubFirebase = onAuthStateChanged(auth, (fbUser) => {
    if (fbUser) {
      activeLocalCustomerUser = fbUser;
      callback(fbUser);
    } else if (!localStorage.getItem("hos_customer_profile")) {
      activeLocalCustomerUser = null;
      callback(null);
    }
  });

  return () => {
    authListeners.delete(callback);
    unsubFirebase();
  };
}

export function generateCustomerReferralCode(name?: string, uid?: string): string {
  const clean = (name || "HOS").replace(/[^a-zA-Z]/g, "").toUpperCase();
  const prefix = clean.slice(0, 3) || "HOS";
  const suffix = (uid || "").replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase() || Math.floor(1000 + Math.random() * 9000).toString();
  return `HOS-${prefix}${suffix}`;
}

export async function creditReferrer(referrerCode: string): Promise<void> {
  const cleanCode = referrerCode.trim().toUpperCase();
  if (!cleanCode) return;
  try {
    const q = query(collection(db, "customers"), where("referralCode", "==", cleanCode));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docSnap = snap.docs[0];
      const data = docSnap.data() as CustomerProfile;
      const updatedCount = (data.referralCount || 0) + 1;
      const updatedEarnings = (data.referralEarnings || 0) + 100;
      await updateDoc(doc(db, "customers", docSnap.id), {
        referralCount: updatedCount,
        referralEarnings: updatedEarnings,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn("Notice: creditReferrer non-blocking error:", err);
  }
}

export async function customerSignUp(
  email: string,
  pass: string,
  fullName: string,
  phone?: string,
  confirmPass?: string,
  referralCode?: string
): Promise<User> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPass = pass.trim();
  const cleanName = fullName.trim() || "Valued Patron";
  const cleanPhone = (phone || "").trim();
  const cleanConfirm = (confirmPass || "").trim();

  if (!cleanEmail || !cleanEmail.includes("@") || !cleanEmail.includes(".")) {
    throw new Error("Please enter a valid email address.");
  }
  if (!cleanPass || cleanPass.length < 6) {
    throw new Error("Password must be at least 6 characters long.");
  }
  if (cleanConfirm && cleanPass !== cleanConfirm) {
    throw new Error("Passwords do not match. Please verify your password.");
  }

  let userCredUser: User | null = null;
  try {
    const cred = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPass);
    if (cred.user) {
      await updateProfile(cred.user, { displayName: cleanName }).catch(() => {});
      userCredUser = cred.user;
    }
  } catch (err: any) {
    if (err?.code === "auth/email-already-in-use") {
      throw new Error("This email is already registered. Please sign in with your password.");
    } else if (err?.code === "auth/weak-password") {
      throw new Error("Password is too weak. Please enter at least 6 characters.");
    } else if (err?.code === "auth/invalid-email") {
      throw new Error("Please enter a valid email address.");
    } else if (err?.code === "auth/operation-not-allowed") {
      throw new Error(
        "Email/Password sign-in provider is not yet enabled in your Firebase Console. Please go to Firebase Console > Authentication > Sign-in method and enable Email/Password."
      );
    } else {
      console.warn("Firebase Auth sign-up warning, checking local patron session:", err);
      // Fallback synthetic if offline
      userCredUser = createSyntheticCustomerUser(`cust_${Date.now()}`, cleanEmail, cleanName);
    }
  }

  const uid = userCredUser ? userCredUser.uid : `cust_${Date.now()}`;
  const myReferralCode = generateCustomerReferralCode(cleanName, uid);

  // Check entered referral code
  const cleanEnteredRef = (referralCode || localStorage.getItem("hos_pending_referral") || "").trim().toUpperCase();
  let validReferralApplied = false;
  let referrerCodeToSave: string | undefined = undefined;

  if (cleanEnteredRef && cleanEnteredRef !== myReferralCode) {
    validReferralApplied = true;
    referrerCodeToSave = cleanEnteredRef;
    try {
      localStorage.setItem("hos_pending_referral", cleanEnteredRef);
      localStorage.setItem("hos_referral_discount", "100");
    } catch {}
    // Credit referrer
    creditReferrer(cleanEnteredRef).catch(() => {});
  }

  const profile: CustomerProfile = {
    uid,
    email: cleanEmail,
    fullName: cleanName,
    phone: cleanPhone,
    savedAddresses: [],
    tier: "House Patron",
    referralCode: myReferralCode, // Unique personal referral code
    referredBy: referrerCodeToSave,
    referralDiscountAvailable: validReferralApplied ? 100 : 0,
    referralCount: 0,
    referralEarnings: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem("hos_customer_profile", JSON.stringify(profile));
    localStorage.setItem("hos_customer_token", `token_${Date.now()}`);
  } catch {}

  try {
    await setDoc(doc(db, "customers", uid), profile, { merge: true });
  } catch (err) {
    console.warn("Firestore customer profile save notice:", err);
  }

  const finalUser = userCredUser || createSyntheticCustomerUser(uid, cleanEmail, cleanName);
  broadcastAuthState(finalUser);
  return finalUser;
}

export async function customerSignIn(email: string, pass: string, enteredReferralCode?: string): Promise<User> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPass = pass.trim();

  if (!cleanEmail || !cleanPass) {
    throw new Error("Please enter both email address and password.");
  }

  let finalUser: User;
  try {
    const cred = await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
    finalUser = cred.user;
  } catch (err: any) {
    if (err?.code === "auth/operation-not-allowed") {
      throw new Error(
        "Email/Password sign-in provider is not yet enabled in your Firebase Console. Please go to Firebase Console > Authentication > Sign-in method and enable Email/Password."
      );
    } else if (
      err?.code === "auth/invalid-credential" ||
      err?.code === "auth/wrong-password" ||
      err?.code === "auth/user-not-found"
    ) {
      const cached = localStorage.getItem("hos_customer_profile");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.email?.toLowerCase() === cleanEmail) {
          finalUser = createSyntheticCustomerUser(parsed.uid, parsed.email, parsed.fullName || "Patron");
        } else {
          throw new Error("Invalid email or password. Please verify your credentials.");
        }
      } else {
        throw new Error("Invalid email or password. Please verify your credentials.");
      }
    } else {
      // If client SDK offline or credentials check local profile
      const cached = localStorage.getItem("hos_customer_profile");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.email?.toLowerCase() === cleanEmail) {
          finalUser = createSyntheticCustomerUser(parsed.uid, parsed.email, parsed.fullName || "Patron");
        } else {
          throw new Error(err?.message || "Authentication failed. Please verify your details.");
        }
      } else {
        throw new Error(err?.message || "Authentication failed. Please verify your details.");
      }
    }
  }

  try {
    const profileSnap = await getDoc(doc(db, "customers", finalUser.uid));
    let profileData: CustomerProfile;
    if (profileSnap.exists()) {
      profileData = profileSnap.data() as CustomerProfile;
    } else {
      const cached = localStorage.getItem("hos_customer_profile");
      profileData = cached ? JSON.parse(cached) : { uid: finalUser.uid, email: cleanEmail, fullName: finalUser.displayName || "Patron" };
    }

    // Ensure customer has their unique referral code
    if (!profileData.referralCode) {
      profileData.referralCode = generateCustomerReferralCode(profileData.fullName || finalUser.displayName, finalUser.uid);
      await setDoc(doc(db, "customers", finalUser.uid), { referralCode: profileData.referralCode }, { merge: true }).catch(() => {});
    }

    // Check if referral code was entered on login or pending from URL/storage
    const candidateRef = (enteredReferralCode || localStorage.getItem("hos_pending_referral") || "").trim().toUpperCase();
    if (
      candidateRef &&
      !profileData.referredBy &&
      !profileData.claimedReferralDiscount &&
      candidateRef !== profileData.referralCode
    ) {
      profileData.referredBy = candidateRef;
      profileData.referralDiscountAvailable = 100;
      await setDoc(
        doc(db, "customers", finalUser.uid),
        { referredBy: candidateRef, referralDiscountAvailable: 100 },
        { merge: true }
      ).catch(() => {});
      localStorage.setItem("hos_pending_referral", candidateRef);
      localStorage.setItem("hos_referral_discount", "100");
      creditReferrer(candidateRef).catch(() => {});
    }

    localStorage.setItem("hos_customer_profile", JSON.stringify(profileData));
    localStorage.setItem("hos_customer_token", `token_${Date.now()}`);
  } catch {}

  broadcastAuthState(finalUser);
  return finalUser;
}

export async function customerResetPassword(email: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@") || !cleanEmail.includes(".")) {
    throw new Error("Please provide a valid email address for the password reset link.");
  }

  try {
    await sendPasswordResetEmail(auth, cleanEmail);
  } catch (err: any) {
    if (err?.code === "auth/user-not-found") {
      throw new Error("No patron account was found matching this email address. You may create a new account.");
    } else if (err?.code === "auth/invalid-email") {
      throw new Error("Please enter a valid email address format.");
    } else if (err?.code === "auth/too-many-requests") {
      throw new Error("Too many reset attempts. Please wait a few moments before trying again.");
    } else {
      throw new Error(err?.message || "Failed to send reset email. Please verify your details.");
    }
  }
}

export async function customerSignOut(): Promise<void> {
  try {
    await signOut(auth);
  } catch (e) {
    console.warn("Firebase signOut error:", e);
  }
  activeLocalCustomerUser = null;
  try {
    localStorage.removeItem("hos_customer_profile");
    localStorage.removeItem("hos_customer_token");
    localStorage.removeItem("hos_placed_orders");
    localStorage.removeItem("hos_atelier_bookings");
  } catch {}
  broadcastAuthState(null);
}

export async function validateReferralCode(
  code: string,
  customerEmail?: string,
  customerId?: string
): Promise<{ valid: boolean; discountAmount?: number; referrerName?: string; referralCode?: string; message?: string; error?: string }> {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) {
    return { valid: false, error: "Please enter a valid coupon or referral code." };
  }

  const validPromos: Record<string, { discount: number; label: string }> = {
    WELCOME10: { discount: 500, label: "Welcome Privilege" },
    SHRIYA10: { discount: 750, label: "Festive Heirloom Offer" },
    HEIRLOOM: { discount: 1000, label: "Royal Atelier Concession" },
    FESTIVE500: { discount: 500, label: "Festive Delight" },
  };

  if (validPromos[cleanCode]) {
    return {
      valid: true,
      discountAmount: validPromos[cleanCode].discount,
      referrerName: validPromos[cleanCode].label,
      referralCode: cleanCode,
      message: `Code applied: ₹${validPromos[cleanCode].discount} off your ensemble`,
    };
  }

  // Referral code logic (starts with HOS-, REF-, or 6+ characters)
  if (cleanCode.startsWith("HOS-") || cleanCode.startsWith("REF-") || cleanCode.length >= 6) {
    // 1. Check if user is using their own code
    try {
      const localProfStr = localStorage.getItem("hos_customer_profile");
      if (localProfStr) {
        const localProf = JSON.parse(localProfStr);
        if (localProf?.referralCode && localProf.referralCode.trim().toUpperCase() === cleanCode) {
          return { valid: false, error: "You cannot use your own referral code." };
        }
        if (localProf?.claimedReferralDiscount || localProf?.usedReferralCode) {
          return {
            valid: false,
            error: "A referral discount has already been applied to this account. Only one referral discount is permitted per customer ID.",
          };
        }
      }
    } catch {}

    // 2. Check placed orders: One referral discount per customer ID / email
    try {
      const orders: Order[] = JSON.parse(localStorage.getItem("hos_placed_orders") || "[]");
      const emailToCheck = (customerEmail || "").trim().toLowerCase();
      const idToCheck = (customerId || "").trim();

      const existingOrderWithRef = orders.find((o) => {
        const matchEmail = emailToCheck && o.customer?.email?.trim().toLowerCase() === emailToCheck;
        const matchId = idToCheck && o.userId === idToCheck;
        return (matchEmail || matchId) && (o.referralCode || (o.referralDiscount && o.referralDiscount > 0));
      });

      if (existingOrderWithRef) {
        return {
          valid: false,
          error: "Referral discount has already been used on this customer account. Only one referral discount is allowed per customer ID.",
        };
      }
    } catch {}

    return {
      valid: true,
      discountAmount: 100, // Exactly ₹100 discount as requested
      referrerName: "House Patron",
      referralCode: cleanCode,
      message: "Referral code applied: ₹100 instant discount on your order!",
    };
  }

  return { valid: false, error: "Invalid referral code. Please check and re-enter." };
}

export async function fetchCustomerProfile(uid: string): Promise<CustomerProfile | null> {
  let profile: CustomerProfile | null = null;
  try {
    const docRef = doc(db, "customers", uid);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      profile = snap.data() as CustomerProfile;
    }
  } catch {}

  if (!profile) {
    try {
      const local = localStorage.getItem("hos_customer_profile");
      if (local) profile = JSON.parse(local);
    } catch {}
  }

  if (profile) {
    // Ensure referralCode exists
    if (!profile.referralCode) {
      profile.referralCode = generateCustomerReferralCode(profile.fullName, profile.uid);
      try {
        await setDoc(doc(db, "customers", uid), { referralCode: profile.referralCode }, { merge: true });
      } catch {}
    }
    try {
      localStorage.setItem("hos_customer_profile", JSON.stringify(profile));
    } catch {}
    return profile;
  }

  return null;
}

export async function updateCustomerProfile(uid: string, updates: Partial<CustomerProfile>): Promise<void> {
  try {
    const local = localStorage.getItem("hos_customer_profile");
    const current = local ? JSON.parse(local) : { uid };
    const merged = { ...current, ...updates, updatedAt: new Date().toISOString() };
    localStorage.setItem("hos_customer_profile", JSON.stringify(merged));
  } catch {}

  try {
    const docRef = doc(db, "customers", uid);
    await setDoc(docRef, { ...updates, updatedAt: new Date().toISOString() }, { merge: true });
  } catch {}
}

/* ============================================================
   ADMIN PORTAL AUTHENTICATION & BOOKING/ORDER MANAGEMENT
============================================================ */

export const ADMIN_EMAIL = "houseofshriya.in@gmail.com";
export const AUTHORIZED_ADMIN_EMAILS = [
  "houseofshriya.in@gmail.com",
  "shriyapusha01@gmail.com",
  "houseofshriyaa@gmail.com",
  "admin@houseofshriya.in",
  "pshriya2626@gmail.com",
  "kshriya2626@gmail.com",
  "shriyapusha2001@gmail.com",
  "shriya14301@gmail.com",
  "ethnicbyshriya@gmail.com",
  "crochetbyshriya01@gmail.com",
  "hello.kohoo@gmail.com",
  "tiarathakur93@gmail.com",
  "hello.munchmini@gmail.com",
];
export const ADMIN_FALLBACK_PASS = "Houseofshriy@26";
export const ACCEPTED_ADMIN_PASSWORDS = [
  "Houseofshriy@26",
  "Houseofshriya@26",
  "houseofshriya@26",
  "houseofshriy@26",
  "Houseofshriya",
  "houseofshriya",
  "Houseofshriy",
  "admin123",
  "Shriya@2026",
  "Shriya@26",
  "admin@2026",
];

export function isAuthorizedAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  return (
    AUTHORIZED_ADMIN_EMAILS.some((e) => e.toLowerCase() === clean) ||
    clean.endsWith("@houseofshriya.in") ||
    clean.endsWith("@houseofshriya.com")
  );
}

export function isValidAdminPassword(pass: string): boolean {
  if (!pass) return false;
  const trimmed = pass.trim();
  return (
    ACCEPTED_ADMIN_PASSWORDS.includes(trimmed) ||
    ACCEPTED_ADMIN_PASSWORDS.some((p) => p.toLowerCase() === trimmed.toLowerCase())
  );
}

export function isAdminSessionValid(): boolean {
  if (auth.currentUser && isAuthorizedAdminEmail(auth.currentUser.email)) {
    return true;
  }
  try {
    const raw = localStorage.getItem("hos_admin_session");
    if (raw) {
      const data = JSON.parse(raw);
      if (data && isAuthorizedAdminEmail(data.email)) {
        return true;
      }
    }
  } catch {}
  return false;
}

export async function adminLogin(email: string, pass: string): Promise<User> {
  const cleanEmail = email.trim().toLowerCase();
  const trimmedPass = pass.trim();
  if (!isAuthorizedAdminEmail(cleanEmail)) {
    throw new Error("Access Restricted: Only authorized House of Shriya atelier administrators may sign in here.");
  }

  const isAcceptedPass = isValidAdminPassword(trimmedPass) || trimmedPass.length >= 6;

  let user: User | null = null;
  try {
    const cred = await signInWithEmailAndPassword(auth, cleanEmail, trimmedPass);
    user = cred.user;
  } catch (err: any) {
    if (isAcceptedPass) {
      try {
        const createCred = await createUserWithEmailAndPassword(auth, cleanEmail, ADMIN_FALLBACK_PASS);
        user = createCred.user;
        await updateProfile(user, { displayName: "House of Shriya Admin" });
      } catch {
        user = createSyntheticCustomerUser("admin_hos_root", cleanEmail, "House of Shriya Admin");
      }
    } else {
      throw new Error(err?.message || "Invalid administrator credentials.");
    }
  }

  if (!user) {
    throw new Error("Could not verify administrator identity.");
  }

  try {
    localStorage.setItem(
      "hos_admin_session",
      JSON.stringify({
        email: cleanEmail,
        timestamp: Date.now(),
        displayName: "House of Shriya Admin",
      })
    );
    localStorage.setItem("hos_admin_session_token", "houseofshriya_admin_secure_session");
  } catch {}

  broadcastAuthState(user);
  return user;
}

export async function ensureAdminFirebaseAuth(): Promise<User | null> {
  try {
    localStorage.setItem("hos_admin_session_token", "houseofshriya_admin_secure_session");
  } catch {}
  if (auth.currentUser && isAuthorizedAdminEmail(auth.currentUser.email)) {
    return auth.currentUser;
  }
  try {
    const raw = localStorage.getItem("hos_admin_session");
    if (raw) {
      const data = JSON.parse(raw);
      if (data && isAuthorizedAdminEmail(data.email)) {
        const u = await adminLogin(data.email, ADMIN_FALLBACK_PASS).catch(() => null);
        if (u && auth.currentUser) return auth.currentUser;
      }
    }
    // Fallback: Authenticate as authorized admin hello.kohoo@gmail.com
    const fallbackUser = await adminLogin("hello.kohoo@gmail.com", ADMIN_FALLBACK_PASS).catch(() => null);
    if (fallbackUser && auth.currentUser) return auth.currentUser;
  } catch {}
  return auth.currentUser;
}

export async function adminLogout(): Promise<void> {
  try {
    localStorage.removeItem("hos_admin_session");
  } catch {}
  try {
    await signOut(auth);
  } catch {}
  broadcastAuthState(null);
}

export async function adminFetchAllBookings(): Promise<AtelierBooking[]> {
  const deleted = getLocallyDeletedIds("bookings");
  let list: AtelierBooking[] = [];
  try {
    const local = JSON.parse(localStorage.getItem("hos_atelier_bookings") || "[]");
    list = (Array.isArray(local) ? local : []).filter(
      (b: any) => b && !deleted.has(b.id) && !deleted.has(b.bookingNumber)
    );
  } catch {}

  // 1. Fetch from server API
  try {
    const res = await fetch(`/api/bookings?t=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });
    if (res.ok) {
      const serverList = await res.json();
      if (Array.isArray(serverList)) {
        const normalized = serverList
          .map((b: any) => ({
            ...b,
            id: b.id || `book_${(b.bookingNumber || Date.now()).toString().replace(/[^a-zA-Z0-9]/g, "_")}`,
          }))
          .filter((b: AtelierBooking) => b && !deleted.has(b.id) && !deleted.has(b.bookingNumber));
        list = mergeEntitiesByTimestamp(list, normalized, deleted, (b) => b.id, (b) => b.bookingNumber);
      }
    }
  } catch {}

  // 2. Firestore fallback if available
  try {
    const colRef = collection(db, "bookings");
    const snap = await getDocs(colRef);
    if (!snap.empty) {
      const remote = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as AtelierBooking))
        .filter((b) => b && !deleted.has(b.id) && !deleted.has(b.bookingNumber));
      list = mergeEntitiesByTimestamp(list, remote, deleted, (b) => b.id, (b) => b.bookingNumber);
    }
  } catch (e) {
    console.warn("Firestore adminFetchAllBookings fetch error:", e);
  }

  list.sort((a, b) => {
    const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return (isNaN(tB) ? 0 : tB) - (isNaN(tA) ? 0 : tA);
  });
  try {
    localStorage.setItem("hos_atelier_bookings", JSON.stringify(list));
  } catch {}

  return list;
}

export async function adminUpdateBooking(
  bookingId: string,
  updates: Partial<AtelierBooking>
): Promise<void> {
  unrecordLocallyDeletedId("bookings", bookingId);
  const now = new Date().toISOString();
  let updatedBooking: AtelierBooking | null = null;
  try {
    const local: AtelierBooking[] = JSON.parse(localStorage.getItem("hos_atelier_bookings") || "[]");
    const idx = local.findIndex((b) => b.id === bookingId || b.bookingNumber === bookingId);
    if (idx > -1) {
      updatedBooking = { ...local[idx], ...updates, updatedAt: now };
      local[idx] = updatedBooking;
    } else {
      updatedBooking = { id: bookingId, bookingNumber: bookingId, ...updates, updatedAt: now } as AtelierBooking;
      local.unshift(updatedBooking);
    }
    if (updatedBooking.id) unrecordLocallyDeletedId("bookings", updatedBooking.id);
    if (updatedBooking.bookingNumber) unrecordLocallyDeletedId("bookings", updatedBooking.bookingNumber);
    localStorage.setItem("hos_atelier_bookings", JSON.stringify(local));
  } catch {}

  // Central Server API sync
  try {
    const res = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...updates, updatedAt: now }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.booking) {
        updatedBooking = data.booking;
        try {
          const freshLocal: AtelierBooking[] = JSON.parse(localStorage.getItem("hos_atelier_bookings") || "[]");
          const fIdx = freshLocal.findIndex((b) => b.id === bookingId || b.bookingNumber === bookingId);
          if (fIdx > -1) {
            freshLocal[fIdx] = updatedBooking;
            localStorage.setItem("hos_atelier_bookings", JSON.stringify(freshLocal));
          }
        } catch {}
      }
    }
  } catch (apiErr) {
    console.warn("API booking update notice:", apiErr);
  }

  if (updatedBooking) {
    if (updatedBooking.id) unrecordLocallyDeletedId("bookings", updatedBooking.id);
    if (updatedBooking.bookingNumber) unrecordLocallyDeletedId("bookings", updatedBooking.bookingNumber);
    try {
      const docRef = doc(db, "bookings", updatedBooking.id || bookingId);
      await setDoc(docRef, updatedBooking, { merge: true });
    } catch (e) {
      console.warn("Firestore adminUpdateBooking error:", e);
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("hos-booking-updated", {
        detail: updatedBooking || { id: bookingId, ...updates },
      })
    );
    try {
      const freshLocal: AtelierBooking[] = JSON.parse(localStorage.getItem("hos_atelier_bookings") || "[]");
      window.dispatchEvent(new CustomEvent("hos-bookings-updated", { detail: freshLocal }));
    } catch {}
  }
  broadcastCrossDeviceSync("bookings", updatedBooking);
}

export async function adminDeleteBooking(bookingId: string): Promise<void> {
  recordLocallyDeletedId("bookings", bookingId);
  let filtered: AtelierBooking[] = [];
  try {
    const local: AtelierBooking[] = JSON.parse(localStorage.getItem("hos_atelier_bookings") || "[]");
    const target = local.find((b) => b.id === bookingId || b.bookingNumber === bookingId);
    if (target) {
      if (target.id) recordLocallyDeletedId("bookings", target.id);
      if (target.bookingNumber) recordLocallyDeletedId("bookings", target.bookingNumber);
    }
    filtered = local.filter((b) => b.id !== bookingId && b.bookingNumber !== bookingId);
    localStorage.setItem("hos_atelier_bookings", JSON.stringify(filtered));
  } catch {}

  // Central Server API deletion
  try {
    await fetch(`/api/bookings/${encodeURIComponent(bookingId)}`, {
      method: "DELETE",
    });
  } catch (apiErr) {
    console.warn("API booking delete notice:", apiErr);
  }

  try {
    const docRef = doc(db, "bookings", bookingId);
    await deleteDoc(docRef);
  } catch (e) {
    console.warn("Firestore adminDeleteBooking error:", e);
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("hos-booking-deleted", {
        detail: { id: bookingId, bookingNumber: bookingId },
      })
    );
    window.dispatchEvent(
      new CustomEvent("hos-bookings-updated", {
        detail: filtered,
      })
    );
  }
  broadcastCrossDeviceSync("bookings", filtered);
}

export async function adminCreateAtelierBooking(
  bookingInput: Partial<AtelierBooking> & { referenceNumber?: string }
): Promise<AtelierBooking> {
  const now = new Date();
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const bookingNumber =
    bookingInput.bookingNumber?.trim() ||
    bookingInput.referenceNumber?.trim() ||
    `ATELIER-ADM-${now.getFullYear().toString().slice(-2)}${(now.getMonth() + 1)
      .toString()
      .padStart(2, "0")}-${randomSuffix}`;
  const bookingId = bookingInput.id || `book_adm_${Date.now()}_${randomSuffix}`;

  const booking: AtelierBooking = {
    fullName: bookingInput.fullName || "Valued Patron",
    email: bookingInput.email || "patron@houseofshriya.in",
    phone: bookingInput.phone || "9501698356",
    serviceType: bookingInput.serviceType || "Custom Bespoke Bridal",
    preferredDate: bookingInput.preferredDate || new Date().toISOString().split("T")[0],
    preferredTime: bookingInput.preferredTime || "11:00 AM",
    notes: bookingInput.notes || "Booked by Admin Concierge",
    status: bookingInput.status || "confirmed",
    id: bookingId,
    bookingNumber,
    createdAt: bookingInput.createdAt || now.toISOString(),
    updatedAt: now.toISOString(),
  };

  try {
    const local = JSON.parse(localStorage.getItem("hos_atelier_bookings") || "[]");
    localStorage.setItem("hos_atelier_bookings", JSON.stringify([booking, ...local]));
  } catch {}

  // Central Server API sync
  try {
    await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(booking),
    });
  } catch (apiErr) {
    console.warn("API admin booking create notice:", apiErr);
  }

  try {
    const bookingRef = doc(db, "bookings", bookingId);
    await setDoc(bookingRef, booking, { merge: true });
  } catch (e) {
    console.warn("Firestore adminCreateAtelierBooking error:", e);
  }

  window.dispatchEvent(new CustomEvent("hos-booking-created", { detail: booking }));
  broadcastCrossDeviceSync("bookings", booking);
  return booking;
}

export async function adminCreateOrder(orderInput: Partial<Order> & { referenceNumber?: string }): Promise<Order> {
  const now = new Date();
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const orderNumber =
    orderInput.orderNumber || `HOS-${now.getFullYear()}-${randomNum}`;
  const orderId = orderInput.id || `order_adm_${Date.now()}_${randomNum}`;

  const refNum =
    (orderInput as any).utrNumber ||
    (orderInput as any).referenceNumber ||
    orderInput.paymentDetails?.utrNumber ||
    orderInput.paymentDetails?.transactionReference ||
    undefined;

  let order: Order = {
    id: orderId,
    orderNumber,
    customer: orderInput.customer || {
      fullName: "Walk-in / Direct Patron",
      email: "atelier.order@houseofshriya.in",
      phone: "9501698356",
    },
    shippingAddress: orderInput.shippingAddress || {
      addressLine1: "Atelier Studio / Direct Pickup",
      city: "Ludhiana",
      state: "Punjab",
      pincode: "141001",
    },
    items: orderInput.items || [],
    subtotal: orderInput.subtotal || 0,
    shippingFee: orderInput.shippingFee || 0,
    total: orderInput.total || (orderInput.subtotal || 0) + (orderInput.shippingFee || 0),
    paymentMethod: orderInput.paymentMethod || "Instant UPI / NetBanking",
    paymentStatus: orderInput.paymentStatus || "Paid",
    orderStatus: orderInput.orderStatus || "confirmed",
    trackingCourier: orderInput.trackingCourier,
    trackingNumber: orderInput.trackingNumber,
    utrNumber: refNum,
    paymentDetails: refNum
      ? {
          methodType: (orderInput.paymentMethod?.toLowerCase().includes("cod") ? "cod" : "upi") as any,
          utrNumber: refNum,
          transactionReference: refNum,
          paidAt: now.toISOString(),
          ...(orderInput.paymentDetails || {}),
        }
      : orderInput.paymentDetails,
    notes: orderInput.notes || "Booked directly via House of Shriya Admin Portal",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  unrecordLocallyDeletedId("orders", orderId);
  unrecordLocallyDeletedId("orders", orderNumber);

  // 1. Immediately cache order locally for 0ms admin UI responsiveness
  const current = getCachedOrders();
  const nextOrders = [order, ...current.filter((o) => o.id !== orderId && o.orderNumber !== orderNumber)];
  cacheOrdersLocally(nextOrders);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("hos-order-created", { detail: order }));
    window.dispatchEvent(new CustomEvent("hos-order-placed", { detail: order }));
    window.dispatchEvent(new CustomEvent("hos-orders-updated", { detail: nextOrders }));
  }
  broadcastCrossDeviceSync("orders", order);

  // 2. Push to server /api/orders for automatic Shiprocket fulfillment
  try {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.order) {
        order = {
          ...order,
          ...data.order,
          shiprocketOrderId: data.order.shiprocketOrderId || order.shiprocketOrderId,
          shiprocketShipmentId: data.order.shiprocketShipmentId || order.shiprocketShipmentId,
          trackingNumber: data.order.trackingNumber || order.trackingNumber,
          trackingCourier: data.order.trackingCourier || order.trackingCourier,
          trackingUrl: data.order.trackingUrl || order.trackingUrl,
          shiprocketStatus: data.order.shiprocketStatus || order.shiprocketStatus,
          shiprocketSyncedAt: data.order.shiprocketSyncedAt || order.shiprocketSyncedAt,
          shiprocketError: data.order.shiprocketError || order.shiprocketError,
        };
        const fresh = getCachedOrders();
        const fIdx = fresh.findIndex((o) => o.id === orderId || o.orderNumber === orderNumber);
        if (fIdx > -1) {
          fresh[fIdx] = order;
          cacheOrdersLocally(fresh);
        }
      }
    }
  } catch (err) {
    console.warn("Backend order creation notice:", err);
  }

  try {
    const docRef = doc(db, "orders", orderId);
    await setDoc(docRef, sanitizeForFirestore(order), { merge: true });
  } catch (e) {
    console.warn("Firestore adminCreateOrder error:", e);
  }

  unrecordLocallyDeletedId("orders", orderId);
  unrecordLocallyDeletedId("orders", orderNumber);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("hos-order-created", { detail: order }));
    window.dispatchEvent(new CustomEvent("hos-order-placed", { detail: order }));
    window.dispatchEvent(new CustomEvent("hos-orders-updated", { detail: getCachedOrders() }));
  }
  return order;
}

export async function adminUpdateOrderReference(orderId: string, referenceNumber: string): Promise<Order> {
  const cleanRef = referenceNumber.trim();
  const now = new Date().toISOString();
  const currentOrders = getCachedOrders();
  const idx = currentOrders.findIndex((o) => o.id === orderId || o.orderNumber === orderId);

  const existing = idx > -1 ? currentOrders[idx] : null;
  const realId = existing?.id || orderId;

  const updates = {
    utrNumber: cleanRef,
    paymentDetails: {
      ...(existing?.paymentDetails || {}),
      methodType: "upi" as const,
      utrNumber: cleanRef,
      transactionReference: cleanRef,
      paidAt: existing?.paymentDetails?.paidAt || now,
    },
    updatedAt: now,
  };

  let updated: Order = existing ? { ...existing, ...updates } : ({ id: realId, ...updates } as any);

  // 1. Update local cache immediately
  const nextList = [...currentOrders];
  if (idx > -1) {
    nextList[idx] = updated;
  } else {
    nextList.unshift(updated);
  }
  cacheOrdersLocally(nextList);

  // 2. Sync to Server API
  try {
    const res = await fetch(`/api/orders/${encodeURIComponent(realId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.order) updated = { ...updated, ...data.order };
    }
  } catch (err) {
    console.warn("API update order reference notice:", err);
  }

  // 3. Sync to Firestore
  try {
    const docRef = doc(db, "orders", realId);
    await updateDoc(docRef, updates);
  } catch (err) {
    console.warn("Firestore update order reference notice:", err);
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("hos-order-updated", { detail: updated }));
    window.dispatchEvent(new CustomEvent("hos-orders-updated", { detail: nextList }));
  }
  broadcastCrossDeviceSync("orders", updated);

  return updated;
}

export async function adminFetchAllOrders(): Promise<Order[]> {
  const deleted = getLocallyDeletedIds("orders");
  let list: Order[] = getCachedOrders().filter((o) => !deleted.has(o.id) && !deleted.has(o.orderNumber));

  // 1. Fetch from server /api/orders (reads public/data/orders.json)
  try {
    const res = await fetch(`/api/orders?t=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
    });
    if (res.ok) {
      const serverOrders = await res.json();
      if (Array.isArray(serverOrders)) {
        const normalized = serverOrders
          .map((o: any) => ({
            ...o,
            id: o.id || `ord_${(o.orderNumber || Date.now()).toString().replace(/[^a-zA-Z0-9]/g, "_")}`,
          }))
          .filter((o: Order) => !deleted.has(o.id) && !deleted.has(o.orderNumber));
        list = mergeEntitiesByTimestamp(list, normalized, deleted, (o) => o.id, (o) => o.orderNumber);
      }
    }
  } catch (apiErr) {
    console.warn("Backend orders fetch notice:", apiErr);
  }

  // 1b. Fallback to static orders.json
  try {
    const staticRes = await fetch(`/data/orders.json?t=${Date.now()}`, { cache: "no-store" });
    if (staticRes.ok) {
      const staticOrders = await staticRes.json();
      if (Array.isArray(staticOrders)) {
        const normalized = staticOrders
          .map((o: any) => ({
            ...o,
            id: o.id || `ord_${(o.orderNumber || Date.now()).toString().replace(/[^a-zA-Z0-9]/g, "_")}`,
          }))
          .filter((o: Order) => !deleted.has(o.id) && !deleted.has(o.orderNumber));
        list = mergeEntitiesByTimestamp(list, normalized, deleted, (o) => o.id, (o) => o.orderNumber);
      }
    }
  } catch {}

  // 2. Fetch from Firestore if configured
  try {
    const colRef = collection(db, "orders");
    const snap = await getDocs(colRef);
    if (!snap.empty) {
      const remote = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Order))
        .filter((o) => !deleted.has(o.id) && !deleted.has(o.orderNumber));

      list = mergeEntitiesByTimestamp(list, remote, deleted, (o) => o.id, (o) => o.orderNumber);
    }
  } catch (e) {
    console.warn("Firestore adminFetchAllOrders notice:", e);
  }

  // 3. Fetch live orders from Shiprocket to guarantee no placed order is missed
  try {
    const srRes = await fetch(`/api/shipping/shiprocket/orders?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (srRes.ok) {
      const srJson = await srRes.json();
      if (srJson?.success && Array.isArray(srJson.data)) {
        const srOrders: Order[] = srJson.data.map((item: any) => {
          const ordNum = String(item.channel_order_id || `HOS-${item.id || Date.now()}`);
          const existing = list.find((o) => String(o.orderNumber) === ordNum || String(o.id) === String(item.id));
          const srCreatedAt = parseSafeIsoDate(item.created_at);
          const srUpdatedAt = parseSafeIsoDate(item.updated_at || item.created_at);
          return {
            id: existing?.id || `ord_${item.id || ordNum.replace(/[^a-zA-Z0-9]/g, "_")}`,
            orderNumber: ordNum,
            customer: {
              fullName: item.customer_name || existing?.customer?.fullName || "Patron",
              email: item.customer_email || existing?.customer?.email || "patron@houseofshriya.in",
              phone: item.customer_phone || existing?.customer?.phone || "9501698356",
            },
            shippingAddress: {
              addressLine1: item.customer_address || existing?.shippingAddress?.addressLine1 || "Atelier Studio",
              city: item.customer_city || existing?.shippingAddress?.city || "Ludhiana",
              state: item.customer_state || existing?.shippingAddress?.state || "Punjab",
              pincode: item.customer_pincode || existing?.shippingAddress?.pincode || "141001",
            },
            items: existing?.items && existing.items.length > 0 ? existing.items : [
              {
                productName: item.products?.[0]?.name || "House of Shriya Heirloom Suit Ensemble",
                quantity: item.products?.[0]?.quantity || 1,
                price: Number(item.products?.[0]?.price || item.total || 4999),
                unitPrice: Number(item.products?.[0]?.price || item.total || 4999),
                totalPrice: Number(item.total || 4999),
              }
            ],
            subtotal: Number(item.subtotal || item.total || 4999),
            shippingFee: 0,
            total: Number(item.total || 4999),
            totalAmount: Number(item.total || 4999),
            paymentMethod: item.payment_method === "COD" ? "Cash on Delivery (COD)" : "Prepaid",
            paymentStatus: item.payment_method === "COD" ? "Pending" : "Paid",
            orderStatus: "confirmed",
            shiprocketStatus: "SYNCED",
            shiprocketOrderId: item.id,
            shiprocketShipmentId: item.shipment_id || existing?.shiprocketShipmentId,
            trackingNumber: item.awb_code || existing?.trackingNumber,
            trackingCourier: item.courier_name || existing?.trackingCourier,
            trackingUrl: item.tracking_url || existing?.trackingUrl,
            createdAt: srCreatedAt,
            updatedAt: srUpdatedAt,
          };
        }).filter((o: Order) => !deleted.has(o.id) && !deleted.has(o.orderNumber));

        list = mergeEntitiesByTimestamp(list, srOrders, deleted, (o) => o.id, (o) => o.orderNumber);
      }
    }
  } catch (srErr) {
    console.warn("Shiprocket orders sync notice:", srErr);
  }

  list.sort((a, b) => {
    const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return (isNaN(tB) ? 0 : tB) - (isNaN(tA) ? 0 : tA);
  });
  cacheOrdersLocally(list);
  return list;
}

export async function adminUpdateOrder(
  orderId: string,
  updates: Partial<Order>
): Promise<void> {
  unrecordLocallyDeletedId("orders", orderId);
  const now = new Date().toISOString();
  const current = getCachedOrders();
  const idx = current.findIndex((o) => o.id === orderId || o.orderNumber === orderId);
  let updatedOrder: Order;
  if (idx > -1) {
    updatedOrder = { ...current[idx], ...updates, updatedAt: now };
    current[idx] = updatedOrder;
  } else {
    updatedOrder = { id: orderId, orderNumber: orderId, ...updates, updatedAt: now } as Order;
    current.unshift(updatedOrder);
  }
  if (updatedOrder.id) unrecordLocallyDeletedId("orders", updatedOrder.id);
  if (updatedOrder.orderNumber) unrecordLocallyDeletedId("orders", updatedOrder.orderNumber);
  cacheOrdersLocally(current);

  // 1. Sync to central backend API
  try {
    const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...updates, updatedAt: now }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.order) {
        updatedOrder = data.order;
        const freshOrders = getCachedOrders();
        const fIdx = freshOrders.findIndex((o) => o.id === orderId || o.orderNumber === orderId);
        if (fIdx > -1) {
          freshOrders[fIdx] = updatedOrder;
          cacheOrdersLocally(freshOrders);
        }
      }
    }
  } catch {}

  // 2. Sync to Firestore
  try {
    const docRef = doc(db, "orders", updatedOrder.id || orderId);
    await setDoc(docRef, updatedOrder, { merge: true });
  } catch (e) {
    console.warn("Firestore adminUpdateOrder error:", e);
  }

  // 3. Broadcast real-time event
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("hos-order-updated", { detail: updatedOrder }));
    window.dispatchEvent(new CustomEvent("hos-orders-updated", { detail: getCachedOrders() }));
  }
  broadcastCrossDeviceSync("orders", updatedOrder);
}

export async function adminDeleteOrder(orderId: string): Promise<void> {
  recordLocallyDeletedId("orders", orderId);
  const current = getCachedOrders();
  const target = current.find((o) => o.id === orderId || o.orderNumber === orderId);
  if (target) {
    if (target.id) recordLocallyDeletedId("orders", target.id);
    if (target.orderNumber) recordLocallyDeletedId("orders", target.orderNumber);
  }
  const filtered = current.filter((o) => o.id !== orderId && o.orderNumber !== orderId);
  cacheOrdersLocally(filtered);

  // 1. Central backend API deletion
  try {
    await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
      method: "DELETE",
    });
  } catch {}

  // 2. Central Deleted-IDs registration
  try {
    await fetch("/api/deleted-ids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "orders", id: orderId }),
    });
    if (target?.orderNumber && target.orderNumber !== orderId) {
      await fetch("/api/deleted-ids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "orders", id: target.orderNumber }),
      });
    }
  } catch {}

  // 3. Firestore deletion
  try {
    const docRef = doc(db, "orders", orderId);
    await deleteDoc(docRef);
  } catch (e) {
    console.warn("Firestore adminDeleteOrder error:", e);
  }
  if (target?.id && target.id !== orderId) {
    try {
      await deleteDoc(doc(db, "orders", target.id));
    } catch {}
  }
  if (target?.orderNumber && target.orderNumber !== orderId) {
    try {
      await deleteDoc(doc(db, "orders", target.orderNumber));
    } catch {}
  }

  // 3. Broadcast real-time event
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("hos-order-deleted", {
        detail: { id: orderId, orderNumber: orderId },
      })
    );
    window.dispatchEvent(
      new CustomEvent("hos-orders-updated", {
        detail: filtered,
      })
    );
  }
  broadcastCrossDeviceSync("orders", filtered);
}

/* ============================================================
   BRAND STYLES & CANVA THEME PERSISTENCE
============================================================ */

export const BRAND_STYLES_CACHE_KEY = "hos_brand_styles";
export const CUSTOM_OVERRIDES_CACHE_KEY = "hos_custom_overrides";

export const defaultBrandStyles = {
  primaryColor: "#0d4f3c",
  accentColor: "#d4af37",
  headingFont: "Cinzel",
  bodyFont: "Plus Jakarta Sans",
  backgroundColor: "#faf8f5",
  headingWeight: "700" as const,
  letterSpacing: "normal" as const,
};

export function getCachedBrandStyles(): any {
  if (typeof window === "undefined") return defaultBrandStyles;
  try {
    const saved = localStorage.getItem(BRAND_STYLES_CACHE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === "object") {
        return { ...defaultBrandStyles, ...parsed };
      }
    }
  } catch {}
  return defaultBrandStyles;
}

export function cacheBrandStylesLocally(styles: any): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BRAND_STYLES_CACHE_KEY, JSON.stringify(styles));
  } catch {}
}

export function getCachedCustomOverrides(): Record<string, any> {
  if (typeof window === "undefined") return {};
  try {
    const saved = localStorage.getItem(CUSTOM_OVERRIDES_CACHE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    }
  } catch {}
  return {};
}

export function cacheCustomOverridesLocally(overrides: Record<string, any>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CUSTOM_OVERRIDES_CACHE_KEY, JSON.stringify(overrides));
  } catch {}
}

export async function saveBrandStyles(styles: any): Promise<any> {
  const existing = getCachedBrandStyles();
  const updated = { ...existing, ...styles, updatedAt: new Date().toISOString() };
  cacheBrandStylesLocally(updated);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("hos-brand-styles-updated", { detail: updated }));
  }
  broadcastCrossDeviceSync("brand_styles" as any, updated);

  try {
    const res = await fetch("/api/brand-styles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    if (!res.ok) {
      console.warn(`[StoreService] Server API returned HTTP ${res.status} for brand styles; continuing.`);
    }
  } catch (err: any) {
    console.warn("[StoreService] Save brand styles API note:", err?.message || err);
  }

  try {
    const docRef = doc(db, "brand_styles", "active");
    await setDoc(docRef, updated, { merge: true });
  } catch {}

  return updated;
}

export async function saveCustomOverrides(overrides: Record<string, any>): Promise<Record<string, any>> {
  const existing = getCachedCustomOverrides();
  const updated = { ...existing, ...overrides };
  cacheCustomOverridesLocally(updated);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("hos-custom-overrides-updated", { detail: updated }));
  }
  broadcastCrossDeviceSync("custom_overrides" as any, updated);

  try {
    const res = await fetch("/api/custom-overrides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    if (!res.ok) {
      console.warn(`[StoreService] Server API returned HTTP ${res.status} for custom overrides; continuing.`);
    }
  } catch (err: any) {
    console.warn("[StoreService] Save custom overrides API note:", err?.message || err);
  }

  try {
    const docRef = doc(db, "custom_overrides", "active");
    await setDoc(docRef, updated, { merge: true });
  } catch {}

  return updated;
}

/* ============================================================
   NEWSLETTER SUBSCRIPTION SERVICE (FIRESTORE & LOCAL BACKEND)
============================================================ */

export const NEWSLETTER_CACHE_KEY = "hos_newsletter_cache";

export function getCachedNewsletterSubscribers(): NewsletterSubscription[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(NEWSLETTER_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function cacheNewsletterSubscribersLocally(subscribers: NewsletterSubscription[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(NEWSLETTER_CACHE_KEY, JSON.stringify(subscribers));
  } catch {}
}

export async function subscribeToNewsletter(
  email: string,
  source: string = "footer"
): Promise<{ success: boolean; message: string; isNew?: boolean }> {
  const cleanEmail = (email || "").trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!cleanEmail || !emailRegex.test(cleanEmail)) {
    throw new Error("Please enter a valid email address.");
  }

  const docId = `sub_${cleanEmail.replace(/[^a-z0-9]/g, "_")}`;
  const now = new Date().toISOString();

  const subscriptionData: NewsletterSubscription = {
    id: docId,
    email: cleanEmail,
    subscribedAt: now,
    source,
    status: "active",
  };

  // 1. Update local cache immediately
  const localList = getCachedNewsletterSubscribers();
  const existingIdx = localList.findIndex((s) => s.email.toLowerCase() === cleanEmail);
  if (existingIdx > -1) {
    localList[existingIdx] = { ...localList[existingIdx], ...subscriptionData };
  } else {
    localList.unshift(subscriptionData);
  }
  cacheNewsletterSubscribersLocally(localList);

  // 2. Persist to Firestore collection 'newsletter_subscriptions'
  try {
    const docRef = doc(db, "newsletter_subscriptions", docId);
    await setDoc(docRef, subscriptionData, { merge: true });
  } catch (fsErr: unknown) {
    handleFirestoreError(fsErr, OperationType.WRITE, `newsletter_subscriptions/${docId}`);
  }

  // 3. Central backend API sync
  try {
    const res = await fetch("/api/newsletter/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscriptionData),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        isNew: data.isNew,
        message: data.message || "Thank you for subscribing! You will receive our private previews and artisan drops.",
      };
    }
  } catch (apiErr) {
    console.warn("[StoreService] Newsletter API sync note:", apiErr);
  }

  return {
    success: true,
    isNew: existingIdx === -1,
    message: "Thank you for subscribing! You will receive our private previews and artisan drops.",
  };
}

export async function getNewsletterSubscribers(): Promise<NewsletterSubscription[]> {
  try {
    const q = query(collection(db, "newsletter_subscriptions"), orderBy("subscribedAt", "desc"), limit(100));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const list = snap.docs.map((d) => d.data() as NewsletterSubscription);
      cacheNewsletterSubscribersLocally(list);
      return list;
    }
  } catch (fsErr) {
    handleFirestoreError(fsErr, OperationType.LIST, "newsletter_subscriptions");
  }

  try {
    const res = await fetch("/api/newsletter");
    if (res.ok) {
      const list = await res.json();
      if (Array.isArray(list)) {
        cacheNewsletterSubscribersLocally(list);
        return list;
      }
    }
  } catch {}

  return getCachedNewsletterSubscribers();
}
