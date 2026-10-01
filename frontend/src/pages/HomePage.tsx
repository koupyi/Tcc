import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Zap, Shield, Palette, Users, Loader2 } from "lucide-react";
import heroImage from "@/assets/hero-keyboard.jpg";
import { productsApi } from "@/api/products";
import { ProductCard } from "@/components/products/ProductCard";
import { toProductCardModel } from "@/adapters/productCard";
import type { ProductListItem } from "@/types/product";

const spring = { type: "spring" as const, stiffness: 300, damping: 25, mass: 0.5 };

const reasons = [
  { icon: Palette, title: "Personalização completa", desc: "Escolha cada componente, do layout às keycaps." },
  { icon: Zap, title: "Visualização em tempo real", desc: "Veja seu teclado sendo montado enquanto escolhe." },
  { icon: Shield, title: "Peças de qualidade", desc: "Utilizamos apenas componentes confiáveis e duráveis." },
  { icon: Users, title: "Comunidade ativa", desc: "Compartilhe setups e descubra novas ideias." },
];

function useProductSection(fetcher: () => Promise<ProductListItem[]>) {
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetcher()
      .then((data) => {
        if (!cancelled) setProducts(data);
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { products, isLoading };
}

const HomePage = () => {
  const featured = useProductSection(async () => {
    const res = await productsApi.list({ isFeatured: "true", limit: "3" });
    return res.success && res.data ? (res.data as unknown as ProductListItem[]) : [];
  });

  const bestSellers = useProductSection(async () => {
    const res = await productsApi.bestSellers(4);
    return res.success && res.data ? (res.data as unknown as ProductListItem[]) : [];
  });

  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroImage} alt="Teclado mecânico personalizado" className="w-full h-full object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/40" />
        </div>
        <div className="relative container mx-auto px-4 py-32 md:py-44">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl"
          >
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-none mb-6">
              Monte o seu teclado<br />
              <span className="text-gradient-primary">ideal</span>
            </h1>
            <p className="text-lg text-foreground max-w-lg mb-8">
              Crie seu teclado mecânico personalizado com nosso construtor interativo. Escolha cada peça, visualize na hora e finalize sua compra com facilidade.
            </p>
            <div className="flex gap-4 flex-wrap">
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={spring}>
                <Link
                  to="/builder"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-md shadow-button transition-colors hover:bg-primary/90"
                >
                  Montar meu teclado <ArrowRight className="h-4 w-4" />
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={spring}>
                <Link
                  to="/products"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-foreground-strong font-semibold rounded-md border border-border transition-colors hover:bg-accent/80"
                >
                  Ver produtos
                </Link>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Destaques — produtos reais marcados como isFeatured no catálogo */}
      {featured.isLoading ? (
        <section className="container mx-auto px-4 py-24 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </section>
      ) : featured.products.length > 0 ? (
        <section className="container mx-auto px-4 py-24">
          <h2 className="text-3xl font-bold tracking-tight mb-2">Teclados em destaque</h2>
          <p className="text-foreground mb-10">Modelos selecionados do nosso catálogo.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {featured.products.map((p, i) => (
              <ProductCard key={p.id} product={toProductCardModel(p)} priority={i < 3} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Mais vendidos — ranqueado por vendas reais (OrderItem), nunca inventado */}
      {bestSellers.isLoading ? (
        <section className="container mx-auto px-4 py-24 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </section>
      ) : bestSellers.products.length > 0 ? (
        <section className="container mx-auto px-4 py-24">
          <h2 className="text-3xl font-bold tracking-tight mb-2">Produtos mais vendidos</h2>
          <p className="text-foreground mb-10">Peças mais populares entre nossos clientes.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {bestSellers.products.map((p) => (
              <ProductCard key={p.id} product={toProductCardModel(p)} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="container mx-auto px-4 py-24">
        <h2 className="text-3xl font-bold tracking-tight text-center mb-2">Por que escolher o Qwerty?</h2>
        <p className="text-foreground text-center mb-12">Tudo o que você precisa para montar seu teclado ideal.</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {reasons.map((r, i) => (
            <motion.div
              key={r.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.4 }}
              className="text-center p-6"
            >
              <div className="inline-flex items-center justify-center h-12 w-12 rounded-lg bg-primary/10 text-primary mb-4">
                <r.icon className="h-6 w-6" />
              </div>
              <h3 className="font-semibold mb-2">{r.title}</h3>
              <p className="text-sm text-foreground">{r.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 py-24">
        <div className="glass rounded-lg p-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight mb-4">Faça parte da comunidade</h2>
          <p className="text-foreground max-w-md mx-auto mb-8">
            Compartilhe seus setups, receba feedback e encontre inspiração.
          </p>
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={spring} className="inline-block">
            <Link to="/community" className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-md shadow-button">
              Ver projetos <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
