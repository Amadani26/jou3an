import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import PrivateRoute from './components/PrivateRoute'
import Home from './pages/Home'
import Results from './pages/Results'
import Onboarding from './pages/Onboarding'
import Profile from './pages/Profile'
import Pro from './pages/Pro'
import Login from './pages/Login'
import Signup from './pages/Signup'
import RestaurantDetail from './pages/RestaurantDetail'
import Admin from './pages/Admin'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/results" element={<Results />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/pro" element={<Pro />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/r/:id" element={<RestaurantDetail />} />

          {/* Auth-protected routes */}
          <Route element={<PrivateRoute />}>
            <Route path="/profile" element={<Profile />} />
            <Route path="/admin" element={<Admin />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
