import { Database } from "bun:sqlite";
import crypto from "crypto";

export type WhatsAppInboxStatus = "pending" | "processing" | "responded" | "failed";

export type WhatsAppInboxItem = {
  id: string;
  source_message_id: string;
  chat_id: string;
  sender_id: string;
  user_name: string | null;
  text: string;
  command_text: string;
  is_group: number;
  status: WhatsAppInboxStatus;
  attempt_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  responded_at: string | null;
};

const db = new Database("bun-ai-api.sqlite", { create: true });

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

// Performance Optimization: Add a compound index to whatsapp_inbox to significantly speed up
// the periodic background polling queries that fetch 'pending'/'failed' items ordered by 'created_at'.
// Without this index, every execution (every 10s) forces a full-table scan, degrading DB performance over time.
db.query("CREATE INDEX IF NOT EXISTS idx_whatsapp_inbox_status_created_at ON whatsapp_inbox(status, created_at);").run();

export const whatsappInboxService = {
  enqueue: (payload: {
    sourceMessageId: string;
    chatId: string;
    senderId: string;
    userName: string | null;
    text: string;
    commandText: string;
    isGroup: boolean;
  }) => {
    const now = new Date().toISOString();
    const existing = db.query(
      "SELECT * FROM whatsapp_inbox WHERE source_message_id = $sourceMessageId LIMIT 1"
    ).get({ $sourceMessageId: payload.sourceMessageId }) as WhatsAppInboxItem | null;

    if (existing) {
      return existing;
    }

    const item: WhatsAppInboxItem = {
      id: crypto.randomUUID(),
      source_message_id: payload.sourceMessageId,
      chat_id: payload.chatId,
      sender_id: payload.senderId,
      user_name: payload.userName,
      text: payload.text,
      command_text: payload.commandText,
      is_group: payload.isGroup ? 1 : 0,
      status: "pending",
      attempt_count: 0,
      last_error: null,
      created_at: now,
      updated_at: now,
      responded_at: null,
    };

    db.query(`
      INSERT INTO whatsapp_inbox (
        id, source_message_id, chat_id, sender_id, user_name, text, command_text,
        is_group, status, attempt_count, last_error, created_at, updated_at, responded_at
      ) VALUES (
        $id, $sourceMessageId, $chatId, $senderId, $userName, $text, $commandText,
        $isGroup, $status, $attemptCount, $lastError, $createdAt, $updatedAt, $respondedAt
      )
    `).run({
      $id: item.id,
      $sourceMessageId: item.source_message_id,
      $chatId: item.chat_id,
      $senderId: item.sender_id,
      $userName: item.user_name,
      $text: item.text,
      $commandText: item.command_text,
      $isGroup: item.is_group,
      $status: item.status,
      $attemptCount: item.attempt_count,
      $lastError: item.last_error,
      $createdAt: item.created_at,
      $updatedAt: item.updated_at,
      $respondedAt: item.responded_at,
    });

    return item;
  },

  getById: (id: string) => {
    return db.query("SELECT * FROM whatsapp_inbox WHERE id = $id LIMIT 1").get({ $id: id }) as WhatsAppInboxItem | null;
  },

  getPending: (limit = 50) => {
    // Performance Optimization: Using IN ('pending', 'failed') with ORDER BY prevents index-based
    // sorting in SQLite, forcing a temporary B-Tree sort. By using UNION ALL on two separate
    // index-backed queries, we maintain O(1) performance using the composite index.
    return db.query(`
      SELECT * FROM (
        SELECT * FROM whatsapp_inbox
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT $limit
      )
      UNION ALL
      SELECT * FROM (
        SELECT * FROM whatsapp_inbox
        WHERE status = 'failed'
        ORDER BY created_at ASC
        LIMIT $limit
      )
      ORDER BY created_at ASC
      LIMIT $limit
    `).all({ $limit: limit }) as WhatsAppInboxItem[];
  },

  markProcessing: (id: string) => {
    const now = new Date().toISOString();
    db.query(`
      UPDATE whatsapp_inbox
      SET status = 'processing',
          attempt_count = attempt_count + 1,
          updated_at = $now
      WHERE id = $id
    `).run({ $id: id, $now: now });
  },

  markResponded: (id: string) => {
    const now = new Date().toISOString();
    db.query(`
      UPDATE whatsapp_inbox
      SET status = 'responded',
          last_error = NULL,
          updated_at = $now,
          responded_at = $now
      WHERE id = $id
    `).run({ $id: id, $now: now });
  },

  markFailed: (id: string, error: string) => {
    const now = new Date().toISOString();
    db.query(`
      UPDATE whatsapp_inbox
      SET status = 'failed',
          last_error = $error,
          updated_at = $now
      WHERE id = $id
    `).run({ $id: id, $error: error.slice(0, 1000), $now: now });
  },
};
