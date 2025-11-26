import mongoose from 'mongoose';

const FeedItemSchema = new mongoose.Schema({
  uploader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  caption: { type: String, default: '' },
  imageUrl: { type: String, required: true },
  thumbUrl: { type: String, default: '' },
  width: { type: Number },
  height: { type: Number },
  size: { type: Number },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('FeedItem', FeedItemSchema);
