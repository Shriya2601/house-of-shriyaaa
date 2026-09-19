import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import {
  AuthUser as User,
  Product,
  SiteContent,
  CategoryItem,
  CartItem,
  Order,
  ShippingAddress,
  CustomerInfo,
  PaymentMethod,
  PaymentStatus,
  OrderPaymentDetails,
  CustomerProfile,
  AtelierBooking,
} from "../types";
import {
  defaultSiteContent,
  defaultCategories,
  getCachedSiteContent,
  getCachedProducts,
  getCachedCategories,
  cacheSiteContentLocally,
  cacheProductsLocally,
  cacheCategoriesLocally,
  subscribeSiteContent,
  subscribeProducts,
  subscribeCategories,
  createRealOrder,
  createAtelierBooking,
  fetchAtelierBookings,
  subscribeAuthState,
  seedInitialProductsIfEmpty,
  syncServerDeletedIds,
  getLocallyDeletedIds,
  fetchCustomerProfile,
  updateCustomerProfile as saveProfileToDb,
  customerSignIn,
  customerSignUp,
  customerSignOut,
  customerResetPassword,
  confirmOrderPayment,
  factoryResetCatalog,
  type FactoryResetResult,
} from "../services/storeService";
import { products as initialFallbackProducts } from "../data/products";

interface StoreContextType {
  // Content & Catalog
  siteContent: SiteContent;
  products: Product[];
  categories: CategoryItem[];
  loadingCatalog: boolean;

  // Cart / Shopping Bag
  cart: CartItem[];
  addToCart: (product: Product, size?: string, quantity?: number) => void;
  removeFromCart: (productId: string, size: string, color?: string) => void;
  updateQuantity: (productId: string, size: string, quantity: number, color?: string) => void;
  clearCart: () => void;
  totalCartCount: number;
  cartSubtotal: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;

  // Checkout
  isCheckoutOpen: boolean;
  setIsCheckoutOpen: (open: boolean) => void;
  instantCheckoutProduct: { product: Product; size: string } | null;
  startInstantCheckout: (product: Product, size?: string) => void;
  closeCheckout: () => void;
  placeOrder: (details: {
    customer: CustomerInfo;
    shippingAddress: ShippingAddress;
    paymentMethod: PaymentMethod;
    paymentDetails?: OrderPaymentDetails;
    paymentStatus?: PaymentStatus;
    notes?: string;
    referralCode?: string;
    referralDiscount?: number;
  }) => Promise<Order>;

  // Wishlist (Persisted)
  wishlist: Set<string>;
  toggleWishlist: (productId: string) => void;
  isWishlisted: (productId: string) => boolean;

  // Customer & Auth
  currentUser: User | null;
  authLoading: boolean;
  customerProfile: CustomerProfile | null;
  customerOrders: Order[];
  atelierBookings: AtelierBooking[];
  refreshCustomerOrders: () => Promise<void>;
  confirmCustomerOrderPayment: (
    orderIdOrNumber: string,
    utrNumber: string,
    paymentMethod?: string
  ) => Promise<{ success: boolean; order?: Order; message?: string }>;
  updateProfileDetails: (updates: Partial<CustomerProfile>) => Promise<void>;
  bookAtelierSession: (
    bookingData: Omit<AtelierBooking, "id" | "bookingNumber" | "createdAt" | "updatedAt" | "status">
  ) => Promise<AtelierBooking>;
  signIn: (email: string, pass: string, referralCode?: string) => Promise<User>;
  signUp: (
    email: string,
    pass: string,
    fullName: string,
    phone?: string,
    confirmPass?: string,
    referralCode?: string
  ) => Promise<User>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;

  // Live CMS & Catalog Editing
  setSiteContent: React.Dispatch<React.SetStateAction<SiteContent>>;
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  factoryReset: (options?: { wipeImages?: boolean }) => Promise<FactoryResetResult>;
}

