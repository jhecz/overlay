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
  const value = Number(amount || 0).toFixed(2);
  return currency === "GBP" ? `£${value}` : `${currency} ${value}`;
}

function getLondonDate(date) {
  return new Date(
    new Date(date).toLocaleString("en-US", { timeZone: "Europe/London" })
  );
}

function isSameDay(date) {
  const d = getLondonDate(date);
  const now = getLondonDate(new Date());
  return d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
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
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function mutedClass(value) {
  return Number(value || 0) === 0 ? "muted" : "";
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
      <div class="card type-card ${key} ${mutedClass(count)}">
        <div class="title">${typeLabels[key]}</div>
        <div class="value">${count}</div>
        <div class="sub ${mutedClass(amount)}">${money(amount)}</div>
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
          <small>${d.createdAt ? new Date(d.createdAt).toLocaleString("en-GB", { timeZone: "Europe/London" }) : "No timestamp"}</small>
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
          background: radial-gradient(circle at top, #210000, #060606 48%);
          color: #fff;
          font-family: Arial, sans-serif;
          margin: 0;
        }

        .wrap {
          max-width: 1500px;
          margin: 0 auto;
          padding-bottom: 35px;
        }

        h1 {
          color: #ff2222;
          text-align: center;
          margin: 38px 0 6px;
          font-size: 48px;
          text-shadow: 0 0 28px rgba(255,0,0,.85);
        }

        .subtitle {
          text-align: center;
          color: #999;
          margin-bottom: 28px;
          font-size: 15px;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit,minmax(240px,1fr));
          gap: 18px;
          padding: 0 25px 25px;
        }

        .section {
          padding: 0 25px 25px;
          display: grid;
          grid-template-columns: repeat(auto-fit,minmax(420px,1fr));
          gap: 18px;
        }

        .card {
          background: linear-gradient(180deg, rgba(26,26,26,.98), rgba(12,12,12,.98));
          border: 1px solid rgba(255,0,0,.75);
          border-radius: 22px;
          padding: 24px;
          box-shadow: 0 0 22px rgba(255,0,0,.25);
          transition: opacity .2s ease, transform .2s ease;
        }

        .card:hover {
          transform: translateY(-2px);
        }

        .card.muted {
          opacity: .2;
        }

        .title {
          color: #aaa;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 1.6px;
          font-weight: 800;
        }

        .value {
          font-size: 42px;
          font-weight: 1000;
          margin-top: 12px;
        }

        .sub {
          color: #fff;
          font-size: 22px;
          font-weight: 900;
          margin-top: 8px;
        }

        .sub.muted {
          opacity: .2;
        }

        .anything { border-color:#00ff6a; }
        .redstripe { border-color:#ff2222; }
        .equipment { border-color:#00c8ff; }
        .giveaways { border-color:#b000ff; }
        .charity { border-color:#ff2b7a; }

        .row, .activity {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          padding: 14px 0;
          border-bottom: 1px solid rgba(255,255,255,.08);
          font-size: 18px;
        }

        .row:last-child,
        .activity:last-child {
          border-bottom: 0;
        }

        .activity span {
          display: inline-block;
          margin-left: 8px;
          color: #ffdf5d;
          font-size: 13px;
          font-weight: 800;
        }

        small {
          display: block;
          color: #888;
          margin-top: 5px;
          font-size: 13px;
        }

        strong, b {
          white-space: nowrap;
        }

        .empty {
          color: #777;
          padding-top: 14px;
        }
      </style>
    </head>

    <body>
      <div class="wrap">
        <h1>🎥 JHECZ STREAM DASHBOARD</h1>
        <div class="subtitle">PayPal + Stripe donation analytics</div>

        <div class="grid">
          <div class="card ${mutedClass(todayAmount)}"><div class="title">Today</div><div class="value">${money(todayAmount)}</div></div>
          <div class="card ${mutedClass(weekAmount)}"><div class="title">This Week</div><div class="value">${money(weekAmount)}</div></div>
          <div class="card ${mutedClass(monthAmount)}"><div class="title">This Month</div><div class="value">${money(monthAmount)}</div></div>
          <div class="card ${mutedClass(stats.totalRaised)}"><div class="title">All Time</div><div class="value">${money(stats.totalRaised)}</div></div>
        </div>

        <div class="grid">
          <div class="card ${mutedClass(stats.totalDonations)}"><div class="title">Total Donations</div><div class="value">${stats.totalDonations || 0}</div></div>
          <div class="card ${mutedClass(stats.redStripeCount)}"><div class="title">Red Stripe Count</div><div class="value">${stats.redStripeCount || 0}</div></div>
          <div class="card ${mutedClass(stats.bigBallerCount)}"><div class="title">Big Ballers</div><div class="value">${stats.bigBallerCount || 0}</div></div>
          <div class="card ${mutedClass(stats.ultraBallerCount)}"><div class="title">Ultra Ballers</div><div class="value">${stats.ultraBallerCount || 0}</div></div>
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
      </div>
    </body>
    </html>
  `);
}
