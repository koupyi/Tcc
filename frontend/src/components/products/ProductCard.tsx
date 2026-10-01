import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Heart, ShoppingCart, Star, Loader2 } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useBuyNow } from "@/hooks/useBuyNow";
import { StockBadge } from "@/components/products/StockBadge";
import { PriceDisplay } from "@/components/products/PriceDisplay";
import type { ProductCardModel } from "@/types/productCard";

const PLACEHOLDER_IMAGE = "/images/product-placeholder.svg";

interface ProductCardProps {
  product: ProductCardModel;
  /** Above-the-fold cards (e.g. first row) should skip lazy loading to protect LCP. */
  priority?: boolean;
}

export function ProductCard({ product, priority = false }: ProductCardProps) {
  const { addItem } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { buyNow, isBuying } = useBuyNow();
  const [isAdding, setIsAdding] = useState(false);
  const [imgSrc, setImgSrc] = useState(product.imageUrl || PLACEHOLDER_IMAGE);

  const detailUrl = `/products/${product.slug}`;
  const inStock = product.stockQty > 0;
  const hasSingleVariant = product.variantCount === 1 && !!product.variantId;
  const needsVariantSelection = product.variantCount > 1;
  const favorite = isFavorite(product.id);

  const cartPayload = {
    variantId: product.variantId as string,
    name: product.name,
    price: product.salePrice ?? product.basePrice,
    image: product.imageUrl || PLACEHOLDER_IMAGE,
  };

  const handleAddToCart = async () => {
    if (!hasSingleVariant || !inStock || isAdding) return;
    setIsAdding(true);
    try {
      await addItem(cartPayload);
    } finally {
      setIsAdding(false);
    }
  };

  const handleBuyNow = async () => {
    if (!hasSingleVariant || !inStock || isBuying) return;
    await buyNow(cartPayload);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -4 }}
      className="bg-card rounded-lg shadow-card overflow-hidden group relative flex flex-col"
    >
      <button
        type="button"
        onClick={() => toggleFavorite(product.id, product.name)}
        aria-label={favorite ? `Remover ${product.name} dos favoritos` : `Adicionar ${product.name} aos favoritos`}
        aria-pressed={favorite}
        className="absolute top-2 right-2 z-10 h-8 w-8 flex items-center justify-center rounded-full bg-background/80 backdrop-blur-sm hover:bg-background transition-colors"
      >
        <Heart className={`h-4 w-4 ${favorite ? "fill-primary text-primary" : "text-foreground"}`} />
      </button>

      <Link to={detailUrl} aria-label={`Ver detalhes de ${product.name}`}>
        <div className="h-48 bg-accent flex items-center justify-center overflow-hidden">
          <img
            src={imgSrc}
            alt={product.imageAlt}
            loading={priority ? "eager" : "lazy"}
            onError={() => setImgSrc(PLACEHOLDER_IMAGE)}
            className="h-32 w-32 object-contain transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      </Link>

      <div className="p-4 flex flex-col flex-1">
        {product.categoryName && (
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{product.categoryName}</p>
        )}

        <Link to={detailUrl}>
          <h3 className="font-semibold text-sm mb-1 hover:text-primary transition-colors line-clamp-2">
            {product.name}
          </h3>
        </Link>

        {product.rating !== null ? (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
            <Star className="h-3 w-3 fill-primary text-primary" />
            <span className="tabular-nums">{product.rating.toFixed(1)}</span>
            <span>({product.reviewCount})</span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground mb-1">Sem avaliações</p>
        )}

        <div className="mb-2">
          <StockBadge stockQty={product.stockQty} />
        </div>

        <div className="mt-auto pt-2">
          <PriceDisplay basePrice={product.basePrice} salePrice={product.salePrice} className="mb-3" />

          {needsVariantSelection ? (
            <Link
              to={detailUrl}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-md hover:bg-primary/90 transition-colors"
            >
              Escolher opções
            </Link>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={!inStock || isAdding || isBuying}
                aria-label={`Adicionar ${product.name} ao carrinho`}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-accent text-foreground-strong text-xs font-semibold rounded-md border border-border hover:bg-accent/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAdding ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShoppingCart className="h-3 w-3" />}
                {isAdding ? "Adicionando..." : "Adicionar"}
              </button>
              <button
                type="button"
                onClick={handleBuyNow}
                disabled={!inStock || isAdding || isBuying}
                aria-label={`Comprar ${product.name} agora`}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isBuying ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                {isBuying ? "Processando..." : "Comprar agora"}
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
