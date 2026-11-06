import * as settings from "../models/settingsModel.js";
import type { AuthUser } from "../models/types.js";
import { parseSettings, serializeSetting, SETTING_KEYS, type AppSettings } from "./settingsRules.js";

/**
 * Guardadas na memória do servidor: evita ler o banco a cada requisição. Ao salvar, a cópia é
 * trocada na hora; a cada CACHE_MS ela é relida (cobre mudanças feitas direto no banco).
 */
const CACHE_MS = 30_000;
let cached: { value: AppSettings; at: number } | null = null;
let pending: Promise<AppSettings> | null = null;
/** Muda a cada gravação: uma leitura iniciada antes dela não substitui a cópia nova. */
let version = 0;

export async function getSettings(): Promise<AppSettings> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  // Requisições simultâneas compartilham a mesma leitura.
  const started = version;
  pending ??= settings
    .readSettingRows()
    .then((rows) => {
      const value = parseSettings(rows);
      if (started === version) cached = { value, at: Date.now() };
      return value;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

export async function updateSettings(actor: AuthUser, patch: Partial<AppSettings>): Promise<AppSettings> {
  const values: Record<string, string> = {};
  for (const key of Object.keys(patch) as (keyof AppSettings)[]) {
    const value = patch[key];
    if (value === undefined) continue;
    values[SETTING_KEYS[key]] = serializeSetting(value);
  }
  await settings.writeSettings(values, actor.id);
  version++;
  cached = null;
  pending = null;
  return getSettings();
}
