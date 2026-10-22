# 0123 — Unlocking loads the history again

Date: 22 October 2026. Status: found by a manual test of the 2.0.2 MSIX on Windows: set a passcode with one item in the history, quit from the tray, start again and unlock. The history was empty. Affects every platform since the lock page was added ([0064](0064-optional-passcode.md)).

## Problem

The vault file still held the item: 1,427 bytes, of which 68 are the header and tag, so about 1.36 KB of saved sessions rather than an empty list. The right passcode decrypted it and nothing reported an error. The sessions never reached the list.

`useVault.unlock` sets `state` to `"unlocked"` and then returns the decoded sessions. That state change makes `App.vue` replace `LockPage` (`v-if="vault.state.value === 'locked'"`), and Vue queues that render before `LockPage`'s code after `await vault.unlock(...)` resumes. By the time `LockPage` called `emit("unlocked", sessions)` it was unmounted, and Vue 3.5 ignores events from an unmounted component (`if (instance.isUnmounted) return` in `emit`). `App.vue`'s `openVault` never ran.

Worse than an empty list: the app was unlocked, so the next masked text would have been saved into the vault on its own, replacing the stored history.

## Decision

`LockPage` loads the unlocked sessions into the session store itself (`store.load`), as it already calls `store.removePrivate()` for a forgotten passcode. The store does not depend on the page still being mounted. The `unlocked` event and `App.vue`'s handler are removed.

## Limits

The repository's tests run in Node without a component renderer, so this is not covered by `pnpm test`; the vault composable's own tests still pass the sessions through. To check by hand on a build: set a passcode with an item in the history, quit from the tray, start, unlock; the item is listed.
