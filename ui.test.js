import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';

const popupHtml = readFileSync(new URL('./popup.html', import.meta.url), 'utf8');
const popupJsRaw = readFileSync(new URL('./popup.js', import.meta.url), 'utf8');
const rulesJsRaw = readFileSync(new URL('./rules.js', import.meta.url), 'utf8');

const popupJs = popupJsRaw.replace(
  'import { DEFAULT_CONFIG, validateConfig, emptyRule } from "./rules.js";',
  ''
);
const rulesJs = rulesJsRaw
  .replace('export const DEFAULT_CONFIG', 'const DEFAULT_CONFIG')
  .replace(/export function /g, 'function ');

function createMockChrome() {
  const storage = { config: { rules: [] }, pluginEnabled: false };
  return {
    storage: {
      local: {
        get: async (key) => {
          if (key === 'config') return { config: storage.config };
          if (key === 'pluginEnabled') return { pluginEnabled: storage.pluginEnabled };
          return {};
        },
        set: async (obj) => {
          if (obj.config) storage.config = obj.config;
          if (obj.pluginEnabled !== undefined) storage.pluginEnabled = obj.pluginEnabled;
        }
      }
    },
    runtime: {
      onMessage: { addListener: () => {} },
      onInstalled: { addListener: () => {} },
      sendMessage: async (msg) => {
        if (msg.type === 'getConfig') return { ok: true, config: storage.config };
        if (msg.type === 'saveConfig') { storage.config = msg.config; return { ok: true }; }
        if (msg.type === 'status') return { ok: true, enabled: storage.pluginEnabled };
        if (msg.type === 'enable') { storage.pluginEnabled = true; return { ok: true, enabled: true }; }
        if (msg.type === 'disable') { storage.pluginEnabled = false; return { ok: true, enabled: false }; }
        return { ok: true };
      }
    },
    declarativeNetRequest: {
      getSessionRules: async () => [],
      updateSessionRules: async () => {}
    },
    _storage: storage
  };
}

async function setupDom(preConfig) {
  const dom = new JSDOM(popupHtml.replace(
    '<script type="module" src="popup.js"></script>',
    ''
  ), { runScripts: 'outside-only', pretendToBeVisual: true });

  const chrome = createMockChrome();
  if (preConfig) chrome._storage.config = JSON.parse(JSON.stringify(preConfig));
  dom.window.chrome = chrome;
  dom.window._mockStorage = chrome._storage;

  dom.window.eval(rulesJs);
  dom.window.eval(popupJs);
  await new Promise(r => setTimeout(r, 100));
  return dom;
}

function createCard(dom) {
  const newBtn = dom.window.document.querySelector('.btn-new');
  newBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
}

function expandCard(dom) {
  const arrow = dom.window.document.querySelector('.arrow');
  arrow.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
}

describe('Initial Load (empty)', () => {
  let dom;
  before(async () => { dom = await setupDom(); });
  after(() => { dom.window.close(); });

  it('should NOT create any card when no saved rules exist', () => {
    assert.equal(dom.window.document.querySelectorAll('.card').length, 0);
  });

  it('should show empty placeholder "No configurations"', () => {
    const ph = dom.window.document.getElementById('empty-placeholder');
    assert(ph, 'placeholder should exist');
    assert.equal(ph.textContent, 'No configurations');
  });

  it('should show toggle switch as off', () => {
    var btn = dom.window.document.getElementById('toggle-btn');
    assert(btn, 'toggle button should exist');
    assert.equal(btn.dataset.enabled !== 'true', true);
  });
});

