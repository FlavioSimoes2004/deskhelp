import * as machines from "../models/machineModel.js";
import type { Machine } from "../models/types.js";
import { findUserById } from "../models/userModel.js";
import { HttpError, notFound } from "../utils/httpError.js";

export const listMachines = machines.listMachines;

export async function getMachine(id: number): Promise<Machine> {
  const machine = await machines.findMachineById(id);
  if (!machine) throw notFound("Máquina não encontrada");
  return machine;
}

async function assertMacAvailable(macAddress: string, exceptId?: number) {
  const other = await machines.findMachineByMac(macAddress);
  if (other && other.id !== exceptId) {
    throw new HttpError(409, "MAC_IN_USE", "Já existe uma máquina com este endereço MAC", [
      { field: "macAddress", message: "Já existe uma máquina com este endereço MAC" },
    ]);
  }
}

async function assertUser(userId: number | null | undefined) {
  if (userId == null) return;
  if (!(await findUserById(userId))) {
    throw new HttpError(400, "VALIDATION_ERROR", "Usuário inválido", [{ field: "userId", message: "Usuário inválido" }]);
  }
}

export async function createMachine(data: machines.MachineFields) {
  await assertMacAvailable(data.macAddress);
  await assertUser(data.userId);
  return getMachine(await machines.insertMachine(data));
}

export async function updateMachine(id: number, data: Partial<machines.MachineFields>) {
  await getMachine(id);
  if (data.macAddress) await assertMacAvailable(data.macAddress, id);
  await assertUser(data.userId);
  await machines.updateMachine(id, data);
  return getMachine(id);
}
