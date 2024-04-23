import express from 'express';
import imagesRouter from './images';
import configRouter from './config';

const router = express.Router();

router.use('/images', imagesRouter);
router.use('/config', configRouter);

export default router;
