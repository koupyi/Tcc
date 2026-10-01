import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { authApi } from "@/api/auth";
import { addressApi, Address } from "@/api/addresses";
import { toast } from "sonner";
import { mapApiError } from "@/utils/errorMapper";
import { PasswordRequirements } from "@/components/PasswordRequirements";
import { isPasswordValid } from "@/utils/passwordValidation";
import { AddressForm, AddressFormData } from "@/components/orders/AddressForm";
import { formatCep } from "@/utils/cep";

interface ProfileForm {
  name: string;
  email: string;
  phone: string;
}

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const AccountPage = () => {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const navigate = useNavigate();

  // Profile state
  const [profile, setProfile] = useState<ProfileForm>({ name: "", email: "", phone: "" });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Password state
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [showPasswordSection, setShowPasswordSection] = useState(false);

  // Address state
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addressSaving, setAddressSaving] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Load profile data
  useEffect(() => {
    if (user) {
      setProfile({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
      });
    }
  }, [user]);

  // Load addresses
  useEffect(() => {
    if (isAuthenticated) {
      loadAddresses();
    }
  }, [isAuthenticated]);

  const loadAddresses = async () => {
    try {
      const res = await addressApi.list();
      if (res.success && res.data) {
        setAddresses(res.data);
      }
    } catch {
      // silent
    } finally {
      setAddressesLoading(false);
    }
  };

  // Profile handlers
  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profileLoading) return;
    setProfileLoading(true);
    setProfileSaved(false);

    try {
      const { apiClient } = await import("@/api/client");
      const res = await apiClient.patch<{ user: typeof user }>("/auth/me", {
        name: profile.name.trim(),
        email: profile.email.trim(),
        phone: profile.phone.trim() || null,
      });
      if (res.success) {
        toast.success("Dados atualizados com sucesso!");
        setProfileSaved(true);
        setTimeout(() => setProfileSaved(false), 3000);
      }
    } catch (err) {
      const mapped = mapApiError(err);
      toast.error(mapped.message);
    } finally {
      setProfileLoading(false);
    }
  };

  // Password handlers
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordLoading) return;

    const errors: Record<string, string> = {};
    if (!passwordForm.currentPassword) errors.currentPassword = "Senha atual é obrigatória";
    if (!isPasswordValid(passwordForm.newPassword)) errors.newPassword = "Nova senha não atende aos requisitos";
    if (passwordForm.newPassword !== passwordForm.confirmPassword) errors.confirmPassword = "As senhas não coincidem";

    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      return;
    }

    setPasswordErrors({});
    setPasswordLoading(true);

    try {
      await authApi.changePassword(
        passwordForm.currentPassword,
        passwordForm.newPassword,
        passwordForm.confirmPassword,
      );
      toast.success("Senha alterada com sucesso!");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setShowPasswordSection(false);
    } catch (err) {
      const mapped = mapApiError(err);
      if (mapped.message.includes("atual") || mapped.message.includes("incorreta")) {
        setPasswordErrors({ currentPassword: "Senha atual incorreta" });
      } else {
        toast.error(mapped.message);
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  // Address handlers
  const handleAddressSubmit = async (data: AddressFormData) => {
    setAddressSaving(true);
    try {
      const res = await addressApi.create({
        recipientName: data.recipientName,
        street: data.street,
        number: data.number,
        complement: data.complement || undefined,
        neighborhood: data.neighborhood,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        label: data.label || undefined,
        isDefault: data.isDefault,
      });
      if (res.success && res.data) {
        // If this address is set as default, update others in local state
        if (data.isDefault) {
          setAddresses((prev) => prev.map((a) => ({ ...a, isDefault: false })));
        }
        setAddresses((prev) => [res.data!, ...prev]);
        setShowAddressForm(false);
        toast.success("Endereço salvo com sucesso!");
      }
    } catch (err) {
      const mapped = mapApiError(err);
      toast.error(mapped.message);
    } finally {
      setAddressSaving(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await addressApi.update(id, { isDefault: true });
      setAddresses((prev) =>
        prev.map((a) => ({ ...a, isDefault: a.id === id }))
      );
      toast.success("Endereço padrão atualizado!");
    } catch (err) {
      const mapped = mapApiError(err);
      toast.error(mapped.message);
    }
  };

  const handleDeleteAddress = async (id: string) => {
    try {
      await addressApi.remove(id);
      setAddresses((prev) => prev.filter((a) => a.id !== id));
      toast.success("Endereço removido.");
    } catch (err) {
      const mapped = mapApiError(err);
      toast.error(mapped.message);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
    toast.success("Você saiu da sua conta.");
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight mb-8">Minha Conta</h1>

      {/* ==================== Profile Section ==================== */}
      <section className="bg-card rounded-lg shadow-card p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Dados Pessoais</h2>
        <form onSubmit={handleProfileSave} className="space-y-4">
          <div>
            <label htmlFor="profile-name" className="text-sm font-medium block mb-1">Nome</label>
            <input
              id="profile-name"
              type="text"
              value={profile.name}
              onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
              className="w-full bg-background border border-border rounded-md px-3 py-2.5 text-sm focus:ring-2 focus:ring-ring outline-none"
              autoComplete="name"
            />
          </div>
          <div>
            <label htmlFor="profile-email" className="text-sm font-medium block mb-1">E-mail</label>
            <input
              id="profile-email"
              type="email"
              value={profile.email}
              onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
              className="w-full bg-background border border-border rounded-md px-3 py-2.5 text-sm focus:ring-2 focus:ring-ring outline-none"
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="profile-phone" className="text-sm font-medium block mb-1">Telefone</label>
            <input
              id="profile-phone"
              type="tel"
              value={profile.phone}
              onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
              className="w-full bg-background border border-border rounded-md px-3 py-2.5 text-sm focus:ring-2 focus:ring-ring outline-none"
              placeholder="(11) 99999-9999"
              autoComplete="tel"
            />
          </div>
          <button
            type="submit"
            disabled={profileLoading}
            className="px-6 py-2.5 bg-primary text-primary-foreground font-medium rounded-md text-sm disabled:opacity-50"
          >
            {profileLoading ? "Salvando..." : "Salvar Alterações"}
          </button>
          {profileSaved && (
            <span className="ml-3 text-sm text-green-600">✓ Dados atualizados</span>
          )}
        </form>
      </section>

      {/* ==================== Password Section ==================== */}
      <section className="bg-card rounded-lg shadow-card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Segurança</h2>
          {!showPasswordSection && (
            <button
              onClick={() => setShowPasswordSection(true)}
              className="text-sm text-primary font-medium hover:underline"
              type="button"
            >
              Alterar Senha
            </button>
          )}
        </div>

        {showPasswordSection && (
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label htmlFor="current-password" className="text-sm font-medium block mb-1">Senha Atual</label>
              <input
                id="current-password"
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => {
                  setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }));
                  setPasswordErrors((prev) => { const n = { ...prev }; delete n.currentPassword; return n; });
                }}
                className="w-full bg-background border border-border rounded-md px-3 py-2.5 text-sm focus:ring-2 focus:ring-ring outline-none"
                autoComplete="current-password"
                aria-invalid={!!passwordErrors.currentPassword}
              />
              {passwordErrors.currentPassword && (
                <p className="text-destructive text-xs mt-1" role="alert">{passwordErrors.currentPassword}</p>
              )}
            </div>
            <div>
              <label htmlFor="new-password" className="text-sm font-medium block mb-1">Nova Senha</label>
              <input
                id="new-password"
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => {
                  setPasswordForm((p) => ({ ...p, newPassword: e.target.value }));
                  setPasswordErrors((prev) => { const n = { ...prev }; delete n.newPassword; return n; });
                }}
                className="w-full bg-background border border-border rounded-md px-3 py-2.5 text-sm focus:ring-2 focus:ring-ring outline-none"
                autoComplete="new-password"
                aria-invalid={!!passwordErrors.newPassword}
              />
              {passwordErrors.newPassword && (
                <p className="text-destructive text-xs mt-1" role="alert">{passwordErrors.newPassword}</p>
              )}
              <PasswordRequirements password={passwordForm.newPassword} show={passwordForm.newPassword.length > 0} />
            </div>
            <div>
              <label htmlFor="confirm-new-password" className="text-sm font-medium block mb-1">Confirmar Nova Senha</label>
              <input
                id="confirm-new-password"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => {
                  setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }));
                  setPasswordErrors((prev) => { const n = { ...prev }; delete n.confirmPassword; return n; });
                }}
                className="w-full bg-background border border-border rounded-md px-3 py-2.5 text-sm focus:ring-2 focus:ring-ring outline-none"
                autoComplete="new-password"
                aria-invalid={!!passwordErrors.confirmPassword}
              />
              {passwordErrors.confirmPassword && (
                <p className="text-destructive text-xs mt-1" role="alert">{passwordErrors.confirmPassword}</p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={passwordLoading}
                className="px-6 py-2.5 bg-primary text-primary-foreground font-medium rounded-md text-sm disabled:opacity-50"
              >
                {passwordLoading ? "Alterando..." : "Alterar Senha"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPasswordSection(false);
                  setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
                  setPasswordErrors({});
                }}
                className="px-6 py-2.5 border border-border rounded-md text-sm font-medium hover:bg-muted"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </section>

      {/* ==================== Addresses Section ==================== */}
      <section className="bg-card rounded-lg shadow-card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Endereços</h2>
          {!showAddressForm && (
            <button
              onClick={() => setShowAddressForm(true)}
              className="text-sm text-primary font-medium hover:underline"
              type="button"
            >
              + Adicionar Endereço
            </button>
          )}
        </div>

        {addressesLoading ? (
          <p className="text-sm text-muted-foreground">Carregando endereços...</p>
        ) : addresses.length === 0 && !showAddressForm ? (
          <p className="text-sm text-muted-foreground">Nenhum endereço cadastrado.</p>
        ) : (
          <div className="space-y-3">
            {addresses.map((addr) => (
              <div key={addr.id} className="border border-border rounded-md p-4 relative">
                {addr.isDefault && (
                  <span className="absolute top-2 right-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                    Padrão
                  </span>
                )}
                <p className="text-sm font-medium">{addr.label || addr.recipientName}</p>
                <p className="text-sm text-muted-foreground">
                  {addr.street}, {addr.number}
                  {addr.complement ? ` - ${addr.complement}` : ""}
                </p>
                <p className="text-sm text-muted-foreground">
                  {addr.neighborhood} — {addr.city}/{addr.state} — CEP {formatCep(addr.zipCode)}
                </p>
                <div className="mt-2 flex gap-3">
                  {!addr.isDefault && (
                    <button
                      onClick={() => handleSetDefault(addr.id)}
                      className="text-xs text-primary hover:underline"
                      type="button"
                    >
                      Definir como padrão
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteAddress(addr.id)}
                    className="text-xs text-destructive hover:underline"
                    type="button"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showAddressForm && (
          <div className="mt-4 border-t border-border pt-4">
            <AddressForm
              onSubmit={handleAddressSubmit}
              onCancel={() => setShowAddressForm(false)}
              isLoading={addressSaving}
            />
          </div>
        )}
      </section>

      {/* ==================== Logout ==================== */}
      <section className="mt-8">
        <button
          onClick={handleLogout}
          className="px-6 py-2.5 border border-destructive text-destructive font-medium rounded-md text-sm hover:bg-destructive/10"
          type="button"
        >
          Sair
        </button>
      </section>
    </div>
  );
};

export default AccountPage;
