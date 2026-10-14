import { useEffect, useRef, useState } from "react";
import "swagger-ui-dist/swagger-ui.css";
import { ErrorAlert, Loading } from "../components/Feedback";
import { ApiError, tokenStore } from "../services/api";

/** Swagger UI renderizando a especificação OpenAPI servida pela própria API. */
export function ApiDocsPage() {
  const container = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Bundle autossuficiente (traz o próprio React; o pacote "swagger-ui" exige React 18).
    import("swagger-ui-dist/swagger-ui-bundle.js")
      .then(({ default: SwaggerUI }) => {
        if (cancelled || !container.current) return;
        SwaggerUI({
          domNode: container.current,
          url: "/api/openapi.json",
          deepLinking: false,
          docExpansion: "list",
          defaultModelsExpandDepth: 0,
          tryItOutEnabled: false,
          // Usa a sessão atual para o "Try it out", sem precisar colar o token.
          requestInterceptor: (req: { headers: Record<string, string> }) => {
            const token = tokenStore.get();
            if (token && !req.headers.Authorization) req.headers.Authorization = `Bearer ${token}`;
            return req;
          },
          onComplete: () => setLoading(false),
        });
      })
      .catch(() => {
        setError(new ApiError(0, "LOAD_ERROR", "Não foi possível carregar a documentação."));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Documentação da API</h1>
          <p>
            Todos os endpoints do DeskHelp. Use “Try it out” para testar: a sua sessão já é usada como token. A
            especificação em JSON está em <a href="/api/openapi.json">/api/openapi.json</a>.
          </p>
        </div>
      </div>
      <ErrorAlert error={error} />
      {loading && <Loading label="Carregando documentação…" />}
      <div className="docs-frame" ref={container} />
    </div>
  );
}
