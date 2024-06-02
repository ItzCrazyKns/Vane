import { CopyPlus } from 'lucide-react';

const Attach = () => {
  return (
    <button
      type="button"
      className="p-2 text-black/50 dark:text-white/50 rounded-xl hover:bg-light-secondary dark:hover:bg-dark-secondary transition duration-200 hover:text-black dark:hover:text-white"
    >
      <CopyPlus />
    </button>
  );
};

export default Attach;
