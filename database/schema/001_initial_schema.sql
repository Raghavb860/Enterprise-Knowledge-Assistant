-- ============================================================
-- Enterprise Knowledge Assistant — MySQL 8 Schema
-- File: database/schema/001_initial_schema.sql
-- Run: mysql -u root -p eka_db < 001_initial_schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS eka_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE eka_db;

-- ─────────────────────────────────────────────
-- ROLES & PERMISSIONS
-- ─────────────────────────────────────────────

CREATE TABLE roles (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(50)  NOT NULL UNIQUE,
  description   TEXT,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE permissions (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL UNIQUE,
  resource      VARCHAR(50)  NOT NULL,
  action        VARCHAR(50)  NOT NULL,
  description   TEXT,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_resource_action (resource, action)
) ENGINE=InnoDB;

CREATE TABLE role_permissions (
  role_id       INT UNSIGNED NOT NULL,
  permission_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id)       REFERENCES roles(id)       ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- USERS
-- ─────────────────────────────────────────────

CREATE TABLE users (
  id              CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  email           VARCHAR(255) NOT NULL UNIQUE,
  username        VARCHAR(100) NOT NULL UNIQUE,
  full_name       VARCHAR(255) NOT NULL,
  hashed_password VARCHAR(255) NOT NULL,
  role_id         INT UNSIGNED NOT NULL,
  department      VARCHAR(100),
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  is_verified     BOOLEAN      NOT NULL DEFAULT FALSE,
  last_login_at   DATETIME,
  password_reset_token  VARCHAR(255),
  password_reset_expiry DATETIME,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id),
  INDEX idx_users_email    (email),
  INDEX idx_users_role     (role_id),
  INDEX idx_users_active   (is_active)
) ENGINE=InnoDB;

