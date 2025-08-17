const { app, BrowserWindow, Menu, shell, ipcMain, dialog } = require('electron')
const path = require('path')
const spawn = require('child_process').spawn
const fs = require('fs')
const http = require('http')

// Simple static file server for packaged apps
function startStaticServer(staticPath, port) {
  const server = http.createServer((req, res) => {
    let filePath = path.join(staticPath, req.url === '/' ? 'index.html' : req.url)
    
    // Security: prevent directory traversal
    if (!filePath.startsWith(staticPath)) {
      res.writeHead(403)
      res.end('Forbidden')
      return
    }
    
    fs.readFile(filePath, (err, data) => {
      if (err) {
        // Try to serve index.html for SPA routing
        if (req.url !== '/' && !path.extname(req.url)) {
          filePath = path.join(staticPath, 'index.html')
          fs.readFile(filePath, (err2, data2) => {
            if (err2) {
              res.writeHead(404)
              res.end('Not Found')
            } else {
              res.writeHead(200, { 'Content-Type': 'text/html' })
              res.end(data2)
            }
          })
        } else {
          res.writeHead(404)
          res.end('Not Found')
        }
        return
      }
      
      // Set content type based on file extension
      const ext = path.extname(filePath)
      const contentTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml'
      }
      
      res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' })
      res.end(data)
    })
  })
  
  server.listen(port, 'localhost')
  debugLog(`Static server listening on http://localhost:${port}`)
  return server
}

let mainWindow
let debugWindow = null
let serverProcess
let clientProcess
let isShuttingDown = false

// Debug logging function
function debugLog(message, data = null) {
  const timestamp = new Date().toISOString()
  const logMessage = `[${timestamp}] ${message}`
  
  console.log(logMessage)
  if (data) {
    console.log(data)
  }
  
  // Also send to debug window if open
  if (debugWindow && !debugWindow.isDestroyed()) {
    debugWindow.webContents.send('debug-log', { message: logMessage, data })
  }
}

