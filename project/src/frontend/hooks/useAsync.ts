import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../services/api";

/**
 * Executa uma função assíncrona quando as dependências mudam e expõe
 * data/error/loading. `reload` repete a chamada (ex. depois de salvar).
 * `refresh` repete em segundo plano: troca os dados sem mostrar carregamento
 * e ignora falhas (para atualizações automáticas).
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setDataState] = useState<T | undefined>(undefined);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const latest = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);

  // Dados vindos de uma ação (ex.: salvar) valem mais que uma busca que ainda está em
  // andamento: avançar o contador faz essa busca ser descartada ao terminar.
  const setData = useCallback((value: T) => {
    latest.current++;
    setDataState(value);
  }, []);

  const reload = useCallback(async () => {
    const call = ++latest.current;
    setLoading(true);
    setError(null);
    try {
      const result = await run();
      if (call === latest.current) setDataState(result);
    } catch (err) {
      if (call === latest.current) {
        setError(err instanceof ApiError ? err : new ApiError(0, "UNKNOWN", "Algo deu errado. Tente novamente."));
      }
    } finally {
      if (call === latest.current) setLoading(false);
    }
  }, [run]);

  const refresh = useCallback(async () => {
    const call = ++latest.current;
    try {
      const result = await run();
      if (call === latest.current) {
        setDataState(result);
        setError(null);
      }
    } catch {
      /* falha momentânea: mantém os dados atuais e tenta de novo na próxima vez */
    }
  }, [run]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload, refresh, setData };
}
