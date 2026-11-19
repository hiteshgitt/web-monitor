// Server-rendered pages for accounts.ruyalab.com. No scripts: every page works with plain HTML forms.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ESC[ch]);

const CSS = `
:root{--bg:#f4f5fb;--card:#fff;--text:#161a2e;--muted:#5b6178;--line:#e2e5f0;--brand:#5b5bd6;--brand-ink:#fff;--bad:#b42318;--bad-bg:#fef3f2;--ok:#067647;--ok-bg:#ecfdf3;--field:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#0d1020;--card:#151a2f;--text:#eef0fa;--muted:#a3a9c2;--line:#262c47;--brand:#8b8bff;--brand-ink:#0d1020;--bad:#fda29b;--bad-bg:#3a1414;--ok:#75e0a7;--ok-bg:#0b2b1d;--field:#0f1428}}
*{box-sizing:border-box}html{font-size:100%}
body{margin:0;min-height:100vh;background:var(--bg);color:var(--text);font:400 1rem/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;display:flex;align-items:center;justify-content:center;padding:2rem 1rem}
main{width:100%;max-width:26rem}
.brand{display:flex;align-items:center;gap:.6rem;justify-content:center;margin-bottom:1.25rem;font-weight:700;font-size:1.15rem;letter-spacing:-.01em}
.mark{width:2rem;height:2rem;border-radius:.6rem;background:linear-gradient(135deg,var(--brand),#ff5a1f);display:grid;place-items:center;color:#fff;font-weight:800;font-size:1rem}
.card{background:var(--card);border:1px solid var(--line);border-radius:1rem;padding:1.75rem;box-shadow:0 10px 30px rgba(20,25,60,.06)}
h1{font-size:1.35rem;margin:0 0 .35rem;letter-spacing:-.01em}.lead{color:var(--muted);margin:0 0 1.25rem;font-size:.95rem}
label{display:block;font-weight:600;font-size:.875rem;margin:0 0 .9rem}
label .small{display:block;font-weight:400;margin-top:.35rem}
input[type=email],input[type=password],input[type=text]{display:block;width:100%;margin-top:.35rem;padding:.7rem .8rem;border:1px solid var(--line);border-radius:.6rem;background:var(--field);color:var(--text);font:inherit}
input:focus{outline:2px solid var(--brand);outline-offset:1px;border-color:transparent}
.btn{display:flex;align-items:center;justify-content:center;gap:.6rem;width:100%;padding:.75rem 1rem;border-radius:.6rem;border:1px solid transparent;background:var(--brand);color:var(--brand-ink);font-family:inherit;font-weight:600;font-size:.95rem;line-height:1;cursor:pointer;text-decoration:none}
.btn.alt{background:transparent;color:var(--text);border-color:var(--line)}
.or{display:flex;align-items:center;gap:.75rem;color:var(--muted);font-size:.8rem;margin:1.1rem 0}.or:before,.or:after{content:"";flex:1;height:1px;background:var(--line)}
.links{display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;margin-top:1.1rem;font-size:.875rem}
a{color:var(--brand)}.muted{color:var(--muted)}.small{font-size:.85rem}
.notice{padding:.7rem .85rem;border-radius:.6rem;margin:0 0 1rem;font-size:.9rem}.bad{background:var(--bad-bg);color:var(--bad)}.ok{background:var(--ok-bg);color:var(--ok)}
.apps{display:flex;gap:.5rem;justify-content:center;margin-top:1.25rem;flex-wrap:wrap}.chip{font-size:.75rem;color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:.2rem .6rem}
.row{display:flex;gap:.6rem}.row>*{flex:1}
dl{display:grid;grid-template-columns:auto 1fr;gap:.35rem 1rem;margin:0 0 1.25rem;font-size:.92rem}dt{color:var(--muted)}dd{margin:0;word-break:break-all}
h2{font-size:1rem;margin:1.5rem 0 .75rem}
`;

const GOOGLE_SVG = '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

export function page(title, body, { status = 200 } = {}) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · Ruya Lab</title><meta name="robots" content="noindex"><style>${CSS}</style></head>
<body><main><div class="brand"><span class="mark">R</span>Ruya Lab</div><div class="card">${body}</div>
<div class="apps"><span class="chip">WebMonitor</span><span class="chip">RuyaShield</span></div>
<p class="small muted" style="text-align:center;margin-top:.9rem">One Ruya Lab account for every Ruya Lab product.</p></main></body></html>`;
  return new Response(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data: https:; form-action 'self' https:; frame-ancestors 'none'; base-uri 'none'",
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'same-origin',
    },
  });
}

const notice = (msg, kind = 'bad') => (msg ? `<p class="notice ${kind}" role="${kind === 'bad' ? 'alert' : 'status'}">${esc(msg)}</p>` : '');
const reqField = (req) => (req ? `<input type="hidden" name="req" value="${esc(req)}">` : '');
const q = (req) => (req ? `?req=${encodeURIComponent(req)}` : '');

export function signinPage({ req, client, error, info, email, google }) {
  return page('Sign in', `
