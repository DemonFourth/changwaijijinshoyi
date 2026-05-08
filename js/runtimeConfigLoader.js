/**
 * 运行时配置加载器
 * 应用启动时从 /api/runtime-config 加载环境配置
 * 失败时自动回退到本地模式
 */

const RuntimeConfigLoader = {
    /**
     * 加载运行时配置
     * @returns {Promise<boolean>} 是否成功加载
     */
    async load() {
        if (typeof fetch !== 'function') {
            console.warn('[RuntimeConfigLoader] fetch not available, using local defaults');
            return false;
        }

        try {
            const response = await fetch('/api/runtime-config', {
                headers: { 'Content-Type': 'application/json' },
                cache: 'no-cache'
            });

            if (!response.ok) {
                console.warn('[RuntimeConfigLoader] /api/runtime-config returned', response.status);
                return false;
            }

            const serverConfig = await response.json();
            Config.load(serverConfig);
            return true;
        } catch (error) {
            console.warn('[RuntimeConfigLoader] Failed to load runtime config:', error.message);
            return false;
        }
    },

    /**
     * 获取当前存储模式
     * @returns {string} 'local' | 'hybrid'
     */
    getStorageMode() {
        return Config.get('storageMode', 'local');
    },

    /**
     * 是否启用云同步（Pages Functions 模式）
     * @returns {boolean}
     */
    isSyncEnabled() {
        return !!Config.get('sync.enabled', false);
    },

    /**
     * 获取云同步 API 基础路径（同源 /api/sync）
     * @returns {string}
     */
    getSyncBasePath() {
        return Config.get('sync.basePath', '');
    }
};

ModuleRegistry.register('RuntimeConfigLoader', RuntimeConfigLoader);
