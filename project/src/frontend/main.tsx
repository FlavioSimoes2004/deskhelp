import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/global.css";
import { applyColorScheme, hasSavedColorScheme, loadColorScheme } from "./utils/theme";

// Aplica a aparência (clara/escura) e a cor escolhida antes de desenhar a tela, para não piscar.
applyColorScheme(loadColorScheme());

// Sem escolha do usuário, acompanha a aparência do sistema operacional quando ela muda.
window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
  if (!hasSavedColorScheme()) applyColorScheme(e.matches ? "dark" : "light");
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
