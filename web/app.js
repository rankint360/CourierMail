const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const paths = {
  mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3 7 9 6 9-6"/>',
  inbox: '<path d="M4 4h16l2 11v5H2v-5L4 4Z"/><path d="M2 15h6l2 3h4l2-3h6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  star: '<path d="m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3L12 17.5l-5.7 3 1.1-6.3-4.6-4.5 6.4-.9L12 3Z"/>',
  send: '<path d="m21 3-7 18-4-7-7-4L21 3ZM10 14 21 3"/>',
  draft: '<path d="M14 3H5v18h14V8l-5-5Z"/><path d="M14 3v5h5M8 13h8M8 17h6"/>',
  archive: '<rect x="3" y="3" width="18" height="5" rx="1"/><path d="M5 8v13h14V8M9 12h6"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  spam: '<path d="m8 3-5 5v8l5 5h8l5-5V8l-5-5H8ZM12 7v6M12 17h.01"/>',
  search: '<circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/>',
  settings: '<path d="m9 3-1 3-3 1-2 4 2 2v4l4 2 3-1 3 1 4-2v-4l2-2-2-4-3-1-1-3H9Z"/><circle cx="12" cy="11.5" r="3"/>',
  refresh: '<path d="M20 7a9 9 0 1 0 1 8M20 3v5h-5"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  back: '<path d="m15 5-7 7 7 7"/>',
  reply: '<path d="m9 5-6 6 6 6M3 11h10c5 0 8 3 8 8"/>',
  replyall: '<path d="m7 5-6 6 6 6M12 5l-6 6 6 6M6 11h8c4 0 7 3 7 8"/>',
  forward: '<path d="m15 5 6 6-6 6M21 11H11c-5 0-8 3-8 8"/>',
  clip: '<path d="m8 15 7-7a3 3 0 0 1 4 4l-9 9a5 5 0 0 1-7-7L14 3a4 4 0 0 1 6 6L9 20"/>',
  file: '<path d="M14 3H5v18h14V8l-5-5ZM14 3v5h5M8 13h8M8 17h5"/>',
  x: '<path d="m6 6 12 12M6 18 18 6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  check: '<path d="m5 12 4 4L20 5"/>',
  folder: '<path d="M3 5h6l2 3h10v13H3V5Z"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.mail}</svg>`;
const button = (action, name, label, extra = '') => `<button type="button" class="icon-button" data-action="${action}" title="${escapeHTML(label)}" aria-label="${escapeHTML(label)}" ${extra}>${icon(name)}</button>`;
const uid = () => crypto.randomUUID();
const CORE_FOLDERS = [{ id: 'inbox', role: 'inbox', name: 'Inbox' }, { id: 'sent', role: 'sent', name: 'Sent' }, { id: 'drafts', role: 'drafts', name: 'Drafts' }, { id: 'archive', role: 'archive', name: 'Archive' }, { id: 'junk', role: 'junk', name: 'Spam' }, { id: 'trash', role: 'trash', name: 'Trash' }];
const templates = [
  { name: 'Pricing inquiry', text: 'Thanks for your interest! I’d be happy to put together a proposal. Could you share a little more about your project, timeline, and budget?\n\nLooking forward to learning more.' },
  { name: 'Meeting confirmation', text: 'Thanks for arranging our meeting. I’m confirming that the proposed time works for me.\n\nPlease send any materials you’d like us to review beforehand. Looking forward to speaking with you.' },
  { name: 'Friendly follow-up', text: 'I wanted to follow up on my previous email. Have you had a chance to review it?\n\nLet me know if there’s anything I can help clarify. Thank you!' },
];
let db;
const state = { mode: 'demo', configured: false, folder: 'inbox', search: '', selected: null, checked: new Set(), messages: [], boxes: [], identities: [], total: 0, loading: false, error: '', listVersion: 0, detailVersion: 0, profile: { name: 'Alex Morgan', email: 'alex@northline.studio', signature: 'Alex Morgan\nNorthline Studio' }, demoMessages: [], demoBoxes: [], drafts: {}, composer: null, online: navigator.onLine };
async function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('courier-mail-v1', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('data');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function diskRead(key) {
  return new Promise((resolve, reject) => { const req = db.transaction('data').objectStore('data').get(key); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
}
async function diskWrite(key, value) {
  if (!db) throw new Error('Browser storage is unavailable. Enable site storage to save your work.');
  return new Promise((resolve, reject) => { const tx = db.transaction('data', 'readwrite'); tx.objectStore('data').put(structuredClone(value), key); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new Error('Storage is full.')); });
}
let saving = Promise.resolve();
function persist() {
  const snapshot = structuredClone({ profile: state.profile, messages: state.demoMessages, boxes: state.demoBoxes, drafts: state.drafts });
  saving = saving.catch(() => {}).then(() => diskWrite('mailbox', snapshot));
  return saving;
}
function toast(message) { $('#toast').textContent = message; $('#toast').style.display = 'block'; clearTimeout(toast.timer); toast.timer = setTimeout(() => $('#toast').style.display = 'none', 5000); }
async function request(path, options = {}) {
  const response = await fetch(`/api/${path}`, { ...options, headers: { ...(typeof options.body === 'string' ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Request failed. Try again.');
  return result;
}
const post = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) });
function initials(name) { return String(name || '?').split(/[\s@]+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase(); }
function sender(message) { return (message.mailboxIds?.sent || state.boxes.find(x => x.role === 'sent' && message.mailboxIds?.[x.id])) ? { name: `To: ${message.to?.[0]?.name || message.to?.[0]?.email || 'No recipient'}` } : message.from?.[0] || { name: 'Unknown sender' }; }
function displayName(person) { return person?.name || person?.email || 'Unknown sender'; }
function dateShort(value) {
  const date = new Date(value); const now = new Date();
  return date.toDateString() === now.toDateString() ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
function bytes(size) { return size >= 1048576 ? `${(size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round((size || 0) / 1024))} KB`; }
function bodyText(message) {
  if (message.text !== undefined) return message.text;
  const text = (message.textBody || []).map(x => message.bodyValues?.[x.partId]?.value || '').join('\n');
  if (text) return text;
  const html = (message.htmlBody || []).map(x => message.bodyValues?.[x.partId]?.value || '').join('\n');
  // Parse in an inert document and render as text. Remote images and active HTML are never inserted.
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  parsed.querySelectorAll('script,style,iframe,object').forEach(x => x.remove());
  parsed.querySelectorAll('br').forEach(x => x.replaceWith('\n'));
  parsed.querySelectorAll('p,div,tr').forEach(x => x.append('\n'));
  return parsed.body.textContent || message.preview || '';
}
function seed() {
  const samples = [
    ['Sophie Chen', 'sophie@atelier.example', 'A new chapter for Northline', 'Hi Alex,\n\nI’ve been thinking about our conversation last week and I’m really excited about the direction we’re taking. The new identity feels like a natural next chapter for Northline.\n\nI’ve attached the updated creative brief with our notes from the workshop. The main things to focus on are the warmer color palette, the simplified wordmark, and a little more breathing room in the layouts.\n\nCould you take a look before our call on Thursday? I’d love to walk through your initial thoughts together.\n\nThanks again for all the care you’re putting into this.\n\nBest,\nSophie', true, true],
    ['Oliver Park', 'oliver@fieldwork.example', 'Website proposal · a few thoughts', 'Hi Alex,\n\nThe proposal is looking great. I have a few thoughts about the project milestones and would love to talk through them with you.\n\nWould Friday morning work for a quick call?\n\nOliver', true, false],
    ['Maya Rodriguez', 'maya@forma.example', 'Coffee next week?', 'Hey Alex,\n\nIt’s been a while! I’ll be in your neighborhood next Tuesday. Would you be up for a coffee around 10?\n\nI’d love to hear how the studio is going.\n\nMaya', false, false],
    ['Daniel Brooks', 'daniel@oakandco.example', 'The final files are ready', 'Hi Alex,\n\nAll the final brand assets are organized and ready for review. Let me know when you have a chance to take a look.\n\nThanks for a wonderful collaboration.\n\nDaniel', false, true],
    ['Emma Wilson', 'emma@papertrail.example', 'Invoice for November', 'Hi Alex,\n\nYour November invoice is ready. Thanks so much for your continued business.\n\nLet me know if you have any questions.\n\nEmma', false, false],
    ['James Lee', 'james@horizon.example', 'Re: Brand workshop', 'Hi Alex,\n\nThursday at 2 pm works perfectly. I’ll bring the inspiration boards and the customer research.\n\nSee you then!\n\nJames', false, false],
    ['Sophie Chen', 'sophie@atelier.example', 'A few references for the project', 'Hi Alex,\n\nSharing a couple of directions to keep in mind for the project. Think thoughtful typography, natural light, and simple materials.\n\nLooking forward to seeing what you create.\n\nSophie', false, false],
    ['Noah Patel', 'noah@common.example', 'Nice meeting you yesterday', 'Hi Alex,\n\nIt was lovely meeting you at the design meetup. I really enjoyed hearing about your work. Let’s keep in touch.\n\nNoah', false, false],
  ];
  state.demoBoxes = [...structuredClone(CORE_FOLDERS), { id: 'projects', name: 'Projects' }, { id: 'clients', name: 'Clients' }, { id: 'personal', name: 'Personal' }];
  state.demoMessages = samples.map((s, i) => ({ id: uid(), from: [{ name: s[0], email: s[1] }], to: [{ email: state.profile.email }], subject: s[2], preview: s[3].replace(/\n/g, ' ').slice(0, 130), text: s[3], keywords: { ...(!s[4] ? { $seen: true } : {}), ...(s[5] ? { $flagged: true } : {}) }, mailboxIds: { inbox: true }, receivedAt: new Date(Date.now() - i * 6500000).toISOString(), attachments: [], hasAttachment: i === 0 }));
  const content = new TextEncoder().encode('NORTHLINE STUDIO\nCreative brief\n\nProject: A new chapter for Northline\n\nDirection\nWarmer colors, simplified wordmark, generous spacing.\n\nDeliverables\nBrand identity, website design, and launch assets.\n\nNext step\nReview the first concepts together on Thursday.');
  state.demoMessages[0].attachments = [{ id: uid(), name: 'Northline — Creative brief.txt', type: 'text/plain', size: content.length, data: content }];
  state.demoMessages.push({ id: uid(), from: [{ name: state.profile.name, email: state.profile.email }], to: [{ name: 'Sophie Chen', email: 'sophie@atelier.example' }], subject: 'Re: Our first workshop', text: 'Hi Sophie,\n\nThanks for such a thoughtful workshop. I’ll send through our next steps shortly.\n\nAlex', preview: 'Thanks for such a thoughtful workshop.', keywords: { $seen: true }, mailboxIds: { sent: true }, receivedAt: new Date(Date.now() - 86400000).toISOString(), attachments: [] });
}
function roleId(role) { return state.boxes.find(x => x.role === role)?.id; }
function folderLabel() { return state.folder === 'starred' ? 'Starred' : state.boxes.find(x => x.id === state.folder)?.name || 'Inbox'; }
function countFolder(id) { return state.mode === 'demo' ? state.demoMessages.filter(x => x.mailboxIds[id] && !x.keywords.$seen).length : state.boxes.find(x => x.id === id)?.unreadEmails || 0; }
function renderShell() {
  const core = CORE_FOLDERS.map(item => ({ ...item, id: roleId(item.role) })).filter(x => x.id);
  core.splice(1, 0, { id: 'starred', name: 'Starred', role: 'starred' });
  const nav = core.map(item => `<button class="nav-button ${state.folder === item.id ? 'active' : ''}" data-action="folder" data-id="${escapeHTML(item.id)}" ${state.folder === item.id ? 'aria-current="page"' : ''}>${icon(({ sent: 'send', drafts: 'draft', junk: 'spam' })[item.role] || item.role)}<span>${item.name}</span>${countFolder(item.id) ? `<span class="count">${countFolder(item.id)}</span>` : ''}</button>`).join('');
  $('#app').innerHTML = `<div class="shell"><button class="mobile-overlay" data-action="menu" aria-label="Close navigation"></button><aside class="sidebar"><div class="brand"><span class="brandmark">${icon('mail')}</span>courier<span class="small">mail</span></div><button class="compose-button" data-action="compose">${icon('plus')}Compose</button><nav class="nav-group" aria-label="Mail folders">${nav}</nav><div><div class="section-label">My folders${button('new-folder', 'plus', 'Create folder')}</div><nav class="nav-group" aria-label="Custom folders">${state.boxes.filter(x => !x.role).map(x => `<button class="nav-button ${state.folder === x.id ? 'active' : ''}" data-action="folder" data-id="${escapeHTML(x.id)}"><span class="folder-dot"></span>${escapeHTML(x.name)}</button>`).join('')}</nav></div><div class="sidebar-bottom"><div class="storage">${state.mode === 'demo' ? 'Your space to make things happen.<br>Demo mailbox · saved on this device' : 'Connected to Fastmail<br>Your mail stays in your account'}</div><button class="nav-button" data-action="settings">${icon('settings')}Settings</button></div></aside><main class="workspace"><header class="topbar">${button('menu', 'menu', 'Open navigation', 'class="mobile-menu"')}<form class="search" id="search-form" role="search">${icon('search')}<input id="search" type="search" placeholder="Search your mail" aria-label="Search mail" value="${escapeHTML(state.search)}"><span class="shortcut">Ctrl K</span></form><div class="top-actions">${button('refresh', 'refresh', 'Refresh mailbox')}<button class="account" data-action="settings" aria-label="Account settings"><span class="account-text"><strong>${escapeHTML(state.profile.name)}</strong>${state.mode === 'demo' ? 'Northline Studio' : 'Fastmail'}</span><span class="avatar">${initials(state.profile.name)}</span></button></div></header><div class="page-title"><div><h1>${escapeHTML(folderLabel())}</h1><div class="subtitle" id="list-subtitle">${state.loading ? 'Loading your messages…' : 'A little clarity for your day.'}</div></div><button class="mode-tag" data-action="settings">${icon(state.mode === 'demo' ? 'folder' : 'check')}${state.mode === 'demo' ? 'Demo mailbox' : 'Fastmail connected'}</button></div><div id="error" class="error-banner ${state.error ? '' : 'hidden'}" role="alert">${escapeHTML(state.error)}</div><div class="mail-layout ${state.selected ? 'has-message' : ''}"><section class="list-panel" aria-label="Messages"><div class="list-toolbar"><input class="check" type="checkbox" id="select-all" aria-label="Select all displayed messages">${button('bulk-read', 'mail', 'Mark selected as read')}${button('bulk-archive', 'archive', 'Archive selected')}${button('bulk-trash', 'trash', 'Move selected to trash')}<span class="spacer"></span><span class="small" id="checked-count"></span></div><div class="message-list" id="message-list"></div><div class="list-footer"><span id="list-count"></span><span>${state.mode === 'demo' ? 'On this device' : 'Synced with Fastmail'}</span></div></section><section class="reading-pane" aria-label="Message reader" id="reader"></section></div></main></div>`;
  // The mobile menu shares the standard icon button component.
  $('.topbar > .icon-button').classList.add('mobile-menu');
  renderList(); renderReader();
}
function renderList() {
  $('#message-list').innerHTML = state.loading && !state.messages.length ? '<div class="empty">Loading your mail…</div>' : !state.messages.length ? `<div class="empty">${icon(state.search ? 'search' : 'inbox')}<h2>${state.search ? 'No matching messages' : 'All clear here'}</h2><p>${state.search ? 'Try another sender, subject, or phrase.' : 'Messages in this folder will appear here.'}</p></div>` : state.messages.map(m => {
    const p = sender(m); const name = displayName(p);
    return `<article class="message-row ${m.id === state.selected?.id ? 'selected' : ''} ${!m.keywords.$seen ? 'unread' : ''}" data-id="${escapeHTML(m.id)}" tabindex="0" role="button" aria-label="${escapeHTML(`${name}, ${m.subject || 'No subject'}${!m.keywords.$seen ? ', unread' : ''}`)}"><div class="row-check"><input class="check message-check" type="checkbox" aria-label="Select message" data-id="${escapeHTML(m.id)}" ${state.checked.has(m.id) ? 'checked' : ''}></div><span class="avatar">${escapeHTML(initials(name))}</span><div><div class="message-meta"><span class="sender">${!m.keywords.$seen ? '<span class="unread-dot"></span>' : ''}${escapeHTML(name)}</span><span class="row-time">${dateShort(m.receivedAt)}</span></div><div class="subject">${escapeHTML(m.subject || '(No subject)')}</div><div class="preview">${escapeHTML(m.preview || m.text?.slice(0, 100) || '')}</div><div class="row-bottom"><span class="small">${m.hasAttachment || m.attachments?.length ? icon('clip') : ''}${m.keywords.$draft ? ' Draft' : ''}</span><button class="star ${m.keywords.$flagged ? 'on' : ''}" data-action="star" data-id="${escapeHTML(m.id)}" aria-label="${m.keywords.$flagged ? 'Unstar' : 'Star'} message">${icon('star')}</button></div></div></article>`;
  }).join('') + (state.messages.length < state.total ? '<button class="load-button" data-action="load-more">Load more messages</button>' : '');
  $('#list-count').textContent = `${state.messages.length ? '1–' + state.messages.length : '0'} of ${state.total} messages`;
  $('#list-subtitle').textContent = state.search ? `Results for “${state.search}”` : `${state.total} message${state.total === 1 ? '' : 's'} · A little clarity for your day.`;
  $('#checked-count').textContent = state.checked.size ? `${state.checked.size} selected` : '';
  $('#select-all').checked = state.messages.length > 0 && state.messages.every(m => state.checked.has(m.id));
  $('#select-all').indeterminate = state.checked.size > 0 && !$('#select-all').checked;
}
function renderReader() {
  const m = state.selected;
  $('.mail-layout').classList.toggle('has-message', Boolean(m));
  if (!m) { $('#reader').innerHTML = `<div class="empty">${icon('mail')}<h2>A moment of focus.</h2><p>Select a message to read it here.</p></div>`; return; }
  const p = m.from?.[0];
  $('#reader').innerHTML = `<div class="reader-toolbar">${button('back', 'back', 'Back to messages', 'data-mobile="true"')}${button('archive', 'archive', 'Archive message')}${button('trash', 'trash', 'Move to trash')}${button('unread', 'mail', 'Mark as unread')}${button('spam', 'spam', 'Move to spam')}<select id="move-folder" class="folder-select" aria-label="Move message to folder"><option value="">Move to folder</option>${state.boxes.map(x => `<option value="${escapeHTML(x.id)}">${escapeHTML(x.name)}</option>`).join('')}</select><span class="spacer"></span>${button('previous', 'back', 'Previous message')}${button('next', 'chevron', 'Next message')}</div><div class="reader-content"><h2 class="reader-title">${escapeHTML(m.subject || '(No subject)')}</h2><div class="reader-sender"><span class="avatar">${escapeHTML(initials(displayName(p)))}</span><div class="sender-details"><strong>${escapeHTML(displayName(p))}</strong><span class="address">&lt;${escapeHTML(p?.email || '')}&gt;</span><div class="recipient">To ${escapeHTML((m.to || []).map(displayName).join(', '))}${m.cc?.length ? ' · Cc ' + escapeHTML(m.cc.map(displayName).join(', ')) : ''}</div></div><span class="reader-date">${escapeHTML(new Date(m.receivedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))}</span><button class="star ${m.keywords.$flagged ? 'on' : ''}" data-action="star" data-id="${escapeHTML(m.id)}" aria-label="${m.keywords.$flagged ? 'Unstar' : 'Star'} message">${icon('star')}</button></div><div class="message-body">${escapeHTML(bodyText(m))}</div>${m.attachments?.length ? `<div class="attachments"><div class="attachment-title">${m.attachments.length} attachment${m.attachments.length === 1 ? '' : 's'}</div>${m.attachments.map((f, i) => `<button class="attachment" data-action="download" data-index="${i}" title="Download ${escapeHTML(f.name)}"><span class="file-icon">${icon('file')}</span><span><span class="file-name">${escapeHTML(f.name || 'Attachment')}</span><span class="file-size">${bytes(f.size)}</span></span>${icon('download')}</button>`).join('')}</div>` : ''}<div class="reply-actions">${m.keywords.$draft ? '<button class="primary" data-action="edit-draft">Edit draft</button>' : `<button class="primary" data-action="reply">${icon('reply')}Reply</button><button class="outline-button" data-action="reply-all">${icon('replyall')}Reply all</button><button class="outline-button" data-action="forward">${icon('forward')}Forward</button>`}</div></div>`;
  $('.reader-toolbar > button').classList.add('back-button');
}
async function loadMailbox({ more = false, selectFirst = false } = {}) {
  const version = ++state.listVersion;
  state.loading = true; state.error = '';
  $('#error')?.classList.add('hidden');
  try {
    let messages, total;
    if (state.mode === 'demo') {
      messages = state.demoMessages.filter(m => state.folder === 'starred' ? m.keywords.$flagged && !m.mailboxIds.trash && !m.mailboxIds.junk : m.mailboxIds[state.folder]);
      if (state.search) { const q = state.search.toLowerCase(); messages = messages.filter(m => [m.subject, m.text, ...(m.from || []).map(displayName), ...(m.to || []).map(displayName)].join(' ').toLowerCase().includes(q)); }
      messages = messages.sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt)); total = messages.length;
    } else {
      const params = new URLSearchParams({ q: state.search, position: String(more ? state.messages.length : 0) });
      if (state.folder === 'starred') params.set('starred', 'true'); else params.set('mailbox', state.folder);
      const result = await request(`messages?${params}`); messages = result.messages; total = result.total;
    }
    if (version !== state.listVersion) return;
    state.messages = more ? [...state.messages, ...messages] : messages;
    state.total = total;
    state.loading = false;
    renderList();
    if (selectFirst && state.messages.length) await openMessage(state.messages[0].id);
  } catch (error) {
    if (version !== state.listVersion) return;
    state.error = error.message; $('#error').textContent = error.message; $('#error').classList.remove('hidden');
  } finally { if (version === state.listVersion) state.loading = false; }
}
async function openMessage(id) {
  const version = ++state.detailVersion;
  const message = state.messages.find(x => x.id === id);
  if (!message) return;
  if (state.mode === 'live') $('#reader').innerHTML = '<div class="empty">Loading message…</div>';
  const result = state.mode === 'demo' ? structuredClone(message) : await request(`message?id=${encodeURIComponent(id)}`);
  if (version !== state.detailVersion) return;
  state.selected = result;
  if (!result.keywords.$seen) await changeMessages([id], { read: true }, false);
  renderList(); renderReader();
}
async function changeMessages(ids, change, reload = true) {
  if (!ids.length) { toast('Select a message first.'); return; }
  if (state.mode === 'live') await post('change', { ids, ...change });
  const update = message => {
    if (!ids.includes(message.id)) return;
    if (change.read !== undefined) { if (change.read) message.keywords.$seen = true; else delete message.keywords.$seen; }
    if (change.starred !== undefined) { if (change.starred) message.keywords.$flagged = true; else delete message.keywords.$flagged; }
    if (change.mailbox) message.mailboxIds = { [change.mailbox]: true };
  };
  state.demoMessages.forEach(update); state.messages.forEach(update); if (state.selected) update(state.selected);
  if (state.mode === 'demo') await persist();
  if (reload) {
    if (change.mailbox) { state.selected = null; ++state.detailVersion; state.checked.clear(); }
    await refreshCounts(); await loadMailbox(); renderShell();
  }
}
async function refreshCounts() {
  if (state.mode === 'demo') { state.boxes = state.demoBoxes; return; }
  const data = await request('mailboxes'); state.boxes = data.mailboxes; state.identities = data.identities;
  if (state.identities[0]) { state.profile.email = state.identities[0].email; state.profile.name = state.identities[0].name || state.identities[0].email; }
}
async function navigate(folder) {
  state.folder = folder; state.selected = null; state.messages = []; state.checked.clear(); ++state.detailVersion;
  renderShell(); await loadMailbox();
}
function freshDraft() {
  return { localId: uid(), mode: state.mode, to: '', cc: '', bcc: '', subject: '', text: state.profile.signature ? '\n\n' + state.profile.signature : '', attachments: [], identityId: state.identities[0]?.id, savedAt: null };
}
function captureComposer() {
  if (!state.composer || !$('#compose').open) return;
  if (state.composer.pendingSubmission) return;
  for (const field of ['to', 'cc', 'bcc', 'subject', 'text']) state.composer[field] = $(`[name="${field}"]`, $('#compose')).value;
  state.composer.savedAt = new Date().toISOString();
  state.drafts[state.composer.localId] = structuredClone(state.composer);
}
async function saveLocalDraft() {
  captureComposer();
  try { await persist(); if ($('#draft-status')) $('#draft-status').textContent = 'Saved on this device'; }
  catch { if ($('#draft-status')) $('#draft-status').textContent = 'Storage full — keep this window open'; throw new Error('Draft could not be saved. Free up browser storage.'); }
}
function renderCompose(draft) {
  $('#compose').innerHTML = `<div class="modal-head"><h2>${state.mode === 'demo' ? 'New demo message' : 'New message'}</h2>${button('close-compose', 'x', 'Save and close draft')}</div><form id="compose-form" class="compose-form"><div class="compose-fields"><div class="field-line"><label>From</label><span>${escapeHTML(state.profile.email)}</span></div><div class="field-line"><label for="compose-to">To</label><input id="compose-to" name="to" value="${escapeHTML(draft.to)}" placeholder="name@company.com" autocomplete="off"><button type="button" data-action="toggle-cc">Cc / Bcc</button></div><div id="cc-fields" class="${draft.cc || draft.bcc ? '' : 'hidden'}"><div class="field-line"><label for="compose-cc">Cc</label><input id="compose-cc" name="cc" value="${escapeHTML(draft.cc)}"></div><div class="field-line"><label for="compose-bcc">Bcc</label><input id="compose-bcc" name="bcc" value="${escapeHTML(draft.bcc)}"></div></div><div class="field-line"><label for="compose-subject">Subject</label><input id="compose-subject" name="subject" value="${escapeHTML(draft.subject)}"></div></div><textarea name="text" class="compose-body" aria-label="Message body" placeholder="Write something thoughtful…">${escapeHTML(draft.text)}</textarea><div class="compose-files" id="compose-files"></div><div class="compose-footer"><button type="submit" class="primary" id="send-button">${icon('send')}${state.mode === 'demo' ? 'Send demo' : 'Send'}</button>${button('attach', 'clip', 'Attach files')}<select id="template-select" class="folder-select" aria-label="Insert reply template"><option value="">Templates</option>${templates.map((x, i) => `<option value="${i}">${escapeHTML(x.name)}</option>`).join('')}</select><span class="spacer"></span><span class="draft-status" id="draft-status">${draft.savedAt ? 'Saved on this device' : ''}</span>${button('discard-draft', 'trash', 'Discard draft')}<input type="file" id="file-input" multiple hidden></div></form>`;
  renderComposeFiles();
  if (draft.pendingSubmission) {
    $$('input:not([type="file"]),textarea', $('#compose')).forEach(x => x.readOnly = true);
    $('#template-select').disabled = true;
    $('#send-button').textContent = 'Check / retry send';
    $('#draft-status').textContent = 'Awaiting send confirmation';
  }
}
function renderComposeFiles() {
  $('#compose-files').innerHTML = state.composer.attachments.map((f, i) => `<span class="attachment">${icon('clip')}<span><span class="file-name">${escapeHTML(f.name)}</span><span class="file-size">${bytes(f.size)}</span></span><button class="icon-button" type="button" data-action="remove-attachment" data-index="${i}" aria-label="Remove ${escapeHTML(f.name)}">${icon('x')}</button></span>`).join('');
}
async function compose(kind = 'new', draftId) {
  if ($('#compose').open) return;
  let draft = draftId ? structuredClone(state.drafts[draftId]) : freshDraft();
  const m = state.selected;
  if (kind === 'edit' && m) {
    draft = { ...draft, id: state.mode === 'live' ? m.id : undefined, demoId: state.mode === 'demo' ? m.id : undefined, to: (m.to || []).map(x => x.email).join(', '), cc: (m.cc || []).map(x => x.email).join(', '), bcc: (m.bcc || []).map(x => x.email).join(', '), subject: m.subject, text: bodyText(m), attachments: structuredClone(m.attachments || []) };
  }
  if (['reply', 'reply-all', 'forward'].includes(kind) && m) {
    const quoted = `\n\nOn ${new Date(m.receivedAt).toLocaleString()}, ${displayName(m.from?.[0])} wrote:\n${bodyText(m).split('\n').map(x => '> ' + x).join('\n')}`;
    draft.subject = `${kind === 'forward' ? 'Fwd: ' : /^re:/i.test(m.subject) ? '' : 'Re: '}${m.subject}`;
    draft.text += quoted;
    if (kind !== 'forward') {
      draft.to = (m.replyTo?.length ? m.replyTo : m.from || []).map(x => x.email).join(', ');
      if (kind === 'reply-all') {
        const existing = new Set([state.profile.email.toLowerCase(), ...draft.to.split(',').map(x => x.trim().toLowerCase())]);
        draft.cc = [...(m.to || []), ...(m.cc || [])].filter(x => { const key = x.email.toLowerCase(); if (existing.has(key)) return false; existing.add(key); return true; }).map(x => x.email).join(', ');
      }
      draft.inReplyTo = m.messageId;
      draft.references = [...(m.references || []), ...(m.messageId || [])];
    } else draft.attachments = structuredClone(m.attachments || []);
  }
  state.composer = draft; renderCompose(draft); $('#compose').showModal();
  if (kind === 'reply' || kind === 'reply-all') $('[name="text"]', $('#compose')).focus(); else $('#compose-to').focus();
  await saveLocalDraft();
}
async function syncDraft(draft) {
  if (draft.mode !== 'live') return;
  const result = await post('draft', draft);
  draft.id = result.id; draft.identityId = result.identityId;
  state.drafts[draft.localId] = structuredClone(draft);
  await persist();
}
async function closeCompose() {
  if (!state.composer) return;
  await saveLocalDraft();
  const draft = state.composer;
  if (draft.pendingSubmission) { $('#compose').close(); state.composer = null; toast('Pending send saved. Recover this draft in Settings to check or retry.'); return; }
  if (state.mode === 'live') {
    try { await syncDraft(draft); }
    catch (error) { toast(`Saved on this device. ${error.message}`); $('#compose').close(); state.composer = null; return; }
  } else {
    const existing = state.demoMessages.find(x => x.id === draft.demoId);
    const message = { id: existing?.id || uid(), from: [{ name: state.profile.name, email: state.profile.email }], to: draft.to.split(/[,;]/).filter(Boolean).map(email => ({ email: email.trim() })), cc: draft.cc.split(/[,;]/).filter(Boolean).map(email => ({ email: email.trim() })), bcc: draft.bcc.split(/[,;]/).filter(Boolean).map(email => ({ email: email.trim() })), subject: draft.subject, text: draft.text, preview: draft.text.slice(0, 130), receivedAt: new Date().toISOString(), mailboxIds: { drafts: true }, keywords: { $seen: true, $draft: true }, attachments: draft.attachments, localId: draft.localId };
    if (existing) Object.assign(existing, message); else state.demoMessages.push(message);
    draft.demoId = message.id; state.drafts[draft.localId] = draft; await persist();
  }
  $('#compose').close(); state.composer = null; await loadMailbox(); renderShell(); toast('Draft saved.');
}
function validRecipients(value) { return String(value).split(/[,;]/).map(x => x.trim()).filter(Boolean); }
let sending = false;
let attaching = false;
async function sendMessage() {
  if (sending) return;
  if (attaching) throw new Error('Wait for attachments to finish uploading.');
  captureComposer();
  const d = state.composer;
  const all = [...validRecipients(d.to), ...validRecipients(d.cc), ...validRecipients(d.bcc)];
  if (!all.length) throw new Error('Add at least one recipient.');
  if (all.some(x => !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(x))) throw new Error('Use email addresses separated by commas.');
  if (!d.subject.trim() && !await confirmAction('Send without a subject?', 'Your message has an empty subject.', 'Send message')) return;
  sending = true; $('#compose-form').inert = true; $('#send-button').disabled = true; $('#send-button').textContent = 'Sending…';
  try {
    await saveLocalDraft();
    if (state.mode === 'live') {
      // A draft with an uncertain submission result is retried using its original ID.
      if (!d.pendingSubmission) await syncDraft(d);
      d.pendingSubmission = true; state.drafts[d.localId] = structuredClone(d); await persist();
      $$('input:not([type="file"]),textarea', $('#compose')).forEach(x => x.readOnly = true);
      $('#template-select').disabled = true;
      await post('send', { id: d.id, identityId: d.identityId });
    } else {
      const m = { id: uid(), from: [{ name: state.profile.name, email: state.profile.email }], to: validRecipients(d.to).map(email => ({ email })), cc: validRecipients(d.cc).map(email => ({ email })), bcc: validRecipients(d.bcc).map(email => ({ email })), subject: d.subject, text: d.text, preview: d.text.slice(0, 130), receivedAt: new Date().toISOString(), mailboxIds: { sent: true }, keywords: { $seen: true }, attachments: d.attachments };
      state.demoMessages = state.demoMessages.filter(x => x.id !== d.demoId); state.demoMessages.unshift(m);
    }
    delete state.drafts[d.localId]; await persist(); $('#compose').close(); state.composer = null; state.selected = null; ++state.detailVersion;
    await refreshCounts(); await loadMailbox(); renderShell(); toast(state.mode === 'demo' ? 'Demo message saved in Sent. No email was delivered.' : 'Message submitted to Fastmail.');
  } finally {
    sending = false;
    if ($('#compose-form')) $('#compose-form').inert = false;
    if ($('#send-button')) { $('#send-button').disabled = false; $('#send-button').innerHTML = `${icon('send')}${d.pendingSubmission ? 'Check / retry send' : state.mode === 'demo' ? 'Send demo' : 'Send'}`; }
  }
}
async function attachFiles(files) {
  if (attaching || sending) return;
  const d = state.composer;
  if (d.pendingSubmission) throw new Error('Resolve the pending send before changing this message.');
  const total = d.attachments.reduce((n, f) => n + (f.size || 0), 0) + files.reduce((n, f) => n + f.size, 0);
  if (total > 10 * 1024 * 1024) throw new Error('Keep total attachments under 10 MB.');
  attaching = true;
  $('#send-button').disabled = true;
  $('#draft-status').textContent = 'Adding attachments…';
  try {
    for (const file of files) {
      const result = state.mode === 'live' ? await request('upload', { method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file }) : { data: new Uint8Array(await file.arrayBuffer()), id: uid() };
      d.attachments.push({ ...result, name: file.name, type: file.type || 'application/octet-stream', size: file.size });
    }
    renderComposeFiles(); await saveLocalDraft();
  } finally {
    attaching = false;
    if ($('#send-button')) $('#send-button').disabled = false;
  }
}
async function downloadAttachment(index) {
  const file = state.selected.attachments[index];
  if (state.mode === 'live') { const link = document.createElement('a'); link.href = `/api/download?${new URLSearchParams({ blobId: file.blobId, name: file.name || 'attachment' })}`; link.download = file.name; link.click(); return; }
  const url = URL.createObjectURL(new Blob([file.data || ''], { type: file.type }));
  const link = document.createElement('a'); link.href = url; link.download = file.name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 20000);
}
function confirmAction(title, message, label = 'Confirm') {
  return new Promise(resolve => {
    $('#confirm').innerHTML = `<div class="modal-head"><h2>${escapeHTML(title)}</h2></div><div class="settings-content"><p>${escapeHTML(message)}</p><div class="settings-footer"><button class="outline-button" id="confirm-cancel">Cancel</button><button class="primary" id="confirm-ok">${escapeHTML(label)}</button></div></div>`;
    const finish = value => { $('#confirm').close(); resolve(value); };
    $('#confirm-ok').onclick = () => finish(true); $('#confirm-cancel').onclick = () => finish(false);
    $('#confirm').oncancel = event => { event.preventDefault(); finish(false); };
    $('#confirm').showModal();
  });
}
function openSettings(tab = 'account') {
  $('#settings').innerHTML = `<div class="modal-head"><h2>Make yourself at home</h2>${button('close-settings', 'x', 'Close settings')}</div><div class="settings-content"><div class="settings-tabs"><button data-action="settings-tab" data-tab="account" class="${tab === 'account' ? 'active' : ''}">Account</button><button data-action="settings-tab" data-tab="drafts" class="${tab === 'drafts' ? 'active' : ''}">Recovered drafts</button></div>${tab === 'drafts' ? `<p>Drafts saved on this device. Live drafts also sync to Fastmail when you close the composer.</p>${Object.values(state.drafts).filter(x => x.mode === state.mode).map(x => `<button class="attachment" data-action="recover-draft" data-id="${x.localId}">${icon('draft')}<span><span class="file-name">${escapeHTML(x.subject || '(No subject)')}</span><span class="file-size">${escapeHTML(x.to || 'No recipient')} · ${x.savedAt ? dateShort(x.savedAt) : 'Unsaved'}</span></span></button>`).join('') || '<p>No recovered drafts.</p>'}` : `<div class="connection-note"><strong>${state.mode === 'demo' ? 'You’re exploring the demo mailbox' : 'Fastmail is connected'}</strong>${state.mode === 'demo' ? 'Demo messages stay in this browser. Sending adds them to the demo Sent folder.' : 'Reading, drafts, folders, attachments, and sending use your Fastmail account.'}</div><form id="settings-form"><label for="profile-name">Display name</label><input id="profile-name" name="name" value="${escapeHTML(state.profile.name)}" ${state.mode === 'live' ? 'readonly' : ''}><label for="profile-email">Email address</label><input id="profile-email" name="email" type="email" required value="${escapeHTML(state.profile.email)}" ${state.mode === 'live' ? 'readonly' : ''}><label for="signature">Email signature</label><textarea id="signature" name="signature">${escapeHTML(state.profile.signature)}</textarea><div class="settings-footer"><button type="submit" class="primary">Save settings</button></div></form><hr><h3>Mailbox connection</h3>${state.configured ? `<p>A Fastmail token is configured on the server.</p><button class="outline-button" data-action="switch-mode">${state.mode === 'live' ? 'Explore demo mailbox' : 'Open live Fastmail mailbox'}</button>` : `<p>To connect real mail, add <code>FASTMAIL_API_TOKEN</code> as a server secret and redeploy. Grant the token Email and Email submission permissions. Tokens require an eligible Fastmail plan.</p><p><a href="https://www.fastmail.help/hc/en-us/articles/5254602856719-API-tokens" target="_blank" rel="noopener noreferrer">Fastmail connection instructions</a></p>`}<p class="small">Courier currently supports one account per private deployment. Keep this site private when a mailbox token is connected.</p><div class="settings-footer"><button class="outline-button" data-action="reset-demo">Reset demo mailbox</button></div>`}</div>`;
  if (!$('#settings').open) $('#settings').showModal();
}
async function handleAction(action, target) {
  switch (action) {
    case 'menu': $('.shell').classList.toggle('menu-open'); break;
    case 'compose': await compose(); break;
    case 'folder': await navigate(target.dataset.id); break;
    case 'star': { const m = state.messages.find(x => x.id === target.dataset.id) || state.selected; await changeMessages([m.id], { starred: !m.keywords.$flagged }); break; }
    case 'refresh': await refreshCounts(); await loadMailbox(); renderShell(); toast('Mailbox refreshed.'); break;
    case 'back': state.selected = null; ++state.detailVersion; renderList(); renderReader(); break;
    case 'archive': case 'trash': case 'spam': {
      const destination = roleId(action === 'spam' ? 'junk' : action);
      if (!destination) throw new Error('This account does not have that folder.');
      await changeMessages([state.selected.id], { mailbox: destination }); toast('Message moved.'); break;
    }
    case 'unread': await changeMessages([state.selected.id], { read: false }); state.selected = null; renderReader(); break;
    case 'bulk-read': await changeMessages([...state.checked], { read: true }); break;
    case 'bulk-archive': case 'bulk-trash': { const destination = roleId(action === 'bulk-archive' ? 'archive' : 'trash'); if (!destination) throw new Error('This account does not have that folder.'); await changeMessages([...state.checked], { mailbox: destination }); break; }
    case 'previous': case 'next': { const index = state.messages.findIndex(x => x.id === state.selected.id); const m = state.messages[index + (action === 'next' ? 1 : -1)]; if (m) await openMessage(m.id); break; }
    case 'reply': case 'reply-all': case 'forward': await compose(action); break;
    case 'edit-draft': { const local = state.selected.localId; if (local && state.drafts[local]) await compose('new', local); else await compose('edit'); break; }
    case 'attach': $('#file-input').click(); break;
    case 'toggle-cc': $('#cc-fields').classList.toggle('hidden'); break;
    case 'close-compose': if (!sending && !attaching) await closeCompose(); break;
    case 'discard-draft': {
      if (sending || attaching) return;
      if (state.composer.pendingSubmission) throw new Error('Check the pending send before discarding this draft.');
      if (!await confirmAction('Discard this draft?', 'The saved draft and its attachments will be removed.', 'Discard draft')) return;
      const d = state.composer;
      if (state.mode === 'live' && d.id) await post('change', { ids: [d.id], mailbox: roleId('trash') });
      state.demoMessages = state.demoMessages.filter(x => x.id !== d.demoId); delete state.drafts[d.localId]; await persist(); $('#compose').close(); state.composer = null; await loadMailbox(); renderShell(); break;
    }
    case 'remove-attachment': if (state.composer.pendingSubmission) throw new Error('Resolve the pending send before changing attachments.'); state.composer.attachments.splice(Number(target.dataset.index), 1); renderComposeFiles(); await saveLocalDraft(); break;
    case 'download': await downloadAttachment(Number(target.dataset.index)); break;
    case 'settings': openSettings(); break;
    case 'close-settings': $('#settings').close(); break;
    case 'settings-tab': openSettings(target.dataset.tab); break;
    case 'recover-draft': $('#settings').close(); await compose('new', target.dataset.id); break;
    case 'switch-mode': {
      $('#settings').close(); state.mode = state.mode === 'live' ? 'demo' : 'live'; state.selected = null; state.messages = []; state.checked.clear(); ++state.detailVersion;
      if (state.mode === 'demo') state.profile = (await diskRead('mailbox'))?.profile || state.profile;
      await refreshCounts(); state.folder = roleId('inbox'); renderShell(); await loadMailbox(); break;
    }
    case 'reset-demo': if (await confirmAction('Reset the demo mailbox?', 'This replaces demo messages and demo drafts with the original sample mailbox.', 'Reset demo')) { seed(); for (const [key, d] of Object.entries(state.drafts)) if (d.mode === 'demo') delete state.drafts[key]; await persist(); $('#settings').close(); if (state.mode === 'demo') { state.boxes = state.demoBoxes; await navigate('inbox'); } toast('Demo mailbox reset.'); } break;
    case 'new-folder': {
      $('#settings').innerHTML = `<div class="modal-head"><h2>Create a folder</h2>${button('close-settings', 'x', 'Cancel')}</div><form class="settings-content" id="folder-form"><label for="folder-name">Folder name</label><input id="folder-name" required maxlength="80" autocomplete="off"><div class="settings-footer"><button class="primary" type="submit">Create folder</button></div></form>`; $('#settings').showModal(); $('#folder-name').focus(); break;
    }
    case 'load-more': await loadMailbox({ more: true }); break;
  }
}
document.addEventListener('click', async event => {
  const action = event.target.closest('[data-action]');
  if (action) { event.preventDefault(); try { await handleAction(action.dataset.action, action); } catch (error) { toast(error.message); } return; }
  if (event.target.closest('input,select,a')) return;
  const row = event.target.closest('.message-row');
  if (row) try { await openMessage(row.dataset.id); } catch (error) { toast(error.message); }
});
document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); if (!document.querySelector('dialog[open]')) $('#search').focus(); }
  if ((event.key === 'Enter' || event.key === ' ') && event.target.classList.contains('message-row')) { event.preventDefault(); openMessage(event.target.dataset.id).catch(e => toast(e.message)); }
});
document.addEventListener('submit', async event => {
  event.preventDefault();
  try {
    if (event.target.id === 'search-form') { state.search = $('#search').value.trim(); state.selected = null; ++state.detailVersion; await loadMailbox(); renderReader(); }
    if (event.target.id === 'compose-form') await sendMessage();
    if (event.target.id === 'settings-form') { const data = new FormData(event.target); state.profile.signature = String(data.get('signature')); if (state.mode === 'demo') { state.profile.name = String(data.get('name')); state.profile.email = String(data.get('email')); } await persist(); $('#settings').close(); renderShell(); toast('Settings saved.'); }
    if (event.target.id === 'folder-form') {
      const name = $('#folder-name').value.trim(); if (!name) return;
      if (state.boxes.some(x => x.name.toLowerCase() === name.toLowerCase())) throw new Error('A folder with that name already exists.');
      if (state.mode === 'live') await post('folder', { name }); else { state.demoBoxes.push({ id: uid(), name }); await persist(); }
      await refreshCounts(); $('#settings').close(); renderShell(); toast('Folder created.');
    }
  } catch (error) { toast(error.message); }
});
let searchTimer;
document.addEventListener('input', event => {
  if (event.target.id === 'search') {
    clearTimeout(searchTimer); searchTimer = setTimeout(async () => { state.search = $('#search').value.trim(); state.selected = null; ++state.detailVersion; await loadMailbox(); renderReader(); }, 220);
  }
  if (event.target.closest('#compose-form')) {
    if (state.composer.pendingSubmission) { $('#draft-status').textContent = 'Pending send — retry before editing'; return; }
    saveLocalDraft().catch(e => toast(e.message));
  }
});
document.addEventListener('change', async event => {
  try {
    if (event.target.classList.contains('message-check')) { if (event.target.checked) state.checked.add(event.target.dataset.id); else state.checked.delete(event.target.dataset.id); renderList(); }
    if (event.target.id === 'select-all') { state.checked = new Set(event.target.checked ? state.messages.map(x => x.id) : []); renderList(); }
    if (event.target.id === 'move-folder' && event.target.value) { await changeMessages([state.selected.id], { mailbox: event.target.value }); toast('Message moved.'); }
    if (event.target.id === 'file-input') await attachFiles([...event.target.files]);
    if (event.target.id === 'template-select' && event.target.value !== '') { const field = $('[name="text"]', $('#compose')); const text = templates[Number(event.target.value)].text; field.setRangeText(text, field.selectionStart, field.selectionEnd, 'end'); event.target.value = ''; await saveLocalDraft(); }
  } catch (error) { toast(error.message); }
});
$('#compose').addEventListener('cancel', event => { event.preventDefault(); if (!sending && !attaching) closeCompose().catch(e => toast(e.message)); });
window.addEventListener('beforeunload', event => { if (sending) { event.preventDefault(); return; } if (state.composer) { captureComposer(); persist().catch(() => {}); } });
window.addEventListener('offline', () => { state.online = false; toast('You’re offline. Drafts continue to save on this device.'); });
window.addEventListener('online', () => { state.online = true; toast('You’re back online.'); });
async function init() {
  try {
    db = await openDB();
    const saved = await diskRead('mailbox');
    if (saved) { state.profile = saved.profile; state.demoMessages = saved.messages; state.demoBoxes = saved.boxes; state.drafts = saved.drafts || {}; } else { seed(); await persist(); }
  } catch { seed(); state.error = 'Browser storage is unavailable. Enable site storage to retain demo messages and drafts.'; }
  try { const config = await request('config'); state.configured = config.configured; } catch { /* Demo remains usable when the server is offline. */ }
  state.boxes = state.demoBoxes; renderShell(); await loadMailbox({ selectFirst: window.matchMedia('(min-width:851px)').matches });
  const recovered = Object.values(state.drafts).filter(x => x.mode === state.mode);
  if (recovered.length) toast(`${recovered.length} saved draft${recovered.length === 1 ? '' : 's'} available in Settings → Recovered drafts.`);
}
init();
