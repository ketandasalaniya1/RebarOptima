import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Paperclip, Smile, Mic, X, Square, Users } from 'lucide-react';
import { chatApi } from '../../../utils/api';
import ReactionPickerModal from './ReactionPickerModal';
import MediaSendModal from './MediaSendModal';
import { validateChatFile, CHAT_FILE_ACCEPT } from '../utils/chatFileSecurity';

export default function MessageComposer({
  onSendMessage,
  onTypingStart,
  onTypingStop,
  replyingTo,
  onCancelReply,
  isGroup = false,
  groupMembers = [],
}) {
  const [text, setText] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);

  // Mention (@user and @all) state for group chat
  const [mentionQuery, setMentionQuery] = useState(null);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);

  // WhatsApp Attachment Send Preview Modal State
  const [pendingFiles, setPendingFiles] = useState([]);
  const [showMediaModal, setShowMediaModal] = useState(false);

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  // Compute mention suggestions for groups
  const mentionOptions = useMemo(() => {
    if (mentionQuery === null || !isGroup) return [];
    const q = mentionQuery.toLowerCase().trim();
    const results = [];

    // 1. @all / @everyone option
    if ('all'.includes(q) || 'everyone'.includes(q) || q === '') {
      results.push({
        id: '__all__',
        name: 'all',
        displayName: '@all',
        description: 'Notify everyone in this group',
        isAll: true,
      });
    }

    // 2. Individual group members
    groupMembers.forEach((m) => {
      const name = m.name || m.username || m.email || 'Member';
      if (!q || name.toLowerCase().includes(q)) {
        results.push({
          id: m.id || m._id,
          name: name,
          displayName: `@${name}`,
          description: m.role ? `Role: ${m.role}` : m.email || '',
          avatar: m.avatar,
          isAll: false,
        });
      }
    });

    return results.slice(0, 8);
  }, [mentionQuery, isGroup, groupMembers]);

  const handleSelectMention = (option) => {
    if (!textareaRef.current) return;
    const cursor = textareaRef.current.selectionStart || text.length;
    const left = text.slice(0, cursor);
    const right = text.slice(cursor);
    const atIndex = left.lastIndexOf('@');
    if (atIndex !== -1) {
      const newLeft = left.slice(0, atIndex) + `@${option.name} `;
      const newText = newLeft + right;
      setText(newText);
      setMentionQuery(null);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const newPos = newLeft.length;
          textareaRef.current.setSelectionRange(newPos, newPos);
        }
      }, 0);
    }
  };

  const handleTextChange = (e) => {
    const val = e.target.value;
    setText(val);

    const cursor = e.target.selectionStart;
    if (isGroup) {
      const left = val.slice(0, cursor);
      const match = left.match(/(?:^|\s)@([a-zA-Z0-9_\s]{0,25})$/);
      if (match) {
        setMentionQuery(match[1]);
        setSelectedMentionIndex(0);
      } else {
        setMentionQuery(null);
      }
    }

    if (onTypingStart) {
      onTypingStart();
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      if (onTypingStop) onTypingStop();
    }, 2000);
  };

  const handleKeyDown = (e) => {
    // Handle keyboard navigation in mention dropdown
    if (mentionQuery !== null && mentionOptions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIndex((prev) => (prev + 1) % mentionOptions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIndex((prev) => (prev - 1 + mentionOptions.length) % mentionOptions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleSelectMention(mentionOptions[selectedMentionIndex] || mentionOptions[0]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (!text.trim()) return;
    const content = text.trim();
    setText('');
    setMentionQuery(null);
    setShowEmojis(false);
    if (onTypingStop) onTypingStop();

    onSendMessage({
      content,
      type: 'text',
      replyTo: replyingTo
        ? {
            messageId: replyingTo._id || replyingTo.id,
            senderName: replyingTo.senderName,
            contentSnippet: replyingTo.content?.substring(0, 80) || 'Attachment',
            type: replyingTo.type || 'text',
          }
        : undefined,
    });

    if (onCancelReply) onCancelReply();
  };

  const handleInsertEmoji = (emoji) => {
    setText((prev) => prev + emoji);
  };

  // ── ATTACHMENT SELECTION (WHATSAPP PREVIEW FLOW) ───────────────────────────
  const handleFileChange = (e) => {
    const rawFiles = Array.from(e.target.files || []);
    if (rawFiles.length === 0) return;

    const validFiles = [];
    for (const file of rawFiles) {
      const check = validateChatFile(file);
      if (!check.valid) {
        alert(check.error);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      validFiles.push(file);
    }

    setPendingFiles(validFiles);
    setShowMediaModal(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Clipboard image/document paste support
  const handlePaste = (e) => {
    if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
      e.preventDefault();
      const rawFiles = Array.from(e.clipboardData.files);
      const validFiles = [];
      for (const file of rawFiles) {
        const check = validateChatFile(file);
        if (!check.valid) {
          alert(check.error);
          return;
        }
        validFiles.push(file);
      }
      setPendingFiles(validFiles);
      setShowMediaModal(true);
    }
  };

  // Callback when user confirms sending from MediaSendModal
  const handleSendMedia = (mediaPayload) => {
    onSendMessage({
      ...mediaPayload,
      replyTo: replyingTo
        ? {
            messageId: replyingTo._id || replyingTo.id,
            senderName: replyingTo.senderName,
            contentSnippet: replyingTo.content?.substring(0, 80) || 'Attachment',
            type: replyingTo.type || 'text',
          }
        : undefined,
    });
    if (onCancelReply) onCancelReply();
  };

  const recordDurationRef = useRef(0);

  // ── VOICE RECORDER ────────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      recordDurationRef.current = 0;

      let selectedMimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          selectedMimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          selectedMimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          selectedMimeType = 'audio/ogg';
        }
      }

      const recorder = new MediaRecorder(stream, { mimeType: selectedMimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: selectedMimeType });
        stream.getTracks().forEach((track) => track.stop());

        if (audioBlob.size === 0) {
          alert('No audio recorded. Please hold or speak into the microphone.');
          return;
        }

        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const base64Data = reader.result;
            const fileExt = selectedMimeType.includes('mp4') ? 'm4a' : 'webm';
            const uploadRes = await chatApi.uploadAttachment({
              fileName: `VoiceNote_${Date.now()}.${fileExt}`,
              mimeType: selectedMimeType,
              sizeBytes: audioBlob.size,
              dataBase64: base64Data,
              durationSeconds: recordDurationRef.current || 1,
            });

            if (uploadRes.success && uploadRes.data) {
              onSendMessage({
                content: '',
                type: 'audio',
                attachments: [uploadRes.data],
              });
            } else {
              alert('Could not upload voice note.');
            }
          } catch (uploadErr) {
            alert(`Voice note upload error: ${uploadErr.message}`);
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      // Collect data every 200ms
      recorder.start(200);
      setIsRecording(true);
      setRecordDuration(0);
      timerRef.current = setInterval(() => {
        recordDurationRef.current += 1;
        setRecordDuration(recordDurationRef.current);
      }, 1000);
    } catch (err) {
      alert('Could not access microphone: ' + err.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      try {
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      } catch {}
      setIsRecording(false);
      clearInterval(timerRef.current);
      audioChunksRef.current = [];
    }
  };

  const formatSecs = (secs) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  };

  return (
    <div className="chat-composer-wrap" style={{ position: 'relative' }}>
      {/* Replying banner */}
      {replyingTo && (
        <div className="chat-reply-banner">
          <div>
            <span style={{ fontWeight: 600, color: '#22c55e', marginRight: '6px' }}>
              Replying to {replyingTo.senderName}:
            </span>
            <span style={{ color: '#cbd5e1' }}>
              {replyingTo.content?.substring(0, 60) || 'Attachment'}
            </span>
          </div>
          <button className="chat-icon-btn" onClick={onCancelReply}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* WhatsApp Emoji Picker popup opening above chat input */}
      <ReactionPickerModal
        isOpen={showEmojis}
        onClose={() => setShowEmojis(false)}
        onSelectEmoji={handleInsertEmoji}
        placement="above"
      />

      {/* Group @mention Suggestions Dropdown */}
      {mentionQuery !== null && mentionOptions.length > 0 && (
        <div className="chat-mention-dropdown" role="listbox">
          <div className="chat-mention-dropdown-header">
            <span>Group Members & Mentions</span>
          </div>
          <div className="chat-mention-list">
            {mentionOptions.map((opt, idx) => (
              <div
                key={opt.id}
                className={`chat-mention-item ${idx === selectedMentionIndex ? 'active' : ''}`}
                onClick={() => handleSelectMention(opt)}
                onMouseEnter={() => setSelectedMentionIndex(idx)}
              >
                <div className="chat-mention-avatar">
                  {opt.isAll ? (
                    <Users size={16} color="#22c55e" />
                  ) : opt.avatar ? (
                    <img src={opt.avatar} alt={opt.name} />
                  ) : (
                    opt.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="chat-mention-info">
                  <div className="chat-mention-name">{opt.displayName}</div>
                  {opt.description && (
                    <div className="chat-mention-desc">{opt.description}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="chat-composer-row">
        {isRecording ? (
          /* Audio recording toolbar */
          <div className="chat-voice-recorder">
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div className="chat-rec-dot"></div>
              <span>Recording voice note... {formatSecs(recordDuration)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={cancelRecording}
                style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '13px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={stopRecording}
                style={{
                  background: '#22c55e',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#0b0e14',
                }}
              >
                <Square size={14} fill="#0b0e14" />
              </button>
            </div>
          </div>
        ) : (
          /* Normal typing composer */
          <>
            <button
              type="button"
              className="chat-icon-btn"
              onClick={() => setShowEmojis(!showEmojis)}
              title="Add Emoji"
            >
              <Smile size={20} />
            </button>

            <button
              type="button"
              className="chat-icon-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Attach File or Image"
            >
              <Paperclip size={20} />
            </button>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              style={{ display: 'none' }}
              multiple
              accept={CHAT_FILE_ACCEPT}
            />

            <textarea
              ref={textareaRef}
              rows={1}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Type a message (Enter to send, Shift+Enter for new line)..."
              className="chat-input-textarea"
            />

            {text.trim() ? (
              <button
                type="button"
                className="chat-send-btn"
                onClick={handleSend}
                title="Send Message"
              >
                <Send size={18} />
              </button>
            ) : (
              <button
                type="button"
                className="chat-icon-btn"
                onClick={startRecording}
                title="Hold or Click to Record Voice Note"
              >
                <Mic size={20} color="#22c55e" />
              </button>
            )}
          </>
        )}
      </div>

      {/* WhatsApp Media & Document Send Preview Modal */}
      <MediaSendModal
        isOpen={showMediaModal}
        initialFiles={pendingFiles}
        onClose={() => {
          setShowMediaModal(false);
          setPendingFiles([]);
        }}
        onSendMedia={handleSendMedia}
      />
    </div>
  );
}
