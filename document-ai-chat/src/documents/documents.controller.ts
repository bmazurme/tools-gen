import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { Document } from './entities/document.entity';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  /**
   * Загрузка документа
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<Document> {
    console.log(file);
    return this.documentsService.uploadDocument(file);
  }

  /**
   * Получение списка всех документов
   */
  @Get()
  async getDocuments(): Promise<Document[]> {
    return this.documentsService.getDocuments();
  }

  /**
   * Получение документа по ID (с чанками)
   */
  @Get(':documentId')
  async getDocument(
    @Param('documentId') documentId: string,
  ): Promise<Document> {
    const document = await this.documentsService.getDocumentById(documentId);

    if (!document) {
      throw new Error('Документ не найден');
    }

    return document;
  }

  /**
   * Удаление документа по ID
   */
  @Delete(':documentId')
  async deleteDocument(@Param('documentId') documentId: string): Promise<void> {
    await this.documentsService.deleteDocument(documentId);
  }

  /**
   * Получение чанков документа по ID документа
   */
  @Get(':documentId/chunks')
  async getDocumentChunks(
    @Param('documentId') documentId: string,
  ): Promise<{ content: string; id: string }[]> {
    const chunks = await this.documentsService.getDocumentChunks(documentId);

    return chunks;
  }
}
