import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Heart, Loader2, AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { communityBuildsApi } from "@/api/communityBuilds";
import { productsApi } from "@/api/products";
import { useBuildPurchase } from "@/hooks/useBuildPurchase";
import { useAuth } from "@/context/AuthContext";
import { mapApiError } from "@/utils/errorMapper";
import type { CommunityBuild, CommunityBuildItem } from "@/types/communityBuild";
import type { ProductListItem } from "@/types/product";

const PLACEHOLDER_IMAGE = "/images/product-placeholder.svg";

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const CommunityBuildDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const customize = searchParams.get("customize") === "1";
  const { isAuthenticated } = useAuth();
  const { buyBuild, isBuying } = useBuildPurchase();

  const [build, setBuild] = useState<CommunityBuild | null>(null);
  const [items, setItems] = useState<CommunityBuildItem[]>([]);
  const [hasSubstitutions, setHasSubstitutions] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [likes, setLikes] = useState(0);
  const [isLiking, setIsLiking] = useState(false);
  const [imgSrc, setImgSrc] = useState(PLACEHOLDER_IMAGE);

  const [substitutingId, setSubstitutingId] = useState<string | null>(null);
  const [alternatives, setAlternatives] = useState<ProductListItem[]>([]);
  const [altLoading, setAltLoading] = useState(false);

  const load = () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    setNotFound(false);
    communityBuildsApi
      .getById(id)
      .then((res) => {
        if (res.success && res.data) {
          setBuild(res.data);
          setItems(res.data.items);
          setHasSubstitutions(false);
          setLikes(res.data.likes);
          setImgSrc(res.data.imageUrl || PLACEHOLDER_IMAGE);
        } else {
          setNotFound(true);
        }
      })
      .catch((err) => {
        const mapped = err as { code?: string };
        if (mapped.code === "NOT_FOUND") {
          setNotFound(true);
        } else {
          setError(mapApiError(err).message);
        }
      })
      .finally(() => setIsLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [id]);

  const totalComponents = items.length;
  const availableComponents = items.filter((i) => i.available).length;
  const estimatedPrice = items.reduce((sum, i) => sum + i.unitPrice, 0);

  const handleLike = async () => {
    if (!id || isLiking) return;
    setIsLiking(true);
    try {
      const res = await communityBuildsApi.like(id);
      if (res.success && res.data) setLikes(res.data.likes);
    } catch {
      toast.error("Não foi possível registrar sua curtida agora.");
    } finally {
      setIsLiking(false);
    }
  };

  const openSubstitution = async (item: CommunityBuildItem) => {
    if (!item.categoryId) {
      toast.error("Não há alternativas disponíveis para este componente.");
      return;
    }
    setSubstitutingId(item.id);
    setAltLoading(true);
    try {
      const res = await productsApi.list({ categoryId: item.categoryId, limit: "8" });
      if (res.success && res.data) {
        const raw = res.data as unknown as ProductListItem[];
        const filtered = raw.filter(
          (p) => p.id !== item.productId && p._count.variants === 1 && (p.variants[0]?.stockQty ?? 0) > 0,
        );
        setAlternatives(filtered);
      } else {
        setAlternatives([]);
      }
    } catch (err) {
      toast.error(mapApiError(err).message);
      setAlternatives([]);
    } finally {
      setAltLoading(false);
    }
  };

  const applySubstitution = (item: CommunityBuildItem, alt: ProductListItem) => {
    const variant = alt.variants[0];
    if (!variant) return;

    const price = variant.price ? Number(variant.price) : alt.salePrice ? Number(alt.salePrice) : Number(alt.basePrice);

    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? {
              ...i,
              productId: alt.id,
              productSlug: alt.slug,
              productName: alt.name,
              categoryId: alt.category?.id ?? i.categoryId,
              variantId: variant.id,
              variantName: variant.name,
              sku: variant.sku,
              imageUrl: alt.images[0]?.url ?? null,
              unitPrice: price,
              stockQty: variant.stockQty,
              available: true,
            }
          : i,
      ),
    );
    setHasSubstitutions(true);
    setSubstitutingId(null);
    toast.success(`${item.category} substituído por ${alt.name}. Build revisada.`);
  };

  const handleBuyBuild = () => {
    if (!build || isBuying || availableComponents === 0) return;
    buyBuild(build.id, items, { useBulkEndpoint: isAuthenticated && !hasSubstitutions });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Erro ao carregar build</h1>
        <p className="text-foreground mb-6">{error}</p>
        <button onClick={load} className="px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-md">
          Tentar novamente
        </button>
      </div>
    );
  }

  if (notFound || !build) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-4xl font-bold mb-2">Build não encontrada</h1>
        <p className="text-foreground mb-6">Esta build não existe ou foi removida.</p>
        <Link
          to="/community"
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-md"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para a comunidade
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <nav className="mb-6">
        <Link to="/community" className="text-sm text-muted-foreground hover:text-foreground-strong inline-flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Voltar para a comunidade
        </Link>
      </nav>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12"
      >
        <div className="h-80 lg:h-full rounded-lg overflow-hidden bg-accent flex items-center justify-center">
          <img
            src={imgSrc}
            alt={build.title}
            onError={() => setImgSrc(PLACEHOLDER_IMAGE)}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{build.title}</h1>
              <p className="text-sm text-muted-foreground mt-1">por {build.owner.name ?? "Comunidade"}</p>
            </div>
            <button
              type="button"
              onClick={handleLike}
              disabled={isLiking}
              aria-label={`Curtir build ${build.title}`}
              className="flex items-center gap-1.5 text-sm text-foreground hover:text-primary transition-colors shrink-0"
            >
              <Heart className="h-5 w-5" />
              <span className="tabular-nums">{likes}</span>
            </button>
          </div>

          {build.description && <p className="text-foreground leading-relaxed">{build.description}</p>}

          <Link
            to={`/builder?communityBuild=${build.id}`}
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            Montar igual no builder completo
          </Link>

          {customize && (
            <p className="text-xs text-primary bg-primary/10 border border-primary/30 rounded-md px-3 py-2">
              Modo personalização — troque qualquer componente pelo equivalente do catálogo antes de comprar.
            </p>
          )}

          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground-strong">Componentes</p>
            {items.map((item) => (
              <div key={item.id} className="border border-border rounded-md p-3">
                <div className="flex items-center gap-3">
                  <img
                    src={item.imageUrl || PLACEHOLDER_IMAGE}
                    alt={item.productName}
                    className="h-12 w-12 object-contain bg-accent rounded"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE;
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">{item.category}</p>
                    <Link to={`/products/${item.productSlug}`} className="text-sm font-medium hover:text-primary transition-colors">
                      {item.productName}
                    </Link>
                    <p className="text-xs text-muted-foreground tabular-nums">{formatBRL(item.unitPrice)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {item.available ? (
                      <span className="text-xs font-medium text-green-600">Disponível</span>
                    ) : (
                      <span className="text-xs font-medium text-destructive">Esgotado</span>
                    )}
                  </div>
                </div>

                {(!item.available || customize) && (
                  <div className="mt-2">
                    {substitutingId === item.id ? (
                      <div className="mt-2 space-y-2">
                        {altLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        ) : alternatives.length > 0 ? (
                          alternatives.map((alt) => (
                            <button
                              key={alt.id}
                              type="button"
                              onClick={() => applySubstitution(item, alt)}
                              className="w-full flex items-center justify-between text-xs px-3 py-2 rounded-md border border-border hover:border-primary/50 hover:bg-accent transition-colors"
                            >
                              <span>{alt.name}</span>
                              <span className="tabular-nums text-primary font-medium">
                                {formatBRL(Number(alt.variants[0]?.price ?? alt.basePrice))}
                              </span>
                            </button>
                          ))
                        ) : (
                          <p className="text-xs text-muted-foreground">Nenhuma alternativa disponível nesta categoria.</p>
                        )}
                        <button
                          type="button"
                          onClick={() => setSubstitutingId(null)}
                          className="text-xs text-muted-foreground hover:text-foreground-strong"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openSubstitution(item)}
                        className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <RefreshCw className="h-3 w-3" /> Substituir
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-border pt-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Preço estimado</span>
              <span className="text-2xl font-bold text-primary tabular-nums">{formatBRL(estimatedPrice)}</span>
            </div>
            <p className={`text-sm font-medium ${availableComponents > 0 ? "text-foreground" : "text-destructive"}`}>
              {availableComponents} de {totalComponents} componentes disponíveis.
            </p>

            <motion.button
              whileHover={availableComponents > 0 ? { scale: 1.02 } : {}}
              whileTap={availableComponents > 0 ? { scale: 0.98 } : {}}
              onClick={handleBuyBuild}
              disabled={availableComponents === 0 || isBuying}
              className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground font-semibold rounded-md shadow-button disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isBuying ? "Processando..." : availableComponents > 0 ? "Comprar build" : "Build indisponível"}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default CommunityBuildDetailPage;
