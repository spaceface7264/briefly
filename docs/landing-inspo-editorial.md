<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Klip — Option A: Editorial Calm</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #FAFAF7;
    --bg-elevated: #FFFFFF;
    --ink: #0E0F12;
    --ink-2: #3A3B40;
    --ink-3: #6B6C72;
    --rule: #E6E4DD;
    --rule-soft: #EFEDE6;
    --accent: #B8482E; /* one restrained color, terracotta */
    --r-sm: 4px;
    --r-md: 8px;
    --r-lg: 12px;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    background: var(--bg);
    color: var(--ink);
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 15px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }
  .serif { font-family: 'Fraunces', serif; font-feature-settings: "ss01"; letter-spacing: -0.01em; }

  .app { max-width: 1240px; margin: 0 auto; padding: 32px 40px 80px; }

  header.top {
    display: flex; align-items: center; justify-content: space-between;
    padding-bottom: 28px;
    border-bottom: 1px solid var(--rule);
  }
  .brand { display: flex; align-items: baseline; gap: 10px; }
  .brand .logo { font-family: 'Fraunces', serif; font-weight: 500; font-size: 24px; letter-spacing: -0.02em; }
  .brand .tag { font-size: 12px; color: var(--ink-3); font-weight: 500; }
  nav.top-nav { display: flex; gap: 28px; }
  nav.top-nav a { color: var(--ink-2); text-decoration: none; font-size: 14px; font-weight: 500; }
  nav.top-nav a.active { color: var(--ink); }
  nav.top-nav a.active::after { content: ""; display: block; height: 2px; background: var(--ink); margin-top: 6px; }
  .avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #C9B8A8, #8A7560); }

  .masthead { padding: 56px 0 40px; border-bottom: 1px solid var(--rule); }
  .masthead .kicker {
    font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase;
    color: var(--accent); font-weight: 600; margin-bottom: 16px;
  }
  .masthead h1 {
    font-family: 'Fraunces', serif; font-weight: 400;
    font-size: 56px; line-height: 1.05; letter-spacing: -0.025em;
    max-width: 720px;
  }
  .masthead h1 em { font-style: italic; color: var(--ink-2); }
  .masthead .sub {
    margin-top: 20px; font-size: 16px; color: var(--ink-3);
    max-width: 540px; line-height: 1.6;
  }

  .grid { display: grid; grid-template-columns: 1fr 320px; gap: 56px; padding-top: 40px; }

  .section-label {
    font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase;
    color: var(--ink-3); font-weight: 600;
    padding-bottom: 14px; border-bottom: 1px solid var(--rule);
    margin-bottom: 0;
    display: flex; justify-content: space-between; align-items: baseline;
  }
  .section-label .count { color: var(--ink); font-family: 'Fraunces', serif; font-size: 14px; letter-spacing: 0; text-transform: none; }

  .brief { padding: 28px 0; border-bottom: 1px solid var(--rule); display: grid; grid-template-columns: 80px 1fr auto; gap: 24px; align-items: start; cursor: pointer; transition: opacity .15s; }
  .brief:hover { opacity: 0.7; }
  .brief .num { font-family: 'Fraunces', serif; font-size: 28px; color: var(--ink-3); font-weight: 400; }
  .brief h3 { font-family: 'Fraunces', serif; font-weight: 500; font-size: 22px; line-height: 1.25; letter-spacing: -0.015em; margin-bottom: 8px; }
  .brief p { color: var(--ink-3); font-size: 14px; line-height: 1.55; max-width: 520px; }
  .brief .meta { display: flex; gap: 12px; margin-top: 14px; font-size: 12px; color: var(--ink-3); }
  .brief .meta span { padding-right: 12px; border-right: 1px solid var(--rule); }
  .brief .meta span:last-child { border-right: none; }
  .brief .pay { text-align: right; }
  .brief .pay .amt { font-family: 'Fraunces', serif; font-size: 20px; font-weight: 500; }
  .brief .pay .when { font-size: 12px; color: var(--ink-3); margin-top: 4px; }

  .sidebar { display: flex; flex-direction: column; gap: 32px; }
  .card {
    background: var(--bg-elevated);
    border: 1px solid var(--rule);
    border-radius: var(--r-lg);
    padding: 24px;
  }
  .card h4 { font-family: 'Fraunces', serif; font-weight: 500; font-size: 18px; margin-bottom: 18px; letter-spacing: -0.01em; }
  .stat { display: flex; justify-content: space-between; align-items: baseline; padding: 12px 0; border-bottom: 1px solid var(--rule-soft); }
  .stat:last-child { border-bottom: none; }
  .stat .label { font-size: 13px; color: var(--ink-3); }
  .stat .value { font-family: 'Fraunces', serif; font-size: 22px; font-weight: 500; letter-spacing: -0.01em; }
  .stat .value .small { font-size: 13px; color: var(--ink-3); margin-left: 2px; }

  .btn {
    display: inline-block; padding: 11px 18px;
    background: var(--ink); color: var(--bg);
    border: none; border-radius: var(--r-md);
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-weight: 600; font-size: 14px; cursor: pointer;
    text-decoration: none;
    transition: background .15s;
  }
  .btn:hover { background: var(--ink-2); }
  .btn.full { display: block; text-align: center; width: 100%; margin-top: 4px; }
  .btn-ghost { background: transparent; color: var(--ink); border: 1px solid var(--rule); }

  .footnote { font-size: 12px; color: var(--ink-3); padding-top: 32px; border-top: 1px solid var(--rule); margin-top: 56px; display: flex; justify-content: space-between; }
