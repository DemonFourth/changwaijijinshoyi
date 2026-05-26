const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadScripts } = require('./helpers/loadBrowserModules.cjs');

const root = path.resolve(__dirname, '..');

function script(relativePath) {
    return path.join(root, relativePath);
}

test('Modal import uses AppSettingsService importData and does not emit duplicate DATA_IMPORTED', async () => {
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
        script('js/application/importAppService.js'),
        script('js/application/appSettingsService.js'),
        script('js/modal.js')
    ]);

    const listeners = {};
    const importedEvents = [];
    const fileInput = {
        files: [
            {
                name: 'import.json'
            }
        ]
    };

    // 模拟 Repositories（绑定导入时的 analyzeImportData 需要）
    context.window.FundRepository = {
        getAll: () => [],
        saveAll: () => true
    };
    context.window.TradeRepository = {
        getAll: () => [],
        saveAll: () => true
    };

    // 模拟 ImportPreviewHelper（绑定导入时自动完成导入流程）
    // 注意：modal.js 中直接引用 ImportPreviewHelper（非 window.），需设为全局变量
    context.ImportPreviewHelper = {
        show: function(analysis) {
            if (analysis && analysis.normalized) {
                context.window.ImportAppService.importData(analysis.normalized, { merge: true });
            }
        }
    };

    context.window.EventBus.on(context.window.EventType.DATA_IMPORTED, (payload) => {
        importedEvents.push(payload);
    });

    context.document = {
        querySelectorAll() { return []; },
        querySelector() { return null; },
        getElementById(id) {
            if (id === 'input-import-file') {
                return fileInput;
            }
            if (id === 'input-merge-data') {
                return { checked: true };
            }
            if (id === 'btn-confirm-import') {
                return {
                    addEventListener(event, handler) {
                        listeners[event] = handler;
                    }
                };
            }
            return null;
        },
        createElement() {
            return null;
        }
    };
    context.window.document = context.document;
    context.window.Utils.showToast = () => {};
    context.window.Modal.hide = () => {};
    context.FileReader = function FileReader() {
        this.onload = null;
        this.readAsText = () => {
            this.onload({
                target: {
                    result: JSON.stringify({ funds: [] })
                }
            });
        };
    };
    context.window.FileReader = context.FileReader;
    context.window.AppSettingsService.importData = async (data, merge) => {
        context.window.EventBus.emit(context.window.EventType.DATA_IMPORTED, { data, merge });
        return { success: true, mode: merge ? 'merge' : 'overwrite' };
    };

    context.window.Modal.bindImportEvents();
    await listeners.click();

    assert.equal(importedEvents.length, 1);
});

test('Modal settings import uses AppSettingsService importData and does not emit duplicate DATA_IMPORTED', async () => {
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
        script('js/application/importAppService.js'),
        script('js/application/appSettingsService.js'),
        script('js/modal.js')
    ]);

    const importedEvents = [];
    let createdInput = null;
    const buttonListeners = {};

    context.window.EventBus.on(context.window.EventType.DATA_IMPORTED, (payload) => {
        importedEvents.push(payload);
    });

    context.document = {
        querySelectorAll() { return []; },
        querySelector() { return null; },
        getElementById(id) {
            if (id === 'btn-settings-import') {
                return {
                    addEventListener(event, handler) {
                        buttonListeners[event] = handler;
                    }
                };
            }
            if (id === 'btn-save-settings' || id === 'btn-settings-export' || id === 'btn-settings-clear') {
                return null;
            }
            return null;
        },
        createElement() {
            createdInput = {
                type: '',
                accept: '',
                onchange: null,
                click() {}
            };
            return createdInput;
        }
    };
    context.window.document = context.document;
    context.window.Utils.showToast = () => {};
    context.window.AppSettingsService.importData = async (data, merge) => {
        context.window.EventBus.emit(context.window.EventType.DATA_IMPORTED, { data, merge });
        return { success: true, mode: 'overwrite' };
    };

    context.window.Modal.bindSettingsEvents();
    buttonListeners.click();

    await createdInput.onchange({
        target: {
            files: [
                {
                    async text() {
                        return JSON.stringify({ trades: [] });
                    }
                }
            ]
        }
    });

    assert.equal(importedEvents.length, 1);
});
