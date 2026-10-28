import { Router } from 'express';
import { authRouter } from './auth.js';
import { metaRouter } from './meta.js';
import { auctionsRouter } from './auctions.js';
import { bidsRouter } from './bids.js';
import { saleRouter } from './sale.js';
import { questionsRouter } from './questions.js';
import { wantsRouter } from './wants.js';
import { notificationsRouter } from './notifications.js';
import { assistantRouter } from './assistant.js';
import { streamRouter } from './stream.js';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/meta', metaRouter);
apiRouter.use('/auctions', bidsRouter);
apiRouter.use('/auctions', saleRouter);
apiRouter.use('/auctions', auctionsRouter);
apiRouter.use('/', questionsRouter);
apiRouter.use('/wants', wantsRouter);
apiRouter.use('/notifications', notificationsRouter);
apiRouter.use('/assistant', assistantRouter);
apiRouter.use('/', streamRouter);
