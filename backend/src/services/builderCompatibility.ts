/**
 * Canonical keyboard-builder compatibility engine (backend copy).
 *
 * This module's rules must stay identical to the frontend's
 * `frontend/src/utils/builderCompatibility.ts` — there is no shared package
 * between the two runtimes in this repo, so the logic is intentionally
 * duplicated rather than silently diverging. Both call sites (the frontend
 * builder UI/community-substitution and this backend validation layer) must
 * reach the same compatible/incompatible verdict for the same inputs.
 *
 * Physical rules preserved from the original (fixture-based) FASE 0-4
 * builder compatibility logic in `frontend/src/utils/compatibilidade.ts`,
 * now expressed over real catalog fields (`ProductVariant.layout` /
 * `ProductVariant.switchType`) instead of fictional product ids:
 *  - case/pcb/plate must match the chosen board layout (or, for a case,
 *    one of its supported layouts).
 *  - switch/pcb/keycap must share the same mount/stem family ("switchType").
 *  - a keycap set's `layout` represents the largest layout it covers —
 *    it must cover (not just equal) the chosen layout.
 *  - extras only carry a layout constraint when they physically need one
 *    (e.g. case foam sized for a specific board); otherwise always compatible.
 */

export type BuilderCategory = 'case' | 'pcb' | 'plate' | 'switch' | 'keycap' | 'extra';

const LAYOUT_ORDER = ['60', '65', '75', 'tkl', 'full'];

function layoutIndex(l: string): number {
  return LAYOUT_ORDER.indexOf(l);
}

/** True when `coveringLayout` is large enough to cover `targetLayout` (e.g. a 'full' keycap set covers a '65' board). */
function layoutCovers(coveringLayout: string, targetLayout: string): boolean {
  const a = layoutIndex(coveringLayout);
  const b = layoutIndex(targetLayout);
  if (a === -1 || b === -1) return true; // unknown layout value — don't block on it
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
    case 'case': {
      if (ctx.layout && item.layout) {
        const supports = item.layout === ctx.layout || (item.supportedLayouts ?? []).includes(ctx.layout);
        if (!supports) {
          return { compatible: false, reason: 'Este case não é compatível com o layout selecionado.' };
        }
      }
      return { compatible: true };
    }

    case 'pcb': {
      if (ctx.layout && item.layout && item.layout !== ctx.layout) {
        return { compatible: false, reason: 'Este PCB não é compatível com o layout selecionado.' };
      }
      if (ctx.switchType && item.switchType && item.switchType !== ctx.switchType) {
        return { compatible: false, reason: 'Este PCB não é compatível com o tipo de switch selecionado.' };
      }
      return { compatible: true };
    }

    case 'plate': {
      if (ctx.layout && item.layout && item.layout !== ctx.layout) {
        return { compatible: false, reason: 'Esta plate não é compatível com o layout selecionado.' };
      }
      return { compatible: true };
    }

    case 'switch': {
      if (ctx.switchType && item.switchType && item.switchType !== ctx.switchType) {
        return { compatible: false, reason: 'Este switch não é compatível com o tipo já selecionado (PCB/keycaps).' };
      }
      return { compatible: true };
    }

    case 'keycap': {
      if (ctx.switchType && item.switchType && item.switchType !== ctx.switchType) {
        return { compatible: false, reason: 'Estas keycaps não são compatíveis com o tipo de switch selecionado.' };
      }
      if (ctx.layout && item.layout && !layoutCovers(item.layout, ctx.layout)) {
        return { compatible: false, reason: 'Este conjunto de keycaps não cobre o layout selecionado.' };
      }
      return { compatible: true };
    }

    case 'extra': {
      if (ctx.layout && item.layout && item.layout !== ctx.layout) {
        return { compatible: false, reason: 'Este extra não é compatível com o layout selecionado.' };
      }
      return { compatible: true };
    }

    default:
      return { compatible: true };
  }
}

export const REQUIRED_BUILDER_CATEGORIES: BuilderCategory[] = ['case', 'pcb', 'plate', 'switch', 'keycap'];
