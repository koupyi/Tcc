import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, AlertTriangle, ShoppingCart, RotateCcw, ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { builderApi, type BuilderConfigurationPayload } from "@/api/builder";
import { communityBuildsApi } from "@/api/communityBuilds";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { mapApiError } from "@/utils/errorMapper";
import { checkCompatibility, type BuildContext } from "@/utils/builderCompatibility";
import { computeSwitchQuantity } from "@/utils/builderLayout";
import { BuilderStepper, type BuilderStepDef } from "@/components/builder/BuilderStepper";
import { BuilderOptionCard } from "@/components/builder/BuilderOptionCard";
import { BuilderSummary } from "@/components/builder/BuilderSummary";
import KeyboardPreview from "@/components/builder/KeyboardPreview";
import { LayoutSelector } from "@/components/builder/LayoutSelector";
import type {
  BuilderOption,
  BuilderOptionsResponse,
  BuilderCategory,
  BuilderConfiguration,
  SelectedBuilderItem,
} from "@/types/builder";
import { REQUIRED_BUILDER_CATEGORIES } from "@/types/builder";

const DRAFT_KEY = "builder_draft_v1";

const STEPS: BuilderStepDef[] = [
  { key: "layout", label: "Layout" },
  { key: "case", label: "Case" },
  { key: "pcb", label: "PCB" },
  { key: "plate", label: "Plate" },
  { key: "switch", label: "Switches" },
  { key: "keycap", label: "Keycaps" },
  { key: "extra", label: "Extras" },
  { key: "review", label: "Revisão" },
];

const CATEGORY_LABEL: Record<BuilderCategory, string> = {
  case: "Case",
  pcb: "PCB",
  plate: "Plate",
  switch: "Switches",
  keycap: "Keycaps",
  extra: "Extra",
};

function emptyConfiguration(): BuilderConfiguration {
  return { layout: null, case: null, pcb: null, plate: null, switch: null, keycap: null, extras: [] };
}

function toSelectedItem(option: BuilderOption, quantity: number): SelectedBuilderItem {
  return {
    productId: option.productId,
    variantId: option.variantId,
    name: option.name,
    variantName: option.variantName,
    imageUrl: option.imageUrl,
    unitPrice: option.unitPrice,
    stockQty: option.stockQty,
    quantity,
    layout: option.layout,
    switchType: option.switchType,
  };
}

function buildContext(config: BuilderConfiguration): BuildContext {
  const switchType = config.pcb?.switchType ?? config.switch?.switchType ?? config.keycap?.switchType ?? null;
  return { layout: config.layout, switchType };
}

/** Normalizes community-build layout strings ("65%", "Full Size") to builder layout codes. */
function normalizeLayoutLabel(raw: string | null): string | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v.includes("60")) return "60";
  if (v.includes("65")) return "65";
  if (v.includes("75")) return "75";
  if (v.includes("tkl")) return "tkl";
  if (v.includes("full")) return "full";
  return null;
}

function normalizeCommunityCategory(label: string): BuilderCategory | null {
  const v = label.trim().toLowerCase();
  if (v === "case") return "case";
  if (v === "pcb") return "pcb";
  if (v === "plate") return "plate";
  if (v === "switch") return "switch";
  if (v === "keycap" || v === "keycaps") return "keycap";
  if (v === "extra" || v === "extras") return "extra";
  return null;
}

