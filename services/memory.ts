import { Database } from "bun:sqlite";
import cron from "node-cron";
import crypto from "crypto";
import type { ChatMessage, UserRecord, ConversationRecord, MessageRecord, MemoryRuleRecord, ReminderRecord } from "../types";
import { SYSTEM_PROMPT_BASE } from "../index";
import { getActiveServices } from "./index";

// Este servicio debe ser instanciado con la misma conexión DB (reusaremos el dbService global si es posible o interactuamos directo)
// Como instanciamos db.ts, lo mejor es exportar la instancia `db` allí, pero si no está exportada, la abrimos igual o exportamos `db` desde `db.ts`.

// Para simplificar y no tocar db.ts mas que lo necesario, interactuaremos abriendo la DB localmente (Bun optimiza esto).
const db = new Database("bun-ai-api.sqlite", { create: true });

export const memoryService = {
    // === USUARIOS Y SESIONES ===
    getUser: (userId: string, channel: string): UserRecord | null => {
        const query = db.query("SELECT * FROM users WHERE id = $id AND channel = $channel");
        return query.get({ $id: userId, $channel: channel }) as UserRecord | null;
    },

    createUser: (userId: string, name: string | null, channel: string): UserRecord => {
        const user = {
            id: userId,
            name,
            channel,
            created_at: new Date().toISOString()
        };
        db.query("INSERT INTO users (id, name, channel, created_at) VALUES ($id, $name, $channel, $createdAt)").run({
            $id: user.id,
            $name: user.name,
            $channel: user.channel,
            $createdAt: user.created_at
        });
        return user;
    },

    getOrCreateConversation: (userId: string, channel: string): string => {
        const q1 = db.query("SELECT id FROM conversations WHERE user_id = $userId AND channel = $channel LIMIT 1");
        const existing = q1.get({ $userId: userId, $channel: channel }) as { id: string } | null;
        if (existing) {
            db.query("UPDATE conversations SET updated_at = $now WHERE id = $id").run({
                $now: new Date().toISOString(),
                $id: existing.id
            });
            return existing.id;
        }

        const newId = crypto.randomUUID();
        db.query("INSERT INTO conversations (id, user_id, channel, updated_at) VALUES ($id, $userId, $channel, $now)").run({
            $id: newId,
            $userId: userId,
            $channel: channel,
            $now: new Date().toISOString()
        });
        return newId;
    },

    // === HISTORIAL Y MENSAJES ===
    saveMessage: (conversationId: string, role: 'user' | 'assistant' | 'system', content: string): MessageRecord => {
        const msg = {
            id: crypto.randomUUID(),
            conversation_id: conversationId,
            role,
            content,
            timestamp: new Date().toISOString(),
            is_analyzed: 0
        };
        db.query(`
      INSERT INTO messages (id, conversation_id, role, content, timestamp, is_analyzed) 
      VALUES ($id, $conversationId, $role, $content, $timestamp, 0)
    `).run({
            $id: msg.id,
            $conversationId: msg.conversation_id,
            $role: msg.role,
            $content: msg.content,
            $timestamp: msg.timestamp
        });
        return { ...msg, is_analyzed: false };
    },

    getRecentHistory: (conversationId: string, limit: number = 20): ChatMessage[] => {
        const query = db.query(`
      SELECT role, content FROM messages 
      WHERE conversation_id = $conversationId 
      ORDER BY timestamp DESC LIMIT $limit
    `);
        const results = query.all({ $conversationId: conversationId, $limit: limit }) as { role: string, content: string }[];

        // Necesitamos devolver en orden cronológico (desc revierte los últimos)
        return results.reverse().map(r => ({
            role: r.role as 'user' | 'assistant' | 'system',
            content: r.content
        }));
    },

    // === REGLAS Y PERSONALIDAD ===
    getSystemPromptAndRules: (): ChatMessage[] => {
        // Buscar si hay un prompt custom 
        const promptQuery = db.query("SELECT content FROM memory_rules WHERE type = 'system_prompt' AND is_active = 1 LIMIT 1");
        const customPrompt = promptQuery.get() as { content: string } | null;

        let baseContent = SYSTEM_PROMPT_BASE.content;
        if (customPrompt) {
            baseContent = customPrompt.content;
        }

        // Agregar reglas activas
        const rulesQuery = db.query("SELECT content FROM memory_rules WHERE type = 'learned_rule' AND is_active = 1");
        const rules = rulesQuery.all() as { content: string }[];

        if (rules.length > 0) {
            baseContent += "\n\nAdicionalmente, has aprendido las siguientes reglas sobre el usuario o el sistema:\n" + rules.map(r => "- " + r.content).join("\n");
        }

        return [{ role: 'system', content: baseContent }];
    },

    saveCustomSystemPrompt: (content: string) => {
        // Desactivar el actual
        db.query("UPDATE memory_rules SET is_active = 0 WHERE type = 'system_prompt'").run();
        // Insertar nuevo
        db.query(`
      INSERT INTO memory_rules (id, type, content, is_active, created_at) 
      VALUES ($id, 'system_prompt', $content, 1, $now)
    `).run({
            $id: crypto.randomUUID(),
            $content: content,
            $now: new Date().toISOString()
        });
    },

    addLearnedRule: (content: string) => {
        db.query(`
      INSERT INTO memory_rules (id, type, content, is_active, created_at) 
      VALUES ($id, 'learned_rule', $content, 1, $now)
    `).run({
            $id: crypto.randomUUID(),
            $content: content,
            $now: new Date().toISOString()
        });
    },

    // === RECORDATORIOS ===
    addReminder: (userId: string, channel: string, message: string, executeAtIso: string) => {
        console.log("[MemoryService] Añadiendo recordatorio para", userId, "a las", executeAtIso);
        db.query(`
      INSERT INTO reminders (id, user_id, channel, message, execute_at, is_executed, created_at) 
      VALUES ($id, $userId, $channel, $message, $executeAt, 0, $now)
    `).run({
            $id: crypto.randomUUID(),
            $userId: userId,
            $channel: channel,
            $message: message,
            $executeAt: executeAtIso,
            $now: new Date().toISOString()
        });
    },

    // Callback setter for reminder execution (to be injected by index.ts/telegram.ts)
    onReminderExecute: null as ((channel: string, userId: string, message: string) => void) | null,
};