// Create debug console window
function createDebugConsole() {
  if (debugWindow && !debugWindow.isDestroyed()) {
    debugWindow.focus()
    return
  }
  
  debugWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: 'TaskerADHD Debug Console',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    show: true,
    alwaysOnTop: true
  })
  
  // Create a simple debug console HTML
  const debugHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>TaskerADHD Debug Console</title>
      <style>
        body { 
          font-family: 'Courier New', monospace; 
          background: #1a1a1a; 
          color: #00ff00; 
          margin: 0; 
          padding: 10px; 
          overflow-y: auto;
        }
        .log-entry { 
          margin: 2px 0; 
          padding: 2px 5px;
          border-left: 3px solid #00ff00;
          white-space: pre-wrap;
        }
        .error { border-left-color: #ff0000; color: #ff6666; }
        .info { border-left-color: #0088ff; color: #66aaff; }
        .warn { border-left-color: #ffaa00; color: #ffcc66; }
        .btn {
          position: fixed;
          top: 10px;
          background: #333;
          color: white;
          border: none;
          padding: 5px 10px;
          cursor: pointer;
          margin-left: 5px;
        }
        #clear-btn {
          right: 10px;
        }
        #copy-btn {
          right: 80px;
        }
      </style>
    </head>
    <body>
      <button id="copy-btn" class="btn" onclick="copyLogs()">Copy</button>
      <button id="clear-btn" class="btn" onclick="clearLogs()">Clear</button>
      <div id="logs"></div>
      
      <script>
        const { ipcRenderer } = require('electron')
        const logsDiv = document.getElementById('logs')
        
        function addLog(message, type = 'info') {
          const div = document.createElement('div')
          div.className = 'log-entry ' + type
          div.textContent = message
          logsDiv.appendChild(div)
          div.scrollIntoView()
        }
        
        function clearLogs() {
          logsDiv.innerHTML = ''
        }
        
        function copyLogs() {
          const logText = logsDiv.innerText
          navigator.clipboard.writeText(logText).then(() => {
            addLog('📋 Logs copied to clipboard!', 'info')
            setTimeout(() => {
              const lastLog = logsDiv.lastElementChild
              if (lastLog && lastLog.textContent.includes('copied to clipboard')) {
                lastLog.remove()
              }
            }, 2000)
          }).catch(() => {
            addLog('❌ Failed to copy logs', 'error')
          })
        }
        
        ipcRenderer.on('debug-log', (event, { message, data }) => {
          addLog(message)
          if (data) {
            addLog(JSON.stringify(data, null, 2))
          }
        })
        
        // Initial message
        addLog('=== TaskerADHD Debug Console Started ===', 'info')
        addLog('Monitoring application startup...', 'info')
      </script>
    </body>
    </html>
  `
  
  debugWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(debugHtml))
}

const isDev = process.env.NODE_ENV === 'development'
const isMac = process.platform === 'darwin'

// Enable live reload for Electron in dev
if (isDev) {
  try {
    require('electron-reload')(__dirname, {
      electron: path.join(__dirname, '..', 'node_modules', '.bin', 'electron'),
      hardResetMethod: 'exit'
    })
  } catch (e) {
    console.log('Could not enable live reload:', e.message)
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, '../assets/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    frame: !isMac,
    show: false
  })

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    if (isDev) {
      mainWindow.webContents.openDevTools()
    }
  })

  // Load the app - detect the client dev port dynamically (3000-3005)
  const candidatePorts = [3000, 3001, 3002, 3003, 3004, 3005]
  ;(async () => {
    for (const port of candidatePorts) {
      const ok = await checkUrl(`http://localhost:${port}`, 500)
      if (ok) {
        debugLog(`Loading client from detected port http://localhost:${port}`)
        mainWindow.loadURL(`http://localhost:${port}`)
        return
      }
    }
    // Fallback to default
    mainWindow.loadURL('http://localhost:3000')
  })()

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// Menu template
const menuTemplate = [
  {
    label: 'File',
    submenu: [
      {
        label: 'New Task',
        accelerator: 'CmdOrCtrl+N',
        click: () => {
          mainWindow.webContents.send('menu-action', 'new-task')
        }
      },
      { type: 'separator' },
      isMac ? { role: 'close' } : { role: 'quit' }
    ]
  },
  {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' }
    ]
  },
  {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]
  },
  {
    label: 'System',
    submenu: [
      {
        label: 'Debug Console',
        accelerator: 'CmdOrCtrl+Shift+D',
        click: () => {
          createDebugConsole()
        }
      },
      { type: 'separator' },
      {
        label: 'Shutdown Servers',
        accelerator: 'CmdOrCtrl+Shift+Q',
        click: async () => {
          debugLog('🛑 Shutdown requested from menu')
          await gracefulShutdown()
        }
      }
    ]
  },
  {
    label: 'Help',
    submenu: [
      {
        label: 'About TaskerADHD',
        click: () => {
          mainWindow.webContents.send('menu-action', 'about')
        }
      },
      {
        label: 'Learn More',
        click: () => {
          shell.openExternal('https://github.com/yourusername/TaskerADHD')
        }
      }
    ]
  }
]

if (isMac) {
  menuTemplate.unshift({
    label: app.getName(),
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      { role: 'services', submenu: [] },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' }
    ]
  })
}

// Simple HTTP check function to replace wait-on
function checkUrl(url, timeout = 5000) {
  return new Promise((resolve) => {
    debugLog(`Checking URL: ${url}`)
    const req = http.get(url, (res) => {
      const success = res.statusCode === 200
      debugLog(`URL ${url} status: ${res.statusCode} ${success ? '✓' : '✗'}`)
      resolve(success)
      req.destroy()
    })
    
    req.on('error', (err) => {
      debugLog(`URL ${url} error:`, err.message)
      resolve(false)
    })
    
    req.setTimeout(timeout, () => {
      debugLog(`URL ${url} timeout after ${timeout}ms`)
      req.destroy()
      resolve(false)
    })
  })
}

// Wait for servers with built-in polling
async function waitForServers(maxAttempts = 30, interval = 2000) {
  const urls = [
    'http://localhost:3001/health',
    'http://localhost:3000'
  ]
  
  debugLog(`Waiting for servers (${maxAttempts} attempts, ${interval}ms interval)`)
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    debugLog(`Checking servers... (${attempt}/${maxAttempts})`)
    
    const results = await Promise.all(urls.map(url => checkUrl(url)))
    
    debugLog(`Server check results:`, results.map((result, i) => `${urls[i]}: ${result ? '✓' : '✗'}`))
    
    if (results.every(result => result)) {
      debugLog('✅ All servers are ready!')
      return true
    }
    
    if (attempt < maxAttempts) {
      debugLog(`Waiting ${interval}ms before next attempt...`)
      await new Promise(resolve => setTimeout(resolve, interval))
    }
  }
  
  debugLog('❌ Servers failed to start within timeout period')
  throw new Error('Servers failed to start within timeout period')
}

