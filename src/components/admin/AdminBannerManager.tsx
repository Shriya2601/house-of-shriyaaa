
import React, { useEffect, useRef, useState } from "react";
import {
  Upload,
  Image as ImageIcon,
  Save,
  RotateCcw,
  ExternalLink,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Eye,
  Sparkle,
  Crown,
  Plus,
  Trash2,
  Loader2,
} from "lucide-react";

import { useStore } from "../../context/StoreContext";
import { saveSiteContent, withTimeout } from "../../services/storeService";
import { uploadImageToAdminStorage, registerLocalImageCache } from "../../services/adminUploadService";
import { HeroSlide } from "../../types";
import { normalizeImageUrl } from "../../utils/imageUtils";

/* -------------------------------------------------------------------------- */
/* DEFAULT SLIDES                                                            */
/* -------------------------------------------------------------------------- */

const DEFAULT_SLIDES: HeroSlide[] = [
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
    image: "https://kommodo.ai/i/OSeP8KXZKOwa1kTFdvK2",
    season: "ROYAL HERITAGE 2026",
    caption: "Pastels • Delicate Embroidery • Effortless Grace",
    mood: "Antique Zari & Handlooms",
    ctaText: "Discover Unstitched",
    ctaTarget: "catalog-section",
  },

  {
    eyebrow: "Daily Chic",
    number: "03",
    collection:
      "Muted pistachio tones and hand-painted watercolor florals",
    title: "Grace in Every Print",
    description:
      "PURE MUL CHANDERI JACOARD WITH HANDWORK WITH ORGANZA EMBROIDERY FOR SLEEVES AND CONTRAST PIPING WITH LACE ON DAMAN.",
    image:
      "https://plain-apac-prod-public.komododecks.com/202609/05/4UmFSGtcoZdZF37bKc3R/image.jpg",
    season: "DAILY CHIC 2026",
    caption: "Printed Organza Dupatta Set in Sage & Pastel Rose",
    mood: "Pastel Silks & Easy Linens",
    ctaText: "Shop Daily Chic",
    ctaTarget: "catalog-section",
  },
];

/* -------------------------------------------------------------------------- */
/* TYPES                                                                     */
/* -------------------------------------------------------------------------- */

interface AdminBannerManagerProps {
  showToast: (
    msg: string,
    type?: "success" | "error" | "info"
  ) => void;
}

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                   */
/* -------------------------------------------------------------------------- */

const getSlideNumber = (index: number) =>
  String(index + 1).padStart(2, "0");

const cloneDefaults = (): HeroSlide[] =>
  DEFAULT_SLIDES.map((slide) => ({ ...slide }));

const mergeSlides = (incoming: HeroSlide[]): HeroSlide[] => {
  return incoming.map((slide, index) => ({
    ...DEFAULT_SLIDES[index % DEFAULT_SLIDES.length],
    ...slide,
    number: slide.number || getSlideNumber(index),
  }));
};

/* -------------------------------------------------------------------------- */
/* COMPONENT                                                                  */
/* -------------------------------------------------------------------------- */

