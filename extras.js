// PAAAWS EXTRAS (Build 035): screen cover, board registration and links to other PAAAWS apps.
// Nothing about the customer is collected until they choose to register a board.
(function () {
  'use strict'

  // ---- Settings: edit these, nothing else needed ----
  var CFG = {
    whatsapp: '447479797985',
    stripe: {
      protection: 'https://buy.stripe.com/5kQfZjakaaXw0I71K41Jm05', // £50, 12 months, up to 4 replacements
      replacement: 'https://buy.stripe.com/bJeaEZ0JAaXwaiH74o1Jm06' // £15, one screen
    },
    price: { protection: 50, replacement: 15, powerbank: 15, protectionBoards: 4, guaranteeMonths: 6 },
    // Supabase: fill both to send registrations to the database. While empty, Register sends a WhatsApp instead.
    supabaseUrl: 'https://rdkfnozwelkewowiqjkq.supabase.co',
    supabaseKey: 'sb_publishable_LHKdeH_fXj01yU61fMCirw_Yx26ltha', // public key: can only add registrations, can't read them
    // Other PAAAWS apps. Set show: true when one is ready and it appears in Extras.
    apps: [
      { name: 'PAAAWS Pets', sub: 'Your own pocket pet', url: '', show: false },
      { name: 'PAAAWS PIPS', sub: 'Coming soon', url: '', show: false },
      { name: 'PAAAWS GLANCE', sub: 'Coming soon', url: '', show: false }
    ]
  }

  var KEY = 'paaaws-extras-boards'
  var root = null, screen = 'home', isOpen = false

  function boards() { try { return JSON.parse(localStorage.getItem(KEY) || '[]') || [] } catch (e) { return [] } }
  function saveBoards(b) { try { localStorage.setItem(KEY, JSON.stringify(b)) } catch (e) {} }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] }) }
  function wa(text) { return 'https://wa.me/' + CFG.whatsapp + '?text=' + encodeURIComponent(text) }
  function go(url) { if (url) window.open(url, '_blank', 'noopener') }
  function fmt(d) { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }
  function addMonths(d, m) { var x = new Date(d); x.setMonth(x.getMonth() + m); return x }
  function linkedBoards() {
    try {
      var l = (window.paaawsBag && window.paaawsBag.list && window.paaawsBag.list()) || []
      return l.map(function (b) { return b && b.device && b.device.name }).filter(Boolean)
    } catch (e) { return [] }
  }
  function toast(m) { if (window.paaawsToast) window.paaawsToast(m); else alert(m) }

  var CSS = '#px{position:fixed;inset:0;z-index:9999;background:#050506;color:#fff;font-family:inherit;display:flex;flex-direction:column;overflow:hidden}' +
    '#px .top{display:flex;align-items:center;gap:10px;padding:14px 16px 8px}#px .back{background:#14100a;border:1.5px solid #ffc72c;color:#ffc72c;border-radius:20px;height:40px;padding:0 14px;font-weight:800;font-size:14px}' +
    '#px h1{margin:0;font-size:22px;color:#ffc72c;font-weight:900;letter-spacing:.02em}#px .scroll{flex:1;overflow:auto;padding:4px 16px 24px}' +
    '#px .card{display:flex;gap:14px;align-items:center;width:100%;text-align:left;margin:10px 0;padding:14px 16px;border-radius:16px;border:1.5px solid #333;background:#121216;color:#fff}' +
    '#px .card.gold{border:2px solid #ffc72c;background:linear-gradient(90deg,#2a1e03,#120d02);box-shadow:0 0 18px #ffc72c44}' +
    '#px .card .ic{font-size:28px;width:40px;text-align:center}#px .card strong{display:block;color:#ffc72c;font-size:17px}#px .card small{color:#ccc;font-size:13px}' +
    '#px .opt{border:1.5px solid #333;border-radius:16px;padding:14px 16px;margin:10px 0;background:#121216}#px .opt.gold{border-color:#ffc72c}' +
    '#px .opt h3{margin:0 0 4px;font-size:17px;color:#ffc72c}#px .opt .pr{float:right;color:#fff;font-weight:900}#px .opt p{margin:4px 0 10px;color:#ddd;font-size:14px;line-height:1.45}' +
    '#px .btn{display:block;width:100%;background:#ffc72c;color:#111;border:0;border-radius:14px;padding:14px;font-weight:800;font-size:16px;margin-top:8px}' +
    '#px .btn.ghost{background:transparent;color:#ffc72c;border:1.5px solid #ffc72c}#px .note{color:#aaa;font-size:12px;line-height:1.45;margin:10px 2px}' +
    '#px label{display:block;color:#ffc72c;font-weight:800;font-size:13px;margin:12px 2px 5px}#px input,#px select{width:100%;box-sizing:border-box;background:#15151b;border:1.5px solid #444;border-radius:12px;padding:12px;color:#fff;font-size:16px}' +
    '#px input:focus,#px select:focus{border-color:#ffc72c;outline:0}#px .chk{display:flex;gap:10px;align-items:flex-start;color:#ddd;font-size:13px;margin:14px 2px;line-height:1.4}#px .chk input{width:22px;height:22px;flex:none;margin:0}' +
    '#px .priv{border:1.5px dashed #ffc72c;border-radius:14px;padding:12px 14px;color:#eee;font-size:13px;line-height:1.5;margin:6px 0}' +
    '#px .row{display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid #222;font-size:14px}#px .row span:first-child{color:#aaa}' +
    '#px .pill{display:inline-block!important;font-size:13px!important;line-height:1.3!important;height:auto!important;padding:3px 9px!important;border-radius:9px;background:#333;color:#ccc;font-weight:700}#px .pill.g{background:#ffc72c!important;color:#111!important}' +
    '#px .sect{color:#ffc72c;font-weight:800;font-size:12px;letter-spacing:.08em;text-transform:uppercase;margin:18px 2px 2px}'

  function shell(title, body, backTo) {
    return '<div class="top"><button class="back" data-back="' + (backTo || '') + '">← Back</button><h1>' + esc(title) + '</h1></div><div class="scroll">' + body + '</div>'
  }

  function viewHome() {
    var reg = boards().length
    var apps = CFG.apps.filter(function (a) { return a.show && a.url })
    var h = '' +
      '<button class="card gold" data-go="protect"><span class="ic">🛡️</span><span><strong>Protect your screen</strong><small>Free ' + CFG.price.guaranteeMonths + '-month guarantee · Protection+ · Replacements</small></span></button>' +
      '<button class="card" data-go="' + (reg ? 'boards' : 'register') + '"><span class="ic">📋</span><span><strong>' + (reg ? 'My boards' : 'Register your board') + '</strong><small>' + (reg ? reg + ' registered · add another' : 'Needed for your free guarantee') + '</small></span></button>' +
      '<button class="card" data-wa="powerbank"><span class="ic">🔋</span><span><strong>PAAAWS power bank</strong><small>£' + CFG.price.powerbank + ' · up to 12 hours of light</small></span></button>'
    if (apps.length) {
      h += '<div class="sect">More PAAAWS apps</div>'
      apps.forEach(function (a, i) { h += '<button class="card" data-app="' + i + '"><span class="ic">🐾</span><span><strong>' + esc(a.name) + '</strong><small>' + esc(a.sub) + '</small></span></button>' })
    }
    return shell('PAAAWS Extras', h)
  }

  function viewProtect() {
    var p = CFG.price
    var h = '' +
      '<div class="opt"><h3>Free guarantee <span class="pr">FREE</span></h3><p>Every bag comes with a ' + p.guaranteeMonths + '-month guarantee. If your screen stops working and it isn\'t your fault, send it back to us. If it comes back in one piece and we find a fault, you get a new one free.</p>' +
      '<button class="btn ghost" data-wa="fault">My screen stopped working</button></div>' +
      '<div class="opt gold"><h3>Protection+ <span class="pr">£' + p.protection + '</span></h3><p>12 months of cover for one bag. Up to ' + p.protectionBoards + ' replacement screens for any damage – snaps, drops, the lot. One payment, it doesn\'t renew on its own.</p>' +
      '<button class="btn" data-pay="protection">Get Protection+ £' + p.protection + '</button></div>' +
      '<div class="opt"><h3>Replacement screen <span class="pr">£' + p.replacement + '</span></h3><p>Snapped or damaged your screen without cover? Get one new screen sent out.</p>' +
      '<button class="btn" data-pay="replacement">Buy a screen £' + p.replacement + '</button></div>' +
      '<p class="note">At checkout you\'ll be asked for your board number. Find it in Extras → My boards. Payments are handled securely by Stripe.</p>'
    return shell('Protect your screen', h, 'home')
  }

  function viewRegister() {
    var linked = linkedBoards(), opts = ''
    linked.forEach(function (n) { opts += '<option>' + esc(n) + '</option>' })
    var h = '' +
      '<div class="priv"><b>Your privacy:</b> your board number stays on this phone. We don\'t take any of your details unless you register here. When you do, we keep your name, phone, email and board number only to look after your guarantee and replacements.</div>' +
      '<label>Board number</label>' +
      (linked.length ? '<select id="pxb">' + opts + '<option value="">Type it in instead…</option></select><input id="pxbt" placeholder="Board number" style="display:none;margin-top:8px">'
        : '<input id="pxbt" placeholder="Connect your bag, or type the number"><p class="note">Tip: connect your bag first and we\'ll fill this in for you.</p>') +
      '<label>Date you got your bag</label><input id="pxd" type="date">' +
      '<label>Your name</label><input id="pxn" autocomplete="name">' +
      '<label>Phone</label><input id="pxp" type="tel" autocomplete="tel">' +
      '<label>Email</label><input id="pxe" type="email" autocomplete="email">' +
      '<div class="chk"><input id="pxc" type="checkbox"><span>I agree to PAAAWS keeping these details to look after my guarantee. If I\'m under 16, a parent or guardian is registering for me.</span></div>' +
      '<button class="btn" data-do="register">Register my board</button>'
    return shell('Register your board', h, 'home')
  }

  function viewBoards() {
    var b = boards(), h = ''
    if (!b.length) h = '<p class="note">No boards registered on this phone yet.</p>'
    b.forEach(function (x) {
      var end = addMonths(x.got || x.at, CFG.price.guaranteeMonths), live = end > new Date()
      h += '<div class="opt"><h3>' + esc(x.board) + '</h3>' +
        '<div class="row"><span>Registered</span><span>' + fmt(x.at) + '</span></div>' +
        '<div class="row"><span>Free guarantee</span><span>' + (live ? '<span class="pill g">until ' + fmt(end) + '</span>' : '<span class="pill">ended ' + fmt(end) + '</span>') + '</span></div>' +
        '<div class="row"><span>Sent to PAAAWS</span><span>' + (x.sent ? 'Yes' : 'By WhatsApp') + '</span></div></div>'
    })
    h += '<button class="btn" data-go="register">Register another board</button><button class="btn ghost" data-go="protect">Protect your screen</button>'
    return shell('My boards', h, 'home')
  }

  function render() {
    if (!root) return
    root.innerHTML = { home: viewHome, protect: viewProtect, register: viewRegister, boards: viewBoards }[screen]()
    var sel = root.querySelector('#pxb'), txt = root.querySelector('#pxbt')
    if (sel && txt) sel.addEventListener('change', function () { txt.style.display = sel.value ? 'none' : 'block' })
    root.scrollTop = 0
  }
  function show(s) { screen = s; render() }

  function register() {
    var sel = root.querySelector('#pxb'), txt = root.querySelector('#pxbt')
    var board = ((sel && sel.value) || (txt && txt.value) || '').trim()
    var v = function (id) { var e = root.querySelector(id); return e ? e.value.trim() : '' }
    var got = v('#pxd'), name = v('#pxn'), phone = v('#pxp'), email = v('#pxe')
    if (!board) return toast('Add your board number')
    if (!name || !phone) return toast('Add your name and phone')
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast('Check your email')
    if (!root.querySelector('#pxc').checked) return toast('Tick the box to agree')
    var rec = { board: board, got: got || null, at: new Date().toISOString(), sent: false }
    var done = function (sent) {
      rec.sent = sent
      var list = boards().filter(function (x) { return x.board !== board }); list.push(rec); saveBoards(list)
      toast(sent ? 'Board registered ✔' : 'Send the WhatsApp to finish registering')
      show('boards')
    }
    var row = { board_number: board, got_bag_on: got || null, name: name, phone: phone, email: email || null }
    if (CFG.supabaseUrl && CFG.supabaseKey) {
      fetch(CFG.supabaseUrl.replace(/\/$/, '') + '/rest/v1/board_registrations', {
        method: 'POST',
        headers: { apikey: CFG.supabaseKey, Authorization: 'Bearer ' + CFG.supabaseKey, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(row)
      }).then(function (r) { if (!r.ok) throw new Error(r.status); done(true) })
        .catch(function () { toast('No connection – sending by WhatsApp instead'); go(waReg(row)); done(false) })
    } else { go(waReg(row)); done(false) }
  }
  function waReg(r) {
    return wa('Hi PAAAWS PACK, I\'d like to register my board.\nBoard number: ' + r.board_number + (r.got_bag_on ? '\nGot my bag: ' + r.got_bag_on : '') + '\nName: ' + r.name + '\nPhone: ' + r.phone + (r.email ? '\nEmail: ' + r.email : ''))
  }

  function onClick(e) {
    var t = e.target.closest('button'); if (!t || !root.contains(t)) return
    if (t.hasAttribute('data-back')) { var b = t.getAttribute('data-back'); if (b) show(b); else close(); return }
    if (t.dataset.go) return show(t.dataset.go)
    if (t.dataset.pay) return go(CFG.stripe[t.dataset.pay])
    if (t.dataset.do === 'register') return register()
    if (t.dataset.app) return go(CFG.apps.filter(function (a) { return a.show && a.url })[+t.dataset.app].url)
    if (t.dataset.wa === 'powerbank') return go(wa('Hi PAAAWS PACK, I\'d like a PAAAWS power bank (£' + CFG.price.powerbank + '). My postcode is: '))
    if (t.dataset.wa === 'fault') {
      var b2 = boards()[0], n = (b2 && b2.board) || linkedBoards()[0] || ''
      return go(wa('Hi PAAAWS PACK, my screen has stopped working and I\'d like to use my free guarantee.' + (n ? '\nBoard number: ' + n : '\nBoard number: ') + '\nWhat happened: '))
    }
  }

  function open(s) {
    if (!root) {
      var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st)
      root = document.createElement('div'); root.id = 'px'; root.addEventListener('click', onClick)
    }
    if (root.parentNode !== document.body) document.body.appendChild(root)
    root.style.display = 'flex'; isOpen = true
    try { history.pushState({ px: 1 }, '') } catch (e) {}
    show(s || 'home')
  }
  function close() { isOpen = false; if (root) root.style.display = 'none' }
  window.addEventListener('popstate', function () { if (isOpen) { if (screen !== 'home') { show('home'); try { history.pushState({ px: 1 }, '') } catch (e) {} } else close() } })

  window.paaawsExtras = { open: open, close: close }
})()
