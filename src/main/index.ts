import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron'
import path from 'path'
import { updateAppleNotesAccounts } from '@/lib/utils'
import { getAppleNoteClientID, getUserAuthToken, ReadwiseSync } from '@/lib'
import { store } from '@/lib/store'
import { updateElectronApp } from 'update-electron-app'

updateElectronApp()

let mainWindow: BrowserWindow

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 650,
    maxWidth: 800,
    maxHeight: 650,
    minWidth: 800,
    minHeight: 650,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true
    }
  })

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`))
  }

  const isDev = !app.isPackaged

  const customMenuItems = [
    {
      label: 'User Guide',
      click: async () => {
        shell.openExternal('https://github.com/Scarvy/apple-notes-readwise/wiki/User-Guide')
      }
    },
    {
      label: 'Report an Issue',
      click: async () => {
        shell.openExternal('https://github.com/Scarvy/apple-notes-readwise/issues')
      }
    },
    {
      label: 'Check latest release',
      click: async () => {
        shell.openExternal('https://github.com/Scarvy/apple-notes-readwise/releases')
      }
    },
    {
      label: 'Permission Issues?',
      click: async () => {
        shell.openExternal(
          'https://scottsplace.notion.site/Apple-Notes-Readwise-Export-Fixing-permission-issues-14474debfabc805e8701f8534d1854a8?pvs=4'
        )
      }
    },
    {
      label: 'Contact Developer',
      click: async () => {
        shell.openExternal('mailto:scottcarvalho71@gmail.com')
      }
    }
  ]

  const defaultMenu = Menu.getApplicationMenu()

  if (defaultMenu) {
    // Clone existing menu items
    const menuTemplate = defaultMenu.items.map((item) => {
      if (item.label === 'Help') {
        // Update the 'Help' menu
        const updatedHelpMenu = {
          ...item,
          submenu: Menu.buildFromTemplate([
            ...(item.submenu ? item.submenu.items : []), // Preserve existing Help submenu items
            ...customMenuItems // Add custom Help submenu items
          ])
        }
        return updatedHelpMenu
      }
      return item // Return other menu items unchanged
    })

    // Set the updated menu
    const menu = Menu.buildFromTemplate(menuTemplate)
    Menu.setApplicationMenu(menu)
  } else {
    // Fallback: Create a new menu with only the custom Help menu
    const menu = Menu.buildFromTemplate([...customMenuItems])
    Menu.setApplicationMenu(menu)
  }

  // check if the user is authenticated
  const tokenExsits = Boolean(store.get('token'))
  console.log('User is authenticated: ', tokenExsits)
  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow.webContents.send('login-status', tokenExsits)
    if (tokenExsits) {
      // Configure scheduled sync
      const syncFrequency = store.get('frequency') || '0' // default to manual
      configureScheduledSync(syncFrequency)

      // if token exists check if the user has set to sync on startup
      const triggerOnLoad = Boolean(store.get('triggerOnLoad'))
      console.log('Trigger on load: ', triggerOnLoad)
      if (triggerOnLoad) {
        // if sync is already in progress, don't start another one
        if (Boolean(store.get('isSyncing'))) {
          mainWindow.webContents.send('toast:show', {
            variant: 'default',
            message: 'Sync already in progress...'
          })
          console.log('Sync already in progress')
          return
        }

        mainWindow.webContents.send('toast:show', {
          variant: 'default',
          message: 'Initiating sync...'
        })
        const readwiseSync = new ReadwiseSync(mainWindow, store)
        readwiseSync.syncHighlights(undefined, true)
        console.log('Syncing highlights on load')
      }
    }
  })

  // Open external links in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Open the DevTools if the app is in development mode
  isDev && mainWindow.webContents.openDevTools()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

ipcMain.on('login-status', (event: Electron.Event, loggedIn: boolean) => {
  event.preventDefault()
  mainWindow.webContents.send('login-status', loggedIn)
})

ipcMain.handle('electron-store-get', async (_, key) => {
  return store.get(key)
})

ipcMain.on('electron-store-set', async (_, key, value) => {
  store.set(key, value)
})

// Testing Apple Notes extraction
// ipcMain.handle('connect-to-database', async () => {
//   console.log('Connecting to Apple Notes database...')
//   const name = 'Normal People'
//   const appleNoteExtractor = new AppleNotesExtractor(mainWindow, true)
//   appleNoteExtractor.extractNotesHTML(name, 'Readwise')
// })

ipcMain.handle('sync-highlights', async (_event, auto?: boolean) => {
  // if sync is already in progress, don't start another one
  if (Boolean(store.get('isSyncing'))) {
    mainWindow.webContents.send('toast:show', {
      variant: 'default',
      message: 'Sync already in progress...'
    })
    console.log('Sync already in progress')
    return
  }

  mainWindow.webContents.send('toast:show', { variant: 'default', message: 'Initiating sync...' })

  const readwiseSync = new ReadwiseSync(mainWindow, store)
  return readwiseSync.syncHighlights(undefined, auto)
})

ipcMain.handle('connect-to-readwise', async (event: Electron.Event) => {
  event.preventDefault()
  const uuid = getAppleNoteClientID()

  shell.openExternal(`https://readwise.io/api_auth?token=${uuid}&service=apple-notes`)

  const token = await getUserAuthToken(uuid)
  if (token) {
    await store.set('token', token)
    mainWindow.webContents.send('login-status', true)
    console.log('Connected to Readwise')
    return 'Connected to Readwise'
  } else {
    console.error('Failed to connect to Readwise')
    mainWindow.webContents.send('login-status', false)
    console.log('Failed to connect to Readwise')
    return 'Failed to connect to Readwise'
  }
})

ipcMain.handle('open-custom-format-window', (event: Electron.Event) => {
  event.preventDefault()
  shell.openExternal(`https://readwise.io/export/apple-notes/preferences`)
})

ipcMain.handle('fetch-apple-notes-accounts', async () => {
  return await updateAppleNotesAccounts()
})

ipcMain.handle('update-sync-frequency', async (_event, frequency: string) => {
  return await configureScheduledSync(frequency)
})

async function configureScheduledSync(frequency: string) {
  const minutes = parseInt(frequency)
  let milliseconds = minutes * 60 * 1000 // convert minutes to milliseconds
  console.log('Settings interval to ', milliseconds)
  if (!milliseconds) {
    // user set frequency to "Manual"
    return '0'
  }
  setInterval(async () => {
    console.log('Syncing highlights...', new Date())
    const readwiseSync = new ReadwiseSync(mainWindow, store)
    await readwiseSync.syncHighlights(undefined, true)
  }, milliseconds)
  return frequency
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
