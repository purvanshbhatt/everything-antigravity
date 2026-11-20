'use strict';
/**
 * Hook profile resolution. Precedence (lowest → highest):
 * profile defaults → ~/.gemini/eag/config.json → environment variables.
 */
const { configFile, readJson, writeJson } = require('./paths');

const PROFILES = Object.freeze(['minimal', 'standard', 'strict']);

/** Feature switches per profile. */
const PROFILE_FEATURES = Object.freeze({
  minimal: { guard: true, ask: false, secrets: false, tracker: false, memory: false, instincts: false, verifyGate: false, compactionNudge: false, autoFormat: false, consoleCheck: false },
  standard: { guard: true, ask: true, secrets: true, tracker: true, memory: true, instincts: true, verifyGate: true, compactionNudge: true, autoFormat: false, consoleCheck: false },
  strict: { guard: true, ask: true, secrets: true, tracker: true, memory: true, instincts: true, verifyGate: true, compactionNudge: true, autoFormat: true, consoleCheck: true },
});

const FEATURE_IDS = Object.freeze(Object.keys(PROFILE_FEATURES.standard));

function loadUserConfig() {
  const cfg = readJson(configFile(), {});
  return cfg && typeof cfg === 'object' ? cfg : {};
}

/**
 * @returns {{profile: string, features: Record<string, boolean>, compactNudgeAt: number}}
 */
function resolveConfig() {
  const user = loadUserConfig();
  const envProfile = (process.env.EAG_HOOK_PROFILE || '').trim().toLowerCase();
  let profile = PROFILES.includes(envProfile) ? envProfile : String(user.profile || 'standard').toLowerCase();
  if (!PROFILES.includes(profile)) profile = 'standard';

  const features = { ...PROFILE_FEATURES[profile] };
  for (const id of FEATURE_IDS) {
    if (typeof user[id] === 'boolean' && profile !== 'minimal') features[id] = user[id];
  }
  const disabled = []
    .concat(Array.isArray(user.disabled) ? user.disabled : [])
    .concat((process.env.EAG_DISABLED_HOOKS || '').split(','))
    .map((s) => s.trim())
    .filter(Boolean);
  for (const id of disabled) {
    if (id in features) features[id] = false;
  }

  const nudge = Number(process.env.EAG_COMPACT_NUDGE_AT || user.compactNudgeAt || 60);
  return { profile, features, compactNudgeAt: Number.isFinite(nudge) && nudge > 0 ? nudge : 60 };
}

function setProfile(profile) {
  if (!PROFILES.includes(profile)) throw new Error(`Unknown profile "${profile}". Use one of: ${PROFILES.join(', ')}`);
  const user = loadUserConfig();
  user.profile = profile;
  writeJson(configFile(), user);
  return user;
}

module.exports = { PROFILES, PROFILE_FEATURES, FEATURE_IDS, resolveConfig, setProfile, loadUserConfig };
