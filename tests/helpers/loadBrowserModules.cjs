const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createLocalStorage() {
    const store = new Map();

    return {
        getItem(key) {
            return store.has(key) ? store.get(key) : null;
        },
        setItem(key, value) {
            store.set(key, String(value));
        },
        removeItem(key) {
            store.delete(key);
        },
        clear() {
            store.clear();
        },
        key(index) {
            return Array.from(store.keys())[index] || null;
        },
        get length() {
            return store.size;
        }
    };
}

function createContext() {
    const localStorage = createLocalStorage();
    const window = {
        localStorage,
        addEventListener() {},
        removeEventListener() {}
    };

    const context = {
        console,
        window,
        localStorage,
        setTimeout,
        clearTimeout,
        Date,
        Math,
        JSON,
        Map,
        Set,
        URL,
        Blob,
        navigator: {},
        document: {
            addEventListener() {},
            getElementById() { return null; },
            querySelector() { return null; },
            querySelectorAll() { return []; },
            createElement() {
                return {
                    click() {},
                    style: {}
                };
            }
        }
    };

    window.window = window;
    window.document = context.document;

    return vm.createContext(context);
}

function loadScripts(scriptPaths) {
    const context = createContext();

    scriptPaths.forEach(scriptPath => {
        const absolutePath = path.resolve(scriptPath);
        const code = fs.readFileSync(absolutePath, 'utf8');
        vm.runInContext(code, context, { filename: absolutePath });
    });

    return context;
}

module.exports = {
    loadScripts
};
