/**
 * AURA Auth Module
 * Supabase authentication for the planner website.
 *
 * Configure your project credentials below, then run the SQL from
 * supabase-schema.sql in your Supabase project's SQL Editor.
 */

const SUPABASE_URL = 'https://dcjptetazbzqsaotdmql.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_j75DuI3AxwcmdSyY8JTGSw_2tyIIlfi';

let supabase = null;
let currentUser = null;
const authStateCallbacks = [];
let credentialsConfigured = false;

/**
 * Test whether placeholder credentials have been replaced.
 */
function areCredentialsConfigured(url, key) {
  return (
    url &&
    key &&
    !url.includes('your-project') &&
    !key.includes('your-anon-key') &&
    url.startsWith('https://')
  );
}

/**
 * Initialize the Supabase client. Call once on app start.
 * Pass credentials explicitly or edit the constants above.
 */
export async function initSupabase(url = SUPABASE_URL, key = SUPABASE_ANON_KEY) {
  if (!window.supabase || !window.supabase.createClient) {
    console.error('Supabase library not loaded. Add the CDN script before auth.js.');
    credentialsConfigured = false;
    return null;
  }

  credentialsConfigured = areCredentialsConfigured(url, key);

  if (!credentialsConfigured) {
    console.warn(
      'Supabase credentials not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in auth.js.'
    );
    return null;
  }

  supabase = window.supabase.createClient(url, key, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  });

  // Listen to auth changes and notify subscribers
  supabase.auth.onAuthStateChange((event, session) => {
    const user = session?.user ?? null;
    currentUser = user;
    notifyAuthState(user, event);
  });

  // Restore any existing session so isAuthenticated() works immediately
  await restoreSession();

  return supabase;
}

/**
 * Subscribe to auth state changes.
 * Callback receives (user, event) where event is a Supabase auth event string.
 */
export function onAuthStateChange(callback) {
  authStateCallbacks.push(callback);
  // Immediately notify with current known state if available
  if (currentUser !== undefined) callback(currentUser, 'INITIAL');
}

function notifyAuthState(user, event = 'STATE_CHANGE') {
  currentUser = user;
  authStateCallbacks.forEach((cb) => cb(user, event));
}

/**
 * Restore the current session from storage. Returns { user, error }.
 */
export async function restoreSession() {
  if (!supabase) return { user: null, error: new Error('Supabase not initialized') };
  const { data, error } = await supabase.auth.getSession();
  const user = data?.session?.user ?? null;
  currentUser = user;
  return { user, error };
}

/**
 * Sign up with email and password.
 */
export async function signUp(email, password) {
  if (!supabase) return { data: null, error: new Error('Supabase not initialized') };
  return supabase.auth.signUp({ email, password });
}

/**
 * Sign in with email and password.
 */
export async function signIn(email, password) {
  if (!supabase) return { data: null, error: new Error('Supabase not initialized') };
  return supabase.auth.signInWithPassword({ email, password });
}

/**
 * Send a magic link (OTP) to the given email address.
 */
export async function signInWithMagicLink(email) {
  if (!supabase) return { data: null, error: new Error('Supabase not initialized') };
  return supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true
    }
  });
}

/**
 * Sign out the current user.
 */
export async function signOut() {
  if (!supabase) return { error: new Error('Supabase not initialized') };
  return supabase.auth.signOut();
}

/**
 * Get the currently authenticated user.
 */
export function getCurrentUser() {
  return currentUser;
}

/**
 * Get the initialized Supabase client.
 */
export function getSupabaseClient() {
  return supabase;
}

/**
 * Returns true if Supabase is initialized and a user is logged in.
 */
export function isAuthenticated() {
  return !!supabase && !!currentUser;
}

/**
 * Returns true if real credentials have been supplied (even if not yet signed in).
 */
export function isSupabaseConfigured() {
  return credentialsConfigured;
}
