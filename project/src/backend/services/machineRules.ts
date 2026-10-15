export interface MachineEditableFields {
  macAddress: string;
  ipAddress: string | null;
  description: string | null;
  userId: number | null;
}

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
  return [
    { field: "created", oldValue: null, newValue: data.macAddress },
    ...diffMachine({ macAddress: data.macAddress, ipAddress: null, description: null, userId: null }, {
      ipAddress: data.ipAddress,
      description: data.description,
      userId: data.userId,
    }),
  ];
}
