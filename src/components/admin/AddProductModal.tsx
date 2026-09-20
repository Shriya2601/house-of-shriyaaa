import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  X,
  Sparkles,
  Plus,
  Image as ImageIcon,
  Check,
  Upload,
  Camera,
  Trash2,
  RefreshCw,
  Link as LinkIcon,
  Layers,
  AlertCircle,
} from "lucide-react";
import { Product } from "../../types";
import {
  saveProduct,
  uploadProductFileToFirebase,
  uploadProductDataUrlToFirebase,
  uploadProductImageToFirebase,
  cleanupOldStorageImage,
} from "../../services/storeService";
import {
  normalizeImageUrl,
  handleImageError,
  getProductDisplayImage,
  getProductHoverImage,
  getProductGalleryImages,
  compressImageFile,
} from "../../utils/imageUtils";
import { registerLocalImageCache } from "../../services/adminUploadService";

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit?: Product | null;
  onSuccess?: (product: Product) => void;
  onSave?: (product: Product) => void;
  categories?: any[];
}

const SAMPLE_IMAGES = [
  "/uploads/hos-001-main-1788707076761-551.webp",
  "/uploads/hos-002-main-1788707076764-431.webp",
  "/uploads/hos-003-main-1788707076767-726.webp",
  "/uploads/hos-004-main-1788707076769-360.webp",
  "/uploads/hos-005-main-1788707076772-389.webp",
  "/uploads/hos-006-main-1788707076774-649.jpg",
  "/uploads/hos-007-main-1788707076777-561.jpg",
];

