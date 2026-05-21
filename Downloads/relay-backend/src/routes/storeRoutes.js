const express = require('express');
const Store = require('../models/Store');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const router = express.Router();

router.use(auth);

// Create store — admin only
router.post('/', authorize('admin'), async (req, res) => {
  try {
    const {
      name,
      code,
      city,
      address,
      phone,
      email,
      zomatoStoreId,
      swiggyStoreId,
      easyDinerStoreId,
      eposStoreId,
    } = req.body;
    if (!name || !code || !city) {
      return res.status(400).json({ message: 'Name, code and city are required' });
    }

    const store = await Store.create({
      name,
      code,
      city,
      address,
      phone,
      email,
      integrations: {
        zomato: { storeId: String(zomatoStoreId || '') },
        swiggy: { storeId: String(swiggyStoreId || '') },
        easyDiner: { storeId: String(easyDinerStoreId || '') },
        epos: { storeId: String(eposStoreId || '') },
      },
      createdBy: req.user._id,
    });

    return res.status(201).json({ message: 'Store created', store });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create store' });
  }
});

router.get('/', async (req, res) => {
  try {
    const stores = await Store.find().sort({ createdAt: -1 });
    return res.json({ stores });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch stores' });
  }
});

// Update store core details — admin only
router.put('/:storeId', authorize('admin'), async (req, res) => {
  try {
    const { storeId } = req.params;
    const {
      name,
      code,
      city,
      address,
      phone,
      email,
      zomatoStoreId,
      swiggyStoreId,
      easyDinerStoreId,
      eposStoreId,
    } = req.body;

    if (!name || !code || !city) {
      return res.status(400).json({ message: 'Name, code and city are required' });
    }

    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }

    store.name = name;
    store.code = code;
    store.city = city;
    store.address = address || '';
    store.phone = phone || '';
    store.email = email || '';

    store.integrations.zomato = {
      ...store.integrations.zomato?.toObject?.(),
      storeId: String(zomatoStoreId || ''),
    };
    store.integrations.swiggy = {
      ...store.integrations.swiggy?.toObject?.(),
      storeId: String(swiggyStoreId || ''),
    };
    store.integrations.easyDiner = {
      ...store.integrations.easyDiner?.toObject?.(),
      storeId: String(easyDinerStoreId || ''),
    };
    store.integrations.epos = {
      ...store.integrations.epos?.toObject?.(),
      storeId: String(eposStoreId || ''),
    };

    await store.save();
    return res.json({ message: 'Store updated', store });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update store' });
  }
});

// Delete store — admin only
router.delete('/:storeId', authorize('admin'), async (req, res) => {
  try {
    const { storeId } = req.params;
    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }

    await Store.findByIdAndDelete(storeId);
    return res.json({ message: 'Store deleted' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete store' });
  }
});

// Update platform credentials — admin only
router.put('/:storeId/integrations/:platform', authorize('admin'), async (req, res) => {
  try {
    const { storeId, platform } = req.params;
    const allowed = ['zomato', 'swiggy', 'easyDiner', 'epos'];
    if (!allowed.includes(platform)) {
      return res.status(400).json({ message: 'Invalid platform' });
    }

    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }

    store.integrations[platform] = {
      ...store.integrations[platform]?.toObject?.(),
      ...req.body,
    };

    await store.save();

    return res.json({ message: `${platform} credentials updated`, store });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update credentials' });
  }
});

module.exports = router;
