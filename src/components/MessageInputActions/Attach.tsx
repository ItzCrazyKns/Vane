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
  Image as ImageIcon,
  Link,
  LoaderCircle,
  Paperclip,
  Plus,
  Trash,
  X,
} from 'lucide-react';
import { Fragment, useRef, useState } from 'react';
import { useChat } from '@/lib/hooks/useChat';
import { AnimatePresence } from 'motion/react';
import { motion } from 'framer-motion';

const Attach = () => {
  const { files, setFiles, setFileIds, fileIds, images, setImages } =
    useChat();

  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<any>();
  const imageInputRef = useRef<any>();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    const newImages = await Promise.all(
      Array.from(selectedFiles).map(
        (file) =>
          new Promise<{ id: string; dataUrl: string; fileName: string }>(
            (resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                resolve({
                  id: Math.random().toString(36).substring(2),
                  dataUrl: reader.result as string,
                  fileName: file.name,
                });
              };
              reader.onerror = reject;
              reader.readAsDataURL(file);
            },
          ),
      ),
    );

    setImages([...images, ...newImages]);
    // Reset the input so the same file can be selected again
    e.target.value = '';
  };

  const removeImage = (id: string) => {
    setImages(images.filter((img) => img.id !== id));
  };

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    const newFileIds = fileIds.filter((_, i) => i !== index);
    setFiles(newFiles);
    setFileIds(newFileIds);
  };

  const hasAttachments = files.length > 0 || images.length > 0;

  return loading ? (
    <div className="active:border-none hover:bg-light-200 hover:dark:bg-dark-200 p-2 rounded-lg focus:outline-none text-black/50 dark:text-white/50 transition duration-200">
      <LoaderCircle size={16} className="text-sky-500 animate-spin" />
    </div>
  ) : hasAttachments ? (
    <Popover className="relative w-full max-w-[15rem] md:max-w-md lg:max-w-lg">
      {({ open }) => (
        <>
          <PopoverButton
            type="button"
            className="active:border-none hover:bg-light-200 hover:dark:bg-dark-200 p-2 rounded-lg focus:outline-none headless-open:text-black dark:headless-open:text-white text-black/50 dark:text-white/50 active:scale-95 transition duration-200 hover:text-black dark:hover:text-white"
          >
            {images.length > 0 && files.length === 0 ? (
              <ImageIcon size={16} className="text-sky-500" />
            ) : (
              <File size={16} className="text-sky-500" />
            )}
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
                      Attachments
                    </h4>
                    <div className="flex flex-row items-center space-x-4">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current.click()}
                        className="flex flex-row items-center space-x-1 text-black/70 dark:text-white/70 hover:text-black hover:dark:text-white transition duration-200 focus:outline-none"
                      >
                        <input
                          type="file"
                          onChange={handleFileChange}
                          ref={fileInputRef}
                          accept=".pdf,.docx,.txt"
                          multiple
                          hidden
                        />
                        <Plus size={16} />
                        <p className="text-xs">File</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => imageInputRef.current.click()}
                        className="flex flex-row items-center space-x-1 text-black/70 dark:text-white/70 hover:text-black hover:dark:text-white transition duration-200 focus:outline-none"
                      >
                        <input
                          type="file"
                          onChange={handleImageChange}
                          ref={imageInputRef}
                          accept="image/*"
                          multiple
                          hidden
                        />
                        <ImageIcon size={14} />
                        <p className="text-xs">Image</p>
                      </button>
                      <button
                        onClick={() => {
                          setFiles([]);
                          setFileIds([]);
                          setImages([]);
                        }}
                        className="flex flex-row items-center space-x-1 text-black/70 dark:text-white/70 hover:text-black hover:dark:text-white transition duration-200 focus:outline-none"
                      >
                        <Trash size={13} />
                        <p className="text-xs">Clear</p>
                      </button>
                    </div>
                  </div>
                  <div className="h-[0.5px] mx-2 bg-white/10" />
                  <div className="flex flex-col items-center">
                    {images.map((img) => (
                      <div
                        key={img.id}
                        className="flex flex-row items-center justify-between w-full space-x-3 p-3"
                      >
                        <div className="flex flex-row items-center space-x-3">
                          <img
                            src={img.dataUrl}
                            alt={img.fileName}
                            className="w-9 h-9 rounded-md object-cover"
                          />
                          <p className="text-black/70 dark:text-white/70 text-xs">
                            {img.fileName.length > 25
                              ? img.fileName.substring(0, 25) + '...'
                              : img.fileName}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeImage(img.id)}
                          className="text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white transition duration-200"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    {files.map((file, i) => (
                      <div
                        key={i}
                        className="flex flex-row items-center justify-between w-full space-x-3 p-3"
                      >
                        <div className="flex flex-row items-center space-x-3">
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
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          className="text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white transition duration-200"
                        >
                          <X size={14} />
                        </button>
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
    <Popover className="relative">
      {({ open }) => (
        <>
          <PopoverButton
            type="button"
            className={cn(
              'flex items-center justify-center active:border-none hover:bg-light-200 hover:dark:bg-dark-200 p-2 rounded-lg focus:outline-none headless-open:text-black dark:headless-open:text-white text-black/50 dark:text-white/50 active:scale-95 transition duration-200 hover:text-black dark:hover:text-white',
            )}
          >
            <Paperclip size={16} />
          </PopoverButton>
          <AnimatePresence>
            {open && (
              <PopoverPanel
                className="absolute z-10 w-40 right-0 bottom-full mb-1"
                static
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.1, ease: 'easeOut' }}
                  className="origin-bottom-right bg-light-primary dark:bg-dark-primary border rounded-md border-light-200 dark:border-dark-200 w-full flex flex-col py-1"
                >
                  <button
                    type="button"
                    onClick={() => {
                      fileInputRef.current.click();
                    }}
                    className="flex flex-row items-center space-x-2 px-3 py-2 text-black/70 dark:text-white/70 hover:bg-light-200 dark:hover:bg-dark-200 transition duration-200 text-xs"
                  >
                    <input
                      type="file"
                      onChange={handleFileChange}
                      ref={fileInputRef}
                      accept=".pdf,.docx,.txt"
                      multiple
                      hidden
                    />
                    <File size={14} />
                    <span>Upload file</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      imageInputRef.current.click();
                    }}
                    className="flex flex-row items-center space-x-2 px-3 py-2 text-black/70 dark:text-white/70 hover:bg-light-200 dark:hover:bg-dark-200 transition duration-200 text-xs"
                  >
                    <input
                      type="file"
                      onChange={handleImageChange}
                      ref={imageInputRef}
                      accept="image/*"
                      multiple
                      hidden
                    />
                    <ImageIcon size={14} />
                    <span>Upload image</span>
                  </button>
                </motion.div>
              </PopoverPanel>
            )}
          </AnimatePresence>
        </>
      )}
    </Popover>
  );
};

export default Attach;
