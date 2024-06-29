import ChatWindow from '@/components/ChatWindow';

const Page = ({ params }: { params: { chatId: string } }) => {
  return <ChatWindow id={params.chatId} />;
};

export default Page;
