// PAAAWS PETS (Build 034): Tamagotchi-style pet for PAAAWS PACK. Shazalino first.
// Rules from the PAAAWS PETS V2 spec (simulated and tested). Save system: two copies + checksum.
(function () {
  'use strict'
  var ART = window.PAAAWS_PET_ART
  var SLOT = 57                       // the pet's own bag slot: the board plays slots 0-59 only; Media GIF uses 56, Program 31-54, home 0, default 17
  var MANUAL = [1, 2, 3, 4, 5, 6, 7, 8, 9]
  var EGG_MS = 60 * 1000              // egg hatches in 1 minute (Teddy, 9 Nov)
  var KEYS = ['paaaws-pets-save-a', 'paaaws-pets-save-b']
  var MIN = 60000, HOUR = 3600000, DAY = 86400000

  // ---------- rules ----------
  var DRAIN = { baby: [8, 6, 10, 4], child: [4, 3, 6, 2.5], teen: [4, 3, 6, 2], adult: [3, 2.5, 5, 2], old: [2.5, 2, 4, 1.5] }
  var POOP_H = { baby: 1, child: 4, teen: 6, adult: 8, old: 10 }
  var STAGE_NAME = { baby: 'Baby', child: 'Child', teen: 'Teen', adult: 'Adult', old: 'Old' }
  var TRICKS = [
    { id: 'board', name: 'Throw the board', icon: '🛹', state: 'trick_board', cost: 0 },
    { id: 'wave', name: 'Wave', icon: '👋', state: 'trick_wave', cost: 0 },
    { id: 'spin', name: 'Spin', icon: '🌀', state: 'trick_spin', cost: 10 }
  ]

  // ---------- save (two alternating copies, CRC32, revision lock) ----------
  function crc32(str) {
    var c, crc = 0xffffffff
    for (var i = 0; i < str.length; i++) { c = (crc ^ str.charCodeAt(i)) & 0xff; for (var k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; crc = (crc >>> 8) ^ c }
    return (crc ^ 0xffffffff) >>> 0
  }
  function readSlot(k) { try { var r = JSON.parse(localStorage.getItem(k)); if (!r || crc32(JSON.stringify(r.data)) !== r.crc) return null; return r } catch (e) { return null } }
  function load() {
    var recs = KEYS.map(readSlot).filter(Boolean).sort(function (a, b) { return b.rev - a.rev })
    return recs.length ? { rev: recs[0].rev, data: recs[0].data } : null
  }
  var REV = 0
  function save(both) {
    var cur = load(); if (cur && cur.rev !== REV) { toast('Your pet was changed in another window. Reloading.'); return reload() }
    var times = both ? 2 : 1
    for (var n = 0; n < times; n++) {
      REV++
      var rec = { v: 1, rev: REV, savedAt: Date.now(), crc: crc32(JSON.stringify(G)), data: G }
      try { localStorage.setItem(KEYS[REV % 2], JSON.stringify(rec)) } catch (e) { toast('Phone storage is full, so your pet could not be saved.') }
    }
  }
  function reload() { var c = load(); G = c ? c.data : fresh(); REV = c ? c.rev : 0; render() }
  function fresh() {
    return { pet: null, album: [], stars: 0, settings: { bedStart: 20 * 60, bedEnd: 7 * 60 + 30, schoolNap: false, holiday: false, speed: 1, display: 'LIVE' }, clock: { game: Date.now(), real: Date.now() } }
  }
  var G = fresh()

  // ---------- time (speed setting lets Teddy test a whole life quickly) ----------
  function gameNow() { var c = G.clock; return c.game + (Date.now() - c.real) * (G.settings.speed || 1) }
  function setClock() { G.clock = { game: gameNow(), real: Date.now() } }
  function tod(t) { var d = new Date(t); return d.getHours() * 60 + d.getMinutes() }
  function inRange(m, a, b) { return a <= b ? (m >= a && m < b) : (m >= a || m < b) }
  function ukDate(t) { var d = new Date(t); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate() }
  function seeded(s) { var h = crc32(s); return (h % 10000) / 10000 }

  // ---------- pet ----------
  function newPet(name, sex) {
    var t = gameNow()
    return { id: 'p' + Date.now().toString(36), name: name || 'Shazalino', sex: sex, char: 'shazalino', eggAt: t, hatchedAt: 0, t: t,
      activeMin: 0, full: 90, happy: 90, energy: 100, hyg: 100, health: 100, weight: 50, poops: 0, poopClock: 0, unclean: 0,
      sick: false, critMin: 0, starveMin: 0, fullHist: [], lightsOff: false, napUntil: 0, lastCare: t,
      cd: {}, snacks: { day: '', n: 0 }, sc: { baby: [0, 0], child: [0, 0], teen: [0, 0], adult: [0, 0], old: [0, 0] }, life: [0, 0],
      forms: {}, stage: 'egg', medGiven: false, tricks: {}, lastDay: '', weightRollDay: '', dead: null }
  }
  function stageOf(p, t) {
    if (!p.hatchedAt) return 'egg'
    if (p.activeMin < 60) return 'baby'
    var ageH = (t - p.hatchedAt) / HOUR
    return ageH < 48 ? 'child' : ageH < 120 ? 'teen' : ageH < 336 ? 'adult' : 'old'
  }
  function clamp(p) { ['full', 'happy', 'energy', 'hyg', 'health', 'weight'].forEach(function (k) { p[k] = Math.max(0, Math.min(100, p[k])) }) }
  function avg(a) { return a[1] ? a[0] / a[1] : 0 }
  function formFor(score) { return score >= 85 ? 'Best' : score >= 60 ? 'Normal' : 'Scruffy' }
  var EVENTS = []

  function step(p, t) {               // one game minute
    var s = G.settings
    if (s.holiday) return
    if (!p.hatchedAt) { if (t - p.eggAt >= EGG_MS) { p.hatchedAt = t; p.stage = 'baby'; p.lastCare = t; EVENTS.push('hatched') } return }
    var m = tod(t), day = new Date(t).getDay(), weekday = day > 0 && day < 6
    var bed = inRange(m, s.bedStart, s.bedEnd)
    if (!bed && p.lightsOff) { p.lightsOff = false; EVENTS.push('woke') }
    // abandonment: 72 hours of game time without meaningful care
    if (t - p.lastCare >= 72 * HOUR) return die(p, t, 'abandoned')
    // daily jobs at wake-up time
    var dkey = ukDate(t)
    if (dkey !== p.lastDay && m >= s.bedEnd) {
      p.lastDay = dkey
      if ((p.weight > 80 || p.weight < 20) && !p.sick && seeded(p.id + dkey) < 0.1) { p.sick = true; p.medGiven = false; EVENTS.push('sick') }
      decayTricks(p, t)
    }
    var protectedNap = s.schoolNap && weekday && inRange(m, 8 * 60 + 45, 15 * 60 + 15)
    if (protectedNap || (bed && p.lightsOff)) { p.energy = Math.min(100, p.energy + 20 / 60); return }
    var rest = 1
    var napping = t < p.napUntil
    if (bed || napping) {
      p.energy = Math.min(100, p.energy + (napping ? 0.4 : 20 / 60)); rest = bed ? 0.3 : 0.6
      if (napping && p.energy >= 100) p.napUntil = 0
    } else {
      p.activeMin++
      var st = stageOf(p, t), d = DRAIN[st] || DRAIN.adult
      p.full -= d[0] / 60; p.happy -= d[1] / 60; p.energy -= d[2] / 60; p.hyg -= d[3] / 60
      if (p.energy <= 0) { p.napUntil = t + HOUR; EVENTS.push('nap') }
      rest = p.energy > 20 ? 1 : 0.4
      p.poopClock++
      if (p.poopClock >= POOP_H[st] * 60) { p.poopClock = 0; if (p.poops < 2) { p.poops++; p.hyg -= 8; EVENTS.push('poop') } }
      p.fullHist.push(p.full); if (p.fullHist.length > 1440) p.fullHist.shift()
      if (p.activeMin % 360 === 0 && p.fullHist.length) {
        var af = p.fullHist.reduce(function (a, b) { return a + b }, 0) / p.fullHist.length
        if (af > 85) p.weight++; else if (af < 40) p.weight--; else if (p.weight > 50) p.weight--; else if (p.weight < 50) p.weight++
      }
      if (!p.sick && p.health < 100) p.health = Math.min(100, p.health + 10 / 60)
    }
    clamp(p)
    if (p.poops) p.unclean++
    if (!p.sick && p.unclean >= 180 && p.hyg < 30) { p.sick = true; p.medGiven = false; EVENTS.push('sick') }
    if (p.sick) { p.health = Math.max(0, p.health - 4 / 60); if (p.health <= 0 && ++p.critMin >= 24 * 60) return die(p, t, 'sickness') }
    p.starveMin = p.full <= 0 ? p.starveMin + 1 : 0
    if (p.starveMin >= 24 * 60) return die(p, t, 'starvation')
    var score = 0.25 * p.full + 0.2 * p.happy + 0.2 * p.hyg + 0.2 * (p.sick ? p.health / 2 : p.health) + 10 * rest + 2.5
    var st2 = stageOf(p, t)
    p.sc[st2][0] += score; p.sc[st2][1]++; p.life[0] += score; p.life[1]++
    if (st2 !== p.stage) { p.forms[p.stage] = formFor(avg(p.sc[p.stage])); p.stage = st2; EVENTS.push('evolved') }
    if (st2 === 'old') { var lifeDays = 20 + 0.15 * avg(p.life); if ((t - p.hatchedAt) / DAY >= lifeDays) return die(p, t, 'old age') }
  }
  function advance(toT) {
    var p = G.pet; if (!p || p.dead) return
    var steps = Math.min(Math.floor((toT - p.t) / MIN), 60 * 24 * 21)
    for (var i = 0; i < steps && !p.dead; i++) { p.t += MIN; step(p, p.t) }
    if (steps >= 60 * 24 * 21) p.t = toT
  }
  function die(p, t, cause) {
    p.dead = { cause: cause, at: t }
    var days = Math.max(1, Math.round((t - (p.hatchedAt || p.eggAt)) / DAY))
    var form = p.forms.adult || p.forms.teen || p.forms.child || formFor(avg(p.life))
    var golden = cause === 'old age' && avg(p.life) >= 85
    G.album.unshift({ n: G.album.length + 1, id: p.id, name: p.name, sex: p.sex, char: 'Shazalino', days: days, form: form, golden: golden })
    EVENTS.push('died')
  }
  function finishGoodbye() { G.pet = null; save(true); go('newegg') }   // wipes tricks/stats from BOTH save copies

  // ---------- tricks ----------
  function trick(p, id) { return p.tricks[id] || (p.tricks[id] = { skill: 0, last: 0, days: [], mastered: false, peak: 0 }) }
  function decayTricks(p, t) {
    Object.keys(p.tricks).forEach(function (id) {
      var k = p.tricks[id]; if (!k.last || t - k.last < 48 * HOUR) return
      var floor = k.mastered ? 70 : 0; k.skill = Math.max(floor, k.skill - 5)
    })
  }
  function trickLabel(k) { return k.mastered ? 'Mastered' : k.skill >= 50 ? 'Knows it ' + Math.round(k.skill) + '%' : 'Learning ' + Math.round(k.skill) + '%' }

  // ---------- what the pet is showing ----------
  function showState(p, t) {
    if (!p) return 'idle'
    if (p.dead) return 'grave'
    if (!p.hatchedAt) return 'egg'
    var s = G.settings, m = tod(t), day = new Date(t).getDay()
    if (p.sick && p.health <= 10) return 'critical'
    if (p.lightsOff || t < p.napUntil || (s.schoolNap && day > 0 && day < 6 && inRange(m, 525, 915))) return 'sleep'
    if (p.sick) return 'sick'
    if (p.poops) return 'poop'
    if (p.full <= 25) return 'hungry'
    if (p.energy <= 15) return 'tired'
    if (p.hyg <= 20) return 'dirty'
    if (p.happy <= 20) return 'sad'
    return 'idle'
  }
  var SAY = { idle: '', sleep: 'Zzz…', hungry: "My tummy's rumbling!", poop: 'Oops! Can you clean up after me?', dirty: "I'm a bit smelly!", tired: "I'm so sleepy…", sad: "I'm feeling lonely. Wanna play?", sick: "I don't feel very well…", critical: 'I need help! Please give me medicine.', egg: '', grave: '' }

  // ---------- art ----------
  var SHEETS = {}, ready = false
  function loadArt(cb) {
    var names = Object.keys(ART.atlas), left = names.length
    names.forEach(function (n) { var im = new Image(); im.onload = function () { SHEETS[n] = im; if (!--left) { ready = true; cb() } }; im.src = ART.atlas[n] })
  }
  var CACHE = {}
  function frameCanvas(stage, state, i, transparent) {
    var key = stage + state + i + (transparent ? 't' : '')
    if (CACHE[key]) return CACHE[key]
    var sheet, row
    if (state === 'egg' || state === 'crack' || state === 'grave') { sheet = SHEETS.extra; row = ART.extraRows.indexOf(state) }
    else { sheet = SHEETS[stage === 'egg' ? 'baby' : stage] || SHEETS.adult; row = ART.states.indexOf(state); if (row < 0) row = 0 }
    var c = document.createElement('canvas'); c.width = c.height = 64
    var x = c.getContext('2d'); x.drawImage(sheet, i * 64, row * 64, 64, 64, 0, 0, 64, 64)
    if (transparent) {
      var d = x.getImageData(0, 0, 64, 64); for (var j = 0; j < d.data.length; j += 4) if (d.data[j] < 6 && d.data[j + 1] < 6 && d.data[j + 2] < 6) d.data[j + 3] = 0
      x.putImageData(d, 0, 0)
    }
    return (CACHE[key] = c)
  }

  // ---------- bag ----------
  var lastSent = '', sending = false, again = false, bagMsg = ''
  function bagState(p, t) {
    var mode = G.settings.display
    if (mode === 'SLEEP') return p && !p.hatchedAt ? 'egg' : 'sleep'
    var st = showState(p, t)
    return mode === 'ROAM' && st === 'idle' ? 'roam' : st
  }
  // MEOW bubble in a tiny pixel font (fits the 64x64 bag screen)
  var FONT = { M: ['10001', '11011', '10101', '10001', '10001'], E: ['111', '100', '110', '100', '111'], O: ['111', '101', '101', '101', '111'], W: ['10001', '10001', '10101', '11011', '10001'] }
  function spriteBox(stage) {
    var d = frameCanvas(stage, 'idle', 0, true).getContext('2d').getImageData(0, 0, 64, 64).data, minX = 64, minY = 64, maxX = 0, maxY = 0
    for (var y = 0; y < 64; y++) for (var x = 0; x < 64; x++) if (d[(y * 64 + x) * 4 + 3]) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y) }
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY }
  }
  function drawMeow(x, bx, by) {
    var word = 'MEOW', w = 1; for (var i = 0; i < 4; i++) w += FONT[word[i]][0].length + 1
    var bw = w + 2, bh = 9; bx = Math.max(0, Math.min(64 - bw, bx)); by = Math.max(0, by)
    x.fillStyle = '#f2f2f8'; x.fillRect(bx + 1, by, bw - 2, bh); x.fillRect(bx, by + 1, bw, bh - 2)
    x.fillRect(bx + 3, by + bh, 2, 1); x.fillRect(bx + 2, by + bh + 1, 1, 1)        // little tail pointing at her
    x.fillStyle = '#20202a'; var cx = bx + 2
    for (var k = 0; k < 4; k++) { var g = FONT[word[k]]; for (var r = 0; r < 5; r++) for (var c = 0; c < g[r].length; c++) if (g[r][c] === '1') x.fillRect(cx + c, by + 2 + r, 1, 1); cx += g[0].length + 1 }
  }
  function meowFrames(stage) {                       // sits, blinks, then a MEOW pops out and floats up
    var b = spriteBox(stage), out = [], seq = [0, 1, 2, 1, 0, 3, 0, 1, 0, 1]
    for (var f = 0; f < seq.length; f++) {
      var c = document.createElement('canvas'); c.width = c.height = 64; var x = c.getContext('2d')
      x.drawImage(frameCanvas(stage, 'idle', seq[f], false), 0, 0)
      if (f >= 6) drawMeow(x, b.maxX - 6, b.minY - 12 - (f - 6))
      out.push(c.toDataURL('image/png'))
    }
    return out
  }
  function meowDelays() { return [300, 300, 300, 300, 300, 300, 260, 260, 260, 400] }
  // ROAM: she walks along the floor, jumps up the right wall, walks back, jumps the left wall (loop)
  function roamFrames(stage) {
    var src = frameCanvas(stage, 'idle', 0, true), x0 = src.getContext('2d').getImageData(0, 0, 64, 64).data
    var minX = 64, minY = 64, maxX = 0, maxY = 0
    for (var y = 0; y < 64; y++) for (var x = 0; x < 64; x++) if (x0[(y * 64 + x) * 4 + 3]) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y) }
    var w = maxX - minX + 1, h = maxY - minY + 1, k = Math.min(1, 28 / h, 30 / w), dw = Math.max(8, Math.round(w * k)), dh = Math.max(8, Math.round(h * k))
    var L = 2, R = 62 - dw, FLOOR = 62 - dh, TOP = 6, out = [], N = 28
    for (var f = 0; f < N; f++) {
      var px, py, flip = false, blink = 0
      if (f < 10) { px = L + (R - L) * f / 10; py = FLOOR - (f % 2 ? 2 : 0) }                                      // walk right
      else if (f < 14) { var j = (f - 10) / 3; px = R; py = FLOOR - Math.round(Math.sin(j * Math.PI) * (FLOOR - TOP)) }   // jump up the right wall
      else if (f < 24) { px = R - (R - L) * (f - 14) / 10; py = FLOOR - (f % 2 ? 2 : 0); flip = true }              // walk left
      else { var j2 = (f - 24) / 3; px = L; py = FLOOR - Math.round(Math.sin(j2 * Math.PI) * (FLOOR - TOP)); flip = true } // jump the left wall
      var c = document.createElement('canvas'); c.width = c.height = 64; var x = c.getContext('2d')
      x.fillStyle = '#000'; x.fillRect(0, 0, 64, 64); x.imageSmoothingEnabled = false
      var fr = frameCanvas(stage, 'idle', f === 6 || f === 20 ? 2 : 0, true)
      x.save(); if (flip) { x.translate(64, 0); x.scale(-1, 1); px = 64 - px - dw }
      x.drawImage(fr, minX, minY, w, h, Math.round(px), Math.round(py), dw, dh); x.restore()
      out.push(c.toDataURL('image/png'))
    }
    return out
  }
  function syncBag(force, override) {
    var B = window.paaawsBag; if (!B || !isOpen || G.settings.display === 'OFF' || !G.pet) return
    var list = B.list() || []; if (!list.length) { bagMsg = 'Bag not connected'; return }
    var t = gameNow(), p = G.pet, stage = p.stage === 'egg' ? 'baby' : p.stage
    var state = override || bagState(p, t), key = stage + ':' + state
    if (key === lastSent && !force) return
    if (sending) { again = true; return }
    sending = true; bagMsg = 'Sending to bag…'; paintBag()
    var frames, delays
    if (state === 'roam') { var m = meowFrames(stage), r = roamFrames(stage); frames = m.concat(r); delays = meowDelays().concat(r.map(function () { return 120 })) }
    else if (state === 'idle') { frames = meowFrames(stage); delays = meowDelays() }
    else { frames = [0, 1, 2, 3].map(function (i) { return frameCanvas(stage, state, i, false).toDataURL('image/png') }); delays = [250, 250, 250, 250] }
    B.gifFromPngs(frames, delays).then(function (bytes) {
      return list.reduce(function (pr, bag) { return pr.then(function () { return B.sendGif(bag, bytes, SLOT) }) }, Promise.resolve())
    }).then(function () { lastSent = key; bagMsg = 'On your bag ✓' }).catch(function (e) { bagMsg = 'Bag: ' + (e && e.message || 'send failed') })
      .then(function () { sending = false; paintBag(); if (again) { again = false; syncBag(true) } })
  }

  // ---------- UI ----------
  var CSS = '#pp{position:fixed;inset:0;z-index:9999;background:#050506;color:#fff;font-family:inherit;display:flex;flex-direction:column;overflow:hidden}' +
    '#pp *{box-sizing:border-box}#pp .top{display:flex;align-items:center;gap:8px;padding:14px 16px 6px}#pp .ttl{font-weight:800;color:#ffc72c;font-size:20px;flex:1}' +
    '#pp .x{background:#15151b;border:1px solid #333;color:#fff;border-radius:12px;min-width:48px;height:44px;font-size:18px}' +
    '#pp .sub{font-size:12px;color:#aaa;padding:0 16px}#pp .room{position:relative;margin:10px 16px;flex:1;min-height:200px;border-radius:18px;background:linear-gradient(#2b2243,#18142a);display:flex;align-items:flex-end;justify-content:center}' +
    '#pp .room.night{background:linear-gradient(#0b0d24,#06060f)}#pp canvas.pet{width:220px;height:220px;image-rendering:pixelated;margin-bottom:6px;touch-action:none;cursor:grab}' +
    '#pp .bub{position:absolute;top:12px;left:12px;right:12px;text-align:center}#pp .bub span{background:#fff;color:#111;border-radius:14px;padding:7px 12px;font-weight:700;font-size:13px;display:inline-block}' +
    '#pp .meters{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:0 16px}#pp .m{background:#15151b;border-radius:10px;padding:6px;text-align:center;font-size:11px}' +
    '#pp .bar{height:7px;border-radius:4px;background:#333;margin-top:4px;overflow:hidden}#pp .bar i{display:block;height:100%;background:#ffc72c}#pp .bar i.low{background:#ff4d4d}' +
    '#pp .acts{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:10px 16px 16px}#pp .a{background:#ffc72c;color:#111;border:0;border-radius:14px;height:64px;font-weight:800;font-size:22px;display:flex;flex-direction:column;align-items:center;justify-content:center}' +
    '#pp .a span{font-size:12px}#pp .a.night{background:#1c2350;color:#ffc72c;border:1.5px solid #ffc72c}#pp .a:disabled{opacity:.4}' +
    '#pp .btn{display:block;width:calc(100% - 32px);margin:8px 16px;background:#ffc72c;color:#111;border:0;border-radius:14px;padding:15px;font-weight:800;font-size:16px}' +
    '#pp .btn.ghost{background:transparent;color:#ffc72c;border:1.5px solid #ffc72c}#pp .mid{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:0 20px;text-align:center}' +
    '#pp .big{font-size:24px;font-weight:800;color:#ffc72c}#pp .txt{font-size:14px;color:#ddd;line-height:1.45}' +
    '#pp .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;width:100%}#pp .card{background:#121216;border:1.5px solid #333;border-radius:16px;padding:12px;text-align:center;font-weight:700;color:#fff}' +
    '#pp .card.on{border-color:#ffc72c;color:#ffc72c;box-shadow:0 0 14px #ffc72c66}#pp .card.off{opacity:.45}#pp input.f{width:100%;background:#15151b;border:1.5px solid #ffc72c;border-radius:12px;padding:13px;color:#fff;font-size:17px;font-weight:700}' +
    '#pp .row{display:flex;justify-content:space-between;align-items:center;background:#121216;border-radius:12px;padding:12px 14px;margin:6px 16px;font-size:14px;gap:10px}' +
    '#pp .row select,#pp .row input{background:#222;color:#fff;border:1px solid #444;border-radius:8px;padding:8px;font-size:14px}' +
    '#pp .pill{font-size:11px;padding:4px 9px;border-radius:9px;background:#333;color:#ccc;white-space:nowrap}#pp .pill.g{background:#ffc72c;color:#111}' +
    '#pp .sheet{position:absolute;left:0;right:0;bottom:0;background:#101014;border-top:2px solid #ffc72c;border-radius:20px 20px 0 0;padding:10px 0 16px;z-index:2}' +
    '#pp .shade{position:absolute;inset:0;background:#0009;z-index:1}#pp .bagbtn{background:#15151b;border:1.5px solid #ffc72c;color:#ffc72c;border-radius:12px;height:44px;padding:0 12px;font-weight:800;font-size:13px}' +
    '#pp .bagmsg{font-size:11px;color:#aaa;text-align:center;min-height:14px}#pp .toast{position:absolute;left:16px;right:16px;bottom:96px;background:#ffc72c;color:#111;border-radius:12px;padding:12px;font-weight:700;text-align:center;z-index:5}' +
    '#pp .scroll{flex:1;overflow:auto;padding-bottom:16px}#pp .alb{display:flex;gap:12px;align-items:center;margin:8px 16px;padding:12px;border-radius:14px;background:linear-gradient(135deg,#2a1e03,#121216);border:1.5px solid #ffc72c}' +
    '#pp .sheet{top:auto!important;inset:auto 0 0 0;display:block!important;align-items:initial}#pp .btn{height:auto!important;min-height:52px;flex:none!important;display:flex!important;align-items:center;justify-content:center;text-align:center;white-space:normal;font-size:16px!important;box-shadow:none;gap:6px}#pp .btn span{font-size:inherit}#pp .toast{border:0!important;box-shadow:0 8px 24px #0009}#pp .card{display:block!important;gap:0}#pp .row{flex-direction:row!important}#pp .bar{height:7px!important}' +
    '#pp .gear{font-size:18px}#pp .sect{color:#ffc72c;font-weight:800;font-size:13px;letter-spacing:.06em;text-transform:uppercase;margin:14px 2px 4px}#pp .manual{flex:1;display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:12px;padding:6px 14px;align-items:flex-start}#pp .manual img{flex:0 0 100%;max-width:100%;max-height:calc(100vh - 140px);object-fit:contain;scroll-snap-align:center;border-radius:14px;background:#111}#pp .mdots{text-align:center;color:#aaa;font-size:12px;padding:6px 0 14px}' +
    'body.pp-open .demo-bags{z-index:10000;top:104px;bottom:auto;right:26px}body.pp-backon #root{padding-top:48px}.pp-back{position:fixed;top:6px;right:12px;z-index:9000;display:flex;align-items:center;gap:6px;height:40px;padding:0 14px;border-radius:20px;border:1.5px solid #ffc72c;background:#14100a;color:#ffc72c;font-weight:800;font-size:14px;box-shadow:0 4px 16px #000c}' +
    '.pets-tile{display:flex;align-items:center;gap:12px;width:100%;margin:10px 0 4px;padding:14px 16px;border-radius:16px;border:2px solid #ffc72c;background:linear-gradient(90deg,#2a1e03,#120d02);color:#fff;text-align:left;box-shadow:0 0 18px #ffc72c55}' +
    '.pets-tile .pets-tile-icon{font-size:30px}.pets-tile strong{color:#ffc72c;font-size:18px;display:block}.pets-tile small{color:#ddd;font-size:12px}'
  var root = null, isOpen = false, screen = 'home', sheet = null, onb = { sex: 'girl', name: 'Shazalino' }, anim = null, frameI = 0, temp = null, toastT = null
  function el(h) { var d = document.createElement('div'); d.innerHTML = h; return d.firstChild }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] }) }
  function he(p) { return p && p.sex === 'boy' ? 'he' : 'she' }
  function her(p) { return p && p.sex === 'boy' ? 'him' : 'her' }
  function toast(msg) {
    if (!root) return; var t = root.querySelector('.toast'); if (t) t.remove()
    root.appendChild(el('<div class="toast">' + esc(msg) + '</div>')); clearTimeout(toastT); toastT = setTimeout(function () { var t = root && root.querySelector('.toast'); t && t.remove() }, 2600)
  }
  function go(s) { screen = s; sheet = null; temp = null; render() }

  function open() {
    if (!root) {
      root = el('<div id="pp"></div>'); root.addEventListener('click', onClick); root.addEventListener('input', onInput); root.addEventListener('change', onInput)
      root.addEventListener('pointermove', onRub); root.addEventListener('touchmove', onRub, { passive: true }); root.addEventListener('pointerup', endRub); root.addEventListener('touchend', endRub); root.addEventListener('pointerleave', endRub)
    }
    if (root.parentNode !== document.body) document.body.appendChild(root)
    isOpen = true; root.style.display = 'flex'; document.body.classList.add('pp-open')
    reload(); tick(); screen = G.pet ? (G.pet.dead ? 'goodbye' : 'home') : 'welcome'; render()
    clearInterval(anim); anim = setInterval(function () { frameI = (frameI + 1) % 4; tick(); maybeMeow(); paintPet() }, 250)
    syncBag(true)
  }
  function close() { isOpen = false; document.body.classList.remove('pp-open'); clearInterval(anim); setClock(); save(); if (root) root.style.display = 'none' }

  var lastSave = 0, lastShow = '', lastNight = ''
  function tick() {
    if (!G.pet) return
    var before = G.pet.dead
    advance(gameNow())
    if (EVENTS.length) {
      var ev = EVENTS.splice(0)
      if (ev.indexOf('hatched') >= 0) { temp = null; toast('Welcome, ' + G.pet.name + '! 🎉'); render() }
      if (ev.indexOf('evolved') >= 0) { toast(G.pet.name + ' has grown into a ' + STAGE_NAME[G.pet.stage] + '! ✨'); render() }
      if (ev.indexOf('died') >= 0 && !before) { save(); go('goodbye'); return }
    }
    var s = showState(G.pet, gameNow())
    var nt = inRange(tod(gameNow()), G.settings.bedStart, G.settings.bedEnd) + ':' + G.pet.lightsOff + ':' + G.pet.stage
    if (s !== lastShow || nt !== lastNight) { lastShow = s; lastNight = nt; if (screen === 'home' && !sheet) render(); syncBag(false) }
    if (Date.now() - lastSave > 5000) { lastSave = Date.now(); setClock(); save() }
    if (screen === 'home') paintMeters()
  }

  function petCanvas() { return '<canvas class="pet" width="64" height="64"></canvas>' }
  function paintPet() {
    if (!root || !isOpen) return
    var c = root.querySelector('canvas.pet'); if (!c || !ready) return
    var p = G.pet, t = gameNow(), stage = p && p.stage !== 'egg' ? p.stage : 'baby'
    var state = c.dataset.state || (temp && temp.until > Date.now() ? temp.state : (p ? showState(p, t) : 'egg'))
    if (state === 'egg' && p && !p.hatchedAt && EGG_MS - (t - p.eggAt) < 15000) state = 'crack'
    var x = c.getContext('2d'); x.clearRect(0, 0, 64, 64); x.drawImage(frameCanvas(stage, state, frameI, true), 0, 0)
    var cd = root.querySelector('[data-countdown]')
    if (cd && p && !p.hatchedAt) cd.textContent = 'Hatching in ' + Math.max(0, Math.ceil((EGG_MS - (t - p.eggAt)) / 1000)) + 's'
  }
  // Rub her: stroke the pet on screen -> purr + meow bubble (small happiness boost, not farmable)
  var rubDist = 0, rubLast = null
  function onRub(e) {
    var c = e.target.closest && e.target.closest('canvas.pet'); if (!c || screen !== 'home') return
    var p = G.pet; if (!p || p.dead || !p.hatchedAt || p.lightsOff) return
    var pt = e.touches ? e.touches[0] : e; if (!pt) return
    if (rubLast) rubDist += Math.abs(pt.clientX - rubLast.x) + Math.abs(pt.clientY - rubLast.y)
    rubLast = { x: pt.clientX, y: pt.clientY }
    if (rubDist > 140) {
      rubDist = 0
      p.happy += 5; clamp(p); save()
      show('happy', ['Meow! 💕', 'Purrrr… 😻', 'Mrrrow! ❤️'][Math.floor(Math.random() * 3)], 1800)
    }
  }
  function endRub() { rubLast = null }
  // When she's awake and fine she meows on her own now and then
  var nextMeow = Date.now() + 8000
  function maybeMeow() {
    var p = G.pet; if (!p || p.dead || !p.hatchedAt || screen !== 'home' || sheet || (temp && temp.until > Date.now())) return
    if (Date.now() < nextMeow) return
    nextMeow = Date.now() + 12000 + Math.random() * 18000
    if (showState(p, gameNow()) === 'idle') show('idle', ['Meow!', 'Mew? 🐾', 'Meow meow!'][Math.floor(Math.random() * 3)], 1600)
  }
  function paintMeters() {
    var p = G.pet; if (!p || !root) return
    ;[['full', p.full], ['happy', p.happy], ['energy', p.energy], ['hyg', p.hyg]].forEach(function (a) {
      var i = root.querySelector('[data-bar="' + a[0] + '"]'); if (i) { i.style.width = Math.round(a[1]) + '%'; i.className = a[1] <= 25 ? 'low' : '' }
    })
  }
  function paintBag() { var m = root && root.querySelector('.bagmsg'); if (m) m.textContent = bagMsg }

  function header(title, back) {
    return '<div class="top">' + (back ? '<button class="x" data-go="' + back + '">‹</button>' : '') + '<div class="ttl">' + title + '</div>' +
      (G.pet && !G.pet.dead && (screen === 'home') ? '<button class="bagbtn" data-act="bagsheet">🎒 ' + G.settings.display + '</button><button class="x gear" data-go="settings" aria-label="Pet settings">⚙️</button>' : '') +
      '<button class="x" data-act="close">✕</button></div>'
  }
  function render() {
    if (!root || !isOpen) return
    var p = G.pet, t = gameNow(), h = ''
    if (screen === 'welcome') h = header('PAAAWS PETS') + '<div class="mid">' + petCanvas().replace('class="pet"', 'class="pet" data-state="egg"') +
      '<div class="big">PAAAWS PETS</div><div class="txt">Hatch your own pet, look after it, teach it tricks and show it off on your bag.</div></div><button class="btn" data-go="choose">Get started</button>'
    else if (screen === 'choose') h = header('Choose your egg', 'welcome') + '<div class="mid"><div class="grid2">' +
      '<div class="card on" data-go="sexname">🥚<br>Shazalino</div><div class="card off">🥚<br>Pup<br><small>Coming soon</small></div><div class="card off">🥚<br>Drako<br><small>Coming soon</small></div><div class="card off">🥚<br>Pawbo<br><small>Coming soon</small></div>' +
      '</div></div><button class="btn" data-go="sexname">Choose Shazalino</button>'
    else if (screen === 'sexname') h = header('Your pet', 'choose') + '<div class="mid"><div class="big">Boy or girl?</div><div class="grid2">' +
      '<div class="card' + (onb.sex === 'boy' ? ' on' : '') + '" data-sex="boy">♂ Boy</div><div class="card' + (onb.sex === 'girl' ? ' on' : '') + '" data-sex="girl">♀ Girl</div></div>' +
      '<div class="big">Name your pet</div><input class="f" maxlength="14" data-in="name" value="' + esc(onb.name) + '"><div class="txt" style="font-size:12px;color:#999">Leave it as Shazalino, or type your own.</div></div>' +
      '<button class="btn" data-act="hatch">That\'s my pet!</button>'
    else if (screen === 'home' && p) {
      var stt = temp && temp.until > Date.now() ? temp.state : showState(p, t)
      var night = inRange(tod(t), G.settings.bedStart, G.settings.bedEnd)
      var say = temp && temp.until > Date.now() ? temp.say : (p.hatchedAt ? SAY[stt] : 'Hatching soon…')
      var sub = !p.hatchedAt ? 'EGG' : 'SHAZALINO · ' + (p.sex === 'boy' ? 'BOY' : 'GIRL') + ' · ' + STAGE_NAME[p.stage].toUpperCase() + ' · DAY ' + (Math.floor((t - p.hatchedAt) / DAY) + 1) + (G.settings.holiday ? ' · ⏸ PAUSED' : '') + (G.settings.speed > 1 ? ' · TEST ×' + G.settings.speed : '')
      h = header('🐾 ' + esc(p.name)) + '<div class="sub">' + sub + '</div><div class="room' + (night || p.lightsOff ? ' night' : '') + '">' +
        (say ? '<div class="bub"><span>' + esc(say) + '</span></div>' : '') + petCanvas() + '</div>' +
        (p.hatchedAt ? '' : '<div class="txt" style="text-align:center" data-countdown></div>') +
        '<div class="meters">' + [['full', '🍽️ Food'], ['happy', '😊 Happy'], ['energy', '⚡ Energy'], ['hyg', '🫧 Clean']].map(function (a) { return '<div class="m">' + a[1] + '<div class="bar"><i data-bar="' + a[0] + '"></i></div></div>' }).join('') + '</div>' +
        '<div class="bagmsg">' + esc(bagMsg) + '</div>' +
        '<div class="acts">' +
        '<button class="a" data-act="feedsheet"' + (p.hatchedAt ? '' : ' disabled') + '>🍽️<span>' + (night ? 'Snack' : 'Feed') + '</span></button>' +
        (night || p.lightsOff ? '<button class="a night" data-act="' + (p.lightsOff ? 'wake' : 'bed') + '"' + (p.hatchedAt ? '' : ' disabled') + '>' + (p.lightsOff ? '☀️<span>Wake</span>' : '🌙<span>Bedtime</span>') + '</button>'
          : '<button class="a" data-act="play"' + (p.hatchedAt ? '' : ' disabled') + '>🎮<span>Play</span></button>') +
        '<button class="a" data-act="clean"' + (p.hatchedAt ? '' : ' disabled') + '>🧼<span>Clean</span></button>' +
        '<button class="a" data-act="caresheet">💊<span>Care</span></button></div>'
    }
    else if (screen === 'teach' && p) {
      h = header('🎓 Teach a trick', 'home') + '<div class="sub">⭐ Trick Stars: <b style="color:#ffc72c">' + G.stars + '</b></div><div class="room" style="flex:0 0 230px">' +
        (temp && temp.until > Date.now() ? '<div class="bub"><span>' + esc(temp.say) + '</span></div>' : '') + petCanvas() + '</div><div class="scroll">' +
        TRICKS.map(function (tr) {
          var k = p.tricks[tr.id], locked = !k && G.stars < tr.cost
          return '<div class="row"' + (locked ? ' style="opacity:.45"' : '') + '><span>' + tr.icon + ' ' + tr.name + '</span>' +
            (locked ? '<span class="pill">🔒 ' + tr.cost + ' ⭐</span>' : '<span class="pill' + (k && k.skill >= 50 ? ' g' : '') + '">' + (k ? trickLabel(k) : 'New') + '</span>' +
              '<button class="bagbtn" data-teach="' + tr.id + '">Teach</button>' + (k && k.skill >= 50 ? '<button class="bagbtn" data-show="' + tr.id + '">Show</button>' : '')) + '</div>'
        }).join('') + '<div class="txt" style="padding:8px 16px;font-size:12px;color:#999">Tricks get rusty if you don\'t practise for 2 days. Mastered tricks never drop below 70%.</div></div>'
    }
    else if (screen === 'album') h = header('📖 Memory Album', p ? 'home' : 'newegg') + '<div class="scroll">' + (G.album.length ? G.album.map(function (a) {
      return '<div class="alb"><div style="font-size:34px">🐱</div><div class="txt"><b style="color:#ffc72c">#' + a.n + ' ' + esc(a.name) + '</b><br>' + a.char + ' · ' + (a.sex === 'boy' ? 'Boy' : 'Girl') + '<br>' + a.days + ' day' + (a.days === 1 ? '' : 's') + ' · ' + a.form + (a.golden ? '<br>🏅 Golden Paw' : '') + '</div></div>'
    }).join('') : '<div class="mid"><div class="txt">No memories yet.</div></div>') + '<div class="txt" style="padding:8px 16px;font-size:12px;color:#999">Only the card is kept. Tricks and stats are cleared.</div></div>'
    else if (screen === 'settings') {
      var s = G.settings
      function hm(v) { return String(Math.floor(v / 60)).padStart(2, '0') + ':' + String(v % 60).padStart(2, '0') }
      h = header('⚙️ Pet settings', 'home') + '<div class="scroll">' +
        '<button class="btn" data-go="manual">📖 How to play</button><div class="sect">Grown-up settings</div>' +
        '<div class="row">🌙 Bedtime<input type="time" data-in="bedStart" value="' + hm(s.bedStart) + '"></div>' +
        '<div class="row">☀️ Wake-up<input type="time" data-in="bedEnd" value="' + hm(s.bedEnd) + '"></div>' +
        '<div class="row">🏫 School nap (weekdays 8:45–3:15)<input type="checkbox" data-in="schoolNap"' + (s.schoolNap ? ' checked' : '') + '></div>' +
        '<div class="row">⏸ Holiday pause<input type="checkbox" data-in="holiday"' + (s.holiday ? ' checked' : '') + '></div>' +
        '<div class="row">🧪 Test speed<select data-in="speed">' + [1, 60, 600].map(function (v) { return '<option value="' + v + '"' + (s.speed === v ? ' selected' : '') + '>' + (v === 1 ? 'Real time' : '×' + v + (v === 60 ? ' (1 min = 1 hr)' : ' (1 min = 10 hrs)')) + '</option>' }).join('') + '</select></div>' +
        '<button class="btn ghost" data-act="skip1">🧪 Skip ahead 1 hour</button><button class="btn ghost" data-act="skip24">🧪 Skip ahead 1 day</button>' +
        '<button class="btn ghost" data-act="backup">💾 Save backup file</button><label class="btn ghost" style="text-align:center">📂 Restore backup<input type="file" accept=".json" data-in="restore" style="display:none"></label>' +
        '<button class="btn ghost" data-act="delete" style="color:#ff6b6b;border-color:#ff6b6b">🗑 Delete pet</button></div>'
    }
    else if (screen === 'manual') {
      h = header('📖 How to play', 'settings') + '<div class="manual">' + MANUAL.map(function (n, i) {
        return '<img src="./pets-manual/page' + n + '.webp" alt="How to play, page ' + (i + 1) + '" loading="' + (i < 2 ? 'eager' : 'lazy') + '">'
      }).join('') + '</div><div class="mdots">Swipe for more · ' + MANUAL.length + ' pages</div>'
    }
    else if (screen === 'goodbye' && p) {
      var gold = p.dead && p.dead.cause === 'old age' && avg(p.life) >= 85
      h = header('PAAAWS PETS') + '<div class="mid">' + petCanvas().replace('class="pet"', 'class="pet" data-state="grave"') +
        '<div class="big">' + (gold ? 'A life well lived ⭐' : 'Goodbye, ' + esc(p.name) + ' ❤️') + '</div><div class="txt">' +
        (gold ? esc(p.name) + ' lived a long, happy life with you. You earned the Golden Paw.' : esc(p.name) + ' has died. We can\'t bring ' + her(p) + ' back, but we can remember the happy times you shared.') +
        '</div></div><button class="btn" data-act="remember">Remember ' + esc(p.name) + '</button>'
    }
    else if (screen === 'newegg') h = header('PAAAWS PETS') + '<div class="mid">' + petCanvas().replace('class="pet"', 'class="pet" data-state="egg"') +
      '<div class="big">Ready for a new friend?</div><div class="txt">Your Trick Stars are still yours.</div></div><button class="btn" data-go="choose">New egg</button><button class="btn ghost" data-go="album">My memories</button>'
    else { screen = G.pet ? 'home' : 'welcome'; return render() }
    if (sheet === 'feed') h += '<div class="shade" data-act="shut"></div><div class="sheet"><button class="btn" data-act="meal">🍽️ Meal</button><button class="btn ghost" data-act="snack">🍪 Snack</button></div>'
    if (sheet === 'play') h += '<div class="shade" data-act="shut"></div><div class="sheet"><button class="btn" data-act="arcade">🕹️ Play a game with ' + esc(p ? p.name : 'your pet') + ' (30 games)</button>' +
      '<button class="btn ghost" data-act="quickplay">🧸 Quick play</button><div class="bagmsg" style="padding:4px 16px">Every game you play gives ' + esc(p ? p.name : 'your pet') + ' a block of happiness.</div></div>'
    if (sheet === 'care') h += '<div class="shade" data-act="shut"></div><div class="sheet"><button class="btn" data-act="medicine">💊 Medicine</button><button class="btn ghost" data-act="cuddle">🤗 Cuddle</button>' +
      '<button class="btn ghost" data-go="teach">🎓 Teach tricks</button><button class="btn ghost" data-go="album">📖 Memory Album</button></div>'
    if (sheet === 'bag') h += '<div class="shade" data-act="shut"></div><div class="sheet">' + ['LIVE', 'ROAM', 'SLEEP', 'OFF'].map(function (m) {
      return '<button class="btn' + (G.settings.display === m ? '' : ' ghost') + '" data-mode="' + m + '">' + { LIVE: '▶ LIVE: shows the real state', ROAM: '🐾 ROAM: walks & jumps round the bag', SLEEP: '💤 SLEEP: always shows sleeping', OFF: '🚫 OFF: pet not sent to the bag' }[m] + '</button>'
    }).join('') + '<button class="btn ghost" data-act="sendnow">📤 Send to bag now</button></div>'
    root.innerHTML = h
    paintPet(); paintMeters()
  }

  // ---------- actions ----------
  function cooldown(p, k, mins) { var t = gameNow(); if (p.cd[k] && t - p.cd[k] < mins * MIN) return false; p.cd[k] = t; return true }
  function show(state, say, ms) { temp = { state: state, say: say, until: Date.now() + (ms || 2500) }; render(); setTimeout(function () { if (temp && temp.until <= Date.now()) { temp = null; render() } }, (ms || 2500) + 50) }
  function cared(p) { p.lastCare = gameNow() }
  function act(a) {
    var p = G.pet, t = gameNow()
    if (a === 'close') return close()
    if (a === 'shut') { sheet = null; return render() }
    if (a === 'hatch') { G.pet = newPet((onb.name || '').trim() || 'Shazalino', onb.sex); G.settings.display = G.settings.display || 'LIVE'; setClock(); save(); go('home'); syncBag(true); return }
    if (a === 'feedsheet') { sheet = 'feed'; return render() }
    if (a === 'caresheet') { sheet = 'care'; return render() }
    if (a === 'bagsheet') { sheet = 'bag'; return render() }
    if (a === 'sendnow') { sheet = null; render(); return syncBag(true) }
    if (a === 'remember') { return finishGoodbye() }
    if (a === 'skip1' || a === 'skip24') { G.clock.game += a === 'skip1' ? HOUR : DAY; tick(); toast(a === 'skip1' ? 'Skipped 1 hour' : 'Skipped 1 day'); return render() }
    if (a === 'backup') {
      var blob = new Blob([JSON.stringify({ kind: 'paaaws-pets-backup', v: 1, crc: crc32(JSON.stringify(G)), data: G })], { type: 'application/json' })
      var u = URL.createObjectURL(blob), l = document.createElement('a'); l.href = u; l.download = 'paaaws-pets-backup.json'; l.click(); setTimeout(function () { URL.revokeObjectURL(u) }, 2000); return
    }
    if (a === 'delete') { if (confirm('Delete your pet? This cannot be undone.')) { G.pet = null; save(true); go('welcome') } return }
    if (!p || p.dead) return
    sheet = null
    if (!p.hatchedAt) { render(); return toast('Wait for the egg to hatch first! 🥚') }
    if (a === 'meal') { if (!cooldown(p, 'meal', 45)) return toast(p.name + ' is still full from the last meal.'); if (p.full < 80) cared(p); p.full += 35; clamp(p); save(); return show('eat', 'Yum! 😋') }
    if (a === 'snack') {
      if (!cooldown(p, 'snack', 30)) return toast('One snack every 30 minutes.')
      var d = ukDate(t); if (p.snacks.day !== d) p.snacks = { day: d, n: 0 }; if (++p.snacks.n > 2) p.weight += 2
      p.full += 12; p.happy += 5; clamp(p); save(); return show('eat', 'Crunchy! 🍪')
    }
    if (a === 'play') { sheet = 'play'; return render() }
    if (a === 'quickplay') { if (p.happy < 60) cared(p); p.happy += 20; p.energy -= 8; p.full -= 3; clamp(p); save(); return show('happy', 'Again! Again! 🎉') }
    if (a === 'arcade') { if (p.lightsOff) return toast(p.name + ' is asleep.'); fromPet(true); close(); if (window.paaawsNav) window.paaawsNav('games'); return }
    if (a === 'cuddle') { if (!cooldown(p, 'cuddle', 30)) return toast('Lots of cuddles already! Try again soon.'); p.happy += 12; clamp(p); save(); return show('happy', 'Purrr… ❤️') }
    if (a === 'clean') {
      if (p.poops) { p.poops = 0; p.hyg += 35; p.unclean = 0; cared(p); clamp(p); save(); return show('happy', 'All clean! ✨') }
      if (!cooldown(p, 'bath', 30)) return toast('Already squeaky clean!')
      p.hyg += 60; cared(p); clamp(p); save(); return show('happy', 'Bath time! 🫧')
    }
    if (a === 'medicine') {
      if (!p.sick) return toast(p.name + ' isn\'t poorly. Medicine only works when ' + he(p) + '\'s sick.')
      if (p.medGiven) return toast(p.name + ' has already had medicine.')
      p.sick = false; p.medGiven = true; p.critMin = 0; p.unclean = 0; p.health = Math.min(100, p.health + 20); cared(p); save(); return show('happy', 'Feeling better! 💊')
    }
    if (a === 'bed' || a === 'wake') temp = null
    if (a === 'bed') {
      if (inRange(tod(t), G.settings.bedStart, G.settings.bedEnd)) { p.lightsOff = true; save(); toast('Night night, ' + p.name + ' 💤'); render(); return syncBag(false) }
      p.napUntil = t + HOUR; save(); render(); return syncBag(false)
    }
    if (a === 'wake') { p.lightsOff = false; p.napUntil = 0; p.happy += 3; clamp(p); save(); render(); return syncBag(false) }
  }
  function teach(id) {
    var p = G.pet; if (!p || p.dead) return
    var tr = TRICKS.filter(function (x) { return x.id === id })[0], t = gameNow()
    var k = p.tricks[id]; if (!k) { if (G.stars < tr.cost) return toast('You need ' + tr.cost + ' Trick Stars.'); k = trick(p, id) }
    if (p.lightsOff) return toast(p.name + ' is asleep.')
    if (p.energy < 10) return toast(p.name + ' is too tired to learn right now.')
    var rusty = k.skill < k.peak
    var ok = Math.random() < 0.35 + (k.skill / 100) * 0.6
    p.energy -= 3; p.happy += 3; k.last = t
    var d = ukDate(t); if (k.days.indexOf(d) < 0) k.days.push(d)
    if (ok) {
      k.skill = Math.min(100, k.skill + 15 * (rusty ? 1.5 : 1)); k.peak = Math.max(k.peak, k.skill); G.stars++
      if (!k.mastered && k.skill >= 100 && k.days.length >= 5) { k.mastered = true; G.stars += 5; toast(p.name + ' has MASTERED ' + tr.name + '! +5 ⭐') }
      cared(p); clamp(p); save(); show(tr.state, 'Did it! ⭐', 2600)
    } else { clamp(p); save(); show('fumble', 'Oops! 😵 (shakes ' + (p.sex === 'boy' ? 'his' : 'her') + ' head)', 2200) }
  }
  function showTrick(id) {
    var tr = TRICKS.filter(function (x) { return x.id === id })[0]
    show(tr.state, 'Showing off! ✨', 4000)
    var B = window.paaawsBag
    if (B && (B.list() || []).length) { lastSent = ''; syncBag(true, tr.state); toast('Sent ' + tr.name + ' to your bag') } else toast('Connect your bag to show it off.')
  }
  function onClick(e) {
    var b = e.target.closest('[data-act],[data-go],[data-sex],[data-teach],[data-show],[data-mode]'); if (!b) return
    if (b.dataset.go) return go(b.dataset.go)
    if (b.dataset.sex) { onb.sex = b.dataset.sex; return render() }
    if (b.dataset.teach) return teach(b.dataset.teach)
    if (b.dataset.show) return showTrick(b.dataset.show)
    if (b.dataset.mode) { G.settings.display = b.dataset.mode; save(); sheet = null; render(); lastSent = ''; return syncBag(true) }
    act(b.dataset.act)
  }
  function onInput(e) {
    var k = e.target.dataset.in; if (!k) return
    if (k === 'name') { onb.name = e.target.value; return }
    var s = G.settings
    if (k === 'bedStart' || k === 'bedEnd') { var v = e.target.value.split(':'); if (v.length === 2) s[k] = +v[0] * 60 + +v[1] }
    else if (k === 'schoolNap' || k === 'holiday') s[k] = e.target.checked
    else if (k === 'speed') { setClock(); s.speed = +e.target.value }
    else if (k === 'restore' && e.type === 'change') return restore(e.target.files[0])
    save()
  }
  function restore(file) {
    if (!file) return
    var r = new FileReader(); r.onload = function () {
      try {
        var o = JSON.parse(r.result); if (o.kind !== 'paaaws-pets-backup' || crc32(JSON.stringify(o.data)) !== o.crc) return toast('That backup file is damaged or not a PAAAWS PETS backup.')
        var data = o.data, ids = {}; G.album.concat(data.album || []).forEach(function (a) { ids[a.id] = ids[a.id] || a })
        if (G.pet && !G.pet.dead && data.pet && data.pet.id !== G.pet.id && !confirm('This will replace ' + G.pet.name + '. Continue?')) return
        data.album = Object.keys(ids).map(function (k) { return ids[k] })
        if (data.pet && ids[data.pet.id]) data.pet = null      // no bringing a dead pet back
        data.stars = Math.max(data.stars || 0, G.stars); G = data; save(true); toast('Backup restored'); go(G.pet ? 'home' : 'welcome')
      } catch (err) { toast('Could not read that file.') }
    }; r.readAsText(file)
  }

  (function () { var st = document.createElement('style'); st.id = 'pp-css'; st.textContent = CSS; (document.head || document.documentElement).appendChild(st) })()
  // Any PAAAWS Arcade game = one block of happiness (+20). No limit: it's a fun bag pet. Saved straight away.
  window.addEventListener('paaaws-game', function () {
    try {
      if (!isOpen) reload()
      var p = G.pet; if (!p || p.dead || !p.hatchedAt) return
      advance(gameNow())
      if (p.dead || p.lightsOff) return
      if (p.happy < 60) cared(p)
      p.happy += 20; p.energy -= 8; p.full -= 3; clamp(p); setClock(); save()
      var msg = p.name + ' loves playing with you! +Happy 🐾'
      if (window.paaawsToast) window.paaawsToast(msg); else toast(msg)
    } catch (e) {}
  })
  // "Back to pet": only shows in the Arcade / a game when you got there from your pet
  function fromPet(v) { try { if (v === undefined) return sessionStorage.getItem('pp-from-pet') === '1'; v ? sessionStorage.setItem('pp-from-pet', '1') : sessionStorage.removeItem('pp-from-pet') } catch (e) { return false } }
  var backBtn = null
  setInterval(function () {
    var pg = window.paaawsPage ? window.paaawsPage() : null
    if (pg === 'home' && fromPet() && !isOpen) fromPet(false)          // went home another way: forget it
    var want = !isOpen && fromPet() && pg && pg !== 'home'
    if (want && !backBtn) {
      backBtn = document.createElement('button'); backBtn.className = 'pp-back'; backBtn.textContent = '🐾 Back to pet'
      backBtn.addEventListener('click', function () { fromPet(false); if (window.paaawsNav) window.paaawsNav('home'); setTimeout(open, 60) })
      document.body.appendChild(backBtn)
    }
    if (backBtn) backBtn.style.display = want ? 'flex' : 'none'
    document.body.classList.toggle('pp-backon', !!want)
  }, 400)
  // Brightness pop-up (sun button on the home screen): tap outside the slider to close it
  document.addEventListener('click', function (e) {
    if (!document.body.classList.contains('bright-open')) return
    if (e.target.closest && (e.target.closest('.brightness') || e.target.closest('.bright-btn'))) return
    document.body.classList.remove('bright-open')
  }, true)
  loadArt(function () { if (isOpen) render() })
  window.paaawsPets = { open: open, close: close,
    _debug: { state: function () { return G }, advanceMinutes: function (n) { G.clock.game -= 0; G.clock = { game: gameNow() + n * MIN, real: Date.now() }; tick() }, show: showState } }
})()
