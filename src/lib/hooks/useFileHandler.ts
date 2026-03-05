import { useCallback, useRef, useState } from 'react';
import { useChat, ImageFile } from '@/lib/hooks/useChat';

const ACCEPTED_DOC_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

/**
 * Shared hook for paste and drag-and-drop file handling in chat inputs.
 * Uses refs to always have latest state in async callbacks.
 */
export const useFileHandler = () => {
  const { images, setImages, files, setFiles, fileIds, setFileIds } =
    useChat();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingFileName, setUploadingFileName] = useState('');

  // Refs to always have the latest state in async callbacks
  const imagesRef = useRef(images);
  imagesRef.current = images;
  const filesRef = useRef(files);
  filesRef.current = files;
  const fileIdsRef = useRef(fileIds);
  fileIdsRef.current = fileIds;

  const processFiles = useCallback(
    (droppedFiles: File[]) => {
      const imageFiles = droppedFiles.filter((f) =>
        f.type.startsWith('image/'),
      );
      const docFiles = droppedFiles.filter((f) =>
        ACCEPTED_DOC_TYPES.includes(f.type),
      );

      if (imageFiles.length === 0 && docFiles.length === 0) return;

      // Handle images (convert to base64 data URL)
      if (imageFiles.length > 0) {
        Promise.all(
          imageFiles.map(
            (file) =>
              new Promise<ImageFile>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                  resolve({
                    id: Math.random().toString(36).substring(2),
                    dataUrl: reader.result as string,
                    fileName: file.name || 'pasted-image.png',
                  });
                };
                reader.onerror = () =>
                  reject(new Error(`Failed to read ${file.name}`));
                reader.onabort = () =>
                  reject(new Error(`Aborted reading ${file.name}`));
                reader.readAsDataURL(file);
              }),
          ),
        )
          .then((newImgs) => {
            setImages([...imagesRef.current, ...newImgs]);
          })
          .catch((err) => {
            console.error('Error reading image files:', err);
          });
      }

      // Handle document files (upload via /api/uploads)
      if (docFiles.length > 0) {
        const names = docFiles.map((f) => f.name).join(', ');
        setIsUploading(true);
        setUploadingFileName(names);

        const data = new FormData();
        docFiles.forEach((file) => data.append('files', file));

        const embeddingModelProvider = localStorage.getItem(
          'embeddingModelProviderId',
        );
        const embeddingModel = localStorage.getItem('embeddingModelKey');
        data.append('embedding_model_provider_id', embeddingModelProvider!);
        data.append('embedding_model_key', embeddingModel!);

        fetch('/api/uploads', { method: 'POST', body: data })
          .then((res) => res.json())
          .then((resData) => {
            setFiles([...filesRef.current, ...resData.files]);
            setFileIds([
              ...fileIdsRef.current,
              ...resData.files.map((f: any) => f.fileId),
            ]);
          })
          .catch((err) => {
            console.error('Error uploading files:', err);
          })
          .finally(() => {
            setIsUploading(false);
            setUploadingFileName('');
          });
      }
    },
    [setImages, setFiles, setFileIds],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const pastedFiles: File[] = Array.from(e.clipboardData?.files || []);

      // Fallback: check items API for screenshots
      if (pastedFiles.length === 0) {
        const items = e.clipboardData?.items;
        if (items) {
          for (let i = 0; i < items.length; i++) {
            if (items[i].kind === 'file') {
              const file = items[i].getAsFile();
              if (file) pastedFiles.push(file);
            }
          }
        }
      }

      if (pastedFiles.length === 0) return;

      const hasRelevantFiles = pastedFiles.some(
        (f) =>
          f.type.startsWith('image/') || ACCEPTED_DOC_TYPES.includes(f.type),
      );
      if (!hasRelevantFiles) return;

      e.preventDefault();
      processFiles(pastedFiles);
    },
    [processFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (
      e.currentTarget &&
      !e.currentTarget.contains(e.relatedTarget as Node)
    ) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const droppedFiles = Array.from(e.dataTransfer?.files || []);
      if (droppedFiles.length > 0) {
        processFiles(droppedFiles);
      }
    },
    [processFiles],
  );

  return {
    isDragging,
    isUploading,
    uploadingFileName,
    handlePaste,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
};
