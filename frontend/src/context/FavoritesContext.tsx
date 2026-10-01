import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "./AuthContext";
import { toast } from "sonner";

/**
 * Minimal favorites implementation — localStorage-backed, scoped per guest
 * or per authenticated user. There is no backend Wishlist model yet; building
 * one is out of scope for this phase, so this is a deliberately small but
 * real (persisted, working) implementation rather than a decorative button.
 */

interface FavoritesContextType {
  favoriteIds: Set<string>;
  isFavorite: (productId: string) => boolean;
  toggleFavorite: (productId: string, productName: string) => void;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

const GUEST_KEY = "favorites_guest";
const userKey = (userId: string) => `favorites_${userId}`;

function readIds(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeIds(key: string, ids: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // Storage unavailable — favorites simply won't persist this session.
  }
}

export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, status } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const storageKey = user ? userKey(user.id) : GUEST_KEY;
  const initializedKey = useRef<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;
    if (initializedKey.current === storageKey) return;
    initializedKey.current = storageKey;
    setFavoriteIds(new Set(readIds(storageKey)));
  }, [storageKey, status]);

  const toggleFavorite = useCallback(
    (productId: string, productName: string) => {
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        const wasFavorite = next.has(productId);
        if (wasFavorite) {
          next.delete(productId);
        } else {
          next.add(productId);
        }
        writeIds(storageKey, Array.from(next));
        toast.success(wasFavorite ? `${productName} removido dos favoritos.` : `${productName} adicionado aos favoritos.`);
        return next;
      });
    },
    [storageKey],
  );

  const isFavorite = useCallback((productId: string) => favoriteIds.has(productId), [favoriteIds]);

  return (
    <FavoritesContext.Provider value={{ favoriteIds, isFavorite, toggleFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
};

export const useFavorites = () => {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error("useFavorites must be used within FavoritesProvider");
  return context;
};
