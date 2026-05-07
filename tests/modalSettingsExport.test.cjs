const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadScripts } = require('./helpers/loadBrowserModules.cjs');

const root = path.resolve(__dirname, '..');

function script(relativePath) {
    return path.join(root, relativePath);
}

test('Modal settings export uses AppSettingsService exportData', () => {
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

    let exportCalls = 0;
    context.window.AppSettingsService.exportData = () => {
        exportCalls++;
        return { funds: [], trades: [] };
    };

    const listeners = {};
    const btnExport = {
        addEventListener(event, handler) {
            listeners[event] = handler;
        }
    };

    context.document = {
        querySelectorAll() { return []; },
        querySelector() { return null; },
        getElementById(id) {
            if (id === 'btn-settings-export') return btnExport;
            if (id === 'btn-save-settings' || id === 'btn-settings-import' || id === 'btn-settings-clear') return null;
            return null;
        },
        createElement() {
            return {
                click() {}
            };
        }
    };
    context.window.document = context.document;
    context.URL.createObjectURL = () => 'blob:test';
    context.URL.revokeObjectURL = () => {};
    context.Blob = function Blob(content, options) {
        this.content = content;
        this.options = options;
    };
    context.window.Utils.showToast = () => {};

    context.window.Modal.bindSettingsEvents();
    listeners.click();

    assert.equal(exportCalls, 1);
});
