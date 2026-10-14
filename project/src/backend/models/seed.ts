/**
 * Insere dados de exemplo: 5 registros em cada tabela do DeskHelp.
 * Uso: npm run db:seed   (rode depois de npm run db:migrate)
 *
 * Todos os usuários de exemplo usam a senha SEED_PASSWORD abaixo.
 */
import mysql from "mysql2/promise";
import { env } from "../config/env.js";
import { hashPassword } from "../utils/password.js";

const SEED_PASSWORD = "Exemplo@2026";

const USERS = [
  { key: "bruno", name: "Bruno Almeida", email: "bruno.almeida@deskhelp.local", role: "admin" },
  { key: "fernanda", name: "Fernanda Lima", email: "fernanda.lima@deskhelp.local", role: "admin" },
  { key: "ana", name: "Ana Souza", email: "ana.souza@deskhelp.local", role: "comum" },
  { key: "carlos", name: "Carlos Pereira", email: "carlos.pereira@deskhelp.local", role: "comum" },
  { key: "juliana", name: "Juliana Rocha", email: "juliana.rocha@deskhelp.local", role: "comum" },
] as const;

const CATEGORIES = [
  "Telefonia",
  "Sistemas internos (ERP)",
  "Backup e arquivos",
  "Segurança da informação",
  "Compras de equipamento",
] as const;

type UserKey = (typeof USERS)[number]["key"];
type CategoryName = (typeof CATEGORIES)[number];

// Horas relativas a agora: criado há X horas, resolvido/fechado há Y horas.
const TICKETS: {
  key: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: CategoryName;
  requester: UserKey;
  assignee: UserKey | null;
  createdHoursAgo: number;
  resolvedHoursAgo?: number;
  closedHoursAgo?: number;
}[] = [
  {
    key: "ramal",
    title: "Ramal não recebe chamadas externas",
    description: "Meu ramal (2231) faz ligações normalmente, mas quem liga de fora cai direto na caixa postal.",
    status: "em_andamento",
    priority: "alta",
    category: "Telefonia",
    requester: "ana",
    assignee: "bruno",
    createdHoursAgo: 50,
  },
  {
    key: "erp",
    title: "ERP trava ao emitir nota fiscal",
    description: "Ao clicar em Emitir NF-e, a tela congela e o sistema fecha. Acontece com todos do faturamento desde hoje cedo.",
    status: "aberto",
    priority: "critica",
    category: "Sistemas internos (ERP)",
    requester: "carlos",
    assignee: null,
    createdHoursAgo: 5,
  },
  {
    key: "planilha",
    title: "Recuperar planilha apagada da pasta compartilhada",
    description: "Apaguei sem querer a planilha Orçamento 2026 da pasta Financeiro. A versão de ontem já serve.",
    status: "resolvido",
    priority: "media",
    category: "Backup e arquivos",
    requester: "juliana",
    assignee: "fernanda",
    createdHoursAgo: 144,
    resolvedHoursAgo: 120,
  },
  {
    key: "phishing",
    title: "E-mail suspeito pedindo troca de senha",
    description: "Recebi um e-mail dizendo ser do TI, pedindo para trocar a senha por um link externo. Não cliquei.",
    status: "fechado",
    priority: "alta",
    category: "Segurança da informação",
    requester: "ana",
    assignee: "bruno",
    createdHoursAgo: 240,
    resolvedHoursAgo: 216,
    closedHoursAgo: 192,
  },
  {
    key: "notebook",
    title: "Solicitar notebook para novo colaborador",
    description: "Um analista começa na equipe comercial na próxima segunda e precisa de notebook com Office e VPN.",
    status: "aguardando",
    priority: "baixa",
    category: "Compras de equipamento",
    requester: "carlos",
    assignee: "fernanda",
    createdHoursAgo: 72,
  },
];

const COMMENTS: { ticket: string; user: UserKey; body: string; hoursAgo: number }[] = [
  { ticket: "ramal", user: "bruno", body: "Vi na central que o ramal está com desvio ativado. Vou remover e testar com você.", hoursAgo: 46 },
  { ticket: "ramal", user: "ana", body: "Obrigada! Fico na mesa até as 18h.", hoursAgo: 45 },
  { ticket: "planilha", user: "fernanda", body: "Restaurei a versão de ontem às 22h a partir do backup. Confere se está tudo lá?", hoursAgo: 121 },
  { ticket: "phishing", user: "bruno", body: "Era phishing. Bloqueamos o remetente e o link; pode apagar a mensagem.", hoursAgo: 217 },
  { ticket: "notebook", user: "fernanda", body: "Cotação enviada ao setor de compras; aguardando aprovação do gestor.", hoursAgo: 70 },
];

