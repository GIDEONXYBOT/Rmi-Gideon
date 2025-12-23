import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

// GTA Teller Schema (for tellers without RMI accounts)
const gtaTellerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  position: {
    type: String,
    default: 'Teller'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'on-leave'],
    default: 'active'
  },
  workplace: {
    type: String,
    default: 'gta'
  },
  notes: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const GTATeller = mongoose.model('GTATeller', gtaTellerSchema);

// GET all GTA tellers
router.get('/', async (req, res) => {
  try {
    const tellers = await GTATeller.find().sort({ name: 1 });
    res.json(tellers);
  } catch (error) {
    console.error('Error fetching GTA tellers:', error);
    res.status(500).json({ error: 'Failed to fetch GTA tellers' });
  }
});

// GET single GTA teller
router.get('/:id', async (req, res) => {
  try {
    const teller = await GTATeller.findById(req.params.id);
    if (!teller) {
      return res.status(404).json({ error: 'Teller not found' });
    }
    res.json(teller);
  } catch (error) {
    console.error('Error fetching GTA teller:', error);
    res.status(500).json({ error: 'Failed to fetch GTA teller' });
  }
});

// CREATE new GTA teller
router.post('/', async (req, res) => {
  try {
    const { name, phone, email, position, status, notes } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const newTeller = new GTATeller({
      name: name.trim(),
      phone: phone?.trim(),
      email: email?.trim(),
      position: position || 'Teller',
      status: status || 'active',
      notes,
      workplace: 'gta'
    });

    const savedTeller = await newTeller.save();
    console.log('✅ GTA Teller created:', savedTeller.name);
    res.status(201).json(savedTeller);
  } catch (error) {
    console.error('Error creating GTA teller:', error);
    res.status(500).json({ error: 'Failed to create GTA teller' });
  }
});

// UPDATE GTA teller
router.put('/:id', async (req, res) => {
  try {
    const { name, phone, email, position, status, notes } = req.body;

    if (name && !name.trim()) {
      return res.status(400).json({ error: 'Name cannot be empty' });
    }

    const updateData = {
      ...(name && { name: name.trim() }),
      ...(phone !== undefined && { phone: phone?.trim() || '' }),
      ...(email !== undefined && { email: email?.trim() || '' }),
      ...(position && { position }),
      ...(status && { status }),
      ...(notes !== undefined && { notes }),
      updatedAt: new Date()
    };

    const updatedTeller = await GTATeller.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!updatedTeller) {
      return res.status(404).json({ error: 'Teller not found' });
    }

    console.log('✅ GTA Teller updated:', updatedTeller.name);
    res.json(updatedTeller);
  } catch (error) {
    console.error('Error updating GTA teller:', error);
    res.status(500).json({ error: 'Failed to update GTA teller' });
  }
});

// DELETE GTA teller
router.delete('/:id', async (req, res) => {
  try {
    const deletedTeller = await GTATeller.findByIdAndDelete(req.params.id);

    if (!deletedTeller) {
      return res.status(404).json({ error: 'Teller not found' });
    }

    console.log('✅ GTA Teller deleted:', deletedTeller.name);
    res.json({ message: 'GTA Teller deleted successfully', teller: deletedTeller });
  } catch (error) {
    console.error('Error deleting GTA teller:', error);
    res.status(500).json({ error: 'Failed to delete GTA teller' });
  }
});

// GET active GTA tellers (for scheduling)
router.get('/active/list', async (req, res) => {
  try {
    const activeTellers = await GTATeller.find({ status: 'active' }).sort({ name: 1 });
    res.json(activeTellers);
  } catch (error) {
    console.error('Error fetching active GTA tellers:', error);
    res.status(500).json({ error: 'Failed to fetch active GTA tellers' });
  }
});

export default router;
