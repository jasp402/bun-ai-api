import { sendMessage } from '../utils';
import type { TelegramMessage } from '../types';
import { projectManager } from '../../services/projectManager';

export async function handleAgent(message: TelegramMessage, cmd: string) {
    const project = projectManager.getActiveProject();
    if (!project) {
        await sendMessage(message.chat.id, "⚠️ No active project.");
        return;
    }
    const finalCmd = cmd.trim() || project.agent_command;
    if (!finalCmd) {
        await sendMessage(message.chat.id, "⚠️ No agent command configured for this project.");
        return;
    }
    try {
        const result = await projectManager.startProcess(project.id, 'agent', finalCmd, project.path);
        await sendMessage(message.chat.id, `🤖 <b>AI Agent started</b>\n📁 Project: <b>${project.name}</b>\n⚡ Command: <code>${finalCmd}</code>\n🔢 PID: <code>${result.pid}</code>`);
    } catch (e: any) {
        await sendMessage(message.chat.id, `❌ Error: ${e.message}`);
    }
}

export async function handleNgrok(message: TelegramMessage, portStr: string) {
    const project = projectManager.getActiveProject();
    if (!project) {
        await sendMessage(message.chat.id, "⚠️ No active project.");
        return;
    }
    const port = portStr.trim() || '3000';
    const cmd = `ngrok http ${port}`;
    try {
        const result = await projectManager.startProcess(project.id, 'tunnel', cmd, project.path, parseInt(port));
        await sendMessage(message.chat.id, `🌐 <b>Ngrok tunnel started</b>\n📁 Project: <b>${project.name}</b>\n🔌 Port: <code>${port}</code>\n🔢 PID: <code>${result.pid}</code>`);
    } catch (e: any) {
        await sendMessage(message.chat.id, `❌ Error: ${e.message}`);
    }
}
