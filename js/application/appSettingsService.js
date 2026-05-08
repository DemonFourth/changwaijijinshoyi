const AppSettingsService = {
    loadSettings() {
        return Storage.loadSettings() || {};
    },

    saveSettings(settings) {
        return Storage.saveSettings(settings);
    },

    loadViewPrefs() {
        return Storage.loadViewPrefs();
    },

    saveViewPrefs(prefs) {
        return Storage.saveViewPrefs(prefs);
    },

    exportData() {
        return Storage.exportAll();
    },

    async importData(data, merge = false) {
        return window.ImportAppService.importData(data, { merge });
    },

    async clearAllData() {
        return window.ImportAppService.clearAll();
    }
};

ModuleRegistry.register('AppSettingsService', AppSettingsService);
