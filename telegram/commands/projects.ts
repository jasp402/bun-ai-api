import { sendMessage } from '../utils';
import type { TelegramMessage } from '../types';
import { projectManager } from '../../services/projectManager';

export async function handleProjects(message: TelegramMessage) {
    const projects = projectManager.listProjects();
    if (projects.length === 0) {
        await sendMessage(message.chat.id, "📂 No projects registered.\n\nUse <code>/addproject name|path|stack|dev_cmd|agent_cmd</code> to add one.");
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
    await sendMessage(message.chat.id, msg);
}

export async function handleSwitch(message: TelegramMessage, name: string) {
    const projectName = name.trim().replace(/^\//, '');
    if (!projectName) {
        await sendMessage(message.chat.id, "⚠️ Usage: <code>/switch project_name</code>");
        return;
    }
    const success = projectManager.switchProject(projectName);
    if (success) {
        const project = projectManager.getActiveProject();
        await sendMessage(message.chat.id, `✅ Active project: <b>${projectName}</b>\n📁 <code>${project?.path}</code>\n🛠️ ${project?.stack || 'No stack'}`);
    } else {
        await sendMessage(message.chat.id, `❌ Project "<b>${projectName}</b>" not found.\nUse <code>/projects</code> to see the list.`);
    }
}
