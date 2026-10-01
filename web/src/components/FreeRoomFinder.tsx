"use client";

import { useState, useEffect } from "react";

interface Campus {
  id: string;
  text: string;
}

interface RoomClass {
  day: string;
  start: string;
  end: string;
}

type RoomData = Record<string, RoomClass[]>;

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

// Time slots from 08:00 to 22:00
const generateTimeSlots = () => {
  const slots = [];
  for (let h = 8; h <= 22; h++) {
    slots.push(`${h.toString().padStart(2, "0")}:00`);
    if (h < 22) slots.push(`${h.toString().padStart(2, "0")}:30`);
  }
  return slots;
};
const TIME_SLOTS = generateTimeSlots();

export default function FreeRoomFinder() {
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [selectedCampus, setSelectedCampus] = useState("");
  
  const [day, setDay] = useState("MONDAY");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("10:00");

  const [roomsData, setRoomsData] = useState<RoomData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/campuses.json")
      .then(res => res.json())
      .then(data => setCampuses(data.filter((c: Campus) => c.id !== "X")))
      .catch(() => setError("Failed to load campuses"));
  }, []);

  useEffect(() => {
    if (!selectedCampus) {
      setRoomsData(null);
      return;
    }
    setIsLoading(true);
    fetch(`/api/rooms/${selectedCampus}.json`)
      .then(res => {
        if (!res.ok) throw new Error("Campus has no room data");
        return res.json();
      })
      .then(data => {
        setRoomsData(data);
        setError("");
      })
      .catch(err => {
        setRoomsData({});
        setError(err.message);
      })
      .finally(() => setIsLoading(false));
  }, [selectedCampus]);

  const findFreeRooms = () => {
    if (!roomsData) return [];
    
    return Object.keys(roomsData).filter(roomName => {
      const classes = roomsData[roomName];
      const hasClash = classes.some(c => {
        if (c.day !== day) return false;
        // Basic time overlap check
        // A class overlaps if its start is before our end, AND its end is after our start
        return (c.start < endTime && c.end > startTime);
      });
      return !hasClash;
    }).sort();
  };

  const freeRooms = findFreeRooms();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-none p-6 border border-gray-300 dark:border-gray-600 ">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Find Empty Classrooms</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Campus</label>
            <select 
              value={selectedCampus} 
              onChange={e => setSelectedCampus(e.target.value)}
              className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-none focus:ring-blue-500 focus:border-blue-500 block p-2.5 dark:bg-[#112952]/50 dark:border-[#2a3f65] dark:text-white"
            >
              <option value="">Select Campus</option>
              {campuses.map(c => (
                <option key={c.id} value={c.id}>{c.text}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Day</label>
            <select 
              value={day} 
              onChange={e => setDay(e.target.value)}
              className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-none focus:ring-blue-500 focus:border-blue-500 block p-2.5 dark:bg-[#112952]/50 dark:border-[#2a3f65] dark:text-white"
            >
              {DAYS.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Start Time</label>
            <select 
              value={startTime} 
              onChange={e => setStartTime(e.target.value)}
              className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-none focus:ring-blue-500 focus:border-blue-500 block p-2.5 dark:bg-[#112952]/50 dark:border-[#2a3f65] dark:text-white"
            >
              {TIME_SLOTS.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">End Time</label>
            <select 
              value={endTime} 
              onChange={e => setEndTime(e.target.value)}
              className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-none focus:ring-blue-500 focus:border-blue-500 block p-2.5 dark:bg-[#112952]/50 dark:border-[#2a3f65] dark:text-white"
            >
              {TIME_SLOTS.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {selectedCampus && !isLoading && !error && (
        <div className="bg-white dark:bg-slate-900 rounded-none p-6 border border-gray-300 dark:border-gray-600 ">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white">
              Available Rooms
            </h3>
            <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-green-900 dark:text-green-300">
              {freeRooms.length} rooms found
            </span>
          </div>

          {freeRooms.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {freeRooms.map(room => (
                <div key={room} className="flex items-center justify-center p-3 rounded-none bg-gray-50 dark:bg-[#112952]/50 border border-gray-200 dark:border-[#2a3f65] text-gray-700 dark:text-gray-200 font-medium text-center hover:bg-blue-50 hover:border-blue-200 dark:hover:bg-blue-900/30 dark:hover:border-blue-700/50 transition-colors">
                  {room}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="text-gray-500 dark:text-gray-400">No free rooms available for this time slot.</p>
            </div>
          )}
        </div>
      )}

      {isLoading && (
        <div className="text-center py-10">
          <div className="animate-spin rounded-none h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading rooms...</p>
        </div>
      )}

      {error && selectedCampus && (
        <div className="text-center py-10">
          <p className="text-red-500">{error}</p>
        </div>
      )}
    </div>
  );
}