CREATE TABLE user_sessions (
  id              CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  user_id         CHAR(36)     NOT NULL,
  refresh_token   VARCHAR(500) NOT NULL UNIQUE,
  expires_at      DATETIME     NOT NULL,
  ip_address      VARCHAR(45),
  user_agent      TEXT,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_sessions_user    (user_id),
  INDEX idx_sessions_token   (refresh_token(255)),
  INDEX idx_sessions_expires (expires_at)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- COLLECTIONS
-- ─────────────────────────────────────────────

CREATE TABLE collections (
  id          CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  department  VARCHAR(100),
  color       VARCHAR(7),
  icon        VARCHAR(50),
  owner_id    CHAR(36)     NOT NULL,
  is_public   BOOLEAN      NOT NULL DEFAULT FALSE,
  doc_count   INT UNSIGNED NOT NULL DEFAULT 0,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id),
  INDEX idx_collections_owner  (owner_id),
  INDEX idx_collections_dept   (department)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- DOCUMENTS
-- ─────────────────────────────────────────────

CREATE TABLE documents (
  id              CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  filename        VARCHAR(500) NOT NULL,
  original_name   VARCHAR(500) NOT NULL,
  file_type       ENUM('pdf','docx','txt','xlsx') NOT NULL,
  file_size       BIGINT UNSIGNED NOT NULL,
  file_hash       VARCHAR(64)  NOT NULL,
  storage_path    VARCHAR(1000) NOT NULL,
  title           VARCHAR(500),
  author          VARCHAR(255),
  department      VARCHAR(100),
  description     TEXT,
  page_count      INT UNSIGNED,
  word_count      INT UNSIGNED,
  language        VARCHAR(10)  DEFAULT 'en',
  collection_id   CHAR(36),
  owner_id        CHAR(36)     NOT NULL,
  status          ENUM('pending','processing','ready','failed') NOT NULL DEFAULT 'pending',
  error_message   TEXT,
  chroma_collection VARCHAR(100),
  chunk_count     INT UNSIGNED DEFAULT 0,
  is_deleted      BOOLEAN      NOT NULL DEFAULT FALSE,
  deleted_at      DATETIME,
  tags            JSON,
  custom_metadata JSON,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE SET NULL,
  FOREIGN KEY (owner_id)      REFERENCES users(id),
  UNIQUE KEY uq_file_hash (file_hash),
  INDEX idx_docs_owner      (owner_id),
  INDEX idx_docs_collection (collection_id),
  INDEX idx_docs_status     (status),
  INDEX idx_docs_type       (file_type),
  INDEX idx_docs_deleted    (is_deleted),
  FULLTEXT idx_docs_fulltext (title, description)
) ENGINE=InnoDB;

CREATE TABLE document_chunks (
  id              CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  document_id     CHAR(36)     NOT NULL,
  chunk_index     INT UNSIGNED NOT NULL,
  page_number     INT UNSIGNED,
  content         MEDIUMTEXT   NOT NULL,
  char_count      INT UNSIGNED NOT NULL,
  token_estimate  INT UNSIGNED,
  chroma_chunk_id VARCHAR(100),
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  INDEX idx_chunks_doc      (document_id),
  INDEX idx_chunks_chroma   (chroma_chunk_id),
  UNIQUE KEY uq_chunk_doc_idx (document_id, chunk_index)
) ENGINE=InnoDB;

CREATE TABLE document_permissions (
  document_id CHAR(36)     NOT NULL,
  user_id     CHAR(36)     NOT NULL,
  can_read    BOOLEAN      NOT NULL DEFAULT TRUE,
  can_delete  BOOLEAN      NOT NULL DEFAULT FALSE,
  granted_by  CHAR(36)     NOT NULL,
  granted_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (document_id, user_id),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE,
  FOREIGN KEY (granted_by)  REFERENCES users(id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- PROCESSING JOBS
-- ─────────────────────────────────────────────

CREATE TABLE processing_jobs (
  id            CHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  document_id   CHAR(36)   NOT NULL,
  job_type      ENUM('parse','embed','reindex') NOT NULL DEFAULT 'parse',
  status        ENUM('queued','running','done','failed') NOT NULL DEFAULT 'queued',
  progress      TINYINT UNSIGNED DEFAULT 0,
  started_at    DATETIME,
  finished_at   DATETIME,
  error_message TEXT,
  created_at    DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  INDEX idx_jobs_doc    (document_id),
  INDEX idx_jobs_status (status)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- CHAT
-- ─────────────────────────────────────────────

CREATE TABLE chat_sessions (
  id              CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  user_id         CHAR(36)     NOT NULL,
  title           VARCHAR(500) NOT NULL DEFAULT 'New Conversation',
  model_used      VARCHAR(100) NOT NULL DEFAULT 'qwen3:8b',
  collection_id   CHAR(36),
  message_count   INT UNSIGNED NOT NULL DEFAULT 0,
  total_tokens    INT UNSIGNED NOT NULL DEFAULT 0,
  is_archived     BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)       REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE SET NULL,
  INDEX idx_sessions_user     (user_id),
  INDEX idx_sessions_created  (created_at)
) ENGINE=InnoDB;

CREATE TABLE chat_messages (
  id              CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  session_id      CHAR(36)     NOT NULL,
  role            ENUM('user','assistant','system') NOT NULL,
  content         MEDIUMTEXT   NOT NULL,
  citations       JSON,
  model_used      VARCHAR(100),
  prompt_tokens   INT UNSIGNED,
  completion_tokens INT UNSIGNED,
  response_time_ms INT UNSIGNED,
  is_regenerated  BOOLEAN      NOT NULL DEFAULT FALSE,
  parent_msg_id   CHAR(36),
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id)   REFERENCES chat_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_msg_id) REFERENCES chat_messages(id) ON DELETE SET NULL,
  INDEX idx_messages_session (session_id),
  INDEX idx_messages_role    (role)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- AUDIT LOGS
-- ─────────────────────────────────────────────

CREATE TABLE audit_logs (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       CHAR(36),
  action        VARCHAR(100)   NOT NULL,
  resource_type VARCHAR(50),
  resource_id   VARCHAR(36),
  details       JSON,
  ip_address    VARCHAR(45),
  user_agent    TEXT,
  status        ENUM('success','failure') NOT NULL DEFAULT 'success',
  created_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_audit_user     (user_id),
  INDEX idx_audit_action   (action),
  INDEX idx_audit_resource (resource_type, resource_id),
  INDEX idx_audit_created  (created_at)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- SEED: DEFAULT ROLES & PERMISSIONS
-- ─────────────────────────────────────────────

INSERT INTO roles (name, description) VALUES
  ('super_admin',       'Full system access'),
  ('admin',             'User and content management'),
  ('knowledge_manager', 'Document and collection management'),
  ('analyst',           'Search and chat access'),
  ('viewer',            'Read-only search and chat');

INSERT INTO permissions (name, resource, action) VALUES
  ('documents:upload',   'documents', 'upload'),
  ('documents:read',     'documents', 'read'),
  ('documents:delete',   'documents', 'delete'),
  ('documents:manage',   'documents', 'manage'),
  ('collections:create', 'collections', 'create'),
  ('collections:read',   'collections', 'read'),
  ('collections:update', 'collections', 'update'),
  ('collections:delete', 'collections', 'delete'),
  ('search:perform',     'search', 'perform'),
  ('chat:create',        'chat', 'create'),
  ('chat:history',       'chat', 'history'),
  ('users:read',         'users', 'read'),
  ('users:create',       'users', 'create'),
  ('users:update',       'users', 'update'),
  ('users:delete',       'users', 'delete'),
  ('roles:manage',       'roles', 'manage'),
  ('audit:read',         'audit', 'read'),
  ('dashboard:view',     'dashboard', 'view');

-- Super Admin gets everything
INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'super_admin';

-- Admin
INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r
  JOIN permissions p ON p.name IN (
    'documents:upload','documents:read','documents:delete','documents:manage',
    'collections:create','collections:read','collections:update','collections:delete',
    'search:perform','chat:create','chat:history',
    'users:read','users:create','users:update',
    'audit:read','dashboard:view'
  ) WHERE r.name = 'admin';

-- Knowledge Manager
INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r
  JOIN permissions p ON p.name IN (
    'documents:upload','documents:read','documents:delete','documents:manage',
    'collections:create','collections:read','collections:update','collections:delete',
    'search:perform','chat:create','chat:history','dashboard:view'
  ) WHERE r.name = 'knowledge_manager';

-- Analyst
INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r
  JOIN permissions p ON p.name IN (
    'documents:read','collections:read',
    'search:perform','chat:create','chat:history','dashboard:view'
  ) WHERE r.name = 'analyst';

-- Viewer
INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r
  JOIN permissions p ON p.name IN (
    'documents:read','collections:read',
    'search:perform','chat:create','chat:history'
  ) WHERE r.name = 'viewer';

-- ─────────────────────────────────────────────
-- DEFAULT SUPER ADMIN USER
-- Password: Admin@123 (bcrypt hash)
-- CHANGE IMMEDIATELY after first login!
-- ─────────────────────────────────────────────

INSERT INTO users (
  id, email, username, full_name, hashed_password, role_id, is_active, is_verified
) VALUES (
  UUID(),
  'admin@eka.local',
  'superadmin',
  'System Administrator',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewqfG7kp8JiVt/Ji',
  (SELECT id FROM roles WHERE name = 'super_admin'),
  TRUE,
  TRUE
);
