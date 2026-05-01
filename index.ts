import { initializeServices, getActiveServices, getAllServicesStatus, initializeDatabase } from './services';
import { dbService } from './services/db';
import { startTelegramBot, sendMessage } from './telegram';
import { getRecentWhatsAppSenders, getWhatsAppState, listWhatsAppChats, renderWhatsAppQrHtml, restartWhatsAppBot, sendWhatsAppMessage, startWhatsAppBot } from './whatsapp';
import type { AIService, ChatMessage } from './types';
import { initMemoryCrons, memoryService } from './services/memory';
import { mcpService } from './services/mcpClient';
import { projectManager } from './services/projectManager';

// Asegurar que la base de datos está lista (tablas creadas)
dbService;

// Asegurar que la base de datos está lista (tablas creadas)
initializeDatabase();

// Iniciar Servidores MCP
await mcpService.initServers();

// Iniciar Project Manager (limpia procesos obsoletos del último reinicio)
projectManager.init();

// Instanciar crons de memoria
initMemoryCrons();

// Mapear ejecucion de recordatorios hacia la capa de Telegram si el canal es telegram
memoryService.onReminderExecute = (channel, userId, message) => {
  if (channel === 'telegram') {
    console.log(`[Recordatorio] Ejecutando recordatorio para Telegram user ${userId}: ${message}`);
    sendMessage(Number(userId), `⏰ *Recordatorio Automático:*\n\n${message}`);
  }
  if (channel === 'whatsapp') {
    console.log(`[Recordatorio] Ejecutando recordatorio para WhatsApp user ${userId}: ${message}`);
    sendWhatsAppMessage(userId, `Recordatorio automatico:\n\n${message}`).catch(console.error);
  }
};

// Mapear ejecución de toques proactivos hacia la capa de Telegram
memoryService.onProactiveNudge = (channel, userId, message) => {
  if (channel === 'telegram') {
    console.log(`[Proactivo] Enviando toque para Telegram user ${userId}: ${message}`);
    sendMessage(Number(userId), `🤖 *Hola:*\n\n${message}`);
  }
  if (channel === 'whatsapp') {
    console.log(`[Proactivo] Enviando toque para WhatsApp user ${userId}: ${message}`);
    sendWhatsAppMessage(userId, `Hola:\n\n${message}`).catch(console.error);
  }
};

// Initialize services and database at startup
await initializeServices();
initializeDatabase();
startTelegramBot();
void startWhatsAppBot().catch((error) => {
  console.error('[WhatsApp] Startup failed:', error);
});

let currentServiceIndex = 0;

// Exportamos solo la base nativa. En memoria usaremos este y las reglas almacenadas
export const SYSTEM_PROMPT_BASE: ChatMessage = {
  role: "system",
  content: `Eres un asistente virtual de inteligencia artificial avanzado y experto en desarrollo de software, automatización y gestión de proyectos. Operas bajo un sistema "Multi-Modelo" con memoria persistente.
    
Tus reglas de comportamiento persistentes son:
1. Responde siempre de forma amable, clara y profesional.
2. Utiliza tu memoria a largo plazo para personalizar la experiencia del usuario, recordando sus gustos, proyectos y errores pasados para no repetirlos.
3. Formatea tus respuestas usando Markdown (negritas, listas, bloques de código) para máxima legibilidad.
4. Eres consciente de que posees una infraestructura de base de datos SQLite donde se almacena el historial y las reglas aprendidas sobre el usuario. 
5. El idioma preferido es Español, a menos que se indique lo contrario.
6. Si detectas que el usuario te corrige un error, agradécelo y asegúrate de que esa "Lección Aprendida" se aplique en el futuro.`
};

function getNextService() {
  const services = getActiveServices();
  if (services.length === 0) return null;
  const service = services[currentServiceIndex];
  currentServiceIndex = (currentServiceIndex + 1) % services.length;
  return service;
}

