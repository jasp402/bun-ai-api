import { sendMessage } from '../utils';
import type { TelegramMessage } from '../types';
import { projectManager } from '../../services/projectManager';

export async function handleStop(message: TelegramMessage) {
    const project = projectManager.getActiveProject();
    if (!project) {
        await sendMessage(message.chat.id, "⚠️ No active project.");
        return;
    }
    projectManager.stopProjectProcesses(project.id);
    await sendMessage(message.chat.id, `🛑 All processes for <b>${project.name}</b> stopped.`);
}

export async function handleStopAll(message: TelegramMessage) {
    const status = projectManager.getStatus();
    status.forEach(p => {
        try {
            process.kill(p.pid);
        } catch (e) { }
    });
    projectManager.init(); // Reset in-memory state
    await sendMessage(message.chat.id, "🛑 <b>All processes stopped</b> and memory cleared.");
}

export async function handleMirror(message: TelegramMessage) {
    const project = projectManager.getActiveProject();
    if (!project) {
        await sendMessage(message.chat.id, "⚠️ No active project.");
        return;
    }
    const newState = projectManager.toggleMirrorMode(project.id);
    await sendMessage(message.chat.id, `🎭 <b>Mirror Mode: ${newState ? 'ON ✅' : 'OFF ⚪'}</b>\n\n${newState ? 'Los procesos visibles ahora guardarán logs en <code>.bot.log</code> para Telegram.' : 'Modo espejo desactivado.'}`);
}

export async function handleStopNgrok(message: TelegramMessage) {
    const project = projectManager.getActiveProject();
    if (!project) {
        await sendMessage(message.chat.id, "⚠️ No active project.");
        return;
    }

    // Obtener los procesos activos para este proyecto filtrando por tipo 'tunnel'
    const processes = projectManager.getStatus().filter(p => p.project_id === project.id && p.type === 'tunnel');

    if (processes.length === 0) {
        await sendMessage(message.chat.id, "⚠️ No ngrok tunnels active for this project.");
        return;
    }

    // Detener cada proceso tunnel
    for (const p of processes) {
        projectManager.stopProcess(p.id);
    }

    await sendMessage(message.chat.id, `🛑 Ngrok tunnel for <b>${project.name}</b> stopped.`);
}
