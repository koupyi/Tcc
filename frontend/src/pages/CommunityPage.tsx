import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, AlertTriangle } from "lucide-react";
import { communityBuildsApi } from "@/api/communityBuilds";
import { CommunityBuildCard } from "@/components/community/CommunityBuildCard";
import { mapApiError } from "@/utils/errorMapper";
import type { CommunityBuild } from "@/types/communityBuild";

const CommunityPage = () => {
  const [builds, setBuilds] = useState<CommunityBuild[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setIsLoading(true);
    setError(null);
    communityBuildsApi
      .list()
      .then((res) => {
        if (res.success && res.data) setBuilds(res.data);
      })
      .catch((err) => setError(mapApiError(err).message))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="container mx-auto px-4 py-12">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-4xl font-bold tracking-tight mb-2">Galeria da Comunidade</h1>
        <p className="text-foreground mb-10">
          Veja teclados personalizados criados pela comunidade — cada componente é um produto real do catálogo, pronto para comprar.
        </p>
      </motion.div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="text-center py-20">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Erro ao carregar builds</h2>
          <p className="text-foreground mb-6">{error}</p>
          <button onClick={load} className="px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-md">
            Tentar novamente
          </button>
        </div>
      ) : builds.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {builds.map((build) => (
            <CommunityBuildCard key={build.id} build={build} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-foreground">
          <p className="text-lg">Nenhuma build da comunidade encontrada.</p>
        </div>
      )}
    </div>
  );
};

export default CommunityPage;
