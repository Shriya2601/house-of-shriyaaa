import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Eye,
  Smartphone,
  Tablet,
  Monitor,
  RefreshCw,
  ExternalLink,
  Save,
  Sparkles,
  Image as ImageIcon,
  Package,
  FileText,
  Tag,
  Palette,
  CheckCircle2,
  Upload,
  AlertCircle,
  Sliders,
  Maximize2,
  Minimize2,
  Edit3,
  Check,
  ChevronRight,
  ArrowUpRight,
  Search,
  Plus,
  Trash2,
  Layers,
} from "lucide-react";
import { useStore } from "../../context/StoreContext";
import {
  saveSiteContent,
  saveProduct,
  saveCategory,
  saveBrandStyles,
  defaultSiteContent,
  uploadProductDataUrlToFirebase,
  uploadProductImageToFirebase,
  cleanupOldStorageImage,
  getCachedProducts,
  withTimeout,
} from "../../services/storeService";
import { uploadImageToAdminStorage, registerLocalImageCache } from "../../services/adminUploadService";
import { HeroSlide, Product, CategoryItem, SiteContent } from "../../types";
import { compressImageFile } from "../../utils/imageUtils";

interface AdminLivePreviewStudioProps {
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
  onOpenProductModal?: () => void;
}

type DeviceMode = "desktop" | "tablet" | "mobile";
type StudioTab = "banners" | "products" | "cms" | "categories" | "branding";

