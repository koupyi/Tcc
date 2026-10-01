import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { PasswordRequirements } from "@/components/PasswordRequirements";
import { isPasswordValid } from "@/utils/passwordValidation";
import { mapApiError } from "@/utils/errorMapper";

const LoginPage = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", confirmPassword: "", name: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Email
    const email = form.email.trim();
    if (!email) {
      newErrors.email = "E-mail é obrigatório";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "E-mail inválido";
    }

    // Password
    if (!form.password) {
      newErrors.password = "Senha é obrigatória";
    } else if (isRegister && !isPasswordValid(form.password)) {
      newErrors.password = "Senha não atende aos requisitos";
    }

    // Register-specific
    if (isRegister) {
      if (!form.name.trim()) {
        newErrors.name = "Nome é obrigatório";
      } else if (form.name.trim().length < 2) {
        newErrors.name = "Nome deve ter no mínimo 2 caracteres";
      }

      if (form.password && form.confirmPassword && form.password !== form.confirmPassword) {
        newErrors.confirmPassword = "As senhas não coincidem";
      } else if (!form.confirmPassword) {
        newErrors.confirmPassword = "Confirmação de senha é obrigatória";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      const authResult = isRegister
        ? await register(form.email.trim(), form.password, form.name.trim())
        : await login(form.email.trim(), form.password);

      if (authResult.success) {
        toast.success(isRegister ? "Conta criada com sucesso!" : "Bem-vindo de volta!");
        navigate("/");
      } else {
        // Use error mapper for friendly message
        const mapped = mapApiError({ success: false, message: authResult.error || "", code: "" });
        setErrors({ form: mapped.message });
      }
    } catch (err) {
      const mapped = mapApiError(err);
      setErrors({ form: mapped.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear field error on change
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const switchMode = () => {
    setIsRegister(!isRegister);
    setErrors({});
    setForm({ email: "", password: "", confirmPassword: "", name: "" });
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="bg-card rounded-lg shadow-card p-8">
          <h1 className="text-2xl font-bold tracking-tight mb-6 text-center">
            {isRegister ? "Criar Conta" : "Entrar"}
          </h1>

          {errors.form && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md" role="alert">
              <p className="text-sm text-destructive">{errors.form}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {isRegister && (
              <div>
                <label htmlFor="name" className="text-sm font-medium text-foreground-strong block mb-1">
                  Nome
                </label>
                <input
                  id="name"
                  type="text"
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  className="w-full bg-background border border-border rounded-md px-3 py-2.5 text-sm text-foreground-strong focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none"
                  placeholder="Seu nome"
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? "name-error" : undefined}
                  autoComplete="name"
                />
                {errors.name && (
                  <p id="name-error" className="text-destructive text-xs mt-1" role="alert">
                    {errors.name}
                  </p>
                )}
              </div>
            )}

            <div>
              <label htmlFor="email" className="text-sm font-medium text-foreground-strong block mb-1">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                className="w-full bg-background border border-border rounded-md px-3 py-2.5 text-sm text-foreground-strong focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none"
                placeholder="voce@exemplo.com"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
                autoComplete="email"
              />
              {errors.email && (
                <p id="email-error" className="text-destructive text-xs mt-1" role="alert">
                  {errors.email}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="text-sm font-medium text-foreground-strong block mb-1">
                Senha
              </label>
              <input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => updateField("password", e.target.value)}
                className="w-full bg-background border border-border rounded-md px-3 py-2.5 text-sm text-foreground-strong focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none"
                placeholder="••••••••"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? "password-error" : "password-requirements"}
                autoComplete={isRegister ? "new-password" : "current-password"}
              />
              {errors.password && (
                <p id="password-error" className="text-destructive text-xs mt-1" role="alert">
                  {errors.password}
                </p>
              )}
              {isRegister && (
                <div id="password-requirements">
                  <PasswordRequirements password={form.password} show={form.password.length > 0} />
                </div>
              )}
            </div>

            {isRegister && (
              <div>
                <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground-strong block mb-1">
                  Confirmar Senha
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => updateField("confirmPassword", e.target.value)}
                  className="w-full bg-background border border-border rounded-md px-3 py-2.5 text-sm text-foreground-strong focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background outline-none"
                  placeholder="••••••••"
                  aria-invalid={!!errors.confirmPassword}
                  aria-describedby={errors.confirmPassword ? "confirm-error" : undefined}
                  autoComplete="new-password"
                />
                {errors.confirmPassword && (
                  <p id="confirm-error" className="text-destructive text-xs mt-1" role="alert">
                    {errors.confirmPassword}
                  </p>
                )}
              </div>
            )}

            <motion.button
              type="submit"
              disabled={isSubmitting}
              whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
              whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
              className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-md shadow-button disabled:opacity-50 disabled:cursor-not-allowed"
              aria-busy={isSubmitting}
            >
              {isSubmitting
                ? "Aguarde..."
                : isRegister
                  ? "Criar Conta"
                  : "Entrar"
              }
            </motion.button>
          </form>

          <p className="text-sm text-center mt-6 text-foreground">
            {isRegister ? "Já tem uma conta?" : "Não tem uma conta?"}{" "}
            <button
              onClick={switchMode}
              className="text-primary font-medium hover:underline"
              type="button"
            >
              {isRegister ? "Entrar" : "Criar Conta"}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
