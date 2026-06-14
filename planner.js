/**
 * AURA Planner Data Module
 * Reads and writes planner data (tasks, events, preferences) to Supabase.
 *
 * All operations are scoped to the authenticated user via Row Level Security.
 */

import { getSupabaseClient, getCurrentUser, isSupabaseConfigured } from './auth.js';

export function isPlannerStorageAvailable() {
  return isSupabaseConfigured() && !!getSupabaseClient();
}

function requireAuth() {
  const sb = getSupabaseClient();
  const user = getCurrentUser();
  if (!sb) throw new Error('Supabase not initialized. Check auth.js credentials.');
  if (!user) throw new Error('You must be signed in to access planner data.');
  return { sb, user };
}

/* -------------------------------------------------------------------------- */
/* Tasks                                                                      */
/* -------------------------------------------------------------------------- */

export async function loadTasks() {
  const { sb, user } = requireAuth();
  const { data, error } = await sb
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function saveTask(task) {
  const { sb, user } = requireAuth();
  const payload = { ...task, user_id: user.id };

  if (payload.id) {
    const { data, error } = await sb
      .from('tasks')
      .update(payload)
      .eq('id', payload.id)
      .eq('user_id', user.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await sb.from('tasks').insert(payload).select().single();
    if (error) throw error;
    return data;
  }
}

export async function deleteTask(id) {
  const { sb, user } = requireAuth();
  const { error } = await sb.from('tasks').delete().eq('id', id).eq('user_id', user.id);
  if (error) throw error;
}

export async function deleteCompletedTasks() {
  const { sb, user } = requireAuth();
  const { error } = await sb
    .from('tasks')
    .delete()
    .eq('user_id', user.id)
    .eq('completed', true);
  if (error) throw error;
}

/* -------------------------------------------------------------------------- */
/* Events                                                                     */
/* -------------------------------------------------------------------------- */

export async function loadEvents() {
  const { sb, user } = requireAuth();
  const { data, error } = await sb
    .from('events')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function saveEvent(event) {
  const { sb, user } = requireAuth();
  const payload = { ...event, user_id: user.id };

  if (payload.id) {
    const { data, error } = await sb
      .from('events')
      .update(payload)
      .eq('id', payload.id)
      .eq('user_id', user.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await sb.from('events').insert(payload).select().single();
    if (error) throw error;
    return data;
  }
}

export async function deleteEvent(id) {
  const { sb, user } = requireAuth();
  const { error } = await sb.from('events').delete().eq('id', id).eq('user_id', user.id);
  if (error) throw error;
}

/* -------------------------------------------------------------------------- */
/* Preferences                                                                */
/* -------------------------------------------------------------------------- */

export async function loadPreferences() {
  const { sb, user } = requireAuth();
  const { data, error } = await sb
    .from('preferences')
    .select('*')
    .eq('user_id', user.id)
    .single();

  // PGRST116 = no rows returned; return a blank preference object
  if (error && error.code !== 'PGRST116') throw error;

  return data || { user_id: user.id, main_focus: '', theme: 'dark' };
}

export async function savePreferences(prefs) {
  const { sb, user } = requireAuth();
  const payload = { ...prefs, user_id: user.id };

  if (payload.id) {
    const { data, error } = await sb
      .from('preferences')
      .update(payload)
      .eq('id', payload.id)
      .eq('user_id', user.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await sb.from('preferences').insert(payload).select().single();
    if (error) throw error;
    return data;
  }
}
