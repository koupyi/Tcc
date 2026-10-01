import { useState } from "react";
import { motion } from "framer-motion";
import { Minus, Plus, Trash2, ShoppingBag, RefreshCw } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { Link } from "react-router-dom";

const PRODUCT_PLACEHOLDER = "/images/product-placeholder.svg";

const CartPage = () => {
  const { items, removeItem, updateQuantity, totalPrice, totalItems, isLoading, error, refetch } = useCart();

  // Loading state
  if (isLoading && items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-32 text-center">
        <div className="animate-pulse space-y-4 max-w-2xl mx-auto">
          <div className="h-8 bg-muted rounded w-48 mx-auto" />
          <div className="h-24 bg-muted rounded" />
          <div className="h-24 bg-muted rounded" />
        </div>
      </div>
    );
  }

  // Error state
  if (error && items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-32 text-center">
        <ShoppingBag className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-bold tracking-tight mb-2">Não foi possível carregar seu carrinho</h1>
        <p className="text-foreground mb-6">{error}</p>
        <button
          onClick={refetch}
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-md shadow-button"
        >
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </button>
      </div>
    );
  }

  // Empty state
  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-32 text-center">
        <ShoppingBag className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-3xl font-bold tracking-tight mb-2">Seu carrinho está vazio</h1>
        <p className="text-foreground mb-8">Que tal montar o teclado dos seus sonhos?</p>
        <Link to="/products" className="inline-flex px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-md shadow-button">
          Ver produtos
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-4xl font-bold tracking-tight mb-8">Carrinho</h1>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <CartItemRow
              key={item.id}
              item={item}
              onUpdateQuantity={updateQuantity}
              onRemove={removeItem}
            />
          ))}
        </div>

        <div className="bg-card rounded-lg shadow-card p-6 h-fit sticky top-24">
          <h3 className="font-semibold text-lg mb-4">Resumo do pedido</h3>
          <div className="space-y-2 text-sm mb-6">
            <div className="flex justify-between text-foreground">
              <span>Itens ({totalItems})</span>
              <span className="tabular-nums">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalPrice)}
              </span>
            </div>
            <div className="flex justify-between text-foreground">
              <span>Frete</span>
              <span>Grátis</span>
            </div>
            <div className="border-t border-border pt-2 flex justify-between text-foreground-strong font-semibold">
              <span>Total</span>
              <span className="tabular-nums">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalPrice)}
              </span>
            </div>
          </div>
          <Link
            to="/checkout"
            className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-md shadow-button text-center block"
          >
            Finalizar compra
          </Link>
        </div>
      </div>
    </div>
  );
};

// --- Cart Item Row with proper image handling ---

interface CartItemRowProps {
  item: { id: string; name: string; price: number; quantity: number; image: string };
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
}

function CartItemRow({ item, onUpdateQuantity, onRemove }: CartItemRowProps) {
  const [imgError, setImgError] = useState(false);

  const imgSrc = imgError || !item.image ? PRODUCT_PLACEHOLDER : item.image;

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="bg-card rounded-lg shadow-card p-4 flex items-center gap-4"
    >
      <div className="h-16 w-16 rounded-md overflow-hidden shrink-0 bg-muted">
        <img
          src={imgSrc}
          alt={item.name}
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => {
            if (!imgError) setImgError(true);
          }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-sm truncate">{item.name}</h3>
        <p className="text-primary font-semibold text-sm tabular-nums">
          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.price)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
          className="p-1 rounded bg-accent hover:bg-accent/80 text-foreground-strong"
          aria-label="Diminuir quantidade"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold w-8 text-center tabular-nums text-foreground-strong">
          {item.quantity}
        </span>
        <button
          onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
          className="p-1 rounded bg-accent hover:bg-accent/80 text-foreground-strong"
          aria-label="Aumentar quantidade"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <p className="text-sm font-semibold text-foreground-strong tabular-nums w-24 text-right">
        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.price * item.quantity)}
      </p>
      <button
        onClick={() => onRemove(item.id)}
        className="p-2 text-destructive hover:bg-destructive/10 rounded transition-colors"
        aria-label={`Remover ${item.name}`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </motion.div>
  );
}

export default CartPage;
