import { Router } from 'express';
import { z } from 'zod';
import {
  createAuction,
  editAuction,
  cancelAuction,
  relistAuction,
  listAuctions,
  getAuctionDetail,
  getMyAuctions,
} from '../services/auctionService.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { uploadPhotos } from '../middleware/upload.js';
import { HttpError } from '../errors.js';

export const auctionsRouter = Router();

const createAuctionSchema = z.object({
  title: z.string().min(3).max(100),
  category: z.string(),
  description: z.string().max(2000).optional(),
  condition: z.enum(['new', 'like_new', 'good', 'fair', 'poor']),
  starting_price: z.coerce.number().int().positive(),
  min_increment: z.coerce.number().int().positive(),
  closes_at: z.string(),
  faqs: z
    .string()
    .optional()
    .transform((str) => (str ? JSON.parse(str) : undefined))
    .pipe(
      z
        .array(
          z.object({
            question: z.string().min(3),
            answer: z.string().min(1),
          })
        )
        .optional()
    ),
});

const editAuctionSchema = z.object({
  title: z.string().min(3).max(100).optional(),
  category: z.string().optional(),
  description: z.string().max(2000).optional(),
  condition: z.enum(['new', 'like_new', 'good', 'fair', 'poor']).optional(),
  starting_price: z.coerce.number().int().positive().optional(),
  min_increment: z.coerce.number().int().positive().optional(),
  closes_at: z.string().optional(),
});

// List auctions with search & filters (BR1, BR2)
auctionsRouter.get('/', async (req, res, next) => {
  try {
    const {
      q,
      category,
      condition,
      min_price,
      max_price,
      closing_soon,
      status,
      sort,
      page,
      limit,
    } = req.query;

    const result = await listAuctions({
      q: typeof q === 'string' ? q : undefined,
      category: typeof category === 'string' ? category : undefined,
      condition: typeof condition === 'string' ? condition : undefined,
      min_price: min_price ? parseInt(min_price as string, 10) : undefined,
      max_price: max_price ? parseInt(max_price as string, 10) : undefined,
      closing_soon: closing_soon === 'true',
      status: typeof status === 'string' ? status : undefined,
      sort: sort as 'ending_soon' | 'newest' | 'price_asc' | 'price_desc' | undefined,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 20,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Create auction with multipart photos upload (L2)
auctionsRouter.post('/', requireAuth, uploadPhotos.array('photos', 5), async (req, res, next) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      throw new HttpError(400, 'VALIDATION', 'At least 1 photo is required');
    }

    const photoFilenames = files.map((f) => f.filename);
    const parsed = createAuctionSchema.parse(req.body);

    const auction = await createAuction(
      req.user!.id,
      {
        title: parsed.title,
        category: parsed.category,
        description: parsed.description,
        condition: parsed.condition,
        starting_price: parsed.starting_price,
        min_increment: parsed.min_increment,
        closes_at: parsed.closes_at,
        faqs: parsed.faqs,
      },
      photoFilenames
    );

    res.status(201).json(auction);
  } catch (err) {
    next(err);
  }
});

// Get single auction detail (BR3)
auctionsRouter.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const auction = await getAuctionDetail(id, req.user?.id);
    res.json(auction);
  } catch (err) {
    next(err);
  }
});

// Edit auction (L3)
auctionsRouter.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const parsed = editAuctionSchema.parse(req.body);
    const auction = await editAuction(req.user!.id, id, parsed);
    res.json(auction);
  } catch (err) {
    next(err);
  }
});

// Cancel auction (L4)
auctionsRouter.post('/:id/cancel', requireAuth, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const { reason } = req.body;
    const auction = await cancelAuction(req.user!.id, id, reason);
    res.json(auction);
  } catch (err) {
    next(err);
  }
});

// Relist auction (L5)
auctionsRouter.post('/:id/relist', requireAuth, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const { closes_at } = req.body;
    if (!closes_at) {
      throw new HttpError(400, 'VALIDATION', 'closes_at date is required to relist');
    }
    const auction = await relistAuction(req.user!.id, id, new Date(closes_at));
    res.status(201).json(auction);
  } catch (err) {
    next(err);
  }
});

// My auctions handler exportable for /me/auctions
export async function handleGetMyAuctions(req: any, res: any, next: any) {
  try {
    const role = (req.query.role as string) === 'bidding' ? 'bidding' : 'selling';
    const items = await getMyAuctions(req.user!.id, role);
    res.json(items);
  } catch (err) {
    next(err);
  }
}
