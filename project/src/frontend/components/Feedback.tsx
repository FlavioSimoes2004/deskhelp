import type { ReactNode } from "react";
import type { ApiError } from "../services/api";

export function ErrorAlert({ error, onRetry }: { error: ApiError | null | undefined; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <div className="alert alert-error" role="alert">
      {error.message}{" "}
      {onRetry && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>
          Tentar de novo
        </button>
      )}
    </div>
  );
}

export function Loading({ label = "Carregando…" }: { label?: string }) {
  return (
    <p className="loading" role="status">
      {label}
    </p>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children}
      {action}
    </div>
  );
}
