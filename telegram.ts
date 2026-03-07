import { getActiveServices } from './services';
import type { ChatMessage } from './types';
import { memoryService } from './services/memory';
import { agentService } from './services/agent';
import { mcpService } from './services/mcpClient';
import { projectManager } from './services/projectManager';

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_API_KEY}`;
let currentServiceIndex = 0;

async function sendChatAction(chatId: number, action: 'typing' | 'upload_photo' | 'record_video' = 'typing') {
    try {
        await fetch(`${TELEGRAM_API}/sendChatAction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, action })
        });
    } catch (err) {
        console.error("Error sending chat action:", err);
    }
}

export async function startTelegramBot() {
    if (!process.env.TELEGRAM_BOT_API_KEY) {
        console.warn("Telegram bot disabled: TELEGRAM_BOT_API_KEY not set");
        return;
    }

    console.log("🤖 Iniciando escucha del bot de Telegram (Long Polling)...");

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
                { command: 'run', description: '🚀 Start dev server' },
                { command: 'agent', description: '🤖 Start AI agent' },
                { command: 'ngrok', description: '🌐 Start ngrok tunnel' },
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

    // Bucle infinito para long-polling
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
                    // Procesar el mensaje sin bloquear el bucle de polling
                    handleMessage(update.message).catch(console.error);
                }
            }
        } catch (error) {
            console.error("Error en polling de Telegram:", error);
            await new Promise(resolve => setTimeout(resolve, 5000)); // Esperar antes de reintentar
        }
    }
}

