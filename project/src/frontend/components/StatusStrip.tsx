import type { CSSProperties } from "react";
import { Link } from "react-router";
import type { StatusCounts } from "../services/types";
import { STATUS_LABEL, STATUS_ORDER } from "../utils/format";

/** Barra empilhada com a distribuição dos chamados por status + legenda com contagens. */
export function StatusStrip({ counts, linkPrefix }: { counts: StatusCounts; linkPrefix: string }) {
  const total = STATUS_ORDER.reduce((sum, s) => sum + (counts[s] ?? 0), 0);
  return (
    <div>
      <div
        className="status-strip"
        role="img"
        aria-label={STATUS_ORDER.map((s) => `${STATUS_LABEL[s]}: ${counts[s] ?? 0}`).join(", ")}
      >
        {total > 0 &&
          STATUS_ORDER.filter((s) => (counts[s] ?? 0) > 0).map((s) => (
            <span
              key={s}
              title={`${STATUS_LABEL[s]}: ${counts[s]}`}
              style={{ "--seg": `var(--st-${s})`, flexGrow: counts[s] } as CSSProperties}
            />
          ))}
      </div>
      <div className="status-legend">
        {STATUS_ORDER.map((s) => (
          <Link key={s} to={`${linkPrefix}status=${s}`}>
            <span className="status" style={{ "--dot": `var(--st-${s})` } as CSSProperties}>
              {STATUS_LABEL[s]}
            </span>
            <strong>{counts[s] ?? 0}</strong>
          </Link>
        ))}
      </div>
    </div>
  );
}
