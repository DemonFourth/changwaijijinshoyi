const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadScripts } = require('./helpers/loadBrowserModules.cjs');

const root = path.resolve(__dirname, '..');

function script(relativePath) {
    return path.join(root, relativePath);
}

function createModalElements() {
    const elements = {
        'modal-container': {
            className: '',
            classList: {
                added: [],
                removed: [],
                add(value) { this.added.push(value); },
                remove(value) { this.removed.push(value); }
            }
        },
        'modal-title': { textContent: '' },
        'modal-body': { innerHTML: '', scrollTop: 0 },
        'modal-footer': { innerHTML: '' }
    };

    return {
        elements,
        getElementById(id) {
            return elements[id] || null;
        }
    };
}

test('Modal uses modal config map to render and bind export modal', () => {
    const context = loadScripts([
        script('js/namespace.js'),
        script('js/moduleRegistry.js'),
        script('js/eventBus.js'),
        script('js/config.js'),
        script('js/utils.js'),
        script('js/storage.js'),
        script('js/storage/schema.js'),
        script('js/storage/migrations.js'),
        script('js/storage/localStorageAdapter.js'),
        script('js/application/appSettingsService.js'),
        script('js/modal.js')
    ]);

    const documentStub = createModalElements();
    context.document = documentStub;
    context.window.document = documentStub;

    let bindCalled = 0;
    context.window.Modal.renderExportForm = () => ({ content: '<p>export</p>', actions: '<button>ok</button>' });
    context.window.Modal.bindExportEvents = () => {
        bindCalled++;
    };

    context.window.Modal.show('export');

    assert.ok(context.window.Modal.modalConfigs, 'expected modalConfigs to exist');
    assert.equal(typeof context.window.Modal.modalConfigs.export.render, 'function');
    assert.equal(typeof context.window.Modal.modalConfigs.export.bind, 'function');
    assert.equal(documentStub.elements['modal-title'].textContent, '导出数据');
    assert.equal(documentStub.elements['modal-body'].innerHTML, '<p>export</p>');
    assert.equal(bindCalled, 1);
});
