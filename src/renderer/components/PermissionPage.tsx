import React, { useEffect } from 'react'
import { Card, CardContent } from './ui/card'
// @ts-ignore
import permissionImg from '../../images/permissions.png'

export default function PermissionPage({ onIsPermissioned }) {
  useEffect(() => {
    const getPermission = async () => {
      const permissioned = await window.api.requestAppleNotesPermission()
      onIsPermissioned(permissioned)
    }

    getPermission()
  }, [onIsPermissioned])

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3">
        <img className="mt-1" src={permissionImg} alt="Permission" width={280} height={200} />
        <p className="mt-2 text-left">
          The "Readwise to Apple Notes" app is needed to export your highlights from Readwise. We
          will only have access to this folder where your notes and highlights are stored. No other
          data will be possible for us to reach
        </p>
        <p className="text-lg">
          <b>Please hit "Open" to grant us access to your Apple Notes folder.</b>
        </p>
      </CardContent>
    </Card>
  )
}
