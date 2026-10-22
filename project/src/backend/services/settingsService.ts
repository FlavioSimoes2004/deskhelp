import * as settings from "../models/settingsModel.js";
import type { AuthUser } from "../models/types.js";
import { parseSettings, serializeSetting, SETTING_KEYS, type AppSettings } from "./settingsRules.js";

/** Lidas a cada uso: uma mudança vale na hora, sem reiniciar a API. */
export async function getSettings(): Promise<AppSettings> {
  return parseSettings(await settings.readSettingRows());
}

export async function updateSettings(actor: AuthUser, patch: Partial<AppSettings>): Promise<AppSettings> {
  const values: Record<string, string> = {};
  for (const key of Object.keys(patch) as (keyof AppSettings)[]) {
    const value = patch[key];
    if (value === undefined) continue;
    values[SETTING_KEYS[key]] = serializeSetting(value);
  }
  await settings.writeSettings(values, actor.id);
  return getSettings();
}
