import { useState } from "react";
import { EmptyState, ErrorAlert, Loading } from "../components/Feedback";
import { BarList, BreakdownTables, Count, daysAgo, PeriodFilter } from "../components/ReportWidgets";
import { useAsync } from "../hooks/useAsync";
import { reportService } from "../services/deskhelp";
import type { PersonReportRow } from "../services/types";
import { isoDay } from "../utils/format";

type Kind = "requesters" | "assignees";

const TEXT: Record<Kind, { title: string; intro: string; column: string; people: string }> = {
  requesters: {
    title: "Relatório de solicitantes",
    intro: "Quem abriu chamados no período: quantos, em que situação estão, de quais categorias e quanto levaram para ser resolvidos.",
    column: "Solicitante",
    people: "Pessoas que abriram chamados",
  },
  assignees: {
    title: "Relatório de responsáveis",
    intro: "Chamados abertos no período por responsável: quantos, em que situação estão, de quais categorias e quanto levaram para ser resolvidos.",
    column: "Responsável",
    people: "Responsáveis com chamados",
  },
};

const nameOf = (p: PersonReportRow) => p.userName ?? "Sem responsável";
const hours = (h: number | null) => (h === null ? "—" : `${h.toLocaleString("pt-BR")} h`);

/** Relatório por pessoa: quem abriu o chamado (requesters) ou o responsável (assignees). */
export function PeopleReportPage({ kind }: { kind: Kind }) {
  const text = TEXT[kind];
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(isoDay(new Date()));
  const report = useAsync(() => reportService.people(kind, from, to), [kind, from, to]);
  const data = report.data;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{text.title}</h1>
          <p>{text.intro}</p>
        </div>
      </div>

      <PeriodFilter
        from={from}
        to={to}
        onChange={(period) => {
          setFrom(period.from);
          setTo(period.to);
        }}
      />

      <ErrorAlert error={report.error} onRetry={report.reload} />
      {report.loading && !data ? (
        <Loading />
      ) : data && data.totals.total === 0 ? (
        <div className="panel">
          <EmptyState title="Nenhum chamado aberto neste período">
            <p>Escolha um período maior para ver o relatório.</p>
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
                <span>{text.people}</span>
                <strong>{data.totals.people}</strong>
              </div>
              {kind === "assignees" ? (
                <div>
                  <span>Sem responsável</span>
                  <strong>{data.totals.unassigned}</strong>
                </div>
              ) : (
                <div>
                  <span>Resolvidos</span>
                  <strong>{data.totals.resolved}</strong>
                </div>
              )}
              <div>
                <span>Tempo médio até resolver</span>
                <strong>{hours(data.totals.avgResolutionHours)}</strong>
              </div>
            </div>
          </section>

          <section className="panel" aria-labelledby={`${kind}-per-person-title`}>
            <div className="panel-head">
              <h2 id={`${kind}-per-person-title`}>Chamados por {text.column.toLowerCase()}</h2>
            </div>
            <BarList
              items={data.people.map((p) => ({ key: String(p.userId ?? "none"), label: nameOf(p), total: p.total }))}
            />
          </section>

          <section className="panel" aria-labelledby={`${kind}-resolution-title`}>
            <div className="panel-head">
              <h2 id={`${kind}-resolution-title`}>Resolução</h2>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">{text.column}</th>
                    <th scope="col" className="num">
                      Chamados
                    </th>
                    <th scope="col" className="num">
                      Resolvidos
                    </th>
                    <th scope="col" className="num">
                      Taxa de resolução
                    </th>
                    <th scope="col" className="num">
                      Tempo médio até resolver
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.people.map((p) => (
                    <tr key={p.userId ?? "none"}>
                      <th scope="row">{p.userId === null ? <span className="muted">{nameOf(p)}</span> : nameOf(p)}</th>
                      <Count value={p.total} />
                      <Count value={p.resolved} />
                      <td className="num">{Math.round((p.resolved / p.total) * 100)}%</td>
                      <td className="num">{hours(p.avgResolutionHours)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <BreakdownTables
            rowLabel={text.column}
            categories={data.categories}
            rows={data.people.map((p) => ({
              key: String(p.userId ?? "none"),
              header: p.userId === null ? <span className="muted">{nameOf(p)}</span> : nameOf(p),
              total: p.total,
              byStatus: p.byStatus,
              byCategory: p.byCategory,
            }))}
          />
        </>
      ) : null}
    </div>
  );
}
