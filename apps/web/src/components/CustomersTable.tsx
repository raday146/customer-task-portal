import { Link } from 'react-router-dom';
import type { Customer } from '../api/types';
import { formatDate } from './DueDate';
import { StatusBadge } from './StatusBadge';

export function CustomersTable({ customers }: { customers: Customer[] }) {
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Status</th>
          <th className="num">Tasks</th>
          <th>Customer since</th>
        </tr>
      </thead>
      <tbody>
        {customers.map((c) => (
          <tr key={c.id}>
            <td>
              <Link to={`/customers/${c.id}`} className="link-strong">
                {c.name}
              </Link>
            </td>
            <td className="muted">{c.email}</td>
            <td>
              <StatusBadge status={c.status} />
            </td>
            <td className="num">{c._count?.tasks ?? 0}</td>
            <td className="muted">{formatDate(c.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
