
import React from 'react';
import { ChatHistoryItem, Theme } from '../types';
import { PlusIcon, ChatBubbleIcon, CloseIcon, TrashIcon, ReloadIcon } from './IconComponents'; // Added ReloadIcon
import ThemeSwitcher from './ThemeSwitcher';
import LoadingDots from './LoadingDots'; // Import LoadingDots

interface SidebarProps {
  histories: ChatHistoryItem[];
  activeChatId: string | null;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  onDeleteAllChats: () => void;
  apiKeyMissing: boolean;
  isOpenOnMobile: boolean;
  onCloseMobileSidebar: () => void;
  currentTheme: Theme;
  onThemeChange: (theme: Theme) => void;
  generatingTitleForChatId: string | null;
  onReloadPage: () => void; // New prop for reloading page
}

const Sidebar: React.FC<SidebarProps> = ({
  histories,
  activeChatId,
  onNewChat,
  onSelectChat,
  onDeleteChat,
  onDeleteAllChats,
  apiKeyMissing,
  isOpenOnMobile,
  onCloseMobileSidebar,
  currentTheme,
  onThemeChange,
  generatingTitleForChatId,
  onReloadPage, // Destructure new prop
}) => {
  const handleSelectChatAndCloseSidebar = (id: string) => {
    onSelectChat(id);
    onCloseMobileSidebar(); 
  };

  const handleNewChatAndCloseSidebar = () => {
    onNewChat();
    onCloseMobileSidebar(); 
  };

  const handleDeleteChat = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation(); 
    if (window.confirm('Are you sure you want to delete this chat? This action cannot be undone.')) {
      onDeleteChat(chatId);
    }
  };

  const handleDeleteAllChats = () => {
    if (window.confirm('Are you sure you want to delete ALL chat histories? This action cannot be undone.')) {
      onDeleteAllChats();
      onCloseMobileSidebar(); 
    }
  };

  const handleReloadAndCloseSidebar = () => {
    onReloadPage();
    // No need to close sidebar manually as page will reload fully
  };

  return (
    <>
      {isOpenOnMobile && (
        <div 
          className="fixed inset-0 z-30 bg-black/50 dark:bg-black/70 md:hidden" 
          onClick={onCloseMobileSidebar}
          aria-hidden="true"
        ></div>
      )}

      <div 
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 transition-transform duration-300 ease-in-out md:static md:inset-auto md:z-auto md:w-64 md:translate-x-0 
                  ${isOpenOnMobile ? 'translate-x-0 w-64 sm:w-72 shadow-xl' : '-translate-x-full w-64 sm:w-72'}`}
        aria-label="Chat history sidebar"
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-300 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Chat History</h2>
          <button 
            onClick={onCloseMobileSidebar} 
            className="md:hidden text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            aria-label="Close sidebar"
          >
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="p-4 border-b border-slate-300 dark:border-slate-700">
          <button
            onClick={handleNewChatAndCloseSidebar}
            disabled={apiKeyMissing}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-sky-500 dark:bg-sky-600 text-white rounded-lg hover:bg-sky-600 dark:hover:bg-sky-500 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed"
          >
            <PlusIcon className="w-5 h-5" />
            New Chat
          </button>
        </div>
        <nav className="flex-grow overflow-y-auto p-2 space-y-1">
          {histories.length === 0 && !apiKeyMissing && (
            <p className="text-slate-500 dark:text-slate-400 text-sm text-center p-4">No chat history yet.</p>
          )}
          {histories.map((history) => (
            <div key={history.id} className="relative group">
              <button
                onClick={() => handleSelectChatAndCloseSidebar(history.id)}
                disabled={apiKeyMissing}
                className={`w-full flex items-center gap-3 p-3 pr-10 rounded-md text-left transition-colors focus:outline-none focus:ring-1 focus:ring-sky-500
                  ${ activeChatId === history.id 
                    ? 'bg-sky-600 dark:bg-sky-700 text-white' 
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  } ${apiKeyMissing ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={history.title}
              >
                <ChatBubbleIcon className="w-5 h-5 flex-shrink-0" />
                <div className="flex items-center flex-grow min-w-0">
                  <span className="truncate text-sm">{history.title}</span>
                  {history.id === generatingTitleForChatId && (
                    <div className="ml-1.5 flex-shrink-0">
                      <LoadingDots />
                    </div>
                  )}
                </div>
                <span className={`text-xs flex-shrink-0 ml-auto mr-1 group-hover:hidden ${activeChatId === history.id ? 'text-sky-100 dark:text-sky-300' : 'text-slate-400 dark:text-slate-500'}`}>
                  {new Date(history.lastUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </button>
              <button
                  onClick={(e) => handleDeleteChat(e, history.id)}
                  disabled={apiKeyMissing}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 rounded-md opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity
                             ${apiKeyMissing ? 'cursor-not-allowed !opacity-25' : ''}`}
                  aria-label={`Delete chat: ${history.title}`}
                >
                  <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-300 dark:border-slate-700 space-y-3">
          <ThemeSwitcher currentTheme={currentTheme} onThemeChange={onThemeChange} />
          
          {/* <button
            onClick={handleReloadAndCloseSidebar}
            className="group w-full flex items-center justify-center gap-2 px-4 py-2 bg-sky-500 dark:bg-sky-600 text-white rounded-lg hover:bg-sky-600 dark:hover:bg-sky-500 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400"
            title="Reload Application"
          >
            <ReloadIcon className="w-5 h-5 group-hover:animate-spin" />
            Reload Page
          </button> */}

          {histories.length > 0 && (
            <button
              onClick={handleDeleteAllChats}
              disabled={apiKeyMissing}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 dark:bg-red-700 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed"
            >
              <TrashIcon className="w-5 h-5" />
              Delete All Chats
            </button>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
            Powered by Kun Amra
          </p>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