async function handleMessage(message: any) {
    const chatId = message.chat.id;
    const text = message.text;
    const textLower = text.toLowerCase().trim(); // Normalizar para comparación de comandos
    const userIdStr = message.from.id.toString();
    const userName = message.from.first_name || message.from.username || null;

    // Registrar / Obtener usuario en DB
    let user = memoryService.getUser(userIdStr, 'telegram');
    if (!user) {
        user = memoryService.createUser(userIdStr, userName, 'telegram');
        console.log(`[Memoria] Nuevo usuario registrado: ${userName} (${userIdStr})`);
    }

    // Obtener conversacion activa
    const convId = memoryService.getOrCreateConversation(userIdStr, 'telegram');

    if (textLower.startsWith('/start')) {
        const welcomeMessage = `👋 <b>¡Hola! Soy tu Asistente de IA Multi-Modelo.</b> 🧠

Estoy aquí para ayudarte a responder preguntas, redactar textos, analizar información y mucho más, usando los mejores modelos de lenguaje disponibles en el mercado.

✨ <b>Mis características principales:</b>
🚀 <b>Rápido y Dinámico:</b> Utilizo un sistema inteligente (Round-Robin) para conectarme rápidamente al servicio con mejor disponibilidad.
🌐 <b>Múltiples Proveedores:</b> Tengo acceso a tecnologías avanzadas de inteligencia artificial (OpenAI, Gemini, Mistral, Anthropic, Groq, Kimi, Cerebras, etc).
⚡ <b>Respuestas en tiempo real:</b> Te responderé con la mayor brevedad posible.

💡 <i>¿Cómo usarme?</i>
Simplemente escríbeme lo que necesites y me encargaré del resto. ¡Pruébame ahora mismo!`;
        await sendMessage(chatId, welcomeMessage);
        return;
    }

    // =============== HELP COMMAND ===============

    if (textLower === '/help') {
        const helpMsg = `📖 <b>Available Commands</b>
───────────────

🔧 <b>Admin</b>
<code>/help</code> — Show this help
<code>/setbio text</code> — Update bot bio
<code>/setdesc text</code> — Update bot description
<code>/setpic</code> — Update bot profile picture

📂 <b>Project Management</b>
<code>/projects</code> — List all registered projects
<code>/addproject path</code> — Auto-detect and add project
<code>/addproject name|path|stack|dev|agent</code> — Explicit add
<code>/rmproject name</code> — Remove a project
<code>/switch name</code> — Switch active project

⚡ <b>Process Control</b>
<code>/run</code> — Start dev server
<code>/agent [cmd]</code> — Start AI agent for project
<code>/ngrok [port]</code> — Start ngrok tunnel
<code>/status</code> — Show all running processes
<code>/logs</code> — Show recent logs of active project
<code>/stop</code> — Stop processes of active project
<code>/stopall</code> — Stop ALL processes

💬 <b>Chat</b>
Just type any message to talk with the AI assistant!
───────────────
💡 <i>Commands are case-insensitive</i>`;
        await sendMessage(chatId, helpMsg);
        return;
    }

    // Comandos de administración
    if (textLower.startsWith('/setbio')) {
        const bio = text.substring(7).trim();
        if (!bio) {
            await sendMessage(chatId, "⚠️ Usage: <code>/setbio your bio text</code>");
            return;
        }
        await updateBotBio(chatId, bio);
        return;
    }

    if (textLower.startsWith('/setdesc')) {
        const desc = text.substring(8).trim();
        if (!desc) {
            await sendMessage(chatId, "⚠️ Usage: <code>/setdesc your description</code>");
            return;
        }
        await updateBotDescription(chatId, desc);
        return;
    }

    if (textLower.startsWith('/setpic')) {
        await updateBotProfilePic(chatId);
        return;
    }

    // =============== PROJECT MANAGEMENT COMMANDS ===============

    if (textLower === '/projects') {
        const projects = projectManager.listProjects();
        if (projects.length === 0) {
            await sendMessage(chatId, "📂 No projects registered.\n\nUse <code>/addproject name|path|stack|dev_cmd|agent_cmd</code> to add one.");
            return;
        }
        let msg = "📂 <b>Registered Projects</b>\n───────────────\n";
        for (const p of projects) {
            const active = p.is_active ? " ✅ ACTIVE" : "";
            const statusEmoji = p.status === 'running' ? '🟢' : p.status === 'error' ? '🔴' : '⚪';
            msg += `\n${statusEmoji} <b>${p.name}</b>${active}\n`;
            msg += `   📁 <code>${p.path}</code>\n`;
            msg += `   🛠️ ${p.stack || 'No stack'}\n`;

            // Shortcuts
            msg += `   🔌 <code>/switch ${p.name}</code>\n`;
            if (p.dev_command) {
                msg += `   🚀 <code>/run</code>\n`;
            } else {
                msg += `   ⚠️ <code>/addproject ${p.name}|${p.path}|${p.stack || 'Stack'}|npm run dev</code>\n`;
            }
        }
        msg += "\n───────────────\n💡 Tap any <code>code</code> command to copy and edit it.";
        await sendMessage(chatId, msg);
        return;
    }

    if (textLower.startsWith('/switch')) {
        const name = text.substring(7).trim().replace(/^\//, '');
        if (!name) {
            await sendMessage(chatId, "⚠️ Usage: <code>/switch project_name</code>");
            return;
        }
        const success = projectManager.switchProject(name);
        if (success) {
            const project = projectManager.getActiveProject();
            await sendMessage(chatId, `✅ Active project: <b>${name}</b>\n📁 <code>${project?.path}</code>\n🛠️ ${project?.stack || 'No stack'}`);
        } else {
            await sendMessage(chatId, `❌ Project "<b>${name}</b>" not found.\nUse <code>/projects</code> to see the list.`);
        }
        return;
    }

    if (textLower.startsWith('/addproject')) {
        let input = '';
        if (textLower === '/addproject') {
            await sendMessage(chatId, "⚠️ Usage: <code>/addproject path</code> or <code>/addproject name|path|stack|dev_cmd|agent_cmd</code>");
            return;
        }
        input = text.substring(11).trim();
        if (input.startsWith(' ')) input = input.trim();

        let name = '', path = '', stack = '', devCommand = '', agentCommand = '';

        if (input.includes('|')) {
            // Explicit format
            const parts = input.split('|').map((s: string) => s.trim());
            if (parts.length < 2) {
                await sendMessage(chatId, "⚠️ Format: <code>/addproject name|path|stack|dev_cmd|agent_cmd</code>");
                return;
            }
            [name, path, stack, devCommand, agentCommand] = [parts[0] || '', parts[1] || '', parts[2] || '', parts[3] || '', parts[4] || ''];
        } else {
            // Auto-detect
            path = input.replace(/\\/g, '/').replace(/\/+$/, '');
            name = path.split('/').pop() || 'unnamed';

            try {
                const pkgPath = path.replace(/\//g, '\\') + '\\package.json';
                const file = Bun.file(pkgPath);
                if (await file.exists()) {
                    const pkg = await file.json();
                    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
                    if (deps['next']) stack = 'Next.js';
                    else if (deps['nuxt']) stack = 'Nuxt';
                    else if (deps['react']) stack = 'React';
                    else if (deps['vue']) stack = 'Vue';
                    else if (deps['svelte'] || deps['@sveltejs/kit']) stack = 'Svelte';
                    else if (deps['express']) stack = 'Express';
                    else if (deps['hono']) stack = 'Hono';
                    else stack = pkg.name || 'Node.js';

                    if (pkg.scripts?.dev) devCommand = 'npm run dev';
                    else if (pkg.scripts?.start) devCommand = 'npm start';

                    if (pkg.scripts?.agent) agentCommand = 'npm run agent';

                    await sendChatAction(chatId);
                }
            } catch (e) { }
        }

        const winPath = path.replace(/\//g, '\\');

        try {
            projectManager.addProject(name, winPath, stack, devCommand, agentCommand);
            let msg = `✅ Project "<b>${name}</b>" registered.\n📁 <code>${winPath}</code>`;
            if (stack) msg += `\n🛠️ Stack: <b>${stack}</b>`;
            if (devCommand) msg += `\n⚡ Dev: <code>${devCommand}</code>`;
            if (agentCommand) msg += `\n🤖 Agent: <code>${agentCommand}</code>`;
            await sendMessage(chatId, msg);
        } catch (e: any) {
            await sendMessage(chatId, `❌ Error registering project: ${e.message}`);
        }
        return;
    }

    if (textLower.startsWith('/rmproject')) {
        const name = text.substring(10).trim();
        if (!name) {
            await sendMessage(chatId, "⚠️ Usage: <code>/rmproject project_name</code>");
            return;
        }
        const success = projectManager.removeProject(name);
        await sendMessage(chatId, success ? `🗑️ Project "<b>${name}</b>" removed.` : `❌ Project "<b>${name}</b>" not found.`);
        return;
    }

    if (textLower === '/run') {
        const project = projectManager.getActiveProject();
        if (!project) {
            await sendMessage(chatId, "⚠️ No active project. Use <code>/switch name</code> first.");
            return;
        }
        if (!project.dev_command) {
            const template = `/addproject ${project.name}|${project.path}|${project.stack || 'Stack'}|npm run dev`;
            await sendMessage(chatId, `⚠️ Project <b>${project.name}</b> has no <code>dev_command</code> configured.\n\n💡 <b>To fix it, copy, edit and send this:</b>\n<code>${template}</code>`);
            return;
        }
        try {
            await sendChatAction(chatId);
            const result = await projectManager.startProcess(project.id, 'dev_server', project.dev_command, project.path);
            await sendMessage(chatId, `🚀 <b>Dev server started</b>\n───────────────\n📁 Project: <b>${project.name}</b>\n⚡ Command: <code>${project.dev_command}</code>\n🔢 PID: <code>${result.pid}</code>`);
        } catch (e: any) {
            await sendMessage(chatId, `❌ Error starting: ${e.message}`);
        }
        return;
    }

    if (textLower === '/status') {
        const processes = projectManager.getStatus();
        if (processes.length === 0) {
            await sendMessage(chatId, "⚪ No running processes.");
            return;
        }
        let msg = "📊 <b>Running Processes</b>\n───────────────\n";
        for (const p of processes) {
            const typeEmoji = p.type === 'dev_server' ? '🖥️' : p.type === 'agent' ? '🤖' : p.type === 'tunnel' ? '🌐' : '⚙️';
            msg += `\n${typeEmoji} <b>${p.type}</b> (${p.project_name || 'N/A'})\n`;
            msg += `   ⚡ <code>${p.command}</code>\n`;
            msg += `   🔢 PID: <code>${p.pid}</code>`;
            if (p.port) msg += ` | Port: <code>${p.port}</code>`;
            msg += `\n`;
        }
        await sendMessage(chatId, msg);
        return;
    }

    if (textLower === '/logs') {
        const project = projectManager.getActiveProject();
        if (!project) {
            await sendMessage(chatId, "⚠️ No active project.");
            return;
        }
        const processesByProject = projectManager.getStatus().filter(p => p.project_id === project.id);
        if (processesByProject.length === 0) {
            await sendMessage(chatId, `⚪ No processes running for <b>${project.name}</b>.`);
            return;
        }

        let logMsg = `📑 <b>Recent Logs: ${project.name}</b>\n───────────────\n`;
        for (const p of processesByProject) {
            const logs = p.last_output || 'No logs yet...';
            logMsg += `\n🔹 <b>${p.type}</b> (PID: ${p.pid})\n<pre>${logs.substring(Math.max(0, logs.length - 800))}</pre>\n`;
        }
        await sendMessage(chatId, logMsg);
        return;
    }

    if (textLower.startsWith('/agent')) {
        const project = projectManager.getActiveProject();
        if (!project) {
            await sendMessage(chatId, "⚠️ No active project.");
            return;
        }
        const cmd = text.substring(6).trim() || project.agent_command;
        if (!cmd) {
            await sendMessage(chatId, "⚠️ No agent command configured for this project.");
            return;
        }
        try {
            const result = await projectManager.startProcess(project.id, 'agent', cmd!, project.path);
            await sendMessage(chatId, `🤖 <b>AI Agent started</b>\n📁 Project: <b>${project.name}</b>\n⚡ Command: <code>${cmd}</code>\n🔢 PID: <code>${result.pid}</code>`);
        } catch (e: any) {
            await sendMessage(chatId, `❌ Error: ${e.message}`);
        }
        return;
    }

    if (textLower.startsWith('/ngrok')) {
        const project = projectManager.getActiveProject();
        if (!project) {
            await sendMessage(chatId, "⚠️ No active project.");
            return;
        }
        const port = text.substring(6).trim() || '3000';
        const cmd = `ngrok http ${port}`;
        try {
            const result = await projectManager.startProcess(project.id, 'tunnel', cmd, project.path, parseInt(port));
            await sendMessage(chatId, `🌐 <b>Ngrok tunnel started</b>\n📁 Project: <b>${project.name}</b>\n🔌 Port: <code>${port}</code>\n🔢 PID: <code>${result.pid}</code>\n\n💡 Wait a few seconds and use <code>/status</code> to check if it's running.`);
        } catch (e: any) {
            await sendMessage(chatId, `❌ Error: ${e.message}`);
        }
        return;
    }

    if (textLower === '/stopall') {
        const status = projectManager.getStatus();
        status.forEach(p => {
            try {
                process.kill(p.pid);
            } catch (e) { }
        });
        projectManager.init(); // Reset in-memory state
        await sendMessage(chatId, "🛑 <b>All processes stopped</b> and memory cleared.");
        return;
    }

    if (textLower.startsWith('/stop')) {
        const project = projectManager.getActiveProject();
        if (!project) {
            await sendMessage(chatId, "⚠️ No active project.");
            return;
        }
        projectManager.stopProjectProcesses(project.id);
        await sendMessage(chatId, `🛑 All processes for <b>${project.name}</b> stopped.`);
        return;
    }

    // =============== END PROJECT COMMANDS ===============

    // Catch-all para cualquier otro comando no reconocido
    if (text.startsWith('/')) {
        await sendMessage(chatId, `❌ Command <code>${text.split(' ')[0]}</code> not recognized.\nUse <code>/help</code> to see available commands.`);
        return;
    }

    const services = getActiveServices();
    if (services.length === 0) {
        await sendMessage(chatId, "⚠️ Lo siento, no hay servicios de IA disponibles en este momento.");
        return;
    }

    // Selección de servicio (Round Robin simple para el bot)
    const service = services[currentServiceIndex];
    // The original `service` variable and its check are removed as the loop handles it.
    // The `currentServiceIndex` is used to determine the starting point for the round-robin.
    const startIndex = currentServiceIndex;
    currentServiceIndex = (currentServiceIndex + 1) % services.length; // Advance for the next request

    let success = false;
    let fullContent = "";

    // === MEMORIA: GUARDAR MSG USR ===
    memoryService.saveMessage(convId, 'user', text);

    // === MEMORIA: PREPARAR CONTEXTO ===
    const systemRules = memoryService.getSystemPromptAndRules();

    // Inyectamos catálogo dinámico de herramientas MCP usando AgentService sobre el primer (y unico) prompt base
    const basePrompt = systemRules[0] || { role: 'system', content: '' };
    const systemPromptWithTools = agentService.injectToolsToPrompt(basePrompt);

    const history = memoryService.getRecentHistory(convId, 20); // 20 mensajes anteriores

    let messagesToSend: ChatMessage[] = [
        systemPromptWithTools,
        ...history
    ];

    for (let i = 0; i < services.length; i++) {
        const index = (startIndex + i) % services.length;
        const service = services[index];
        if (!service) continue;

        try {
            console.log(`[Telegram] Trying service: ${service.name} (${service.model})...`);

            let agentLoopCount = 0;
            const MAX_AGENT_STEPS = 5;

            // ---- AGENT RE-ACT LOOP ----
            while (agentLoopCount < MAX_AGENT_STEPS) {
                agentLoopCount++;

                // Feedback visual de que la IA está trabajando
                await sendChatAction(chatId, 'typing');

                const stream = await service.chat(messagesToSend);

                fullContent = "";
                for await (const chunk of stream) {
                    if (chunk) fullContent += chunk;
                }

                // Parsear si el texto contiene <mcp_tool_call>
                const toolCalls = agentService.parseToolCalls(fullContent);

                if (toolCalls && toolCalls.length > 0) {
                    console.log(`[Agente] Detectó ${toolCalls.length} llamadas a herramientas.`);

                    // Aseguramos de que el modelo recuerde que hizo este intento (Rol assistant)
                    messagesToSend.push({ role: 'assistant', content: fullContent });

                    // Responder a cada call
                    for (const call of toolCalls) {
                        try {
                            const result = await mcpService.callTool(call.server, call.tool, call.args);
                            const resultMsg = agentService.formatToolResult(call.tool, result, false);
                            messagesToSend.push(resultMsg);
                        } catch (toolError: any) {
                            console.error(`[Agente] Error corriendo tool ${call.tool}:`, toolError);
                            const resultMsg = agentService.formatToolResult(call.tool, { error: toolError.message }, true);
                            messagesToSend.push(resultMsg);
                        }
                    }
                    // RE-Ejecuta el request con las <mcp_tool_result> inyectadas al final
                    console.log(`[Agente] Evaluando resultados de las herramientas...`);
                    continue;
                }

                // SI NO HAY TOOL CALLS O ES TEXTO NORMAL: Sale del loop y responde al usuario
                break;
            }

            // Limpiamos contenido interno XML antes de mandarlo finalmente al cliente
            const finalCleanContent = agentService.cleanFinalResponse(fullContent);

            // Sanitizamos caracteres sueltos para HTML de Telegram
            const finalHtmlContent = agentService.escapeHTML(finalCleanContent);

            console.log(`[Telegram] Contenido final a enviar (HTML): "${finalHtmlContent.slice(0, 100)}..."`);

            if (finalHtmlContent.trim().length > 0) {
                await sendMessage(chatId, finalHtmlContent);
            } else {
                console.warn("[Telegram] La respuesta final está vacía tras la limpieza, enviando mensaje de error fallback.");
                await sendMessage(chatId, "El modelo no generó una respuesta legible después de usar la herramienta.");
            }
            console.log(`✅ [Telegram] Answered by ${service.name} after ${agentLoopCount} turns.`);

            // Guardar última respuesta humana final de IA en memoria
            memoryService.saveMessage(convId, 'assistant', finalCleanContent);

            success = true;
            break; // Salimos del bucle de servicios de IA exitosamente
        } catch (error: any) {
            console.error(`❌ [Telegram] Service ${service.name} failed:`, error.message);
            // Continua con el siguiente servicio RR...
        }
    }

    if (!success) {
        await sendMessage(chatId, "❌ Todos los servicios de IA están ocupados o fallaron. Por favor, intenta de nuevo más tarde.");
    }
}

export async function sendMessage(chatId: number, text: string) {
    if (!text || text.trim().length === 0) return;

    try {
        const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
        });

        const data = await response.json() as any;
        if (!data.ok) {
            console.warn(`[Telegram] Error enviando mensaje (HTML): ${data.description}. Reintentando sin formato...`);
            // Fallback plano si el HTML falló por algún tag no cerrado
            await fetch(`${TELEGRAM_API}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, text })
            });
        }
    } catch (err) {
        console.error("Error de conexión enviando mensaje a Telegram:", err);
    }
}

// === Funciones de Administración del Bot ===

async function updateBotBio(chatId: number, aboutText: string) {
    try {
        const response = await fetch(`${TELEGRAM_API}/setMyShortDescription`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ short_description: aboutText })
        });
        const data = await response.json() as any;
        if (data.ok) {
            await sendMessage(chatId, "✅ <b>Biografía corta actualizada</b> con éxito.");
        } else {
            await sendMessage(chatId, `❌ Error al actualizar la biografía: ${data.description}`);
        }
    } catch (error) {
        console.error("Error updating bio:", error);
        await sendMessage(chatId, "❌ Error de conexión al intentar actualizar la biografía.");
    }
}

async function updateBotDescription(chatId: number, description: string) {
    try {
        const response = await fetch(`${TELEGRAM_API}/setMyDescription`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description })
        });
        const data = await response.json() as any;
        if (data.ok) {
            await sendMessage(chatId, "✅ <b>Descripción larga actualizada</b> con éxito.");
        } else {
            await sendMessage(chatId, `❌ Error al actualizar la descripción: ${data.description}`);
        }
    } catch (error) {
        console.error("Error updating description:", error);
        await sendMessage(chatId, "❌ Error de conexión al intentar actualizar la descripción.");
    }
}

async function updateBotProfilePic(chatId: number) {
    // La API HTTP de Telegram (Bot API) actualmente NO soporta actualizar
    // la foto de perfil (Avatar) mediante un endpoint nativo para bots.
    // Esto se debe hacer manualmente a través de @BotFather en Telegram
    // usando el comando /setuserpic
    await sendMessage(chatId, "⚠️ <b>Aviso:</b> La API de Telegram no permite que los bots cambien su propia foto de perfil dinámicamente. \n\nPara cambiar la foto de perfil debes:\n1. Ir a <a href=\"https://t.me/BotFather\">@BotFather</a> en Telegram\n2. Enviar el comando <code>/setuserpic</code>\n3. Seleccionar tu bot y enviarle la nueva imagen.");
}
