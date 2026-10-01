import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { communityBuildsApi } from "@/api/communityBuilds";
import { mapApiError } from "@/utils/errorMapper";
import type { CommunityBuildItem } from "@/types/communityBuild";

const PLACEHOLDER_IMAGE = "/images/product-placeholder.svg";

/**
 * "Comprar build" — adds every currently-available component to the cart.
 *
 * Two paths:
 *  - authenticated + no client-side substitution: the atomic backend bulk
 *    endpoint (one transaction, fresh server revalidation of every item).
 *  - guest, or once the user has substituted a component: per-item adds
 *    through the normal cart (guest cart is client-only, so it can never
 *    go through the server bulk endpoint; substituted items only exist
 *    client-side so the backend build definition can't resolve them).
 * Either way, only available components are added, and the user is told
 * exactly what happened — never a silent partial add.
 */
export function useBuildPurchase() {
  const { isAuthenticated } = useAuth();
  const { addItem } = useCart();
  const navigate = useNavigate();
  const [isBuying, setIsBuying] = useState(false);

  const buyBuild = useCallback(
    async (
      buildId: string,
      items: CommunityBuildItem[],
      options?: { useBulkEndpoint?: boolean },
    ): Promise<boolean> => {
      setIsBuying(true);
      try {
        if (isAuthenticated && options?.useBulkEndpoint) {
          try {
            const res = await communityBuildsApi.addToCart(buildId);
            if (res.success && res.data && res.data.added.length > 0) {
              const { added, skipped } = res.data;
              toast.success(
                skipped.length > 0
                  ? `${added.length} componente(s) adicionados ao carrinho. ${skipped.length} indisponível(is) no momento da compra.`
                  : "Componentes da build adicionados ao carrinho.",
              );
              navigate("/cart");
              return true;
            }
            toast.error("Nenhum componente desta build está disponível no momento.");
            return false;
          } catch (err) {
            toast.error(mapApiError(err).message);
            return false;
          }
        }

        const available = items.filter((i) => i.available);
        if (available.length === 0) {
          toast.error("Nenhum componente desta build está disponível no momento.");
          return false;
        }

        let addedCount = 0;
        for (const item of available) {
          const success = await addItem(
            {
              variantId: item.variantId,
              name: item.productName,
              price: item.unitPrice,
              image: item.imageUrl || PLACEHOLDER_IMAGE,
            },
            { silent: true },
          );
          if (success) addedCount++;
        }

        if (addedCount === 0) {
          toast.error("Não foi possível adicionar os componentes ao carrinho.");
          return false;
        }

        const skippedCount = items.length - addedCount;
        toast.success(
          skippedCount > 0
            ? `${addedCount} componente(s) adicionados ao carrinho. ${skippedCount} indisponível(is).`
            : "Componentes da build adicionados ao carrinho.",
        );
        navigate("/cart");
        return true;
      } finally {
        setIsBuying(false);
      }
    },
    [isAuthenticated, addItem, navigate],
  );

  return { buyBuild, isBuying };
}
