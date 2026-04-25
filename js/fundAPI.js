/**
 * 基金API服务
 * 调用基金数据API并处理GB2312编码
 */

const FundAPI = {
    // API缓存
    cache: new Map(),

    // JSONP请求计数器，用于生成唯一回调函数名
    _jsonpCounter: 0,

    /**
     * 获取基金数据
     * @param {string} fundCode - 基金代码
     * @param {boolean} useCache - 是否使用缓存
     * @returns {Promise<object>}
     */
    async getFundData(fundCode, useCache = true) {
        // 验证基金代码
        if (!Utils.isValidFundCode(fundCode)) {
            throw new Error('基金代码格式不正确');
        }

        // 检查缓存
        if (useCache) {
            const cached = this.getFromCache(fundCode);
            if (cached) {
                console.log(`Using cached data for fund ${fundCode}`);
                return cached;
            }
        }

        // 调用API
        const url = Config.getApiUrl(fundCode);
        console.log(`Fetching fund data from: ${url}`);

        try {
            const data = await this.fetchWithRetry(url);
            const fundData = this.parseJSONPResponse(data, fundCode);

            // 使用返回数据中的实际基金代码保存缓存
            this.saveToCache(fundData.code, fundData);

            return fundData;
        } catch (error) {
            console.error(`Failed to fetch fund data for ${fundCode}:`, error);
            throw error;
        }
    },

    /**
     * 带重试的JSONP请求
     * @param {string} url - 请求URL
     * @returns {Promise<string>}
     */
    async fetchWithRetry(url) {
        const retryCount = Config.get('api.retryCount', 3);
        const retryDelay = Config.get('api.retryDelay', 1000);

        for (let i = 0; i < retryCount; i++) {
            try {
                const data = await this.fetchJSONP(url);
                return data;
            } catch (error) {
                console.error(`Attempt ${i + 1} failed:`, error);

                if (i < retryCount - 1) {
                    console.log(`Retrying in ${retryDelay}ms...`);
                    await Utils.sleep(retryDelay);
                } else {
                    throw error;
                }
            }
        }
    },

    /**
     * 使用JSONP方式获取数据（绕过CORS）
     * 使用全局jsonpgz回调，通过请求ID匹配响应
     * @param {string} url - 请求URL
     * @returns {Promise<object>}
     */
    fetchJSONP(url) {
        return new Promise((resolve, reject) => {
            const timeout = Config.get('api.timeout', 10000);
            let timeoutId = null;
            let script = null;
            const requestId = ++FundAPI._jsonpCounter;

            // 初始化待处理请求队列
            if (!FundAPI._pendingRequests) {
                FundAPI._pendingRequests = [];
            }

            // 清理函数
            const cleanup = () => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                if (script && script.parentNode) {
                    script.parentNode.removeChild(script);
                }
                // 从待处理队列中移除
                FundAPI._pendingRequests = FundAPI._pendingRequests.filter(r => r.id !== requestId);
            };

            // 设置超时
            timeoutId = setTimeout(() => {
                cleanup();
                reject(new Error('JSONP request timeout'));
            }, timeout);

            // 将当前请求加入待处理队列
            FundAPI._pendingRequests.push({
                id: requestId,
                resolve: (data) => {
                    cleanup();
                    resolve(data);
                }
            });

            // 设置全局jsonpgz回调，将数据分发给队列中最早的请求（FIFO）
            window.jsonpgz = (data) => {
                // 取出最早入队的请求并resolve
                if (FundAPI._pendingRequests.length > 0) {
                    const pending = FundAPI._pendingRequests.shift();
                    pending.resolve(data);
                }
            };

            // 创建script标签
            script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = url;

            // 尝试设置charset
            try {
                script.setAttribute('charset', 'gb2312');
            } catch (e) {
                console.warn('Cannot set charset attribute');
            }

            // 错误处理
            script.onerror = () => {
                cleanup();
                reject(new Error('JSONP script load error'));
            };

            // 添加到页面
            const head = document.head || document.getElementsByTagName('head')[0];
            head.appendChild(script);
        });
    },

    /**
     * 解析JSONP响应数据
     * @param {object} data - JSONP返回的数据对象
     * @param {string} fundCode - 期望的基金代码（用于日志，不强制匹配）
     * @returns {object}
     */
    parseJSONPResponse(data, fundCode) {
        try {
            // 验证返回的数据
            if (!data || !data.fundcode) {
                throw new Error('Invalid response data');
            }

            // 构造标准化的基金数据对象
            const result = {
                code: data.fundcode,
                name: data.name,
                netValue: parseFloat(data.dwjz) || 0,
                netValueDate: data.jzrq,
                estimatedValue: parseFloat(data.gsz) || 0,
                estimatedDate: data.gztime,
                estimatedGrowth: parseFloat(data.gszzl) || 0,
                updateTime: new Date().toISOString()
            };

            return result;
        } catch (error) {
            console.error('Failed to parse JSONP response:', error);
            throw new Error('Failed to parse fund data');
        }
    },

    /**
     * 从缓存获取数据
     * @param {string} fundCode - 基金代码
     * @returns {object|null}
     */
    getFromCache(fundCode) {
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

    /**
     * 保存数据到缓存
     * @param {string} fundCode - 基金代码
     * @param {object} data - 基金数据
     */
    saveToCache(fundCode, data) {
        const maxEntries = Config.get('cache.maxEntries', 100);

        // 如果缓存已满，删除最旧的条目
        if (this.cache.size >= maxEntries) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(fundCode, {
            data,
            timestamp: Date.now()
        });
    },

    /**
     * 清空缓存
     */
    clearCache() {
        this.cache.clear();
        console.log('API cache cleared');
    },

    /**
     * 批量获取基金数据
     * @param {string[]} fundCodes - 基金代码数组
     * @param {number} concurrency - 并发数量（默认5）
     * @returns {Promise<object[]>}
     */
    async batchGetFundData(fundCodes, concurrency = 5) {
        console.log(`Batch get fund data: ${fundCodes.length} funds, concurrency: ${concurrency}`);
        
        const results = [];
        const errors = [];
        
        // 分批处理
        for (let i = 0; i < fundCodes.length; i += concurrency) {
            const batch = fundCodes.slice(i, i + concurrency);
            console.log(`Processing batch ${Math.floor(i / concurrency) + 1}: ${batch.join(', ')}`);
            
            const batchPromises = batch.map(code =>
                this.getFundData(code).catch(error => {
                    console.error(`Failed to get data for ${code}:`, error);
                    errors.push({ code, error: error.message });
                    return null;
                })
            );
            
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults.filter(r => r !== null));
        }
        
        console.log(`Batch complete: ${results.length} success, ${errors.length} errors`);
        return results;
    },

    /**
     * 刷新基金数据
     * @param {string} fundCode - 基金代码
     * @returns {Promise<object>}
     */
    refreshFundData(fundCode) {
        // 强制不使用缓存
        return this.getFundData(fundCode, false);
    }
};

// 注册到模块系统
ModuleRegistry.register('FundAPI', FundAPI);
