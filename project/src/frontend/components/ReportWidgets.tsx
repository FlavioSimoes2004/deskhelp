import { useId, type CSSProperties, type ReactNode } from "react";
import type { TicketStatus } from "../services/types";
import { isoDay, STATUS_ORDER } from "../utils/format";
import { StatusBadge } from "./Badges";

export const daysAgo = (n: number) => isoDay(new Date(Date.now() - n * 86_400_000));

const PRESETS = [
  { label: "7 dias", days: 6 },
  { label: "30 dias", days: 29 },
  { label: "90 dias", days: 89 },
];

/** Datas "De"/"Até" e atalhos de período usados nas páginas de relatório. */
export function PeriodFilter({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (period: { from: string; to: string }) => void;
}) {
  const id = useId();
  return (
    <div className="filters">
      <div className="field">
        <label htmlFor={`${id}-from`}>De</label>
        <input
          id={`${id}-from`}
          className="input"
          type="date"
          value={from}
          max={to}
          onChange={(e) => e.target.value && onChange({ from: e.target.value, to })}
        />
      </div>
      <div className="field">
        <label htmlFor={`${id}-to`}>Até</label>
        <input
          id={`${id}-to`}
          className="input"
          type="date"
          value={to}
          min={from}
          onChange={(e) => e.target.value && onChange({ from, to: e.target.value })}
        />
      </div>
      {PRESETS.map((p) => (
        <button
          key={p.days}
          type="button"
          className="btn btn-ghost"
          aria-pressed={from === daysAgo(p.days) && to === isoDay(new Date())}
          onClick={() => onChange({ from: daysAgo(p.days), to: isoDay(new Date()) })}
        >
          Últimos {p.label}
        </button>
      ))}
    </div>
  );
}

/** Barras horizontais com rótulo e valor ao lado (uma série, então sem legenda). */
export function BarList({
  items,
  colorOf,
}: {
  items: { key: string; label: string; total: number }[];
  colorOf?: (key: string) => string;
}) {
  const max = Math.max(1, ...items.map((i) => i.total));
  if (!items.some((i) => i.total > 0)) return <p style={{ color: "var(--ink-3)" }}>Sem chamados no período.</p>;
  return (
    <ul className="bar-list">
      {items.map((item) => (
        <li key={item.key}>
          <span className="bar-label" title={item.label}>
            {item.label}
          </span>
          <span className="bar-track" title={`${item.label}: ${item.total}`}>
            <span
              className="bar-fill"
              style={
                {
                  display: "block",
                  width: `${(item.total / max) * 100}%`,
                  "--bar": colorOf?.(item.key),
                } as CSSProperties
              }
            />
          </span>
          <span className="bar-value">{item.total}</span>
        </li>
      ))}
    </ul>
  );
}

/** Número da célula; zero aparece apagado para destacar onde há chamados. */
export const Count = ({ value }: { value: number }) => (
  <td className="num">{value === 0 ? <span className="muted">0</span> : <strong>{value}</strong>}</td>
);

export interface BreakdownRow {
  key: string;
  /** Conteúdo do cabeçalho da linha (nome da máquina, da pessoa...). */
  header: ReactNode;
  total: number;
  byStatus: Record<TicketStatus, number>;
  byCategory: { label: string; total: number }[];
}

/** Tabelas "Por status" e "Por categoria": uma linha por grupo, com o total ao fim. */
export function BreakdownTables({
  rowLabel,
  rows,
  categories,
}: {
  /** Título da primeira coluna (ex.: "Máquina"). */
  rowLabel: string;
  rows: BreakdownRow[];
  categories: string[];
}) {
  const id = useId();
  return (
    <>
      <section className="panel" aria-labelledby={`${id}-status`}>
        <div className="panel-head">
          <h2 id={`${id}-status`}>Por status</h2>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{rowLabel}</th>
                {STATUS_ORDER.map((s) => (
                  <th key={s} scope="col" className="num">
                    <StatusBadge status={s} />
                  </th>
                ))}
                <th scope="col" className="num">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <th scope="row">{r.header}</th>
                  {STATUS_ORDER.map((s) => (
                    <Count key={s} value={r.byStatus[s]} />
                  ))}
                  <Count value={r.total} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel" aria-labelledby={`${id}-category`}>
        <div className="panel-head">
          <h2 id={`${id}-category`}>Por categoria</h2>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{rowLabel}</th>
                {categories.map((c) => (
                  <th key={c} scope="col" className="num">
                    {c}
                  </th>
                ))}
                <th scope="col" className="num">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <th scope="row">{r.header}</th>
                  {categories.map((c) => (
                    <Count key={c} value={r.byCategory.find((x) => x.label === c)?.total ?? 0} />
                  ))}
                  <Count value={r.total} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
