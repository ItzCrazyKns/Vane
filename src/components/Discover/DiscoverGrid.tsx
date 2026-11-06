import type { ReactNode } from 'react';
import type { DiscoverItem } from '@/lib/discover/types';
import MajorNewsCard from './MajorNewsCard';
import SmallNewsCard from './SmallNewsCard';

/**
 * Desktop layout: one large card, three small, two large side by side,
 * three small, and so on. Mobile shows a simple grid of small cards.
 */
const DesktopLayout = ({ items }: { items: DiscoverItem[] }) => {
  const sections: ReactNode[] = [];
  let index = 0;

  while (index < items.length) {
    if (sections.length > 0) {
      sections.push(
        <hr
          key={`sep-${index}`}
          className="border-t border-light-200/20 dark:border-dark-200/20 my-3 w-full"
        />,
      );
    }

    if (index < items.length) {
      sections.push(
        <MajorNewsCard
          key={`major-${index}`}
          item={items[index]}
          isLeft={false}
        />,
      );
      index++;
    }

    if (index < items.length) {
      sections.push(
        <hr
          key={`sep-${index}-after`}
          className="border-t border-light-200/20 dark:border-dark-200/20 my-3 w-full"
        />,
      );
    }

    if (index < items.length) {
      const smallCards = items.slice(index, index + 3);
      sections.push(
        <div
          key={`small-group-${index}`}
          className="grid lg:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-4"
        >
          {smallCards.map((item, i) => (
            <SmallNewsCard key={`small-${index + i}`} item={item} />
          ))}
        </div>,
      );
      index += 3;
    }

    if (index < items.length) {
      sections.push(
        <hr
          key={`sep-${index}-after-small`}
          className="border-t border-light-200/20 dark:border-dark-200/20 my-3 w-full"
        />,
      );
    }

    if (index < items.length - 1) {
      const twoMajorCards = items.slice(index, index + 2);
      twoMajorCards.forEach((item, i) => {
        sections.push(
          <MajorNewsCard
            key={`double-${index + i}`}
            item={item}
            isLeft={i === 0}
          />,
        );
        if (i === 0) {
          sections.push(
            <hr
              key={`sep-double-${index + i}`}
              className="border-t border-light-200/20 dark:border-dark-200/20 my-3 w-full"
            />,
          );
        }
      });
      index += 2;
    } else if (index < items.length) {
      sections.push(
        <MajorNewsCard
          key={`final-major-${index}`}
          item={items[index]}
          isLeft={true}
        />,
      );
      index++;
    }

    if (index < items.length) {
      sections.push(
        <hr
          key={`sep-${index}-after-major`}
          className="border-t border-light-200/20 dark:border-dark-200/20 my-3 w-full"
        />,
      );
    }

    if (index < items.length) {
      const smallCards = items.slice(index, index + 3);
      sections.push(
        <div
          key={`small-group-2-${index}`}
          className="grid lg:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-4"
        >
          {smallCards.map((item, i) => (
            <SmallNewsCard key={`small-2-${index + i}`} item={item} />
          ))}
        </div>,
      );
      index += 3;
    }
  }

  return <>{sections}</>;
};

const DiscoverGrid = ({ items }: { items: DiscoverItem[] }) => (
  <div className="flex flex-col gap-4 pb-28 pt-5 lg:pb-8 w-full">
    <div className="block lg:hidden">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {items.map((item, i) => (
          <SmallNewsCard key={`mobile-${i}`} item={item} />
        ))}
      </div>
    </div>
    <div className="hidden lg:block">
      <DesktopLayout items={items} />
    </div>
  </div>
);

export default DiscoverGrid;