// Determine paths for different environments
function getProjectPaths() {
  const isPackaged = app.isPackaged
  
  if (isPackaged) {
    // In packaged app, use extraResources which are extracted outside the asar
    const resourcesPath = process.resourcesPath
    return {
      clientPath: path.join(resourcesPath, 'client'),
      serverPath: path.join(resourcesPath, 'server'),
      isPackaged: true
    }
  } else {
    // In development
    return {
      clientPath: path.join(__dirname, '../client'),
      serverPath: path.join(__dirname, '../server'),
      isPackaged: false
    }
  }
}

// Check if servers are already running
async function checkServersRunning() {
  try {
    debugLog('Checking if servers are already running...')
    const backendOk = await checkUrl('http://localhost:3001/health', 3000)
    const frontendOk = await checkUrl('http://localhost:3000', 3000)
    
    if (backendOk && frontendOk) {
      debugLog('✅ Both servers already running')
      return true
    }
    debugLog('Some servers not running yet')
  } catch (error) {
    debugLog('Error checking servers:', error.message)
  }
  return false
}

// Start servers based on environment
async function startServers() {
  debugLog('=== TaskerADHD Starting Up ===')
  debugLog('Checking if servers are already running...')
  
  // Check if servers are already running
  if (await checkServersRunning()) {
    debugLog('Servers already running, skipping startup')
    return
  }
  
  debugLog('App packaged status:', app.isPackaged)
  debugLog('Platform:', process.platform)
  debugLog('Node version:', process.version)
  debugLog('Electron version:', process.versions.electron)
  
  if (app.isPackaged) {
    // In packaged mode, start our own servers
    debugLog('App is packaged - starting internal servers...')
    debugLog('Creating debug console...')
    createDebugConsole()
    
    // Check if servers are already running first
    debugLog('Checking for existing servers...')
    const backendCheck = await checkUrl('http://localhost:3001/health', 3000)
    const frontendCheck = await checkUrl('http://localhost:3000', 3000)
    
    debugLog(`Backend server (3001) running: ${backendCheck}`)
    debugLog(`Frontend server (3000) running: ${frontendCheck}`)
    
    if (backendCheck && frontendCheck) {
      debugLog('✅ Servers already running! Proceeding with normal startup...')
      return
    }
    
    debugLog('🚀 Starting internal development servers...')
    // Fall through to start our own servers
  }
  
  // Development mode - start dev servers
  debugLog('Starting development servers...')
  createDebugConsole() // Also show debug console in dev mode for better debugging
  
  const paths = getProjectPaths()
  debugLog('Project paths:', paths)
  
  try {
    // Verify paths exist
    debugLog('Verifying paths exist...')
    if (!fs.existsSync(paths.serverPath)) {
      throw new Error(`Server path not found: ${paths.serverPath}`)
    }
    debugLog('Server path verified:', paths.serverPath)
    
    if (!fs.existsSync(paths.clientPath)) {
      throw new Error(`Client path not found: ${paths.clientPath}`)
    }
    debugLog('Client path verified:', paths.clientPath)

    // Start backend server
    debugLog('Starting backend server...')
    let serverCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
    
    // In packaged mode, try to find npm in different locations
    if (app.isPackaged) {
      debugLog('Looking for npm in packaged app...')
      const possibleNpmPaths = [
        'npm.cmd',
        'npm',
        path.join(process.env.ProgramFiles || 'C:\\Program Files', 'nodejs', 'npm.cmd'),
        path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'nodejs', 'npm.cmd'),
        path.join(process.env.APPDATA || '', 'npm', 'npm.cmd')
      ]
      
      for (const npmPath of possibleNpmPaths) {
        if (fs.existsSync(npmPath) || npmPath === 'npm.cmd' || npmPath === 'npm') {
          serverCmd = npmPath
          debugLog(`Found npm at: ${npmPath}`)
          break
        }
      }
    }
    
    debugLog('Server command:', serverCmd)
    
    // In packaged mode, install dependencies first then run dev
    if (app.isPackaged) {
      debugLog('Installing server dependencies...')
      // First install dependencies
      const installServer = spawn(serverCmd, ['install'], {
        cwd: paths.serverPath,
        shell: process.platform === 'win32',
        stdio: 'pipe'
      })
      
      await new Promise((resolve) => {
        installServer.on('close', () => {
          debugLog('Server dependencies installed')
          resolve()
        })
      })
      
      debugLog('Generating Prisma client...')
      const prismaGenerate = spawn(serverCmd, ['run', 'prisma:generate'], {
        cwd: paths.serverPath,
        shell: process.platform === 'win32',
        stdio: 'pipe'
      })
      
      await new Promise((resolve) => {
        prismaGenerate.on('close', () => {
          debugLog('Prisma client generated')
          resolve()
        })
      })
      
      debugLog('Setting up database...')
      const prismaPush = spawn(serverCmd, ['run', 'prisma:push'], {
        cwd: paths.serverPath,
        shell: process.platform === 'win32',
        stdio: 'pipe',
        env: { 
          ...process.env, 
          DATABASE_URL: 'file:./dev.db'
        }
      })
      
      await new Promise((resolve) => {
        prismaPush.on('close', () => {
          debugLog('Database setup complete')
          resolve()
        })
      })
      
      debugLog('Running server via npm run dev (packaged)...')
      serverProcess = spawn(serverCmd, ['run', 'dev'], {
        cwd: paths.serverPath,
        shell: process.platform === 'win32',
        stdio: 'pipe',
        env: { 
          ...process.env, 
          NODE_ENV: 'development',
          DATABASE_URL: 'file:./dev.db',
          DISABLE_REDIS: process.env.REDIS_URL ? '0' : '1',
          JWT_SECRET: 'your-jwt-secret-key-change-in-production',
          JWT_EXPIRES_IN: '7d',
          MAGIC_LINK_SECRET: 'your-magic-link-secret-change-in-production',
          FRONTEND_URL: 'http://localhost:3000'
        }
      })
    } else {
      debugLog('Running server via npm run dev...')
      serverProcess = spawn(serverCmd, ['run', 'dev'], {
        cwd: paths.serverPath,
        shell: process.platform === 'win32',
        stdio: 'pipe',
        env: { 
          ...process.env, 
          NODE_ENV: 'development',
          DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db',
          DISABLE_REDIS: process.env.REDIS_URL ? '0' : '1',
          JWT_SECRET: process.env.JWT_SECRET || 'your-jwt-secret-key-change-in-production',
          JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
          MAGIC_LINK_SECRET: process.env.MAGIC_LINK_SECRET || 'your-magic-link-secret-change-in-production',
          FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000'
        }
      })
    }

    serverProcess.stdout?.on('data', (data) => {
      debugLog(`[SERVER] ${data.toString().trim()}`)
    })

    serverProcess.stderr?.on('data', (data) => {
      debugLog(`[SERVER ERROR] ${data.toString().trim()}`)
    })

    serverProcess.on('error', (error) => {
      debugLog('Server process error:', {
        message: error.message,
        code: error.code,
        errno: error.errno,
        path: error.path
      })
    })

    serverProcess.on('exit', (code, signal) => {
      debugLog(`Server process exited with code ${code}, signal ${signal}`)
    })

    // Start frontend server
    debugLog('Starting frontend server...')
    let clientCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
    
    // In packaged mode, use the same npm path we found for server
    if (app.isPackaged) {
      clientCmd = serverCmd // Reuse the npm path we already found
    }
    
    debugLog('Client command:', clientCmd)
    
    // In packaged mode, install dependencies first then run dev
    if (app.isPackaged) {
      debugLog('Installing client dependencies...')
      // First install dependencies
      const installClient = spawn(clientCmd, ['install'], {
        cwd: paths.clientPath,
        shell: process.platform === 'win32',
        stdio: 'pipe'
      })
      
      await new Promise((resolve) => {
        installClient.on('close', () => {
          debugLog('Client dependencies installed')
          resolve()
        })
      })
      
      debugLog('Running client via npm run dev (packaged)...')
      clientProcess = spawn(clientCmd, ['run', 'dev'], {
        cwd: paths.clientPath,
        shell: process.platform === 'win32',
        stdio: 'pipe',
        env: { ...process.env, NODE_ENV: 'development' }
      })
    } else {
      debugLog('Running client via npm run dev...')
      clientProcess = spawn(clientCmd, ['run', 'dev'], {
        cwd: paths.clientPath,
        shell: process.platform === 'win32',
        stdio: 'pipe',
        env: { ...process.env, NODE_ENV: 'development' }
      })
    }

    clientProcess.stdout?.on('data', (data) => {
      debugLog(`[CLIENT] ${data.toString().trim()}`)
    })

    clientProcess.stderr?.on('data', (data) => {
      debugLog(`[CLIENT ERROR] ${data.toString().trim()}`)
    })

    clientProcess.on('error', (error) => {
      debugLog('Client process error:', {
        message: error.message,
        code: error.code,
        errno: error.errno,
        path: error.path
      })
    })

    clientProcess.on('exit', (code, signal) => {
      debugLog(`Client process exited with code ${code}, signal ${signal}`)
    })



    // Wait for both servers to be ready
    debugLog('Waiting for servers to be ready...')
    await waitForServers(30, 2000) // 30 attempts, 2 seconds each = 60 seconds max
    debugLog('Development servers ready!')
    
  } catch (err) {
    debugLog('Failed to start development servers:', err)
    
    // Show user-friendly error dialog
    dialog.showErrorBox(
      'Server Startup Failed', 
      `Failed to start the application servers. Please ensure:\n\n` +
      `1. Node.js is installed and accessible\n` +
      `2. Dependencies are installed (npm install)\n` +
      `3. Ports 3000 and 3001 are available\n` +
      `4. No antivirus is blocking the application\n\n` +
      `Error: ${err.message}\n\n` +
      `You can try running the app manually:\n` +
      `1. Open terminal in the TaskerADHD folder\n` +
      `2. Run: npm run dev\n\n` +
      `Debug console is showing detailed logs.`
    )
    
    app.quit()
  }
}

