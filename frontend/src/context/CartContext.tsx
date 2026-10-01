import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { cartApi, Cart as ApiCart, CartItem as ApiCartItem } from "../api/cart";
import { useAuth } from "./AuthContext";
import { mapApiError } from "../utils/errorMapper";
import { toast } from "sonner";

const PRODUCT_PLACEHOLDER = "/images/product-placeholder.svg";

export interface CartItem {
  id: string;
  variantId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

interface CartContextType {
  items: CartItem[];
  /** Resolves to true when the item was actually added (server-confirmed for authenticated users), false otherwise. */
  addItem: (
    item: Omit<CartItem, "quantity" | "id"> & { id?: string; quantity?: number },
    opts?: { silent?: boolean },
  ) => Promise<boolean>;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const ANON_CART_KEY = "anon_cart";

// --- localStorage helpers ---

function getAnonCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(ANON_CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAnonCart(items: CartItem[]): void {
  try {
    localStorage.setItem(ANON_CART_KEY, JSON.stringify(items));
  } catch {
    // Storage unavailable
  }
}

function clearAnonCart(): void {
  try {
    localStorage.removeItem(ANON_CART_KEY);
  } catch {
    // Ignore
  }
}

// --- API response mapper ---

function mapApiCartToItems(apiCart: ApiCart): CartItem[] {
  return apiCart.items.map((item: ApiCartItem) => ({
    id: item.id,
    variantId: item.variantId,
    name: item.variant?.product?.name
      ? `${item.variant.product.name} — ${item.variant.name}`
      : item.variant?.name || "Produto",
    price: Number(item.unitPrice),
    quantity: item.quantity,
    image:
      item.variant?.product?.images?.[0]?.url ||
      item.variant?.images?.[0]?.url ||
      PRODUCT_PLACEHOLDER,
  }));
}

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, status } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevAuthRef = useRef(false);
  const initializedRef = useRef(false);

