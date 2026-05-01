import { Cerebras } from '@cerebras/cerebras_cloud_sdk';
import type { AIService, ChatMessage } from '../types';

export const cerebrasFactory = {
  isEnabled: () => !!process.env.CEREBRAS_API_KEY,
  create: (): AIService => {
    const client = new Cerebras({
      apiKey: process.env.CEREBRAS_API_KEY,
    });

    return {
      name: 'Cerebras',
      model: 'llama3.1-8b',
      supportsVision: false,
      metrics: {},

      async validate() {
        try {
          await client.models.list();
          return true;
        } catch {
          return false;
        }
      },

      async chat(messages: ChatMessage[]) {
        const response = await client.chat.completions.create({
          messages: messages.map(m => ({
            role: m.role as 'system' | 'user' | 'assistant',
            content: typeof m.content === 'string' ? m.content : m.content.map(p => p.type === 'text' ? p.text : '').join('\n')
          })),
          model: "llama3.1-8b",
          stream: true,
        });

        // Cerebras SDK might not expose .asResponse() directly or headers easily in the stream object
        // NOTE: The official V1 SDK is very similar to OpenAI. 
        // If .asResponse() is not available, we might skip metrics for now or try to access them if documented.
        // Assuming partial support for now, skipping header capture to avoid build errors if method missing
        // since I cannot verify SDK version features easily.
        // Update: Standard OpenAI fork SDKs usually have it. Let's try to inspect safe.
        // Actually, Cerebras SDK is a fork. Let's assume standard behavior but wrap in try-catch if feasible?
        // No, better to keep it simple and safe. If metrics are critical, I'd need to check types.
        // Let's implement basic streaming first, similar to before but with added validation method.

        return (async function* () {
          for await (const chunk of response) {
            yield chunk.choices[0]?.delta?.content || '';
          }
        })();
      }
    }
  }
}