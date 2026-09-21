import React, { createElement, useEffect, useMemo, useState, type CSSProperties, type ElementType, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Product } from "../types";
import { initialProducts } from "../data/products";
import { useStore } from "../context/StoreContext";
import { useEditMode, CanvaEditable } from "../components/editmode";
import SimpleIntroScreen from "../components/intro/SimpleIntroScreen";
import CustomerAuthModal from "../components/customer/CustomerAuthModal";
import WhatsAppHelpButton, { getWhatsAppHelpUrl } from "../components/whatsapp/WhatsAppHelpButton";
import { customerSignOut, findOrderByOrderNumber, generateCustomerReferralCode, confirmOrderPayment, getLocallyDeletedIds, subscribeToNewsletter } from "../services/storeService";
import { lookupPincode } from "../utils/pincodeLookup";
import { normalizeImageUrl } from "../utils/imageUtils";
import { SavedAddress, Order, AtelierBooking, HeroSlide } from "../types";
import {
  AlertCircle,
  ArrowRight,
  Bell,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  CreditCard,
  Crown,
  Edit3,
  ExternalLink,
  Gift,
  GraduationCap,
  Heart,
  HelpCircle,
  Home,
  Info,
  Layers,
  Loader2,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Package,
  PackageCheck,
  Plus,
  Search,
  Settings,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  Sparkles,
  Star,
  Tag,
  Trash2,
  Truck,
  User,
  UserRound,
  X,
  Zap,
  ZoomIn,
} from "lucide-react";
import LuxuryImageViewerModal from "../components/gallery/LuxuryImageViewerModal";

type BuilderTextProps = {
  key?: React.Key;
  id?: string;
  as?: ElementType;
  text?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  fieldPath?: string;
  label?: string;
  type?: "text" | "heading" | "button" | "brand";
};

export function BuilderText({
  as: Tag = "span",
  id,
  text,
  className,
  style,
  children,
  fieldPath,
  label,
  type = "text",
}: BuilderTextProps) {
  const generatedId =
    id ||
    (typeof text === "string"
      ? `txt_${text.slice(0, 24).toLowerCase().replace(/[^a-z0-9]/g, "_")}`
      : `el_${Math.random().toString(36).slice(2, 7)}`);

  return (
    <CanvaEditable
      id={generatedId}
      as={Tag}
      text={text}
      className={className}
      style={style}
      fieldPath={fieldPath}
      type={type}
      label={label || (typeof text === "string" ? text.slice(0, 24) : undefined)}
    >
      {children}
    </CanvaEditable>
  );
}

const imageUrls = {
  silk: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1600&q=85",
  chanderi: "https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=900&q=85",
  fabric: "https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?auto=format&fit=crop&w=800&q=80",
  luxury: "https://images.unsplash.com/photo-1596704017254-9b121068fb31?auto=format&fit=crop&w=900&q=85",
  festive: "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=900&q=85",
  daily: "https://images.unsplash.com/photo-1563178406-4cdc2923acbc?auto=format&fit=crop&w=900&q=85",
  college: "https://images.unsplash.com/photo-1583391733975-27a928923a1a?auto=format&fit=crop&w=900&q=85",
};

const products: Product[] = initialProducts;

const slides = [
  {
    eyebrow: "NEW ARRIVAL / Contemporary Pret",
    number: "01",
    collection: "Festive Pret & Luxury Coordinates",
    title: "Sage & Turquoise Handcrafted Printed Kurti Set",
    description: "Handcrafted pure cotton-silk designer kurti tunic with traditional geometric & floral motifs, embroidered contrast placket, and effortless artisanal elegance.",
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
    description: "Elegant mint-green embroidered salwar suit paired with a soft peach striped dupatta featuring delicate scalloped detailing. A graceful choice for festive occasions, family gatherings, and elegant everyday wear.",
    image: "https://plain-eeur-prod-public.komododecks.com/202609/15/OSeP8KXZKOwa1kTFdvK2/image.jpg",
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
    description: "PURE MUL CHANDERI JACOARD WITH HANDWORK WITH ORGANZA EMBROIDERY FOR SLEEVES AND CONTRAST PIPING WITH LACE ON DAMAN.",
    image: "https://plain-apac-prod-public.komododecks.com/202609/05/4UmFSGtcoZdZF37bKc3R/image.jpg",
    season: "DAILY CHIC 2026",
    caption: "Printed Organza Dupatta Set in Sage & Pastel Rose",
    mood: "Pastel Silks & Easy Linens",
    ctaText: "Shop Daily Chic",
    ctaTarget: "catalog-section",
  },
];

export function LogoMark({ small = false }: { small?: boolean }) {
  return (
    <span data-editable="true" className={small ? "logo-mark-small" : "logo-mark"}>
      <Crown size={small ? 14 : 28} strokeWidth={1.75} />
    </span>
  );
}

function IntroOverlay({ onEnter }: { onEnter: () => void }) {
  return <SimpleIntroScreen onComplete={onEnter} />;
}

