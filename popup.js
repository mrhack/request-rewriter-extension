import { DEFAULT_CONFIG, validateConfig, emptyRule } from "./rules.js";

var root = document.getElementById('app');
var cardContainer = document.getElementById('card-container');
var toggleBtn = document.getElementById('toggle-btn');
var allConfigs = { rules: [] };

function sendMessage(msg, ms) {
  ms = ms || 3000;
  return Promise.race([
    chrome.runtime.sendMessage(msg),
    new Promise(function(_, reject) { setTimeout(function() { reject(new Error('timeout')); }, ms); })
  ]);
}

async function loadConfig() {
  try {
    var resp = await sendMessage({ type: 'getConfig' });
    if (resp && resp.ok) allConfigs = resp.config;
  } catch(e) { console.error('loadConfig error:', e); }
  if (!allConfigs || !allConfigs.rules) allConfigs = { rules: [] };
}

async function saveConfigToStorage() {
  try {
    await sendMessage({ type: 'saveConfig', config: allConfigs });
  } catch(e) { console.error('saveConfig error:', e); }
}

function serializeOne(card) {
  return {
    id: card._id || '',
    name: (card.querySelector('.card-title') || {}).textContent || '',
    enabled: !!(card.querySelector('.toggle') || {}).classList && card.querySelector('.toggle').classList.contains('on'),
    matchPattern: (card.querySelector('.regex-input') || {}).value || '',
    headerMods: serializeHeader(card)
  };
}

function serializeAll() {
  var rules = [];
  cardContainer.querySelectorAll('.card').forEach(function(card) {
    rules.push(serializeOne(card));
  });
  return rules;
}

function serializeHeader(card) {
  var g = card.querySelector('.header-section');
  if (!g) return { on: true, rows: [] };
  var rows = [];
  g.querySelectorAll('.header-rows .kv-row').forEach(function(row) {
    var ins = row.querySelectorAll('input');
    rows.push({ k: ins[0] ? ins[0].value : '', v: ins[1] ? ins[1].value : '' });
  });
  return { on: true, rows: rows };
}

function createHeaderRow(k, v) {
  var div = document.createElement('div');
  div.className = 'kv-row';
  div.style.cssText = 'display: flex; align-items: center; gap: 6px; padding: 2px 0;';
  var i1 = document.createElement('input');
  i1.style.cssText = 'flex:1;background:#16213e;border:1px solid #2a2a4a;color:#eee;border-radius:6px;padding:5px 8px;font-size:12px;min-width:0;';
  i1.placeholder = 'key'; if (k !== undefined) i1.value = k;
  var i2 = document.createElement('input');
  i2.style.cssText = 'flex:1;background:#16213e;border:1px solid #2a2a4a;color:#eee;border-radius:6px;padding:5px 8px;font-size:12px;min-width:0;';
  i2.placeholder = 'value'; if (v !== undefined) i2.value = v;
  var del = document.createElement('span');
  del.className = 'del-btn';
  del.style.cssText = 'color:#e74c3c;cursor:pointer;font-size:14px;flex:0 0 auto;';
  del.textContent = '✕';
  div.appendChild(i1); div.appendChild(i2); div.appendChild(del);
  return div;
}

function showEmptyPlaceholder() {
  var existing = document.getElementById('empty-placeholder');
  if (existing) { existing.style.display = 'block'; return; }
  var div = document.createElement('div');
  div.id = 'empty-placeholder';
  div.style.cssText = 'text-align:center;padding:40px 20px;color:#555;font-size:13px;';
  div.textContent = 'No configurations';
  cardContainer.appendChild(div);
}

function hideEmptyPlaceholder() {
  var existing = document.getElementById('empty-placeholder');
  if (existing) existing.remove();
}

