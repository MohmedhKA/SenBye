import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout.js';
import { BrowsePage } from './pages/BrowsePage.js';
import { AuctionPage } from './pages/AuctionPage.js';
import { NewListingPage } from './pages/NewListingPage.js';
import { MyListingsPage } from './pages/MyListingsPage.js';
import { MyBidsPage } from './pages/MyBidsPage.js';
import { WantsPage } from './pages/WantsPage.js';
import { AssistantPage } from './pages/AssistantPage.js';
import { NotificationsPage } from './pages/NotificationsPage.js';
import { LoginPage, RegisterPage } from './pages/AuthPages.js';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<BrowsePage />} />
        <Route path="auctions/:id" element={<AuctionPage />} />
        <Route path="sell/new" element={<NewListingPage />} />
        <Route path="sell/:id/edit" element={<NewListingPage />} />
        <Route path="me/selling" element={<MyListingsPage />} />
        <Route path="me/bidding" element={<MyBidsPage />} />
        <Route path="wants" element={<WantsPage />} />
        <Route path="assistant" element={<AssistantPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
      </Route>
    </Routes>
  );
}
