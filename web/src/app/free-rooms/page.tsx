"use client";

import FreeRoomFinder from "@/components/FreeRoomFinder";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useTheme } from "../hooks/useTheme";

export default function FreeRoomsPage() {
  const { dark, toggle: toggleDark } = useTheme();

  return (
    <div className={`min-h-screen relative overflow-hidden transition-colors duration-500
      bg-gradient-to-br from-blue-100 via-blue-200 to-blue-300
      dark:from-[#0c1e3d] dark:via-[#112952] dark:to-[#0d3b7a]`}>
      
      <div className="relative min-h-screen p-4 max-w-7xl mx-auto">
        <Header dark={dark} toggleDark={toggleDark} />
        
        <main className="container mx-auto px-4 py-8">
          <FreeRoomFinder />
        </main>
      </div>

      <Footer />
    </div>
  );
}
