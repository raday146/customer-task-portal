import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { AppRoutes } from '../App';
import { AuthProvider } from '../auth/AuthContext';
import { ToastProvider } from '../components/Toast';

export const demoUser = {
  id: 'u-1',
  name: 'Olivia Hart',
  email: 'admin@northstar.test',
  role: 'ADMIN',
  tenant: { id: 't-1', name: 'Northstar Consulting' },
};

type Routes = Record<string, unknown | ((init?: RequestInit) => unknown)>;

/** Stubs `fetch` with a map of "METHOD /path" (path without query) → JSON body. */
export function mockApi(routes: Routes) {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost');
    const key = `${init?.method ?? 'GET'} ${url.pathname.replace(/^\/api/, '')}`;
    if (!(key in routes)) {
      return new Response(JSON.stringify({ message: `No mock for ${key}` }), { status: 404 });
    }
    const value = routes[key];
    const body =
      typeof value === 'function' ? (value as (i?: RequestInit) => unknown)(init) : value;
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

export function renderApp(path = '/') {
  return render(
    <MemoryRouter
      initialEntries={[path]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}
