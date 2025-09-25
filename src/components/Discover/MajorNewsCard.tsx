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
    className="w-full group flex flex-row items-stretch gap-6 h-60 py-3"
    target="_blank"
  >
    {isLeft ? (
      <>
        <div className="relative w-80 h-full overflow-hidden rounded-2xl flex-shrink-0">
          <img
            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
            src={
              new URL(item.thumbnail).origin +
              new URL(item.thumbnail).pathname +
              `?id=${new URL(item.thumbnail).searchParams.get('id')}`
            }
            alt={item.title}
          />
        </div>
        <div className="flex flex-col justify-center flex-1 py-4">
          <h2
            className="text-3xl font-light mb-3 leading-tight line-clamp-3 group-hover:text-cyan-500 dark:group-hover:text-cyan-300 transition duration-200"
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
        <div className="flex flex-col justify-center flex-1 py-4">
          <h2
            className="text-3xl font-light mb-3 leading-tight line-clamp-3 group-hover:text-cyan-500 dark:group-hover:text-cyan-300 transition duration-200"
            style={{ fontFamily: 'PP Editorial, serif' }}
          >
            {item.title}
          </h2>
          <p className="text-black/60 dark:text-white/60 text-base leading-relaxed line-clamp-4">
            {item.content}
          </p>
        </div>
        <div className="relative w-80 h-full overflow-hidden rounded-2xl flex-shrink-0">
          <img
            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
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
