import { validatePassword } from '@/utils/passwordValidation';

interface PasswordRequirementsProps {
  password: string;
  show?: boolean;
}

/**
 * Dynamic password requirements indicator.
 * Shows check/cross with color + text for each rule.
 * Accessible: uses aria-live and text indicators (not color-only).
 */
export function PasswordRequirements({ password, show = true }: PasswordRequirementsProps) {
  if (!show || !password) return null;

  const results = validatePassword(password);

  return (
    <div className="mt-2 space-y-1" role="status" aria-live="polite" aria-label="Requisitos da senha">
      {results.map((rule) => (
        <div
          key={rule.id}
          className={`flex items-center gap-2 text-xs ${
            rule.passed ? 'text-green-600' : 'text-muted-foreground'
          }`}
        >
          <span aria-hidden="true" className="text-sm">
            {rule.passed ? '✓' : '✕'}
          </span>
          <span>
            {rule.label}
            <span className="sr-only">{rule.passed ? ' — atendido' : ' — não atendido'}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