<h1>Sign in</h1><p class="lead">${client ? `to continue to <strong>${esc(client)}</strong>` : 'to your Ruya Lab account'}</p>
${notice(error)}${notice(info, 'ok')}
${google ? `<a class="btn alt" href="/google/start${q(req)}">${GOOGLE_SVG}Continue with Google</a><div class="or">or</div>` : ''}
<form method="post" action="/signin">${reqField(req)}
<label>Email<input type="email" name="email" required autocomplete="email" value="${esc(email)}" autofocus></label>
<label>Password<input type="password" name="password" required autocomplete="current-password"></label>
<button class="btn" type="submit">Sign in</button></form>
<div class="links"><a href="/signup${q(req)}">Create an account</a><a href="/forgot${q(req)}">Forgot password?</a></div>`);
}

export function signupPage({ req, client, error, email, name, google }) {
  return page('Create account', `
<h1>Create your Ruya Lab account</h1><p class="lead">${client ? `One account for ${esc(client)} and every Ruya Lab product.` : 'One account for every Ruya Lab product.'}</p>
${notice(error)}
${google ? `<a class="btn alt" href="/google/start${q(req)}">${GOOGLE_SVG}Sign up with Google</a><div class="or">or</div>` : ''}
<form method="post" action="/signup">${reqField(req)}
<label>Name<input type="text" name="name" required maxlength="80" autocomplete="name" value="${esc(name)}"></label>
<label>Email<input type="email" name="email" required autocomplete="email" value="${esc(email)}"></label>
<label>Password<input type="password" name="password" required minlength="10" autocomplete="new-password"><span class="small muted">At least 10 characters, mixing letters with numbers or symbols.</span></label>
<button class="btn" type="submit">Create account</button></form>
<div class="links"><span class="muted">Already have one?</span><a href="/signin${q(req)}">Sign in</a></div>`);
}

export const checkEmailPage = (email) => page('Check your email', `
<h1>Check your email</h1><p class="lead">We sent a link to <strong>${esc(email)}</strong>. Open it to confirm your address and continue. The link works for 24 hours.</p>
<p class="small muted">Nothing arrived? Check spam, or <a href="/signin">sign in</a> again to get a new link.</p>`);

export function forgotPage({ req, error, sent }) {
  if (sent) return page('Reset link sent', `<h1>Check your email</h1><p class="lead">If an account uses that address, a reset link is on its way. It works for one hour.</p><a class="btn alt" href="/signin${q(req)}">Back to sign in</a>`);
  return page('Reset password', `<h1>Reset your password</h1><p class="lead">We'll email you a link to choose a new one.</p>${notice(error)}
<form method="post" action="/forgot">${reqField(req)}<label>Email<input type="email" name="email" required autocomplete="email" autofocus></label>
<button class="btn" type="submit">Send reset link</button></form><div class="links"><a href="/signin${q(req)}">Back to sign in</a></div>`);
}

export function resetPage({ token, error }) {
  return page('Choose a new password', `<h1>Choose a new password</h1>${notice(error)}
<form method="post" action="/reset"><input type="hidden" name="token" value="${esc(token)}">
<label>New password<input type="password" name="password" required minlength="10" autocomplete="new-password"></label>
<button class="btn" type="submit">Save password and sign in</button></form>`);
}

export function accountPage({ user, info, error, apps }) {
  return page('Your account', `
<h1>Your Ruya Lab account</h1>${notice(error)}${notice(info, 'ok')}
<dl><dt>Name</dt><dd>${esc(user.name || '—')}</dd><dt>Email</dt><dd>${esc(user.email)}</dd>
<dt>Sign-in</dt><dd>${[user.password_hash ? 'Password' : null, user.google_sub ? 'Google' : null].filter(Boolean).join(' and ') || '—'}</dd>
<dt>Plan</dt><dd>${user.plan === 'pro' ? 'Ruya Lab Pro: Pro in every Ruya Lab product' : 'Free'}</dd></dl>
<div class="row">${apps.map((a) => `<a class="btn alt" href="${esc(a.url)}">Open ${esc(a.name)}</a>`).join('')}</div>
<h2>Name</h2><form method="post" action="/account/name" class="row"><input type="text" name="name" maxlength="80" value="${esc(user.name)}" aria-label="Name" style="margin:0"><button class="btn alt" type="submit" style="flex:0 0 auto;width:auto">Save</button></form>
<h2>${user.password_hash ? 'Change password' : 'Add a password'}</h2>
<form method="post" action="/account/password">
${user.password_hash ? '<label>Current password<input type="password" name="current" required autocomplete="current-password"></label>' : ''}
<label>New password<input type="password" name="password" required minlength="10" autocomplete="new-password"></label>
<button class="btn alt" type="submit">Save password</button></form>
<h2>Sessions</h2><form method="post" action="/account/signout-all"><button class="btn alt" type="submit">Sign out on every device</button></form>
<form method="post" action="/logout" style="margin-top:.6rem"><button class="btn" type="submit">Sign out</button></form>`);
}

export const errorPage = (title, message, status = 400) => page(title, `<h1>${esc(title)}</h1><p class="lead">${esc(message)}</p><a class="btn alt" href="/signin">Go to sign in</a>`, { status });
