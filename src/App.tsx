/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Search from "./pages/Search";
import Details from "./pages/Details";
import Favorites from "./pages/Favorites";
import Clients from "./pages/Clients";
import Keywords from "./pages/Keywords";
import Opportunities from "./pages/Opportunities";
import Prices from "./pages/Prices";
import Diagnostics from "./pages/Diagnostics";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/search" element={<Search />} />
        <Route path="/bids/:id" element={<Details />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/keywords" element={<Keywords />} />
        <Route path="/opportunities" element={<Opportunities />} />
        <Route path="/prices" element={<Prices />} />
        <Route path="/diagnostics" element={<Diagnostics />} />
      </Routes>
    </Layout>
  );
}
