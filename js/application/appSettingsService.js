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

    importData(data, merge = false) {
        return Storage.importAll(data, merge);
    },

    clearAllData() {
        return DataService.clearAll();
    }
};

ModuleRegistry.register('AppSettingsService', AppSettingsService);