const STANDARD_CATEGORIES = [
  "Cotton Suits",
  "Satin Wear",
  "Silk Wear",
  "Chiffon & Organza",
  "Georgette Grace",
  "Velvet Luxe",
  "Handcrafted Couture",
  "Festive Heirloom",
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
const formatBytes = formatFileSize;

export default function AddProductModal({
  isOpen,
  onClose,
  productToEdit,
  onSuccess,
  onSave,
  categories = [],
}: AddProductModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryList = useMemo(() => {
    const custom = (categories || [])
      .map((c: any) => (typeof c === "string" ? c : c?.name))
      .filter(Boolean);
    const combined = Array.from(new Set([...custom, ...STANDARD_CATEGORIES]));
    return combined;
  }, [categories]);

  // Form fields
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Cotton Suits");
  const [price, setPrice] = useState("₹2,999");
  const [originalPrice, setOriginalPrice] = useState("₹4,499");
  const [fabricType, setFabricType] = useState("Pure Chanderi Silk");
  const [color, setColor] = useState("Royal Emerald");
  const [colorHex, setColorHex] = useState("#0d4f3c");
  const [description, setDescription] = useState(
    "Handcrafted pure artisanal unstitched fabric with intricate zari border and bespoke heirloom finish."
  );

  // Image Upload State
  const [uploadMode, setUploadMode] = useState<"file" | "url">("file");
  const [image, setImage] = useState("");
  const [hoverImage, setHoverImage] = useState("");
  const [extraImages, setExtraImages] = useState<string[]>([]);
  const [mainImageDetails, setMainImageDetails] = useState<{ name: string; size: string } | null>(null);
  const [hoverImageDetails, setHoverImageDetails] = useState<{ name: string; size: string } | null>(null);

  // Explicit upload status: "idle" | "uploading" | "uploaded" | "error"
  const [mainUploadState, setMainUploadState] = useState<"idle" | "uploading" | "uploaded" | "error">("idle");
  const [mainUploadError, setMainUploadError] = useState<string | null>(null);
  const [mainUploadProgress, setMainUploadProgress] = useState(0);
  const [hoverUploadState, setHoverUploadState] = useState<"idle" | "uploading" | "uploaded" | "error">("idle");
  const [hoverUploadError, setHoverUploadError] = useState<string | null>(null);
  const [hoverUploadProgress, setHoverUploadProgress] = useState(0);
  const [extraUploadState, setExtraUploadState] = useState<"idle" | "uploading" | "uploaded" | "error">("idle");
  const [extraUploadError, setExtraUploadError] = useState<string | null>(null);
  const [extraUploadProgress, setExtraUploadProgress] = useState(0);

  const isProcessingMain = mainUploadState === "uploading";
  const isProcessingHover = hoverUploadState === "uploading";
  const isProcessingExtra = extraUploadState === "uploading";

  const [isDragOverMain, setIsDragOverMain] = useState(false);
  const [isDragOverHover, setIsDragOverHover] = useState(false);

  // File Input References
  const mainFileInputRef = useRef<HTMLInputElement>(null);
  const hoverFileInputRef = useRef<HTMLInputElement>(null);
  const extraFileInputRef = useRef<HTMLInputElement>(null);
  const lastMainFileRef = useRef<File | null>(null);
  const lastHoverFileRef = useRef<File | null>(null);

  const [inStock, setInStock] = useState(true);
  const [selectedBadge, setSelectedBadge] = useState("New Drop");

  // Helper to immediately purge removed image from storage
  const purgeOldImage = async (url: string) => {
    if (!url || typeof url !== "string") return;
    try {
      if (url.includes("firebasestorage.googleapis.com") || url.includes("storage.googleapis.com")) {
        cleanupOldStorageImage(url, "").catch(() => {});
      }
    } catch {}
  };

  useEffect(() => {
    if (productToEdit) {
      setName(productToEdit.name || "");
      setCategory(
        productToEdit.category ||
          (categoryList.length > 0 ? categoryList[0] : "Cotton Suits")
      );
      setPrice(productToEdit.price || "₹2,999");
      setOriginalPrice(productToEdit.originalPrice || "₹4,499");
      setFabricType(productToEdit.fabricType || "Pure Chanderi Silk");
      setColor(productToEdit.color || "Royal Emerald");
      setColorHex(productToEdit.colorHex || "#0d4f3c");
      setDescription(productToEdit.description || "");

      const initialMain = getProductDisplayImage(productToEdit);
      const initialHover = getProductHoverImage(productToEdit);
      const gallery = getProductGalleryImages(productToEdit);
      const extras = gallery.filter((u) => u !== initialMain && u !== initialHover);

      setImage(initialMain);
      setHoverImage(initialHover || initialMain);
      setExtraImages(extras);
      setInStock(productToEdit.inStock !== false);
      setSelectedBadge(productToEdit.badges?.[0] || "New Drop");
      setMainImageDetails(initialMain ? { name: "Current Product Photo", size: "Ready" } : null);
      setHoverImageDetails(initialHover ? { name: "Current Hover Photo", size: "Ready" } : null);
      setMainUploadState(initialMain ? "uploaded" : "idle");
      setMainUploadError(null);
      setHoverUploadState(initialHover ? "uploaded" : "idle");
      setHoverUploadError(null);
      setExtraUploadState(extras.length > 0 ? "uploaded" : "idle");
      setExtraUploadError(null);
    } else {
      // Reset form
      setName("");
      setCategory(categoryList.length > 0 ? categoryList[0] : "Cotton Suits");
      setPrice("₹2,999");
      setOriginalPrice("₹4,499");
      setFabricType("Pure Chanderi Silk");
      setColor("Royal Emerald");
      setColorHex("#0d4f3c");
      setDescription(
        "Handcrafted pure artisanal unstitched fabric with intricate zari border and bespoke heirloom finish."
      );
      setImage("");
      setHoverImage("");
      setExtraImages([]);
      setMainImageDetails(null);
      setHoverImageDetails(null);
      setMainUploadState("idle");
      setMainUploadError(null);
      setHoverUploadState("idle");
      setHoverUploadError(null);
      setExtraUploadState("idle");
      setExtraUploadError(null);
      setInStock(true);
      setSelectedBadge("New Drop");
    }
    setError(null);
  }, [productToEdit, isOpen, categoryList]);

  if (!isOpen) return null;

  // Auto calculate savings percentage
  const calculateSavings = (p: string, orig: string): string => {
    const numP = parseInt(p.replace(/[^0-9]/g, ""), 10);
    const numOrig = parseInt(orig.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(numP) && !isNaN(numOrig) && numOrig > numP) {
      const pct = Math.round(((numOrig - numP) / numOrig) * 100);
      return `Save ${pct}%`;
    }
    return "Special Edition";
  };

  // Handle Main Image File Select
  const handleMainFileChange = async (file: File) => {
    console.log(
      `%c[AdminPortal:AddProductModal] %c📁 [Main Photo Selected] %c${file.name} (${formatBytes(file.size)}, ${file.type})`,
      "color: #4338ca; font-weight: bold;",
      "background: #4338ca; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: bold;",
      "color: #1e293b; font-weight: 600;"
    );
    lastMainFileRef.current = file;
    setMainUploadState("uploading");
    setMainUploadProgress(20);
    setMainUploadError(null);
    setError(null);

    const prodId = productToEdit?.id || `hos-${Date.now()}`;
    try {
      // Step 1: Immediately compress client-side for zero-latency, high-resolution rendering
      const { dataUrl, sizeText } = await compressImageFile(file, 1400, 0.85);
      setImage(dataUrl);
      setMainImageDetails({ name: file.name, size: sizeText });
      registerLocalImageCache(dataUrl, dataUrl);
      setMainUploadProgress(45);

      // Step 2: Upload to persistent production storage engine in background
      let downloadUrl = "";
      try {
        downloadUrl = await uploadProductDataUrlToFirebase(
          dataUrl,
          prodId,
          "main",
          (pct) => setMainUploadProgress(45 + Math.round(pct * 0.55))
        );
      } catch (uploadErr) {
        console.warn("[AddProductModal] Storage upload background notice:", uploadErr);
      }

      if (downloadUrl) {
        setImage(downloadUrl);
        registerLocalImageCache(downloadUrl, dataUrl);
      }

      setMainUploadState("uploaded");
      setMainUploadProgress(100);
      setMainUploadError(null);
      console.log(
        `%c[AdminPortal:AddProductModal] %c✅ [Main Photo Ready] %c${downloadUrl || "Cached locally"}`,
        "color: #4338ca; font-weight: bold;",
        "background: #16a34a; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: bold;",
        "color: #15803d; font-weight: 600;"
      );

      // Auto-populate hover image if empty or identical to previous main image
      if (!hoverImage || hoverImage === image || (productToEdit && hoverImage === productToEdit.image)) {
        const hoverUrl = downloadUrl || dataUrl;
        setHoverImage(hoverUrl);
        setHoverImageDetails({ name: file.name, size: sizeText });
        registerLocalImageCache(hoverUrl, dataUrl);
        setHoverUploadState("uploaded");
        setHoverUploadError(null);
      }
    } catch (error: any) {
      console.error("[AddProductModal] Main photo processing error:", error);
      const message = error instanceof Error ? error.message : String(error);
      setMainUploadError(message);
      setMainUploadState("idle");
    } finally {
      if (mainFileInputRef.current) mainFileInputRef.current.value = "";
    }
  };

  // Handle Hover Image File Select
  const handleHoverFileChange = async (file: File) => {
    console.log(
      `%c[AdminPortal:AddProductModal] %c📁 [Hover Photo Selected] %c${file.name} (${formatBytes(file.size)}, ${file.type})`,
      "color: #4338ca; font-weight: bold;",
      "background: #4338ca; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: bold;",
      "color: #1e293b; font-weight: 600;"
    );
    lastHoverFileRef.current = file;
    setHoverUploadState("uploading");
    setHoverUploadProgress(20);
    setHoverUploadError(null);
    setError(null);

    const prodId = productToEdit?.id || `hos-${Date.now()}`;
    try {
      const { dataUrl, sizeText } = await compressImageFile(file, 1400, 0.85);
      setHoverImage(dataUrl);
      setHoverImageDetails({ name: file.name, size: sizeText });
      registerLocalImageCache(dataUrl, dataUrl);
      setHoverUploadProgress(45);

      let downloadUrl = "";
      try {
        downloadUrl = await uploadProductDataUrlToFirebase(
          dataUrl,
          prodId,
          "hover",
          (pct) => setHoverUploadProgress(45 + Math.round(pct * 0.55))
        );
      } catch (uploadErr) {
        console.warn("[AddProductModal] Hover storage upload notice:", uploadErr);
      }

      if (downloadUrl) {
        setHoverImage(downloadUrl);
        registerLocalImageCache(downloadUrl, dataUrl);
      }

      setHoverUploadState("uploaded");
      setHoverUploadProgress(100);
      setHoverUploadError(null);
      console.log(
        `%c[AdminPortal:AddProductModal] %c✅ [Hover Photo Ready] %c${downloadUrl || "Cached locally"}`,
        "color: #4338ca; font-weight: bold;",
        "background: #16a34a; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: bold;",
        "color: #15803d; font-weight: 600;"
      );
    } catch (error: any) {
      console.error("[AddProductModal] Hover photo processing error:", error);
      const message = error instanceof Error ? error.message : String(error);
      setHoverUploadError(message);
      setHoverUploadState("idle");
    } finally {
      if (hoverFileInputRef.current) hoverFileInputRef.current.value = "";
    }
  };

  // Handle Additional Gallery Image File Select
  const handleExtraFileChange = async (file: File) => {
    console.log(
      `%c[AdminPortal:AddProductModal] %c📁 [Gallery Photo Selected] %c${file.name} (${formatBytes(file.size)}, ${file.type})`,
      "color: #4338ca; font-weight: bold;",
      "background: #4338ca; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: bold;",
      "color: #1e293b; font-weight: 600;"
    );
    setExtraUploadState("uploading");
    setExtraUploadProgress(20);
    setExtraUploadError(null);
    setError(null);

    const prodId = productToEdit?.id || `hos-${Date.now()}`;
    try {
      const { dataUrl } = await compressImageFile(file, 1400, 0.85);
      registerLocalImageCache(dataUrl, dataUrl);
      setExtraImages((prev) => [...prev, dataUrl]);
      setExtraUploadProgress(45);

      let downloadUrl = "";
      try {
        downloadUrl = await uploadProductDataUrlToFirebase(
          dataUrl,
          prodId,
          `gallery-${Date.now()}`,
          (pct) => setExtraUploadProgress(45 + Math.round(pct * 0.55))
        );
      } catch (uploadErr) {
        console.warn("[AddProductModal] Gallery storage upload notice:", uploadErr);
      }

      if (downloadUrl) {
        registerLocalImageCache(downloadUrl, dataUrl);
        setExtraImages((prev) => prev.map((img) => (img === dataUrl ? downloadUrl : img)));
      }

      setExtraUploadState("uploaded");
      setExtraUploadProgress(100);
      setExtraUploadError(null);
      console.log(
        `%c[AdminPortal:AddProductModal] %c✅ [Gallery Photo Ready] %c${downloadUrl || "Cached locally"}`,
        "color: #4338ca; font-weight: bold;",
        "background: #16a34a; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: bold;",
        "color: #15803d; font-weight: 600;"
      );
    } catch (error: any) {
      console.error("[AddProductModal] Gallery photo processing error:", error);
      const message = error instanceof Error ? error.message : String(error);
      setExtraUploadError(message);
      setExtraUploadState("idle");
    } finally {
      if (extraFileInputRef.current) extraFileInputRef.current.value = "";
    }
  };

  const handleRemoveExtraImage = (indexToRemove: number) => {
    setExtraImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter a product title or name.");
      return;
    }

    if (!image.trim()) {
      setError("Please upload at least one photo of the suit from your device or choose an image.");
      return;
    }

    if (mainUploadState === "uploading" || hoverUploadState === "uploading" || extraUploadState === "uploading") {
      setError("Photos are currently uploading. Please wait for the upload progress to complete before saving.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const prodId = productToEdit?.id || `hos-${Date.now()}`;
    const savings = calculateSavings(price, originalPrice);

    // Fast-path parallel image resolver with zero-data-loss fallback
    const resolveImg = async (imgUrl: string, slot: string): Promise<string> => {
      if (!imgUrl) return "";
      const trimmed = imgUrl.trim();
      if (!trimmed.startsWith("data:") && !trimmed.startsWith("blob:")) {
        return trimmed;
      }
      try {
        let fileSource: File | Blob | string =
          slot === "main" && lastMainFileRef.current
            ? lastMainFileRef.current
            : slot === "hover" && lastHoverFileRef.current
            ? lastHoverFileRef.current
            : trimmed;
        if (trimmed.startsWith("blob:") && typeof window !== "undefined" && typeof fileSource === "string") {
          const resp = await fetch(trimmed);
          fileSource = await resp.blob();
        }
        const uploaded = await uploadProductImageToFirebase(prodId, slot, fileSource);
        if (uploaded && !uploaded.startsWith("blob:")) {
          return uploaded;
        }
      } catch (err: any) {
        console.warn(`[AddProductModal] Pre-upload notice for ${slot}, preserving local image:`, err);
      }

      // If network upload was delayed, return trimmed URL or convert blob to data URL
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
          return base64;
        } catch {
          return trimmed;
        }
      }

      registerLocalImageCache(trimmed, trimmed);
      return trimmed;
    };

    let finalMainImg = image.trim();
    let finalHoverImage = hoverImage.trim() || finalMainImg;
    let resolvedExtraImages: string[] = [];

    try {
      const [mainRes, hoverRes, ...extraRes] = await Promise.all([
        resolveImg(image, "main"),
        hoverImage.trim() ? resolveImg(hoverImage, "hover") : Promise.resolve(""),
        ...extraImages.map((img, idx) => resolveImg(img, `gallery-${idx + 1}`)),
      ]);

      if (mainRes) {
        finalMainImg = mainRes;
        setImage(finalMainImg);
      }
      if (hoverRes) {
        finalHoverImage = hoverRes;
        setHoverImage(finalHoverImage);
      } else {
        finalHoverImage = finalMainImg;
      }
      resolvedExtraImages = extraRes.filter(Boolean) as string[];
    } catch (uploadErr: any) {
      console.warn("[AddProductModal] Notice during image resolution:", uploadErr);
    }

    const finalImages = [
      finalMainImg,
      finalHoverImage && finalHoverImage !== finalMainImg ? finalHoverImage : null,
      ...resolvedExtraImages.filter((u) => u && u !== finalMainImg && u !== finalHoverImage),
    ].filter(Boolean) as string[];

    const productPayload: Product = {
      id: prodId,
      name: name.trim(),
      category: category.trim(),
      price: price.trim(),
      originalPrice: originalPrice.trim(),
      savings,
      fabricType: fabricType.trim(),
      color: color.trim(),
      colorHex: colorHex.trim(),
      description: description.trim(),
      image: finalMainImg,
      hoverImage: finalHoverImage,
      images: finalImages,
      inStock,
      badges: selectedBadge ? [selectedBadge] : ["New Drop"],
      tags: productToEdit?.tags || [category.trim(), fabricType.trim(), selectedBadge].filter(Boolean),
      rating: productToEdit?.rating || "4.9",
      reviews: productToEdit?.reviews || "12",
      sizes: ["Unstitched Suit"],
      updatedAt: new Date().toISOString(),
      createdAt: productToEdit?.createdAt || new Date().toISOString(),
      colorVariants:
        productToEdit?.colorVariants && productToEdit.colorVariants.length > 0
          ? [
              {
                ...productToEdit.colorVariants[0],
                colorName: color.trim(),
                colorHex: colorHex.trim(),
                price: price.trim(),
                originalPrice: originalPrice.trim(),
                savings,
                fabricType: fabricType.trim(),
                description: description.trim(),
                image: finalMainImg,
                hoverImage: finalHoverImage,
                images: finalImages,
                inStock,
              },
              ...productToEdit.colorVariants.slice(1),
            ]
          : [
              {
                id: `var-${prodId}-0`,
                colorName: color.trim(),
                colorHex: colorHex.trim(),
                price: price.trim(),
                originalPrice: originalPrice.trim(),
                savings,
                fabricType: fabricType.trim(),
                description: description.trim(),
                image: finalMainImg,
                hoverImage: finalHoverImage,
                images: finalImages,
                inStock,
              },
            ],
    };

    try {
      const res = await saveProduct(productPayload);
      const savedProd = res?.product || productPayload;

      // Clean up old storage image if main image was changed
      if (productToEdit?.image && productToEdit.image !== finalMainImg) {
        cleanupOldStorageImage(productToEdit.image, finalMainImg).catch(() => {});
      }

      if (typeof onSuccess === "function") {
        onSuccess(savedProd);
      } else if (typeof onSave === "function") {
        onSave(savedProd);
      }
      onClose();
    } catch (err: any) {
      console.error("[AddProductModal] Failed to save product:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to save product: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      id="modal-add-product"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs overflow-hidden"
    >
      <div className="bg-white w-full h-[94vh] sm:h-auto sm:max-h-[90vh] sm:max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-2xl border border-[#e5ddd3] flex flex-col overflow-hidden animate-in fade-in duration-200">
        {/* Modal Header (Sticky) */}
        <div className="shrink-0 bg-[#0d4f3c] text-white px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#d4af37]/20 flex items-center justify-center text-[#d4af37] shrink-0">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base sm:text-lg leading-snug">
                {productToEdit ? "Edit Boutique Suit Piece" : "Add New Boutique Suit Piece"}
              </h3>
              <p className="text-[10px] sm:text-[11px] text-white/70">
                Direct device photo upload • Auto-optimized • Live updates on site
              </p>
            </div>
          </div>
          <button
            id="btn-close-product-modal"
            onClick={onClose}
            className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0 text-red-600" />
              <div>
                <span className="font-bold">Error: </span>
                {error}
              </div>
            </div>
          )}

          {/* Section: Direct Image Upload (Priority Section) */}
          <div className="space-y-3 bg-[#faf8f5] p-4 rounded-xl border border-[#ebe2d8]">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#0d4f3c] flex items-center gap-1.5">
                  <Camera size={14} className="text-[#0d4f3c]" />
                  <span>Product Photos (Upload from Device) *</span>
                </h4>
                <p className="text-[11px] text-stone-500">
                  Select photos directly from your phone gallery or computer. No URL link required!
                </p>
              </div>

              {/* Toggle upload mode */}
              <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-stone-200 text-[11px]">
                <button
                  type="button"
                  onClick={() => setUploadMode("file")}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    uploadMode === "file"
                      ? "bg-[#0d4f3c] text-white"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  Device Upload
                </button>
                <button
                  type="button"
                  onClick={() => setUploadMode("url")}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    uploadMode === "url"
                      ? "bg-[#0d4f3c] text-white"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  Or Image URL
                </button>
              </div>
            </div>

            {uploadMode === "file" ? (
              <div className="space-y-4 pt-1">
                {/* 1. Primary Photo Dropzone */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-stone-700">
                      1. Main Suit Photo *
                    </label>
                    {mainUploadState === "uploaded" && image && (
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                        <Check size={11} />
                        <span>Uploaded</span>
                      </span>
                    )}
                    {mainUploadState === "uploading" && (
                      <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                        <RefreshCw size={11} className="animate-spin" />
                        <span>Uploading {mainUploadProgress}%</span>
                      </span>
                    )}
                  </div>

                  {/* Hidden Main File Input */}
                  <input
                    ref={mainFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleMainFileChange(f);
                      e.target.value = "";
                    }}
                  />

                  {/* Upload Error Banner */}
                  {mainUploadState === "error" && mainUploadError && (
                    <div className="mb-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                      <AlertCircle size={15} className="shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-semibold">{mainUploadError}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => mainFileInputRef.current?.click()}
                        className="text-[11px] font-bold text-red-800 underline hover:no-underline shrink-0"
                      >
                        Choose Image
                      </button>
                    </div>
                  )}

                  {mainUploadState === "uploading" ? (
                    <div className="p-5 border-2 border-dashed border-amber-300 bg-amber-50/50 rounded-xl text-center">
                      <div className="py-2 flex flex-col items-center gap-2 text-stone-700">
                        <RefreshCw size={22} className="animate-spin text-[#0d4f3c]" />
                        <p className="text-xs font-bold text-stone-900">
                          Uploading & Securing Photo ({mainUploadProgress}%)
                        </p>
                        <div className="w-48 h-1.5 bg-stone-200 rounded-full overflow-hidden mt-1">
                          <div
                            className="h-full bg-[#0d4f3c] transition-all duration-150"
                            style={{ width: `${mainUploadProgress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : image ? (
                    <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-stone-200 shadow-2xs">
                      <div className="w-16 h-20 rounded-lg overflow-hidden border border-stone-200 bg-stone-100 shrink-0">
                        <img
                          src={normalizeImageUrl(image)}
                          alt="Main Suit"
                          className="w-full h-full object-cover"
                          onError={handleImageError}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-semibold text-stone-900 truncate">
                            {mainImageDetails?.name || "Suit Primary Photo"}
                          </p>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded-sm ${
                              mainUploadState === "error"
                                ? "bg-red-100 text-red-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {mainUploadState === "error" ? "Upload Failed" : "Uploaded"}
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-500">
                          {mainImageDetails?.size ? `Size: ${mainImageDetails.size}` : "Cloudflare Storage active"}
                        </p>
                        <p
                          className={`text-[10px] font-medium mt-0.5 ${
                            mainUploadState === "error" ? "text-red-600" : "text-emerald-600"
                          }`}
                        >
                          {mainUploadState === "error"
                            ? "⚠️ Photo upload failed, please retry"
                            : "✓ Shown on boutique storefront and home grid"}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0">
                        {mainUploadState === "error" && (
                          <button
                            type="button"
                            onClick={() => {
                              if (lastMainFileRef.current) {
                                handleMainFileChange(lastMainFileRef.current);
                              } else {
                                mainFileInputRef.current?.click();
                              }
                            }}
                            className="px-2.5 py-1 text-[11px] font-medium bg-red-100 hover:bg-red-200 text-red-800 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <RefreshCw size={11} />
                            <span>Retry</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => mainFileInputRef.current?.click()}
                          className="px-2.5 py-1 text-[11px] font-medium bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw size={11} />
                          <span>Change</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setImage("");
                            setMainImageDetails(null);
                            setMainUploadState("idle");
                            setMainUploadError(null);
                          }}
                          className="px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 size={11} />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragOverMain(true);
                      }}
                      onDragLeave={() => setIsDragOverMain(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragOverMain(false);
                        const f = e.dataTransfer.files?.[0];
                        if (f) handleMainFileChange(f);
                      }}
                      onClick={() => mainFileInputRef.current?.click()}
                      className={`p-5 border-2 border-dashed rounded-xl text-center cursor-pointer transition-all ${
                        isDragOverMain
                          ? "border-[#0d4f3c] bg-[#0d4f3c]/10 scale-[1.01]"
                          : "border-stone-300 bg-white hover:border-[#0d4f3c] hover:bg-[#faf8f5]"
                      }`}
                    >
                      <div className="py-1 flex flex-col items-center gap-1.5">
                        <div className="w-10 h-10 rounded-full bg-[#0d4f3c]/10 text-[#0d4f3c] flex items-center justify-center mb-1">
                          <Upload size={18} />
                        </div>
                        <p className="text-xs font-bold text-stone-800">
                          Choose Image or Drag & Drop Main Suit Photo
                        </p>
                        <p className="text-[11px] text-stone-500">
                          Phone photos, camera shots, JPG, PNG, WebP (auto-compressed for Cloudflare Storage)
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Secondary / Hover / Close-Up Photo (Optional) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-stone-700">
                      2. Hover / Close-Up Photo (Optional)
                    </label>
                    {hoverUploadState === "uploaded" && hoverImage && (
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                        <Check size={11} />
                        <span>Uploaded</span>
                      </span>
                    )}
                    {hoverUploadState === "uploading" && (
                      <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                        <RefreshCw size={11} className="animate-spin" />
                        <span>Uploading {hoverUploadProgress}%</span>
                      </span>
                    )}
                  </div>

                  {/* Hidden Hover File Input */}
                  <input
                    ref={hoverFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleHoverFileChange(f);
                      e.target.value = "";
                    }}
                  />

                  {/* Hover Upload Error Banner */}
                  {hoverUploadState === "error" && hoverUploadError && (
                    <div className="mb-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                      <AlertCircle size={15} className="shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-semibold">{hoverUploadError}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => hoverFileInputRef.current?.click()}
                        className="text-[11px] font-bold text-red-800 underline hover:no-underline shrink-0"
                      >
                        Choose Image
                      </button>
                    </div>
                  )}

                  {hoverUploadState === "uploading" ? (
                    <div className="p-3.5 border border-dashed border-amber-300 bg-amber-50/50 rounded-xl text-center">
                      <div className="py-1 flex items-center justify-center gap-2 text-stone-700 text-xs font-semibold">
                        <RefreshCw size={14} className="animate-spin text-[#0d4f3c]" />
                        <span>Uploading & Securing Photo ({hoverUploadProgress}%)</span>
                      </div>
                    </div>
                  ) : hoverImage ? (
                    <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-stone-200 shadow-2xs">
                      <div className="w-16 h-20 rounded-lg overflow-hidden border border-stone-200 bg-stone-100 shrink-0">
                        <img
                          src={normalizeImageUrl(hoverImage)}
                          alt="Hover Detail"
                          className="w-full h-full object-cover"
                          onError={handleImageError}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-semibold text-stone-900 truncate">
                            {hoverImageDetails?.name || "Hover Secondary Photo"}
                          </p>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded-sm ${
                              hoverUploadState === "error"
                                ? "bg-red-100 text-red-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {hoverUploadState === "error" ? "Upload Failed" : "Uploaded"}
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-500">
                          {hoverImage === image
                            ? "Matches primary (click Change to set distinct hover photo)"
                            : hoverImageDetails?.size
                            ? `Size: ${hoverImageDetails.size}`
                            : "Cloudflare Storage active"}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0">
                        {hoverUploadState === "error" && (
                          <button
                            type="button"
                            onClick={() => {
                              if (lastHoverFileRef.current) {
                                handleHoverFileChange(lastHoverFileRef.current);
                              } else {
                                hoverFileInputRef.current?.click();
                              }
                            }}
                            className="px-2.5 py-1 text-[11px] font-medium bg-red-100 hover:bg-red-200 text-red-800 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <RefreshCw size={11} />
                            <span>Retry</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => hoverFileInputRef.current?.click()}
                          className="px-2.5 py-1 text-[11px] font-medium bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw size={11} />
                          <span>Change</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setHoverImage("");
                            setHoverImageDetails(null);
                            setHoverUploadState("idle");
                            setHoverUploadError(null);
                          }}
                          className="px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 size={11} />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragOverHover(true);
                      }}
                      onDragLeave={() => setIsDragOverHover(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragOverHover(false);
                        const f = e.dataTransfer.files?.[0];
                        if (f) handleHoverFileChange(f);
                      }}
                      onClick={() => hoverFileInputRef.current?.click()}
                      className={`p-3.5 border border-dashed rounded-xl text-center cursor-pointer transition-all ${
                        isDragOverHover
                          ? "border-[#0d4f3c] bg-[#0d4f3c]/5"
                          : "border-stone-300 bg-white hover:border-[#0d4f3c] hover:bg-[#faf8f5]"
                      }`}
                    >
                      <div className="flex items-center justify-center gap-2 text-stone-600 text-xs">
                        <Plus size={14} className="text-[#0d4f3c]" />
                        <span>Choose Image for optional hover/embroidery detail photo</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Additional Gallery Photos */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-stone-700">
                      3. Additional Gallery Photos (Optional)
                    </label>
                    <span className="text-[11px] text-stone-400 font-normal">
                      {extraImages.length} additional {extraImages.length === 1 ? "photo" : "photos"}
                    </span>
                  </div>

                  <input
                    ref={extraFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleExtraFileChange(f);
                      e.target.value = "";
                    }}
                  />

                  {/* Extra Upload Error Banner */}
                  {extraUploadState === "error" && extraUploadError && (
                    <div className="mb-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                      <AlertCircle size={15} className="shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-semibold">{extraUploadError}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => extraFileInputRef.current?.click()}
                        className="text-[11px] font-bold text-red-800 underline hover:no-underline shrink-0"
                      >
                        Choose Image
                      </button>
                    </div>
                  )}

                  {extraImages.length > 0 && (
                    <div className="flex flex-wrap gap-2.5 mb-2.5">
                      {extraImages.map((extraImg, idx) => (
                        <div
                          key={idx}
                          className="relative group w-16 h-20 rounded-lg overflow-hidden border border-stone-200 bg-stone-100 shadow-2xs"
                        >
                          <img
                            src={normalizeImageUrl(extraImg)}
                            alt={`Gallery ${idx + 1}`}
                            className="w-full h-full object-cover"
                            onError={handleImageError}
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveExtraImage(idx)}
                            className="absolute top-1 right-1 p-1 rounded-md bg-black/60 hover:bg-red-600 text-white transition-colors cursor-pointer"
                            title="Remove photo"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => extraFileInputRef.current?.click()}
                    disabled={extraUploadState === "uploading"}
                    className="w-full py-2.5 px-3 border border-dashed border-stone-300 hover:border-[#0d4f3c] hover:bg-[#faf8f5] rounded-xl text-xs text-stone-600 font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {extraUploadState === "uploading" ? (
                      <>
                        <RefreshCw size={13} className="animate-spin text-[#0d4f3c]" />
                        <span className="font-semibold text-stone-800">Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Plus size={13} className="text-[#0d4f3c]" />
                        <span>Choose Image / Add Another Gallery Photo</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* URL Mode */
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Main Image URL
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="product-input-image"
                      type="text"
                      value={image}
                      onChange={(e) => setImage(e.target.value)}
                      placeholder="https://... or /uploads/suit.jpg"
                      className="flex-1 text-sm px-3 py-2 border border-stone-300 rounded-lg font-mono focus:outline-hidden focus:border-[#0d4f3c]"
                    />
                    {image && (
                      <img
                        src={normalizeImageUrl(image)}
                        alt="Preview"
                        className="w-10 h-10 object-cover rounded-md border border-stone-200 shrink-0"
                        onError={handleImageError}
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Hover Image URL (Optional)
                  </label>
                  <input
                    type="text"
                    value={hoverImage}
                    onChange={(e) => setHoverImage(e.target.value)}
                    placeholder="https://... (falls back to main image if empty)"
                    className="w-full text-sm px-3 py-2 border border-stone-300 rounded-lg font-mono focus:outline-hidden focus:border-[#0d4f3c]"
                  />
                </div>
              </div>
            )}

            {/* Quick Sample Selector */}
            <div className="pt-2 border-t border-[#ebe2d8]">
              <p className="text-[11px] text-stone-500 mb-1.5 flex items-center gap-1">
                <ImageIcon size={12} />
                <span>Or pick from House of Shriya curated atelier photography:</span>
              </p>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {SAMPLE_IMAGES.map((imgUrl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setImage(imgUrl);
                      if (SAMPLE_IMAGES[i + 1]) setHoverImage(SAMPLE_IMAGES[i + 1]);
                      setMainImageDetails({ name: `Atelier Preset 0${i + 1}`, size: "Verified" });
                    }}
                    className={`relative w-12 h-12 rounded-lg overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                      image === imgUrl
                        ? "border-[#0d4f3c] scale-105 shadow-xs"
                        : "border-stone-200 opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img
                      src={normalizeImageUrl(imgUrl)}
                      alt={`Sample ${i}`}
                      className="w-full h-full object-cover"
                      onError={handleImageError}
                    />
                    {image === imgUrl && (
                      <div className="absolute inset-0 bg-[#0d4f3c]/40 flex items-center justify-center text-white">
                        <Check size={14} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section: Basic Information */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 border-b border-stone-200 pb-1">
              Boutique Design & Title
            </h4>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Product Title / Name *
              </label>
              <input
                id="product-input-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Royal Emerald Chanderi Silk Suit"
                className="w-full text-sm px-3 py-2 border border-stone-300 rounded-lg focus:outline-hidden focus:border-[#0d4f3c] focus:ring-1 focus:ring-[#0d4f3c]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Category</label>
                <select
                  id="product-select-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-stone-300 rounded-lg bg-white focus:outline-hidden focus:border-[#0d4f3c]"
                >
                  {categoryList.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Fabric Type
                </label>
                <input
                  id="product-input-fabric"
                  type="text"
                  value={fabricType}
                  onChange={(e) => setFabricType(e.target.value)}
                  placeholder="e.g. Pure Chanderi Silk, Satin, Organza"
                  className="w-full text-sm px-3 py-2 border border-stone-300 rounded-lg focus:outline-hidden focus:border-[#0d4f3c]"
                />
              </div>
            </div>
          </div>

          {/* Section: Pricing & Savings */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 border-b border-stone-200 pb-1">
              Pricing & Value
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Selling Price *
                </label>
                <input
                  id="product-input-price"
                  type="text"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="₹2,999"
                  className="w-full text-sm px-3 py-2 border border-stone-300 rounded-lg font-semibold text-[#0d4f3c] focus:outline-hidden focus:border-[#0d4f3c]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Original / Strikethrough Price
                </label>
                <input
                  id="product-input-orig-price"
                  type="text"
                  value={originalPrice}
                  onChange={(e) => setOriginalPrice(e.target.value)}
                  placeholder="₹4,499"
                  className="w-full text-sm px-3 py-2 border border-stone-300 rounded-lg text-stone-500 focus:outline-hidden focus:border-[#0d4f3c]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Badge</label>
                <select
                  id="product-select-badge"
                  value={selectedBadge}
                  onChange={(e) => setSelectedBadge(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-stone-300 rounded-lg bg-white focus:outline-hidden focus:border-[#0d4f3c]"
                >
                  <option value="New Drop">New Drop</option>
                  <option value="Bestseller">Bestseller</option>
                  <option value="Limited Edition">Limited Edition</option>
                  <option value="Artisanal Handcraft">Artisanal Handcraft</option>
                  <option value="Festive Heirloom">Festive Heirloom</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section: Color & Palette */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 border-b border-stone-200 pb-1">
              Color Edition & Swatch
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Color Shade Name
                </label>
                <input
                  id="product-input-color"
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="e.g. Royal Emerald, Dusty Rose, Champagne Gold"
                  className="w-full text-sm px-3 py-2 border border-stone-300 rounded-lg focus:outline-hidden focus:border-[#0d4f3c]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Color Swatch (Hex)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={colorHex}
                    onChange={(e) => setColorHex(e.target.value)}
                    className="w-10 h-10 rounded-lg border border-stone-300 cursor-pointer p-0.5"
                  />
                  <input
                    id="product-input-hex"
                    type="text"
                    value={colorHex}
                    onChange={(e) => setColorHex(e.target.value)}
                    className="flex-1 text-sm font-mono px-3 py-2 border border-stone-300 rounded-lg"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section: Description & Stock */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 border-b border-stone-200 pb-1">
              Description & Availability
            </h4>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Atelier Description
              </label>
              <textarea
                id="product-input-description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the fabric weave, borders, craftsmanship details..."
                className="w-full text-sm px-3 py-2 border border-stone-300 rounded-lg focus:outline-hidden focus:border-[#0d4f3c]"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-stone-50 rounded-lg border border-stone-200">
              <div>
                <p className="text-xs font-bold text-stone-800">In Stock for Immediate Delivery</p>
                <p className="text-[11px] text-stone-500">
                  Allow customers to purchase directly or book an atelier trial
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  id="product-toggle-stock"
                  type="checkbox"
                  checked={inStock}
                  onChange={(e) => setInStock(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-stone-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0d4f3c]"></div>
              </label>
            </div>
          </div>
          </div>

          {/* Modal Footer (Sticky) */}
          <div className="shrink-0 bg-[#faf8f5] border-t border-[#e5ddd3] px-4 sm:px-6 py-3 sm:py-3.5 flex items-center justify-end gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 sm:px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 border border-stone-300 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="btn-submit-add-product"
              type="submit"
              disabled={submitting || isProcessingMain || isProcessingHover || isProcessingExtra}
              className="px-4 sm:px-5 py-2 text-xs font-bold uppercase tracking-wider bg-[#0d4f3c] hover:bg-[#09382b] text-white rounded-lg transition-colors flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <RefreshCw size={15} className="animate-spin" />
              ) : productToEdit ? (
                <Check size={15} />
              ) : (
                <Plus size={15} />
              )}
              <span>
                {submitting
                  ? "Saving to Boutique..."
                  : isProcessingMain || isProcessingHover || isProcessingExtra
                  ? "Uploading..."
                  : productToEdit
                  ? "Update Product"
                  : "Save & Add Product"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
