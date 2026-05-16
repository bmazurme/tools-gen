import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';

import { DocumentChunk } from './entities/document-chunk.entity';
import { Document } from './entities/document.entity';

import { VectorStoreModule } from '../vector-store/vector-store.module';

@Module({
  imports: [
    VectorStoreModule,
    TypeOrmModule.forFeature([Document, DocumentChunk]),
    MulterModule.register({
      storage: memoryStorage(), // Используем memoryStorage вместо diskStorage
      limits: { fileSize: 10 * 1024 * 1024 }, // ограничение в 10MB
      // fileFilter: (req, file, cb) => {
      //   // const imageTypes = ['image/png', 'image/jpeg', 'image/jpg'];
      //   // if (imageTypes.includes(file.mimetype)) {
      //   //   return cb(null, true);
      //   // }
      //   // cb(new Error('Только изображения разрешены'), false);
      // },
    }),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
