import ChatWindow from '@/components/ChatWindow';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Chat - Perplexica',
  description: 'Chat with the internet, chat with Perplexica.',
};

const Home = () => {
  return <ChatWindow />;
};

export default Home;
