import { useState, type FormEvent } from "react";
import { EmptyState, ErrorAlert, Loading } from "../components/Feedback";
import { Field } from "../components/Field";
import { useAsync } from "../hooks/useAsync";
import { ApiError } from "../services/api";
import { categoryService } from "../services/deskhelp";
import type { Category } from "../services/types";

/** Categorias dos chamados (só admin): lista e cadastro. Os nomes ficam sempre em maiúsculas. */
export function CategoriesPage() {
  const categories = useAsync(() => categoryService.list(), []);
  const [name, setName] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [toggling, setToggling] = useState<number | null>(null);

  async function toggle(category: Category) {
    setToggling(category.id);
    setError(null);
    setNotice(null);
    try {
      const updated = await categoryService.setActive(category.id, !category.active);
      setNotice(`Categoria ${updated.name} ${updated.active ? "ativada" : "desativada"}.`);
      void categories.reload();
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setToggling(null);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const created = await categoryService.create(name);
      setName("");
      setNotice(`Categoria ${created.name} cadastrada.`);
      void categories.reload();
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <div className="page-head">
        <div>
          <h1>Categorias</h1>
          <p>
            Categorias que as pessoas escolhem ao abrir um chamado. Os nomes são gravados em maiúsculas. Categorias
            desativadas somem da escolha, mas chamados que já as usam continuam com elas.
          </p>
        </div>
      </div>

      <form className="panel form" onSubmit={onSubmit} noValidate>
        <div className="panel-head">
          <h2>Nova categoria</h2>
        </div>
        <ErrorAlert error={error && !error.details.length ? error : null} />
        {notice && (
          <div className="alert alert-ok" role="status">
            {notice}
          </div>
        )}
        <Field label="Nome" hint="Ex.: Telefonia. Será gravado como TELEFONIA." error={error?.fieldError("name")}>
          <input
            className="input"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            style={{ textTransform: "uppercase" }}
          />
        </Field>
        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={saving || name.trim().length < 2}>
            {saving ? "Salvando…" : "Cadastrar categoria"}
          </button>
        </div>
      </form>

      <div style={{ marginTop: 16 }}>
        <ErrorAlert error={categories.error} onRetry={categories.reload} />
        {categories.loading && !categories.data ? (
          <Loading />
        ) : categories.data?.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">Situação</th>
                  <th scope="col">
                    <span className="visually-hidden">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {categories.data.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong className={c.active ? undefined : "muted"}>{c.name}</strong>
                    </td>
                    <td>
                      <span className={c.active ? "tag" : "tag tag-muted"}>{c.active ? "Ativa" : "Desativada"}</span>
                    </td>
                    <td className="num">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={toggling === c.id}
                        onClick={() => toggle(c)}
                      >
                        {c.active ? "Desativar" : "Ativar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="panel">
            <EmptyState title="Nenhuma categoria cadastrada">
              <p>Cadastre a primeira categoria acima.</p>
            </EmptyState>
          </div>
        )}
      </div>
    </div>
  );
}
