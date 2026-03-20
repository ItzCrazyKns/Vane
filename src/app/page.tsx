import ChatWindow from '@/components/ChatWindow';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Chat - ShloomTheory Search',
  description: 'Chat with the internet, chat with ShloomTheory Search.',
};

const Home = () => {
  return <ChatWindow />;
};

export default Home;
