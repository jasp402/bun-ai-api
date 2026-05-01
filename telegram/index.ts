import { TELEGRAM_API, sendMessage, sendChatAction } from './utils';
export { sendMessage, sendChatAction };
import { memoryService } from '../services/memory';
import { projectManager } from '../services/projectManager';
import { automationService } from '../services/automationService';
import { textAnalyzerService } from '../services/textAnalyzerService';
import { agentService } from '../services/agent';
import { mcpService } from '../services/mcpClient';
import { dbService } from '../services/db';
import { getActiveServices } from '../services';
import type { ChatMessage, MessageContentPart } from '../types';


// Importación de comandos
import { handleStart } from './commands/start';
import { handleHelp } from './commands/help';
import { handleSetBio, handleSetDesc, handleSetPic } from './commands/admin';
import { handleProjects, handleSwitch } from './commands/projects';
import { handleAddProject, handleRmProject } from './commands/addproject';
import { handleRun, handleRunBg } from './commands/run';
import { handleStop, handleStopAll, handleMirror, handleStopNgrok } from './commands/stop';
import { handleStatus, handleLogs } from './commands/status';
import { handleAgent, handleNgrok } from './commands/agent';
import { handlePc, handleScreen, handleShell } from './commands/automation';
import { handleGodInvocation, handleExitAgent } from './commands/gods';
import { handleQuiet, handleBusy, handleFree, handleNudge } from './commands/availability';
import { explainCommand } from './docsService';

let currentServiceIndex = 0;

