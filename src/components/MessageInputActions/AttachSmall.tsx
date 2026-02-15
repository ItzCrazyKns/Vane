import {
  Popover,
  PopoverButton,
  PopoverPanel,

} from '@headlessui/react';
import { File, LoaderCircle, Paperclip, Plus, Trash } from 'lucide-react';
import { useRef, useState } from 'react';
import { useChat } from '@/lib/hooks/useChat';
import { AnimatePresence } from 'motion/react';
import { motion } from 'framer-motion';

const AttachSmall = () => {
  const { files, setFiles, setFileIds, fileIds } = useChat();

  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setLoading(true);
    const data = new FormData();

    for (let i = 0; i < e.target.files!.length; i++) {
      data.append('files', e.target.files![i]);
    }

    const embeddingModelProvider = localStorage.getItem(
      'embeddingModelProviderId',
    );
    const embeddingModel = localStorage.getItem('embeddingModelKey');

    data.append('embedding_model_provider_id', embeddingModelProvider!);
    data.append('embedding_model_key', embeddingModel!);

    const res = await fetch(`/api/uploads`, {
      method: 'POST',
      body: data,
    });

    const resData = await res.json();

    setFiles([...files, ...resData.files]);
    setFileIds([...fileIds, ...resData.files.map((file: any) => file.fileId)]);
    setLoading(false);
  };

  return loading ? (
    <div className="flex flex-row items-center justify-between space-x-1 p-1 ">
      <LoaderCircle size={20} className="text-sky-500 animate-spin" />
    </div>
  ) : files.length > 0 ? (
    <Popover className="max-w-[15rem] md:max-w-md lg:max-w-lg">
      {({ open }) => (
        <>
          <PopoverButton
            type="button"
            className="flex flex-row items-center justify-between space-x-1 p-1 text-black/50 dark:text-white/50 rounded-xl hover:bg-light-secondary dark:hover:bg-dark-secondary active:scale-95 transition duration-200 hover:text-black dark:hover:text-white"
          >
            <File size={20} className="text-sky-500" />
          </PopoverButton>
          <AnimatePresence>
            {open && (
              <PopoverPanel
                className="absolute z-10 w-64 md:w-[350px] bottom-14"
                static
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.1, ease: 'easeOut' }}
                  className="origin-bottom-left bg-light-primary dark:bg-dark-primary border rounded-md border-light-200 dark:border-dark-200 w-full max-h-[200px] md:max-h-none overflow-y-auto flex flex-col"
                >
                  <div className="flex flex-row items-center justify-between px-3 py-2">
                    <h4 className="text-black/70 dark:text-white/70 font-medium text-sm">
                      Attached files
                    </h4>
                    <div className="flex flex-row items-center space-x-4">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-row items-center space-x-1 text-black/70 dark:text-white/70 hover:text-black hover:dark:text-white transition duration-200"
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
                        <p className="text-xs">Add</p>
                      </button>
                      <button
                        onClick={() => {
                          setFiles([]);
                          setFileIds([]);
                        }}
                        className="flex flex-row items-center space-x-1 text-black/70 dark:text-white/70 hover:text-black hover:dark:text-white transition duration-200"
                      >
                        <Trash size={13} />
                        <p className="text-xs">Clear</p>
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
      onClick={() => fileInputRef.current?.click()}
      className="flex flex-row items-center space-x-1 text-black/50 dark:text-white/50 rounded-xl hover:bg-light-secondary dark:hover:bg-dark-secondary transition duration-200 hover:text-black dark:hover:text-white p-1"
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

export default AttachSmall;
