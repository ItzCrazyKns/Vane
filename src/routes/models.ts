import express from 'express';
import logger from '../utils/logger';
import { getAvailableProviders } from '../lib/providers';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const providers = await getAvailableProviders();

    res.status(200).json({ providers });
  } catch (err) {
    res.status(500).json({ message: 'An error has occurred.' });
    logger.error(err.message);
  }
});

export default router;
