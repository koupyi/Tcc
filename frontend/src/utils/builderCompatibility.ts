import type { BuilderCategory } from "@/types/builder";

/**
 * Canonical keyboard-builder compatibility engine (frontend copy).
 *
 * This is the ONLY compatibility implementation on the frontend — the
 * builder steps and the Community Build substitution flow both call this
 * module, never a separate ad-hoc ruleset. Its logic must stay identical to
 * `backend/src/services/builderCompatibility.ts` (no shared package exists
 * between the two runtimes in this repo, so it's intentionally duplicated,
 * not silently diverged — the backend re-checks everything server-side
 * regardless, this copy only drives filtering/explaining in the UI).
 *
 * Physical rules preserved from the original fixture-based
 * `frontend/src/utils/compatibilidade.ts` (FASE 0–4), now expressed over
 * real catalog fields instead of fictional product ids:
 *  - case/pcb/plate must match the chosen board layout (or, for a case,
 *    one of its supported layouts).
 *  - switch/pcb/keycap must share the same mount/stem family ("switchType").
 *  - a keycap set's `layout` represents the largest layout it covers — it
 *    must cover (not just equal) the chosen layout.
 *  - extras only carry a layout constraint when they physically need one.
 */

const LAYOUT_ORDER = ["60", "65", "75", "tkl", "full"];

function layoutIndex(l: string): number {
  return LAYOUT_ORDER.indexOf(l);
}

function layoutCovers(coveringLayout: string, targetLayout: string): boolean {
  const a = layoutIndex(coveringLayout);
  const b = layoutIndex(targetLayout);
  if (a === -1 || b === -1) return true;
  return a >= b;
}

export interface CompatibilityItemFacts {
  layout: string | null;
  switchType: string | null;
  supportedLayouts?: string[] | null;
}

export interface BuildContext {
  layout: string | null;
  /** Mount/stem family already locked in by a previously-chosen switch, PCB, or keycap set. */
  switchType: string | null;
}

export interface CompatibilityResult {
  compatible: boolean;
  reason?: string;
}

export function checkCompatibility(
  category: BuilderCategory,
  item: CompatibilityItemFacts,
  ctx: BuildContext,
): CompatibilityResult {
  switch (category) {
    case "case": {
      if (ctx.layout && item.layout) {
        const supports = item.layout === ctx.layout || (item.supportedLayouts ?? []).includes(ctx.layout);
        if (!supports) {
          return { compatible: false, reason: "Este case não é compatível com o layout selecionado." };
        }
      }
      return { compatible: true };
    }

    case "pcb": {
      if (ctx.layout && item.layout && item.layout !== ctx.layout) {
        return { compatible: false, reason: "Este PCB não é compatível com o layout selecionado." };
      }
      if (ctx.switchType && item.switchType && item.switchType !== ctx.switchType) {
        return { compatible: false, reason: "Este PCB não é compatível com o tipo de switch selecionado." };
      }
      return { compatible: true };
    }

    case "plate": {
      if (ctx.layout && item.layout && item.layout !== ctx.layout) {
        return { compatible: false, reason: "Esta plate não é compatível com o layout selecionado." };
      }
      return { compatible: true };
    }

    case "switch": {
      if (ctx.switchType && item.switchType && item.switchType !== ctx.switchType) {
        return { compatible: false, reason: "Este switch não é compatível com o tipo já selecionado (PCB/keycaps)." };
      }
      return { compatible: true };
    }

    case "keycap": {
      if (ctx.switchType && item.switchType && item.switchType !== ctx.switchType) {
        return { compatible: false, reason: "Estas keycaps não são compatíveis com o tipo de switch selecionado." };
      }
      if (ctx.layout && item.layout && !layoutCovers(item.layout, ctx.layout)) {
        return { compatible: false, reason: "Este conjunto de keycaps não cobre o layout selecionado." };
      }
      return { compatible: true };
    }

    case "extra": {
      if (ctx.layout && item.layout && item.layout !== ctx.layout) {
        return { compatible: false, reason: "Este extra não é compatível com o layout selecionado." };
      }
      return { compatible: true };
    }

    default:
      return { compatible: true };
  }
}
