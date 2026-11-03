import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CustomersTable } from './CustomersTable';

describe('CustomersTable', () => {
  it('renders a row per customer with a link to its detail page', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <CustomersTable
          customers={[
            {
              id: 'c-1',
              name: 'Acme Robotics',
              email: 'ops@acme.example',
              status: 'ACTIVE',
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
              _count: { tasks: 4 },
            },
            {
              id: 'c-2',
              name: 'Fjord Analytics',
              email: 'team@fjord.example',
              status: 'INACTIVE',
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ]}
        />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(screen.getByRole('link', { name: 'Acme Robotics' })).toHaveAttribute(
      'href',
      '/customers/c-1',
    );
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });
});
