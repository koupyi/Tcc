import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Loader2, AlertTriangle } from "lucide-react";
import { useProducts } from "@/hooks/useProducts";
import { SearchInput } from "@/components/products/SearchInput";
import { Pagination } from "@/components/products/Pagination";
import { CategoryFilter } from "@/components/products/CategoryFilter";
import { ProductCard } from "@/components/products/ProductCard";
import { toProductCardModel } from "@/adapters/productCard";
import type { ProductListParams } from "@/types/product";

const ITEMS_PER_PAGE = 8;

const ProductsPage = () => {
  const [params, setParams] = useState<ProductListParams>({ limit: ITEMS_PER_PAGE });
  const { products, meta, isLoading, error, refetch } = useProducts(params);
  const [sort, setSort] = useState("newest");

  const handleSearch = useCallback((search: string) => {
    setParams((prev) => ({ ...prev, search: search || undefined, page: 1 }));
  }, []);

  const handleCategoryChange = useCallback((categoryId: string | undefined) => {
    setParams((prev) => ({ ...prev, categoryId, page: 1 }));
  }, []);

  const handleSort = (value: string) => {
    setSort(value);
    const sortMap: Record<string, { sortBy?: string; sortOrder?: string }> = {
      newest: {},
      "price-low": { sortBy: "price", sortOrder: "asc" },
      "price-high": { sortBy: "price", sortOrder: "desc" },
      name: { sortBy: "name", sortOrder: "asc" },
    };
    setParams((prev) => ({ ...prev, ...sortMap[value], page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setParams((prev) => ({ ...prev, page }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Loading state
  if (isLoading && products.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Erro ao carregar produtos</h1>
        <p className="text-foreground mb-6">{error}</p>
        <button
          onClick={refetch}
          className="px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-md"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1 className="text-4xl font-bold tracking-tight mb-2">Produtos</h1>
        <p className="text-foreground mb-8">Peças premium para o seu próximo setup.</p>
      </motion.div>

      {/* Search + Sort */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <SearchInput onSearch={handleSearch} isLoading={isLoading} />

        <select
          value={sort}
          onChange={(e) => handleSort(e.target.value)}
          className="bg-card border border-border rounded-md px-3 py-2.5 text-sm text-foreground-strong focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
          aria-label="Ordenar por"
        >
          <option value="newest">Mais recentes</option>
          <option value="price-low">Preço: menor para maior</option>
          <option value="price-high">Preço: maior para menor</option>
          <option value="name">Nome A-Z</option>
        </select>
      </div>

      {/* Category Filter */}
      <div className="mb-6">
        <CategoryFilter
          selectedCategoryId={params.categoryId}
          onCategoryChange={handleCategoryChange}
        />
      </div>

      {/* Results count */}
      {meta && (
        <p className="text-sm text-muted-foreground mb-6">
          {meta.total} {meta.total === 1 ? "produto encontrado" : "produtos encontrados"}
          {params.search && <span> para &quot;{params.search}&quot;</span>}
        </p>
      )}

      {/* Product Grid */}
      {products.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product, i) => (
            <ProductCard key={product.id} product={toProductCardModel(product)} priority={i < 4} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-foreground">
          <p className="text-lg">Nenhum produto encontrado.</p>
          {params.search && (
            <p className="text-sm text-muted-foreground mt-2">
              Tente buscar com outros termos.
            </p>
          )}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="mt-10">
          <Pagination meta={meta} onPageChange={handlePageChange} />
        </div>
      )}
    </div>
  );
};

export default ProductsPage;