function createHeaderSectionHTML() {
  return '<div class="header-section" style="border:1px solid #2a2a4a;border-radius:8px;overflow:hidden;margin-top:10px;background:#16213e;">' +
    '<div style="padding:8px 10px;font-size:12px;border-bottom:1px solid #2a2a4a;">' +
      '<span style="font-weight:500;color:#ccc;">Request Headers</span>' +
    '</div>' +
    '<div class="mod-row-body" style="display:block;padding:10px 10px 8px;background:#111;">' +
      '<div class="header-rows" style="display:flex;flex-direction:column;gap:4px;"></div>' +
      '<button class="add-header-row" style="width:100%;background:transparent;border:1px dashed #2a2a4a;color:#888;border-radius:8px;padding:6px;cursor:pointer;font-size:11px;margin-top:6px;">＋ Add Row</button>' +
    '</div></div>';
}

function createNewCard(rule) {
  if (!rule) rule = emptyRule();
  hideEmptyPlaceholder();
  var card = document.createElement('div');
  card.className = 'card';
  card._id = rule.id || '';
  card.style.cssText = 'background:#16213e;border:1px solid #2a2a4a;border-radius:8px;overflow:hidden;margin:8px 0;';
  card.innerHTML =
    '<div class="card-head" style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;">' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="display:flex;align-items:center;gap:8px;">' +
          '<span class="arrow" style="font-size:10px;color:#888;cursor:pointer;padding:4px 8px;margin:-4px -8px;">▶</span>' +
          '<span class="card-title" style="font-weight:600;font-size:13px;outline:none;cursor:text;display:inline-block;" contenteditable="false">' + (rule.name || 'New Config') + '</span>' +
        '</div>' +
        '<div class="card-subtitle" style="font-size:11px;color:#888;margin-top:3px;margin-left:18px;">Match: ' + ((rule.matchPattern || '').trim() || 'All requests') + '</div>' +
        '<div class="header-tags" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;margin-left:18px;"></div>' +
      '</div>' +
      '<div class="toggle ' + (rule.enabled !== false ? 'on' : '') + '" style="width:36px;height:20px;background:' + (rule.enabled !== false ? '#00b894' : '#2a2a4a') + ';border-radius:10px;position:relative;flex-shrink:0;cursor:pointer;transition:background .2s;">' +
        '<div style="position:absolute;top:2px;left:' + (rule.enabled !== false ? '18px' : '2px') + ';width:16px;height:16px;background:#fff;border-radius:50%;transition:left .2s;"></div>' +
      '</div>' +
    '</div>' +
    '<div class="card-body" style="display:none;padding:0 12px 12px;border-top:1px solid #2a2a4a;">' +
      '<div style="margin-top:8px;"><label style="display:block;font-size:11px;color:#888;margin-bottom:4px;">URL Regex (empty = all)</label>' +
        '<input class="regex-input" style="width:100%;background:#1a1a2e;border:1px solid #2a2a4a;color:#eee;border-radius:6px;padding:6px 8px;font-size:12px;box-sizing:border-box;" value="' + (rule.matchPattern || '') + '" /></div>' +
      '<div style="margin-top:8px;"><label style="display:block;font-size:11px;color:#888;margin-bottom:4px;"><span>Test URL</span><span class="match-status" style="margin-left:8px;font-size:11px;"></span></label>' +
        '<input class="test-url-input" style="width:100%;background:#1a1a2e;border:1px solid #2a2a4a;color:#eee;border-radius:6px;padding:6px 8px;font-size:12px;box-sizing:border-box;" placeholder="https://api.example.com/api/v1/users/123" /></div>' +
      createHeaderSectionHTML() +
      '<div style="display:flex;gap:8px;margin-top:12px;padding-top:10px;border-top:1px solid #2a2a4a;">' +
        '<button class="btn-delete" title="Delete" style="flex:1;padding:7px;border:none;border-radius:8px;cursor:pointer;font-size:15px;font-weight:700;background:#0f3460;color:#e74c3c;">✕ Delete</button>' +
      '</div>' +
    '</div>';
  cardContainer.appendChild(card);
  bindCardEvents(card);
  restoreHeaderIntoDom(card, rule);
  updateHeaderTags(card);
  return card;
}

