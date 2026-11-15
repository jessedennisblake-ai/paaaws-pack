/* Draws a 64×64-dot LED screen like the real bag, from 16×16 pixel sprites (each sprite pixel = 4×4 LEDs). */
(function () {
  const S = {
    paw: [
      "................", "....##....##....", "...####..####...", "...####..####...",
      ".##.##....##.##.", "####..........##", "####..####...###", ".##..######..##.",
      "....########....", "...##########...", "...##########...", "...##########...",
      "....########....", ".....######.....", "................", "................"],
    crown: [
      "................", "................", "..#....##....#..", "..##..####..##..",
      "..###.####.###..", "..############..", "..############..", "..############..",
      "..############..", "..##.##..##.##..", "..############..", "..############..",
      "................", "................", "................", "................"],
    heart: [
      "................", "................", "..####....####..", ".######..######.",
      "################", "################", "################", ".##############.",
      "..############..", "...##########...", "....########....", ".....######.....",
      "......####......", ".......##.......", "................", "................"],
    pad: [
      "................", "................", "................", "...##########...",
      "..############..", ".###.#####..###.", ".##...####.#.##.", ".###.#####..###.",
      ".##############.", ".######..######.", ".#####....#####.", "..###......###..",
      "................", "................", "................", "................"],
    invader: [
      "................", "...#.......#....", "....#.....#.....", "...#########....",
      "..###.###.###...", ".#############..", ".#.#########.#..", ".#.#.......#.#..",
      "....##...##.....", "................", "................", "................",
      "................", "................", "................", "................"],
    fire: [
      ".......#........", "......##........", "......###.......", ".....####..#....",
      "....#####.##....", "....#########...", "...###########..", "...####..#####..",
      "..####....#####.", "..###......####.", "..###......###..", "...###....###...",
      "....########....", "......####......", "................", "................"]
  };
  const COLORS = { gold: "#ffc94a", pink: "#ff4fb0", blue: "#3fa2ff", violet: "#b07cff", orange: "#ff7a2f", green: "#4dff9a" };

  function draw(cv, name, color, t) {
    const ctx = cv.getContext("2d");
    const n = 64, w = cv.width, cell = w / n, r = cell * 0.36;
    ctx.fillStyle = "#050407";
    ctx.fillRect(0, 0, w, w);
    const sp = S[name] || S.paw;
    // centre the sprite vertically by its bounding rows
    const rows = sp.map((l, i) => (l.includes("#") ? i : -1)).filter(i => i >= 0);
    const off = Math.round((16 - (rows[rows.length - 1] - rows[0] + 1)) / 2) - rows[0];
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const sy = Math.floor(y / 4) - off, sx = Math.floor(x / 4);
        const on = sy >= 0 && sy < 16 && sp[sy][sx] === "#";
        ctx.beginPath();
        ctx.arc(x * cell + cell / 2, y * cell + cell / 2, r, 0, Math.PI * 2);
        if (on) {
          const flick = 0.82 + 0.18 * Math.sin(t / 400 + (x + y) / 9);
          ctx.globalAlpha = flick;
          ctx.fillStyle = color;
        } else {
          ctx.globalAlpha = 1;
          ctx.fillStyle = "#16131c";
        }
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function size(cv) {
    const px = Math.max(256, Math.round(cv.clientWidth * (window.devicePixelRatio || 1)));
    if (cv.width !== px) { cv.width = px; cv.height = px; }
  }

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const screens = [...document.querySelectorAll("canvas.led")];
  const hero = document.querySelector("canvas.led[data-cycle]");
  const cycle = [["paw", "gold"], ["crown", "gold"], ["heart", "pink"], ["pad", "blue"], ["invader", "violet"], ["fire", "orange"]];
  let ci = 0, last = 0;

  function frame(t) {
    if (hero && !reduce && t - last > 2200) {
      ci = (ci + 1) % cycle.length; last = t;
      hero.dataset.sprite = cycle[ci][0]; hero.dataset.color = cycle[ci][1];
    }
    screens.forEach(cv => { size(cv); draw(cv, cv.dataset.sprite, COLORS[cv.dataset.color] || cv.dataset.color, reduce ? 0 : t); });
    if (!reduce) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  if (reduce) window.addEventListener("resize", () => requestAnimationFrame(frame));

  /* Shop + contact */
  const C = window.PAAAWS || {};
  const money = v => "£" + (Number.isInteger(v) ? v : v.toFixed(2));
  document.querySelectorAll("[data-price]").forEach(el => (el.textContent = money(C.price)));
  document.querySelectorAll("[data-delivery]").forEach(el => (el.textContent = money(C.delivery)));
  document.querySelectorAll("[data-company]").forEach(el => (el.textContent = C.company));
  document.querySelectorAll("[data-companyno]").forEach(el => (el.textContent = C.companyNo));
  document.querySelectorAll("[data-office]").forEach(el => (el.textContent = C.office));
  document.querySelectorAll("[data-ico]").forEach(el => (el.textContent = C.ico));
  document.querySelectorAll("[data-applink]").forEach(el => (el.href = C.appLink));
  const wa = text => "https://wa.me/" + C.whatsapp + "?text=" + encodeURIComponent(text);
  document.querySelectorAll("[data-wa]").forEach(el => (el.href = wa("Hi PAAAWS PACK, ")));

  document.querySelectorAll("[data-pbprice]").forEach(el => (el.textContent = money(C.powerbank)));
  document.querySelectorAll("[data-battery]").forEach(el => (el.textContent = C.battery));

  document.querySelectorAll("[data-buy]").forEach(btn => {
    const colour = btn.dataset.buy;
    const link = (C.stripe || {})[colour];
    const tick = document.querySelector(`[data-powerbank="${colour}"]`);
    const update = () => {
      if (link) { btn.href = link; return; }
      const pb = tick && tick.checked;
      const total = C.price + (pb ? C.powerbank : 0) + C.delivery;
      btn.href = wa(`Hi PAAAWS PACK, I'd like to order a ${colour} bag (${money(C.price)})` +
        (pb ? ` + PAAAWS power bank (${money(C.powerbank)})` : "") +
        ` + ${money(C.delivery)} delivery. Total ${money(total)}. My postcode is: `);
      btn.target = "_blank"; btn.rel = "noopener";
    };
    if (tick) tick.addEventListener("change", update);
    update();
  });

  const form = document.getElementById("contact-form");
  if (form) form.addEventListener("submit", e => {
    e.preventDefault();
    const f = new FormData(form);
    const msg = `Hi PAAAWS PACK, this is ${f.get("name")}.` + (f.get("order") ? ` Order: ${f.get("order")}.` : "") + `\n\n${f.get("message")}`;
    window.open(wa(msg), "_blank", "noopener");
  });

  /* How it works: side jump menu appears once the top buttons scroll away */
  const side = document.querySelector(".tutorial-side"), jump = document.querySelector(".tutorial-jump");
  if (side && jump && "IntersectionObserver" in window) {
    new IntersectionObserver(([e]) => side.classList.toggle("show", !e.isIntersecting && e.boundingClientRect.top < 0)).observe(jump);
    const links = [...side.querySelectorAll('a[href^="#"]:not(.side-top)')];
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) links.forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id));
    }), { rootMargin: "-45% 0px -50% 0px" });
    links.forEach(a => { const t = document.querySelector(a.getAttribute("href")); if (t) io.observe(t); });
  }

  const y = document.getElementById("year"); if (y) y.textContent = new Date().getFullYear();
})();

