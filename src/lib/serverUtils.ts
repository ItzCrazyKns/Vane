import crypto from 'crypto';

export const hashObj = (obj: { [key: string]: any }) => {
  const json = JSON.stringify(obj, Object.keys(obj).sort());
  const hash = crypto.createHash('sha256').update(json).digest('hex');
  return hash;
};
