export default function handler(req, res) {
  const auth = req.headers.authorization || "";
  const username = "jhecz";
  const password = process.env.DASHBOARD_PASSWORD;

  const expected =
    "Basic " + Buffer.from(`${username}:${password}`).toString("base64");

  if (!password || auth !== expected) {
    res.setHeader("WWW-Authenticate", 'Basic realm="JHecz Dashboard"');
    return res.status(401).send(`Login required. Password set: ${password ? "YES" : "NO"}`);
  }

  res.setHeader("Content-Type", "text/html");

  return res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>JHECZ Dashboard</title>
      <style>
        body { background:#0b0b0b; color:white; font-family:Arial; margin:0; }
        h1 { color:#ff0000; text-align:center; margin-top:40px; }
        .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:20px; padding:30px; }
        .card { background:#151515; border:2px solid #ff0000; border-radius:20px; padding:25px; box-shadow:0 0 20px rgba(255,0,0,.35); }
        .title { color:#aaa; font-size:18px; }
        .value { font-size:42px; font-weight:bold; margin-top:10px; }
      </style>
    </head>
    <body>
      <h1>🎥 JHECZ STREAM DASHBOARD</h1>
      <div class="grid">
        <div class="card"><div class="title">Total Donations</div><div class="value">Coming soon</div></div>
        <div class="card"><div class="title">Total Raised</div><div class="value">£0.00</div></div>
        <div class="card"><div class="title">Red Stripe Count</div><div class="value">0</div></div>
        <div class="card"><div class="title">Big Ballers</div><div class="value">0</div></div>
      </div>
    </body>
    </html>
  `);
}
