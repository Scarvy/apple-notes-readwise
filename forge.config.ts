import type { ForgeConfig } from '@electron-forge/shared-types'
import { MakerSquirrel } from '@electron-forge/maker-squirrel'
import { MakerDeb } from '@electron-forge/maker-deb'
import { MakerZIP } from '@electron-forge/maker-zip'
import { MakerRpm } from '@electron-forge/maker-rpm'
import { VitePlugin } from '@electron-forge/plugin-vite'
import { FusesPlugin } from '@electron-forge/plugin-fuses'
import { FuseV1Options, FuseVersion } from '@electron/fuses'
import * as dotenv from 'dotenv'

dotenv.config()

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: 'resources/icon',
    osxSign: {
      optionsForFile(_filePath: string) {
        return {
          entitlements: './entitlements/entitlements.plist',
        };
      }
    },
    osxNotarize: {
      appleId: process.env.APPLE_ID || '',
      appleIdPassword: process.env.APPLE_ID_PASSWORD || '',
      teamId: process.env.APPLE_TEAM_ID || ''
    },
    extendInfo: {
      "NSAppleEventsUsageDescription": "This app requires permission to access and interact with Apple Notes.",
      "NSSystemAdministrationUsageDescription": "This app requires full disk access to read and process your notes securely."
    },
    "protocols": [
      {
        "name": "Readwise to Apple Notes",
        "schemes": ["readwise-apple-notes"]
      }
    ]
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({}),
    new MakerRpm({}),
    new MakerDeb({}),
    new MakerZIP({}),
    {
      name: '@electron-forge/maker-dmg',
      config: { overwrite: true, icon: 'resources/icon_128x128.png' }
    }
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: process.env.GITHUB_OWNER || '',
          name: process.env.GITHUB_REPO || ''
        },
        draft: true,
        prerelease: true,
        generateReleaseNotes: true,
        authToken: process.env.GITHUB_TOKEN || ''
      }
    }
  ],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main/index.ts',
          config: 'vite.main.config.ts',
          target: 'main'
        },
        {
          entry: 'src/preload/index.ts',
          config: 'vite.preload.config.ts',
          target: 'preload'
        }
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts'
        }
      ]
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true
    })
  ]
}

export default config
