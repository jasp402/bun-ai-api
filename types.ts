export interface MessageContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
  };
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | MessageContentPart[];
}

export interface ServiceMetrics {
  remainingRequests?: number;
  remainingTokens?: number;
  resetTime?: number; // Timestamp
}

export interface AIService {
  name: string;
  model: string;
  supportsVision?: boolean; // Indica si el servicio soporta imágenes
  metrics?: ServiceMetrics; // Estado interno de métricas
  validate?: () => Promise<boolean>; // Método para validar la key
  chat: (messages: ChatMessage[]) => Promise<AsyncIterable<string>>;
}

export interface ServiceStatus {
  id: string;
  name: string;
  model: string;
  isOnline: boolean;
  isValid?: boolean; // New: Indica si la API Key es válida
  metrics?: ServiceMetrics; // New: Métricas de consumo
}

// =============== COMPONENTES DE MEMORIA ===============

export interface UserRecord {
  id: string;          // Discord/Telegram user ID o UUID si no hay
  name: string | null;
  channel: string;
  busy_until: string | null;      // ISO Date
  quiet_hours_start: string | null; // "HH:mm"
  quiet_hours_end: string | null;   // "HH:mm"
  nudge_delay_hours: number;        // Horas de inactividad para el toque proactivo
  created_at: string;
}

export interface ConversationRecord {
  id: string;
  user_id: string;
  channel: string;
  updated_at: string;
}

export interface MessageRecord {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  is_analyzed: boolean;
}

export interface MemoryRuleRecord {
  id: string;
  type: string;        // 'system_prompt', 'learned_rule', etc
  content: string;
  is_active: boolean;
  created_at: string;
}

export interface ReminderRecord {
  id: string;
  user_id: string;
  channel: string;
  message: string;
  execute_at: string;  // Fecha/Hora límite para enviar
  is_executed: boolean;
  created_at: string;
}

export interface McpServerConfig {
  id: string;
  name: string;
  type: 'stdio' | 'sse';
  command?: string;
  args?: string; // Serialized JSON array
  env?: string;  // Serialized JSON object
  url?: string;
  is_active: boolean;
  created_at: string;
}

export interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema: any;
}

// =============== SISTEMA DE PROYECTOS ===============

export interface ProjectRecord {
  id: string;
  name: string;
  path: string;
  stack: string;           // Tecnología: "Next.js", "Bun", "Python", etc.
  dev_command: string;     // Comando para levantar el servidor dev
  agent_command: string;   // Comando para el agente IA (gemini, claude, codex)
  is_active: boolean;      // Si está seleccionado como proyecto activo
  mirror_mode: boolean;    // Si está activado el modo espejo (logs duales)
  status: 'idle' | 'running' | 'error';
  created_at: string;
}

export interface ProcessRecord {
  id: string;
  project_id: string;
  type: 'dev_server' | 'agent' | 'tunnel' | 'custom';
  command: string;
  pid: number | null;
  status: 'running' | 'stopped' | 'error';
  port: number | null;
  last_output: string;     // Buffer circular de las últimas líneas de output
  started_at: string;
}