import OpenAI from 'openai';
import type { AIService, ChatMessage } from '../types';

export const grokFactory = {
    isEnabled: () => !!process.env.XAI_API_KEY,
    create: (): AIService => {
        const openai = new OpenAI({
            apiKey: process.env.XAI_API_KEY,
            baseURL: 'https://api.x.ai/v1',
        });

        const service: AIService = {
            name: 'Grok',
            model: 'grok-beta',
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
                const rawResponse = await openai.chat.completions.create({
                    model: this.model,
                    messages: messages.map(m => ({
                        role: m.role as 'system' | 'user' | 'assistant',
                        content: m.content
                    })),
                    stream: true,
                }).asResponse();

                const headers = rawResponse.headers;
                this.metrics = {
                    remainingRequests: headers.get('x-ratelimit-remaining-requests') ? parseInt(headers.get('x-ratelimit-remaining-requests') || '0') : undefined,
                    remainingTokens: headers.get('x-ratelimit-remaining-tokens') ? parseInt(headers.get('x-ratelimit-remaining-tokens') || '0') : undefined,
                    resetTime: Date.now()
                };

                const stream = OpenAI.Chat.Completions.ChatCompletionStream.fromReadableStream(rawResponse.body as any);

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
