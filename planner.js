/**
 * AURA Planner Data Module
 * Reads and writes planner data (tasks, events, preferences) to Supabase.
 *
 * All operations are scoped to the authenticated user via Row Level Security.
 * When the user is offline or not signed in, data falls back to localStorage
 * so the app remains usable.
 */

import { getSupabaseClient, getCurrentUser, isSupabaseConfigured } from './auth.js';

const LS_KEYS = {
  tasks: 'aura_tasks',
  events: 'aura_events',
  preferences: 'aura_preferences'
};

export function isPlannerStorageAvailable() {
  try {
    return isSupabaseConfigured() && typeof window !== 'undefined' && Boolean(window.supabase && window.supabase.createClient);
  } catch {
    return false;
  }
}

export function isOnline() {
  return typeof navigator !== 'undefined' && navigator.onLine !== false;
}

function currentAuthContext() {
  return {
    connected: isPlannerStorageAvailable(),
    userId: getCurrentUser()?.id ?? null,
    online: isOnline()
  };
}

function requireAuth() {
  const sb = getSupabaseClient();
  const user = getCurrentUser();
  if (!sb) throw new Error('Supabase not initialized. Check auth.js credentials.');
  if (!user) throw new Error('You must be signed in to access planner data.');
  return { sb, user };
}

function canSync() {
  return isPlannerStorageAvailable() && !!getCurrentUser() && isOnline();
}

function getLocal(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('Failed to write to localStorage:', err);
  }
}

function generateLocalId() {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeTask(task) {
  return {
    text: task.text || '',
    tag: task.tag || task.category || 'Personal',
    category: task.category || task.tag || 'Personal',
    priority: task.priority || 'medium',
    due_date: task.due_date || null,
    color: task.color || null,
    completed: !!task.completed,
    created_at: task.created_at || new Date().toISOString(),
    updated_at: task.updated_at || new Date().toISOString(),
    ...task
  };
}

/* -------------------------------------------------------------------------- */
/* Tasks                                                                      */
/* -------------------------------------------------------------------------- */

export async function loadTasks() {
  if (canSync()) {
    const { sb, user } = requireAuth();
    const { data, error } = await sb
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) throw error;
    const tasks = (data || []).map(normalizeTask);
    setLocal(LS_KEYS.tasks, tasks);
    return tasks;
  }

  return getLocal(LS_KEYS.tasks, getDefaultTasks()).map(normalizeTask);
}

export async function saveTask(task) {
  const normalized = normalizeTask(task);

  if (canSync()) {
    const { sb, user } = requireAuth();
    const payload = { ...normalized, user_id: user.id };
    delete payload.id; // let server generate if missing

    if (task.id && !String(task.id).startsWith('local_')) {
      const { data, error } = await sb
        .from('tasks')
        .update(payload)
        .eq('id', task.id)
        .eq('user_id', user.id)
        .select()
        .single();
      if (error) throw error;
      const saved = normalizeTask(data);
      updateLocalTask(saved);
      return saved;
    } else {
      const { data, error } = await sb.from('tasks').insert(payload).select().single();
      if (error) throw error;
      const saved = normalizeTask(data);
      updateLocalTask(saved);
      return saved;
    }
  }

  // Offline / not signed in: localStorage fallback
  const localTask = {
    ...normalized,
    id: normalized.id || generateLocalId()
  };
  updateLocalTask(localTask);
  return localTask;
}

function updateLocalTask(task) {
  const tasks = getLocal(LS_KEYS.tasks, []);
  const idx = tasks.findIndex((t) => t.id === task.id);
  if (idx >= 0) {
    tasks[idx] = task;
  } else {
    tasks.push(task);
  }
  setLocal(LS_KEYS.tasks, tasks);
}

export async function deleteTask(id) {
  if (canSync()) {
    const { sb, user } = requireAuth();
    const { error } = await sb.from('tasks').delete().eq('id', id).eq('user_id', user.id);
    if (error) throw error;
  }
  const tasks = getLocal(LS_KEYS.tasks, []).filter((t) => t.id !== id);
  setLocal(LS_KEYS.tasks, tasks);
}

export async function deleteCompletedTasks() {
  if (canSync()) {
    const { sb, user } = requireAuth();
    const { error } = await sb
      .from('tasks')
      .delete()
      .eq('user_id', user.id)
      .eq('completed', true);
    if (error) throw error;
  }
  const tasks = getLocal(LS_KEYS.tasks, []).filter((t) => !t.completed);
  setLocal(LS_KEYS.tasks, tasks);
}

