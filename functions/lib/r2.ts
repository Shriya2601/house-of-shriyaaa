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
  if (!env) return null;
  const candidates = [
    env.R2,
    env.BUCKET,
    env.R2_BUCKET,
    env.IMAGES_BUCKET,
    env.IMAGE_BUCKET,
    env.HOUSE_OF_SHRIYA_IMAGES,
    env.STORAGE,
    env.UPLOADS,
    env.MY_BUCKET,
    env.IMAGES,
  ];
  for (const b of candidates) {
    if (b && typeof b.get === "function" && typeof b.put === "function") {
      return b;
    }
  }
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