const BuilderPage = () => {
  const [searchParams] = useSearchParams();
  const communityBuildId = searchParams.get("communityBuild");
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { isAuthenticated } = useAuth();

  const [options, setOptions] = useState<BuilderOptionsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);



  const draftRestored = useRef(false);
  const prefillApplied = useRef(false);
  const stepTitleRef = useRef<HTMLHeadingElement>(null);

  const loadOptions = useCallback(() => {
    setIsLoading(true);
    setError(null);
    builderApi
      .getOptions()
      .then((res) => {
        if (res.success && res.data) setOptions(res.data);
        else setError("Não foi possível carregar as opções agora.");
      })
      .catch((err) => setError(mapApiError(err).message))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  // Restore a local draft (identifiers + quantities only — never price/stock) once options are loaded,
  // unless a community-build prefill is about to take over.
  useEffect(() => {
    if (!options || draftRestored.current || communityBuildId) return;
    draftRestored.current = true;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as {
        layout: string | null;
        case?: string; pcb?: string; plate?: string; keycap?: string;
        switch?: string; switchQty?: number;
        extras?: Array<{ variantId: string; quantity: number }>;
      };

      const find = (cat: BuilderCategory, variantId?: string) =>
        variantId ? options.options[cat].find((o) => o.variantId === variantId) ?? null : null;

      const next = emptyConfiguration();
      next.layout = draft.layout ?? null;
      const c = find("case", draft.case);
      if (c) next.case = toSelectedItem(c, 1);
      const p = find("pcb", draft.pcb);
      if (p) next.pcb = toSelectedItem(p, 1);
      const pl = find("plate", draft.plate);
      if (pl) next.plate = toSelectedItem(pl, 1);
      const sw = find("switch", draft.switch);
      if (sw) next.switch = toSelectedItem(sw, draft.switchQty || 1);
      const kc = find("keycap", draft.keycap);
      if (kc) next.keycap = toSelectedItem(kc, 1);
      if (draft.extras) {
        next.extras = draft.extras
          .map((e) => {
            const opt = find("extra", e.variantId);
            return opt ? toSelectedItem(opt, e.quantity) : null;
          })
          .filter((x): x is SelectedBuilderItem => x !== null);
      }
      setConfiguration(next);
    } catch {
      // Corrupt/old draft — ignore.
    }
  }, [options, communityBuildId]);

  // Community Build prefill ("Montar igual") — real variants only, never prices in the URL.
  useEffect(() => {
    if (!options || !communityBuildId || prefillApplied.current) return;
    prefillApplied.current = true;

    communityBuildsApi
      .getById(communityBuildId)
      .then((res) => {
        if (!res.success || !res.data) {
          toast.error("Não foi possível carregar essa build da comunidade.");
          return;
        }
        const build = res.data;
        const next = emptyConfiguration();
        next.layout = normalizeLayoutLabel(build.layout);
        const unavailable: string[] = [];

        for (const item of build.items) {
          const category = normalizeCommunityCategory(item.category);
          if (!category) continue;

          const matched = options.options[category].find((o) => o.variantId === item.variantId);
          if (matched && matched.stockQty > 0) {
            if (category === "extra") {
              next.extras.push(toSelectedItem(matched, 1));
            } else if (category !== "extra") {
              const qty = category === "switch" ? computeSwitchQuantity(next.layout, matched.specs) : 1;
              (next as Record<string, unknown>)[category] = toSelectedItem(matched, qty);
            }
          } else {
            unavailable.push(`${CATEGORY_LABEL[category]}: ${item.productName}`);
          }
        }

        setConfiguration(next);
        if (unavailable.length > 0) {
          toast.warning(`Alguns componentes desta build não estão disponíveis: ${unavailable.join(", ")}. Escolha uma alternativa.`);
        } else {
          toast.success("Build da comunidade carregada — revise e ajuste como quiser.");
        }
      })
      .catch(() => toast.error("Não foi possível carregar essa build da comunidade."));
  }, [options, communityBuildId]);

  // Persist draft (ids + quantities only).
  useEffect(() => {
    if (!draftRestored.current) return;
    const draft = {
      layout: configuration.layout,
      case: configuration.case?.variantId,
      pcb: configuration.pcb?.variantId,
      plate: configuration.plate?.variantId,
      switch: configuration.switch?.variantId,
      switchQty: configuration.switch?.quantity,
      keycap: configuration.keycap?.variantId,
      extras: configuration.extras.map((e) => ({ variantId: e.variantId, quantity: e.quantity })),
    };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Storage unavailable — draft simply won't persist.
    }
  }, [configuration]);

  // Focus the new step's heading on navigation (a11y).
  useEffect(() => {
    stepTitleRef.current?.focus();
  }, [stepIndex]);

  const botanicalBaseActive = Boolean(
    configuration.case && /botanical|garden/i.test(configuration.case.name || "")
  ) || Boolean(
    configuration.keycap && /botanical|garden/i.test(configuration.keycap.name || "")
  );

  const effectiveBaseFinish = botanicalBaseActive ? "wood" : baseFinish;

  const ctx = useMemo(() => buildContext(configuration), [configuration]);

  const revalidateDownstream = useCallback((config: BuilderConfiguration): { config: BuilderConfiguration; removed: string[] } => {
    const next = { ...config, extras: [...config.extras] };
    const removed: string[] = [];
    const singleCategories: BuilderCategory[] = ["case", "pcb", "plate", "switch", "keycap"];

    for (const cat of singleCategories) {
      const item = next[cat] as SelectedBuilderItem | null;
      if (!item) continue;
      const localCtx = buildContext(next);
      const result = checkCompatibility(cat, { layout: item.layout, switchType: item.switchType }, localCtx);
      if (!result.compatible) {
        (next as Record<string, unknown>)[cat] = null;
        removed.push(`${CATEGORY_LABEL[cat]} removido: ${result.reason}`);
      }
    }

    // Extras with a layout constraint (e.g. case foam) can also be invalidated by a layout change.
    const localCtx = buildContext(next);
    const keptExtras = next.extras.filter((e) => {
      const result = checkCompatibility("extra", { layout: e.layout, switchType: e.switchType }, localCtx);
      if (!result.compatible) removed.push(`${e.name} removido: ${result.reason}`);
      return result.compatible;
    });
    next.extras = keptExtras;

    return { config: next, removed };
  }, []);

  const applyChange = useCallback(
    (mutate: (draft: BuilderConfiguration) => void) => {
      setConfiguration((prev) => {
        const draft: BuilderConfiguration = { ...prev, extras: [...prev.extras] };
        mutate(draft);
        const { config: revalidated, removed } = revalidateDownstream(draft);
        removed.forEach((msg) => toast.warning(msg));
        return revalidated;
      });
    },
    [revalidateDownstream],
  );

  const handleLayoutChange = (layout: string) => applyChange((draft) => { draft.layout = layout; });

  const handleSelect = (category: Exclude<BuilderCategory, "extra">, option: BuilderOption) => {
    const quantity = category === "switch" ? computeSwitchQuantity(configuration.layout, option.specs) : 1;
    applyChange((draft) => {
      const current = draft[category] as SelectedBuilderItem | null;
      draft[category] = current?.variantId === option.variantId ? null : (toSelectedItem(option, quantity) as never);
    });
  };

  const toggleExtra = (option: BuilderOption) => {
    applyChange((draft) => {
      const exists = draft.extras.find((e) => e.variantId === option.variantId);
      draft.extras = exists ? draft.extras.filter((e) => e.variantId !== option.variantId) : [...draft.extras, toSelectedItem(option, 1)];
    });
  };

  const total = useMemo(() => {
    const singles: Array<SelectedBuilderItem | null> = [configuration.case, configuration.pcb, configuration.plate, configuration.switch, configuration.keycap];
    const singlesTotal = singles.reduce((sum, i) => sum + (i ? i.unitPrice * i.quantity : 0), 0);
    const extrasTotal = configuration.extras.reduce((sum, e) => sum + e.unitPrice * e.quantity, 0);
    return singlesTotal + extrasTotal;
  }, [configuration]);

  const completedSteps = useMemo(() => {
    const done = new Set<string>();
    if (configuration.layout) done.add("layout");
    if (configuration.case) done.add("case");
    if (configuration.pcb) done.add("pcb");
    if (configuration.plate) done.add("plate");
    if (configuration.switch) done.add("switch");
    if (configuration.keycap) done.add("keycap");
    if (configuration.extras.length > 0) done.add("extra");
    return done;
  }, [configuration]);

  const allRequiredFilled = REQUIRED_BUILDER_CATEGORIES.every((c) => configuration[c] !== null);

  const goNext = () => setStepIndex((i) => Math.min(STEPS.length - 1, i + 1));
  const goBack = () => setStepIndex((i) => Math.max(0, i - 1));

  const handleClearAll = () => {
    setConfiguration(emptyConfiguration());
    setStepIndex(0);
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
  };

  const buildPayload = (): BuilderConfigurationPayload => {
    const items: BuilderConfigurationPayload["items"] = [];
    (["case", "pcb", "plate", "switch", "keycap"] as const).forEach((cat) => {
      const item = configuration[cat];
      if (item) items.push({ category: cat, variantId: item.variantId, quantity: item.quantity });
    });
    configuration.extras.forEach((e) => items.push({ category: "extra", variantId: e.variantId, quantity: e.quantity }));
    return { layout: configuration.layout, items };
  };

  const handleAddToCart = async () => {
    if (!allRequiredFilled || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitErrors([]);
    const payload = buildPayload();

    try {
      if (isAuthenticated) {
        const res = await builderApi.addToCart(payload);
        if (res.success && res.data) {
          const { added, skipped } = res.data;
          toast.success(
            skipped.length > 0
              ? `Configuração adicionada ao carrinho. ${skipped.length} extra(s) indisponível(is).`
              : "Configuração adicionada ao carrinho.",
          );
          if (added.length > 0) navigate("/cart");
        }
      } else {
        const res = await builderApi.validate(payload);
        if (!res.success || !res.data || !res.data.valid) {
          const reasons = (res.data?.items ?? []).filter((i) => !i.valid).map((i) => i.reason).filter(Boolean) as string[];
          setSubmitErrors(reasons.length > 0 ? reasons : ["Revise sua configuração antes de adicionar ao carrinho."]);
          return;
        }

        let addedCount = 0;
        for (const item of res.data.items) {
          if (!item.valid) continue;
          const success = await addItem(
            {
              variantId: item.variantId,
              name: item.productName || "Componente",
              price: item.unitPrice ?? 0,
              image: "",
              quantity: item.quantity,
            },
            { silent: true },
          );
          if (success) addedCount++;
        }

        if (addedCount > 0) {
          toast.success("Configuração adicionada ao carrinho.");
          navigate("/cart");
        } else {
          toast.error("Não foi possível adicionar a configuração ao carrinho.");
        }
      }
    } catch (err) {
      const mapped = mapApiError(err);
      setSubmitErrors(mapped.fieldErrors ? Object.values(mapped.fieldErrors).flat() : [mapped.message]);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !options) {
    return (
      <div className="container mx-auto px-4 py-20 space-y-6">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Não foi possível carregar as opções agora.</h1>
          <p className="text-foreground mb-6">{error}</p>
          <button onClick={loadOptions} className="px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-md">
            Tentar novamente
          </button>
        </div>

        <div className="mx-auto max-w-4xl rounded-2xl border border-border bg-slate-950/40 p-3 shadow-inner">
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground">Preview 3D</p>
              <h3 className="text-sm font-semibold text-foreground">Modelo do teclado</h3>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-white/70">
              Orbit
            </span>
          </div>

          <div className="overflow-hidden rounded-xl border border-white/10 bg-background/60">
            <KeyboardPreview
              selectedLayout="65"
              selectedCase={null}
              selectedPcb={null}
              selectedSwitch={null}
              selectedKeycap={null}
              caseColor="#2a2a2e"
            />
          </div>
        </div>
      </div>
    );
  }

  const currentStep = STEPS[stepIndex];

  return (
    <div className="container mx-auto px-4 py-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Keyboard Builder</h1>
        <p className="text-muted-foreground mt-1">Monte seu teclado com produtos reais — compatibilidade e preço verificados em tempo real.</p>
      </motion.div>

      <div className="mb-6">
        <BuilderStepper steps={STEPS} currentIndex={stepIndex} completed={completedSteps} onStepClick={setStepIndex} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
        <div className="glass rounded-2xl p-6 min-h-[420px]">
          <h2 ref={stepTitleRef} tabIndex={-1} className="text-lg font-bold mb-4 outline-none" style={{ color: "hsl(var(--foreground-strong))" }}>
            {stepIndex + 1}. {currentStep.label}
          </h2>

          {currentStep.key === "layout" && (
            <div className="space-y-6">
              <LayoutSelector layouts={options.layouts} selected={configuration.layout} onChange={handleLayoutChange} />

              <div className="rounded-2xl border border-border bg-slate-950/60 p-3 shadow-inner">
                <div className="mb-3 flex items-center justify-between gap-3 px-1">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground">Preview 3D</p>
                    <h3 className="text-sm font-semibold text-foreground">Visualização do teclado</h3>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-white/70">
                    Orbit
                  </span>
                </div>

                <div className="overflow-hidden rounded-xl border border-white/10 bg-background/60">
                  <KeyboardPreview
                    selectedLayout={configuration.layout || "65"}
                    selectedCase={configuration.case}
                    selectedPcb={configuration.pcb}
                    selectedSwitch={configuration.switch}
                    selectedKeycap={configuration.keycap}
                    caseColor={effectiveBaseFinish === "wood" ? "#b07a49" : "#2a2a2e"}
                    finish={effectiveBaseFinish}
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setBaseFinish("solid")}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      effectiveBaseFinish === "solid" ? "border-primary bg-primary/10 text-primary" : "border-border bg-transparent text-foreground"
                    }`}
                  >
                    Base preta
                  </button>
                  <button
                    type="button"
                    onClick={() => setBaseFinish("wood")}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      effectiveBaseFinish === "wood" ? "border-amber-500 bg-amber-500/10 text-amber-300" : "border-border bg-transparent text-foreground"
                    }`}
                  >
                    Base de madeira
                  </button>
                </div>
              </div>
            </div>
          )}

          {(["case", "pcb", "plate", "switch", "keycap"] as const).includes(currentStep.key as never) && (
            <StepOptionList
              category={currentStep.key as Exclude<BuilderCategory, "extra">}
              options={options.options[currentStep.key as Exclude<BuilderCategory, "extra">]}
              selectedVariantId={(configuration[currentStep.key as "case"] as SelectedBuilderItem | null)?.variantId ?? null}
              ctx={ctx}
              layout={configuration.layout}
              onSelect={(opt) => handleSelect(currentStep.key as Exclude<BuilderCategory, "extra">, opt)}
            />
          )}

          {currentStep.key === "extra" && (
            <ExtrasStepList options={options.options.extra} selected={configuration.extras} ctx={ctx} onToggle={toggleExtra} />
          )}

          {currentStep.key === "review" && (
            <ReviewStep
              configuration={configuration}
              total={total}
              allRequiredFilled={allRequiredFilled}
              isSubmitting={isSubmitting}
              errors={submitErrors}
              onEdit={(key) => setStepIndex(STEPS.findIndex((s) => s.key === key))}
              onSubmit={handleAddToCart}
            />
          )}

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
            <button
              type="button"
              onClick={goBack}
              disabled={stepIndex === 0}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md border border-border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="h-3 w-3" /> Limpar tudo
            </button>
            {currentStep.key !== "review" && (
              <button
                type="button"
                onClick={goNext}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Próximo <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 self-start">
          <BuilderSummary configuration={configuration} total={total} />
        </aside>
      </div>
    </div>
  );
};

