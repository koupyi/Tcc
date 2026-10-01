import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ShoppingCart, ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import { useProduct } from "@/hooks/useProduct";
import { useCart } from "@/context/CartContext";
import { useBuyNow } from "@/hooks/useBuyNow";
import { ProductGallery } from "@/components/products/ProductGallery";
import { VariantSelector } from "@/components/products/VariantSelector";
import { StockBadge } from "@/components/products/StockBadge";
import { PriceDisplay } from "@/components/products/PriceDisplay";
import { ProductCard } from "@/components/products/ProductCard";
import { toProductCardModel } from "@/adapters/productCard";
import { productsApi } from "@/api/products";
import { mapApiError } from "@/utils/errorMapper";
import { toast } from "sonner";
import type { ProductVariant, ProductListItem } from "@/types/product";

const ProductDetailPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { product, isLoading, error, notFound, refetch } = useProduct(slug);
  const { addItem } = useCart();
  const { buyNow, isBuying } = useBuyNow();
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [related, setRelated] = useState<ProductListItem[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);

  // Related products — same category, excluding the current product.
  useEffect(() => {
    if (!product?.categoryId) {
      setRelated([]);
      return;
    }
    let cancelled = false;
    setRelatedLoading(true);
    productsApi
      .list({ categoryId: product.categoryId, limit: "5" })
      .then((res) => {
        if (cancelled || !res.success || !res.data) return;
        const items = (res.data as unknown as ProductListItem[])
          .filter((p) => p.id !== product.id)
          .slice(0, 4);
        setRelated(items);
      })
      .catch(() => {
        if (!cancelled) setRelated([]);
      })
      .finally(() => {
        if (!cancelled) setRelatedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [product?.categoryId, product?.id]);

  // Auto-select first variant when product loads
  useEffect(() => {
    if (product && product.variants.length > 0 && !selectedVariant) {
      setSelectedVariant(product.variants[0]);
    }
  }, [product, selectedVariant]);

  // Loading state
  if (isLoading) {
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
        <h1 className="text-2xl font-bold mb-2">Erro ao carregar produto</h1>
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

  // 404 state
  if (notFound || !product) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-4xl font-bold mb-2">Produto não encontrado</h1>
        <p className="text-foreground mb-6">O produto que você procura não existe ou foi removido.</p>
        <Link
          to="/products"
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-md"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para produtos
        </Link>
      </div>
    );
  }

  const currentPrice = selectedVariant?.price ?? product.basePrice;
  const currentStock = selectedVariant?.stockQty ?? 0;
  const canAddToCart = selectedVariant && currentStock > 0;

  const buildCartPayload = () => ({
    id: selectedVariant!.id,
    variantId: selectedVariant!.id,
    name: `${product.name} — ${selectedVariant!.name}`,
    price: Number(currentPrice),
    image: product.images[0]?.url || "",
    quantity,
  });

  const handleAddToCart = async () => {
    if (!selectedVariant) {
      toast.error("Selecione uma variante");
      return;
    }
    if (currentStock <= 0) {
      toast.error("Produto esgotado");
      return;
    }
    if (isAdding || isBuying) return;

    setIsAdding(true);
    try {
      await addItem(buildCartPayload());
    } catch (err) {
      toast.error(mapApiError(err).message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleBuyNow = async () => {
    if (!selectedVariant) {
      toast.error("Selecione uma variante");
      return;
    }
    if (currentStock <= 0) {
      toast.error("Produto esgotado");
      return;
    }
    if (isAdding || isBuying) return;

    await buyNow(buildCartPayload());
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6">
        <Link to="/products" className="text-sm text-muted-foreground hover:text-foreground-strong inline-flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Voltar para produtos
        </Link>
      </nav>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12"
      >
        {/* Gallery */}
        <ProductGallery images={product.images} productName={product.name} />

        {/* Product Info */}
        <div className="space-y-6">
          {/* Category */}
          {product.category && (
            <p className="text-xs text-muted-foreground uppercase tracking-widest">
              {product.category.name}
            </p>
          )}

          {/* Name */}
          <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>

          {/* Price */}
          <PriceDisplay
            basePrice={Number(product.basePrice)}
            salePrice={selectedVariant?.price ? Number(selectedVariant.price) : product.salePrice ? Number(product.salePrice) : null}
          />

          {/* Description */}
          {product.description && (
            <p className="text-foreground leading-relaxed">{product.description}</p>
          )}

          {/* Specs */}
          {product.specs && Object.keys(product.specs).length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground-strong">Especificações</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(product.specs).map(([key, value]) => (
                  <div key={key} className="text-sm">
                    <span className="text-muted-foreground capitalize">{key}:</span>{" "}
                    <span className="text-foreground-strong">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Variant Selector */}
          <VariantSelector
            variants={product.variants}
            selectedVariantId={selectedVariant?.id || null}
            onSelect={setSelectedVariant}
          />

          {/* Stock */}
          <StockBadge stockQty={currentStock} />

          {/* SKU */}
          {selectedVariant && (
            <p className="text-xs text-muted-foreground">
              SKU: {selectedVariant.sku}
            </p>
          )}

          {/* Quantity + Add to Cart */}
          <div className="flex items-center flex-wrap gap-4 pt-2">
            <div className="flex items-center border border-border rounded-md">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="px-3 py-2 text-foreground-strong hover:bg-accent"
                aria-label="Diminuir quantidade"
              >
                −
              </button>
              <span className="px-4 py-2 text-sm font-medium tabular-nums text-foreground-strong">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity((q) => Math.min(currentStock, q + 1))}
                className="px-3 py-2 text-foreground-strong hover:bg-accent"
                disabled={quantity >= currentStock}
                aria-label="Aumentar quantidade"
              >
                +
              </button>
            </div>

            <motion.button
              whileHover={canAddToCart ? { scale: 1.02 } : {}}
              whileTap={canAddToCart ? { scale: 0.98 } : {}}
              onClick={handleAddToCart}
              disabled={!canAddToCart || isAdding || isBuying}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-accent text-foreground-strong font-semibold rounded-md border border-border disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ShoppingCart className="h-4 w-4" />
              {currentStock > 0 ? (isAdding ? "Adicionando..." : "Adicionar ao carrinho") : "Esgotado"}
            </motion.button>

            <motion.button
              whileHover={canAddToCart ? { scale: 1.02 } : {}}
              whileTap={canAddToCart ? { scale: 0.98 } : {}}
              onClick={handleBuyNow}
              disabled={!canAddToCart || isAdding || isBuying}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground font-semibold rounded-md shadow-button disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {currentStock > 0 ? (isBuying ? "Processando..." : "Comprar agora") : "Esgotado"}
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Related products */}
      {relatedLoading ? (
        <div className="mt-16 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : related.length > 0 ? (
        <section className="mt-16">
          <h2 className="text-2xl font-bold tracking-tight mb-6">Produtos relacionados</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {related.map((r) => (
              <ProductCard key={r.id} product={toProductCardModel(r)} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
};

export default ProductDetailPage;
