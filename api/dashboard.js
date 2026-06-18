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
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">
      <title>JHECZ Dashboard</title>
     <style>
  :root {
    --bg: #050505;
    --panel: rgba(18, 18, 20, 0.78);
    --panel-strong: rgba(28, 28, 32, 0.9);
    --border: rgba(255, 255, 255, 0.08);
    --border-red: rgba(255, 34, 34, 0.35);
    --red: #ff2222;
    --red-soft: rgba(255, 34, 34, 0.14);
    --text: #ffffff;
    --muted-text: #8d8d93;
    --soft-text: #b7b7bd;
    --green: #00ff8a;
    --cyan: #00c8ff;
    --purple: #b45cff;
    --pink: #ff4d8d;
    --gold: #ffd166;
    --radius: 24px;
    --shadow: 0 18px 50px rgba(0, 0, 0, 0.55);
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    min-height: 100vh;
    color: var(--text);
    font-family: "Inter", Arial, sans-serif;
    background:
      radial-gradient(circle at 20% 0%, rgba(255, 0, 0, 0.22), transparent 32%),
      radial-gradient(circle at 85% 18%, rgba(255, 34, 34, 0.12), transparent 28%),
      linear-gradient(135deg, #070707 0%, #0d0d10 45%, #030303 100%);
  }

  body::before {
    content: "";
    position: fixed;
    inset: 0;
    pointer-events: none;
    background-image:
      linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
    background-size: 46px 46px;
    mask-image: linear-gradient(to bottom, black, transparent 78%);
  }

  .layout {
    display: flex;
    min-height: 100vh;
  }

  .sidebar {
    width: 270px;
    flex: 0 0 270px;
    min-height: 100vh;
    position: sticky;
    top: 0;
    padding: 28px 18px;
    background: rgba(5, 5, 7, 0.76);
    border-right: 1px solid var(--border);
    backdrop-filter: blur(18px);
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 12px 24px;
    margin-bottom: 18px;
    color: var(--text);
    font-size: 25px;
    font-weight: 950;
    letter-spacing: -0.8px;
    border-bottom: 1px solid var(--border);
  }

  .logo::after {
    content: "LIVE OPS";
    margin-left: auto;
    color: var(--red);
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 1.4px;
    padding: 5px 8px;
    border: 1px solid var(--border-red);
    border-radius: 999px;
    background: var(--red-soft);
  }

  .nav {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 46px;
    margin: 7px 0;
    padding: 12px 14px;
    color: var(--muted-text);
    text-decoration: none;
    font-weight: 750;
    border-radius: 16px;
    border: 1px solid transparent;
    transition: all 0.18s ease;
  }

  .nav:hover {
    color: var(--text);
    background: rgba(255, 255, 255, 0.045);
    transform: translateX(3px);
  }

  .nav.active {
    color: var(--text);
    background: linear-gradient(135deg, rgba(255,34,34,0.22), rgba(255,34,34,0.06));
    border-color: var(--border-red);
    box-shadow: 0 0 28px rgba(255, 0, 0, 0.14);
  }

  .content {
    flex: 1;
    min-width: 0;
  }

  .wrap {
    width: 100%;
    max-width: 1580px;
    margin: 0 auto;
    padding: 0 28px 42px;
  }

  .hero {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 22px;
    padding: 38px 0 26px;
  }

  .breadcrumb {
    color: var(--red);
    text-transform: uppercase;
    letter-spacing: 2px;
    font-size: 12px;
    font-weight: 900;
    margin-bottom: 10px;
  }

  h1 {
    margin: 0;
    font-size: clamp(34px, 4vw, 56px);
    line-height: 0.96;
    letter-spacing: -2px;
    font-weight: 950;
    color: var(--text);
    text-shadow: 0 0 34px rgba(255, 0, 0, 0.36);
  }

  .subtitle {
    margin-top: 14px;
    color: var(--soft-text);
    font-size: 15px;
    font-weight: 600;
  }

  .live-pill {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    white-space: nowrap;
    padding: 12px 17px;
    border-radius: 999px;
    background: rgba(255, 34, 34, 0.12);
    color: #ff6b6b;
    border: 1px solid var(--border-red);
    font-size: 13px;
    font-weight: 900;
    letter-spacing: 0.8px;
    box-shadow: 0 0 28px rgba(255, 0, 0, 0.12);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(235px, 1fr));
    gap: 18px;
    padding: 0 0 20px;
  }

  .section {
    display: grid;
    grid-template-columns: minmax(340px, 0.9fr) minmax(420px, 1.1fr);
    gap: 18px;
    padding: 0 0 20px;
  }

  .card {
    position: relative;
    overflow: hidden;
    padding: 22px;
    min-height: 132px;
    border-radius: var(--radius);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.025)),
      var(--panel);
    border: 1px solid var(--border);
    box-shadow: var(--shadow);
    backdrop-filter: blur(18px);
    transition: transform 0.18s ease, border-color 0.18s ease, opacity 0.18s ease;
  }

  .card::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(circle at top right, rgba(255,34,34,0.16), transparent 38%);
    opacity: 0.8;
  }

  .card:hover {
    transform: translateY(-3px);
    border-color: rgba(255, 255, 255, 0.16);
  }

  .card.muted {
    opacity: 0.2;
  }

  .title {
    position: relative;
    z-index: 1;
    color: var(--muted-text);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 1.7px;
    font-weight: 900;
  }

  .value {
    position: relative;
    z-index: 1;
    margin-top: 12px;
    font-size: clamp(34px, 3vw, 46px);
    line-height: 1;
    font-weight: 950;
    letter-spacing: -1.7px;
  }

  .sub {
    position: relative;
    z-index: 1;
    margin-top: 10px;
    color: var(--text);
    font-size: 20px;
    font-weight: 900;
  }

  .sub.muted {
    opacity: 0.2;
  }

  .anything {
    border-color: rgba(0,255,138,0.28);
  }

  .redstripe {
    border-color: rgba(255,34,34,0.48);
  }

  .equipment {
    border-color: rgba(0,200,255,0.35);
  }

  .giveaways {
    border-color: rgba(180,92,255,0.35);
  }

  .charity {
    border-color: rgba(255,77,141,0.35);
  }

  .anything::before {
    background: radial-gradient(circle at top right, rgba(0,255,138,0.18), transparent 42%);
  }

  .redstripe::before {
    background: radial-gradient(circle at top right, rgba(255,34,34,0.26), transparent 42%);
  }

  .equipment::before {
    background: radial-gradient(circle at top right, rgba(0,200,255,0.2), transparent 42%);
  }

  .giveaways::before {
    background: radial-gradient(circle at top right, rgba(180,92,255,0.22), transparent 42%);
  }

  .charity::before {
    background: radial-gradient(circle at top right, rgba(255,77,141,0.22), transparent 42%);
  }

  .row,
  .activity {
    position: relative;
    z-index: 1;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 18px;
    padding: 14px 0;
    border-bottom: 1px solid rgba(255,255,255,0.075);
    font-size: 16px;
  }

  .row:last-child,
  .activity:last-child {
    border-bottom: 0;
  }

  .activity span {
    display: inline-flex;
    margin-left: 8px;
    color: var(--gold);
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 0.8px;
    text-transform: uppercase;
  }

  small {
    display: block;
    color: var(--muted-text);
    margin-top: 6px;
    font-size: 12px;
    font-weight: 650;
  }

  strong,
  b {
    white-space: nowrap;
    font-weight: 950;
  }

  .empty {
    position: relative;
    z-index: 1;
    color: var(--muted-text);
    padding-top: 14px;
  }

  .coming-soon-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 18px;
    padding: 0;
  }

  .coming-soon {
    min-height: 170px;
    opacity: 0.92;
  }

  .coming-soon .value {
    font-size: 26px;
    letter-spacing: -0.8px;
  }

  .badge {
    display: inline-flex;
    margin-top: 16px;
    padding: 7px 10px;
    border-radius: 999px;
    color: var(--muted-text);
    border: 1px solid var(--border);
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  @media (max-width: 900px) {
    .layout {
      display: block;
    }

    .sidebar {
      width: 100%;
      height: auto;
      min-height: auto;
      position: relative;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 16px;
    }

    .logo {
      width: 100%;
      margin-bottom: 8px;
      padding-bottom: 14px;
    }

    .nav {
      margin: 0;
    }

    .hero {
      flex-direction: column;
    }

    .section {
      grid-template-columns: 1fr;
    }

    .wrap {
      padding: 0 16px 35px;
    }
  }
</style>
    </head>

    <body>
  <div class="layout">

    <aside class="sidebar">
      <div class="logo">🎥 JHECZ</div>

      <a href="/api/dashboard" class="nav active">Dashboard</a>
      <a href="/api/donations" class="nav">Donations</a>
      <a href="/api/twitch" class="nav">Twitch</a>
      <a href="/api/tiktok" class="nav">TikTok</a>
      <a href="/api/leaderboard" class="nav">Leaderboards</a>
      <a href="/api/settings" class="nav">Settings</a>
    </aside>

    <main class="content">
      <div class="wrap">
       <div class="hero">
          
            <div>
              <div class="breadcrumb">
                Dashboard
              </div>
          
              <h1>🎥 JHECZ COMMAND CENTRE</h1>
          
              <div class="subtitle">
                Live streaming analytics & supporter insights
              </div>
            </div>
          
            <div class="live-pill">
              🔴 OFFLINE
            </div>
          
          </div>

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

<div class="coming-soon-grid">

  <div class="card coming-soon">
    <div class="title">🎮 Twitch Analytics</div>
    <div class="value">Coming Soon</div>
    <div class="badge">API Integration Planned</div>
  </div>

  <div class="card coming-soon">
    <div class="title">🎵 TikTok Analytics</div>
    <div class="value">Coming Soon</div>
    <div class="badge">API Integration Planned</div>
  </div>

  <div class="card coming-soon">
    <div class="title">🏆 Stream Leaderboards</div>
    <div class="value">Coming Soon</div>
    <div class="badge">Supporters • Subs • Gifts</div>
  </div>

</div>
        </div>
    </main>
  </div>
</body>
</html>
  `);
}
