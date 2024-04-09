import express from 'express';
import imagesRouter from './images';

const router = express.Router();

router.use('/images', imagesRouter);

export default router;
