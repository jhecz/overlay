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
//helper functions brooo
function money(amount, currency = "GBP") {
  if (currency === "GBP") {
    return `£${Number(amount || 0).toFixed(2)}`;
  }

  return `${currency} ${Number(amount || 0).toFixed(2)}`;
}

function getLondonDate(date) {
  return new Date(
    new Date(date).toLocaleString("en-US", {
      timeZone: "Europe/London"
    })
  );
}

function isSameDay(date) {
  const d = getLondonDate(date);
  const now = getLondonDate(new Date());

  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

function isThisWeek(date) {
  const d = getLondonDate(date);
  const now = getLondonDate(new Date());

  const monday = new Date(now);
  const day = monday.getDay() || 7;

  monday.setDate(monday.getDate() - day + 1);
  monday.setHours(0, 0, 0, 0);

  return d >= monday;
}

function isThisMonth(date) {
  const d = getLondonDate(date);
  const now = getLondonDate(new Date());

  return (
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}
//end helper functions
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

  const recent = stats.recent || [];

  const todayAmount = recent.filter(d => d.createdAt && isSameDay(d.createdAt)).reduce((s, d) => s + Number(d.amount || 0), 0);
  const weekAmount = recent.filter(d => d.createdAt && isThisWeek(d.createdAt)).reduce((s, d) => s + Number(d.amount || 0), 0);
  const monthAmount = recent.filter(d => d.createdAt && isThisMonth(d.createdAt)).reduce((s, d) => s + Number(d.amount || 0), 0);

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
      <div class="card type-card ${key}">
        <div class="title">${typeLabels[key]}</div>
        <div class="value">${count}</div>
        <div class="sub">${money(amount)}</div>
      </div>
    `;
  }).join("");

  const topSupporters = Object.entries(stats.supporters || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, amount], index) => {
      const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`;
      return `
        <div class="row">
          <span>${medal} ${name}</span>
          <strong>${money(amount)}</strong>
        </div>
      `;
    })
    .join("") || `<div class="empty">No supporters yet</div>`;

  const activityFeed = recent
    .slice(0, 20)
    .map((d) => `
      <div class="activity">
        <div>
          <strong>${d.name}</strong>
          <span>${typeLabels[d.option] || d.option}</span>
          <small>${d.createdAt ? new Date(d.createdAt).toLocaleString("en-GB") : "No timestamp"}</small>
        </div>
        <b>${money(d.amount, d.currency)}</b>
      </div>
    `)
    .join("") || `<div class="empty">No activity yet</div>`;

  res.setHeader("Content-Type", "text/html");

  return res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>JHECZ Dashboard</title>
      <style>
        body {
          background: radial-gradient(circle at top, #1a0000, #050505 45%);
          color: white;
          font-family: Arial, sans-serif;
          margin: 0;
        }

        h1 {
          color: #ff1a1a;
          text-align: center;
          margin: 35px 0 5px;
          font-size: 46px;
          text-shadow: 0 0 25px rgba(255,0,0,.8);
        }

        .subtitle {
          text-align: center;
          color: #aaa;
          margin-bottom: 25px;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit,minmax(240px,1fr));
          gap: 20px;
          padding: 25px;
        }

        .card {
          background: rgba(18,18,18,.95);
          border: 2px solid #ff0000;
          border-radius: 22px;
          padding: 24px;
          box-shadow: 0 0 24px rgba(255,0,0,.35);
        }

        .title {
          color: #aaa;
          font-size: 15px;
          text-transform: uppercase;
          letter-spacing: 1.5px;
        }

        .value {
          font-size: 42px;
          font-weight: 900;
          margin-top: 10px;
        }

        .sub {
          color: #ffdf5d;
          font-size: 22px;
          font-weight: bold;
          margin-top: 8px;
        }

        .anything { border-color:#00ff6a; }
        .redstripe { border-color:#ff0000; }
        .equipment { border-color:#00c8ff; }
        .giveaways { border-color:#b000ff; }
        .charity { border-color:#ff2b7a; }

        .section {
          padding: 0 25px 25px;
          display: grid;
          grid-template-columns: repeat(auto-fit,minmax(420px,1fr));
          gap: 20px;
        }

        .row, .activity {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          padding: 14px 0;
          border-bottom: 1px solid #333;
          font-size: 18px;
        }

        .activity span {
          display: inline-block;
          margin-left: 8px;
          color: #ffdf5d;
          font-size: 14px;
        }

        small {
          display: block;
          color: #999;
          margin-top: 4px;
          font-size: 13px;
        }

        .empty {
          color: #777;
          padding-top: 12px;
        }
      </style>
    </head>
    <body>
      <h1>🎥 JHECZ STREAM DASHBOARD</h1>
      <div class="subtitle">PayPal + Stripe donation analytics</div>

      <div class="grid">
        <div class="card"><div class="title">Today</div><div class="value">${money(todayAmount)}</div></div>
        <div class="card"><div class="title">This Week</div><div class="value">${money(weekAmount)}</div></div>
        <div class="card"><div class="title">This Month</div><div class="value">${money(monthAmount)}</div></div>
        <div class="card"><div class="title">All Time</div><div class="value">${money(stats.totalRaised)}</div></div>
      </div>

      <div class="grid">
        <div class="card"><div class="title">Total Donations</div><div class="value">${stats.totalDonations || 0}</div></div>
        <div class="card"><div class="title">Red Stripe Count</div><div class="value">${stats.redStripeCount || 0}</div></div>
        <div class="card"><div class="title">Big Ballers</div><div class="value">${stats.bigBallerCount || 0}</div></div>
        <div class="card"><div class="title">Ultra Ballers</div><div class="value">${stats.ultraBallerCount || 0}</div></div>
      </div>

      <div class="grid">
        ${typeCards}
      </div>

      <div class="section">
        <div class="card">
          <div class="title">🏆 Hall of Fame</div>
          ${topSupporters}
        </div>

        <div class="card">
          <div class="title">📡 Activity Feed</div>
          ${activityFeed}
        </div>
      </div>
    </body>
    </html>
  `);
}
