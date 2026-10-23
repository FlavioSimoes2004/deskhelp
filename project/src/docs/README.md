# DeskHelp

Sistema de chamados (help desk): usuários abrem chamados e a equipe de suporte (administradores) atende, muda o status, define responsável e acompanha os relatórios.

- **Banco:** MariaDB
- **Backend:** Node.js + Express 5 + TypeScript (`src/backend`)
- **Frontend:** React 19 + React Router + Vite + TypeScript (`src/frontend`)
- **Documentação da API:** OpenAPI 3.1 em [`openapi.yaml`](openapi.yaml), exibida no app em `/api-docs`

## Perfis de acesso

| Perfil | Pode |
| --- | --- |
| **Comum** | Abrir chamados, ver e comentar apenas os próprios chamados, avaliar o atendimento, usar a agenda, editar o próprio perfil e senha |
| **Administrador** (`admin`) | **Vê todos os chamados** (só leitura: não atende, não altera e só comenta nos que abriu; não vê notas internas). De resto, as restrições do comum (sem Usuários e Máquinas) + as páginas de **Administração**: relatórios e Configurações |
| **Suporte** | Tudo do comum + ver todos os chamados, assumir um chamado sem responsável (status vai para "em andamento" se estava aberto), alterar prioridade, categoria e máquina, notas internas. Não altera status nem troca um responsável já definido. Gerencia usuários comuns e de suporte (sem criar, promover ou alterar administradores e super supports) e máquinas |
| **Super support** (`super_support`) | Acesso total: tudo do suporte sem as restrições dele (alterar status e responsável, assumir qualquer chamado, gerenciar qualquer usuário), Administração e o grupo **Super support** (Categorias e Documentação da API) |

Regras importantes:
- O responsável por um chamado precisa ser um suporte ou super support ativo.
- Somente quem abriu o chamado e o responsável por ele podem comentar (vale também para o super support).
- Chamados não podem ser excluídos.
- Suporte e super support vinculam a máquina do chamado; um chamado só pode ficar "resolvido" com máquina vinculada.
- A solução do chamado é registrada pelo responsável (ou um super support) em qualquer status, com máquina vinculada. Quem abriu é avisado e confirma; confirmada, o chamado fica "resolvido". Mudar a solução pede nova confirmação.
- Quem abriu pode reabrir um chamado "resolvido" (volta para "em andamento"); o prazo, em horas após a conclusão, é definido em Configurações.
- Suporte e super support podem deixar notas internas no chamado, que quem abriu não vê.
- Quem abriu avalia o atendimento (1 a 5) uma vez, com o chamado resolvido ou fechado.
- Abrir um chamado marca as notificações dele como lidas.
- A tela se atualiza sozinha a cada 15 segundos (e ao voltar para a aba): sino, avisos da agenda, notificações, chamados e a conversa do chamado. O intervalo fica em `LIVE_REFRESH_MS` (`src/frontend/hooks/useLiveRefresh.ts`).
- Ninguém pode trocar o próprio perfil nem desativar a própria conta.
- Conta desativada perde o acesso na hora (o token é revalidado no banco a cada requisição).
- Uma conta só fica conectada em um lugar: um login novo encerra a sessão anterior.
- Após 25 minutos sem atividade aparece um aviso; aos 30 minutos o usuário é desconectado.
- Chamado fechado só aceita comentários do super support.
- Toda alteração de chamado fica registrada no histórico.
- A conta inicial criada pelo `db:migrate` (ADMIN_EMAIL/ADMIN_PASSWORD) é um super support. Na primeira migração com o perfil super support, as contas `admin` existentes foram convertidas para super support.

## Páginas

