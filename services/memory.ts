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

    setUserBusy: (userId: string, untilIso: string | null) => {
        db.query("UPDATE users SET busy_until = $until WHERE id = $id").run({ $until: untilIso, $id: userId });
    },

    setUserQuietHours: (userId: string, start: string, end: string) => {
        db.query("UPDATE users SET quiet_hours_start = $start, quiet_hours_end = $end WHERE id = $id").run({
            $start: start,
            $end: end,
            $id: userId
        });
    },

    setUserNudgeDelay: (userId: string, hours: number) => {
        db.query("UPDATE users SET nudge_delay_hours = $hours WHERE id = $id").run({ $hours: hours, $id: userId });
    },

    createUser: (userId: string, name: string | null, channel: string): UserRecord => {
        const user = {
            id: userId,
            name,
            channel,
            busy_until: null,
            quiet_hours_start: '22:00',
            quiet_hours_end: '09:00',
            nudge_delay_hours: 12,
            created_at: new Date().toISOString()
        };
        db.query("INSERT INTO users (id, name, channel, created_at, nudge_delay_hours) VALUES ($id, $name, $channel, $createdAt, 12)").run({
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
    getSystemPromptAndRules: (userId?: string, userName?: string): ChatMessage[] => {
        // 1. Obtener User Data si existe
        let userContext = "";
        if (userId) {
            const userQuery = db.query("SELECT * FROM users WHERE id = $id LIMIT 1");
            const user = userQuery.get({ $id: userId }) as any;

            // Buscar datos específicos en memory_rules (tipo user_data)
            const userDataQuery = db.query("SELECT content FROM memory_rules WHERE type = 'user_data' AND is_active = 1");
            const data = userDataQuery.all() as { content: string }[];

            if (user || userName || data.length > 0) {
                userContext = `\n\n=== CONTEXTO DEL USUARIO ===\n`;
                userContext += `Estás hablando con: ${user?.name || userName || 'Usuario'}\n`;
                if (data.length > 0) {
                    userContext += `Información conocida:\n` + data.map(d => "- " + d.content).join("\n");
                }
                userContext += `\n============================\n`;
            }
        }

        // 2. Buscar si hay un prompt custom 
        const promptQuery = db.query("SELECT content FROM memory_rules WHERE type = 'system_prompt' AND is_active = 1 LIMIT 1");
        const customPrompt = promptQuery.get() as { content: string } | null;

        let baseContent = SYSTEM_PROMPT_BASE.content;
        if (customPrompt) {
            baseContent = customPrompt.content;
        }

        // 3. Agregar reglas activas y lecciones aprendidas
        const rulesQuery = db.query("SELECT content FROM memory_rules WHERE type = 'learned_rule' AND is_active = 1");
        const rules = rulesQuery.all() as { content: string }[];

        if (rules.length > 0) {
            baseContent += "\n\n=== REGLAS DE COMPORTAMIENTO Y LECCIONES APRENDIDAS ===\n" +
                "IMPORTANTE: Las siguientes son reglas que has aprendido para no repetir errores y mejorar tu servicio:\n" +
                rules.map(r => "- " + r.content).join("\n");
        }

        return [{ role: 'system', content: userContext + baseContent }];
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
    onProactiveNudge: null as ((channel: string, userId: string, message: string) => void) | null,
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

        // Marcar como analizados para no reprocesarlos de forma segura
        const updateStmt = db.query("UPDATE messages SET is_analyzed = 1 WHERE id = $id");
        const markAnalyzed = db.transaction((messages: MessageRecord[]) => {
            for (const msg of messages) {
                updateStmt.run({ $id: msg.id });
            }
        });
        markAnalyzed(msgs);

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
      1. Datos Vitales del Usuario: Nombre, Profesión/Trabajo, Intereses, Gustos personales.
      2. Contexto de Proyectos: Cuáles son sus proyectos favoritos o en los que más trabaja.
      3. Lecciones Aprendidas: Errores que la IA cometió y que el usuario corrigió, o instrucciones explícitas sobre "cómo NO hacer las cosas".
      4. SIEMPRE verifica si se te ha ordenado cambiar la forma fundamental en que actúas (generar nuevo SYSTEM_PROMPT).
      5. IMPORTANTE: Si un usuario te agendó/pidió que le recuerdes algo cronometrado (generar reminder).
      6. DISPONIBILIDAD: Detecta si el usuario indica que estará ocupado, de viaje o no disponible hasta cierta fecha o periodo.

      Responde EXCLUSIVAMENTE en formato JSON con la siguiente estructura (si no hay nada, null o array vacío):
      {
        "newSystemPrompt": "string o null si no cambió",
        "userData": {
           "name": "Nombre si lo detectas",
           "profession": "Trabajo/Rol",
           "interests": ["interés 1", "interés 2"],
           "favoriteProjects": ["proyecto 1"],
           "busyUntil": "ISO Date si el usuario indica que estará ocupado o no disponible hasta cierta fecha/hora, de lo contrario null"
        },
        "learnedRules": ["Regla de comportamiento o lección aprendida para no repetir errores"],
        "reminders": [
          {
            "userId": "ID del usuario",
            "message": "Mensaje exacto a recordarle",
            "executeAtIso": "ISO Date"
          }
        ]
      }
      
      Historial a analizar:
      ${JSON.stringify(msgs.map(m => `[${m.role}] ${m.content}`))}
      
      IMPORTANTE: Los datos en "userData" deben ser persistentes y acumulativos.
      La fecha/hora actual es: ${new Date().toISOString()}.
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

            const firstMsg = msgs[0];
            const sourceConversation = firstMsg
                ? db.query("SELECT user_id, channel FROM conversations WHERE id = $id").get({ $id: firstMsg.conversation_id }) as { user_id: string, channel: string } | null
                : null;
            const isWhatsAppConversation = sourceConversation?.channel === 'whatsapp';

            if (parsed.newSystemPrompt && !isWhatsAppConversation) {
                console.log("[Cron Memory] Actualizando System Prompt base");
                memoryService.saveCustomSystemPrompt(parsed.newSystemPrompt);
            }
            if (parsed.userData) {
                const { name, profession, interests, favoriteProjects, busyUntil } = parsed.userData;
                const m = memoryService as any;
                if (name) m.addUserData(`Nombre: ${name}`);
                if (profession) m.addUserData(`Profesión: ${profession}`);
                if (interests && Array.isArray(interests)) interests.forEach((i: string) => m.addUserData(`Interés: ${i}`));
                if (favoriteProjects && Array.isArray(favoriteProjects)) favoriteProjects.forEach((p: string) => m.addUserData(`Proyecto Favorito: ${p}`));
                
                if (busyUntil) {
                    const usrMsg = msgs.find(m => m.role === 'user');
                    if (usrMsg) {
                        const convQuery = db.query("SELECT user_id FROM conversations WHERE id = $id");
                        const conv = convQuery.get({ $id: usrMsg.conversation_id }) as { user_id: string };
                        if (conv) {
                            console.log(`[Cron Memory] Usuario ${conv.user_id} estará ocupado hasta ${busyUntil}`);
                            memoryService.setUserBusy(conv.user_id, busyUntil);
                        }
                    }
                }
            }
            if (!isWhatsAppConversation && parsed.learnedRules && Array.isArray(parsed.learnedRules)) {
                for (const rule of parsed.learnedRules) {
                    console.log("[Cron Memory] Nueva regla aprendida:", rule);
                    memoryService.addLearnedRule(rule);
                }
            }
            if (parsed.reminders && Array.isArray(parsed.reminders)) {
                for (const r of parsed.reminders) {
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

    // 3. Cron de Seguimiento Proactivo (Nudge) - Se ejecuta cada hora en el minuto 30
    cron.schedule("30 * * * *", async () => {
        console.log("[Cron] Verificando inactividad para seguimiento proactivo...");
        const now = new Date();
        const nowIso = now.toISOString();

        // Buscar conversaciones inactivas basándose en el delay preferido del usuario (en horas)
        // Se ignoran si han pasado más de 7 días (para no ser spammer en chats olvidados)
        const query = db.query(`
            SELECT c.*, u.name as user_name, u.busy_until, u.quiet_hours_start, u.quiet_hours_end, u.nudge_delay_hours
            FROM conversations c
            JOIN users u ON c.user_id = u.id
            WHERE datetime(c.updated_at, '+' || u.nudge_delay_hours || ' hours') <= datetime($now)
            AND c.updated_at >= datetime($now, '-7 days')
            AND (c.last_nudge_at IS NULL OR c.last_nudge_at < c.updated_at)
        `);

        const candidates = query.all({ $now: nowIso }) as any[];

        if (candidates.length === 0) return;
        
        const services = getActiveServices();
        const ai = services[0];
        if (!ai) return;

        for (const c of candidates) {
            // 1. Verificar si está ocupado
            if (c.busy_until && new Date(c.busy_until) > now) {
                console.log(`[Cron Nudge] Usuario ${c.user_id} está ocupado hasta ${c.busy_until}, saltando.`);
                continue;
            }

            // 2. Verificar horas de silencio
            const currentHour = now.getHours();
            const currentMin = now.getMinutes();
            const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')}`;

            const qStart = c.quiet_hours_start || "22:00";
            const qEnd = c.quiet_hours_end || "09:00";

            const isQuietTime = qStart > qEnd 
                ? (currentTimeStr >= qStart || currentTimeStr < qEnd) // Cruza la medianoche
                : (currentTimeStr >= qStart && currentTimeStr < qEnd);

            if (isQuietTime) {
                console.log(`[Cron Nudge] Usuario ${c.user_id} está en horas de silencio (${qStart}-${qEnd}), saltando.`);
                continue;
            }

            // 3. Generar Nudge con IA
            console.log(`[Cron Nudge] Generando mensaje proactivo para ${c.user_name || c.user_id} (Inactividad: ${c.nudge_delay_hours}h)`);
            
            // Determinar actitud según el delay
            let attitude = "amigable y equilibrada";
            if (c.nudge_delay_hours <= 3) attitude = "muy atenta, curiosa y un poco insistente (modo INTENSO)";
            else if (c.nudge_delay_hours >= 160) attitude = "muy relajada, casi como si te hubieras olvidado de escribir y acabas de recordar (modo OLVIDADIZO)";
            else if (c.nudge_delay_hours >= 40) attitude = "despreocupada y casual, sin ninguna presión (modo DESPREOCUPADO)";

            const history = memoryService.getRecentHistory(c.id, 5);
            const nudgePrompt = `
                Eres una IA asistente personal con una actitud ${attitude}. 
                Has notado que el usuario (${c.user_name || 'amigo'}) no ha interactuado contigo en más de ${c.nudge_delay_hours} horas.
                
                Instrucciones de estilo:
                - Escribe un mensaje muy BREVE (máximo 2 frases).
                - Refleja tu actitud de forma natural en el saludo.
                - Basándote en el último historial, pregunta cómo va o si necesita ayuda con algo específico.
                
                Últimos mensajes:
                ${JSON.stringify(history)}
            `;

            try {
                const stream = await ai.chat([{ role: 'user', content: nudgePrompt }]);
                let nudgeMessage = "";
                for await (const chunk of stream) if (chunk) nudgeMessage += chunk;

                if (memoryService.onProactiveNudge) {
                    memoryService.onProactiveNudge(c.channel, c.user_id, nudgeMessage.trim());
                    db.query("UPDATE conversations SET last_nudge_at = $now WHERE id = $id").run({
                        $now: now.toISOString(),
                        $id: c.id
                    });
                }
            } catch (e) {
                console.error(`[Cron Nudge] Error generando nudge para ${c.user_id}:`, e);
            }
        }
    });

    // Helper interno para guardar datos del usuario (inyectado al servicio)
    (memoryService as any).addUserData = (content: string) => {
        const exists = db.query("SELECT id FROM memory_rules WHERE type = 'user_data' AND content = $content LIMIT 1").get({ $content: content });
        if (!exists) {
            db.query(`
              INSERT INTO memory_rules (id, type, content, is_active, created_at) 
              VALUES ($id, 'user_data', $content, 1, $now)
            `).run({
                $id: crypto.randomUUID(),
                $content: content,
                $now: new Date().toISOString()
            });
        }
    };
}
