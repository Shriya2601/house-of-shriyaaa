import React, {
  ElementType,
  ReactNode,
  CSSProperties,
  createElement,
} from "react";
import { useEditMode } from "./EditModeContext";
import { normalizeImageUrl, handleImageError, getLocalCachedImage } from "../../utils/imageUtils";

interface CanvaEditableProps {
  id: string;
  as?: ElementType;
  type?: "text" | "heading" | "banner" | "image" | "product" | "button" | "brand";
  label?: string;
  fieldPath?: string;
  currentValue?: string;
  productId?: string;
  slideIndex?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  text?: string;
  src?: string;
  alt?: string;
  onLoad?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  [key: string]: any;
}

export default function CanvaEditable({
  id,
  as: Component = "span",
  className = "",
  style = {},
  children,
  text,
  src,
  alt,
  label,
  type,
  fieldPath,
  currentValue,
  productId,
  slideIndex,
  ...rest
}: CanvaEditableProps) {
  const { getOverride, isEditMode } = useEditMode();
  const override = getOverride(id);

  // Live props (text, src) passed from StoreContext / CMS / catalog must ALWAYS take precedence on the storefront:
  const displayText = text !== undefined ? text : (override?.text !== undefined ? override.text : undefined);

  // Live image source must always take precedence whenever provided:
  const rawSrc = src || override?.src || "";
  let displaySrc = normalizeImageUrl(rawSrc);
  if (displaySrc) {
    if (displaySrc.startsWith("/public/")) {
      displaySrc = displaySrc.replace("/public", "");
    }
  }

  const computedStyle: CSSProperties = {
    ...style,
    ...(override?.fontFamily ? { fontFamily: override.fontFamily } : {}),
    ...(override?.fontSize ? { fontSize: override.fontSize } : {}),
    ...(override?.color ? { color: override.color } : {}),
    ...(override?.backgroundColor ? { backgroundColor: override.backgroundColor } : {}),
    ...(override?.fontWeight ? { fontWeight: override.fontWeight } : {}),
    ...(override?.fontStyle ? { fontStyle: override.fontStyle } : {}),
    ...(override?.textAlign ? { textAlign: override.textAlign } : {}),
    ...(override?.textTransform ? { textTransform: override.textTransform } : {}),
  };

  if (Component === "img" || type === "image") {
    const finalImageSrc = displaySrc || "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&q=80";
    return createElement("img", {
      ...rest,
      id,
      key: `${id}_${finalImageSrc}`,
      src: finalImageSrc,
      alt: alt || label || "",
      className,
      style: computedStyle,
      referrerPolicy: "no-referrer",
      onError: (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
        const target = e.currentTarget;
        if (!target) return;
        const cached = getLocalCachedImage(target.src);
        if (cached && target.src !== cached) {
          target.src = cached;
          return;
        }
        handleImageError(e, "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&q=80");
        if (typeof (rest as any).onError === "function") {
          try {
            (rest as any).onError(e);
          } catch {}
        }
        if (typeof (rest as any).onLoad === "function") {
          try {
            (rest as any).onLoad(e);
          } catch {}
        }
      },
    });
  }

  return createElement(
    Component,
    {
      ...rest,
      id,
      className,
      style: computedStyle,
    },
    displayText !== undefined ? displayText : children
  );
}

