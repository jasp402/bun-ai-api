import { Database } from "bun:sqlite";

const db = new Database("bun-ai-api.sqlite", { create: true });

// Enable WAL for better concurrency
db.query("PRAGMA journal_mode = WAL;").run();

// Initialize Schema
export function initializeDatabase() {
  console.log("Initializing Database...");

  // Request Logs Table
  db.query(`
    CREATE TABLE IF NOT EXISTS request_logs (
      request_id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      providers_tried TEXT, -- JSON array
      final_provider TEXT,
      stream BOOLEAN,
      token_estimate INTEGER,
      total_latency_ms INTEGER,
      success BOOLEAN,
      error_details TEXT
    );
  `).run();

  // System Config Table (Key-Value)
  db.query(`
    CREATE TABLE IF NOT EXISTS system_config (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT
    );
  `).run();

  // =============== MEMORY SUBSYSTEM ===============

  // Users Table (para identificar y recordar el nombre)
  db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      channel TEXT,
      busy_until TEXT,
      quiet_hours_start TEXT DEFAULT '22:00',
      quiet_hours_end TEXT DEFAULT '09:00',
      nudge_delay_hours INTEGER DEFAULT 12,
      created_at TEXT
    );
  `).run();

  // Migrations for users
  try { db.query("ALTER TABLE users ADD COLUMN busy_until TEXT").run(); } catch(e){}
  try { db.query("ALTER TABLE users ADD COLUMN quiet_hours_start TEXT DEFAULT '22:00'").run(); } catch(e){}
  try { db.query("ALTER TABLE users ADD COLUMN quiet_hours_end TEXT DEFAULT '09:00'").run(); } catch(e){}
  try { db.query("ALTER TABLE users ADD COLUMN nudge_delay_hours INTEGER DEFAULT 12").run(); } catch(e){}

  // Conversations Table
  db.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      channel TEXT,
      last_nudge_at TEXT,
      updated_at TEXT
    );
  `).run();

  // Migrations for conversations
  try { db.query("ALTER TABLE conversations ADD COLUMN last_nudge_at TEXT").run(); } catch(e){}

  // Messages Table (con is_analyzed para el cron)
  db.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT,
      role TEXT,
      content TEXT,
      timestamp TEXT,
      is_analyzed BOOLEAN DEFAULT 0
    );
  `).run();

  // Memory Rules Table (SYSTEM_PROMPT_BASE y reglas aprendidas)
  db.query(`
    CREATE TABLE IF NOT EXISTS memory_rules (
      id TEXT PRIMARY KEY,
      type TEXT, -- ej. 'system_prompt', 'learned_rule'
      content TEXT,
      is_active BOOLEAN DEFAULT 1,
      created_at TEXT
    );
  `).run();

  // Reminders Table
  db.query(`
    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      channel TEXT,
      message TEXT,
      execute_at TEXT, -- ISO Date
      is_executed BOOLEAN DEFAULT 0,
      created_at TEXT
    );
  `).run();

  // WhatsApp Inbox Queue
  db.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_inbox (
      id TEXT PRIMARY KEY,
      source_message_id TEXT UNIQUE,
      chat_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      user_name TEXT,
      text TEXT NOT NULL,
      command_text TEXT NOT NULL,
      is_group BOOLEAN DEFAULT 0,
      status TEXT DEFAULT 'pending',
      attempt_count INTEGER DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      responded_at TEXT
    );
  `).run();

  // =============== MCP SUBSYSTEM ===============

  // MCP Servers Config
  db.query(`
    CREATE TABLE IF NOT EXISTS mcp_servers (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE,
      type TEXT, -- 'stdio' o 'sse'
      command TEXT, -- Para stdio: comando a ejecutar (ej. 'npx')
      args TEXT, -- Para stdio: JSON array de argumentos
      env TEXT, -- JSON Object con variables de entorno necesarias
      url TEXT, -- Para sse: url de conexión remota
      is_active BOOLEAN DEFAULT 1,
      created_at TEXT
    );
  `).run();

  // Insert Default Filesystem MCP if not exists
  const fsExists = db.query("SELECT id FROM mcp_servers WHERE name = 'filesystem' LIMIT 1").get();
  if (!fsExists) {
    db.query(`
      INSERT INTO mcp_servers (id, name, type, command, args, env, is_active, created_at)
      VALUES ($id, 'filesystem', 'stdio', 'npx', $args, '{}', 1, $now)
    `).run({
      $id: crypto.randomUUID?.() || Math.random().toString(), // Para soportar crypto importado o no
      $args: JSON.stringify(["-y", "@modelcontextprotocol/server-filesystem", "D:\\"]),
      $now: new Date().toISOString()
    });
    console.log("Added default MCP server: filesystem");
  }

  // =============== SISTEMA DE PROYECTOS ===============

  // Projects Table
  db.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE,
      path TEXT NOT NULL,
      stack TEXT DEFAULT '',
      dev_command TEXT DEFAULT '',
      agent_command TEXT DEFAULT '',
      is_active BOOLEAN DEFAULT 0,
      mirror_mode BOOLEAN DEFAULT 0,
      status TEXT DEFAULT 'idle',
      created_at TEXT
    );
  `).run();

  // MIGRACIÓN: Añadir mirror_mode si no existe (para DBs ya creadas)
  try {
    db.query("ALTER TABLE projects ADD COLUMN mirror_mode BOOLEAN DEFAULT 0").run();
    console.log("[Database] Columna mirror_mode añadida.");
  } catch (e) {
    // Si ya existe ignorar
  }


  // MIGRACIÓN/LIMPIEZA: Normalizar rutas malformadas (ej: 'd:path' -> 'd:\path')
  const malformed = db.query("SELECT id, path FROM projects WHERE path LIKE '_:%' AND path NOT LIKE '_:/%'").all() as any[];
  for (const p of malformed) {
    const fixedPath = p.path.replace(/^([a-zA-Z]):/, '$1:/');
    db.query("UPDATE projects SET path = $fixed WHERE id = $id").run({ $fixed: fixedPath, $id: p.id });
    console.log(`[Database] Normalized malformed path: ${p.path} -> ${fixedPath}`);
  }

  // Processes Table
  db.query(`
    CREATE TABLE IF NOT EXISTS processes (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      type TEXT NOT NULL,
      command TEXT NOT NULL,
      pid INTEGER,
      status TEXT DEFAULT 'stopped',
      port INTEGER,
      last_output TEXT DEFAULT '',
      started_at TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );
  `).run();

  // =============== PERFORMANCE INDEXES ===============

  db.query("CREATE INDEX IF NOT EXISTS idx_users_id_channel ON users(id, channel);").run();
  db.query("CREATE INDEX IF NOT EXISTS idx_conversations_user_channel ON conversations(user_id, channel);").run();
  db.query("CREATE INDEX IF NOT EXISTS idx_messages_conversation_timestamp ON messages(conversation_id, timestamp);").run();
  db.query("CREATE INDEX IF NOT EXISTS idx_messages_is_analyzed_timestamp ON messages(is_analyzed, timestamp);").run();
  db.query("CREATE INDEX IF NOT EXISTS idx_memory_rules_type_is_active ON memory_rules(type, is_active);").run();
  db.query("CREATE INDEX IF NOT EXISTS idx_reminders_is_executed_execute_at ON reminders(is_executed, execute_at);").run();
  db.query("CREATE INDEX IF NOT EXISTS idx_processes_project_id ON processes(project_id);").run();
  db.query("CREATE INDEX IF NOT EXISTS idx_processes_status ON processes(status);").run();

  console.log("Database initialized.");
}

export type RequestLogEntry = {
  requestId: string;
  timestamp: string;
  providersTried: any[]; // will be stringified
  finalProvider: string | null;
  stream: boolean;
  tokenEstimate: number;
  totalLatencyMs: number;
  success: boolean;
  errorDetails?: string | null;
};

export const dbService = {
  insertRequestLog: (log: RequestLogEntry) => {
    try {
      const query = db.query(`
        INSERT INTO request_logs (
          request_id, timestamp, providers_tried, final_provider, 
          stream, token_estimate, total_latency_ms, success, error_details
        ) VALUES (
          $requestId, $timestamp, $providersTried, $finalProvider, 
          $stream, $tokenEstimate, $totalLatencyMs, $success, $errorDetails
        )
      `);

      query.run({
        $requestId: log.requestId,
        $timestamp: log.timestamp,
        $providersTried: JSON.stringify(log.providersTried),
        $finalProvider: log.finalProvider,
        $stream: log.stream,
        $tokenEstimate: log.tokenEstimate,
        $totalLatencyMs: log.totalLatencyMs,
        $success: log.success,
        $errorDetails: log.errorDetails || null
      });
    } catch (error) {
      console.error("Failed to write request log to DB:", error);
    }
  },

  getConfig: (key: string): string | null => {
    const query = db.query("SELECT value FROM system_config WHERE key = $key");
    const result = query.get({ $key: key }) as { value: string } | null;
    return result ? result.value : null;
  },

  setConfig: (key: string, value: string) => {
    const query = db.query(`
      INSERT INTO system_config (key, value, updated_at) 
      VALUES ($key, $value, $timestamp)
      ON CONFLICT(key) DO UPDATE SET value = $value, updated_at = $timestamp
    `);
    query.run({
      $key: key,
      $value: value,
      $timestamp: new Date().toISOString()
    });
  },

  // =============== CRUD DE PROYECTOS ===============

  addProject: (name: string, path: string, stack: string = '', devCommand: string = '', agentCommand: string = '') => {
    db.query(`
      INSERT INTO projects (id, name, path, stack, dev_command, agent_command, is_active, status, created_at)
      VALUES ($id, $name, $path, $stack, $devCommand, $agentCommand, 0, 'idle', $now)
      ON CONFLICT(name) DO UPDATE SET
        path = excluded.path,
        stack = excluded.stack,
        dev_command = excluded.dev_command,
        agent_command = excluded.agent_command
    `).run({
      $id: crypto.randomUUID?.() || Math.random().toString(),
      $name: name,
      $path: path,
      $stack: stack,
      $devCommand: devCommand,
      $agentCommand: agentCommand,
      $now: new Date().toISOString()
    });
  },

  getProjects: (): any[] => {
    return db.query("SELECT * FROM projects ORDER BY is_active DESC, name ASC").all();
  },

  getActiveProject: (): any | null => {
    return db.query("SELECT * FROM projects WHERE is_active = 1 LIMIT 1").get() || null;
  },

  setActiveProject: (name: string): boolean => {
    db.query("UPDATE projects SET is_active = 0").run();
    const result = db.query("UPDATE projects SET is_active = 1 WHERE name = $name").run({ $name: name });
    return result.changes > 0;
  },

  updateProjectStatus: (projectId: string, status: string) => {
    db.query("UPDATE projects SET status = $status WHERE id = $id").run({ $status: status, $id: projectId });
  },

  deleteProject: (name: string): boolean => {
    const result = db.query("DELETE FROM projects WHERE name = $name").run({ $name: name });
    return result.changes > 0;
  },

  setMirrorMode: (projectId: string, enabled: boolean) => {
    db.query("UPDATE projects SET mirror_mode = $val WHERE id = $id").run({ $val: enabled ? 1 : 0, $id: projectId });
  },

  // =============== CRUD DE PROCESOS ===============

  addProcess: (projectId: string, type: string, command: string, pid: number | null = null, port: number | null = null): string => {
    const id = crypto.randomUUID?.() || Math.random().toString();
    db.query(`
      INSERT INTO processes (id, project_id, type, command, pid, status, port, last_output, started_at)
      VALUES ($id, $projectId, $type, $command, $pid, 'running', $port, '', $now)
    `).run({
      $id: id,
      $projectId: projectId,
      $type: type,
      $command: command,
      $pid: pid,
      $port: port,
      $now: new Date().toISOString()
    });
    return id;
  },

  updateProcess: (processId: string, updates: { pid?: number; status?: string; last_output?: string }) => {
    if (updates.pid !== undefined) {
      db.query("UPDATE processes SET pid = $pid WHERE id = $id").run({ $pid: updates.pid, $id: processId });
    }
    if (updates.status !== undefined) {
      db.query("UPDATE processes SET status = $status WHERE id = $id").run({ $status: updates.status, $id: processId });
    }
    if (updates.last_output !== undefined) {
      db.query("UPDATE processes SET last_output = $output WHERE id = $id").run({ $output: updates.last_output, $id: processId });
    }
  },

  getProcessesByProject: (projectId: string): any[] => {
    return db.query("SELECT * FROM processes WHERE project_id = $projectId").all({ $projectId: projectId });
  },

  getRunningProcesses: (): any[] => {
    return db.query("SELECT p.*, pr.name as project_name FROM processes p LEFT JOIN projects pr ON p.project_id = pr.id WHERE p.status = 'running'").all();
  },

  getProcessById: (processId: string): any | null => {
    return db.query("SELECT * FROM processes WHERE id = $id").get({ $id: processId });
  },

  deleteProcess: (processId: string) => {
    db.query("DELETE FROM processes WHERE id = $id").run({ $id: processId });
  },

  cleanStaleProcesses: () => {
    db.query("UPDATE processes SET status = 'stopped' WHERE status = 'running'").run();
  }
};
