import { sendMessage, sendChatAction, TELEGRAM_API } from '../utils';
import type { TelegramMessage } from '../types';
import { automationService } from '../../services/automationService';

export async function handlePc(message: TelegramMessage, cmd: string) {
    if (!cmd) {
        await sendMessage(message.chat.id, "⚠️ Usage: <code>/pc Click(500, 400)</code> or <code>/pc SendText('Hello')</code>\n\n(Supports AutoHotkey v2 syntax)");
        return;
    }
    await sendChatAction(message.chat.id);
    try {
        const output = await automationService.runAhk(cmd);
        await sendMessage(message.chat.id, `🎹 <b>AutoHotkey Execution</b>\n<code>${cmd}</code>\n\n✅ Output:\n<pre>${output || "(no output)"}</pre>`);
    } catch (error: any) {
        await sendMessage(message.chat.id, `❌ AHK Error:\n<pre>${error.message || error}</pre>`);
    }
}

export async function handleScreen(message: TelegramMessage) {
    await sendChatAction(message.chat.id, 'upload_photo');
    const screenPath = await automationService.quickAction.takeScreenshot();
    if (screenPath) {
        try {
            const fs = require('node:fs');
            const photo = fs.readFileSync(screenPath);
            const formData = new FormData();
            formData.append('chat_id', message.chat.id.toString());
            formData.append('photo', new Blob([photo], { type: 'image/png' }), 'screenshot.png');
            formData.append('caption', `🖥️ Pantalla actual del PC - ${new Date().toLocaleTimeString()}`);

            await fetch(`${TELEGRAM_API}/sendPhoto`, {
                method: 'POST',
                body: formData
            });

            // Limpiar después de enviar
            setTimeout(() => { try { fs.unlinkSync(screenPath); } catch (e) { } }, 5000);
        } catch (e: any) {
            await sendMessage(message.chat.id, `❌ Error enviando captura: ${e.message}`);
        }
    } else {
        await sendMessage(message.chat.id, "❌ No se pudo capturar la pantalla.");
    }
}

export async function handleShell(message: TelegramMessage, cmd: string) {
    if (!cmd) {
        await sendMessage(message.chat.id, "⚠️ Usage: <code>/shell any native command</code>");
        return;
    }
    await sendChatAction(message.chat.id);
    try {
        const shellCmd = "C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
        const proc = Bun.spawn([shellCmd, "-Command", cmd], {
            stdout: "pipe",
            stderr: "pipe",
        });
        const stdout = await new Response(proc.stdout).text();
        const stderr = await new Response(proc.stderr).text();

        let response = `💻 <b>Shell Execution</b>\n<code>${cmd}</code>\n\n`;
        if (stdout) response += `📄 <b>Output:</b>\n<pre>${stdout.substring(0, 1000)}</pre>\n`;
        if (stderr) response += `❗ <b>Error:</b>\n<pre>${stderr.substring(0, 1000)}</pre>`;
        if (!stdout && !stderr) response += `✅ Command executed (no output).`;

        await sendMessage(message.chat.id, response);
    } catch (e: any) {
        await sendMessage(message.chat.id, `❌ Shell Error: ${e.message}`);
    }
}
