import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Document } from './document.entity';

@Entity()
export class DocumentChunk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  content: string;

  @Column('simple-array')
  embedding: number[];

  @Column()
  documentId: string;

  @Column('varchar', { nullable: true })
  vectorId: string;

  @ManyToOne(() => Document, (document) => document.chunks, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  document: Document;
}
