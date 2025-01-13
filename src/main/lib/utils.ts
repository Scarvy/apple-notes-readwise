import { execFile } from 'node:child_process'
import { store } from '@/lib/store'

// https://github.com/sindresorhus/run-applescript/blob/9db60e8a8fa7db46534c3c8a05c0f58135280ebb/index.js#L5
async function runAppleScript(
  script: string,
  { humanReadableOutput = true } = {}
): Promise<string> {
  const outputArguments = humanReadableOutput ? [] : ['-ss']

  return new Promise((resolve, reject) => {
    execFile('osascript', ['-e', script, ...outputArguments], (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Error: ${stderr || error.message}`))
      } else {
        resolve(stdout.trim())
      }
    })
  })
}

export async function updateAppleNotesAccounts() {
  const newAccounts = await getAppleNotesAccounts()
  const storedAccounts = store.get('accounts') || []
  const storedDefaultAccount = store.get('defaultAccount') || ''

  // Check if there are any new accounts
  if (JSON.stringify(newAccounts) !== JSON.stringify(storedAccounts)) {
    store.set('accounts', newAccounts)
  }

  if (!storedDefaultAccount) {
    const defaultAccount = await fetchDefaultAccount()
    store.set('defaultAccount', defaultAccount)
    store.set('currentAccount', defaultAccount)
  }

  return {
    accounts: store.get('accounts'),
    defaultAccount: store.get('defaultAccount'),
    currentAccount: store.get('currentAccount')
  }
}

function sanitizeHTML(text: string | number | null | undefined) {
  if (!text && text !== 0) return '' // Handle undefined, null, or empty cases
  return text
    .toString()
    .replace(/\\/g, '\\\\') // Escape backslashes
    .replace(/"/g, '\\"') // Escape double quotes
    .replace(/\n/g, '\\n') // Escape newlines
}

const executeAppleScript = async (script: string): Promise<string> => {
  try {
    const result = await runAppleScript(script)
    return result
  } catch (error) {
    console.error('Error executing AppleScript:', error)
    throw error
  }
}

async function fetchDefaultAccount() {
  const script = `
    tell application "Notes"
      set defaultAccount to the default account
      set defaultAccountName to name of defaultAccount
      return defaultAccountName
    end tell
  `
  const result = await executeAppleScript(script)
  return result.trim()
}

export async function checkIfNoteExist(
  note_id: string,
  folder: string,
  account: string
): Promise<boolean> {
  const script = `
      tell application "Notes"
      set noteExist to false
        try
            set theAccount to account "${account}" -- specify your account name here
            set theFolder to folder "${folder}" of theAccount -- specify your folder name here
            set theNote to the first note in theFolder whose id is "${note_id}"
            set noteExist to true
        on error
            set noteExist to false
        end try
      end tell
      return noteExist
    `

  const result = await executeAppleScript(script)
  return result === 'true'
}

export async function getAppleNotesAccounts(): Promise<string[]> {
  const script = `
    tell application "Notes"
      set accountNames to {}
      
      -- Loop through each account and collect names
      repeat with anAccount in accounts
          set end of accountNames to name of anAccount
      end repeat
      
      -- Return the list of account names
      return accountNames
    end tell
    `

  const result = await executeAppleScript(script)
  return result.split(', ')
}

export const checkFolderExistsAndIsEmptyInAppleNotes = async (
  folder: string,
  account: string
): Promise<boolean> => {
  const script = `
    tell application "Notes"
      set folderName to "${folder}"
      set accountName to "${account}"
      
      try
          set targetFolder to folder folderName of account accountName
          if (count of notes of targetFolder) is 0 then
              return true -- Folder exists and is empty
          else
              return false -- Folder exists but is not empty
          end if
      on error
          return false -- Folder does not exist
      end try
    end tell
  `

  const result = await executeAppleScript(script)
  return result === 'true'
}

export const checkFolderExistsInAppleNotes = async (
  folder: string,
  account: string
): Promise<boolean> => {
  const script = `
      tell application "Notes"
        set folderName to "${folder}"
        set accountName to "${account}"
        
        try
            set targetFolder to folder folderName of account accountName
            return true -- Folder exists
        on error
            return false -- Folder does not exist
        end try
      end tell
    `

  const result = await executeAppleScript(script)
  return result === 'true'
}

export const createFolderInAppleNotes = async (
  folder: string,
  account: string
): Promise<boolean> => {
  const script = `
      tell application "Notes"
        set folderName to "${folder}"
        set accountName to "${account}"
        
        try
            set targetAccount to account accountName
            make new folder at targetAccount with properties {name:folderName}
            return true -- Folder created
        on error
            return false -- Folder not created
        end try
      end tell
    `

  const result = await executeAppleScript(script)
  return result === 'true'
}

export const checkIfFolderIsEmtpy = async (folder: string, account: string): Promise<boolean> => {
  const script = `
      tell application "Notes"
        set folderName to "${folder}"
        set accountName to "${account}"
        try
            set targetFolder to folder folderName of account accountName
            if (count of notes of targetFolder) is 0 then
                return true -- Folder is empty
            else
                return false -- Folder is not empty
            end if
        on error
            return false -- Folder does not exist
        end try
      end tell
    `

  const result = await executeAppleScript(script)
  return result === 'true'
}

export const updateExistingNote = async (
  content: string,
  note_id: string,
  folder: string,
  account: string
): Promise<string> => {
  const cleanContent = sanitizeHTML(content) // Sanitize the content for AppleScript
  const script = `
      tell application "Notes"
        try
            -- Specify the account and folder
            set targetAccount to first account whose name is "${account}"
            set targetFolder to first folder of targetAccount whose name is "${folder}"
            
            -- Find the note with the specified ID
            set noteMatch to first note of targetFolder whose id is "${note_id}"
            set noteTitle to name of noteMatch
            set currentContent to the body of noteMatch -- retrieve existing content
            
            -- Update the note with the new content appended
            set newContent to currentContent & "<div><br></div>" & "${cleanContent}" -- modify appended text here
            set body of noteMatch to newContent
            
            -- Return the ID of the updated note
            return id of noteMatch
        on error
            -- Return an empty string if the note is not found
            return ""
        end try
    end tell
    `
  const result = await executeAppleScript(script)
  return result
}

export const appendToExistingNote = async (
  content: string,
  note_id: string,
  folder: string,
  account: string
): Promise<string> => {
  const cleanContent = sanitizeHTML(content) // Sanitize the content for AppleScript
  const script = `
      tell application "Notes"
        try
          -- Specify the account and folder
          set targetAccount to first account whose name is "${account}"
          set targetFolder to first folder of targetAccount whose name is "${folder}"
          
          -- Find the note with the specified ID
          set noteMatch to first note of targetFolder whose id is "${note_id}"
          set noteTitle to name of noteMatch
          
          -- Append the new content to the existing note
          set body of noteMatch to "<h1>" & noteTitle & "</h1><br>" & "${cleanContent}"

          -- Return the ID of the updated note
          return id of noteMatch
        on error
          -- Return an empty string if the note is not found
          return ""
        end try
      end tell
    `
  const result = await executeAppleScript(script)
  return result
}

export const createNewNote = async (
  content: string,
  title: string,
  folder: string,
  account: string
) => {
  const cleanContent = sanitizeHTML(content) // Sanitize the content for AppleScript  
  const appleScript = `
    tell application "Notes"

        -- Specify the desired account and folder
        set desiredAccountName to "${account}"
        set folderName to "${folder}"
        set noteTitle to "${title}"
        set noteBody to "${cleanContent}"

        set noteCreated to ""

        -- Create a new note in the specified folder of the desired account
        try            
            set newNote to make new note at folder folderName of account desiredAccountName with properties {name:"", body:noteBody}
            log "Note '" & noteTitle & "' updated in folder '" & folderName & "' of " & account & " desiredAccountName."
            set noteCreated to id of newNote
        on error
            log "Note '" & noteTitle & "' not found in folder '" & folderName & "' of " & account & " desiredAccountName."
        end try
        return noteCreated
    end tell
    `
  const result = await executeAppleScript(appleScript)
  return result
}