function updateHeaderTags(card) {
  var tagsDiv = card.querySelector('.header-tags');
  if (!tagsDiv) return;
  var mods = serializeHeader(card);
  tagsDiv.innerHTML = '';
  if (!mods.on || !mods.rows || !mods.rows.length) return;
  mods.rows.forEach(function(row) {
    if (!row.k) return;
    var tag = document.createElement('span');
    tag.style.cssText = 'display:inline-block;background:#0f3460;color:#8be9fd;border-radius:4px;padding:1px 6px;font-size:10px;white-space:nowrap;font-family:monospace;';
    tag.textContent = row.k + ': ' + (row.v || '');
    tagsDiv.appendChild(tag);
  });
}

function restoreHeaderIntoDom(card, rule) {
  var mods = rule.headerMods;
  if (!mods) return;
  var section = card.querySelector('.header-section');
  if (!section) return;
  var rowsDiv = section.querySelector('.header-rows');
  (mods.rows || []).forEach(function(r) { rowsDiv.appendChild(createHeaderRow(r.k, r.v)); });
}

function bindCardEvents(card) {
  var saveTimer = null;
  function autoSave() {
    updateHeaderTags(card);
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async function() {
      allConfigs.rules = serializeAll();
      await saveConfigToStorage();
    }, 300);
  }
  card._autoSave = autoSave;
  card.addEventListener('input', autoSave);
  card.addEventListener('click', function() { setTimeout(autoSave, 0); });

  // Arrow expand/collapse
  var arrow = card.querySelector('.arrow');
  arrow.addEventListener('click', function(e) {
    e.stopPropagation();
    var body = card.querySelector('.card-body');
    if (body.style.display === 'none' || !body.style.display) {
      cardContainer.querySelectorAll('.card').forEach(function(c) {
        if (c !== card) { var cb2 = c.querySelector('.card-body'); if (cb2) cb2.style.display = 'none'; var ca2 = c.querySelector('.arrow'); if (ca2) ca2.textContent = '▶'; }
      });
      body.style.display = 'block'; arrow.textContent = '▼';
    } else { body.style.display = 'none'; arrow.textContent = '▶'; }
  });

  // Title edit
  var titleSpan = card.querySelector('.card-title');
  titleSpan.addEventListener('click', function(e) { e.stopPropagation(); this.contentEditable = 'true'; this.focus(); });
  titleSpan.addEventListener('blur', function() { this.contentEditable = 'false'; this.textContent = this.textContent.trim() || 'Untitled'; autoSave(); });
  titleSpan.addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); this.blur(); } });

  // Enable toggle
  var toggle = card.querySelector('.toggle');
  toggle.addEventListener('click', function(e) {
    e.stopPropagation();
    if (this.classList.contains('on')) {
      this.classList.remove('on'); this.style.background = '#2a2a4a'; this.querySelector('div').style.left = '2px'; card.style.opacity = '0.6';
    } else { this.classList.add('on'); this.style.background = '#00b894'; this.querySelector('div').style.left = '18px'; card.style.opacity = '1'; }
    autoSave();
  });

  // Regex subtitle update
  var regexInput = card.querySelector('.regex-input');
  if (regexInput) regexInput.addEventListener('input', function() {
    var s = card.querySelector('.card-subtitle'); if (s) s.textContent = 'Match: ' + (this.value.trim() || 'All requests');
  });
  // Test URL matching
  var testInput = card.querySelector('.test-url-input');
  var matchStatus = card.querySelector('.match-status');
  if (regexInput && testInput && matchStatus) {
    function testMatch() {
      var p = regexInput.value.trim(), u = testInput.value.trim();
      if (!u) { matchStatus.textContent = ''; return; }
      if (!p) { matchStatus.textContent = 'Matches all'; matchStatus.style.color = '#888'; return; }
      try { if (new RegExp(p).test(u)) { matchStatus.textContent = 'Matched'; matchStatus.style.color = '#00b894'; } else { matchStatus.textContent = 'Not matched'; matchStatus.style.color = '#e74c3c'; } }
      catch(err) { matchStatus.textContent = 'Regex error'; matchStatus.style.color = '#fdcb6e'; }
    }
    regexInput.addEventListener('input', testMatch);
    testInput.addEventListener('input', testMatch);
  }

}

