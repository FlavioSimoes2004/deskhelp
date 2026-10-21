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

/**
 * Disparado quando a API responde 401, para o AuthContext encerrar a sessão.
 * É um CustomEvent cujo detail é o código do erro (ex.: "SESSION_REPLACED").
 */
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
  // FormData define o próprio Content-Type (multipart com boundary).
  const isForm = options.body instanceof FormData;
  if (options.body !== undefined && !isForm) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      body: options.body === undefined ? undefined : isForm ? (options.body as FormData) : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Sem conexão com o servidor. Verifique se a API está rodando.");
  }

  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = payload?.error ?? {};
    if (response.status === 401 && token) {
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: error.code ?? "UNAUTHORIZED" }));
    }
    throw new ApiError(
      response.status,
      error.code ?? "HTTP_ERROR",
      error.message ?? `Erro ${response.status}`,
      error.details ?? [],
    );
  }
  return payload as T;
}

/** Busca um arquivo autenticado; erros da API viram ApiError. */
async function fetchFile(path: string, query: Query = {}): Promise<Response> {
  const token = tokenStore.get();
  const response = await fetch(buildUrl(path, query), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiError(response.status, payload?.error?.code ?? "HTTP_ERROR", payload?.error?.message ?? "Falha no download");
  }
  return response;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>("GET", path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, { body }),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, { body }),
  /** Envia multipart/form-data (ex. comentário com anexos). */
  postForm: <T>(path: string, form: FormData) => request<T>("POST", path, { body: form }),
  delete: (path: string) => request<void>("DELETE", path),
  /** Baixa um arquivo autenticado (ex. CSV) e dispara o download no navegador. */
  /** Conteúdo de um arquivo autenticado (ex. imagem para pré-visualizar). */
  blob: async (path: string) => (await fetchFile(path)).blob(),
  async download(path: string, query: Query, fallbackName: string) {
    const response = await fetchFile(path, query);
    const disposition = response.headers.get("Content-Disposition") ?? "";
    // Prefere filename* (UTF-8), que preserva acentos no nome do arquivo.
    const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
    const name = encoded
      ? decodeURIComponent(encoded)
      : (/filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackName);
    const url = URL.createObjectURL(await response.blob());
    const link = Object.assign(document.createElement("a"), { href: url, download: name });
    link.click();
    URL.revokeObjectURL(url);
  },
};
