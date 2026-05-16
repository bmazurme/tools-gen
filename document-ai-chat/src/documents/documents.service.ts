import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Repository, In } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

// import * as PDFParser from 'pdf-parse';
// import * as docx from 'docx';

import { Document } from './entities/document.entity';
import { DocumentChunk } from './entities/document-chunk.entity';
import { VectorStoreService } from '../vector-store/vector-store.service';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private readonly uploadPath = './uploads';
  private readonly chunkSize = 1000; // Размер чанка в символах

  constructor(
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
    @InjectRepository(DocumentChunk)
    private documentChunkRepository: Repository<DocumentChunk>,
    private vectorStoreService: VectorStoreService,
  ) {
    // Создаём папку для загрузок, если её нет
    if (!fs.existsSync(this.uploadPath)) {
      fs.mkdirSync(this.uploadPath, { recursive: true });
    }
  }

  /**
   * Загрузка документа и его обработка
   */
  async uploadDocument(file: Express.Multer.File): Promise<Document> {
    try {
      // Сохраняем файл на диск
      const filePath = await this.saveFileToDisk(file);

      // Извлекаем текст из документа
      const textContent = await this.extractTextFromFile(file, filePath);

      // Создаём запись документа в БД
      const document = await this.documentRepository.save({
        name: file.originalname,
        filePath: filePath,
      });

      // Разбиваем текст на чанки и сохраняем
      await this.createDocumentChunks(document.id, textContent);

      this.logger.log(
        `Документ загружен: ${document.name} (ID: ${document.id})`,
      );

      return document;
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      this.logger.error(`Ошибка загрузки документа: ${errorMessage}`);
      throw new BadRequestException(
        `Не удалось загрузить документ: ${errorMessage}`,
      );
    }
  }

  /**
   * Сохранение файла на диск
   */
  private async saveFileToDisk(file: Express.Multer.File): Promise<string> {
    const filePath = path.join(this.uploadPath, file.originalname);

    return new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(filePath);
      writeStream.on('finish', () => resolve(filePath));
      writeStream.on('error', (err) => reject(err));
      writeStream.write(file.buffer);
      writeStream.end();
    });
  }

  /**
   * Извлечение текста из файла в зависимости от типа
   */
  private async extractTextFromFile(
    file: Express.Multer.File,
    filePath: string,
  ): Promise<string> {
    const extension = path.extname(file.originalname).toLowerCase();

    switch (extension) {
      // case '.pdf':
      //   return await this.extractTextFromPDF(filePath);
      // case '.docx':
      //   return await this.extractTextFromDOCX(filePath);
      case '.txt':
        return fs.readFileSync(filePath, 'utf8');
      default:
        throw new BadRequestException('Неподдерживаемый формат файла');
    }
  }

  /**
   * Извлечение текста из PDF
   */
  // private async extractTextFromPDF(filePath: string): Promise<string> {
  //   const pdfParser = new PDFParser();
  //   const data = await pdfParser.parseBuffer(fs.readFileSync(filePath));
  //   return data.text || '';
  // }

  /**
   * Извлечение текста из DOCX
   */
  // private async extractTextFromDOCX(filePath: string): Promise<string> {
  //   const content = fs.readFileSync(filePath);
  //   const extracted = await docx.extractAsync(content);
  //   return extracted.fullText || '';
  // }

  /**
   * Разбиение текста на чанки и сохранение в БД
   */
  private async createDocumentChunks(
    documentId: string,
    text: string,
  ): Promise<void> {
    const chunks = this.splitTextIntoChunks(text, this.chunkSize);
    const chunkEntities = [];

    for (const chunkContent of chunks) {
      try {
        const chunkUuid = uuidv4();
        // Генерируем эмбеддинг для чанка
        const embedding =
          await this.vectorStoreService.generateEmbedding(chunkContent);

        const vectorId = `${documentId}_chunk_${chunkEntities.length}`;

        // Добавляем чанк в векторное хранилище
        await this.vectorStoreService.addChunk(vectorId, chunkContent, {
          documentId: documentId,
        });
        this.logger.debug(`Чанк добавлен в векторное хранилище: ${chunkUuid}`);

        chunkEntities.push({
          id: chunkUuid,
          content: chunkContent,
          embedding: embedding, // теперь поле заполнено реальным вектором
          documentId: documentId,
          vectorId: vectorId,
        });
      } catch (error) {
        this.logger.warn(
          `Пропущен чанк из‑за ошибки генерации эмбеддинга: ${this.getErrorMessage(error)}`,
        );
      }
    }

    if (chunkEntities.length > 0) {
      await this.documentChunkRepository.save(chunkEntities);
      this.logger.log(
        `Успешно создано ${chunkEntities.length} чанков с эмбеддингами для документа ${documentId}`,
      );
    } else {
      throw new BadRequestException(
        'Не удалось создать ни одного чанка с эмбеддингом',
      );
    }
  }

  /**
   * Разбиение текста на чанки
   */
  private splitTextIntoChunks(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Получение списка всех документов
   */
  async getDocuments(): Promise<Document[]> {
    return this.documentRepository.find({
      relations: ['chunks'],
    });
  }

  /**
   * Удаление документа и всех его чанков
   */
  async deleteDocument(documentId: string): Promise<void> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
      relations: ['chunks'],
    });

    if (!document) {
      throw new BadRequestException('Документ не найден');
    }

    // Удаляем файл с диска
    if (fs.existsSync(document.filePath)) {
      fs.unlinkSync(document.filePath);
    }

    // Удаляем чанки
    if (document.chunks && document.chunks.length > 0) {
      await this.documentChunkRepository.delete({
        id: In(document.chunks.map((chunk) => chunk.id)),
      });
    }

    // Удаляем документ из БД
    await this.documentRepository.delete(documentId);
    this.logger.log(`Документ ${document.name} удалён`);
  }

  private isErrorWithMessage(error: unknown): error is { message: string } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof (error as { message: string }).message === 'string'
    );
  }

  private getErrorMessage(error: unknown): string {
    if (this.isErrorWithMessage(error)) {
      return error.message;
    }
    return String(error);
  }

  async getDocumentById(documentId: string): Promise<Document> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
      relations: ['chunks'],
    });

    if (!document) {
      throw new BadRequestException('Документ не найден');
    }

    return document;
  }

  async getDocumentChunks(
    documentId: string,
  ): Promise<{ content: string; id: string }[]> {
    return this.documentChunkRepository.find({
      where: { id: documentId },
      select: ['content', 'id'],
    });
  }

  async findExactChunkMatch(query: string): Promise<DocumentChunk | null> {
    return this.documentChunkRepository.findOne({
      where: { content: query },
    });
  }
}
