import { Discover } from '@/app/discover/page';
import Link from 'next/link';

const SmallNewsCard = ({ item }: { item: Discover }) => (
  <Link
    href={`/?q=Summary: ${item.url}`}
    className="rounded-xl overflow-hidden bg-light-primary dark:bg-dark-primary border border-light-200 dark:border-dark-200 group flex flex-col hover:border-light-300 dark:hover:border-dark-300 transition-colors duration-200"
    target="_blank"
  >
    <div className="relative aspect-video overflow-hidden border-b border-light-200 dark:border-dark-200">
      <img
        className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500 ease-in-out"
        src={
          new URL(item.thumbnail).origin +
          new URL(item.thumbnail).pathname +
          `?id=${new URL(item.thumbnail).searchParams.get('id')}`
        }
        alt={item.title}
      />
    </div>
    <div className="p-4 flex flex-col gap-2">
      <h3 className="font-medium text-base leading-snug line-clamp-2 group-hover:text-[#24A0ED] transition-colors duration-200">
        {item.title}
      </h3>
      <p className="text-black/60 dark:text-white/60 text-xs leading-relaxed line-clamp-3">
        {item.content}
      </p>
    </div>
  </Link>
);

export default SmallNewsCard;
