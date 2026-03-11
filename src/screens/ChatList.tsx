import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { useTheme } from '../context/ThemeContext';
import { 
  Search, MoreVertical, MessageSquare, Users, 
  Settings, LogOut, Sun, Moon, Plus, Check, CheckCheck, Smile
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

export default function ChatList() {
  const { user, logout } = useAuth();
  const { conversations, setActiveConversation, activeConversation } = useChat();
  const { theme, toggleTheme } = useTheme();
  const [search, setSearch] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    fetch('/api/users')
      .then(res => res.json())
      .then(data => setAllUsers(data.filter((u: any) => u.id !== user?.id)));
  }, [user]);

  const filteredUsers = allUsers.filter(u => u.name.toLowerCase().includes(search.toLowerCase()));

  const startNewChat = (otherUser: any) => {
    const convoId = [user?.id, otherUser.id].sort().join('_');
    const newConvo = {
      id: convoId,
      participants: [user?.id!, otherUser.id],
      lastMessage: '',
      updatedAt: new Date().toISOString(),
      isGroup: false,
      name: otherUser.name,
      avatar: otherUser.avatar
    };
    setActiveConversation(newConvo);
    setIsSearching(false);
    setSearch('');
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#111b21] border-r border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="bg-[#f0f2f5] dark:bg-[#202c33] p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={user?.avatar} alt="Profile" className="w-10 h-10 rounded-full cursor-pointer" />
          <span className="font-medium dark:text-white hidden md:block">{user?.name}</span>
        </div>
        <div className="flex items-center gap-4 text-[#54656f] dark:text-[#aebac1]">
          <button onClick={toggleTheme} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
          <button className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
            <Users size={20} />
          </button>
          <button className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
            <MessageSquare size={20} />
          </button>
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
              <MoreVertical size={20} />
            </button>
            <AnimatePresence>
              {showMenu && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#233138] shadow-lg rounded-lg py-2 z-50 border border-gray-100 dark:border-gray-800"
                >
                  <button className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-[#182229] dark:text-white flex items-center gap-3">
                    <Settings size={16} /> Settings
                  </button>
                  <button onClick={logout} className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-[#182229] text-red-500 flex items-center gap-3">
                    <LogOut size={16} /> Logout
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="p-2">
        <div className="bg-[#f0f2f5] dark:bg-[#202c33] flex items-center px-4 py-1.5 rounded-lg">
          <Search size={18} className="text-gray-500 mr-3" />
          <input
            type="text"
            placeholder="Search or start new chat"
            className="bg-transparent border-none outline-none w-full py-1 text-sm dark:text-white"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setIsSearching(e.target.value.length > 0);
            }}
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {isSearching ? (
          <div className="py-2">
            <p className="px-4 py-2 text-xs font-bold text-[#2563eb] uppercase tracking-wider">New Chat</p>
            {filteredUsers.map(u => (
              <div 
                key={u.id} 
                onClick={() => startNewChat(u)}
                className="flex items-center gap-3 px-4 py-3 hover:bg-[#f5f6f6] dark:hover:bg-[#2a3942] cursor-pointer transition-colors"
              >
                <img src={u.avatar} alt={u.name} className="w-12 h-12 rounded-full" />
                <div className="flex-1 border-b border-gray-100 dark:border-gray-800 pb-3">
                  <h3 className="font-medium dark:text-white">{u.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{u.about}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          conversations.map(convo => (
            <div 
              key={convo.id} 
              onClick={() => setActiveConversation(convo)}
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${activeConversation?.id === convo.id ? 'bg-[#ebebeb] dark:bg-[#2a3942]' : 'hover:bg-[#f5f6f6] dark:hover:bg-[#2a3942]'}`}
            >
              <img src={convo.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${convo.name}`} alt={convo.name} className="w-12 h-12 rounded-full" />
              <div className="flex-1 border-b border-gray-100 dark:border-gray-800 pb-3">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="font-medium dark:text-white">{convo.name}</h3>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {format(new Date(convo.updatedAt), 'HH:mm')}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate flex-1">{convo.lastMessage}</p>
                  {convo.unreadCount ? (
                    <span className="bg-[#3b82f6] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                      {convo.unreadCount}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