const HISTORY: { ticket: string; user: UserKey; field: string; from: string | null; to: string | UserKey; hoursAgo: number }[] = [
  { ticket: "ramal", user: "bruno", field: "assigneeId", from: null, to: "bruno", hoursAgo: 47 },
  { ticket: "ramal", user: "bruno", field: "status", from: "aberto", to: "em_andamento", hoursAgo: 47 },
  { ticket: "planilha", user: "fernanda", field: "status", from: "em_andamento", to: "resolvido", hoursAgo: 120 },
  { ticket: "phishing", user: "bruno", field: "status", from: "resolvido", to: "fechado", hoursAgo: 192 },
  { ticket: "notebook", user: "fernanda", field: "status", from: "em_andamento", to: "aguardando", hoursAgo: 70 },
];

const conn = await mysql.createConnection({
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
});

try {
  const [existing] = await conn.query<mysql.RowDataPacket[]>("SELECT id FROM users WHERE email = ?", [USERS[0].email]);
  if (existing.length > 0) {
    console.log("Os dados de exemplo já foram inseridos; nada a fazer.");
  } else {
    await conn.beginTransaction();

    const passwordHash = await hashPassword(SEED_PASSWORD);
    const userId: Record<string, number> = {};
    for (const u of USERS) {
      const [r] = await conn.execute<mysql.ResultSetHeader>(
        "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
        [u.name, u.email, passwordHash, u.role],
      );
      userId[u.key] = r.insertId;
    }

    const categoryId: Record<string, number> = {};
    for (const name of CATEGORIES) {
      const [r] = await conn.execute<mysql.ResultSetHeader>("INSERT INTO categories (name) VALUES (?)", [name]);
      categoryId[name] = r.insertId;
    }

    const ago = "DATE_SUB(NOW(), INTERVAL ? HOUR)";
    const ticketId: Record<string, number> = {};
    for (const t of TICKETS) {
      const [r] = await conn.execute<mysql.ResultSetHeader>(
        `INSERT INTO tickets (title, description, status, priority, category_id, requester_id, assignee_id,
                              created_at, updated_at, resolved_at, closed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ${ago}, ${ago},
                 IF(? IS NULL, NULL, ${ago}), IF(? IS NULL, NULL, ${ago}))`,
        [
          t.title,
          t.description,
          t.status,
          t.priority,
          categoryId[t.category],
          userId[t.requester],
          t.assignee ? userId[t.assignee] : null,
          t.createdHoursAgo,
          t.closedHoursAgo ?? t.resolvedHoursAgo ?? Math.max(1, t.createdHoursAgo - 3),
          t.resolvedHoursAgo ?? null,
          t.resolvedHoursAgo ?? 0,
          t.closedHoursAgo ?? null,
          t.closedHoursAgo ?? 0,
        ],
      );
      ticketId[t.key] = r.insertId;
    }

    for (const c of COMMENTS) {
      await conn.execute(`INSERT INTO ticket_comments (ticket_id, user_id, body, created_at) VALUES (?, ?, ?, ${ago})`, [
        ticketId[c.ticket],
        userId[c.user],
        c.body,
        c.hoursAgo,
      ]);
    }

    for (const h of HISTORY) {
      const toValue = h.field === "assigneeId" ? String(userId[h.to]) : h.to;
      await conn.execute(
        `INSERT INTO ticket_history (ticket_id, user_id, field, old_value, new_value, created_at) VALUES (?, ?, ?, ?, ?, ${ago})`,
        [ticketId[h.ticket], userId[h.user], h.field, h.from, toValue, h.hoursAgo],
      );
    }

    await conn.commit();
    console.log("Dados de exemplo inseridos: 5 usuários, 5 categorias, 5 chamados, 5 comentários, 5 históricos.");
  }
} catch (error) {
  await conn.rollback();
  throw error;
} finally {
  await conn.end();
}
