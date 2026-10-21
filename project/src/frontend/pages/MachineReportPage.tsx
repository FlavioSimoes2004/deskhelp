import { useState } from "react";
import { EmptyState, ErrorAlert, Loading } from "../components/Feedback";
import { BarList, BreakdownTables, daysAgo, PeriodFilter } from "../components/ReportWidgets";
import { useAsync } from "../hooks/useAsync";
import { reportService } from "../services/deskhelp";
import type { MachineReportRow } from "../services/types";
import { isoDay } from "../utils/format";
import { machineLabel } from "../utils/machine";

/** Nome (ou MAC) e, abaixo, MAC, descrição e com quem a máquina está. */
function MachineCell({ machine }: { machine: MachineReportRow }) {
  const details = [machine.name ? machine.macAddress : null, machine.description, machine.userName]
    .filter(Boolean)
    .join(" · ");
  return (
    <>
      <strong>{machine.name ?? machine.macAddress}</strong>
      {details && (
        <span className="muted" style={{ display: "block" }}>
          {details}
        </span>
      )}
    </>
  );
}

export function MachineReportPage() {
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(isoDay(new Date()));
  const report = useAsync(() => reportService.machines(from, to), [from, to]);
  const data = report.data;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Relatório de máquinas</h1>
          <p>Quantos chamados abertos no período estão vinculados a cada máquina, por status e por categoria.</p>
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
      ) : data && data.machines.length === 0 ? (
        <div className="panel">
          <EmptyState title="Nenhum chamado com máquina vinculada neste período">
            <p>
              {data.totals.withoutMachine > 0
                ? `Há ${data.totals.withoutMachine} ${data.totals.withoutMachine === 1 ? "chamado" : "chamados"} no período sem máquina vinculada.`
                : "Escolha um período maior para ver o relatório."}
            </p>
          </EmptyState>
        </div>
      ) : data ? (
        <>
          <section className="panel" aria-label="Indicadores do período">
            <div className="kpis">
              <div>
                <span>Chamados com máquina</span>
                <strong>{data.totals.withMachine}</strong>
              </div>
              <div>
                <span>Máquinas com chamados</span>
                <strong>{data.totals.machines}</strong>
              </div>
              <div>
                <span>Chamados sem máquina</span>
                <strong>{data.totals.withoutMachine}</strong>
              </div>
            </div>
          </section>

          <section className="panel" aria-labelledby="per-machine-title">
            <div className="panel-head">
              <h2 id="per-machine-title">Chamados por máquina</h2>
            </div>
            <BarList
              items={data.machines.map((m) => ({
                key: String(m.machineId),
                label: machineLabel(m),
                total: m.total,
              }))}
            />
          </section>

          <BreakdownTables
            rowLabel="Máquina"
            categories={data.categories}
            rows={data.machines.map((m) => ({
              key: String(m.machineId),
              header: <MachineCell machine={m} />,
              total: m.total,
              byStatus: m.byStatus,
              byCategory: m.byCategory,
            }))}
          />
        </>
      ) : null}
    </div>
  );
}