  // Load cart from backend for authenticated user
  const loadAuthenticatedCart = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await cartApi.get();
      if (response.success && response.data) {
        setItems(mapApiCartToItems(response.data));
      }
    } catch (err) {
      const mapped = mapApiError(err);
      setError(mapped.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initialize: load anon cart from localStorage or fetch from backend
  useEffect(() => {
    if (initializedRef.current) return;
    if (status === "loading") return; // Wait for auth to resolve
    initializedRef.current = true;

    if (isAuthenticated) {
      // Authenticated on init (page refresh) — load from backend
      loadAuthenticatedCart();
    } else {
      // Not authenticated — load from localStorage
      const anonItems = getAnonCart();
      if (anonItems.length > 0) {
        setItems(anonItems);
      }
    }
  }, [isAuthenticated, status, loadAuthenticatedCart]);

  // Auth state change: merge on login, clear on logout
  useEffect(() => {
    if (status === "loading") return;
    if (!initializedRef.current) return;

    const wasAuthenticated = prevAuthRef.current;
    prevAuthRef.current = isAuthenticated;

    if (isAuthenticated && !wasAuthenticated) {
      // Just logged in — merge anon cart then load from backend
      const anonItems = getAnonCart();
      setIsLoading(true);
      setError(null);

      const mergeAndLoad = async () => {
        try {
          if (anonItems.length > 0) {
            const mergePayload = anonItems.map((i) => ({
              variantId: i.variantId,
              quantity: i.quantity,
            }));
            const mergeResult = await cartApi.merge(mergePayload);

            // Only clear anon cart after successful merge
            clearAnonCart();

            // Notify user of adjusted items
            if (mergeResult.success && mergeResult.data) {
              const data = mergeResult.data as unknown as { adjusted?: Array<{ reason: string }> };
              if (data.adjusted && data.adjusted.length > 0) {
                data.adjusted.forEach((adj) => {
                  toast.warning(adj.reason);
                });
              }
            }
          }

          // Load final cart from backend
          const response = await cartApi.get();
          if (response.success && response.data) {
            setItems(mapApiCartToItems(response.data));
          }
        } catch {
          // If merge/load fails, still try to load cart
          try {
            const response = await cartApi.get();
            if (response.success && response.data) {
              setItems(mapApiCartToItems(response.data));
            }
          } catch {
            // Keep anon items visible — don't clear localStorage on failure
          }
        } finally {
          setIsLoading(false);
        }
      };

      mergeAndLoad();
    } else if (!isAuthenticated && wasAuthenticated) {
      // Just logged out — show fresh anon cart
      const anonItems = getAnonCart();
      setItems(anonItems);
      setError(null);
    }
  }, [isAuthenticated, status]);

  const refetch = useCallback(() => {
    if (isAuthenticated) {
      loadAuthenticatedCart();
    } else {
      setItems(getAnonCart());
      setError(null);
    }
  }, [isAuthenticated, loadAuthenticatedCart]);

  const addItem = useCallback(
    (
      item: Omit<CartItem, "quantity" | "id"> & { id?: string; quantity?: number },
      opts?: { silent?: boolean },
    ): Promise<boolean> => {
      const quantity = item.quantity || 1;

      if (isAuthenticated) {
        setIsLoading(true);
        return cartApi
          .addItem(item.variantId, quantity)
          .then((response) => {
            if (response.success && response.data) {
              setItems(mapApiCartToItems(response.data));
              if (!opts?.silent) toast.success("Item adicionado ao carrinho");
              return true;
            }
            return false;
          })
          .catch((err) => {
            const mapped = mapApiError(err);
            if (!opts?.silent) toast.error(mapped.message);
            return false;
          })
          .finally(() => setIsLoading(false));
      }

      setItems((prev) => {
        const existing = prev.find((i) => i.variantId === item.variantId);
        let updated: CartItem[];
        if (existing) {
          updated = prev.map((i) =>
            i.variantId === item.variantId
              ? { ...i, quantity: i.quantity + quantity }
              : i,
          );
        } else {
          const newItem: CartItem = {
            id: `anon-${item.variantId}`,
            variantId: item.variantId,
            name: item.name,
            price: item.price,
            quantity,
            image: item.image || PRODUCT_PLACEHOLDER,
          };
          updated = [...prev, newItem];
        }
        saveAnonCart(updated);
        return updated;
      });
      if (!opts?.silent) toast.success("Item adicionado ao carrinho");
      return Promise.resolve(true);
    },
    [isAuthenticated],
  );

  const removeItem = useCallback(
    (id: string) => {
      if (isAuthenticated) {
        setIsLoading(true);
        cartApi
          .removeItem(id)
          .then((response) => {
            if (response.success && response.data) {
              setItems(mapApiCartToItems(response.data));
            }
          })
          .catch((err) => {
            const mapped = mapApiError(err);
            toast.error(mapped.message);
          })
          .finally(() => setIsLoading(false));
      } else {
        setItems((prev) => {
          const updated = prev.filter((i) => i.id !== id);
          saveAnonCart(updated);
          return updated;
        });
      }
    },
    [isAuthenticated],
  );

  const updateQuantity = useCallback(
    (id: string, quantity: number) => {
      if (quantity <= 0) {
        removeItem(id);
        return;
      }

      if (isAuthenticated) {
        setIsLoading(true);
        cartApi
          .updateItem(id, quantity)
          .then((response) => {
            if (response.success && response.data) {
              setItems(mapApiCartToItems(response.data));
            }
          })
          .catch((err) => {
            const mapped = mapApiError(err);
            toast.error(mapped.message);
          })
          .finally(() => setIsLoading(false));
      } else {
        setItems((prev) => {
          const updated = prev.map((i) => (i.id === id ? { ...i, quantity } : i));
          saveAnonCart(updated);
          return updated;
        });
      }
    },
    [isAuthenticated, removeItem],
  );

  const clearCart = useCallback(() => {
    if (isAuthenticated) {
      setIsLoading(true);
      cartApi
        .clear()
        .then(() => {
          setItems([]);
        })
        .catch((err) => {
          const mapped = mapApiError(err);
          toast.error(mapped.message);
        })
        .finally(() => setIsLoading(false));
    } else {
      setItems([]);
      clearAnonCart();
    }
  }, [isAuthenticated]);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice, isLoading, error, refetch }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
};
