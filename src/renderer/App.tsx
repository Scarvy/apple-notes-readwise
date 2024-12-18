import React, { useState, useEffect } from 'react'
import { Toaster } from './components/ui/toaster'
import { LoginCard } from './components/login'
import { SettingsOptions } from './components/settings-options'
import { SyncingProgress } from './components/syncing-progress'

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  const checkLoginStatus = async () => {
    const token = await window.api.getStoreValue('token')
    setIsLoggedIn(Boolean(token)) // Set state based on the token existence
  }

  useEffect(() => {
    checkLoginStatus()

    window.api.on('login-status', (_event, loggedIn: boolean) => {
      setIsLoggedIn(loggedIn)

      if (loggedIn) {
        console.log('Logged in')
      } else {
        console.log('Logged out')
      }
    })

    return () => {
      window.api.removeAllListeners('login-status')
    }
  }, [isSyncing])

  return (
    <div className="grid grid-rows-1 min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col">
        <div className="md:container space-y-3">
          <h1 className="text-4xl font-bold text-black mb-1">Apple Notes Export</h1>
          <hr className="border-[1px] border-black"></hr>
          {isLoggedIn ? (
            isSyncing ? (
              <SyncingProgress onIsSyncing={setIsSyncing} />
            ) : (
              <SettingsOptions onIsSyncing={setIsSyncing} />
            )
          ) : (
            <LoginCard />
          )}
          <Toaster />
        </div>
        <footer className="p-8 text-center text-sm text-black">
          <p>
            Questions? Please see our{' '}
            <a
              className="text-blue-500"
              href="https://github.com/Scarvy/apple-notes-readwise/wiki/User-Guide"
              target="_blank"
            >
              docs
            </a>{' '}
            or email us at{' '}
            <a className="text-blue-500" href="mailto:hello@readwise.io" target="_blank">
              hello@readwise.io
            </a>{' '}
            🙂
          </p>
        </footer>
      </main>
    </div>
  )
}
