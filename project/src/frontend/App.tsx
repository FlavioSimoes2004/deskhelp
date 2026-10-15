import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import { Loading } from "./components/Feedback";
import { Layout } from "./components/Layout";
import { RequireAuth } from "./components/RequireAuth";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { MachinesPage } from "./pages/MachinesPage";
import { NewTicketPage } from "./pages/NewTicketPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SignupPage } from "./pages/SignupPage";
import { TicketDetailPage } from "./pages/TicketDetailPage";
import { TicketsPage } from "./pages/TicketsPage";
import { UsersPage } from "./pages/UsersPage";
import { ReportsPage } from "./pages/ReportsPage";
import { AuthProvider } from "./store/AuthContext";

// O Swagger UI é pesado; só é baixado quando alguém abre a documentação.
const ApiDocsPage = lazy(() => import("./pages/ApiDocsPage").then((m) => ({ default: m.ApiDocsPage })));

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/cadastro" element={<SignupPage />} />
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route index element={<HomePage />} />
            <Route path="chamados" element={<TicketsPage />} />
            <Route path="chamados/novo" element={<NewTicketPage />} />
            <Route path="chamados/:id" element={<TicketDetailPage />} />
            <Route path="perfil" element={<ProfilePage />} />
            <Route
              path="api-docs"
              element={
                <Suspense fallback={<Loading />}>
                  <ApiDocsPage />
                </Suspense>
              }
            />
            <Route
              path="usuarios"
              element={
                <RequireAuth staff>
                  <UsersPage />
                </RequireAuth>
              }
            />
            <Route
              path="maquinas"
              element={
                <RequireAuth staff>
                  <MachinesPage />
                </RequireAuth>
              }
            />
            <Route
              path="relatorios"
              element={
                <RequireAuth admin>
                  <ReportsPage />
                </RequireAuth>
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
