import { Injectable, OnModuleInit } from '@nestjs/common';
import { ChromaClient, Collection, getEmbeddingFunction } from 'chromadb';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class VectorStoreService implements OnModuleInit {
  private client: ChromaClient;
  private collection: Collection;

  constructor() {
    // Явно указываем URL ChromaDB
    this.client = new ChromaClient({
      path: 'http://localhost:8001',
    });
  }

  async onModuleInit() {
    try {
      await this.initCollection();
      console.log('Коллекция ChromaDB инициализирована');

      try {
        await this.ingestDocuments('./documents');
        console.log('Документы успешно загружены в ChromaDB');
      } catch (error) {
        console.warn('Не удалось загрузить документы при старте:', error);
      }
    } catch (error) {
      console.error('Критическая ошибка инициализации ChromaDB:', error);
    }
  }

  private async initCollection() {
    console.log('Инициализация коллекции ChromaDB...');

    try {
      // Получаем функцию эмбеддингов
      const embeddingFunction = await getEmbeddingFunction({
        client: this.client,
        efConfig: {
          name: 'default',
          type: 'known',
          config: {},
        },
      });

      this.collection = await this.client.getOrCreateCollection({
        name: 'documents',
        embeddingFunction,
      });

      console.log(
        '✅ Коллекция ChromaDB успешно создана с функцией эмбеддингов',
      );
    } catch (error) {
      console.error('❌ Ошибка создания коллекции:', error);
      throw error;
    }
  }

  async ingestDocuments(directoryPath: string) {
    if (!fs.existsSync(directoryPath)) {
      throw new Error(`Папка ${directoryPath} не найдена`);
    }

    const files = fs.readdirSync(directoryPath);

    for (const file of files) {
      if (file.endsWith('.txt')) {
        const filePath = path.join(directoryPath, file);
        const content = fs.readFileSync(filePath, 'utf8');

        await this.collection.add({
          ids: [`doc_${Date.now()}_${file}`],
          documents: [content],
          metadatas: [{ source: file }],
        });
        console.log(`✅ Документ ${file} загружен в ChromaDB`);
      }
    }
  }

  async searchSimilar(query: string, limit: number = 3): Promise<any[]> {
    if (!this.collection) {
      throw new Error('Коллекция не инициализирована');
    }

    try {
      const results = await this.collection.query({
        queryTexts: [query],
        nResults: limit,
      });

      return results.documents[0] || [];
    } catch (error) {
      console.error('Ошибка поиска в ChromaDB:', error);
      return [];
    }
  }
}
