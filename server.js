require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

const Customer = mongoose.model('Customer', new mongoose.Schema({
  clientId: { type: String, unique: true, required: true },
  nid: Number,
  name: String,
  mobile: String,
  address: String,
  medicines: [{ _id: false, name: String, qty: Number }],
  startDate: String,      // YYYY-MM-DD
  days: Number,
  deliveryDate: String,   // YYYY-MM-DD
  alarmOn: { type: Boolean, default: true },
  alarms: [{ _id: false, date: String, time: String }],   // manual alarms
  autoRenew: { type: Boolean, default: false },            // repeat cycle
  deleted: { type: Boolean, default: false },
  updatedAt: { type: Number, default: 0 }
}));

app.get('/api/health', (_, res) => res.json({ ok: true }));

app.get('/api/customers', async (_, res) => {
  res.json(await Customer.find({}).lean());
});

// Offline-first sync: app sends everything it has, newest updatedAt wins, server returns merged list
app.post('/api/customers/sync', async (req, res) => {
  try {
    for (const c of req.body.customers || []) {
      delete c._id; delete c.__v;
      const existing = await Customer.findOne({ clientId: c.clientId });
      if (!existing || c.updatedAt > existing.updatedAt) {
        await Customer.findOneAndUpdate({ clientId: c.clientId }, c, { upsert: true });
      }
    }
    res.json(await Customer.find({}).lean());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Optional: serve the Angular web build (copy dist/med-reminder/browser/* into server/public)
const web = path.join(__dirname, 'public');
app.use(express.static(web));
app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(web, 'index.html'), err => { if (err) res.status(404).send('API running'); }));

const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGO_URI)
  .then(() => app.listen(PORT, '0.0.0.0', () => console.log('API on ' + PORT)))
  .catch(e => { console.error(e); process.exit(1); });