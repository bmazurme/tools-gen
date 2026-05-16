import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DocumentsModule } from './documents/documents.module';
import { ChatsModule } from './chats/chats.module';

import { Document } from './documents/entities/document.entity';
import { DocumentChunk } from './documents/entities/document-chunk.entity';
import { ChatSession } from './chats/entities/chat-session.entity';
import { ChatMessage } from './chats/entities/chat-message.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'newPassword',
      database: 'document_ai',
      entities: [Document, DocumentChunk, ChatSession, ChatMessage],
      synchronize: true,
    }),
    DocumentsModule,
    ChatsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
