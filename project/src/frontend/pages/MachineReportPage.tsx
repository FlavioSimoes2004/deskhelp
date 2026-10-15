import { useState } from "react";
import { StatusBadge } from "../components/Badges";
import { EmptyState, ErrorAlert, Loading } from "../components/Feedback";
import { BarList, daysAgo, PeriodFilter } from "../components/ReportWidgets";
import { useAsync } from "../hooks/useAsync";
import { reportService } from "../services/deskhelp";
import type { MachineReportRow } from "../services/types";
import { isoDay, STATUS_ORDER } from "../utils/format";

/** Célula com o MAC e, abaixo, a descrição e com quem a máquina está. */
function MachineCell({ machine }: { machine: MachineReportRow }) {
  const details = [machine.description, machine.userName].filter(Boolean).join(" · ");
  return (
    <th scope="row">
      <strong>{machine.macAddress}</strong>
      {details && (
        <span className="muted" style={{ display: "block" }}>
          {details}
        </span>
      )}
    </th>
  );
}

/** Número da célula; zero aparece apagado para destacar onde há chamados. */
const Count = ({ value }: { value: number }) => (
  <td className="num">{value === 0 ? <span className="muted">0</span> : <strong>{value}</strong>}</td>
);

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
                label: m.description ? `${m.macAddress} (${m.description})` : m.macAddress,
                total: m.total,
              }))}
            />
          </section>

          <section className="panel" aria-labelledby="by-status-title">
            <div className="panel-head">
              <h2 id="by-status-title">Por status</h2>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Máquina</th>
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
                  {data.machines.map((m) => (
                    <tr key={m.machineId}>
                      <MachineCell machine={m} />
                      {STATUS_ORDER.map((s) => (
                        <Count key={s} value={m.byStatus[s]} />
                      ))}
                      <Count value={m.total} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel" aria-labelledby="by-category-title">
            <div className="panel-head">
              <h2 id="by-category-title">Por categoria</h2>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Máquina</th>
                    {data.categories.map((c) => (
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
                  {data.machines.map((m) => (
                    <tr key={m.machineId}>
                      <MachineCell machine={m} />
                      {data.categories.map((c) => (
                        <Count key={c} value={m.byCategory.find((x) => x.label === c)?.total ?? 0} />
                      ))}
                      <Count value={m.total} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
