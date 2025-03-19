import ChatWindow from '@/components/ChatWindow';
import React from 'react';

const Page = ({ params }: { params: Promise<{ chatId: string }> }) => {
  const { chatId } = React.use(params);
  return <ChatWindow id={chatId} />;
};

export default Page;
