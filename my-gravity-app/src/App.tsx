import { ChatContainer, type ChatType, type TChatMessage } from '@gravity-ui/aikit';
import { useState, useCallback, useEffect } from 'react';
import { ThemeProvider } from '@gravity-ui/uikit';

import { aiApi } from './services/aiApi';

export default function App() {
  const [messages, setMessages] = useState<TChatMessage[]>([]);
  const [chats, setChats] = useState<ChatType[]>([]);
  const [activeChat, setActiveChat] = useState<ChatType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const userId = 'user-123'; // Замените на реального пользователя

  const loadChatHistory = useCallback(async (sessionId: string) => {
    setIsLoading(true);
    try {
      const historyResponse = await aiApi.getChatHistory(sessionId);

      const formattedMessages: TChatMessage[] = historyResponse.history.map(msg => ({
        id: msg.id,
        content: msg.content,
        role: msg.role,
        timestamp: msg.timestamp,
      }));

      setMessages(formattedMessages);
    } catch (error) {
      console.error('Ошибка загрузки истории чата:', error);
      setMessages([{
        id: Date.now().toString(),
        content: 'Не удалось загрузить историю чата. Проверьте подключение.',
        role: 'assistant',
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSendMessage = useCallback(async (data: { content: string }) => {
    if (isLoading) return;

    const userMessage: TChatMessage = {
      id: Date.now().toString(),
      content: data.content,
      role: 'user',
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const apiResponse = await aiApi.sendMessage(data.content, activeChat?.id);

      if (!apiResponse.reply) {
        throw new Error('Empty response from AI');
      }

      // Если сессия ещё не активна, но сервер вернул sessionId — создаём новый чат
      if (!activeChat && apiResponse.sessionId) {
        const newChat: ChatType = {
          id: apiResponse.sessionId,
          name: `Чат ${chats.length + 1}`,
          createTime: new Date().toISOString(),
        };

        setChats(prev => [...prev, newChat]);
        setActiveChat(newChat);
        // Не очищаем messages — уже добавили userMessage
      }

      const aiMessage: TChatMessage = {
        // id: (Date.now() + 1).toString(),
        role: 'assistant',
        timestamp: new Date().toISOString(),
        content: apiResponse.reply,
      };
      // console.log(aiMessage);
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Ошибка при общении с AI:', error);

      const errorMessage: TChatMessage = {
        id: (Date.now() + 2).toString(),
        content: 'Произошла ошибка при общении с AI. Проверьте подключение или попробуйте позже.',
        role: 'assistant',
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, chats.length, activeChat]);

  const handleSelectChat = useCallback((chat: ChatType) => {
    setActiveChat(chat);
    loadChatHistory(chat.id);
  }, [loadChatHistory]);

  const handleCreateChat = useCallback(async () => {
    setIsLoading(true);
    try {
      const sessionResponse = await aiApi.createSession(userId);

      const newChat: ChatType = {
        id: sessionResponse.sessionId,
        name: `Чат ${chats.length + 1}`,
        createTime: new Date().toISOString(),
      };

      setChats(prev => [...prev, newChat]);
      setActiveChat(newChat);
      setMessages([]); // Очищаем сообщения для нового чата
    } catch (error) {
      console.error('Ошибка создания сессии чата:', error);
      setMessages([{
        id: Date.now().toString(),
        content: 'Не удалось создать новый чат. Проверьте подключение.',
        role: 'assistant',
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [chats.length, userId]);

  const handleDeleteChat = useCallback(async (chat: ChatType) => {
    setIsLoading(true);
    try {
      await aiApi.clearChatHistory(chat.id);

      setChats(prev => prev.filter(c => c.id !== chat.id));

      if (activeChat?.id === chat.id) {
        setActiveChat(null);
        setMessages([]);
      }
    } catch (error) {
      console.error('Ошибка очистки истории чата:', error);
      setMessages([{
        id: Date.now().toString(),
        content: 'Не удалось удалить чат. Попробуйте позже.',
        role: 'assistant',
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [activeChat]);

  useEffect(() => {
    const loadChatList = async () => {
      setIsLoading(true);
      try {
        const chatList = await aiApi.getChatList(userId);

        // Преобразуем данные под формат ChatType
        const formattedChats: ChatType[] = chatList.map(chat => ({
          id: chat.id,
          name: chat.name || `Чат ${chat.id.slice(-4)}`,
          createTime: chat.createTime,
        }));

        setChats(formattedChats);

        // Автоматически выбираем первый чат, если он есть
        if (formattedChats.length > 0 && !activeChat) {
          setActiveChat(formattedChats[0]);
          loadChatHistory(formattedChats[0].id);
        }
      } catch (error) {
        console.error('Ошибка загрузки списка чатов:', error);
        // Показываем сообщение об ошибке в интерфейсе
        setMessages([{
          id: Date.now().toString(),
          content: 'Не удалось загрузить список чатов. Проверьте подключение.',
          role: 'assistant',
          timestamp: new Date().toISOString(),
        }]);
      } finally {
        setIsLoading(false);
      }
    };

    loadChatList();
  }, [userId]);

  return (
    <ThemeProvider theme={'dark'}>
      <ChatContainer
        className="gap"
        chats={chats}
        activeChat={activeChat}
        messages={messages}
        onSendMessage={handleSendMessage}
        onSelectChat={handleSelectChat}
        onCreateChat={handleCreateChat}
        onDeleteChat={handleDeleteChat}
        status={isLoading ? 'streaming_loading' : 'ready'}
      />
    </ThemeProvider>
  );
}
