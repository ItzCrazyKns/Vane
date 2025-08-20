'use client';

import ChatWindow from '@/components/ChatWindow';
import { useParams } from 'next/navigation';
import React from 'react';
import { ChatProvider } from '@/lib/hooks/useChat';

const Page = () => {
  const { chatId }: { chatId: string } = useParams();
  return (
    <ChatProvider id={chatId}>
      <ChatWindow />
    </ChatProvider>
  );
};

export default Page;
