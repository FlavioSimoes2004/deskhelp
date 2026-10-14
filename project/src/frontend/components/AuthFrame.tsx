import type { CSSProperties, ReactNode } from "react";
import { LogoMark } from "./Logo";

const SAMPLE = [
  { id: 128, status: "em_andamento", title: "VPN não conecta no home office", meta: "Rede e internet" },
  { id: 127, status: "aguardando", title: "Instalar o leitor de PDF atualizado", meta: "Software" },
  { id: 126, status: "resolvido", title: "Impressora do 2º andar sem toner", meta: "Impressoras" },
] as const;

/** Moldura das telas de login e cadastro: painel escuro com chamados de exemplo + formulário. */
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="auth">
      <aside className="auth-aside">
        <div className="brand">
          <LogoMark />
          DeskHelp
        </div>
        <div className="stub-stack" aria-hidden="true">
          {SAMPLE.map((t) => (
            <div key={t.id} className="stub" style={{ "--stub-color": `var(--st-${t.status})` } as CSSProperties}>
              <div className="stub-number">
                <strong>#{t.id}</strong>
              </div>
              <div className="stub-body">
                <strong>{t.title}</strong>
                <span className="muted" style={{ color: "var(--ink-3)", fontSize: "var(--step--1)" }}>
                  {t.meta}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div>
          <h2>Cada problema vira um chamado com dono.</h2>
          <p>Abra um chamado, acompanhe o andamento e converse com o suporte no mesmo lugar.</p>
        </div>
      </aside>
      <main className="auth-main">
        <div className="auth-card">{children}</div>
      </main>
    </div>
  );
}
