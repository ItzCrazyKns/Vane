import path from 'path';
import fs from 'fs';
import { DATA_ROOT } from '../serverPaths';

export const getFileDetails = (fileId: string) => {
  const fileLoc = path.join(DATA_ROOT, 'uploads', fileId + '-extracted.json');

  const parsedFile = JSON.parse(fs.readFileSync(fileLoc, 'utf8'));

  return {
    name: parsedFile.title,
    fileId: fileId,
  };
};
