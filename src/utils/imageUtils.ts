/**
 * Image URL normalization utility for House of Shriya.
 * Converts external share links (Kommodo, Google Drive, Dropbox) into direct, embeddable image URLs.
 */
import type React from "react";
import { getLocalCachedImage, registerLocalImageCache } from "../services/adminUploadService";

const KNOWN_KOMMODO_MAP: Record<string, string> = {
  "eA9kgNNZCuEDbWDBS8JI": "https://plain-apac-prod-public.komododecks.com/202609/05/eA9kgNNZCuEDbWDBS8JI/image.jpg",
  "OSeP8KXZKOwa1kTFdvK2": "https://plain-eeur-prod-public.komododecks.com/202609/15/OSeP8KXZKOwa1kTFdvK2/image.jpg",
  "4UmFSGtcoZdZF37bKc3R": "https://plain-apac-prod-public.komododecks.com/202609/05/4UmFSGtcoZdZF37bKc3R/image.jpg",
};

export function normalizeImageUrl(url?: string | null, fallback = ""): string {
  if (!url || typeof url !== "string") return fallback;
  let trimmed = url.trim();
  if (!trimmed) return fallback;

  // Check known Kommodo mappings
  for (const [key, directUrl] of Object.entries(KNOWN_KOMMODO_MAP)) {
    if (trimmed.includes(key)) {
      return directUrl;
    }
  }

  // Generic Kommodo/Komodo share link: route through proxy if not a direct image file
  if (trimmed.includes("kommodo.ai/i/") || trimmed.includes("komodo.ai/i/")) {
    const idMatch = trimmed.match(/komm?odo\.ai\/i\/([a-zA-Z0-9_-]+)/);
    if (idMatch && idMatch[1] && KNOWN_KOMMODO_MAP[idMatch[1]]) {
      return KNOWN_KOMMODO_MAP[idMatch[1]];
    }
    return `/api/proxy-image?url=${encodeURIComponent(trimmed)}`;
  }

  // Google Drive share link: https://drive.google.com/file/d/ID/view -> direct stream
  const gDriveMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (gDriveMatch && gDriveMatch[1]) {
    return `https://drive.google.com/uc?export=view&id=${gDriveMatch[1]}`;
  }

  // Dropbox share link: dl=0 -> raw=1
  if (trimmed.includes("dropbox.com") && trimmed.includes("dl=0")) {
    return trimmed.replace("dl=0", "raw=1");
  }

  // Check if any uploaded image is immediately available in local memory/storage cache
  if (!trimmed.startsWith("data:") && !trimmed.startsWith("blob:")) {
    const cached = getLocalCachedImage(trimmed);
    if (cached) return cached;
  }

  // Clean /public/ or public/ prefix if stored incorrectly
  if (trimmed.startsWith("/public/")) {
    trimmed = trimmed.replace("/public", "");
  } else if (trimmed.startsWith("public/")) {
    trimmed = "/" + trimmed.replace(/^public\//, "");
  }

  if (
    !trimmed.startsWith("http://") &&
    !trimmed.startsWith("https://") &&
    !trimmed.startsWith("data:") &&
    !trimmed.startsWith("blob:") &&
    !trimmed.startsWith("/")
  ) {
    trimmed = `/${trimmed}`;
  }

  return trimmed;
}

export function handleImageError(
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  fallback = "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&q=80"
) {
  const target = e.currentTarget;
  // If image has ?v= cache-busting timestamp, retry without ?v=
  if (target.src && target.src.includes("?v=") && !target.dataset.retried) {
    target.dataset.retried = "true";
    target.src = target.src.split("?")[0];
    return;
  }
  // Check if we have an immediate local/session cached dataUrl for this uploaded image
  const cached = getLocalCachedImage(target.src);
  if (cached && target.src !== cached) {
    target.src = cached;
    return;
  }

  // Cloudflare R2 / D1 Recovery: If image was an /uploads/ URL that 404s on static CDN, fetch directly from /api/images/
  if (target.src && (target.src.includes("/uploads/") || target.src.includes("uploads/")) && !target.dataset.apiRetried) {
    target.dataset.apiRetried = "true";
    try {
      const urlObj = new URL(target.src, window.location.href);
      const pathname = urlObj.pathname;
      const filename = pathname.split("/").pop() || "";

      if (filename) {
        const apiFallbackUrl = `/api/images/${filename}`;
        target.src = apiFallbackUrl;
        return;
      }
    } catch {}
  }

  if (!target.src.includes("unsplash.com") && target.src !== fallback) {
    target.src = fallback;
  }
}

export function getProductDisplayImage(
  product?: {
    image?: string;
    hoverImage?: string;
    images?: string[];
    colorVariants?: Array<{ image?: string; hoverImage?: string; images?: string[] }>;
  } | null,
  fallback = "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&q=80"
): string {
  if (!product) return fallback;
  const raw =
    product.image ||
    (Array.isArray(product.images) && product.images.find((img) => img && typeof img === "string" && img.trim())) ||
    product.colorVariants?.[0]?.image ||
    (Array.isArray(product.colorVariants?.[0]?.images) && product.colorVariants[0].images.find((img) => img && typeof img === "string" && img.trim())) ||
    "";
  return normalizeImageUrl(raw, fallback);
}

export function getProductHoverImage(
  product?: {
    image?: string;
    hoverImage?: string;
    images?: string[];
    colorVariants?: Array<{ image?: string; hoverImage?: string; images?: string[] }>;
  } | null,
  fallback = ""
): string {
  if (!product) return fallback;
  const main = getProductDisplayImage(product, "");
  const raw =
    (product.hoverImage && product.hoverImage !== product.image ? product.hoverImage : null) ||
    (Array.isArray(product.images) && product.images.length > 1 ? product.images[1] : null) ||
    product.colorVariants?.[0]?.hoverImage ||
    (Array.isArray(product.colorVariants?.[0]?.images) && product.colorVariants[0].images.length > 1 ? product.colorVariants[0].images[1] : null) ||
    main;
  return normalizeImageUrl(raw, fallback || main);
}

export function getProductGalleryImages(
  product?: {
    image?: string;
    hoverImage?: string;
    images?: string[];
    colorVariants?: Array<{ image?: string; hoverImage?: string; images?: string[] }>;
  } | null
): string[] {
  if (!product) return [];
  const list: string[] = [];
  const add = (u?: string | null) => {
    if (!u || typeof u !== "string") return;
    const clean = normalizeImageUrl(u);
    if (clean && !list.includes(clean)) list.push(clean);
  };

  add(product.image);
  if (Array.isArray(product.images)) {
    product.images.forEach(add);
  }
  add(product.hoverImage);

  if (Array.isArray(product.colorVariants)) {
    for (const v of product.colorVariants) {
      add(v.image);
      if (Array.isArray(v.images)) v.images.forEach(add);
      add(v.hoverImage);
    }
  }

  return list;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Client-side image compression: optimizes raw camera/phone photos to ~60-120KB JPEG data URL
export async function compressImageFile(
  file: File,
  maxWidth = 1400,
  quality = 0.85
): Promise<{ dataUrl: string; sizeText: string }> {
  return new Promise((resolve, reject) => {
    const isImage =
      !file.type ||
      file.type.startsWith("image/") ||
      /\.(jpe?g|png|webp|gif|avif|bmp|svg|heic|heif)$/i.test(file.name);

    if (!isImage) {
      reject(new Error("Please choose a valid photo (JPG, PNG, WebP, AVIF, or HEIC)."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read photo from your device."));
    reader.onload = (e) => {
      const raw = e.target?.result as string;
      if (!raw) {
        reject(new Error("Empty image file."));
        return;
      }
      const img = new Image();
      // If browser Image element fails to decode, fallback gracefully to dataUrl
      img.onerror = () => {
        resolve({ dataUrl: raw, sizeText: formatFileSize(file.size) });
      };
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          let { width, height } = img;

          if (width > maxWidth || height > maxWidth) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxWidth) / height);
              height = maxWidth;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve({ dataUrl: raw, sizeText: formatFileSize(file.size) });
            return;
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, width, height);

          const compressed = canvas.toDataURL("image/jpeg", quality);
          const approxBytes = Math.round((compressed.length * 3) / 4);
          resolve({ dataUrl: compressed, sizeText: formatFileSize(approxBytes) });
        } catch {
          resolve({ dataUrl: raw, sizeText: formatFileSize(file.size) });
        }
      };
      img.src = raw;
    };
    reader.readAsDataURL(file);
  });
}
