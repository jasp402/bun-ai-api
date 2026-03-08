import { sendMessage } from '../utils';
import type { TelegramMessage } from '../types';

export async function handleStart(message: TelegramMessage) {
    const welcomeMessage = `👋 <b>¡Hola! Soy tu Asistente de IA Multi-Modelo.</b> 🧠

Estoy aquí para ayudarte a responder preguntas, redactar textos, analizar información y mucho más, usando los mejores modelos de lenguaje disponibles en el mercado.

✨ <b>Mis características principales:</b>
🚀 <b>Rápido y Dinámico:</b> Utilizo un sistema inteligente (Round-Robin) para conectarme rápidamente al servicio con mejor disponibilidad.
🌐 <b>Múltiples Proveedores:</b> Tengo acceso a tecnologías avanzadas de inteligencia artificial (OpenAI, Gemini, Mistral, Anthropic, Groq, Kimi, Cerebras, etc).
⚡ <b>Respuestas en tiempo real:</b> Te responderé con la mayor brevedad posible.

💡 <i>¿Cómo usarme?</i>
Simplemente escríbeme lo que necesites y me encargaré del resto. ¡Pruébame ahora mismo!`;
    await sendMessage(message.chat.id, welcomeMessage);
}
