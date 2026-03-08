import { sendMessage, sendChatAction } from '../utils';
import type { TelegramMessage } from '../types';
import { projectManager } from '../../services/projectManager';

export async function handleRun(message: TelegramMessage, portStr: string) {
    const project = projectManager.getActiveProject();
    if (!project) {
        await sendMessage(message.chat.id, "⚠️ No active project. Use <code>/switch name</code> first.");
        return;
    }

    const port = portStr ? parseInt(portStr) : null;

    if (!project.dev_command) {
        const template = `/addproject ${project.name}|${project.path}|${project.stack || 'Stack'}|npm run dev`;
        await sendMessage(message.chat.id, `⚠️ Project <b>${project.name}</b> has no <code>dev_command</code> configured.\n\n💡 <b>To fix it, copy, edit and send this:</b>\n<code>${template}</code>`);
        return;
    }
    try {
        await sendChatAction(message.chat.id);
        // Terminal visible por defecto
        const result = await projectManager.startProcess(project.id, 'dev_server', project.dev_command, project.path, port, true);
        let msg = `🖥️ <b>Terminal Opened on PC</b>\n───────────────\n📁 Project: <b>${project.name}</b>\n⚡ Command: <code>${project.dev_command}</code>\n🔢 PID: <code>${result.pid}</code>`;
        if (port) msg += `\n🔌 Port: <code>${port}</code>`;
        msg += `\n\n💡 La ventana ahora es visible en tu monitor.`;
        await sendMessage(message.chat.id, msg);
    } catch (e: any) {
        await sendMessage(message.chat.id, `❌ Error starting: ${e.message}`);
    }
}

export async function handleRunBg(message: TelegramMessage) {
    const project = projectManager.getActiveProject();
    if (!project) {
        await sendMessage(message.chat.id, "⚠️ No active project.");
        return;
    }
    if (!project.dev_command) {
        const template = `/addproject ${project.name}|${project.path}|${project.stack || 'Stack'}|npm run dev`;
        await sendMessage(message.chat.id, `⚠️ Project <b>${project.name}</b> has no <code>dev_command</code> configured.\n\n💡 <b>To fix it, copy, edit and send this:</b>\n<code>${template}</code>`);
        return;
    }
    try {
        await sendChatAction(message.chat.id);
        const result = await projectManager.startProcess(project.id, 'dev_server', project.dev_command, project.path, null, false);
        await sendMessage(message.chat.id, `🚀 <b>Dev server started (Background)</b>\n───────────────\n📁 Project: <b>${project.name}</b>\n⚡ Command: <code>${project.dev_command}</code>\n🔢 PID: <code>${result.pid}</code>\n\n💡 Use <code>/status</code> or <code>/logs</code> para ver el output.`);
    } catch (e: any) {
        await sendMessage(message.chat.id, `❌ Error starting: ${e.message}`);
    }
}