/* Xmas special discount badge (auto-injected on every page) */
(function(){
  function makeBadge(){
    try{
      if(document.querySelector('.xmas-badge'))return;
      var cur=document.querySelector('nav a[aria-current="page"]');
      var isHome=!!(cur&&/index\.html/.test(cur.getAttribute('href')||''));
      var spikes=22,pts=[];
      for(var i=0;i<spikes*2;i++){var ang=Math.PI*i/spikes-Math.PI/2;var rad=(i%2===0)?98:80;pts.push((100+rad*Math.cos(ang)).toFixed(1)+','+(100+rad*Math.sin(ang)).toFixed(1));}
      var a=document.createElement('a');
      a.className='xmas-badge'+(isHome?' home':'');
      a.href='shop.html';
      a.setAttribute('aria-label','Xmas special: 27% off, now 40 pounds plus delivery');
      a.innerHTML='<svg class="xmas-burst-svg" viewBox="0 0 200 200" aria-hidden="true"><polygon points="'+pts.join(' ')+'" fill="#c21f1f"></polygon><circle cx="100" cy="100" r="74" fill="#e2302f"></circle><circle cx="100" cy="100" r="74" fill="none" stroke="#f8c44f" stroke-width="4" stroke-dasharray="3 4"></circle></svg><span class="xmas-badge-text"><b class="xb-k">XMAS SPECIAL</b><b class="xb-pct">27%</b><b class="xb-off">OFF</b><b class="xb-price"><s>&pound;54.99</s> &pound;40</b><b class="xb-del">+ delivery</b></span>';
      document.body.appendChild(a);
    }catch(e){}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',makeBadge);else makeBadge();
})();
