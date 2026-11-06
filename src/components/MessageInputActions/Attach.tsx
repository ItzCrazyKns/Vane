import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from '@headlessui/react';
import {
  CopyPlus,
  File,
  Link,
  LoaderCircle,
  Paperclip,
  Plus,
  Trash,
} from 'lucide-react';
import { Fragment, useRef, useState } from 'react';
import { useChat } from '@/lib/hooks/useChat';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

const Attach = () => {
  const t = useTranslations('Attach');
  const { files, setFiles, setFileIds, fileIds } = useChat();

  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<any>();

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;

    if (!selectedFiles?.length) {
      return;
    }

    setLoading(true);

    try {
      const data = new FormData();

      for (let i = 0; i < selectedFiles.length; i++) {
        data.append('files', selectedFiles[i]);
      }

      const embeddingModelProvider = localStorage.getItem(
        'embeddingModelProviderId',
      );
      const embeddingModel = localStorage.getItem('embeddingModelKey');

      if (!embeddingModelProvider || !embeddingModel) {
        throw new Error(t('embeddingRequired'));
      }

      data.append('embedding_model_provider_id', embeddingModelProvider);
      data.append('embedding_model_key', embeddingModel);

      const res = await fetch(`/api/uploads`, {
        method: 'POST',
        body: data,
      });

      const resData = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(resData.message || t('uploadFailed'));
      }

      if (!Array.isArray(resData.files)) {
        throw new Error(t('invalidResponse'));
      }

      setFiles([...files, ...resData.files]);
      setFileIds([
        ...fileIds,
        ...resData.files.map((file: any) => file.fileId),
      ]);
    } catch (err: any) {
      toast(err?.message || t('uploadFailed'));
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  return loading ? (
    <div className="active:border-none hover:bg-light-200 hover:dark:bg-dark-200 p-2 rounded-lg focus:outline-none text-black/50 dark:text-white/50 transition duration-200">
      <LoaderCircle size={16} className="text-sky-500 animate-spin" />
    </div>
  ) : files.length > 0 ? (
    <Popover className="relative w-full max-w-[15rem] md:max-w-md lg:max-w-lg">
      {({ open }) => (
        <>
          <PopoverButton
            type="button"
            className="active:border-none hover:bg-light-200 hover:dark:bg-dark-200 p-2 rounded-lg focus:outline-none headless-open:text-black dark:headless-open:text-white text-black/50 dark:text-white/50 active:scale-95 transition duration-200 hover:text-black dark:hover:text-white"
          >
            <File size={16} className="text-sky-500" />
          </PopoverButton>
          <AnimatePresence>
            {open && (
              <PopoverPanel
                className="absolute z-10 w-64 md:w-[350px] right-0"
                static
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.1, ease: 'easeOut' }}
                  className="origin-top-right bg-light-primary dark:bg-dark-primary border rounded-md border-light-200 dark:border-dark-200 w-full max-h-[200px] md:max-h-none overflow-y-auto flex flex-col"
                >
                  <div className="flex flex-row items-center justify-between px-3 py-2">
                    <h4 className="text-black/70 dark:text-white/70 text-sm">
                      {t('attachedFiles')}
                    </h4>
                    <div className="flex flex-row items-center space-x-4">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current.click()}
                        className="flex flex-row items-center space-x-1 text-black/70 dark:text-white/70 hover:text-black hover:dark:text-white transition duration-200 focus:outline-none"
                      >
                        <input
                          type="file"
                          onChange={handleChange}
                          ref={fileInputRef}
                          accept=".pdf,.docx,.txt"
                          multiple
                          hidden
                        />
                        <Plus size={16} />
                        <p className="text-xs">{t('add')}</p>
                      </button>
                      <button
                        onClick={() => {
                          setFiles([]);
                          setFileIds([]);
                        }}
                        className="flex flex-row items-center space-x-1 text-black/70 dark:text-white/70 hover:text-black hover:dark:text-white transition duration-200 focus:outline-none"
                      >
                        <Trash size={13} />
                        <p className="text-xs">{t('clear')}</p>
                      </button>
                    </div>
                  </div>
                  <div className="h-[0.5px] mx-2 bg-white/10" />
                  <div className="flex flex-col items-center">
                    {files.map((file, i) => (
                      <div
                        key={i}
                        className="flex flex-row items-center justify-start w-full space-x-3 p-3"
                      >
                        <div className="bg-light-100 dark:bg-dark-100 flex items-center justify-center w-9 h-9 rounded-md">
                          <File
                            size={16}
                            className="text-black/70 dark:text-white/70"
                          />
                        </div>
                        <p className="text-black/70 dark:text-white/70 text-xs">
                          {file.fileName.length > 25
                            ? file.fileName
                                .replace(/\.\w+$/, '')
                                .substring(0, 25) +
                              '...' +
                              file.fileExtension
                            : file.fileName}
                        </p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </PopoverPanel>
            )}
          </AnimatePresence>
        </>
      )}
    </Popover>
  ) : (
    <button
      type="button"
      onClick={() => fileInputRef.current.click()}
      className={cn(
        'flex items-center justify-center active:border-none hover:bg-light-200 hover:dark:bg-dark-200 p-2 rounded-lg focus:outline-none headless-open:text-black dark:headless-open:text-white text-black/50 dark:text-white/50 active:scale-95 transition duration-200 hover:text-black dark:hover:text-white',
      )}
    >
      <input
        type="file"
        onChange={handleChange}
        ref={fileInputRef}
        accept=".pdf,.docx,.txt"
        multiple
        hidden
      />
      <Paperclip size={16} />
    </button>
  );
};

export default Attach;
