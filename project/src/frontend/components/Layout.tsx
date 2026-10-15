import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { useAuth } from "../hooks/useAuth";
import { initials, ROLE_LABEL } from "../utils/format";
import { LogoMark } from "./Logo";
import { NotificationBell } from "./NotificationBell";

const navClass = ({ isActive }: { isActive: boolean }) => `nav-link${isActive ? " active" : ""}`;

export function Layout() {
  const { user, isAdmin, isStaff, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  if (!user) return null;
  return (
    <div className="shell">
      <aside className={`rail${open ? " open" : ""}`}>
        <div className="rail-top">
          <Link to="/" className="brand">
            <LogoMark />
            DeskHelp
          </Link>
          <div className="rail-top-actions">
            <NotificationBell />
            <button
              type="button"
              className="btn btn-rail btn-sm menu-toggle"
              aria-expanded={open}
              aria-controls="main-nav"
              onClick={() => setOpen((v) => !v)}
            >
              Menu
            </button>
          </div>
        </div>

        <nav id="main-nav" aria-label="Principal">
          <NavLink to="/" end className={navClass}>
            Início
          </NavLink>
          <NavLink to="/chamados" end className={navClass}>
            {isStaff ? "Chamados" : "Meus chamados"}
          </NavLink>
          <NavLink to="/chamados/novo" className={navClass}>
            Abrir chamado
          </NavLink>
          {isStaff && (
            <>
              <div className="rail-group">Suporte</div>
              <NavLink to="/usuarios" className={navClass}>
                Usuários
              </NavLink>
              <NavLink to="/maquinas" className={navClass}>
                Máquinas
              </NavLink>
              <NavLink to="/api-docs" className={navClass}>
                Documentação da API
              </NavLink>
            </>
          )}
          {isAdmin && (
            <>
              <div className="rail-group">Administração</div>
              <NavLink to="/relatorios" className={navClass}>
                Relatórios
              </NavLink>
            </>
          )}
        </nav>

        <div className="rail-user">
          <span className="avatar" aria-hidden="true">
            {initials(user.name)}
          </span>
          <div className="who">
            <strong>{user.name}</strong>
            <span>{user.role === "comum" ? "Usuário" : ROLE_LABEL[user.role]}</span>
          </div>
          <NavLink to="/perfil" className={navClass} style={{ gridColumn: "1 / -1" }}>
            Meu perfil
          </NavLink>
          <button type="button" className="btn btn-rail btn-sm" onClick={logout}>
            Sair
          </button>
        </div>
      </aside>

      <main className="main" id="conteudo">
        <Outlet />
      </main>
    </div>
  );
}
