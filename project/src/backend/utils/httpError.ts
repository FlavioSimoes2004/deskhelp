/** Erro com status HTTP e código legível por máquina, tratado pelo errorHandler. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: { field: string; message: string }[],
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const notFound = (message = "Recurso não encontrado") => new HttpError(404, "NOT_FOUND", message);
export const forbidden = (message = "Você não tem permissão para esta ação") =>
  new HttpError(403, "FORBIDDEN", message);
