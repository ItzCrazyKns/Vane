import ChatWindow from '@/components/ChatWindow';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata');
  return { title: t('chatTitle'), description: t('chatDescription') };
}

const Home = () => {
  return <ChatWindow />;
};

export default Home;
