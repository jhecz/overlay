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
  const auth = req.headers.authorization || "";
  const password = process.env.DASH_PASS;

  const decoded = auth.startsWith("Basic ")
    ? Buffer.from(auth.replace("Basic ", ""), "base64").toString()
    : "";

  const enteredPassword = decoded.split(":").slice(1).join(":");

  if (!password || enteredPassword !== password) {
    res.setHeader("WWW-Authenticate", 'Basic realm="JHecz Dashboard"');
    return res.status(401).send("Login required");
  }

  const redis = await getRedis();

 const donation = {
  id: Date.now().toString(),
  name: "m0dk",
  amount: 5,
  currency: "GBP",
  option: "redstripe",
  createdAt: "2026-06-18T07:40:00+01:00"
};

 const stats = {
  totalDonations: 1,
  totalRaised: 5,
  redStripeCount: 1,
  bigBallerCount: 0,
  ultraBallerCount: 0,
  byType: {
    redstripe: 1
  },
  byTypeAmount: {
    redstripe: 5
  },
  supporters: {
    m0dk: 5
  },
  recent: [donation]
};

  await redis.set("donation_stats", JSON.stringify(stats));

  return res.status(200).json({
    ok: true,
    message: "Stats fixed",
    stats
  });
}
