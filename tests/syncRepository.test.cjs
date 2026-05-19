const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function loadSyncRepositoryModule() {
    const filePath = path.join(root, 'functions/_shared/syncRepository.js');
    const code = fs.readFileSync(filePath, 'utf8')
        .replace(/export\s+async\s+function\s+(\w+)\s*\(/g, 'async function $1(')
        .replace(/export\s+function\s+(\w+)\s*\(/g, 'function $1(')
        + '\nmodule.exports = { getSnapshot, updateSnapshot, appendChangeLogs };';

    const context = {
        console,
        JSON,
        module: { exports: {} },
        exports: {}
    };

    vm.createContext(context);
    vm.runInContext(code, context, { filename: filePath });
    return context.module.exports;
}

test('updateSnapshot upserts app snapshot when main row is missing', async () => {
    const { updateSnapshot } = loadSyncRepositoryModule();
    const sqlCalls = [];

    const env = {
        DB: {
            prepare(sql) {
                sqlCalls.push(sql);
                return {
                    bind() {
                        return this;
                    },
                    async first() {
                        return null;
                    },
                    async run() {
                        return { success: true };
                    }
                };
            }
        }
    };

    const result = await updateSnapshot(env, {
        funds: [{ id: 'fund-1', syncId: 'fund-1' }],
        trades: [{ id: 'trade-1', syncId: 'trade-1' }]
    }, 'default');

    assert.equal(result.success, true);
    assert.equal(result.revision, 1);
    assert.equal(sqlCalls.some(sql => sql.includes('INSERT INTO app_snapshot')), true);
});
