// src/chat/chat.controller.ts
import {
  Controller,
  Post,
  Body,
  UsePipes,
  ValidationPipe,
  Get,
  Param,
} from '@nestjs/common';
import { ChatsService } from './chats.service';
import { AskQuestionDto } from './dto/ask-question.dto';
import { CreateChatSessionDto } from './dto/create-chat-session.dto';
import { ChatSession } from './entities/chat-session.entity';

@Controller('chat')
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  /**
   * Создание новой сессии чата
   */
  @Post('session')
  @UsePipes(new ValidationPipe())
  async createSession(@Body() dto: CreateChatSessionDto): Promise<ChatSession> {
    return this.chatsService.createChatSession(dto.userId);
  }

  /**
   * Отправка вопроса и получение ответа от AI
   */
  @Post('ask')
  @UsePipes(new ValidationPipe())
  async askQuestion(@Body() dto: AskQuestionDto) {
    const response = await this.chatsService.processQuery(dto.question);

    // Сохраняем вопрос и ответ в историю (если указана сессия)
    if (dto.sessionId) {
      await this.chatsService.saveChatMessage(
        dto.sessionId,
        'user',
        dto.question,
      );
      await this.chatsService.saveChatMessage(
        dto.sessionId,
        'assistant',
        response,
      );
    }

    return {
      reply: response,
      sessionId: dto.sessionId || null,
    };
  }

  /**
   * Получение истории чата для конкретной сессии
   */
  @Get('session/:sessionId/history')
  async getChatHistory(@Param('sessionId') sessionId: string) {
    const history = await this.chatsService.getChatHistory(sessionId);
    return { sessionId, history };
  }

  /**
   * Очистка истории чата
   */
  @Post('session/:sessionId/clear')
  async clearChatHistory(@Param('sessionId') sessionId: string) {
    await this.chatsService.clearChatHistory(sessionId);
    return { message: 'История чата очищена' };
  }

  @Get('user/:userId/sessions')
  async getChatList(@Param('userId') userId: string) {
    try {
      const chatSessions =
        await this.chatsService.getChatSessionsByUser(userId);

      return chatSessions.map((session) => ({
        id: session.id,
        name: session.name || `Чат ${session.id.slice(-4)}`,
        createTime: session.createdAt.toISOString(),
        messageCount: session.messages?.length || 0,
      }));
    } catch (error) {
      // this.logger.error(
      //   `Failed to load chat sessions for user ${userId}:`,
      //   error,
      // );
      throw new Error(
        `Не удалось загрузить список чатов для пользователя ${userId}. Проверьте подключение.`,
      );
    }
  }
}
