import { useState, type FormEvent } from "react";
import { EmptyState, ErrorAlert, Loading } from "../components/Feedback";
import { Field } from "../components/Field";
import { useAsync } from "../hooks/useAsync";
import { ApiError } from "../services/api";
import { machineService, userService } from "../services/deskhelp";
import type { Machine, User } from "../services/types";
import { formatDateTime } from "../utils/format";

export function MachinesPage() {
  const [search, setSearch] = useState("");
  const machines = useAsync(() => machineService.list(search), [search]);
  const users = useAsync(() => userService.list(), []);
  const [editing, setEditing] = useState<Machine | "new" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function onSaved(message: string) {
    setEditing(null);
    setNotice(message);
    void machines.reload();
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Máquinas</h1>
          <p>Cadastre as máquinas pelo endereço MAC, registre o IP e quem está com cada uma.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setNotice(null);
            setEditing("new");
          }}
        >
          Cadastrar máquina
        </button>
      </div>

      {notice && (
        <div className="alert alert-ok" role="status" style={{ marginBottom: 16 }}>
          {notice}
        </div>
      )}

      {editing && (
        <MachineForm
          key={editing === "new" ? "new" : editing.id}
          machine={editing === "new" ? null : editing}
          users={users.data ?? []}
          onCancel={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}

      <div className="filters" role="search">
        <div className="field grow">
          <label htmlFor="m-search">Buscar</label>
          <input
            id="m-search"
            className="input"
            type="search"
            placeholder="MAC, IP ou nome do usuário"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <ErrorAlert error={machines.error} onRetry={machines.reload} />
      {machines.loading && !machines.data ? (
        <Loading />
      ) : machines.data?.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Endereço MAC</th>
                <th scope="col">IP</th>
                <th scope="col">Usuário</th>
                <th scope="col">Atualizado em</th>
                <th scope="col">
                  <span className="visually-hidden">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {machines.data.map((m) => (
                <tr key={m.id}>
                  <td>
                    <strong>{m.macAddress}</strong>
                  </td>
                  <td>{m.ipAddress ?? <span className="muted">Sem IP</span>}</td>
                  <td>{m.userName ?? <span className="muted">Sem usuário</span>}</td>
                  <td className="muted">{formatDateTime(m.updatedAt)}</td>
                  <td className="num">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setNotice(null);
                        setEditing(m);
                      }}
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="panel">
          <EmptyState title="Nenhuma máquina encontrada">
            <p>{search ? "Ajuste a busca." : "Cadastre a primeira máquina."}</p>
          </EmptyState>
        </div>
      )}
    </div>
  );
}

function MachineForm({
  machine,
  users,
  onCancel,
  onSaved,
}: {
  machine: Machine | null;
  users: User[];
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const [form, setForm] = useState({
    macAddress: machine?.macAddress ?? "",
    ipAddress: machine?.ipAddress ?? "",
    userId: machine?.userId ? String(machine.userId) : "",
  });
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);

  // Usuários desativados só aparecem se já estiverem com esta máquina.
  const options = users.filter((u) => u.active || u.id === machine?.userId);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const data = {
      macAddress: form.macAddress,
      ipAddress: form.ipAddress.trim() || null,
      userId: form.userId ? Number(form.userId) : null,
    };
    try {
      if (machine) {
        const saved = await machineService.update(machine.id, data);
        onSaved(`Máquina ${saved.macAddress} atualizada.`);
      } else {
        const saved = await machineService.create(data);
        onSaved(`Máquina ${saved.macAddress} cadastrada.`);
      }
    } catch (err) {
      setError(err as ApiError);
      setSaving(false);
    }
  }

  return (
    <form className="panel form" onSubmit={onSubmit} style={{ marginBottom: 16 }} noValidate>
      <div className="panel-head">
        <h2>{machine ? `Editar ${machine.macAddress}` : "Cadastrar máquina"}</h2>
      </div>
      <ErrorAlert error={error && !error.details.length ? error : null} />
      <div className="form-row">
        <Field label="Endereço MAC" hint="Ex.: AA:BB:CC:DD:EE:FF" error={error?.fieldError("macAddress")}>
          <input
            className="input"
            value={form.macAddress}
            onChange={(e) => setForm({ ...form, macAddress: e.target.value })}
            autoFocus
            spellCheck={false}
          />
        </Field>
        <Field label="Endereço IP" hint="IPv4 ou IPv6. Deixe em branco se não houver." error={error?.fieldError("ipAddress")}>
          <input
            className="input"
            value={form.ipAddress}
            onChange={(e) => setForm({ ...form, ipAddress: e.target.value })}
            spellCheck={false}
          />
        </Field>
      </div>
      <Field label="Usuário" error={error?.fieldError("userId")}>
        <select className="select" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}>
          <option value="">Sem usuário</option>
          {options.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.email}){u.active ? "" : " - desativado"}
            </option>
          ))}
        </select>
      </Field>
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Salvando…" : machine ? "Salvar alterações" : "Cadastrar máquina"}
        </button>
      </div>
    </form>
  );
}
