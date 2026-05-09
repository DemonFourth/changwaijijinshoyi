const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadScripts } = require('./helpers/loadBrowserModules.cjs');

const root = path.resolve(__dirname, '..');

function script(relativePath) {
    return path.join(root, relativePath);
}

test('Router.navigate relies on hashchange instead of emitting PAGE_CHANGED twice', () => {
    const context = loadScripts([
        script('js/namespace.js'),
        script('js/moduleRegistry.js'),
        script('js/eventBus.js'),
        script('js/router.js')
    ]);

    const emitted = [];
    context.window.location = { hash: '' };
    context.window.EventBus.emit = (event, payload) => {
        emitted.push({ event, payload });
    };

    context.window.Router.navigate('detail', { fundId: 'fund-1' });

    assert.equal(emitted.length, 0);
    assert.equal(context.window.location.hash, 'detail?fundId=fund-1');
});
