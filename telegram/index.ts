import { TELEGRAM_API, sendMessage, sendChatAction } from './utils';
export { sendMessage, sendChatAction };
import { memoryService } from '../services/memory';
import { projectManager } from '../services/projectManager';
import { automationService } from '../services/automationService';
import { agentService } from '../services/agent';
import { mcpService } from '../services/mcpClient';
import { dbService } from '../services/db';
import { getActiveServices } from '../services';
import type { ChatMessage } from '../types';


// Importación de comandos
import { handleStart } from './commands/start';
import { handleHelp } from './commands/help';
import { handleSetBio, handleSetDesc, handleSetPic } from './commands/admin';
import { handleProjects, handleSwitch } from './commands/projects';
import { handleAddProject, handleRmProject } from './commands/addproject';
import { handleRun, handleRunBg } from './commands/run';
import { handleStop, handleStopAll, handleMirror } from './commands/stop';
import { handleStatus, handleLogs } from './commands/status';
import { handleAgent, handleNgrok } from './commands/agent';
import { handlePc, handleScreen, handleShell } from './commands/automation';
import { handleGodInvocation, handleExitAgent } from './commands/gods';

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
                { command: 'help', description: '📖 Show available commands' },
                { command: 'projects', description: '📂 List all registered projects' },
                { command: 'addproject', description: '➕ Register a new project' },
                { command: 'rmproject', description: '🗑️ Remove a project' },
                { command: 'switch', description: '🔀 Switch active project' },
                { command: 'run', description: '🖥️ Start dev server (Visible Window)' },
                { command: 'runbg', description: '🚀 Start dev server (Background)' },
                { command: 'mirror', description: '🎭 Toggle Mirror Mode (Dual Logs)' },
                { command: 'gemini', description: '🤖 Invocación de Agente Gemini' },
                { command: 'claude', description: '🤖 Invocación de Agente Claude' },
                { command: 'codex', description: '🤖 Invocación de Agente Codex' },
                { command: 'agent', description: '🤖 Start AI agent' },
                { command: 'ngrok', description: '🌐 Start ngrok tunnel' },
                { command: 'shell', description: '💻 Run native command (Win)' },
                { command: 'status', description: '📊 Show running processes' },
                { command: 'logs', description: '📑 Show recent project logs' },
                { command: 'stop', description: '🛑 Stop active project' },
                { command: 'stopall', description: '💀 Stop ALL processes' },
                { command: 'start', description: '👋 Welcome message' },
            ]
        })
    }).then(() => console.log("✅ Bot commands registered in Telegram menu."))
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
    const text = message.text;
    const textLower = text.toLowerCase().trim();
    const userIdStr = message.from.id.toString();
    const userName = message.from.first_name || message.from.username || null;

    // Gestión de Memoria
    let user = memoryService.getUser(userIdStr, 'telegram');
    if (!user) {
        user = memoryService.createUser(userIdStr, userName, 'telegram');
    }
    const convId = memoryService.getOrCreateConversation(userIdStr, 'telegram');

    console.log(`\n📩 [Telegram] Nuevo mensaje de ${userName || userIdStr}: "${text}"`);
    const activeProject = projectManager.getActiveProject();
    console.log(`   [Context] Proyecto Activo: ${activeProject?.name || 'NINGUNO'}`);

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
    if (textLower.startsWith('/stop')) return handleStop(message);

    if (textLower.startsWith('/shell')) return handleShell(message, text.substring(6).trim());
    if (textLower.startsWith('/pc')) return handlePc(message, text.substring(4).trim());
    if (textLower === '/screen') return handleScreen(message);

    // --- MODO PUENTE (Pasar a Terminal Activa) ---
    if (activeProject && !text.startsWith('/')) {
        console.log(`[Bridge] Buscando agente para proyecto: ${activeProject.name}`);
        const runningProcs = dbService.getRunningProcesses().filter(p =>
            p.project_id === activeProject.id && p.type === 'agent'
        );

        if (runningProcs.length > 0) {
            const proc = runningProcs[0];
            // Importante: El winTitle debe coincidir con el formato de projectManager: AGENT-GOD-ID8
            const god = (proc.command.toLowerCase().includes('gemini')) ? 'GEMINI' :
                (proc.command.toLowerCase().includes('claude')) ? 'CLAUDE' : 'AGENT';

            const winTitle = `AGENT-${god}-${activeProject.id.substring(0, 8)}`;
            console.log(`[Bridge] Agente ${god} encontrado (PID: ${proc.pid}). Buscando ventana: "${winTitle}"`);

            try {
                const exists = await automationService.quickAction.windowExists(winTitle, proc.pid);
                console.log(`[Bridge] Resultado windowExists: ${exists}`);
                if (exists) {
                    await sendChatAction(chatId, 'typing');
                    console.log(`[Bridge] Enviando '${text.substring(0, 20)}...' a la ventana PID: ${proc.pid}`);
                    await automationService.quickAction.focusAndType(winTitle, text, proc.pid);
                    console.log(`[Bridge] Envío a la ventana completado en AHK.`);
                    await sendMessage(chatId, `⚡ Mensaje enviado a la ventana activa de <b>${god.toUpperCase()}</b> (PID: ${proc.pid}).`);
                    return;
                }
            } catch (e: any) {
                console.error(`[Bridge] Error verificando ventana:`, e.message);
            }
        } else {
            console.log(`[Bridge] No hay procesos de tipo 'agent' activos.`);
        }
    }

    // --- CHAT CON IA (Fallback) ---
    if (text.startsWith('/')) {
        await sendMessage(chatId, `❌ Command <code>${text.split(' ')[0]}</code> not recognized.\nUse <code>/help</code> to see available commands.`);
        return;
    }

    await handleChatRoundRobin(message, convId);
}

async function handleChatRoundRobin(message: any, convId: string) {
    const chatId = message.chat.id;
    const text = message.text;
    const services = getActiveServices();

    if (services.length === 0) {
        await sendMessage(chatId, "⚠️ No hay servicios de IA disponibles.");
        return;
    }

    const startIndex = currentServiceIndex;
    currentServiceIndex = (currentServiceIndex + 1) % services.length;

    memoryService.saveMessage(convId, 'user', text);
    const systemRules = memoryService.getSystemPromptAndRules();
    const basePrompt = systemRules[0] || { role: 'system', content: '' };
    const systemPromptWithTools = agentService.injectToolsToPrompt(basePrompt);
    const history = memoryService.getRecentHistory(convId, 20);

    let messagesToSend: ChatMessage[] = [systemPromptWithTools, ...history];

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
                                    const path = await automationService.takeScreenshot();
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
