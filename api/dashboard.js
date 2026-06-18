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

function money(amount, currency = "GBP") {
  return `${currency} ${Number(amount || 0).toFixed(2)}`;
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
  const statsRaw = await redis.get("donation_stats");

  const stats = statsRaw
    ? JSON.parse(statsRaw)
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

  const typeLabels = {
    anything: "ANYTHING",
    redstripe: "RED STRIPE ;)",
    equipment: "Equipment",
    giveaways: "Giveaways",
    charity: "Charity"
  };

  const typeCards = Object.keys(typeLabels).map((key) => {
    const count = stats.byType?.[key] || 0;
    const amount = stats.byTypeAmount?.[key] || 0;

    return `
      <div class="card">
        <div class="title">${typeLabels[key]}</div>
        <div class="value">${count}</div>
        <div class="sub">${money(amount)}</div>
      </div>
    `;
  }).join("");

  const topSupporters = Object.entries(stats.supporters || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, amount], index) => `
      <div class="row">
        <span>${index + 1}. ${name}</span>
        <strong>${money(amount)}</strong>
      </div>
    `)
    .join("") || `<div class="empty">No supporters yet</div>`;

  const recentSupporters = (stats.recent || [])
    .slice(0, 10)
    .map((d) => `
      <div class="row">
        <div>
          <div>${d.name} <small>${typeLabels[d.option] || d.option}</small></div>
          <small>${new Date(d.createdAt).toLocaleString()}</small>
        </div>
        <strong>${money(d.amount, d.currency)}</strong>
      </div>
    `)
    .join("") || `<div class="empty">No recent donations yet</div>`;

  res.setHeader("Content-Type", "text/html");

  return res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>JHECZ Dashboard</title>
      <style>
        body {
          background:#070707;
          color:white;
          font-family:Arial, sans-serif;
          margin:0;
        }

        h1 {
          color:#ff0000;
          text-align:center;
          margin:35px 0 5px;
          font-size:42px;
        }

        .subtitle {
          text-align:center;
          color:#aaa;
          margin-bottom:25px;
        }

        .grid {
          display:grid;
          grid-template-columns:repeat(auto-fit,minmax(240px,1fr));
          gap:20px;
          padding:25px;
        }

        .card {
          background:#151515;
          border:2px solid #ff0000;
          border-radius:20px;
          padding:24px;
          box-shadow:0 0 22px rgba(255,0,0,.35);
        }

        .title {
          color:#aaa;
          font-size:17px;
          text-transform:uppercase;
          letter-spacing:1px;
        }

        .value {
          font-size:44px;
          font-weight:900;
          margin-top:10px;
        }

        .sub {
          color:#ffdf5d;
          font-size:22px;
          font-weight:bold;
          margin-top:8px;
        }

        .section {
          padding:0 25px 25px;
          display:grid;
          grid-template-columns:repeat(auto-fit,minmax(360px,1fr));
          gap:20px;
        }

        .row {
          display:flex;
          justify-content:space-between;
          gap:15px;
          padding:12px 0;
          border-bottom:1px solid #333;
          font-size:18px;
        }

        small {
          color:#999;
          margin-left:8px;
        }

        .empty {
          color:#777;
          padding-top:12px;
        }
      </style>
    </head>
    <body>
      <h1>🎥 JHECZ STREAM DASHBOARD</h1>
      <div class="subtitle">PayPal + Stripe donation stats</div>

      <div class="grid">
        <div class="card">
          <div class="title">Total Donations</div>
          <div class="value">${stats.totalDonations || 0}</div>
        </div>

        <div class="card">
          <div class="title">Total Raised</div>
          <div class="value">${money(stats.totalRaised)}</div>
        </div>

        <div class="card">
          <div class="title">Red Stripe Count</div>
          <div class="value">${stats.redStripeCount || 0}</div>
        </div>

        <div class="card">
          <div class="title">Big Ballers</div>
          <div class="value">${stats.bigBallerCount || 0}</div>
        </div>

        <div class="card">
          <div class="title">Ultra Ballers</div>
          <div class="value">${stats.ultraBallerCount || 0}</div>
        </div>
      </div>

      <div class="grid">
        ${typeCards}
      </div>

      <div class="section">
        <div class="card">
          <div class="title">Top Supporters</div>
          ${topSupporters}
        </div>

        <div class="card">
          <div class="title">Recent Supporters</div>
          ${recentSupporters}
        </div>
      </div>
    </body>
    </html>
  `);
}
