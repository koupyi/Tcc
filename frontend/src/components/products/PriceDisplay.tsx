interface PriceDisplayProps {
  basePrice: number;
  salePrice?: number | null;
  className?: string;
}

export function PriceDisplay({ basePrice, salePrice, className = "" }: PriceDisplayProps) {
  const formatPrice = (value: number): string => {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  if (salePrice && salePrice < basePrice) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="text-lg font-bold text-primary tabular-nums">
          {formatPrice(salePrice)}
        </span>
        <span className="text-sm text-muted-foreground line-through tabular-nums">
          {formatPrice(basePrice)}
        </span>
      </div>
    );
  }

  return (
    <span className={`text-lg font-bold text-primary tabular-nums ${className}`}>
      {formatPrice(basePrice)}
    </span>
  );
}
