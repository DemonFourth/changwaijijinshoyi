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
        const protocol = window.location && window.location.protocol;
        if (protocol === 'file:') {
            console.warn('[RuntimeConfigLoader] file protocol detected, using local defaults');
            this._showLocalModeBanner();
            return false;
        }

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
     * 显示本地模式提示条
     */
    _showLocalModeBanner() {
        const showBanner = () => {
            if (!document.body) {
                setTimeout(showBanner, 100);
                return;
            }

            const existingBanner = document.getElementById('local-mode-banner');
            if (existingBanner) return;

            const banner = document.createElement('div');
            banner.id = 'local-mode-banner';
            banner.innerHTML = '📁 本地模式 · 数据仅保存在本浏览器 · 刷新页面后数据保留';
            banner.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); color: #0369a1; padding: 10px 16px; text-align: center; font-size: 14px; font-weight: 500; z-index: 10000; border-bottom: 2px solid #0ea5e9; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);';

            document.body.style.paddingTop = '44px';
            document.body.prepend(banner);
        };

        showBanner();
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
