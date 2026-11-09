// PAAAWS PACK — Demo mode ("Try without a bag").
// Pretends to be a real PAAAWS PACK board over Bluetooth, so every feature can be
// used without the bag (Google Play / App Store reviewers, testers, new customers).
// Pictures sent to the pretend bag are drawn on a small "virtual bag" screen.
(function () {
  'use strict'
  var SVC = '0000fff0-0000-1000-8000-00805f9b34fb'
  var WRITE = '0000fff2-0000-1000-8000-00805f9b34fb'
  var NOTIFY = '0000fff1-0000-1000-8000-00805f9b34fb'
  var BATT_SVC = '0000180f-0000-1000-8000-00805f9b34fb'
  var BATT_CHAR = '00002a19-0000-1000-8000-00805f9b34fb'
  var W = 64, H = 64
  var demoOn = false
  var bags = []
  var bagCount = 0

  function le16(n) { return [n & 255, (n >> 8) & 255] }
  function rd16(a, i) { return a[i] | (a[i + 1] << 8) }

  // Same frame shape the app sends: AA 55 FF FF len seq C1 type cmd payload sum
  function frame(seq, type, cmd, payload) {
    var h = [].concat(le16(seq), [193, type, cmd], payload)
    var g = [170, 85, 255, 255].concat(le16(h.length + 2), h)
    var sum = 0
    for (var i = 0; i < g.length; i++) sum = (sum + g[i]) & 65535
    return new Uint8Array(g.concat(le16(sum)))
  }
  function takeFrames(buf) {
    var out = []
    for (;;) {
      var o = -1
      for (var i = 0; i + 3 < buf.length; i++) if (buf[i] === 170 && buf[i + 1] === 85 && buf[i + 2] === 255 && buf[i + 3] === 255) { o = i; break }
      if (o < 0) { if (buf.length > 3) buf.splice(0, buf.length - 3); return out }
      if (o > 0) buf.splice(0, o)
      if (buf.length < 6) return out
      var len = rd16(buf, 4)
      if (buf.length < 6 + len) return out
      var f = buf.splice(0, 6 + len)
      out.push({ seq: rd16(f, 6), type: f[9], cmd: f[10], payload: f.slice(11, f.length - 2) })
    }
  }

  // ---------- the pretend bag ----------
  function makeBag() {
    bagCount++
    var bag = {
      n: bagCount,
      slots: {}, region: { x: 0, y: 0, w: W, h: H }, uploadSlot: 0, chunks: {}, total: 0,
      shown: null, gifs: {}, brightness: 20, on: true, caption: 'Waiting for a design…', rx: []
    }
    var notifyTarget = new EventTarget()
    var notify = {
      uuid: NOTIFY, value: null,
      properties: { read: false, write: false, writeWithoutResponse: false, notify: true, indicate: false },
      startNotifications: function () { return Promise.resolve(notify) },
      stopNotifications: function () { return Promise.resolve(notify) },
      addEventListener: function (t, f) { notifyTarget.addEventListener(t, f) },
      removeEventListener: function (t, f) { notifyTarget.removeEventListener(t, f) }
    }
    function reply(seq, type, cmd, payload) {
      setTimeout(function () {
        var b = frame(seq, type, cmd, payload)
        notify.value = new DataView(b.buffer)
        notifyTarget.dispatchEvent(new Event('characteristicvaluechanged'))
      }, 12)
    }
    var write = {
      uuid: WRITE,
      properties: { read: false, write: true, writeWithoutResponse: true, notify: false, indicate: false },
      writeValueWithoutResponse: function (chunk) {
        var u8 = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk.buffer || chunk)
        for (var i = 0; i < u8.length; i++) bag.rx.push(u8[i])
        takeFrames(bag.rx).forEach(function (f) {
          try { handle(bag, f) } catch (e) { console.warn('[demo]', e) }
          if (f.cmd === 10) reply(f.seq, f.type, f.cmd, [0].concat(Array.from(new TextEncoder().encode('PAAAWS DEMO BAG,64x64,DEMO'))))
          else reply(f.seq, f.type, f.cmd, [0])
        })
        return Promise.resolve()
      }
    }
    write.writeValue = write.writeValueWithoutResponse
    write.writeValueWithResponse = write.writeValueWithoutResponse
    var battery = {
      uuid: BATT_CHAR,
      properties: { read: true, write: false, writeWithoutResponse: false, notify: false, indicate: false },
      readValue: function () { return Promise.resolve(new DataView(new Uint8Array([87]).buffer)) }
    }
    var services = [
      { uuid: SVC, getCharacteristics: function () { return Promise.resolve([notify, write]) } },
      { uuid: BATT_SVC, getCharacteristics: function () { return Promise.resolve([battery]) } }
    ]
    var devTarget = new EventTarget()
    var device = {
      id: 'paaaws-demo-bag-' + bag.n,
      name: bag.n === 1 ? 'PAAAWS DEMO BAG' : 'PAAAWS DEMO BAG ' + bag.n,
      addEventListener: function (t, f) { devTarget.addEventListener(t, f) },
      removeEventListener: function (t, f) { devTarget.removeEventListener(t, f) }
    }
    var server = {
      connected: false, device: device,
      connect: function () { server.connected = true; return Promise.resolve(server) },
      disconnect: function () {
        if (!server.connected) return
        server.connected = false
        bags = bags.filter(function (b) { return b !== bag })
        render()
        setTimeout(function () { devTarget.dispatchEvent(new Event('gattserverdisconnected')) }, 0)
      },
      getPrimaryServices: function () { return Promise.resolve(services) }
    }
    device.gatt = server
    bag.device = device
    return bag
  }

  // Read what the app sends and draw it on the virtual bag
  function handle(bag, f) {
    var p = f.payload, cmd = f.cmd
    if (cmd === 8) {
      if (p[20] === 29 && p[21] === 9) {
        bag.uploadSlot = p[2]
        bag.region = { x: rd16(p, 22), y: rd16(p, 24), w: rd16(p, 26), h: rd16(p, 28) }
        bag.chunks = {}; bag.total = 0
      } else { bag.caption = 'Text sent ✓ (animates on a real bag)'; bag.textShown = true; render() }
    } else if (cmd === 9) {
      if (p[11] === 20) { bag.total = p[14]; bag.chunks = {}; bag.uploadSlot = p[4] }
      else if (p[11] === 18) {
        var total = rd16(p, 13), idx = rd16(p, 15), len = rd16(p, 22)
        bag.total = total
        bag.chunks[idx] = p.slice(24, 24 + len)
        if (Object.keys(bag.chunks).length === total) finishUpload(bag)
      }
    } else if (cmd === 54) {
      var slot = p[2]
      if (bag.slots[slot] || bag.gifs[slot]) { bag.shown = slot; bag.textShown = false; bag.caption = 'Showing on the bag ✓' }
      render()
    } else if (cmd === 6) { bag.brightness = p[2]; render() }
    else if (cmd === 4) { bag.on = p[2] === 1; render() }
    else if (cmd !== 5 && cmd !== 53 && cmd !== 10) {
      bag.caption = 'Animation sent ✓ (plays on a real bag)'; render()
    }
  }
  function finishUpload(bag) {
    var all = []
    for (var i = 0; i < bag.total; i++) all = all.concat(bag.chunks[i] || [])
    bag.chunks = {}
    // animated GIF (pet, Media GIFs): keep the GIF itself and let the browser animate it
    if (all[0] === 71 && all[1] === 73 && all[2] === 70) {
      if (bag.gifs[bag.uploadSlot]) URL.revokeObjectURL(bag.gifs[bag.uploadSlot])
      bag.gifs[bag.uploadSlot] = URL.createObjectURL(new Blob([new Uint8Array(all)], { type: 'image/gif' }))
      delete bag.slots[bag.uploadSlot]
      bag.shown = bag.uploadSlot; bag.textShown = false; bag.caption = 'Showing on the bag ✓'; render(); return
    }
    // header: "YSTP01" w h 1 0 64 0 24 then raw RGB
    if (all[0] !== 89 || all[1] !== 83) { bag.caption = 'Sent ✓'; render(); return }
    var w = rd16(all, 6), h = rd16(all, 8), rgb = all.slice(15)
    var r = bag.region
    var img = bag.slots[bag.uploadSlot] || new Uint8ClampedArray(W * H * 4)
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var X = r.x + x, Y = r.y + y
      if (X >= W || Y >= H) continue
      var s = (y * w + x) * 3, d = (Y * W + X) * 4
      img[d] = rgb[s]; img[d + 1] = rgb[s + 1]; img[d + 2] = rgb[s + 2]; img[d + 3] = 255
    }
    if (bag.gifs[bag.uploadSlot]) { URL.revokeObjectURL(bag.gifs[bag.uploadSlot]); delete bag.gifs[bag.uploadSlot] }
    bag.slots[bag.uploadSlot] = img
    bag.shown = bag.uploadSlot
    bag.textShown = false
    bag.caption = 'Showing on the bag ✓'
    render()
  }

  // ---------- fake Bluetooth ----------
  var fakeBluetooth = {
    getAvailability: function () { return Promise.resolve(true) },
    requestDevice: function () {
      var bag = makeBag()
      bags.push(bag)
      render()
      return Promise.resolve(bag.device)
    },
    addEventListener: function () {}, removeEventListener: function () {}
  }
  function startDemo() {
    if (demoOn) return
    demoOn = true
    bagCount = 0
    Object.defineProperty(navigator, 'bluetooth', { value: fakeBluetooth, configurable: true, writable: true })
    document.body.classList.add('demo-on')
    render()
    var btn = document.querySelector('.conn-card .conn-btn')
    if (btn) btn.click()
  }
  function stopDemo() {
    bags.slice().forEach(function (b) { b.device.gatt.disconnect() })
    bags = []
    demoOn = false
    try { delete navigator.bluetooth } catch (e) {}
    document.body.classList.remove('demo-on')
    render()
  }

  // ---------- on-screen bits ----------
  var panel, banner, canvases = {}
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e }
  function render() {
    if (!document.body) return
    if (!banner) {
      banner = el('div', 'demo-banner')
      banner.appendChild(el('span', 'demo-banner-text', 'DEMO MODE · no bag needed'))
      var exit = el('button', 'demo-exit', 'Exit demo')
      exit.addEventListener('click', stopDemo)
      banner.appendChild(exit)
      document.body.appendChild(banner)
      panel = el('div', 'demo-bags')
      document.body.appendChild(panel)
    }
    banner.hidden = !demoOn
    panel.hidden = !demoOn || bags.length === 0
    if (panel.hidden) return
    // build / remove one screen per pretend bag
    Object.keys(canvases).forEach(function (k) {
      if (!bags.some(function (b) { return String(b.n) === k })) { canvases[k].wrap.remove(); delete canvases[k] }
    })
    bags.forEach(function (b) {
      var c = canvases[b.n]
      if (!c) {
        var wrap = el('div', 'demo-bag')
        var screen = el('div', 'demo-screen')
        var cv = el('canvas'); cv.width = W; cv.height = H
        screen.appendChild(cv)
        var gi = el('img', 'demo-gif'); gi.alt = ''; gi.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated;display:none'; screen.appendChild(gi)
        wrap.appendChild(el('div', 'demo-bag-name', bags.length > 1 || b.n > 1 ? 'Bag ' + b.n : 'Virtual bag'))
        wrap.appendChild(screen)
        var cap = el('div', 'demo-caption')
        wrap.appendChild(cap)
        wrap.addEventListener('click', function () { panel.classList.toggle('big') })
        panel.appendChild(wrap)
        c = canvases[b.n] = { wrap: wrap, cv: cv, cap: cap, gi: gi }
      }
      var ctx = c.cv.getContext('2d')
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H)
      if (b.on && b.shown != null && b.slots[b.shown] && !b.textShown) ctx.putImageData(new ImageData(new Uint8ClampedArray(b.slots[b.shown]), W, H), 0, 0)
      var gif = b.on && b.shown != null && !b.textShown && b.gifs[b.shown]
      if (gif) { if (c.gi.getAttribute('src') !== gif) c.gi.src = gif; c.gi.style.display = 'block'; c.gi.style.opacity = String(Math.max(0.2, b.brightness / 20)) } else { c.gi.style.display = 'none'; c.gi.removeAttribute('src') }
      c.cv.style.opacity = b.on ? String(Math.max(0.2, b.brightness / 20)) : '1'
      c.cap.textContent = b.on ? b.caption : 'Screen off'
    })
  }

  // "Try without a bag" button on the home screen connection card
  function addTryButton() {
    var card = document.querySelector('.conn-card')
    if (!card) return
    var connected = !!card.querySelector('.status-dot.on')
    var btn = card.querySelector('.demo-try')
    if (connected || demoOn) { if (btn) btn.remove(); return }
    if (btn) return
    var add = card.querySelector('.conn-add')
    if (!add || !add.parentNode) return
    btn = el('button', 'conn-add demo-try', 'Try without a bag')
    btn.type = 'button'
    btn.addEventListener('click', startDemo)
    add.parentNode.insertBefore(btn, add.nextSibling)
  }
  function boot() {
    render()
    addTryButton()
    new MutationObserver(addTryButton).observe(document.body, { childList: true, subtree: true })
    if (/[?&]demo=1\b/.test(location.search)) setTimeout(startDemo, 800)
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot)
  else boot()
  window.paaawsDemo = { start: startDemo, stop: stopDemo, isOn: function () { return demoOn } }
})()
