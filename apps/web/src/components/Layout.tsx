import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/customers', label: 'Customers', end: false },
  { to: '/tasks', label: 'Tasks', end: false },
];

export function Layout() {
  const { user, logout } = useAuth();
  const initials = user?.name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">CT</span>
          <span>Task Portal</span>
        </div>
        <nav aria-label="Main">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="company">{user?.tenant.name}</div>
          <div className="profile">
            <span className="avatar">{initials}</span>
            <div>
              <div className="profile-name">{user?.name}</div>
              <span className={`role role-${user?.role.toLowerCase()}`}>
                {user?.role === 'ADMIN' ? 'Admin' : 'Member'}
              </span>
            </div>
          </div>
          <button className="btn btn-ghost btn-block" onClick={logout}>
            Log out
          </button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
