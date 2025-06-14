import React, { useEffect } from "react";
import { ChatSession } from "../types";
import { PlusCircle, Trash2, MessageSquare, X, Menu } from "lucide-react";

interface SidebarProps {
  history: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  onDeleteSession: (sessionId: string) => void;
  onDeleteAllHistory: () => void;
  isOpen: boolean;
  toggleSidebar: () => void;
setSidebarOpen: (open: boolean) => void; // <-- Add this prop
}

const Sidebar: React.FC<SidebarProps> = ({
  history,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onDeleteAllHistory,
  isOpen,
  toggleSidebar,
  setSidebarOpen,
}) => {
  // Open sidebar automatically on mount (first load)
  useEffect(() => {
    setSidebarOpen(true);
    // eslint-disable-next-line
  }, []);

  return (
    <>
      {/* Menu button for mobile, always visible at top-left */}
      <button
        className=" top-4 left-4 z-50 md:hidden bg-gray-900 text-gray-200 p-2 rounded-full shadow-lg focus:outline-none"
        style={{ display: isOpen ? "none" : "block" }}
        
      >
        {/* <Menu size={28} /> */}
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          onClick={toggleSidebar}
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
        ></div>
      )}

      <div
        className={`fixed  inset-y-0 left-0 z-40 w-64 bg-gray-900 text-gray-200 flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 min-h-screen`}
      >
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <h1 className="text-xl font-semibold">Chat History</h1>
          <button
            onClick={toggleSidebar}
            className="md:hidden text-gray-400 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        <button
          onClick={() => {
            onNewChat();
            if (window.innerWidth < 768) toggleSidebar();
          }}
          className="flex items-center w-full text-left px-4 py-3 hover:bg-gray-700 transition-colors border-b border-gray-700"
        >
          <PlusCircle size={20} className="mr-3 text-green-400" />
          New Chat
        </button>

        <div className="flex-grow overflow-y-auto custom-scrollbar">
          {history.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-500">No chats yet.</p>
          ) : (
            history.map((session) => (
              <div
                key={session.id}
                className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-700 transition-colors ${
                  activeSessionId === session.id
                    ? "bg-indigo-700 text-white"
                    : ""
                }`}
                onClick={() => {
                  onSelectSession(session.id);
                  if (window.innerWidth < 768) toggleSidebar();
                }}
              >
                <div className="flex items-center overflow-hidden">
                  <MessageSquare size={18} className="mr-2 flex-shrink-0" />
                  <span className="truncate text-sm">
                    {session.title || "Untitled Chat"}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (
                      window.confirm(
                        `Are you sure you want to delete "${
                          session.title || "this chat"
                        }"?`
                      )
                    ) {
                      onDeleteSession(session.id);
                      if (history.length === 1) {
                        setTimeout(() => {
                          onNewChat();
                        }, 0);
                      }
                      if (window.innerWidth < 768) toggleSidebar();
                    }
                  }}
                  className="ml-2 p-1 text-red-600 te hover:text-red-400 opacity-50 hover:opacity-100"
                  aria-label="Delete chat"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>

        {history.length > 0 && (
          <div className="p-4 border-t border-gray-700">
            <button
              onClick={() => {
                if (
                  window.confirm(
                    "Are you sure you want to delete all chat history? This action cannot be undone."
                  )
                ) {
                  onDeleteAllHistory();
                  setTimeout(() => {
                    onNewChat();
                  }, 0);
                  if (window.innerWidth < 768) toggleSidebar();
                }
              }}
              className="w-full flex items-center justify-center px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-md shadow-md transition-colors text-sm"
            >
              <Trash2 size={18} className="mr-2 " />
              Delete All History
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default Sidebar;
