import { NewspaperIcon } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

/** Article image with a neutral placeholder when there is none or it fails. */
const ArticleImage = ({
  src,
  alt,
  className,
}: {
  src?: string;
  alt: string;
  className?: string;
}) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={cn(
          'flex items-center justify-center w-full h-full bg-light-200 dark:bg-dark-200 text-black/30 dark:text-white/30',
          className,
        )}
      >
        <NewspaperIcon size={28} />
      </div>
    );
  }

  return (
    <img
      className={cn('object-cover w-full h-full', className)}
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
};

export default ArticleImage;
