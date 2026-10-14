declare module "swagger-ui-dist/swagger-ui-bundle.js" {
  interface SwaggerUIOptions {
    domNode: HTMLElement;
    url: string;
    deepLinking?: boolean;
    docExpansion?: "list" | "full" | "none";
    defaultModelsExpandDepth?: number;
    tryItOutEnabled?: boolean;
    requestInterceptor?: (req: { headers: Record<string, string> }) => unknown;
    onComplete?: () => void;
  }
  export default function SwaggerUI(options: SwaggerUIOptions): unknown;
}
