/// <reference types="vite/client" />

import type { GatherApi } from '@shared/types'

declare global {
  interface Window {
    gather?: GatherApi
  }
}

export {}
