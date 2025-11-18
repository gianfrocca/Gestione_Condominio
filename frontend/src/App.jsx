import { useState } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { Home, FileText, Settings as SettingsIcon, BarChart3, Menu, X } from 'lucide-react';
import Dashboard from './components/Dashboard';
import Readings from './components/Readings';
import Bills from './components/Bills';
import Reports from './components/Reports';
import Settings from './components/Settings';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigation = [
    { id: 'dashboard', name: 'Dashboard', icon: Home },
    { id: 'readings', name: 'Letture', icon: BarChart3 },
    { id: 'bills', name: 'Bollette', icon: FileText },
    { id: 'reports', name: 'Report', icon: FileText },
    { id: 'settings', name: 'Impostazioni', icon: SettingsIcon },
  ];

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'readings':
        return <Readings />;
      case 'bills':
        return <Bills />;
      case 'reports':
        return <Reports />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Router>
      <div className="min-h-screen bg-gray-50 lg:flex">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-gray-600 bg-opacity-75 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div
          className={`fixed inset-y-0 left-0 z-30 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:relative lg:flex-shrink-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between h-16 px-6 bg-primary-600">
            <h1 className="text-xl font-bold text-white">Gestione Condominio</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-white"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="mt-6 px-3 pb-24 overflow-y-auto" style={{ height: 'calc(100vh - 4rem - 5rem)' }}>
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentPage(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center px-4 py-3 mb-2 rounded-lg transition-colors ${
                    currentPage === item.id
                      ? 'bg-primary-50 text-primary-600 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="h-5 w-5 mr-3" />
                  {item.name}
                </button>
              );
            })}
          </nav>

          <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
            <div className="text-xs text-gray-500 text-center">
              <p>Gestione Condominio v1.0</p>
              <p className="mt-1">© 2025 - Tutti i diritti riservati</p>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Top bar */}
          <div className="sticky top-0 z-10 bg-white shadow-sm">
            <div className="flex items-center justify-between h-16 px-4 lg:px-8">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden text-gray-600"
              >
                <Menu className="h-6 w-6" />
              </button>

              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">Amministratore</p>
                  <p className="text-xs text-gray-500">
                    {new Date().toLocaleDateString('it-IT', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Page content */}
          <main className="flex-1 p-4 lg:p-8">
            {renderPage()}
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;
