import { hydrateStart, StartClient } from '@tanstack/solid-start/client'
import { getRouter } from './router'
import { mount } from 'solid-js/web'

const router = getRouter()

hydrateStart().then(() => {
  mount(() => <StartClient router={router} />, document.getElementById('app')!)
})
