import { Copy, CheckCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface PixQRCodeProps {
  qrCode: string;
  amount: number;
}

export function PixQRCode({ qrCode, amount }: PixQRCodeProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(qrCode);
      setCopied(true);
      toast.success("Código PIX copiado!");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error("Erro ao copiar código");
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* QR Code visual placeholder */}
      <div className="w-48 h-48 bg-white border-2 border-border rounded-lg flex items-center justify-center p-4">
        <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 rounded grid grid-cols-8 grid-rows-8 gap-0.5 p-2">
          {Array.from({ length: 64 }).map((_, i) => (
            <div
              key={i}
              className={`rounded-sm ${Math.random() > 0.4 ? 'bg-white' : 'bg-transparent'}`}
            />
          ))}
        </div>
      </div>

      <p className="text-2xl font-bold text-primary tabular-nums">
        {amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
      </p>

      {/* Copy PIX code */}
      <div className="w-full max-w-sm">
        <p className="text-xs text-muted-foreground mb-2 text-center">Código PIX Copia e Cola:</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs bg-accent p-2 rounded overflow-hidden text-ellipsis whitespace-nowrap">
            {qrCode.substring(0, 40)}...
          </code>
          <button
            onClick={handleCopy}
            className="p-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            aria-label="Copiar código PIX"
          >
            {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
