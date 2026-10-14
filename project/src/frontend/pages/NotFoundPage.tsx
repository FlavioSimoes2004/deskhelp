import { Link } from "react-router";
import { EmptyState } from "../components/Feedback";

export function NotFoundPage() {
  return (
    <div className="page panel">
      <EmptyState
        title="Página não encontrada"
        action={
          <Link className="btn btn-primary" to="/">
            Ir para o início
          </Link>
        }
      >
        <p>O endereço pode estar errado ou a página foi removida.</p>
      </EmptyState>
    </div>
  );
}
