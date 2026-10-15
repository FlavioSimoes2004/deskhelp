import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/global.css";
import { applyAccent, loadAccent } from "./utils/theme";

// Aplica a cor escolhida antes de desenhar a tela, para não piscar a cor padrão.
applyAccent(loadAccent());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
