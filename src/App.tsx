import { useEffect, useState } from 'react'
import './App.css'

// Type definitions for our tab and group data structures
type TabSummary = {
  id: number
  title: string
  url: string
  selected: boolean
}

type GroupSuggestion = {
  host: string // e.g. "youtube.com"
  tabs: TabSummary[]
  groupSelected: boolean // whole group on/off
  customName?: string // User-defined name for the group
}

/**
 * Extracts the hostname from a URL, removing 'www.' prefix if present
 * Returns "unknown" if the URL is invalid
 */
function getHostname(url: string): string {
  try {
    const u = new URL(url)
    return u.hostname.replace(/^www\./, '')
  } catch {
    return 'unknown'
  }
}

function App() {
  // State to track loading status
  const [loading, setLoading] = useState(true)
  
  // State to hold our grouped tab suggestions
  const [groups, setGroups] = useState<GroupSuggestion[]>([])
  
  // State to track if organization was successful
  const [organized, setOrganized] = useState(false)
  
  // Track current active tab ID
  const [activeTabId, setActiveTabId] = useState<number | undefined>(undefined)
  
  // Track which group is being renamed
  const [editingGroupIndex, setEditingGroupIndex] = useState<number | null>(null)

  // Fetch and group tabs when component mounts
  useEffect(() => {
    async function loadTabs() {
      try {
        // Query all tabs in the current window
        const tabs = await chrome.tabs.query({ currentWindow: true })
        
        // Filter out Chrome internal pages and extension pages
        const filteredTabs = tabs.filter(
          (tab) =>
            tab.url &&
            !tab.url.startsWith('chrome://') &&
            !tab.url.startsWith('chrome-extension://')
        )

        // Get current active tab ID for highlighting
        const currentWindow = await chrome.windows.getCurrent()
        const activeTab = await chrome.tabs.query({ 
          active: true, 
          windowId: currentWindow.id 
        })
        const currentActiveTabId = activeTab[0]?.id

        // Group tabs by hostname
        // Using a Map to efficiently group tabs by their hostname
        const hostMap = new Map<string, TabSummary[]>()

        filteredTabs.forEach((tab) => {
          if (tab.id && tab.url && tab.title) {
            const host = getHostname(tab.url)
            const tabSummary: TabSummary = {
              id: tab.id,
              title: tab.title,
              url: tab.url,
              selected: true, // All tabs selected by default
            }

            if (!hostMap.has(host)) {
              hostMap.set(host, [])
            }
            hostMap.get(host)!.push(tabSummary)
          }
        })

        // Convert Map to GroupSuggestion array
        // Each group starts with all tabs selected (groupSelected: true)
        const groupSuggestions: GroupSuggestion[] = Array.from(
          hostMap.entries()
        ).map(([host, tabs]) => ({
          host,
          tabs,
          groupSelected: true,
        }))

        setGroups(groupSuggestions)
        setActiveTabId(currentActiveTabId)
        setLoading(false)
      } catch (error) {
        console.error('Error loading tabs:', error)
        setLoading(false)
      }
    }

    loadTabs()
  }, [])

  /**
   * Toggles the selection state of an entire group
   * When a group is toggled, all tabs in that group are also toggled
   */
  const toggleGroup = (groupIndex: number) => {
    setGroups((prevGroups) => {
      const updated = [...prevGroups]
      const group = updated[groupIndex]
      group.groupSelected = !group.groupSelected
      
      // Update all tabs in the group to match the group's selection state
      group.tabs = group.tabs.map((tab) => ({
        ...tab,
        selected: group.groupSelected,
      }))
      
      return updated
    })
  }

  /**
   * Toggles the selection state of a single tab
   * If all tabs in a group are selected/deselected, update the group's state accordingly
   */
  const toggleTab = (groupIndex: number, tabIndex: number) => {
    setGroups((prevGroups) => {
      const updated = [...prevGroups]
      const group = updated[groupIndex]
      const tab = group.tabs[tabIndex]
      
      // Toggle the individual tab
      tab.selected = !tab.selected
      
      // Update group selection state based on whether all tabs are selected
      group.groupSelected = group.tabs.every((t) => t.selected)
      
      return updated
    })
  }

  /**
   * Checks if there are any selected tabs across all groups
   * Used to enable/disable the "Organize Tabs" button
   */
  const hasSelectedTabs = () => {
    return groups.some((group) =>
      group.tabs.some((tab) => tab.selected)
    )
  }

  /**
   * Updates the custom name for a group
   */
  const updateGroupName = (groupIndex: number, newName: string) => {
    setGroups((prevGroups) => {
      const updated = [...prevGroups]
      updated[groupIndex].customName = newName
      return updated
    })
  }

  /**
   * Organizes selected tabs into Chrome tab groups
   * For each group with selected tabs, creates a Chrome tab group
   */
  const handleOrganizeTabs = async () => {
    try {
      // Iterate through each group suggestion
      for (const group of groups) {
        // Get all selected and unselected tab IDs from this group
        const selectedTabIds = group.tabs
          .filter((tab) => tab.selected)
          .map((tab) => tab.id)
        
        const unselectedTabIds = group.tabs
          .filter((tab) => !tab.selected)
          .map((tab) => tab.id)

        // Ungroup any tabs that were deselected
        if (unselectedTabIds.length > 0) {
          // Check if these tabs are in groups and ungroup them
          for (const tabId of unselectedTabIds) {
            try {
              const tab = await chrome.tabs.get(tabId)
              if (tab.groupId !== -1) {
                await chrome.tabs.ungroup(tabId)
              }
            } catch (error) {
              // Tab might not exist, continue
            }
          }
        }

        // Only create a group if there are selected tabs
        if (selectedTabIds.length > 0) {
          // Get current group state (collapsed/expanded) before creating new group
          // Check if any of the selected tabs are already in a group
          let existingGroupId: number | null = null
          let wasCollapsed = false
          
          for (const tabId of selectedTabIds) {
            try {
              const tab = await chrome.tabs.get(tabId)
              if (tab.groupId !== -1) {
                existingGroupId = tab.groupId
                const groupInfo = await chrome.tabGroups.get(tab.groupId)
                wasCollapsed = groupInfo.collapsed || false
                break
              }
            } catch (error) {
              // Continue
            }
          }

          // Create or update Chrome tab group with the selected tabs
          let groupId: number
          if (existingGroupId !== null) {
            // Tabs are already grouped, just update the group
            groupId = existingGroupId
            // Add any new tabs to the existing group
            const currentGroupTabs = await chrome.tabs.query({ groupId })
            const currentTabIds = currentGroupTabs.map(t => t.id).filter((id): id is number => id !== undefined)
            const tabsToAdd = selectedTabIds.filter(id => !currentTabIds.includes(id))
            if (tabsToAdd.length > 0) {
              await chrome.tabs.group({ groupId, tabIds: tabsToAdd })
            }
          } else {
            // Create new group
            groupId = await chrome.tabs.group({ tabIds: selectedTabIds })
          }
          
          // Update the group's title and color, preserve collapsed state
          await chrome.tabGroups.update(groupId, {
            title: group.customName || group.host,
            color: 'grey', // Changed from blue to grey
            collapsed: wasCollapsed, // Preserve collapsed state
          })
        }
      }

      // Reload tabs to reflect the new grouping
      const tabs = await chrome.tabs.query({ currentWindow: true })
      const filteredTabs = tabs.filter(
        (tab) =>
          tab.url &&
          !tab.url.startsWith('chrome://') &&
          !tab.url.startsWith('chrome-extension://')
      )

      // Rebuild groups based on actual Chrome tab groups
      const hostMap = new Map<string, TabSummary[]>()
      const groupMap = new Map<number, { name: string; tabs: TabSummary[] }>()

      // First, get all tabs that are in groups
      for (const tab of filteredTabs) {
        if (tab.id && tab.url && tab.title) {
          if (tab.groupId !== -1) {
            // Tab is in a group
            if (!groupMap.has(tab.groupId)) {
              try {
                const groupInfo = await chrome.tabGroups.get(tab.groupId)
                groupMap.set(tab.groupId, {
                  name: groupInfo.title || getHostname(tab.url),
                  tabs: [],
                })
              } catch {
                groupMap.set(tab.groupId, {
                  name: getHostname(tab.url),
                  tabs: [],
                })
              }
            }
            const groupData = groupMap.get(tab.groupId)!
            groupData.tabs.push({
              id: tab.id,
              title: tab.title,
              url: tab.url,
              selected: true,
            })
          } else {
            // Tab is not in a group, group by hostname
            const host = getHostname(tab.url)
            if (!hostMap.has(host)) {
              hostMap.set(host, [])
            }
            hostMap.get(host)!.push({
              id: tab.id,
              title: tab.title,
              url: tab.url,
              selected: true,
            })
          }
        }
      }

      // Convert to GroupSuggestion array
      const newGroups: GroupSuggestion[] = []
      
      // Add groups from Chrome tab groups
      for (const [, groupData] of groupMap.entries()) {
        newGroups.push({
          host: groupData.name,
          tabs: groupData.tabs,
          groupSelected: true,
          customName: groupData.name,
        })
      }
      
      // Add ungrouped tabs by hostname
      for (const [host, tabs] of hostMap.entries()) {
        newGroups.push({
          host,
          tabs,
          groupSelected: true,
        })
      }

      setGroups(newGroups)
      setOrganized(true)
    } catch (error) {
      console.error('Error organizing tabs:', error)
      alert('Failed to organize tabs. Please try again.')
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="app">
        <div className="header">
          <h1>Tab Organizer</h1>
        </div>
        <div className="loading">Loading tabs...</div>
      </div>
    )
  }

  // Success state after organizing
  if (organized) {
    return (
      <div className="app">
        <div className="header">
          <h1>Tab Organizer</h1>
        </div>
        <div className="success-message">
          Tabs organized! You can close this popup.
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="header">
        <h1>Tab Organizer</h1>
        <p className="header-hint">
          ✓ Check tabs to include in groups • Uncheck to exclude
        </p>
      </div>

      <div className="groups-container">
        {groups.length === 0 ? (
          <div className="empty-state">No tabs to organize.</div>
        ) : (
          groups.map((group, groupIndex) => (
            <div key={group.host} className="group-card">
              {/* Group-level checkbox and label */}
              <div className="group-header">
                <label className="group-checkbox-label">
                  <input
                    type="checkbox"
                    checked={group.groupSelected}
                    onChange={() => toggleGroup(groupIndex)}
                    title="Select/deselect all tabs in this group"
                  />
                  {editingGroupIndex === groupIndex ? (
                    <input
                      type="text"
                      className="group-name-input"
                      value={group.customName || group.host}
                      onChange={(e) => updateGroupName(groupIndex, e.target.value)}
                      onBlur={() => setEditingGroupIndex(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setEditingGroupIndex(null)
                        }
                      }}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span 
                      className="group-label"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingGroupIndex(groupIndex)
                      }}
                      title="Click to rename"
                    >
                      {group.customName || group.host} ({group.tabs.length} tab
                      {group.tabs.length !== 1 ? 's' : ''})
                    </span>
                  )}
                </label>
              </div>

              {/* List of tabs in this group */}
              <div className="tabs-list">
                {group.tabs.map((tab, tabIndex) => (
                  <label 
                    key={tab.id} 
                    className={`tab-item ${tab.id === activeTabId ? 'active-tab' : ''}`}
                    title={tab.id === activeTabId ? 'Current active tab' : tab.title}
                  >
                    <input
                      type="checkbox"
                      checked={tab.selected}
                      onChange={() => toggleTab(groupIndex, tabIndex)}
                      title={tab.selected ? 'Deselect to exclude from group' : 'Select to include in group'}
                    />
                    {tab.id === activeTabId && (
                      <span className="active-indicator" title="Current tab">●</span>
                    )}
                    <span className="tab-title" title={tab.title}>
                      {tab.title.length > 50
                        ? `${tab.title.substring(0, 50)}...`
                        : tab.title}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Organize button */}
      <div className="footer">
        <button
          className="organize-button"
          onClick={handleOrganizeTabs}
          disabled={!hasSelectedTabs()}
        >
          Organize Tabs
        </button>
      </div>
    </div>
  )
}

export default App

