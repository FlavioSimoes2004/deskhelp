import { cloneElement, useId, type ReactElement } from "react";

interface Props {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactElement<{ id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }>;
}

/** Rótulo + controle + dica/erro, com os atributos de acessibilidade ligados. */
export function Field({ label, error, hint, className, children }: Props) {
  const id = useId();
  const noteId = `${id}-note`;
  return (
    <div className={`field ${className ?? ""}`}>
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, {
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error || hint ? noteId : undefined,
      })}
      {error ? (
        <span id={noteId} className="error">
          {error}
        </span>
      ) : hint ? (
        <span id={noteId} className="hint">
          {hint}
        </span>
      ) : null}
    </div>
  );
}
