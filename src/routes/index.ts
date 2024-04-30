import express from 'express';
import imagesRouter from './images';
import videosRouter from './videos';
import configRouter from './config';

const router = express.Router();

router.use('/images', imagesRouter);
router.use('/videos', videosRouter);
router.use('/config', configRouter);

export default router;