| Rota | Página | Perfil |
| --- | --- | --- |
| `/login` | Entrar | público |
| `/cadastro` | Criar conta comum (se `ALLOW_SIGNUP=true`) | público |
| `/` | Início: chamados por status, "com você agora" (admin e suporte) e recentes | todos |
| `/chamados` | Lista com busca, filtros e paginação | todos (comum vê só os seus) |
| `/chamados/novo` | Abrir chamado | todos |
| `/chamados/:id` | Detalhe, conversa, histórico e painel de atendimento (admin e suporte) | dono, admin ou suporte |
| `/perfil` | Nome e troca de senha | todos |
| `/agenda` | Lembretes pessoais com data e hora (opcionalmente vinculados a um chamado); avisam na tela e nas notificações; podem ser excluídos | todos |
| `/api-docs` | Documentação da API (Swagger UI) | todos |
| `/usuarios` | Cadastro e gestão de usuários | suporte e super support |
| `/relatorios` | Indicadores por período + exportação CSV | admin e super support |
| `/relatorios/maquinas` | Chamados por máquina no período, por status e por categoria | admin e super support |
| `/relatorios/solicitantes` | Chamados por quem abriu, no período: status, categoria e resolução | admin e super support |
| `/categorias` | Lista, cadastro e ativação/desativação de categorias (nomes sempre em maiúsculas; desativadas somem da escolha nos chamados) | super support |
| `/configuracoes` | Configurações gerais: esconder prioridade de usuários comuns, só o suporte definir a prioridade, proibir o suporte de cadastrar/editar usuários, bloquear avaliações, prazo para reabrir, bloquear conversa, limitar chamados abertos por usuário | admin e super support |
| `/relatorios/responsaveis` | Chamados por responsável, no período: status, categoria e resolução | admin e super support |

## Instalação (Fedora)

Pré-requisitos: Node.js 22+ e MariaDB rodando (`sudo dnf install nodejs mariadb-server && sudo systemctl enable --now mariadb`).

```bash
cd project
npm install
cp .env.example .env      # preencha DB_PASSWORD, JWT_SECRET (openssl rand -hex 32) e ADMIN_PASSWORD
npm run db:setup          # cria banco e usuário no MariaDB; pede a senha do root do MariaDB
npm run db:migrate        # cria as tabelas, categorias e o admin inicial (ADMIN_EMAIL / ADMIN_PASSWORD)
npm run db:seed           # opcional: 5 registros de exemplo em cada tabela (senha em src/backend/models/seed.ts)
```

Se o seu administrador do MariaDB não for `root`, use `DB_ROOT_USER=nome npm run db:setup`.

## Rodando

```bash
npm run dev     # API em http://localhost:3000 e frontend em http://localhost:5173 (com proxy para /api)
npm test        # testes unitários (vitest)
npm run build   # compila frontend (dist/client) e backend (dist/server)
npm start       # produção: a API serve o frontend em http://localhost:3000
```

## Estrutura

```
src/backend/
  config/       env.ts (valida o .env), database.ts (pool MariaDB)
  routes/       index.ts: todas as rotas /api e quais middlewares usam
  middlewares/  auth (JWT + perfil), validate (zod), schemas, errorHandler
  controllers/  recebem a requisição e devolvem a resposta
  services/     regras de negócio (ticketRules/userRules têm testes)
  models/       SQL (schema.sql, migrate, setupDb) e consultas
  utils/        jwt, senha (bcrypt), csv, HttpError
src/frontend/
  pages/        uma por rota
  components/   layout, tabelas, badges, canhoto do chamado...
  services/     cliente HTTP e funções da API
  store/        AuthContext (usuário logado)
  hooks/        useAuth, useAsync
  styles/       global.css (tokens de cor e tipografia)
  utils/        formatação de datas, rótulos de status/prioridade
src/docs/       openapi.yaml e este guia
```

## Segurança

- Senhas com bcrypt (custo 12); JWT HS256 com expiração (`JWT_EXPIRES_IN`).
- Limite de 20 tentativas de login/cadastro por IP a cada 15 minutos.
- Toda entrada validada com zod; SQL sempre parametrizado.
- Cabeçalhos de segurança com helmet (CSP incluída).
- Usuário comum recebe 404 (não 403) ao tentar abrir chamado de outra pessoa, para não revelar que ele existe.
- Exportação CSV neutraliza fórmulas (`=`, `+`, `-`, `@`) para evitar injeção em planilhas.
