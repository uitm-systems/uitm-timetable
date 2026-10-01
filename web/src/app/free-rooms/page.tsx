"use client";

import FreeRoomFinder from "@/components/FreeRoomFinder";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useTheme } from "../hooks/useTheme";

export default function FreeRoomsPage() {
  const { dark, toggle: toggleDark } = useTheme();

  return (
    <div className={`min-h-screen relative overflow-hidden transition-colors duration-500
      bg-gray-100 dark:bg-[#1d1d1d]"relative min-h-screen p-4 max-w-7xl mx-auto">
        <Header dark={dark} toggleDark={toggleDark} />
        
        <main className="container mx-auto px-4 py-8">
          <FreeRoomFinder />
        </main>
      </div>

      <Footer />
    </div>
  );
}