export default function AdminLivePreviewStudio({
  showToast,
  onOpenProductModal,
}: AdminLivePreviewStudioProps) {
  const { siteContent, setSiteContent, products, setProducts, categories, setCategories } = useStore();

  // Viewport and Layout state
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("desktop");
  const [activeStudioTab, setActiveStudioTab] = useState<StudioTab>("banners");
  const [isFullscreenPreview, setIsFullscreenPreview] = useState<boolean>(false);
  const [isClickToEditActive, setIsClickToEditActive] = useState<boolean>(false);
  const [previewKey, setPreviewKey] = useState<number>(Date.now());
  const [isRefreshingPreview, setIsRefreshingPreview] = useState<boolean>(false);
  const [lastSavedTime, setLastSavedTime] = useState<string>("Just now");

  // Iframe ref for postMessage and reloading
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ---------------------------------------------------------------------------
  // TAB 1: HERO SLIDESHOW STATE & HANDLERS
  // ---------------------------------------------------------------------------
  const [selectedSlideIndex, setSelectedSlideIndex] = useState<number>(0);
  const [isUploadingBannerPhoto, setIsUploadingBannerPhoto] = useState<boolean>(false);
  const [isSavingBanner, setIsSavingBanner] = useState<boolean>(false);
  const bannerFileInputRef = useRef<HTMLInputElement>(null);

  const heroSlides = useMemo<HeroSlide[]>(() => {
    if (siteContent?.heroSlides && Array.isArray(siteContent.heroSlides) && siteContent.heroSlides.length > 0) {
      return siteContent.heroSlides;
    }
    return defaultSiteContent.heroSlides || [];
  }, [siteContent]);

  const currentSlide = heroSlides[selectedSlideIndex] || heroSlides[0] || {
    eyebrow: "",
    number: "01",
    collection: "",
    title: "",
    description: "",
    image: "",
    season: "",
    caption: "",
    mood: "",
    ctaText: "Explore Collection",
    ctaTarget: "catalog-section",
  };

  const handleSlideFieldChange = (field: keyof HeroSlide, value: string) => {
    const updatedSlides = heroSlides.map((slide, idx) =>
      idx === selectedSlideIndex ? { ...slide, [field]: value } : slide
    );
    setSiteContent((prev) => ({
      ...prev,
      heroSlides: updatedSlides,
    }));
  };

  const handleSaveCurrentSlide = async () => {
    setIsSavingBanner(true);
    try {
      const slidesToSave =
        siteContent?.heroSlides && siteContent.heroSlides.length > 0
          ? siteContent.heroSlides
          : heroSlides;
      const saved = await saveSiteContent({ heroSlides: slidesToSave });
      setSiteContent((prev) => ({ ...prev, ...saved, heroSlides: slidesToSave }));
      setLastSavedTime(new Date().toLocaleTimeString());
      showToast(`Slide 0${selectedSlideIndex + 1} published live to boutique!`, "success");
      notifyIframeRefresh(saved);
    } catch (err: any) {
      showToast(err.message || "Failed to publish slide changes", "error");
    } finally {
      setIsSavingBanner(false);
    }
  };

  const handleBannerPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingBannerPhoto(true);
    try {
      // 1. Compress image to high-quality responsive dataUrl
      const { dataUrl } = await compressImageFile(file, 1600, 0.88);

      // 2. Upload to persistent production storage engine
      let finalUrl = dataUrl;
      try {
        finalUrl = await uploadImageToAdminStorage(dataUrl, {
          slot: `hero-slide-${selectedSlideIndex + 1}`,
        });
      } catch (uploadErr) {
        console.warn("[LivePreviewStudio] Banner storage notice:", uploadErr);
      }

      // 3. Update state and immediately save to database and broadcast live
      const nextSlides = heroSlides.map((s, idx) =>
        idx === selectedSlideIndex ? { ...s, image: finalUrl } : s
      );

      const saved = await saveSiteContent({ heroSlides: nextSlides });
      setSiteContent((prev) => ({ ...prev, ...saved, heroSlides: nextSlides }));

      setLastSavedTime(new Date().toLocaleTimeString());
      showToast(`Hero Slide 0${selectedSlideIndex + 1} photo updated & live!`, "success");
      notifyIframeRefresh(saved);
    } catch (err: any) {
      showToast("Error uploading photo: " + (err.message || "Failed"), "error");
    } finally {
      setIsUploadingBannerPhoto(false);
      if (bannerFileInputRef.current) bannerFileInputRef.current.value = "";
    }
  };

  // ---------------------------------------------------------------------------
  // TAB 2: PRODUCTS QUICK PHOTO & DETAILS STATE & HANDLERS
  // ---------------------------------------------------------------------------
  const [productSearch, setProductSearch] = useState<string>("");
  const [selectedProductCategory, setSelectedProductCategory] = useState<string>("all");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [isUploadingProductPhoto, setIsUploadingProductPhoto] = useState<boolean>(false);
  const [isSavingProduct, setIsSavingProduct] = useState<boolean>(false);
  const productFileInputRef = useRef<HTMLInputElement>(null);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = selectedProductCategory === "all" || p.category === selectedProductCategory;
      const matchSearch =
        !productSearch.trim() ||
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.fabricType?.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.color?.toLowerCase().includes(productSearch.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [products, selectedProductCategory, productSearch]);

  const activeProduct = useMemo(() => {
    if (selectedProductId) {
      return products.find((p) => p.id === selectedProductId) || products[0];
    }
    return products[0];
  }, [products, selectedProductId]);

  const handleProductPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeProduct) return;

    setIsUploadingProductPhoto(true);
    try {
      console.log("[StorageEngine] 1. LivePreviewStudio photo selected:", activeProduct.id, file.name);
      const { dataUrl, sizeText } = await compressImageFile(file, 1400, 0.85);
      console.log("[StorageEngine] 2. LivePreviewStudio photo compressed:", { sizeText, length: dataUrl.length });
      registerLocalImageCache(dataUrl, dataUrl);
      
      // Upload directly to persistent storage
      let finalUrl = dataUrl;
      try {
        finalUrl = await uploadProductDataUrlToFirebase(dataUrl, activeProduct.id, "main");
        if (finalUrl) {
          registerLocalImageCache(finalUrl, dataUrl);
        }
      } catch (uploadErr) {
        console.warn("[LivePreviewStudio] Product photo storage notice:", uploadErr);
      }
      const oldImage = activeProduct.image;

      const updated: Product = {
        ...activeProduct,
        image: finalUrl,
        hoverImage: activeProduct.hoverImage === activeProduct.image ? finalUrl : activeProduct.hoverImage || finalUrl,
        images: Array.isArray(activeProduct.images) && activeProduct.images.length > 0
          ? [finalUrl, ...activeProduct.images.slice(1)]
          : [finalUrl],
        colorVariants:
          Array.isArray(activeProduct.colorVariants) && activeProduct.colorVariants.length > 0
            ? [
                {
                  ...activeProduct.colorVariants[0],
                  image: finalUrl,
                  hoverImage:
                    activeProduct.hoverImage === activeProduct.image
                      ? finalUrl
                      : activeProduct.colorVariants[0].hoverImage || finalUrl,
                  images:
                    Array.isArray(activeProduct.colorVariants[0].images) &&
                    activeProduct.colorVariants[0].images.length > 0
                      ? [finalUrl, ...activeProduct.colorVariants[0].images.slice(1)]
                      : [finalUrl],
                },
                ...activeProduct.colorVariants.slice(1),
              ]
            : activeProduct.colorVariants,
      };

      // Instantly update products in preview
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));

      const res = await saveProduct(updated);
      const savedProd = res?.product || updated;
      setProducts((prev) => prev.map((p) => (p.id === savedProd.id ? savedProd : p)));

      // Cleanup old storage file if replaced
      if (oldImage && oldImage !== finalUrl) {
        cleanupOldStorageImage(oldImage, finalUrl).catch(() => {});
      }

      setLastSavedTime(new Date().toLocaleTimeString());
      showToast(`Photo for "${updated.name}" updated & published live!`, "success");
      notifyIframeRefresh(undefined, getCachedProducts());
    } catch (err: any) {
      console.error("Product image upload failed:", err);
      const message = err instanceof Error ? err.message : String(err);
      showToast("Photo upload failed: " + message, "error");
    } finally {
      setIsUploadingProductPhoto(false);
      if (productFileInputRef.current) productFileInputRef.current.value = "";
    }
  };

  const handleUpdateActiveProduct = async (updates: Partial<Product>) => {
    if (!activeProduct) return;
    setIsSavingProduct(true);
    try {
      const updated: Product = {
        ...activeProduct,
        ...updates,
      };
      const nextProds = products.map((p) => (p.id === updated.id ? updated : p));
      setProducts(nextProds);
      await saveProduct(updated);
      setLastSavedTime(new Date().toLocaleTimeString());
      showToast(`Updated "${updated.name}" live in boutique!`, "success");
      notifyIframeRefresh(undefined, nextProds);
    } catch (err: any) {
      showToast("Update failed: " + (err.message || "Error"), "error");
    } finally {
      setIsSavingProduct(false);
    }
  };

  // ---------------------------------------------------------------------------
  // TAB 3: SITE CMS & ANNOUNCEMENT TEXT
  // ---------------------------------------------------------------------------
  const [cmsData, setCmsData] = useState<SiteContent>(siteContent || defaultSiteContent);
  const [isSavingCms, setIsSavingCms] = useState<boolean>(false);

  useEffect(() => {
    if (siteContent) {
      setCmsData((prev) => ({ ...prev, ...siteContent }));
    }
  }, [siteContent]);

  const handleSaveCms = async () => {
    setIsSavingCms(true);
    try {
      // Exclude heroSlides from CMS update to prevent overwriting banner images
      const { heroSlides: _unused, ...safeCms } = cmsData;
      const saved = await saveSiteContent(safeCms);
      setSiteContent((prev) => ({ ...prev, ...saved }));
      setLastSavedTime(new Date().toLocaleTimeString());
      showToast("Site text & announcement banner published live!", "success");
      notifyIframeRefresh(saved);
    } catch (err: any) {
      showToast("Failed to save CMS text: " + (err.message || "Error"), "error");
    } finally {
      setIsSavingCms(false);
    }
  };

  // ---------------------------------------------------------------------------
  // TAB 4: BRAND COLORS & STYLING
  // ---------------------------------------------------------------------------
  const [primaryColor, setPrimaryColor] = useState<string>("#0d4f3c");
  const [accentColor, setAccentColor] = useState<string>("#d4af37");
  const [isSavingBrand, setIsSavingBrand] = useState<boolean>(false);

  const handleSaveBrand = async () => {
    setIsSavingBrand(true);
    try {
      await saveBrandStyles({
        primaryColor,
        accentColor,
      });
      setLastSavedTime(new Date().toLocaleTimeString());
      showToast("Brand styling published live!", "success");
      notifyIframeRefresh();
    } catch (err: any) {
      showToast("Failed to save brand styles: " + (err.message || "Error"), "error");
    } finally {
      setIsSavingBrand(false);
    }
  };

  // ---------------------------------------------------------------------------
  // REFRESH & SYNC UTILS
  // ---------------------------------------------------------------------------
  const notifyIframeRefresh = (
    freshContent?: SiteContent,
    freshProducts?: Product[],
    freshCategories?: CategoryItem[]
  ) => {
    const payloadContent = freshContent || siteContent;
    const payloadProducts = freshProducts || products;
    const payloadCategories = freshCategories || categories;
    try {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          {
            type: "hos-sync-refresh",
            products: payloadProducts,
            siteContent: payloadContent,
            categories: payloadCategories,
            timestamp: Date.now(),
          },
          "*"
        );
      }
    } catch {}
    // Also trigger key bump for guaranteed rerender
    setPreviewKey(Date.now());
  };

  const handleManualRefreshPreview = () => {
    setIsRefreshingPreview(true);
    notifyIframeRefresh();
    setTimeout(() => {
      setIsRefreshingPreview(false);
      showToast("Live preview synchronized with current boutique data.", "info");
    }, 600);
  };

  // Frame width based on selected device mode
  const getDeviceFrameStyles = () => {
    switch (deviceMode) {
      case "mobile":
        return "w-[380px] h-[740px] max-h-[85vh] rounded-[38px] border-[10px] border-[#1e1b18] shadow-2xl overflow-hidden";
      case "tablet":
        return "w-[768px] h-[820px] max-h-[88vh] rounded-[24px] border-[8px] border-[#2d2926] shadow-2xl overflow-hidden";
      case "desktop":
      default:
        return "w-full h-[820px] max-h-[88vh] rounded-xl border border-[#e5ddd3] shadow-md overflow-hidden";
    }
  };

  const previewUrl = `/?preview_mode=admin&nointro=true${isClickToEditActive ? "&canva=true" : ""}&v=${previewKey}`;

  return (
    <div id="admin-live-preview-studio" className="space-y-4">
      {/* Top Banner & Control Bar */}
      <div className="bg-gradient-to-r from-[#0d4f3c] via-[#135f49] to-[#0d4f3c] text-white p-4 sm:p-5 rounded-2xl shadow-lg border border-[#d4af37]/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#d4af37]/25 border border-[#d4af37] flex items-center justify-center text-[#d4af37] shadow-inner shrink-0">
            <Eye size={22} className="text-[#d4af37]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-serif font-bold text-white tracking-wide">
                Live Storefront Preview & Visual Studio
              </h2>
              <span className="bg-[#d4af37] text-[#0d4f3c] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Live Edit Mode
              </span>
            </div>
            <p className="text-xs text-white/80 mt-0.5">
              Admin se direct images, banners aur text badlo — jo bhi changes kroge turant live store par reflect honge.
            </p>
          </div>
        </div>

        {/* Live Sync Status & Quick Links */}
        <div className="flex flex-wrap items-center gap-2.5 self-stretch md:self-auto justify-end">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/30 border border-emerald-500/40 text-xs text-emerald-300 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
            <span className="w-2 h-2 rounded-full bg-emerald-400 -ml-3.5 shrink-0" />
            <span>Live Synced ({lastSavedTime})</span>
          </div>

          <button
            onClick={handleManualRefreshPreview}
            disabled={isRefreshingPreview}
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer text-white"
            title="Reload storefront preview iframe"
          >
            <RefreshCw size={13} className={isRefreshingPreview ? "animate-spin" : ""} />
            <span>Refresh Preview</span>
          </button>

          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-1.5 rounded-lg bg-[#d4af37] hover:bg-[#c29d2b] text-[#0d4f3c] text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
          >
            <span>Open Live Storefront</span>
            <ArrowUpRight size={14} />
          </a>
        </div>
      </div>

      {/* Main Studio Viewport: Split Layout or Fullscreen */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ================================================================= */}
        {/* LEFT / CENTER: INTERACTIVE PREVIEW VIEWPORT                       */}
        {/* ================================================================= */}
        <div
          className={`${
            isFullscreenPreview ? "lg:col-span-12" : "lg:col-span-7 xl:col-span-7"
          } space-y-3 transition-all duration-200`}
        >
          {/* Viewport Header Bar */}
          <div className="bg-white p-2.5 sm:px-4 rounded-xl border border-[#e5ddd3] shadow-xs flex flex-wrap items-center justify-between gap-3">
            {/* Device Switcher */}
            <div className="flex items-center bg-[#f0ebe3] p-1 rounded-lg">
              <button
                onClick={() => setDeviceMode("desktop")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  deviceMode === "desktop"
                    ? "bg-[#0d4f3c] text-white shadow-xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
                title="Desktop Viewport (100% responsive)"
              >
                <Monitor size={14} />
                <span className="hidden sm:inline">Desktop</span>
              </button>

              <button
                onClick={() => setDeviceMode("tablet")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  deviceMode === "tablet"
                    ? "bg-[#0d4f3c] text-white shadow-xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
                title="Tablet Portrait Viewport (768px)"
              >
                <Tablet size={14} />
                <span className="hidden sm:inline">Tablet</span>
              </button>

              <button
                onClick={() => setDeviceMode("mobile")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  deviceMode === "mobile"
                    ? "bg-[#0d4f3c] text-white shadow-xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
                title="Mobile Viewport (380px iPhone style)"
              >
                <Smartphone size={14} />
                <span className="hidden sm:inline">Mobile</span>
              </button>
            </div>

            {/* Click-to-Edit mode & Fullscreen toggles */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setIsClickToEditActive(!isClickToEditActive);
                  setPreviewKey(Date.now());
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border ${
                  isClickToEditActive
                    ? "bg-amber-100 text-amber-900 border-amber-400 font-bold"
                    : "bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-300"
                }`}
                title="Enable in-place visual click to edit inside the preview"
              >
                <Edit3 size={13} className={isClickToEditActive ? "text-amber-700" : ""} />
                <span>Visual Click-to-Edit: {isClickToEditActive ? "ON" : "OFF"}</span>
              </button>

              <button
                onClick={() => setIsFullscreenPreview(!isFullscreenPreview)}
                className="p-2 text-stone-600 hover:text-[#0d4f3c] hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                title={isFullscreenPreview ? "Exit Fullscreen Preview" : "Expand Fullscreen Preview"}
              >
                {isFullscreenPreview ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            </div>
          </div>

          {/* Actual Embedded Storefront Iframe Frame */}
          <div className="flex justify-center items-start bg-[#ece6de] p-3 sm:p-5 rounded-2xl border border-[#d6ccc2] min-h-[580px] overflow-hidden">
            <div className={getDeviceFrameStyles()}>
              {/* Mobile device speaker notch bar */}
              {deviceMode === "mobile" && (
                <div className="w-full bg-[#1e1b18] h-6 flex items-center justify-center">
                  <div className="w-20 h-3 bg-black rounded-full" />
                </div>
              )}

              <iframe
                ref={iframeRef}
                key={previewKey}
                src={previewUrl}
                title="House of Shriya Live Storefront Preview"
                className="w-full h-full bg-[#faf8f5] border-0"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-stone-500 px-1">
            <span className="flex items-center gap-1">
              <CheckCircle2 size={13} className="text-emerald-600" />
              <span>Preview rendered in real-time with zero HMR lag</span>
            </span>
            <span>URL: {window.location.origin}/</span>
          </div>
        </div>

        {/* ================================================================= */}
        {/* RIGHT: VISUAL STUDIO QUICK EDIT PANEL                             */}
        {/* ================================================================= */}
        {!isFullscreenPreview && (
          <div className="lg:col-span-5 xl:col-span-5 space-y-4">
            {/* Studio Navigation Tabs */}
            <div className="bg-white p-2 rounded-xl border border-[#e5ddd3] shadow-xs flex flex-wrap gap-1.5">
              <button
                onClick={() => setActiveStudioTab("banners")}
                className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeStudioTab === "banners"
                    ? "bg-[#0d4f3c] text-white shadow-xs"
                    : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"
                }`}
              >
                <ImageIcon size={14} />
                <span>Hero Banners ({heroSlides.length})</span>
              </button>

              <button
                onClick={() => setActiveStudioTab("products")}
                className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeStudioTab === "products"
                    ? "bg-[#0d4f3c] text-white shadow-xs"
                    : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"
                }`}
              >
                <Package size={14} />
                <span>Products & Photos ({products.length})</span>
              </button>

              <button
                onClick={() => setActiveStudioTab("cms")}
                className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeStudioTab === "cms"
                    ? "bg-[#0d4f3c] text-white shadow-xs"
                    : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"
                }`}
              >
                <FileText size={14} />
                <span>Site Text & CMS</span>
              </button>

              <button
                onClick={() => setActiveStudioTab("branding")}
                className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeStudioTab === "branding"
                    ? "bg-[#0d4f3c] text-white shadow-xs"
                    : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"
                }`}
              >
                <Palette size={14} />
                <span>Brand Colors</span>
              </button>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* SUB-PANEL 1: HERO BANNERS & SLIDESHOW                         */}
            {/* ------------------------------------------------------------- */}
            {activeStudioTab === "banners" && (
              <div className="bg-white rounded-xl border border-[#e5ddd3] p-4 sm:p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#f0ebe3]">
                  <div>
                    <h3 className="font-serif font-bold text-sm text-[#1e1b18]">
                      Hero Banner Slideshow Editor
                    </h3>
                    <p className="text-xs text-stone-500">
                      Slide ki photo badlo aur text edit karo — seedha preview me dikhega.
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-[#0d4f3c] bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                    Slide 0{selectedSlideIndex + 1} of 0{heroSlides.length}
                  </span>
                </div>

                {/* Slide Selector Carousel Tabs */}
                <div className="grid grid-cols-3 gap-2">
                  {heroSlides.map((slide, idx) => {
                    const isSelected = idx === selectedSlideIndex;
                    return (
                      <button
                        key={`slide-selector-${idx}`}
                        onClick={() => setSelectedSlideIndex(idx)}
                        className={`relative rounded-xl p-1.5 border-2 text-left transition-all cursor-pointer flex flex-col items-center gap-1.5 overflow-hidden ${
                          isSelected
                            ? "border-[#0d4f3c] bg-[#0d4f3c]/5 shadow-sm ring-2 ring-[#d4af37]"
                            : "border-[#e5ddd3] hover:border-stone-400 bg-white"
                        }`}
                      >
                        <div className="w-full h-16 rounded-lg bg-stone-100 overflow-hidden relative">
                          <img
                            src={slide.image}
                            alt={`Slide ${idx + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=600&q=80";
                            }}
                          />
                          <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] font-mono px-1 rounded font-bold">
                            0{idx + 1}
                          </span>
                        </div>
                        <span className="text-[11px] font-medium text-stone-800 line-clamp-1 text-center w-full">
                          {slide.title || `Slide 0${idx + 1}`}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Slide Image Preview & Upload Controls */}
                <div className="bg-[#faf8f5] p-3.5 rounded-xl border border-[#e5ddd3] space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                      <ImageIcon size={14} className="text-[#0d4f3c]" />
                      <span>Slide 0{selectedSlideIndex + 1} Banner Image</span>
                    </label>
                  </div>

                  <div className="relative w-full h-44 rounded-xl overflow-hidden border border-[#d6ccc2] bg-stone-900 group">
                    <img
                      src={currentSlide.image}
                      alt={currentSlide.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2 opacity-95 group-hover:opacity-100 transition-opacity p-4">
                      <input
                        type="file"
                        ref={bannerFileInputRef}
                        onChange={handleBannerPhotoUpload}
                        accept="image/*"
                        className="hidden"
                      />
                      <button
                        onClick={() => bannerFileInputRef.current?.click()}
                        disabled={isUploadingBannerPhoto}
                        className="px-4 py-2 bg-[#d4af37] hover:bg-[#c29d2b] text-[#0d4f3c] text-xs font-bold uppercase tracking-wider rounded-lg flex items-center gap-2 shadow-lg transition-transform active:scale-95 cursor-pointer"
                      >
                        <Upload size={14} />
                        <span>{isUploadingBannerPhoto ? "Compressing & Uploading..." : "Upload New Banner Photo"}</span>
                      </button>
                      <span className="text-[11px] text-white/90 text-center font-medium">
                        JPG, PNG, WebP — automatically optimized for fast boutique loading
                      </span>
                    </div>
                  </div>

                  {/* Or Paste Direct Image URL */}
                  <div>
                    <label className="text-[11px] font-medium text-stone-600 block mb-1">
                      Or Paste Image URL directly:
                    </label>
                    <input
                      type="text"
                      value={currentSlide.image}
                      onChange={(e) => handleSlideFieldChange("image", e.target.value)}
                      placeholder="https://... or /uploads/..."
                      className="w-full text-xs bg-white border border-[#d6ccc2] rounded-lg px-3 py-1.5 font-mono text-stone-800 focus:outline-none focus:border-[#0d4f3c]"
                    />
                  </div>
                </div>

                {/* Editable Text Fields for Slide */}
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Eyebrow Tag</label>
                    <input
                      type="text"
                      value={currentSlide.eyebrow}
                      onChange={(e) => handleSlideFieldChange("eyebrow", e.target.value)}
                      placeholder="e.g. NEW ARRIVAL / Contemporary Pret"
                      className="w-full bg-white border border-[#d6ccc2] rounded-lg px-3 py-1.5 text-stone-800 focus:outline-none focus:border-[#0d4f3c]"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Slide Heading / Title</label>
                    <input
                      type="text"
                      value={currentSlide.title}
                      onChange={(e) => handleSlideFieldChange("title", e.target.value)}
                      placeholder="e.g. Sage & Turquoise Handcrafted Kurti Set"
                      className="w-full bg-white border border-[#d6ccc2] rounded-lg px-3 py-1.5 font-serif text-sm font-semibold text-stone-900 focus:outline-none focus:border-[#0d4f3c]"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Slide Description</label>
                    <textarea
                      rows={3}
                      value={currentSlide.description}
                      onChange={(e) => handleSlideFieldChange("description", e.target.value)}
                      placeholder="Describe the fabric, resham work, and styling..."
                      className="w-full bg-white border border-[#d6ccc2] rounded-lg px-3 py-1.5 text-stone-800 focus:outline-none focus:border-[#0d4f3c]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-bold text-stone-700 block mb-1">Season Tag</label>
                      <input
                        type="text"
                        value={currentSlide.season}
                        onChange={(e) => handleSlideFieldChange("season", e.target.value)}
                        placeholder="e.g. SUMMER/FESTIVE 2026"
                        className="w-full bg-white border border-[#d6ccc2] rounded-lg px-3 py-1.5 text-stone-800 focus:outline-none focus:border-[#0d4f3c]"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-stone-700 block mb-1">Button CTA Text</label>
                      <input
                        type="text"
                        value={currentSlide.ctaText}
                        onChange={(e) => handleSlideFieldChange("ctaText", e.target.value)}
                        placeholder="e.g. Explore Collection"
                        className="w-full bg-white border border-[#d6ccc2] rounded-lg px-3 py-1.5 text-stone-800 focus:outline-none focus:border-[#0d4f3c]"
                      />
                    </div>
                  </div>
                </div>

                {/* Publish Button */}
                <button
                  onClick={handleSaveCurrentSlide}
                  disabled={isSavingBanner}
                  className="w-full py-2.5 bg-[#0d4f3c] hover:bg-[#09392b] text-white font-bold text-xs uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  <Save size={15} className="text-[#d4af37]" />
                  <span>{isSavingBanner ? "Publishing to Storefront..." : "Publish Slide Changes Live"}</span>
                </button>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* SUB-PANEL 2: PRODUCTS & PHOTO REPLACER                        */}
            {/* ------------------------------------------------------------- */}
            {activeStudioTab === "products" && (
              <div className="bg-white rounded-xl border border-[#e5ddd3] p-4 sm:p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#f0ebe3]">
                  <div>
                    <h3 className="font-serif font-bold text-sm text-[#1e1b18]">
                      Product Photos & Quick Edit
                    </h3>
                    <p className="text-xs text-stone-500">
                      Product select karein, new photo upload karein ya price update karein.
                    </p>
                  </div>
                  {onOpenProductModal && (
                    <button
                      onClick={onOpenProductModal}
                      className="px-2.5 py-1 bg-[#d4af37] text-[#0d4f3c] text-xs font-bold rounded-lg flex items-center gap-1 hover:bg-[#c29d2b] transition-colors cursor-pointer"
                    >
                      <Plus size={12} />
                      <span>Add Product</span>
                    </button>
                  )}
                </div>

                {/* Product Search & Category Filter */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-2 text-stone-400" />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Search product..."
                      className="w-full text-xs pl-8 pr-3 py-1.5 bg-[#faf8f5] border border-[#d6ccc2] rounded-lg text-stone-800 focus:outline-none focus:border-[#0d4f3c]"
                    />
                  </div>
                  <select
                    value={selectedProductCategory}
                    onChange={(e) => setSelectedProductCategory(e.target.value)}
                    className="text-xs bg-[#faf8f5] border border-[#d6ccc2] rounded-lg px-2 py-1.5 text-stone-800 focus:outline-none"
                  >
                    <option value="all">All Categories</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Horizontal Product Thumbnail Carousel */}
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {filteredProducts.slice(0, 15).map((p) => {
                    const isSel = p.id === activeProduct?.id;
                    return (
                      <button
                        key={`prod-chip-${p.id}`}
                        onClick={() => setSelectedProductId(p.id)}
                        className={`shrink-0 w-20 rounded-xl p-1 border text-left transition-all cursor-pointer ${
                          isSel
                            ? "border-[#0d4f3c] bg-[#0d4f3c]/5 ring-2 ring-[#d4af37]"
                            : "border-[#e5ddd3] hover:border-stone-400 bg-white"
                        }`}
                      >
                        <div className="w-full h-20 rounded-lg bg-stone-100 overflow-hidden relative mb-1">
                          <img
                            src={p.image}
                            alt={p.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=400&q=80";
                            }}
                          />
                        </div>
                        <span className="text-[10px] font-medium text-stone-800 line-clamp-1 block text-center">
                          {p.name}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Active Product Photo & Details Card */}
                {activeProduct && (
                  <div className="bg-[#faf8f5] p-3.5 rounded-xl border border-[#e5ddd3] space-y-3">
                    <div className="flex gap-3.5 items-start">
                      <div className="w-28 h-36 rounded-xl overflow-hidden border border-[#d6ccc2] bg-stone-900 shrink-0 relative group">
                        <img
                          src={activeProduct.image}
                          alt={activeProduct.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center p-2 opacity-90 group-hover:opacity-100 transition-opacity">
                          <input
                            type="file"
                            ref={productFileInputRef}
                            onChange={handleProductPhotoUpload}
                            accept="image/*"
                            className="hidden"
                          />
                          <button
                            onClick={() => productFileInputRef.current?.click()}
                            disabled={isUploadingProductPhoto}
                            className="px-2 py-1.5 bg-[#d4af37] text-[#0d4f3c] text-[10px] font-bold uppercase rounded flex items-center gap-1 shadow cursor-pointer text-center"
                          >
                            <Upload size={11} />
                            <span>{isUploadingProductPhoto ? "Uploading..." : "Replace Photo"}</span>
                          </button>
                        </div>
                      </div>

                      <div className="flex-1 space-y-2 text-xs">
                        <div>
                          <label className="font-bold text-stone-700 block">Product Name</label>
                          <input
                            type="text"
                            value={activeProduct.name}
                            onChange={(e) =>
                              setProducts((prev) =>
                                prev.map((p) => (p.id === activeProduct.id ? { ...p, name: e.target.value } : p))
                              )
                            }
                            className="w-full bg-white border border-[#d6ccc2] rounded-lg px-2.5 py-1 text-stone-900 font-semibold"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="font-bold text-stone-700 block">Price (₹)</label>
                            <input
                              type="text"
                              value={activeProduct.price}
                              onChange={(e) =>
                                setProducts((prev) =>
                                  prev.map((p) => (p.id === activeProduct.id ? { ...p, price: e.target.value } : p))
                                )
                              }
                              className="w-full bg-white border border-[#d6ccc2] rounded-lg px-2.5 py-1 font-bold text-[#0d4f3c]"
                            />
                          </div>
                          <div>
                            <label className="font-bold text-stone-700 block">Original (₹)</label>
                            <input
                              type="text"
                              value={activeProduct.originalPrice || ""}
                              onChange={(e) =>
                                setProducts((prev) =>
                                  prev.map((p) =>
                                    p.id === activeProduct.id ? { ...p, originalPrice: e.target.value } : p
                                  )
                                )
                              }
                              className="w-full bg-white border border-[#d6ccc2] rounded-lg px-2.5 py-1 text-stone-500 line-through"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="font-bold text-stone-700 block">Fabric Type</label>
                          <input
                            type="text"
                            value={activeProduct.fabricType || ""}
                            onChange={(e) =>
                              setProducts((prev) =>
                                prev.map((p) => (p.id === activeProduct.id ? { ...p, fabricType: e.target.value } : p))
                              )
                            }
                            placeholder="e.g. Pure Mulmul Chanderi Silk"
                            className="w-full bg-white border border-[#d6ccc2] rounded-lg px-2.5 py-1"
                          />
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <label className="flex items-center gap-2 cursor-pointer font-medium text-stone-700">
                            <input
                              type="checkbox"
                              checked={activeProduct.inStock !== false}
                              onChange={(e) =>
                                handleUpdateActiveProduct({ inStock: e.target.checked })
                              }
                              className="accent-[#0d4f3c] w-4 h-4 rounded"
                            />
                            <span>In Stock & Available to Buy</span>
                          </label>

                          <button
                            onClick={() => handleUpdateActiveProduct(activeProduct)}
                            disabled={isSavingProduct}
                            className="px-3 py-1 bg-[#0d4f3c] hover:bg-[#09392b] text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
                          >
                            <Save size={13} className="text-[#d4af37]" />
                            <span>Save Live</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* SUB-PANEL 3: SITE TEXT & CMS                                  */}
            {/* ------------------------------------------------------------- */}
            {activeStudioTab === "cms" && (
              <div className="bg-white rounded-xl border border-[#e5ddd3] p-4 sm:p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#f0ebe3]">
                  <div>
                    <h3 className="font-serif font-bold text-sm text-[#1e1b18]">
                      Site Announcement & Brand CMS
                    </h3>
                    <p className="text-xs text-stone-500">
                      Announcement bar, brand tagline aur contact details edit karein.
                    </p>
                  </div>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-stone-700">Top Announcement Bar Text</label>
                      <label className="flex items-center gap-1 text-[11px] text-stone-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cmsData.announcementVisible !== false}
                          onChange={(e) =>
                            setCmsData((prev) => ({ ...prev, announcementVisible: e.target.checked }))
                          }
                          className="accent-[#0d4f3c]"
                        />
                        <span>Visible</span>
                      </label>
                    </div>
                    <input
                      type="text"
                      value={cmsData.announcementText || ""}
                      onChange={(e) => setCmsData((prev) => ({ ...prev, announcementText: e.target.value }))}
                      placeholder="e.g. Festive Edit 2026 • Exclusive Unstitched Handlooms"
                      className="w-full bg-white border border-[#d6ccc2] rounded-lg px-3 py-1.5 text-stone-800 focus:outline-none focus:border-[#0d4f3c]"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Brand Tagline</label>
                    <input
                      type="text"
                      value={cmsData.brandTagline || ""}
                      onChange={(e) => setCmsData((prev) => ({ ...prev, brandTagline: e.target.value }))}
                      placeholder="e.g. Heirloom Indian Couture, Reimagined for the Modern Connoisseur"
                      className="w-full bg-white border border-[#d6ccc2] rounded-lg px-3 py-1.5 font-serif text-stone-900"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Brand Story & Description</label>
                    <textarea
                      rows={3}
                      value={cmsData.brandDescription || ""}
                      onChange={(e) => setCmsData((prev) => ({ ...prev, brandDescription: e.target.value }))}
                      className="w-full bg-white border border-[#d6ccc2] rounded-lg px-3 py-1.5 text-stone-800"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-bold text-stone-700 block mb-1">Phone / WhatsApp</label>
                      <input
                        type="text"
                        value={cmsData.contactPhone || ""}
                        onChange={(e) => setCmsData((prev) => ({ ...prev, contactPhone: e.target.value }))}
                        className="w-full bg-white border border-[#d6ccc2] rounded-lg px-3 py-1.5 text-stone-800"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-stone-700 block mb-1">Email</label>
                      <input
                        type="text"
                        value={cmsData.contactEmail || ""}
                        onChange={(e) => setCmsData((prev) => ({ ...prev, contactEmail: e.target.value }))}
                        className="w-full bg-white border border-[#d6ccc2] rounded-lg px-3 py-1.5 text-stone-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Atelier Physical Address</label>
                    <input
                      type="text"
                      value={cmsData.atelierAddress || ""}
                      onChange={(e) => setCmsData((prev) => ({ ...prev, atelierAddress: e.target.value }))}
                      className="w-full bg-white border border-[#d6ccc2] rounded-lg px-3 py-1.5 text-stone-800"
                    />
                  </div>

                  <button
                    onClick={handleSaveCms}
                    disabled={isSavingCms}
                    className="w-full py-2.5 bg-[#0d4f3c] hover:bg-[#09392b] text-white font-bold text-xs uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50 mt-2"
                  >
                    <Save size={15} className="text-[#d4af37]" />
                    <span>{isSavingCms ? "Publishing CMS..." : "Publish Website CMS Live"}</span>
                  </button>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* SUB-PANEL 4: BRAND COLORS & STYLING                           */}
            {/* ------------------------------------------------------------- */}
            {activeStudioTab === "branding" && (
              <div className="bg-white rounded-xl border border-[#e5ddd3] p-4 sm:p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#f0ebe3]">
                  <div>
                    <h3 className="font-serif font-bold text-sm text-[#1e1b18]">
                      Brand Colors & Atmosphere
                    </h3>
                    <p className="text-xs text-stone-500">
                      Boutique theme colors define the signature House of Shriya look.
                    </p>
                  </div>
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Primary Color (Royal Emerald)</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="w-10 h-10 rounded-lg border border-stone-300 cursor-pointer p-0.5"
                      />
                      <input
                        type="text"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="text-xs font-mono bg-[#faf8f5] border border-[#d6ccc2] rounded-lg px-3 py-2 flex-1"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Accent Color (Boutique Gold)</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        className="w-10 h-10 rounded-lg border border-stone-300 cursor-pointer p-0.5"
                      />
                      <input
                        type="text"
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        className="text-xs font-mono bg-[#faf8f5] border border-[#d6ccc2] rounded-lg px-3 py-2 flex-1"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleSaveBrand}
                    disabled={isSavingBrand}
                    className="w-full py-2.5 bg-[#0d4f3c] hover:bg-[#09392b] text-white font-bold text-xs uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50 mt-2"
                  >
                    <Save size={15} className="text-[#d4af37]" />
                    <span>{isSavingBrand ? "Applying Colors..." : "Publish Brand Colors Live"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
