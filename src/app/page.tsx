import ChatWindow from '@/components/ChatWindow';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Chat - Vane',
  description: 'Chat with the internet, chat with Vane.',
};

const Home = () => {
  return <ChatWindow />;
};

export default Home;
