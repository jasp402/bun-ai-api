import { sendMessage } from '../utils';
import type { TelegramMessage } from '../types';
import { projectManager } from '../../services/projectManager';

export async function handleStatus(message: TelegramMessage) {
    const processes = projectManager.getStatus();
    if (processes.length === 0) {
        await sendMessage(message.chat.id, "⚪ No running processes.");
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
    await sendMessage(message.chat.id, msg);
}

export async function handleLogs(message: TelegramMessage) {
    const project = projectManager.getActiveProject();
    if (!project) {
        await sendMessage(message.chat.id, "⚠️ No active project.");
        return;
    }
    const processesByProject = projectManager.getStatus().filter(p => p.project_id === project.id);

    let logMsg = `📑 <b>Recent Logs: ${project.name}</b>\n───────────────\n`;

    // 1. Logs de procesos en ejecución (Background)
    for (const p of processesByProject) {
        const logs = p.last_output || 'No logs yet...';
        logMsg += `\n🔹 <b>${p.type}</b> (PID: ${p.pid})\n<pre>${logs.substring(Math.max(0, logs.length - 600))}</pre>\n`;
    }

    // 2. Logs de Espejo (Archivo .bot.log para ventanas visibles)
    if (project.mirror_mode) {
        try {
            const logFilePath = `${project.path}\\.bot.log`;
            const file = Bun.file(logFilePath);
            if (await file.exists()) {
                const text = await file.text();
                logMsg += `\n🎭 <b>Mirror Log (Visible Terminal)</b>\n<pre>${text.substring(Math.max(0, text.length - 800))}</pre>\n`;
            }
        } catch (e) { }
    }

    if (processesByProject.length === 0 && !project.mirror_mode) {
        await sendMessage(message.chat.id, `⚪ No processes/mirror running for <b>${project.name}</b>.`);
        return;
    }

    await sendMessage(message.chat.id, logMsg);
}
