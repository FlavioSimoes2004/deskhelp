import type { StorageType } from "../models/types.js";

export interface MachineEditableFields {
  name: string | null;
  macAddress: string;
  ipAddress: string | null;
  description: string | null;
  ramGb: number | null;
  ramType: string | null;
  cpu: string | null;
  storageGb: number | null;
  storageType: StorageType | null;
  gpu: string | null;
  userId: number | null;
}

/** Máquina sem nada preenchido além do MAC: base para registrar os valores do cadastro. */
const EMPTY: Omit<MachineEditableFields, "macAddress"> = {
  name: null,
  ipAddress: null,
  description: null,
  ramGb: null,
  ramType: null,
  cpu: null,
  storageGb: null,
  storageType: null,
  gpu: null,
  userId: null,
};

export interface MachineChange {
  field: keyof MachineEditableFields | "created";
  oldValue: string | null;
  newValue: string | null;
}

const asText = (value: string | number | null): string | null => (value === null ? null : String(value));

/** Lista os campos que realmente mudam, para gravar no histórico. */
export function diffMachine(current: MachineEditableFields, patch: Partial<MachineEditableFields>): MachineChange[] {
  const changes: MachineChange[] = [];
  for (const field of Object.keys(patch) as (keyof MachineEditableFields)[]) {
    const next = patch[field];
    if (next === undefined || next === current[field]) continue;
    changes.push({ field, oldValue: asText(current[field]), newValue: asText(next) });
  }
  return changes;
}

/** Entradas do cadastro: o evento "created" e os valores iniciais preenchidos. */
export function creationEntries(data: MachineEditableFields): MachineChange[] {
  const { macAddress, ...initial } = data;
  return [
    { field: "created", oldValue: null, newValue: macAddress },
    ...diffMachine({ macAddress, ...EMPTY }, initial),
  ];
}
