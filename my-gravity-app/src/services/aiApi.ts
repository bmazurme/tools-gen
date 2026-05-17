export interface AIResponse {
  reply: string;
  sessionId: string | null; // Всегда присутствует, может быть null
  error?: string;
}

export interface ChatHistoryResponse {
  sessionId: string;
  history: Array<{
    id: string;
    content: string;
    role: 'user' | 'assistant';
    timestamp: string; // Формат ISO string
  }>;
}

export const aiApi = {
  // Создание новой сессии чата
  createSession: async (userId: string): Promise<{ sessionId: string }> => {
    const response = await fetch('/api/chat/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: ChatSession = await response.json();
    return { sessionId: data.sessionId };
  },

  // Отправка вопроса и получение ответа
  sendMessage: async (
    message: string,
    sessionId?: string
  ): Promise<AIResponse> => {
    const response = await fetch('/api/chat/ask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: message,
        sessionId: sessionId || null,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `HTTP error! status: ${response.status}, message: ${errorData.message || 'Unknown error'}`
      );
    }

    return await response.json(); // Убедитесь, что сервер возвращает { reply, sessionId }
  },

  // Получение истории чата
  getChatHistory: async (sessionId: string): Promise<ChatHistoryResponse> => {
    const response = await fetch(`/api/chat/session/${sessionId}/history`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  },

  // Очистка истории чата
  clearChatHistory: async (sessionId: string): Promise<{ message: string }> => {
    const response = await fetch(`/api/chat/session/${sessionId}/clear`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  },

  getChatList: async (userId: string): Promise<Array<{
    id: string;
    name: string;
    createTime: string;
    messageCount: number;
  }>> => {
    const response = await fetch(`/api/chat/user/${userId}/sessions`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  },
};

// Дополнительный тип для ответа createSession
interface ChatSession {
  sessionId: string;
  // Другие поля, которые может возвращать сервис
}
