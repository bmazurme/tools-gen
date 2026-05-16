import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { ChatSession } from './chat-session.entity';

@Entity()
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  content: string;

  @Column()
  role: string; // 'user' or 'assistant'

  @Column('uuid')
  sessionId: string;

  @ManyToOne(() => ChatSession, (session) => session.messages)
  session: ChatSession;

  @CreateDateColumn()
  createdAt: Date;
}
