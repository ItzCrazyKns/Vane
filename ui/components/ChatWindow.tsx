'use client';

import { useEffect, useState } from 'react';
import { Document } from '@langchain/core/documents';
import Navbar from './Navbar';
import Chat from './Chat';
import EmptyChat from './EmptyChat';

export type Message = {
  id: string;
  createdAt?: Date;
  content: string;
  role: 'user' | 'assistant';
  sources?: Document[];
};

const useSocket = (url: string) => {
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    if (!ws) {
      const ws = new WebSocket(url);
      ws.onopen = () => {
        console.log('[DEBUG] open');
        setWs(ws);
      };
    }

    return () => {
      ws?.close();
      console.log('[DEBUG] closed');
    };
  }, [ws, url]);

  return ws;
};

const ChatWindow = () => {
  const ws = useSocket(process.env.NEXT_PUBLIC_WS_URL!);
  const [chatHistory, setChatHistory] = useState<[string, string][]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [messageAppeared, setMessageAppeared] = useState(false);

  const sendMessage = async (message: string) => {
    if (loading) return;
    setLoading(true);
    setMessageAppeared(false);

    let sources: Document[] | undefined = undefined;
    let recievedMessage = '';
    let added = false;

    ws?.send(
      JSON.stringify({
        type: 'message',
        content: message,
        history: [...chatHistory, ['human', message]],
      }),
    );

    setMessages((prevMessages) => [
      ...prevMessages,
      {
        content: message,
        id: Math.random().toString(36).substring(7),
        role: 'user',
      },
    ]);

    const messageHandler = (e: MessageEvent) => {
      const data = JSON.parse(e.data);

      if (data.type === 'sources') {
        sources = data.data;
        if (!added) {
          setMessages((prevMessages) => [
            ...prevMessages,
            {
              content: '',
              id: data.messageId,
              role: 'assistant',
              sources: sources,
            },
          ]);
          added = true;
        }
        setMessageAppeared(true);
      }

      if (data.type === 'message') {
        if (!added) {
          setMessages((prevMessages) => [
            ...prevMessages,
            {
              content: data.data,
              id: data.messageId,
              role: 'assistant',
              sources: sources,
            },
          ]);
          added = true;
        }

        setMessages((prev) =>
          prev.map((message) => {
            if (message.id === data.messageId) {
              return { ...message, content: message.content + data.data };
            }

            return message;
          }),
        );

        recievedMessage += data.data;
        setMessageAppeared(true);
      }

      if (data.type === 'messageEnd') {
        setChatHistory((prevHistory) => [
          ...prevHistory,
          ['human', message],
          ['assistant', recievedMessage],
        ]);
        ws?.removeEventListener('message', messageHandler);
        setLoading(false);
      }
    };

    ws?.addEventListener('message', messageHandler);
  };

  const rewrite = (messageId: string) => {
    const index = messages.findIndex((msg) => msg.id === messageId);

    if (index === -1) return;

    const message = messages[index - 1];

    setMessages((prev) => {
      return [...prev.slice(0, messages.length > 2 ? index - 1 : 0)];
    });
    setChatHistory((prev) => {
      return [...prev.slice(0, messages.length > 2 ? index - 1 : 0)];
    });

    sendMessage(message.content);
  };

  return (
    <div>
      {messages.length > 0 ? (
        <>
          <Navbar />
          <Chat
            loading={loading}
            messages={messages}
            sendMessage={sendMessage}
            messageAppeared={messageAppeared}
            rewrite={rewrite}
          />
        </>
      ) : (
        <EmptyChat sendMessage={sendMessage} />
      )}
    </div>
  );
};

export default ChatWindow;
