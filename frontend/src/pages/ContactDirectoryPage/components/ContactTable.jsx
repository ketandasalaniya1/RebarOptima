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
  Edit2,
  Archive,
  RotateCcw,
  Trash2,
  Eye,
} from 'lucide-react';

export default function ContactTable({
  contacts = [],
  onView,
  onEdit,
  onToggleFavourite,
  onArchive,
  onRestore,
  onDelete,
  onProjectClick,
}) {
  const [copiedId, setCopiedId] = useState(null);

  const handleCopy = async (id, phone, e) => {
    e.stopPropagation();
    if (!phone) return;
    try {
      await navigator.clipboard.writeText(phone);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (_) {}
  };

  const handleWhatsApp = (name, phone, e) => {
    e.stopPropagation();
    const digits = phone.replace(/\D/g, '');
    if (!digits) return;
    const cleanNumber = digits.length === 10 ? `91${digits}` : digits;
    window.open(`https://wa.me/${cleanNumber}?text=Hello%20${encodeURIComponent(name)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="ro-contact-table-wrapper">
      <table className="ro-contact-table">
        <thead>
          <tr>
            <th className="th-fav" aria-label="Favourite"></th>
            <th>Contact Name</th>
            <th>Category</th>
            <th>Company / Designation</th>
            <th>Primary Phone</th>
            <th>Email</th>
            <th>Associated Projects</th>
            <th>Visibility</th>
            <th className="th-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((contact) => {
            const id = contact.id || contact._id;
            const primaryPhone = contact.primaryPhone || contact.phones?.[0]?.number || '';
            const hasWhatsApp = contact.phones?.some((p) => (p.isPrimary ? p.hasWhatsApp : false)) || Boolean(contact.phones?.[0]?.hasWhatsApp);

            return (
              <tr key={id} className={`ro-table-row ${contact.isArchived ? 'is-archived-row' : ''}`} onClick={() => onView(contact)}>
                {/* Favourite Star */}
                <td className="td-fav" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className={`ro-btn-table-fav ${contact.isFavourite ? 'active' : ''}`}
                    onClick={() => onToggleFavourite(id)}
                    title={contact.isFavourite ? 'Unmark favourite' : 'Mark favourite'}
                    aria-label="Toggle favourite"
                  >
                    <Star size={15} fill={contact.isFavourite ? '#f59e0b' : 'none'} color={contact.isFavourite ? '#f59e0b' : 'currentColor'} />
                  </button>
                </td>

                {/* Name & Avatar */}
                <td className="td-name">
                  <div className="ro-table-name-cell">
                    <div className="ro-table-avatar-initials">
                      {(contact.name?.[0] || 'C').toUpperCase()}
                    </div>
                    <div className="ro-table-name-meta">
                      <span className="ro-table-name-text">{contact.name}</span>
                      {contact.phones?.length > 1 && (
                        <span className="ro-table-sub-numbers">+{contact.phones.length - 1} more</span>
                      )}
                    </div>
                  </div>
                </td>

                {/* Category */}
                <td>
                  <span className="ro-category-pill">{contact.categoryName || 'Other'}</span>
                </td>

                {/* Company & Designation */}
                <td>
                  <div className="ro-table-comp-cell">
                    <span className="ro-table-comp-name">{contact.companyName || '—'}</span>
                    {contact.designation && <span className="ro-table-comp-desig">{contact.designation}</span>}
                  </div>
                </td>

                {/* Primary Phone with Click to Call, WhatsApp, Copy */}
                <td onClick={(e) => e.stopPropagation()}>
                  {primaryPhone ? (
                    <div className="ro-table-phone-cell">
                      <a href={`tel:${primaryPhone}`} className="ro-table-phone-link">
                        <Phone size={12} />
                        <span>{primaryPhone}</span>
                      </a>

                      <button
                        type="button"
                        className="ro-table-icon-btn"
                        onClick={(e) => handleCopy(id, primaryPhone, e)}
                        title="Copy phone number"
                        aria-label="Copy phone number"
                      >
                        {copiedId === id ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                      </button>

                      {hasWhatsApp && (
                        <button
                          type="button"
                          className="ro-table-icon-btn ro-action-wa"
                          onClick={(e) => handleWhatsApp(contact.name, primaryPhone, e)}
                          title="Open WhatsApp"
                          aria-label="Open WhatsApp"
                        >
                          <MessageCircle size={13} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="ro-text-muted-xs">—</span>
                  )}
                </td>

                {/* Email */}
                <td onClick={(e) => e.stopPropagation()}>
                  {contact.email ? (
                    <a href={`mailto:${contact.email}`} className="ro-table-email-link" title={contact.email}>
                      <Mail size={12} />
                      <span>{contact.email}</span>
                    </a>
                  ) : (
                    <span className="ro-text-muted-xs">—</span>
                  )}
                </td>

                {/* Projects */}
                <td onClick={(e) => e.stopPropagation()}>
                  {contact.projects && contact.projects.length > 0 ? (
                    <div className="ro-table-projects-list">
                      {contact.projects.slice(0, 2).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="ro-table-project-pill"
                          onClick={() => onProjectClick?.(p.id)}
                          title={`Filter by ${p.name}`}
                        >
                          {p.name}
                        </button>
                      ))}
                      {contact.projects.length > 2 && (
                        <span className="ro-table-more-pill" title={contact.projects.map((p) => p.name).join(', ')}>
                          +{contact.projects.length - 2}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="ro-text-muted-xs">Company-wide</span>
                  )}
                </td>

                {/* Visibility */}
                <td>
                  {contact.visibility === 'private' ? (
                    <span className="ro-table-badge-private">
                      <Lock size={11} />
                      <span>Private</span>
                    </span>
                  ) : (
                    <span className="ro-table-badge-shared">Shared</span>
                  )}
                </td>

                {/* Actions */}
                <td className="td-actions" onClick={(e) => e.stopPropagation()}>
                  <div className="ro-table-action-btns">
                    <button
                      type="button"
                      className="ro-table-btn-act"
                      onClick={() => onView(contact)}
                      title="View details"
                      aria-label="View details"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      type="button"
                      className="ro-table-btn-act"
                      onClick={() => onEdit(contact)}
                      title="Edit contact"
                      aria-label="Edit contact"
                    >
                      <Edit2 size={14} />
                    </button>
                    {contact.isArchived ? (
                      <button
                        type="button"
                        className="ro-table-btn-act"
                        onClick={() => onRestore(id)}
                        title="Restore contact"
                        aria-label="Restore contact"
                      >
                        <RotateCcw size={14} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="ro-table-btn-act"
                        onClick={() => onArchive(id)}
                        title="Archive contact"
                        aria-label="Archive contact"
                      >
                        <Archive size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="ro-table-btn-act text-danger"
                      onClick={() => onDelete(id)}
                      title="Delete contact"
                      aria-label="Delete contact"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

