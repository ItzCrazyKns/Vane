import path from 'path';

type UploadsDirs = {
  /* Where new uploads are written: DATA_DIR/data/uploads. */
  uploadsDir: string;
  /* Read-only fallback for files uploaded before uploads followed DATA_DIR,
     when they were always written to cwd/data/uploads. Null when it is the
     same folder as uploadsDir (DATA_DIR unset or equal to the app folder). */
  legacyUploadsDir: string | null;
};

export const resolveUploadsDirs = ({
  dataDir = process.env.DATA_DIR,
  cwd = process.cwd(),
}: { dataDir?: string; cwd?: string } = {}): UploadsDirs => {
  const uploadsDir = path.join(dataDir || cwd, 'data', 'uploads');
  const legacyUploadsDir = path.join(cwd, 'data', 'uploads');

  return {
    uploadsDir,
    legacyUploadsDir:
      path.resolve(legacyUploadsDir) === path.resolve(uploadsDir)
        ? null
        : legacyUploadsDir,
  };
};
