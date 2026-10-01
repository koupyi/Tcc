import { useState, useEffect, useCallback } from "react";
import { productsApi } from "@/api/products";
import type { ProductDetail } from "@/types/product";

interface UseProductState {
  product: ProductDetail | null;
  isLoading: boolean;
  error: string | null;
  notFound: boolean;
}

interface UseProductReturn extends UseProductState {
  refetch: () => void;
}

export function useProduct(slug: string | undefined): UseProductReturn {
  const [state, setState] = useState<UseProductState>({
    product: null,
    isLoading: true,
    error: null,
    notFound: false,
  });

  const fetchProduct = useCallback(async () => {
    if (!slug) {
      setState({ product: null, isLoading: false, error: null, notFound: true });
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null, notFound: false }));
    try {
      const response = await productsApi.getBySlug(slug);
      if (response.success && response.data) {
        setState({
          product: response.data as unknown as ProductDetail,
          isLoading: false,
          error: null,
          notFound: false,
        });
      } else {
        setState({ product: null, isLoading: false, error: null, notFound: true });
      }
    } catch (err) {
      const apiErr = err as { code?: string; message?: string };
      if (apiErr.code === "NOT_FOUND") {
        setState({ product: null, isLoading: false, error: null, notFound: true });
      } else {
        const message = apiErr.message || "Erro ao carregar produto";
        setState({ product: null, isLoading: false, error: message, notFound: false });
      }
    }
  }, [slug]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  return { ...state, refetch: fetchProduct };
}
