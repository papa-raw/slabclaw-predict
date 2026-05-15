const keys = new Map();
export function setKey(spiritId, key) { keys.set(spiritId, key); }
export function getKey(spiritId) { return keys.get(spiritId); }
export function clearKeys() { keys.clear(); }
