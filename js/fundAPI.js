/**
 * 基金API服务
 * 调用基金数据API并处理GB2312编码
 */

const FundAPI = {
    // API缓存
    cache: new Map(),

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

            // 保存到缓存
            this.saveToCache(fundCode, fundData);

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
     * @param {string} url - 请求URL
     * @returns {Promise<object>}
     */
    fetchJSONP(url) {
        return new Promise((resolve, reject) => {
            const timeout = Config.get('api.timeout', 10000);
            let timeoutId = null;
            let script = null;

            // 清理函数
            const cleanup = () => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                if (script && script.parentNode) {
                    script.parentNode.removeChild(script);
                }
            };

            // 设置超时
            timeoutId = setTimeout(() => {
                cleanup();
                reject(new Error('JSONP request timeout'));
            }, timeout);

            // 保存原始的jsonpgz函数（如果存在）
            const originalJsonpgz = window.jsonpgz;

            // 创建临时的jsonpgz回调函数
            window.jsonpgz = (data) => {
                console.log('=== JSONP Callback Debug ===');
                console.log('1. Raw data received:', data);
                console.log('2. Data type:', typeof data);
                console.log('3. Fund code:', data ? data.fundcode : 'N/A');
                console.log('4. Fund name (raw):', data ? data.name : 'N/A');

                // 修复编码问题：如果name是乱码，尝试修复
                if (data && data.name) {
                    const originalName = data.name;
                    console.log('5. Original name char codes:',
                        Array.from(originalName).slice(0, 10).map(c => `${c}(${c.charCodeAt(0)})`));

                    // 检查是否是乱码（不包含中文字符）
                    const hasChinese = /[\u4e00-\u9fa5]/.test(originalName);
                    console.log('6. Has Chinese characters:', hasChinese);

                    if (!hasChinese) {
                        // 尝试修复：将乱码字符串重新编码为UTF-8
                        try {
                            // 方法1：将字符串转为Latin-1字节，再用UTF-8解码
                            const bytes = new Uint8Array(originalName.length);
                            for (let i = 0; i < originalName.length; i++) {
                                bytes[i] = originalName.charCodeAt(i);
                            }
                            const decoder = new TextDecoder('utf-8');
                            const fixedName = decoder.decode(bytes);

                            console.log('7. Fixed name:', fixedName);
                            console.log('8. Fixed name has Chinese:', /[\u4e00-\u9fa5]/.test(fixedName));

                            // 如果修复后包含中文，使用修复后的名称
                            if (/[\u4e00-\u9fa5]/.test(fixedName)) {
                                data.name = fixedName;
                                console.log('✅ Name fixed successfully');
                            }
                        } catch (e) {
                            console.error('Failed to fix name:', e);
                        }
                    }
                }

                cleanup();
                // 恢复原始函数
                if (originalJsonpgz) {
                    window.jsonpgz = originalJsonpgz;
                } else {
                    delete window.jsonpgz;
                }

                // 返回修复后的数据
                resolve(data);
            };

            // 创建script标签
            script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = url;

            // 尝试设置charset（虽然可能不起作用）
            try {
                script.setAttribute('charset', 'gb2312');
            } catch (e) {
                console.warn('Cannot set charset attribute');
            }

            // 错误处理
            script.onerror = () => {
                cleanup();
                // 恢复原始函数
                if (originalJsonpgz) {
                    window.jsonpgz = originalJsonpgz;
                } else {
                    delete window.jsonpgz;
                }
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
     * @param {string} fundCode - 基金代码
     * @returns {object}
     */
    parseJSONPResponse(data, fundCode) {
        console.log('=== Parse Response Debug ===');
        console.log('1. Input data:', data);
        console.log('2. Expected fund code:', fundCode);

        try {
            // 验证返回的数据
            if (!data || !data.fundcode) {
                throw new Error('Invalid response data');
            }

            if (data.fundcode !== fundCode) {
                throw new Error('Fund code mismatch');
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

            console.log('3. Parsed result:', result);
            console.log('4. Final name:', result.name);
            console.log('5. Name is valid Chinese:', /[\u4e00-\u9fa5]/.test(result.name));

            return result;
        } catch (error) {
            console.error('Failed to parse JSONP response:', error);
            console.error('Response data:', data);
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
     * @returns {Promise<object[]>}
     */
    async batchGetFundData(fundCodes) {
        const promises = fundCodes.map(code =>
            this.getFundData(code).catch(error => {
                console.error(`Failed to get data for ${code}:`, error);
                return null;
            })
        );

        const results = await Promise.all(promises);
        return results.filter(r => r !== null);
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
