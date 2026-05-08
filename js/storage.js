/**
 * 存储管理器
 * 封装localStorage操作，提供数据持久化功能
 */

const Storage = {
    save(key, data) {
        try {
            const serialized = JSON.stringify(data);
            localStorage.setItem(key, serialized);
            return true;
        } catch (error) {
            console.error('Storage save failed:', error);

            if (error.name === 'QuotaExceededError') {
                console.error('localStorage quota exceeded');
                Utils.showToast('存储空间不足，请清理数据', 'error');
            }

            return false;
        }
    },

    load(key) {
        try {
            const serialized = localStorage.getItem(key);
            if (serialized === null) {
                return null;
            }
            return JSON.parse(serialized);
        } catch (error) {
            console.error('Storage load failed:', error);
            return null;
        }
    },

    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Storage remove failed:', error);
            return false;
        }
    },

    clear() {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            console.error('Storage clear failed:', error);
            return false;
        }
    },

    has(key) {
        return localStorage.getItem(key) !== null;
    },

    keys() {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            keys.push(localStorage.key(i));
        }
        return keys;
    },

    getSize() {
        let size = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            size += key.length + value.length;
        }
        return size * 2;
    },

    getUsage() {
        const size = this.getSize();
        const maxSize = 5 * 1024 * 1024;

        return {
            used: size,
            total: maxSize,
            percent: (size / maxSize * 100).toFixed(2),
            usedMB: (size / 1024 / 1024).toFixed(2),
            totalMB: (maxSize / 1024 / 1024).toFixed(2)
        };
    },

    saveFunds(funds) {
        if (typeof window.LocalStorageAdapter !== 'undefined') {
            return window.LocalStorageAdapter.saveFunds(funds);
        }

        return this.save(Config.get('storage.fundsKey'), funds);
    },

    loadFunds() {
        if (typeof window.LocalStorageAdapter !== 'undefined') {
            return window.LocalStorageAdapter.loadFunds();
        }

        return this.load(Config.get('storage.fundsKey')) || [];
    },

    saveTrades(trades) {
        if (typeof window.LocalStorageAdapter !== 'undefined') {
            return window.LocalStorageAdapter.saveTrades(trades);
        }

        return this.save(Config.get('storage.tradesKey'), trades);
    },

    loadTrades() {
        if (typeof window.LocalStorageAdapter !== 'undefined') {
            return window.LocalStorageAdapter.loadTrades();
        }

        return this.load(Config.get('storage.tradesKey')) || [];
    },

    saveSettings(settings) {
        return this.save(Config.get('storage.settingsKey'), settings);
    },

    loadSettings() {
        const key = Config.get('storage.settingsKey');
        const settings = this.load(key) || {};

        if (settings.defaultBuyFee !== undefined && settings.defaultBuyFeeRate === undefined) {
            settings.defaultBuyFeeRate = settings.defaultBuyFee;
            delete settings.defaultBuyFee;
            this.save(key, settings);
        }
        if (settings.defaultSellFee !== undefined && settings.defaultSellFeeRate === undefined) {
            settings.defaultSellFeeRate = settings.defaultSellFee;
            delete settings.defaultSellFee;
            this.save(key, settings);
        }

        return settings;
    },

    saveTheme(theme) {
        return this.save(Config.get('storage.themeKey'), theme);
    },

    loadTheme() {
        return this.load(Config.get('storage.themeKey')) || Config.get('app.defaultTheme');
    },

    saveViewPrefs(prefs) {
        return this.save('fund_calculator_view_prefs', prefs);
    },

    loadViewPrefs() {
        const saved = this.load('fund_calculator_view_prefs');
        const settings = this.loadSettings() || {};

        return {
            viewMode: (saved && saved.viewMode) || settings.defaultViewMode || Config.get('ui.defaultViewMode', 'card'),
            sortField: (saved && saved.sortField) || settings.defaultSortField || Config.get('ui.defaultSortField', 'profitRate'),
            sortOrder: (saved && saved.sortOrder) || settings.defaultSortOrder || Config.get('ui.defaultSortOrder', 'desc'),
            tradeDisplayMode: (saved && saved.tradeDisplayMode) || null,
            cycleExpandState: (saved && saved.cycleExpandState) || {}
        };
    },

    exportAll() {
        const snapshot = typeof window.LocalStorageAdapter !== 'undefined'
            ? window.LocalStorageAdapter.loadSnapshot()
            : null;

        return {
            version: Config.get('app.version'),
            exportTime: new Date().toISOString(),
            schemaVersion: snapshot ? snapshot.schemaVersion : window.StorageSchema.VERSION,
            funds: this.loadFunds(),
            trades: this.loadTrades(),
            settings: this.loadSettings(),
            syncMeta: snapshot ? snapshot.syncMeta : window.StorageSchema.createEmptySnapshot().syncMeta
        };
    },

    importAll(data, merge = false) {
        try {
            if (!data || typeof data !== 'object') {
                console.error('Invalid import data format');
                return false;
            }

            const incomingFunds = Array.isArray(data.funds)
                ? data.funds.map(fund => window.StorageSchema.createFundEntity(fund))
                : [];
            const incomingTrades = Array.isArray(data.trades)
                ? data.trades.map(trade => window.StorageSchema.createTradeEntity(trade))
                : [];

            if (merge) {
                const mergedFunds = this.mergeArrays(this.loadFunds(), incomingFunds, 'id');
                const mergedTrades = this.mergeArrays(this.loadTrades(), incomingTrades, 'id');
                this.saveFunds(mergedFunds);
                this.saveTrades(mergedTrades);
            } else {
                this.saveFunds(incomingFunds);
                this.saveTrades(incomingTrades);
            }

            if (data.settings && typeof data.settings === 'object') {
                if (merge) {
                    const existingSettings = this.loadSettings();
                    this.saveSettings({ ...existingSettings, ...data.settings });
                } else {
                    this.saveSettings(data.settings);
                }
            }

            if (data.syncMeta && typeof data.syncMeta === 'object' && typeof window.LocalStorageAdapter !== 'undefined') {
                window.LocalStorageAdapter.updateSyncMeta(data.syncMeta);
            }

            return true;
        } catch (error) {
            console.error('Import data failed:', error);
            return false;
        }
    },

    mergeArrays(existing, imported, keyField) {
        const result = [...existing];
        const existingKeys = new Set(existing.map(item => item[keyField]));

        imported.forEach(item => {
            if (!existingKeys.has(item[keyField])) {
                result.push(item);
            }
        });

        return result;
    }
};

ModuleRegistry.register('Storage', Storage);
