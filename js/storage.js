/**
 * 存储管理器
 * 封装localStorage操作，提供数据持久化功能
 */

const Storage = {
    /**
     * 保存数据到localStorage
     * @param {string} key - 存储键
     * @param {any} data - 要存储的数据
     * @returns {boolean} 是否成功
     */
    save(key, data) {
        try {
            const serialized = JSON.stringify(data);
            localStorage.setItem(key, serialized);
            return true;
        } catch (error) {
            console.error('Storage save failed:', error);

            // 检查是否是存储空间不足
            if (error.name === 'QuotaExceededError') {
                console.error('localStorage quota exceeded');
                Utils.showToast('存储空间不足，请清理数据', 'error');
            }

            return false;
        }
    },

    /**
     * 从localStorage读取数据
     * @param {string} key - 存储键
     * @returns {any} 读取的数据，失败返回null
     */
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

    /**
     * 删除localStorage中的数据
     * @param {string} key - 存储键
     * @returns {boolean} 是否成功
     */
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Storage remove failed:', error);
            return false;
        }
    },

    /**
     * 清空所有数据
     * @returns {boolean} 是否成功
     */
    clear() {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            console.error('Storage clear failed:', error);
            return false;
        }
    },

    /**
     * 检查键是否存在
     * @param {string} key - 存储键
     * @returns {boolean}
     */
    has(key) {
        return localStorage.getItem(key) !== null;
    },

    /**
     * 获取所有键
     * @returns {string[]}
     */
    keys() {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            keys.push(localStorage.key(i));
        }
        return keys;
    },

    /**
     * 获取存储大小（字节）
     * @returns {number}
     */
    getSize() {
        let size = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            size += key.length + value.length;
        }
        return size * 2; // UTF-16编码，每个字符2字节
    },

    /**
     * 获取存储使用情况
     * @returns {object}
     */
    getUsage() {
        const size = this.getSize();
        const maxSize = 5 * 1024 * 1024; // localStorage通常限制5MB

        return {
            used: size,
            total: maxSize,
            percent: (size / maxSize * 100).toFixed(2),
            usedMB: (size / 1024 / 1024).toFixed(2),
            totalMB: (maxSize / 1024 / 1024).toFixed(2)
        };
    },

    /**
     * 保存基金数据
     * @param {array} funds - 基金列表
     * @returns {boolean}
     */
    saveFunds(funds) {
        const key = Config.get('storage.fundsKey');
        return this.save(key, funds);
    },

    /**
     * 加载基金数据
     * @returns {array}
     */
    loadFunds() {
        const key = Config.get('storage.fundsKey');
        return this.load(key) || [];
    },

    /**
     * 保存交易记录
     * @param {array} trades - 交易记录列表
     * @returns {boolean}
     */
    saveTrades(trades) {
        const key = Config.get('storage.tradesKey');
        return this.save(key, trades);
    },

    /**
     * 加载交易记录
     * @returns {array}
     */
    loadTrades() {
        const key = Config.get('storage.tradesKey');
        return this.load(key) || [];
    },

    /**
     * 保存应用设置
     * @param {object} settings - 设置对象
     * @returns {boolean}
     */
    saveSettings(settings) {
        const key = Config.get('storage.settingsKey');
        return this.save(key, settings);
    },

    /**
     * 加载应用设置
     * @returns {object}
     */
    loadSettings() {
        const key = Config.get('storage.settingsKey');
        return this.load(key) || {};
    },

    /**
     * 保存主题设置
     * @param {string} theme - 主题名称
     * @returns {boolean}
     */
    saveTheme(theme) {
        const key = Config.get('storage.themeKey');
        return this.save(key, theme);
    },

    /**
     * 加载主题设置
     * @returns {string}
     */
    loadTheme() {
        const key = Config.get('storage.themeKey');
        return this.load(key) || Config.get('app.defaultTheme');
    },

    /**
     * 保存视图偏好设置
     * @param {object} prefs - 视图偏好 {viewMode, sortField, sortOrder}
     * @returns {boolean}
     */
    saveViewPrefs(prefs) {
        return this.save('fund_calculator_view_prefs', prefs);
    },

    /**
     * 加载视图偏好设置
     * @returns {object} 视图偏好
     */
    loadViewPrefs() {
        return this.load('fund_calculator_view_prefs') || {
            viewMode: Config.get('ui.defaultViewMode', 'card'),
            sortField: Config.get('ui.defaultSortField', 'profitRate'),
            sortOrder: Config.get('ui.defaultSortOrder', 'desc')
        };
    },

    /**
     * 导出所有数据
     * @returns {object}
     */
    exportAll() {
        return {
            version: Config.get('app.version'),
            exportTime: new Date().toISOString(),
            funds: this.loadFunds(),
            trades: this.loadTrades(),
            settings: this.loadSettings()
        };
    },

    /**
     * 导入数据
     * @param {object} data - 导入的数据
     * @param {boolean} merge - 是否合并，false则覆盖
     * @returns {boolean}
     */
    importAll(data, merge = false) {
        try {
            // 验证数据格式
            if (!data || typeof data !== 'object') {
                console.error('Invalid import data format');
                return false;
            }

            // 导入基金数据
            if (Array.isArray(data.funds)) {
                if (merge) {
                    const existingFunds = this.loadFunds();
                    const mergedFunds = this.mergeArrays(existingFunds, data.funds, 'id');
                    this.saveFunds(mergedFunds);
                } else {
                    this.saveFunds(data.funds);
                }
            }

            // 导入交易记录
            if (Array.isArray(data.trades)) {
                if (merge) {
                    const existingTrades = this.loadTrades();
                    const mergedTrades = this.mergeArrays(existingTrades, data.trades, 'id');
                    this.saveTrades(mergedTrades);
                } else {
                    this.saveTrades(data.trades);
                }
            }

            // 导入设置
            if (data.settings && typeof data.settings === 'object') {
                if (merge) {
                    const existingSettings = this.loadSettings();
                    const mergedSettings = { ...existingSettings, ...data.settings };
                    this.saveSettings(mergedSettings);
                } else {
                    this.saveSettings(data.settings);
                }
            }

            return true;
        } catch (error) {
            console.error('Import data failed:', error);
            return false;
        }
    },

    /**
     * 合并数组（根据唯一键）
     * @param {array} existing - 现有数组
     * @param {array} imported - 导入数组
     * @param {string} keyField - 唯一键字段名
     * @returns {array}
     */
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

// 注册到模块系统
ModuleRegistry.register('Storage', Storage);
