import React from 'react';
import { Outlet } from 'react-router-dom';

export function Layout() {
  return (
    <main className="min-h-screen bg-gray-50">
      <Outlet />
    </main>
  );
}