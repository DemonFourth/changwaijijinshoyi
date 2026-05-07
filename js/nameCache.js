/**
 * 基金名称本地缓存
 * 存储验证正确的基金名称，作为兜底数据源
 */

const NameCache = {
    CACHE_KEY: 'fund_calculator_name_cache',
    DEFAULT_TTL: 30 * 24 * 60 * 60 * 1000,

    get(fundCode) {
        const cache = NameCache.loadCache();
        if (!cache) return null;

        const entry = cache[fundCode];
        if (!entry) return null;

        const now = Date.now();
        if (now - entry.timestamp > NameCache.DEFAULT_TTL) {
            delete cache[fundCode];
            NameCache.saveCache(cache);
            return null;
        }

        return entry;
    },

    set(fundCode, name, source) {
        const cache = NameCache.loadCache() || {};

        cache[fundCode] = {
            name: name,
            source: source || 'api',
            timestamp: Date.now(),
            updateTime: new Date().toISOString()
        };

        NameCache.saveCache(cache);
    },

    remove(fundCode) {
        const cache = NameCache.loadCache();
        if (!cache || !cache[fundCode]) return false;

        delete cache[fundCode];
        NameCache.saveCache(cache);
        return true;
    },

    clear() {
        Storage.remove(NameCache.CACHE_KEY);
    },

    getAll() {
        return NameCache.loadCache() || {};
    },

    getStats() {
        const cache = NameCache.loadCache() || {};
        const entries = Object.keys(cache).length;
        const now = Date.now();
        let validEntries = 0;
        let expiredEntries = 0;

        for (const code in cache) {
            if (Object.prototype.hasOwnProperty.call(cache, code)) {
                if (now - cache[code].timestamp <= NameCache.DEFAULT_TTL) {
                    validEntries++;
                } else {
                    expiredEntries++;
                }
            }
        }

        return {
            total: entries,
            valid: validEntries,
            expired: expiredEntries
        };
    },

    cleanup() {
        const cache = NameCache.loadCache();
        if (!cache) return 0;

        const now = Date.now();
        let removed = 0;

        for (const code in cache) {
            if (Object.prototype.hasOwnProperty.call(cache, code)) {
                if (now - cache[code].timestamp > NameCache.DEFAULT_TTL) {
                    delete cache[code];
                    removed++;
                }
            }
        }

        if (removed > 0) {
            NameCache.saveCache(cache);
        }

        return removed;
    },

    loadCache() {
        return Storage.load(NameCache.CACHE_KEY);
    },

    saveCache(cache) {
        Storage.save(NameCache.CACHE_KEY, cache);
    }
};

ModuleRegistry.register('NameCache', NameCache);