export default function AdminBannerManager({
  showToast,
}: AdminBannerManagerProps) {
  const { siteContent, setSiteContent } = useStore();

  const [slides, setSlides] = useState<HeroSlide[]>(() => {
    if (
      siteContent?.heroSlides &&
      Array.isArray(siteContent.heroSlides) &&
      siteContent.heroSlides.length > 0
    ) {
      return mergeSlides(siteContent.heroSlides);
    }

    return cloneDefaults();
  });

  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(
    null
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const [autoSaveStatus, setAutoSaveStatus] = useState<
    "saved" | "saving" | "unsaved"
  >("saved");

  const slidesRef = useRef<HeroSlide[]>(slides);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const isDirtyRef = useRef(false);
  const saveInProgressRef = useRef(false);

  slidesRef.current = slides;

  const currentSlide =
    slides[activeSlideIndex] || slides[0] || DEFAULT_SLIDES[0];

  /* ------------------------------------------------------------------------ */
  /* CLEANUP                                                                  */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  /* ------------------------------------------------------------------------ */
  /* STORE -> ADMIN SYNC                                                      */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (isDirtyRef.current) return;
    if (uploadingIndex !== null) return;
    if (saveInProgressRef.current) return;

    if (
      siteContent?.heroSlides &&
      Array.isArray(siteContent.heroSlides) &&
      siteContent.heroSlides.length > 0
    ) {
      const incomingSlides = mergeSlides(siteContent.heroSlides);

      setSlides((previous) => {
        if (
          JSON.stringify(previous) !== JSON.stringify(incomingSlides)
        ) {
          slidesRef.current = incomingSlides;
          return incomingSlides;
        }

        return previous;
      });
    }
  }, [siteContent, uploadingIndex]);

  /* ------------------------------------------------------------------------ */
  /* LIVE CROSS-TAB / CROSS-DEVICE SYNC                                      */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    const handleLiveSync = (event: Event) => {
      if (isDirtyRef.current) return;
      if (uploadingIndex !== null) return;
      if (saveInProgressRef.current) return;

      const customEvent = event as CustomEvent;

      const updatedContent = customEvent.detail;

      if (
        !updatedContent?.heroSlides ||
        !Array.isArray(updatedContent.heroSlides) ||
        updatedContent.heroSlides.length === 0
      ) {
        return;
      }

      const incomingSlides = mergeSlides(
        updatedContent.heroSlides
      );

      setSlides((previous) => {
        if (
          JSON.stringify(previous) !==
          JSON.stringify(incomingSlides)
        ) {
          slidesRef.current = incomingSlides;
          return incomingSlides;
        }

        return previous;
      });
    };

    window.addEventListener(
      "hos-content-updated",
      handleLiveSync
    );

    return () => {
      window.removeEventListener(
        "hos-content-updated",
        handleLiveSync
      );
    };
  }, [uploadingIndex]);

  /* ------------------------------------------------------------------------ */
  /* CANCEL AUTOSAVE                                                          */
  /* ------------------------------------------------------------------------ */

  const cancelPendingAutoSave = () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
  };

  /* ------------------------------------------------------------------------ */
  /* SAVE SLIDES                                                              */
  /* ------------------------------------------------------------------------ */

  const persistSlides = async (
    slidesToSave: HeroSlide[],
    successMessage?: string
  ) => {
    const cleanSlides = slidesToSave.map((slide, index) => ({
      ...slide,
      number: getSlideNumber(index),
      image: slide.image || "",
    }));

    slidesRef.current = cleanSlides;
    setSlides(cleanSlides);

    saveInProgressRef.current = true;
    setAutoSaveStatus("saving");

    try {
      const savedContent = await saveSiteContent({
        heroSlides: cleanSlides,
      });

      /*
       * Important:
       * Keep the locally edited slides authoritative.
       * This prevents an older store response from putting an old
       * image back into the admin editor.
       */
      setSiteContent((previous) => ({
        ...previous,
        ...(savedContent || {}),
        heroSlides: cleanSlides,
      }));

      slidesRef.current = cleanSlides;
      setSlides(cleanSlides);

      isDirtyRef.current = false;
      setIsDirty(false);
      setAutoSaveStatus("saved");

      if (successMessage) {
        showToast(successMessage, "success");
      }

      return true;
    } catch (error) {
      console.error("Hero banner save error:", error);

      setAutoSaveStatus("unsaved");
      isDirtyRef.current = true;
      setIsDirty(true);

      throw error;
    } finally {
      saveInProgressRef.current = false;
    }
  };

  /* ------------------------------------------------------------------------ */
  /* SELECT SLIDE                                                             */
  /* ------------------------------------------------------------------------ */

  const handleSelectSlide = async (targetIndex: number) => {
    if (
      targetIndex < 0 ||
      targetIndex >= slidesRef.current.length
    ) {
      return;
    }

    if (targetIndex === activeSlideIndex) {
      return;
    }

    /*
     * Do not allow a pending text save to race with slide switching.
     */
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    if (isDirtyRef.current) {
      try {
        await persistSlides(slidesRef.current);
      } catch {
        showToast(
          "Your latest changes could not be saved. Please try again.",
          "error"
        );
        return;
      }
    }

    setActiveSlideIndex(targetIndex);
  };

  /* ------------------------------------------------------------------------ */
  /* FIELD CHANGE                                                             */
  /* ------------------------------------------------------------------------ */

  const handleFieldChange = (
    field: keyof HeroSlide,
    value: string
  ) => {
    const targetIndex = activeSlideIndex;

    const nextSlides = slidesRef.current.map((slide, index) =>
      index === targetIndex
        ? {
            ...slide,
            [field]: value,
          }
        : slide
    );

    slidesRef.current = nextSlides;
    setSlides(nextSlides);

    /*
     * Update the store immediately so the storefront preview can
     * react without waiting for the database.
     */
    setSiteContent((previous) => ({
      ...previous,
      heroSlides: nextSlides,
    }));

    isDirtyRef.current = true;
    setIsDirty(true);
    setAutoSaveStatus("unsaved");

    cancelPendingAutoSave();

    autoSaveTimerRef.current = setTimeout(async () => {
      autoSaveTimerRef.current = null;

      try {
        await persistSlides(slidesRef.current);
      } catch (error) {
        console.error("Hero auto-save error:", error);
      }
    }, 900);
  };

  /* ------------------------------------------------------------------------ */
  /* ADD SLIDE                                                                */
  /* ------------------------------------------------------------------------ */

  const handleAddSlide = async () => {
    cancelPendingAutoSave();

    const currentSlides = slidesRef.current;

    const newIndex = currentSlides.length;

    const newSlide: HeroSlide = {
      eyebrow: "NEW COLLECTION",
      number: getSlideNumber(newIndex),
      collection: "The Shriya Edit",
      title: "Handcrafted Luxury Ensemble",
      description:
        "Handcrafted pure fabric unstitched ensemble tailored for royal celebrations.",
      image:
        "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1600&q=85",
      season: "FESTIVE 2026",
      caption: "Bespoke Indian Couture Ensemble",
      mood: "Artisanal Weaves & Silks",
      ctaText: "Explore Collection",
      ctaTarget: "catalog-section",
    };

    const nextSlides = [...currentSlides, newSlide];

    setSlides(nextSlides);
    slidesRef.current = nextSlides;

    setActiveSlideIndex(newIndex);

    setSiteContent((previous) => ({
      ...previous,
      heroSlides: nextSlides,
    }));

    try {
      await persistSlides(
        nextSlides,
        `Added Slide ${getSlideNumber(newIndex)} and published live!`
      );
    } catch {
      showToast(
        `Slide ${getSlideNumber(newIndex)} was added locally, but could not be published.`,
        "error"
      );
    }
  };

  /* ------------------------------------------------------------------------ */
  /* DELETE SLIDE                                                             */
  /* ------------------------------------------------------------------------ */

  const handleDeleteSlide = async (
    indexToDelete: number,
    event: React.MouseEvent
  ) => {
    event.stopPropagation();

    const currentSlides = slidesRef.current;

    if (currentSlides.length <= 1) {
      showToast(
        "You must keep at least one homepage banner.",
        "error"
      );
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete Slide ${getSlideNumber(
        indexToDelete
      )}?`
    );

    if (!confirmed) return;

    cancelPendingAutoSave();

    const nextSlides = currentSlides
      .filter((_, index) => index !== indexToDelete)
      .map((slide, index) => ({
        ...slide,
        number: getSlideNumber(index),
      }));

    let nextActiveIndex = activeSlideIndex;

    if (indexToDelete < activeSlideIndex) {
      nextActiveIndex = activeSlideIndex - 1;
    } else if (
      indexToDelete === activeSlideIndex &&
      activeSlideIndex >= nextSlides.length
    ) {
      nextActiveIndex = nextSlides.length - 1;
    }

    setSlides(nextSlides);
    slidesRef.current = nextSlides;
    setActiveSlideIndex(nextActiveIndex);

    setSiteContent((previous) => ({
      ...previous,
      heroSlides: nextSlides,
    }));

    try {
      await persistSlides(
        nextSlides,
        `Deleted Slide ${getSlideNumber(indexToDelete)} and updated the live website.`
      );
    } catch {
      showToast(
        "Slide deleted locally, but publishing failed.",
        "error"
      );
    }
  };

  /* ------------------------------------------------------------------------ */
  /* MOVE / REORDER                                                           */
  /* ------------------------------------------------------------------------ */

  const handleMoveSlide = async (
    fromIndex: number,
    toIndex: number,
    event?: React.MouseEvent
  ) => {
    event?.stopPropagation();

    const currentSlides = slidesRef.current;

    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= currentSlides.length ||
      toIndex >= currentSlides.length ||
      fromIndex === toIndex
    ) {
      return;
    }

    cancelPendingAutoSave();

    const reordered = [...currentSlides];

    const [movedSlide] = reordered.splice(fromIndex, 1);

    if (!movedSlide) return;

    reordered.splice(toIndex, 0, movedSlide);

    const nextSlides = reordered.map((slide, index) => ({
      ...slide,
      number: getSlideNumber(index),
    }));

    setSlides(nextSlides);
    slidesRef.current = nextSlides;
    setActiveSlideIndex(toIndex);

    setSiteContent((previous) => ({
      ...previous,
      heroSlides: nextSlides,
    }));

    try {
      await persistSlides(
        nextSlides,
        "Banner order updated and published live."
      );
    } catch {
      showToast(
        "Banner order changed locally, but publishing failed.",
        "error"
      );
    }
  };

  /* ------------------------------------------------------------------------ */
  /* IMAGE COMPRESSION                                                        */
  /* ------------------------------------------------------------------------ */

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        const result = event.target?.result;

        if (!result) {
          reject(new Error("Could not read image."));
          return;
        }

        const img = new Image();

        img.onload = () => {
          try {
            const MAX_DIMENSION = 1400;

            let width = img.width;
            let height = img.height;

            if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
              if (width >= height) {
                height = Math.round(
                  (height * MAX_DIMENSION) / width
                );
                width = MAX_DIMENSION;
              } else {
                width = Math.round(
                  (width * MAX_DIMENSION) / height
                );
                height = MAX_DIMENSION;
              }
            }

            const canvas = document.createElement("canvas");

            canvas.width = width;
            canvas.height = height;

            const context = canvas.getContext("2d");

            if (!context) {
              resolve(result as string);
              return;
            }

            context.imageSmoothingEnabled = true;
            context.imageSmoothingQuality = "high";

            context.drawImage(
              img,
              0,
              0,
              width,
              height
            );

            let compressed = canvas.toDataURL("image/webp", 0.82);
            if (!compressed.startsWith("data:image/webp")) {
              compressed = canvas.toDataURL("image/jpeg", 0.82);
            }

            resolve(compressed);
          } catch {
            resolve(result as string);
          }
        };

        img.onerror = () => {
          resolve(result as string);
        };

        img.src = result as string;
      };

      reader.onerror = () => {
        reject(new Error("Unable to read image file."));
      };

      reader.readAsDataURL(file);
    });
  };

  /* ------------------------------------------------------------------------ */
  /* IMAGE UPLOAD                                                             */
  /* ------------------------------------------------------------------------ */

  const processAndUploadFile = async (file: File) => {
    console.log(
      `%c[AdminPortal:BannerManager] %c🎨 [Banner Photo Selected] %c${file.name} (${file.size} bytes, ${file.type}) for Slide #${activeSlideIndex + 1}`,
      "color: #4338ca; font-weight: bold;",
      "background: #4338ca; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: bold;",
      "color: #1e293b; font-weight: 600;"
    );

    const isImage =
      file.type.startsWith("image/") ||
      /\.(jpe?g|png|webp|gif|avif|bmp|svg)$/i.test(
        file.name
      );

    if (!isImage) {
      console.warn(`[AdminPortal:BannerManager] Invalid file format rejected: ${file.name}`);
      showToast(
        "Please upload a valid image file such as JPG, PNG or WebP.",
        "error"
      );
      return;
    }

    const targetIndex = activeSlideIndex;

    setUploadingIndex(targetIndex);
    setAutoSaveStatus("saving");

    cancelPendingAutoSave();

    try {
      /*
       * Step 1:
       * Compress locally so the admin preview changes immediately.
       */
      const compressedDataUrl = await compressImage(file);

      registerLocalImageCache(compressedDataUrl, compressedDataUrl);

      const previewSlides = slidesRef.current.map(
        (slide, index) =>
          index === targetIndex
            ? {
                ...slide,
                image: compressedDataUrl,
              }
            : slide
      );

      slidesRef.current = previewSlides;
      setSlides(previewSlides);

      setSiteContent((previous) => ({
        ...previous,
        heroSlides: previewSlides,
      }));

      /*
       * Step 2:
       * Upload directly to production persistent storage engine.
       */
      let finalImageUrl = compressedDataUrl;

      try {
        finalImageUrl = await uploadImageToAdminStorage(compressedDataUrl, {
          slot: `hero-slide-${targetIndex + 1}`,
        });
        if (finalImageUrl) {
          registerLocalImageCache(finalImageUrl, compressedDataUrl);
        }
        console.log(
          `%c[AdminPortal:BannerManager] %c✅ [Banner Upload Succeeded] %cResolved URL: ${finalImageUrl}`,
          "color: #4338ca; font-weight: bold;",
          "background: #16a34a; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: bold;",
          "color: #15803d; font-weight: 600;"
        );
      } catch (uploadError) {
        console.warn("[Production Upload Note]", uploadError);
      }

      /*
       * Step 3:
       * Build the final list from the CURRENT ref.
       *
       * This is important because we do not want an old state value
       * to overwrite the newly uploaded photo.
       */
      const finalSlides = slidesRef.current.map(
        (slide, index) =>
          index === targetIndex
            ? {
                ...slide,
                image: finalImageUrl,
              }
            : slide
      );

      slidesRef.current = finalSlides;
      setSlides(finalSlides);

      setSiteContent((previous) => ({
        ...previous,
        heroSlides: finalSlides,
      }));

      /*
       * Step 4:
       * Persist immediately.
       */
      await persistSlides(
        finalSlides,
        `Slide ${getSlideNumber(
          targetIndex
        )} photo uploaded and published live!`
      );
    } catch (error) {
      console.error("Banner image upload error:", error);

      setAutoSaveStatus("unsaved");
      isDirtyRef.current = true;
      setIsDirty(true);

      showToast(
        "The image could not be published. Please try again.",
        "error"
      );
    } finally {
      setUploadingIndex(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  /* ------------------------------------------------------------------------ */
  /* FILE INPUT                                                               */
  /* ------------------------------------------------------------------------ */

  const handleImageFileSelected = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      void processAndUploadFile(file);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* DRAG & DROP                                                              */
  /* ------------------------------------------------------------------------ */

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];

    if (file) {
      void processAndUploadFile(file);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* PUBLISH ALL                                                              */
  /* ------------------------------------------------------------------------ */

  const handleSaveAll = async () => {
    cancelPendingAutoSave();

    if (saveInProgressRef.current) {
      return;
    }

    setIsSaving(true);
    setAutoSaveStatus("saving");

    try {
      const finalSlides = slidesRef.current.map(
        (slide, index) => ({
          ...slide,
          number: getSlideNumber(index),
          image: slide.image || "",
        })
      );

      await persistSlides(
        finalSlides,
        "Homepage Hero Slideshow updated successfully and published live."
      );
    } catch (error: any) {
      console.error("Publish banners error:", error);

      showToast(
        "Failed to publish banners: " +
          (error?.message || "Please try again."),
        "error"
      );
    } finally {
      setIsSaving(false);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* RESET DEFAULTS                                                           */
  /* ------------------------------------------------------------------------ */

  const handleResetDefaults = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to reset all homepage banners to the original curated defaults?"
    );

    if (!confirmed) {
      return;
    }

    cancelPendingAutoSave();

    const defaultSlides = cloneDefaults();

    setSlides(defaultSlides);
    slidesRef.current = defaultSlides;
    setActiveSlideIndex(0);

    setSiteContent((previous) => ({
      ...previous,
      heroSlides: defaultSlides,
    }));

    setIsSaving(true);
    setAutoSaveStatus("saving");

    try {
      await persistSlides(
        defaultSlides,
        "Homepage banners restored to the original curated defaults."
      );
    } catch (error: any) {
      showToast(
        "Failed to reset banners: " +
          (error?.message || "Please try again."),
        "error"
      );
    } finally {
      setIsSaving(false);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* IMAGE FALLBACK                                                           */
  /* ------------------------------------------------------------------------ */

  const fallbackImage =
    "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=1200&q=85";

  /* ------------------------------------------------------------------------ */
  /* RENDER                                                                   */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* HIDDEN FILE INPUT                                                  */}
      {/* ------------------------------------------------------------------ */}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageFileSelected}
      />

      {/* ------------------------------------------------------------------ */}
      {/* HEADER                                                             */}
      {/* ------------------------------------------------------------------ */}

      <div className="bg-white rounded-xl border border-[#e5ddd3] p-5 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-[#0d4f3c]/10 text-[#0d4f3c] rounded-lg">
              <ImageIcon size={18} />
            </span>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-serif font-bold text-lg text-[#1e1b18]">
                  Homepage Hero Slideshow & Banners
                </h2>

                {autoSaveStatus === "saving" || isSaving ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-300">
                    <Loader2
                      size={11}
                      className="animate-spin"
                    />
                    Saving live...
                  </span>
                ) : isDirty ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                    <AlertCircle size={11} />
                    Saving shortly...
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
                    <CheckCircle2 size={11} />
                    Live & Saved
                  </span>
                )}
              </div>

              <p className="text-xs text-stone-500">
                Manage the rotating banner images and headlines displayed
                on the House of Shriya storefront.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 text-xs font-medium text-stone-700 hover:text-[#0d4f3c] hover:bg-stone-100 rounded-lg border border-stone-200 transition-colors flex items-center gap-1.5"
          >
            <Eye size={14} />
            <span>View Storefront</span>
            <ExternalLink
              size={12}
              className="opacity-60"
            />
          </a>

          <button
            type="button"
            onClick={handleResetDefaults}
            disabled={isSaving || uploadingIndex !== null}
            className="px-3 py-2 text-xs font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg border border-stone-200 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RotateCcw size={13} />
            <span>Reset Defaults</span>
          </button>

          <button
            type="button"
            onClick={handleSaveAll}
            disabled={isSaving || uploadingIndex !== null}
            className={`px-4 py-2 text-white text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
              isDirty
                ? "bg-[#0d4f3c] hover:bg-[#0b3f30] ring-2 ring-emerald-400 ring-offset-1 animate-pulse"
                : "bg-[#0d4f3c] hover:bg-[#0b3f30]"
            }`}
          >
            {isSaving ? (
              <Loader2
                size={14}
                className="animate-spin"
              />
            ) : (
              <Save size={14} />
            )}

            <span>
              {isSaving
                ? "Publishing..."
                : "Publish Banners"}
            </span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* SLIDE TABS                                                         */}
      {/* ------------------------------------------------------------------ */}

      <div className="flex flex-wrap items-center gap-3">
        {slides.map((slide, index) => {
          const isActive = activeSlideIndex === index;

          return (
            <div
              key={`slide-${index}-${slide.number}`}
              onClick={() => {
                void handleSelectSlide(index);
              }}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 flex-1 min-w-[220px] max-w-[340px] relative group ${
                isActive
                  ? "bg-[#0d4f3c]/5 border-[#0d4f3c] shadow-xs"
                  : "bg-white border-stone-200 hover:border-stone-300"
              }`}
            >
              <div className="relative w-14 h-11 rounded-md overflow-hidden bg-stone-100 shrink-0 border border-stone-200">
                <img
                  src={normalizeImageUrl(slide.image)}
                  alt={slide.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={(event) => {
                    const target =
                      event.currentTarget;

                    if (target.src !== fallbackImage) {
                      target.src = fallbackImage;
                    }
                  }}
                />

                <span className="absolute bottom-0.5 right-0.5 bg-black/70 text-white font-mono text-[9px] px-1 rounded font-bold">
                  #{index + 1}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider ${
                        isActive
                          ? "text-[#0d4f3c]"
                          : "text-stone-500"
                      }`}
                    >
                      Slide {getSlideNumber(index)}
                    </span>

                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#0d4f3c] animate-pulse" />
                    )}
                  </div>

                  <div
                    className="flex items-center gap-0.5"
                    onClick={(event) =>
                      event.stopPropagation()
                    }
                  >
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={(event) =>
                        void handleMoveSlide(
                          index,
                          index - 1,
                          event
                        )
                      }
                      title="Move slide left"
                      className="p-1 rounded text-stone-400 hover:text-stone-700 hover:bg-stone-100 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                    >
                      <ChevronLeft size={13} />
                    </button>

                    <button
                      type="button"
                      disabled={
                        index === slides.length - 1
                      }
                      onClick={(event) =>
                        void handleMoveSlide(
                          index,
                          index + 1,
                          event
                        )
                      }
                      title="Move slide right"
                      className="p-1 rounded text-stone-400 hover:text-stone-700 hover:bg-stone-100 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                    >
                      <ChevronRight size={13} />
                    </button>

                    {slides.length > 1 && (
                      <button
                        type="button"
                        onClick={(event) =>
                          void handleDeleteSlide(
                            index,
                            event
                          )
                        }
                        title="Delete slide"
                        className="p-1 rounded text-stone-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs font-semibold text-stone-800 truncate">
                  {slide.title || "Untitled Banner"}
                </p>

                <p className="text-[11px] text-stone-500 truncate">
                  {slide.collection ||
                    slide.eyebrow ||
                    "Homepage Banner"}
                </p>
              </div>
            </div>
          );
        })}

        {/* Add Slide */}
        <button
          type="button"
          onClick={() => {
            void handleAddSlide();
          }}
          disabled={isSaving || uploadingIndex !== null}
          className="p-3 rounded-xl border border-dashed border-stone-300 hover:border-[#0d4f3c] hover:bg-[#0d4f3c]/5 text-stone-500 hover:text-[#0d4f3c] transition-all flex items-center justify-center gap-2 text-xs font-medium cursor-pointer h-16 min-w-[130px] disabled:opacity-50"
        >
          <Plus size={15} />
          <span>Add Slide</span>
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* MAIN EDITOR                                                        */}
      {/* ------------------------------------------------------------------ */}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ---------------------------------------------------------------- */}
        {/* PREVIEW                                                          */}
        {/* ---------------------------------------------------------------- */}

        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-xl border border-[#e5ddd3] p-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-3">
              <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                <Sparkles
                  size={13}
                  className="text-[#0d4f3c]"
                />
                <span>
                  Live Hero Preview (
                  {getSlideNumber(activeSlideIndex)})
                </span>
              </span>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    const previous =
                      activeSlideIndex > 0
                        ? activeSlideIndex - 1
                        : slides.length - 1;

                    void handleSelectSlide(previous);
                  }}
                  className="p-1 rounded hover:bg-stone-100 text-stone-600 transition-colors"
                  title="Previous Slide"
                >
                  <ChevronLeft size={16} />
                </button>

                <span className="text-[11px] font-mono font-semibold text-stone-600 px-1">
                  {getSlideNumber(activeSlideIndex)} /{" "}
                  {getSlideNumber(slides.length)}
                </span>

                <button
                  type="button"
                  onClick={() => {
                    const next =
                      activeSlideIndex <
                      slides.length - 1
                        ? activeSlideIndex + 1
                        : 0;

                    void handleSelectSlide(next);
                  }}
                  className="p-1 rounded hover:bg-stone-100 text-stone-600 transition-colors"
                  title="Next Slide"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Preview / Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() =>
                fileInputRef.current?.click()
              }
              className={`relative rounded-lg overflow-hidden bg-stone-950 aspect-[4/5] shadow-md group cursor-pointer transition-all ${
                isDragging
                  ? "ring-4 ring-emerald-500 ring-offset-2 scale-[1.01]"
                  : "hover:ring-2 hover:ring-stone-400"
              }`}
            >
              <img
                key={`preview_slide_${activeSlideIndex}_${currentSlide.image}`}
                src={normalizeImageUrl(currentSlide.image)}
                alt={currentSlide.title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                referrerPolicy="no-referrer"
                onError={(event) => {
                  const target =
                    event.currentTarget;

                  if (target.src !== fallbackImage) {
                    target.src = fallbackImage;
                  }
                }}
              />

              {/* Drag Overlay */}
              {isDragging && (
                <div className="absolute inset-0 bg-[#0d4f3c]/90 backdrop-blur-xs flex flex-col items-center justify-center text-white z-20">
                  <Upload
                    size={36}
                    className="animate-bounce mb-2"
                  />

                  <p className="font-serif font-bold text-base">
                    Drop photo to upload
                  </p>

                  <p className="text-xs text-stone-200">
                    Release to publish the new banner
                  </p>
                </div>
              )}

              {/* Uploading Overlay */}
              {uploadingIndex === activeSlideIndex && (
                <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex flex-col items-center justify-center text-white z-20">
                  <Loader2
                    size={34}
                    className="animate-spin mb-2"
                  />

                  <p className="text-xs font-semibold">
                    Processing & publishing photo...
                  </p>
                </div>
              )}

              {/* Hover Upload Hint */}
              {uploadingIndex === null && (
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10 pointer-events-none">
                  <span className="px-3.5 py-2 bg-white/95 text-stone-900 rounded-lg text-xs font-bold shadow-lg flex items-center gap-1.5 backdrop-blur-xs">
                    <Upload
                      size={14}
                      className="text-[#0d4f3c]"
                    />
                    <span>
                      Click or Drag photo to replace
                    </span>
                  </span>
                </div>
              )}

              {/* Gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/40 to-transparent pointer-events-none" />

              {/* Season */}
              <div className="absolute top-3 left-3 bg-[#0d4f3c]/90 backdrop-blur-xs text-white text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full shadow-xs pointer-events-none">
                {currentSlide.season || "FESTIVE 2026"}
              </div>

              {/* Content */}
              <div className="absolute bottom-0 left-0 right-0 p-4 text-white space-y-1.5">
                <div className="flex items-center gap-1 text-[11px] text-amber-200 font-medium">
                  <Sparkle size={11} />
                  <span>{currentSlide.eyebrow}</span>
                </div>

                <p className="text-[11px] uppercase tracking-widest text-stone-300 font-mono">
                  {currentSlide.collection}
                </p>

                <h4 className="font-serif font-bold text-base text-white leading-tight line-clamp-2">
                  {currentSlide.title}
                </h4>

                {currentSlide.caption && (
                  <p className="text-[11px] text-amber-200/90 font-medium line-clamp-1">
                    ✦ {currentSlide.caption}
                  </p>
                )}

                <p className="text-xs text-stone-300 line-clamp-2 leading-relaxed">
                  {currentSlide.description}
                </p>

                <div className="pt-2 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 text-[10px] bg-white text-stone-900 font-bold px-3 py-1 rounded-full shadow-xs">
                    {currentSlide.ctaText ||
                      "Explore Collection"}{" "}
                    →
                  </span>

                  <span className="text-[10px] text-stone-400 font-mono truncate">
                    ✦{" "}
                    {currentSlide.mood ||
                      "Handloom Silks"}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Upload */}
            <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between">
              <span className="text-[11px] text-stone-500">
                Need to change this photo?
              </span>

              <button
                type="button"
                onClick={() =>
                  fileInputRef.current?.click()
                }
                disabled={uploadingIndex !== null}
                className="px-3 py-1.5 bg-stone-900 hover:bg-[#0d4f3c] text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Upload size={13} />

                <span>
                  {uploadingIndex === activeSlideIndex
                    ? "Uploading..."
                    : "Upload Photo"}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* SETTINGS                                                         */}
        {/* ---------------------------------------------------------------- */}

        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-xl border border-[#e5ddd3] p-5 shadow-xs space-y-4">
            {/* Editor Header */}
            <div className="flex items-center justify-between border-b border-stone-100 pb-3 gap-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#0d4f3c] text-white text-xs font-bold flex items-center justify-center font-mono">
                  {getSlideNumber(activeSlideIndex)}
                </span>

                <h3 className="font-serif font-bold text-base text-[#1e1b18]">
                  Edit Slide{" "}
                  {getSlideNumber(activeSlideIndex)}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                {activeSlideIndex > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      void handleMoveSlide(
                        activeSlideIndex,
                        0
                      )
                    }
                    disabled={
                      isSaving ||
                      uploadingIndex !== null
                    }
                    className="text-xs font-semibold text-[#0d4f3c] bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-md transition-colors border border-emerald-200 cursor-pointer flex items-center gap-1 disabled:opacity-50"
                    title="Move this slide to the first position"
                  >
                    <Crown size={12} />
                    <span>Set as Slide #1</span>
                  </button>
                )}

                <span className="hidden sm:inline text-xs text-stone-400 font-mono">
                  ID: #{currentSlide.number}
                </span>
              </div>
            </div>

            {/* ------------------------------------------------------------ */}
            {/* IMAGE                                                         */}
            {/* ------------------------------------------------------------ */}

            <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-3">
              <label className="block text-xs font-bold text-stone-800">
                Banner Image
              </label>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="w-20 h-14 rounded-lg overflow-hidden bg-stone-200 border border-stone-300 shrink-0">
                  <img
                    key={`thumb_slide_${activeSlideIndex}_${currentSlide.image}`}
                    src={normalizeImageUrl(
                      currentSlide.image
                    )}
                    alt="Banner preview"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(event) => {
                      const target =
                        event.currentTarget;

                      if (
                        target.src !== fallbackImage
                      ) {
                        target.src = fallbackImage;
                      }
                    }}
                  />
                </div>

                <div className="flex-1 w-full space-y-2">
                  <button
                    type="button"
                    onClick={() =>
                      fileInputRef.current?.click()
                    }
                    disabled={
                      uploadingIndex !== null
                    }
                    className="px-3.5 py-2 bg-[#0d4f3c] hover:bg-[#0b3f30] text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {uploadingIndex ===
                    activeSlideIndex ? (
                      <Loader2
                        size={14}
                        className="animate-spin"
                      />
                    ) : (
                      <Upload size={14} />
                    )}

                    <span>
                      {uploadingIndex ===
                      activeSlideIndex
                        ? "Uploading..."
                        : "Upload from Device / Gallery"}
                    </span>
                  </button>

                  <input
                    type="text"
                    value={currentSlide.image || ""}
                    onChange={(event) =>
                      handleFieldChange(
                        "image",
                        event.target.value
                      )
                    }
                    placeholder="Paste image URL or /uploads/..."
                    className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:border-[#0d4f3c] bg-white font-mono"
                  />
                </div>
              </div>

              <p className="text-[11px] text-stone-500">
                Use a high-resolution JPG, PNG or WebP image.
                Device uploads are automatically optimized.
              </p>
            </div>

            {/* ------------------------------------------------------------ */}
            {/* TITLE                                                         */}
            {/* ------------------------------------------------------------ */}

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Slide Headline / Main Title{" "}
                <span className="text-red-500">*</span>
              </label>

              <input
                type="text"
                value={currentSlide.title || ""}
                onChange={(event) =>
                  handleFieldChange(
                    "title",
                    event.target.value
                  )
                }
                placeholder="e.g. Pure Handloom Silks & Unstitched Suits"
                className="w-full text-sm font-serif font-bold px-3.5 py-2.5 rounded-lg border border-stone-200 focus:outline-none focus:border-[#0d4f3c]"
              />
            </div>

            {/* ------------------------------------------------------------ */}
            {/* EYEBROW + COLLECTION                                          */}
            {/* ------------------------------------------------------------ */}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Eyebrow Tag
                </label>

                <input
                  type="text"
                  value={currentSlide.eyebrow || ""}
                  onChange={(event) =>
                    handleFieldChange(
                      "eyebrow",
                      event.target.value
                    )
                  }
                  placeholder="NEW ARRIVAL / Contemporary Pret"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:border-[#0d4f3c]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Collection Subtitle
                </label>

                <input
                  type="text"
                  value={currentSlide.collection || ""}
                  onChange={(event) =>
                    handleFieldChange(
                      "collection",
                      event.target.value
                    )
                  }
                  placeholder="Festive Pret & Luxury Coordinates"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:border-[#0d4f3c]"
                />
              </div>
            </div>

            {/* ------------------------------------------------------------ */}
            {/* DESCRIPTION                                                   */}
            {/* ------------------------------------------------------------ */}

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Editorial Description
              </label>

              <textarea
                rows={4}
                value={currentSlide.description || ""}
                onChange={(event) =>
                  handleFieldChange(
                    "description",
                    event.target.value
                  )
                }
                placeholder="Write a short description for this banner..."
                className="w-full text-xs px-3.5 py-2 rounded-lg border border-stone-200 focus:outline-none focus:border-[#0d4f3c] leading-relaxed"
              />
            </div>

            {/* ------------------------------------------------------------ */}
            {/* CAPTION + MOOD                                                */}
            {/* ------------------------------------------------------------ */}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Photo Card Caption
                </label>

                <input
                  type="text"
                  value={currentSlide.caption || ""}
                  onChange={(event) =>
                    handleFieldChange(
                      "caption",
                      event.target.value
                    )
                  }
                  placeholder="Bespoke Printed Kurti with Embroidered Placket"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:border-[#0d4f3c]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Moodboard Tag
                </label>

                <input
                  type="text"
                  value={currentSlide.mood || ""}
                  onChange={(event) =>
                    handleFieldChange(
                      "mood",
                      event.target.value
                    )
                  }
                  placeholder="Turquoise, Sage & Terracotta"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:border-[#0d4f3c]"
                />
              </div>
            </div>

            {/* ------------------------------------------------------------ */}
            {/* SEASON + CTA + TARGET                                         */}
            {/* ------------------------------------------------------------ */}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Season Badge
                </label>

                <input
                  type="text"
                  value={currentSlide.season || ""}
                  onChange={(event) =>
                    handleFieldChange(
                      "season",
                      event.target.value
                    )
                  }
                  placeholder="SUMMER/FESTIVE 2026"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:border-[#0d4f3c]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Button CTA Text
                </label>

                <input
                  type="text"
                  value={currentSlide.ctaText || ""}
                  onChange={(event) =>
                    handleFieldChange(
                      "ctaText",
                      event.target.value
                    )
                  }
                  placeholder="Explore Collection"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:border-[#0d4f3c]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Button Target
                </label>

                <input
                  type="text"
                  value={currentSlide.ctaTarget || ""}
                  onChange={(event) =>
                    handleFieldChange(
                      "ctaTarget",
                      event.target.value
                    )
                  }
                  placeholder="catalog-section"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:border-[#0d4f3c]"
                />
              </div>
            </div>

            {/* ------------------------------------------------------------ */}
            {/* ACTION BAR                                                    */}
            {/* ------------------------------------------------------------ */}

            <div className="pt-3 border-t border-stone-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="text-xs text-stone-500">
                {isDirty
                  ? "Changes are being saved automatically."
                  : "All banner changes are saved."}
              </div>

              <button
                type="button"
                onClick={handleSaveAll}
                disabled={
                  isSaving ||
                  uploadingIndex !== null
                }
                className="px-5 py-2.5 bg-[#0d4f3c] hover:bg-[#0b3f30] text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2
                    size={14}
                    className="animate-spin"
                  />
                ) : (
                  <Save size={14} />
                )}

                <span>
                  {isSaving
                    ? "Publishing..."
                    : "Publish All Banners"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
