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
        await sendMessage(message.chat.id, `🌐 <b>Ngrok tunnel started</b>\n📁 Project: <b>${project.name}</b>\n🔌 Port: <code>${port}</code>\n🔢 PID: <code>${result.pid}</code>\n⏳ <i>Obteniendo URL pública...</i>`);

        // Esperar un momento a que ngrok levante y exponga su API local
        setTimeout(async () => {
            try {
                const response = await fetch('http://127.0.0.1:4040/api/tunnels');
                if (response.ok) {
                    const data = await response.json() as any;
                    if (data && data.tunnels && data.tunnels.length > 0) {
                        const publicUrl = data.tunnels[0].public_url;
                        await sendMessage(message.chat.id, `🔗 <b>Ngrok URL:</b>\n<a href="${publicUrl}">${publicUrl}</a>`);
                    } else {
                        await sendMessage(message.chat.id, `⚠️ No se pudo obtener la URL pública de ngrok. ¿Está corriendo correctamente?`);
                    }
                } else {
                    await sendMessage(message.chat.id, `⚠️ Error conectando al API local de ngrok (Status: ${response.status}).`);
                }
            } catch (err: any) {
                console.error("[Ngrok] Error fetching public URL:", err.message);
                await sendMessage(message.chat.id, `⚠️ Error al intentar leer la URL de ngrok: ${err.message}`);
            }
        }, 3000); // 3 segundos de espera razonables para que ngrok conecte

    } catch (e: any) {
        await sendMessage(message.chat.id, `❌ Error: ${e.message}`);
    }
}
