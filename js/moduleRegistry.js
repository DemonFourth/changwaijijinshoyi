/**
 * 模块注册器
 * 提供统一的模块注册接口
 */

const ModuleRegistry = {
    /**
     * 注册模块到全局命名空间
     * @param {string} name - 模块名称
     * @param {object} module - 模块对象
     * @returns {boolean} 注册是否成功
     */
    register(name, module) {
        if (!name || typeof name !== 'string') {
            console.error('Module name must be a non-empty string');
            return false;
        }

        if (!module || typeof module !== 'object') {
            console.error('Module must be an object');
            return false;
        }

        // 注册到全局命名空间
        FundCalculator.register(name, module);

        // 同时暴露到全局，方便直接访问
        window[name] = module;

        return true;
    },

    /**
     * 批量注册模块
     * @param {object} modules - 模块对象集合 {name: module}
     * @returns {boolean} 全部注册是否成功
     */
    registerAll(modules) {
        if (!modules || typeof modules !== 'object') {
            console.error('Modules must be an object');
            return false;
        }

        let allSuccess = true;
        for (const [name, module] of Object.entries(modules)) {
            const success = this.register(name, module);
            if (!success) {
                allSuccess = false;
            }
        }

        return allSuccess;
    },

    /**
     * 获取模块
     * @param {string} name - 模块名称
     * @returns {object} 模块对象
     */
    get(name) {
        return FundCalculator.get(name);
    },

    /**
     * 检查模块是否已注册
     * @param {string} name - 模块名称
     * @returns {boolean}
     */
    has(name) {
        return FundCalculator.has(name);
    }
};

// 暴露到全局
window.ModuleRegistry = ModuleRegistry;
