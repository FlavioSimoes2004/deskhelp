const TOKEN_KEY = "deskhelp.token";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details: { field: string; message: string }[] = [],
  ) {
    super(message);
  }

  /** Mensagem de erro de um campo específico, para mostrar ao lado do input. */
  fieldError(field: string): string | undefined {
    return this.details.find((d) => d.field === field)?.message;
  }
}

export const tokenStore = {
  get: (): string | null => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token: string) => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* sem armazenamento: a sessão dura até recarregar a página */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignorado */
    }
  },
};

/** Disparado quando a API responde 401, para o AuthContext encerrar a sessão. */
export const SESSION_EXPIRED_EVENT = "deskhelp:session-expired";

type Query = Record<string, string | number | boolean | null | undefined>;

function buildUrl(path: string, query?: Query) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return `/api${path}${qs ? `?${qs}` : ""}`;
}

async function request<T>(method: string, path: string, options: { body?: unknown; query?: Query } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Sem conexão com o servidor. Verifique se a API está rodando.");
  }

  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = payload?.error ?? {};
    if (response.status === 401 && token) window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    throw new ApiError(
      response.status,
      error.code ?? "HTTP_ERROR",
      error.message ?? `Erro ${response.status}`,
      error.details ?? [],
    );
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>("GET", path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, { body }),
  delete: (path: string) => request<void>("DELETE", path),
  /** Baixa um arquivo autenticado (ex. CSV) e dispara o download no navegador. */
  async download(path: string, query: Query, fallbackName: string) {
    const token = tokenStore.get();
    const response = await fetch(buildUrl(path, query), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new ApiError(response.status, payload?.error?.code ?? "HTTP_ERROR", payload?.error?.message ?? "Falha no download");
    }
    const name = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "")?.[1] ?? fallbackName;
    const url = URL.createObjectURL(await response.blob());
    const link = Object.assign(document.createElement("a"), { href: url, download: name });
    link.click();
    URL.revokeObjectURL(url);
  },
};
