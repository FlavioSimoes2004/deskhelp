import { Link } from "react-router";
import { EmptyState, ErrorAlert, Loading } from "../components/Feedback";
import { StatusStrip } from "../components/StatusStrip";
import { TicketTable } from "../components/TicketTable";
import { useAsync } from "../hooks/useAsync";
import { useLiveRefresh } from "../hooks/useLiveRefresh";
import { useAuth } from "../hooks/useAuth";
import { ticketService } from "../services/deskhelp";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export function HomePage() {
  const { user, isStaff } = useAuth();
  const overview = useAsync(() => ticketService.overview(), []);
  const recent = useAsync(() => ticketService.list({ pageSize: 6 }), []);
  const mine = useAsync(
    () => (isStaff && user ? ticketService.list({ assigneeId: user.id, pageSize: 6 }) : Promise.resolve(null)),
    [isStaff, user?.id],
  );
  useLiveRefresh(() => {
    void overview.refresh();
    void recent.refresh();
    void mine.refresh();
  });

  const firstName = user?.name.split(" ")[0] ?? "";
  const openForMe = mine.data?.data.filter((t) => t.status !== "resolvido" && t.status !== "fechado") ?? [];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>
            {greeting()}, {firstName}
          </h1>
          <p>
            {isStaff
              ? "Esta é a situação de todos os chamados da equipe."
              : "Acompanhe aqui os chamados que você abriu."}
          </p>
        </div>
        <Link className="btn btn-primary" to="/chamados/novo">
          Abrir chamado
        </Link>
      </div>

      <section className="panel" aria-labelledby="dist-title">
        <div className="panel-head">
          <h2 id="dist-title">{isStaff ? "Todos os chamados por status" : "Seus chamados por status"}</h2>
        </div>
        <ErrorAlert error={overview.error} onRetry={overview.reload} />
        {overview.data ? <StatusStrip counts={overview.data.byStatus} linkPrefix="/chamados?" /> : !overview.error && <Loading />}
      </section>

      {isStaff && (
        <section className="panel" aria-labelledby="mine-title">
          <div className="panel-head">
            <h2 id="mine-title">Com você agora</h2>
            {user && <Link to={`/chamados?assigneeId=${user.id}`}>Ver todos os seus</Link>}
          </div>
          <ErrorAlert error={mine.error} onRetry={mine.reload} />
          {mine.loading ? (
            <Loading />
          ) : openForMe.length ? (
            <TicketTable tickets={openForMe} showRequester />
          ) : (
            <EmptyState title="Nenhum chamado em aberto com você">
              <p>Pegue um chamado da fila ou atribua um a você na tela do chamado.</p>
            </EmptyState>
          )}
        </section>
      )}

      <section className="panel" aria-labelledby="recent-title">
        <div className="panel-head">
          <h2 id="recent-title">Abertos recentemente</h2>
          <Link to="/chamados">Ver todos</Link>
        </div>
        <ErrorAlert error={recent.error} onRetry={recent.reload} />
        {recent.loading ? (
          <Loading />
        ) : recent.data?.data.length ? (
          <TicketTable tickets={recent.data.data} showRequester={isStaff} />
        ) : (
          <EmptyState
            title="Nenhum chamado ainda"
            action={
              <Link className="btn btn-primary" to="/chamados/novo">
                Abrir o primeiro chamado
              </Link>
            }
          >
            <p>Quando algo não estiver funcionando, descreva o problema e a equipe de suporte assume.</p>
          </EmptyState>
        )}
      </section>
    </div>
  );
}
