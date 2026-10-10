import express from 'express';
import {timingSafeEqual} from 'node:crypto';
export const minecraftBridge = express.Router();
const timestamps: number[] = [];
minecraftBridge.post('/v1/chat/completions', (req, res, next) => {
  const key = process.env.MINECRAFT_BRIDGE_KEY;
  const expected = Buffer.from(`Bearer ${key ?? ''}`);
  const actual = Buffer.from(req.get('authorization') ?? '');
  if (!key || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    res.status(401).json({error: 'unauthorized'}); return;
  }
  const now = Date.now();
  while (timestamps.length && timestamps[0] < now - 60000) timestamps.shift();
  if (timestamps.length >= 12) { res.status(429).json({error: 'rate_limited'}); return; }
  timestamps.push(now); next();
}, express.json({limit: '32kb'}), async (req, res) => {
  try {
    const response = await fetch('http://10.0.1.1:8646/v1/chat/completions', {
      method:'POST', headers:{'content-type':'application/json', authorization:`Bearer ${process.env.MINECRAFT_BRIDGE_KEY}`},
      body: JSON.stringify({messages:req.body?.messages}), signal:AbortSignal.timeout(48000)
    });
    res.status(response.status).json(await response.json());
  } catch { res.status(502).json({error:'planner_unavailable'}); }
});
