import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { adminApi } from "@/api/admin";
import { Loader2, Package, Users, ShoppingCart, Truck, CreditCard, LayoutGrid } from "lucide-react";

export default function AdminPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auth + Role guard
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || (user && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN'))) {
      navigate("/", { replace: true });
    }
  }, [authLoading, isAuthenticated, user, navigate]);

  useEffect(() => {
    if (isAuthenticated && user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN')) {
      adminApi.getDashboard()
        .then((res) => { if (res.success && res.data) setStats(res.data); })
        .catch((err) => setError((err as { message?: string }).message || 'Erro ao carregar dashboard'))
        .finally(() => setIsLoading(false));
    }
  }, [isAuthenticated, user]);

  if (authLoading || isLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (error) {
    return <div className="container mx-auto px-4 py-12 text-center"><p className="text-destructive">{error}</p></div>;
  }

  const cards = [
    { label: "Produtos", icon: Package, href: "/admin/products", value: stats?.totalProducts, available: true },
    { label: "Pedidos", icon: ShoppingCart, href: "/admin/orders", value: stats?.totalOrders, available: true },
    { label: "Categorias", icon: LayoutGrid, href: "/admin/categories", value: stats?.totalCategories, available: false },
    { label: "Usuários", icon: Users, href: "/admin/users", value: stats?.totalUsers, available: false },
    { label: "Pagamentos", icon: CreditCard, href: "/admin/payments", value: null, available: false },
    { label: "Envios", icon: Truck, href: "/admin/shipments", value: null, available: false },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Painel Administrativo</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {cards.map((card) => {
          const inner = (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <card.icon className="h-6 w-6 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  {card.value !== undefined && card.value !== null && (
                    <p className="text-2xl font-bold text-foreground-strong">{String(card.value)}</p>
                  )}
                </div>
              </div>
              {!card.available && (
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground border border-border rounded-full px-2 py-0.5">
                  Em breve
                </span>
              )}
            </div>
          );

          return card.available ? (
            <Link key={card.href} to={card.href} className="p-6 rounded-lg border border-border bg-card hover:shadow-md transition-shadow">
              {inner}
            </Link>
          ) : (
            <div
              key={card.href}
              aria-disabled="true"
              title="Gestão disponível via API; interface dedicada em desenvolvimento."
              className="p-6 rounded-lg border border-dashed border-border bg-card/60 opacity-70 cursor-not-allowed"
            >
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
