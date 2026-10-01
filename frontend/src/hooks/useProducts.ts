import { useState, useEffect, useCallback } from "react";
import { productsApi } from "@/api/products";
import type { ProductListItem, PaginationMeta, ProductListParams } from "@/types/product";

interface UseProductsState {
  products: ProductListItem[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
}

interface UseProductsReturn extends UseProductsState {
  refetch: () => void;
  setParams: (params: ProductListParams) => void;
  params: ProductListParams;
}

export function useProducts(initialParams?: ProductListParams): UseProductsReturn {
  const [params, setParams] = useState<ProductListParams>(initialParams || {});
  const [state, setState] = useState<UseProductsState>({
    products: [],
    meta: null,
    isLoading: true,
    error: null,
  });

  const fetchProducts = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const queryParams: Record<string, string> = {};
      if (params.page) queryParams.page = String(params.page);
      if (params.limit) queryParams.limit = String(params.limit);
      if (params.search) queryParams.search = params.search;
      if (params.categoryId) queryParams.categoryId = params.categoryId;
      if (params.brand) queryParams.brand = params.brand;
      if (params.minPrice) queryParams.minPrice = params.minPrice;
      if (params.maxPrice) queryParams.maxPrice = params.maxPrice;
      if (params.sortBy) queryParams.sortBy = params.sortBy;
      if (params.sortOrder) queryParams.sortOrder = params.sortOrder;

      const response = await productsApi.list(queryParams);
      if (response.success && response.data) {
        setState({
          products: response.data as unknown as ProductListItem[],
          meta: (response.meta as unknown as PaginationMeta) || null,
          isLoading: false,
          error: null,
        });
      } else {
        setState((prev) => ({ ...prev, isLoading: false, error: response.message || "Erro ao carregar produtos" }));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao carregar produtos";
      setState((prev) => ({ ...prev, isLoading: false, error: message }));
    }
  }, [params]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return {
    ...state,
    refetch: fetchProducts,
    setParams,
    params,
  };
}
