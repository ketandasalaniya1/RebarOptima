import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Clock,
  Smile,
  Search,
  Coffee,
  Activity,
  Car,
  Lightbulb,
  Hash,
  Flag,
  PawPrint,
  X,
} from 'lucide-react';
import { EMOJI_CATEGORIES, EMOJI_DATABASE } from './emojiData';

const CATEGORY_ICONS = {
  recent: Clock,
  smileys: Smile,
  animals: PawPrint,
  food: Coffee,
  activity: Activity,
  travel: Car,
  objects: Lightbulb,
  symbols: Hash,
  flags: Flag,
};

const DEFAULT_RECENT = ['👍', '❤️', '😂', '🔥', '🙏', '👏', '🏗️', '🎉', '✅', '💯'];

export default function ReactionPickerModal({
  isOpen,
  onClose,
  onSelectEmoji,
  placement = 'left',
}) {
  const [activeTab, setActiveTab] = useState('smileys');
  const [search, setSearch] = useState('');
  const [recentEmojis, setRecentEmojis] = useState(() => {
    try {
      const saved = localStorage.getItem('chat_recent_reactions');
      return saved ? JSON.parse(saved) : DEFAULT_RECENT;
    } catch {
      return DEFAULT_RECENT;
    }
  });

  const pickerRef = useRef(null);
  const scrollRef = useRef(null);
  const isProgrammaticScrollRef = useRef(false);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Handle Tab navigation & smooth scroll
  const handleTabClick = (catId) => {
    setActiveTab(catId);
    if (search) {
      setSearch('');
    }
    isProgrammaticScrollRef.current = true;
    setTimeout(() => {
      if (!scrollRef.current) return;
      const targetEl = scrollRef.current.querySelector(`#cat-${catId}`);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 400);
    }, 50);
  };

  // Sync active tab with user scroll
  const handleScroll = () => {
    if (isProgrammaticScrollRef.current || search || !scrollRef.current) return;
    const container = scrollRef.current;
    const sections = container.querySelectorAll('.chat-rp-section');
    const containerTop = container.getBoundingClientRect().top;

    let currentVisibleId = null;
    for (const sec of sections) {
      const rect = sec.getBoundingClientRect();
      if (rect.top - containerTop <= 60 && rect.bottom - containerTop > 10) {
        currentVisibleId = sec.id.replace('cat-', '');
      }
    }
    if (currentVisibleId && currentVisibleId !== activeTab) {
      setActiveTab(currentVisibleId);
    }
  };

  // Filter emojis across all categories based on search query
  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    const results = [];
    const seen = new Set();

    for (const [, list] of Object.entries(EMOJI_DATABASE)) {
      for (const item of list) {
        if (!seen.has(item.char) && (item.char === q || item.keywords.toLowerCase().includes(q))) {
          seen.add(item.char);
          results.push(item);
        }
      }
    }
    return results;
  }, [search]);

  if (!isOpen) return null;

  const handleEmojiClick = (emojiChar) => {
    // Update recent list
    const updated = [emojiChar, ...recentEmojis.filter((e) => e !== emojiChar)].slice(0, 16);
    setRecentEmojis(updated);
    try {
      localStorage.setItem('chat_recent_reactions', JSON.stringify(updated));
    } catch {}

    onSelectEmoji(emojiChar);
    onClose();
  };

  return (
    <div className={`chat-reaction-picker-popup placement-${placement}`} ref={pickerRef}>
      {/* 1. Category Tab Icons Bar (WhatsApp Web style tabs) */}
      <div className="chat-rp-tabs-header">
        {EMOJI_CATEGORIES.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.id] || Smile;
          const isActive = activeTab === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              className={`chat-rp-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => handleTabClick(cat.id)}
              title={cat.label}
            >
              <Icon size={18} />
              {isActive && <div className="chat-rp-tab-indicator" />}
            </button>
          );
        })}
      </div>

      {/* 2. Search Reaction Input */}
      <div className="chat-rp-search-bar">
        <div className="chat-rp-search-input-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search reaction"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          {search && (
            <button
              type="button"
              className="chat-icon-btn"
              style={{ width: '20px', height: '20px', padding: 0 }}
              onClick={() => setSearch('')}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* 3. Scrollable Emoji Grid Sections */}
      <div
        className="chat-rp-scroll-body"
        ref={scrollRef}
        onScroll={handleScroll}
      >
        {/* If Search is Active */}
        {search.trim() ? (
          <div className="chat-rp-section" id="cat-search-results">
            <div className="chat-rp-section-title">
              Search Results ({searchResults.length})
            </div>
            {searchResults.length > 0 ? (
              <div className="chat-rp-grid">
                {searchResults.map((item, i) => (
                  <button
                    key={`search-${item.char}-${i}`}
                    type="button"
                    className="chat-rp-emoji-btn"
                    onClick={() => handleEmojiClick(item.char)}
                    title={item.keywords.split(' ').slice(0, 3).join(' ')}
                  >
                    {item.char}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 12px', color: '#8696a0', fontSize: '13px' }}>
                No reactions found for "{search}"
              </div>
            )}
          </div>
        ) : (
          /* Normal Category Sections */
          <>
            {/* Recent reactions */}
            {recentEmojis.length > 0 && (
              <div className="chat-rp-section" id="cat-recent">
                <div className="chat-rp-section-title">Recent reactions</div>
                <div className="chat-rp-grid">
                  {recentEmojis.map((emoji, i) => (
                    <button
                      key={`recent-${emoji}-${i}`}
                      type="button"
                      className="chat-rp-emoji-btn"
                      onClick={() => handleEmojiClick(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Standard Categories */}
            {EMOJI_CATEGORIES.filter((c) => c.id !== 'recent').map((cat) => {
              const list = EMOJI_DATABASE[cat.id] || [];
              if (list.length === 0) return null;
              return (
                <div key={cat.id} className="chat-rp-section" id={`cat-${cat.id}`}>
                  <div className="chat-rp-section-title">{cat.label}</div>
                  <div className="chat-rp-grid">
                    {list.map((item, i) => (
                      <button
                        key={`${cat.id}-${item.char}-${i}`}
                        type="button"
                        className="chat-rp-emoji-btn"
                        onClick={() => handleEmojiClick(item.char)}
                        title={item.keywords.split(' ').slice(0, 3).join(' ')}
                      >
                        {item.char}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
