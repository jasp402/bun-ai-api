import OpenAI from 'openai';
import type { AIService, ChatMessage } from '../types';

export const mistralFactory = {
    isEnabled: () => !!process.env.MISTRAL_API_KEY,
    create: (): AIService => {
        const openai = new OpenAI({
            apiKey: process.env.MISTRAL_API_KEY,
            baseURL: 'https://api.mistral.ai/v1',
        });

        const service: AIService = {
            name: 'Mistral',
            model: 'mistral-small-latest',
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

                // Note: we lose headers access here with standard stream, but it's safer.
                // If metrics are critical, we'd need a raw fetch.

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