interface StepOptionListProps {
  category: Exclude<BuilderCategory, "extra">;
  options: BuilderOption[];
  selectedVariantId: string | null;
  ctx: BuildContext;
  layout: string | null;
  onSelect: (option: BuilderOption) => void;
}

function StepOptionList({ category, options, selectedVariantId, ctx, layout, onSelect }: StepOptionListProps) {
  if (options.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Nenhum componente disponível nesta categoria no momento.</p>;
  }

  const withCompat = options.map((opt) => ({
    opt,
    compat: checkCompatibility(category, { layout: opt.layout, switchType: opt.switchType, supportedLayouts: (opt.specs?.supportedLayouts as string[] | undefined) ?? null }, ctx),
  }));

  const anyCompatible = withCompat.some((w) => w.compat.compatible && w.opt.stockQty > 0);

  return (
    <div className="space-y-2">
      {!anyCompatible && (
        <p className="text-sm text-muted-foreground mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          Nenhum componente compatível disponível. Volte e altere sua configuração.
        </p>
      )}
      {withCompat.map(({ opt, compat }) => (
        <BuilderOptionCard
          key={opt.variantId}
          option={opt}
          selected={selectedVariantId === opt.variantId}
          compatible={compat.compatible}
          incompatibleReason={compat.reason}
          quantityLabel={category === "switch" ? `${computeSwitchQuantity(layout, opt.specs)}x pack` : undefined}
          onSelect={() => onSelect(opt)}
        />
      ))}
    </div>
  );
}

