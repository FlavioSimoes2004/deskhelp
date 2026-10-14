# DeskHelp

Sistema de chamados (help desk): usuários abrem chamados e a equipe de suporte (administradores) atende, muda o status, define responsável e acompanha os relatórios.

- **Banco:** MariaDB
- **Backend:** Node.js + Express 5 + TypeScript (`src/backend`)
- **Frontend:** React 19 + React Router + Vite + TypeScript (`src/frontend`)
- **Documentação da API:** OpenAPI 3.1 em [`openapi.yaml`](openapi.yaml), exibida no app em `/api-docs`

## Perfis de acesso

| Perfil | Pode |
| --- | --- |
| **Comum** | Abrir chamados, ver e comentar apenas os próprios chamados, editar o próprio perfil e senha |
| **Admin** | Tudo do comum + ver todos os chamados, alterar status, prioridade, categoria e responsável, assumir e excluir chamados, cadastrar/editar/desativar usuários, ver relatórios e exportar CSV |

Regras importantes:
- O responsável por um chamado precisa ser um administrador ativo.
- Um admin não pode tirar o próprio perfil de admin nem desativar a própria conta.
- Conta desativada perde o acesso na hora (o token é revalidado no banco a cada requisição).
- Chamado fechado não aceita comentários de usuário comum.
- Toda alteração de chamado fica registrada no histórico.

## Páginas

| Rota | Página | Perfil |
| --- | --- | --- |
| `/login` | Entrar | público |
| `/cadastro` | Criar conta comum (se `ALLOW_SIGNUP=true`) | público |
| `/` | Início: chamados por status, "com você agora" (admin) e recentes | todos |
| `/chamados` | Lista com busca, filtros e paginação | todos (comum vê só os seus) |
| `/chamados/novo` | Abrir chamado | todos |
| `/chamados/:id` | Detalhe, conversa, histórico e painel de atendimento (admin) | dono ou admin |
| `/perfil` | Nome e troca de senha | todos |
| `/api-docs` | Documentação da API (Swagger UI) | todos |
| `/usuarios` | Cadastro e gestão de usuários | admin |
| `/relatorios` | Indicadores por período + exportação CSV | admin |

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
