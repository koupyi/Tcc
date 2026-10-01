import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { adminApi } from "@/api/admin";
import { mapApiError } from "@/utils/errorMapper";
import { Loader2, ArrowLeft, Plus, Search, Pencil, Ban } from "lucide-react";

interface AdminProduct {
  id: string;
  name: string;
  slug: string;
  brand?: string | null;
  sku?: string | null;
  basePrice: number | string;
  isActive: boolean;
  category?: { id: string; name: string } | null;
  variants?: Array<{ id: string; name: string; price: number | string | null; stockQty: number }>;
}

interface Category {
  id: string;
  name: string;
}

interface ProductFormState {
  categoryId: string;
  name: string;
  sku: string;
  brand: string;
  basePrice: string;
  description: string;
}

const emptyForm: ProductFormState = { categoryId: "", name: "", sku: "", brand: "", basePrice: "", description: "" };

function formatPrice(value: number | string | null) {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function AdminProductsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [formLoading, setFormLoading] = useState(false);

  const [stockEditId, setStockEditId] = useState<string | null>(null); // variantId being edited
  const [stockValue, setStockValue] = useState("");

  const isAdmin = !!user && (user.role === "ADMIN" || user.role === "SUPER_ADMIN");

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      navigate("/", { replace: true });
    }
  }, [authLoading, isAuthenticated, isAdmin, navigate]);

  const loadProducts = useCallback(() => {
    setIsLoading(true);
    setError(null);
    const params: Record<string, string> = { limit: "50" };
    if (search.trim()) params.search = search.trim();
    adminApi
      .getProducts(params)
      .then((res) => {
        if (res.success && res.data) setProducts(res.data as AdminProduct[]);
      })
      .catch((err) => setError(mapApiError(err).message))
      .finally(() => setIsLoading(false));
  }, [search]);

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      loadProducts();
      adminApi.getCategories().then((res) => {
        if (res.success && res.data) setCategories(res.data as Category[]);
      }).catch(() => { /* non-blocking */ });
    }
  }, [isAuthenticated, isAdmin, loadProducts]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, categoryId: categories[0]?.id ?? "" });
    setShowForm(true);
  };

  const openEdit = (p: AdminProduct) => {
    setEditingId(p.id);
    setForm({
      categoryId: p.category?.id ?? categories[0]?.id ?? "",
      name: p.name,
      sku: p.sku ?? "",
      brand: p.brand ?? "",
      basePrice: String(Number(p.basePrice)),
      description: "",
    });
    setShowForm(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formLoading) return;
    const price = parseFloat(form.basePrice);
    if (!form.name.trim() || !form.categoryId || Number.isNaN(price) || price <= 0) {
      toast.error("Preencha nome, categoria e um preço válido.");
      return;
    }
    setFormLoading(true);
    try {
      if (editingId) {
        const payload: Record<string, unknown> = {
          name: form.name.trim(),
          brand: form.brand.trim() || undefined,
          basePrice: price,
        };
        if (form.description.trim()) payload.description = form.description.trim();
        const res = await adminApi.updateProduct(editingId, payload);
        if (res.success) toast.success("Produto atualizado.");
      } else {
        const payload: Record<string, unknown> = {
          categoryId: form.categoryId,
          name: form.name.trim(),
          sku: form.sku.trim(),
          basePrice: price,
        };
        if (form.brand.trim()) payload.brand = form.brand.trim();
        if (form.description.trim()) payload.description = form.description.trim();
        const res = await adminApi.createProduct(payload);
        if (res.success) toast.success("Produto criado.");
      }
      setShowForm(false);
      loadProducts();
    } catch (err) {
      toast.error(mapApiError(err).message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDisable = async (p: AdminProduct) => {
    try {
      const res = await adminApi.deleteProduct(p.id);
      if (res.success) {
        toast.success(`"${p.name}" desativado e removido do catálogo.`);
        loadProducts();
      }
    } catch (err) {
      toast.error(mapApiError(err).message);
    }
  };

  const startStockEdit = (variantId: string, current: number) => {
    setStockEditId(variantId);
    setStockValue(String(current));
  };

  const saveStock = async () => {
    if (!stockEditId) return;
    const qty = parseInt(stockValue, 10);
    if (Number.isNaN(qty) || qty < 0) {
      toast.error("Estoque deve ser um inteiro ≥ 0.");
      return;
    }
    try {
      const res = await adminApi.updateStock(stockEditId, qty);
      if (res.success) {
        toast.success("Estoque atualizado.");
        setStockEditId(null);
        loadProducts();
      }
    } catch (err) {
      toast.error(mapApiError(err).message);
    }
  };

  if (authLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Painel
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold">Produtos</h1>
        <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-md text-sm">
          <Plus className="h-4 w-4" /> Novo produto
        </button>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar por nome, marca, SKU…"
          className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-md text-sm focus:ring-2 focus:ring-ring outline-none"
        />
      </div>

      {showForm && (
        <form onSubmit={handleFormSubmit} className="rounded-lg border border-border bg-card p-4 mb-6 space-y-3">
          <h2 className="font-semibold">{editingId ? "Editar produto" : "Novo produto"}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">Nome</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Categoria</label>
              <select value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))} disabled={!!editingId} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm disabled:opacity-60">
                <option value="">Selecione…</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {!editingId && (
              <div>
                <label className="text-sm font-medium block mb-1">SKU</label>
                <input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm" />
              </div>
            )}
            <div>
              <label className="text-sm font-medium block mb-1">Marca</label>
              <input value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Preço base (R$)</label>
              <input type="number" step="0.01" min="0" value={form.basePrice} onChange={(e) => setForm((f) => ({ ...f, basePrice: e.target.value }))} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={formLoading} className="px-6 py-2 bg-primary text-primary-foreground font-semibold rounded-md text-sm disabled:opacity-50 flex items-center gap-2">
              {formLoading && <Loader2 className="h-4 w-4 animate-spin" />}{editingId ? "Salvar" : "Criar"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2 border border-border rounded-md text-sm font-medium">Cancelar</button>
          </div>
          {editingId && <p className="text-xs text-muted-foreground">Categoria e SKU não são editáveis aqui. O estoque é editado por variante na tabela abaixo.</p>}
        </form>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : error ? (
        <div className="text-center py-12"><p className="text-destructive">{error}</p></div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground"><p>Nenhum produto encontrado.</p></div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Produto</th>
                <th className="px-4 py-3 font-medium">Categoria</th>
                <th className="px-4 py-3 font-medium text-right">Preço</th>
                <th className="px-4 py-3 font-medium">Estoque (1ª variante)</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.map((p) => {
                const v = p.variants?.[0];
                return (
                  <tr key={p.id} className="hover:bg-accent/40 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.brand || "—"} · {p.sku || "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.category?.name || "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatPrice(p.basePrice)}</td>
                    <td className="px-4 py-3">
                      {v ? (
                        stockEditId === v.id ? (
                          <div className="flex items-center gap-2">
                            <input type="number" min="0" value={stockValue} onChange={(e) => setStockValue(e.target.value)} className="w-20 bg-background border border-border rounded-md px-2 py-1 text-sm" />
                            <button onClick={saveStock} className="text-xs text-primary hover:underline">Salvar</button>
                            <button onClick={() => setStockEditId(null)} className="text-xs text-muted-foreground hover:underline">Cancelar</button>
                          </div>
                        ) : (
                          <button onClick={() => startStockEdit(v.id, v.stockQty)} className="text-sm hover:underline">
                            {v.stockQty} <span className="text-xs text-muted-foreground">(editar)</span>
                          </button>
                        )
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => openEdit(p)} className="inline-flex items-center gap-1 text-primary text-sm hover:underline mr-3">
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </button>
                      <button onClick={() => handleDisable(p)} className="inline-flex items-center gap-1 text-destructive text-sm hover:underline">
                        <Ban className="h-3.5 w-3.5" /> Desativar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