// App event handlers
app.whenReady().then(async () => {
  debugLog('🚀 Electron app ready, starting initialization...')
  
  try {
    // Attempt to kill stray dev processes on common ports to avoid conflicts
    try {
      if (process.platform === 'win32') {
        // Kill node processes listening on common ports (best-effort)
        const netstat = spawn('powershell', ['-NoProfile','-Command', "Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 3000..3005 -or $_.LocalPort -eq 3001 } | Select-Object -ExpandProperty OwningProcess | Get-Process -Id {$_} | Select-Object -ExpandProperty Id"], { shell: true })
        netstat.stdout.on('data', (data) => {
          const pids = data.toString().split(/\s+/).filter(Boolean)
          pids.forEach(pid => {
            try { spawn('taskkill', ['/pid', pid, '/f', '/t']) } catch {}
          })
        })
      }
    } catch (e) {
      debugLog('Best-effort port cleanup failed (non-fatal):', e.message)
    }

    // Start servers
    await startServers()
    
    debugLog('📋 Setting up menu...')
    const menu = Menu.buildFromTemplate(menuTemplate)
    Menu.setApplicationMenu(menu)
    
    debugLog('🖼️ Creating main window...')
    createWindow()
    
    debugLog('✅ Application initialization complete!')
    
    // Additional check for packaged apps - try to load the main window anyway
    if (app.isPackaged) {
      debugLog('📱 Packaged app - attempting to load main window with localhost:3000...')
      mainWindow.loadURL('http://localhost:3000')
        .then(() => {
          debugLog('✅ Successfully loaded main application')
        })
        .catch((err) => {
          debugLog('❌ Failed to load main application:', err.message)
          debugLog('This is expected if development servers are not running')
        })
    }
  } catch (error) {
    debugLog('❌ Application initialization failed:', error)
    dialog.showErrorBox('Initialization Failed', `Application failed to start: ${error.message}`)
  }
})