// === CRON JOBS ===
export function initMemoryCrons() {
    console.log("Iniciando CronJobs de memoria...");

    // 1. Cron de ejecución de recordatorios (se ejecuta cada minuto)
    cron.schedule("* * * * *", () => {
        const nowIso = new Date().toISOString();
        const query = db.query("SELECT * FROM reminders WHERE is_executed = 0 AND execute_at <= $now");
        const reminders = query.all({ $now: nowIso }) as ReminderRecord[];

        if (reminders.length > 0) {
            console.log(`[Cron] Ejecutando ${reminders.length} recordatorios pendientes.`);

            for (const r of reminders) {
                if (memoryService.onReminderExecute) {
                    try {
                        memoryService.onReminderExecute(r.channel, r.user_id, r.message);
                        db.query("UPDATE reminders SET is_executed = 1 WHERE id = $id").run({ $id: r.id });
                    } catch (error) {
                        console.error("[Cron Reminder Error]", error);
                    }
                } else {
                    console.warn("[Cron] Recordatorio pendiente pero callback onReminderExecute no está configurado.");
                }
            }
        }
    });

    // 2. Cron de Análisis de Memoria (se ejecuta cada hora)
    cron.schedule("0 * * * *", async () => {
        console.log("[Cron] Iniciando análisis de memoria/conversaciones...");
        // Obtener mensajes no analizados, agrupados por conversacion
        const query = db.query("SELECT * FROM messages WHERE is_analyzed = 0 ORDER BY timestamp ASC LIMIT 100");
        const msgs = query.all() as MessageRecord[];

        if (msgs.length === 0) return;

        // Marcar como analizados para no reprocesarlos
        const ids = msgs.map(m => `'${m.id}'`).join(",");
        db.query(`UPDATE messages SET is_analyzed = 1 WHERE id IN (${ids})`).run();

        // Obtener servicio activo de IA para procesar
        const services = getActiveServices();
        if (services.length === 0) return;
        const ai = services[0]; // Usar el primero disponible para el cron en background
        if (!ai) return;

        // Armar prompt de meta-análisis
        const metaPrompt = `
      Eres un módulo de análisis de memoria en background de la IA.
      Tu tarea es analizar el siguiente historial reciente de mensajes entre usuarios y tú (la IA).
      Debes identificar:
      1. Si se te ha ordenado cambiar la forma fundamental en que actúas (generar nuevo SYSTEM_PROMPT).
      2. Si aprendiste datos vitales o preferencias del usuario (generar learned_rule).
      3. IMPORTANTE: Si un usuario te agendó/pidió que le recuerdes algo cronometrado (generar reminder). \n 
      Responde EXCLUSIVAMENTE en formato JSON con la siguiente estructura (si no hay nada, array vacío en cada uno):
      {
        "newSystemPrompt": "string o null si no cambió",
        "learnedRules": ["regla 1", "regla 2"],
        "reminders": [
          {
            "userId": "extraído del mensaje de la IA o el contexto si es posible",
            "message": "Mensaje exacto a recordarle al usuario",
            "executeAtIso": "Fecha ISO-8601 ej. 2026-03-07T14:00:00Z"
          }
        ]
      }
      
      Historial a analizar:
      ${JSON.stringify(msgs.map(m => `[${m.role}] ${m.content}`))}
      
      La fecha/hora actual es: ${new Date().toISOString()}. Úsala como base para los recordatorios como 'dentro de 10 minutos' o 'mañana'.
    `;

        try {
            const stream = await ai.chat([{ role: 'user', content: metaPrompt }]);
            let jsonResponseStr = "";
            for await (const chunk of stream) {
                if (chunk) jsonResponseStr += chunk;
            }

            // Limpiar markdown si el IA responde con backticks
            jsonResponseStr = jsonResponseStr.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();

            let parsed: any;
            try {
                parsed = JSON.parse(jsonResponseStr);
            } catch (e) {
                console.warn("[Cron Memory] La respuesta de la IA no fue un JSON válido, ignorando este ciclo:", jsonResponseStr);
                return; // Ignoramos este ciclo, se retomará en la siguiente hora con más o los mismos mensajes.
            }

            if (parsed.newSystemPrompt) {
                console.log("[Cron Memory] Actualizando System Prompt base");
                memoryService.saveCustomSystemPrompt(parsed.newSystemPrompt);
            }
            if (parsed.learnedRules && Array.isArray(parsed.learnedRules)) {
                for (const rule of parsed.learnedRules) {
                    console.log("[Cron Memory] Nueva regla aprendida:", rule);
                    memoryService.addLearnedRule(rule);
                }
            }
            if (parsed.reminders && Array.isArray(parsed.reminders)) {
                for (const r of parsed.reminders) {
                    // Nota: El cron no sabe el channel/userid exacto salvo que lo cruce.
                    // En la practica real se enviaria userId completo desde el meta-análisis. 
                    // Buscamos que usuario lo pidio basandonos en la DB o inferimos del contexto.
                    // Para simplificar, pondremos channel telegram fijo y cruzamos del historial.

                    // Buscar de qué usuario era ese mensaje aproximadamente (primer msg de usuario no analizado antes)
                    const usrMsg = msgs.find(m => m.role === 'user');
                    if (usrMsg) {
                        const convQuery = db.query("SELECT user_id, channel FROM conversations WHERE id = $id");
                        const conv = convQuery.get({ $id: usrMsg.conversation_id }) as { user_id: string, channel: string };
                        if (conv) {
                            memoryService.addReminder(conv.user_id, conv.channel, r.message, r.executeAtIso);
                        }
                    }
                }
            }
        } catch (e) {
            console.error("[Cron Memory] Error analizando el historial", e);
        }
    });
}
