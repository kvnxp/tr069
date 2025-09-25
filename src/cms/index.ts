import { Router } from 'express';
import pagesRouter from './routes/pages';
import apiRouter from './routes/api';
import authRouter from './routes/auth';
import staticRouter from './routes/static';

const cmsRouter = Router();

// Mount sub-routers
cmsRouter.use('/', pagesRouter);
cmsRouter.use('/api', apiRouter);
cmsRouter.use('/', authRouter);
cmsRouter.use('/scripts', staticRouter);

export default cmsRouter;