export async function startTelegramBot() {
    if (!process.env.TELEGRAM_BOT_API_KEY) {
        console.warn("Telegram bot disabled: TELEGRAM_BOT_API_KEY not set");
        return;
    }

    console.log("------------------------------------------");
    console.log("🤖 INICIANDO BOT v2.1 (BRIDGE MODE READY)");
    console.log("------------------------------------------");

    // Registrar comandos en el menú de Telegram
    await fetch(`${TELEGRAM_API}/setMyCommands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            commands: [
                { command: 'help', description: '📖 Ver ayuda y ejemplos' },
                { command: 'projects', description: '📂 Ver todos los proyectos' },
                { command: 'addproject', description: '➕ Nuevo proyecto (ej: /addproject mi-app)' },
                { command: 'rmproject', description: '🗑️ Borrar proyecto (ej: /rmproject mi-app)' },
                { command: 'switch', description: '🔀 Cambiar proyecto activo (ej: /switch mi-app)' },
                { command: 'run', description: '🖥️ Iniciar servidor (ej: /run npm start)' },
                { command: 'runbg', description: '🚀 Iniciar servidor en segundo plano' },
                { command: 'mirror', description: '🎭 Modo Espejo (Logs duales)' },
                { command: 'gemini', description: '🤖 Hablar con Gemini (ej: /gemini hola)' },
                { command: 'claude', description: '🤖 Hablar con Claude Code' },
                { command: 'codex', description: '🤖 Hablar con Codex (ej: /codex hola)' },
                { command: 'agent', description: '🤖 Iniciar agente IA del proyecto' },
                { command: 'ngrok', description: '🌐 Abrir túnel ngrok (ej: /ngrok 3000)' },
                { command: 'shell', description: '💻 Ejecutar en Windows (ej: /shell dir)' },
                { command: 'status', description: '📊 Ver procesos corriendo' },
                { command: 'logs', description: '📑 Ver logs recientes' },
                { command: 'stop', description: '🛑 Detener proyecto activo' },
                { command: 'stopall', description: '💀 Matar TODOS los procesos' },
                { command: 'quiet', description: '🤫 Horas de silencio (ej: /quiet 22:00 09:00)' },
                { command: 'busy', description: '🔋 Modo ocupado (ej: /busy un rato)' },
                { command: 'free', description: '🔓 Volver a estar libre' },
                { command: 'nudge', description: '🔔 Cuándo te escribo (ej: /nudge relajado)' },
                { command: 'start', description: '👋 Mensaje de bienvenida' },
            ]
        })
    })
.then(() => console.log("✅ Bot commands registered in Telegram menu."))
        .catch(err => console.error("Failed to set bot commands:", err));

    let offset = 0;

    while (true) {
        try {
            const response = await fetch(`${TELEGRAM_API}/getUpdates?offset=${offset}&timeout=30`);
            if (!response.ok) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }

            const data = await response.json() as any;
            if (!data.ok || !data.result) continue;

            for (const update of data.result) {
                offset = update.update_id + 1;
                if (update.message && update.message.text) {
                    handleMessage(update.message).catch(console.error);
                }
            }
        } catch (error) {
            console.error("Error en polling de Telegram:", error);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

async function handleMessage(message: any) {
    const chatId = message.chat.id;
    const text = message.text || message.caption || "";
    const textLower = text.toLowerCase().trim();
    const userIdStr = message.from.id.toString();
    const userName = message.from.first_name || message.from.username || null;

    // Gestión de Memoria
    let user = memoryService.getUser(userIdStr, 'telegram');
    if (!user) {
        user = memoryService.createUser(userIdStr, userName, 'telegram');
    }
    const convId = memoryService.getOrCreateConversation(userIdStr, 'telegram');

    let image_url: string | undefined = undefined;

    // Detección de Imágenes
    if (message.photo && message.photo.length > 0) {
        const fileId = message.photo[message.photo.length - 1].file_id; // Foto con mayor resolución
        try {
            const fileResp = await fetch(`${TELEGRAM_API}/getFile?file_id=${fileId}`);
            const fileData = await fileResp.json() as any;
            if (fileData.ok) {
                image_url = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_API_KEY}/${fileData.result.file_path}`;
                console.log(`📸 [Telegram] Imagen detectada: ${image_url}`);
            }
        } catch (e) {
            console.error("Error obteniendo URL de imagen en Telegram:", e);
        }
    }

    console.log(`\n📩 [Telegram] Nuevo mensaje de ${userName || userIdStr}: "${text}" ${image_url ? '(con imagen)' : ''}`);
    const activeProject = projectManager.getActiveProject();
    console.log(`   [Context] Proyecto Activo: ${activeProject?.name || 'NINGUNO'}`);

    // --- INTERCEPTOR DE AYUDA POR COMANDO ---
    // Detecta patrones como /run ? o /run? o /run ayuda
    if (text.startsWith('/') && (text.endsWith('?') || text.endsWith(' ayuda') || text.includes(' ? '))) {
        const cmdPart = text.split(' ')[0].replace('?', '');
        console.log(`[Docs] Solicitando ayuda para el comando: ${cmdPart}`);
        return explainCommand(cmdPart, message);
    }

    // --- ENRUTADOR DE COMANDOS ---
    if (textLower.startsWith('/start')) return handleStart(message);
    if (textLower === '/help') return handleHelp(message);

    if (textLower.startsWith('/setbio')) return handleSetBio(message, text.substring(7).trim());
    if (textLower.startsWith('/setdesc')) return handleSetDesc(message, text.substring(8).trim());
    if (textLower.startsWith('/setpic')) return handleSetPic(message);

    if (textLower === '/projects') return handleProjects(message);
    if (textLower.startsWith('/switch')) return handleSwitch(message, text.substring(7).trim());
    if (textLower.startsWith('/addproject')) return handleAddProject(message, text.substring(11).trim());
    if (textLower.startsWith('/rmproject')) return handleRmProject(message, text.substring(10).trim());

    if (textLower.startsWith('/run')) return handleRun(message, text.substring(4).trim());
    if (textLower === '/runbg') return handleRunBg(message);
    if (textLower === '/status') return handleStatus(message);
    if (textLower === '/logs') return handleLogs(message);
    if (textLower === '/mirror') return handleMirror(message);

    if (textLower.startsWith('/agent')) return handleAgent(message, text.substring(6).trim());
    if (textLower.startsWith('/ngrok')) return handleNgrok(message, text.substring(6).trim());

    if (textLower.startsWith('/gemini')) return handleGodInvocation(message, 'gemini', text.split(' ').slice(1).join(' ').trim());
    if (textLower.startsWith('/claude')) return handleGodInvocation(message, 'claude', text.split(' ').slice(1).join(' ').trim());
    if (textLower.startsWith('/codex')) return handleGodInvocation(message, 'codex', text.split(' ').slice(1).join(' ').trim());
    if (textLower === '/exitagent') return handleExitAgent(message);

    if (textLower === '/stopall') return handleStopAll(message);
    if (textLower === '/stopngrok') return handleStopNgrok(message);
    if (textLower.startsWith('/stop')) return handleStop(message);

    if (textLower.startsWith('/shell')) return handleShell(message, text.substring(6).trim());
    if (textLower.startsWith('/pc')) return handlePc(message, text.substring(4).trim());
    if (textLower === '/screen') return handleScreen(message);

    if (textLower.startsWith('/quiet')) return handleQuiet(message, text.substring(7).trim());
    if (textLower.startsWith('/busy')) return handleBusy(message, text.substring(6).trim());
    if (textLower === '/free') return handleFree(message);
    if (textLower.startsWith('/nudge')) return handleNudge(message, text.substring(6).trim());

    // --- MODO PUENTE (Pasar a Terminal Activa) ---
    if (activeProject && !text.startsWith('/')) {
        // ... (el puente AHK no soporta imágenes nativamente via focusAndType por ahora, avisamos)
        if (image_url) {
            await sendMessage(chatId, "⚠️ El modo puente (terminal activa) no soporta envío de imágenes directamente. Usaré el chat IA estándar.");
        } else {
            console.log(`[Bridge] Buscando agente para proyecto: ${activeProject.name}`);
            const runningProcs = dbService.getRunningProcesses().filter(p =>
                p.project_id === activeProject.id && p.type === 'agent'
            );

            if (runningProcs.length > 0) {
                const proc = runningProcs[0];
                const god = (proc.command.toLowerCase().includes('gemini')) ? 'GEMINI' :
                    (proc.command.toLowerCase().includes('claude')) ? 'CLAUDE' :
                    (proc.command.toLowerCase().includes('codex')) ? 'CODEX' : 'AGENT';

                const winTitle = `AGENT-${god}-${activeProject.id.substring(0, 8)}`;
                console.log(`[Bridge] Agente ${god} encontrado (PID: ${proc.pid}). Buscando ventana: "${winTitle}"`);

                try {
                    const exists = await automationService.quickAction.windowExists(winTitle, proc.pid);
                    console.log(`[Bridge] Resultado windowExists: ${exists}`);
                    if (exists) {
                        await sendChatAction(chatId, 'typing');
                        memoryService.saveMessage(convId, 'user', text);
                        console.log(`[Bridge] Enviando '${text.substring(0, 20)}...' a la ventana PID: ${proc.pid}`);
                        await automationService.quickAction.focusAndType(winTitle, text, proc.pid);
                        console.log(`[Bridge] Envío a la ventana completado en AHK.`);

                        await sendMessage(chatId, `⚡ Mensaje enviado verificando IA...`);

                        let attempts = 0;
                        const maxAttempts = 15;
                        let lastScreenText = "";
                        let consecutiveMatches = 0;

                        const checkInterval = setInterval(async () => {
                            attempts++;
                            try {
                                const screenText = await automationService.quickAction.readTerminalContent(winTitle);
                                if (!screenText) return;

                                const responseBlock = textAnalyzerService.extractLatestResponse(screenText, text);
                                const lowerBlock = responseBlock.toLowerCase();
                                const isPrompting =
                                    lowerBlock.includes("allow execution of mcp") ||
                                    lowerBlock.includes("action required") ||
                                    lowerBlock.includes("1. allow once") ||
                                    lowerBlock.includes("select an option:") ||
                                    lowerBlock.includes("yes/no");

                                const isFinished = responseBlock.endsWith(">") || responseBlock.endsWith("$") || responseBlock.endsWith("~");

                                if (responseBlock === lastScreenText && responseBlock.length > 0) {
                                    consecutiveMatches++;
                                } else {
                                    consecutiveMatches = 0;
                                }
                                lastScreenText = responseBlock;

                                if (isPrompting || isFinished || consecutiveMatches >= 2 || attempts >= maxAttempts) {
                                    clearInterval(checkInterval);
                                    if (responseBlock.length > 0) {
                                        memoryService.saveMessage(convId, 'assistant', responseBlock);
                                        const formattedHtml = textAnalyzerService.formatForTelegram(responseBlock);
                                        const CHUNK_SIZE = 4000;
                                        let currentIndex = 0;
                                        const totalChunks = Math.ceil(formattedHtml.length / CHUNK_SIZE);
                                        let chunkNumber = 1;

                                        while (currentIndex < formattedHtml.length) {
                                            let chunk = formattedHtml.substring(currentIndex, currentIndex + CHUNK_SIZE);
                                            let prefix = isPrompting ? `⚠️ <b>[ACCIÓN REQUERIDA ${god}]</b>` : `🤖 <b>[${god}]</b>`;
                                            if (totalChunks > 1) prefix += ` <i>(Parte ${chunkNumber}/${totalChunks})</i>`;
                                            await sendMessage(chatId, `${prefix}:\n<pre>${chunk}</pre>`);
                                            currentIndex += CHUNK_SIZE;
                                            chunkNumber++;
                                            if (currentIndex < formattedHtml.length) await new Promise(r => setTimeout(r, 500));
                                        }
                                    }
                                }
                            } catch (e: any) {
                                clearInterval(checkInterval);
                            }
                        }, 3000);

                        return;
                    }
                } catch (e: any) {
                    console.error(`[Bridge] Error verificando ventana:`, e.message);
                }
            }
        }
    }

    // --- CHAT CON IA (Fallback) ---
    if (text.startsWith('/') && !image_url) {
        await sendMessage(chatId, `❌ Command <code>${text.split(' ')[0]}</code> not recognized.\nUse <code>/help</code> to see available commands.`);
        return;
    }

    await handleChatRoundRobin(message, convId, image_url);
}

