import { sendMessage, sendChatAction } from '../utils';
import type { TelegramMessage } from '../types';
import { projectManager } from '../../services/projectManager';
import { automationService } from '../../services/automationService';

export async function handleGodInvocation(message: TelegramMessage, god: string, args: string) {
    const project = projectManager.getActiveProject();
    if (!project) {
        await sendMessage(message.chat.id, "⚠️ No active project.");
        return;
    }

    const baseCmd = god === 'gemini' ? 'gemini' : god === 'claude' ? 'claude-code' : 'codex';
    const winTitle = `AGENT-${god.toUpperCase()}-${project.id.substring(0, 8)}`;

    // Verificamos si existe buscando en DB primero para obtener el PID
    const runningProcs = projectManager.getStatus().filter(p => p.project_id === project.id && p.type === 'agent' && p.command.includes(baseCmd));
    const activeProc = runningProcs.length > 0 ? runningProcs[0] : null;

    console.log(`[Telegram] handleGodInvocation - Verificando si existe la ventana: ${winTitle}`);
    const exists = await automationService.quickAction.windowExists(winTitle, activeProc?.pid);

    try {
        if (exists) {
            console.log(`[Telegram] La ventana ${winTitle} YA EXISTE. Preparando envío de texto...`);
            const pid = activeProc?.pid;
            if (args) {
                console.log(`[Telegram] Enviando '${args.substring(0, 20)}...' a la ventana PID: ${pid}`);
                await automationService.quickAction.focusAndType(winTitle, args, pid);
                console.log(`[Telegram] Envío a la ventana completado en AHK.`);
                await sendMessage(message.chat.id, `⚡ Mensaje enviado a la ventana activa de <b>${god.toUpperCase()}</b>${pid ? ` (PID: ${pid})` : ''}.`);
                console.log(`[Telegram] Confirmación en Telegram enviada.`);
            } else {
                console.log(`[Telegram] Activando la ventana (sin comandos extra).`);
                await automationService.runAhk(`WinActivate("${pid ? `ahk_pid ${pid}` : winTitle}")`);
                await sendMessage(message.chat.id, `🔍 Ventana de <b>${god.toUpperCase()}</b> enfocada en el PC${pid ? ` (PID: ${pid})` : ''}.`);
            }
            return;
        }

        console.log(`[Telegram] La ventana ${winTitle} NO EXISTE. Arrancando nuevo proceso...`);
        const statusMsg = args ? `⚡ Iniciando terminal de <b>${god.toUpperCase()}</b> con instrucciones...` : `⚡ Iniciando terminal interactiva de <b>${god.toUpperCase()}</b>...`;
        await sendMessage(message.chat.id, statusMsg);

        const result = await projectManager.startProcess(project.id, 'agent', baseCmd, project.path, null, true, god);

        if (result && result.pid) {
            await sendMessage(message.chat.id, `✅ Terminal de <b>${god.toUpperCase()}</b> lista. PID: <code>${result.pid}</code>`);

            // 🔥 CAPTURA INMEDIATA DEL HWND 🔥
            // Se lanza asíncronamente un `wait` en AHK para agarrar el Window Handle
            // justo cuando la consola nace, antes de que el CLI de IA modifique su título.
            automationService.quickAction.captureHwnd(winTitle, 8000).catch(console.error);
        }

        if (args) {
            setTimeout(async () => {
                console.log(`[Telegram] Enviando argumentos iniciales al nuevo agente...`);
                await automationService.quickAction.focusAndType(winTitle, args, result?.pid ?? undefined);
            }, 4000);
        }
    } catch (e: any) {
        console.error(`[Telegram] Error gestionando la invocación de ${god}:`, e);
        await sendMessage(message.chat.id, `❌ No se pudo invocar a ${god}: ${e.message}`);
    }
}

export async function handleExitAgent(message: TelegramMessage) {
    const project = projectManager.getActiveProject();
    if (!project) return;
    const activeProcesses = projectManager.getStatus();
    const agents = activeProcesses.filter(p => p.project_id === project.id && p.type === 'agent');

    if (agents.length === 0) {
        await sendMessage(message.chat.id, "⚠️ No hay agentes activos para cerrar.");
        return;
    }

    for (const agent of agents) {
        projectManager.stopProcess(agent.id);
    }
    await sendMessage(message.chat.id, "🛑 Sesiones de agentes cerradas.");
}
