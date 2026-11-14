import React from 'react';
import { AppProvider } from './state/AppContext.jsx';
import { useRoute, parseRoute, tabOfRoute } from './router.js';
import { BottomTabs, ErrorBanner } from './components/common.jsx';
import { HomePage } from './pages/Home.jsx';
import { ExpensesPage } from './pages/Expenses.jsx';
import { ShoppingPage } from './pages/Shopping.jsx';
import { MenuPage } from './pages/Menu.jsx';
import { GraphPage, CategoryPage } from './pages/Graph.jsx';
import { SettingsPage } from './pages/Settings.jsx';

function Shell() {
  const loc = useRoute();
  const route = parseRoute(loc);
  const tab = tabOfRoute(route);
  return (
    <div className="appframe">
      <header className="appheader">夫婦家計簿</header>
      <ErrorBanner />
      <main className="appmain">
        {route.name === 'home' && <HomePage />}
        {route.name === 'expenses' && <ExpensesPage tab={route.tab} />}
        {route.name === 'shopping' && <ShoppingPage />}
        {route.name === 'menu' && <MenuPage />}
        {route.name === 'graph' && <GraphPage />}
        {route.name === 'category' && <CategoryPage categoryId={route.categoryId} />}
        {route.name === 'settings' && <SettingsPage />}
      </main>
      <BottomTabs activeTab={tab} />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
