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

    const existingStatsRaw = await redis.get("donation_stats");
    const stats = existingStatsRaw
      ? JSON.parse(existingStatsRaw)
      : {
          totalDonations: 0,
          totalRaised: 0,
          redStripeCount: 0,
          bigBallerCount: 0,
          ultraBallerCount: 0,
          byType: {},
          byTypeAmount: {},
          supporters: {},
          recent: []
        };

    stats.totalDonations += 1;
    stats.totalRaised += alert.amount;

    stats.byType[alert.option] = (stats.byType[alert.option] || 0) + 1;
    stats.byTypeAmount[alert.option] =
    (stats.byTypeAmount[alert.option] || 0) + alert.amount;

    if (alert.option === "redstripe") {
      stats.redStripeCount += 1;
    }

    if (alert.amount >= 20) {
      stats.bigBallerCount += 1;
    }

    if (alert.amount >= 50) {
      stats.ultraBallerCount += 1;
    }

    stats.supporters[alert.name] =
      (stats.supporters[alert.name] || 0) + alert.amount;

    stats.recent.unshift(alert);
    stats.recent = stats.recent.slice(0, 10);

    await redis.set("donation_stats", JSON.stringify(stats));

    return res.status(200).json({ ok: true, alert, stats });
  }

  const latest = await redis.get("latest_alert");

  return res.status(200).json(latest ? JSON.parse(latest) : {});
}
