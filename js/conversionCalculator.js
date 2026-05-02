/**
 * 基金转换计算器
 * 计算从A基金转换到B基金的完整过程
 * 支持单费率和分段费率两种模式
 */

const ConversionCalculator = {
    EPSILON: 0.0001,

    /**
     * 执行转换计算
     * @param {object} params - 转换参数
     * @returns {object} 计算结果
     */
    calculate(params) {
        const {
            aNetValue,
            aShares,
            bNetValue,
            bShares,
            bBuyRate
        } = params;

        // 验证输入
        const validation = ConversionCalculator.validate(params);
        if (!validation.valid) {
            return { error: validation.message };
        }

        // 判断使用分段费率还是单费率
        const isTiered = params.useTieredFee && params.sellFeeTiers && params.sellFeeTiers.length > 0;

        let sellFee, sellFeeDetails;

        if (isTiered) {
            // 分段费率模式
            const tieredResult = ConversionCalculator.calculateTieredSellFee(
                aNetValue,
                params.sellFeeTiers
            );
            sellFee = tieredResult.totalFee;
            sellFeeDetails = tieredResult.details;
        } else {
            // 单费率模式
            const { aSellRate } = params;
            const transferAmount = aNetValue * aShares;
            sellFee = transferAmount * (aSellRate / 100);
            sellFeeDetails = [{
                shares: aShares,
                rate: aSellRate,
                fee: sellFee
            }];
        }

        // A基金卖出
        const transferAmount = aNetValue * aShares;
        const receivedAmount = transferAmount - sellFee;

        // B基金买入
        const baseAmount = bNetValue * bShares;
        const buyFee = baseAmount * (bBuyRate / 100);
        const paidAmount = baseAmount + buyFee;

        // 资金结算
        const balance = receivedAmount - paidAmount;
        const totalFee = sellFee + buyFee;

        return {
            // A基金
            transferAmount: transferAmount,
            sellFee: sellFee,
            sellFeeDetails: sellFeeDetails,
            receivedAmount: receivedAmount,

            // B基金
            baseAmount: baseAmount,
            buyFee: buyFee,
            paidAmount: paidAmount,

            // 结算
            balance: balance,
            totalFee: totalFee,

            // 输入参数
            input: params
        };
    },

    /**
     * 计算分段卖出手续费
     * @param {number} netValue - 基金净值
     * @param {array} tiers - 费率段数组 [{shares, rate}]
     * @returns {object} {totalFee, details}
     */
    calculateTieredSellFee(netValue, tiers) {
        let totalFee = 0;
        const details = [];

        for (const tier of tiers) {
            const shares = parseFloat(tier.shares);
            const rate = parseFloat(tier.rate);
            const tierAmount = netValue * shares;
            const tierFee = tierAmount * (rate / 100);

            totalFee += tierFee;
            details.push({
                shares: shares,
                rate: rate,
                amount: tierAmount,
                fee: tierFee
            });
        }

        return {
            totalFee: totalFee,
            details: details
        };
    },

    /**
     * 验证输入参数
     * @param {object} params - 转换参数
     * @returns {object} {valid, message}
     */
    validate(params) {
        const {
            aNetValue,
            aShares,
            bNetValue,
            bShares,
            bBuyRate
        } = params;

        if (!aNetValue || aNetValue <= 0) {
            return { valid: false, message: 'A基金净值必须大于0' };
        }
        if (!aShares || aShares <= 0) {
            return { valid: false, message: 'A基金份额必须大于0' };
        }
        if (!bNetValue || bNetValue <= 0) {
            return { valid: false, message: 'B基金净值必须大于0' };
        }
        if (!bShares || bShares <= 0) {
            return { valid: false, message: 'B基金份额必须大于0' };
        }
        if (bBuyRate === undefined || bBuyRate === null || bBuyRate < 0) {
            return { valid: false, message: 'B基金买入费率不能为空' };
        }

        // 分段费率模式验证
        if (params.useTieredFee && params.sellFeeTiers && params.sellFeeTiers.length > 0) {
            const totalTierShares = params.sellFeeTiers.reduce((sum, tier) =>
                sum + parseFloat(tier.shares || 0), 0);

            const sharesDiff = Math.abs(totalTierShares - aShares);
            if (sharesDiff > ConversionCalculator.EPSILON) {
                return {
                    valid: false,
                    message: `费率段份额总和(${totalTierShares.toFixed(2)})与A基金总份额(${aShares.toFixed(2)})不一致`
                };
            }

            for (let i = 0; i < params.sellFeeTiers.length; i++) {
                const tier = params.sellFeeTiers[i];
                if (!tier.shares || parseFloat(tier.shares) <= 0) {
                    return { valid: false, message: `第${i + 1}段份额必须大于0` };
                }
                if (tier.rate === undefined || tier.rate === null || parseFloat(tier.rate) < 0) {
                    return { valid: false, message: `第${i + 1}段费率不能为空` };
                }
            }
        } else if (!params.useTieredFee) {
            // 单费率模式验证
            const { aSellRate } = params;
            if (aSellRate === undefined || aSellRate === null || aSellRate < 0) {
                return { valid: false, message: 'A基金卖出费率不能为空' };
            }
        }

        return { valid: true, message: '' };
    },

    /**
     * 生成交易记录
     * @param {object} result - 计算结果
     * @param {object} options - 选项 {date, remark, targetFundId, sourceFundId}
     * @returns {array} 两条交易记录 [卖出记录, 买入记录]
     */
    generateTrades(result, options) {
        const { date, remark, targetFundId, sourceFundId } = options;

        // 生成分段费率备注
        let feeRemark = '';
        if (result.sellFeeDetails && result.sellFeeDetails.length > 1) {
            const details = result.sellFeeDetails.map(tier =>
                `${tier.shares.toFixed(2)}份@${tier.rate}%`);
            feeRemark = ` [费率:${details.join(', ')}]`;
        }

        // A基金卖出记录
        const sellTrade = {
            fundId: sourceFundId || '',
            date: date,
            type: 'sell',
            netValue: result.input.aNetValue,
            shares: result.input.aShares,
            amount: result.receivedAmount,
            fee: result.sellFee,
            remark: remark ? `[转换] ${remark}${feeRemark}` : `基金转换-卖出${feeRemark}`,
            createTime: new Date().toISOString()
        };

        // B基金买入记录
        const buyTrade = {
            fundId: targetFundId || '',
            date: date,
            type: 'buy',
            netValue: result.input.bNetValue,
            shares: result.input.bShares,
            amount: result.paidAmount,
            fee: result.buyFee,
            remark: remark ? `[转换] ${remark}` : '基金转换-买入',
            createTime: new Date().toISOString()
        };

        return [sellTrade, buyTrade];
    }
};

// 注册到模块系统
ModuleRegistry.register('ConversionCalculator', ConversionCalculator);
