import { motion } from "framer-motion";
import { Keyboard } from "lucide-react";
import { keyCountForLayout, layoutLabel } from "@/utils/builderLayout";

interface LayoutSelectorProps {
  /** Normalized layout values actually supported by the real catalog (e.g. ['60','65','75','tkl']). */
  layouts: string[];
  selected: string | null;
  onChange: (layout: string) => void;
}

export function LayoutSelector({ layouts, selected, onChange }: LayoutSelectorProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <Keyboard className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Layout</span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {layouts.map((l) => {
          const active = selected === l;
          const keys = keyCountForLayout(l);
          return (
            <motion.button
              key={l}
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onChange(l)}
              aria-pressed={active}
              className={`relative flex flex-col items-center gap-0.5 rounded-xl py-3 px-2 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active
                  ? "bg-primary/15 border-2 border-primary ring-1 ring-primary/30"
                  : "bg-card border border-border hover:border-primary/30"
              }`}
            >
              <span className="text-sm font-bold" style={{ color: "hsl(var(--foreground-strong))" }}>
                {layoutLabel(l)}
              </span>
              {keys && <span className="text-[10px] text-muted-foreground">{keys} teclas</span>}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
