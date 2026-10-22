import { useState } from "react";
import { EmptyState, ErrorAlert, Loading } from "../components/Feedback";
import { BarList, daysAgo, PeriodFilter } from "../components/ReportWidgets";
import { useAsync } from "../hooks/useAsync";
import { ApiError } from "../services/api";
import { reportService } from "../services/deskhelp";
import type { CountItem, TicketPriority, TicketStatus } from "../services/types";
import { formatDay, isoDay, PRIORITY_LABEL, PRIORITY_ORDER, STATUS_LABEL, STATUS_ORDER } from "../utils/format";

/** Completa a lista com as categorias fixas (status/prioridade), na ordem do fluxo. */
function inOrder<K extends string>(items: CountItem[], order: K[], labels: Record<K, string>) {
  return order.map((key) => ({ key, label: labels[key], total: items.find((i) => i.label === key)?.total ?? 0 }));
}

export function TicketReportPage() {
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(isoDay(new Date()));
  const [exportError, setExportError] = useState<ApiError | null>(null);
  const [exporting, setExporting] = useState(false);
  const summary = useAsync(() => reportService.summary(from, to), [from, to]);
  const data = summary.data;

  async function onExport() {
    setExporting(true);
    setExportError(null);
    try {
      await reportService.exportCsv(from, to);
    } catch (err) {
      setExportError(err as ApiError);
    } finally {
      setExporting(false);
    }
  }

  const perDayMax = Math.max(1, ...(data?.perDay.map((d) => d.total) ?? []));
  // Preenche os dias sem chamados para o eixo do tempo não "pular" datas.
  const days: { day: string; total: number }[] = [];
  if (data) {
    for (let d = new Date(`${data.period.from}T12:00:00`); isoDay(d) <= data.period.to; d.setDate(d.getDate() + 1)) {
      const day = isoDay(d);
      days.push({ day, total: data.perDay.find((p) => p.day === day)?.total ?? 0 });
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Relatório de chamados</h1>
          <p>Chamados abertos no período escolhido: volume, situação e tempo até a solução.</p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={onExport} disabled={exporting}>
          {exporting ? "Gerando CSV…" : "Exportar CSV"}
        </button>
      </div>

      <PeriodFilter
        from={from}
        to={to}
        onChange={(period) => {
          setFrom(period.from);
          setTo(period.to);
        }}
      />

      <ErrorAlert error={exportError} />
      <ErrorAlert error={summary.error} onRetry={summary.reload} />
      {summary.loading && !data ? (
        <Loading />
      ) : data && data.totals.total === 0 ? (
        <div className="panel">
          <EmptyState title="Nenhum chamado aberto neste período">
            <p>Escolha um período maior para ver os indicadores.</p>
          </EmptyState>
        </div>
      ) : data ? (
        <>
          <section className="panel" aria-label="Indicadores do período">
            <div className="kpis">
              <div>
                <span>Chamados abertos</span>
                <strong>{data.totals.total}</strong>
              </div>
              <div>
                <span>Resolvidos</span>
                <strong>{data.totals.resolved}</strong>
              </div>
              <div>
                <span>Taxa de resolução</span>
                <strong>{Math.round((data.totals.resolved / data.totals.total) * 100)}%</strong>
              </div>
              <div>
                <span>Tempo médio até resolver</span>
                <strong>{data.totals.avgResolutionHours === null ? "—" : `${data.totals.avgResolutionHours.toLocaleString("pt-BR")} h`}</strong>
              </div>
            </div>
          </section>

          <section className="panel" aria-labelledby="per-day-title">
            <div className="panel-head">
              <h2 id="per-day-title">Chamados abertos por dia</h2>
            </div>
            <div className="columns" role="list" aria-label="Chamados abertos por dia">
              {days.map((d) => (
                <div
                  key={d.day}
                  className="col"
                  role="listitem"
                  tabIndex={0}
                  aria-label={`${formatDay(d.day)}: ${d.total} chamados`}
                >
                  <i style={{ height: `${(d.total / perDayMax) * 100}%` }} />
                  <span className="tip">
                    {formatDay(d.day)}: {d.total}
                  </span>
                </div>
              ))}
            </div>
            <div className="columns-axis" aria-hidden="true">
              <span>{formatDay(data.period.from)}</span>
              <span>Máx. {perDayMax} por dia</span>
              <span>{formatDay(data.period.to)}</span>
            </div>
          </section>

          <div className="grid-2" style={{ marginTop: 16 }}>
            <section className="panel" aria-labelledby="by-status-title" style={{ marginTop: 0 }}>
              <div className="panel-head">
                <h2 id="by-status-title">Por status atual</h2>
              </div>
              <BarList
                items={inOrder<TicketStatus>(data.byStatus, STATUS_ORDER, STATUS_LABEL)}
                colorOf={(key) => `var(--st-${key})`}
              />
            </section>
            <section className="panel" aria-labelledby="by-priority-title" style={{ marginTop: 0 }}>
              <div className="panel-head">
                <h2 id="by-priority-title">Por prioridade</h2>
              </div>
              <BarList
                items={[
                  ...inOrder<TicketPriority>(data.byPriority, PRIORITY_ORDER, PRIORITY_LABEL),
                  // Chamados ainda sem prioridade (definida depois pelo suporte).
                  ...data.byPriority
                    .filter((p) => p.label === null)
                    .map((p) => ({ key: "__none", label: "Sem prioridade", total: p.total })),
                ]}
              />
            </section>
            <section className="panel" aria-labelledby="by-category-title" style={{ marginTop: 0 }}>
              <div className="panel-head">
                <h2 id="by-category-title">Por categoria</h2>
              </div>
              <BarList items={data.byCategory.map((c) => ({ key: c.label ?? "", label: c.label ?? "", total: c.total }))} />
            </section>
            <section className="panel" aria-labelledby="by-assignee-title" style={{ marginTop: 0 }}>
              <div className="panel-head">
                <h2 id="by-assignee-title">Por responsável</h2>
              </div>
              <BarList
                items={data.byAssignee.map((a) => ({
                  key: a.label ?? "__none",
                  label: a.label ?? "Sem responsável",
                  total: a.total,
                }))}
              />
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
