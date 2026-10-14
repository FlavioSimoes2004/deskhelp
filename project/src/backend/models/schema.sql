-- DeskHelp: esquema do banco MariaDB.
-- Idempotente: pode ser executado várias vezes por "npm run db:migrate".

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('admin', 'comum') NOT NULL DEFAULT 'comum',
  active        TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role_active (role, active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS ticket_comments (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  ticket_id  INT UNSIGNED NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  body       TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_comments_ticket (ticket_id, created_at),
  CONSTRAINT fk_comments_ticket FOREIGN KEY (ticket_id) REFERENCES tickets (id) ON DELETE CASCADE,
  CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES users (id)
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

INSERT IGNORE INTO categories (name) VALUES
  ('Acesso e senhas'),
  ('Hardware'),
  ('Software'),
  ('Rede e internet'),
  ('E-mail'),
  ('Impressoras'),
  ('Outros');
