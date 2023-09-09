import { Meteor } from 'meteor/meteor'
import { WebAppInternals } from 'meteor/webapp'
import type HTTP from 'http'
import {
    getConfig, DevConnectionLog,
    MeteorViteConfig,
    setConfig,
    ViteConnection, RuntimeConfig,
} from './loading/vite-connection-handler';
import { createWorkerFork, getProjectPackageJson, isMeteorIPCMessage, meteorPackagePath } from './workers';

function viteHtml({ host, port, entryFile }: RuntimeConfig) {
    return `
<script id="vite-entrypoint" defer type="module" src="http://${host}:${port}/${entryFile}"></script>
<script>
document.getElementById('vite-entrypoint').onerror = (error) => {
    console.error('Vite entrypoint module failed to load! Refreshing page...', error);
    window.location.reload();
}
</script>
`
}

if (Meteor.isDevelopment) {
    DevConnectionLog.info('Starting Vite server...');
    
    WebAppInternals.registerBoilerplateDataCallback('meteor-vite', (request: HTTP.IncomingMessage, data: BoilerplateData) => {
        const config = getConfig();
        if (config.ready) {
            data.dynamicBody = `${data.dynamicBody || ""}\n${viteHtml(config)}\n`
        } else {
            // Vite not ready yet
            // Refresh page after some time
            data.dynamicBody = `${data.dynamicBody || ""}\n${Assets.getText('loading/dev-server-splash.html')}`
        }
    });
    
    const viteServer = createWorkerFork({
        viteConfig(config) {
            const { ready } = setConfig(config);
            if (ready) {
                DevConnectionLog.info(`Meteor-Vite ready for connections!`)
            }
        },
        refreshNeeded() {
            DevConnectionLog.info('Some lazy-loaded packages were imported, please refresh')
        }
    });
    
    viteServer.call({
        method: 'vite.startDevServer',
        params: [{
            packageJson: getProjectPackageJson(),
            globalMeteorPackagesDir: meteorPackagePath,
        }]
    });
    
    process.on('message', (message) => {
        if (!isMeteorIPCMessage(message)) return;
        viteServer.call({
            method: 'meteor.ipcMessage',
            params: [message],
        })
    })
    
    Meteor.publish(ViteConnection.publication, () => {
        return MeteorViteConfig.find(ViteConnection.configSelector);
    });
    
    Meteor.methods({
        [ViteConnection.methods.refreshConfig]() {
            DevConnectionLog.info('Refreshing configuration from Vite dev server...')
            viteServer.call({
                method: 'vite.getDevServerConfig',
                params: [],
            });
            return getConfig();
        }
    })
    
    /**
     * Builds the 'meteor-vite' npm package where the worker and Vite server is kept.
     * Primarily to ease the testing process for the Vite plugin.
     */
    if (process.env.BUILD_METEOR_VITE_DEPENDENCY === 'true') {
        const packageBuilder = createWorkerFork({});
        packageBuilder.call({
            method: 'tsup.watchMeteorVite',
            params: [],
        });
    }
}

interface BoilerplateData {
    dynamicBody?: string;
    additionalStaticJs: [contents: string, pathname: string][];
    inline?: string;
}
