import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { demoUser, mockApi, renderApp } from './test/utils';

const dashboard = {
  customers: 12,
  activeCustomers: 10,
  openTasks: 7,
  completedTasks: 3,
  overdueTasks: 2,
  topCustomers: [{ id: 'c-1', name: 'Acme Robotics', openTasks: 3, overdueTasks: 1 }],
  upcomingTasks: [],
};

const customers = {
  items: [
    {
      id: 'c-1',
      name: 'Acme Robotics',
      email: 'ops@acme.example',
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      _count: { tasks: 3 },
    },
  ],
  total: 1,
  page: 1,
  pageSize: 15,
};

describe('App', () => {
  it('signs in and lands on the dashboard', async () => {
    const fetchMock = mockApi({
      'POST /auth/login': { accessToken: 'token-123', user: demoUser },
      'GET /dashboard': dashboard,
    });
    renderApp('/login');

    await userEvent.type(screen.getByLabelText('Email'), 'admin@northstar.test');
    await userEvent.type(screen.getByLabelText('Password'), 'DemoPass123!');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Overdue tasks')).toBeInTheDocument();
    expect(screen.getByText('Northstar Consulting')).toBeInTheDocument();
    expect(localStorage.getItem('ctp.token')).toBe('token-123');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('navigates from the dashboard to the customer list', async () => {
    localStorage.setItem('ctp.token', 'token-123');
    mockApi({
      'GET /auth/me': demoUser,
      'GET /dashboard': dashboard,
      'GET /customers': customers,
    });
    renderApp('/');

    expect(await screen.findByText('Customers needing attention')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Customers' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Customers' })).toBeInTheDocument(),
    );
    expect(await screen.findByRole('link', { name: 'Acme Robotics' })).toBeInTheDocument();
  });

  it('redirects to login when there is no session', async () => {
    renderApp('/tasks');
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });
});
