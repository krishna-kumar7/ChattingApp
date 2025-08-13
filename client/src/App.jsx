import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import './App.css';

// Mock data for demo if backend is empty
const MOCK_CONVERSATIONS = [
  {
    _id: 'alice',
    messages: [
      { id: '1', text: 'Hello!', from_me: false, timestamp: Date.now() - 60000, status: 'read' },
      { id: '2', text: 'Hi Alice!', from_me: true, timestamp: Date.now() - 50000, status: 'sent' },
    ],
  },
  {
    _id: 'bob',
    messages: [
      { id: '3', text: 'How are you?', from_me: false, timestamp: Date.now() - 40000, status: 'delivered' },
    ],
  },
  {
    _id: 'carol',
    messages: [
      { id: '4', text: 'Hey there!', from_me: false, timestamp: Date.now() - 30000, status: 'sent' },
    ],
  },
];

function App() {
  const [showAddMember, setShowAddMember] = useState(false);
  // Member state
  const [members, setMembers] = useState([]);
  const [newMember, setNewMember] = useState({ wa_id: '', name: '' });
  const [currentMember, setCurrentMember] = useState(null);
  // Chat state
  const [conversations, setConversations] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [socket, setSocket] = useState(null);

  // Setup socket.io connection
  useEffect(() => {
    const s = io('http://localhost:5000');
    setSocket(s);
    return () => s.disconnect();
  }, []);

  // Fetch members
  useEffect(() => {
    fetch('http://localhost:5000/api/members')
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => setMembers(data))
      .catch(() => setMembers([]));
  }, [currentMember]);

  // Fetch conversations (chat list)
  useEffect(() => {
    fetch('http://localhost:5000/api/conversations')
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) setConversations(data);
        else setConversations(MOCK_CONVERSATIONS);
      })
      .catch(() => setConversations(MOCK_CONVERSATIONS));
  }, []);

  // Fetch messages for selected chat and join socket room
  useEffect(() => {
    if (!selectedChat) return;
    if (socket) socket.emit('join', selectedChat._id);
    fetch(`http://localhost:5000/api/messages/${selectedChat._id}`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) setMessages(data);
        else setMessages(selectedChat.messages || []);
      })
      .catch(() => setMessages(selectedChat.messages || []));
  }, [selectedChat, socket]);

  // Listen for real-time messages
  useEffect(() => {
    if (!socket) return;
    const handler = (msg) => {
      if (selectedChat && msg.wa_id === selectedChat._id) {
        setMessages((prev) => [...prev, msg]);
      }
    };
    socket.on('new_message', handler);
    return () => socket.off('new_message', handler);
  }, [socket, selectedChat]);

  // Handle chat selection
  const handleSelectChat = (chat) => {
    setSelectedChat(chat);
  };

  // Handle member selection
  const handleSelectMember = (member) => {
    setCurrentMember(member);
    setSelectedChat(null);
    setMessages([]);
  };

  // Handle new member form
  const handleNewMemberChange = (e) => {
    setNewMember({ ...newMember, [e.target.name]: e.target.value });
  };
  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newMember.wa_id.trim() || !newMember.name.trim()) return;
    const res = await fetch('http://localhost:5000/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newMember),
    });
    if (res.ok) {
      setNewMember({ wa_id: '', name: '' });
      setShowAddMember(false);
      // Refresh member list
      fetch('http://localhost:5000/api/members')
        .then(res => res.ok ? res.json() : Promise.reject())
        .then(data => setMembers(data));
    } else {
      alert('Failed to add member (maybe duplicate wa_id)');
    }
  };

  // Handle message send
  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || !selectedChat || !currentMember) return;
    const newMsg = {
      id: Date.now().toString(),
      wa_id: selectedChat._id,
      text: input,
      from_me: true,
      sender: currentMember.wa_id,
      timestamp: Date.now(),
      status: 'sent',
    };
    setMessages([...messages, newMsg]);
    setInput('');
    // Try backend
    fetch('http://localhost:5000/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newMsg),
    });
  };

  return (
    <div className="wa-container">
      <aside className="wa-sidebar">
        <div className="wa-sidebar-header" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <span>Members</span>
          <button
            style={{
              background:'none',border:'none',fontSize:'1.5rem',cursor:'pointer',color:'#25d366',padding:0
            }}
            title="Add Member"
            onClick={() => setShowAddMember(true)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="12" fill="#25d366"/>
              <path d="M12 7v10M7 12h10" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        {showAddMember && (
          <div style={{
            position:'fixed',top:0,left:0,width:'100vw',height:'100vh',background:'rgba(0,0,0,0.3)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'
          }}>
            <div style={{background:'#222d34',padding:'2rem',borderRadius:'10px',minWidth:'300px',boxShadow:'0 2px 16px #0008',position:'relative'}}>
              <button
                style={{position:'absolute',top:10,right:10,background:'none',border:'none',fontSize:'1.5rem',color:'#fff',cursor:'pointer'}}
                onClick={() => setShowAddMember(false)}
                title="Close"
              >×</button>
              <h2 style={{margin:'0 0 1rem 0',color:'#25d366'}}>Add New Member</h2>
              <form onSubmit={handleAddMember}>
                <input
                  type="text"
                  name="wa_id"
                  placeholder="wa_id (unique)"
                  value={newMember.wa_id}
                  onChange={handleNewMemberChange}
                  style={{marginBottom:'1rem',width:'100%',padding:'0.5rem',borderRadius:'5px',border:'1px solid #333',background:'#111',color:'#fff'}}
                />
                <input
                  type="text"
                  name="name"
                  placeholder="Name"
                  value={newMember.name}
                  onChange={handleNewMemberChange}
                  style={{marginBottom:'1rem',width:'100%',padding:'0.5rem',borderRadius:'5px',border:'1px solid #333',background:'#111',color:'#fff'}}
                />
                <button type="submit" style={{background:'#25d366',color:'#fff',border:'none',borderRadius:'5px',padding:'0.5rem 1.5rem',fontWeight:'bold',fontSize:'1rem',cursor:'pointer'}}>Add</button>
              </form>
            </div>
          </div>
        )}
        <div className="wa-chat-list">
          {members.map(member => (
            <div
              key={member.wa_id}
              className={`wa-chat-item${currentMember && currentMember.wa_id === member.wa_id ? ' active' : ''}`}
              onClick={() => handleSelectMember(member)}
            >
              <div className="wa-chat-avatar">{member.name?.[0]?.toUpperCase() || '?'}</div>
              <div className="wa-chat-info">
                <div className="wa-chat-name">{member.name}</div>
                <div className="wa-chat-last">{member.wa_id}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="wa-sidebar-header" style={{marginTop:'1rem'}}>Chats</div>
        <div className="wa-chat-list">
          {conversations.map(chat => (
            <div
              key={chat._id}
              className={`wa-chat-item${selectedChat && selectedChat._id === chat._id ? ' active' : ''}`}
              onClick={() => handleSelectChat(chat)}
            >
              <div className="wa-chat-avatar">{chat._id?.[0]?.toUpperCase() || '?'}</div>
              <div className="wa-chat-info">
                <div className="wa-chat-name">{chat._id}</div>
                <div className="wa-chat-last">{chat.messages?.[chat.messages.length-1]?.text || ''}</div>
              </div>
            </div>
          ))}
        </div>
      </aside>
      <main className="wa-main">
        {selectedChat && currentMember ? (
          <>
            <div className="wa-main-header">
              <div className="wa-user-avatar">{selectedChat._id?.[0]?.toUpperCase() || '?'}</div>
              <div className="wa-user-info">
                <div className="wa-user-name">{selectedChat._id}</div>
                <div className="wa-user-number">Chatting as: {currentMember.name} ({currentMember.wa_id})</div>
              </div>
            </div>
            <div className="wa-messages">
              {messages.map((msg, idx) => (
                <div
                  key={msg.id || idx}
                  className={`wa-message ${msg.from_me ? 'wa-message-sent' : 'wa-message-received'}`}
                >
                  <div className="wa-message-bubble">{msg.text}</div>
                  <div className="wa-message-meta">
                    {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    {msg.status ? ` ${msg.status === 'read' ? '✓✓' : msg.status === 'delivered' ? '✓✓' : '✓'}` : ''}
                    {msg.sender ? ` | from: ${msg.sender}` : ''}
                  </div>
                </div>
              ))}
            </div>
            <form className="wa-input-box" onSubmit={handleSend}>
              <input
                type="text"
                placeholder="Type a message"
                value={input}
                onChange={e => setInput(e.target.value)}
              />
              <button type="submit">Send</button>
            </form>
          </>
        ) : (
          <div className="wa-main-header" style={{justifyContent:'center',fontSize:'1.2rem'}}>Select a member and a chat to start messaging</div>
        )}
      </main>
    </div>
  );
}

export default App;