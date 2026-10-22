-- DeskHelp: esquema do banco MariaDB.
-- Idempotente: pode ser executado várias vezes por "npm run db:migrate".

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('admin', 'comum', 'support') NOT NULL DEFAULT 'comum',
  active        TINYINT(1) NOT NULL DEFAULT 1,
  -- Sessão atual: cada login gera um id novo e derruba a sessão anterior (um login por conta).
  session_id    CHAR(36) NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role_active (role, active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bancos criados antes do controle de sessão única.
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_id CHAR(36) NULL AFTER active;

-- Bancos criados antes do perfil 'support' recebem a nova opção.
ALTER TABLE users MODIFY role ENUM('admin', 'comum', 'support') NOT NULL DEFAULT 'comum';

CREATE TABLE IF NOT EXISTS categories (
  id   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tickets (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title        VARCHAR(160) NOT NULL,
  description  TEXT NOT NULL,
  status       ENUM('aberto', 'em_andamento', 'aguardando', 'resolvido', 'fechado') NOT NULL DEFAULT 'aberto',
  priority     ENUM('baixa', 'media', 'alta', 'critica') NOT NULL DEFAULT 'media',
  category_id  INT UNSIGNED NOT NULL,
  requester_id INT UNSIGNED NOT NULL,
  assignee_id  INT UNSIGNED NULL,
  -- Máquina a que o chamado se refere (vinculada por admin/suporte; obrigatória para "resolvido").
  -- A chave estrangeira para machines é criada por migrate.ts, pois machines vem depois.
  machine_id   INT UNSIGNED NULL,
  -- Solução do chamado: registrada pelo responsável ou por um admin, com o chamado "resolvido".
  solution     TEXT NULL,
  -- Avaliação do atendimento pelo solicitante (1 a 5), com o chamado resolvido ou fechado.
  rating         TINYINT UNSIGNED NULL,
  rating_comment VARCHAR(500) NULL,
  rated_at       DATETIME NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  resolved_at  DATETIME NULL,
  closed_at    DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_tickets_status_created (status, created_at),
  KEY idx_tickets_requester (requester_id, created_at),
  KEY idx_tickets_assignee (assignee_id, status),
  KEY idx_tickets_category (category_id),
  KEY idx_tickets_created (created_at),
  CONSTRAINT fk_tickets_category FOREIGN KEY (category_id) REFERENCES categories (id),
  CONSTRAINT fk_tickets_requester FOREIGN KEY (requester_id) REFERENCES users (id),
  CONSTRAINT fk_tickets_assignee FOREIGN KEY (assignee_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- is_internal = 1: nota interna, visível só para admin e suporte.
CREATE TABLE IF NOT EXISTS ticket_comments (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  ticket_id   INT UNSIGNED NOT NULL,
  user_id     INT UNSIGNED NOT NULL,
  body        TEXT NOT NULL,
  is_internal TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_comments_ticket (ticket_id, created_at),
  CONSTRAINT fk_comments_ticket FOREIGN KEY (ticket_id) REFERENCES tickets (id) ON DELETE CASCADE,
  CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Anexos dos comentários. O arquivo fica no servidor (pasta UPLOAD_DIR);
-- file_path guarda o caminho dele relativo a essa pasta. comment_id liga o anexo
-- ao comentário; ticket_id repete o chamado para checar o acesso no download.
CREATE TABLE IF NOT EXISTS ticket_comment_attachments (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  comment_id    INT UNSIGNED NOT NULL,
  ticket_id     INT UNSIGNED NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_path     VARCHAR(255) NOT NULL,
  mime_type     VARCHAR(120) NOT NULL,
  size_bytes    INT UNSIGNED NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_attachments_path (file_path),
  KEY idx_attachments_comment (comment_id),
  KEY idx_attachments_ticket (ticket_id),
  CONSTRAINT fk_attachments_comment FOREIGN KEY (comment_id) REFERENCES ticket_comments (id) ON DELETE CASCADE,
  CONSTRAINT fk_attachments_ticket FOREIGN KEY (ticket_id) REFERENCES tickets (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Agenda pessoal: cada usuário cria lembretes com data e hora. Quando chega a hora,
-- o sistema cria uma notificação (notified_at) e mostra um aviso na tela até o
-- usuário dispensar (dismissed_at). ticket_id vincula o item a um chamado (opcional).
CREATE TABLE IF NOT EXISTS agenda_items (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      INT UNSIGNED NOT NULL,
  ticket_id    INT UNSIGNED NULL,
  title        VARCHAR(160) NOT NULL,
  description  TEXT NULL,
  scheduled_at DATETIME NOT NULL,
  notified_at  DATETIME NULL,
  dismissed_at DATETIME NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_agenda_user_scheduled (user_id, scheduled_at),
  KEY idx_agenda_pending (notified_at, scheduled_at),
  KEY idx_agenda_ticket (ticket_id),
  CONSTRAINT fk_agenda_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_agenda_ticket FOREIGN KEY (ticket_id) REFERENCES tickets (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bancos criados antes do vínculo da agenda com chamados (índice e chave criados por migrate.ts).
ALTER TABLE agenda_items ADD COLUMN IF NOT EXISTS ticket_id INT UNSIGNED NULL AFTER user_id;

-- Notificações de cada usuário. type: 'assigned' (um admin atribuiu o chamado a ele),
-- 'comment' (alguém comentou em um chamado que ele abriu ou do qual é responsável) ou
-- 'agenda' (chegou a hora de um item da agenda dele; sem chamado nem autor).
-- actor_id é quem gerou a notificação; read_at fica NULL enquanto não for lida.
CREATE TABLE IF NOT EXISTS notifications (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  type       ENUM('assigned', 'comment', 'agenda') NOT NULL,
  ticket_id  INT UNSIGNED NULL,
  actor_id   INT UNSIGNED NULL,
  comment_id INT UNSIGNED NULL,
  agenda_id  INT UNSIGNED NULL,
  read_at    DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notifications_user_created (user_id, created_at),
  KEY idx_notifications_user_read (user_id, read_at),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_notifications_ticket FOREIGN KEY (ticket_id) REFERENCES tickets (id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_actor FOREIGN KEY (actor_id) REFERENCES users (id),
  CONSTRAINT fk_notifications_comment FOREIGN KEY (comment_id) REFERENCES ticket_comments (id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_agenda FOREIGN KEY (agenda_id) REFERENCES agenda_items (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bancos criados antes das notificações da agenda (a chave de agenda_id é criada por migrate.ts).
ALTER TABLE notifications
  MODIFY type ENUM('assigned', 'comment', 'agenda') NOT NULL,
  MODIFY ticket_id INT UNSIGNED NULL,
  MODIFY actor_id INT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS agenda_id INT UNSIGNED NULL AFTER comment_id;

-- Máquinas (nome, endereço MAC, IP, descrição, configuração e o usuário que está com ela).
CREATE TABLE IF NOT EXISTS machines (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name         VARCHAR(80) NULL,
  mac_address  CHAR(17) NOT NULL,
  ip_address   VARCHAR(45) NULL,
  description  VARCHAR(255) NULL,
  ram_gb       SMALLINT UNSIGNED NULL,
  ram_type     VARCHAR(120) NULL,
  cpu          VARCHAR(120) NULL,
  storage_gb   INT UNSIGNED NULL,
  storage_type ENUM('ssd', 'hd') NULL,
  gpu          VARCHAR(120) NULL,
  user_id     INT UNSIGNED NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_machines_mac (mac_address),
  KEY idx_machines_user (user_id),
  CONSTRAINT fk_machines_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bancos criados antes das notas internas e da avaliação do atendimento.
ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS is_internal TINYINT(1) NOT NULL DEFAULT 0 AFTER body;
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS rating TINYINT UNSIGNED NULL AFTER solution,
  ADD COLUMN IF NOT EXISTS rating_comment VARCHAR(500) NULL AFTER rating,
  ADD COLUMN IF NOT EXISTS rated_at DATETIME NULL AFTER rating_comment;

-- Bancos criados antes da coluna tickets.solution.
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS solution TEXT NULL AFTER machine_id;

-- Bancos criados antes da coluna tickets.machine_id.
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS machine_id INT UNSIGNED NULL AFTER assignee_id;

-- Bancos criados antes da coluna machines.description.
ALTER TABLE machines ADD COLUMN IF NOT EXISTS description VARCHAR(255) NULL AFTER ip_address;

-- Bancos criados antes do nome e da configuração das máquinas.
ALTER TABLE machines
  ADD COLUMN IF NOT EXISTS name VARCHAR(80) NULL AFTER id,
  ADD COLUMN IF NOT EXISTS ram_gb SMALLINT UNSIGNED NULL AFTER description,
  ADD COLUMN IF NOT EXISTS ram_type VARCHAR(120) NULL AFTER ram_gb,
  ADD COLUMN IF NOT EXISTS cpu VARCHAR(120) NULL AFTER ram_type,
  ADD COLUMN IF NOT EXISTS storage_gb INT UNSIGNED NULL AFTER cpu,
  ADD COLUMN IF NOT EXISTS storage_type ENUM('ssd', 'hd') NULL AFTER storage_gb,
  ADD COLUMN IF NOT EXISTS gpu VARCHAR(120) NULL AFTER storage_type;

-- Histórico das máquinas: cadastro (field = 'created') e cada campo alterado.
CREATE TABLE IF NOT EXISTS machine_history (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  machine_id INT UNSIGNED NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  field      VARCHAR(40) NOT NULL,
  old_value  VARCHAR(255) NULL,
  new_value  VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_machine_history_machine (machine_id, created_at),
  CONSTRAINT fk_machine_history_machine FOREIGN KEY (machine_id) REFERENCES machines (id) ON DELETE CASCADE,
  CONSTRAINT fk_machine_history_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Histórico de alterações (status, prioridade, responsável...) para auditoria.
CREATE TABLE IF NOT EXISTS ticket_history (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  ticket_id  INT UNSIGNED NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  field      VARCHAR(40) NOT NULL,
  old_value  VARCHAR(255) NULL,
  new_value  VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_history_ticket (ticket_id, created_at),
  CONSTRAINT fk_history_ticket FOREIGN KEY (ticket_id) REFERENCES tickets (id) ON DELETE CASCADE,
  CONSTRAINT fk_history_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Configurações gerais da aplicação (alteradas por admins na página Configurações).
-- Chaves: hide_priority_for_comum, comments_locked, max_open_tickets_per_user.
CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(60) NOT NULL,
  value       VARCHAR(255) NOT NULL,
  updated_by  INT UNSIGNED NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key),
  CONSTRAINT fk_settings_user FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO categories (name) VALUES
  ('Acesso e senhas'),
  ('Hardware'),
  ('Software'),
  ('Rede e internet'),
  ('E-mail'),
  ('Impressoras'),
  ('Outros');
