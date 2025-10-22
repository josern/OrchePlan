// Ensure any global localStorage stub doesn't break SSR.
// Some environments (or node flags) may define a non-standard localStorage
// object where getItem isn't a function. That causes Next's server-side
// rendering (and some libraries) to throw. Remove it early when Node starts.
try {
  if (typeof globalThis !== 'undefined' && typeof globalThis.localStorage !== 'undefined') {
    // Attempt to delete the stub; if deletion isn't allowed, set to undefined.
    try { delete globalThis.localStorage } catch (e) { globalThis.localStorage = undefined }
  }
} catch (e) {
  // noop - defensive
}