const server = Bun.serve({
  port: process.env.PORT ?? 3000,
  async fetch(req) {
    const url = new URL(req.url);
    const { pathname } = url;

    // CORS Headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // API v1 Status Endpoint
    if (req.method === 'GET' && pathname === '/api/v1/status') {
      const status = getAllServicesStatus();
      return new Response(JSON.stringify(status), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // API v1 Chat Endpoint
    if (req.method === 'POST' && pathname === '/api/v1/chat') {
      const services = getActiveServices();

      if (services.length === 0) {
        return new Response(JSON.stringify({ error: "No AI services available" }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // We need to clone the JSON body if we were to read it multiple times, 
      // but here we just read it once.
      // However, req.json() can only be read once.
      let messages: ChatMessage[];
      let useStream = true; // Default to true

      try {
        const body = await req.json() as { messages: ChatMessage[], stream?: boolean | string };
        messages = body.messages;
        console.log("Received body stream param:", body.stream, "Type:", typeof body.stream);

        if (body.stream === false || body.stream === 'false') {
          useStream = false;
        } else if (body.stream === true || body.stream === 'true') {
          useStream = true;
        }
        console.log("Using stream mode:", useStream);
      } catch (e) {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: corsHeaders });
      }

      const requestId = crypto.randomUUID();
      const startTime = Date.now();

      // Token estimate (very rough: 4 chars per token)
      const tokenEstimate = messages.reduce((acc, m) => acc + (m.content?.length || 0), 0) / 4;

      const logData: any = {
        requestId,
        timestamp: new Date().toISOString(),
        providersTried: [],
        finalProvider: null,
        stream: useStream,
        tokenEstimate: Math.round(tokenEstimate),
        totalLatencyMs: 0,
        success: false,
        errorDetails: null
      };

      // Round Robin Start Index
      const startIndex = currentServiceIndex;
      // Advance global index for next request
      currentServiceIndex = (currentServiceIndex + 1) % services.length;

      let stream: AsyncIterable<string> | null = null;
      let usedService: AIService | null = null;
      let lastError: any = null;
      let errors: string[] = [];

      // Try each service starting from the current RR index
      for (let i = 0; i < services.length; i++) {
        const index = (startIndex + i) % services.length;
        const service = services[index];
        if (!service) continue;
        const serviceStart = Date.now();

        try {
          console.log(`[Attempt ${i + 1}/${services.length}] Trying service: ${service.name} (${service.model})...`);

          // Determine if validation allows us to skip known broken services
          // (Optional: check service.isValid !== false)

          // Inyectar Personalidad y Reglas Dinamicas Aprendidas
          const dynamicSystemRules = memoryService.getSystemPromptAndRules();
          const apiMessages = [...dynamicSystemRules, ...messages];

          stream = await service.chat(apiMessages);
          usedService = service;
          console.log(`✅ Request handled by ${service.name}`);

          logData.providersTried.push({
            name: service.name,
            status: "success",
            latencyMs: Date.now() - serviceStart
          });

          break; // Success!
        } catch (error: any) {
          console.error(`❌ Service ${service.name} failed:`, error.message);
          lastError = error;
          errors.push(`${service.name}: ${error.message}`);

          logData.providersTried.push({
            name: service.name,
            status: "failed",
            error: error.message,
            latencyMs: Date.now() - serviceStart
          });
          // Continue to next service
        }
      }

      if (!usedService || !stream) {
        console.error("All services failed.");
        logData.totalLatencyMs = Date.now() - startTime;
        logData.success = false;
        logData.errorDetails = "All AI services failed to respond.";
        dbService.insertRequestLog(logData);

        const isAllRateLimited = errors.every(e => e.includes('429') || e.includes('Quota') || e.includes('Balance'));

        return new Response(JSON.stringify({
          error: "All AI services failed to respond.",
          details: errors,
          lastError: lastError?.toString()
        }), {
          status: isAllRateLimited ? 429 : 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      logData.totalLatencyMs = Date.now() - startTime;
      logData.success = true;
      logData.finalProvider = usedService.name;
      // logData.model = usedService.model; // Optional, not in DB schema yet
      dbService.insertRequestLog(logData);

      try {
        const currentService = usedService!;
        const currentStream = stream!;

        // Handle Non-Streaming (Unified Response)
        if (!useStream) {
          const chunks: string[] = [];
          for await (const chunk of currentStream) {
            if (chunk) chunks.push(chunk);
          }
          const fullContent = chunks.join('');

          return new Response(JSON.stringify({
            service: currentService.name,
            model: currentService.model,
            content: fullContent,
            finish_reason: "stop"
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Handle Streaming (SSE)
        const sseStream = (async function* () {
          // Send start event with metadata
          yield `data: ${JSON.stringify({
            type: 'start',
            service: currentService.name,
            model: currentService.model
          })}\n\n`;

          for await (const chunk of currentStream) {
            if (chunk) {
              yield `data: ${JSON.stringify({
                type: 'chunk',
                content: chunk
              })}\n\n`;
            }
          }

          yield `data: ${JSON.stringify({ type: 'done' })}\n\n`;
          yield 'data: [DONE]\n\n'; // Standard termination
        })();

        return new Response(sseStream, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      } catch (error: any) {
        console.error("Streaming error:", error);
        // If headers are already sent (which they are implicitly by returning the Response object with stream),
        // we can't change the status code. The stream will just die.
        // But usually this catch block captures errors creating the stream generator, not the execution of it inside Response.
        return new Response(JSON.stringify({ error: "Stream setup failed" }), { status: 500, headers: corsHeaders });
      }
    }

    if (req.method === 'GET' && pathname === '/api/v1/whatsapp/status') {
      return new Response(JSON.stringify(getWhatsAppState()), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'GET' && pathname === '/api/v1/whatsapp/qr') {
      return renderWhatsAppQrHtml();
    }

    if (req.method === 'GET' && pathname === '/api/v1/whatsapp/chats') {
      try {
        const chats = await listWhatsAppChats();
        return new Response(JSON.stringify(chats), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message || 'Unable to list WhatsApp chats' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (req.method === 'GET' && pathname === '/api/v1/whatsapp/recent-senders') {
      return new Response(JSON.stringify(getRecentWhatsAppSenders()), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'POST' && pathname === '/api/v1/whatsapp/restart') {
      try {
        await restartWhatsAppBot();
        return new Response(JSON.stringify({ ok: true, status: getWhatsAppState() }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message || 'WhatsApp restart failed' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (pathname === '/webhooks/whatsapp') {
      if (req.method === 'GET') {
        return new Response("Not used. This project uses WhatsApp Web via WPPConnect.", {
          status: 410,
          headers: corsHeaders,
        });
      }

      if (req.method === 'POST') {
        return new Response("Not used. This project uses WhatsApp Web via WPPConnect.", {
          status: 410,
          headers: corsHeaders,
        });
      }
    }

    // 404
    return new Response("Not found", { status: 404, headers: corsHeaders });
  }
})

console.log(`Server is running on ${server.url}`);
