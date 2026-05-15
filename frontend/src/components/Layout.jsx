import BottomNav from './BottomNav';

export default function Layout({ children }) {
  return (
    <div className="app-layout">
      <main className="app-main">{children}</main>
      <BottomNav />
    </div>
  );
}
