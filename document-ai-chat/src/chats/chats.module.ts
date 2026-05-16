import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DocumentsModule } from '../documents/documents.module';
import { ChatsService } from './chats.service';
import { ChatsController } from './chats.controller';

import { ChatSession } from './entities/chat-session.entity';
import { ChatMessage } from './entities/chat-message.entity';

import { VectorStoreService } from '../vector-store/vector-store.service';

@Module({
  imports: [
    DocumentsModule,
    TypeOrmModule.forFeature([ChatSession, ChatMessage]),
  ],
  controllers: [ChatsController],
  providers: [ChatsService, VectorStoreService],
  exports: [ChatsService],
})
export class ChatsModule {}
