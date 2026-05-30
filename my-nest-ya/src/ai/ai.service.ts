import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private client: OpenAI;

  constructor(private configService: ConfigService) {
    this.initializeClient();
  }

  private initializeClient(): void {
    const apiKey = this.configService.get<string>('YANDEX_CLOUD_API_KEY');
    const folderId = this.configService.get<string>('YANDEX_CLOUD_FOLDER');

    if (!apiKey || !folderId) {
      throw new Error('Yandex Cloud API key or folder ID is not configured');
    }

    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://ai.api.cloud.yandex.net/v1',
      defaultHeaders: {
        'OpenAI-Project': folderId,
      },
    });
  }

  async generateResponse(
    prompt: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      systemMessage?: string;
    },
  ): Promise<string> {
    const {
      temperature = 0.3,
      maxTokens = 500,
      systemMessage = 'Ты — помощник, использующий контекст для ответов. Если информации недостаточно, скажи об этом.',
    } = options || {};

    try {
      const response = await this.client.chat.completions.create({
        model: `gpt://${this.configService.get('YANDEX_CLOUD_FOLDER')}/${this.configService.get('YANDEX_CLOUD_MODEL')}`,
        messages: [
          {
            role: 'system',
            content: systemMessage,
          },
          { role: 'user', content: prompt },
        ],
        temperature: temperature,
        max_tokens: maxTokens,
      });

      return response.choices[0].message.content || 'Не удалось получить ответ';
    } catch (error) {
      console.error('AI API error:', error);
      throw new Error('Ошибка при обращении к AI сервису');
    }
  }
}
