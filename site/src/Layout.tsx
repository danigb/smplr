import { NavLink, Outlet } from "react-router-dom";
import pkg from "smplr/package.json";

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return isActive
    ? "text-zinc-200"
    : "text-zinc-400 hover:text-zinc-200 transition-colors";
}

export function Layout() {
  return (
    <>
      <nav className="border-b border-zinc-700 bg-zinc-900">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-6">
          <NavLink to="/" className="flex items-end gap-2">
            <span className="text-2xl font-bold">smplr</span>
            <span className="text-zinc-500 text-sm">{pkg.version}</span>
          </NavLink>
          <div className="flex gap-4 text-sm">
            <NavLink to="/" end className={navLinkClass}>
              Instruments
            </NavLink>
            <NavLink to="/sequencer" className={navLinkClass}>
              Sequencer
            </NavLink>
            <NavLink to="/drumabuse" className={navLinkClass}>
              Drumabuse
            </NavLink>
          </div>
          <NavLink
            to="/test"
            className={({ isActive }) =>
              `ml-auto text-xs ${
                isActive
                  ? "text-zinc-200"
                  : "text-zinc-500 hover:text-zinc-300 transition-colors"
              }`
            }
          >
            test
          </NavLink>
        </div>
      </nav>
      <main className="max-w-4xl mx-auto p-4 my-12">
        <Outlet />
      </main>
    </>
  );
}
