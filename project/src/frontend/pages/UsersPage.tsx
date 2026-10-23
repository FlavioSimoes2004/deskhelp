import { useState, type FormEvent } from "react";
import { EmptyState, ErrorAlert, Loading } from "../components/Feedback";
import { Field } from "../components/Field";
import { useAppSettings } from "../hooks/useAppSettings";
import { useAsync } from "../hooks/useAsync";
import { useAuth } from "../hooks/useAuth";
import { ApiError } from "../services/api";
import { userService } from "../services/deskhelp";
import type { Role, User } from "../services/types";
import { formatDateTime, ROLE_LABEL } from "../utils/format";

export function UsersPage() {
  const { user: me, isAdmin } = useAuth();
  // Configuração: o suporte pode estar proibido de cadastrar e editar usuários.
  const settings = useAppSettings();
  const canWrite = isAdmin || !settings?.blockSupportUserManagement;
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [active, setActive] = useState<"true" | "false" | "">("");
  const users = useAsync(() => userService.list({ search, role, active }), [search, role, active]);
  const [editing, setEditing] = useState<User | "new" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function onSaved(message: string) {
    setEditing(null);
    setNotice(message);
    void users.reload();
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Usuários</h1>
          <p>Cadastre pessoas, defina o perfil de cada uma e desative contas que não devem mais entrar.</p>
        </div>
        {canWrite && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setNotice(null);
              setEditing("new");
            }}
          >
            Cadastrar usuário
          </button>
        )}
      </div>

      {!canWrite && (
        <div className="alert alert-warn" role="status" style={{ marginBottom: 16 }}>
          O cadastro e a edição de usuários estão restritos a administradores. Você pode consultar a lista.
        </div>
      )}

      {notice && (
        <div className="alert alert-ok" role="status" style={{ marginBottom: 16 }}>
          {notice}
        </div>
      )}

      {editing && canWrite && (
        <UserForm
          key={editing === "new" ? "new" : editing.id}
          user={editing === "new" ? null : editing}
          isSelf={editing !== "new" && editing.id === me?.id}
          canGrantAdmin={isAdmin}
          onCancel={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}

      <div className="filters" role="search">
        <div className="field grow">
          <label htmlFor="u-search">Buscar</label>
          <input
            id="u-search"
            className="input"
            type="search"
            placeholder="Nome ou e-mail"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="u-role">Perfil</label>
          <select id="u-role" className="select" value={role} onChange={(e) => setRole(e.target.value as Role | "")}>
            <option value="">Todos</option>
            <option value="admin">Administrador</option>
            <option value="support">Suporte</option>
            <option value="comum">Comum</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="u-active">Situação</label>
          <select
            id="u-active"
            className="select"
            value={active}
            onChange={(e) => setActive(e.target.value as "true" | "false" | "")}
          >
            <option value="">Todas</option>
            <option value="true">Ativos</option>
            <option value="false">Desativados</option>
          </select>
        </div>
      </div>

      <ErrorAlert error={users.error} onRetry={users.reload} />
      {users.loading && !users.data ? (
        <Loading />
      ) : users.data?.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Nome</th>
                <th scope="col">E-mail</th>
                <th scope="col">Perfil</th>
                <th scope="col">Situação</th>
                <th scope="col">Cadastrado em</th>
                <th scope="col">
                  <span className="visually-hidden">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {users.data.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.name}</strong>
                    {u.id === me?.id && <span className="muted"> (você)</span>}
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <span className={u.role === "admin" ? "tag" : "tag tag-muted"}>{ROLE_LABEL[u.role]}</span>
                  </td>
                  <td>{u.active ? "Ativo" : <span className="muted">Desativado</span>}</td>
                  <td className="muted">{formatDateTime(u.createdAt)}</td>
                  <td className="num">
                    {/* O suporte não altera administradores (regra também aplicada na API). */}
                    {canWrite && (isAdmin || u.role !== "admin") && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setNotice(null);
                          setEditing(u);
                        }}
                      >
                        Editar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="panel">
          <EmptyState title="Nenhum usuário encontrado">
            <p>Ajuste a busca ou os filtros.</p>
          </EmptyState>
        </div>
      )}
    </div>
  );
}

function UserForm({
  user,
  isSelf,
  canGrantAdmin,
  onCancel,
  onSaved,
}: {
  user: User | null;
  isSelf: boolean;
  /** Só admin pode criar ou promover administradores. */
  canGrantAdmin: boolean;
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const [form, setForm] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    role: user?.role ?? ("comum" as Role),
    active: user?.active ?? true,
    password: "",
  });
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (user) {
        await userService.update(user.id, {
          name: form.name,
          email: form.email,
          role: form.role,
          active: form.active,
          ...(form.password ? { password: form.password } : {}),
        });
        onSaved(`Usuário ${form.name} atualizado.`);
      } else {
        await userService.create({ name: form.name, email: form.email, password: form.password, role: form.role });
        onSaved(`Usuário ${form.name} cadastrado.`);
      }
    } catch (err) {
      setError(err as ApiError);
      setSaving(false);
    }
  }

  return (
    <form className="panel form" onSubmit={onSubmit} style={{ marginBottom: 16 }} noValidate>
      <div className="panel-head">
        <h2>{user ? `Editar ${user.name}` : "Cadastrar usuário"}</h2>
      </div>
      <ErrorAlert error={error && !error.details.length ? error : null} />
      <div className="form-row">
        <Field label="Nome" error={error?.fieldError("name")}>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
        </Field>
        <Field label="E-mail" error={error?.fieldError("email")}>
          <input
            className="input"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
      </div>
      <div className="form-row">
        <Field
          label="Perfil"
          hint={isSelf ? "Você não pode alterar o seu próprio perfil de acesso." : undefined}
          error={error?.fieldError("role")}
        >
          <select
            className="select"
            value={form.role}
            disabled={isSelf}
            onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
          >
            <option value="comum">Comum: abre e acompanha os próprios chamados</option>
            <option value="support">Suporte: assume chamados sem responsável e ajusta prioridade e categoria</option>
            {canGrantAdmin && <option value="admin">Administrador: atende chamados e gerencia o sistema</option>}
          </select>
        </Field>
        <Field
          label={user ? "Nova senha" : "Senha"}
          hint={user ? "Deixe em branco para manter a senha atual." : "Pelo menos 8 caracteres."}
          error={error?.fieldError("password")}
        >
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
      </div>
      {user && !isSelf && (
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
          Conta ativa (desmarque para bloquear o acesso)
        </label>
      )}
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Salvando…" : user ? "Salvar alterações" : "Cadastrar usuário"}
        </button>
      </div>
    </form>
  );
}
