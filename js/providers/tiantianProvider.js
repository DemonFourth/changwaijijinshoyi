/**
 * 天天基金数据提供者
 * 通过 JSONP 方式调用 fundgz.1234567.com.cn API
 */

const TiantianFundProvider = {
    cache: new Map(),
    _jsonpCounter: 0,
    _pendingRequests: [],

    getFundData(fundCode, useCache = true) {
        return this._getFundData(fundCode, useCache);
    },

    async _getFundData(fundCode, useCache) {
        if (!Utils.isValidFundCode(fundCode)) {
            throw new Error('基金代码格式不正确');
        }

        if (useCache) {
            const cached = this._getFromCache(fundCode);
            if (cached) {
                console.log('Using cached data for fund ' + fundCode);
                return cached;
            }
        }

        const url = Config.getApiUrl(fundCode);
        console.log('Fetching fund data from: ' + url);

        try {
            const data = await this._fetchWithRetry(url);
            const fundData = this._parseResponse(data, fundCode);
            this._saveToCache(fundData.code, fundData);
            return fundData;
        } catch (error) {
            console.error('Failed to fetch fund data for ' + fundCode + ':', error);
            throw error;
        }
    },

    async _fetchWithRetry(url) {
        const retryCount = Config.get('api.retryCount', 3);
        const retryDelay = Config.get('api.retryDelay', 1000);

        for (let i = 0; i < retryCount; i++) {
            try {
                const data = await this._fetchJSONP(url);
                return data;
            } catch (error) {
                console.error('Attempt ' + (i + 1) + ' failed:', error);

                if (i < retryCount - 1) {
                    console.log('Retrying in ' + retryDelay + 'ms...');
                    await Utils.sleep(retryDelay);
                } else {
                    throw error;
                }
            }
        }
    },

    _fetchJSONP(url) {
        return new Promise((resolve, reject) => {
            const timeout = Config.get('api.timeout', 10000);
            let timeoutId = null;
            let script = null;
            const requestId = ++TiantianFundProvider._jsonpCounter;

            if (!TiantianFundProvider._pendingRequests) {
                TiantianFundProvider._pendingRequests = [];
            }

            const cleanup = () => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                if (script && script.parentNode) {
                    script.parentNode.removeChild(script);
                }
                TiantianFundProvider._pendingRequests = TiantianFundProvider._pendingRequests.filter(r => r.id !== requestId);
            };

            timeoutId = setTimeout(() => {
                cleanup();
                reject(new Error('JSONP request timeout'));
            }, timeout);

            TiantianFundProvider._pendingRequests.push({
                id: requestId,
                resolve: (data) => {
                    cleanup();
                    resolve(data);
                }
            });

            window.jsonpgz = (data) => {
                if (TiantianFundProvider._pendingRequests.length > 0) {
                    const pending = TiantianFundProvider._pendingRequests.shift();
                    pending.resolve(data);
                }
            };

            script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = url;

            try {
                script.setAttribute('charset', 'gb2312');
            } catch (e) {
                console.warn('Cannot set charset attribute');
            }

            script.onerror = () => {
                cleanup();
                reject(new Error('JSONP script load error'));
            };

            const head = document.head || document.getElementsByTagName('head')[0];
            head.appendChild(script);
        });
    },

    _parseResponse(data, _fundCode) {
        try {
            if (!data || !data.fundcode) {
                throw new Error('Invalid response data');
            }

            return {
                code: data.fundcode,
                name: data.name,
                netValue: parseFloat(data.dwjz) || 0,
                netValueDate: data.jzrq,
                estimatedValue: parseFloat(data.gsz) || 0,
                estimatedDate: data.gztime,
                estimatedGrowth: parseFloat(data.gszzl) || 0,
                updateTime: new Date().toISOString()
            };
        } catch (error) {
            console.error('Failed to parse response:', error);
            throw new Error('Failed to parse fund data');
        }
    },

    _getFromCache(fundCode) {
        const cached = this.cache.get(fundCode);

        if (!cached) {
            return null;
        }

        const ttl = Config.get('cache.apiTTL', 5 * 60 * 1000);
        const now = Date.now();

        if (now - cached.timestamp > ttl) {
            this.cache.delete(fundCode);
            return null;
        }

        return cached.data;
    },

    _saveToCache(fundCode, data) {
        const maxEntries = Config.get('cache.maxEntries', 100);

        if (this.cache.size >= maxEntries) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(fundCode, {
            data,
            timestamp: Date.now()
        });
    },

    clearCache() {
        this.cache.clear();
        console.log('Tiantian provider cache cleared');
    },

    clearCacheForFund(fundCode) {
        this.cache.delete(fundCode);
        console.log('Tiantian provider cache cleared for fund:', fundCode);
    },

    fetchNameOnly(fundCode) {
        return TiantianFundProvider.getFundData(fundCode, false).then(data => data.name);
    },

    async batchGetFundData(fundCodes, concurrency = 5) {
        console.log('Batch get fund data: ' + fundCodes.length + ' funds, concurrency: ' + concurrency);

        const results = [];
        const errors = [];

        for (let i = 0; i < fundCodes.length; i += concurrency) {
            const batch = fundCodes.slice(i, i + concurrency);
            console.log('Processing batch ' + (Math.floor(i / concurrency) + 1) + ': ' + batch.join(', '));

            const batchPromises = batch.map(code =>
                this.getFundData(code).catch(error => {
                    console.error('Failed to get data for ' + code + ':', error);
                    errors.push({ code, error: error.message });
                    return null;
                })
            );

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults.filter(r => r !== null));
        }

        console.log('Batch complete: ' + results.length + ' success, ' + errors.length + ' errors');
        return results;
    },

    refreshFundData(fundCode) {
        return this.getFundData(fundCode, false);
    },

    isConfigured() {
        return true;
    }
};

ModuleRegistry.register('TiantianFundProvider', TiantianFundProvider);

// 自动注册并设置为默认提供者
FundProviderRegistry.registerProvider('tiantian', TiantianFundProvider);
FundProviderRegistry.setCurrentProvider('tiantian');