interface ExtrasStepListProps {
  options: BuilderOption[];
  selected: SelectedBuilderItem[];
  ctx: BuildContext;
  onToggle: (option: BuilderOption) => void;
}

function ExtrasStepList({ options, selected, ctx, onToggle }: ExtrasStepListProps) {
  if (options.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Nenhum extra disponível no momento.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-2">Extras são opcionais — selecione quantos quiser.</p>
      {options.map((opt) => {
        const compat = checkCompatibility("extra", { layout: opt.layout, switchType: opt.switchType }, ctx);
        const isSelected = selected.some((e) => e.variantId === opt.variantId);
        return (
          <BuilderOptionCard
            key={opt.variantId}
            option={opt}
            selected={isSelected}
            compatible={compat.compatible}
            incompatibleReason={compat.reason}
            onSelect={() => onToggle(opt)}
          />
        );
      })}
    </div>
  );
}

interface ReviewStepProps {
  configuration: BuilderConfiguration;
  total: number;
  allRequiredFilled: boolean;
  isSubmitting: boolean;
  errors: string[];
  onEdit: (stepKey: string) => void;
  onSubmit: () => void;
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function ReviewStep({ configuration, total, allRequiredFilled, isSubmitting, errors, onEdit, onSubmit }: ReviewStepProps) {
  const rows: Array<{ key: BuilderCategory; label: string; item: SelectedBuilderItem | null }> = [
    { key: "case", label: "Case", item: configuration.case },
    { key: "pcb", label: "PCB", item: configuration.pcb },
    { key: "plate", label: "Plate", item: configuration.plate },
    { key: "switch", label: "Switches", item: configuration.switch },
    { key: "keycap", label: "Keycaps", item: configuration.keycap },
  ];

  return (
    <div className="space-y-4">
      {!allRequiredFilled && (
        <p className="text-sm text-destructive flex items-center gap-2" role="alert">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Complete todas as etapas obrigatórias (Case, PCB, Plate, Switches, Keycaps) antes de adicionar ao carrinho.
        </p>
      )}

      {rows.map(({ key, label, item }) => (
        <div key={key} className="flex items-center justify-between gap-3 border-b border-border pb-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
            {item ? (
              <>
                <p className="text-sm font-medium truncate" style={{ color: "hsl(var(--foreground-strong))" }}>{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  Qtd: {item.quantity} · {formatBRL(item.unitPrice * item.quantity)}
                </p>
              </>
            ) : (
              <p className="text-sm text-destructive">Não selecionado</p>
            )}
          </div>
          <button type="button" onClick={() => onEdit(key)} className="text-xs text-primary hover:underline shrink-0">
            Alterar
          </button>
        </div>
      ))}

      <div className="flex items-start justify-between gap-3 pb-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Extras</p>
          {configuration.extras.length > 0 ? (
            <ul className="text-sm space-y-0.5 mt-1">
              {configuration.extras.map((e) => (
                <li key={e.variantId} style={{ color: "hsl(var(--foreground-strong))" }}>
                  {e.name} — {formatBRL(e.unitPrice * e.quantity)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum extra selecionado</p>
          )}
        </div>
        <button type="button" onClick={() => onEdit("extra")} className="text-xs text-primary hover:underline shrink-0">
          Alterar
        </button>
      </div>

      <div className="flex items-center justify-between pt-2">
        <span className="text-base font-semibold" style={{ color: "hsl(var(--foreground-strong))" }}>Subtotal</span>
        <span className="text-2xl font-bold text-primary tabular-nums">{formatBRL(total)}</span>
      </div>

      {errors.length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 space-y-1">
          {errors.map((e, i) => (
            <p key={i} className="text-xs text-destructive">{e}</p>
          ))}
        </div>
      )}

      <motion.button
        whileHover={allRequiredFilled ? { scale: 1.01 } : {}}
        whileTap={allRequiredFilled ? { scale: 0.98 } : {}}
        onClick={onSubmit}
        disabled={!allRequiredFilled || isSubmitting}
        className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground font-semibold rounded-xl shadow-button disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
      >
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
        {isSubmitting ? "Adicionando..." : "Adicionar configuração ao carrinho"}
      </motion.button>
    </div>
  );
}

export default BuilderPage;
