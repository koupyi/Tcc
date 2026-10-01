import { CheckCircle, XCircle } from "lucide-react";

interface StockBadgeProps {
  stockQty: number;
}

export function StockBadge({ stockQty }: StockBadgeProps) {
  if (stockQty > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-600">
        <CheckCircle className="h-4 w-4" />
        Em estoque ({stockQty} disponíveis)
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-destructive">
      <XCircle className="h-4 w-4" />
      Esgotado
    </span>
  );
}
