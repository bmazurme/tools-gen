// src/vector-store/vector-store.service.ts
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ChromaClient, Collection } from 'chromadb';

type SearchResult = {
  content: string;
  metadata: Record<string, any>;
  similarity: number;
};

@Injectable()
export class VectorStoreService {
  private readonly logger = new Logger(VectorStoreService.name);
  private client: ChromaClient;
  private collection: Collection;

  // URL локального сервера Ollama для генерации эмбеддингов
  private readonly localEmbeddingUrl = 'http://localhost:11434/api/embeddings';
  // Модель для генерации эмбеддингов (должна быть загружена в Ollama)
  private readonly embeddingModel = 'nomic-embed-text';

  constructor() {
    this.initializeVectorStore();
  }

  private async initializeVectorStore() {
    try {
      // Инициализируем ChromaDB клиент
      this.client = new ChromaClient({
        host: 'localhost',
        port: 8001,
      });

      // Создаём коллекцию для чанков документов
      this.collection = await this.client.getOrCreateCollection({
        name: 'document-chunks',
        metadata: {
          'hnsw:space': 'cosine',
        },
      });

      // console.log(this.collection);
      this.checkVectorStore();
      this.testEmbeddingGeneration();
      this.testSimilaritySearch();

      this.logger.log('Vector store инициализирован успешно');
    } catch (error) {
      this.logger.error('Ошибка инициализации векторного хранилища:', error);
      throw error;
    }
  }

  async checkVectorStore() {
    const count = await this.collection.count();
    console.log(`В векторной базе: ${count} документов`);
    if (count === 0) {
      console.error('Векторная база пуста! Загрузите документы.');
    }
  }

  async testEmbeddingGeneration() {
    const testQuery = 'Тестовый запрос для проверки эмбеддингов';
    const embedding = await this.generateEmbedding(testQuery);
    console.log('Размер эмбеддинга:', embedding.length);
    console.log('Первые 5 значений:', embedding.slice(0, 5));
  }

  async testSimilaritySearch() {
    const testQueries = [
      'Наполеон не побоялся принять на себя одного ответственность в этом поступке',
      // 'Заговорили тотчас об убийстве герцога Энгиенского',
      // 'Наполеон',
      // 'Абсолютно нерелевантный запрос',
    ];

    for (const query of testQueries) {
      console.log('\n=== ТЕСТОВЫЙ ЗАПРОС:', query);
      const chunks = await this.similaritySearch(query, 3);
      console.log('НАЙДЕНО ЧАНК(ОВ):', chunks.length);
      chunks.forEach((chunk, i) => {
        console.log(
          `--- ЧАНК ${i + 1} (сходство: ${chunk.similarity?.toFixed(3) || 'N/A'}):`,
          chunk.content,
        );
      });
    }
  }

  /**
   * Генерация эмбеддинга для текста через локальную модель (Ollama)
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await axios.post(this.localEmbeddingUrl, {
        model: this.embeddingModel,
        prompt: text,
      });

      if (!response.data.embedding) {
        throw new Error(
          'Ollama не вернул эмбеддинг. Ответ: ' + JSON.stringify(response.data),
        );
      }

      this.logger.log(
        `Эмбеддинг сгенерирован (размер: ${response.data.embedding.length})`,
      );

      return response.data.embedding;
    } catch (error) {
      this.logger.error('Ошибка генерации эмбеддинга:', error);
      throw new Error(
        'Не удалось сгенерировать эмбеддинг. Проверьте работу локальной модели.',
      );
    }
  }

  /**
   * Добавление чанка в векторное хранилище
   */
  async addChunk(
    chunkId: string,
    content: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    try {
      const embedding = await this.generateEmbedding(content);

      await this.collection.add({
        ids: [chunkId],
        embeddings: [embedding],
        documents: [content],
        metadatas: [metadata || {}],
      });

      this.logger.debug(`Чанк добавлен в векторное хранилище: ${chunkId}`);
    } catch (error) {
      this.logger.error(`Ошибка добавления чанка ${chunkId}:`, error);
      throw error;
    }
  }

  async similaritySearch(
    query: string,
    limit: number = 3,
  ): Promise<SearchResult[]> {
    try {
      const queryEmbedding = await this.generateEmbedding(query);
      console.log('Запрос:', query);
      console.log('Размер эмбеддинга:', queryEmbedding.length);

      const results = await this.collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: limit,
        include: ['documents', 'metadatas', 'distances'],
      });

      console.log('Raw ChromaDB response:', JSON.stringify(results, null, 2));

      if (!results.documents?.length || !results.documents[0]?.length) {
        this.logger.warn('Нет результатов поиска для запроса:', query);
        return [];
      }

      // Анализируем distances
      const distances = results.distances?.[0] || [];
      console.log('Расстояния сходства:', distances);

      // Повышаем порог до 0.5 — только умеренно релевантные результаты
      const minSimilarity = 0.25;
      const validIndices = distances
        .map((d, i) => (d >= minSimilarity ? i : -1))
        .filter((i) => i !== -1);

      if (validIndices.length === 0) {
        console.warn(
          `Нет релевантных результатов (сходство < ${minSimilarity}) для запроса: "${query}"`,
        );
        return [];
      }

      console.log(
        `Найдено ${validIndices.length} релевантных чанков с сходством >= ${minSimilarity}`,
      );

      // Форматируем только валидные результаты
      const formattedResults = validIndices.map((index) => ({
        content: results.documents[0][index],
        metadata: results.metadatas?.[0]?.[index] || {},
        similarity: distances[index], // добавляем расстояние для отладки
      }));

      formattedResults.forEach((chunk, i) => {
        console.log(
          `ЧАНК ${i + 1} (сходство: ${chunk.similarity.toFixed(3)}):`,
          chunk.content,
        );
      });

      return formattedResults;
    } catch (error) {
      this.logger.error('Ошибка поиска похожих чанков:', error);
      throw error;
    }
  }

  /**
   * Удаление чанка из векторного хранилища
   */
  async deleteChunk(chunkId: string): Promise<void> {
    try {
      await this.collection.delete({
        ids: [chunkId], // Передаём массив ids
      });
      this.logger.debug(`Чанк удалён из векторного хранилища: ${chunkId}`);
    } catch (error) {
      this.logger.error(`Ошибка удаления чанка ${chunkId}:`, error);
      throw error;
    }
  }

  /**
   * Очистка всего векторного хранилища (для тестирования)
   */
  async clearStore(): Promise<void> {
    try {
      await this.collection.delete({}); // Передаём пустой объект
      this.logger.warn('Векторное хранилище очищено');
    } catch (error) {
      this.logger.error('Ошибка очистки векторного хранилища:', error);
      throw error;
    }
  }

  async findExactContentInVectorStore(
    query: string,
  ): Promise<SearchResult | null> {
    try {
      const results = await this.collection.get({
        where: { document: query }, // зависит от структуры метаданных
        limit: 1,
      });

      if (results.documents?.length && results.documents[0].length) {
        return {
          content: results.documents[0][0],
          metadata: (results.metadatas?.[0]?.[0] as Record<string, any>) || {},
          similarity: 1.0,
        };
      }
      return null;
    } catch (error) {
      this.logger.warn(
        'Ошибка поиска точного совпадения в векторном хранилище:',
        error,
      );
      return null;
    }
  }
}
