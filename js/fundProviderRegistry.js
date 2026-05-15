/**
 * 基金数据提供者注册表
 * 管理不同基金数据API提供者的注册与切换
 */

const FundProviderRegistry = {
    providers: {},
    _currentProvider: 'tiantian',

    registerProvider(name, provider) {
        FundProviderRegistry.providers[name] = provider;
        console.log('Fund provider registered:', name);
    },

    getProvider(name) {
        return FundProviderRegistry.providers[name] || null;
    },

    getCurrentProvider() {
        const name = FundProviderRegistry._currentProvider;
        const provider = FundProviderRegistry.getProvider(name);
        if (!provider) {
            console.warn('Current provider not found, falling back to tiantian');
            return FundProviderRegistry.getProvider('tiantian');
        }
        return provider;
    },

    setCurrentProvider(name) {
        if (!FundProviderRegistry.providers[name]) {
            throw new Error('Provider not found: ' + name);
        }
        FundProviderRegistry._currentProvider = name;
        console.log('Current fund provider set to:', name);
    },

    getProviderName() {
        return FundProviderRegistry._currentProvider;
    },

    listProviders() {
        return Object.keys(FundProviderRegistry.providers);
    }
};

ModuleRegistry.register('FundProviderRegistry', FundProviderRegistry);
