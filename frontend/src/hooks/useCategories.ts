import { useState, useEffect, useCallback } from "react";
import { categoriesApi, Category } from "@/api/categories";

interface UseCategoriesState {
  categories: Category[];
  isLoading: boolean;
  error: string | null;
}

interface UseCategoriesReturn extends UseCategoriesState {
  refetch: () => void;
}

export function useCategories(): UseCategoriesReturn {
  const [state, setState] = useState<UseCategoriesState>({
    categories: [],
    isLoading: true,
    error: null,
  });

  const fetchCategories = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await categoriesApi.list();
      if (response.success && response.data) {
        setState({
          categories: response.data as Category[],
          isLoading: false,
          error: null,
        });
      } else {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: response.message || "Erro ao carregar categorias",
        }));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao carregar categorias";
      setState((prev) => ({ ...prev, isLoading: false, error: message }));
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return { ...state, refetch: fetchCategories };
}
