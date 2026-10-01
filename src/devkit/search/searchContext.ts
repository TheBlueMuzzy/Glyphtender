// What the Dev Kit panel tells a settings tab about the search box: the text typed ('' = not searching), and
// goTo(sectionId) = "take me to this section" (clears the search, shows the tab, opens + scrolls to the section).
// A tab reads it with useContext(DevKitSearch); DevKit.tsx provides it around each tab.
import { createContext } from 'react'

export type DevKitSearchInfo = { query: string; goTo: (sectionId: string) => void }

export const DevKitSearch = createContext<DevKitSearchInfo>({ query: '', goTo: () => {} })
