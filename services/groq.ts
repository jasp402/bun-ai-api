import { Groq } from 'groq-sdk';
import type { AIService, ChatMessage, ServiceMetrics } from '../types';

export const groqFactory = {
  isEnabled: () => !!process.env.GROQ_API_KEY,
  create: (): AIService => {
    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });

    const service: AIService = {
      name: 'Groq',
      model: 'llama-3.3-70b-versatile',
      metrics: {},

      async validate() {
        try {
          // Groq might not support listing models with this SDK version or key, 
          // but let's try a minimal completion to be sure.
          const completion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: 'test' }],
            max_tokens: 1
          });
          return !!completion.choices[0];
        } catch {
          return false;
        }
      },

      async chat(messages: ChatMessage[]) {
        const stream = await groq.chat.completions.create({
          messages: messages.map(m => ({
            role: m.role as any,
            content: typeof m.content === 'string' ? m.content : m.content.map(p => p.type === 'text' ? p.text : '').join('\n')
          })),
          model: this.model,
          temperature: 0.6,
          max_completion_tokens: 4096,
          top_p: 1,
          stream: true,
          stop: null
        });

        // Metrics logic removed as we don't get headers in standard stream easily
        // and previous logic was using a non-existent body.

        return (async function* () {
          for await (const chunk of stream) {
            yield chunk.choices[0]?.delta?.content || ''
          }
        })()

        return (async function* () {
          for await (const chunk of stream) {
            yield chunk.choices[0]?.delta?.content || ''
          }
        })()
      }
    };
    return service;
  }
}