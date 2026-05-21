<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Briefly — Daily briefs for working creators</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=PP+Neue+Montreal:wght@400;500;700&family=Inter+Tight:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #0E0E10;
    --bg-2: #161618;
    --bg-3: #1D1D20;
    --line: #28282C;
    --line-soft: #1F1F22;
    --paper: #F4F1EA;
    --paper-2: #B5B2AB;
    --paper-3: #75726C;
    --punch: #C8FF3C;        /* signal lime */
    --punch-2: #FF5C2E;      /* secondary warm */
    --r-sm: 8px;
    --r-md: 14px;
    --r-lg: 20px;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    background: var(--bg);
    color: var(--paper);
    font-family: 'Inter Tight', sans-serif;
    font-size: 16px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }
  .mono { font-family: 'JetBrains Mono', monospace; }

  body::before {
    content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 100;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.03 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
    opacity: 0.7;
  }

  .container { max-width: 1280px; margin: 0 auto; padding: 0 32px; }

  /* ============ NAV ============ */
  .nav-wrap {
    position: sticky; top: 16px; z-index: 50;
    padding: 16px 0 0;
  }
  .nav {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 32px;
    background: rgba(14,14,16,0.85);
    backdrop-filter: blur(12px);
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 10px 12px 10px 24px;
  }
  .wordmark {
    font-family: 'Inter Tight', sans-serif;
    font-weight: 800;
    font-size: 22px;
    letter-spacing: -0.04em;
    display: flex; align-items: center; gap: 6px;
  }
  .wordmark::after {
    content: ""; width: 7px; height: 7px;
    background: var(--punch); border-radius: 50%;
    margin-left: 2px;
  }
  .nav-links {
    display: flex; gap: 28px; justify-content: center;
    font-size: 14px; font-weight: 500;
  }
  .nav-links a {
    color: var(--paper-2); text-decoration: none;
    transition: color .15s;
  }
  .nav-links a:hover { color: var(--paper); }
  .nav-cta {
    display: flex; align-items: center; gap: 8px;
  }
  .btn {
    border: none; cursor: pointer;
    font-family: 'Inter Tight', sans-serif;
    font-weight: 600; font-size: 14px;
    letter-spacing: -0.005em;
    padding: 10px 18px;
    border-radius: 999px;
    transition: background .15s, transform .12s, color .15s;
  }
  .btn:active { transform: translateY(1px); }
  .btn-ghost { background: transparent; color: var(--paper); }
  .btn-ghost:hover { background: var(--bg-3); }
  .btn-pill {
    background: var(--paper); color: var(--bg);
  }
  .btn-pill:hover { background: white; }
  .btn-punch {
    background: var(--punch); color: var(--bg);
  }
  .btn-punch:hover { background: #DAFF6B; }

  /* ============ HERO ============ */
  .hero { padding: 80px 0 60px; }
  .hero-meta {
    display: flex; align-items: center; gap: 12px;
    margin-bottom: 32px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    color: var(--paper-3);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .hero-meta .dot {
    width: 6px; height: 6px;
    background: var(--punch); border-radius: 50%;
    box-shadow: 0 0 0 4px rgba(200,255,60,0.15);
    animation: pulse 2.5s infinite;
  }
  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 0 4px rgba(200,255,60,0.15); }
    50% { box-shadow: 0 0 0 7px rgba(200,255,60,0.05); }
  }
  .hero-meta .pill {
    padding: 4px 10px;
    border: 1px solid var(--line);
    border-radius: 999px;
    color: var(--paper-2);
  }

  .hero h1 {
    font-family: 'Inter Tight', sans-serif;
    font-weight: 800;
    font-size: clamp(56px, 9vw, 132px);
    line-height: 0.92;
    letter-spacing: -0.045em;
    max-width: 13ch;
    margin-bottom: 36px;
  }
  .hero h1 .punch { color: var(--punch); }
  .hero h1 em {
    font-style: normal;
    font-weight: 400;
    font-family: 'Inter Tight', sans-serif;
    font-style: italic;
    color: var(--paper-2);
  }

  .hero-row {
    display: grid;
    grid-template-columns: 1.4fr 1fr;
    gap: 48px;
    align-items: end;
  }
  .hero-row p {
    font-size: 19px;
    line-height: 1.5;
    color: var(--paper-2);
    max-width: 38ch;
  }
  .hero-cta {
    display: flex; gap: 10px; align-items: center;
    justify-self: end;
  }
  .btn-lg {
    padding: 16px 24px;
    font-size: 15px;
    border-radius: 999px;
    display: inline-flex; align-items: center; gap: 12px;
  }
  .btn-lg .arrow {
    width: 18px; height: 18px; border-radius: 50%;
    background: var(--bg); color: var(--punch);
    display: grid; place-items: center;
    font-size: 11px;
    transition: transform .2s;
  }
  .btn-lg:hover .arrow { transform: translateX(3px); }

  /* Scarcity/spec strip */
  .spec-strip {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    border-top: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
    margin-top: 80px;
  }
  .spec {
    padding: 24px 0;
    border-right: 1px solid var(--line);
    padding-right: 24px;
  }
  .spec:not(:first-child) { padding-left: 24px; }
  .spec:last-child { border-right: none; padding-right: 0; }
  .spec .lbl {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px; color: var(--paper-3);
    letter-spacing: 0.1em; text-transform: uppercase;
    margin-bottom: 8px;
  }
  .spec .val {
    font-size: 28px; font-weight: 700;
    letter-spacing: -0.025em;
    line-height: 1;
  }
  .spec .val .u {
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px; color: var(--paper-3);
    margin-left: 4px; font-weight: 500;
  }
  .spec .val .punch { color: var(--punch); }

  /* ============ MARQUEE ============ */
  .marquee-section {
    margin-top: 80px;
    padding: 0 0 24px;
    overflow: hidden;
    position: relative;
  }
  .marquee-section::before, .marquee-section::after {
    content: ""; position: absolute; top: 0; bottom: 0; width: 80px;
    z-index: 2; pointer-events: none;
  }
  .marquee-section::before { left: 0; background: linear-gradient(to right, var(--bg), transparent); }
  .marquee-section::after { right: 0; background: linear-gradient(to left, var(--bg), transparent); }

  .marquee {
    display: flex;
    gap: 12px;
    white-space: nowrap;
    animation: marquee 60s linear infinite;
    width: max-content;
  }
  @keyframes marquee {
    from { transform: translateX(0); }
    to { transform: translateX(-50%); }
  }
  .marquee-item {
    display: inline-flex; align-items: center; gap: 10px;
    padding: 10px 18px;
    border: 1px solid var(--line);
    border-radius: 999px;
    font-size: 13px;
    color: var(--paper-2);
    background: var(--bg-2);
  }
  .marquee-item.punch { background: var(--punch); color: var(--bg); border-color: var(--punch); font-weight: 600; }
  .marquee-item .av {
    width: 24px; height: 24px; border-radius: 50%;
    background: linear-gradient(135deg, #2a2a2e, #4a4a52);
    flex-shrink: 0;
  }
  .marquee-item .av.a1 { background: linear-gradient(135deg, #C8FF3C, #5a7016); }
  .marquee-item .av.a2 { background: linear-gradient(135deg, #FF5C2E, #7a2c14); }
  .marquee-item .av.a3 { background: linear-gradient(135deg, #f4e4d4, #b89878); }
  .marquee-item .av.a4 { background: linear-gradient(135deg, #d4d4f4, #6868a8); }
  .marquee-item .av.a5 { background: linear-gradient(135deg, #f4d4e8, #a8688c); }
  .marquee-item .role {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: var(--paper-3);
    margin-left: 4px;
  }
  .marquee-item.punch .role { color: rgba(0,0,0,0.6); }

  /* ============ HOW IT WORKS / VALUE ============ */
  .section { padding: 100px 0; }
  .section-h {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 48px;
    margin-bottom: 56px;
    align-items: end;
  }
  .section-h .label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px; color: var(--punch);
    letter-spacing: 0.15em;
    text-transform: uppercase;
    margin-bottom: 16px;
  }
  .section-h h2 {
    font-family: 'Inter Tight', sans-serif;
    font-weight: 800;
    font-size: clamp(40px, 5.5vw, 72px);
    line-height: 0.95;
    letter-spacing: -0.035em;
    max-width: 14ch;
  }
  .section-h h2 em {
    font-style: italic; font-weight: 400;
    color: var(--paper-2);
  }
  .section-h p {
    font-size: 18px;
    color: var(--paper-2);
    line-height: 1.55;
    max-width: 44ch;
    padding-bottom: 12px;
  }

  /* Steps */
  .steps {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0;
    border-top: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
  }
  .step {
    padding: 36px 28px 36px 0;
    border-right: 1px solid var(--line);
    position: relative;
  }
  .step:not(:first-child) { padding-left: 28px; }
  .step:last-child { border-right: none; padding-right: 0; }
  .step .num {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: var(--punch);
    letter-spacing: 0.1em;
    margin-bottom: 28px;
  }
  .step h3 {
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.15;
    margin-bottom: 12px;
  }
  .step p {
    font-size: 14px;
    color: var(--paper-2);
    line-height: 1.55;
  }

  /* ============ TWO-PILLAR OFFER ============ */
  .pillars {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  .pillar {
    background: var(--bg-2);
    border: 1px solid var(--line);
    border-radius: var(--r-lg);
    padding: 36px;
    display: flex; flex-direction: column;
    min-height: 480px;
    position: relative;
    overflow: hidden;
  }
  .pillar.punch {
    background: var(--punch);
    border-color: var(--punch);
    color: var(--bg);
  }
  .pillar-tag {
    display: inline-block;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    padding: 5px 11px;
    border: 1px solid var(--line);
    border-radius: 999px;
    color: var(--paper-2);
    margin-bottom: 32px;
    align-self: flex-start;
    letter-spacing: 0.05em;
  }
  .pillar.punch .pillar-tag {
    border-color: rgba(0,0,0,0.25);
    color: rgba(0,0,0,0.7);
  }
  .pillar h3 {
    font-size: 44px;
    font-weight: 800;
    letter-spacing: -0.035em;
    line-height: 0.95;
    margin-bottom: 16px;
  }
  .pillar p {
    font-size: 16px;
    line-height: 1.55;
    color: var(--paper-2);
    margin-bottom: 32px;
    max-width: 42ch;
  }
  .pillar.punch p { color: rgba(0,0,0,0.7); }

  .pillar-list {
    list-style: none;
    margin-bottom: 36px;
  }
  .pillar-list li {
    display: flex; align-items: flex-start; gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid var(--line-soft);
    font-size: 14px;
  }
  .pillar.punch .pillar-list li {
    border-bottom-color: rgba(0,0,0,0.1);
  }
  .pillar-list li:last-child { border-bottom: none; }
  .pillar-list li .check {
    width: 14px; height: 14px;
    background: var(--punch); flex-shrink: 0;
    margin-top: 4px;
    display: grid; place-items: center;
    color: var(--bg);
    font-size: 9px; font-weight: 700;
  }
  .pillar.punch .pillar-list li .check {
    background: var(--bg); color: var(--punch);
  }
  .pillar-foot {
    margin-top: auto;
    display: flex; align-items: center; justify-content: space-between;
    gap: 16px;
    padding-top: 24px;
    border-top: 1px solid var(--line-soft);
  }
  .pillar.punch .pillar-foot { border-top-color: rgba(0,0,0,0.15); }
  .pillar-foot .terms {
    font-size: 13px;
    color: var(--paper-3);
  }
  .pillar.punch .pillar-foot .terms { color: rgba(0,0,0,0.6); }
  .pillar-foot .terms strong {
    color: var(--paper); display: block;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin-bottom: 2px;
  }
  .pillar.punch .pillar-foot .terms strong { color: var(--bg); }
  .pillar .scarcity {
    position: absolute;
    top: 28px; right: 28px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: var(--punch-2);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    display: flex; align-items: center; gap: 6px;
  }
  .pillar.punch .scarcity { color: var(--bg); }
  .pillar .scarcity::before {
    content: ""; width: 5px; height: 5px;
    background: currentColor; border-radius: 50%;
  }

  /* ============ BRIEF SAMPLE ============ */
  .sample-section { padding: 80px 0; }
  .sample-h {
    display: flex; align-items: end; justify-content: space-between;
    margin-bottom: 32px;
    padding-bottom: 24px;
    border-bottom: 1px solid var(--line);
  }
  .sample-h h2 {
    font-size: 40px;
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1;
  }
  .sample-h h2 em { font-style: italic; font-weight: 400; color: var(--paper-2); }
  .sample-h .meta {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    color: var(--paper-3);
    letter-spacing: 0.1em;
  }

  .briefs {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
  .brief-card {
    background: var(--bg-2);
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    padding: 24px;
    display: flex; flex-direction: column;
    min-height: 240px;
    cursor: pointer;
    transition: border-color .2s, transform .2s;
  }
  .brief-card:hover {
    border-color: var(--punch);
    transform: translateY(-2px);
  }
  .brief-card .row {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 16px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: var(--paper-3);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .brief-card .row .id { color: var(--paper-2); }
  .brief-card .row .type {
    padding: 3px 9px;
    border: 1px solid var(--line);
    border-radius: 999px;
  }
  .brief-card h4 {
    font-size: 19px;
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.2;
    margin-bottom: 10px;
  }
  .brief-card p {
    font-size: 13px;
    color: var(--paper-2);
    line-height: 1.5;
    margin-bottom: auto;
  }
  .brief-card .foot {
    display: flex; align-items: center; justify-content: space-between;
    padding-top: 20px;
    margin-top: 20px;
    border-top: 1px solid var(--line-soft);
  }
  .brief-card .pay {
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--punch);
  }
  .brief-card .pay .u {
    font-size: 11px;
    color: var(--paper-3);
    font-weight: 500;
    margin-left: 3px;
    font-family: 'JetBrains Mono', monospace;
  }
  .brief-card .due {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: var(--paper-3);
    letter-spacing: 0.05em;
  }

  /* ============ TRUST / PROOF ============ */
  .proof-section {
    padding: 100px 0;
    border-top: 1px solid var(--line);
  }
  .proof-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 80px;
    align-items: center;
  }
  .proof-grid h2 {
    font-size: 56px;
    font-weight: 800;
    letter-spacing: -0.035em;
    line-height: 0.95;
    margin-bottom: 24px;
    max-width: 12ch;
  }
  .proof-grid h2 em { font-style: italic; font-weight: 400; color: var(--paper-2); }
  .proof-grid .body {
    font-size: 17px;
    color: var(--paper-2);
    line-height: 1.6;
    max-width: 40ch;
    margin-bottom: 32px;
  }
  .proof-list {
    list-style: none;
    border-top: 1px solid var(--line);
  }
  .proof-list li {
    display: flex; align-items: center; gap: 16px;
    padding: 18px 0;
    border-bottom: 1px solid var(--line);
    font-size: 15px;
  }
  .proof-list li .num {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: var(--punch);
    letter-spacing: 0.05em;
    flex-shrink: 0;
    width: 32px;
  }
  .proof-list li strong {
    font-weight: 700;
    color: var(--paper);
  }

  .testimonial-card {
    background: var(--bg-2);
    border: 1px solid var(--line);
    border-radius: var(--r-lg);
    padding: 36px;
    position: relative;
  }
  .testimonial-card .quote-mark {
    font-family: 'Inter Tight', sans-serif;
    font-style: italic;
    font-weight: 400;
    font-size: 80px;
    line-height: 0.7;
    color: var(--punch);
    margin-bottom: 12px;
  }
  .testimonial-card blockquote {
    font-size: 22px;
    line-height: 1.4;
    letter-spacing: -0.015em;
    margin-bottom: 28px;
  }
  .testimonial-card blockquote em { color: var(--punch); font-style: normal; }
  .testimonial-card .author {
    display: flex; align-items: center; gap: 12px;
    padding-top: 24px;
    border-top: 1px solid var(--line);
  }
  .testimonial-card .author .av {
    width: 44px; height: 44px; border-radius: 50%;
    background: linear-gradient(135deg, #C8FF3C, #5a7016);
    flex-shrink: 0;
  }
  .testimonial-card .author .name {
    font-weight: 600;
    font-size: 15px;
  }
  .testimonial-card .author .role {
    font-size: 13px;
    color: var(--paper-3);
    font-family: 'JetBrains Mono', monospace;
  }

  /* ============ CTA ============ */
  .cta-section {
    padding: 120px 0 80px;
    text-align: center;
    border-top: 1px solid var(--line);
  }
  .cta-section h2 {
    font-size: clamp(60px, 8vw, 120px);
    font-weight: 800;
    letter-spacing: -0.045em;
    line-height: 0.92;
    max-width: 14ch;
    margin: 0 auto 32px;
  }
  .cta-section h2 em { font-style: italic; font-weight: 400; color: var(--paper-2); }
  .cta-section h2 .punch { color: var(--punch); }
  .cta-section p {
    font-size: 18px;
    color: var(--paper-2);
    max-width: 44ch;
    margin: 0 auto 40px;
    line-height: 1.55;
  }
  .cta-buttons {
    display: flex; gap: 12px; justify-content: center;
  }

  /* ============ FOOTER ============ */
  footer {
    padding: 48px 0 32px;
    border-top: 1px solid var(--line);
  }
  .footer-grid {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 1fr;
    gap: 48px;
    margin-bottom: 64px;
  }
  .footer-grid h4 {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: var(--paper-3);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin-bottom: 18px;
  }
  .footer-grid ul { list-style: none; }
  .footer-grid li { margin-bottom: 10px; }
  .footer-grid a {
    color: var(--paper-2); text-decoration: none;
    font-size: 14px;
    transition: color .15s;
  }
  .footer-grid a:hover { color: var(--paper); }
  .footer-grid .brand-col h3 {
    font-size: 32px;
    font-weight: 800;
    letter-spacing: -0.04em;
    margin-bottom: 12px;
  }
  .footer-grid .brand-col p {
    font-size: 14px;
    color: var(--paper-2);
    max-width: 32ch;
    line-height: 1.5;
  }
  .footer-bottom {
    display: flex; justify-content: space-between; align-items: center;
    padding-top: 24px;
    border-top: 1px solid var(--line);
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: var(--paper-3);
    letter-spacing: 0.05em;
  }

  /* GIANT WORDMARK FOOTER FLOURISH */
  .giant-mark {
    font-family: 'Inter Tight', sans-serif;
    font-weight: 800;
    font-size: clamp(120px, 22vw, 320px);
    letter-spacing: -0.06em;
    line-height: 0.85;
    color: var(--bg-2);
    text-align: center;
    margin: 32px 0 -32px;
    overflow: hidden;
    user-select: none;
  }
  .giant-mark .punch { color: var(--punch); }

</style>
</head>
<body>

  <div class="nav-wrap">
    <div class="container">
      <nav class="nav">
        <div class="wordmark">briefly</div>
        <div class="nav-links">
          <a href="#">How it works</a>
          <a href="#">Briefs</a>
          <a href="#">For brands</a>
          <a href="#">Pricing</a>
        </div>
        <div class="nav-cta">
          <button class="btn btn-ghost">Log in</button>
          <button class="btn btn-pill">Apply →</button>
        </div>
      </nav>
    </div>
  </div>

  <!-- HERO -->
  <section class="hero">
    <div class="container">
      <div class="hero-meta">
        <span><span class="dot" style="display:inline-block; vertical-align:middle; margin-right:6px;"></span>5 BRIEFS LIVE TODAY</span>
        <span class="pill">For working creators</span>
        <span class="pill">Now in Denmark · Sweden · Norway</span>
      </div>

      <h1>
        Five briefs.<br>
        Every <em>weekday.</em><br>
        <span class="punch">Pick your work.</span>
      </h1>

      <div class="hero-row">
        <p>Briefly is a curated marketplace for vetted creators. New briefs publish daily at 09:00, paid in seven days, no bidding, no haggling, no chasing invoices.</p>
        <div class="hero-cta">
          <button class="btn btn-lg btn-ghost" style="border: 1px solid var(--line);">See today's briefs</button>
          <button class="btn btn-lg btn-punch">
            Apply to join
            <span class="arrow">→</span>
          </button>
        </div>
      </div>

      <div class="spec-strip">
        <div class="spec">
          <div class="lbl">New briefs</div>
          <div class="val">Daily<span class="u"> · 09:00</span></div>
        </div>
        <div class="spec">
          <div class="lbl">Average payout</div>
          <div class="val"><span class="punch">3 800</span><span class="u"> kr</span></div>
        </div>
        <div class="spec">
          <div class="lbl">Time to payment</div>
          <div class="val">7 days<span class="u"> on delivery</span></div>
        </div>
        <div class="spec">
          <div class="lbl">Roster</div>
          <div class="val">340<span class="u"> creators</span></div>
        </div>
      </div>
    </div>
  </section>

  <!-- MARQUEE -->
  <section class="marquee-section">
    <div class="marquee">
      <span class="marquee-item"><span class="av a1"></span>Maja H. <span class="role">Photo · CPH</span></span>
      <span class="marquee-item"><span class="av a2"></span>Tobias L. <span class="role">Video · Aarhus</span></span>
      <span class="marquee-item punch"><span class="av"></span>340 vetted creators</span>
      <span class="marquee-item"><span class="av a3"></span>Sofie K. <span class="role">Motion · Malmö</span></span>
      <span class="marquee-item"><span class="av a4"></span>Andreas Ø. <span class="role">Photo · Bergen</span></span>
      <span class="marquee-item"><span class="av a5"></span>Linnea J. <span class="role">Direction · Stockholm</span></span>
      <span class="marquee-item"><span class="av a1"></span>Karim B. <span class="role">Video · CPH</span></span>
      <span class="marquee-item"><span class="av a2"></span>Eva M. <span class="role">Copy · Oslo</span></span>
      <span class="marquee-item punch"><span class="av"></span>1 200+ briefs delivered</span>
      <span class="marquee-item"><span class="av a3"></span>Jonas P. <span class="role">Photo · Aarhus</span></span>
      <span class="marquee-item"><span class="av a4"></span>Nina F. <span class="role">Edit · CPH</span></span>
      <span class="marquee-item"><span class="av a5"></span>Mads T. <span class="role">Direction · Aarhus</span></span>
      <!-- duplicate for seamless loop -->
      <span class="marquee-item"><span class="av a1"></span>Maja H. <span class="role">Photo · CPH</span></span>
      <span class="marquee-item"><span class="av a2"></span>Tobias L. <span class="role">Video · Aarhus</span></span>
      <span class="marquee-item punch"><span class="av"></span>340 vetted creators</span>
      <span class="marquee-item"><span class="av a3"></span>Sofie K. <span class="role">Motion · Malmö</span></span>
      <span class="marquee-item"><span class="av a4"></span>Andreas Ø. <span class="role">Photo · Bergen</span></span>
      <span class="marquee-item"><span class="av a5"></span>Linnea J. <span class="role">Direction · Stockholm</span></span>
      <span class="marquee-item"><span class="av a1"></span>Karim B. <span class="role">Video · CPH</span></span>
      <span class="marquee-item"><span class="av a2"></span>Eva M. <span class="role">Copy · Oslo</span></span>
      <span class="marquee-item punch"><span class="av"></span>1 200+ briefs delivered</span>
      <span class="marquee-item"><span class="av a3"></span>Jonas P. <span class="role">Photo · Aarhus</span></span>
      <span class="marquee-item"><span class="av a4"></span>Nina F. <span class="role">Edit · CPH</span></span>
      <span class="marquee-item"><span class="av a5"></span>Mads T. <span class="role">Direction · Aarhus</span></span>
    </div>
  </section>

  <!-- HOW IT WORKS -->
  <section class="section">
    <div class="container">
      <div class="section-h">
        <div>
          <div class="label">How it works</div>
          <h2>Open the app. <em>Pick a brief.</em> Get paid.</h2>
        </div>
        <p>Briefly handles the parts creators hate. Sourcing, scoping, contracts, invoicing, chasing. You handle the part you love. The work.</p>
      </div>

      <div class="steps">
        <div class="step">
          <div class="num">01 / APPLY</div>
          <h3>Apply with your reel</h3>
          <p>We review your work and approve a tier. Most creators hear back in 48 hours.</p>
        </div>
        <div class="step">
          <div class="num">02 / BROWSE</div>
          <h3>Open today's briefs</h3>
          <p>Five new briefs every weekday at 09:00, matched to your skills and tier.</p>
        </div>
        <div class="step">
          <div class="num">03 / CLAIM</div>
          <h3>Claim what fits</h3>
          <p>One tap. The brief is yours, the brand is notified, the timer starts.</p>
        </div>
        <div class="step">
          <div class="num">04 / DELIVER</div>
          <h3>Deliver and get paid</h3>
          <p>Upload the work, we generate the invoice, payout hits your account in 7 days.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- TWO-PILLAR OFFER -->
  <section class="section" style="padding-top: 0;">
    <div class="container">
      <div class="section-h">
        <div>
          <div class="label">Two ways in</div>
          <h2>For creators. <em>For brands.</em></h2>
        </div>
        <p>Briefly is a two-sided marketplace. Same platform, same standards, opposite sides of the table.</p>
      </div>

      <div class="pillars">

        <div class="pillar punch">
          <span class="scarcity">Open · 12 spots in May</span>
          <span class="pillar-tag">For creators</span>
          <h3>Steady briefs.<br>Predictable pay.</h3>
          <p>A daily feed of vetted briefs, priced fairly, paid on time. Replace the feast-and-famine cycle with a flow you can plan around.</p>
          <ul class="pillar-list">
            <li><span class="check">✓</span>5 new briefs every weekday at 09:00</li>
            <li><span class="check">✓</span>Self-billed invoices, no chasing</li>
            <li><span class="check">✓</span>Payment within 7 days of delivery</li>
            <li><span class="check">✓</span>No bidding, no race to the bottom</li>
            <li><span class="check">✓</span>Direct access to brands at your tier</li>
          </ul>
          <div class="pillar-foot">
            <div class="terms">
              <strong>0 kr</strong>
              free to apply · 8% platform fee
            </div>
            <button class="btn btn-pill">Apply →</button>
          </div>
        </div>

        <div class="pillar">
          <span class="scarcity">Onboarding 8 brands in May</span>
          <span class="pillar-tag">For brands</span>
          <h3>Post a brief.<br>Get the work.</h3>
          <p>Skip the agency markup and the freelancer roulette. Post a brief, our top-tier creators claim it, you receive deliverables in days, not weeks.</p>
          <ul class="pillar-list">
            <li><span class="check">✓</span>Vetted creators across photo, video, motion, copy</li>
            <li><span class="check">✓</span>Average delivery: 5 days from post</li>
            <li><span class="check">✓</span>Single platform invoice, no contractor admin</li>
            <li><span class="check">✓</span>Direct chat with the creator on the work</li>
            <li><span class="check">✓</span>Quality guarantee or we re-match</li>
          </ul>
          <div class="pillar-foot">
            <div class="terms">
              <strong>From 1 500 kr / brief</strong>
              all-in pricing · no retainer
            </div>
            <button class="btn btn-punch">Post a brief →</button>
          </div>
        </div>

      </div>
    </div>
  </section>

  <!-- BRIEF SAMPLE -->
  <section class="sample-section">
    <div class="container">
      <div class="sample-h">
        <h2>A taste of <em>today's feed.</em></h2>
        <span class="meta">EDITION №47 · 08 MAY · 5 LIVE</span>
      </div>

      <div class="briefs">

        <article class="brief-card">
          <div class="row">
            <span class="id">B-047</span>
            <span class="type">Video</span>
          </div>
          <h4>Bouldering gym launch — 3× short-form video</h4>
          <p>Three vertical cuts, native sound, no voiceover. Full creative trust. Aarhus.</p>
          <div class="foot">
            <span class="pay">4 200<span class="u"> kr</span></span>
            <span class="due">DUE 22 MAY</span>
          </div>
        </article>

        <article class="brief-card">
          <div class="row">
            <span class="id">B-046</span>
            <span class="type">Photo</span>
          </div>
          <h4>Coffee roaster, single-origin launch</h4>
          <p>Eight hero shots. Half-day, in-studio, props provided.</p>
          <div class="foot">
            <span class="pay">2 800<span class="u"> kr</span></span>
            <span class="due">DUE 18 MAY</span>
          </div>
        </article>

        <article class="brief-card">
          <div class="row">
            <span class="id">B-043</span>
            <span class="type">Video · Doc</span>
          </div>
          <h4>Restaurant opening — behind the scenes</h4>
          <p>One full evening of service. Two-minute edit plus raw selects.</p>
          <div class="foot">
            <span class="pay">6 800<span class="u"> kr</span></span>
            <span class="due">DUE 02 JUN</span>
          </div>
        </article>

      </div>
    </div>
  </section>

  <!-- PROOF / TESTIMONIAL -->
  <section class="proof-section">
    <div class="container">
      <div class="proof-grid">

        <div>
          <h2>Built by creators. <em>For creators.</em></h2>
          <p class="body">We made Briefly because we got tired of the parts of freelance that aren't the work. The chasing, the scoping, the gentle reminders, the unpaid 30-day terms.</p>
          <ul class="proof-list">
            <li><span class="num">01</span><span><strong>Vetted by humans.</strong> Every creator reviewed by our team. No bots, no portfolios from 2018.</span></li>
            <li><span class="num">02</span><span><strong>Curated briefs.</strong> Briefs are written and priced before they go live. No mystery scope.</span></li>
            <li><span class="num">03</span><span><strong>Self-billed invoices.</strong> Briefly issues the invoice on your behalf. You never write one.</span></li>
            <li><span class="num">04</span><span><strong>One platform fee.</strong> 8% on creator side, transparent. No hidden costs.</span></li>
          </ul>
        </div>

        <div class="testimonial-card">
          <div class="quote-mark">"</div>
          <blockquote>
            For the first time in years, I've got a calendar instead of a panic. <em>Briefly does the boring half of freelance</em> so I can spend the morning shooting and the afternoon editing.
          </blockquote>
          <div class="author">
            <div class="av"></div>
            <div>
              <div class="name">Maja Holm</div>
              <div class="role">Photographer · Copenhagen</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </section>

  <!-- CTA -->
  <section class="cta-section">
    <div class="container">
      <h2>Less <em>chasing.</em><br>More <span class="punch">making.</span></h2>
      <p>Apply once, browse the daily feed, claim what fits. Briefly handles the rest.</p>
      <div class="cta-buttons">
        <button class="btn btn-lg btn-ghost" style="border: 1px solid var(--line);">See today's briefs</button>
        <button class="btn btn-lg btn-punch">Apply to join <span class="arrow">→</span></button>
      </div>
    </div>
    <div class="giant-mark">brief<span class="punch">ly</span>.</div>
  </section>

  <!-- FOOTER -->
  <footer>
    <div class="container">
      <div class="footer-grid">
        <div class="brand-col">
          <h3>briefly</h3>
          <p>A curated marketplace for working creators. Daily briefs, fair pay, no chasing.</p>
        </div>
        <div>
          <h4>Product</h4>
          <ul>
            <li><a href="#">For creators</a></li>
            <li><a href="#">For brands</a></li>
            <li><a href="#">Pricing</a></li>
            <li><a href="#">Today's briefs</a></li>
          </ul>
        </div>
        <div>
          <h4>Company</h4>
          <ul>
            <li><a href="#">About</a></li>
            <li><a href="#">Careers</a></li>
            <li><a href="#">Press</a></li>
            <li><a href="#">Contact</a></li>
          </ul>
        </div>
        <div>
          <h4>Legal</h4>
          <ul>
            <li><a href="#">Terms</a></li>
            <li><a href="#">Privacy</a></li>
            <li><a href="#">Creator agreement</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© 2026 BRIEFLY APS · AARHUS</span>
        <span>EDITION №47 · 08.05.2026</span>
      </div>
    </div>
  </footer>

</body>
</html>