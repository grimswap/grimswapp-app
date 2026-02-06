import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Providers } from './providers'
import { Layout } from './components/layout/Layout'
import { HomePage } from './pages/home'
import { SwapPage } from './pages/swap'
import { PoolsPage } from './pages/pools'
import { WalletPage } from './pages/wallet'
import { ToastContainer } from './components/ui/toast'
import { useToast } from './hooks/use-toast'

function AppContent() {
  const { toasts, removeToast } = useToast()

  return (
    <>
      <Routes>
        {/* Landing page - no layout wrapper (has its own header/bg) */}
        <Route path="/" element={<HomePage />} />

        {/* App pages - with layout wrapper */}
        <Route
          path="/swap"
          element={
            <Layout>
              <SwapPage />
            </Layout>
          }
        />
        <Route
          path="/pools"
          element={
            <Layout>
              <PoolsPage />
            </Layout>
          }
        />
        <Route
          path="/wallet"
          element={
            <Layout>
              <WalletPage />
            </Layout>
          }
        />
      </Routes>
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  )
}

export function App() {
  return (
    <Providers>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </Providers>
  )
}