app.on('window-all-closed', () => {
  debugLog('All windows closed')
  if (!isMac) {
    debugLog('Quitting application (not macOS)')
    app.quit()
  }
})

app.on('activate', () => {
  debugLog('App activated')
  if (BrowserWindow.getAllWindows().length === 0) {
    debugLog('No windows open, creating new window')
    createWindow()
  }
})

// Graceful shutdown function
async function gracefulShutdown() {
  if (isShuttingDown) {
    debugLog('Shutdown already in progress, skipping...')
    return
  }
  
  isShuttingDown = true
  debugLog('🛑 Starting graceful shutdown...')
  
  try {
    // First, cleanly shutdown our tracked processes
    if (serverProcess) {
      debugLog('📤 Sending SIGTERM to server process...')
      try {
        if (process.platform === 'win32') {
          // On Windows, send a graceful shutdown signal first
          serverProcess.kill('SIGTERM')
          // Wait a bit for graceful shutdown
          await new Promise(resolve => setTimeout(resolve, 3000))
          // If still running, force kill
          if (!serverProcess.killed) {
            spawn('taskkill', ['/pid', serverProcess.pid.toString(), '/f', '/t'])
          }
        } else {
          serverProcess.kill('SIGTERM')
          // Wait for graceful shutdown
          await new Promise(resolve => setTimeout(resolve, 3000))
          if (!serverProcess.killed) {
            serverProcess.kill('SIGKILL')
          }
        }
      } catch (e) {
        debugLog('Error during server shutdown:', e.message)
      }
    }
    
    if (clientProcess) {
      debugLog('📤 Sending SIGTERM to client process...')
      try {
        if (process.platform === 'win32') {
          clientProcess.kill('SIGTERM')
          await new Promise(resolve => setTimeout(resolve, 2000))
          if (!clientProcess.killed) {
            spawn('taskkill', ['/pid', clientProcess.pid.toString(), '/f', '/t'])
          }
        } else {
          clientProcess.kill('SIGTERM')
          await new Promise(resolve => setTimeout(resolve, 2000))
          if (!clientProcess.killed) {
            clientProcess.kill('SIGKILL')
          }
        }
      } catch (e) {
        debugLog('Error during client shutdown:', e.message)
      }
    }
    
    // Clean up any stray Node.js processes on our ports
    debugLog('🧹 Cleaning up stray processes on known ports...')
    if (process.platform === 'win32') {
      const portsToClean = [3000, 3001, 3002, 3003, 3004, 3005]
      
      // First, try to kill processes on specific ports
      for (const port of portsToClean) {
        try {
          const { spawn: spawnSync } = require('child_process')
          // Find processes using the port
          const netstat = spawnSync('powershell', ['-Command', 
            `Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object OwningProcess`
          ], { stdio: ['ignore', 'pipe', 'ignore'] })
          
          if (netstat.stdout) {
            const output = netstat.stdout.toString()
            const pidMatches = output.match(/\d+/g)
            if (pidMatches) {
              for (const pid of pidMatches) {
                if (pid && parseInt(pid) > 0) {
                  debugLog(`🔪 Killing process ${pid} on port ${port}`)
                  // Kill with force and terminate child processes
                  spawn('taskkill', ['/pid', pid, '/f', '/t'], { stdio: 'ignore' })
                }
              }
            }
          }
        } catch (e) {
          // Try alternative method with netstat
          try {
            const netstatAlt = spawnSync('netstat', ['-ano'], { stdio: ['ignore', 'pipe', 'ignore'] })
            if (netstatAlt.stdout) {
              const lines = netstatAlt.stdout.toString().split('\n')
              for (const line of lines) {
                if (line.includes(`:${port} `) && (line.includes('LISTENING') || line.includes('ESTABLISHED'))) {
                  const parts = line.trim().split(/\s+/)
                  const pid = parts[parts.length - 1]
                  if (pid && parseInt(pid) > 0) {
                    debugLog(`🔪 Force killing process ${pid} on port ${port}`)
                    spawn('taskkill', ['/pid', pid, '/f', '/t'], { stdio: 'ignore' })
                  }
                }
              }
            }
          } catch (e2) {
            debugLog(`Could not clean port ${port}:`, e2.message)
          }
        }
      }
      
      // Additional aggressive cleanup for Node.js processes
      try {
        debugLog('🔪 Final cleanup: killing any remaining Node.js processes')
        
        // Kill any node.exe processes that might be from our app
        spawn('powershell', ['-Command', 
          `Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -eq "node" } | Stop-Process -Force`
        ], { stdio: 'ignore' })
        
        // Also try direct taskkill as backup
        spawn('taskkill', ['/im', 'node.exe', '/f', '/t'], { stdio: 'ignore' })
        
        // Wait for processes to die
        await new Promise(resolve => setTimeout(resolve, 2000))
        
      } catch (e) {
        debugLog('Could not perform final Node.js cleanup:', e.message)
      }
    }
    
    // Final wait to ensure all processes have time to die
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    debugLog('✅ Graceful shutdown completed')
  } catch (error) {
    debugLog('❌ Error during graceful shutdown:', error.message)
  }
  
  // Close the app after cleanup
  app.quit()
}

app.on('before-quit', (event) => {
  if (!isShuttingDown) {
    // Prevent immediate quit and do graceful shutdown
    event.preventDefault()
    gracefulShutdown().catch(error => {
      debugLog('Error during before-quit graceful shutdown:', error.message)
      // Force quit if graceful shutdown fails
      app.exit(1)
    })
  }
})

// IPC handlers for renderer process
ipcMain.handle('get-version', () => {
  return app.getVersion()
})

ipcMain.handle('get-platform', () => {
  return process.platform
})

ipcMain.handle('app-shutdown', async () => {
  debugLog('🛑 Shutdown requested from UI')
  await gracefulShutdown()
  return true
})

// Handle app crashes and errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})