describe('New Button', () => {
  let dom;
  before(async () => { dom = await setupDom(); });
  after(() => { dom.window.close(); });

  it('should create first card when + clicked', async () => {
    createCard(dom);
    await new Promise(r => setTimeout(r, 50));
    assert.equal(dom.window.document.querySelectorAll('.card').length, 1);
  });

  it('should hide empty placeholder when card is created', () => {
    assert(!dom.window.document.getElementById('empty-placeholder'));
  });

  it('should persist new card to storage', () => {
    assert.equal(dom.window.chrome._storage.config.rules.length, 1);
  });

  it('should create second card when + clicked again', async () => {
    createCard(dom);
    await new Promise(r => setTimeout(r, 50));
    assert.equal(dom.window.document.querySelectorAll('.card').length, 2);
  });
});

describe('Expand/Collapse', () => {
  let dom;
  before(async () => { dom = await setupDom(); createCard(dom); await new Promise(r => setTimeout(r, 50)); });
  after(() => { dom.window.close(); });

  it('should have card expanded after create', () => {
    const body = dom.window.document.querySelector('.card-body');
    assert.equal(body.style.display, 'block');
  });

  it('should collapse card when arrow clicked', () => {
    const arrow = dom.window.document.querySelector('.arrow');
    arrow.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    const body = dom.window.document.querySelector('.card-body');
    assert.equal(body.style.display, 'none');
  });

  it('should re-expand card when arrow clicked again', () => {
    const arrow = dom.window.document.querySelector('.arrow');
    arrow.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    const body = dom.window.document.querySelector('.card-body');
    assert.equal(body.style.display, 'block');
  });

  it('should NOT expand when clicking title', () => {
    const title = dom.window.document.querySelector('.card-title');
    const body = dom.window.document.querySelector('.card-body');
    body.style.display = 'none';
    title.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    assert.equal(body.style.display, 'none');
  });
});

describe('Delete Button', () => {
  let dom;
  before(async () => { dom = await setupDom(); createCard(dom); createCard(dom); });
  after(() => { dom.window.close(); });

  it('should delete card and persist to storage', async () => {
    const deleteBtn = dom.window.document.querySelector('.btn-delete');
    deleteBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 50));
    assert.equal(dom.window.document.querySelectorAll('.card').length, 1);
    assert.equal(dom.window.chrome._storage.config.rules.length, 1);
  });

  it('should show placeholder after deleting last card', async () => {
    const deleteBtn = dom.window.document.querySelector('.btn-delete');
    deleteBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 50));
    assert.equal(dom.window.document.querySelectorAll('.card').length, 0);
    const ph = dom.window.document.getElementById('empty-placeholder');
    assert(ph);
    assert.equal(ph.textContent, 'No configurations');
  });
});

describe('Auto-Save', () => {
  let dom;
  before(async () => { dom = await setupDom(); createCard(dom); await new Promise(r => setTimeout(r, 50)); });
  after(() => { dom.window.close(); });

  it('should auto-save when regex changes', async () => {
    const regexInput = dom.window.document.querySelector('.regex-input');
    regexInput.value = 'new-pattern';
    regexInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 500));

    assert.equal(dom.window.chrome._storage.config.rules[0].matchPattern, 'new-pattern');
  });

  it('should auto-save when header row added', async () => {
    const addBtn = dom.window.document.querySelector('.add-header-row');
    addBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 500));

    assert.equal(dom.window.chrome._storage.config.rules[0].headerMods.rows.length, 1);
  });

  it('should auto-save when header key changes', async () => {
    const inputs = dom.window.document.querySelectorAll('.header-rows .kv-row input');
    inputs[0].value = 'X-Custom';
    inputs[0].dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 500));

    assert.equal(dom.window.chrome._storage.config.rules[0].headerMods.rows[0].k, 'X-Custom');
  });

  it('should auto-save when title changes', async () => {
    const title = dom.window.document.querySelector('.card-title');
    title.textContent = 'Renamed';
    title.dispatchEvent(new dom.window.Event('blur', { bubbles: true }));
    await new Promise(r => setTimeout(r, 500));

    assert.equal(dom.window.chrome._storage.config.rules[0].name, 'Renamed');
  });

  it('should auto-save when enable toggle clicked', async () => {
    const toggle = dom.window.document.querySelector('.toggle');
    toggle.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 500));

    assert.equal(dom.window.chrome._storage.config.rules[0].enabled, false);
  });
});

