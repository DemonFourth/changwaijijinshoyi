const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadScripts } = require('./helpers/loadBrowserModules.cjs');

const root = path.resolve(__dirname, '..');

function script(relativePath) {
    return path.join(root, relativePath);
}

test('Modal edit fund success does not manually emit FUND_UPDATED', async () => {
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
        script('js/modal.js')
    ]);

    const events = [];
    const listeners = {};
    let hideCalls = 0;
    let refreshCalls = 0;

    const originalEmit = context.window.EventBus.emit.bind(context.window.EventBus);
    context.window.EventBus.emit = (event, payload) => {
        events.push(event);
        return originalEmit(event, payload);
    };

    context.window.FundManager = {
        getFund() {
            return { id: 'fund-1', code: '000001', name: '旧名称', remark: '旧备注' };
        },
        async updateFund() {
            return true;
        }
    };
    context.FundManager = context.window.FundManager;
    context.window.NameCache = {
        set() {}
    };
    context.NameCache = context.window.NameCache;
    context.window.Detail = {
        refresh() {
            refreshCalls++;
        }
    };
    context.Detail = context.window.Detail;
    context.window.Utils.showToast = () => {};
    context.window.Modal.hide = () => {
        hideCalls++;
    };

    context.document = {
        getElementById(id) {
            if (id === 'input-edit-fund-name') {
                return {
                    value: '新名称',
                    addEventListener(event, handler) {
                        listeners[id + ':' + event] = handler;
                    }
                };
            }
            if (id === 'input-edit-fund-remark') {
                return {
                    value: '新备注'
                };
            }
            if (id === 'btn-confirm-edit-fund') {
                return {
                    addEventListener(event, handler) {
                        listeners[id + ':' + event] = handler;
                    }
                };
            }
            if (id === 'btn-edit-refresh-name' || id === 'edit-name-source-badge' || id === 'edit-name-status') {
                return null;
            }
            return null;
        },
        querySelector() {
            return null;
        },
        querySelectorAll() {
            return [];
        },
        addEventListener() {}
    };
    context.window.document = context.document;

    context.window.Modal.bindEditFundEvents({ fundId: 'fund-1' });
    await listeners['btn-confirm-edit-fund:click']();

    assert.equal(hideCalls, 1);
    assert.equal(refreshCalls, 1);
    assert.equal(events.filter(event => event === context.window.EventType.FUND_UPDATED).length, 0);
});
