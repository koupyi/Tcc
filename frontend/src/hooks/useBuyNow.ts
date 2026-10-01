import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart, CartItem } from "@/context/CartContext";

/**
 * Single "Comprar agora" behavior shared by every commercial surface:
 * add the item to the cart, and only navigate to checkout if that
 * actually succeeded. Never fake a purchase, never navigate on failure.
 */
export function useBuyNow() {
  const { addItem } = useCart();
  const navigate = useNavigate();
  const [isBuying, setIsBuying] = useState(false);

  const buyNow = useCallback(
    async (item: Omit<CartItem, "quantity" | "id"> & { id?: string; quantity?: number }) => {
      setIsBuying(true);
      try {
        const success = await addItem(item);
        if (success) {
          navigate("/checkout");
        }
        return success;
      } finally {
        setIsBuying(false);
      }
    },
    [addItem, navigate],
  );

  return { buyNow, isBuying };
}
