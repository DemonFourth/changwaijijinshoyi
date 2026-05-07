const DetailFundUpdateHelper = {
    buildNameUpdatePayload(name) {
        return {
            name,
            nameSource: 'manual',
            nameUpdateTime: new Date().toISOString()
        };
    },

    buildRemarkUpdatePayload(remark) {
        return {
            remark
        };
    }
};

ModuleRegistry.register('DetailFundUpdateHelper', DetailFundUpdateHelper);
