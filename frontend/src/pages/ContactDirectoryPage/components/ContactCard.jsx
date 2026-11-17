import React, { useState } from 'react';
import {
  Phone,
  MessageCircle,
  Copy,
  Check,
  Mail,
  Building2,
  Lock,
  Star,
  MoreVertical,
  Edit2,
  Archive,
  RotateCcw,
  Trash2,
  Eye,
  ExternalLink,
} from 'lucide-react';

const AVATAR_COLORS = [
  { bg: 'rgba(4, 120, 87, 0.14)', text: '#047857' },
  { bg: 'rgba(37, 99, 235, 0.14)', text: '#2563eb' },
  { bg: 'rgba(124, 58, 237, 0.14)', text: '#7c3aed' },
  { bg: 'rgba(217, 119, 6, 0.14)', text: '#d97706' },
  { bg: 'rgba(219, 39, 119, 0.14)', text: '#db2777' },
  { bg: 'rgba(13, 148, 136, 0.14)', text: '#0d9488' },
];

function getAvatarStyle(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ContactCard({
  contact,
  onView,
  onEdit,
  onToggleFavourite,
  onArchive,
  onRestore,
  onDelete,
  onProjectClick,
}) {
  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const primaryPhone = contact.primaryPhone || contact.phones?.[0]?.number || '';
  const digitsOnly = primaryPhone.replace(/\D/g, '');
  const hasWhatsApp = contact.phones?.some((p) => p.isPrimary ? p.hasWhatsApp : false) || Boolean(contact.phones?.[0]?.hasWhatsApp);

  const avatarStyle = getAvatarStyle(contact.name);
  const initials = getInitials(contact.name);

  const handleCopyPhone = async (e) => {
    e.stopPropagation();
    if (!primaryPhone) return;
    try {
      await navigator.clipboard.writeText(primaryPhone);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  };

  const handleWhatsApp = (e) => {
    e.stopPropagation();
    if (!digitsOnly) return;
    const cleanNumber = digitsOnly.length === 10 ? `91${digitsOnly}` : digitsOnly;
    const url = `https://wa.me/${cleanNumber}?text=Hello%20${encodeURIComponent(contact.name)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCall = (e) => {
    e.stopPropagation();
  };

  const handleEmail = (e) => {
    e.stopPropagation();
  };

  return (
    <div className={`ro-contact-card ${contact.isArchived ? 'is-archived' : ''}`} onClick={() => onView(contact)}>
      {/* Card Header */}
      <div className="ro-contact-card-top">
        <div className="ro-contact-avatar-wrap">
          {contact.avatar ? (
            <img src={contact.avatar} alt={contact.name} className="ro-contact-avatar-img" />
          ) : (
            <div
              className="ro-contact-avatar-initials"
              style={{ backgroundColor: avatarStyle.bg, color: avatarStyle.text }}
            >
              {initials}
            </div>
          )}
        </div>

        <div className="ro-contact-title-area">
          <div className="ro-contact-name-row">
            <h3 className="ro-contact-name" title={contact.name}>
              {contact.name}
            </h3>
            {contact.visibility === 'private' && (
              <span className="ro-contact-badge-private" title="Private to creator">
                <Lock size={11} />
                <span>Private</span>
              </span>
            )}
          </div>

          <div className="ro-contact-meta-row">
            {contact.designation && <span className="ro-contact-designation">{contact.designation}</span>}
            {contact.designation && contact.companyName && <span className="ro-contact-meta-sep">•</span>}
            {contact.companyName && <span className="ro-contact-company">{contact.companyName}</span>}
          </div>
        </div>

        <div className="ro-contact-top-actions" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className={`ro-btn-fav ${contact.isFavourite ? 'active' : ''}`}
            onClick={() => onToggleFavourite(contact.id || contact._id)}
            title={contact.isFavourite ? 'Remove from favourites' : 'Mark as favourite'}
            aria-label="Toggle favourite"
          >
            <Star size={16} fill={contact.isFavourite ? '#f59e0b' : 'none'} color={contact.isFavourite ? '#f59e0b' : 'currentColor'} />
          </button>

          <div className="ro-contact-dropdown-anchor">
            <button
              type="button"
              className="ro-btn-card-menu"
              onClick={() => setShowMenu((prev) => !prev)}
              aria-label="Contact options"
            >
              <MoreVertical size={16} />
            </button>

            {showMenu && (
              <>
                <div className="ro-menu-backdrop" onClick={() => setShowMenu(false)} />
                <div className="ro-card-dropdown-menu">
                  <button
                    type="button"
                    className="ro-dropdown-item"
                    onClick={() => {
                      setShowMenu(false);
                      onView(contact);
                    }}
                  >
                    <Eye size={14} />
                    <span>View Details</span>
                  </button>

                  <button
                    type="button"
                    className="ro-dropdown-item"
                    onClick={() => {
                      setShowMenu(false);
                      onEdit(contact);
                    }}
                  >
                    <Edit2 size={14} />
                    <span>Edit Contact</span>
                  </button>

                  {contact.isArchived ? (
                    <button
                      type="button"
                      className="ro-dropdown-item"
                      onClick={() => {
                        setShowMenu(false);
                        onRestore(contact.id || contact._id);
                      }}
                    >
                      <RotateCcw size={14} />
                      <span>Restore Contact</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="ro-dropdown-item"
                      onClick={() => {
                        setShowMenu(false);
                        onArchive(contact.id || contact._id);
                      }}
                    >
                      <Archive size={14} />
                      <span>Archive Contact</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className="ro-dropdown-item text-danger"
                    onClick={() => {
                      setShowMenu(false);
                      onDelete(contact.id || contact._id);
                    }}
                  >
                    <Trash2 size={14} />
                    <span>Delete</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Category Chip */}
      <div className="ro-contact-category-bar">
        <span className="ro-category-pill">{contact.categoryName || 'Other'}</span>
        {contact.phones?.length > 1 && (
          <span className="ro-other-phones-pill">+{contact.phones.length - 1} more numbers</span>
        )}
      </div>

      {/* Quick Action Dialing & Message Bar */}
      <div className="ro-contact-quick-actions" onClick={(e) => e.stopPropagation()}>
        {primaryPhone ? (
          <div className="ro-phone-action-group">
            <a
              href={`tel:${primaryPhone}`}
              className="ro-action-link ro-action-call"
              onClick={handleCall}
              title={`Call ${primaryPhone}`}
            >
              <Phone size={13} />
              <span>{primaryPhone}</span>
            </a>

            <button
              type="button"
              className="ro-action-icon-btn ro-action-copy"
              onClick={handleCopyPhone}
              title="Copy phone number"
              aria-label="Copy phone number"
            >
              {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
            </button>

            {hasWhatsApp && (
              <button
                type="button"
                className="ro-action-icon-btn ro-action-wa"
                onClick={handleWhatsApp}
                title="Message on WhatsApp"
                aria-label="Open WhatsApp chat"
              >
                <MessageCircle size={14} />
              </button>
            )}
          </div>
        ) : (
          <span className="ro-text-muted-xs">No phone added</span>
        )}

        {contact.email && (
          <a
            href={`mailto:${contact.email}`}
            className="ro-action-icon-btn ro-action-email"
            onClick={handleEmail}
            title={`Send email to ${contact.email}`}
            aria-label={`Send email to ${contact.email}`}
          >
            <Mail size={14} />
          </a>
        )}
      </div>

      {/* Associated Projects Bar */}
      <div className="ro-contact-projects-bar">
        {contact.projects && contact.projects.length > 0 ? (
          <div className="ro-projects-pill-list">
            <Building2 size={12} className="ro-project-icon" />
            {contact.projects.slice(0, 2).map((p) => (
              <button
                key={p.id}
                type="button"
                className="ro-project-chip-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onProjectClick?.(p.id);
                }}
                title={`Filter by ${p.name}`}
              >
                <span>{p.name}</span>
              </button>
            ))}
            {contact.projects.length > 2 && (
              <span className="ro-more-projects-count" title={contact.projects.map((p) => p.name).join(', ')}>
                +{contact.projects.length - 2}
              </span>
            )}
          </div>
        ) : (
          <div className="ro-projects-empty-tag">
            <span className="ro-dot-muted" />
            <span>Company-wide (No specific project)</span>
          </div>
        )}
      </div>
    </div>
  );
}

