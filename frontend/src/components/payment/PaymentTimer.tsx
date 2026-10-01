import { useState, useEffect } from "react";
import { Timer } from "lucide-react";

interface PaymentTimerProps {
  expiresAt: string;
  onExpired?: () => void;
}

export function PaymentTimer({ expiresAt, onExpired }: PaymentTimerProps) {
  const [timeLeft, setTimeLeft] = useState("");
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const update = () => {
      const now = new Date().getTime();
      const end = new Date(expiresAt).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft("00:00");
        setExpired(true);
        onExpired?.();
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpired]);

  if (expired) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-destructive">
        <Timer className="h-4 w-4" />
        Pagamento expirado
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
      <Timer className="h-4 w-4" />
      Expira em {timeLeft}
    </span>
  );
}
