import { Outlet } from 'react-router-dom'
import Nav from './Nav'
import BottomNav from './BottomNav'
import InstallPrompt from './InstallPrompt'

export default function Layout() {
  return (
    <>
      <Nav />
      <main className="pt-[calc(56px_+_env(safe-area-inset-top))] md:pt-[62px] min-h-screen pb-[calc(64px_+_env(safe-area-inset-bottom))] md:pb-0">
        <Outlet />
      </main>
      <BottomNav />
      <InstallPrompt />
    </>
  )
}
