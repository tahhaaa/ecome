import { hasAdminSession, jsonResponse } from '../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  return jsonResponse({ authenticated: await hasAdminSession(request, env) });
}
