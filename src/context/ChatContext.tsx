import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  text?: string;
  imageUrl?: string;
  timestamp: string;
  status: 'sent' | 'delivered' | 'read';
  conversationId: string;
  reactions?: { userId: string; reaction: string }[];
}

interface Conversation {
  id: string;
  participants: string[];
  lastMessage: string;
  updatedAt: string;
  isGroup: boolean;
  name?: string;
  unreadCount?: number;
}

interface ChatContextType {
  socket: Socket | null;
  conversations: Conversation[];
  messages: Message[];
  activeConversation: Conversation | null;
  setActiveConversation: (convo: Conversation | null) => void;
  sendMessage: (text: string, imageUrl?: string) => void;
  typing: boolean;
  setTyping: (isTyping: boolean) => void;
  isOtherTyping: boolean;
  addReaction: (messageId: string, reaction: string) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [typing, setTyping] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);

  useEffect(() => {
    if (user && token) {
      const newSocket = io(window.location.origin);
      setSocket(newSocket);

      newSocket.emit('join', user.id);

      newSocket.on('receive_message', (message: Message) => {
        if (activeConversation && message.conversationId === activeConversation.id) {
          setMessages(prev => [...prev, message]);
        }
        // Update conversation list
        setConversations(prev => {
          const index = prev.findIndex(c => c.id === message.conversationId);
          if (index !== -1) {
            const updated = [...prev];
            updated[index] = { ...updated[index], lastMessage: message.text || 'Image', updatedAt: message.timestamp };
            return updated.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
          }
          return prev;
        });
      });

      newSocket.on('message_sent', (message: Message) => {
        setMessages(prev => [...prev, message]);
      });

      newSocket.on('user_typing', (data) => {
        if (activeConversation && data.conversationId === activeConversation.id) {
          setIsOtherTyping(true);
          setTimeout(() => setIsOtherTyping(false), 3000);
        }
      });

      newSocket.on('message_reaction', (data) => {
        setMessages(prev => prev.map(m => 
          m.id === data.messageId 
            ? { ...m, reactions: [...(m.reactions || []), { userId: data.userId, reaction: data.reaction }] }
            : m
        ));
      });

      return () => {
        newSocket.disconnect();
      };
    }
  }, [user, token, activeConversation]);

  const sendMessage = useCallback((text: string, imageUrl?: string) => {
    if (socket && user && activeConversation) {
      const receiverId = activeConversation.participants.find(p => p !== user.id);
      socket.emit('send_message', {
        senderId: user.id,
        receiverId,
        text,
        imageUrl,
        conversationId: activeConversation.id,
        isGroup: activeConversation.isGroup
      });
    }
  }, [socket, user, activeConversation]);

  const addReaction = useCallback((messageId: string, reaction: string) => {
    if (socket && user) {
      socket.emit('react', { messageId, reaction, userId: user.id });
    }
  }, [socket, user]);

  return (
    <ChatContext.Provider value={{ 
      socket, conversations, messages, activeConversation, 
      setActiveConversation, sendMessage, typing, setTyping, 
      isOtherTyping, addReaction 
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used within a ChatProvider');
  return context;
};