describe('Header Section', () => {
  let dom;
  before(async () => { dom = await setupDom(); createCard(dom); await new Promise(r => setTimeout(r, 50)); });
  after(() => { dom.window.close(); });

  it('should always show header section expanded by default', () => {
    const body = dom.window.document.querySelector('.header-section .mod-row-body');
    assert(body, 'header mod-row-body should exist');
    assert.equal(body.style.display, 'block');
  });

  it('should add a header row when add-header-row clicked', () => {
    const addBtn = dom.window.document.querySelector('.add-header-row');
    addBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    const rows = dom.window.document.querySelectorAll('.header-section .header-rows .kv-row');
    assert.equal(rows.length, 1);
  });

  it('should set headerMods.on to true in serialized data', () => {
    // auto-save happens on input; trigger it
    const regexInput = dom.window.document.querySelector('.regex-input');
    regexInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    assert.equal(dom.window.chrome._storage.config.rules[0].headerMods.on, true);
  });
});

describe('Toggle (enable/disable)', () => {
  let dom;
  before(async () => { dom = await setupDom(); createCard(dom); });
  after(() => { dom.window.close(); });

  it('should toggle enabled state', () => {
    const toggle = dom.window.document.querySelector('.toggle');
    assert(toggle.classList.contains('on'));
    toggle.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    assert(!toggle.classList.contains('on'));
  });
});

describe('Header Restore Bug', () => {
  it('should NOT add empty header rows on restore with headerMods.on=true', async () => {
    const rule = {
      id: 'test123', name: 'Test Rule', enabled: true, matchPattern: 'test',
      headerMods: { on: true, rows: [{ k: 'X-Test', v: '1' }, { k: 'X-Foo', v: 'bar' }] }
    };
    const dom = await setupDom({ rules: [rule] });
    const rows = dom.window.document.querySelectorAll('.header-section .header-rows .kv-row');
    assert.equal(rows.length, 2);
    assert.equal(rows[0].querySelectorAll('input')[0].value, 'X-Test');
    // no dirty dot in auto-save mode
    assert(!dom.window.document.querySelector('.dirty-dot'));
    dom.window.close();
  });
});

describe('Persistence Across Reload', () => {
  it('should restore saved rules on reload without dirty dot', async () => {
    const dom = await setupDom();
    createCard(dom);

    const regexInput = dom.window.document.querySelector('.regex-input');
    regexInput.value = 'test-persist';
    regexInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    // auto-save with debounce
    await new Promise(r => setTimeout(r, 500));

    const savedConfig = JSON.parse(JSON.stringify(dom.window.chrome._storage.config));
    dom.window.close();

    const dom2 = await setupDom(savedConfig);
    assert.equal(dom2.window.document.querySelector('.regex-input').value, 'test-persist');
    assert(!dom2.window.document.querySelector('.dirty-dot'));
    assert.equal(dom2.window.document.querySelectorAll('.card').length, 1);
    dom2.window.close();
  });

  it('should show placeholder when reloading with empty config', async () => {
    const dom = await setupDom();
    assert(dom.window.document.getElementById('empty-placeholder'));
    dom.window.close();
  });
});

describe('Old Format Migration', () => {
  it('should migrate old requestMods.header to headerMods', async () => {
    const oldRule = {
      id: 'old1', name: 'Old Rule', enabled: true, matchPattern: 'test',
      requestMods: { header: { on: true, rows: [{ k: 'X-Old', v: '1' }] }, body: { on: false } },
      responseMods: { header: { on: false, rows: [] }, body: { on: false } }
    };
    const dom = await setupDom({ rules: [oldRule] });
    const rows = dom.window.document.querySelectorAll('.header-section .header-rows .kv-row');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].querySelectorAll('input')[0].value, 'X-Old');
    dom.window.close();
  });
});
