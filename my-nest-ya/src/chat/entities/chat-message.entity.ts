import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { ChatSession } from './chat-session.entity';

@Entity()
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ enum: ['user', 'assistant'] })
  role: 'user' | 'assistant';

  @ManyToOne(() => ChatSession, (session) => session.messages)
  @JoinColumn()
  session: ChatSession;

  @CreateDateColumn()
  timestamp: Date;
}
