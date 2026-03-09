import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { 
  MoreVertical, Search, Paperclip, Smile, Mic, Send, 
  ArrowLeft, Image as ImageIcon, Check, CheckCheck
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

export default function Chat() {
  const { user } = useAuth();
  const { 
    activeConversation, setActiveConversation, messages, 
    sendMessage, isOtherTyping, setTyping, addReaction 
  } = useChat();
  const [inputText, setInputText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOtherTyping]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      sendMessage(inputText);
      setInputText('');
      setTyping(false);
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    if (e.target.value.length > 0) {
      setTyping(true);
    } else {
      setTyping(false);
    }
  };

  if (!activeConversation) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[#f0f2f5] dark:bg-[#222e35] text-center p-8">
        <div className="w-64 h-64 mb-8 opacity-20">
          <img src="https://whatsapp-desktop.web.app/assets/intro-connection-light.png" alt="Intro" className="w-full h-full object-contain" />
        </div>
        <h1 className="text-3xl font-light text-gray-600 dark:text-gray-300 mb-4">BLUEYAD Web</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md leading-relaxed">
          Send and receive messages without keeping your phone online.<br />
          Use BLUEYAD on up to 4 linked devices and 1 phone at the same time.
        </p>
        <div className="mt-auto flex items-center gap-2 text-xs text-gray-400">
          <Lock size={12} /> End-to-end encrypted
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#efeae2] dark:bg-[#0b141a] relative overflow-hidden">
      {/* Chat Header */}
      <div className="bg-[#f0f2f5] dark:bg-[#202c33] p-3 flex items-center justify-between z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => setActiveConversation(null)} className="md:hidden p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full">
            <ArrowLeft size={20} className="text-[#54656f] dark:text-[#aebac1]" />
          </button>
          <img src={activeConversation.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${activeConversation.name}`} alt="Avatar" className="w-10 h-10 rounded-full" />
          <div>
            <h3 className="font-medium dark:text-white text-sm">{activeConversation.name}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isOtherTyping ? 'typing...' : 'online'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[#54656f] dark:text-[#aebac1]">
          <button className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
            <Search size={20} />
          </button>
          <button className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
            <MoreVertical size={20} />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-2 custom-scrollbar bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] dark:bg-none bg-repeat">
        {messages.map((msg, idx) => {
          const isMe = msg.senderId === user?.id;
          return (
            <motion.div 
              key={msg.id}
              initial={{ opacity: 0, scale: 0.95, x: isMe ? 20 : -20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-[85%] md:max-w-[65%] p-2 rounded-lg shadow-sm relative group ${
                  isMe ? 'bg-[#d9fdd3] dark:bg-[#005c4b] rounded-tr-none' : 'bg-white dark:bg-[#202c33] dark:text-white rounded-tl-none'
                }`}
              >
                {msg.imageUrl && (
                  <img src={msg.imageUrl} alt="Media" className="rounded-md mb-2 max-w-full h-auto" />
                )}
                <p className="text-sm pr-12">{msg.text}</p>
                <div className="flex items-center justify-end gap-1 mt-1">
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">
                    {format(new Date(msg.timestamp), 'HH:mm')}
                  </span>
                  {isMe && (
                    <span className="text-[#53bdeb]">
                      {msg.status === 'read' ? <CheckCheck size={14} /> : <Check size={14} />}
                    </span>
                  )}
                </div>

                {/* Reactions */}
                {msg.reactions && msg.reactions.length > 0 && (
                  <div className="absolute -bottom-3 left-2 flex gap-1">
                    {msg.reactions.map((r, i) => (
                      <span key={i} className="bg-white dark:bg-[#202c33] shadow-sm rounded-full px-1 text-xs border border-gray-100 dark:border-gray-800">
                        {r.reaction}
                      </span>
                    ))}
                  </div>
                )}

                {/* Reaction Picker Trigger */}
                <button 
                  onClick={() => addReaction(msg.id, '❤️')}
                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-black/5 rounded-full"
                >
                  <Smile size={14} className="text-gray-400" />
                </button>
              </div>
            </motion.div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-[#f0f2f5] dark:bg-[#202c33] p-2 flex items-center gap-2 z-10">
        <div className="flex items-center gap-1">
          <button className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-[#54656f] dark:text-[#aebac1]">
            <Smile size={24} />
          </button>
          <button className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-[#54656f] dark:text-[#aebac1]">
            <Paperclip size={24} />
          </button>
        </div>
        <form onSubmit={handleSend} className="flex-1">
          <input
            type="text"
            placeholder="Type a message"
            className="w-full bg-white dark:bg-[#2a3942] dark:text-white px-4 py-2 rounded-lg outline-none text-sm"
            value={inputText}
            onChange={handleTyping}
          />
        </form>
        <button 
          onClick={handleSend}
          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-[#54656f] dark:text-[#aebac1]"
        >
          {inputText.trim() ? <Send size={24} className="text-[#00a884]" /> : <Mic size={24} />}
        </button>
      </div>
    </div>
  );
}

function Lock({ size, className }: { size: number, className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
