import { Discover } from '@/app/discover/page';
import Link from 'next/link';

const MajorNewsCard = ({
  item,
  isLeft = true,
}: {
  item: Discover;
  isLeft?: boolean;
}) => (
  <Link
    href={`/?q=Summary: ${item.url}`}
    className="w-full group flex flex-col md:flex-row items-stretch gap-6 min-h-[16rem] p-4 rounded-2xl hover:bg-light-secondary dark:hover:bg-dark-secondary transition-colors duration-200"
    target="_blank"
  >
    {isLeft ? (
      <>
        <div className="relative w-full md:w-1/2 h-48 md:h-auto overflow-hidden rounded-xl flex-shrink-0 border border-light-200 dark:border-dark-200">
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
        <div className="flex flex-col justify-center flex-1 py-2">
          <h2
            className="text-3xl font-medium mb-3 leading-tight line-clamp-3 group-hover:text-[#24A0ED] transition-colors duration-200"
            style={{ fontFamily: 'PP Editorial, serif' }}
          >
            {item.title}
          </h2>
          <p className="text-black/60 dark:text-white/60 text-base leading-relaxed line-clamp-4">
            {item.content}
          </p>
        </div>
      </>
    ) : (
      <>
        <div className="flex flex-col justify-center flex-1 py-2 order-2 md:order-1">
          <h2
            className="text-3xl font-medium mb-3 leading-tight line-clamp-3 group-hover:text-[#24A0ED] transition-colors duration-200"
            style={{ fontFamily: 'PP Editorial, serif' }}
          >
            {item.title}
          </h2>
          <p className="text-black/60 dark:text-white/60 text-base leading-relaxed line-clamp-4">
            {item.content}
          </p>
        </div>
        <div className="relative w-full md:w-1/2 h-48 md:h-auto overflow-hidden rounded-xl flex-shrink-0 border border-light-200 dark:border-dark-200 order-1 md:order-2">
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
      </>
    )}
  </Link>
);

export default MajorNewsCard;
