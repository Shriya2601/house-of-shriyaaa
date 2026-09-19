/**
 * Cloudflare R2 Storage Helper for House of Shriya
 * Connects directly to Cloudflare R2 bucket bindings or R2 S3 API.
 * ZERO Firebase usage!
 */

export interface R2BucketLike {
  get(key: string): Promise<any>;
  put(key: string, value: any, options?: any): Promise<any>;
  delete(key: string): Promise<void>;
  head?(key: string): Promise<any>;
}

export function getR2Bucket(env: any): R2BucketLike | null {
  if (!env || typeof env !== "object") return null;

  // 1. Check known uppercase, lowercase, and common binding names
  const candidates = [
    env.R2,
    env.r2,
    env.BUCKET,
    env.bucket,
    env.R2_BUCKET,
    env.r2_bucket,
    env.IMAGES_BUCKET,
    env.IMAGE_BUCKET,
    env.images_bucket,
    env.image_bucket,
    env.HOUSE_OF_SHRIYA_IMAGES,
    env.STORAGE,
    env.storage,
    env.UPLOADS,
    env.uploads,
    env.MY_BUCKET,
    env.my_bucket,
    env.IMAGES,
    env.images,
  ];

  for (const b of candidates) {
    if (b && typeof b.get === "function" && typeof b.put === "function") {
      return b;
    }
  }

  // 2. Scan all object properties in env for any binding that satisfies R2Bucket interface
  try {
    for (const key of Object.keys(env)) {
      const val = env[key];
      if (
        val &&
        typeof val === "object" &&
        typeof val.get === "function" &&
        typeof val.put === "function" &&
        typeof val.delete === "function"
      ) {
        return val;
      }
    }
  } catch {}

  return null;
}

export function getR2PublicBaseUrl(env: any): string {
  const customDomain =
    env?.R2_PUBLIC_DOMAIN ||
    env?.CLOUDFLARE_R2_PUBLIC_URL ||
    env?.CLOUDFLARE_R2_PUBLIC_DOMAIN ||
    env?.PUBLIC_R2_URL ||
    env?.R2_PUBLIC_URL ||
    "";
  if (customDomain) {
    return customDomain.replace(/\/+$/, "");
  }
  return "";
}
