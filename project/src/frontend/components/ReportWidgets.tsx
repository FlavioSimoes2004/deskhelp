import { useId, type CSSProperties } from "react";
import { isoDay } from "../utils/format";

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
