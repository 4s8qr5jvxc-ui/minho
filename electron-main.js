const { app, BrowserWindow } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const fs = require('fs');
const waitOn = require('wait-on');

let mainWindow;
let serverProcess;
const PORT = 3001;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        },
        icon: path.join(__dirname, 'server/public/logo.png'),
        autoHideMenuBar: true,
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#0d0d12',
            symbolColor: '#7920D4'
        }
    });

    const url = `http://localhost:${PORT}`;

    // Use wait-on to ensure the server is ready before loading
    const opts = {
        resources: [url],
        timeout: 10000, // 10 seconds
    };

    waitOn(opts)
        .then(() => {
            mainWindow.loadURL(url).catch(err => {
                console.error('Failed to load URL:', err);
                // Show a simple error message in the window
                mainWindow.loadFile(path.join(__dirname, 'server/public/index.html')).catch(() => {
                    mainWindow.webContents.executeJavaScript('document.body.innerHTML = "<h1>Failed to connect to local server</h1>"');
                });
            });
        })
        .catch(err => {
            console.error('Wait-on timeout or error:', err);
            // Fallback: try loading anyway or show error
            mainWindow.webContents.executeJavaScript('document.body.innerHTML = "<h1>Server startup timeout</h1>"');
        });

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

function startServer() {
    const userDataPath = app.getPath('userData');
    console.log('User Data Path:', userDataPath);

    // Path to server script
    const serverPath = path.join(__dirname, 'server/index.js');

    if (fs.existsSync(serverPath)) {
        serverProcess = fork(serverPath, [], {
            env: {
                ...process.env,
                PORT: PORT,
                MINHE_DATA_PATH: userDataPath,
                CORS_ORIGIN: '*'
            },
            stdio: 'pipe'
        });

        serverProcess.stdout.on('data', (data) => {
            console.log(`[SERVER]: ${data}`);
        });

        serverProcess.stderr.on('data', (data) => {
            console.error(`[SERVER ERR]: ${data}`);
        });
    } else {
        console.error('Server script not found at:', serverPath);
    }
}

app.on('ready', () => {
    startServer();
    createWindow();
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', function () {
    if (mainWindow === null) {
        createWindow();
    }
});

app.on('will-quit', () => {
    if (serverProcess) {
        serverProcess.kill();
    }
});
