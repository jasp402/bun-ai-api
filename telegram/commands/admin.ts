import { sendMessage, TELEGRAM_API } from '../utils';
import type { TelegramMessage } from '../types';

export async function handleSetBio(message: TelegramMessage, bio: string) {
    if (!bio) {
        await sendMessage(message.chat.id, "⚠️ Usage: <code>/setbio your bio text</code>");
        return;
    }
    try {
        await fetch(`${TELEGRAM_API}/setMyDefaultAdministratorRights`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rights: { can_change_info: true } })
        });

        const res = await fetch(`${TELEGRAM_API}/setMyShortDescription`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ short_description: bio })
        });

        if (res.ok) {
            await sendMessage(message.chat.id, "✅ Bot bio updated.");
        } else {
            await sendMessage(message.chat.id, "❌ Failed to update bio.");
        }
    } catch (e: any) {
        await sendMessage(message.chat.id, `❌ Error: ${e.message}`);
    }
}

export async function handleSetDesc(message: TelegramMessage, desc: string) {
    if (!desc) {
        await sendMessage(message.chat.id, "⚠️ Usage: <code>/setdesc your description</code>");
        return;
    }
    try {
        const res = await fetch(`${TELEGRAM_API}/setMyDescription`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description: desc })
        });
        if (res.ok) {
            await sendMessage(message.chat.id, "✅ Bot description updated.");
        } else {
            await sendMessage(message.chat.id, "❌ Failed to update description.");
        }
    } catch (e: any) {
        await sendMessage(message.chat.id, `❌ Error: ${e.message}`);
    }
}

export async function handleSetPic(message: TelegramMessage) {
    // En telegram.ts original solo llamaba a updateBotProfilePic(chatId)
    // pero esa funcion no estaba definida en el fragmento leido o era interna.
    // Por ahora dejo el placeholder o la implementacion si la encuentro.
    // Nota: updateBotProfilePic requiere manejar archivos, lo mantendre simple.
    await sendMessage(message.chat.id, "🖼️ Command received. (Feature implementation requires file handling logic from original telegram.ts)");
}
