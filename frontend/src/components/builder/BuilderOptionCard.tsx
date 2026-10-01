import { motion } from "framer-motion";
import { CheckCircle2, XCircle } from "lucide-react";
import type { BuilderOption } from "@/types/builder";

const PLACEHOLDER_IMAGE = "/images/product-placeholder.svg";

interface BuilderOptionCardProps {
  option: BuilderOption;
  selected: boolean;
  compatible: boolean;
  incompatibleReason?: string;
  /** For switches: how many packs this selection would require for the current layout. */
  quantityLabel?: string;
  onSelect: () => void;
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Selection-only card for the builder ("BuilderOptionCard") — distinct from
 * the commercial `<ProductCard />` used in the catalog/community surfaces.
 * It never offers "Adicionar ao carrinho"/"Comprar agora": its only job is
 * choosing a real component for the current step.
 */
export function BuilderOptionCard({ option, selected, compatible, incompatibleReason, quantityLabel, onSelect }: BuilderOptionCardProps) {
  const inStock = option.stockQty > 0;
  const selectable = compatible && inStock;

  return (
    <motion.button
      type="button"
      whileHover={selectable ? { scale: 1.01 } : undefined}
      whileTap={selectable ? { scale: 0.98 } : undefined}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      disabled={!selectable}
      aria-pressed={selected}
      aria-disabled={!selectable}
      onClick={onSelect}
      className={`relative flex items-center gap-4 rounded-xl p-4 text-left transition-all w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        selected
          ? "bg-primary/15 border-2 border-primary ring-1 ring-primary/30"
          : selectable
            ? "bg-card border border-border hover:border-primary/30"
            : "bg-card/40 border border-border opacity-50 cursor-not-allowed"
      }`}
    >
      <img
        src={option.imageUrl || PLACEHOLDER_IMAGE}
        alt={option.name}
        loading="lazy"
        onError={(e) => {
          (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE;
        }}
        className="h-14 w-14 object-contain shrink-0 bg-accent rounded-lg"
      />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: "hsl(var(--foreground-strong))" }}>
          {option.name}
        </p>
        <p className="text-xs text-muted-foreground truncate">{option.variantName}</p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {option.layout && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{option.layout}</span>
          )}
          {option.switchType && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{option.switchType}</span>
          )}
          {quantityLabel && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-foreground-strong">{quantityLabel}</span>
          )}
        </div>
        {!compatible && incompatibleReason && (
          <p className="text-[10px] text-destructive mt-1">{incompatibleReason}</p>
        )}
        {compatible && !inStock && <p className="text-[10px] text-destructive mt-1">Esgotado</p>}
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-sm font-bold tabular-nums" style={{ color: "hsl(var(--foreground-strong))" }}>
          {formatBRL(option.unitPrice)}
        </span>
        {selectable ? (
          selected ? (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-primary font-medium">
              <CheckCircle2 className="h-3 w-3" /> Selecionado
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground">Disponível</span>
          )
        ) : (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-destructive font-medium">
            <XCircle className="h-3 w-3" /> {inStock ? "Incompatível" : "Esgotado"}
          </span>
        )}
      </div>
    </motion.button>
  );
}
