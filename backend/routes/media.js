import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';
import FeedItem from '../models/FeedItem.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// POST /api/media/upload
// Accepts JSON: { image: 'data:image/png;base64,...', caption: '...' }
router.post('/upload', requireAuth, async (req, res) => {
  try {
    const { image, caption } = req.body;
    if (!image) return res.status(400).json({ success: false, message: 'No image provided' });

    // decode
    const match = image.match(/^data:(image\/\w+);base64,(.*)$/);
    let data = image;
    let mime = 'image/png';
    if (match) {
      mime = match[1];
      data = match[2];
    }

    const buffer = Buffer.from(data, 'base64');

    // validations
    const MIN_BYTES = 8 * 1024;
    const MIN_W = 128;
    const MIN_H = 128;
    if (buffer.length < MIN_BYTES) return res.status(400).json({ success: false, message: 'Image file too small' });

    let meta;
    try { meta = await sharp(buffer).metadata(); } catch (err) { return res.status(400).json({ success: false, message: 'Invalid image' }); }
    if (meta.width < MIN_W || meta.height < MIN_H) return res.status(400).json({ success: false, message: `Image dimensions must be at least ${MIN_W}x${MIN_H}` });

    // ensure directory
    const uploadsDir = path.resolve('uploads', 'feed');
    await fs.mkdir(uploadsDir, { recursive: true });

    // file names
    const idBase = `${req.user._id.toString()}-${Date.now()}`;
    const mainName = `${idBase}.png`;
    const thumbName = `${idBase}-thumb.png`;

    // process images: main 1024 cover, thumb 320 crop
    await sharp(buffer).resize({ width: 1024, height: 1024, fit: 'cover' }).png({ quality: 90 }).toFile(path.join(uploadsDir, mainName));
    await sharp(buffer).resize({ width: 320, height: 320, fit: 'cover' }).png({ quality: 80 }).toFile(path.join(uploadsDir, thumbName));

    const feed = new FeedItem({
      uploader: req.user._id,
      caption: caption || '',
      imageUrl: `/uploads/feed/${mainName}`,
      thumbUrl: `/uploads/feed/${thumbName}`,
      width: meta.width,
      height: meta.height,
      size: buffer.length
    });

    await feed.save();
    res.json({ success: true, item: feed });
  } catch (err) {
    console.error('Media upload failed', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/media/feed - latest feed items
// GET /api/media/feed - latest feed items (optional ?userId=... to filter by uploader)
router.get('/feed', async (req, res) => {
  try {
    const { userId } = req.query;
    const filter = {};
    if (userId) filter.uploader = userId;
    const list = await FeedItem.find(filter).sort({ createdAt: -1 }).limit(50).populate('uploader', 'username name avatarUrl');
    res.json({ success: true, items: list });
  } catch (err) {
    console.error('Failed to fetch feed', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
