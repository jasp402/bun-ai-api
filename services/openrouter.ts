import OpenAI from 'openai';
import type { AIService, ChatMessage } from '../types';

export const openRouterFactory = {
    isEnabled: () => !!process.env.OPEN_ROUTER_API_KEY,
    create: (): AIService => {
        const openai = new OpenAI({
            apiKey: process.env.OPEN_ROUTER_API_KEY,
            baseURL: 'https://openrouter.ai/api/v1',
        });

        const service: AIService = {
            name: 'OpenRouter',
            model: 'openrouter/auto', // Modelo auto como predeterminado
            supportsVision: false,
            metrics: {},

            async validate() {
                try {
                    await openai.models.list();
                    return true;
                } catch {
                    return false;
                }
            },

            async chat(messages: ChatMessage[]) {
                const stream = await openai.chat.completions.create({
                    model: this.model,
                    messages: messages.map(m => ({
                        role: m.role as 'system' | 'user' | 'assistant',
                        content: typeof m.content === 'string' ? m.content : m.content.map(p => p.type === 'text' ? p.text : '').join('\n')
                    })),
                    stream: true,
                });

                return (async function* () {
                    for await (const chunk of stream) {
                        yield chunk.choices[0]?.delta?.content || '';
                    }
                })();
            }
        };
        return service;
    }
}
