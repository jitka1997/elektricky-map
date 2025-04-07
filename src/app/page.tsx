"use client";

import dynamic from "next/dynamic";

// Load the Map component client-side only
const MapWithNoSSR = dynamic(() => import("../components/Map"), { ssr: false });

const Home = () => {
  return (
    <main className="flex min-h-screen flex-col items-center p-4">
      <h1 className="text-3xl font-bold mb-4">Električky Map</h1>
      <div className="w-full max-w-4xl">
        <MapWithNoSSR />
      </div>
    </main>
  );
};

export default Home;