const StoreContext = createContext<StoreContextType | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [siteContent, setSiteContent] = useState<SiteContent>(() => getCachedSiteContent());
  const [products, setProducts] = useState<Product[]>(() => getCachedProducts());
  const [categories, setCategories] = useState<CategoryItem[]>(() => getCachedCategories());
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  // Cart state persisted in localStorage for smooth guest shopping experience
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem("hos_cart");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [wishlist, setWishlist] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("hos_wishlist");
      return saved ? new Set(JSON.parse(saved)) : new Set(initialFallbackProducts.filter(p => p.activeWishlist).map(p => p.id));
    } catch {
      return new Set();
    }
  });

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [instantCheckoutProduct, setInstantCheckoutProduct] = useState<{ product: Product; size: string } | null>(null);

  // Auth & Customer state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(() => {
    try {
      const saved = localStorage.getItem("hos_customer_profile");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [customerOrders, setCustomerOrders] = useState<Order[]>(() => {
    try {
      const saved = localStorage.getItem("hos_placed_orders");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [atelierBookings, setAtelierBookings] = useState<AtelierBooking[]>(() => {
    try {
      const saved = localStorage.getItem("hos_atelier_bookings");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Sync Cart to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("hos_cart", JSON.stringify(cart));
    } catch (e) {
      console.warn("Cart local storage sync notice:", e);
    }
  }, [cart]);

  // Capture referral code from URL parameter if present (?ref=CODE)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const refCode = params.get("ref");
      if (refCode) {
        localStorage.setItem("hos_pending_referral", refCode.trim().toUpperCase());
      }
    } catch {}
  }, []);

  // Sync Wishlist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("hos_wishlist", JSON.stringify(Array.from(wishlist)));
    } catch (e) {
      console.warn("Wishlist storage sync notice:", e);
    }
  }, [wishlist]);

  // Fetch / Sync customer orders and bookings from Firestore
  const refreshCustomerOrders = useCallback(async () => {
    let combinedOrders: Order[] = [];
    try {
      const local: Order[] = JSON.parse(localStorage.getItem("hos_placed_orders") || "[]");
      combinedOrders = [...local];
    } catch {}

    if (currentUser?.email || currentUser?.uid) {
      try {
        const remoteOrders: Order[] = [];

        // 1. Query by customer email from Cloudflare D1 /api/orders
        if (currentUser.email) {
          try {
            const res = await fetch(`/api/orders?email=${encodeURIComponent(currentUser.email.trim().toLowerCase())}`);
            if (res.ok) {
              const ordersData = await res.json();
              if (Array.isArray(ordersData)) {
                remoteOrders.push(...ordersData);
              }
            }
          } catch (err) {
            console.warn("Error fetching orders by email:", err);
          }
        }

        // Smart merge preserving verified payment status & UTR
        const orderMap = new Map<string, Order>();
        for (const ord of [...combinedOrders, ...remoteOrders]) {
          const key = ord.orderNumber || ord.id;
          if (!key) continue;
          const existing = orderMap.get(key);
          if (!existing) {
            orderMap.set(key, {
              ...ord,
              status: ord.status || ord.orderStatus || "pending",
              totalAmount: ord.totalAmount ?? ord.total ?? 0,
              customerAddress: ord.customerAddress || ord.shippingAddress,
            });
          } else {
            const bestPaymentStatus =
              ord.paymentStatus && ord.paymentStatus !== "Pending"
                ? ord.paymentStatus
                : existing.paymentStatus || ord.paymentStatus || "Pending";
            const bestUtr = ord.utrNumber || existing.utrNumber;
            orderMap.set(key, {
              ...existing,
              ...ord,
              paymentStatus: bestPaymentStatus,
              utrNumber: bestUtr,
              status: ord.status || ord.orderStatus || existing.status || "pending",
              totalAmount: ord.totalAmount ?? ord.total ?? existing.totalAmount ?? 0,
              customerAddress: ord.customerAddress || ord.shippingAddress || existing.customerAddress,
            });
          }
        }
        const merged = Array.from(orderMap.values());
        merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        combinedOrders = merged;
      } catch (e) {
        console.warn("Error querying customer remote orders:", e);
      }
    }

    setCustomerOrders(combinedOrders);

    // Also fetch atelier bookings
    if (currentUser?.email || currentUser?.uid) {
      try {
        const bookings = await fetchAtelierBookings(currentUser.email || currentUser.uid);
        setAtelierBookings(bookings);
      } catch (e) {
        console.warn("Error syncing atelier bookings:", e);
      }
    }
  }, [currentUser]);

  // Real-time synchronization for order updates across window / modals
  useEffect(() => {
    const handleSingleOrderUpdate = (e: any) => {
      const updated: Order = e.detail;
      if (updated && (updated.id || updated.orderNumber)) {
        setCustomerOrders((prev) => {
          const idx = prev.findIndex(
            (o) => o.id === updated.id || o.orderNumber === updated.orderNumber
          );
          if (idx > -1) {
            const next = [...prev];
            next[idx] = { ...next[idx], ...updated };
            return next;
          }
          return [updated, ...prev];
        });
      }
    };

    window.addEventListener("hos-order-updated", handleSingleOrderUpdate);
    return () => window.removeEventListener("hos-order-updated", handleSingleOrderUpdate);
  }, []);

  // Subscribe to real-time Firebase Auth & load profile
  useEffect(() => {
    const unsubAuth = subscribeAuthState(async (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
      if (user) {
        try {
          const prof = await fetchCustomerProfile(user.uid);
          if (prof) {
            setCustomerProfile(prof);
          } else {
            // Build initial profile
            const newProf: CustomerProfile = {
              uid: user.uid,
              email: user.email || "",
              fullName: user.displayName || user.email?.split("@")[0] || "Valued Patron",
              savedAddresses: [],
              tier: "House Patron",
            };
            setCustomerProfile(newProf);
          }
        } catch (e) {
          console.warn("Error loading customer profile:", e);
        }
      } else {
        setCustomerProfile(null);
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    refreshCustomerOrders();
  }, [currentUser, refreshCustomerOrders]);

  const updateProfileDetails = async (updates: Partial<CustomerProfile>) => {
    if (!currentUser) return;
    const updated = await saveProfileToDb(currentUser.uid, updates);
    setCustomerProfile(updated);
  };

  const handleSignIn = async (email: string, pass: string, referralCode?: string): Promise<User> => {
    const user = await customerSignIn(email, pass, referralCode);
    setCurrentUser(user);
    try {
      const prof = await fetchCustomerProfile(user.uid);
      if (prof) setCustomerProfile(prof);
    } catch {}
    await refreshCustomerOrders();
    return user;
  };

  const handleSignUp = async (
    email: string,
    pass: string,
    fullName: string,
    phone?: string,
    confirmPass?: string,
    referralCode?: string
  ): Promise<User> => {
    const user = await customerSignUp(email, pass, fullName, phone, confirmPass, referralCode);
    setCurrentUser(user);
    try {
      const prof = await fetchCustomerProfile(user.uid);
      if (prof) setCustomerProfile(prof);
    } catch {}
    await refreshCustomerOrders();
    return user;
  };

  const handleSignOut = async (): Promise<void> => {
    await customerSignOut();
    setCurrentUser(null);
    setCustomerProfile(null);
    setCustomerOrders([]);
    setAtelierBookings([]);
  };

  const handleResetPassword = async (email: string): Promise<void> => {
    await customerResetPassword(email);
  };

  // Subscribe to real-time Firestore content, products, and categories
  useEffect(() => {
    // Immediately synchronize any deleted items from the server so stale items are purged
    syncServerDeletedIds().catch(() => {});

    // Fast-track authoritative API fetch on mount to ensure disk persistence is instantly visible
    const fetchFreshServerData = async () => {
      try {
        const [contentRes, prodsRes, catsRes] = await Promise.all([
          fetch(`/api/site-content?t=${Date.now()}`, { cache: "no-store" }).catch(() => null),
          fetch(`/api/products?t=${Date.now()}`, { cache: "no-store" }).catch(() => null),
          fetch(`/api/categories?t=${Date.now()}`, { cache: "no-store" }).catch(() => null),
        ]);
        if (contentRes && contentRes.ok) {
          const content = await contentRes.json();
          if (content && typeof content === "object") {
            const cached = getCachedSiteContent();
            const cachedTime = cached?.updatedAt ? new Date(cached.updatedAt).getTime() : 0;
            const incomingTime = content.updatedAt ? new Date(content.updatedAt).getTime() : 0;

            if (incomingTime >= cachedTime || !cachedTime) {
              const merged: SiteContent = { ...cached, ...content };
              if (
                Array.isArray(cached?.heroSlides) &&
                cached.heroSlides.length > 0 &&
                (!Array.isArray(content.heroSlides) || content.heroSlides.length === 0)
              ) {
                merged.heroSlides = cached.heroSlides;
              }
              setSiteContent(merged);
              cacheSiteContentLocally(merged);
            }
          }
        }
        if (prodsRes && prodsRes.ok) {
          const prods = await prodsRes.json();
          if (Array.isArray(prods)) {
            const deleted = getLocallyDeletedIds("products");
            const clean = prods.filter(
              (p: any) =>
                p &&
                p.id &&
                !deleted.has(p.id) &&
                (!p.sku || !deleted.has(p.sku)) &&
                (!p.name || !deleted.has(p.name))
            );
            setProducts(clean);
            cacheProductsLocally(clean);
            setLoadingCatalog(false);
          }
        }
        if (catsRes && catsRes.ok) {
          const cats = await catsRes.json();
          if (Array.isArray(cats)) {
            const deleted = getLocallyDeletedIds("categories");
            const clean = cats.filter(
              (c: any) =>
                c &&
                (!c.id || !deleted.has(c.id)) &&
                (!c.slug || !deleted.has(c.slug)) &&
                (!c.name || !deleted.has(c.name))
            );
            setCategories(clean);
            cacheCategoriesLocally(clean);
          }
        }
      } catch {}
    };
    fetchFreshServerData();

    // Attempt initial database bootstrap if products empty
    seedInitialProductsIfEmpty().catch(() => {});

    const unsubContent = subscribeSiteContent((content) => {
      setSiteContent(content);
    });

    const unsubProducts = subscribeProducts((fetchedProducts) => {
      setProducts(fetchedProducts);
      setLoadingCatalog(false);
    });

    const unsubCategories = subscribeCategories((cats) => {
      setCategories(cats);
    });

    // Real-time deletion listeners
    const handleProdDel = (e: any) => {
      const id = e.detail?.id;
      const sku = e.detail?.sku;
      const name = e.detail?.name;
      if (id || sku || name) {
        setProducts((prev) =>
          prev.filter(
            (p) =>
              (!id || p.id !== id) &&
              (!sku || (p as any).sku !== sku) &&
              (!name || p.name !== name)
          )
        );
        setCart((prev) =>
          prev.filter(
            (item) =>
              (!id || item.product.id !== id) &&
              (!sku || (item.product as any).sku !== sku) &&
              (!name || item.product.name !== name)
          )
        );
        setWishlist((prev) => {
          const next = new Set(prev);
          if (id) next.delete(id);
          if (sku) next.delete(sku);
          return next;
        });
      }
    };
    const handleProdSaved = (e: any) => {
      const prod = e.detail;
      if (prod && prod.id) {
        setProducts((prev) => {
          const idx = prev.findIndex((p) => p.id === prod.id);
          if (idx > -1) {
            const next = [...prev];
            next[idx] = prod;
            return next;
          }
          return [prod, ...prev];
        });
      }
    };
    const handleCatDel = (e: any) => {
      const id = e.detail?.id;
      const slug = e.detail?.slug;
      const name = e.detail?.name;
      if (id || slug || name) {
        setCategories((prev) =>
          prev.filter(
            (c) =>
              (!id || c.id !== id) &&
              (!slug || c.slug !== slug) &&
              (!name || c.name !== name)
          )
        );
      }
    };
    const handleCatSaved = (e: any) => {
      const cat = e.detail;
      if (cat && cat.id) {
        setCategories((prev) => {
          const idx = prev.findIndex((c) => c.id === cat.id);
          if (idx > -1) {
            const next = [...prev];
            next[idx] = cat;
            return next;
          }
          return [...prev, cat];
        });
      }
    };
    const handleContentUpdated = (e: any) => {
      if (e.detail) {
        setSiteContent(e.detail);
      }
    };
    const handleCatalogUpdated = (e: any) => {
      if (Array.isArray(e.detail)) {
        setProducts(e.detail);
      }
    };
    const handleCategoriesUpdated = (e: any) => {
      if (Array.isArray(e.detail)) {
        setCategories(e.detail);
      }
    };
    const handleOrdersUpdated = (e: any) => {
      if (Array.isArray(e.detail)) {
        setCustomerOrders(e.detail);
      }
    };
    const handleOrderDel = (e: any) => {
      const id = e.detail?.id || e.detail?.orderNumber;
      if (id) {
        setCustomerOrders((prev) =>
          prev.filter(
            (o) =>
              (o.id ? o.id !== id : true) &&
              (o.orderNumber ? o.orderNumber !== id : true)
          )
        );
      }
    };
    const handleBookingsUpdated = (e: any) => {
      if (Array.isArray(e.detail)) {
        setAtelierBookings(e.detail);
      }
    };
    const handleBookingDel = (e: any) => {
      const id = e.detail?.id || e.detail?.bookingNumber;
      if (id) {
        setAtelierBookings((prev) =>
          prev.filter(
            (b) =>
              (b.id ? b.id !== id : true) &&
              (b.bookingNumber ? b.bookingNumber !== id : true)
          )
        );
      }
    };

    const handleFactoryResetCompleted = () => {
      setProducts([]);
      setCart([]);
      setWishlist(new Set());
    };

    const handleWindowMessage = (event: MessageEvent) => {
      if (!event.data) return;
      if (
        event.data.type === "hos-sync-refresh" ||
        event.data.type === "hos-catalog-refresh" ||
        event.data.type === "hos-refresh"
      ) {
        if (Array.isArray(event.data.products)) {
          setProducts(event.data.products);
        }
        if (Array.isArray(event.data.categories)) {
          setCategories(event.data.categories);
        }
        if (event.data.siteContent) {
          setSiteContent(event.data.siteContent);
        }
        // Also perform background API fetch to make sure disk state is synced
        fetch(`/api/products?t=${Date.now()}`, { cache: "no-store" })
          .then((r) => r.json())
          .then((prods) => {
            if (Array.isArray(prods) && prods.length > 0) setProducts(prods);
          })
          .catch(() => {});
        fetch(`/api/site-content?t=${Date.now()}`, { cache: "no-store" })
          .then((r) => r.json())
          .then((content) => {
            if (content && typeof content === "object") setSiteContent((prev) => ({ ...prev, ...content }));
          })
          .catch(() => {});
        fetch(`/api/categories?t=${Date.now()}`, { cache: "no-store" })
          .then((r) => r.json())
          .then((cats) => {
            if (Array.isArray(cats) && cats.length > 0) setCategories(cats);
          })
          .catch(() => {});
      }
      if (event.data.type === "products" && Array.isArray(event.data.data)) {
        setProducts(event.data.data);
      }
      if (event.data.type === "categories" && Array.isArray(event.data.data)) {
        setCategories(event.data.data);
      }
    };

    window.addEventListener("message", handleWindowMessage);
    window.addEventListener("hos-product-deleted", handleProdDel);
    window.addEventListener("hos-product-saved", handleProdSaved);
    window.addEventListener("hos-catalog-updated", handleCatalogUpdated);
    window.addEventListener("hos-factory-reset-completed", handleFactoryResetCompleted);
    window.addEventListener("hos-content-updated", handleContentUpdated);
    window.addEventListener("hos-category-deleted", handleCatDel);
    window.addEventListener("hos-category-saved", handleCatSaved);
    window.addEventListener("hos-categories-updated", handleCategoriesUpdated);
    window.addEventListener("hos-orders-updated", handleOrdersUpdated);
    window.addEventListener("hos-order-deleted", handleOrderDel);
    window.addEventListener("hos-bookings-updated", handleBookingsUpdated);
    window.addEventListener("hos-booking-deleted", handleBookingDel);

    return () => {
      unsubContent();
      unsubProducts();
      unsubCategories();
      window.removeEventListener("message", handleWindowMessage);
      window.removeEventListener("hos-product-deleted", handleProdDel);
      window.removeEventListener("hos-product-saved", handleProdSaved);
      window.removeEventListener("hos-catalog-updated", handleCatalogUpdated);
      window.removeEventListener("hos-factory-reset-completed", handleFactoryResetCompleted);
      window.removeEventListener("hos-content-updated", handleContentUpdated);
      window.removeEventListener("hos-category-deleted", handleCatDel);
      window.removeEventListener("hos-category-saved", handleCatSaved);
      window.removeEventListener("hos-categories-updated", handleCategoriesUpdated);
      window.removeEventListener("hos-orders-updated", handleOrdersUpdated);
      window.removeEventListener("hos-order-deleted", handleOrderDel);
      window.removeEventListener("hos-bookings-updated", handleBookingsUpdated);
      window.removeEventListener("hos-booking-deleted", handleBookingDel);
    };
  }, []);

  // Helper to parse price string "₹3,899" -> 3899
  const parsePrice = (priceStr: string): number => {
    const cleaned = priceStr.replace(/[^\d]/g, "");
    return cleaned ? parseInt(cleaned, 10) : 0;
  };

  // Cart operations
  const addToCart = (product: Product, size = "Unstitched Fabric", quantity = 1) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (item) =>
          item.product.id === product.id &&
          item.size === size &&
          (item.product.color || "") === (product.color || "")
      );
      if (existingIndex > -1) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: next[existingIndex].quantity + quantity,
        };
        return next;
      }
      return [...prev, { product, size, quantity }];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (productId: string, size: string, color?: string) => {
    setCart((prev) =>
      prev.filter(
        (item) =>
          !(
            item.product.id === productId &&
            item.size === size &&
            (color === undefined || (item.product.color || "") === (color || ""))
          )
      )
    );
  };

  const updateQuantity = (productId: string, size: string, quantity: number, color?: string) => {
    if (quantity <= 0) {
      removeFromCart(productId, size, color);
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId &&
        item.size === size &&
        (color === undefined || (item.product.color || "") === (color || ""))
          ? { ...item, quantity }
          : item
      )
    );
  };

  const clearCart = () => {
    setCart([]);
  };

  const totalCartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const cartSubtotal = cart.reduce((acc, item) => {
    const price = parsePrice(item.product.price);
    return acc + price * item.quantity;
  }, 0);

  // Instant Checkout for "Buy Now" flow
  const startInstantCheckout = (product: Product, size = "Unstitched Fabric") => {
    setInstantCheckoutProduct({ product, size });
    setIsCheckoutOpen(true);
  };

  const closeCheckout = () => {
    setIsCheckoutOpen(false);
    setInstantCheckoutProduct(null);
  };

  // Real Order Placement (Called during checkout)
  const placeOrder = async (details: {
    customer: CustomerInfo;
    shippingAddress: ShippingAddress;
    paymentMethod: PaymentMethod;
    paymentDetails?: OrderPaymentDetails;
    paymentStatus?: PaymentStatus;
    notes?: string;
    referralCode?: string;
    referralDiscount?: number;
  }): Promise<Order> => {
    let orderItems: {
      productId: string;
      productName: string;
      productImage: string;
      color: string;
      size: string;
      unitPrice: number;
      quantity: number;
      totalPrice: number;
    }[] = [];

    let subtotal = 0;

    if (instantCheckoutProduct) {
      const p = instantCheckoutProduct.product;
      const unit = parsePrice(p.price);
      orderItems = [
        {
          productId: p.id,
          productName: p.name,
          productImage: p.image,
          color: p.color,
          size: instantCheckoutProduct.size,
          unitPrice: unit,
          quantity: 1,
          totalPrice: unit,
        },
      ];
      subtotal = unit;
    } else {
      orderItems = cart.map((item) => {
        const unit = parsePrice(item.product.price);
        return {
          productId: item.product.id,
          productName: item.product.name,
          productImage: item.product.image,
          color: item.product.color,
          size: item.size,
          unitPrice: unit,
          quantity: item.quantity,
          totalPrice: unit * item.quantity,
        };
      });
      subtotal = cartSubtotal;
    }

    // Free delivery on ₹1,999+ otherwise ₹150 express shipping
    const discount = Math.max(0, details.referralDiscount || 0);
    const shippingFee = subtotal >= 1999 || subtotal === 0 ? 0 : 150;
    const total = Math.max(0, subtotal - discount + shippingFee);

    // Create real order in Firestore database
    const newOrder = await createRealOrder({
      userId: currentUser?.uid,
      customer: details.customer,
      shippingAddress: details.shippingAddress,
      customerAddress: details.shippingAddress,
      items: orderItems.map((item) => ({
        ...item,
        name: item.productName,
      })),
      subtotal,
      shippingFee,
      total,
      totalAmount: total,
      referralDiscount: discount,
      referralCode: details.referralCode,
      paymentMethod: details.paymentMethod,
      paymentDetails: details.paymentDetails,
      paymentStatus: (details.paymentStatus || (details.paymentDetails?.utrNumber ? "Payment Verification Pending" : "Pending")) as PaymentStatus,
      confirmationMessageDispatched: true,
      confirmationMessageChannel: "Both",
      orderStatus: "pending",
      status: "pending",
      notes: details.notes || "",
      isTest: false, // strictly marked as real customer order
    });

    // If referral discount was applied, mark referral code as consumed by this customer ID
    if (details.referralCode && discount > 0) {
      try {
        if (currentUser?.uid) {
          await updateProfileDetails({
            claimedReferralDiscount: true,
            usedReferralCode: details.referralCode,
            referralDiscountAvailable: 0,
          });
        }
        localStorage.removeItem("hos_pending_referral");
        localStorage.removeItem("hos_referral_discount");
        const custEmail = (details.customer?.email || currentUser?.email || "").toLowerCase().trim();
        if (custEmail) {
          localStorage.setItem(`hos_claimed_ref_${custEmail}`, "true");
        }
      } catch (e) {
        console.warn("Notice: customer referral state cleanup:", e);
      }
    }

    // Save to local placed orders list for immediate persistence and guest retrieval
    try {
      const existing: Order[] = JSON.parse(localStorage.getItem("hos_placed_orders") || "[]");
      const updated = [newOrder, ...existing.filter((o) => o.id !== newOrder.id && o.orderNumber !== newOrder.orderNumber)];
      localStorage.setItem("hos_placed_orders", JSON.stringify(updated));
      setCustomerOrders(updated);
    } catch (e) {
      console.warn("Failed saving placed order locally:", e);
    }

    // Clear cart if this was a cart checkout
    if (!instantCheckoutProduct) {
      clearCart();
    }
    setInstantCheckoutProduct(null);

    return newOrder;
  };

  const bookAtelierSession = async (
    bookingData: Omit<AtelierBooking, "id" | "bookingNumber" | "createdAt" | "updatedAt" | "status">
  ): Promise<AtelierBooking> => {
    const booking = await createAtelierBooking({
      ...bookingData,
      userId: currentUser?.uid || bookingData.userId,
    });
    setAtelierBookings((prev) => [booking, ...prev.filter((b) => b.id !== booking.id)]);
    return booking;
  };

  const toggleWishlist = (productId: string) => {
    setWishlist((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      try {
        localStorage.setItem("hos_wishlist", JSON.stringify(Array.from(next)));
      } catch (e) {
        console.warn("Failed to persist wishlist:", e);
      }
      return next;
    });
  };

  const isWishlisted = (productId: string) => wishlist.has(productId);

  const updateProduct = (id: string, updates: Partial<Product>) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p))
    );
  };

  const handleConfirmCustomerOrderPayment = async (
    orderIdOrNumber: string,
    utrNumber: string,
    paymentMethod: string = "UPI / QR Code"
  ) => {
    const res = await confirmOrderPayment(orderIdOrNumber, utrNumber, paymentMethod);
    if (res.success) {
      setCustomerOrders((prev) =>
        prev.map((ord) => {
          if (ord.id === orderIdOrNumber || ord.orderNumber === orderIdOrNumber) {
            return {
              ...ord,
              paymentStatus: "Payment Verification Pending" as PaymentStatus,
              utrNumber: utrNumber.trim(),
              paymentDetails: {
                ...ord.paymentDetails,
                methodType: "upi",
                utrNumber: utrNumber.trim(),
                paidAt: new Date().toISOString(),
              },
            };
          }
          return ord;
        })
      );
    }
    return res;
  };

  return (
    <StoreContext.Provider
      value={{
        siteContent,
        products,
        categories,
        loadingCatalog,
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalCartCount,
        cartSubtotal,
        isCartOpen,
        setIsCartOpen,
        isCheckoutOpen,
        setIsCheckoutOpen,
        instantCheckoutProduct,
        startInstantCheckout,
        closeCheckout,
        placeOrder,
        wishlist,
        toggleWishlist,
        isWishlisted,
        currentUser,
        authLoading,
        customerProfile,
        customerOrders,
        atelierBookings,
        refreshCustomerOrders,
        confirmCustomerOrderPayment: handleConfirmCustomerOrderPayment,
        updateProfileDetails,
        bookAtelierSession,
        signIn: handleSignIn,
        signUp: handleSignUp,
        signOut: handleSignOut,
        resetPassword: handleResetPassword,
        setSiteContent,
        setProducts,
        updateProduct,
        factoryReset: factoryResetCatalog,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useStore must be used within a StoreProvider");
  }
  return context;
}
