import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ChatProvider, useChat } from './context/ChatContext';
import { ThemeProvider } from './context/ThemeContext';
import { motion, AnimatePresence } from 'motion/react';
import Login from './screens/Login';
import ChatList from './screens/ChatList';
import Chat from './screens/Chat';

function AppContent() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <ChatProvider>
      <div className="h-screen w-screen flex overflow-hidden bg-[#f0f2f5] dark:bg-[#111b21]">
        {/* Desktop Layout */}
        <div className="hidden md:flex w-full h-full max-w-[1600px] mx-auto shadow-2xl my-auto md:h-[95vh] rounded-none md:rounded-lg overflow-hidden">
          <div className="w-[400px] flex-shrink-0">
            <ChatList />
          </div>
          <div className="flex-1">
            <Chat />
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="flex md:hidden w-full h-full">
          <div className="w-full h-full relative">
            <ChatList />
            <div className="absolute inset-0 z-50 pointer-events-none">
              {/* This is a simple way to handle mobile navigation in a single-page mock */}
              <div className="pointer-events-auto h-full w-full">
                <ChatOverlay />
              </div>
            </div>
          </div>
        </div>
      </div>
    </ChatProvider>
  );
}

function ChatOverlay() {
  const { activeConversation } = useChat();
  return (
    <AnimatePresence>
      {activeConversation && (
        <motion.div 
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed inset-0 z-[60] bg-white dark:bg-[#0b141a]"
        >
          <Chat />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </AuthProvider>
  );
}
