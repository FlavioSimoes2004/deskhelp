import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../services/api";

/**
 * Executa uma função assíncrona quando as dependências mudam e expõe
 * data/error/loading. `reload` repete a chamada (ex. depois de salvar).
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const latest = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);

  const reload = useCallback(async () => {
    const call = ++latest.current;
    setLoading(true);
    setError(null);
    try {
      const result = await run();
      if (call === latest.current) setData(result);
    } catch (err) {
      if (call === latest.current) {
        setError(err instanceof ApiError ? err : new ApiError(0, "UNKNOWN", "Algo deu errado. Tente novamente."));
      }
    } finally {
      if (call === latest.current) setLoading(false);
    }
  }, [run]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload, setData };
}
