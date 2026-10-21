import { useEffect, useState, type FormEvent } from "react";
import { EmptyState, ErrorAlert, Loading } from "../components/Feedback";
import { Field } from "../components/Field";
import { useAsync } from "../hooks/useAsync";
import { ApiError } from "../services/api";
import { machineService, userService, type MachineFilters } from "../services/deskhelp";
import type { Machine, MachineHistoryEntry, StorageType, User } from "../services/types";
import { formatDateTime, timeAgo } from "../utils/format";
import { formatGb, machineLabel, machineSpecs, STORAGE_LABEL } from "../utils/machine";

const NO_FILTERS = {
  search: "",
  name: "",
  cpu: "",
  gpu: "",
  ramType: "",
  ramGbMin: "",
  storageGbMin: "",
  storageType: "",
};
type FilterForm = typeof NO_FILTERS;

export function MachinesPage() {
  // O que está nos campos; a busca roda 300 ms depois da última digitação.
  const [draft, setDraft] = useState<FilterForm>(NO_FILTERS);
  const [filters, setFilters] = useState<FilterForm>(NO_FILTERS);
  useEffect(() => {
    const timer = setTimeout(() => setFilters(draft), 300);
    return () => clearTimeout(timer);
  }, [draft]);
  const query: MachineFilters = {
    ...filters,
    ramGbMin: filters.ramGbMin ? Number(filters.ramGbMin) : "",
    storageGbMin: filters.storageGbMin ? Number(filters.storageGbMin) : "",
    storageType: filters.storageType as MachineFilters["storageType"],
  };
  const machines = useAsync(() => machineService.list(query), [JSON.stringify(filters)]);
  const hasFilters = Object.values(draft).some(Boolean);
  const set = (key: keyof FilterForm) => (e: { target: { value: string } }) => setDraft({ ...draft, [key]: e.target.value });
  const users = useAsync(() => userService.list(), []);
  const [editing, setEditing] = useState<Machine | "new" | null>(null);
  const [historyOf, setHistoryOf] = useState<Machine | null>(null);
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
          <p>Cadastre as máquinas com nome, endereço MAC, IP, configuração e quem está com cada uma.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setNotice(null);
            setHistoryOf(null);
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

      {historyOf && (
        <MachineHistory
          key={historyOf.id}
          machine={historyOf}
          users={users.data ?? []}
          onClose={() => setHistoryOf(null)}
        />
      )}

      <div className="filters" role="search">
        <div className="field grow">
          <label htmlFor="m-search">Buscar</label>
          <input
            id="m-search"
            className="input"
            type="search"
            placeholder="Nome, MAC, IP, descrição, configuração ou usuário"
            value={draft.search}
            onChange={set("search")}
          />
        </div>
        <div className="field">
          <label htmlFor="m-name">Nome</label>
          <input id="m-name" className="input" type="search" value={draft.name} onChange={set("name")} />
        </div>
        <div className="field">
          <label htmlFor="m-cpu">Processador</label>
          <input id="m-cpu" className="input" type="search" placeholder="Ex.: i5" value={draft.cpu} onChange={set("cpu")} />
        </div>
        <div className="field">
          <label htmlFor="m-gpu">Placa de vídeo</label>
          <input id="m-gpu" className="input" type="search" value={draft.gpu} onChange={set("gpu")} />
        </div>
      </div>
      <div className="filters">
        <div className="field">
          <label htmlFor="m-ram-type">Tipo de memória</label>
          <input
            id="m-ram-type"
            className="input"
            type="search"
            placeholder="Ex.: DDR4"
            value={draft.ramType}
            onChange={set("ramType")}
          />
        </div>
        <div className="field">
          <label htmlFor="m-ram">RAM mínima (GB)</label>
          <input
            id="m-ram"
            className="input"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={draft.ramGbMin}
            onChange={set("ramGbMin")}
          />
        </div>
        <div className="field">
          <label htmlFor="m-storage">Armazenamento mínimo (GB)</label>
          <input
            id="m-storage"
            className="input"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={draft.storageGbMin}
            onChange={set("storageGbMin")}
          />
        </div>
        <div className="field">
          <label htmlFor="m-storage-type">Tipo de armazenamento</label>
          <select id="m-storage-type" className="select" value={draft.storageType} onChange={set("storageType")}>
            <option value="">Todos</option>
            <option value="ssd">SSD</option>
            <option value="hd">HD</option>
          </select>
        </div>
        {hasFilters && (
          <button type="button" className="btn btn-ghost" onClick={() => setDraft(NO_FILTERS)}>
            Limpar filtros
          </button>
        )}
      </div>

      <ErrorAlert error={machines.error} onRetry={machines.reload} />
      {machines.loading && !machines.data ? (
        <Loading />
      ) : machines.data?.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Máquina</th>
                <th scope="col">IP</th>
                <th scope="col">Configuração</th>
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
                    <strong>{m.name ?? m.macAddress}</strong>
                    {(m.name || m.description) && (
                      <span className="muted" style={{ display: "block" }}>
                        {[m.name ? m.macAddress : null, m.description].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </td>
                  <td>{m.ipAddress ?? <span className="muted">Sem IP</span>}</td>
                  <td>{machineSpecs(m) ?? <span className="muted">Não informada</span>}</td>
                  <td>{m.userName ?? <span className="muted">Sem usuário</span>}</td>
                  <td className="muted">{formatDateTime(m.updatedAt)}</td>
                  <td className="num">
                    <div style={{ display: "inline-flex", gap: 8 }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        aria-pressed={historyOf?.id === m.id}
                        onClick={() => {
                          setEditing(null);
                          setHistoryOf(historyOf?.id === m.id ? null : m);
                        }}
                      >
                        Histórico
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setNotice(null);
                          setHistoryOf(null);
                          setEditing(m);
                        }}
                      >
                        Editar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="panel">
          <EmptyState title="Nenhuma máquina encontrada">
            <p>{hasFilters ? "Ajuste a busca ou os filtros." : "Cadastre a primeira máquina."}</p>
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
    name: machine?.name ?? "",
    macAddress: machine?.macAddress ?? "",
    ipAddress: machine?.ipAddress ?? "",
    description: machine?.description ?? "",
    ramGb: machine?.ramGb ? String(machine.ramGb) : "",
    ramType: machine?.ramType ?? "",
    cpu: machine?.cpu ?? "",
    storageGb: machine?.storageGb ? String(machine.storageGb) : "",
    storageType: (machine?.storageType ?? "") as StorageType | "",
    gpu: machine?.gpu ?? "",
    userId: machine?.userId ? String(machine.userId) : "",
  });
  const text = (value: string) => value.trim() || null;
  const number = (value: string) => (value.trim() ? Number(value) : null);
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);

  // Usuários desativados só aparecem se já estiverem com esta máquina.
  const options = users.filter((u) => u.active || u.id === machine?.userId);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const data = {
      name: text(form.name),
      macAddress: form.macAddress,
      ipAddress: text(form.ipAddress),
      description: text(form.description),
      ramGb: number(form.ramGb),
      ramType: text(form.ramType),
      cpu: text(form.cpu),
      storageGb: number(form.storageGb),
      storageType: form.storageType || null,
      gpu: text(form.gpu),
      userId: form.userId ? Number(form.userId) : null,
    };
    try {
      if (machine) {
        const saved = await machineService.update(machine.id, data);
        onSaved(`Máquina ${machineLabel(saved)} atualizada.`);
      } else {
        const saved = await machineService.create(data);
        onSaved(`Máquina ${machineLabel(saved)} cadastrada.`);
      }
    } catch (err) {
      setError(err as ApiError);
      setSaving(false);
    }
  }

  return (
    <form className="panel form" onSubmit={onSubmit} style={{ marginBottom: 16 }} noValidate>
      <div className="panel-head">
        <h2>{machine ? `Editar ${machineLabel(machine)}` : "Cadastrar máquina"}</h2>
      </div>
      <ErrorAlert error={error && !error.details.length ? error : null} />
      <div className="form-row">
        <Field label="Nome" hint="Ex.: RECEPCAO-01. Opcional." error={error?.fieldError("name")}>
          <input
            className="input"
            value={form.name}
            maxLength={80}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            autoFocus
          />
        </Field>
        <Field label="Endereço MAC" hint="Ex.: AA:BB:CC:DD:EE:FF" error={error?.fieldError("macAddress")}>
          <input
            className="input"
            value={form.macAddress}
            onChange={(e) => setForm({ ...form, macAddress: e.target.value })}
            spellCheck={false}
          />
        </Field>
      </div>
      <div className="form-row">
        <Field label="Endereço IP" hint="IPv4 ou IPv6. Deixe em branco se não houver." error={error?.fieldError("ipAddress")}>
          <input
            className="input"
            value={form.ipAddress}
            onChange={(e) => setForm({ ...form, ipAddress: e.target.value })}
            spellCheck={false}
          />
        </Field>
        <Field
          label="Descrição"
          hint="Ex.: Notebook da recepção. Deixe em branco se não houver."
          error={error?.fieldError("description")}
        >
          <input
            className="input"
            value={form.description}
            maxLength={255}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
      </div>

      <fieldset className="fieldset">
        <legend>Configuração (opcional)</legend>
        <div className="form-row">
          <Field label="Memória RAM (GB)" error={error?.fieldError("ramGb")}>
            <input
              className="input"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={form.ramGb}
              onChange={(e) => setForm({ ...form, ramGb: e.target.value })}
            />
          </Field>
          <Field label="Tipo de memória" hint="Ex.: DDR4 3200 MHz" error={error?.fieldError("ramType")}>
            <input
              className="input"
              value={form.ramType}
              maxLength={120}
              onChange={(e) => setForm({ ...form, ramType: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Processador" hint="Ex.: Intel Core i5-10400" error={error?.fieldError("cpu")}>
          <input className="input" value={form.cpu} maxLength={120} onChange={(e) => setForm({ ...form, cpu: e.target.value })} />
        </Field>
        <div className="form-row">
          <Field label="Armazenamento (GB)" hint="Ex.: 512 ou 1024 (1 TB)" error={error?.fieldError("storageGb")}>
            <input
              className="input"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={form.storageGb}
              onChange={(e) => setForm({ ...form, storageGb: e.target.value })}
            />
          </Field>
          <Field label="Tipo de armazenamento" error={error?.fieldError("storageType")}>
            <select
              className="select"
              value={form.storageType}
              onChange={(e) => setForm({ ...form, storageType: e.target.value as StorageType | "" })}
            >
              <option value="">Não informado</option>
              <option value="ssd">SSD</option>
              <option value="hd">HD</option>
            </select>
          </Field>
        </div>
        <Field label="Placa de vídeo" hint="Ex.: NVIDIA GeForce GTX 1650 ou integrada" error={error?.fieldError("gpu")}>
          <input className="input" value={form.gpu} maxLength={120} onChange={(e) => setForm({ ...form, gpu: e.target.value })} />
        </Field>
      </fieldset>
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

/** Rótulo e formatação do valor de cada campo de texto/configuração no histórico. */
const FIELD_TEXT: Partial<Record<MachineHistoryEntry["field"], { label: string; format?: (v: string) => string }>> = {
  name: { label: "o nome" },
  ramGb: { label: "a memória RAM", format: (v) => formatGb(Number(v)) },
  ramType: { label: "o tipo de memória" },
  cpu: { label: "o processador" },
  storageGb: { label: "o armazenamento", format: (v) => formatGb(Number(v)) },
  storageType: { label: "o tipo de armazenamento", format: (v) => STORAGE_LABEL[v as StorageType] ?? v },
  gpu: { label: "a placa de vídeo" },
};

function describeMachineChange(entry: MachineHistoryEntry, users: User[]): string {
  const userName = (id: string) => users.find((u) => String(u.id) === id)?.name ?? `usuário #${id}`;
  const { oldValue: from, newValue: to } = entry;
  const field = FIELD_TEXT[entry.field];
  if (field) {
    const show = (v: string) => `“${field.format ? field.format(v) : v}”`;
    if (!from) return `definiu ${field.label} como ${show(to ?? "")}`;
    if (!to) return `removeu ${field.label} ${show(from)}`;
    return `alterou ${field.label} de ${show(from)} para ${show(to)}`;
  }
  switch (entry.field) {
    case "created":
      return `cadastrou a máquina com o MAC ${to}`;
    case "macAddress":
      return `alterou o MAC de ${from} para ${to}`;
    case "description":
      if (!from) return `definiu a descrição como “${to}”`;
      if (!to) return `removeu a descrição “${from}”`;
      return `alterou a descrição de “${from}” para “${to}”`;
    case "ipAddress":
      if (!from) return `definiu o IP como ${to}`;
      if (!to) return `removeu o IP ${from}`;
      return `alterou o IP de ${from} para ${to}`;
    case "userId":
      if (!from) return `entregou a máquina para ${userName(to ?? "")}`;
      if (!to) return `retirou a máquina de ${userName(from)}`;
      return `passou a máquina de ${userName(from)} para ${userName(to)}`;
    default:
      return `alterou ${entry.field}`;
  }
}

function MachineHistory({ machine, users, onClose }: { machine: Machine; users: User[]; onClose: () => void }) {
  const history = useAsync(() => machineService.history(machine.id), [machine.id]);

  return (
    <section className="panel" aria-labelledby="machine-history-title" style={{ marginBottom: 16 }}>
      <div className="panel-head">
        <h2 id="machine-history-title">Histórico de {machineLabel(machine)}</h2>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          Fechar
        </button>
      </div>
      <ErrorAlert error={history.error} onRetry={history.reload} />
      {history.loading && !history.data ? (
        <Loading />
      ) : history.data?.length ? (
        <ol className="timeline">
          {history.data.map((h) => (
            <li key={h.id}>
              <span className="event-dot" aria-hidden="true" />
              <span className="event" title={formatDateTime(h.createdAt)}>
                <strong>{h.userName}</strong> {describeMachineChange(h, users)}, {timeAgo(h.createdAt)} (
                {formatDateTime(h.createdAt)})
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">Nenhuma alteração registrada.</p>
      )}
    </section>
  );
}
