import type { BuilderConfiguration } from "@/types/builder";
import { layoutLabel } from "@/utils/builderLayout";

interface BuilderSummaryProps {
  configuration: BuilderConfiguration;
  total: number;
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const ROWS: Array<{ key: keyof BuilderConfiguration; label: string }> = [
  { key: "case", label: "Case" },
  { key: "pcb", label: "PCB" },
  { key: "plate", label: "Plate" },
  { key: "switch", label: "Switches" },
  { key: "keycap", label: "Keycaps" },
];

/** Always-visible real-time price breakdown — updates on every selection change. */
export function BuilderSummary({ configuration, total }: BuilderSummaryProps) {
  const extrasTotal = configuration.extras.reduce((sum, e) => sum + e.unitPrice * e.quantity, 0);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Seu build</p>

      {configuration.layout && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Layout</span>
          <span className="font-medium" style={{ color: "hsl(var(--foreground-strong))" }}>{layoutLabel(configuration.layout)}</span>
        </div>
      )}

      {ROWS.map(({ key, label }) => {
        const item = configuration[key] as BuilderConfiguration["case"];
        return (
          <div key={key} className="flex items-center justify-between text-sm gap-2">
            <span className="text-muted-foreground shrink-0">{label}</span>
            {item ? (
              <span className="flex items-center gap-2 min-w-0">
                <span className="truncate text-right" style={{ color: "hsl(var(--foreground-strong))" }}>{item.name}</span>
                <span className="tabular-nums font-medium shrink-0">{formatBRL(item.unitPrice * item.quantity)}</span>
              </span>
            ) : (
              <span className="text-muted-foreground/60">—</span>
            )}
          </div>
        );
      })}

      {configuration.extras.length > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Extras ({configuration.extras.length})</span>
          <span className="tabular-nums font-medium">{formatBRL(extrasTotal)}</span>
        </div>
      )}

      <div className="border-t border-border pt-3 flex items-center justify-between">
        <span className="text-sm font-semibold" style={{ color: "hsl(var(--foreground-strong))" }}>Total</span>
        <span data-testid="builder-total" className="text-xl font-bold text-primary tabular-nums">{formatBRL(total)}</span>
      </div>
    </div>
  );
}
