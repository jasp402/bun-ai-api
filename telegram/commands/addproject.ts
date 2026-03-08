import { sendMessage, sendChatAction } from '../utils';
import type { TelegramMessage } from '../types';
import { projectManager } from '../../services/projectManager';

export async function handleAddProject(message: TelegramMessage, input: string) {
    if (!input) {
        await sendMessage(message.chat.id, "⚠️ Usage: <code>/addproject path</code> or <code>/addproject name|path|stack|dev_cmd|agent_cmd</code>");
        return;
    }

    let name = '', path = '', stack = '', devCommand = '', agentCommand = '';

    if (input.includes('|')) {
        // Explicit format
        const parts = input.split('|').map((s: string) => s.trim());
        if (parts.length < 2) {
            await sendMessage(message.chat.id, "⚠️ Format: <code>/addproject name|path|stack|dev_cmd|agent_cmd</code>");
            return;
        }
        [name, path, stack, devCommand, agentCommand] = [parts[0] || '', parts[1] || '', parts[2] || '', parts[3] || '', parts[4] || ''];
    } else {
        // Auto-detect
        let rawPath = input.replace(/\\/g, '/').replace(/\/+$/, '');
        // BUG FIX: Normalizar d:_DEV a d:\_DEV
        if (/^[a-zA-Z]:[^/]/.test(rawPath)) {
            rawPath = rawPath.replace(/^([a-zA-Z]):/, '$1:/');
        }
        path = rawPath;
        name = path.split('/').pop() || 'unnamed';

        try {
            const pkgPath = path.replace(/\//g, '\\') + '\\package.json';
            const file = Bun.file(pkgPath);
            if (await file.exists()) {
                const pkg = await file.json() as any;
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

                await sendChatAction(message.chat.id);
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
        await sendMessage(message.chat.id, msg);
    } catch (e: any) {
        await sendMessage(message.chat.id, `❌ Error registering project: ${e.message}`);
    }
}

export async function handleRmProject(message: TelegramMessage, name: string) {
    if (!name) {
        await sendMessage(message.chat.id, "⚠️ Usage: <code>/rmproject project_name</code>");
        return;
    }
    const success = projectManager.removeProject(name.trim());
    await sendMessage(message.chat.id, success ? `🗑️ Project "<b>${name}</b>" removed.` : `❌ Project "<b>${name}</b>" not found.`);
}