export function getDefaultTasks() {
  return [
    { id: 'local_default_1', text: 'Review project brief', tag: 'Work', category: 'Work', priority: 'high', completed: false },
    { id: 'local_default_2', text: 'Morning run 5km', tag: 'Health', category: 'Health', priority: 'medium', completed: false },
    { id: 'local_default_3', text: 'Call dentist at 2 PM', tag: 'Personal', category: 'Personal', priority: 'medium', completed: false },
    { id: 'local_default_4', text: 'Submit quarterly report', tag: 'Urgent', category: 'Urgent', priority: 'high', completed: false },
    { id: 'local_default_5', text: 'Read 20 pages', tag: 'Personal', category: 'Personal', priority: 'low', completed: false }
  ];
}

/* -------------------------------------------------------------------------- */
/* Events                                                                     */
/* -------------------------------------------------------------------------- */

export async function loadEvents() {
  if (canSync()) {
    const { sb, user } = requireAuth();
    const { data, error } = await sb
      .from('events')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) throw error;
    setLocal(LS_KEYS.events, data || []);
    return data || [];
  }

  return getLocal(LS_KEYS.events, getDefaultEvents());
}

export async function saveEvent(event) {
  if (canSync()) {
    const { sb, user } = requireAuth();
    const payload = { ...event, user_id: user.id };

    if (event.id && !String(event.id).startsWith('local_')) {
      const { data, error } = await sb
        .from('events')
        .update(payload)
        .eq('id', event.id)
        .eq('user_id', user.id)
        .select()
        .single();
      if (error) throw error;
      updateLocalEvent(data);
      return data;
    } else {
      const { data, error } = await sb.from('events').insert(payload).select().single();
      if (error) throw error;
      updateLocalEvent(data);
      return data;
    }
  }

  const localEvent = { ...event, id: event.id || generateLocalId() };
  updateLocalEvent(localEvent);
  return localEvent;
}

function updateLocalEvent(event) {
  const events = getLocal(LS_KEYS.events, []);
  const idx = events.findIndex((e) => e.id === event.id);
  if (idx >= 0) {
    events[idx] = event;
  } else {
    events.push(event);
  }
  setLocal(LS_KEYS.events, events);
}

export async function deleteEvent(id) {
  if (canSync()) {
    const { sb, user } = requireAuth();
    const { error } = await sb.from('events').delete().eq('id', id).eq('user_id', user.id);
    if (error) throw error;
  }
  const events = getLocal(LS_KEYS.events, []).filter((e) => e.id !== id);
  setLocal(LS_KEYS.events, events);
}

export function getDefaultEvents() {
  return [
    { id: 'local_ev_1', day: 'Mon', name: 'Strategy kickoff' },
    { id: 'local_ev_2', day: 'Wed', name: 'Design critique' },
    { id: 'local_ev_3', day: 'Fri', name: 'Sprint retrospective' }
  ];
}

/* -------------------------------------------------------------------------- */
/* Preferences                                                                */
/* -------------------------------------------------------------------------- */

export async function loadPreferences() {
  if (canSync()) {
    const { sb, user } = requireAuth();
    const { data, error } = await sb
      .from('preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // PGRST116 = no rows returned; return a blank preference object
    if (error && error.code !== 'PGRST116') throw error;

    const prefs = data || { user_id: user.id, main_focus: '', theme: 'dark' };
    setLocal(LS_KEYS.preferences, prefs);
    return prefs;
  }

  return getLocal(LS_KEYS.preferences, { main_focus: '', theme: 'dark' });
}

export async function savePreferences(prefs) {
  if (canSync()) {
    const { sb, user } = requireAuth();
    const payload = { ...prefs, user_id: user.id };

    if (prefs.id) {
      const { data, error } = await sb
        .from('preferences')
        .update(payload)
        .eq('id', prefs.id)
        .eq('user_id', user.id)
        .select()
        .single();
      if (error) throw error;
      setLocal(LS_KEYS.preferences, data);
      return data;
    } else {
      const { data, error } = await sb.from('preferences').insert(payload).select().single();
      if (error) throw error;
      setLocal(LS_KEYS.preferences, data);
      return data;
    }
  }

  setLocal(LS_KEYS.preferences, prefs);
  return prefs;
}

/* -------------------------------------------------------------------------- */
/* Sync helpers                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Sync local tasks/events/preferences to Supabase after sign-in.
 * Useful when a user created data while offline or not signed in.
 */
export async function syncLocalToCloud() {
  if (!canSync()) return { tasks: 0, events: 0 };

  const localTasks = getLocal(LS_KEYS.tasks, []);
  const localEvents = getLocal(LS_KEYS.events, []);

  let syncedTasks = 0;
  for (const task of localTasks) {
    try {
      await saveTask({ ...task, id: undefined });
      syncedTasks++;
    } catch (err) {
      console.warn('Failed to sync task:', err);
    }
  }

  let syncedEvents = 0;
  for (const event of localEvents) {
    try {
      await saveEvent({ ...event, id: undefined });
      syncedEvents++;
    } catch (err) {
      console.warn('Failed to sync event:', err);
    }
  }

  return { tasks: syncedTasks, events: syncedEvents };
}