// --- Global event delegation ---
root.addEventListener('click', async function(e) {
  if (e.target.classList.contains('add-header-row')) {
    e.stopPropagation();
    e.target.closest('.mod-row-body').querySelector('.header-rows').appendChild(createHeaderRow());
  }
  if (e.target.classList.contains('del-btn')) {
    e.stopPropagation();
    var row = e.target.closest('.kv-row'); if (row) row.remove();
  }
  if (e.target.classList.contains('btn-delete')) {
    e.stopPropagation();
    e.target.closest('.card').remove();
    allConfigs.rules = serializeAll();
    await saveConfigToStorage();
    if (!cardContainer.querySelector('.card')) showEmptyPlaceholder();
  }
});

// --- New button ---
root.querySelector('.btn-new').addEventListener('click', async function() {
  var rule = emptyRule();
  var card = createNewCard(rule);
  card.querySelector('.arrow').click();
  allConfigs.rules = serializeAll();
  await saveConfigToStorage();
});

// --- Import ---
root.querySelector('.btn-import').addEventListener('click', function() {
  var fi = document.createElement('input');
  fi.type = 'file'; fi.accept = '.json';
  fi.addEventListener('change', function() {
    var file = fi.files[0]; if (!file) return;
    var reader = new FileReader();
    reader.onload = async function(ev) {
      try {
        var data = JSON.parse(ev.target.result);
        var rules = Array.isArray(data) ? data : (data.rules || [data]);
        // Migrate old format: convert requestMods.header → headerMods
        rules.forEach(function(r) {
          if (r.requestMods && r.requestMods.header) {
            r.headerMods = r.requestMods.header;
            delete r.requestMods;
          }
          if (r.responseMods) delete r.responseMods;
        });
        rules.forEach(function(r) { createNewCard(r); });
        allConfigs.rules = serializeAll();
        await saveConfigToStorage();
      } catch(err) { alert('Invalid JSON: ' + err.message); }
    };
    reader.readAsText(file);
  });
  fi.click();
});

// --- Export ---
root.querySelector('.btn-export').addEventListener('click', function() {
  allConfigs.rules = serializeAll();
  var blob = new Blob([JSON.stringify(allConfigs.rules, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = 'request-rewriter-configs.json';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

// --- Plugin toggle ---
toggleBtn.addEventListener('click', async function() {
  allConfigs.rules = serializeAll();
  await saveConfigToStorage();
  try {
    var enabled = toggleBtn.dataset.enabled === 'true';
    var resp = await sendMessage({ type: enabled ? 'disable' : 'enable' });
    if (!resp.ok) throw new Error(resp.error);
    renderStatus(resp.enabled);
  } catch(err) { alert(err.message); }
});

async function refreshStatus() {
  try {
    var resp = await sendMessage({ type: 'status' });
    if (!resp.ok) throw new Error(resp.error);
    renderStatus(resp.enabled);
  } catch(err) { console.error('status error:', err); }
}

function renderStatus(enabled) {
  toggleBtn.dataset.enabled = String(enabled);
  toggleBtn.style.background = enabled ? '#00b894' : '#2a2a4a';
  var knob = document.getElementById('toggle-knob');
  if (knob) knob.style.left = enabled ? '18px' : '2px';
  var icon = document.getElementById('rw-icon');
  if (icon) icon.style.background = enabled ? '#00b894' : '#555';
}

// --- Init ---
(async function init() {
  try {
    await loadConfig();
    if (allConfigs.rules && allConfigs.rules.length) {
      // Migrate old format
      allConfigs.rules.forEach(function(r) {
        if (r.requestMods && r.requestMods.header) {
          r.headerMods = r.requestMods.header;
          delete r.requestMods;
        }
        if (r.responseMods) delete r.responseMods;
      });
      allConfigs.rules.forEach(function(r) { createNewCard(r); });
    } else {
      showEmptyPlaceholder();
    }
    await refreshStatus();
  } catch(e) {
    console.error('init error:', e);
    if (!cardContainer.children.length) showEmptyPlaceholder();
  }
})();