</style>
</head>
<body>
  <div class="app">
    <header class="top">
      <div class="brand">
        <span class="logo">Klip.</span>
        <span class="tag">Issue 47 · May 2026</span>
      </div>
      <nav class="top-nav">
        <a href="#" class="active">Briefs</a>
        <a href="#">Library</a>
        <a href="#">Earnings</a>
        <a href="#">Profile</a>
      </nav>
      <div class="avatar"></div>
    </header>

    <section class="masthead">
      <div class="kicker">Today's feed</div>
      <h1>Five briefs <em>worth your morning.</em></h1>
      <p class="sub">A curated set of opportunities matched to your portfolio. Take what fits, pass on the rest. New briefs publish daily at 09:00.</p>
    </section>

    <div class="grid">
      <main>
        <div class="section-label">
          <span>Open briefs</span>
          <span class="count">5 available</span>
        </div>

        <article class="brief">
          <div class="num">01</div>
          <div>
            <h3>Bouldering gym launch — short-form video, Aarhus</h3>
            <p>Three 30-second cuts for opening week. Vertical, native sound, no voiceover required. Brand has full creative trust.</p>
            <div class="meta">
              <span>Video</span>
              <span>3 deliverables</span>
              <span>Due 22 May</span>
            </div>
          </div>
          <div class="pay">
            <div class="amt">4 200 kr</div>
            <div class="when">on delivery</div>
          </div>
        </article>

        <article class="brief">
          <div class="num">02</div>
          <div>
            <h3>Coffee roaster — product photography, in-studio</h3>
            <p>Eight hero shots for a single-origin launch. Natural light preferred. Half-day shoot, props provided.</p>
            <div class="meta">
              <span>Photo</span>
              <span>8 images</span>
              <span>Due 18 May</span>
            </div>
          </div>
          <div class="pay">
            <div class="amt">2 800 kr</div>
            <div class="when">on delivery</div>
          </div>
        </article>

        <article class="brief">
          <div class="num">03</div>
          <div>
            <h3>Wellness brand — long-form Instagram reel</h3>
            <p>Sixty seconds, voiceover scripted by client. Shoot in natural daylight, talent provided on location.</p>
            <div class="meta">
              <span>Video</span>
              <span>1 reel</span>
              <span>Due 25 May</span>
            </div>
          </div>
          <div class="pay">
            <div class="amt">3 500 kr</div>
            <div class="when">on delivery</div>
          </div>
        </article>

        <article class="brief">
          <div class="num">04</div>
          <div>
            <h3>Independent magazine — editorial portrait</h3>
            <p>Single subject, single location. Final selection of six frames in colour and black and white. Print rights only.</p>
            <div class="meta">
              <span>Photo</span>
              <span>6 images</span>
              <span>Due 28 May</span>
            </div>
          </div>
          <div class="pay">
            <div class="amt">1 900 kr</div>
            <div class="when">on delivery</div>
          </div>
        </article>

        <article class="brief">
          <div class="num">05</div>
          <div>
            <h3>Restaurant opening — behind-the-scenes documentary</h3>
            <p>One full evening of service. Two-minute edit, plus raw selects. Subject is comfortable on camera.</p>
            <div class="meta">
              <span>Video</span>
              <span>1 film + selects</span>
              <span>Due 02 Jun</span>
            </div>
          </div>
          <div class="pay">
            <div class="amt">6 800 kr</div>
            <div class="when">on delivery</div>
          </div>
        </article>
      </main>

      <aside class="sidebar">
        <div class="card">
          <h4>This month</h4>
          <div class="stat">
            <span class="label">Briefs claimed</span>
            <span class="value">7</span>
          </div>
          <div class="stat">
            <span class="label">Awaiting payout</span>
            <span class="value">12 400<span class="small"> kr</span></span>
          </div>
          <div class="stat">
            <span class="label">Paid out</span>
            <span class="value">8 600<span class="small"> kr</span></span>
          </div>
          <div class="stat">
            <span class="label">Acceptance rate</span>
            <span class="value">94<span class="small">%</span></span>
          </div>
        </div>

        <div class="card">
          <h4>Next payout</h4>
          <p style="font-size: 14px; color: var(--ink-3); margin-bottom: 16px; line-height: 1.5;">Wednesday, 14 May. Self-billed invoice will be issued automatically.</p>
          <a href="#" class="btn full">Review invoice</a>
        </div>
      </aside>
    </div>

    <div class="footnote">
      <span>Klip — a marketplace for vetted creators.</span>
      <span>v1.0</span>
    </div>
  </div>
</body>
</html>