import { useEffect, useState } from 'react'
import { app } from '@microsoft/teams-js'
import { PersonalTab } from './pages/PersonalTab'
import { ChannelTab } from './pages/ChannelTab'

type Context = 'personal' | 'channel' | null

export default function App() {
  const [ctx, setCtx] = useState<Context>(null)

  useEffect(() => {
    app
      .initialize()
      .then(() => app.getContext())
      .then((teamsCtx) => {
        setCtx(teamsCtx.channel?.id ? 'channel' : 'personal')
      })
      .catch(() => {
        // Outside Teams (local dev) — drive with ?tab=channel
        const param = new URLSearchParams(window.location.search).get('tab')
        setCtx(param === 'channel' ? 'channel' : 'personal')
      })
  }, [])

  if (ctx === null) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#616161',
          fontSize: 13,
        }}
      >
        Initialising ELLA Square…
      </div>
    )
  }

  return ctx === 'channel' ? <ChannelTab /> : <PersonalTab />
}