// Navigation Drawer Component (Myntra-style E-Commerce Side Menu)
export function NavigationDrawer({
  isOpen,
  onClose,
  onSelectCategory,
  onOpenModal,
  onOpenAuth,
  wishlistCount,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelectCategory: (category: string) => void;
  onOpenModal: (type: string) => void;
  onOpenAuth: () => void;
  wishlistCount: number;
}) {
  if (!isOpen) return null;
  const { currentUser, customerProfile, customerOrders, siteContent, categories, products } = useStore();
  const whatsappUrl = getWhatsAppHelpUrl(siteContent?.whatsappNumber);

  const initials = currentUser
    ? (customerProfile?.fullName || currentUser.displayName || currentUser.email || "P")
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "HS";

  return (
    <>
      <div className="nav-drawer-backdrop" onClick={onClose} />
      <aside className="nav-drawer" aria-label="E-Commerce Navigation Menu">
        {/* Drawer Header */}
        <div className="nav-drawer-header">
          <div className="nav-drawer-top-row">
            <div className="flex items-center gap-2">
              <LogoMark small />
              <div>
                <span className="text-[0.6rem] uppercase tracking-widest text-[#d4af37] font-bold block">HAUTE COUTURE</span>
                <strong className="text-sm font-serif text-[#faf8f5] tracking-wider block">House of Shriya</strong>
              </div>
            </div>
            <button
              className="nav-drawer-close"
              aria-label="Close navigation menu"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>

          {currentUser ? (
            <div className="nav-user-card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="nav-user-avatar">{initials}</div>
                <div className="nav-user-info">
                  <strong>{customerProfile?.fullName || currentUser.displayName || currentUser.email?.split("@")[0] || "Patron"}</strong>
                  <span><Sparkles size={11} /> Atelier Patron · Tier {customerProfile?.tier || "Gold"}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await customerSignOut();
                  onClose();
                }}
                className="text-[0.65rem] text-[#faf8f5]/70 hover:text-white px-2 py-1 bg-white/10 hover:bg-white/20 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                title="Sign Out"
              >
                <LogOut size={12} />
                <span>Logout</span>
              </button>
            </div>
          ) : (
            <div className="nav-user-card flex items-center justify-between">
              <div>
                <strong className="text-xs text-[#faf8f5] block font-serif">Welcome to Atelier</strong>
                <span className="text-[0.68rem] text-[#faf8f5]/70 block mt-0.5">Sign in for orders & patron privileges</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAuth();
                }}
                className="text-xs bg-[#d4af37] hover:bg-[#b89528] text-[#0d4f3c] font-bold px-3 py-1.5 rounded-full shadow transition-all cursor-pointer"
              >
                Sign In / Register
              </button>
            </div>
          )}

          {/* Quick Shortcuts: Track Order & My Orders */}
          <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenModal("track_order");
              }}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2.5 bg-white/10 hover:bg-white/20 text-[#faf8f5] rounded-lg text-xs font-semibold transition-colors"
            >
              <Truck size={13} className="text-[#d4af37]" />
              <span>Track Order</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenModal("order_history");
              }}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2.5 bg-white/10 hover:bg-white/20 text-[#faf8f5] rounded-lg text-xs font-semibold transition-colors"
            >
              <Package size={13} className="text-[#d4af37]" />
              <span>My Orders ({customerOrders.length})</span>
            </button>
          </div>
        </div>

        {/* Drawer Content */}
        <div className="nav-drawer-content">
          {/* SECTION 1: SHOP */}
          <div className="nav-section">
            <div className="nav-section-title">
              <span>Shop</span>
              <Layers size={13} />
            </div>

            <button
              className="nav-item-btn"
              onClick={() => {
                onSelectCategory("All Collections");
                onClose();
              }}
            >
              <div className="nav-item-left">
                <div className="nav-item-icon"><Sparkles size={17} /></div>
                <div className="nav-item-text">
                  <span className="nav-item-title">All Collections</span>
                  <span className="nav-item-sub">Explore full handcrafted catalog</span>
                </div>
              </div>
              <span className="nav-item-badge">{products.length} Pieces</span>
            </button>

            {categories && categories.length > 0 ? (
              categories.map((cat) => {
                const count = products.filter((p) => p.category === cat.name).length;
                return (
                  <button
                    key={cat.id || cat.name}
                    className="nav-item-btn"
                    onClick={() => {
                      onSelectCategory(cat.name);
                      onClose();
                    }}
                  >
                    <div className="nav-item-left">
                      <div className="nav-item-icon"><Shirt size={17} /></div>
                      <div className="nav-item-text">
                        <span className="nav-item-title">{cat.name}</span>
                        <span className="nav-item-sub">{cat.description || "Handcrafted collection"}</span>
                      </div>
                    </div>
                    {count > 0 ? (
                      <span className="nav-item-badge">{count} {count === 1 ? "Piece" : "Pieces"}</span>
                    ) : (
                      <ChevronRight size={15} className="text-[#c5a059]" />
                    )}
                  </button>
                );
              })
            ) : (
              <>
                <button
                  className="nav-item-btn"
                  onClick={() => {
                    onSelectCategory("Cotton Suits");
                    onClose();
                  }}
                >
                  <div className="nav-item-left">
                    <div className="nav-item-icon"><Shirt size={17} /></div>
                    <div className="nav-item-text">
                      <span className="nav-item-title">Cotton Suits</span>
                      <span className="nav-item-sub">Pure Mulmul & Hand-block sets</span>
                    </div>
                  </div>
                  <ChevronRight size={15} className="text-[#c5a059]" />
                </button>

                <button
                  className="nav-item-btn"
                  onClick={() => {
                    onSelectCategory("Daily Wear Suits");
                    onClose();
                  }}
                >
                  <div className="nav-item-left">
                    <div className="nav-item-icon"><Sparkles size={17} /></div>
                    <div className="nav-item-text">
                      <span className="nav-item-title">Daily Wear Suits</span>
                      <span className="nav-item-sub">Comfortable modal & linen sets</span>
                    </div>
                  </div>
                  <ChevronRight size={15} className="text-[#c5a059]" />
                </button>

                <button
                  className="nav-item-btn"
                  onClick={() => {
                    onSelectCategory("Co-ord Sets");
                    onClose();
                  }}
                >
                  <div className="nav-item-left">
                    <div className="nav-item-icon"><Layers size={17} /></div>
                    <div className="nav-item-text">
                      <span className="nav-item-title">Co-ord Sets</span>
                      <span className="nav-item-sub">Contemporary tunics & palazzos</span>
                    </div>
                  </div>
                  <ChevronRight size={15} className="text-[#c5a059]" />
                </button>

                <button
                  className="nav-item-btn"
                  onClick={() => {
                    onSelectCategory("Satin Wear");
                    onClose();
                  }}
                >
                  <div className="nav-item-left">
                    <div className="nav-item-icon"><Crown size={17} /></div>
                    <div className="nav-item-text">
                      <span className="nav-item-title">Satin Wear</span>
                      <span className="nav-item-sub">Glossy silks & evening ensembles</span>
                    </div>
                  </div>
                  <ChevronRight size={15} className="text-[#c5a059]" />
                </button>
              </>
            )}
          </div>

          {/* SECTION 2: MY ORDERS */}
          <div className="nav-section">
            <div className="nav-section-title">
              <span>My Orders</span>
              <Package size={13} />
            </div>

            <button
              className="nav-item-btn"
              onClick={() => {
                onClose();
                onOpenModal("order_history");
              }}
            >
              <div className="nav-item-left">
                <div className="nav-item-icon"><Clock size={17} /></div>
                <div className="nav-item-text">
                  <span className="nav-item-title">Order History</span>
                  <span className="nav-item-sub">Past bookings & invoices</span>
                </div>
              </div>
              <span className="nav-item-badge">
                {customerOrders.length > 0 ? `${customerOrders.length} ${customerOrders.length === 1 ? "Order" : "Orders"}` : "0 Orders"}
              </span>
            </button>

            <button
              className="nav-item-btn"
              onClick={() => {
                onClose();
                onOpenModal("track_order");
              }}
            >
              <div className="nav-item-left">
                <div className="nav-item-icon"><Truck size={17} /></div>
                <div className="nav-item-text">
                  <span className="nav-item-title">Track Order</span>
                  <span className="nav-item-sub">Live shipment & courier status</span>
                </div>
              </div>
              <span className="nav-item-badge">Tracking</span>
            </button>
          </div>

          {/* SECTION 3: MY ACCOUNT */}
          <div className="nav-section">
            <div className="nav-section-title">
              <span>My Account</span>
              <User size={13} />
            </div>

            <button
              className="nav-item-btn"
              onClick={() => {
                onClose();
                if (!currentUser) {
                  onOpenAuth();
                } else {
                  onOpenModal("profile");
                }
              }}
            >
              <div className="nav-item-left">
                <div className="nav-item-icon"><UserRound size={17} /></div>
                <div className="nav-item-text">
                  <span className="nav-item-title">Profile</span>
                  <span className="nav-item-sub">Measurements, sizing & contact info</span>
                </div>
              </div>
              <ChevronRight size={15} className="text-[#c5a059]" />
            </button>

            <button
              className="nav-item-btn"
              onClick={() => {
                onClose();
                onOpenModal("referral");
              }}
            >
              <div className="nav-item-left">
                <div className="nav-item-icon text-[#0d4f3c]"><Gift size={17} /></div>
                <div className="nav-item-text">
                  <span className="nav-item-title flex items-center gap-1.5">
                    Refer & Earn ₹100
                    <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                      Rewards
                    </span>
                  </span>
                  <span className="nav-item-sub">Give ₹100, get ₹100 on every friend</span>
                </div>
              </div>
              <ChevronRight size={15} className="text-[#c5a059]" />
            </button>

            <button
              className="nav-item-btn"
              onClick={() => {
                onClose();
                if (!currentUser) {
                  onOpenAuth();
                } else {
                  onOpenModal("addresses");
                }
              }}
            >
              <div className="nav-item-left">
                <div className="nav-item-icon"><MapPin size={17} /></div>
                <div className="nav-item-text">
                  <span className="nav-item-title">Saved Addresses</span>
                  <span className="nav-item-sub">Delivery locations & pincodes</span>
                </div>
              </div>
              <span className="nav-item-badge">{customerProfile?.savedAddresses?.length || 0} Saved</span>
            </button>

            <button
              className="nav-item-btn"
              onClick={() => {
                onClose();
                onSelectCategory("Wishlist");
                document.getElementById("catalog-section")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <div className="nav-item-left">
                <div className="nav-item-icon"><Heart size={17} /></div>
                <div className="nav-item-text">
                  <span className="nav-item-title">Wishlist</span>
                  <span className="nav-item-sub">Saved couture pieces</span>
                </div>
              </div>
              <span className="nav-item-badge">{wishlistCount} Saved</span>
            </button>

            <button
              className="nav-item-btn"
              onClick={() => {
                onClose();
                onOpenModal("payments");
              }}
            >
              <div className="nav-item-left">
                <div className="nav-item-icon"><CreditCard size={17} /></div>
                <div className="nav-item-text">
                  <span className="nav-item-title">Payment Methods</span>
                  <span className="nav-item-sub">Instant UPI & Cards</span>
                </div>
              </div>
              <ChevronRight size={15} className="text-[#c5a059]" />
            </button>
          </div>

          {/* SECTION 4: SETTINGS */}
          <div className="nav-section">
            <div className="nav-section-title">
              <span>Settings</span>
              <Settings size={13} />
            </div>

            <button
              className="nav-item-btn"
              onClick={() => {
                onClose();
                onOpenModal("settings");
              }}
            >
              <div className="nav-item-left">
                <div className="nav-item-icon"><Settings size={17} /></div>
                <div className="nav-item-text">
                  <span className="nav-item-title">Account Settings</span>
                  <span className="nav-item-sub">Security, password & preferences</span>
                </div>
              </div>
              <ChevronRight size={15} className="text-[#c5a059]" />
            </button>

            <button
              className="nav-item-btn"
              onClick={() => {
                onClose();
                onOpenModal("notifications");
              }}
            >
              <div className="nav-item-left">
                <div className="nav-item-icon"><Bell size={17} /></div>
                <div className="nav-item-text">
                  <span className="nav-item-title">Notifications</span>
                  <span className="nav-item-sub">WhatsApp & VIP drop alerts</span>
                </div>
              </div>
              <span className="nav-item-badge">Active</span>
            </button>

            <button
              className="nav-item-btn"
              onClick={() => {
                onClose();
                onOpenModal("privacy");
              }}
            >
              <div className="nav-item-left">
                <div className="nav-item-icon"><ShieldCheck size={17} /></div>
                <div className="nav-item-text">
                  <span className="nav-item-title">Privacy & Security</span>
                  <span className="nav-item-sub">100% encrypted & protected</span>
                </div>
              </div>
              <ChevronRight size={15} className="text-[#c5a059]" />
            </button>

            <button
              className="nav-item-btn"
              onClick={() => {
                onClose();
                onOpenModal("support");
              }}
            >
              <div className="nav-item-left">
                <div className="nav-item-icon"><HelpCircle size={17} /></div>
                <div className="nav-item-text">
                  <span className="nav-item-title">Help & Support</span>
                  <span className="nav-item-sub">Atelier styling concierge 24/7</span>
                </div>
              </div>
              <ChevronRight size={15} className="text-[#c5a059]" />
            </button>

            <Link
              to="/our-story"
              className="nav-item-btn"
              onClick={onClose}
            >
              <div className="nav-item-left">
                <div className="nav-item-icon"><Info size={17} /></div>
                <div className="nav-item-text">
                  <span className="nav-item-title">About House of Shriya</span>
                  <span className="nav-item-sub">Our Surat heritage & handloom journey</span>
                </div>
              </div>
              <ChevronRight size={15} className="text-[#c5a059]" />
            </Link>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="nav-drawer-footer">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 rounded-full bg-[#25D366] hover:bg-[#20ba59] text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <MessageCircle size={16} />
            <span>Need Help? / Open WhatsApp</span>
          </a>
          <div className="text-center text-[0.62rem] text-[#8c827a] mt-2 flex items-center justify-center gap-2">
            <span>House of Shriya · 100% Authentic Handlooms</span>
          </div>
        </div>
      </aside>
    </>
  );
}

// Interactive Information Modal System
export function InteractiveModal({
  type,
  onClose,
  onOpenModal,
  onOpenAuth,
}: {
  type: string | null;
  onClose: () => void;
  onOpenModal?: (type: string) => void;
  onOpenAuth?: () => void;
}) {
  const {
    currentUser,
    customerProfile,
    customerOrders,
    atelierBookings,
    siteContent,
    updateProfileDetails,
    bookAtelierSession,
    confirmCustomerOrderPayment,
  } = useStore();

  const [activeModalType, setActiveModalType] = useState<string | null>(type);

  useEffect(() => {
    setActiveModalType(type);
  }, [type]);

  const switchModal = (newType: string) => {
    setActiveModalType(newType);
    if (onOpenModal) onOpenModal(newType);
  };

  const [trackSearchQuery, setTrackSearchQuery] = useState("");
  const [searchedOrder, setSearchedOrder] = useState<Order | null>(null);
  const [trackError, setTrackError] = useState("");
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [referralCopied, setReferralCopied] = useState(false);

  // Atelier Booking States
  const [historyTab, setHistoryTab] = useState<"orders" | "bookings">("orders");
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [bookingService, setBookingService] = useState("Atelier Fitting Session");
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("11:30 AM");
  const [bookingPhone, setBookingPhone] = useState(customerProfile?.phone || "");
  const [bookingNotes, setBookingNotes] = useState("");
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingSuccessMsg, setBookingSuccessMsg] = useState("");

  const [addrPincodeLoading, setAddrPincodeLoading] = useState(false);
  const [addrPincodeFeedback, setAddrPincodeFeedback] = useState<string | null>(null);
  const [trackUtrInput, setTrackUtrInput] = useState("");
  const [trackUtrSubmitting, setTrackUtrSubmitting] = useState(false);
  const [trackUtrSuccess, setTrackUtrSuccess] = useState(false);
  const [copiedTrackAwb, setCopiedTrackAwb] = useState(false);

  // Order History UTR states
  const [historyUtrInputs, setHistoryUtrInputs] = useState<Record<string, string>>({});
  const [historyUtrSubmitting, setHistoryUtrSubmitting] = useState<Record<string, boolean>>({});
  const [historyUtrSuccess, setHistoryUtrSuccess] = useState<Record<string, boolean>>({});
  const [activeHistoryPayOrder, setActiveHistoryPayOrder] = useState<string | null>(null);
  const [copiedUpiId, setCopiedUpiId] = useState(false);

  const [newAddr, setNewAddr] = useState<Omit<SavedAddress, "id">>({
    label: "Home",
    fullName: customerProfile?.fullName || "",
    phone: customerProfile?.phone || "",
    addressLine1: "",
    city: "",
    state: "",
    pincode: "",
    isDefault: false,
  });

  const whatsappUrl = getWhatsAppHelpUrl(siteContent?.whatsappNumber);

  if (!type) return null;

  const handleAddrPincodeChange = async (val: string) => {
    const clean = val.replace(/\D/g, "").slice(0, 6);
    setNewAddr((prev) => ({ ...prev, pincode: clean }));
    if (clean.length === 6) {
      setAddrPincodeLoading(true);
      try {
        const info = await lookupPincode(clean);
        if (info) {
          setNewAddr((prev) => ({
            ...prev,
            city: info.city || prev.city,
            state: info.state || prev.state,
          }));
          setAddrPincodeFeedback(`Auto-detected: ${info.city ? info.city + ", " : ""}${info.state}`);
        } else {
          setAddrPincodeFeedback(null);
        }
      } catch {
        setAddrPincodeFeedback(null);
      } finally {
        setAddrPincodeLoading(false);
      }
    } else {
      setAddrPincodeFeedback(null);
    }
  };

  const handleTrackSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackSearchQuery.trim()) return;
    setTrackError("");
    try {
      const found = await findOrderByOrderNumber(trackSearchQuery.trim());
      if (found) {
        setSearchedOrder(found);
      } else {
        setSearchedOrder(null);
        setTrackError(`No order found matching "${trackSearchQuery.trim()}". Please verify your order number or phone number.`);
      }
    } catch {
      setTrackError("Unable to locate order. Please check order number or phone.");
    }
  };

  const handleTrackSubmitUtr = async (e: React.FormEvent, orderId: string, orderNumber: string) => {
    e.preventDefault();
    const cleanUtr = trackUtrInput.trim();
    if (!cleanUtr) return;
    setTrackUtrSubmitting(true);
    try {
      const res = await confirmCustomerOrderPayment(orderId || orderNumber, cleanUtr, "UPI / QR Code");
      if (res.success) {
        setTrackUtrSuccess(true);
        if (searchedOrder) {
          setSearchedOrder({
            ...searchedOrder,
            paymentStatus: "Payment Verification Pending",
            utrNumber: cleanUtr,
            paymentDetails: {
              ...searchedOrder.paymentDetails,
              methodType: "upi",
              utrNumber: cleanUtr,
              paidAt: new Date().toISOString(),
            },
          });
        }
      }
    } catch (err) {
      console.error("UTR submission error:", err);
    } finally {
      setTrackUtrSubmitting(false);
    }
  };

  const handleHistorySubmitUtr = async (e: React.FormEvent, order: Order) => {
    e.preventDefault();
    const utr = (historyUtrInputs[order.id] || "").trim();
    if (!utr) return;
    setHistoryUtrSubmitting((prev) => ({ ...prev, [order.id]: true }));
    try {
      const res = await confirmCustomerOrderPayment(order.id, utr, "UPI / QR Code");
      if (res.success) {
        setHistoryUtrSuccess((prev) => ({ ...prev, [order.id]: true }));
        if (searchedOrder && (searchedOrder.id === order.id || searchedOrder.orderNumber === order.orderNumber)) {
          setSearchedOrder({
            ...searchedOrder,
            paymentStatus: "Payment Verification Pending",
            utrNumber: utr,
            paymentDetails: {
              ...searchedOrder.paymentDetails,
              methodType: "upi",
              utrNumber: utr,
              paidAt: new Date().toISOString(),
            },
          });
        }
      }
    } catch (err) {
      console.error("History UTR submission error:", err);
    } finally {
      setHistoryUtrSubmitting((prev) => ({ ...prev, [order.id]: false }));
    }
  };

  const handleSaveNewAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerProfile || !newAddr.addressLine1 || !newAddr.pincode) return;
    const addressToAdd: SavedAddress = {
      ...newAddr,
      id: "addr_" + Date.now(),
    };
    const updated = [...(customerProfile.savedAddresses || []), addressToAdd];
    await updateProfileDetails({ savedAddresses: updated });
    setIsAddingAddress(false);
  };

  const handleDeleteAddress = async (id: string) => {
    if (!customerProfile) return;
    const updated = (customerProfile.savedAddresses || []).filter((a) => a.id !== id);
    await updateProfileDetails({ savedAddresses: updated });
  };

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingDate) return;
    setBookingSubmitting(true);
    try {
      await bookAtelierSession({
        fullName: customerProfile?.fullName || currentUser?.displayName || "Patron",
        email: currentUser?.email || "",
        phone: bookingPhone || customerProfile?.phone || "",
        serviceType: bookingService,
        preferredDate: bookingDate,
        preferredTime: bookingTime,
        notes: bookingNotes,
      });
      setBookingSuccessMsg("Your atelier booking is confirmed and stored in your profile!");
      setIsBookingOpen(false);
      setBookingNotes("");
      setHistoryTab("bookings");
      setTimeout(() => setBookingSuccessMsg(""), 5000);
    } catch (err) {
      console.warn("Booking creation notice:", err);
    } finally {
      setBookingSubmitting(false);
    }
  };

  const renderContent = () => {
    switch (activeModalType || type) {
      case "track_order": {
        const orderToDisplay = searchedOrder || (customerOrders.length > 0 ? customerOrders[0] : null);

        const orderTotal = orderToDisplay ? (orderToDisplay.totalAmount ?? orderToDisplay.total ?? 0) : 0;
        const orderStatusText = orderToDisplay ? (orderToDisplay.status || orderToDisplay.orderStatus || "pending").replace("_", " ") : "";
        const city = orderToDisplay?.customerAddress?.city || orderToDisplay?.shippingAddress?.city || "New Delhi";
        const pincode = orderToDisplay?.customerAddress?.pincode || orderToDisplay?.shippingAddress?.pincode || "110001";
        const isPaid = orderToDisplay?.paymentStatus === "Paid";
        const isVerifying = orderToDisplay?.paymentStatus === "Payment Verification Pending";
        const isPending = !isPaid && !isVerifying;

        return (
          <div className="space-y-4">
            {/* Quick Order Selection Chips if user has multiple orders */}
            {customerOrders.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-[#706458] block">Your Recent Bookings:</span>
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {customerOrders.map((ord) => {
                    const isSelected = orderToDisplay?.id === ord.id || orderToDisplay?.orderNumber === ord.orderNumber;
                    return (
                      <button
                        key={ord.id}
                        type="button"
                        onClick={() => {
                          setSearchedOrder(ord);
                          setTrackSearchQuery(ord.orderNumber);
                          setTrackError("");
                        }}
                        className={`text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap font-medium transition-all ${
                          isSelected
                            ? "bg-[#0d4f3c] text-white shadow-xs font-bold"
                            : "bg-[#f4efe8] text-[#554b43] hover:bg-[#e8dfd5]"
                        }`}
                      >
                        #{ord.orderNumber}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <form onSubmit={handleTrackSearch} className="flex gap-2">
              <input
                type="text"
                value={trackSearchQuery}
                onChange={(e) => setTrackSearchQuery(e.target.value)}
                placeholder="Enter Order # (e.g. HOS-XXXXXX) or Mobile No."
                className="flex-1 px-3 py-2 text-xs border border-[#ebe2d8] rounded-lg bg-white text-[#1e1b18] focus:outline-none focus:border-[#0d4f3c]"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-[#0d4f3c] text-white text-xs font-bold rounded-lg hover:bg-[#083427] transition-colors"
              >
                Track
              </button>
            </form>

            <div className="flex items-center justify-between text-[11px] text-[#706458] px-1">
              <span>Don't have your Order ID?</span>
              <a
                href={`https://wa.me/919501698356?text=${encodeURIComponent(
                  "Namaste House of Shriya! I want to track my order status. Please help me locate my booking."
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#0d4f3c] font-bold hover:underline inline-flex items-center gap-1"
              >
                <MessageCircle size={11} className="text-[#25D366]" />
                <span>Ask on WhatsApp (9501698356)</span>
              </a>
            </div>

            {trackError && (
              <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                {trackError}
              </p>
            )}

            {orderToDisplay ? (
              <div className="space-y-3 pt-1">
                {/* Order Summary Header */}
                <div className="bg-[#f7f2eb] p-3.5 rounded-xl border border-[#e8dfd5] flex items-center justify-between">
                  <div>
                    <span className="text-xs text-[#8c6d37] font-bold block">ORDER #{orderToDisplay.orderNumber}</span>
                    <strong className="text-sm text-[#1e1b18] font-serif">
                      {orderToDisplay.items[0]?.name || orderToDisplay.items[0]?.productName || "Luxury Couture Order"}
                    </strong>
                    <span className="text-xs text-[#706458] block mt-0.5">
                      {orderToDisplay.items.length} {orderToDisplay.items.length === 1 ? "item" : "items"} · Total: ₹{orderTotal.toLocaleString()}
                    </span>
                  </div>
                  <span className="bg-[#0d4f3c] text-[#faf8f5] text-xs font-bold px-2.5 py-1 rounded-full capitalize">
                    {orderStatusText}
                  </span>
                </div>

                {/* PAYMENT STATUS & CONFIRMATION BOX */}
                <div className="rounded-xl border p-3.5 text-xs space-y-2.5 bg-white border-[#ebe2d8]">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#1e1b18] flex items-center gap-1.5">
                      <CreditCard size={14} className="text-[#0d4f3c]" />
                      <span>Payment Status:</span>
                    </span>
                    {isPaid ? (
                      <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 size={11} /> Paid & Confirmed
                      </span>
                    ) : isVerifying ? (
                      <span className="bg-amber-100 text-amber-900 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                        <Clock size={11} /> Verification In Progress
                      </span>
                    ) : (
                      <span className="bg-rose-100 text-rose-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-rose-200 flex items-center gap-1">
                        <AlertCircle size={11} /> Payment Pending
                      </span>
                    )}
                  </div>

                  {orderToDisplay.utrNumber && (
                    <div className="text-[11px] text-[#63594e] bg-[#f8f5ee] px-2.5 py-1.5 rounded-lg border border-[#e8dfd5] flex items-center justify-between">
                      <span>Submitted UTR / Ref:</span>
                      <strong className="font-mono text-[#0d4f3c]">{orderToDisplay.utrNumber}</strong>
                    </div>
                  )}

                  {/* If payment is pending or customer wants to submit UTR */}
                  {isPending && (
                    <div className="space-y-2 pt-1 border-t border-[#f0e8dc]">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] text-[#706458]">
                          Pay via UPI to <strong className="text-[#0d4f3c]">House of Shriya Atelier</strong> ({siteContent?.upiId || "shriyapusha01-1@okaxis"}):
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(siteContent?.upiId || "shriyapusha01-1@okaxis");
                            setCopiedUpiId(true);
                            setTimeout(() => setCopiedUpiId(false), 2000);
                          }}
                          className="text-[10px] text-[#0d4f3c] font-bold hover:underline flex items-center gap-1"
                        >
                          {copiedUpiId ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                          <span>{copiedUpiId ? "Copied UPI" : "Copy UPI ID"}</span>
                        </button>
                      </div>

                      {trackUtrSuccess ? (
                        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-lg text-xs flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                          <span>Thank you! Your UTR has been submitted and registered for verification.</span>
                        </div>
                      ) : (
                        <form
                          onSubmit={(e) => handleTrackSubmitUtr(e, orderToDisplay.id, orderToDisplay.orderNumber)}
                          className="flex gap-2"
                        >
                          <input
                            type="text"
                            placeholder="Enter 12-digit UPI UTR / Ref #"
                            value={trackUtrInput}
                            onChange={(e) => setTrackUtrInput(e.target.value)}
                            required
                            className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-[#d6ccc2] rounded-lg focus:outline-none focus:border-[#0d4f3c]"
                          />
                          <button
                            type="submit"
                            disabled={trackUtrSubmitting}
                            className="px-3 py-1.5 bg-[#0d4f3c] text-white font-bold rounded-lg hover:bg-[#083528] transition-colors shrink-0 disabled:opacity-50"
                          >
                            {trackUtrSubmitting ? "Submitting..." : "Confirm Payment"}
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </div>

                {/* COURIER & SHIPROCKET TRACKING */}
                {(orderToDisplay.trackingNumber || orderToDisplay.shiprocketOrderId) && (
                  <div className="bg-[#0d4f3c]/5 border border-[#0d4f3c]/20 rounded-xl p-3.5 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-serif font-bold text-xs text-[#0d4f3c] flex items-center gap-1.5">
                        <Truck size={15} />
                        <span>Shiprocket Express Courier</span>
                      </span>
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                        {orderToDisplay.shiprocketStatus || "Manifest Dispatched"}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#6b6257]">Courier Partner</span>
                      <span className="font-semibold text-[#1e1b18]">
                        {orderToDisplay.trackingCourier || "Shiprocket Express"}
                      </span>
                    </div>

                    {orderToDisplay.trackingNumber && (
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-[#6b6257]">Air Waybill (AWB)</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-[#0d4f3c]">
                            {orderToDisplay.trackingNumber}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(orderToDisplay.trackingNumber!);
                              setCopiedTrackAwb(true);
                              setTimeout(() => setCopiedTrackAwb(false), 2000);
                            }}
                            className="text-stone-400 hover:text-stone-700 p-0.5"
                            title="Copy AWB"
                          >
                            {copiedTrackAwb ? (
                              <Check size={12} className="text-emerald-600" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {(orderToDisplay.trackingUrl || orderToDisplay.trackingNumber) && (
                      <div className="pt-1.5 border-t border-[#0d4f3c]/10 flex items-center justify-between text-[11px]">
                        <span className="text-stone-500">Live Courier Tracking:</span>
                        <a
                          href={orderToDisplay.trackingUrl || `https://shiprocket.co/tracking/${orderToDisplay.trackingNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold text-[#0d4f3c] hover:underline inline-flex items-center gap-1"
                        >
                          <span>Track on Shiprocket</span>
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* Progress Steps */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-[#0d4f3c] text-white flex items-center justify-center shrink-0 text-xs">
                      ✓
                    </div>
                    <div>
                      <strong className="text-xs text-[#1e1b18] block">Order Placed & Registered</strong>
                      <span className="text-[0.7rem] text-[#706458]">
                        {new Date(orderToDisplay.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })} · Surat Atelier Registry
                      </span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-[#0d4f3c] text-white flex items-center justify-center shrink-0 text-xs">
                      ✓
                    </div>
                    <div>
                      <strong className="text-xs text-[#1e1b18] block">Handloom Artisan Quality Check</strong>
                      <span className="text-[0.7rem] text-[#706458]">Surat Atelier Flagship Inspection</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-[#0d4f3c] text-white flex items-center justify-center shrink-0 text-xs">
                      <Truck size={14} />
                    </div>
                    <div>
                      <strong className="text-xs text-[#1e1b18] block">Dispatched via Premium Express Carrier</strong>
                      <span className="text-[0.7rem] text-[#0d4f3c] font-medium">
                        Delivery to: {city}, {pincode}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Direct WhatsApp Concierge Link */}
                <div className="pt-2">
                  <a
                    href={`https://wa.me/919501698356?text=${encodeURIComponent(
                      `Namaste House of Shriya! I am tracking my order ${orderToDisplay.orderNumber} (Total: ₹${orderTotal}). Please share the latest courier status.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 bg-[#25D366] hover:bg-[#1faa53] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors shadow-xs"
                  >
                    <MessageCircle size={15} />
                    <span>WhatsApp Atelier Support (9501698356)</span>
                  </a>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-[#706458] space-y-3">
                <p>No active shipments found. Enter an order number or mobile number above, or check your order history.</p>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  {customerOrders.length > 0 && (
                    <button
                      type="button"
                      onClick={() => switchModal("order_history")}
                      className="px-4 py-2 bg-[#0d4f3c] text-white rounded-xl font-bold text-xs"
                    >
                      View All My Orders ({customerOrders.length})
                    </button>
                  )}
                  <a
                    href="https://wa.me/919501698356?text=Namaste%20House%20of%20Shriya!%20I%20need%20help%20tracking%20my%20order."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#25D366] text-white rounded-xl font-bold text-xs"
                  >
                    <MessageCircle size={14} />
                    <span>WhatsApp Help (9501698356)</span>
                  </a>
                  {!currentUser && onOpenAuth && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenAuth();
                      }}
                      className="px-4 py-2 bg-[#d4af37] text-[#0d4f3c] rounded-xl font-bold text-xs"
                    >
                      Sign In to View Orders
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      }

      case "order_history": {
        if (!currentUser) {
          return (
            <div className="text-center py-8 space-y-3 text-xs">
              <Package size={36} className="mx-auto text-[#c5a059]" />
              <div>
                <strong className="text-sm font-serif text-[#1e1b18] block">Customer Login Required</strong>
                <p className="text-[#706458] mt-1">Sign in with your account to view your past couture orders, fittings, and bookings.</p>
              </div>
              {onOpenAuth && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAuth();
                  }}
                  className="px-5 py-2 bg-[#0d4f3c] hover:bg-[#083427] text-white font-bold rounded-full text-xs shadow transition-all"
                >
                  Sign In / Register
                </button>
              )}
            </div>
          );
        }

        return (
          <div className="space-y-4">
            {/* Tab switcher: Orders vs Atelier Bookings */}
            <div className="flex items-center justify-between border-b border-[#ebe2d8] pb-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setHistoryTab("orders");
                    setIsBookingOpen(false);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    historyTab === "orders" && !isBookingOpen
                      ? "bg-[#0d4f3c] text-white"
                      : "bg-[#f5efeb] text-[#706458] hover:bg-[#ebe2d8]"
                  }`}
                >
                  Couture Orders ({customerOrders.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHistoryTab("bookings");
                    setIsBookingOpen(false);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    historyTab === "bookings" && !isBookingOpen
                      ? "bg-[#0d4f3c] text-white"
                      : "bg-[#f5efeb] text-[#706458] hover:bg-[#ebe2d8]"
                  }`}
                >
                  Atelier Bookings ({atelierBookings.length})
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsBookingOpen(!isBookingOpen)}
                className="flex items-center gap-1 px-3 py-1.5 bg-[#f5eee6] hover:bg-[#ebe0d3] text-[#8c6d37] rounded-lg text-xs font-bold border border-[#d8cbba] transition-colors"
              >
                <Plus size={13} />
                <span>{isBookingOpen ? "View History" : "New Booking"}</span>
              </button>
            </div>

            {bookingSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>{bookingSuccessMsg}</span>
              </div>
            )}

            {/* NEW ATELIER BOOKING FORM */}
            {isBookingOpen ? (
              <form onSubmit={handleCreateBooking} className="bg-[#faf7f2] p-4 rounded-xl border border-[#ebe2d8] space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <strong className="text-sm font-serif text-[#1e1b18]">Book Atelier Consultation or Fitting</strong>
                  <span className="text-[10px] text-[#8c6d37] font-semibold uppercase tracking-wider">Bespoke Service</span>
                </div>
                <p className="text-[#706458] text-[11px]">
                  Reserve a personalized drape, fabric selection, or bridal consultation with our master couturiers.
                </p>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#1e1b18]">Service Required</label>
                  <select
                    value={bookingService}
                    onChange={(e) => setBookingService(e.target.value)}
                    className="w-full p-2 border border-[#ebe2d8] rounded-lg bg-white text-xs"
                  >
                    <option value="Atelier Fitting Session">Atelier Fitting Session (Flagship Boutique)</option>
                    <option value="Virtual Drape & Styling">Virtual Drape & Styling (Video Consultation)</option>
                    <option value="Bespoke Bridal Consultation">Bespoke Bridal Trousseau Consultation</option>
                    <option value="Fabric Selection & Sizing Guidance">Fabric Selection & Sizing Guidance</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-[#1e1b18]">Preferred Date</label>
                    <input
                      type="date"
                      required
                      value={bookingDate}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={(e) => setBookingDate(e.target.value)}
                      className="w-full p-2 border border-[#ebe2d8] rounded-lg bg-white text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-[#1e1b18]">Preferred Time Slot</label>
                    <select
                      value={bookingTime}
                      onChange={(e) => setBookingTime(e.target.value)}
                      className="w-full p-2 border border-[#ebe2d8] rounded-lg bg-white text-xs"
                    >
                      <option value="11:00 AM">11:00 AM - 12:00 PM</option>
                      <option value="01:00 PM">01:00 PM - 02:00 PM</option>
                      <option value="03:30 PM">03:30 PM - 04:30 PM</option>
                      <option value="05:30 PM">05:30 PM - 06:30 PM</option>
                      <option value="07:00 PM">07:00 PM - 08:00 PM</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#1e1b18]">Contact Phone / WhatsApp</label>
                  <input
                    type="tel"
                    placeholder="10 digit mobile number"
                    required
                    value={bookingPhone}
                    onChange={(e) => setBookingPhone(e.target.value)}
                    className="w-full p-2 border border-[#ebe2d8] rounded-lg bg-white text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#1e1b18]">Special Requests or Occasion (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Bridal trousseau, festive unstitched suit selection"
                    value={bookingNotes}
                    onChange={(e) => setBookingNotes(e.target.value)}
                    className="w-full p-2 border border-[#ebe2d8] rounded-lg bg-white text-xs"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={bookingSubmitting}
                    className="flex-1 py-2.5 bg-[#0d4f3c] hover:bg-[#083528] text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    {bookingSubmitting ? "Confirming Booking..." : "Confirm & Save Booking"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsBookingOpen(false)}
                    className="px-4 py-2.5 bg-gray-200 text-gray-700 font-bold rounded-lg text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : historyTab === "orders" ? (
              customerOrders.length === 0 ? (
                <div className="text-center py-8 space-y-3 text-xs">
                  <Package size={36} className="mx-auto text-[#c5a059]" />
                  <div>
                    <strong className="text-sm font-serif text-[#1e1b18] block">No Orders Yet</strong>
                    <p className="text-[#706458] mt-1">You haven't placed any couture orders yet. Discover our latest creations!</p>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      document.getElementById("catalog-section")?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="px-5 py-2 bg-[#0d4f3c] text-white font-bold rounded-full text-xs"
                  >
                    Browse Collections
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {customerOrders.map((order) => {
                    const totalVal = order.totalAmount ?? order.total ?? 0;
                    const statusStr = (order.status || order.orderStatus || "pending").replace("_", " ");
                    const pMethod = (order.paymentMethod || "COD").toUpperCase();
                    const isPaid = order.paymentStatus === "Paid";
                    const isVerifying = order.paymentStatus === "Payment Verification Pending";
                    const isPending = !isPaid && !isVerifying;
                    const isPayOpen = activeHistoryPayOrder === order.id;
                    const isSubmitting = historyUtrSubmitting[order.id];
                    const isSuccess = historyUtrSuccess[order.id];

                    return (
                      <div key={order.id} className="bg-white p-3.5 rounded-xl border border-[#ebe2d8] space-y-2.5 shadow-2xs">
                        <div className="flex justify-between items-center text-xs">
                          <strong className="text-[#8c6d37] font-mono">#{order.orderNumber}</strong>
                          <span className="bg-[#0d4f3c]/10 text-[#0d4f3c] text-[11px] font-bold px-2 py-0.5 rounded-full capitalize border border-[#0d4f3c]/20">
                            {statusStr}
                          </span>
                        </div>

                        <div>
                          <p className="text-sm font-semibold text-[#1e1b18]">
                            {order.items.map((i) => i.name || i.productName || "Couture Ensemble").join(", ")}
                          </p>
                          <span className="text-[0.7rem] text-[#706458] block mt-0.5">
                            Placed on {new Date(order.createdAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>

                        {/* Payment Status & Details */}
                        <div className="bg-[#fcfaf7] p-2.5 rounded-lg border border-[#f0e8dc] text-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[#63594e] font-medium flex items-center gap-1.5">
                              <CreditCard size={13} className="text-[#8c6d37]" />
                              <span>Payment:</span>
                            </span>

                            {isPaid ? (
                              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                                <CheckCircle2 size={10} /> Paid & Confirmed
                              </span>
                            ) : isVerifying || isSuccess ? (
                              <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                                <Clock size={10} /> Verification Pending
                              </span>
                            ) : (
                              <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-rose-200 flex items-center gap-1">
                                <AlertCircle size={10} /> Payment Pending
                              </span>
                            )}
                          </div>

                          {(order.utrNumber || (isSuccess && historyUtrInputs[order.id])) && (
                            <div className="flex items-center justify-between text-[11px] text-[#63594e] bg-white px-2 py-1 rounded border border-[#ebe2d8]">
                              <span>UTR Reference:</span>
                              <strong className="font-mono text-[#0d4f3c]">
                                {order.utrNumber || historyUtrInputs[order.id]}
                              </strong>
                            </div>
                          )}

                          {isPending && !isSuccess && (
                            <div className="pt-1">
                              <button
                                type="button"
                                onClick={() => setActiveHistoryPayOrder(isPayOpen ? null : order.id)}
                                className="text-[11px] font-bold text-[#0d4f3c] hover:underline flex items-center gap-1"
                              >
                                <span>{isPayOpen ? "Hide Payment & UTR" : "Pay via UPI / Submit UTR →"}</span>
                              </button>

                              {isPayOpen && (
                                <div className="mt-2 space-y-2 pt-2 border-t border-[#f0e8dc]">
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="text-[#706458]">
                                      UPI ID: <strong className="text-[#0d4f3c]">{siteContent?.upiId || "shriyapusha01-1@okaxis"}</strong> (House of Shriya)
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(siteContent?.upiId || "shriyapusha01-1@okaxis");
                                        setCopiedUpiId(true);
                                        setTimeout(() => setCopiedUpiId(false), 2000);
                                      }}
                                      className="text-[10px] text-[#0d4f3c] font-bold hover:underline flex items-center gap-1"
                                    >
                                      {copiedUpiId ? <Check size={10} className="text-emerald-600" /> : <Copy size={10} />}
                                      <span>{copiedUpiId ? "Copied" : "Copy"}</span>
                                    </button>
                                  </div>

                                  <form onSubmit={(e) => handleHistorySubmitUtr(e, order)} className="flex gap-2">
                                    <input
                                      type="text"
                                      placeholder="Enter 12-digit UTR #"
                                      value={historyUtrInputs[order.id] || ""}
                                      onChange={(e) =>
                                        setHistoryUtrInputs((prev) => ({ ...prev, [order.id]: e.target.value }))
                                      }
                                      required
                                      className="flex-1 px-2.5 py-1 text-xs bg-white border border-[#d6ccc2] rounded-lg focus:outline-none focus:border-[#0d4f3c]"
                                    />
                                    <button
                                      type="submit"
                                      disabled={isSubmitting}
                                      className="px-3 py-1 bg-[#0d4f3c] text-white font-bold rounded-lg hover:bg-[#083528] transition-colors text-xs shrink-0 disabled:opacity-50"
                                    >
                                      {isSubmitting ? "Submitting..." : "Submit UTR"}
                                    </button>
                                  </form>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center justify-between pt-2 border-t border-[#f5efeb] text-xs gap-2">
                          <span className="text-[#706458] font-medium">
                            Total: <strong className="text-[#1e1b18]">₹{totalVal.toLocaleString()}</strong> ({pMethod})
                          </span>
                          <div className="flex items-center gap-2">
                            <a
                              href={`https://wa.me/919501698356?text=${encodeURIComponent(
                                `Namaste House of Shriya! Inquiry for order #${order.orderNumber} (₹${totalVal.toLocaleString()}).`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#25D366] hover:underline flex items-center gap-1 text-[11px] font-bold"
                              title="WhatsApp Support"
                            >
                              <MessageCircle size={12} />
                              <span>WhatsApp</span>
                            </a>
                            <button
                              type="button"
                              onClick={() => {
                                setSearchedOrder(order);
                                setTrackSearchQuery(order.orderNumber);
                                switchModal("track_order");
                              }}
                              className="px-2.5 py-1 bg-[#0d4f3c] hover:bg-[#083427] text-white font-bold rounded-lg text-xs transition-colors flex items-center gap-1"
                            >
                              <Truck size={12} />
                              <span>Track Package →</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              /* ATELIER BOOKINGS LIST */
              atelierBookings.length === 0 ? (
                <div className="text-center py-8 space-y-3 text-xs">
                  <Clock size={36} className="mx-auto text-[#c5a059]" />
                  <div>
                    <strong className="text-sm font-serif text-[#1e1b18] block">No Atelier Bookings Yet</strong>
                    <p className="text-[#706458] mt-1">
                      Schedule a virtual drape consultation or boutique fitting session with our couture specialists.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsBookingOpen(true)}
                    className="px-5 py-2 bg-[#0d4f3c] text-white font-bold rounded-full text-xs"
                  >
                    Schedule Booking
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {atelierBookings.map((bk) => (
                    <div key={bk.id} className="bg-white p-3.5 rounded-xl border border-[#ebe2d8] space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-mono font-bold text-[#8c6d37]">{bk.bookingNumber}</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold uppercase text-[10px]">
                          {bk.status}
                        </span>
                      </div>
                      <strong className="text-sm font-serif text-[#1e1b18] block">{bk.serviceType}</strong>
                      <div className="flex items-center gap-3 text-[#706458] text-[11px]">
                        <span>📅 {bk.preferredDate}</span>
                        <span>⏰ {bk.preferredTime}</span>
                        <span>📞 {bk.phone}</span>
                      </div>
                      {bk.notes && (
                        <p className="text-[11px] text-[#8c827a] italic pt-1 border-t border-[#f5efeb]">
                          "{bk.notes}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        );
      }

      case "profile": {
        if (!currentUser) {
          return (
            <div className="text-center py-8 space-y-3 text-xs">
              <User size={36} className="mx-auto text-[#c5a059]" />
              <div>
                <strong className="text-sm font-serif text-[#1e1b18] block">Customer Login Required</strong>
                <p className="text-[#706458] mt-1">Please sign in to access your patron profile and privileges.</p>
              </div>
              {onOpenAuth && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAuth();
                  }}
                  className="px-5 py-2 bg-[#0d4f3c] text-white font-bold rounded-full text-xs"
                >
                  Sign In / Register
                </button>
              )}
            </div>
          );
        }

        const initials = (customerProfile?.fullName || currentUser.displayName || currentUser.email || "P")
          .split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();

        return (
          <div className="space-y-3.5 text-xs">
            <div className="flex items-center gap-3 p-3 bg-[#f5efeb] rounded-xl">
              <div className="w-11 h-11 rounded-full bg-[#0d4f3c] text-[#d4af37] flex items-center justify-center font-serif text-base font-bold">
                {initials}
              </div>
              <div>
                <strong className="text-sm font-serif text-[#1e1b18] block">
                  {customerProfile?.fullName || currentUser.displayName || "Atelier Patron"}
                </strong>
                <span className="text-[#8c6d37]">
                  {currentUser.email || "No email"} {customerProfile?.phone ? `· +91 ${customerProfile.phone}` : ""}
                </span>
              </div>
            </div>

            <div className="p-3 bg-white border border-[#ebe2d8] rounded-xl space-y-1.5">
              <strong className="text-xs text-[#1e1b18] block">Atelier Attire Preference</strong>
              <div className="grid grid-cols-2 gap-2 text-[#706458]">
                <span>Attire: <strong>100% Unstitched Luxury Suits</strong></span>
                <span>Cut Preference: <strong>{customerProfile?.sizingProfile?.cutPreference || "Classic Atelier"}</strong></span>
                <span>Fabric Craft: <strong>Surat Handloom Weave</strong></span>
                <span>Dupatta Drape: <strong>Artisan Handloom</strong></span>
              </div>
            </div>

            <div className="p-3 bg-white border border-[#ebe2d8] rounded-xl flex items-center justify-between">
              <div>
                <strong className="text-xs text-[#1e1b18] block">VIP Atelier Tier</strong>
                <span className="text-[#706458]">
                  {customerProfile?.tier || "Gold"} Heirloom Member ({customerOrders.length * 500 + 1000} points)
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-[#f4ecd8] text-[#7a4e12] font-bold">
                {customerProfile?.tier || "Gold"}
              </span>
            </div>

            {/* Referral Privilege Summary */}
            <div className="p-3.5 bg-gradient-to-br from-[#fdfbf7] to-[#f5eee6] border border-[#d4af37]/40 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-[#0d4f3c]">
                  <Gift size={16} />
                  <span>Referral Code: <span className="font-mono text-[#1e1b18]">{customerProfile?.referralCode || "ACTIVE"}</span></span>
                </div>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                  Earn ₹100 / Friend
                </span>
              </div>
              <p className="text-[11px] text-[#706458]">
                Share with friends to give ₹100 instant discount and earn ₹100 rewards on their first suit order.
              </p>
              <div className="flex items-center justify-between pt-1 border-t border-[#e8dfd8] text-[11px]">
                <span>Rewards Earned: <strong className="text-emerald-700">₹{customerProfile?.referralEarnings || 0}</strong></span>
                <span>Referrals: <strong>{customerProfile?.referralCount || 0}</strong></span>
              </div>
            </div>

            <button
              type="button"
              onClick={async () => {
                await customerSignOut();
                onClose();
              }}
              className="w-full py-2 bg-rose-50 border border-rose-200 text-rose-700 font-bold rounded-lg hover:bg-rose-100 transition-colors flex items-center justify-center gap-1.5"
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        );
      }

      case "referral": {
        // Retrieve or generate referral code for logged-in patron or guest visitor
        let myRefCode = customerProfile?.referralCode || "";
        if (!myRefCode && currentUser) {
          myRefCode = generateCustomerReferralCode(currentUser.displayName || currentUser.email, currentUser.uid);
          updateProfileDetails({ referralCode: myRefCode }).catch(() => {});
        } else if (!myRefCode && !currentUser) {
          const storedGuest = localStorage.getItem("hos_guest_referral_code");
          if (storedGuest) {
            myRefCode = storedGuest;
          } else {
            myRefCode = generateCustomerReferralCode("PATRON", String(Date.now()));
            try {
              localStorage.setItem("hos_guest_referral_code", myRefCode);
            } catch {}
          }
        }

        const shareUrl = `${window.location.origin}/?ref=${myRefCode}`;
        const whatsappShareText = `Namaste! Use my House of Shriya referral code *${myRefCode}* to get ₹100 instant discount on your order: ${shareUrl}`;

        const handleCopyCode = () => {
          if (!myRefCode) return;
          navigator.clipboard.writeText(myRefCode);
          setReferralCopied(true);
          setTimeout(() => setReferralCopied(false), 2500);
        };

        return (
          <div className="space-y-4 text-xs">
            {/* Promo Header Banner */}
            <div className="p-4 bg-gradient-to-br from-[#f8f5ee] to-[#ece3d4] border border-[#d4af37]/40 rounded-xl space-y-1.5 text-center">
              <span className="text-[10px] font-bold tracking-widest text-[#0d4f3c] uppercase block">
                PATRON PRIVILEGE PROGRAM
              </span>
              <h3 className="font-serif font-bold text-lg text-[#1e1b18]">
                Give ₹100, Get ₹100
              </h3>
              <p className="text-[11px] text-[#63594e] max-w-sm mx-auto leading-relaxed">
                Invite friends and family to House of Shriya. When they log in or order using your referral code, they get <strong className="text-[#0d4f3c]">₹100 instant discount</strong>, and you earn ₹100 in atelier rewards!
              </p>
            </div>

            {/* Unique Referral Code Card */}
            <div className="p-4 bg-white border border-[#ebe2d8] rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#1e1b18] block">Your Unique Referral Code</span>
                <span className="text-[10px] text-[#0d4f3c] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                  Active
                </span>
              </div>
              <div className="flex items-center justify-between bg-[#f5efeb] border border-[#e2d5c5] rounded-xl p-3">
                <span className="font-mono text-base font-bold text-[#0d4f3c] tracking-widest select-all">
                  {myRefCode || "HOS-VIP100"}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#0d4f3c] text-white font-bold text-xs hover:bg-[#083528] transition-colors shadow-xs"
                >
                  {referralCopied ? (
                    <>
                      <Check size={14} className="text-emerald-300" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(whatsappShareText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 rounded-lg bg-[#25D366] text-white font-bold text-xs flex items-center justify-center gap-2 hover:bg-[#1faa53] transition-colors"
                >
                  <MessageCircle size={15} />
                  <span>Share on WhatsApp</span>
                </a>
                <button
                  type="button"
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({
                        title: "House of Shriya - Luxury Suits & Sarees",
                        text: whatsappShareText,
                        url: shareUrl,
                      }).catch(() => {});
                    } else {
                      handleCopyCode();
                    }
                  }}
                  className="w-full py-2.5 rounded-lg bg-[#f4eee6] border border-[#dcd2c4] text-[#1e1b18] font-bold text-xs flex items-center justify-center gap-2 hover:bg-[#ece2d4] transition-colors"
                >
                  <Share2 size={15} className="text-[#0d4f3c]" />
                  <span>Share Link</span>
                </button>
              </div>
            </div>

            {/* If unauthenticated, offer 1-click sign in to permanently save rewards */}
            {!currentUser && onOpenAuth && (
              <div className="p-3.5 bg-[#f9f7f4] border border-[#e8dfd5] rounded-xl flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-semibold text-[#1e1b18] block">Save Your Referral Earnings</span>
                  <p className="text-[11px] text-[#706458] mt-0.5">
                    Sign in to track your ₹100 rewards balance and view orders in one place.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAuth();
                  }}
                  className="px-3.5 py-1.5 bg-[#0d4f3c] text-white font-bold text-xs rounded-full hover:bg-[#083528] shrink-0"
                >
                  Sign In
                </button>
              </div>
            )}

            {/* Performance Stats (for logged in patrons) */}
            {currentUser && (
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 bg-white border border-[#ebe2d8] rounded-xl text-center">
                  <span className="text-[10px] uppercase tracking-wider text-[#706458] font-semibold block">
                    Friends Referred
                  </span>
                  <strong className="text-xl font-serif text-[#0d4f3c] block mt-1">
                    {customerProfile?.referralCount || 0}
                  </strong>
                  <span className="text-[10px] text-[#8c6d37]">Patrons Joined</span>
                </div>
                <div className="p-3.5 bg-white border border-[#ebe2d8] rounded-xl text-center">
                  <span className="text-[10px] uppercase tracking-wider text-[#706458] font-semibold block">
                    Rewards Earned
                  </span>
                  <strong className="text-xl font-serif text-emerald-700 block mt-1">
                    ₹{customerProfile?.referralEarnings || 0}
                  </strong>
                  <span className="text-[10px] text-emerald-800">Available Balance</span>
                </div>
              </div>
            )}

            {/* Available Discount Banner */}
            {customerProfile?.referralDiscountAvailable && customerProfile.referralDiscountAvailable > 0 ? (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-3 flex items-center gap-2.5">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <div className="text-xs leading-relaxed">
                  <strong>₹100 Referral Discount Active:</strong> Will be automatically applied to your cart at checkout!
                </div>
              </div>
            ) : null}

            {/* Program Details */}
            <div className="p-3.5 bg-[#faf8f5] border border-[#ebe2d8] rounded-xl space-y-2">
              <strong className="text-xs text-[#1e1b18] block font-serif">How the Referral Program Works:</strong>
              <div className="space-y-1.5 text-[11px] text-[#706458]">
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#0d4f3c] text-white text-[9px] flex items-center justify-center shrink-0 font-bold mt-0.5">1</span>
                  <span>Click & copy your personal referral code or share directly via WhatsApp with friends.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#0d4f3c] text-white text-[9px] flex items-center justify-center shrink-0 font-bold mt-0.5">2</span>
                  <span>When anyone logs in or orders using your code, they get <strong>₹100 instant discount</strong>.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#0d4f3c] text-white text-[9px] flex items-center justify-center shrink-0 font-bold mt-0.5">3</span>
                  <span>Strict rule: Each customer ID / account can redeem a referral code exactly once.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#0d4f3c] text-white text-[9px] flex items-center justify-center shrink-0 font-bold mt-0.5">4</span>
                  <span>When their order is placed, your account is credited with ₹100 in atelier rewards!</span>
                </div>
              </div>
            </div>
          </div>
        );
      }

      case "addresses": {
        if (!currentUser) {
          return (
            <div className="text-center py-8 space-y-3 text-xs">
              <MapPin size={36} className="mx-auto text-[#c5a059]" />
              <div>
                <strong className="text-sm font-serif text-[#1e1b18] block">Sign In to View Addresses</strong>
                <p className="text-[#706458] mt-1">Save your shipping addresses for seamless 1-click checkout.</p>
              </div>
              {onOpenAuth && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAuth();
                  }}
                  className="px-5 py-2 bg-[#0d4f3c] text-white font-bold rounded-full text-xs"
                >
                  Sign In / Register
                </button>
              )}
            </div>
          );
        }

        const addresses = customerProfile?.savedAddresses || [];

        return (
          <div className="space-y-3">
            {addresses.map((addr) => (
              <div
                key={addr.id}
                className={`p-3.5 bg-white rounded-xl border ${
                  addr.isDefault ? "border-2 border-[#0d4f3c]" : "border-[#ebe2d8]"
                } space-y-1 text-xs relative`}
              >
                <div className="flex justify-between items-center">
                  <strong className="text-sm text-[#1e1b18] flex items-center gap-1.5">
                    <MapPin size={14} className="text-[#0d4f3c]" /> {addr.label} ({addr.fullName})
                  </strong>
                  <div className="flex items-center gap-2">
                    {addr.isDefault && (
                      <span className="bg-[#0d4f3c] text-white text-[0.65rem] px-2 py-0.5 rounded-full font-bold">
                        Default
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteAddress(addr.id)}
                      className="text-rose-500 hover:text-rose-700 p-1"
                      title="Delete address"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <p className="text-[#706458]">{addr.addressLine1}, {addr.city}, {addr.state} - {addr.pincode}</p>
                <span className="text-[#1e1b18] font-semibold block pt-1">Phone: +91 {addr.phone}</span>
              </div>
            ))}

            {isAddingAddress ? (
              <form onSubmit={handleSaveNewAddress} className="bg-[#fcfaf7] p-3.5 rounded-xl border border-[#ebe2d8] space-y-2 text-xs">
                <strong className="text-xs text-[#1e1b18] block">Add New Delivery Address</strong>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Full Name"
                    required
                    value={newAddr.fullName}
                    onChange={(e) => setNewAddr({ ...newAddr, fullName: e.target.value })}
                    className="p-2 border border-[#ebe2d8] rounded bg-white"
                  />
                  <input
                    type="tel"
                    placeholder="Phone (10 digits)"
                    required
                    value={newAddr.phone}
                    onChange={(e) => setNewAddr({ ...newAddr, phone: e.target.value })}
                    className="p-2 border border-[#ebe2d8] rounded bg-white"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Street / Flat / Colony"
                  required
                  value={newAddr.addressLine1}
                  onChange={(e) => setNewAddr({ ...newAddr, addressLine1: e.target.value })}
                  className="w-full p-2 border border-[#ebe2d8] rounded bg-white"
                />
                <div className="grid grid-cols-3 gap-2">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="PIN Code"
                      required
                      maxLength={6}
                      value={newAddr.pincode}
                      onChange={(e) => handleAddrPincodeChange(e.target.value)}
                      className="w-full p-2 border border-[#ebe2d8] rounded bg-white"
                    />
                    {addrPincodeLoading && (
                      <Loader2 size={12} className="absolute right-2 top-3 animate-spin text-[#0d4f3c]" />
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="City"
                    required
                    value={newAddr.city}
                    onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })}
                    className="p-2 border border-[#ebe2d8] rounded bg-white"
                  />
                  <input
                    type="text"
                    placeholder="State"
                    required
                    value={newAddr.state}
                    onChange={(e) => setNewAddr({ ...newAddr, state: e.target.value })}
                    className="p-2 border border-[#ebe2d8] rounded bg-white"
                  />
                </div>
                {addrPincodeFeedback && (
                  <div className="text-[11px] text-[#0d4f3c] bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md flex items-center gap-1.5 font-medium">
                    <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                    <span>{addrPincodeFeedback}</span>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-[#0d4f3c] text-white font-bold rounded-lg"
                  >
                    Save Address
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingAddress(false)}
                    className="px-3 py-2 bg-gray-200 text-gray-700 font-bold rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setIsAddingAddress(true)}
                className="w-full py-2.5 border-2 border-dashed border-[#c5a059] text-[#8c6d37] font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 hover:bg-[#fdfbf7] transition-colors"
              >
                <Plus size={14} />
                <span>Add New Address</span>
              </button>
            )}
          </div>
        );
      }

      case "payments": {
        return (
          <div className="space-y-3 text-xs">
            <div className="p-3 bg-white border border-[#ebe2d8] rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#f5efeb] flex items-center justify-center text-[#0d4f3c]">
                  <CreditCard size={17} />
                </div>
                <div>
                  <strong className="text-xs text-[#1e1b18] block">Instant UPI Payment</strong>
                  <span className="text-[#706458]">Google Pay, PhonePe, Paytm, BHIM & Any UPI ID</span>
                </div>
              </div>
              <span className="text-[#0d4f3c] font-bold">Supported ✓</span>
            </div>

            <div className="p-3 bg-white border border-[#ebe2d8] rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#f5efeb] flex items-center justify-center text-[#7a4e12]">
                  <CreditCard size={17} />
                </div>
                <div>
                  <strong className="text-xs text-[#1e1b18] block">Credit & Debit Cards</strong>
                  <span className="text-[#706458]">Visa, MasterCard, RuPay, American Express & Net Banking</span>
                </div>
              </div>
              <span className="text-[#0d4f3c] font-bold">Supported ✓</span>
            </div>
          </div>
        );
      }

      case "shipping_policy": {
        return (
          <div className="space-y-3 text-xs text-[#1e1b18]">
            <div className="p-3 bg-white border border-[#ebe2d8] rounded-xl space-y-2">
              <strong className="text-sm font-serif block text-[#0d4f3c]">Atelier Shipping & Delivery Policy</strong>
              <p className="text-[#706458] leading-relaxed">
                Every House of Shriya ensemble undergoes artisanal quality checks before dispatch.
              </p>
              <div className="pt-2 border-t border-[#f5efeb] space-y-1.5 text-[#706458]">
                <p>✦ <strong>Domestic Shipping:</strong> Delivered within 4–7 business days via air cargo.</p>
                <p>✦ <strong>Artisan Inspection:</strong> Hand-inspected with artisanal care before dispatch.</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-full bg-[#0d4f3c] text-white font-bold"
            >
              Close
            </button>
          </div>
        );
      }

      case "support":
        return (
          <div className="space-y-4 text-xs text-[#1e1b18] py-2">
            <div className="p-4 bg-white border border-[#ebe2d8] rounded-xl space-y-3">
              <p className="text-[#1e1b18] font-medium leading-relaxed text-sm">
                Customer Support & Atelier Concierge is available Monday to Sunday.
              </p>
              <div className="pt-2 border-t border-[#f5efeb] flex flex-col gap-2.5 text-sm">
                <a
                  href={`https://wa.me/${(siteContent?.whatsappNumber || "919501698356").replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 text-[#0d4f3c] font-semibold hover:underline"
                >
                  <MessageCircle size={17} className="text-[#25D366] shrink-0" />
                  <span>{siteContent?.contactPhone || "+91 95016 98356"}</span>
                </a>
                <a
                  href={`mailto:${siteContent?.contactEmail || "shriyapusha01@gmail.com"}`}
                  className="flex items-center gap-2.5 text-[#0d4f3c] font-semibold hover:underline"
                >
                  <Mail size={17} className="text-[#c5a059] shrink-0" />
                  <span>{siteContent?.contactEmail || "shriyapusha01@gmail.com"}</span>
                </a>
                <div className="flex items-start gap-2 text-stone-600 text-xs pt-1 border-t border-stone-100">
                  <MapPin size={16} className="text-[#0d4f3c] shrink-0 mt-0.5" />
                  <span>{siteContent?.atelierAddress || "1908/2 Ahluwalia Street, Near Arna Barna Chowk, Patiala, Punjab - 147001"}</span>
                </div>
              </div>
            </div>

            <a
              href={`https://wa.me/${(siteContent?.whatsappNumber || "919501698356").replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 rounded-full bg-[#25D366] hover:bg-[#20ba59] text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors shadow-xs"
            >
              <MessageCircle size={16} />
              <span>Open WhatsApp</span>
            </a>
          </div>
        );

      case "settings":
      case "notifications":
      case "privacy":
      default:
        return (
          <div className="space-y-3 text-xs text-[#1e1b18] p-2">
            <p className="text-[#706458]">Your atelier preferences are active and secured.</p>
            <button
              onClick={onClose}
              className="w-full py-2 rounded-full bg-[#0d4f3c] text-white font-semibold mt-2"
            >
              Close
            </button>
          </div>
        );
    }
  };

  const getTitle = () => {
    switch (activeModalType || type) {
      case "track_order":
        return "Live Order Tracking";
      case "order_history":
        return "My Order History";
      case "profile":
        return "My Atelier Profile";
      case "referral":
        return "Refer & Earn ₹100";
      case "addresses":
        return "Saved Addresses";
      case "payments":
        return "Payment Methods";
      case "notifications":
        return "Notification Preferences";
      case "privacy":
        return "Privacy & Security";
      case "shipping_policy":
        return "Shipping Policy";
      case "support":
        return "Contact Us";
      default:
        return "Atelier Concierge";
    }
  };

  return (
    <div className="interactive-modal-backdrop" onClick={onClose}>
      <div className="interactive-modal" onClick={(e) => e.stopPropagation()}>
        <div className="interactive-modal-header">
          <strong className="text-sm font-serif text-[#faf8f5] tracking-wider">{getTitle()}</strong>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
          >
            <X size={15} />
          </button>
        </div>
        <div className="interactive-modal-body">{renderContent()}</div>
      </div>
    </div>
  );
}

export function StoreHeader({
  onPookie,
  onOpenDrawer,
  onOpenAuth,
  onOpenModal,
  searchQuery,
  onSearchChange,
  wishlistCount,
  onSelectCategory,
}: {
  onPookie: () => void;
  onOpenDrawer: () => void;
  onOpenAuth?: () => void;
  onOpenModal?: (type: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  wishlistCount: number;
  onSelectCategory?: (category: string) => void;
}) {
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const { siteContent, totalCartCount, setIsCartOpen, currentUser, customerProfile } = useStore();

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    } else {
      navigate(`/#${id}`);
    }
  };

  return (
    <header className="store-header">
      {siteContent?.announcementVisible === true &&
       siteContent?.announcementText &&
       siteContent.announcementText.trim() !== "" && (
        <div className="announcement-bar">
          <button
            data-editable="true"
            onClick={() => scrollTo("catalog-section")}
            className="announcement-cta"
          >
            <BuilderText
              as="span"
              id="announcement_bar_text"
              fieldPath="announcementText"
              label="Announcement Bar"
              text={`${siteContent.announcementText}${siteContent.announcementCta ? ` · ${siteContent.announcementCta}` : ""}`}
            />
            <ArrowRight size={13} className="shrink-0 inline ml-1" />
          </button>
        </div>
      )}

      <div className="header-main">
        {/* Left Side: Three-line hamburger menu button prominently placed beside Search */}
        <div className="header-left">
          <button
            data-editable="true"
            className="icon-button header-menu-btn"
            aria-label="Open Navigation Menu"
            title="Open E-Commerce Menu"
            onClick={onOpenDrawer}
          >
            <Menu size={20} />
          </button>

          <div className={`search-box ${searchOpen ? "search-box-open" : ""}`}>
            <Search size={15} />
            <input
              data-editable="true"
              aria-label="Search products"
              placeholder="Search suits, silks, fabrics..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  document.getElementById("catalog-section")?.scrollIntoView({ behavior: "smooth" });
                }
              }}
            />
          </div>

          <button
            data-editable="true"
            className="icon-button mobile-search"
            aria-label="Search"
            onClick={() => setSearchOpen(!searchOpen)}
          >
            <Search size={18} />
          </button>

          <button
            data-editable="true"
            className="header-pill track-pill"
            onClick={() => (onOpenModal ? onOpenModal("track_order") : onOpenDrawer())}
          >
            <Truck size={14} /> <BuilderText as="span" id="nav_track_order" label="Track Order Pill" text="Track Order" />
          </button>
        </div>

        {/* Center: Brand Lockup */}
        <Link to="/" className="brand-lockup" aria-label="House of Shriya home">
          <LogoMark small />
          <span className="brand-title">
            <BuilderText as="span" id="brand_title_header" label="Brand Logo Title" type="brand" text="House of Shriya" />
          </span>
        </Link>

        {/* Right Side: Quick Action Pills & Icons */}
        <div className="header-right">
          {/* Quick Track Order Icon Button on Right Side */}
          <button
            data-editable="true"
            className="icon-button header-action track-header-btn"
            aria-label="Track Order & Shipment"
            title="Track Order & Shipment"
            onClick={() => (onOpenModal ? onOpenModal("track_order") : onOpenDrawer())}
          >
            <Truck size={18} />
          </button>

          <button data-editable="true" className="refer-pill" onClick={() => onOpenModal ? onOpenModal("referral") : onOpenDrawer()}>
            <Gift size={14} />
            <span data-editable="true"><BuilderText as="span" text="Refer & Earn" /> <BuilderText as="b" text="₹100" /></span>
          </button>
          
          <button
            data-editable="true"
            className="pookie-pill"
            onClick={onPookie}
            aria-label="Ask Pookie Styling Concierge"
            title="Ask Pookie Styling Concierge"
          >
            <Sparkles size={15} className="pookie-icon" />
            <span className="pookie-label">
              <BuilderText as="span" className="pookie-ask" text="Ask" />{" "}
              <BuilderText as="span" text="Pookie" />
            </span>
            <i />
          </button>

          <button
            data-editable="true"
            className="icon-button header-action wishlist-header-btn"
            aria-label={`Wishlist with ${wishlistCount} saved items`}
            title={`Wishlist (${wishlistCount} saved items)`}
            onClick={() => {
              if (onSelectCategory) {
                onSelectCategory("Wishlist");
              }
              scrollTo("catalog-section");
            }}
          >
            <Heart size={18} />
            <span
              className={`wishlist-badge ${wishlistCount === 0 ? "wishlist-badge-empty" : ""}`}
              id="header-wishlist-badge"
              aria-label={`${wishlistCount} saved items`}
              title={`${wishlistCount} saved items`}
            >
              {wishlistCount}
            </span>
          </button>

          {currentUser ? (
            <button
              data-editable="true"
              className="icon-button header-action account-action"
              aria-label="My Account & Orders"
              onClick={() => (onOpenModal ? onOpenModal("order_history") : onOpenDrawer())}
              title={customerProfile?.fullName || currentUser.displayName || "My Orders"}
            >
              <UserRound size={18} />
              <span className="max-w-[75px] truncate font-medium">
                {customerProfile?.fullName?.split(" ")[0] || currentUser.displayName?.split(" ")[0] || "Orders"}
              </span>
            </button>
          ) : (
            <button
              data-editable="true"
              className="icon-button header-action account-action"
              aria-label="Customer Login"
              onClick={onOpenAuth || onOpenDrawer}
              title="Sign In / Register"
            >
              <UserRound size={18} />
              <span>Login</span>
            </button>
          )}

          <button
            data-editable="true"
            className="bag-button"
            aria-label={`Shopping Bag with ${totalCartCount} items`}
            title="Open Shopping Bag"
            onClick={() => setIsCartOpen(true)}
          >
            <ShoppingBag size={17} />
            <BuilderText as="span" text={String(totalCartCount)} />
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="mobile-search-bar">
          <Search size={16} className="text-[#c5a059] shrink-0" />
          <input
            data-editable="true"
            type="text"
            placeholder="Search suits, silks, fabrics..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                document.getElementById("catalog-section")?.scrollIntoView({ behavior: "smooth" });
                setSearchOpen(false);
              }
            }}
          />
          <button
            onClick={() => setSearchOpen(false)}
            aria-label="Close search"
            type="button"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </header>
  );
}

function Hero({ onPookie }: { onPookie: () => void }) {
  const { siteContent } = useStore();
  const [activeSlide, setActiveSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [liveSlides, setLiveSlides] = useState<HeroSlide[] | null>(() => siteContent?.heroSlides || null);
  const [forceTick, setForceTick] = useState(0);

  // Sync with store updates
  useEffect(() => {
    if (siteContent?.heroSlides && siteContent.heroSlides.length > 0) {
      setLiveSlides(siteContent.heroSlides);
    }
  }, [siteContent]);

  // Instant storefront reactivity for live admin updates
  useEffect(() => {
    const handleUpdate = (e: any) => {
      if (e?.detail?.heroSlides && Array.isArray(e.detail.heroSlides) && e.detail.heroSlides.length > 0) {
        setLiveSlides(e.detail.heroSlides);
      }
      setForceTick((t) => t + 1);
    };
    window.addEventListener("hos-content-updated", handleUpdate);
    return () => window.removeEventListener("hos-content-updated", handleUpdate);
  }, []);

  const activeSlides = useMemo(() => {
    const slidesToUse = liveSlides && liveSlides.length > 0 ? liveSlides : siteContent?.heroSlides;
    if (slidesToUse && slidesToUse.length > 0) {
      return slidesToUse.map((s, idx) => {
        const fallback = slides[idx % slides.length] || slides[0];
        return {
          eyebrow: s.eyebrow !== undefined ? s.eyebrow : fallback.eyebrow,
          number: s.number || `0${idx + 1}`,
          collection: s.collection !== undefined ? s.collection : fallback.collection,
          title: s.title !== undefined ? s.title : fallback.title,
          description: s.description !== undefined ? s.description : fallback.description,
          image: normalizeImageUrl(s.image) || s.image || fallback.image,
          season: s.season !== undefined ? s.season : fallback.season,
          caption: s.caption !== undefined ? s.caption : fallback.caption,
          mood: s.mood !== undefined ? s.mood : fallback.mood,
          ctaText: s.ctaText !== undefined ? s.ctaText : fallback.ctaText,
          ctaTarget: s.ctaTarget || fallback.ctaTarget || "catalog-section",
        };
      });
    }
    return slides;
  }, [siteContent, liveSlides, forceTick]);

  useEffect(() => {
    if (activeSlides.length <= 1 || isPaused) return;
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % activeSlides.length);
    }, 5500);
    return () => clearInterval(timer);
  }, [activeSlides.length, isPaused]);

  const slideIndex = activeSlide % activeSlides.length;
  const slide = activeSlides[slideIndex] || activeSlides[0];

  return (
    <section
      className="hero-section"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="hero-glow hero-glow-left" />
      <div className="hero-glow hero-glow-right" />
      <div className="hero-dots" />
      <BuilderText as="div" className="hero-word" text="SHRIYA" />
      <div className="site-container hero-container">
        <div className="hero-meta">
          <div data-editable="true">
            <span className="ping-dot" />
            <BuilderText as="strong" text="HOUSE OF SHRIYA" />
            <i><BuilderText as="span" text="·" /></i>
          </div>
          <div className="hero-meta-pills"><BuilderText as="span" text="Pure Fabrics" /><BuilderText as="span" text="Unstitched Set" /><BuilderText as="span" text="100% handloom" /></div>
        </div>
        <div className="hero-grid">
          <div className="hero-copy" key={`hero_copy_${slideIndex}_${slide.title}_${slide.number}`}>
            <div data-editable="true" className="hero-eyebrow">
              <Sparkles size={13} />{" "}
              <BuilderText
                as="span"
                id={`hero_slide_${slideIndex}_eyebrow`}
                key={`eyebrow_${slideIndex}_${slide.eyebrow}`}
                fieldPath={`heroSlides[${slideIndex}].eyebrow`}
                label="Hero Eyebrow"
                text={slide.eyebrow}
              />
            </div>
            <BuilderText
              as="p"
              id={`hero_slide_${slideIndex}_collection`}
              key={`collection_${slideIndex}_${slide.collection}`}
              className="hero-collection"
              fieldPath={`heroSlides[${slideIndex}].collection`}
              label="Hero Collection"
              text={slide.collection}
            />
            <BuilderText
              as="h1"
              id={`hero_slide_${slideIndex}_title`}
              key={`title_${slideIndex}_${slide.title}`}
              fieldPath={`heroSlides[${slideIndex}].title`}
              label="Hero Headline"
              type="heading"
              text={slide.title}
            />
            <BuilderText
              as="p"
              id={`hero_slide_${slideIndex}_desc`}
              key={`desc_${slideIndex}_${slide.description}`}
              className="hero-description"
              fieldPath={`heroSlides[${slideIndex}].description`}
              label="Hero Description"
              text={slide.description}
            />
            <div className="material-pills">
              <span data-editable="true">
                <Sparkles size={13} /> <BuilderText as="span" text="Pure Banarasi Katan · 100% Handloom" />
              </span>
              <span data-editable="true">
                <Sparkles size={13} /> <BuilderText as="span" text="Soft & Elegant" />
              </span>
            </div>
            <div className="hero-actions">
              <button
                data-editable="true"
                className="primary-action"
                onClick={() => {
                  const targetId = slide.ctaTarget || "catalog-section";
                  if (targetId.startsWith("#")) {
                    document.querySelector(targetId)?.scrollIntoView({ behavior: "smooth" });
                  } else if (targetId.startsWith("http://") || targetId.startsWith("https://") || targetId.startsWith("/")) {
                    window.location.href = targetId;
                  } else {
                    const el = document.getElementById(targetId);
                    if (el) {
                      el.scrollIntoView({ behavior: "smooth" });
                    } else {
                      document.getElementById("catalog-section")?.scrollIntoView({ behavior: "smooth" });
                    }
                  }
                }}
              >
                <BuilderText
                  as="span"
                  id={`hero_slide_${slideIndex}_cta`}
                  fieldPath={`heroSlides[${slideIndex}].ctaText`}
                  label="Hero Button CTA"
                  type="button"
                  text={slide.ctaText || "Explore Festive Edit"}
                />{" "}
                <ArrowRight size={17} />
              </button>
              <button data-editable="true" className="secondary-action pookie-action" onClick={onPookie}>
                <Sparkles size={15} /> <BuilderText as="span" text="Ask Pookie" />
              </button>
            </div>
            <div className="slide-controls">
              <div className="slide-dots">
                {activeSlides.map((item, index) => (
                  <button
                    data-editable="true"
                    key={item.number || index}
                    aria-label={`Go to slide ${index + 1}`}
                    className={index === slideIndex ? "active" : ""}
                    onClick={() => setActiveSlide(index)}
                  />
                ))}
              </div>
              <div className="slide-arrows">
                <button
                  data-editable="true"
                  aria-label="Previous Slide"
                  onClick={() => setActiveSlide((slideIndex + activeSlides.length - 1) % activeSlides.length)}
                >
                  <ChevronLeft size={17} />
                </button>
                <button
                  data-editable="true"
                  aria-label="Next Slide"
                  onClick={() => setActiveSlide((slideIndex + 1) % activeSlides.length)}
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>
          </div>
          <div className="hero-media-wrap" key={`hero_media_${slideIndex}_${slide.image}`}>
            <div data-editable="true" className="hero-media-label">
              <Crown size={15} /> <BuilderText as="span" text="Haute Couture Edit" />
            </div>
            <div className="hero-media">
              <CanvaEditable
                id={`hero_slide_${slideIndex}_image`}
                as="img"
                type="image"
                label={`Hero Slide ${slideIndex + 1} Photo`}
                src={slide.image}
                alt={slide.title}
                slideIndex={slideIndex}
                fieldPath={`heroSlides[${slideIndex}].image`}
              />
              <div className="media-gradient" />
              <button data-editable="true" className="save-pin">
                <Bookmark size={14} /> <BuilderText as="span" text="Save Pin" />
              </button>
              <div className="hero-caption" key={`caption_${slideIndex}_${slide.caption}_${slide.mood}`}>
                <div>
                  <BuilderText as="strong" text="HOUSE OF SHRIYA COUTURE" />
                  <BuilderText as="span" text={`${slide.number} · ${slide.season}`} />
                </div>
                <BuilderText
                  as="h3"
                  id={`hero_slide_${slideIndex}_caption`}
                  key={`caption_h3_${slideIndex}_${slide.caption}`}
                  fieldPath={`heroSlides[${slideIndex}].caption`}
                  label="Hero Caption"
                  text={slide.caption}
                />
                <BuilderText
                  as="p"
                  id={`hero_slide_${slideIndex}_mood`}
                  key={`mood_${slideIndex}_${slide.mood}`}
                  fieldPath={`heroSlides[${slideIndex}].mood`}
                  label="Hero Mood"
                  text={`✦ Trending on Moodboard: ${slide.mood}`}
                />
              </div>
            </div>
            <div className="atelier-card">
              <div><BuilderText as="span" text="Atelier Detail" /></div>
            </div>
          </div>
        </div>
      </div>
      <FeatureStrip />
    </section>
  );
}

function FeatureStrip() {
  const { siteContent } = useStore();
  const iconMap: Record<string, any> = {
    Crown,
    Sparkles,
    Check,
    PackageCheck,
    Heart,
    ShieldCheck,
    Truck,
    Gift,
    Shirt,
  };

  const defaultFeatures = [
    { icon: Crown, title: "Heritage Craftsmanship", text: "Artisanal hand-woven heirlooms" },
    { icon: Sparkles, title: "100% Pure Handlooms", text: "Authentic Banarasi & Chanderi" },
    { icon: Check, title: "Instant UPI & Cards", text: "Zero-hassle secure checkout" },
    { icon: PackageCheck, title: "Worldwide Express", text: "Fast insured courier delivery" },
  ];

  const featuresToDisplay = useMemo(() => {
    if (Array.isArray(siteContent?.features) && siteContent.features.length > 0) {
      return siteContent.features.map((f, idx) => {
        const fallback = defaultFeatures[idx % defaultFeatures.length];
        const IconComponent = (f.iconName && iconMap[f.iconName]) || fallback.icon;
        return {
          icon: IconComponent,
          title: f.title || fallback.title,
          text: f.text || (f as any).subtitle || fallback.text,
        };
      });
    }
    return defaultFeatures;
  }, [siteContent?.features]);

  return (
    <div className="feature-strip">
      <div className="site-container feature-grid">
        {featuresToDisplay.map(({ icon: Icon, title, text }, i) => (
          <div className="feature-item" key={`${title}-${i}`}>
            <span data-editable="true"><Icon size={17} /></span>
            <div>
              <BuilderText as="strong" text={title} />
              <BuilderText as="small" text={text} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Catalog({
  wishlist,
  onWishlist,
  activeCategory,
  onCategoryChange,
  query,
  onQueryChange,
}: {
  wishlist: Set<string>;
  onWishlist: (id: string) => void;
  activeCategory: string;
  onCategoryChange: (cat: string) => void;
  query: string;
  onQueryChange: (q: string) => void;
}) {
  const { products: dynamicProducts, categories, siteContent, loadingCatalog } = useStore();
  const [sort, setSort] = useState("Featured Couture");

  const categoryPills = useMemo(() => {
    const defaultPills = [
      "All Collections",
      "Wishlist",
      "Cotton Suits",
      "Daily Wear Suits",
      "Co-ord Sets",
      "Party Wear",
      "Festive Wear",
      "Seasonal Drop",
    ];
    if (!categories || categories.length === 0) return defaultPills;
    // Exclude 'Wishlist' and 'All Collections' to prevent duplicate pill keys since they are prepended
    const catNames = categories
      .map((c) => c.name?.trim())
      .filter((n): n is string => Boolean(n) && n !== "Wishlist" && n !== "All Collections");
    return ["All Collections", "Wishlist", ...Array.from(new Set(catNames))];
  }, [categories]);

  const visibleProducts = useMemo(() => {
    const deleted = getLocallyDeletedIds("products");
    const sourceList =
      Array.isArray(dynamicProducts) && (dynamicProducts.length > 0 || !loadingCatalog)
        ? dynamicProducts
        : products;
    const listToFilter = sourceList.filter(
      (p) =>
        p &&
        p.id &&
        !deleted.has(p.id) &&
        !deleted.has((p as any).sku) &&
        (!p.name || !deleted.has(p.name))
    );
    let result = listToFilter.filter((product) => {
      let matchesFilter = true;
      if (activeCategory === "Wishlist") {
        matchesFilter = wishlist.has(product.id);
      } else if (
        !activeCategory ||
        activeCategory === "All Collections" ||
        activeCategory === "All Suits" ||
        activeCategory.toLowerCase() === "all"
      ) {
        matchesFilter = true;
      } else {
        const pCat = (product.category || "").trim().toLowerCase();
        const activeCat = activeCategory.trim().toLowerCase();
        const productTags = (product.tags || []).map((t) => t.trim().toLowerCase());
        matchesFilter =
          pCat === activeCat ||
          productTags.includes(activeCat) ||
          pCat.includes(activeCat) ||
          activeCat.includes(pCat);
      }

      const matchesQuery = `${product.name} ${product.description || ""} ${product.color || ""} ${product.fabricType || ""}`
        .toLowerCase()
        .includes(query.toLowerCase());

      return matchesFilter && matchesQuery;
    });

    if (sort === "Price: Low to High") {
      result = [...result].sort((a, b) => {
        const pA = Number(String(a.price).replace(/[^0-9]/g, "")) || 0;
        const pB = Number(String(b.price).replace(/[^0-9]/g, "")) || 0;
        return pA - pB;
      });
    }
    if (sort === "Price: High to Low") {
      result = [...result].sort((a, b) => {
        const pA = Number(String(a.price).replace(/[^0-9]/g, "")) || 0;
        const pB = Number(String(b.price).replace(/[^0-9]/g, "")) || 0;
        return pB - pA;
      });
    }
    if (sort === "Highest Rated") {
      result = [...result].sort((a, b) => {
        const rA = parseFloat(String(a.rating || "4.8")) || 4.8;
        const rB = parseFloat(String(b.rating || "4.8")) || 4.8;
        return rB - rA;
      });
    }
    return result;
  }, [dynamicProducts, activeCategory, query, sort, wishlist, loadingCatalog]);

  return (
    <section id="catalog-section" className="catalog-section">
      <div className="site-container">
        <div className="catalog-heading">
          <div>
            <BuilderText
              as="p"
              id="catalog_subtitle"
              fieldPath="catalogSubtitle"
              label="Catalog Eyebrow"
              className="section-eyebrow"
              text={
                activeCategory === "Wishlist"
                  ? "Saved Heirloom Favorites"
                  : siteContent?.catalogSubtitle || "All Handcrafted Silks & Suits"
              }
            />
            <BuilderText
              as="h2"
              id="catalog_title"
              fieldPath="catalogTitle"
              label="Catalog Title"
              type="heading"
              text={
                activeCategory === "Wishlist"
                  ? `My Wishlist (${wishlist.size})`
                  : siteContent?.catalogTitle || "Grand Boutique Catalog"
              }
            />
          </div>
          <div className="catalog-search">
            <Search size={15} />
            <input
              data-editable="true"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search by suit, fabric, or color..."
              aria-label="Search the catalog"
            />
          </div>
        </div>

        <div className="catalog-toolbar">
          <div className="filter-pills" style={{ overflowX: "auto", maxWidth: "100%", paddingBottom: "0.25rem" }}>
            {categoryPills.map((item) => (
              <button
                data-editable="true"
                key={item}
                className={activeCategory === item ? "active" : ""}
                onClick={() => onCategoryChange(item)}
              >
                <BuilderText as="span" text={item} />
              </button>
            ))}
          </div>

          <label className="sort-select">
            <BuilderText as="span" text="↕" />
            <select
              data-editable="true"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              aria-label="Sort products"
            >
              <option>Featured Couture</option>
              <option>Price: Low to High</option>
              <option>Price: High to Low</option>
              <option>Highest Rated</option>
            </select>
          </label>
        </div>

        {loadingCatalog && visibleProducts.length === 0 ? (
          <div className="product-grid" aria-label="Loading curated collection">
            {Array.from({ length: 8 }).map((_, sIdx) => (
              <div
                key={`catalog-skeleton-${sIdx}`}
                className="product-card border border-[#e8dfd5]/60 bg-white overflow-hidden shadow-sm"
              >
                <div className="product-image shimmer-skeleton" />
                <div className="p-4 space-y-2.5">
                  <div className="h-3 w-20 rounded shimmer-skeleton" />
                  <div className="h-4 w-3/4 rounded shimmer-skeleton" />
                  <div className="h-4 w-1/3 rounded shimmer-skeleton" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="product-grid">
            {visibleProducts.map((product, index) => (
              <ProductCard
                key={`${product.id}-${product.updatedAt || ""}-${product.image || ""}`}
                index={index}
                product={product}
                isWishlisted={wishlist.has(product.id)}
                onWishlist={onWishlist}
              />
            ))}
          </div>
        )}

        {!loadingCatalog && visibleProducts.length === 0 && (
          <div className="empty-state">
            {activeCategory === "Wishlist" ? (
              <div className="py-6 flex flex-col items-center gap-2">
                <p className="text-[#5a544c] text-sm">Your wishlist is empty. Tap the heart on any suit piece to save it here.</p>
                <button
                  onClick={() => onCategoryChange("All Collections")}
                  className="mt-2 px-4 py-1.5 text-xs uppercase tracking-widest font-semibold bg-[#0d4f3c] text-white hover:bg-[#093a2c] transition-colors rounded-sm cursor-pointer"
                >
                  Explore All Collections
                </button>
              </div>
            ) : (
              <BuilderText as="span" text="No pieces found in this category or search. Try clearing filters." />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export function ProductCard({
  product,
  isWishlisted,
  onWishlist,
  index,
}: {
  product: Product;
  isWishlisted: boolean;
  onWishlist: (id: string) => void;
  index: number;
  key?: React.Key;
}) {
  const navigate = useNavigate();
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const { addToCart, startInstantCheckout } = useStore();
  const { isEditMode, isPreviewOnly, quickEditProduct } = useEditMode();

  useEffect(() => {
    setActiveImageIndex(0);
    setImgLoaded(false);
  }, [product.id, product.image, product.updatedAt]);

  const currentVariant = useMemo(() => {
    if (product.colorVariants && product.colorVariants.length > 0) {
      return product.colorVariants[selectedVariantIndex] || product.colorVariants[0];
    }
    return undefined;
  }, [product.colorVariants, selectedVariantIndex]);

  const productImages = useMemo(() => {
    if (selectedVariantIndex === 0 && product.image) {
      if (currentVariant && Array.isArray(currentVariant.images) && currentVariant.images.length > 0) {
        const valid = currentVariant.images.filter(Boolean);
        return [product.image, ...valid.filter((img) => img !== product.image)];
      }
      if (Array.isArray(product.images) && product.images.length > 0) {
        const valid = product.images.filter(Boolean);
        return [product.image, ...valid.filter((img) => img !== product.image)];
      }
      return [product.image, ...(product.hoverImage && product.hoverImage !== product.image ? [product.hoverImage] : [])].filter(Boolean);
    }

    if (currentVariant) {
      if (Array.isArray(currentVariant.images) && currentVariant.images.length > 0) {
        const valid = currentVariant.images.filter(Boolean);
        if (valid.length > 0) return valid;
      }
      if (currentVariant.image) {
        return [currentVariant.image, currentVariant.hoverImage].filter(Boolean);
      }
      if (selectedVariantIndex > 0) {
        return ["https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80"];
      }
    }
    if (Array.isArray(product.images) && product.images.length > 0) {
      return product.images.filter(Boolean);
    }
    return [product.image, ...(product.hoverImage && product.hoverImage !== product.image ? [product.hoverImage] : [])].filter(Boolean);
  }, [currentVariant, selectedVariantIndex, product.images, product.image, product.hoverImage]);

  const activeImage = selectedVariantIndex === 0 && product.image && activeImageIndex === 0
    ? product.image
    : (productImages[activeImageIndex] || product.image || productImages[0]);

  const handleOpenDetails = () => {
    const colorParam = currentVariant?.colorName ? `?color=${encodeURIComponent(currentVariant.colorName)}` : "";
    navigate(`/product/${product.id}${colorParam}`);
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    const defaultSize = product.sizes?.[0] || "Unstitched Suit";
    const variantProduct: Product = currentVariant
      ? {
          ...(product as Product),
          color: currentVariant.colorName || product.color,
          colorHex: currentVariant.colorHex || product.colorHex,
          price: currentVariant.price || product.price,
          originalPrice: currentVariant.originalPrice || product.originalPrice,
          savings: currentVariant.savings || product.savings,
          image: currentVariant.images?.[0] || currentVariant.image || product.image,
          hoverImage: currentVariant.images?.[1] || currentVariant.hoverImage || product.hoverImage,
          images: currentVariant.images || product.images,
        }
      : (product as Product);
    addToCart(variantProduct, defaultSize);
  };

  const handleBuyNow = (e: React.MouseEvent) => {
    e.stopPropagation();
    const defaultSize = product.sizes?.[0] || "Unstitched Suit";
    const variantProduct: Product = currentVariant
      ? {
          ...(product as Product),
          color: currentVariant.colorName || product.color,
          colorHex: currentVariant.colorHex || product.colorHex,
          price: currentVariant.price || product.price,
          originalPrice: currentVariant.originalPrice || product.originalPrice,
          savings: currentVariant.savings || product.savings,
          image: currentVariant.images?.[0] || currentVariant.image || product.image,
          hoverImage: currentVariant.images?.[1] || currentVariant.hoverImage || product.hoverImage,
          images: currentVariant.images || product.images,
        }
      : (product as Product);
    startInstantCheckout(variantProduct, defaultSize);
  };

  const whatsappMsg = encodeURIComponent(
    `Namaste House of Shriya! I would like to inquire about ${product.name} (${currentVariant?.price || product.price}, ${currentVariant?.colorName || product.color || "Surat Handloom"}). Can you assist with delivery?`
  );

  return (
    <motion.article
      className="product-card relative cursor-pointer"
      onClick={handleOpenDetails}
      initial={{ opacity: 0, y: 28, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{
        duration: 0.55,
        ease: [0.22, 1, 0.36, 1],
        delay: (index % 3) * 0.08,
      }}
    >
      {/* Quick Edit button in Edit Mode */}
      {isEditMode && !isPreviewOnly && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            quickEditProduct(product);
          }}
          className="absolute top-2 left-2 z-30 bg-[#7D2AE8] hover:bg-[#6d20d8] text-white text-[0.65rem] px-2.5 py-1 rounded-md shadow-lg flex items-center gap-1 font-sans font-semibold cursor-pointer border border-white/20 transition-all hover:scale-105"
          title="Click to edit product in Canva modal"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse" />
          <span>Edit Suit</span>
        </button>
      )}

      <div className="product-image relative">
        {!imgLoaded && (
          <div className="absolute inset-0 shimmer-skeleton z-0 pointer-events-none transition-opacity duration-300" aria-hidden="true" />
        )}
        <CanvaEditable
          id={`product_${product.id}_image`}
          as="img"
          type="image"
          label={`${product.name} Photo`}
          src={activeImage}
          alt={product.name}
          productId={product.id}
          className="product-image-primary transition-opacity duration-300"
          loading="lazy"
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgLoaded(true)}
        />
        <img
          key={`hover_${product.id}_${productImages[1] || currentVariant?.hoverImage || product.hoverImage || activeImage}`}
          data-editable="true"
          className="product-image-hover"
          src={normalizeImageUrl(productImages[1] || currentVariant?.hoverImage || product.hoverImage || activeImage)}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&q=80";
          }}
        />
        <div className="product-badges">
          {(product.badges || []).slice(0, 2).map((badge, bIdx) => (
            <BuilderText as="span" key={`${badge}-${bIdx}`} text={badge} />
          ))}
        </div>
        <button
          type="button"
          data-editable="true"
          className={`wishlist-button ${isWishlisted ? "wishlisted" : ""}`}
          aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
          onClick={(e) => {
            e.stopPropagation();
            onWishlist(product.id);
          }}
        >
          <Heart size={16} fill={isWishlisted ? "currentColor" : "none"} />
        </button>
        <button
          type="button"
          data-editable="true"
          className="absolute top-2.5 right-12 z-20 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-[#2a241e] hover:text-[#0d4f3c] flex items-center justify-center shadow-md opacity-90 sm:opacity-0 group-hover:opacity-100 transition-all hover:scale-110 border border-black/5"
          title="Zoom and Inspect High-Resolution Photos"
          aria-label={`Zoom ${product.name} photos`}
          onClick={(e) => {
            e.stopPropagation();
            setIsViewerOpen(true);
          }}
        >
          <ZoomIn size={15} />
        </button>
        <button
          type="button"
          data-editable="true"
          className="quick-view"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenDetails();
          }}
        >
          <BuilderText as="span" text="View Details" />
        </button>
      </div>
      <div className="product-content">
        <div className="rating-row">
          <span data-editable="true">
            <Star size={12} fill="currentColor" /> <BuilderText as="span" text={`${product.rating || "4.8"} (${product.reviews || "120+"})`} />
          </span>
          <BuilderText as="small" text={currentVariant?.colorName || product.color || "Artisan Craft"} />
        </div>

        {/* Color Palette Swatches on Card */}
        {product.colorVariants && product.colorVariants.length > 1 && (
          <div className="flex items-center gap-1.5 pt-1 pb-0.5" onClick={(e) => e.stopPropagation()}>
            {product.colorVariants.slice(0, 6).map((variant, vIdx) => {
              const isSelected = vIdx === selectedVariantIndex;
              return (
                <button
                  key={variant.id ? `${variant.id}-${vIdx}` : `var-${vIdx}`}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedVariantIndex(vIdx);
                    setActiveImageIndex(0);
                  }}
                  className={`w-3.5 h-3.5 rounded-full transition-all cursor-pointer ${
                    isSelected
                      ? "ring-2 ring-[#0d4f3c] ring-offset-1 scale-110 shadow-xs"
                      : "opacity-75 hover:opacity-100 hover:scale-110 border border-black/20"
                  }`}
                  style={{ backgroundColor: variant.colorHex || "#0d4f3c" }}
                  title={`Select ${variant.colorName} edition (${variant.price || product.price})`}
                />
              );
            })}
            {product.colorVariants.length > 6 && (
              <span className="text-[10px] text-[#8c8275] font-medium">
                +{product.colorVariants.length - 6}
              </span>
            )}
          </div>
        )}

        <BuilderText
          as="h3"
          id={`product_${product.id}_title`}
          label={`${product.name} Title`}
          type="heading"
          text={product.name}
        />
        <BuilderText
          as="p"
          id={`product_${product.id}_desc`}
          label={`${product.name} Description`}
          text={currentVariant?.description || product.description}
        />
        <div className="price-row">
          <BuilderText
            as="strong"
            id={`product_${product.id}_price`}
            label={`${product.name} Price`}
            text={currentVariant?.price || product.price}
          />
          {(currentVariant?.originalPrice || product.originalPrice) && (
            <BuilderText
              as="del"
              id={`product_${product.id}_orig_price`}
              label={`${product.name} Original Price`}
              text={currentVariant?.originalPrice || product.originalPrice}
            />
          )}
          {(currentVariant?.savings || product.savings) && (
            <BuilderText
              as="span"
              id={`product_${product.id}_savings`}
              label={`${product.name} Savings`}
              text={currentVariant?.savings || product.savings}
            />
          )}
        </div>

        <div className="product-actions flex items-center gap-1 sm:gap-1.5 mt-2 pt-1 w-full">
          <button
            type="button"
            data-editable="true"
            onClick={handleBuyNow}
            title="Instant Checkout"
            className="flex-1 min-w-0 bg-[#0d4f3c] hover:bg-[#083528] active:scale-[0.98] text-[#faf8f5] font-semibold text-[11px] sm:text-xs py-2 px-2 sm:px-3 rounded-full border-0 cursor-pointer transition-all text-center truncate shadow-2xs"
          >
            <BuilderText as="span" text="Buy Now" />
          </button>

          <button
            type="button"
            data-editable="true"
            onClick={handleAddToCart}
            title="Add to Shopping Bag"
            aria-label={`Add ${product.name} to Shopping Bag`}
            className="bg-[#f4eee6] hover:bg-[#eae2d5] active:scale-[0.98] text-[#0d4f3c] font-semibold text-[11px] sm:text-xs py-2 px-2 sm:px-2.5 rounded-full border border-[#d6ccc2] cursor-pointer inline-flex items-center justify-center gap-1 shrink-0 transition-all"
          >
            <ShoppingBag size={13} className="shrink-0" />
            <span className="hidden xs:inline sm:inline">Bag</span>
          </button>

          <a
            data-editable="true"
            href={`https://wa.me/919501698356?text=${whatsappMsg}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="whatsapp-button inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#25D366] hover:bg-[#20ba5a] active:scale-95 text-white shrink-0 transition-colors shadow-2xs"
            aria-label={`Inquire on WhatsApp about ${product.name}`}
          >
            <MessageCircle size={14} />
          </a>
        </div>
      </div>

      {/* Fullscreen High-Resolution Image Viewer */}
      <LuxuryImageViewerModal
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        images={productImages}
        title={product.name}
        subtitle={product.category}
        colorName={product.color}
        price={product.price}
      />
    </motion.article>
  );
}

export function Footer({ onOpenModal }: { onOpenModal?: (type: string) => void }) {
  const { siteContent } = useStore();
  const whatsappHelpPookieUrl = "https://wa.me/919501698356?text=" + encodeURIComponent("Hi House of Shriya! POOKIE NEED A HELP ✨");

  const [email, setEmail] = useState("");
  const [subStatus, setSubStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [feedbackMsg, setFeedbackMsg] = useState("");

  const handleSubscribe = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = (email || "").trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setSubStatus("error");
      setFeedbackMsg("Please enter a valid email address.");
      return;
    }

    setSubStatus("loading");
    setFeedbackMsg("");
    try {
      const res = await subscribeToNewsletter(cleanEmail, "footer");
      setSubStatus("success");
      setFeedbackMsg(res.message || "Thank you for subscribing! You will receive our private previews.");
      setEmail("");
    } catch (err: any) {
      setSubStatus("error");
      setFeedbackMsg(err?.message || "Unable to subscribe right now. Please try again.");
    }
  };

  return (
    <footer className="site-footer">
      <div className="site-container">
        <div className="footer-main">
          <div className="footer-brand">
            <LogoMark />
            <BuilderText as="h2" text="House of Shriya" />
            <BuilderText as="p" text={siteContent?.brandDescription || "Where pretty meets effortless elegance"} />
            <a
              data-editable="true"
              href={whatsappHelpPookieUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs text-[#f9a8d4] bg-[#f9a8d4]/10 hover:bg-[#f9a8d4]/20 border border-[#f9a8d4]/45 hover:border-[#f9a8d4] px-4 py-2 rounded-full transition-all duration-300 w-fit shadow-xs group"
              style={{
                fontFamily: '"Playfair Display", "Cormorant Garamond", Georgia, serif',
                letterSpacing: "0.08em",
                fontWeight: 600,
              }}
              title="Chat on WhatsApp (+919501698356)"
              aria-label="POOKIE NEED A HELP - Open WhatsApp chat"
            >
              <MessageCircle size={14} className="text-[#f9a8d4] group-hover:scale-110 transition-transform" />
              <BuilderText as="span" text="POOKIE NEED A HELP" />
              <Sparkles size={13} className="text-[#f9a8d4] group-hover:rotate-12 transition-transform opacity-90" />
            </a>
          </div>
          <div className="footer-links">
            <div>
              <BuilderText as="strong" text="Discover" />
              <Link data-editable="true" to="/our-story"><BuilderText as="span" text="Our Story" /></Link>
              <Link data-editable="true" to="/craftsmanship"><BuilderText as="span" text="Craftsmanship" /></Link>
              <Link data-editable="true" to="/journal"><BuilderText as="span" text="Journal" /></Link>
            </div>
            <div>
              <BuilderText as="strong" text="Client Care" />
              <button
                type="button"
                data-editable="true"
                onClick={() => onOpenModal?.("shipping_policy")}
                className="text-left text-[#faf8f5]/70 hover:text-white transition-colors"
              >
                <BuilderText as="span" text="Shipping Policy" />
              </button>
              <button
                type="button"
                data-editable="true"
                onClick={() => onOpenModal?.("support")}
                className="text-left text-[#faf8f5]/70 hover:text-white transition-colors"
              >
                <BuilderText as="span" text="Contact Us" />
              </button>
            </div>
            <div>
              <BuilderText as="strong" text="Stay in the know" />
              <BuilderText as="p" text="Private previews, artisan stories, and first access to every drop." />
              <form onSubmit={handleSubscribe} className="footer-input" aria-label="Newsletter subscription form">
                <input
                  data-editable="true"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (subStatus !== "idle") {
                      setSubStatus("idle");
                      setFeedbackMsg("");
                    }
                  }}
                  disabled={subStatus === "loading"}
                  placeholder="Your email address"
                  aria-label="Email address"
                  required
                />
                <button
                  data-editable="true"
                  type="submit"
                  disabled={subStatus === "loading"}
                  aria-label="Subscribe"
                  title="Subscribe to private previews"
                >
                  {subStatus === "loading" ? (
                    <Loader2 size={15} className="animate-spin text-[#d4af37]" />
                  ) : subStatus === "success" ? (
                    <Check size={15} className="text-[#a7f3d0]" />
                  ) : (
                    <ArrowRight size={15} />
                  )}
                </button>
              </form>
              {subStatus === "success" && (
                <p className="mt-2 text-[0.68rem] text-[#a7f3d0] flex items-center gap-1.5 animate-fadeIn font-medium">
                  <Check size={12} className="shrink-0 text-[#10b981]" />
                  <span>{feedbackMsg}</span>
                </p>
              )}
              {subStatus === "error" && (
                <p className="mt-2 text-[0.68rem] text-[#fca5a5] flex items-center gap-1.5 animate-fadeIn font-medium">
                  <AlertCircle size={12} className="shrink-0 text-[#ef4444]" />
                  <span>{feedbackMsg}</span>
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="footer-bottom flex flex-wrap items-center justify-between gap-2">
          <BuilderText as="span" text={siteContent?.footerNote ? siteContent.footerNote.replace(/\s*·?\s*(?:SURAT|WORLDWIDE SHIPPING).*$/i, "").trim() : "© House of Shriya. Made for your forever wardrobe."} />
          <div className="flex items-center gap-4">
            <BuilderText as="span" text={`${siteContent?.atelierCity || "Patiala, Punjab, India"} · Worldwide Shipping`} />
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function Index() {
  const [showIntro, setShowIntro] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        const params = new URLSearchParams(window.location.search);
        if (
          params.get("preview_mode") === "admin" ||
          params.get("nointro") === "true" ||
          params.get("canva") === "true" ||
          window.self !== window.top
        ) {
          return false;
        }
      } catch {}
    }
    return true;
  });
  const [pookieMessage, setPookieMessage] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("All Collections");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Sync listener when inside an iframe or preview frame
  useEffect(() => {
    const handleWindowMessage = (event: MessageEvent) => {
      if (!event.data) return;
      if (
        event.data.type === "hos-sync-refresh" ||
        event.data.type === "hos-catalog-refresh" ||
        event.data.type === "hos-refresh"
      ) {
        if (typeof window !== "undefined") {
          if (event.data.siteContent) {
            window.dispatchEvent(new CustomEvent("hos-content-updated", { detail: event.data.siteContent }));
          }
          if (Array.isArray(event.data.products)) {
            window.dispatchEvent(new CustomEvent("hos-catalog-updated", { detail: event.data.products }));
          }
          if (Array.isArray(event.data.categories)) {
            window.dispatchEvent(new CustomEvent("hos-categories-updated", { detail: event.data.categories }));
          }

          // Only fetch from API if data was missing from the postMessage event
          if (!Array.isArray(event.data.products)) {
            fetch(`/api/products?t=${Date.now()}`, { cache: "no-store" })
              .then((r) => r.json())
              .then((prods) => {
                if (Array.isArray(prods) && prods.length > 0) {
                  window.dispatchEvent(new CustomEvent("hos-catalog-updated", { detail: prods }));
                }
              })
              .catch(() => {});
          }
          if (!event.data.siteContent) {
            fetch(`/api/site-content?t=${Date.now()}`, { cache: "no-store" })
              .then((r) => r.json())
              .then((content) => {
                if (content && typeof content === "object") {
                  window.dispatchEvent(new CustomEvent("hos-content-updated", { detail: content }));
                }
              })
              .catch(() => {});
          }
          if (!Array.isArray(event.data.categories)) {
            fetch(`/api/categories?t=${Date.now()}`, { cache: "no-store" })
              .then((r) => r.json())
              .then((cats) => {
                if (Array.isArray(cats) && cats.length > 0) {
                  window.dispatchEvent(new CustomEvent("hos-categories-updated", { detail: cats }));
                }
              })
              .catch(() => {});
          }
        }
      }
    };
    window.addEventListener("message", handleWindowMessage);
    return () => window.removeEventListener("message", handleWindowMessage);
  }, []);

  // Use persistent store wishlist and toggleWishlist
  const { wishlist, toggleWishlist } = useStore();

  const dismissIntro = () => setShowIntro(false);

  const openPookie = () => {
    window.dispatchEvent(new CustomEvent("open-pookie-chat"));
  };

  const handleSelectCategory = (category: string) => {
    setActiveCategory(category);
    document.getElementById("catalog-section")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="storefront">
      {showIntro && (
        <IntroOverlay onEnter={dismissIntro} />
      )}

      <StoreHeader
        onPookie={openPookie}
        onOpenDrawer={() => setDrawerOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenModal={(type) => setActiveModal(type)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        wishlistCount={wishlist.size}
        onSelectCategory={handleSelectCategory}
      />
          
          <main>
            <Hero onPookie={openPookie} />

            <Catalog
              wishlist={wishlist}
              onWishlist={toggleWishlist}
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
              query={searchQuery}
              onQueryChange={setSearchQuery}
            />
          </main>

          <Footer onOpenModal={(type) => setActiveModal(type)} />

          {/* Navigation Drawer Menu */}
          <NavigationDrawer
            isOpen={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            onSelectCategory={handleSelectCategory}
            onOpenModal={(type) => setActiveModal(type)}
            onOpenAuth={() => setIsAuthOpen(true)}
            wishlistCount={wishlist.size}
          />

          {/* Interactive Info Modal */}
          <InteractiveModal
            type={activeModal}
            onClose={() => setActiveModal(null)}
            onOpenModal={(type) => setActiveModal(type)}
            onOpenAuth={() => setIsAuthOpen(true)}
          />

          {/* Customer Authentication Modal */}
          <CustomerAuthModal
            isOpen={isAuthOpen}
            onClose={() => setIsAuthOpen(false)}
          />

          {pookieMessage && (
            <div className="pookie-toast">
              <span data-editable="true"><Sparkles size={16} /></span>
              <div>
                <BuilderText as="strong" text="Pookie is ready" />
                <BuilderText as="small" text="Tell me your occasion and I’ll style the perfect edit." />
              </div>
              <button data-editable="true" onClick={() => setPookieMessage(false)} aria-label="Close Pookie message">
                <X size={15} />
              </button>
            </div>
          )}
    </div>
  );
}
