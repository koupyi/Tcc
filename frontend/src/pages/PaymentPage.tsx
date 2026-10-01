import { useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, AlertTriangle, CheckCircle, ArrowLeft } from "lucide-react";
import { usePayment } from "@/hooks/usePayment";
import { useAuth } from "@/context/AuthContext";
import { PixQRCode } from "@/components/payment/PixQRCode";
import { PaymentStatusBadge } from "@/components/payment/PaymentStatusBadge";
import { PaymentTimer } from "@/components/payment/PaymentTimer";

const PaymentPage = () => {
  const { id: orderId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { payment, isLoading, error, createPayment } = usePayment(orderId);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/login", { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Auto-create payment if not exists
  useEffect(() => {
    if (orderId && !payment && !isLoading && !error && isAuthenticated) {
      createPayment();
    }
  }, [orderId, payment, isLoading, error, isAuthenticated, createPayment]);

  // Redirect to success when paid
  useEffect(() => {
    if (payment?.status === "PAID") {
      setTimeout(() => navigate(`/orders/${orderId}/success`, { replace: true }), 1500);
    }
  }, [payment?.status, orderId, navigate]);

  if (authLoading || isLoading) {
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
        <h1 className="text-2xl font-bold mb-2">Erro no pagamento</h1>
        <p className="text-foreground mb-6">{error}</p>
        <Link to="/orders" className="text-primary hover:underline">Ver meus pedidos</Link>
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-foreground">Criando pagamento...</span>
      </div>
    );
  }

  // Payment paid — show success
  if (payment.status === "PAID") {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        </motion.div>
        <h1 className="text-3xl font-bold mb-2">Pagamento confirmado!</h1>
        <p className="text-foreground">Redirecionando...</p>
      </div>
    );
  }

  // Payment expired/failed
  if (payment.status === "CANCELLED" || payment.status === "FAILED") {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">
          {payment.status === "CANCELLED" ? "Pagamento expirado" : "Pagamento falhou"}
        </h1>
        <p className="text-foreground mb-6">Crie um novo pedido para tentar novamente.</p>
        <Link to="/products" className="px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-md">
          Ver produtos
        </Link>
      </div>
    );
  }

  // Payment pending — show PIX QR
  const qrCode = payment.gatewayResponse?.qrCode || "";
  const expiresAt = payment.gatewayResponse?.expiresAt || "";

  return (
    <div className="container mx-auto px-4 py-8 max-w-lg">
      <nav className="mb-6">
        <Link to="/orders" className="text-sm text-muted-foreground hover:text-foreground-strong inline-flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Meus pedidos
        </Link>
      </nav>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-lg shadow-card p-6 space-y-6"
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Pagamento PIX</h1>
          <PaymentStatusBadge status={payment.status} />
        </div>

        {/* QR Code */}
        {qrCode && <PixQRCode qrCode={qrCode} amount={Number(payment.amount)} />}

        {/* Timer */}
        {expiresAt && (
          <div className="text-center">
            <PaymentTimer expiresAt={expiresAt} />
          </div>
        )}

        {/* Instructions */}
        <div className="bg-accent rounded-md p-4 text-sm space-y-2">
          <p className="font-medium">Como pagar:</p>
          <ol className="list-decimal list-inside space-y-1 text-foreground">
            <li>Abra o app do seu banco</li>
            <li>Escaneie o QR Code ou copie o código</li>
            <li>Confirme o pagamento</li>
            <li>A confirmação é automática</li>
          </ol>
        </div>

        {/* Polling indicator */}
        <p className="text-xs text-muted-foreground text-center">
          Verificando pagamento automaticamente...
        </p>
      </motion.div>
    </div>
  );
};

export default PaymentPage;