async function handleChatRoundRobin(message: any, convId: string, image_url?: string) {
    const chatId = message.chat.id;
    const text = message.text || message.caption || "";
    let services = getActiveServices();

    if (image_url) {
        services = services.filter(s => s.supportsVision);
        if (services.length === 0) {
            await sendMessage(chatId, "⚠️ He recibido una imagen pero no tengo configurada ninguna IA con capacidades de visión actualmente (Gemini u OpenAI).");
            return;
        }
    }

    if (services.length === 0) {
        await sendMessage(chatId, "⚠️ No hay servicios de IA disponibles.");
        return;
    }

    const startIndex = currentServiceIndex;
    currentServiceIndex = (currentServiceIndex + 1) % services.length;

    const userMessageContent = image_url ? [
        { type: 'text', text },
        { type: 'image_url', image_url: { url: image_url } }
    ] : text;

    memoryService.saveMessage(convId, 'user', typeof userMessageContent === 'string' ? userMessageContent : JSON.stringify(userMessageContent));

    const user = memoryService.getUser(message.from.id.toString(), 'telegram');
    const systemRules = memoryService.getSystemPromptAndRules(message.from.id.toString(), message.from.first_name);
    const basePrompt = systemRules[0] || { role: 'system', content: '' };
    const systemPromptWithTools = agentService.injectToolsToPrompt(basePrompt);
    const history = memoryService.getRecentHistory(convId, 20);

    // Convertimos el historial cargado (strings JSON si eran multimodales) a objetos reales si es necesario
    const parsedHistory = history.map(h => {
        if (h.role === 'user' && typeof h.content === 'string' && h.content.startsWith('[')) {
            try {
                return { ...h, content: JSON.parse(h.content) as MessageContentPart[] };
            } catch {
                return h;
            }
        }
        return h;
    });

    let messagesToSend: ChatMessage[] = [systemPromptWithTools, ...parsedHistory];
    // Aseguramos que el ÚLTIMO mensaje sea el actual con el objeto multimodal real
    const lastMsg = messagesToSend[messagesToSend.length - 1];
    if (lastMsg) lastMsg.content = userMessageContent;

    for (let i = 0; i < services.length; i++) {
        const service = services[(startIndex + i) % services.length];
        if (!service) continue;
        try {
            let agentLoopCount = 0;
            const MAX_AGENT_STEPS = 5;
            let fullContent = "";

            while (agentLoopCount < MAX_AGENT_STEPS) {
                agentLoopCount++;
                await sendChatAction(chatId, 'typing');
                const stream = await service.chat(messagesToSend);
                fullContent = "";
                for await (const chunk of stream) if (chunk) fullContent += chunk;

                const toolCalls = agentService.parseToolCalls(fullContent);
                if (toolCalls && toolCalls.length > 0) {
                    messagesToSend.push({ role: 'assistant', content: fullContent });
                    for (const call of toolCalls) {
                        try {
                            let result: any;
                            if (call.server === 'automation') {
                                if (call.tool === 'ahk_run') result = await automationService.runAhk(call.args.code);
                                else if (call.tool === 'screenshot') {
                                    const path = await automationService.quickAction.takeScreenshot();
                                    if (path) {
                                        result = { status: "Captura enviada al chat." };
                                    }
                                }
                            } else {
                                result = await mcpService.callTool(call.server, call.tool, call.args);
                            }
                            messagesToSend.push(agentService.formatToolResult(call.tool, result, false));
                        } catch (e: any) {
                            messagesToSend.push(agentService.formatToolResult(call.tool, { error: e.message }, true));
                        }
                    }
                    continue;
                }
                break;
            }

            const finalCleanContent = agentService.cleanFinalResponse(fullContent);
            const finalHtmlContent = agentService.escapeHTML(finalCleanContent);
            if (finalHtmlContent.trim().length > 0) {
                await sendMessage(chatId, finalHtmlContent);
                memoryService.saveMessage(convId, 'assistant', finalCleanContent);
            }
            return;
        } catch (error: any) {
            console.error(`[Telegram] Service ${service.name} failed:`, error.message);
        }
    }
}
