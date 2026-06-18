import { createClient } from "redis";

let client;

async function getRedis() {
  if (!client) {
    client = createClient({ url: process.env.REDIS_URL });
    client.on("error", (err) => console.error("Redis error", err));
    await client.connect();
  }
  return client;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const redis = await getRedis();

  if (req.method === "POST") {
    const alert = {
      id: Date.now().toString(),
      name: req.body.name || "Anonymous Supporter",
      amount: Number(req.body.amount || 0),
      currency: req.body.currency || "GBP",
      option: req.body.option || "anything"
    };

    await redis.set("latest_alert", JSON.stringify(alert));

    return res.status(200).json({ ok: true, alert });
  }

  const latest = await redis.get("latest_alert");

  return res.status(200).json(latest ? JSON.parse(latest) : {});
}
