import { COMMAND_DOCS } from './command_docs';
import { getActiveServices } from '../services';
import { sendMessage, sendChatAction } from './utils';

export async function explainCommand(commandName: string, message: any) {
    const chatId = message.chat.id;
    const doc = COMMAND_DOCS[commandName.replace('/', '')];

    if (!doc) {
        return sendMessage(chatId, `⚠️ No tengo documentación específica para el comando <code>${commandName}</code>.`);
    }

    await sendChatAction(chatId, 'typing');

    const services = getActiveServices();
    const ai = services[0];

    if (!ai) {
        // Fallback si no hay IA disponible
        let fallbackMsg = `📖 <b>Ayuda: ${commandName}</b>\n\n`;
        fallbackMsg += `📝 ${doc.desc}\n`;
        fallbackMsg += `⚙️ <b>Parámetros:</b> ${doc.params}\n`;
        fallbackMsg += `💡 <b>Ejemplos:</b>\n` + doc.examples.map(ex => `<code>${ex}</code>`).join('\n');
        return sendMessage(chatId, fallbackMsg);
    }

    const prompt = `
        Eres un asistente técnico experto. El usuario ha solicitado ayuda sobre el comando "${commandName}".
        
        Aquí tienes la documentación técnica del comando:
        - Descripción: ${doc.desc}
        - Parámetros: ${doc.params}
        - Ejemplos: ${doc.examples.join(', ')}
        
        Tu tarea:
        1. Escribe una respuesta amigable en español explicando qué hace el comando de forma clara.
        2. Explica qué parámetros recibe y da ejemplos de uso reales.
        3. Usa formato HTML de Telegram (<b>, <i>, <code>).
        4. Sé conciso pero muy servicial.
    `;

    try {
        const stream = await ai.chat([{ role: 'user', content: prompt }]);
        let fullContent = "";
        for await (const chunk of stream) if (chunk) fullContent += chunk;
        
        return sendMessage(chatId, fullContent.trim());
    } catch (e) {
        console.error("Error explicando comando con IA:", e);
        // Fallback si la IA falla
        let fallbackMsg = `📖 <b>Ayuda: ${commandName}</b>\n\n`;
        fallbackMsg += `📝 ${doc.desc}\n`;
        fallbackMsg += `⚙️ <b>Parámetros:</b> ${doc.params}\n`;
        fallbackMsg += `💡 <b>Ejemplos:</b>\n` + doc.examples.map(ex => `<code>${ex}</code>`).join('\n');
        return sendMessage(chatId, fallbackMsg);
    }
}
