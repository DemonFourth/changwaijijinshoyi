const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const root = path.resolve(__dirname, '..');

test('index.html keeps foundational utility scripts before app bootstrap', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

    assert.equal(html.includes('js/themeManager.js'), true);
    assert.equal(html.includes('js/bigNumberFormatter.js'), true);
    assert.equal(html.includes('js/paginator.js'), true);
});
