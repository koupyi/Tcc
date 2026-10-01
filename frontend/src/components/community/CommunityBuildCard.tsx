import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { communityBuildsApi } from "@/api/communityBuilds";
import { useBuildPurchase } from "@/hooks/useBuildPurchase";
import type { CommunityBuild } from "@/types/communityBuild";

const PLACEHOLDER_IMAGE = "/images/product-placeholder.svg";

interface CommunityBuildCardProps {
  build: CommunityBuild;
}

export function CommunityBuildCard({ build }: CommunityBuildCardProps) {
  const { buyBuild, isBuying } = useBuildPurchase();
  const [likes, setLikes] = useState(build.likes);
  const [isLiking, setIsLiking] = useState(false);
  const [imgSrc, setImgSrc] = useState(build.imageUrl || PLACEHOLDER_IMAGE);

  const detailUrl = `/community/${build.id}`;
  const hasAvailable = build.availableComponents > 0;

  const handleLike = async () => {
    if (isLiking) return;
    setIsLiking(true);
    try {
      const res = await communityBuildsApi.like(build.id);
      if (res.success && res.data) setLikes(res.data.likes);
    } catch {
      toast.error("Não foi possível registrar sua curtida agora.");
    } finally {
      setIsLiking(false);
    }
  };

  const handleBuyBuild = () => {
    if (isBuying || !hasAvailable) return;
    buyBuild(build.id, build.items, { useBulkEndpoint: true });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -4 }}
      className="bg-card rounded-lg shadow-card overflow-hidden flex flex-col"
    >
      <Link to={detailUrl} aria-label={`Ver build ${build.title}`}>
        <div className="h-48 bg-accent flex items-center justify-center overflow-hidden">
          <img
            src={imgSrc}
            alt={build.title}
            loading="lazy"
            onError={() => setImgSrc(PLACEHOLDER_IMAGE)}
            className="h-full w-full object-cover"
          />
        </div>
      </Link>

      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-start justify-between mb-2">
          <div>
            <Link to={detailUrl}>
              <h3 className="font-semibold hover:text-primary transition-colors">{build.title}</h3>
            </Link>
            <p className="text-xs text-muted-foreground">por {build.owner.name ?? "Comunidade"}</p>
          </div>
          <button
            type="button"
            onClick={handleLike}
            disabled={isLiking}
            aria-label={`Curtir build ${build.title}`}
            className="flex items-center gap-1 text-sm text-foreground hover:text-primary transition-colors shrink-0"
          >
            <Heart className="h-4 w-4" />
            <span className="tabular-nums">{likes}</span>
          </button>
        </div>

        {build.description && <p className="text-sm text-foreground mb-3 line-clamp-2">{build.description}</p>}

        <ul className="space-y-1 mb-3 text-xs">
          {build.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2">
              <span className={item.available ? "text-foreground-strong" : "text-muted-foreground line-through"}>
                {item.category}: {item.productName}
              </span>
              {!item.available && <span className="text-destructive shrink-0">Esgotado</span>}
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-2 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Preço estimado</span>
            <span className="text-primary font-bold tabular-nums text-sm">
              {build.estimatedPrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
          </div>
          <p className={`text-xs font-medium ${hasAvailable ? "text-foreground" : "text-destructive"}`}>
            {build.availableComponents} de {build.totalComponents} componentes disponíveis.
          </p>

          <div className="flex flex-col gap-2 pt-1">
            <div className="flex gap-2">
              <Link
                to={detailUrl}
                className="flex-1 text-center px-3 py-2 bg-accent text-foreground-strong text-xs font-semibold rounded-md border border-border hover:bg-accent/80 transition-colors"
              >
                Ver build
              </Link>
              <Link
                to={`/builder?communityBuild=${build.id}`}
                className="flex-1 text-center px-3 py-2 bg-accent text-foreground-strong text-xs font-semibold rounded-md border border-border hover:bg-accent/80 transition-colors"
              >
                Montar igual
              </Link>
            </div>
            <button
              type="button"
              onClick={handleBuyBuild}
              disabled={!hasAvailable || isBuying}
              aria-label={`Comprar build ${build.title}`}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isBuying && <Loader2 className="h-3 w-3 animate-spin" />}
              {isBuying ? "Processando..." : hasAvailable ? "Comprar build" : "Indisponível"}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
