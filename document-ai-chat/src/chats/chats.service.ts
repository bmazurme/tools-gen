// src/chat/chat.service.ts
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

import { VectorStoreService } from '../vector-store/vector-store.service';

import { ChatSession } from './entities/chat-session.entity';
import { ChatMessage } from './entities/chat-message.entity';

@Injectable()
export class ChatsService {
  private readonly logger = new Logger(ChatsService.name);

  // URL локального сервера Ollama для генерации ответов
  private readonly localLlamaUrl = 'http://localhost:11434/api/chat';
  // Модель для генерации ответов (должна быть загружена в Ollama)
  private readonly llamaModel = 'llama3';

  constructor(
    private vectorStore: VectorStoreService,
    @InjectRepository(ChatSession)
    private chatSessionRepository: Repository<ChatSession>,
    @InjectRepository(ChatMessage)
    private chatMessageRepository: Repository<ChatMessage>,
  ) {}

  async processQuery(query: string): Promise<string> {
    try {
      // Поиск релевантных чанков
      const relevantChunks = await this.vectorStore.similaritySearch(query, 25);
      console.log('=== ЗАПРОС:', query);
      console.log('=== НАЙДЕНО ЧАНК(ОВ):', relevantChunks.length);

      relevantChunks.forEach((chunk, i) => {
        console.log(
          `--- ЧАНК ${i + 1} (длина: ${chunk.content.length}):`,
          chunk.content,
        );
      });

      if (relevantChunks.length === 0) {
        return 'Не удалось найти информацию по вашему запросу.';
      }

      // Формирование промпта с контекстом
      const context = relevantChunks
        .map((chunk, index) => `Фрагмент ${index + 1}:\n${chunk.content}`)
        .join('\n\n');

      const prompt = `
Ты — помощник, отвечающий на вопросы строго на основе предоставленного контекста.
Если ответа нет в контексте, скажи: "Не удалось найти информацию по вашему запросу."

Важные правила:
1. Не выдумывай информацию, отвечай со ссылкой на источник.
2. Если контекст пуст, отвечай: "Не удалось найти информацию."
3. Отвечай по существу.
4. Отвечай на русском языке.

Контекст (наиболее релевантные фрагменты):
${context}

Вопрос пользователя: ${query}

Ответ (на русском языке):
    `.trim();

      // Запрос к локальной модели через Ollama
      const response = await axios.post(this.localLlamaUrl, {
        model: this.llamaModel,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        stream: false,
        options: {
          temperature: 0.7,
          num_ctx: 4000,
        },
      });

      if (!response.data?.message?.content) {
        throw new Error('Empty response from Ollama');
      }

      return response.data.message.content;
    } catch (error) {
      this.logger.error('Ошибка при обработке запроса через Ollama:', error);

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 500) {
          throw new Error('Сервер Ollama недоступен. Проверьте его работу.');
        }
      }

      throw new Error(
        'Не удалось получить ответ от локальной модели. Проверьте её работу.',
      );
    }
  }

  async createChatSession(userId: string): Promise<ChatSession> {
    return this.chatSessionRepository.save({ userId });
  }

  async getChatHistory(sessionId: string) {
    return this.chatMessageRepository.find({
      where: { sessionId },
      order: { createdAt: 'ASC' },
    });
  }

  async saveChatMessage(sessionId: string, role: string, content: string) {
    await this.chatMessageRepository.save({
      sessionId,
      role,
      content,
    });
  }

  async clearChatHistory(sessionId: string) {
    const session = await this.chatSessionRepository.findOne({
      where: { id: sessionId },
    });
    console.log(session);

    if (!session) {
      throw new Error(`Сессия чата с ID ${sessionId} не найдена`);
    }

    await this.chatSessionRepository.delete(sessionId);
  }

  async getChatSessionsByUser(userId: string): Promise<ChatSession[]> {
    return this.chatSessionRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      relations: ['messages'],
    });
  }
}
