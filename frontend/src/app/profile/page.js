'use client';

import React from 'react';
import Navbar from '@/components/Navbar';
import ProfileEditor from '@/components/profile/ProfileEditor';

export default function ProfilePage() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
      <Navbar />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <ProfileEditor mode="page" />
      </main>
    </div>
  );
}
