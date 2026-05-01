import OpenAI from 'openai';
import type { AIService, ChatMessage } from '../types';

export const glmFactory = {
    isEnabled: () => !!process.env.ZHIPU_API_KEY,
    create: (): AIService => {
        const openai = new OpenAI({
            apiKey: process.env.ZHIPU_API_KEY,
            baseURL: 'https://open.bigmodel.cn/api/paas/v4/',
        });

        const service: AIService = {
            name: 'GLM',
            model: 'glm-4-flash',
            supportsVision: false,
            metrics: {},

            async validate() {
                try {
                    // Try a minimal chat completion to verify model, not just list models.
                    const completion = await openai.chat.completions.create({
                        model: 'glm-4-flash',
                        messages: [{ role: 'user', content: 'test' }],
                        max_tokens: 1,
                    });
                    return !!completion.choices[0];
                } catch (e: any) {
                    console.error("GLM Validation Failed:", e.message);
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
