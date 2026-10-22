import { settingsService } from "../services/deskhelp";
import type { AppSettings } from "../services/types";
import { useAsync } from "./useAsync";
import { useLiveRefresh } from "./useLiveRefresh";

/** Configurações da aplicação, atualizadas junto com o resto da tela. Enquanto carregam: undefined. */
export function useAppSettings(): AppSettings | undefined {
  const settings = useAsync(() => settingsService.get(), []);
  useLiveRefresh(settings.refresh);
  return settings.data;
}
